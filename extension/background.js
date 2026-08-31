'use strict';

const STORAGE_PREFIX = 'imdb_enh_';
const MAX_RESPONSE_TEXT = 8 * 1024 * 1024;
const REQUEST_TIMEOUT = 30_000;
const ALLOWED_CONTENT_HOSTS = new Set(['www.imdb.com']);
const ALLOWED_REQUEST_HOSTS = new Set([
    'www.rottentomatoes.com',
    'backend.metacritic.com',
    'letterboxd.com',
    'www.justwatch.com',
    'www.youtube.com',
    'query.wikidata.org',
    'localhost',
    '127.0.0.1',
]);
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);
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
const REDIRECT_ERROR_PATTERN = /redirect/i;

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
        if (!ALLOWED_REQUEST_HOSTS.has(hostname)) return null;
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
            const maybe = namespace[method](arg, done);
            if (maybe && typeof maybe.then === 'function') maybe.then(resolve, reject);
        } catch (error) { reject(error); }
    });
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

function sendHttpRequest(message, sender, sendResponse) {
    const requestId = String(message.id || '');
    const requestKey = getRequestKey(message, sender);
    const url = String(message.url || '');
    const target = describeRequestUrl(url);
    if (!requestId || !target) {
        sendResponse({ ok:false, status:0, errorType:'invalid_url', error:'Invalid HTTP(S) request' });
        return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(
        Math.max(Number(message.timeout) || 10_000, 1_000),
        REQUEST_TIMEOUT,
    ));
    activeRequests.set(requestKey, controller);

    const method = String(message.method || 'GET').toUpperCase().slice(0, 16);
    const headers = normalizeHeaders(message.headers);
    const body = message.body === undefined || message.body === null
        ? undefined
        : String(message.body).slice(0, MAX_RESPONSE_TEXT);

    /* A credential-bearing request is not permitted to redirect at all. There is no
       point in the flow where a followed redirect's headers can be rewritten, so the
       only way to guarantee the token never reaches a second origin is to refuse the
       hop outright — and a local Radarr, Sonarr, Plex, Jellyfin or Emby endpoint has
       no legitimate reason to redirect a caller elsewhere. */
    const carriesCredentials = hasSensitiveHeader(headers);

    fetch(url, {
        method,
        headers,
        body,
        credentials: 'omit',
        redirect: carriesCredentials ? 'error' : 'follow',
        signal: controller.signal,
    }).then(async response => {
        /* The initial URL was allowlisted; the URL the response actually came from is
           the one that matters. Validate it before the body is read, so a redirected
           response is discarded rather than parsed. */
        const finalUrl = String(response.url || url);
        const landed = describeRequestUrl(finalUrl);
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
        let errorType = 'network';
        if (aborted) errorType = 'aborted';
        // redirect:'error' and an over-long chain both surface as network failures
        // naming the redirect; report them as the redirect refusals they are.
        else if (REDIRECT_ERROR_PATTERN.test(message)) errorType = 'redirect_blocked';
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

chrome.runtime.onInstalled.addListener(() => { syncAdBlockingFromStorage(); checkForUpdate(); });
chrome.runtime.onStartup.addListener(() => { syncAdBlockingFromStorage(); checkForUpdate(); });
chrome.storage.onChanged.addListener((changes, areaName) => {
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
    return undefined;
});
