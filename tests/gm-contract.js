/* One behavioural suite, run twice.
 *
 * The userscript is written against a userscript manager's GM_* API, and
 * scripts/build-extension.js hand-reimplements that API on top of chrome.storage
 * for the extension builds. Four shipped defects came from that reimplementation
 * quietly dropping a guarantee the userscript depends on — a storage snapshot
 * instead of a live read, swallowed write and clipboard rejections, and a renamed
 * response field — and every one of them survived a green test run, because the
 * extension checks validated manifest shape and never bridge semantics.
 *
 * So the contract below is expressed once and asserted against both
 * implementations. A guarantee that holds for the manager but not for the bridge
 * fails here, which is the only place it can be caught without a browser.
 */
const assert = require('assert');
const vm = require('vm');
const { EXTENSION_BRIDGE_SOURCE } = require('../scripts/build-extension.js');

let failures = 0;
function check(implementation, name, fn) {
    return Promise.resolve()
        .then(fn)
        .then(() => console.log(`ok - [${implementation}] ${name}`))
        .catch(error => {
            failures += 1;
            console.log(`not ok - [${implementation}] ${name}`);
            console.log(String(error && error.stack || error));
        });
}

const clone = value => (value === undefined || value === null ? value : JSON.parse(JSON.stringify(value)));
const settle = () => new Promise(resolve => setImmediate(resolve));

/* ---------------------------------------------------------------------------
 * Implementation A — a userscript manager, modelled on the semantics the
 * userscript was written against: storage reads are live, and a rejected write
 * throws at the call site.
 * ------------------------------------------------------------------------- */
function createManagerAdapter() {
    const store = new Map();
    let failWrite = null;
    let failClipboard = null;
    const observed = { writeFailures: 0, clipboardFailures: 0 };

    return {
        name: 'userscript manager',
        gm: {
            getValue: (key, fallback) => (store.has(key) ? clone(store.get(key)) : clone(fallback)),
            setValue: (key, value) => {
                if (failWrite) { const error = failWrite; failWrite = null; observed.writeFailures += 1; throw error; }
                store.set(key, clone(value));
            },
            deleteValue: key => {
                if (failWrite) { const error = failWrite; failWrite = null; observed.writeFailures += 1; throw error; }
                store.delete(key);
            },
            listValues: () => [...store.keys()],
            setClipboard: () => {
                if (failClipboard) { const error = failClipboard; failClipboard = null; observed.clipboardFailures += 1; throw error; }
            },
            xmlHttpRequest: options => {
                // Managers hand back finalUrl, which is why every consumer reads it.
                setImmediate(() => options.onload && options.onload({
                    status: 200,
                    responseText: 'body',
                    finalUrl: pendingResponseUrl,
                }));
                return { abort() {} };
            },
        },
        externalChange: (key, value) => { store.set(key, value); },
        failNextWrite: error => { failWrite = error; },
        failNextClipboard: error => { failClipboard = error; },
        observed,
        settle,
    };
}

/* ---------------------------------------------------------------------------
 * Implementation B — the generated MV3 bridge, executed as it ships.
 * ------------------------------------------------------------------------- */
let pendingResponseUrl = 'https://example.test/final';

async function createBridgeAdapter() {
    const store = Object.create(null);
    const changeListeners = [];
    const observed = { writeFailures: 0, clipboardFailures: 0 };
    let failWriteMessage = null;
    let clipboardRejection = null;

    const withLastError = (message, run) => {
        chromeStub.runtime.lastError = message ? { message } : null;
        try { run(); } finally { chromeStub.runtime.lastError = null; }
    };

    const chromeStub = {
        runtime: {
            lastError: null,
            sendMessage: (message, callback) => {
                if (typeof callback !== 'function') return;
                if (message.type === 'imdb-enhanced:http') {
                    setImmediate(() => callback({
                        status: 200,
                        responseText: 'body',
                        responseURL: pendingResponseUrl,
                    }));
                }
            },
        },
        storage: {
            local: {
                get: (arg, callback) => {
                    const done = typeof arg === 'function' ? arg : callback;
                    setImmediate(() => done({ ...store }));
                },
                set: (values, callback) => setImmediate(() => {
                    if (failWriteMessage) {
                        const message = failWriteMessage;
                        failWriteMessage = null;
                        withLastError(message, () => callback());
                        return;
                    }
                    Object.assign(store, values);
                    callback();
                }),
                remove: (key, callback) => setImmediate(() => {
                    if (failWriteMessage) {
                        const message = failWriteMessage;
                        failWriteMessage = null;
                        withLastError(message, () => callback());
                        return;
                    }
                    delete store[key];
                    callback();
                }),
            },
            onChanged: { addListener: fn => changeListeners.push(fn) },
        },
    };

    const context = {
        chrome: chromeStub,
        console,
        setTimeout,
        structuredClone,
        Promise, Object, JSON, Error, String, Number, Date, Array,
        navigator: {
            clipboard: {
                writeText: () => (clipboardRejection
                    ? Promise.reject(clipboardRejection)
                    : Promise.resolve()),
            },
        },
        document: {
            documentElement: { setAttribute() {}, removeAttribute() {} },
            dispatchEvent: event => {
                if (event.type === 'imdb-enhanced:settings-save-failed') observed.writeFailures += 1;
                if (event.type === 'imdb-enhanced:clipboard-failed') observed.clipboardFailures += 1;
                return true;
            },
        },
        CustomEvent: class { constructor(type) { this.type = type; } },
    };
    context.globalThis = context;
    vm.createContext(context);
    await vm.runInContext(`(async () => {\n${EXTENSION_BRIDGE_SOURCE}\n})()`, context);

    const guard = fn => (...args) => {
        try { return fn(...args); }
        catch (error) { observed.writeFailures += 0; throw error; }
    };

    return {
        name: 'MV3 bridge',
        gm: {
            getValue: context.GM_getValue,
            setValue: guard(context.GM_setValue),
            deleteValue: guard(context.GM_deleteValue),
            listValues: context.GM_listValues,
            setClipboard: context.GM_setClipboard,
            xmlHttpRequest: context.GM_xmlhttpRequest,
        },
        // Another tab writing to chrome.storage.local reaches this page only as an
        // onChanged event; there is no shared synchronous store to mutate.
        externalChange: (key, value) => {
            store[key] = value;
            changeListeners.forEach(fn => fn({ [key]: { newValue: value } }, 'local'));
        },
        failNextWrite: error => { failWriteMessage = error.message; },
        failNextClipboard: error => { clipboardRejection = error; },
        observed,
        settle,
    };
}

/* ---------------------------------------------------------------------------
 * The contract. Every assertion here is a guarantee the userscript relies on.
 * ------------------------------------------------------------------------- */
async function runContract(adapter) {
    const label = adapter.name;
    const { gm } = adapter;

    await check(label, 'a written value reads back immediately', () => {
        gm.setValue('imdb_enh_theme', 'oled');
        assert.strictEqual(gm.getValue('imdb_enh_theme', 'dark'), 'oled');
        assert.strictEqual(gm.getValue('imdb_enh_missing', 'fallback'), 'fallback');
    });

    await check(label, 'stored values are cloned, not aliased', () => {
        const marks = { tt1: { state: 'seen' } };
        gm.setValue('imdb_enh_userMarks', marks);
        marks.tt1.state = 'mutated';
        assert.strictEqual(gm.getValue('imdb_enh_userMarks', {}).tt1.state, 'seen');
    });

    /* setUserMark re-reads storage immediately before every write so a second tab
       cannot clobber marks written by the first. A page-lifetime snapshot turns
       that defence into a no-op and silently loses data. */
    await check(label, 'a change made in another context becomes visible to a later read', async () => {
        gm.setValue('imdb_enh_userMarks', { tt1: { state: 'seen' } });
        adapter.externalChange('imdb_enh_userMarks', { tt1: { state: 'seen' }, tt2: { state: 'skip' } });
        await adapter.settle();
        const marks = gm.getValue('imdb_enh_userMarks', {});
        assert.deepStrictEqual(Object.keys(marks).sort(), ['tt1', 'tt2'],
            'a mark written by another tab must be visible, or the next write erases it');
    });

    await check(label, 'listValues reflects writes and deletes', async () => {
        gm.setValue('imdb_enh_temp', 1);
        assert(gm.listValues().includes('imdb_enh_temp'));
        gm.deleteValue('imdb_enh_temp');
        await adapter.settle();
        assert(!gm.listValues().includes('imdb_enh_temp'));
    });

    /* trySaveSetting, the settings-import rollback and the "Save failed" header
       state all key off a failed write throwing. The manager throws at the call;
       the bridge cannot know yet, so it throws on the next one. The contract is the
       throw — asserting only that a failure *event* fired would still pass while
       the value silently never reached storage. */
    await check(label, 'a rejected write throws rather than reporting success', async () => {
        let threw = false;
        adapter.failNextWrite(new Error('simulated quota failure'));
        try { gm.setValue('imdb_enh_theme', 'midnight'); } catch { threw = true; }
        await adapter.settle();
        try { gm.setValue('imdb_enh_theme', 'light'); } catch { threw = true; }
        await adapter.settle();
        assert(threw, 'a storage failure must reach the caller, not just the UI');
    });

    await check(label, 'a refused clipboard write throws rather than announcing a copy', async () => {
        let threw = false;
        adapter.failNextClipboard(new Error('clipboard permission denied'));
        try { gm.setClipboard('tt0903747'); } catch { threw = true; }
        await adapter.settle();
        try { gm.setClipboard('tt0903747'); } catch { threw = true; }
        await adapter.settle();
        assert(threw, 'a refused copy must not report success');
    });

    /* Five call sites re-validate the URL a lookup actually landed on, to reject a
       cross-origin redirect away from the service they asked for. They read
       finalUrl; a response that omits it makes every one of them fall back to the
       pre-redirect guess. */
    await check(label, 'a response exposes the URL it actually resolved to', async () => {
        pendingResponseUrl = 'https://www.rottentomatoes.com/m/the-matrix';
        const response = await new Promise(resolve => {
            gm.xmlHttpRequest({ url: 'https://www.rottentomatoes.com/search?q=matrix', onload: resolve });
        });
        assert.strictEqual(response.finalUrl, pendingResponseUrl,
            'post-redirect URL validation depends on finalUrl');
    });
}

(async () => {
    await runContract(createManagerAdapter());
    await runContract(await createBridgeAdapter());
    if (failures) {
        console.error(`\n${failures} GM contract check(s) failed.`);
        process.exit(1);
    }
    console.log('GM contract holds for both the userscript manager and the MV3 bridge.');
})();
