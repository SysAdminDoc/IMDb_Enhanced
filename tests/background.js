/* Executes extension/background.js for real against a stubbed chrome.* and fetch.
   The rest of the extension suite asserts on source text, which cannot tell whether a
   redirect is actually refused — the defect this file exists to catch is a privileged
   fetch following a redirect off the allowlist while carrying a local API key. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const backgroundPath = path.join(root, 'extension', 'background.js');
const backgroundSource = fs.readFileSync(backgroundPath, 'utf8');
/* The worker derives the hosts it will fetch from the manifest, so the stub has to serve
   the real one. A hand-written manifest here would decide for itself which providers are
   reachable and pass while the shipped build refused them. */
const shippedManifest = JSON.parse(fs.readFileSync(path.join(root, 'extension', 'manifest.json'), 'utf8'));

/* Every case here is async. Registering them and awaiting in order keeps a rejected
   assertion from being swallowed as an unhandled rejection and reported as a pass. */
const cases = [];
function test(name, fn) { cases.push({ name, fn }); }

/* The two engines differ in exactly one way that reaches this file: Chromium's chrome.*
   returns promises while Gecko's alias is callback-style. callApi is written to accept
   both, so every case below runs against both shapes. */
/* fastTimers fires the worker's own request timer on the next tick instead of after ten
   seconds, so a timeout can be exercised for real rather than asserted from source. */
function loadBackground({
    engine = 'chromium',
    fetchImpl,
    fastTimers = false,
    granted = shippedManifest.optional_host_permissions,
    openOptionsFailure = null,
    omitOpenOptionsPage = false,
    tabsCreateFailure = null,
    grantedPermissions = [],
    seed = {},
    notificationFailure = null,
    onStateWrite = null,
} = {}) {
    const listeners = [];
    const alarmListeners = [];
    const calls = { fetches: [], permissions: [], tabs: [], openedOptions: 0, alarms: [], notifications: [] };
    const grantedApiPermissions = new Set(grantedPermissions);
    const storage = new Map();
    const lifecycle = [];
    const grantedOrigins = new Set(granted || []);
    let runtimeLastError = null;

    const api = (result) => (arg, done) => {
        if (engine === 'chromium') return Promise.resolve(result(arg));
        // Gecko: callback form, no thenable returned.
        done(result(arg));
        return undefined;
    };

    const sandbox = {
        console: { warn() {}, log() {}, error() {} },
        setTimeout: fastTimers ? (fn => setTimeout(fn, 0)) : setTimeout,
        clearTimeout,
        AbortController,
        URL,
        Promise,
        Date,
        Number,
        String,
        Object,
        Array,
        Boolean,
        Set,
        Math,
        JSON,
        Error,
        TypeError,
        RegExp,
        fetch: (...args) => {
            calls.fetches.push(args);
            return fetchImpl(...args);
        },
        chrome: {
            permissions: {
                contains: (arg, done) => {
                    /* The worker asks about API permissions as well as origins, and the
                       two are different sets: notifications is granted from a settings
                       control, host access from the options page. */
                    if (arg.permissions) {
                        calls.permissions.push(['contains', arg.permissions]);
                        done(arg.permissions.every(name => grantedApiPermissions.has(name)));
                        return;
                    }
                    calls.permissions.push(['contains', arg.origins]);
                    done(grantedOrigins.size > 0 && arg.origins.every(o => grantedOrigins.has(o)));
                },
                remove: (arg, done) => { calls.permissions.push(['remove', arg.origins]); arg.origins.forEach(o => grantedOrigins.delete(o)); done(true); },
                request: (arg, done) => { calls.permissions.push(['request', arg.origins]); done(false); },
            },
            tabs: {
                create: (options, done) => {
                    calls.tabs.push(options);
                    if (engine === 'chromium') {
                        return tabsCreateFailure
                            ? Promise.reject(tabsCreateFailure)
                            : Promise.resolve({ id:8 });
                    }
                    if (typeof done === 'function') queueMicrotask(() => {
                        runtimeLastError = tabsCreateFailure
                            ? { message:String(tabsCreateFailure.message || tabsCreateFailure) }
                            : null;
                        try { done(tabsCreateFailure ? undefined : { id:8 }); }
                        finally { runtimeLastError = null; }
                    });
                    return undefined;
                },
            },
            runtime: {
                get lastError() { return runtimeLastError; },
                openOptionsPage: done => {
                    calls.openedOptions += 1;
                    if (engine === 'chromium') {
                        return openOptionsFailure
                            ? Promise.reject(openOptionsFailure)
                            : Promise.resolve();
                    }
                    if (typeof done === 'function') queueMicrotask(() => {
                        runtimeLastError = openOptionsFailure
                            ? { message:String(openOptionsFailure.message || openOptionsFailure) }
                            : null;
                        try { done(); }
                        finally { runtimeLastError = null; }
                    });
                    return undefined;
                },
                getURL: relativePath => `chrome-extension://test/${relativePath}`,
                getManifest: () => ({
                    version: shippedManifest.version,
                    host_permissions: shippedManifest.host_permissions,
                    optional_host_permissions: shippedManifest.optional_host_permissions,
                    // The worker reads the icon it notifies with from here, so the stub
                    // has to serve the real names or an unshipped file goes unnoticed.
                    icons: shippedManifest.icons,
                }),
                onInstalled: { addListener: fn => lifecycle.push(fn) },
                onStartup: { addListener: fn => lifecycle.push(fn) },
                onMessage: { addListener: fn => listeners.push(fn) },
            },
            storage: {
                local: {
                    get: api(keys => {
                        const out = {};
                        [].concat(keys || []).forEach(key => {
                            if (storage.has(key)) out[key] = storage.get(key);
                        });
                        return out;
                    }),
                    set: api(items => {
                        Object.entries(items || {}).forEach(([key, value]) => {
                            storage.set(key, value);
                            if (key === 'imdb_enh_watchlistAlertState' && onStateWrite) onStateWrite(value);
                        });
                        return undefined;
                    }),
                },
                onChanged: { addListener() {} },
            },
            i18n: { getMessage: key => (key === 'notification_watchlist_title' ? 'New on your watchlist' : '') },
            declarativeNetRequest: { updateDynamicRules: api(() => undefined) },
            alarms: {
                create: (name, options, done) => {
                    calls.alarms.push(['create', name, options]);
                    if (engine === 'chromium') return Promise.resolve();
                    if (typeof done === 'function') queueMicrotask(done);
                    return undefined;
                },
                clear: (name, done) => {
                    calls.alarms.push(['clear', name]);
                    if (engine === 'chromium') return Promise.resolve(true);
                    if (typeof done === 'function') queueMicrotask(() => done(true));
                    return undefined;
                },
                onAlarm: { addListener: fn => alarmListeners.push(fn) },
            },
            notifications: {
                create: (options, done) => {
                    calls.notifications.push(options);
                    if (engine === 'chromium') {
                        return notificationFailure ? Promise.reject(notificationFailure) : Promise.resolve('id');
                    }
                    if (typeof done === 'function') queueMicrotask(() => {
                        runtimeLastError = notificationFailure
                            ? { message:String(notificationFailure.message || notificationFailure) }
                            : null;
                        try { done('id'); }
                        finally { runtimeLastError = null; }
                    });
                    return undefined;
                },
            },
        },
    };
    Object.entries(seed).forEach(([key, value]) => storage.set(key, value));
    if (omitOpenOptionsPage) delete sandbox.chrome.runtime.openOptionsPage;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(backgroundSource, sandbox, { filename: backgroundPath });

    const dispatch = (message, sender) => new Promise(resolve => {
        let settled = false;
        const sendResponse = value => {
            if (settled) return;
            settled = true;
            resolve(value);
        };
        const handled = listeners.some(listener => listener(message, sender, sendResponse));
        if (!handled && !settled) resolve(undefined);
    });
    /* Draining a fixed number of microtasks was both too little and too much: a
       twenty-title run needed more turns than the count allowed, so it was silently cut
       short, and a single macrotask anywhere in the handler would have made every
       "nothing was requested" assertion true before the handler had even started.

       This waits for the worker to go quiet instead: it keeps turning the loop, through
       real macrotasks, until nothing has been recorded for several turns in a row. */
    const settle = async () => {
        let quiet = 0;
        let seen = -1;
        for (let turn = 0; turn < 5000 && quiet < 5; turn += 1) {
            const activity = calls.fetches.length + calls.notifications.length
                + calls.permissions.length + calls.alarms.length + storage.size;
            quiet = activity === seen ? quiet + 1 : 0;
            seen = activity;
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    };
    /* The alarm path is the one the browser actually takes, so tests drive it rather
       than reaching for the function it calls. */
    const fireAlarm = async name => {
        alarmListeners.forEach(listener => listener({ name }));
        await settle();
    };
    const runLifecycle = async () => {
        lifecycle.forEach(listener => listener());
        await settle();
    };
    return { dispatch, calls, storage, grantedOrigins, fireAlarm, runLifecycle };
}

const IMDB_SENDER = { url: 'https://www.imdb.com/title/tt0133093/', tab: { id: 7 } };

/* The message a browser gives for a failed fetch. Chrome and Firefox both refuse to
   leak redirect detail into it, which is why classification must never sniff it. */
const OPAQUE_FETCH_FAILURE = 'Failed to fetch';

/* Simulates a redirect chain. `chain` maps a start URL to the URL the response
   ultimately came from, which is exactly what response.url reports after a followed
   redirect. Under redirect:'manual' a hop yields an opaque-redirect response instead
   of being followed, exactly as the platform does — status 0, empty url, no body. */
function makeFetch(chain, { body = 'PAYLOAD', status = 200 } = {}) {
    return (url, init = {}) => {
        const finalUrl = chain[url] || url;
        const redirected = finalUrl !== url;
        if (redirected && init.redirect === 'manual') {
            /* Measured against Chrome 143 in a real MV3 service worker: an opaque
               redirect reports the ORIGINAL request URL, not the target, and status 0.
               That matters — a check that looked at .url first would read this as a
               successful same-origin response, so the type check has to come first. */
            return Promise.resolve({
                type: 'opaqueredirect',
                url,
                status: 0,
                redirected: false,
                text: () => Promise.resolve(''),
            });
        }
        return Promise.resolve({
            type: 'basic',
            url: finalUrl,
            status,
            redirected,
            text: () => Promise.resolve(body),
        });
    };
}

const request = (url, extra = {}) => ({ type: 'imdb-enhanced:http', id: 'req-1', url, ...extra });

async function observeUnhandled(action) {
    const unhandled = [];
    const listener = reason => { unhandled.push(reason); };
    process.on('unhandledRejection', listener);
    try {
        const value = await action();
        await new Promise(resolve => setImmediate(resolve));
        return { value, unhandled };
    } finally {
        process.removeListener('unhandledRejection', listener);
    }
}

for (const engine of ['chromium', 'gecko']) {
    test(`[${engine}] an allowlisted request with no redirect succeeds`, async () => {
        const { dispatch, calls } = loadBackground({ engine, fetchImpl: makeFetch({}) });
        const response = await dispatch(request('https://letterboxd.com/film/the-matrix/'), IMDB_SENDER);
        assert.strictEqual(response.ok, true);
        assert.strictEqual(response.responseText, 'PAYLOAD');
        assert.strictEqual(calls.permissions[0][0], 'contains');
        assert.strictEqual(Array.from(calls.permissions[0][1]).join(','), 'https://letterboxd.com/*',
            'an optional-origin request must prove its current grant before fetch');
    });

    test(`[${engine}] an ungranted optional origin is refused before fetch`, async () => {
        const { dispatch, calls } = loadBackground({
            engine,
            fetchImpl: makeFetch({}),
            granted: shippedManifest.optional_host_permissions
                .filter(origin => origin !== 'https://api.themoviedb.org/*'),
        });
        const response = await dispatch(request('https://api.themoviedb.org/3/find/tt0133093', {
            credentialHeader:{ name:'Authorization', ref:'tmdbReadToken' },
        }), IMDB_SENDER);
        assert.strictEqual(response.ok, false);
        assert.strictEqual(response.errorType, 'permission_not_granted');
        assert.strictEqual(calls.fetches.length, 0,
            'CORS must not bypass a host grant the user has not made');
        assert.strictEqual(calls.permissions.at(-1)[0], 'contains');
        assert.strictEqual(Array.from(calls.permissions.at(-1)[1]).join(','),
            'https://api.themoviedb.org/*');
    });

    test(`[${engine}] a required origin does not need an optional grant`, async () => {
        const { dispatch, calls } = loadBackground({ engine, fetchImpl: makeFetch({}), granted:[] });
        const response = await dispatch(request('https://www.imdb.com/title/tt0133093/'), IMDB_SENDER);
        assert.strictEqual(response.ok, true);
        assert.strictEqual(calls.permissions.length, 0,
            'required host access must not be mistaken for an ungranted optional origin');
    });

    test(`[${engine}] a same-origin redirect is followed`, async () => {
        // Letterboxd's /imdb/{ttID}/ route is a deliberate same-origin redirect the
        // score lookup depends on; refusing every redirect would break it.
        const { dispatch } = loadBackground({
            engine,
            fetchImpl: makeFetch({
                'https://letterboxd.com/imdb/tt0133093/': 'https://letterboxd.com/film/the-matrix/',
            }),
        });
        const response = await dispatch(request('https://letterboxd.com/imdb/tt0133093/'), IMDB_SENDER);
        assert.strictEqual(response.ok, true, 'a same-origin redirect must still resolve');
        assert.strictEqual(response.responseURL, 'https://letterboxd.com/film/the-matrix/');
    });

    test(`[${engine}] a redirect to an unlisted host is refused and its body discarded`, async () => {
        let bodyRead = false;
        const { dispatch } = loadBackground({
            engine,
            fetchImpl: () => Promise.resolve({
                url: 'https://attacker.example/collect',
                status: 200,
                redirected: true,
                text: () => { bodyRead = true; return Promise.resolve('SECRET'); },
            }),
        });
        const response = await dispatch(request('https://letterboxd.com/imdb/tt0133093/'), IMDB_SENDER);
        assert.strictEqual(response.ok, false);
        assert.strictEqual(response.errorType, 'redirect_destination_not_allowed');
        assert.strictEqual(response.responseText, undefined, 'a refused response must carry no body');
        assert.strictEqual(bodyRead, false, 'a refused response must not even be read');
    });

    test(`[${engine}] a redirect to another allowlisted origin is still refused`, async () => {
        // Being on the allowlist is not permission to receive another host's request.
        const { dispatch } = loadBackground({
            engine,
            fetchImpl: makeFetch({
                'https://letterboxd.com/imdb/tt0133093/': 'https://www.justwatch.com/us',
            }),
        });
        const response = await dispatch(request('https://letterboxd.com/imdb/tt0133093/'), IMDB_SENDER);
        assert.strictEqual(response.ok, false);
        assert.strictEqual(response.errorType, 'redirect_changed_origin');
    });

    test(`[${engine}] a loopback service cannot redirect a credentialed request outward`, async () => {
        const captured = [];
        const { dispatch, calls } = loadBackground({
            engine,
            fetchImpl: (url, init) => {
                captured.push(init);
                return makeFetch({ 'http://localhost:7878/api/v3/movie': 'https://attacker.example/steal' })(url, init);
            },
        });
        const response = await dispatch(request('http://localhost:7878/api/v3/movie', {
            headers: { 'X-Api-Key': 'radarr-secret', Accept: 'application/json' },
        }), IMDB_SENDER);
        assert.strictEqual(response.ok, false);
        assert.strictEqual(response.errorType, 'redirect_blocked');
        assert.strictEqual(captured[0].redirect, 'manual',
            'a request carrying an API key must not follow a hop, since a followed one cannot be un-sent');
        assert.strictEqual(captured[0].headers['X-Api-Key'], 'radarr-secret',
            'the credential must still reach the local service it was meant for');
        assert.strictEqual(calls.fetches.length, 1,
            'the redirect target must never be requested, so the credential goes nowhere else');
    });

    /* The refusal above and an unreachable service must not look the same. Both used to
       reject with the browser's opaque "Failed to fetch", so a stopped Radarr was
       reported as a blocked redirect and vice versa. */
    test(`[${engine}] an unreachable local service reads as a network error, not a blocked redirect`, async () => {
        const { dispatch } = loadBackground({
            engine,
            fetchImpl: () => Promise.reject(new TypeError(OPAQUE_FETCH_FAILURE)),
        });
        const response = await dispatch(request('http://localhost:7878/api/v3/movie', {
            headers: { 'X-Api-Key': 'radarr-secret' },
        }), IMDB_SENDER);
        assert.strictEqual(response.ok, false);
        assert.strictEqual(response.errorType, 'network',
            'a service that is simply not running must not be reported as a redirect attempt');
    });

    test(`[${engine}] a credentialed request that does not redirect still succeeds`, async () => {
        const { dispatch } = loadBackground({ engine, fetchImpl: makeFetch({}) });
        const response = await dispatch(request('http://localhost:7878/api/v3/movie', {
            headers: { 'X-Api-Key': 'radarr-secret' },
        }), IMDB_SENDER);
        assert.strictEqual(response.ok, true, 'forbidding redirects must not break ordinary local calls');
        assert.strictEqual(response.responseText, 'PAYLOAD');
    });

    test(`[${engine}] every credential header shape forbids redirects`, async () => {
        for (const header of ['Authorization', 'X-Api-Key', 'X-Plex-Token', 'X-Emby-Token', 'x-mediabrowser-token', 'Cookie']) {
            const captured = [];
            const { dispatch } = loadBackground({
                engine,
                fetchImpl: (url, init) => {
                    captured.push(init);
                    return Promise.resolve({ url, status: 200, redirected: false, text: () => Promise.resolve('ok') });
                },
            });
            await dispatch(request('http://127.0.0.1:32400/library/sections', {
                headers: { [header]: 'secret' },
            }), IMDB_SENDER);
            assert.strictEqual(captured[0].redirect, 'manual', `${header} must be treated as a credential`);
        }
    });

    test(`[${engine}] a public request may not be redirected to loopback`, async () => {
        // The SSRF direction: a public provider steering the privileged fetch at the
        // user's own machine.
        const { dispatch } = loadBackground({
            engine,
            fetchImpl: makeFetch({
                'https://www.justwatch.com/us/search?q=x': 'http://localhost:7878/api/v3/system/status',
            }),
        });
        const response = await dispatch(request('https://www.justwatch.com/us/search?q=x'), IMDB_SENDER);
        assert.strictEqual(response.ok, false);
        assert.strictEqual(response.errorType, 'redirect_crossed_trust_boundary');
    });

    test(`[${engine}] an uncredentialed loopback request may not be redirected outward`, async () => {
        const { dispatch } = loadBackground({
            engine,
            fetchImpl: makeFetch({
                'http://localhost:8096/System/Info': 'https://www.youtube.com/results',
            }),
        });
        const response = await dispatch(request('http://localhost:8096/System/Info'), IMDB_SENDER);
        assert.strictEqual(response.ok, false);
        assert.strictEqual(response.errorType, 'redirect_crossed_trust_boundary');
    });

    test(`[${engine}] a redirect loop fails cleanly rather than hanging`, async () => {
        const { dispatch } = loadBackground({
            engine,
            // Once its own hop limit is exhausted the engine rejects with the same
            // opaque failure it uses for everything else; there is nothing to read
            // from it, so this only has to fail closed and stay typed.
            fetchImpl: () => Promise.reject(new TypeError(OPAQUE_FETCH_FAILURE)),
        });
        const response = await dispatch(request('https://letterboxd.com/imdb/tt0133093/'), IMDB_SENDER);
        assert.strictEqual(response.ok, false);
        assert.strictEqual(response.errorType, 'network');
        assert.strictEqual(response.responseText, undefined, 'a failed chain must yield no body');
    });

    test(`[${engine}] an unlisted or malformed start URL never reaches fetch`, async () => {
        for (const url of [
            'https://attacker.example/x',
            'ftp://letterboxd.com/x',
            'https://user:pw@letterboxd.com/x',
            'javascript:alert(1)',
            '',
        ]) {
            const { dispatch, calls } = loadBackground({ engine, fetchImpl: makeFetch({}) });
            const response = await dispatch(request(url), IMDB_SENDER);
            assert.strictEqual(response.ok, false, `${url} should be refused`);
            assert.strictEqual(response.errorType, 'invalid_url', `${url} should be refused as an invalid URL`);
            assert.strictEqual(calls.fetches.length, 0, `${url} must not be requested at all`);
        }
    });

    test(`[${engine}] a forged sender gets no privileged fetch`, async () => {
        for (const sender of [
            { url: 'https://attacker.example/', tab: { id: 1 } },
            { url: 'http://www.imdb.com/', tab: { id: 1 } },
            { url: 'https://www.imdb.com.attacker.example/', tab: { id: 1 } },
            {},
        ]) {
            const { dispatch, calls } = loadBackground({ engine, fetchImpl: makeFetch({}) });
            const response = await dispatch(request('https://letterboxd.com/film/the-matrix/'), sender);
            assert.strictEqual(response, undefined, 'a non-IMDb sender must not be answered');
            assert.strictEqual(calls.fetches.length, 0, 'a non-IMDb sender must not cause a request');
        }
    });

    /* chrome.permissions is not exposed to content scripts, so the settings panel cannot
       read or change host access itself and asks the background instead. */
    test(`[${engine}] the background answers permission state for the settings panel`, async () => {
        const { dispatch, calls } = loadBackground({
            engine,
            fetchImpl: makeFetch({}),
            granted:['https://www.rottentomatoes.com/*', 'https://query.wikidata.org/*'],
        });
        const granted = await dispatch({
            type:'imdb-enhanced:permissions-contains',
            origins:['https://www.rottentomatoes.com/*', 'https://query.wikidata.org/*'],
        }, IMDB_SENDER);
        // The worker runs in its own realm, so compare fields rather than identity.
        assert.strictEqual(granted.ok, true);
        assert.strictEqual(granted.granted, true);

        const missing = await dispatch({
            type:'imdb-enhanced:permissions-contains',
            origins:['http://localhost/*'],
        }, IMDB_SENDER);
        assert.strictEqual(missing.granted, false, 'an ungranted origin must report as missing');
        assert.deepStrictEqual(calls.permissions.at(-1), ['contains', ['http://localhost/*']]);
    });

    test(`[${engine}] the background releases only origins this build declares optional`, async () => {
        const { dispatch, calls, grantedOrigins } = loadBackground({ engine, fetchImpl: makeFetch({}) });
        await dispatch({
            type:'imdb-enhanced:permissions-remove',
            origins:['https://www.rottentomatoes.com/*'],
        }, IMDB_SENDER);
        assert(!grantedOrigins.has('https://www.rottentomatoes.com/*'), 'the named origin must be released');
        assert(grantedOrigins.has('https://query.wikidata.org/*'), 'an origin not named must be left alone');

        /* Without this a content script could name any pattern and use the background to
           probe or drop permissions the extension never declared. */
        calls.permissions.length = 0;
        const refused = await dispatch({
            type:'imdb-enhanced:permissions-remove',
            origins:['https://attacker.example/*', '<all_urls>'],
        }, IMDB_SENDER);
        assert.strictEqual(refused.removed, false);
        assert.strictEqual(calls.permissions.length, 0, 'an undeclared origin must never reach the permissions API');
    });

    test(`[${engine}] permission messages from a forged sender are ignored`, async () => {
        const { dispatch, calls } = loadBackground({ engine, fetchImpl: makeFetch({}) });
        const response = await dispatch({
            type:'imdb-enhanced:permissions-remove',
            origins:['https://www.rottentomatoes.com/*'],
        }, { url:'https://attacker.example/', tab:{ id:1 } });
        assert.strictEqual(response, undefined, 'a non-IMDb sender must not be answered');
        assert.strictEqual(calls.permissions.length, 0, 'a non-IMDb sender must not touch permissions');
    });

    /* The background can hand the user to the options page, which is the only surface
       with both an extension page and a user gesture — the two things permissions.request
       needs and neither the content script nor the worker has together. */
    test(`[${engine}] the background can open the page where granting is possible`, async () => {
        const { dispatch, calls } = loadBackground({ engine, fetchImpl: makeFetch({}) });
        const response = await dispatch({ type:'imdb-enhanced:open-options' }, IMDB_SENDER);
        assert.strictEqual(response.ok, true);
        assert.strictEqual(calls.openedOptions, 1);
        // Requesting is deliberately not proxied: a worker has no gesture to offer.
        assert(!backgroundSource.includes('permissions-request'),
            'a proxied permissions.request would fail and must not exist');
        assert(!/chrome\.permissions\.request/.test(backgroundSource),
            'the background must not attempt a request it cannot make');
    });

    test(`[${engine}] an options-page failure is reported without an unhandled rejection`, async () => {
        const failure = new Error(`Options page failed ${'x'.repeat(400)}`);
        const { dispatch, calls } = loadBackground({
            engine,
            fetchImpl: makeFetch({}),
            openOptionsFailure: failure,
        });
        const { value:response, unhandled } = await observeUnhandled(() =>
            dispatch({ type:'imdb-enhanced:open-options' }, IMDB_SENDER));
        assert.strictEqual(response.ok, false, 'a rejected options-page call must not report success');
        assert(response.error.startsWith('Options page failed'));
        assert(response.error.length <= 240, 'extension API errors must be length bounded');
        assert.strictEqual(calls.openedOptions, 1);
        assert.strictEqual(unhandled.length, 0, 'the API rejection must be consumed by the worker');
    });

    test(`[${engine}] a fallback-tab failure is reported without an unhandled rejection`, async () => {
        const failure = new Error(`Fallback tab failed ${'y'.repeat(400)}`);
        const { dispatch, calls } = loadBackground({
            engine,
            fetchImpl: makeFetch({}),
            omitOpenOptionsPage: true,
            tabsCreateFailure: failure,
        });
        const { value:response, unhandled } = await observeUnhandled(() =>
            dispatch({ type:'imdb-enhanced:open-options' }, IMDB_SENDER));
        assert.strictEqual(response.ok, false, 'a rejected fallback tab must not report success');
        assert(response.error.startsWith('Fallback tab failed'));
        assert(response.error.length <= 240, 'fallback API errors must be length bounded');
        assert.strictEqual(calls.tabs.length, 1);
        assert.strictEqual(calls.tabs[0].url, 'chrome-extension://test/recovery.html');
        assert.strictEqual(unhandled.length, 0, 'the fallback rejection must be consumed by the worker');
    });

    /* IE-89: the content script cannot read an integration credential at all, so it names
       the header and the stored key and the value is substituted here. */
    test(`[${engine}] the background injects a credential only into a loopback request`, async () => {
        const { dispatch, calls, storage } = loadBackground({ engine, fetchImpl: makeFetch({}) });
        storage.set('imdb_enh_radarrApiKey', 'radarr-secret');

        const ok = await dispatch(request('http://localhost:7878/api/v3/movie', {
            headers: { Accept:'application/json' },
            credentialHeader: { name:'X-Api-Key', ref:'radarrApiKey' },
        }), IMDB_SENDER);
        assert.strictEqual(ok.ok, true);
        assert.strictEqual(calls.fetches[0][1].headers['X-Api-Key'], 'radarr-secret',
            'the local service must still receive its key');
        assert.strictEqual(calls.fetches[0][1].redirect, 'manual',
            'an injected credential must still forbid redirects');
    });

    test(`[${engine}] a credential is never injected into a public request`, async () => {
        const { dispatch, calls, storage } = loadBackground({ engine, fetchImpl: makeFetch({}) });
        storage.set('imdb_enh_radarrApiKey', 'radarr-secret');
        // Same reference, public destination: the value must not travel.
        await dispatch(request('https://www.rottentomatoes.com/m/x', {
            credentialHeader: { name:'X-Api-Key', ref:'radarrApiKey' },
        }), IMDB_SENDER);
        const sent = calls.fetches[0][1];
        assert.strictEqual(sent.headers['X-Api-Key'], undefined,
            'a public host must never receive a local integration key');
        assert(!JSON.stringify(sent.headers).includes('radarr-secret'), 'and not under any other name');
    });

    /* Without this the injection path would be a way to read any stored value into an
       outbound request just by naming its key. */
    test(`[${engine}] only known credential keys can be injected`, async () => {
        const { dispatch, calls, storage } = loadBackground({ engine, fetchImpl: makeFetch({}) });
        storage.set('imdb_enh_userMarks', 'private-marks-payload');
        storage.set('imdb_enh_failureJournal', 'journal-payload');
        for (const ref of ['userMarks', 'failureJournal', 'themeVariant', '../../etc']) {
            calls.fetches.length = 0;
            await dispatch(request('http://localhost:7878/api/v3/movie', {
                credentialHeader: { name:'X-Api-Key', ref },
            }), IMDB_SENDER);
            const sent = calls.fetches[0][1];
            assert.strictEqual(sent.headers['X-Api-Key'], undefined, `${ref} must not be injectable`);
            assert(!JSON.stringify(sent.headers).includes('payload'), `${ref} must not leak its value`);
        }
    });

    test(`[${engine}] an injected credential cannot smuggle a header break`, async () => {
        const { dispatch, calls, storage } = loadBackground({ engine, fetchImpl: makeFetch({}) });
        storage.set('imdb_enh_plexToken', 'secret\r\nX-Injected: yes');
        await dispatch(request('http://127.0.0.1:32400/library/sections', {
            credentialHeader: { name:'X-Plex-Token', ref:'plexToken' },
        }), IMDB_SENDER);
        const sent = calls.fetches[0][1];
        assert.strictEqual(sent.headers['X-Plex-Token'], undefined,
            'a credential carrying control characters must be refused, not sent');
    });

    test(`[${engine}] credentials are never sent to a public provider`, async () => {
        const { dispatch, calls } = loadBackground({ engine, fetchImpl: makeFetch({}) });
        await dispatch(request('https://query.wikidata.org/sparql?query=x', {
            headers: { Accept: 'application/sparql-results+json' },
        }), IMDB_SENDER);
        const sent = calls.fetches[0][1];
        assert.strictEqual(sent.credentials, 'omit', 'destination cookies must stay omitted');
        Object.keys(sent.headers).forEach(name => {
            assert(!/^(authorization|cookie|x-api-key|x-plex-token|x-emby-token|x-mediabrowser-token)$/i.test(name),
                `public request carried a credential header: ${name}`);
        });
        assert.strictEqual(sent.redirect, 'follow', 'an uncredentialed public request may still follow same-origin hops');
    });

    /* The other half of "the page never sees a credential": the worker attaches it, so the
       worker must not hand it back. Nothing tested this — adding the sent headers to the
       success response left the suite green while undoing the whole boundary. */
    test(`[${engine}] a successful response never carries the credential back`, async () => {
        const { dispatch, storage } = loadBackground({ engine, fetchImpl: makeFetch({}, { body:'PAYLOAD' }) });
        storage.set('imdb_enh_radarrApiKey', 'RADARR-SECRET');
        const answer = await dispatch(request('http://localhost:7878/api/v3/movie', {
            credentialHeader: { name:'X-Api-Key', ref:'radarrApiKey' },
        }), IMDB_SENDER);
        assert.strictEqual(answer.ok, true, 'the request should have succeeded');
        assert(!JSON.stringify(answer).includes('RADARR-SECRET'),
            'no part of the answer may carry the credential the worker attached');
        assert.strictEqual(answer.headers, undefined, 'the worker must not report the headers it sent');
        assert.strictEqual(answer.injected, undefined, 'nor what it injected');
    });

    test(`[${engine}] a failed response never carries the credential back either`, async () => {
        const { dispatch, storage } = loadBackground({
            engine,
            fetchImpl: () => Promise.reject(new TypeError(OPAQUE_FETCH_FAILURE)),
        });
        storage.set('imdb_enh_radarrApiKey', 'RADARR-SECRET');
        const answer = await dispatch(request('http://localhost:7878/api/v3/movie', {
            credentialHeader: { name:'X-Api-Key', ref:'radarrApiKey' },
        }), IMDB_SENDER);
        assert.strictEqual(answer.ok, false);
        assert(!JSON.stringify(answer).includes('RADARR-SECRET'),
            'a failure must not report the credential in its message or elsewhere');
    });

    /* IE-91: the TMDB token is the only credential that leaves the machine, so it is bound
       to one host. The binding, not the caller, decides where a key may go and under which
       scheme, because the caller cannot read the value and has no business shaping the
       header around it. */
    test(`[${engine}] the TMDB token is sent to TMDB, under the scheme the binding declares`, async () => {
        const { dispatch, calls, storage } = loadBackground({ engine, fetchImpl: makeFetch({}) });
        storage.set('imdb_enh_tmdbReadToken', 'TMDB-TOKEN-VALUE');
        await dispatch(request('https://api.themoviedb.org/3/find/tt0133093?external_source=imdb_id', {
            credentialHeader: { name:'Authorization', ref:'tmdbReadToken' },
        }), IMDB_SENDER);
        const sent = calls.fetches[0][1];
        assert.strictEqual(sent.headers.Authorization, 'Bearer TMDB-TOKEN-VALUE',
            'the worker attaches the token with the scheme its binding declares');
        assert.strictEqual(sent.redirect, 'manual',
            'a request carrying a credential must still refuse to redirect');
    });

    /* IE-110: OMDb accepts its key in the query string and nowhere else, so this is the
       first credential that rides in the URL. Everything the header form guarantees has
       to hold here too, plus one thing that is new: the address the request went to is
       itself a secret, and the page is not allowed to see it. */
    test(`[${engine}] the OMDb key is put in the query string of an OMDb request`, async () => {
        const { dispatch, calls, storage } = loadBackground({ engine, fetchImpl: makeFetch({}) });
        storage.set('imdb_enh_omdbApiKey', 'OMDB-KEY-VALUE');
        const asked = 'https://www.omdbapi.com/?i=tt0133093';
        const answer = await dispatch(request(asked, {
            credentialQuery: { name:'apikey', ref:'omdbApiKey' },
        }), IMDB_SENDER);
        assert.strictEqual(calls.fetches[0][0], 'https://www.omdbapi.com/?i=tt0133093&apikey=OMDB-KEY-VALUE',
            'the key must reach OMDb the only way OMDb accepts one');
        assert.strictEqual(calls.fetches[0][1].redirect, 'manual',
            'a request whose URL carries a credential must refuse to redirect');
        assert.strictEqual(answer.responseURL, asked,
            'the address that came back must not carry the key into the page');
        assert(!JSON.stringify(answer).includes('OMDB-KEY-VALUE'),
            'and nothing else in the response may either');
    });

    test(`[${engine}] the OMDb key is refused to every other destination`, async () => {
        for (const url of [
            'https://api.themoviedb.org/3/find/tt0133093?external_source=imdb_id',
            'http://localhost:7878/api/v3/movie',
            'https://query.wikidata.org/sparql?query=x',
        ]) {
            const { dispatch, calls, storage } = loadBackground({ engine, fetchImpl: makeFetch({}) });
            storage.set('imdb_enh_omdbApiKey', 'OMDB-KEY-VALUE');
            await dispatch(request(url, { credentialQuery: { name:'apikey', ref:'omdbApiKey' } }), IMDB_SENDER);
            assert(!String(calls.fetches[0][0]).includes('OMDB-KEY-VALUE'),
                `the OMDb key must not be attached to ${url}`);
        }
    });

    /* The parameter name comes from the binding, exactly as the header scheme does. A
       caller that cannot read the value cannot decide what carries it either. */
    test(`[${engine}] a caller cannot choose the parameter a URL credential rides in`, async () => {
        const { dispatch, calls, storage } = loadBackground({ engine, fetchImpl: makeFetch({}) });
        storage.set('imdb_enh_omdbApiKey', 'OMDB-KEY-VALUE');
        await dispatch(request('https://www.omdbapi.com/?i=tt0133093', {
            credentialQuery: { name:'callback', ref:'omdbApiKey' },
        }), IMDB_SENDER);
        const sent = String(calls.fetches[0][0]);
        assert(sent.includes('apikey=OMDB-KEY-VALUE'), 'the binding names the parameter');
        assert(!sent.includes('callback='), 'a parameter named in the message must be ignored');
    });

    test(`[${engine}] an OMDb redirect is stopped before the key can follow it`, async () => {
        const { dispatch, storage } = loadBackground({
            engine,
            fetchImpl: makeFetch({
                'https://www.omdbapi.com/?i=tt0133093&apikey=OMDB-KEY-VALUE': 'https://example.invalid/collect',
            }),
        });
        storage.set('imdb_enh_omdbApiKey', 'OMDB-KEY-VALUE');
        const answer = await dispatch(request('https://www.omdbapi.com/?i=tt0133093', {
            credentialQuery: { name:'apikey', ref:'omdbApiKey' },
        }), IMDB_SENDER);
        assert.strictEqual(answer.errorType, 'redirect_blocked');
        assert(!JSON.stringify(answer).includes('OMDB-KEY-VALUE'));
    });

    test(`[${engine}] the TMDB token is refused to every other destination`, async () => {
        for (const url of [
            'https://www.justwatch.com/us/movie/the-matrix',
            'http://localhost:7878/api/v3/movie',
            'https://query.wikidata.org/sparql?query=x',
        ]) {
            const { dispatch, calls, storage } = loadBackground({ engine, fetchImpl: makeFetch({}) });
            storage.set('imdb_enh_tmdbReadToken', 'TMDB-TOKEN-VALUE');
            await dispatch(request(url, { credentialHeader: { name:'Authorization', ref:'tmdbReadToken' } }), IMDB_SENDER);
            const sent = calls.fetches[0][1];
            assert.strictEqual(sent.headers.Authorization, undefined,
                `the TMDB token must not be attached to ${url}`);
        }
    });

    /* Found by adversarial review. The scheme in a binding is the header scheme, and
       describeRequestUrl accepts http as well as https for the sake of loopback services,
       so plain http://api.themoviedb.org carried the token in clear text. */
    test(`[${engine}] a host-bound credential is refused over plain http`, async () => {
        const { dispatch, calls, storage } = loadBackground({ engine, fetchImpl: makeFetch({}) });
        storage.set('imdb_enh_tmdbReadToken', 'TMDB-TOKEN-VALUE');
        const response = await dispatch(request('http://api.themoviedb.org/3/find/tt0133093?external_source=imdb_id', {
            credentialHeader: { name:'Authorization', ref:'tmdbReadToken' },
        }), IMDB_SENDER);
        assert.strictEqual(response.errorType, 'permission_not_granted');
        assert.strictEqual(calls.fetches.length, 0,
            'a public origin declared only for HTTPS must never be fetched over plain HTTP');
    });

    test(`[${engine}] a loopback credential is still allowed over plain http`, async () => {
        const { dispatch, calls, storage } = loadBackground({ engine, fetchImpl: makeFetch({}) });
        storage.set('imdb_enh_radarrApiKey', 'RADARR-KEY');
        await dispatch(request('http://localhost:7878/api/v3/movie', {
            credentialHeader: { name:'X-Api-Key', ref:'radarrApiKey' },
        }), IMDB_SENDER);
        assert.strictEqual(calls.fetches[0][1].headers['X-Api-Key'], 'RADARR-KEY',
            'a local service on your own machine is normally plain http and must keep working');
    });

    /* Whether a request carries a credential was decided by sniffing the header name, and
       the caller chooses that name. Calling it something outside the sensitive list got
       the token attached AND redirect:'follow', which is what carries a custom header
       across an origin change. */
    test(`[${engine}] a credential-bearing request refuses redirects whatever its header is called`, async () => {
        const { dispatch, calls, storage } = loadBackground({ engine, fetchImpl: makeFetch({}) });
        storage.set('imdb_enh_tmdbReadToken', 'TMDB-TOKEN-VALUE');
        await dispatch(request('https://api.themoviedb.org/3/find/tt0133093?external_source=imdb_id', {
            credentialHeader: { name:'X-Not-On-The-Sensitive-List', ref:'tmdbReadToken' },
        }), IMDB_SENDER);
        const sent = calls.fetches[0][1];
        assert.strictEqual(sent.headers['X-Not-On-The-Sensitive-List'], 'Bearer TMDB-TOKEN-VALUE',
            'the binding still decides what is attached');
        assert.strictEqual(sent.redirect, 'manual',
            'and the worker knows it attached one, whatever the caller called the header');
    });

    test(`[${engine}] a loopback credential is refused to TMDB`, async () => {
        const { dispatch, calls, storage } = loadBackground({ engine, fetchImpl: makeFetch({}) });
        storage.set('imdb_enh_radarrApiKey', 'RADARR-KEY');
        await dispatch(request('https://api.themoviedb.org/3/find/tt0133093?external_source=imdb_id', {
            credentialHeader: { name:'X-Api-Key', ref:'radarrApiKey' },
        }), IMDB_SENDER);
        const sent = calls.fetches[0][1];
        assert.strictEqual(sent.headers['X-Api-Key'], undefined,
            'a key bound to your own machine must not follow a request to a public host');
    });

    test(`[${engine}] a caller cannot choose the scheme a credential is sent under`, async () => {
        const { dispatch, calls, storage } = loadBackground({ engine, fetchImpl: makeFetch({}) });
        storage.set('imdb_enh_tmdbReadToken', 'TMDB-TOKEN-VALUE');
        await dispatch(request('https://api.themoviedb.org/3/find/tt0133093?external_source=imdb_id', {
            credentialHeader: { name:'Authorization', ref:'tmdbReadToken', prefix:'Basic ', scheme:'Basic ' },
        }), IMDB_SENDER);
        assert.strictEqual(calls.fetches[0][1].headers.Authorization, 'Bearer TMDB-TOKEN-VALUE',
            'a scheme named in the message must be ignored');
    });

    /* The worker used to keep its own copy of the hosts it would fetch, which meant a
       provider added to the manifest was silently refused by the one component that has
       to reach it. */
    test(`[${engine}] every origin the manifest declares is reachable`, async () => {
        const { dispatch, calls } = loadBackground({ engine, fetchImpl: makeFetch({}) });
        const hosts = [...new Set([
            ...(shippedManifest.host_permissions || []),
            ...(shippedManifest.optional_host_permissions || []),
        ].map(pattern => { try { return new URL(pattern.replace('*.', '')).hostname; } catch { return ''; } }).filter(Boolean))];
        assert(hosts.includes('api.themoviedb.org'), 'TMDB must be among the declared origins');
        for (const host of hosts) {
            calls.fetches.length = 0;
            const answer = await dispatch(request(`https://${host}/probe`), IMDB_SENDER);
            assert.notStrictEqual(answer.errorType, 'invalid_url',
                `the worker refuses ${host}, which the manifest says it may reach`);
        }
    });

    /* A request that ran out of time and one the page cancelled on navigation both reject
       with AbortError and the same "The user aborted a request" message, so they were
       reported identically. Only the timer knows which happened. The distinction is load
       bearing: the stale-score fallback treats a timeout as the provider being
       unreachable, and a cancellation as nothing worth reacting to. */
    test(`[${engine}] a timed-out request is reported as a timeout, not a cancellation`, async () => {
        const abortError = Object.assign(new Error('The user aborted a request.'), { name:'AbortError' });
        const { dispatch } = loadBackground({
            engine,
            fetchImpl: (url, init = {}) => new Promise((resolve, reject) => {
                // Rejects only once the worker's own timer has fired and aborted.
                init.signal?.addEventListener('abort', () => reject(abortError));
            }),
            fastTimers: true,
        });
        const answer = await dispatch(request('https://www.rottentomatoes.com/m/x', { timeout: 1000 }), IMDB_SENDER);
        assert.strictEqual(answer.ok, false, 'a timed-out request must not report success');
        assert.strictEqual(answer.errorType, 'timeout',
            'the worker must say the request timed out rather than that it was cancelled');
    });

    test(`[${engine}] a cancelled request is still reported as a cancellation`, async () => {
        const abortError = Object.assign(new Error('The user aborted a request.'), { name:'AbortError' });
        const { dispatch } = loadBackground({
            engine,
            fetchImpl: () => Promise.reject(abortError),
        });
        const answer = await dispatch(request('https://www.rottentomatoes.com/m/x'), IMDB_SENDER);
        assert.strictEqual(answer.errorType, 'aborted',
            'an abort that did not come from the timer must stay a cancellation');
    });
}


/* ---- Watchlist availability alerts -------------------------------------------------
   Run against the real worker: the alarm is fired the way the browser fires it, TMDB is
   stubbed, and what is asserted is what reaches the network, the storage and the
   notification — not what the source says it will do. */

const TMDB_FIND = 'https://api.themoviedb.org/3/find/tt0133093?external_source=imdb_id';
const TMDB_PROVIDERS = 'https://api.themoviedb.org/3/movie/603/watch/providers';

function tmdbFetch(providerIds, { region = 'US' } = {}) {
    return url => {
        if (url.startsWith('https://api.themoviedb.org/3/find/')) {
            return Promise.resolve({ ok:true, json: () => Promise.resolve({ movie_results:[{ id:603 }] }) });
        }
        if (url.startsWith('https://api.themoviedb.org/3/movie/')) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ results:{ [region]: { flatrate: providerIds.map(name => ({ provider_name:name })) } } }),
            });
        }
        return Promise.resolve({ ok:false, status:404, json: () => Promise.resolve({}) });
    };
}

const ALERT_SEED = {
    imdb_enh_watchlistAlerts: true,
    imdb_enh_watchlistAlertServices: ['Netflix'],
    imdb_enh_watchlistSnapshot: { v:1, ts:1, titles:{ tt0133093:{ title:'The Matrix' } } },
    imdb_enh_availabilityRegion: 'US',
    imdb_enh_tmdbReadToken: 'TMDB-TOKEN',
};

test('the alarm is only scheduled while the alerts are switched on', async () => {
    const off = loadBackground({ fetchImpl: tmdbFetch([]), seed:{ imdb_enh_watchlistAlerts: false } });
    await off.runLifecycle();
    assert(off.calls.alarms.length > 0 && off.calls.alarms.every(entry => entry[0] === 'clear'),
        'a feature that is off must not leave a schedule running');

    const on = loadBackground({ fetchImpl: tmdbFetch([]), seed: ALERT_SEED });
    await on.runLifecycle();
    const created = on.calls.alarms.find(entry => entry[0] === 'create');
    assert.ok(created, 'and one that is on must be scheduled');
    /* Re-created on every startup rather than trusted to persist: persistAcrossSessions
       defaults to true only from Chrome 150. */
    assert.strictEqual(created[2].periodInMinutes, 1440, 'once a day, as the disclosure says');
});

test('a first check records what is already available and says nothing', async () => {
    const worker = loadBackground({
        fetchImpl: tmdbFetch(['Netflix', 'Hulu']),
        seed: ALERT_SEED,
        grantedPermissions: ['notifications'],
    });
    await worker.fireAlarm('imdb-enhanced:watchlist-alerts');

    assert.strictEqual(worker.calls.notifications.length, 0,
        'everything a title is already on is not news');
    const state = worker.storage.get('imdb_enh_watchlistAlertState');
    assert.deepStrictEqual(Array.from(state.seen.tt0133093), ['Netflix', 'Hulu'], 'but it is remembered');
    /* And every service it walked past is kept as something the settings panel can
       offer: that list is the only thing the picker has to show, so an empty one is a
       picker that stays empty forever. */
    assert.deepStrictEqual(Array.from(state.services), ['Hulu', 'Netflix'],
        'the services it saw are recorded for the picker');
    assert(worker.calls.fetches.length >= 2, 'the find and the providers call both happen');
});

test('a service arriving on a watched title produces exactly one notification', async () => {
    const worker = loadBackground({
        fetchImpl: tmdbFetch(['Netflix', 'Hulu']),
        seed: {
            ...ALERT_SEED,
            imdb_enh_watchlistAlertState: { checkedAt:1, cursor:0, seen:{ tt0133093:['Hulu'] } },
        },
        grantedPermissions: ['notifications'],
    });
    await worker.fireAlarm('imdb-enhanced:watchlist-alerts');

    assert.strictEqual(worker.calls.notifications.length, 1, 'one notification, not one per title');
    const shown = worker.calls.notifications[0];
    assert.match(shown.message, /The Matrix/, 'and it names the title rather than an id');
    /* An unresolvable iconUrl makes Chrome refuse the whole notification, so the file it
       names has to be one the build actually ships. */
    const iconRelative = String(shown.iconUrl).replace('chrome-extension://test/', '');
    assert(Object.values(shippedManifest.icons).includes(iconRelative),
        `the notification icon must be one the manifest ships, got ${iconRelative}`);
    assert(fs.existsSync(path.join(root, 'extension', iconRelative)),
        'and the file must exist');
    assert(shown.title, 'a notification with no title is a notification about nothing');
});

test('a second run the same day is not a second notification', async () => {
    /* Guarded the same way as the case above: a run that is merely slow would satisfy the
       "asked nothing" half on its own. */
    /* The alarm alone does not space these out: it is re-created from onInstalled, from
       onStartup and from every change to the setting, each with a one-minute delay. Four
       browser restarts in a day used to be four checks and four notifications. */
    const worker = loadBackground({
        fetchImpl: tmdbFetch(['Netflix', 'Hulu']),
        grantedPermissions: ['notifications'],
        seed: {
            ...ALERT_SEED,
            imdb_enh_watchlistAlertState: { checkedAt: Date.now() - 1000, cursor:'', seen:{ tt0133093:['Hulu'] } },
        },
    });
    await worker.fireAlarm('imdb-enhanced:watchlist-alerts');
    assert.strictEqual(worker.calls.fetches.length, 0, 'a check an hour after the last one asks nothing');
    assert.strictEqual(worker.calls.notifications.length, 0, 'and says nothing');

    // Move the last check back a day and the same worker asks again.
    worker.storage.set('imdb_enh_watchlistAlertState', { checkedAt: Date.now() - (25 * 60 * 60 * 1000), cursor:'', seen:{ tt0133093:['Hulu'] } });
    await worker.fireAlarm('imdb-enhanced:watchlist-alerts');
    assert(worker.calls.fetches.length > 0, 'a day later it does ask, which is what makes the silence above mean something');

    /* A stamp in the future is a broken clock or a restored backup, not a recent check.
       Treating it as recent left the feature waiting for the wall clock to catch up. */
    const skewed = loadBackground({
        fetchImpl: tmdbFetch(['Netflix']),
        grantedPermissions: ['notifications'],
        seed: {
            ...ALERT_SEED,
            imdb_enh_watchlistAlertState: { checkedAt: Date.now() + (400 * 24 * 60 * 60 * 1000), cursor:'', seen:{} },
        },
    });
    await skewed.fireAlarm('imdb-enhanced:watchlist-alerts');
    assert(skewed.calls.fetches.length > 0,
        'a timestamp in the future must not disable the feature until the clock catches up');
});

test('the scheduled run refuses to reach TMDB without the granted origin', async () => {
    /* Every other request in this worker is gated on the origin being granted. A job that
       runs on a timer, with the user's bearer token, is the last place that should be the
       exception — and TMDB answers cross-origin requests from anywhere, so nothing else
       would have stopped it. */
    const worker = loadBackground({
        fetchImpl: tmdbFetch(['Netflix']),
        grantedPermissions: ['notifications'],
        granted: [],
        seed: {
            ...ALERT_SEED,
            imdb_enh_watchlistAlertState: { checkedAt:1, cursor:'', seen:{ tt0133093:[] } },
        },
    });
    await worker.fireAlarm('imdb-enhanced:watchlist-alerts');
    assert.strictEqual(worker.calls.fetches.length, 0,
        'a revoked or never-granted TMDB origin means no request at all');
    assert.strictEqual(worker.calls.notifications.length, 0);

    // The same seed with the origin granted, so the silence above is about the grant.
    const granted = loadBackground({
        fetchImpl: tmdbFetch(['Netflix']),
        grantedPermissions: ['notifications'],
        seed: {
            ...ALERT_SEED,
            imdb_enh_watchlistAlertState: { checkedAt:1, cursor:'', seen:{ tt0133093:[] } },
        },
    });
    await granted.fireAlarm('imdb-enhanced:watchlist-alerts');
    assert(granted.calls.fetches.length > 0, 'with the origin granted the same run does ask');
});

test('an arrival nobody was shown is announced again on the next run', async () => {
    /* Once providers are in seen the arrival is not new again, so a notification that
       failed to appear is an arrival lost for good. Deleting the entry to compensate is
       worse, not better: a title with no record is a FIRST sighting, and a first sighting
       is deliberately silent, so the news is lost twice over. What has to hold is not a
       shape in storage but that the next run says it. */
    const failing = loadBackground({
        fetchImpl: tmdbFetch(['Netflix', 'Hulu']),
        grantedPermissions: ['notifications'],
        notificationFailure: new Error('Unable to download all specified images'),
        seed: {
            ...ALERT_SEED,
            imdb_enh_watchlistAlertState: { checkedAt:1, cursor:'', seen:{ tt0133093:['Hulu'] } },
        },
    });
    await failing.fireAlarm('imdb-enhanced:watchlist-alerts');
    assert.strictEqual(failing.calls.notifications.length, 1, 'it tried');
    const carried = failing.storage.get('imdb_enh_watchlistAlertState');

    // The very same state, handed to a run whose notification works.
    const retry = loadBackground({
        fetchImpl: tmdbFetch(['Netflix', 'Hulu']),
        grantedPermissions: ['notifications'],
        seed: { ...ALERT_SEED, imdb_enh_watchlistAlertState: { ...carried, checkedAt:1 } },
    });
    await retry.fireAlarm('imdb-enhanced:watchlist-alerts');
    assert.strictEqual(retry.calls.notifications.length, 1,
        'the arrival nobody saw is still news the next time round');
    assert.match(retry.calls.notifications[0].message, /The Matrix/);

    // And once it has been shown, it is not shown again.
    const third = loadBackground({
        fetchImpl: tmdbFetch(['Netflix', 'Hulu']),
        grantedPermissions: ['notifications'],
        seed: {
            ...ALERT_SEED,
            imdb_enh_watchlistAlertState: { ...retry.storage.get('imdb_enh_watchlistAlertState'), checkedAt:1 },
        },
    });
    await third.fireAlarm('imdb-enhanced:watchlist-alerts');
    assert.strictEqual(third.calls.notifications.length, 0, 'and not a third time');

    /* The picker's list of services is derived from what the runs have seen, so a failed
       notification must not empty it. */
    assert(Array.from(carried.services).includes('Netflix'),
        'a failed notification must not wipe the services the picker offers');
});

test('progress is written as the run goes, not only at the end', async () => {
    /* A service worker is stopped when it looks idle, and nothing in the request loop is
       an extension API call. A batch that is killed part-way used to lose the cursor with
       everything else, so the same titles were checked forever and the rest never were. */
    const titles = {};
    for (let index = 0; index < 5; index += 1) titles[`tt000000${index}1`] = { title:`Title ${index}` };
    const writes = [];
    const worker = loadBackground({
        fetchImpl: tmdbFetch(['Netflix']),
        grantedPermissions: ['notifications'],
        onStateWrite: value => writes.push(value.cursor),
        seed: {
            ...ALERT_SEED,
            imdb_enh_watchlistSnapshot: { v:1, ts:1, titles },
            imdb_enh_watchlistAlertState: { checkedAt:1, cursor:'', seen:{} },
        },
    });
    await worker.fireAlarm('imdb-enhanced:watchlist-alerts');
    assert(writes.length >= 5, `progress must be recorded per title, saw ${writes.length} writes`);
    /* And the cursor is a title, not a position: the snapshot is rewritten in whatever
       order the watchlist page rendered, so an index points at an unrelated title the
       moment somebody re-sorts their list. */
    writes.forEach(cursor => assert.match(String(cursor), /^tt\d+$/, 'the cursor names a title'));
});

test('a redirect is refused rather than followed with the token attached', async () => {
    /* The request carries a bearer token, so it must not be sent anywhere but where it
       was addressed. Under redirect:'manual' the platform yields an opaque redirect
       instead of following, which is what this stub returns. */
    const redirected = (url, init = {}) => {
        if (init.redirect === 'manual') {
            return Promise.resolve({ type:'opaqueredirect', url, status:0, ok:false, json: () => Promise.resolve({}) });
        }
        // Followed, from somewhere else, with the token already delivered.
        return Promise.resolve({
            type: 'basic',
            url: 'https://elsewhere.example.com/3/find/tt0133093',
            status: 200,
            ok: true,
            json: () => Promise.resolve({ movie_results:[{ id:603 }], results:{ US:{ flatrate:[{ provider_name:'Netflix' }] } } }),
        });
    };
    const worker = loadBackground({
        fetchImpl: redirected,
        grantedPermissions: ['notifications'],
        seed: { ...ALERT_SEED, imdb_enh_watchlistAlertState: { checkedAt:1, cursor:'', seen:{ tt0133093:['Hulu'] } } },
    });
    await worker.fireAlarm('imdb-enhanced:watchlist-alerts');
    assert.strictEqual(worker.calls.notifications.length, 0, 'a redirect is not an answer');
    const state = worker.storage.get('imdb_enh_watchlistAlertState');
    assert.deepStrictEqual(Array.from(state.seen.tt0133093), ['Hulu'],
        'and it must not overwrite what was known with nothing');
});

test('a run resumes at the title it stopped on, not at a position in the list', async () => {
    /* The snapshot is rewritten in whatever order the watchlist page rendered, so an
       index into it points at an unrelated title the moment somebody re-sorts their
       list — and titles at the far end are starved across pass after pass. */
    const many = {};
    for (let index = 0; index < 25; index += 1) {
        many[`tt${String(1000000 + index).padStart(7, '0')}`] = { title:`Title ${index}` };
    }
    const ids = Object.keys(many);
    const worker = loadBackground({
        fetchImpl: tmdbFetch(['Netflix']),
        grantedPermissions: ['notifications'],
        seed: {
            ...ALERT_SEED,
            imdb_enh_watchlistSnapshot: { v:1, ts:1, titles: many },
            imdb_enh_watchlistAlertState: { checkedAt:1, cursor:'', seen:{} },
        },
    });
    await worker.fireAlarm('imdb-enhanced:watchlist-alerts');
    const first = worker.storage.get('imdb_enh_watchlistAlertState');
    assert.strictEqual(first.cursor, ids[20], 'after twenty titles it stops on the twenty-first');

    // The same titles, in a different order, which is what re-sorting a watchlist does.
    const reordered = {};
    [...ids].reverse().forEach(id => { reordered[id] = many[id]; });
    const second = loadBackground({
        fetchImpl: tmdbFetch(['Netflix']),
        grantedPermissions: ['notifications'],
        seed: {
            ...ALERT_SEED,
            imdb_enh_watchlistSnapshot: { v:1, ts:1, titles: reordered },
            imdb_enh_watchlistAlertState: { checkedAt:1, cursor:first.cursor, seen:{} },
        },
        onStateWrite: () => {},
    });
    const asked = [];
    second.calls.fetches.length = 0;
    await second.fireAlarm('imdb-enhanced:watchlist-alerts');
    second.calls.fetches.forEach(([url]) => {
        const found = String(url).match(/find\/(tt\d+)/)?.[1];
        if (found) asked.push(found);
    });
    assert.strictEqual(asked[0], first.cursor,
        'the next run picks up the title it stopped on, wherever it now sits in the list');
});

test('an arrival is not recorded until it has actually been shown', async () => {
    /* Progress is written as the run goes so a terminated worker keeps its place, and a
       title that has produced news must be exempt from that: once its new providers are
       stored the arrival is not new again, and a worker stopped between the write and the
       notification would lose it. What is asserted is the state at the moment it is
       written, not the state at the end. */
    const writes = [];
    const worker = loadBackground({
        fetchImpl: tmdbFetch(['Netflix', 'Hulu']),
        grantedPermissions: ['notifications'],
        onStateWrite: value => writes.push(JSON.parse(JSON.stringify(value.seen || {}))),
        seed: {
            ...ALERT_SEED,
            imdb_enh_watchlistAlertState: { checkedAt:1, cursor:'', seen:{ tt0133093:['Hulu'] } },
        },
    });
    await worker.fireAlarm('imdb-enhanced:watchlist-alerts');
    assert(writes.length >= 2, 'the run writes as it goes and again at the end');
    const duringLoop = writes[0];
    assert.deepStrictEqual(Array.from(duringLoop.tt0133093 || []), ['Hulu'],
        'the new provider must not be recorded before the notification was shown');
    const atEnd = writes[writes.length - 1];
    assert.deepStrictEqual(Array.from(atEnd.tt0133093), ['Netflix', 'Hulu'],
        'and must be recorded once it has been');
});

test('a cursor title that has left the watchlist does not restart the walk', async () => {
    /* Resuming by title is what stops a re-sorted watchlist scrambling the position. A
       title can also be removed, and treating "not found" as position zero starves the
       far end of the list exactly as an index did. */
    const many = {};
    for (let index = 0; index < 60; index += 1) {
        many[`tt${String(3000000 + index).padStart(7, '0')}`] = { title:`Title ${index}` };
    }
    const ids = Object.keys(many);
    const worker = loadBackground({
        fetchImpl: tmdbFetch(['Netflix']),
        grantedPermissions: ['notifications'],
        seed: {
            ...ALERT_SEED,
            imdb_enh_watchlistSnapshot: { v:1, ts:1, titles: many },
            // The title it stopped on is gone; the position it was at is remembered.
            imdb_enh_watchlistAlertState: { checkedAt:1, cursor:'tt9999999', cursorIndex:20, seen:{} },
        },
    });
    await worker.fireAlarm('imdb-enhanced:watchlist-alerts');
    const asked = worker.calls.fetches
        .map(([url]) => String(url).match(/find\/(tt\d+)/)?.[1])
        .filter(Boolean);
    assert.strictEqual(asked[0], ids[20],
        'it picks up near where it was, rather than starting the list again');
});

test('the position it stopped at is written down, not only read', async () => {
    /* The hint above was seeded by hand, so the run that has to produce it was never
       checked: writing a constant zero there left every test green and quietly turned the
       fallback back into "start from the top". */
    const many = {};
    for (let index = 0; index < 60; index += 1) {
        many[`tt${String(4000000 + index).padStart(7, '0')}`] = { title:`Title ${index}` };
    }
    const ids = Object.keys(many);
    const snapshot = { v:1, ts:1, titles: many };
    const first = loadBackground({
        fetchImpl: tmdbFetch(['Netflix']),
        grantedPermissions: ['notifications'],
        seed: {
            ...ALERT_SEED,
            imdb_enh_watchlistSnapshot: snapshot,
            imdb_enh_watchlistAlertState: { checkedAt:1, cursor:'', seen:{} },
        },
    });
    await first.fireAlarm('imdb-enhanced:watchlist-alerts');
    const state = first.storage.get('imdb_enh_watchlistAlertState');
    assert.strictEqual(state.cursor, ids[20], 'twenty titles in, it stops on the twenty-first');
    assert.strictEqual(state.cursorIndex, 20, 'and records where that was');

    /* And the number has to be that title's position rather than any number: put the run
       back with the title it stopped on removed, and it must carry on from there instead
       of walking the first twenty again. */
    const shorter = { ...many };
    delete shorter[ids[20]];
    const remaining = Object.keys(shorter);
    const second = loadBackground({
        fetchImpl: tmdbFetch(['Netflix']),
        grantedPermissions: ['notifications'],
        seed: {
            ...ALERT_SEED,
            imdb_enh_watchlistSnapshot: { v:1, ts:1, titles: shorter },
            imdb_enh_watchlistAlertState: { ...state, checkedAt:1 },
        },
    });
    await second.fireAlarm('imdb-enhanced:watchlist-alerts');
    const asked = second.calls.fetches
        .map(([url]) => String(url).match(/find\/(tt\d+)/)?.[1])
        .filter(Boolean);
    assert.strictEqual(asked[0], remaining[20],
        'the walk continues from the recorded position, not from the start');
    assert(!asked.includes(ids[0]), 'the titles it already checked are not checked again');
});

test('the worker enforces the snapshot ceiling itself', async () => {
    /* The 200-title bound decides how much of somebody else's API a schedule walks, so
       it cannot depend on another context having written the file correctly. */
    const huge = {};
    for (let index = 0; index < 250; index += 1) {
        huge[`tt${String(2000000 + index).padStart(7, '0')}`] = { title:`Title ${index}` };
    }
    const beyondTheBound = `tt${String(2000000 + 249).padStart(7, '0')}`;
    const worker = loadBackground({
        fetchImpl: tmdbFetch(['Netflix']),
        grantedPermissions: ['notifications'],
        seed: {
            ...ALERT_SEED,
            imdb_enh_watchlistSnapshot: { v:1, ts:1, titles: huge },
            imdb_enh_watchlistAlertState: { checkedAt:1, cursor:'', seen:{ [beyondTheBound]:['Netflix'] } },
        },
    });
    await worker.fireAlarm('imdb-enhanced:watchlist-alerts');
    const state = worker.storage.get('imdb_enh_watchlistAlertState');
    assert.strictEqual(state.seen[beyondTheBound], undefined,
        'a title past the ceiling is not part of the list this walks');
});

test('two titles arriving on the same day are one notification, not two', async () => {
    /* The whole shape Letterboxd's version has, and the reason this runs on an alarm
       rather than per title: one digest a day. With a single title in the list a batched
       notification and a per-title one look identical, so this needs two. */
    const twoTitles = url => {
        if (url.includes('/find/tt0133093')) {
            return Promise.resolve({ ok:true, json: () => Promise.resolve({ movie_results:[{ id:603 }] }) });
        }
        if (url.includes('/find/tt0234215')) {
            return Promise.resolve({ ok:true, json: () => Promise.resolve({ movie_results:[{ id:604 }] }) });
        }
        if (url.includes('/movie/')) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ results:{ US:{ flatrate:[{ provider_name:'Netflix' }] } } }),
            });
        }
        return Promise.resolve({ ok:false, status:404, json: () => Promise.resolve({}) });
    };
    const worker = loadBackground({
        fetchImpl: twoTitles,
        grantedPermissions: ['notifications'],
        seed: {
            ...ALERT_SEED,
            imdb_enh_watchlistSnapshot: { v:1, ts:1, titles:{
                tt0133093:{ title:'The Matrix' },
                tt0234215:{ title:'The Matrix Reloaded' },
            } },
            imdb_enh_watchlistAlertState: { checkedAt:1, cursor:0, seen:{ tt0133093:[], tt0234215:[] } },
        },
    });
    await worker.fireAlarm('imdb-enhanced:watchlist-alerts');

    assert.strictEqual(worker.calls.notifications.length, 1,
        'a day with two arrivals is still one interruption');
    assert.match(worker.calls.notifications[0].message, /The Matrix/);
    assert.match(worker.calls.notifications[0].message, /The Matrix Reloaded/,
        'and it names both rather than only the first');
});

test('an arrival on a service nobody asked about is not a notification', async () => {
    const worker = loadBackground({
        fetchImpl: tmdbFetch(['Hulu', 'Shudder']),
        seed: {
            ...ALERT_SEED,
            imdb_enh_watchlistAlertState: { checkedAt:1, cursor:0, seen:{ tt0133093:['Hulu'] } },
        },
        grantedPermissions: ['notifications'],
    });
    await worker.fireAlarm('imdb-enhanced:watchlist-alerts');

    assert.strictEqual(worker.calls.notifications.length, 0,
        'service 15 was not one of the chosen ones');
    assert.deepStrictEqual(Array.from(worker.storage.get('imdb_enh_watchlistAlertState').seen.tt0133093), ['Hulu', 'Shudder'],
        'though it is still recorded, so it is not news next time either');
});

test('without the notification permission the check still records what it saw', async () => {
    const worker = loadBackground({
        fetchImpl: tmdbFetch(['Netflix', 'Hulu']),
        seed: {
            ...ALERT_SEED,
            imdb_enh_watchlistAlertState: { checkedAt:1, cursor:0, seen:{ tt0133093:['Hulu'] } },
        },
        grantedPermissions: [],
    });
    await worker.fireAlarm('imdb-enhanced:watchlist-alerts');

    assert.strictEqual(worker.calls.notifications.length, 0, 'nothing is shown without permission');
    /* And what it saw is kept, so granting the permission later does not produce a flood
       of things that arrived months ago. */
    assert.deepStrictEqual(Array.from(worker.storage.get('imdb_enh_watchlistAlertState').seen.tt0133093), ['Netflix', 'Hulu']);
});

test('nothing is requested without a token, chosen services, or a recorded watchlist', async () => {
    const cases = [
        ['no token', { ...ALERT_SEED, imdb_enh_tmdbReadToken: '' }],
        ['no chosen services', { ...ALERT_SEED, imdb_enh_watchlistAlertServices: [] }],
        ['nothing recorded', { ...ALERT_SEED, imdb_enh_watchlistSnapshot: { v:1, ts:1, titles:{} } }],
        ['switched off', { ...ALERT_SEED, imdb_enh_watchlistAlerts: false }],
    ];
    for (const [name, seed] of cases) {
        const worker = loadBackground({ fetchImpl: tmdbFetch(['Netflix']), seed, grantedPermissions: ['notifications'] });
        await worker.fireAlarm('imdb-enhanced:watchlist-alerts');
        assert.strictEqual(worker.calls.fetches.length, 0, `${name} must cost no request`);
        assert.strictEqual(worker.calls.notifications.length, 0, `${name} must say nothing`);

        /* Every assertion above is also true of a run that never started, so the same
           worker is asked to prove a request is observable at all: put the missing piece
           back and fire again. Without this the whole case passes if anything ever makes
           the run slower than the wait. */
        /* A fresh worker rather than the same one: a run that was merely slow is still
           in flight, and letting it see the restored settings would count its late
           request as the control passing. */
        const control = loadBackground({
            fetchImpl: tmdbFetch(['Netflix']),
            grantedPermissions: ['notifications'],
            seed: { ...ALERT_SEED, imdb_enh_watchlistAlertState: { checkedAt:1, cursor:'', seen:{} } },
        });
        await control.fireAlarm('imdb-enhanced:watchlist-alerts');
        assert(control.calls.fetches.length > 0,
            `${name}: with the missing piece restored a request must appear, or this test proves nothing`);
    }
});

test('a title that has left the watchlist is forgotten', async () => {
    const worker = loadBackground({
        fetchImpl: tmdbFetch(['Netflix']),
        seed: {
            ...ALERT_SEED,
            imdb_enh_watchlistAlertState: { checkedAt:1, cursor:0, seen:{ tt0133093:['Netflix'], tt0000001:['Netflix', 'Hulu'] } },
        },
        grantedPermissions: ['notifications'],
    });
    await worker.fireAlarm('imdb-enhanced:watchlist-alerts');

    const seen = worker.storage.get('imdb_enh_watchlistAlertState').seen;
    assert.deepStrictEqual(Array.from(Object.keys(seen)), ['tt0133093'],
        'the record cannot grow forever off titles nobody is waiting for');
});

(async () => {
    let failures = 0;
    for (const { name, fn } of cases) {
        try {
            await fn();
            console.log(`ok - ${name}`);
        } catch (error) {
            failures += 1;
            console.error(`not ok - ${name}`);
            console.error(error);
        }
    }
    if (failures) {
        console.error(`${failures} background test(s) failed.`);
        process.exit(1);
    }
    console.log('Privileged fetch bridge refuses unsafe redirects in both engine shapes.');
})();
