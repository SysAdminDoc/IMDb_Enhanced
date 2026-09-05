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
    /* The same size bound the bridge adapter models. A script manager backs GM_setValue
       with the extension's own storage, so it has a ceiling too, and a write past it
       throws here exactly as a rejected write does. */
    let quotaBytes = Infinity;
    const sizeWith = (key, value) => [...store.entries()]
        .filter(([name]) => name !== key)
        .concat([[key, value]])
        .reduce((total, [name, held]) => total
            + Buffer.byteLength(name, 'utf8')
            + Buffer.byteLength(JSON.stringify(held) ?? '', 'utf8'), 0);
    const observed = { writeFailures: 0, clipboardFailures: 0, writeFailureKeys: [] };

    return {
        name: 'userscript manager',
        setQuotaBytes: bytes => { quotaBytes = bytes; },
        gm: {
            getValue: (key, fallback) => (store.has(key) ? clone(store.get(key)) : clone(fallback)),
            setValue: (key, value) => {
                if (failWrite) { const error = failWrite; failWrite = null; observed.writeFailures += 1; throw error; }
                if (sizeWith(key, value) > quotaBytes) {
                    observed.writeFailures += 1;
                    throw new Error('QUOTA_BYTES quota exceeded');
                }
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
                    status: pendingResponseStatus,
                    responseText: 'body',
                    finalUrl: pendingResponseUrl,
                    // A manager hands back the raw header block; the page reads it.
                    ...(pendingRetryAfterMs === null
                        ? {}
                        : { responseHeaders: `content-type: text/html
Retry-After: ${pendingRetryAfterMs / 1000}
` }),
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
let pendingResponseStatus = 200;
let pendingRetryAfterMs = null;

async function createBridgeAdapter({ seed = {}, trusted = false } = {}) {
    const store = Object.create(null);
    Object.assign(store, seed);
    const changeListeners = [];
    const observed = { writeFailures: 0, clipboardFailures: 0, writeFailureKeys: [] };
    /* A queue, not a single slot: sustained quota pressure fails every write, and a
       one-shot flag could not express two failures in flight, which is the shape that
       exposed the rollback restoring an earlier unstored value. */
    const failWriteMessages = [];
    /* Bytes the store may hold in total, the way chrome.storage.local bounds it. Off by
       default so every existing case is unaffected; set it and a write large enough to
       cross it is refused by the backend rather than by a flag somebody set. */
    let quotaBytes = Infinity;
    const storedSize = extra => {
        const merged = { ...store, ...(extra || {}) };
        return Object.entries(merged)
            .reduce((total, [key, value]) => total
                + Buffer.byteLength(key, 'utf8')
                + Buffer.byteLength(JSON.stringify(value) ?? '', 'utf8'), 0);
    };
    // Writes deferred by holdNextWrite, released together by releaseHeldWrites.
    const heldWrites = [];
    let holdCount = 0;
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
                        status: pendingResponseStatus,
                        responseText: 'body',
                        responseURL: pendingResponseUrl,
                        ...(pendingRetryAfterMs === null ? {} : { retryAfterMs: pendingRetryAfterMs }),
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
                set: (values, callback) => {
                    /* chrome.storage.local settles in whatever order it settles. Holding
                       one write open is the only way to reproduce an earlier write
                       confirming after a later one, which is the case the ordering token
                       in the bridge exists for. */
                    const run = () => setImmediate(() => {
                        if (failWriteMessages.length) {
                            withLastError(failWriteMessages.shift(), () => callback());
                            return;
                        }
                        if (storedSize(values) > quotaBytes) {
                            withLastError('QUOTA_BYTES quota exceeded', () => callback());
                            return;
                        }
                        Object.assign(store, values);
                        callback();
                    });
                    if (holdCount > 0) { holdCount -= 1; heldWrites.push(run); return; }
                    run();
                },
                remove: (key, callback) => setImmediate(() => {
                    if (failWriteMessages.length) {
                        withLastError(failWriteMessages.shift(), () => callback());
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
    /* The options page runs this same bridge with the trusted flag set, so the suite
       instantiates it that way rather than paraphrasing it. */
    const bridgeSource = trusted
        ? EXTENSION_BRIDGE_SOURCE.replace('__TRUSTED_CONTEXT = false', '__TRUSTED_CONTEXT = true')
        : EXTENSION_BRIDGE_SOURCE;
    if (trusted && bridgeSource === EXTENSION_BRIDGE_SOURCE) {
        throw new Error('The trusted-context flag could not be found in the bridge source.');
    }
    await vm.runInContext(`(async () => {\n${bridgeSource}\n})()`, context);

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
        failNextWrite: error => { failWriteMessages.push(error.message); },
        setQuotaBytes: bytes => { quotaBytes = bytes; },
        storedSize: () => storedSize(),
        failNextClipboard: error => { clipboardRejection = error; },
        holdNextWrite: () => { holdCount += 1; },
        releaseHeldWrites: () => { heldWrites.splice(0).forEach(run => run()); },
        observed,
        settle,
        // Only the bridge has a credential boundary; the manager has nothing to redact.
        credentials: {
            isConfigured: key => Boolean(context.__imdbEnhancedCredentialConfigured?.(key)),
            hookDefined: () => typeof context.__imdbEnhancedCredentialConfigured === 'function',
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

    /* Every other rejection in this file is injected: something calls failNextWrite and the
       backend obeys. A real store refuses because of size, and that path was never taken,
       so "a large library writes and reads back" was asserted nowhere. The backend derives
       the refusal from what it is being asked to hold. */
    await check(label, 'a large library writes and reads back, and is refused when it will not fit', async () => {
        const marks = {};
        for (let index = 0; index < 2000; index += 1) {
            marks[`tt${String(index).padStart(7, '0')}`] = {
                state: index % 2 ? 'watched' : 'skip',
                title: `Title ${index}`,
                ts: index,
                viewings: [{ date: '2025-01-01', rating: 8 }],
            };
        }
        const size = JSON.stringify(marks).length;
        assert.ok(size > 100000, `the sample should be a real library, got ${size} bytes`);

        adapter.setQuotaBytes(Infinity);
        gm.setValue('imdb_enh_userMarks', marks);
        await adapter.settle();
        assert.strictEqual(Object.keys(gm.getValue('imdb_enh_userMarks', {})).length, 2000,
            'a store this size goes in and comes back whole');

        /* And the same write against a backend too small for it is refused rather than
           silently truncated, which is the failure a quota actually produces. The bridge
           cannot throw on the call itself, because chrome.storage answers later; it
           surfaces the rejection on the next write, which is the shape the injected-failure
           case above already relies on. */
        gm.setValue('imdb_enh_userMarks', {});
        await adapter.settle();
        adapter.setQuotaBytes(1024);
        let refused = false;
        try { gm.setValue('imdb_enh_userMarks', marks); } catch { refused = true; }
        await adapter.settle();
        try { gm.setValue('imdb_enh_probe', 'after'); } catch { refused = true; }
        await adapter.settle();
        assert.ok(refused, 'a store larger than the quota must reach the caller as a failure');
        assert.notStrictEqual(Object.keys(gm.getValue('imdb_enh_userMarks', {})).length, 2000,
            'and it must not be reported as stored');

        adapter.setQuotaBytes(Infinity);
        gm.setValue('imdb_enh_userMarks', {});
        gm.deleteValue('imdb_enh_probe');
        await adapter.settle();
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

    /* IE-100: the shadow store existed so a rejected write could put back what storage
       last confirmed. For a cache entry there is nothing to put back that is worth
       keeping: the reader treats a miss as "ask the provider again", and holding a copy
       of every cached lookup doubled what this world keeps in memory for no gain. The
       proof is that the value is not reachable through the rollback afterwards. */
    if (adapter.asyncWrites) {
        await check(label, 'a rejected cache write drops the entry rather than restoring a shadowed copy', async () => {
            const drain = async () => {
                for (let pass = 0; pass < 3; pass += 1) {
                    try { gm.setValue('imdb_enh_drain', String(pass)); } catch { /* that is the point */ }
                    await adapter.settle();
                }
            };
            await drain();

            // The size the item is actually about: one entry may reach 256 KiB.
            const bulky = 'x'.repeat(200 * 1024);
            gm.setValue('cache_rt_tt0133093', bulky);
            await adapter.settle();
            assert.strictEqual(gm.getValue('cache_rt_tt0133093', null), bulky,
                'a stored cache entry must be readable, or the rollback below proves nothing');

            adapter.failNextWrite(new Error('simulated quota failure'));
            try { gm.setValue('cache_rt_tt0133093', 'a smaller entry'); } catch { /* reported via the event */ }
            await adapter.settle();
            assert.strictEqual(gm.getValue('cache_rt_tt0133093', null), null,
                'the earlier cache value must not come back from a shadow copy');
            assert(!gm.listValues().includes('cache_rt_tt0133093'),
                'and nothing may be left for the cache to size itself from');

            // A setting is not disposable, and its rollback is unchanged. Drain first:
            // the rejection armed above surfaces on whatever write comes next.
            await drain();
            gm.setValue('imdb_enh_theme', 'oled');
            await adapter.settle();
            adapter.failNextWrite(new Error('simulated quota failure'));
            try { gm.setValue('imdb_enh_theme', 'light'); } catch { /* reported via the event */ }
            await adapter.settle();
            assert.strictEqual(gm.getValue('imdb_enh_theme', null), 'oled',
                'an ordinary setting still rolls back to what storage confirmed');

            await drain();
        });
    }

    /* IE-101: the same defect one step later. The rollback above identifies the write it
       is undoing; the confirm has to as well. Storage settles in its own order, so an
       earlier write can land after a later one, and a confirm that does not check whether
       it is still the current write records a value that has already been superseded. The
       next rejected write then restores that stale value, which is exactly the bug the
       rollback token was added to prevent. */
    if (adapter.asyncWrites && adapter.holdNextWrite) {
        await check(label, 'a confirm that arrives late does not become the value a rollback restores', async () => {
            const drain = async () => {
                for (let pass = 0; pass < 3; pass += 1) {
                    try { gm.setValue('imdb_enh_drain', String(pass)); } catch { /* that is the point */ }
                    await adapter.settle();
                }
            };
            await drain();

            adapter.holdNextWrite();
            gm.setValue('imdb_enh_order', 'first');
            gm.setValue('imdb_enh_order', 'second');
            await adapter.settle();
            // The later write has confirmed; the earlier one is still in flight.
            adapter.releaseHeldWrites();
            await adapter.settle();
            await adapter.settle();
            assert.strictEqual(gm.getValue('imdb_enh_order', null), 'second',
                'a late-settling earlier write must not change what the mirror reports');

            adapter.failNextWrite(new Error('simulated quota failure'));
            try { gm.setValue('imdb_enh_order', 'third'); } catch { /* reported via the event */ }
            await adapter.settle();
            assert.strictEqual(gm.getValue('imdb_enh_order', null), 'second',
                'a rejected write must roll back to the write that actually won, not to a superseded one');

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

    /* The other field the page cannot get any other way. A manager hands back the raw
       header block and the page reads Retry-After out of it; a worker cannot, so it parses
       the seconds and passes a number. The bridge dropped it while rebuilding the response,
       so every rate-limit hold fell back to the default minute and a service asking for ten
       was re-asked at one — the loop the hold exists to prevent. */
    await check(label, 'a rate-limited response carries the wait the service asked for', async () => {
        pendingResponseStatus = 429;
        pendingRetryAfterMs = 600000;
        try {
            const response = await new Promise(resolve => {
                gm.xmlHttpRequest({ url: 'https://graphql.anilist.co/', onload: resolve });
            });
            assert.strictEqual(response.status, 429);
            /* Each shape carries it the way that shape can: a manager passes the header
               block through, the bridge parses the one header and passes a number. What
               matters is that neither drops it, since the page has no other source. */
            const carried = Number.isFinite(Number(response.retryAfterMs))
                ? Number(response.retryAfterMs) === 600000
                : /retry-after:[ 	]*600(?![0-9])/i.test(String(response.responseHeaders || ''));
            assert(carried,
                `the hold length has to reach the page: ${JSON.stringify(response)}`);
        } finally {
            pendingResponseStatus = 200;
            pendingRetryAfterMs = null;
        }
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

    /* The single-failure case was already covered and passed. Two in flight was not, and
       that is the shape sustained quota pressure actually produces: the second write's
       rollback restored what the mirror held, which was the first write's value, itself
       never stored. The page kept showing a mark that did not exist while the user was
       told twice that nothing had been saved. */
    await check(label, 'two rejected writes in a row leave nothing behind in the mirror', async () => {
        const bridge = await createBridgeAdapter({ seed: { imdb_enh_userMarks: { tt0000009: { state:'skip' } } } });
        bridge.failNextWrite(new Error('simulated quota failure'));
        try { bridge.gm.setValue('imdb_enh_userMarks', { tt0000001:{ state:'watched' } }); } catch { /* reported below */ }
        bridge.failNextWrite(new Error('simulated quota failure'));
        try { bridge.gm.setValue('imdb_enh_userMarks', { tt0000001:{ state:'watched' }, tt0000002:{ state:'watched' } }); } catch { /* reported below */ }
        await bridge.settle();
        await bridge.settle();
        assert.deepStrictEqual(
            bridge.gm.getValue('imdb_enh_userMarks', null),
            { tt0000009: { state:'skip' } },
            'the mirror must report what storage actually holds, not an earlier write that also failed');
        assert.deepStrictEqual(
            bridge.credentials.backingStore().imdb_enh_userMarks,
            { tt0000009: { state:'skip' } },
            'and storage really must be unchanged, or the premise is wrong');
    });

    await check(label, 'a rejected write after a successful one falls back to the successful value', async () => {
        const bridge = await createBridgeAdapter();
        bridge.gm.setValue('imdb_enh_themeVariant', 'oled');
        await bridge.settle();
        bridge.failNextWrite(new Error('simulated quota failure'));
        try { bridge.gm.setValue('imdb_enh_themeVariant', 'light'); } catch { /* reported below */ }
        await bridge.settle();
        assert.strictEqual(bridge.gm.getValue('imdb_enh_themeVariant', ''), 'oled',
            'a value that really was stored must survive a later failure');
    });

    /* Found by adversarial review. The confirmed-value shadow recorded every successful
       write, including a credential's, and the next rejected write to that key restored it
       into the mirror. So a key typed into the settings panel stayed out of this world only
       until the next write failed, which under quota pressure is immediately. */
    await check(label, 'a rejected write never restores a credential into the content world', async () => {
        const bridge = await createBridgeAdapter();
        bridge.gm.setValue('imdb_enh_plexToken', 'SUPER-SECRET-PLEX-TOKEN');
        await bridge.settle();
        assert.strictEqual(bridge.gm.getValue('imdb_enh_plexToken', ''), '', 'not readable after a successful write');

        bridge.failNextWrite(new Error('simulated quota failure'));
        try { bridge.gm.setValue('imdb_enh_plexToken', 'REPLACEMENT'); } catch { /* reported below */ }
        await bridge.settle();
        assert.strictEqual(bridge.gm.getValue('imdb_enh_plexToken', ''), '',
            'and still not readable after a rejected one, which is when the rollback runs');
        assert(!bridge.gm.listValues().includes('imdb_enh_plexToken'),
            'nor listed as something this world holds');
        assert.strictEqual(bridge.credentials.isConfigured('imdb_enh_plexToken'), true,
            'while the field still knows one is stored');
        assert.strictEqual(bridge.credentials.backingStore().imdb_enh_plexToken, 'SUPER-SECRET-PLEX-TOKEN',
            'and storage still holds the one that did land');
    });

    await check(label, 'repeated failures never make a credential readable', async () => {
        const bridge = await createBridgeAdapter({ seed: { imdb_enh_embyApiKey: 'SEEDED-SECRET' } });
        for (let attempt = 0; attempt < 3; attempt += 1) {
            bridge.failNextWrite(new Error('simulated quota failure'));
            try { bridge.gm.setValue('imdb_enh_embyApiKey', `attempt-${attempt}`); } catch { /* reported below */ }
            await bridge.settle();
            assert.strictEqual(bridge.gm.getValue('imdb_enh_embyApiKey', ''), '',
                `readable after failure ${attempt + 1}`);
        }
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

/* The options page runs the same bridge with __TRUSTED_CONTEXT true, and it is the one
   surface that can produce an encrypted backup. It must therefore read credentials, and
   must not advertise the hook that tells the rest of the code they are being withheld:
   doing so made it conclude it could not read the keys it was holding, and the encrypted
   export refused, telling the user to go to the page they were already on. */
async function runTrustedContext() {
    const label = 'MV3 bridge (options page)';
    const trustedSource = EXTENSION_BRIDGE_SOURCE.replace('__TRUSTED_CONTEXT = false', '__TRUSTED_CONTEXT = true');
    assert.notStrictEqual(trustedSource, EXTENSION_BRIDGE_SOURCE, 'the trusted flag must be findable');

    await check(label, 'reads credentials and does not claim they are withheld', async () => {
        const bridge = await createBridgeAdapter({ seed: { imdb_enh_radarrApiKey: 'REAL-KEY' }, trusted: true });
        assert.strictEqual(bridge.gm.getValue('imdb_enh_radarrApiKey', ''), 'REAL-KEY',
            'the page that makes the encrypted backup must be able to read what goes in it');
        assert(bridge.gm.listValues().includes('imdb_enh_radarrApiKey'), 'and see that it is there');
        assert.strictEqual(bridge.credentials.hookDefined(), false,
            'and must not define the withheld-value hook, which is what makes callers give up');
    });

    await check(label, 'a rejected write still rolls back to the confirmed value', async () => {
        const bridge = await createBridgeAdapter({ trusted: true });
        bridge.gm.setValue('imdb_enh_radarrApiKey', 'FIRST');
        await bridge.settle();
        bridge.failNextWrite(new Error('simulated quota failure'));
        try { bridge.gm.setValue('imdb_enh_radarrApiKey', 'SECOND'); } catch { /* reported below */ }
        await bridge.settle();
        assert.strictEqual(bridge.gm.getValue('imdb_enh_radarrApiKey', ''), 'FIRST',
            'where values are held, the rollback restores the one that was really stored');
    });
}

(async () => {
    await runContract(createManagerAdapter());
    await runContract(await createBridgeAdapter());
    await runCredentialBoundary();
    await runTrustedContext();
    if (failures) {
        console.error(`\n${failures} GM contract check(s) failed.`);
        process.exit(1);
    }
    console.log('GM contract holds for both the userscript manager and the MV3 bridge.');
})();
