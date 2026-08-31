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

/* Every case here is async. Registering them and awaiting in order keeps a rejected
   assertion from being swallowed as an unhandled rejection and reported as a pass. */
const cases = [];
function test(name, fn) { cases.push({ name, fn }); }

/* The two engines differ in exactly one way that reaches this file: Chromium's chrome.*
   returns promises while Gecko's alias is callback-style. callApi is written to accept
   both, so every case below runs against both shapes. */
/* fastTimers fires the worker's own request timer on the next tick instead of after ten
   seconds, so a timeout can be exercised for real rather than asserted from source. */
function loadBackground({ engine = 'chromium', fetchImpl, fastTimers = false } = {}) {
    const listeners = [];
    const calls = { fetches: [], permissions: [], tabs: [], openedOptions: 0 };
    const storage = new Map();
    const grantedOrigins = new Set(['https://www.rottentomatoes.com/*', 'https://query.wikidata.org/*']);

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
                contains: (arg, done) => { calls.permissions.push(['contains', arg.origins]); done(grantedOrigins.size > 0 && arg.origins.every(o => grantedOrigins.has(o))); },
                remove: (arg, done) => { calls.permissions.push(['remove', arg.origins]); arg.origins.forEach(o => grantedOrigins.delete(o)); done(true); },
                request: (arg, done) => { calls.permissions.push(['request', arg.origins]); done(false); },
            },
            tabs: { create: options => { calls.tabs.push(options); } },
            runtime: {
                lastError: null,
                openOptionsPage: () => { calls.openedOptions += 1; },
                getManifest: () => ({
                    version: '2.15.0',
                    optional_host_permissions: [
                        'https://www.rottentomatoes.com/*',
                        'https://query.wikidata.org/*',
                        'http://localhost/*',
                    ],
                }),
                onInstalled: { addListener() {} },
                onStartup: { addListener() {} },
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
                        Object.entries(items || {}).forEach(([key, value]) => storage.set(key, value));
                        return undefined;
                    }),
                },
                onChanged: { addListener() {} },
            },
            declarativeNetRequest: { updateDynamicRules: api(() => undefined) },
        },
    };
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
    return { dispatch, calls, storage, grantedOrigins };
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

for (const engine of ['chromium', 'gecko']) {
    test(`[${engine}] an allowlisted request with no redirect succeeds`, async () => {
        const { dispatch } = loadBackground({ engine, fetchImpl: makeFetch({}) });
        const response = await dispatch(request('https://letterboxd.com/film/the-matrix/'), IMDB_SENDER);
        assert.strictEqual(response.ok, true);
        assert.strictEqual(response.responseText, 'PAYLOAD');
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
        const { dispatch, calls } = loadBackground({ engine, fetchImpl: makeFetch({}) });
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
