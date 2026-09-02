'use strict';

const STORAGE_PREFIX = 'imdb_enh_';
const MAX_RESPONSE_TEXT = 8 * 1024 * 1024;
const REQUEST_TIMEOUT = 30_000;
const ALLOWED_CONTENT_HOSTS = new Set(['www.imdb.com']);
/* The hosts this worker will fetch, taken from the origins the manifest declares rather
   than listed again here. Kept as defence in depth behind the permission check: a second
   copy of the same list only ever drifts, and the copy that drifted was this one, which
   silently refused every request to a newly declared provider. */
let allowedRequestHosts = null;
function getAllowedRequestHosts() {
    if (allowedRequestHosts) return allowedRequestHosts;
    const manifest = chrome.runtime.getManifest();
    const patterns = [
        ...(manifest.host_permissions || []),
        ...(manifest.optional_host_permissions || []),
    ];
    allowedRequestHosts = new Set(patterns.map(pattern => {
        try { return new URL(pattern.replace('*.', '')).hostname.toLowerCase(); }
        catch { return ''; }
    }).filter(Boolean));
    return allowedRequestHosts;
}
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);
/* Each credential is bound to the destination it may be attached to and, where the
   protocol needs one, the scheme it is sent under. Binding it here rather than trusting
   the request is the point: a caller naming a key it is not entitled to, or naming a
   destination that does not own it, gets nothing. The scheme is declared here too so the
   page cannot influence any part of the header it is unable to read. */
const CREDENTIAL_DESTINATIONS = new Map([
    ['imdb_enh_radarrApiKey', { loopback: true, header: 'X-Api-Key' }],
    ['imdb_enh_sonarrApiKey', { loopback: true, header: 'X-Api-Key' }],
    ['imdb_enh_seerrApiKey', { loopback: true, header: 'X-Api-Key' }],
    ['imdb_enh_plexToken', { loopback: true, header: 'X-Plex-Token' }],
    /* Jellyfin 12.0 reads X-Emby-Token only where the operator re-enabled legacy
       authorization, so its token rides in the scheme its parser always accepts. The
       parts around the token name this client in the server's device list; only Token
       carries the secret, and the closing quote is the suffix because the parser trims
       quotes off each value it reads. */
    ['imdb_enh_jellyfinApiKey', {
        loopback: true,
        header: 'Authorization',
        scheme: `MediaBrowser Client="IMDb Enhanced", Device="Browser", DeviceId="imdb-enhanced", Version="${chrome.runtime.getManifest().version}", Token="`,
        suffix: '"',
    }],
    ['imdb_enh_embyApiKey', { loopback: true, header: 'X-Emby-Token' }],
    // The one credential that goes anywhere but your own machine, and it goes to exactly
    // one host over TLS.
    ['imdb_enh_tmdbReadToken', { host: 'api.themoviedb.org', header: 'Authorization', scheme: 'Bearer ' }],
    /* OMDb accepts its key in the query string and nowhere else, so this binding names
       the parameter instead of a header scheme. The parameter name comes from here, like
       the scheme does, so a page that cannot read the key cannot shape what carries it.
       The URL therefore holds a secret: the address is never handed back to the page. */
    ['imdb_enh_omdbApiKey', { host: 'www.omdbapi.com', query: 'apikey' }],
    // MDBList takes its key the same way and nowhere else.
    ['imdb_enh_mdblistApiKey', { host: 'api.mdblist.com', query: 'apikey' }],
]);
const CREDENTIAL_STORAGE_KEYS = new Set(CREDENTIAL_DESTINATIONS.keys());
/* Credentials the userscript attaches to local-service calls. fetch strips
   Authorization across an origin change but carries arbitrary custom headers with
   it, so these are exactly the ones a redirect could hand to a third party. Compared
   lowercased: header names are case-insensitive. */
const SENSITIVE_HEADER_NAMES = new Set([
    'authorization', 'cookie', 'proxy-authorization',
    'x-api-key', 'x-plex-token', 'x-emby-token', 'x-mediabrowser-token',
]);
/* Redirects are permitted only within one origin, so no hop can move a request to a
   host the allowlist never approved or across the loopback boundary. Letterboxd's
   /imdb/{ttID}/ route — the one deliberate redirect this extension depends on — is
   same-origin and still works. The engine caps a same-origin chain at 20 hops and
   reports a loop as a network failure; this is the bound that matters, because a
   chain that cannot leave its origin cannot reach anything new by being long. */

/* A content script may only ask about origins this build actually declares as optional.
   Without this it could name any pattern at all and use the background to probe or drop
   permissions the extension never asked for. */
function isKnownOptionalOrigin(origin) {
    const declared = chrome.runtime.getManifest().optional_host_permissions || [];
    return typeof origin === 'string' && declared.includes(origin);
}

function manifestOriginMatchesTarget(pattern, target) {
    if (typeof pattern !== 'string' || !target?.url) return false;
    try {
        const wildcardHost = pattern.includes('://*.');
        const parsed = new URL(pattern.replace('://*.', '://').replace(/\*$/, ''));
        if (parsed.protocol !== target.url.protocol) return false;
        const hostname = parsed.hostname.toLowerCase();
        return target.hostname === hostname
            || (wildcardHost && target.hostname.endsWith(`.${hostname}`));
    } catch {
        return false;
    }
}

async function hasRequestOriginPermission(target) {
    const manifest = chrome.runtime.getManifest();
    const required = (manifest.host_permissions || [])
        .some(pattern => manifestOriginMatchesTarget(pattern, target));
    if (required) return true;
    const optionalPattern = (manifest.optional_host_permissions || [])
        .find(pattern => manifestOriginMatchesTarget(pattern, target));
    if (!optionalPattern) return false;
    try {
        return await callApi(chrome.permissions, 'contains', { origins:[optionalPattern] }) === true;
    } catch {
        return false;
    }
}

function isLoopbackHost(hostname) {
    return LOOPBACK_HOSTS.has(String(hostname || '').toLowerCase());
}

function describeRequestUrl(value) {
    try {
        const url = new URL(String(value || ''));
        if (String(value || '').length > 8192) return null;
        if (!/^https?:$/.test(url.protocol)) return null;
        if (url.username || url.password) return null;
        const hostname = url.hostname.toLowerCase();
        if (!getAllowedRequestHosts().has(hostname)) return null;
        return { url, hostname, origin:url.origin, loopback:isLoopbackHost(hostname) };
    } catch {
        return null;
    }
}

function hasSensitiveHeader(headers) {
    return Object.keys(headers || {}).some(name => SENSITIVE_HEADER_NAMES.has(String(name).toLowerCase()));
}
/* Gecko's chrome.* alias is callback-style, so awaiting the return value of these
   calls is not portable. The callback form is accepted by both engines. */
function callApi(namespace, method, arg) {
    return new Promise((resolve, reject) => {
        const done = value => {
            const failure = chrome.runtime && chrome.runtime.lastError;
            if (failure) reject(new Error(failure.message || 'Extension API call failed'));
            else resolve(value);
        };
        try {
            const maybe = arg === undefined
                ? namespace[method](done)
                : namespace[method](arg, done);
            if (maybe && typeof maybe.then === 'function') maybe.then(resolve, reject);
        } catch (error) { reject(error); }
    });
}

function boundedApiError(error, fallback) {
    const message = String(error?.message || '').trim().replace(/\s+/g, ' ');
    return (message || fallback).slice(0, 240);
}

async function openRecoveryPage() {
    if (typeof chrome.runtime.openOptionsPage === 'function') {
        await callApi(chrome.runtime, 'openOptionsPage');
        return;
    }
    await callApi(chrome.tabs, 'create', { url:chrome.runtime.getURL('recovery.html') });
}

const activeRequests = new Map();
let adRuleUpdate = Promise.resolve();

/* Dynamic rules persist across sessions and extension updates, so removing only
   the ids this build knows about would strand any rule a future release drops.
   The whole reserved band is cleared on every update instead. */
const AD_RULE_ID_BASE = 1001;
const AD_RULE_ID_CAPACITY = 50;
const AD_RULE_IDS = Array.from({ length:AD_RULE_ID_CAPACITY }, (_, index) => AD_RULE_ID_BASE + index);
const AD_RULES = [
    '||amazon-adsystem.com/',
    '||advertising.amazon.dev/',
    '||images-na.ssl-images-amazon.com/images/S/sash/',
    '||sb.scorecardresearch.com/',
    '||fls-na.amazon.com/',
    '||unagi.amazon.com/',
    '||unagi-na.amazon.com/',
].map((urlFilter, index) => ({
    id: AD_RULE_ID_BASE + index,
    priority: 1,
    action: { type:'block' },
    condition: {
        urlFilter,
        initiatorDomains: ['imdb.com'],
        resourceTypes: ['script', 'image', 'stylesheet', 'sub_frame', 'xmlhttprequest', 'media', 'font', 'object', 'other', 'ping'],
    },
}));

function isAllowedContentSender(sender) {
    try {
        const url = new URL(sender?.url || '');
        return url.protocol === 'https:' && ALLOWED_CONTENT_HOSTS.has(url.hostname.toLowerCase());
    } catch {
        return false;
    }
}

function isHttpUrl(value) {
    return Boolean(describeRequestUrl(value));
}

function normalizeHeaders(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const headers = {};
    Object.entries(value).slice(0, 50).forEach(([name, raw]) => {
        const key = String(name).trim().slice(0, 120);
        const item = String(raw ?? '').slice(0, 4096);
        if (!key || /[\u0000-\u001f\u007f]/.test(key) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(item)) return;
        headers[key] = item;
    });
    return headers;
}

async function updateAdBlocking(enabled) {
    adRuleUpdate = adRuleUpdate.catch(() => {}).then(() => callApi(chrome.declarativeNetRequest, 'updateDynamicRules', {
            removeRuleIds: AD_RULE_IDS,
            addRules: enabled ? AD_RULES : [],
        }));
    await adRuleUpdate;
}

async function syncAdBlockingFromStorage() {
    try {
        const stored = await callApi(chrome.storage.local, 'get', `${STORAGE_PREFIX}removeAds`);
        await updateAdBlocking(stored[`${STORAGE_PREFIX}removeAds`] !== false);
    } catch (error) {
        console.warn('[IMDb Enhanced] extension ad rules could not be synchronized:', error);
    }
}

function getRequestKey(message, sender) {
    return `${Number(sender?.tab?.id) || 0}:${String(message?.id || '')}`;
}

async function sendHttpRequest(message, sender, sendResponse) {
    const requestId = String(message.id || '');
    const requestKey = getRequestKey(message, sender);
    const url = String(message.url || '');
    const target = describeRequestUrl(url);
    if (!requestId || !target) {
        sendResponse({ ok:false, status:0, errorType:'invalid_url', error:'Invalid HTTP(S) request' });
        return;
    }
    /* Declaring an optional origin says the extension may ask for it, not that the user
       granted it. A permissive CORS response can otherwise let the worker fetch without
       host access, bypassing the choice shown in settings. Check before reading a stored
       credential, registering an active request, or touching fetch. */
    if (!await hasRequestOriginPermission(target)) {
        sendResponse({
            ok:false,
            status:0,
            errorType:'permission_not_granted',
            error:'Access to this service has not been granted',
        });
        return;
    }

    const controller = new AbortController();
    /* An abort is reported as AbortError whatever caused it, so a request that ran out of
       time and one the page cancelled on navigation are indistinguishable downstream.
       Only this timer knows which happened, so it records it. */
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, Math.min(
        Math.max(Number(message.timeout) || 10_000, 1_000),
        REQUEST_TIMEOUT,
    ));
    activeRequests.set(requestKey, controller);

    const method = String(message.method || 'GET').toUpperCase().slice(0, 16);
    const headers = normalizeHeaders(message.headers);
    /* The content script cannot read integration credentials — the bridge keeps them out
       of its world entirely — so it names the header and the stored key it wants and the
       value is fetched here. Two conditions, both required: the key must be one of the
       known credential settings, and the destination must already have been validated as
       loopback. That is what stops this from becoming a way to read storage into an
       arbitrary request. */
    const credentialRef = message.credentialHeader || message.credentialQuery;
    const credentialKey = credentialRef ? `${STORAGE_PREFIX}${credentialRef.ref}` : '';
    const binding = CREDENTIAL_DESTINATIONS.get(credentialKey);
    /* Three conditions, all required: the key must be one this worker knows, the request
       must already have been validated as a URL it will fetch, and the destination must be
       the one that key is bound to. Nothing else earns a credential. A loopback key goes
       only to your own machine; a host-bound key goes only to that host. */
    /* A host-bound credential goes over TLS or not at all. `scheme` in the binding is the
       header scheme, not the URL's, and describeRequestUrl accepts http as well as https
       for the sake of loopback services, so plain http://api.themoviedb.org would
       otherwise have carried the token in clear text. */
    const destinationOwnsCredential = Boolean(binding)
        && (binding.loopback
            ? target.loopback
            : target.hostname === binding.host && target.url.protocol === 'https:');
    /* The address actually fetched. It differs from the one the page asked for only
       where the binding says the credential rides in the query string, and that version
       never leaves this worker. */
    let requestUrl = url;
    let credentialInUrl = false;
    if (destinationOwnsCredential) {
        const stored = await callApi(chrome.storage.local, 'get', credentialKey).catch(() => null);
        const value = stored?.[credentialKey];
        // Rejected the same way normalizeHeaders rejects one: a control character here
        // would be a header-injection vector.
        if (typeof value === 'string' && value.trim() && !/[\u0000-\u001f\u007f]/.test(value)) {
            if (binding.query) {
                const withKey = new URL(url);
                withKey.searchParams.set(binding.query, value.slice(0, 4096));
                requestUrl = withKey.toString();
                credentialInUrl = true;
            } else if (binding.header && !value.includes('"')) {
                /* A header name is case-insensitive and fetch folds duplicates into one
                   comma-joined value, so a page that sent its own `authorization` got its
                   text placed in front of the worker's and the destination read the page's
                   scheme name instead. Every spelling of the bound name goes before the
                   real one is written.

                   A value carrying a double quote is refused rather than sent: where the
                   binding wraps the token in quotes, one inside it ends the value early and
                   the rest is parsed as further fields. No credential these services issue
                   contains one, so this can only be a paste of the wrong thing. */
                Object.keys(headers).forEach(name => {
                    if (name.toLowerCase() === binding.header.toLowerCase()) delete headers[name];
                });
                /* The name, the scheme and anything closing the value all come from the
                   binding, never from the message: a caller that cannot read the value has
                   no business shaping the header around it, or choosing which header it
                   arrives in. Every key here is bound to exactly one header name, so a
                   message asking for a different one is simply ignored rather than
                   honoured — which is what keeps one service's token out of another
                   service's authentication scheme. */
                headers[binding.header] = `${binding.scheme || ''}${value.slice(0, 4096)}${binding.suffix || ''}`;
            }
        }
    }
    const body = message.body === undefined || message.body === null
        ? undefined
        : String(message.body).slice(0, MAX_RESPONSE_TEXT);

    /* A credential-bearing request is not permitted to redirect at all: there is no
       point in the flow where a followed redirect's headers can be rewritten, so the
       only way to guarantee the token never reaches a second origin is to refuse the
       hop — and a local Radarr, Sonarr, Plex, Jellyfin or Emby endpoint has no
       legitimate reason to redirect a caller elsewhere.

       'manual' rather than 'error' because both stop the hop, but only 'manual' lets us
       say which happened. 'error' rejects with the same opaque TypeError the browser
       uses for an unreachable host ("Failed to fetch" in Chrome, "NetworkError…" in
       Firefox), so a stopped Radarr and a redirecting one were indistinguishable.
       'manual' returns an opaque-redirect response instead — the second request is
       never made, so the credential still goes nowhere — and a genuinely dead host
       still throws, so the two stay apart. */
    /* Decided by what this worker attached, not by the header name the caller chose. Name
       the credential header something outside the sensitive list and the old predicate said
       no, which let a token-bearing request follow a redirect off its origin. The name check
       stays for headers the caller supplied itself. */
    const carriesCredentials = destinationOwnsCredential || hasSensitiveHeader(headers);

    fetch(requestUrl, {
        method,
        headers,
        body,
        credentials: 'omit',
        redirect: carriesCredentials ? 'manual' : 'follow',
        signal: controller.signal,
    }).then(async response => {
        if (response.type === 'opaqueredirect' || (carriesCredentials && response.status === 0)) {
            sendResponse({
                ok:false,
                status:0,
                errorType:'redirect_blocked',
                error:'The service tried to redirect a request carrying a credential, so it was stopped',
            });
            return;
        }
        /* The initial URL was allowlisted; the URL the response actually came from is
           the one that matters. Validate it before the body is read, so a redirected
           response is discarded rather than parsed. */
        /* Where the key rides in the URL, the address this response came from carries
           it. Validate that address, then report the one the page asked for: handing back
           the other would put the secret into the world the bridge keeps it out of. */
        const landedUrl = String(response.url || requestUrl);
        const finalUrl = credentialInUrl ? url : landedUrl;
        const landed = describeRequestUrl(landedUrl);
        if (!landed) {
            sendResponse({
                ok:false,
                status:0,
                errorType:'redirect_destination_not_allowed',
                error:'Request was redirected to a destination that is not allowed',
            });
            return;
        }
        if (landed.loopback !== target.loopback) {
            sendResponse({
                ok:false,
                status:0,
                errorType:'redirect_crossed_trust_boundary',
                error:'Request was redirected across the local/public boundary',
            });
            return;
        }
        if (landed.origin !== target.origin) {
            sendResponse({
                ok:false,
                status:0,
                errorType:'redirect_changed_origin',
                error:'Request was redirected to a different origin',
            });
            return;
        }
        const text = await response.text();
        if (text.length > MAX_RESPONSE_TEXT) throw new Error('Response was too large');
        sendResponse({
            ok: response.status < 400,
            status: response.status,
            responseText: text,
            responseURL: finalUrl,
        });
    }).catch(error => {
        const aborted = error?.name === 'AbortError';
        const message = String(error?.message || 'Request failed');
        /* Classified from what this code knows, never from the message: browsers do not
           leak redirect detail into fetch's TypeError, so a refused hop and a dead host
           read identically here. A refused hop is recognized above, from the response,
           which is why this is left as a plain network failure. */
        let errorType = aborted ? (timedOut ? 'timeout' : 'aborted') : 'network';
        sendResponse({
            ok:false,
            status: Number(error?.status) || 0,
            errorType,
            error: message.slice(0, 240),
        });
    }).finally(() => {
        clearTimeout(timeout);
        activeRequests.delete(requestKey);
    });
}

/* An extension installed unpacked can never update itself, and Chrome only permits
   off-store hosting on Linux, so the only honest mitigation is to notice and say so.
   The published userscript is the version of record; raw.githubusercontent.com serves
   it with Access-Control-Allow-Origin: *, so this needs no host permission and no
   manifest change. It is a read of a public file — no identifiers are sent. */
const UPDATE_SOURCE_URL = 'https://raw.githubusercontent.com/SysAdminDoc/IMDb_Enhanced/main/IMDb_Enhanced.user.js';
const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000;
const UPDATE_STATE_KEY = `${STORAGE_PREFIX}updateState`;
const UPDATE_SETTING_KEY = `${STORAGE_PREFIX}updateNotice`;
const UPDATE_HEAD_BYTES = 2048;

function parseUserscriptVersion(text) {
    const match = String(text || '').slice(0, UPDATE_HEAD_BYTES).match(/^\/\/\s*@version\s+([0-9]+(?:\.[0-9]+){0,3})\s*$/m);
    return match ? match[1] : '';
}

/* Numeric, segment-wise: '2.9.0' must not compare as newer than '2.13.0'. */
function isNewerVersion(candidate, current) {
    const a = String(candidate).split('.').map(Number);
    const b = String(current).split('.').map(Number);
    if (a.some(Number.isNaN) || b.some(Number.isNaN)) return false;
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
        const left = a[i] || 0;
        const right = b[i] || 0;
        if (left !== right) return left > right;
    }
    return false;
}

async function checkForUpdate() {
    const stored = await callApi(chrome.storage.local, 'get', [UPDATE_STATE_KEY, UPDATE_SETTING_KEY]).catch(() => null);
    if (!stored || stored[UPDATE_SETTING_KEY] === false) return;
    const previous = stored[UPDATE_STATE_KEY] || {};
    const now = Date.now();
    if (Number.isFinite(previous.checkedAt) && now - previous.checkedAt < UPDATE_CHECK_INTERVAL) return;
    const current = chrome.runtime.getManifest().version;
    let latest = '';
    try {
        const response = await fetch(UPDATE_SOURCE_URL, { credentials:'omit', cache:'no-cache' });
        if (response.ok) latest = parseUserscriptVersion(await response.text());
    } catch { /* offline or blocked: record the attempt and try again tomorrow */ }
    await callApi(chrome.storage.local, 'set', {
        [UPDATE_STATE_KEY]: { checkedAt:now, latest, available: Boolean(latest) && isNewerVersion(latest, current) },
    }).catch(() => { /* a failed write only costs one skipped check */ });
}

/* The toolbar button was inert, which meant every recovery action — backup, restore,
   reset, permission repair — depended on the content script having successfully
   injected into an IMDb page. That is exactly the condition that is broken when someone
   needs those actions. On Chromium this handler runs because no default_popup is set;
   Firefox opens permissions.html instead, which links to the same page. */
if (chrome.action?.onClicked) {
    chrome.action.onClicked.addListener(() => {
        openRecoveryPage().catch(error => {
            console.warn('[IMDb Enhanced] recovery page could not be opened:', boundedApiError(error, 'Extension API call failed'));
        });
    });
}

/* ---- Watchlist availability alerts -------------------------------------------------
   The one thing here that has to keep working with every IMDb tab closed. The page
   writes down what is on the watchlist; this checks it on a schedule and says something
   once, in one notification, when a title turns up on a service that was asked about.

   Deliberately slow. A watchlist is up to 200 titles in the snapshot and each check is
   two calls to TMDB, so a run takes a slice and moves a cursor: the whole list comes
   round over a few days rather than in one burst on somebody else's API. */
const WATCHLIST_ALARM = 'imdb-enhanced:watchlist-alerts';
const WATCHLIST_ALARM_MINUTES = 24 * 60;
const WATCHLIST_SETTING_KEY = `${STORAGE_PREFIX}watchlistAlerts`;
const WATCHLIST_SERVICES_KEY = `${STORAGE_PREFIX}watchlistAlertServices`;
const WATCHLIST_SNAPSHOT_KEY = `${STORAGE_PREFIX}watchlistSnapshot`;
const WATCHLIST_STATE_KEY = `${STORAGE_PREFIX}watchlistAlertState`;
const WATCHLIST_REGION_KEY = `${STORAGE_PREFIX}availabilityRegion`;
const WATCHLIST_TOKEN_KEY = 'imdb_enh_tmdbReadToken';
const WATCHLIST_BATCH = 20;
// The same ceiling the page writes under, enforced again on the way out of storage.
const WATCHLIST_SNAPSHOT_LIMIT = 200;
// One digest a day. The alarm is re-created on every startup, so without this a person
// who restarts their browser four times gets four checks and four notifications.
const WATCHLIST_MIN_INTERVAL = 20 * 60 * 60 * 1000;
const WATCHLIST_NOTIFICATION_TITLES = 3;

// How many service names the picker is offered, not how long one may be.
const WATCHLIST_SERVICE_LIMIT = 60;

function boundedProviderNames(value) {
    return [...new Set((Array.isArray(value) ? value : [])
        .map(entry => String(entry?.provider_name || '').trim().slice(0, 60))
        .filter(Boolean))].slice(0, 40);
}

const TMDB_ORIGIN = 'https://api.themoviedb.org/';

async function tmdbJson(path, token) {
    const url = `${TMDB_ORIGIN}3/${path}`;
    /* The same gate every other request here passes. Somebody who declined TMDB, or
       revoked it, must not have their watchlist sent there on a timer — and TMDB answers
       cross-origin requests from anywhere, so nothing else would have stopped it. */
    /* The gate takes a described URL, not a string: the same shape every other
       request in this file is checked with. */
    const target = describeRequestUrl(url);
    if (!target || !await hasRequestOriginPermission(target)) throw new Error('TMDB access is not granted');
    const response = await fetch(url, {
        credentials: 'omit',
        cache: 'no-cache',
        // It carries a bearer token, so it refuses to be sent anywhere else.
        redirect: 'manual',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (response.type === 'opaqueredirect') throw new Error('TMDB redirected a request carrying a token');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

/* Which services carry it where you are, right now. Movies only: TMDB has no
   watch/providers for a series episode, and answering "everywhere" for one would be a
   notification about nothing. */
async function readAvailableProviders(imdbId, region, token) {
    const found = await tmdbJson(`find/${encodeURIComponent(imdbId)}?external_source=imdb_id`, token);
    const movie = Array.isArray(found?.movie_results) ? found.movie_results[0] : null;
    if (!movie?.id) return null;
    const providers = await tmdbJson(`movie/${Number(movie.id)}/watch/providers`, token);
    const regional = providers?.results?.[region];
    if (!regional) return [];
    return boundedProviderNames(regional.flatrate);
}

function describeArrivals(arrivals) {
    const names = arrivals.slice(0, WATCHLIST_NOTIFICATION_TITLES).map(entry => entry.title);
    const extra = arrivals.length - names.length;
    return extra > 0 ? `${names.join(', ')} and ${extra} more` : names.join(', ');
}

async function notifyArrivals(arrivals) {
    if (!arrivals.length) return true;
    const allowed = await callApi(chrome.permissions, 'contains', { permissions:['notifications'] }).catch(() => false);
    /* Asking for the permission needs a user gesture, which an alarm does not have. The
       settings panel offers it; until it is granted the run still records what it saw, so
       switching notifications on later does not produce a flood of old news. */
    /* Not shown and not lost: without the permission the run still records what it saw,
       so granting it later does not replay months of old news. */
    if (allowed !== true || !chrome.notifications?.create) return true;
    const icons = chrome.runtime.getManifest().icons || {};
    const iconPath = icons['128'] || icons['48'] || Object.values(icons)[0];
    /* Its own words come from the same catalog as everything else. A worker cannot reach
       the userscript's lookup, but chrome.i18n serves the generated _locales directly. */
    const title = chrome.i18n?.getMessage?.('notification_watchlist_title') || 'New on your watchlist';
    try {
        await callApi(chrome.notifications, 'create', {
            type: 'basic',
            iconUrl: chrome.runtime.getURL(iconPath),
            title,
            message: describeArrivals(arrivals),
        });
        return true;
    } catch (error) {
        /* Reported rather than swallowed: the providers behind an arrival are about to be
           written down as seen, and a notification nobody was shown is an arrival lost
           for good. The caller keeps them unseen so the next run says it again. */
        console.warn('[IMDb Enhanced] watchlist notification failed:', boundedApiError(error, 'Notification failed'));
        return false;
    }
}

async function runWatchlistCheck() {
    const stored = await callApi(chrome.storage.local, 'get', [
        WATCHLIST_SETTING_KEY, WATCHLIST_SERVICES_KEY, WATCHLIST_SNAPSHOT_KEY,
        WATCHLIST_STATE_KEY, WATCHLIST_REGION_KEY, WATCHLIST_TOKEN_KEY,
    ]).catch(() => null);
    if (!stored || stored[WATCHLIST_SETTING_KEY] !== true) return;
    const token = String(stored[WATCHLIST_TOKEN_KEY] || '');
    const wanted = new Set(boundedProviderNames((Array.isArray(stored[WATCHLIST_SERVICES_KEY])
        ? stored[WATCHLIST_SERVICES_KEY]
        : []).map(name => ({ provider_name: name }))));
    // No token or no chosen services: nothing to ask and nothing worth asking about.
    if (!token || !wanted.size) return;
    const titles = stored[WATCHLIST_SNAPSHOT_KEY]?.titles;
    if (!titles || typeof titles !== 'object') return;
    /* Bounded here as well as where it is written. This is the number that decides how
       much of somebody else's API a schedule walks, so it cannot depend on another
       context having written the file correctly. */
    const ids = Object.keys(titles)
        .filter(id => /^tt\d{7,10}$/.test(id))
        .slice(0, WATCHLIST_SNAPSHOT_LIMIT);
    if (!ids.length) return;

    const region = /^[A-Z]{2}$/.test(String(stored[WATCHLIST_REGION_KEY] || ''))
        ? stored[WATCHLIST_REGION_KEY]
        : 'US';
    const previous = stored[WATCHLIST_STATE_KEY] || {};
    /* The alarm alone does not space these out: it is re-created from onInstalled,
       onStartup and every change to the setting, each with a one-minute delay. */
    const since = Date.now() - (Number(previous.checkedAt) || 0);
    // A stamp in the future is not "checked recently", it is a broken stamp: run now.
    if (since >= 0 && since < WATCHLIST_MIN_INTERVAL) return;
    const seen = previous.seen && typeof previous.seen === 'object' ? { ...previous.seen } : {};
    /* Where to resume, by title rather than by position. The snapshot is rewritten in
       whatever order the watchlist page rendered, so an index into it points at an
       unrelated title the moment somebody re-sorts their list, and titles get starved. */
    const found = ids.indexOf(String(previous.cursor || ''));
    const hinted = Number.isInteger(previous.cursorIndex) ? previous.cursorIndex : 0;
    const resumeAt = found >= 0 ? found : Math.min(Math.max(hinted, 0), Math.max(ids.length - 1, 0));
    const slice = [];
    for (let step = 0; step < WATCHLIST_BATCH && step < ids.length; step += 1) {
        slice.push(ids[(resumeAt + step) % ids.length]);
    }

    const arrivals = [];
    /* Every service these runs walked past, kept separately from what has been reported.
       A title whose arrival is being held back for a notification must still contribute
       to the list the settings picker offers, or a failed notification empties it. */
    const observed = new Set(Array.isArray(previous.services) ? previous.services : []);
    /* Written as it goes rather than once at the end. A service worker is stopped when it
       looks idle, and nothing in this loop is an extension API call, so a slow batch can
       be killed mid-way — which used to lose the whole run's progress including the
       cursor, so the same twenty titles were checked forever and the rest never were. */
    const persist = async next => {
        await callApi(chrome.storage.local, 'set', {
            [WATCHLIST_STATE_KEY]: {
                checkedAt: Date.now(),
                cursor: next,
                // Only consulted when the title above has left the watchlist entirely.
                cursorIndex: Math.max(0, ids.indexOf(next)),
                seen,
                services: [...observed, ...Object.values(seen).flat()]
                    .filter(name => typeof name === 'string' && name)
                    .filter((name, index, all) => all.indexOf(name) === index)
                    .sort().slice(0, WATCHLIST_SERVICE_LIMIT),
            },
        }).catch(() => { /* the next run re-reads whatever did land */ });
    };

    for (let step = 0; step < slice.length; step += 1) {
        const id = slice[step];
        let providers = null;
        try { providers = await readAvailableProviders(id, region, token); }
        catch { continue; }
        /* Null means TMDB has no film for this id, which is every series on the list.
           Recorded as nothing available so it stops consuming a slot on every pass. */
        if (providers === null) providers = [];
        providers.forEach(name => observed.add(name));
        const before = Array.isArray(seen[id]) ? seen[id] : null;
        let arrived = false;
        /* The first time a title is checked there is no "before", so everything it is
           already on would read as an arrival. That is a notification about nothing
           having changed, so a first sighting only records. */
        if (before) {
            const added = providers.filter(provider => !before.includes(provider) && wanted.has(provider));
            if (added.length) {
                arrived = true;
                arrivals.push({ id, title: String(titles[id]?.title || id).slice(0, 80), before, providers });
            }
        }
        // Held back until the notification lands; everything else is recorded now.
        if (!arrived) seen[id] = providers;
        await persist(ids[(resumeAt + step + 1) % ids.length]);
    }

    // Titles that have left the watchlist are forgotten, so the record cannot grow forever.
    const live = new Set(ids);
    Object.keys(seen).forEach(id => { if (!live.has(id)) delete seen[id]; });

    /* Said first, then written down. An arrival that was shown is recorded so it is not
       announced twice; one that could not be shown keeps whatever was known before, so
       the next run sees the same change and says it again. Deleting the entry instead
       made it a first sighting, which says nothing at all. */
    const told = await notifyArrivals(arrivals);
    arrivals.forEach(arrival => {
        if (told) seen[arrival.id] = arrival.providers;
        else if (arrival.before) seen[arrival.id] = arrival.before;
    });
    await persist(ids[(resumeAt + slice.length) % ids.length]);
}

async function ensureWatchlistAlarm() {
    if (!chrome.alarms?.create) return;
    const stored = await callApi(chrome.storage.local, 'get', [WATCHLIST_SETTING_KEY]).catch(() => null);
    if (stored?.[WATCHLIST_SETTING_KEY] !== true) {
        await callApi(chrome.alarms, 'clear', WATCHLIST_ALARM).catch(() => {});
        return;
    }
    /* Re-created on every startup rather than trusted to persist: persistAcrossSessions
       defaults to true only from Chrome 150, and an alarm that quietly stopped existing
       is a feature that quietly stopped working. */
    /* Not through callApi: it forwards exactly one argument, and alarms.create takes
       the name and the schedule as two. Passing the schedule through it created an
       alarm with no period at all, which is a feature that fires once and never again. */
    try {
        await chrome.alarms.create(WATCHLIST_ALARM, {
            periodInMinutes: WATCHLIST_ALARM_MINUTES,
            delayInMinutes: 1,
        });
    } catch { /* the next startup tries again */ }
}

if (chrome.alarms?.onAlarm) {
    chrome.alarms.onAlarm.addListener(alarm => {
        if (alarm?.name !== WATCHLIST_ALARM) return;
        runWatchlistCheck().catch(error => {
            console.warn('[IMDb Enhanced] watchlist check failed:', boundedApiError(error, 'Check failed'));
        });
    });
}

chrome.runtime.onInstalled.addListener(() => { syncAdBlockingFromStorage(); checkForUpdate(); ensureWatchlistAlarm(); });
chrome.runtime.onStartup.addListener(() => { syncAdBlockingFromStorage(); checkForUpdate(); ensureWatchlistAlarm(); });
chrome.storage.onChanged.addListener((changes, areaName) => {
    // Switching the alerts on or off has to reach the schedule, not wait for a restart.
    if (areaName === 'local' && Object.prototype.hasOwnProperty.call(changes, WATCHLIST_SETTING_KEY)) {
        ensureWatchlistAlarm().catch(() => { /* the next startup re-creates it */ });
    }
    if (areaName !== 'local' || !Object.prototype.hasOwnProperty.call(changes, `${STORAGE_PREFIX}removeAds`)) return;
    updateAdBlocking(changes[`${STORAGE_PREFIX}removeAds`].newValue !== false).catch(error => {
        console.warn('[IMDb Enhanced] extension ad rule update failed:', error);
    });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isAllowedContentSender(sender)) return undefined;
    if (message?.type === 'imdb-enhanced:set-ad-blocking') {
        updateAdBlocking(message.enabled !== false)
            .then(() => sendResponse({ ok:true }))
            .catch(error => sendResponse({ ok:false, error:String(error?.message || 'Rule update failed').slice(0, 240) }));
        return true;
    }
    if (message?.type === 'imdb-enhanced:http-abort') {
        activeRequests.get(getRequestKey(message, sender))?.abort();
        return undefined;
    }
    if (message?.type === 'imdb-enhanced:http') {
        sendHttpRequest(message, sender, sendResponse);
        return true;
    }
    /* chrome.permissions is not exposed to content scripts — they get runtime, storage,
       i18n, extension, csi, dom and loadTimes and nothing else — so the settings panel
       cannot read or change host access itself. It asks here instead.

       Only `contains` and `remove` are proxied. `request` is deliberately absent: it
       needs a user gesture in an extension page, and a service worker has no gesture to
       offer, so a proxied request would fail no matter how it was called. Granting
       happens on the options page, which has both. */
    if (message?.type === 'imdb-enhanced:permissions-contains') {
        const origins = Array.isArray(message.origins) ? message.origins.filter(isKnownOptionalOrigin) : [];
        if (!origins.length) { sendResponse({ ok:true, granted:true }); return true; }
        chrome.permissions.contains({ origins }, granted => {
            void chrome.runtime.lastError;
            sendResponse({ ok:true, granted:granted === true });
        });
        return true;
    }
    if (message?.type === 'imdb-enhanced:permissions-remove') {
        const origins = Array.isArray(message.origins) ? message.origins.filter(isKnownOptionalOrigin) : [];
        if (!origins.length) { sendResponse({ ok:true, removed:false }); return true; }
        chrome.permissions.remove({ origins }, removed => {
            void chrome.runtime.lastError;
            sendResponse({ ok:true, removed:removed === true });
        });
        return true;
    }
    if (message?.type === 'imdb-enhanced:open-options') {
        /* Reports what happened rather than assuming it worked. The caller tells the user
           a page has opened, and saying so when it has not is worse than saying nothing. */
        openRecoveryPage()
            .then(() => sendResponse({ ok:true }))
            .catch(error => sendResponse({
                ok:false,
                error:boundedApiError(error, 'The options page could not be opened'),
            }));
        return true;
    }
    return undefined;
});
