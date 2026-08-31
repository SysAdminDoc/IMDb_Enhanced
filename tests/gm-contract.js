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
    const observed = { writeFailures: 0, clipboardFailures: 0, writeFailureKeys: [] };

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
        // A manager writes synchronously, so a caller always knows which write failed:
        // the throw happens at its own call site. Only the async bridge has to say.
        asyncWrites: false,
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

async function createBridgeAdapter({ seed = {} } = {}) {
    const store = Object.create(null);
    Object.assign(store, seed);
    const changeListeners = [];
    const observed = { writeFailures: 0, clipboardFailures: 0, writeFailureKeys: [] };
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
                if (event.type === 'imdb-enhanced:settings-save-failed') {
                    observed.writeFailures += 1;
                    observed.writeFailureKeys.push(event.detail?.key);
                }
                if (event.type === 'imdb-enhanced:clipboard-failed') observed.clipboardFailures += 1;
                return true;
            },
        },
        // detail was dropped here, which made a failure event's payload untestable.
        CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
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
        asyncWrites: true,
        failNextWrite: error => { failWriteMessage = error.message; },
        failNextClipboard: error => { clipboardRejection = error; },
        observed,
        settle,
        // Only the bridge has a credential boundary; the manager has nothing to redact.
        credentials: {
            isConfigured: key => context.__imdbEnhancedCredentialConfigured(key),
            backingStore: () => ({ ...store }),
        },
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

    /* A rejected write means the value never reached storage, so a reader must not go on
       seeing it. The MV3 bridge writes to its mirror first and only learns of the
       rejection later, which left GM_getValue and GM_listValues describing a store that
       did not exist — and the lookup cache sizes itself from exactly those two, so it
       counted bytes nothing was holding and stopped evicting when it should have. */
    await check(label, 'a rejected write leaves no trace in what the store reports', async () => {
        gm.setValue('imdb_enh_rollback', 'original');
        await adapter.settle();
        adapter.failNextWrite(new Error('simulated quota failure'));
        try { gm.setValue('imdb_enh_rollback', 'never-stored'); } catch { /* reported below */ }
        await adapter.settle();
        assert.strictEqual(gm.getValue('imdb_enh_rollback', null), 'original',
            'a value that failed to store must not be readable afterwards');

        adapter.failNextWrite(new Error('simulated quota failure'));
        try { gm.setValue('imdb_enh_brand_new', 'never-stored'); } catch { /* reported below */ }
        await adapter.settle();
        assert.strictEqual(gm.getValue('imdb_enh_brand_new', null), null,
            'a new key whose write failed must not appear to exist');
        assert(!gm.listValues().includes('imdb_enh_brand_new'),
            'a key whose write failed must not be listed');
    });

    /* The rollback must identify the write it is undoing, not the value. Two writes of
       the same primitive in flight, the first rejecting, would otherwise revert the
       second — which succeeded. */
    if (adapter.asyncWrites) {
        await check(label, 'a rejected write does not roll back a later successful one', async () => {
            /* An earlier check can leave both an armed rejection and an unthrown failure
               behind. Draining takes two passes: one write to absorb the armed rejection,
               a second to absorb the failure that rejection then records. Without this the
               setup below throws instead of the write actually under test. */
            const drain = async () => {
                for (let pass = 0; pass < 3; pass += 1) {
                    try { gm.setValue('imdb_enh_drain', String(pass)); } catch { /* that is the point */ }
                    await adapter.settle();
                }
            };
            await drain();

            gm.setValue('imdb_enh_race', 'before');
            await adapter.settle();

            adapter.failNextWrite(new Error('simulated quota failure'));
            // The same value written twice: the first rejects, the second succeeds.
            try { gm.setValue('imdb_enh_race', 'after'); } catch { /* reported via the event */ }
            try { gm.setValue('imdb_enh_race', 'after'); } catch { /* the earlier failure may surface here */ }
            await adapter.settle();
            assert.strictEqual(gm.getValue('imdb_enh_race', null), 'after',
                'the successful write must survive the earlier rejection of an identical value');

            // Leave nothing armed for the checks that follow.
            await drain();
        });
    }

    /* Only meaningful where writes are asynchronous. A synchronous manager satisfies this
       by construction — the throw lands at the caller's own call site, so it already
       knows which key. The bridge's rejection arrives later, and its next-call throw can
       surface on a completely different key, so it has to name the one that failed or a
       caller managing its own storage budget (the lookup cache) cannot act on it. */
    if (adapter.asyncWrites) {
        await check(label, 'a write failure names the key that failed', async () => {
            adapter.observed.writeFailureKeys.length = 0;
            adapter.failNextWrite(new Error('simulated quota failure'));
            try { gm.setValue('cache_rt_tt0133093', 'x'); } catch { /* reported via the event */ }
            await adapter.settle();
            assert.deepStrictEqual(adapter.observed.writeFailureKeys, ['cache_rt_tt0133093'],
                'the failure event must identify the key whose write was rejected');
        });
    }

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

/* The credential boundary, executed rather than matched in source. Three mutations that
   kept credential values in the content world all survived the source-text assertion in
   tests/extension.js, which is the whole reason this is here: the claim is about what the
   bridge does, so it has to be asked of the bridge. */
async function runCredentialBoundary() {
    const label = 'MV3 bridge';
    const pre = 'PRE-EXISTING-SECRET';
    const typed = 'JUST-TYPED-SECRET';

    await check(label, 'a credential already in storage never enters the content world', async () => {
        const bridge = await createBridgeAdapter({ seed: { imdb_enh_radarrApiKey: pre, imdb_enh_themeVariant: 'oled' } });
        assert.strictEqual(bridge.gm.getValue('imdb_enh_radarrApiKey', ''), '',
            'the value must not be readable from the page tab');
        assert.strictEqual(bridge.gm.getValue('imdb_enh_themeVariant', ''), 'oled',
            'an ordinary setting must still be readable, or the mirror is simply broken');
        assert(!bridge.gm.listValues().includes('imdb_enh_radarrApiKey'),
            'nor discoverable by listing what is stored');
        assert.strictEqual(bridge.credentials.isConfigured('imdb_enh_radarrApiKey'), true,
            'but the field must still be able to say one is set');
        assert.strictEqual(bridge.credentials.isConfigured('imdb_enh_sonarrApiKey'), false);
    });

    /* The one the source-text check could never have caught: a credential typed into the
       settings panel went through GM_setValue, which put it straight into the mirror. It
       stayed readable in that tab until the page was reloaded. */
    await check(label, 'a credential typed into the panel never enters the content world either', async () => {
        const bridge = await createBridgeAdapter();
        bridge.gm.setValue('imdb_enh_plexToken', typed);
        assert.strictEqual(bridge.gm.getValue('imdb_enh_plexToken', ''), '',
            'the value must not be readable straight after writing it');
        await bridge.settle();
        assert.strictEqual(bridge.gm.getValue('imdb_enh_plexToken', ''), '',
            'nor once the change event has come back');
        assert(!bridge.gm.listValues().includes('imdb_enh_plexToken'));
        assert.strictEqual(bridge.credentials.isConfigured('imdb_enh_plexToken'), true,
            'the field must know one is now set');
        assert.strictEqual(bridge.credentials.backingStore().imdb_enh_plexToken, typed,
            'and it must really have been stored, or the setting silently did nothing');
    });

    await check(label, 'a credential changed in another tab updates only whether it is set', async () => {
        const bridge = await createBridgeAdapter({ seed: { imdb_enh_embyApiKey: pre } });
        bridge.externalChange('imdb_enh_embyApiKey', 'ROTATED-SECRET');
        assert.strictEqual(bridge.gm.getValue('imdb_enh_embyApiKey', ''), '',
            'a value arriving by change event must not be adopted either');
        assert.strictEqual(bridge.credentials.isConfigured('imdb_enh_embyApiKey'), true);
        bridge.externalChange('imdb_enh_embyApiKey', '');
        assert.strictEqual(bridge.credentials.isConfigured('imdb_enh_embyApiKey'), false,
            'clearing it elsewhere must be reflected');
    });
}

(async () => {
    await runContract(createManagerAdapter());
    await runContract(await createBridgeAdapter());
    await runCredentialBoundary();
    if (failures) {
        console.error(`\n${failures} GM contract check(s) failed.`);
        process.exit(1);
    }
    console.log('GM contract holds for both the userscript manager and the MV3 bridge.');
})();
