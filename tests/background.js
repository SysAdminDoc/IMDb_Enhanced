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
function loadBackground({ engine = 'chromium', fetchImpl } = {}) {
    const listeners = [];
    const calls = { fetches: [] };
    const storage = new Map();

    const api = (result) => (arg, done) => {
        if (engine === 'chromium') return Promise.resolve(result(arg));
        // Gecko: callback form, no thenable returned.
        done(result(arg));
        return undefined;
    };

    const sandbox = {
        console: { warn() {}, log() {}, error() {} },
        setTimeout,
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
            runtime: {
                lastError: null,
                getManifest: () => ({ version: '2.15.0' }),
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
    return { dispatch, calls, storage };
}

const IMDB_SENDER = { url: 'https://www.imdb.com/title/tt0133093/', tab: { id: 7 } };

/* Simulates a redirect chain. `chain` maps a start URL to the URL the response
   ultimately came from, which is exactly what response.url reports after a followed
   redirect. Under redirect:'error' any hop rejects, the way fetch does. */
function makeFetch(chain, { body = 'PAYLOAD', status = 200 } = {}) {
    return (url, init = {}) => {
        const finalUrl = chain[url] || url;
        const redirected = finalUrl !== url;
        if (redirected && init.redirect === 'error') {
            return Promise.reject(new TypeError('Failed to fetch: redirect mode is error'));
        }
        return Promise.resolve({
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
        const { dispatch } = loadBackground({
            engine,
            fetchImpl: (url, init) => {
                captured.push(init);
                if (init.redirect === 'error') {
                    return Promise.reject(new TypeError('Failed to fetch: redirect mode is error'));
                }
                return Promise.resolve({
                    url: 'https://attacker.example/steal',
                    status: 200,
                    redirected: true,
                    text: () => Promise.resolve('ok'),
                });
            },
        });
        const response = await dispatch(request('http://localhost:7878/api/v3/movie', {
            headers: { 'X-Api-Key': 'radarr-secret', Accept: 'application/json' },
        }), IMDB_SENDER);
        assert.strictEqual(response.ok, false);
        assert.strictEqual(response.errorType, 'redirect_blocked');
        assert.strictEqual(captured[0].redirect, 'error',
            'a request carrying an API key must forbid redirects outright, since a followed hop cannot be un-sent');
        assert.strictEqual(captured[0].headers['X-Api-Key'], 'radarr-secret',
            'the credential must still reach the local service it was meant for');
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
            assert.strictEqual(captured[0].redirect, 'error', `${header} must be treated as a credential`);
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

    test(`[${engine}] a redirect loop is reported as a refused redirect, not a mystery`, async () => {
        const { dispatch } = loadBackground({
            engine,
            // What the engine does once its own hop limit is exhausted.
            fetchImpl: () => Promise.reject(new TypeError('Failed to fetch: too many redirects')),
        });
        const response = await dispatch(request('https://letterboxd.com/imdb/tt0133093/'), IMDB_SENDER);
        assert.strictEqual(response.ok, false);
        assert.strictEqual(response.errorType, 'redirect_blocked');
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
