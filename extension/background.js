'use strict';

const STORAGE_PREFIX = 'imdb_enh_';
const MAX_RESPONSE_TEXT = 8 * 1024 * 1024;
const REQUEST_TIMEOUT = 30_000;
const ALLOWED_CONTENT_HOSTS = new Set(['www.imdb.com', 'www.cineby.at']);
const ALLOWED_REQUEST_HOSTS = new Set([
    'www.rottentomatoes.com',
    'backend.metacritic.com',
    'www.metacritic.com',
    'letterboxd.com',
    'www.justwatch.com',
    'www.youtube.com',
    'query.wikidata.org',
    'localhost',
    '127.0.0.1',
]);
const activeRequests = new Map();
let adRuleUpdate = Promise.resolve();

const AD_RULES = [
    '||amazon-adsystem.com/',
    '||advertising.amazon.dev/',
    '||images-na.ssl-images-amazon.com/images/S/sash/',
    '||sb.scorecardresearch.com/',
    '||fls-na.amazon.com/',
    '||unagi.amazon.com/',
    '||unagi-na.amazon.com/',
].map((urlFilter, index) => ({
    id: 1001 + index,
    priority: 1,
    action: { type:'block' },
    condition: {
        urlFilter,
        initiatorDomains: ['imdb.com'],
        resourceTypes: ['script', 'image', 'stylesheet', 'sub_frame', 'xmlhttprequest', 'media', 'font', 'object', 'other', 'ping'],
    },
}));
const AD_RULE_IDS = AD_RULES.map(rule => rule.id);

function isAllowedContentSender(sender) {
    try {
        const url = new URL(sender?.url || '');
        return url.protocol === 'https:' && ALLOWED_CONTENT_HOSTS.has(url.hostname.toLowerCase());
    } catch {
        return false;
    }
}

function isHttpUrl(value) {
    try {
        const url = new URL(String(value || ''));
        return String(value || '').length <= 8192
            && /^https?:$/.test(url.protocol)
            && ALLOWED_REQUEST_HOSTS.has(url.hostname.toLowerCase())
            && !url.username && !url.password;
    } catch {
        return false;
    }
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
    adRuleUpdate = adRuleUpdate.catch(() => {}).then(() => chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: AD_RULE_IDS,
            addRules: enabled ? AD_RULES : [],
        }));
    await adRuleUpdate;
}

async function syncAdBlockingFromStorage() {
    try {
        const stored = await chrome.storage.local.get(`${STORAGE_PREFIX}removeAds`);
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
    if (!requestId || !isHttpUrl(url)) {
        sendResponse({ ok:false, status:0, error:'Invalid HTTP(S) request' });
        return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(
        Math.max(Number(message.timeout) || 10_000, 1_000),
        REQUEST_TIMEOUT,
    ));
    activeRequests.set(requestKey, controller);

    const method = String(message.method || 'GET').toUpperCase().slice(0, 16);
    const body = message.body === undefined || message.body === null
        ? undefined
        : String(message.body).slice(0, MAX_RESPONSE_TEXT);

    fetch(url, {
        method,
        headers: normalizeHeaders(message.headers),
        body,
        credentials: 'omit',
        redirect: 'follow',
        signal: controller.signal,
    }).then(async response => {
        const text = await response.text();
        if (text.length > MAX_RESPONSE_TEXT) throw new Error('Response was too large');
        sendResponse({
            ok: response.status < 400,
            status: response.status,
            responseText: text,
            responseURL: response.url,
        });
    }).catch(error => {
        sendResponse({
            ok:false,
            status: Number(error?.status) || 0,
            error: String(error?.message || 'Request failed').slice(0, 240),
        });
    }).finally(() => {
        clearTimeout(timeout);
        activeRequests.delete(requestKey);
    });
}

chrome.runtime.onInstalled.addListener(() => { syncAdBlockingFromStorage(); });
chrome.runtime.onStartup.addListener(() => { syncAdBlockingFromStorage(); });
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
