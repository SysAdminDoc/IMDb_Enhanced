// ==UserScript==
// @name         IMDb Enhanced
// @namespace    https://github.com/SysAdminDoc
// @version      2.5.0
// @updateURL    https://raw.githubusercontent.com/SysAdminDoc/IMDb_Enhanced/main/IMDb_Enhanced.user.js
// @downloadURL  https://raw.githubusercontent.com/SysAdminDoc/IMDb_Enhanced/main/IMDb_Enhanced.user.js
// @description  Premium IMDb overhaul: cleaner pages, modern themes, refined score widgets, media library indicators, quick navigation, richer external links, TV tools, search shortcuts, and polished settings import/export
// @author       SysAdminDoc
// @match        https://www.imdb.com/title/*
// @match        https://www.imdb.com/name/*
// @match        https://www.imdb.com/*/title/*
// @match        https://www.imdb.com/*/name/*
// @match        https://www.imdb.com/user/*/watchlist*
// @match        https://www.imdb.com/list/*
// @match        https://www.imdb.com/chart/*
// @match        https://m.imdb.com/title/*
// @match        https://m.imdb.com/name/*
// @match        https://www.cineby.at/search
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @grant        GM_listValues
// @grant        GM_deleteValue
// @connect      www.rottentomatoes.com
// @connect      backend.metacritic.com
// @connect      letterboxd.com
// @connect      www.justwatch.com
// @connect      www.opensubtitles.org
// @connect      www.youtube.com
// @connect      localhost
// @connect      127.0.0.1
// @run-at       document-start
// @noframes
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    // =========================================================================
    //  CONSTANTS & CONFIG
    // =========================================================================
    const VERSION = '2.5.0';
    const PREFIX  = 'imdb_enh_';
    const CINEBY_QUERY_KEY = PREFIX + 'cineby_query';
    const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
    const CACHE_UNAVAILABLE_TTL = 24 * 60 * 60 * 1000; // 24 hours
    const CACHE_MAX_ENTRIES = 120;
    const TITLE_STACK_ORDER = {
        quickCopyID: 10,
        searchButtons: 20,
        externalLinks: 30,
        trailerPopover: 32,
        servarrIntegration: 35,
        mediaServerIntegration: 36,
        tvShowEnhancements: 40,
    };
    const CINEBY_HOSTS = [
        { label:'Cineby', url:'https://www.cineby.at/search' },
    ];
    const DEFAULT_WATCH_SITES = [
        { name:'Cineby', color:'#6366f1', url:CINEBY_HOSTS[0].url, storeQuery:true },
        { name:'StreamXTV', color:'#10b981', url:'https://www.streamxtv.tech/search?q={{TITLE}}' },
        { name:'LookMovie', color:'#f59e0b', url:'https://www.lookmovie2.to/movies/search/?q={{TITLE}}' },
        { name:'CineVids', color:'#8b5cf6', url:'https://cinevids.site/?s={{TITLE}}' },
        { name:'CinemaOS', color:'#ef4444', url:'https://cinemaos.live/search?q={{TITLE}}' },
        { name:'LivNet', color:'#ec4899', url:'https://livnet.pages.dev/search?q={{TITLE}}' },
        { name:'Flixer', color:'#06b6d4', url:'https://flixer.su/search?q={{TITLE}}' },
        { name:'Cine.su', color:'#14b8a6', url:'https://cine.su/en/search' },
        { name:'Fmovies+', color:'#f97316', url:'https://fmovies.gd/search/{{TITLE_DASH}}' },
    ];
    const DEFAULT_EXTERNAL_SITES = [
        { name:'Rotten Tomatoes', color:'#fa320a', url:'https://www.rottentomatoes.com/search?search={{TITLE}}' },
        { name:'Letterboxd', color:'#00d735', url:'https://letterboxd.com/imdb/{{IMDB_ID}}/' },
        { name:'TMDB', color:'#01b4e4', url:'https://www.themoviedb.org/search/movie?query={{TITLE}}' },
        { name:'YouTube', color:'#ff0000', url:'https://www.youtube.com/results?search_query={{TITLE}}%20trailer' },
        { name:'Wikipedia', color:'#636466', url:'https://en.wikipedia.org/w/index.php?search={{TITLE}}+film' },
        { name:'JustWatch', color:'#fbc500', url:'https://www.justwatch.com/us/search?q={{TITLE}}' },
        { name:'Trakt', color:'#ed1c24', url:'https://trakt.tv/search/imdb/{{IMDB_ID}}?id_type={{TRAKT_TYPE}}' },
    ];

    const DEFAULTS = {
        // Cleanup
        removeAds: true, removeProUpsell: true, removeNewsSection: true,
        removeRelatedInterests: true, removeContribution: true,
        removeSponsoredRecs: true, removeAppBanner: true,
        // Appearance
        modernUI: true, compactHeader: true, enhancedRatingDisplay: true,
        widerLayout: true, ratingColorCoding: true,
        // Theme
        themeVariant: 'dark', // dark | oled | midnight | light | highContrast
        themeAuto: false,
        // Sections
        collapsibleSections: true, spoilerBlur: true, quickNav: true,
        // Scores
        inlineRTScore: true, inlineLetterboxdScore: true, inlineMetacriticScore: true,
        ratingHistogram: true, streamAvailability: true,
        // Links
        searchButtons: true, externalLinks: true, expandedLinkMenu: true,
        trailerPopover: true,
        watchSites: DEFAULT_WATCH_SITES, externalSites: DEFAULT_EXTERNAL_SITES,
        cinebyHost: CINEBY_HOSTS[0].url,
        watchedMarking: true, userMarks: {},
        servarrIntegration: false,
        radarrUrl: 'http://localhost:7878', radarrApiKey: '',
        radarrRootFolderPath: '', radarrQualityProfileId: '1',
        sonarrUrl: 'http://localhost:8989', sonarrApiKey: '',
        sonarrRootFolderPath: '', sonarrQualityProfileId: '1', sonarrLanguageProfileId: '1',
        mediaServerIntegration: false,
        plexUrl: 'http://localhost:32400', plexToken: '',
        jellyfinUrl: 'http://localhost:8096', jellyfinApiKey: '',
        embyUrl: 'http://localhost:8096', embyApiKey: '',
        // TV
        tvEpisodeTools: true, tvShowEnhancements: true, subtitleLinks: true,
        // Utility
        quickCopyID: true, watchlistBatch: true, listMultiSearch: true,
        keyboardShortcuts: false,
    };

    const FEATURE_DETAILS = {
        removeAds: 'Removes ad slots, tracking pixels, sponsored media, and injected ad wrappers.',
        removeProUpsell: 'Hides IMDbPro prompts and add-to-list upsells from title and name pages.',
        removeNewsSection: 'Keeps the page focused by removing IMDb news modules.',
        removeRelatedInterests: 'Hides broad interest recommendations that dilute title and cast pages.',
        removeContribution: 'Removes contribution calls to action from detail pages.',
        removeSponsoredRecs: 'Suppresses sponsored recommendation blocks where IMDb inserts them.',
        removeAppBanner: 'Hides app-install prompts and mobile app banners.',
        modernUI: 'Applies the cohesive dark surface, typography, focus, and component treatment.',
        compactHeader: 'Slims the IMDb header while keeping it readable and stable.',
        enhancedRatingDisplay: 'Elevates IMDb rating and popularity blocks with clearer emphasis.',
        widerLayout: 'Uses more horizontal room on desktop while preserving mobile readability.',
        ratingColorCoding: 'Adds a small quality label beside the IMDb score.',
        collapsibleSections: 'Adds per-section collapse controls and remembers each state.',
        spoilerBlur: 'Softens long plot text until you intentionally reveal it.',
        quickNav: 'Adds a right-side section navigator on wide screens.',
        ratingHistogram: 'Shows a compact 1-10 vote distribution bar chart beside the IMDb rating.',
        inlineRTScore: 'Shows Rotten Tomatoes score feedback inline when available.',
        inlineLetterboxdScore: 'Shows Letterboxd average ratings inline for films when available.',
        inlineMetacriticScore: 'Shows Metacritic score feedback inline when available.',
        streamAvailability: 'Shows one-glance JustWatch streaming providers when available.',
        searchButtons: 'Adds prominent, keyboard-friendly watch-site links near the title.',
        externalLinks: 'Adds trusted research and trailer links near the title.',
        expandedLinkMenu: 'Groups additional movie, review, subtitle, and TV lookup links.',
        trailerPopover: 'Adds an in-page trailer modal backed by a click-to-fetch YouTube lookup.',
        watchedMarking: 'Adds local Watched and Skip marks to title posters and recommendation cards.',
        servarrIntegration: 'Adds optional local Radarr/Sonarr quick-add buttons with library status indicator when API settings are configured.',
        mediaServerIntegration: 'Checks configured local Plex, Jellyfin, and Emby servers and shows whether the title is already in your library.',
        tvEpisodeTools: 'Blurs episode synopses and surfaces the highest-rated episodes where episode data is present.',
        tvShowEnhancements: 'Adds TV-specific lookup shortcuts on series pages.',
        subtitleLinks: 'Adds subtitle lookup links in the details section.',
        quickCopyID: 'Adds a visible IMDb ID copy button beside the title.',
        watchlistBatch: 'Adds a watchlist-page button that copies all visible IMDb title IDs.',
        listMultiSearch: 'Adds a search-all button on watchlist, list, and chart pages to open each title on a selected watch site.',
        keyboardShortcuts: 'Optional. Enables ? for settings, c to copy, r for rating, and t for top.',
    };

    // =========================================================================
    //  STORAGE HELPERS
    // =========================================================================
    const get = (k) => GM_getValue(PREFIX + k, DEFAULTS[k]);
    const set = (k, v) => GM_setValue(PREFIX + k, v);

    function cacheGet(key) {
        try {
            const storageKey = 'cache_' + key;
            const raw = GM_getValue(storageKey, null);
            if (!raw) return null;
            const { data, ts, ttl } = JSON.parse(raw);
            if (!ts || Date.now() - ts > (ttl || CACHE_TTL)) {
                if (typeof GM_deleteValue === 'function') GM_deleteValue(storageKey);
                return null;
            }
            return data;
        } catch { return null; }
    }
    function cacheSet(key, data, ttl = CACHE_TTL) {
        GM_setValue('cache_' + key, JSON.stringify({ data, ts: Date.now(), ttl }));
    }
    function cacheSetUnavailable(key) {
        cacheSet(key, { unavailable: true }, CACHE_UNAVAILABLE_TTL);
    }
    function cacheGC() {
        if (cacheGC._ran) return;
        cacheGC._ran = true;
        try {
            const now = Date.now();
            const live = [];
            GM_listValues().forEach(storageKey => {
                if (!storageKey.startsWith('cache_')) return;
                try {
                    const raw = GM_getValue(storageKey, null);
                    const entry = raw ? JSON.parse(raw) : null;
                    const ts = Number(entry?.ts) || 0;
                    const ttl = Number(entry?.ttl) || CACHE_TTL;
                    if (!entry || !ts || now - ts > ttl) {
                        if (typeof GM_deleteValue === 'function') GM_deleteValue(storageKey);
                        return;
                    }
                    live.push({ storageKey, ts });
                } catch {
                    if (typeof GM_deleteValue === 'function') GM_deleteValue(storageKey);
                }
            });
            if (live.length <= CACHE_MAX_ENTRIES) return;
            live.sort((a, b) => a.ts - b.ts)
                .slice(0, live.length - CACHE_MAX_ENTRIES)
                .forEach(entry => GM_deleteValue(entry.storageKey));
        } catch (e) {
            console.warn('[IMDb Enhanced] cache GC failed:', e);
        }
    }
    function normalizeUserMark(record) {
        if (record === 'watched' || record === 'skip') return { state: record, title: '', ts: 0 };
        if (!record || typeof record !== 'object') return null;
        const state = record.state === 'watched' || record.state === 'skip' ? record.state : '';
        if (!state) return null;
        return {
            state,
            title: String(record.title || '').trim().slice(0, 160),
            ts: Number(record.ts) || 0,
        };
    }
    function getUserMarks() {
        const raw = get('userMarks');
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
        const marks = {};
        Object.entries(raw).forEach(([id, record]) => {
            if (!/^tt\d+$/.test(id)) return;
            const normalized = normalizeUserMark(record);
            if (normalized) marks[id] = normalized;
        });
        return marks;
    }
    function setUserMarks(marks) {
        set('userMarks', marks && typeof marks === 'object' && !Array.isArray(marks) ? marks : {});
    }
    function getUserMark(imdbId) {
        return getUserMarks()[imdbId]?.state || '';
    }
    function setUserMark(imdbId, state, title = '') {
        if (!/^tt\d+$/.test(imdbId || '')) return;
        const marks = getUserMarks();
        if (state === 'watched' || state === 'skip') {
            marks[imdbId] = { state, title: String(title || '').trim().slice(0, 160), ts: Date.now() };
        } else {
            delete marks[imdbId];
        }
        setUserMarks(marks);
    }
    function getUserMarkEntries() {
        return Object.entries(getUserMarks()).sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0));
    }

    // =========================================================================
    //  DOM UTILITIES
    // =========================================================================
    function waitFor(sel, timeout = 8000) {
        return new Promise((resolve, reject) => {
            const el = document.querySelector(sel);
            if (el) return resolve(el);
            const root = document.body || document.documentElement;
            if (!root) return reject();
            const obs = new MutationObserver(() => {
                const el = document.querySelector(sel);
                if (el) { obs.disconnect(); resolve(el); }
            });
            obs.observe(root, { childList: true, subtree: true });
            setTimeout(() => { obs.disconnect(); reject(); }, timeout);
        });
    }

    function getTitleSurface() {
        const explicit = document.querySelector('[data-testid="hero__pageTitle"]');
        if (explicit) return explicit;
        const primary = document.querySelector('[data-testid="hero__primary-text"]');
        if (primary) return primary.closest('[data-testid="hero__pageTitle"]') || primary.closest('h1') || primary.parentElement || primary;
        const mainHeading = document.querySelector('main h1, h1');
        return mainHeading || null;
    }

    function getTitleActionAnchor() {
        const title = getTitleSurface();
        if (!title) return null;
        const heading = title.matches?.('[data-testid="hero__pageTitle"], h1')
            ? title
            : title.closest?.('[data-testid="hero__pageTitle"], h1');
        return heading?.parentElement || title.parentElement || title;
    }

    function insertAfter(anchor, node) {
        if (!anchor?.parentElement || !node) return false;
        anchor.parentElement.insertBefore(node, anchor.nextSibling);
        return true;
    }

    function getOrCreateTitleStack() {
        const existing = document.getElementById('enh-title-stack');
        if (existing) return existing;
        const anchor = getTitleActionAnchor();
        if (!anchor) return null;
        const stack = makeEl('div', { id:'enh-title-stack' });
        return insertAfter(anchor, stack) ? stack : null;
    }

    function appendTitleStackItem(node, order) {
        const stack = getOrCreateTitleStack();
        if (!stack || !node) return false;
        node.dataset.titleStackOrder = String(order);
        const next = Array.from(stack.children).find(child =>
            Number(child.dataset.titleStackOrder || Number.MAX_SAFE_INTEGER) > order
        );
        stack.insertBefore(node, next || null);
        return true;
    }

    function pruneTitleStack() {
        const stack = document.getElementById('enh-title-stack');
        if (stack && !stack.children.length) stack.remove();
    }

    function waitForTitleSurface(timeout = 20000) {
        return new Promise((resolve, reject) => {
            const found = getTitleSurface();
            if (found) return resolve(found);
            const root = document.body || document.documentElement;
            if (!root) return reject();
            const obs = new MutationObserver(() => {
                const next = getTitleSurface();
                if (next) { obs.disconnect(); resolve(next); }
            });
            obs.observe(root, { childList: true, subtree: true });
            setTimeout(() => { obs.disconnect(); reject(); }, timeout);
        });
    }

    function addCSS(css, id) {
        let s = document.getElementById(id);
        if (s) { s.textContent = css; return s; }
        s = document.createElement('style');
        s.id = id; s.textContent = css;
        (document.head || document.documentElement).appendChild(s);
        return s;
    }
    function removeCSS(id) { document.getElementById(id)?.remove(); }

    function makeEl(tag, attrs = {}, ...children) {
        const e = document.createElement(tag);
        for (const [k, v] of Object.entries(attrs)) {
            if (v === false || v === null || v === undefined) continue;
            if (k === 'style' && typeof v === 'object') {
                Object.entries(v).forEach(([prop, val]) => {
                    if (prop.startsWith('--')) e.style.setProperty(prop, val);
                    else e.style[prop] = val;
                });
            }
            else if (k === 'className') e.className = v;
            else if (k === 'innerHTML') e.innerHTML = v;
            else if (k === 'textContent') e.textContent = v;
            else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
            else if (k === 'dataset') Object.assign(e.dataset, v);
            else e.setAttribute(k, v);
        }
        for (const c of children) {
            if (typeof c === 'string') e.appendChild(document.createTextNode(c));
            else if (c) e.appendChild(c);
        }
        return e;
    }

    function normalizeColor(color, fallback = '#6366f1') {
        const value = String(color || '').trim();
        return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
    }

    function normalizeUrlTemplate(url) {
        const value = String(url || '').trim();
        return /^https?:\/\//i.test(value) ? value : '';
    }

    function getCinebyHost() {
        const saved = normalizeUrlTemplate(get('cinebyHost'));
        return CINEBY_HOSTS.some(host => host.url === saved) ? saved : CINEBY_HOSTS[0].url;
    }

    function normalizeSite(site, fallbackColor = '#6366f1') {
        const name = String(site?.name || '').trim().slice(0, 40);
        const url = normalizeUrlTemplate(site?.url);
        if (!name || !url) return null;
        return {
            name,
            url,
            color: normalizeColor(site?.color, fallbackColor),
            ...(site?.storeQuery ? { storeQuery:true } : {}),
        };
    }

    function getSiteList(key, defaults) {
        const value = get(key);
        if (Array.isArray(value)) return value.map(site => normalizeSite(site)).filter(Boolean);
        return defaults.map(site => normalizeSite(site)).filter(Boolean);
    }

    function setSiteList(key, sites) {
        const normalized = sites.map(site => normalizeSite(site)).filter(Boolean);
        set(key, normalized);
    }

    function getLinkContext(title = getTitleText(), imdbId = getIMDbID(), year = getTitleYear()) {
        const rawTitle = title || '';
        return {
            TITLE: encodeURIComponent(rawTitle),
            TITLE_RAW: rawTitle,
            TITLE_DASH: encodeURIComponent(rawTitle.replace(/\s+/g, '-')),
            TITLE_SLUG: rawTitle.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-'),
            IMDB_ID: imdbId || '',
            IMDB_NUM: (imdbId || '').replace(/^tt/, ''),
            TRAKT_TYPE: isTVType() ? 'show' : 'movie',
            YEAR: year || '',
        };
    }

    function applyLinkTemplate(template, ctx) {
        return String(template || '').replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => ctx[key] ?? '');
    }

    // =========================================================================
    //  PAGE DATA EXTRACTION
    // =========================================================================
    function getIMDbID()   { return window.location.pathname.match(/\/(tt\d+)/)?.[1] || null; }
    function getTitleText() {
        return (document.querySelector('[data-testid="hero__primary-text"]') ||
                document.querySelector('h1'))?.textContent?.trim() || '';
    }

    let _ldData = null;
    function getLDData() {
        if (_ldData) return _ldData;
        try {
            const s = document.querySelector('script[type="application/ld+json"]');
            if (s) _ldData = JSON.parse(s.textContent);
        } catch { /* ignore */ }
        return _ldData || {};
    }

    function yearFromText(text) {
        return String(text || '').match(/\b(18|19|20)\d{2}\b/)?.[0] || '';
    }

    function getTitleYear() {
        const ld = getLDData();
        const releaseEvents = Array.isArray(ld.releasedEvent) ? ld.releasedEvent : [ld.releasedEvent].filter(Boolean);
        const structuredCandidates = [
            ld.datePublished,
            ld.releaseDate,
            ld.startDate,
            ld.dateCreated,
            ...releaseEvents.flatMap(ev => [ev?.startDate, ev?.endDate]),
        ];
        for (const candidate of structuredCandidates) {
            const year = yearFromText(candidate);
            if (year) return year;
        }

        const inlines = document.querySelectorAll('[data-testid="hero-subnav-bar-left-block"] a, section[data-testid="hero-parent"] a[href*="releaseinfo"], main h1 ~ ul a');
        for (const a of inlines) { const m = a.textContent.match(/\b(19|20)\d{2}\b/); if (m) return m[0]; }
        const metaTitle = document.querySelector('meta[property="og:title"], meta[name="title"]')?.content;
        const fallbackSources = [
            metaTitle,
            document.querySelector('[data-testid="hero__pageTitle"]')?.textContent,
            document.querySelector('h1')?.parentElement?.textContent,
            document.title,
        ];
        for (const source of fallbackSources) {
            const year = yearFromText(source);
            if (year) return year;
        }
        return '';
    }

    function getMediaType() {
        const ld = getLDData();
        const types = Array.isArray(ld['@type']) ? ld['@type'] : [ld['@type']];
        if (types.includes('TVEpisode') || ld.partOfSeries || ld.partOfSeason) return 'episode';
        if (types.includes('TVSeries')) {
            const text = [ld.name, ld.description, ld.keywords].filter(Boolean).join(' ');
            return /mini[-\s]?series/i.test(text) ? 'miniseries' : 'series';
        }
        const genres = Array.isArray(ld.genre) ? ld.genre : [ld.genre].filter(Boolean);
        if (genres.some(genre => /short/i.test(String(genre)))) return 'short';
        return 'movie';
    }

    function isTVType(type = getMediaType()) {
        return type === 'series' || type === 'episode' || type === 'miniseries';
    }

    function getIMDbRating() {
        const ld = getLDData();
        return ld.aggregateRating?.ratingValue || null;
    }

    // =========================================================================
    //  TOAST
    // =========================================================================
    function showToast(msg, duration = 2500) {
        document.getElementById('enh-toast')?.remove();
        const t = makeEl('div', { id: 'enh-toast', role: 'status', 'aria-live': 'polite' }, msg);
        document.body.appendChild(t);
        requestAnimationFrame(() => t.classList.add('visible'));
        setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 350); }, duration);
    }

    // =========================================================================
    //  ASYNC HTTP
    // =========================================================================
    function httpRequest(url, opts = {}) {
        return new Promise((resolve, reject) => {
            const hasBody = opts.body !== undefined;
            const headers = {
                ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
                ...(opts.headers || {}),
            };
            GM_xmlhttpRequest({
                ...opts,
                method: opts.method || 'GET',
                url,
                timeout: opts.timeout || 10000,
                headers,
                data: hasBody ? JSON.stringify(opts.body) : opts.data,
                onload: (r) => r.status >= 400 ? reject(r) : resolve(r),
                onerror: reject, ontimeout: reject,
            });
        });
    }
    function httpGet(url, opts = {}) {
        return httpRequest(url, { ...opts, method: 'GET' });
    }
    function parseJSONResponse(response) {
        try { return JSON.parse(response.responseText || 'null'); }
        catch { throw new Error('Response was not valid JSON'); }
    }
    function getRequestErrorMessage(error) {
        if (error?.responseText) {
            try {
                const body = JSON.parse(error.responseText);
                if (Array.isArray(body) && body[0]?.errorMessage) return body[0].errorMessage;
                if (body.message) return body.message;
                if (body.errorMessage) return body.errorMessage;
                if (body.error) return body.error;
            } catch { /* use status fallback */ }
        }
        if (error?.status) return `HTTP ${error.status}`;
        return error?.message || 'Request failed';
    }
    function normalizeServarrBaseUrl(value) {
        const raw = String(value || '').trim().replace(/\/+$/, '');
        if (!raw) return '';
        try {
            const url = new URL(raw);
            if (!/^https?:$/i.test(url.protocol)) return '';
            return url.href.replace(/\/+$/, '');
        } catch { return ''; }
    }
    function isLocalServiceUrl(baseUrl) {
        try {
            const host = new URL(baseUrl).hostname.toLowerCase();
            return host === 'localhost' || host === '127.0.0.1';
        } catch { return false; }
    }
    function isLocalServarrUrl(baseUrl) {
        return isLocalServiceUrl(baseUrl);
    }
    function getServarrConfig(kind) {
        const prefix = kind === 'sonarr' ? 'sonarr' : 'radarr';
        const baseUrl = normalizeServarrBaseUrl(get(`${prefix}Url`));
        return {
            kind: prefix,
            baseUrl,
            apiKey: String(get(`${prefix}ApiKey`) || '').trim(),
            rootFolderPath: String(get(`${prefix}RootFolderPath`) || '').trim(),
            qualityProfileId: parseInt(get(`${prefix}QualityProfileId`), 10) || 1,
            languageProfileId: parseInt(get('sonarrLanguageProfileId'), 10) || 1,
        };
    }
    function isServarrConfigured(kind) {
        const cfg = getServarrConfig(kind);
        return Boolean(cfg.baseUrl && cfg.apiKey && cfg.rootFolderPath && cfg.qualityProfileId);
    }
    function buildServarrUrl(cfg, path, query = {}) {
        const url = new URL(`${cfg.baseUrl}/api/v3/${path.replace(/^\/+/, '')}`);
        Object.entries(query).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
        });
        return url.href;
    }
    async function servarrRequest(kind, path, opts = {}) {
        const cfg = getServarrConfig(kind);
        if (!isLocalServarrUrl(cfg.baseUrl)) {
            throw new Error('Only localhost and 127.0.0.1 Servarr URLs are allowed by this userscript build.');
        }
        return httpRequest(buildServarrUrl(cfg, path, opts.query), {
            method: opts.method || 'GET',
            body: opts.body,
            timeout: opts.timeout || 15000,
            headers: {
                Accept: 'application/json',
                'X-Api-Key': cfg.apiKey,
                ...(opts.headers || {}),
            },
        });
    }
    function buildLocalServiceUrl(baseUrl, path, query = {}) {
        const url = new URL(String(path || '').replace(/^\/+/, ''), `${baseUrl.replace(/\/+$/, '')}/`);
        Object.entries(query).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
        });
        return url.href;
    }
    function getMediaServerConfig(kind) {
        const defs = {
            plex: { label:'Plex', urlKey:'plexUrl', tokenKey:'plexToken' },
            jellyfin: { label:'Jellyfin', urlKey:'jellyfinUrl', tokenKey:'jellyfinApiKey' },
            emby: { label:'Emby', urlKey:'embyUrl', tokenKey:'embyApiKey' },
        };
        const def = defs[kind];
        if (!def) return null;
        return {
            kind,
            label: def.label,
            baseUrl: normalizeServarrBaseUrl(get(def.urlKey)),
            token: String(get(def.tokenKey) || '').trim(),
        };
    }
    function getConfiguredMediaServers() {
        return ['plex', 'jellyfin', 'emby']
            .map(getMediaServerConfig)
            .filter(cfg => cfg?.baseUrl && cfg.token);
    }
    function normalizeIMDbProviderId(value) {
        return String(value || '').match(/tt\d+/i)?.[0]?.toLowerCase() || '';
    }
    function normalizeLookupTitle(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/&/g, ' and ')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }
    function collectProviderIds(item = {}) {
        const ids = [item.guid, item.Guid, item.key, item.ratingKey].filter(Boolean);
        const providerIds = item.providerIds || item.ProviderIds;
        if (Array.isArray(providerIds)) ids.push(...providerIds);
        else if (providerIds && typeof providerIds === 'object') ids.push(...Object.values(providerIds));
        return ids.map(normalizeIMDbProviderId).filter(Boolean);
    }
    function mediaItemMatches(item, ctx) {
        const imdbId = normalizeIMDbProviderId(ctx?.imdbId);
        if (imdbId && collectProviderIds(item).includes(imdbId)) return true;

        const itemTitle = normalizeLookupTitle(item?.title || item?.Name || item?.name || item?.OriginalTitle);
        const wantedTitle = normalizeLookupTitle(ctx?.title);
        if (!itemTitle || itemTitle !== wantedTitle) return false;

        const itemYear = Number(item?.year || item?.ProductionYear || item?.productionYear) || 0;
        const wantedYear = Number(ctx?.year) || 0;
        return !itemYear || !wantedYear || Math.abs(itemYear - wantedYear) <= 1;
    }
    function parsePlexItems(xmlText) {
        try {
            const doc = new DOMParser().parseFromString(String(xmlText || ''), 'application/xml');
            return Array.from(doc.querySelectorAll('Video,Directory')).map(node => ({
                title: node.getAttribute('title') || node.getAttribute('originalTitle') || '',
                year: Number(node.getAttribute('year')) || 0,
                providerIds: [
                    node.getAttribute('guid') || '',
                    ...Array.from(node.querySelectorAll('Guid')).map(guid => guid.getAttribute('id') || ''),
                ],
            }));
        } catch { return []; }
    }
    function parseMediaServerItems(payload) {
        try {
            const data = typeof payload === 'string' ? JSON.parse(payload || '{}') : (payload || {});
            const items = Array.isArray(data) ? data : (Array.isArray(data.Items) ? data.Items : []);
            return items.map(item => ({
                title: item.Name || item.OriginalTitle || item.SeriesName || '',
                year: Number(item.ProductionYear) || 0,
                providerIds: item.ProviderIds || {},
            }));
        } catch { return []; }
    }
    async function mediaServerRequest(cfg, path, opts = {}) {
        if (!isLocalServiceUrl(cfg.baseUrl)) {
            throw new Error('Only localhost and 127.0.0.1 media server URLs are allowed by this userscript build.');
        }
        const query = { ...(opts.query || {}) };
        const headers = cfg.kind === 'plex'
            ? { Accept:'application/xml', ...(opts.headers || {}) }
            : { Accept:'application/json', 'X-Emby-Token': cfg.token, ...(opts.headers || {}) };
        if (cfg.kind === 'plex') query['X-Plex-Token'] = cfg.token;
        return httpRequest(buildLocalServiceUrl(cfg.baseUrl, path, query), {
            method: opts.method || 'GET',
            timeout: opts.timeout || 12000,
            headers,
        });
    }

    // =========================================================================
    //  FEATURE REGISTRY
    // =========================================================================
    const features = [];
    function reg(f) { features.push(f); }

    // #########################################################################
    //
    //  CLEANUP FEATURES
    //
    // #########################################################################

    reg({
        key: 'removeAds', name: 'Hide ads and tracking', group: 'Cleanup',
        css: `.nas-slot,.slot_wrapper,[id*="gpt-ad"],[id*="inline20"],[id*="inline50"],
            [id="sis_pixel_r2"],[id="cookie_sync_pixel"],.inline20-page-background,
            [class*="AdSlot"],[class*="adslot"],iframe[src*="amazon-adsystem"],
            .ipc-wrap-background,#ipc-wrap-background-id,.sponsored_label,.sponsored-content,
            [data-testid="inline-video-playback-container"]
            {display:none!important;height:0!important;overflow:hidden!important}`,
        init() { addCSS(this.css, 'enh-removeAds'); },
        destroy() { removeCSS('enh-removeAds'); }
    });

    reg({
        key: 'removeProUpsell', name: 'Hide IMDbPro upsells', group: 'Cleanup',
        css: `[data-testid="hero-subnav-bar-imdb-pro-link"],[data-testid="hero-proupsell"],
            a[href*="pro.imdb.com"],[class*="ProUpsell"],[class*="proupsell"],
            [data-testid="tm-box-addtolist-button"]{display:none!important}`,
        init() { addCSS(this.css, 'enh-proUpsell'); },
        destroy() { removeCSS('enh-proUpsell'); }
    });

    reg({ key: 'removeNewsSection', name: 'Hide news modules', group: 'Cleanup',
        css: `section[data-testid="News"]{display:none!important}`,
        init() { addCSS(this.css, 'enh-news'); }, destroy() { removeCSS('enh-news'); } });

    reg({ key: 'removeRelatedInterests', name: 'Hide related interests', group: 'Cleanup',
        css: `section[data-testid="RelatedInterests"]{display:none!important}`,
        init() { addCSS(this.css, 'enh-relInt'); }, destroy() { removeCSS('enh-relInt'); } });

    reg({ key: 'removeContribution', name: 'Hide contribution prompts', group: 'Cleanup',
        css: `section[data-testid="contribution"]{display:none!important}`,
        init() { addCSS(this.css, 'enh-contrib'); }, destroy() { removeCSS('enh-contrib'); } });

    reg({ key: 'removeSponsoredRecs', name: 'Hide sponsored recommendations', group: 'Cleanup',
        css: `[cel_widget_id*="Sponsored"],[class*="Sponsored"]{display:none!important}`,
        init() { addCSS(this.css, 'enh-sponsRecs'); }, destroy() { removeCSS('enh-sponsRecs'); } });

    reg({ key: 'removeAppBanner', name: 'Hide app banners', group: 'Cleanup',
        css: `.footer__app,.imdb-footer__open-in-app-button,[class*="AppBanner"],#announcement-text{display:none!important}`,
        init() { addCSS(this.css, 'enh-appBanner'); }, destroy() { removeCSS('enh-appBanner'); } });

    // #########################################################################
    //
    //  THEME SYSTEM
    //
    // #########################################################################

    // ===================== DESIGN SYSTEM =====================
    // 4px grid, 3-tier elevation, semantic color roles, consistent radius scale
    const THEMES = {
        dark: {
            scheme: 'dark',
            // Surfaces (elevation layers)
            bg:     '#101014',  // base canvas
            sf0:    '#18181c',  // card level 0
            sf1:    '#1e1e24',  // card level 1 (hover, nested)
            sf2:    '#26262e',  // card level 2 (active, popovers)
            // Borders
            bd0:    'rgba(255,255,255,0.05)',  // subtle dividers
            bd1:    'rgba(255,255,255,0.08)',  // card borders
            bd2:    'rgba(255,255,255,0.12)',  // hover borders
            // Shadows
            sh1:    '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
            sh2:    '0 4px 16px rgba(0,0,0,0.35), 0 1px 4px rgba(0,0,0,0.25)',
            sh3:    '0 12px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
            // Text hierarchy
            tx0:    '#f0f0f2',  // primary headings
            tx1:    '#c8c8d0',  // body text
            tx2:    '#8888a0',  // secondary / muted
            tx3:    '#55556a',  // disabled / tertiary
            // Accent palette
            accent: '#f5c518',  // IMDb gold
            accentMuted: 'rgba(245,197,24,0.12)',
            accentBorder: 'rgba(245,197,24,0.20)',
            blue:   '#4da8f0',  // links, info
            blueHi: '#7dc4ff',  // link hover
            blueMuted: 'rgba(77,168,240,0.10)',
            red:    '#e84057',  // ratings, alerts
            redMuted: 'rgba(232,64,87,0.10)',
            green:  '#3dd68c',  // positive
            // Header / chrome
            hdr:    'rgba(16,16,20,0.82)',
            hdrBorder: 'rgba(255,255,255,0.04)',
            // Scrollbar
            sT:     '#2a2a34', sH: '#3e3e4a',
            // Quote accent
            quoteBar: '#4da8f0',
        },
        oled: {
            scheme: 'dark',
            bg:     '#000000',
            sf0:    '#0c0c0e',
            sf1:    '#141418',
            sf2:    '#1c1c22',
            bd0:    'rgba(255,255,255,0.04)',
            bd1:    'rgba(255,255,255,0.06)',
            bd2:    'rgba(255,255,255,0.10)',
            sh1:    '0 1px 3px rgba(0,0,0,0.6), 0 1px 2px rgba(0,0,0,0.4)',
            sh2:    '0 4px 16px rgba(0,0,0,0.6), 0 1px 4px rgba(0,0,0,0.4)',
            sh3:    '0 12px 40px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.5)',
            tx0:    '#e4e4e8',
            tx1:    '#b0b0bc',
            tx2:    '#6e6e80',
            tx3:    '#444458',
            accent: '#f5c518',
            accentMuted: 'rgba(245,197,24,0.10)',
            accentBorder: 'rgba(245,197,24,0.18)',
            blue:   '#3d98e0',
            blueHi: '#6cb8ff',
            blueMuted: 'rgba(61,152,224,0.08)',
            red:    '#d63850',
            redMuted: 'rgba(214,56,80,0.08)',
            green:  '#30c47c',
            hdr:    'rgba(0,0,0,0.92)',
            hdrBorder: 'rgba(255,255,255,0.03)',
            sT:     '#1a1a22', sH: '#2a2a34',
            quoteBar: '#3d98e0',
        },
        midnight: {
            scheme: 'dark',
            bg:     '#0a0e1c',
            sf0:    '#10152a',
            sf1:    '#161c34',
            sf2:    '#1e2644',
            bd0:    'rgba(120,160,255,0.05)',
            bd1:    'rgba(120,160,255,0.08)',
            bd2:    'rgba(120,160,255,0.14)',
            sh1:    '0 1px 3px rgba(0,0,20,0.4), 0 1px 2px rgba(0,0,20,0.3)',
            sh2:    '0 4px 16px rgba(0,0,20,0.45), 0 1px 4px rgba(0,0,20,0.3)',
            sh3:    '0 12px 40px rgba(0,0,20,0.6), 0 2px 8px rgba(0,0,20,0.35)',
            tx0:    '#e4e8f4',
            tx1:    '#b4bcda',
            tx2:    '#6c78a8',
            tx3:    '#445080',
            accent: '#f5c518',
            accentMuted: 'rgba(245,197,24,0.10)',
            accentBorder: 'rgba(245,197,24,0.20)',
            blue:   '#5eaaff',
            blueHi: '#8ec8ff',
            blueMuted: 'rgba(94,170,255,0.10)',
            red:    '#f06070',
            redMuted: 'rgba(240,96,112,0.10)',
            green:  '#48e098',
            hdr:    'rgba(10,14,28,0.88)',
            hdrBorder: 'rgba(120,160,255,0.05)',
            sT:     '#1c2444', sH: '#283460',
            quoteBar: '#5eaaff',
        },
        light: {
            scheme: 'light',
            bg:     '#f6f7f9',
            sf0:    '#ffffff',
            sf1:    '#eef1f5',
            sf2:    '#e2e7ef',
            bd0:    'rgba(15,23,42,0.08)',
            bd1:    'rgba(15,23,42,0.12)',
            bd2:    'rgba(15,23,42,0.18)',
            sh1:    '0 1px 3px rgba(15,23,42,0.10), 0 1px 2px rgba(15,23,42,0.06)',
            sh2:    '0 8px 22px rgba(15,23,42,0.12), 0 2px 8px rgba(15,23,42,0.08)',
            sh3:    '0 16px 46px rgba(15,23,42,0.16), 0 4px 14px rgba(15,23,42,0.10)',
            tx0:    '#101827',
            tx1:    '#334155',
            tx2:    '#64748b',
            tx3:    '#94a3b8',
            accent: '#a76500',
            accentMuted: 'rgba(167,101,0,0.12)',
            accentBorder: 'rgba(167,101,0,0.28)',
            blue:   '#0f6fbf',
            blueHi: '#07599c',
            blueMuted: 'rgba(15,111,191,0.10)',
            red:    '#b91c1c',
            redMuted: 'rgba(185,28,28,0.10)',
            green:  '#047857',
            hdr:    'rgba(255,255,255,0.92)',
            hdrBorder: 'rgba(15,23,42,0.10)',
            sT:     '#c7ced8', sH: '#98a2b3',
            quoteBar: '#0f6fbf',
        },
        highContrast: {
            scheme: 'dark',
            bg:     '#000000',
            sf0:    '#050505',
            sf1:    '#111111',
            sf2:    '#1f1f1f',
            bd0:    '#ffffff',
            bd1:    '#ffffff',
            bd2:    '#ffd400',
            sh1:    'none',
            sh2:    '0 0 0 2px #ffffff',
            sh3:    '0 0 0 3px #ffd400',
            tx0:    '#ffffff',
            tx1:    '#ffffff',
            tx2:    '#eeeeee',
            tx3:    '#cfcfcf',
            accent: '#ffd400',
            accentMuted: 'rgba(255,212,0,0.22)',
            accentBorder: '#ffd400',
            blue:   '#6bd5ff',
            blueHi: '#ffffff',
            blueMuted: 'rgba(107,213,255,0.20)',
            red:    '#ff5a66',
            redMuted: 'rgba(255,90,102,0.20)',
            green:  '#00ff87',
            hdr:    'rgba(0,0,0,0.98)',
            hdrBorder: '#ffffff',
            sT:     '#ffffff', sH: '#ffd400',
            quoteBar: '#ffd400',
        },
    };

    function getStoredThemeId() {
        const id = get('themeVariant');
        return THEMES[id] ? id : 'dark';
    }
    function prefersLightTheme() {
        return typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-color-scheme: light)').matches;
    }
    function getActiveThemeId() {
        return get('themeAuto') ? (prefersLightTheme() ? 'light' : 'dark') : getStoredThemeId();
    }
    function getTheme(id = getActiveThemeId()) {
        return THEMES[id] || THEMES.dark;
    }
    function updateThemeControls(activeId = getActiveThemeId()) {
        const selector = document.querySelector('.enh-theme-selector');
        if (selector) {
            selector.querySelectorAll('.enh-theme-swatch').forEach(swatch => {
                const isActive = swatch.dataset.theme === activeId;
                swatch.classList.toggle('active', isActive);
                swatch.setAttribute('aria-pressed', String(isActive));
            });
        }
        const autoInput = document.getElementById('enh-theme-auto');
        if (autoInput) autoInput.checked = !!get('themeAuto');
    }
    function refreshThemeDependentFeatures() {
        ['compactHeader', 'enhancedRatingDisplay', 'watchedMarking', 'servarrIntegration'].forEach(refreshFeature);
    }
    function applyThemeStyles(options = {}) {
        const activeId = getActiveThemeId();
        if (get('modernUI')) addCSS(getThemeCSS(activeId), 'enh-modernUI');
        injectGlobalStyles();
        injectEarlyThemeShell();
        if (options.refreshDependent !== false) refreshThemeDependentFeatures();
        updateThemeControls(activeId);
    }
    function setupThemeAutoSync() {
        if (setupThemeAutoSync._done || typeof window.matchMedia !== 'function') return;
        setupThemeAutoSync._done = true;
        const media = window.matchMedia('(prefers-color-scheme: light)');
        const onChange = () => {
            if (get('themeAuto')) applyThemeStyles();
        };
        if (typeof media.addEventListener === 'function') media.addEventListener('change', onChange);
        else if (typeof media.addListener === 'function') media.addListener(onChange);
    }

    function getThemeCSS(id) {
        const t = getTheme(id);
        return `
/* ════════════════════════════════════════════
   BASE CANVAS & TYPOGRAPHY
   ════════════════════════════════════════════ */
body, .ipc-page-background, .ipc-page-background--base,
.ipc-page-background--baseAlt { background: ${t.bg} !important; }

html { color-scheme: ${t.scheme}; scroll-behavior: smooth; }
body {
    color: ${t.tx1} !important;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
}

/* Type scale — tighten the whole page */
[data-testid="hero__primary-text"] {
    font-weight: 700 !important; letter-spacing: -0.025em !important;
    line-height: 1.1 !important; color: ${t.tx0} !important;
}
.ipc-title__text {
    font-weight: 600 !important; letter-spacing: -0.015em !important;
    color: ${t.tx0} !important;
}
h3.ipc-title__text { color: ${t.blue} !important; }
a h3 span, a h3 .ipc-title__text { color: ${t.blue} !important; }
.ipc-title__description { color: ${t.tx2} !important; margin-top: 2px !important; }

/* Body text */
.ipc-html-content-inner-div { color: ${t.tx1} !important; }
.ipc-overflowText--children { color: ${t.tx1} !important; }

/* Metadata labels & values */
.ipc-metadata-list-item__label { color: ${t.tx2} !important; }
span.ipc-metadata-list-item__label.ipc-btn--not-interactable { color: ${t.tx2} !important; }
a.ipc-metadata-list-item__label--link { color: ${t.blue} !important; }
a.ipc-metadata-list-item__label--link:hover { color: ${t.blueHi} !important; }
.ipc-metadata-list-item__list-content-item--link,
.ipc-metadata-list-item__list-content-item a { color: ${t.blue} !important; }
.ipc-metadata-list-item__list-content-item--link:hover,
.ipc-metadata-list-item__list-content-item a:hover { color: ${t.blueHi} !important; }

/* Muted / secondary text */
[data-testid="title-cast-item"] .ipc-inline-list__item,
.ipc-metadata-list-item__content-container,
.ipc-rating-star--voteCount { color: ${t.tx3} !important; }
[data-testid="hero-rating-bar__popularity"] { color: ${t.blue} !important; }

/* Links — global */
.ipc-link, .ipc-link--base { color: ${t.blue} !important; transition: color .15s ease !important; }
.ipc-link:hover, .ipc-link--base:hover { color: ${t.blueHi} !important; }
.ipc-md-link--entity { color: ${t.blue} !important; }

/* Rating star */
span.ipc-rating-star--rating { color: ${t.accent} !important; font-weight: 700 !important; }
span.ipc-rating-star--maxRating { color: ${t.tx3} !important; }

/* ════════════════════════════════════════════
   ELEVATION SYSTEM — CARDS & SECTIONS
   ════════════════════════════════════════════ */

/* Title page main sections → elevation 0 cards */
section[data-testid="title-cast"],
section[data-testid="UserReviews"],
section[data-testid="MoreLikeThis"],
section[data-testid="Details"],
section[data-testid="BoxOffice"],
section[data-testid="TechSpecs"],
section[data-testid="DidYouKnow"],
section[data-testid="videos-section"],
section[data-testid="Photos"],
section[data-testid="Filmography"],
section[data-testid="PersonalDetails"] {
    background: ${t.sf0} !important;
    border: 1px solid ${t.bd1} !important;
    border-radius: 12px !important;
    padding: 20px 24px !important;
    margin-bottom: 12px !important;
    box-shadow: ${t.sh1} !important;
    transition: border-color .2s ease !important;
}

/* Hero section */
section[data-testid="hero-parent"] {
    background: linear-gradient(180deg, ${t.sf0} 0%, ${t.bg} 100%) !important;
    border-radius: 0 0 16px 16px !important;
    padding-bottom: 24px !important;
    border-bottom: 1px solid ${t.bd0} !important;
}

/* Transparent base sections (prevent double-backgrounds) */
section.ipc-page-section.ipc-page-section--base { background: transparent !important; }
section.ipc-page-section.ipc-page-section--none { background: transparent !important; }

/* Generic list cards → transparent or elevation 0 */
.ipc-list-card--border-line { border-color: ${t.bd0} !important; }
.ipc-list-card--border-line.ipc-list-card--tp-none.ipc-list-card--bp-none { background: transparent !important; }
.ipc-list-card--span.ipc-list-card--border-shadow { background: transparent !important; }
.ipc-inline-list--show-dividers .ipc-inline-list__item::after { border-color: ${t.bd0} !important; }

/* ════════════════════════════════════════════
   CAST CARDS — elevation 1 with hover lift
   ════════════════════════════════════════════ */
[data-testid="title-cast-item"] {
    background: ${t.sf1} !important;
    border: 1px solid ${t.bd1} !important;
    border-radius: 10px !important;
    overflow: hidden !important;
    box-shadow: ${t.sh1} !important;
    transition: transform .2s cubic-bezier(.4,0,.2,1),
                border-color .2s ease,
                box-shadow .2s ease !important;
}
[data-testid="title-cast-item"]:hover {
    transform: translateY(-3px) !important;
    border-color: ${t.accentBorder} !important;
    box-shadow: ${t.sh2} !important;
}

/* ════════════════════════════════════════════
   POSTER CARDS (More Like This, shovelers)
   ════════════════════════════════════════════ */
.ipc-poster-card {
    border-radius: 10px !important;
    overflow: hidden !important;
    transition: transform .2s cubic-bezier(.4,0,.2,1),
                box-shadow .2s ease !important;
}
.ipc-poster-card:hover {
    transform: translateY(-4px) !important;
    box-shadow: ${t.sh2} !important;
}

/* Hero poster */
[data-testid="hero-media__poster"] img {
    border-radius: 10px !important;
    box-shadow: ${t.sh2} !important;
    transition: transform .25s cubic-bezier(.4,0,.2,1),
                box-shadow .25s ease !important;
}
[data-testid="hero-media__poster"]:hover img {
    transform: scale(1.03) !important;
    box-shadow: ${t.sh3} !important;
}

/* ════════════════════════════════════════════
   SQUIRCLE SYSTEM — circles → rounded squares
   ════════════════════════════════════════════ */
.ipc-avatar, .ipc-avatar__avatar-image,
[class*="avatar"] img, [class*="Avatar"] img,
.ipc-media--circle, .ipc-media--avatar,
img[class*="avatar"], img[class*="Avatar"],
[class*="ipc-avatar"] {
    border-radius: 22% !important;
}
[style*="border-radius: 50%"], [style*="border-radius:50%"] {
    border-radius: 22% !important;
}

/* ════════════════════════════════════════════
   BUTTONS & CHIPS
   ════════════════════════════════════════════ */
.ipc-btn--core-accent1 {
    border-radius: 8px !important;
    transition: transform .15s ease, box-shadow .15s ease, background .15s ease !important;
}
.ipc-btn--core-accent1:hover {
    transform: translateY(-1px) !important;
    box-shadow: 0 4px 16px ${t.accentMuted} !important;
}
.ipc-chip, .ipc-chip--on-base, .ipc-chip--on-baseAlt {
    border-radius: 8px !important;
    border-color: ${t.bd1} !important;
    background: ${t.sf0} !important;
    transition: background .15s ease, border-color .15s ease, color .15s ease !important;
}
.ipc-chip:hover, .ipc-chip--on-base:hover {
    background: ${t.sf1} !important;
    border-color: ${t.bd2} !important;
}
.ipc-chip--filled {
    background: ${t.sf1} !important;
}

/* ════════════════════════════════════════════
   REVIEW PAGE
   ════════════════════════════════════════════ */
[data-testid="review-card-parent"] {
    background: ${t.sf0} !important;
    border: 1px solid ${t.bd1} !important;
    border-radius: 10px !important;
    padding: 16px 20px !important;
    margin: 0 0 10px 0 !important;
    box-shadow: ${t.sh1} !important;
    transition: border-color .2s ease !important;
}
[data-testid="review-card-parent"]:hover {
    border-color: ${t.bd2} !important;
}
[data-testid="review-summary"] .ipc-title__text {
    color: ${t.tx0} !important;
    font-weight: 600 !important;
}
[data-testid="author-link"], [data-testid="reviews-author"] {
    color: ${t.blue} !important;
}
[data-testid="review-overflow"] .ipc-html-content-inner-div {
    color: ${t.tx1} !important;
    line-height: 1.65 !important;
}
.ipc-list-card__content { padding: 8px 0 !important; }
/* Review rating stars inline */
.ipc-rating-star--voteCount, [data-testid="review-card-parent"] .ipc-rating-star--voteCount { color: ${t.tx2} !important; }

/* ════════════════════════════════════════════
   QUOTES PAGE — blockquote style with accent bar
   ════════════════════════════════════════════ */
[data-testid="sub-section-Quotes"] .ipc-list-card,
section[id*="quote" i] .ipc-list-card {
    background: ${t.sf0} !important;
    border: 1px solid ${t.bd1} !important;
    border-left: 3px solid ${t.quoteBar} !important;
    border-radius: 0 10px 10px 0 !important;
    padding: 12px 16px !important;
    margin: 0 0 8px 0 !important;
    box-shadow: ${t.sh1} !important;
}
[data-testid="sub-section-Quotes"] .ipc-list-card,
section[id*="quote" i] .ipc-list-card {
    padding: 4px 0 !important;
    margin: 0 !important;
}
[data-testid="sub-section-Quotes"] .ipc-html-content-inner-div,
section[id*="quote" i] .ipc-html-content-inner-div {
    color: ${t.tx1} !important;
    line-height: 1.6 !important;
    font-style: italic !important;
}

/* ════════════════════════════════════════════
   NAME / PERSON PAGE
   ════════════════════════════════════════════ */
/* Hero photo → squircle with shadow */
[data-testid="name-overview-widget"] img,
.name-overview-widget img {
    border-radius: 12px !important;
    box-shadow: ${t.sh2} !important;
}
/* Bio text */
[data-testid="bio-content"] { color: ${t.tx1} !important; }
[data-testid="bio-content"] .ipc-html-content-inner-div {
    color: ${t.tx1} !important;
    line-height: 1.65 !important;
}
/* Filmography accordion */
.ipc-accordion__item {
    border-color: ${t.bd0} !important;
    transition: background .15s ease !important;
}
.ipc-accordion__item:hover { background: ${t.sf1} !important; }
.ipc-accordion__item__header {
    padding: 10px 0 !important;
}
.ipc-accordion__item__title { color: ${t.tx0} !important; font-weight: 600 !important; }
.ipc-accordion__item__content { padding: 0 !important; }
/* Personal details */
[data-testid="PersonalDetails"] .ipc-metadata-list-item__label { color: ${t.tx2} !important; }
[data-testid="PersonalDetails"] a { color: ${t.blue} !important; }

/* ════════════════════════════════════════════
   SIDEBAR (all subpages)
   ════════════════════════════════════════════ */
[data-testid="sidebar-sticky-block"] .ipc-slate-card {
    border-radius: 10px !important;
    overflow: hidden !important;
    box-shadow: ${t.sh1} !important;
}
[data-testid="sidebar-sticky-block"] .ipc-list-card,
[data-testid="sidebar-sticky-block"] .ipc-slate-card {
    background: ${t.sf0} !important;
    border-color: ${t.bd0} !important;
    border-radius: 8px !important;
    transition: background .15s ease !important;
}
[data-testid="sidebar-sticky-block"] .ipc-list-card:hover,
[data-testid="sidebar-sticky-block"] .ipc-slate-card:hover { background: ${t.sf1} !important; }
[data-testid="sidebar-sticky-block"] .ipc-title__text { color: ${t.tx0} !important; }
[data-testid="sidebar-sticky-block"] .ipc-inline-list__item { color: ${t.tx3} !important; }

/* ════════════════════════════════════════════
   SCROLLBAR
   ════════════════════════════════════════════ */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: ${t.sT}; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: ${t.sH}; }

/* ════════════════════════════════════════════
   FOOTER & CHROME CLEANUP
   ════════════════════════════════════════════ */
footer.imdb-footer { display: none !important; }
button.FavoritePeopleCTA_favPeopleCTAOnAvatar__ZQ2LQ { display: none !important; }
[data-testid="hero-proupsell"],
[data-testid="tm-box-addtolist-button"] { display: none !important; }
div.nav__userMenu { display: none !important; }

/* ════════════════════════════════════════════
   SUBTITLE & CUSTOM ROWS
   ════════════════════════════════════════════ */
#enh-sub-row { color: ${t.blue} !important; }
#enh-sub-row a { color: ${t.blue} !important; }
#enh-sub-row a:hover { color: ${t.blueHi} !important; }

/* ════════════════════════════════════════════
   GLOBAL SPACING RHYTHM (4px grid)
   ════════════════════════════════════════════ */
.ipc-page-section { margin-top: 0 !important; margin-bottom: 0 !important; }
.ipc-page-section--tp-none { padding-top: 0 !important; }
.ipc-page-section--bp-none { padding-bottom: 0 !important; }
.ipc-title { margin-bottom: 8px !important; }
.ipc-chip-list__scroller { gap: 6px !important; }
.ipc-overflowText--children { margin: 0 !important; }

/* ════════════════════════════════════════════
   FOCUS STATES (accessibility)
   ════════════════════════════════════════════ */
a:focus-visible, button:focus-visible, .ipc-chip:focus-visible {
    outline: 2px solid ${t.accent} !important;
    outline-offset: 2px !important;
}

@media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto !important; }
    *, *::before, *::after {
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.001ms !important;
    }
}
        `;
    }

    function injectEarlyThemeShell() {
        if (!window.location.hostname.includes('imdb.com')) return;
        const t = getTheme();
        document.documentElement.dataset.imdbEnhanced = 'active';
        addCSS(`
html[data-imdb-enhanced="active"] { color-scheme: ${t.scheme}; background: ${t.bg}; }
html[data-imdb-enhanced="active"] body,
html[data-imdb-enhanced="active"] .ipc-page-background {
    background: ${t.bg} !important;
}
#imdbHeader {
    background: ${t.hdr} !important;
    border-bottom: 1px solid ${t.hdrBorder} !important;
}
        `, 'enh-early-shell');
    }

    injectEarlyThemeShell();
    setupThemeAutoSync();

    reg({
        key: 'modernUI', name: 'Modern IMDb skin', group: 'Appearance',
        init() { applyThemeStyles({ refreshDependent: false }); },
        destroy() { removeCSS('enh-modernUI'); }
    });

    reg({
        key: 'compactHeader', name: 'Compact header', group: 'Appearance',
        init() {
            const t = getTheme();
            addCSS(`
                #imdbHeader {
                    padding: 4px 0 !important;
                    background: ${t.hdr} !important;
                    border-bottom: 1px solid ${t.hdrBorder} !important;
                    transition: background .2s ease !important;
                }
                .navbar__inner { min-height: 46px !important; }
                #imdbHeader .imdb-header__logo-link svg { height: 24px !important; width: auto !important; }
            `, 'enh-compactHdr');
        },
        destroy() { removeCSS('enh-compactHdr'); }
    });

    reg({
        key: 'enhancedRatingDisplay', name: 'Refined rating display', group: 'Appearance',
        init() {
            const t = getTheme();
            addCSS(`
                [data-testid="hero-rating-bar__aggregate-rating"] {
                    background: ${t.accentMuted} !important;
                    border: 1px solid ${t.accentBorder} !important;
                    border-radius: 12px !important;
                    padding: 8px 16px !important;
                    box-shadow: 0 0 24px ${t.accentMuted} !important;
                    transition: background .2s ease, box-shadow .2s ease !important;
                }
                [data-testid="hero-rating-bar__aggregate-rating"]:hover {
                    background: rgba(245,197,24,0.16) !important;
                    box-shadow: 0 0 32px rgba(245,197,24,0.12) !important;
                }
                [data-testid="hero-rating-bar__aggregate-rating__score"] span:first-child {
                    font-size: 1.6em !important; font-weight: 800 !important;
                }
                [data-testid="hero-rating-bar__popularity"] {
                    background: ${t.blueMuted} !important;
                    border: 1px solid rgba(77,168,240,0.12) !important;
                    border-radius: 12px !important; padding: 8px 16px !important;
                }
            `, 'enh-enhRating');
        },
        destroy() { removeCSS('enh-enhRating'); }
    });

    reg({ key: 'widerLayout', name: 'Wider responsive layout', group: 'Appearance',
        css: `
/* ── Full-width containers ── */
.ipc-page-content-container--center { max-width: 100% !important; padding: 0 32px !important; }
.ipc-page-section--base.celwidget { width: 100% !important; max-width: 100% !important; }
.bRimta { width: 100% !important; max-width: 100% !important; }
.ipc-page-grid { max-width: 100% !important; width: 100% !important; padding: 0 32px !important; }
.ipc-page-content-container--full { max-width: 100% !important; width: 100% !important; }
.ipc-page-wrapper { max-width: 100% !important; }
[data-testid="atf-wrapper-bg"] { max-width: 100% !important; }

/* ── Poster card compaction ── */
div.ipc-rating-star-group.ipc-poster-card__rating-star-group {
    padding: 0 !important; margin: 0 !important;
}
a.ipc-poster-card__title.ipc-poster-card__title--clamp-2.ipc-poster-card__title--clickable {
    padding: 0 !important; margin: 0 0 -29px 0 !important;
}

/* ── Grid & shoveler spacing ── */
div.ipc-sub-grid.ipc-sub-grid--page-span-2.ipc-sub-grid--nowrap.ipc-shoveler__grid {
    padding: 0 !important; margin: 0 !important;
}

/* ── Section vertical compression ── */
section.ipc-page-section.ipc-page-section--base.celwidget {
    padding: 0 !important; margin: 0 !important;
}
div.ipc-html-content-inner-div { padding: 0 !important; margin: 0 !important; }
li.ipc-metadata-list__item.ipc-metadata-list__item--align-end.ipc-metadata-list-item--link {
    padding: 0 !important; margin: 0 !important;
}
h3.ipc-title__text.ipc-title__text--reduced { padding: 0 !important; margin: 0 !important; }
.ipc-title__wrapper { padding: 0 !important; margin: 0 !important; }

/* ── Accordion (filmography) ── */
.ipc-accordion__item__content_inner { padding: 4px 0 !important; }
.ipc-accordion__item__header { padding: 8px 0 !important; min-height: auto !important; }

/* ── Review / quote specific ── */
[data-testid="review-overflow"] { margin: 4px 0 !important; }
[data-testid="sub-section-Quotes"] .ipc-list-card,
section[id*="quote" i] .ipc-list-card { padding: 4px 0 !important; margin: 2px 0 !important; }
.ipc-chip-list__scroller { padding: 4px 0 !important; }

/* ── Sidebar compression ── */
[data-testid="sidebar-sticky-block"] { gap: 0 !important; }
.ipc-page-section--none { margin: 0 !important; padding: 4px 0 !important; }

/* ── Name page ── */
[data-testid="bio-content"] { padding: 4px 0 !important; }
[data-testid="PersonalDetails"] { padding: 4px 0 !important; }
[data-testid="Filmography"] { padding: 4px 0 !important; }

@media (max-width: 900px) {
    .ipc-page-content-container--center,
    .ipc-page-grid {
        padding-left: 16px !important;
        padding-right: 16px !important;
    }
}
        `,
        init() { addCSS(this.css, 'enh-wider'); }, destroy() { removeCSS('enh-wider'); } });

    // ===================== RATING COLOR CODING =====================
    function ratingColor(val) {
        const n = parseFloat(val);
        if (isNaN(n)) return { bg:'#555', text:'#ccc', label:'N/A' };
        if (n >= 8.0) return { bg:'#22c55e', text:'#fff', label:'Great' };
        if (n >= 7.0) return { bg:'#84cc16', text:'#000', label:'Good' };
        if (n >= 6.0) return { bg:'#eab308', text:'#000', label:'Average' };
        if (n >= 5.0) return { bg:'#f97316', text:'#000', label:'Below Avg' };
        return { bg:'#ef4444', text:'#fff', label:'Poor' };
    }
    function mcColor(s) { return s >= 75 ? '#6c3' : s >= 50 ? '#ffbd3f' : s >= 25 ? '#ff6874' : '#f00'; }
    function rtColorFn(s) { return s >= 60 ? '#fa320a' : '#6b7280'; }
    function lbColor(s) { return s >= 4 ? '#00e054' : s >= 3 ? '#40bcf4' : s >= 2 ? '#ff8000' : '#ff6874'; }
    function getRTSlugCandidates(title) {
        const normalized = String(title || '')
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/&/g, ' and ')
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, ' ')
            .trim()
            .replace(/\s+/g, ' ');
        if (!normalized) return [];
        const tokens = normalized.split(' ').filter(Boolean);
        const withoutArticle = tokens[0] === 'the' && tokens.length > 1 ? tokens.slice(1) : tokens;
        const variants = [tokens, withoutArticle];
        return [...new Set(variants.flatMap(parts => [
            parts.join('_'),
            parts.join('-'),
            parts.join(''),
        ]).filter(Boolean))];
    }
    function formatScore(n) {
        return Number(n).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    }
    function formatCount(n) {
        const count = Number(n);
        if (!Number.isFinite(count) || count <= 0) return '';
        if (count >= 1000000) return `${(count / 1000000).toFixed(count >= 10000000 ? 0 : 1)}M`;
        if (count >= 1000) return `${Math.round(count / 1000)}K`;
        return String(count);
    }
    function decodeHTML(text) {
        const ta = document.createElement('textarea');
        ta.innerHTML = String(text || '');
        return ta.value;
    }
    function getJustWatchSlug(title = getTitleText()) {
        return String(title || '')
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/&/g, ' and ')
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
    }
    function getJustWatchTypePath() {
        return isTVType() ? 'tv-show' : 'movie';
    }
    function getJustWatchSearchUrl(title = getTitleText()) {
        return `https://www.justwatch.com/us/search?q=${encodeURIComponent(title || '')}`;
    }
    function getJustWatchDetailUrl(title = getTitleText()) {
        const slug = getJustWatchSlug(title);
        return slug ? `https://www.justwatch.com/us/${getJustWatchTypePath()}/${slug}` : getJustWatchSearchUrl(title);
    }
    function getTrailerSearchUrl(title = getTitleText(), year = getTitleYear()) {
        const query = [title, year, 'official trailer'].filter(Boolean).join(' ');
        return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    }
    function compactProviders(providers, limit = 2) {
        const clean = [];
        providers.forEach(provider => {
            const name = String(provider || '').trim().replace(/\s+/g, ' ');
            if (name && !clean.some(existing => existing.toLowerCase() === name.toLowerCase())) clean.push(name);
        });
        if (clean.length <= limit + 1) return { providers: clean, extra: 0 };
        return { providers: clean.slice(0, limit), extra: clean.length - limit };
    }
    function formatProviderSummary(providers) {
        const { providers: shown, extra } = compactProviders(providers);
        const summary = shown.join(', ');
        return extra > 0 ? `${summary} +${extra}` : summary;
    }

    reg({
        key: 'ratingColorCoding', name: 'Rating quality labels', group: 'Appearance',
        init() {
            addCSS(`
                [data-testid="hero-rating-bar__aggregate-rating"].enh-rating-colorized
                [data-testid="hero-rating-bar__aggregate-rating__score"] span:first-child {
                    color: var(--enh-rating-score-color) !important;
                    text-shadow: var(--enh-rating-score-shadow) !important;
                }
                #enh-rating-badge {
                    display: inline-block;
                    font-size: 10px;
                    font-weight: 700;
                    padding: 2px 8px;
                    border-radius: 4px;
                    margin-left: 6px;
                    vertical-align: middle;
                    background: var(--enh-rating-badge-bg);
                    color: var(--enh-rating-badge-text);
                    letter-spacing: .03em;
                }
            `, 'enh-ratingColor');
            waitFor('[data-testid="hero-rating-bar__aggregate-rating__score"]').then(el => {
                const rating = getIMDbRating();
                if (!rating) return;
                const c = ratingColor(rating);
                const container = el.closest('[data-testid="hero-rating-bar__aggregate-rating"]') || el;
                container.classList.add('enh-rating-colorized');
                container.style.setProperty('--enh-rating-score-color', c.bg);
                container.style.setProperty('--enh-rating-score-shadow', `0 0 20px ${c.bg}44`);
                container.style.setProperty('--enh-rating-badge-bg', c.bg);
                container.style.setProperty('--enh-rating-badge-text', c.text);
                if (!document.getElementById('enh-rating-badge')) {
                    const badge = document.createElement('span');
                    badge.id = 'enh-rating-badge';
                    badge.textContent = c.label;
                    el.appendChild(badge);
                }
            }).catch(() => {});
        },
        destroy() {
            removeCSS('enh-ratingColor');
            document.getElementById('enh-rating-badge')?.remove();
            document.querySelectorAll('.enh-rating-colorized').forEach(el => {
                el.classList.remove('enh-rating-colorized');
                ['--enh-rating-score-color', '--enh-rating-score-shadow', '--enh-rating-badge-bg', '--enh-rating-badge-text']
                    .forEach(prop => el.style.removeProperty(prop));
            });
        }
    });

    // #########################################################################
    //
    //  INLINE SCORES (RT + Metacritic)
    //
    // #########################################################################

    function onceVisible(el, callback) {
        if (!el || typeof IntersectionObserver === 'undefined') { callback(); return; }
        const obs = new IntersectionObserver((entries, observer) => {
            if (entries.some(e => e.isIntersecting)) { observer.disconnect(); callback(); }
        }, { rootMargin: '200px' });
        obs.observe(el);
    }

    function findRatingBar() {
        const agg = document.querySelector('[data-testid="hero-rating-bar__aggregate-rating"]');
        if (!agg) return null;
        // Walk up to find the flex container holding all rating widgets
        let parent = agg.parentElement;
        for (let i = 0; i < 3 && parent; i++) {
            if (parent.children.length >= 2) return parent;
            parent = parent.parentElement;
        }
        return agg.parentElement;
    }

    function getHistogramData() {
        try {
            const scripts = document.querySelectorAll('script[type="application/json"]');
            for (const s of scripts) {
                const text = s.textContent;
                if (!text.includes('histogramData') && !text.includes('ratingsSummary')) continue;
                const json = JSON.parse(text);
                const find = (obj) => {
                    if (!obj || typeof obj !== 'object') return null;
                    if (obj.histogramData && Array.isArray(obj.histogramData)) return obj.histogramData;
                    if (obj.ratingsSummary?.histogramData) return obj.ratingsSummary.histogramData;
                    for (const v of Object.values(obj)) {
                        const r = find(v);
                        if (r) return r;
                    }
                    return null;
                };
                const data = find(json);
                if (data?.length) return data;
            }
        } catch { /* ignore */ }
        return null;
    }

    reg({
        key: 'ratingHistogram', name: 'Rating histogram', group: 'Scores',
        init() {
            if (document.getElementById('enh-histogram')) return;
            const histogram = getHistogramData();
            if (!histogram?.length) return;
            const bar = findRatingBar();
            if (!bar) return;

            const maxVotes = Math.max(...histogram.map(b => b.voteCount || b.count || 0), 1);
            const t = getTheme();
            const w = makeEl('div', { id: 'enh-histogram', className: 'enh-score-widget' });
            const label = makeEl('div', { className: 'enh-score-widget__label' }, 'VOTES');
            const chart = makeEl('div', { className: 'enh-histogram-chart' });
            const sorted = [...histogram].sort((a, b) => (a.rating || 0) - (b.rating || 0));
            sorted.forEach(bucket => {
                const rating = bucket.rating || 0;
                const votes = bucket.voteCount || bucket.count || 0;
                const pct = Math.max((votes / maxVotes) * 100, 2);
                const col = makeEl('div', { className: 'enh-histogram-col', title: `${rating}/10: ${votes.toLocaleString()} votes` },
                    makeEl('div', { className: 'enh-histogram-bar', style: { height: pct + '%' } }),
                    makeEl('div', { className: 'enh-histogram-label' }, String(rating))
                );
                chart.appendChild(col);
            });
            w.appendChild(label);
            w.appendChild(chart);
            bar.appendChild(w);
        },
        destroy() { document.getElementById('enh-histogram')?.remove(); }
    });

    reg({
        key: 'inlineRTScore', name: 'Rotten Tomatoes scores', group: 'Scores',
        async init() {
            const imdbId = getIMDbID(), title = getTitleText();
            if (!imdbId || !title) return;

            const cacheKey = 'rt_' + imdbId;
            const cached = cacheGet(cacheKey);
            if (cached) {
                if (cached.unavailable) this._renderUnavailable();
                else this._render(cached);
                return;
            }
            const bar = findRatingBar();
            await new Promise(r => onceVisible(bar, r));
            this._renderLoading();

            const type = isTVType() ? 'tv' : 'movie';
            const prefix = type === 'tv' ? '/tv/' : '/m/';
            for (const slug of getRTSlugCandidates(title)) {
                try {
                    const res = await httpGet('https://www.rottentomatoes.com' + prefix + slug);
                    const data = this._parse(res.responseText);
                    if (data) { cacheSet(cacheKey, data); this._render(data); return; }
                } catch { /* try next slug */ }
            }

            // Fallback: search page
            try {
                const res2 = await httpGet(`https://www.rottentomatoes.com/search?search=${encodeURIComponent(title)}`);
                const tm = res2.responseText.match(/"tomatoScore"\s*:\s*(\d+)/);
                const au = res2.responseText.match(/"audienceScore"\s*:\s*(\d+)/);
                if (tm) {
                    const d = { tomatometer: parseInt(tm[1]), audience: au ? parseInt(au[1]) : null, consensus: null };
                    cacheSet(cacheKey, d); this._render(d);
                    return;
                }
            } catch { /* handled below */ }
            cacheSetUnavailable(cacheKey);
            this._renderUnavailable();
        },
        _parse(html) {
            try {
                let tomatometer = null, audience = null, consensus = null;
                const ldM = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
                if (ldM) {
                    const ld = JSON.parse(ldM[1]);
                    if (ld.aggregateRating)
                        tomatometer = Math.round(ld.aggregateRating.ratingValue);
                }
                const tm = html.match(/tomatometer[^}]*?"value"\s*:\s*(\d+)/);
                const au = html.match(/audienceScore[^}]*?"value"\s*:\s*(\d+)/);
                if (tm && tomatometer === null) tomatometer = parseInt(tm[1]);
                if (au) audience = parseInt(au[1]);
                const cm = html.match(/critics-consensus[^>]*>([^<]+)</i)
                    || html.match(/"criticsConsensus"\s*:\s*"([^"]+)"/);
                if (cm) consensus = cm[1].trim();
                if (tomatometer !== null) return { tomatometer, audience, consensus };
            } catch { /* ignore */ }
            return null;
        },
        _render(data) {
            document.getElementById('enh-rt-widget')?.remove();
            const bar = findRatingBar();
            if (!bar) return;
            const hasScore = data.tomatometer !== null && data.tomatometer !== undefined;
            const hasAudience = data.audience !== null && data.audience !== undefined;
            const color = hasScore ? rtColorFn(data.tomatometer) : '#555';
            const titleAttr = data.consensus ? data.consensus : '';
            const w = makeEl('div', { id: 'enh-rt-widget', className: 'enh-score-widget' });
            w.innerHTML = `
                <div class="enh-score-widget__label">TOMATOMETER</div>
                <a href="https://www.rottentomatoes.com/search?search=${encodeURIComponent(getTitleText())}"
                   target="_blank" rel="noopener" class="enh-score-widget__score" style="--score-color:${color}"
                   ${titleAttr ? `title="${titleAttr.replace(/"/g, '&quot;')}"` : ''}>
                    <span class="enh-score-widget__badge enh-score-widget__badge--outline">RT</span>
                    <span class="enh-score-widget__value">${hasScore ? data.tomatometer + '%' : '--'}</span>
                </a>
                ${hasAudience ? `<div class="enh-score-widget__sub">Audience: ${data.audience}%</div>` : ''}
            `;
            bar.appendChild(w);
        },
        _renderLoading() {
            if (document.getElementById('enh-rt-widget')) return;
            const bar = findRatingBar();
            if (!bar) return;
            const w = makeEl('div', { id: 'enh-rt-widget', className: 'enh-score-widget enh-score-widget--loading' });
            w.innerHTML = `
                <div class="enh-score-widget__label">TOMATOMETER</div>
                <div class="enh-score-widget__skeleton" aria-label="Loading Rotten Tomatoes score"></div>
            `;
            bar.appendChild(w);
        },
        _renderUnavailable() {
            document.getElementById('enh-rt-widget')?.remove();
            const bar = findRatingBar();
            if (!bar) return;
            const w = makeEl('div', { id: 'enh-rt-widget', className: 'enh-score-widget enh-score-widget--muted' });
            w.innerHTML = `
                <div class="enh-score-widget__label">TOMATOMETER</div>
                <a href="https://www.rottentomatoes.com/search?search=${encodeURIComponent(getTitleText())}"
                   target="_blank" rel="noopener" class="enh-score-widget__score" style="--score-color:#8888a0">
                    <span class="enh-score-widget__badge enh-score-widget__badge--outline">RT</span>
                    <span class="enh-score-widget__value">Open</span>
                </a>
                <div class="enh-score-widget__sub">Score unavailable</div>
            `;
            bar.appendChild(w);
        },
        destroy() { document.getElementById('enh-rt-widget')?.remove(); }
    });

    reg({
        key: 'inlineLetterboxdScore', name: 'Letterboxd scores', group: 'Scores',
        async init() {
            if (isTVType()) return;
            const imdbId = getIMDbID();
            if (!imdbId) return;

            const cacheKey = 'lb_' + imdbId;
            const cached = cacheGet(cacheKey);
            if (cached) {
                if (cached.unavailable) this._renderUnavailable();
                else this._render(cached);
                return;
            }
            const bar = findRatingBar();
            await new Promise(r => onceVisible(bar, r));
            this._renderLoading();

            const lookupUrl = `https://letterboxd.com/imdb/${imdbId}/`;
            try {
                const res = await httpGet(lookupUrl);
                const data = this._parse(res.responseText, lookupUrl);
                if (data) {
                    cacheSet(cacheKey, data);
                    this._render(data);
                    return;
                }
            } catch { /* handled below */ }

            cacheSetUnavailable(cacheKey);
            this._renderUnavailable();
        },
        _parse(html, fallbackUrl) {
            if (!html || /IMDb ID Not found/i.test(html)) return null;

            let score = null;
            let ratingCount = null;
            let url = fallbackUrl;

            const meta = html.match(/<meta[^>]+name=["']twitter:data2["'][^>]+content=["']([^"']+)["']/i);
            if (meta) score = parseFloat(meta[1]);

            const ldMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>\s*([\s\S]*?)<\/script>/i);
            if (ldMatch) {
                try {
                    const ld = JSON.parse(ldMatch[1]);
                    const aggregate = ld.aggregateRating || {};
                    if (aggregate.ratingValue !== undefined) score = parseFloat(aggregate.ratingValue);
                    if (aggregate.ratingCount !== undefined) ratingCount = parseInt(aggregate.ratingCount, 10);
                    if (ld.url) url = new URL(ld.url, 'https://letterboxd.com').href;
                } catch { /* fall through to regex fallback */ }
            }

            if (!ratingCount) {
                const count = html.match(/"ratingCount"\s*:\s*(\d+)/);
                if (count) ratingCount = parseInt(count[1], 10);
            }
            if (url === fallbackUrl) {
                const idUrl = html.match(/"@id"\s*:\s*"([^"]+)"/);
                if (idUrl) url = new URL(idUrl[1], 'https://letterboxd.com').href;
            }

            return Number.isFinite(score) ? { score, ratingCount, url } : null;
        },
        _render(data) {
            document.getElementById('enh-lb-widget')?.remove();
            const bar = findRatingBar();
            if (!bar) return;
            const score = Number(data.score);
            const color = lbColor(score);
            const count = formatCount(data.ratingCount);
            const w = makeEl('div', { id: 'enh-lb-widget', className: 'enh-score-widget' });
            w.innerHTML = `
                <div class="enh-score-widget__label">LETTERBOXD</div>
                <a href="${data.url || `https://letterboxd.com/imdb/${getIMDbID()}/`}"
                   target="_blank" rel="noopener" class="enh-score-widget__score" style="--score-color:${color}">
                    <span class="enh-score-widget__badge enh-score-widget__badge--outline">LB</span>
                    <span class="enh-score-widget__value">${formatScore(score)}</span>
                </a>
                <div class="enh-score-widget__sub">${count ? `${count} ratings` : 'Average rating'}</div>
            `;
            bar.appendChild(w);
        },
        _renderLoading() {
            if (document.getElementById('enh-lb-widget')) return;
            const bar = findRatingBar();
            if (!bar) return;
            const w = makeEl('div', { id: 'enh-lb-widget', className: 'enh-score-widget enh-score-widget--loading' });
            w.innerHTML = `
                <div class="enh-score-widget__label">LETTERBOXD</div>
                <div class="enh-score-widget__skeleton" aria-label="Loading Letterboxd score"></div>
            `;
            bar.appendChild(w);
        },
        _renderUnavailable() {
            document.getElementById('enh-lb-widget')?.remove();
            const bar = findRatingBar();
            if (!bar) return;
            const w = makeEl('div', { id: 'enh-lb-widget', className: 'enh-score-widget enh-score-widget--muted' });
            w.innerHTML = `
                <div class="enh-score-widget__label">LETTERBOXD</div>
                <a href="https://letterboxd.com/imdb/${getIMDbID()}/"
                   target="_blank" rel="noopener" class="enh-score-widget__score" style="--score-color:#8888a0">
                    <span class="enh-score-widget__badge enh-score-widget__badge--outline">LB</span>
                    <span class="enh-score-widget__value">Open</span>
                </a>
                <div class="enh-score-widget__sub">Score unavailable</div>
            `;
            bar.appendChild(w);
        },
        destroy() { document.getElementById('enh-lb-widget')?.remove(); }
    });

    reg({
        key: 'inlineMetacriticScore', name: 'Metacritic scores', group: 'Scores',
        async init() {
            const imdbId = getIMDbID(), title = getTitleText();
            if (!imdbId || !title) return;

            const cacheKey = 'mc_' + imdbId;
            const cached = cacheGet(cacheKey);
            if (cached) {
                if (cached.unavailable) this._renderUnavailable();
                else this._render(cached);
                return;
            }
            const bar = findRatingBar();
            await new Promise(r => onceVisible(bar, r));
            this._renderLoading();

            const type = isTVType() ? '1' : '2';
            const url = `https://backend.metacritic.com/finder/metacritic/search/${encodeURIComponent(title)}/web?componentName=search-tabs&componentDisplayName=Search+Page+Tab+Filters&componentType=FilterConfig&mcoTypeId=${type}&offset=0&limit=5`;

            try {
                const res = await httpGet(url);
                const obj = JSON.parse(res.responseText);
                const items = obj?.data?.items || [];
                if (items.length > 0) {
                    const best = items[0];
                    const score = best.criticScoreSummary?.score || null;
                    const userScore = best.userScoreSummary?.score || null;
                    let metaUrl = best.criticScoreSummary?.url
                        ? 'https://www.metacritic.com' + best.criticScoreSummary.url.replace('/critic-reviews/', '/')
                        : `https://www.metacritic.com/search/${encodeURIComponent(title)}/`;
                    const d = { score, userScore, url: metaUrl, title: best.title };
                    cacheSet(cacheKey, d); this._render(d);
                    return;
                }
            } catch { /* handled below */ }
            cacheSetUnavailable(cacheKey);
            this._renderUnavailable();
        },
        _render(data) {
            document.getElementById('enh-mc-widget')?.remove();
            const bar = findRatingBar();
            if (!bar) return;
            const hasScore = data.score !== null && data.score !== undefined;
            const color = hasScore ? mcColor(data.score) : '#555';
            const w = makeEl('div', { id: 'enh-mc-widget', className: 'enh-score-widget' });
            w.innerHTML = `
                <div class="enh-score-widget__label">METASCORE</div>
                <a href="${data.url}" target="_blank" rel="noopener" class="enh-score-widget__score" style="--score-color:${color}">
                    <span class="enh-score-widget__badge" style="background:${color};color:${data.score >= 60 ? '#000' : '#fff'}">${hasScore ? data.score : '--'}</span>
                </a>
                ${data.userScore ? `<div class="enh-score-widget__sub">User: ${data.userScore.toFixed(1)}</div>` : ''}
            `;
            bar.appendChild(w);
        },
        _renderLoading() {
            if (document.getElementById('enh-mc-widget')) return;
            const bar = findRatingBar();
            if (!bar) return;
            const w = makeEl('div', { id: 'enh-mc-widget', className: 'enh-score-widget enh-score-widget--loading' });
            w.innerHTML = `
                <div class="enh-score-widget__label">METASCORE</div>
                <div class="enh-score-widget__skeleton" aria-label="Loading Metacritic score"></div>
            `;
            bar.appendChild(w);
        },
        _renderUnavailable() {
            document.getElementById('enh-mc-widget')?.remove();
            const bar = findRatingBar();
            if (!bar) return;
            const w = makeEl('div', { id: 'enh-mc-widget', className: 'enh-score-widget enh-score-widget--muted' });
            w.innerHTML = `
                <div class="enh-score-widget__label">METASCORE</div>
                <a href="https://www.metacritic.com/search/${encodeURIComponent(getTitleText())}/"
                   target="_blank" rel="noopener" class="enh-score-widget__score" style="--score-color:#8888a0">
                    <span class="enh-score-widget__badge enh-score-widget__badge--outline">MC</span>
                    <span class="enh-score-widget__value">Open</span>
                </a>
                <div class="enh-score-widget__sub">Score unavailable</div>
            `;
            bar.appendChild(w);
        },
        destroy() { document.getElementById('enh-mc-widget')?.remove(); }
    });

    reg({
        key: 'streamAvailability', name: 'Streaming availability', group: 'Scores',
        async init() {
            const imdbId = getIMDbID(), title = getTitleText();
            if (!imdbId || !title) return;

            const cacheKey = 'jw_' + imdbId;
            const cached = cacheGet(cacheKey);
            if (cached) {
                if (cached.unavailable) this._renderUnavailable();
                else this._render(cached);
                return;
            }
            this._renderLoading();

            const headers = { Accept: 'text/html,application/xhtml+xml' };
            const directUrl = getJustWatchDetailUrl(title);
            try {
                const res = await httpGet(directUrl, { headers, timeout: 12000 });
                const data = this._parse(res.responseText, directUrl);
                if (data) {
                    cacheSet(cacheKey, data);
                    this._render(data);
                    return;
                }
            } catch { /* fall back to search below */ }

            try {
                const searchUrl = getJustWatchSearchUrl(title);
                const searchRes = await httpGet(searchUrl, { headers, timeout: 12000 });
                const path = this._firstDetailPath(searchRes.responseText);
                if (path) {
                    const detailUrl = new URL(path, 'https://www.justwatch.com').href;
                    const detailRes = await httpGet(detailUrl, { headers, timeout: 12000 });
                    const data = this._parse(detailRes.responseText, detailUrl);
                    if (data) {
                        cacheSet(cacheKey, data);
                        this._render(data);
                        return;
                    }
                }
            } catch { /* handled below */ }

            cacheSetUnavailable(cacheKey);
            this._renderUnavailable();
        },
        _parse(html, url) {
            if (!html) return null;
            const providers = [];

            const metaTag = html.match(/<meta[^>]+name=["']description["'][^>]*>/i)?.[0] || '';
            const content = metaTag.match(/\scontent=["']([^"']+)["']/i)?.[1] || '';
            const desc = decodeHTML(content);
            const availability = desc.match(/\bonline on (.+?) today\b/i)?.[1];
            if (availability) {
                availability
                    .replace(/\s+[–-]\s+including.*$/i, '')
                    .replace(/\bincluding.*$/i, '')
                    .replace(/\s*,?\s+and\s+/gi, ',')
                    .split(',')
                    .map(name => name.trim())
                    .filter(Boolean)
                    .forEach(name => providers.push(name));
            }

            const ldScripts = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>\s*([\s\S]*?)<\/script>/gi);
            for (const script of ldScripts) {
                try {
                    this._collectProviderNames(JSON.parse(script[1]), providers);
                } catch { /* ignore malformed structured data */ }
            }

            const unique = compactProviders(providers, 12).providers;
            return unique.length ? { providers: unique, url } : null;
        },
        _collectProviderNames(node, providers) {
            if (!node) return;
            if (Array.isArray(node)) {
                node.forEach(item => this._collectProviderNames(item, providers));
                return;
            }
            if (typeof node !== 'object') return;

            const offeredBy = node.offeredBy;
            if (Array.isArray(offeredBy)) {
                offeredBy.forEach(item => {
                    if (item?.name) providers.push(item.name);
                });
            } else if (offeredBy?.name) {
                providers.push(offeredBy.name);
            }
            Object.values(node).forEach(value => this._collectProviderNames(value, providers));
        },
        _firstDetailPath(html) {
            const typePath = getJustWatchTypePath();
            const re = new RegExp(`/us/${typePath}/[a-z0-9][a-z0-9-]*`, 'gi');
            const match = re.exec(html || '');
            return match ? decodeHTML(match[0]) : '';
        },
        _render(data) {
            document.getElementById('enh-jw-widget')?.remove();
            const bar = findRatingBar();
            if (!bar) return;
            const providers = Array.isArray(data.providers) ? data.providers : [];
            const summary = formatProviderSummary(providers);
            if (!summary) { this._renderUnavailable(); return; }

            const w = makeEl('div', { id: 'enh-jw-widget', className: 'enh-score-widget enh-score-widget--availability' },
                makeEl('div', { className: 'enh-score-widget__label' }, 'STREAMING'),
                makeEl('a', {
                    href: data.url || getJustWatchSearchUrl(),
                    target: '_blank',
                    rel: 'noopener',
                    className: 'enh-score-widget__score enh-score-widget__score--availability',
                    style: { '--score-color': '#fbc500' },
                },
                    makeEl('span', { className: 'enh-score-widget__badge enh-score-widget__badge--outline' }, 'JW'),
                    makeEl('span', { className: 'enh-score-widget__value enh-score-widget__value--availability' }, `On ${summary}`)
                ),
                makeEl('div', { className: 'enh-score-widget__sub' }, 'Via JustWatch')
            );
            bar.appendChild(w);
        },
        _renderLoading() {
            if (document.getElementById('enh-jw-widget')) return;
            const bar = findRatingBar();
            if (!bar) return;
            const w = makeEl('div', { id: 'enh-jw-widget', className: 'enh-score-widget enh-score-widget--loading enh-score-widget--availability' });
            w.innerHTML = `
                <div class="enh-score-widget__label">STREAMING</div>
                <div class="enh-score-widget__skeleton" aria-label="Loading streaming availability"></div>
            `;
            bar.appendChild(w);
        },
        _renderUnavailable() {
            document.getElementById('enh-jw-widget')?.remove();
            const bar = findRatingBar();
            if (!bar) return;
            const w = makeEl('div', { id: 'enh-jw-widget', className: 'enh-score-widget enh-score-widget--muted enh-score-widget--availability' },
                makeEl('div', { className: 'enh-score-widget__label' }, 'STREAMING'),
                makeEl('a', {
                    href: getJustWatchSearchUrl(),
                    target: '_blank',
                    rel: 'noopener',
                    className: 'enh-score-widget__score enh-score-widget__score--availability',
                    style: { '--score-color': '#8888a0' },
                },
                    makeEl('span', { className: 'enh-score-widget__badge enh-score-widget__badge--outline' }, 'JW'),
                    makeEl('span', { className: 'enh-score-widget__value' }, 'Open')
                ),
                makeEl('div', { className: 'enh-score-widget__sub' }, 'Availability unavailable')
            );
            bar.appendChild(w);
        },
        destroy() { document.getElementById('enh-jw-widget')?.remove(); }
    });

    // #########################################################################
    //
    //  LAYOUT FEATURES
    //
    // #########################################################################

    reg({
        key: 'collapsibleSections', name: 'Collapsible sections', group: 'Layout',
        _ids: ['title-cast','UserReviews','MoreLikeThis','Details','BoxOffice','TechSpecs','DidYouKnow','videos-section','Photos'],
        init() {
            addCSS(`
                .enh-collapse-btn{position:absolute;top:12px;right:12px;width:28px;height:28px;
                    background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);
                    border-radius:6px;cursor:pointer;color:#a1a1aa;font-size:16px;z-index:10;
                    display:flex;align-items:center;justify-content:center;transition:background .12s ease,border-color .12s ease,color .12s ease,transform .12s ease;
                    line-height:1;padding:0}
                .enh-collapse-btn:hover{background:rgba(255,255,255,0.1);color:#fff}
                .enh-section--collapsed>*:not(.ipc-title):not(.enh-collapse-btn):not([class*="title"]):not(h3):not(header){display:none!important}
                .enh-section--collapsed{min-height:auto!important;padding-bottom:12px!important}
                section[data-testid]{position:relative}
            `, 'enh-collapsible');

            this._ids.forEach(id => {
                const sec = document.querySelector(`section[data-testid="${id}"]`);
                if (!sec || sec.querySelector('.enh-collapse-btn')) return;
                const collapsed = GM_getValue('enh_coll_' + id, false);
                if (collapsed) sec.classList.add('enh-section--collapsed');
                const sectionLabel = sec.querySelector('.ipc-title__text, h2, h3')?.textContent?.trim() || id;
                const btn = makeEl('button', {
                    className: 'enh-collapse-btn', type: 'button', title: collapsed ? 'Expand section' : 'Collapse section',
                    'aria-expanded': String(!collapsed),
                    'aria-label': `${collapsed ? 'Expand' : 'Collapse'} ${sectionLabel}`,
                    textContent: collapsed ? '+' : '-',
                    onClick: () => {
                        const now = sec.classList.toggle('enh-section--collapsed');
                        btn.textContent = now ? '+' : '-';
                        btn.title = now ? 'Expand section' : 'Collapse section';
                        btn.setAttribute('aria-expanded', String(!now));
                        btn.setAttribute('aria-label', `${now ? 'Expand' : 'Collapse'} ${sectionLabel}`);
                        GM_setValue('enh_coll_' + id, now);
                    }
                });
                sec.appendChild(btn);
            });
        },
        destroy() {
            removeCSS('enh-collapsible');
            document.querySelectorAll('.enh-collapse-btn').forEach(b => b.remove());
            document.querySelectorAll('.enh-section--collapsed').forEach(s => s.classList.remove('enh-section--collapsed'));
        }
    });

    reg({
        key: 'spoilerBlur', name: 'Spoiler blur on plot', group: 'Layout',
        init() {
            addCSS(`
                .enh-blur{filter:blur(6px);transition:filter .3s ease;cursor:pointer;user-select:none;position:relative}
                .enh-blur::after{content:'Click to reveal';position:absolute;top:50%;left:50%;
                    transform:translate(-50%,-50%);color:#f5c518;font-weight:600;font-size:12px;
                    background:rgba(0,0,0,0.5);padding:4px 12px;border-radius:6px;pointer-events:none;
                    opacity:1;transition:opacity .3s ease}
                .enh-blur.enh-revealed{filter:none;cursor:default}
                .enh-blur.enh-revealed::after{opacity:0}
            `, 'enh-spoilerBlur');

            const plotFull = document.querySelector('[data-testid="plot-l"],[data-testid="plot-xl"]');
            if (plotFull && plotFull.textContent.length > 200) {
                plotFull.classList.add('enh-blur');
                plotFull.addEventListener('click', function h() {
                    plotFull.classList.add('enh-revealed');
                    plotFull.removeEventListener('click', h);
                });
            }
        },
        destroy() {
            removeCSS('enh-spoilerBlur');
            document.querySelectorAll('.enh-blur').forEach(e => e.classList.remove('enh-blur','enh-revealed'));
        }
    });

    reg({
        key: 'quickNav', name: 'Section navigator', group: 'Layout',
        _navItems: [
            { id:'hero-parent', label:'Overview', icon:'O' },
            { id:'title-cast', label:'Cast', icon:'C' },
            { id:'UserReviews', label:'Reviews', icon:'R' },
            { id:'MoreLikeThis', label:'Similar', icon:'S' },
            { id:'Details', label:'Details', icon:'D' },
            { id:'BoxOffice', label:'Box Office', icon:'$' },
            { id:'DidYouKnow', label:'Trivia', icon:'?' },
        ],
        init() {
            addCSS(`
                #enh-quicknav{position:fixed;right:16px;top:50%;transform:translateY(-50%);
                    z-index:99999;display:flex;flex-direction:column;gap:4px}
                .enh-qn-dot{width:36px;height:36px;border-radius:10px;
                    background:rgba(22,22,26,0.9);border:1px solid rgba(255,255,255,0.06);
                    color:#a1a1aa;font-size:11px;font-weight:800;letter-spacing:.04em;cursor:pointer;
                    display:flex;align-items:center;justify-content:center;transition:background .15s ease,border-color .15s ease,color .15s ease,transform .15s ease;
                    text-decoration:none;position:relative}
                .enh-qn-dot:hover{background:rgba(245,197,24,0.12);border-color:rgba(245,197,24,0.25);
                    color:#f5c518;transform:translateX(-2px)}
                .enh-qn-dot::before{content:attr(data-label);position:absolute;right:calc(100% + 8px);
                    padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;
                    background:#1c1c22;color:#e4e4e7;white-space:nowrap;border:1px solid rgba(255,255,255,0.08);
                    opacity:0;transform:translateX(4px);pointer-events:none;transition:opacity .15s ease,transform .15s ease}
                .enh-qn-dot:hover::before{opacity:1;transform:translateX(0)}
                @media(max-width:1200px){#enh-quicknav{display:none}}
            `, 'enh-quickNav');

            const nav = makeEl('div', { id: 'enh-quicknav' });
            this._navItems.forEach(s => {
                const sec = document.querySelector(`section[data-testid="${s.id}"]`);
                if (!sec) return;
                nav.appendChild(makeEl('a', {
                    className:'enh-qn-dot', href:'#', dataset:{ label:s.label }, textContent:s.icon,
                    title: s.label, 'aria-label': `Jump to ${s.label}`,
                    onClick: (e) => { e.preventDefault(); sec.scrollIntoView({behavior:'smooth',block:'start'}); }
                }));
            });
            if (nav.children.length) document.body.appendChild(nav);
        },
        destroy() { removeCSS('enh-quickNav'); document.getElementById('enh-quicknav')?.remove(); }
    });

    // #########################################################################
    //
    //  SEARCH & LINKS
    //
    // #########################################################################

    function probeSiteHealth(url, timeout = 4000) {
        return new Promise(resolve => {
            try {
                const origin = new URL(url).origin;
                const img = new Image();
                let settled = false;
                const settle = (alive) => { if (!settled) { settled = true; resolve(alive); } };
                img.onload = () => settle(true);
                img.onerror = () => settle(true);
                setTimeout(() => settle(false), timeout);
                img.src = origin + '/favicon.ico?' + Date.now();
            } catch { resolve(false); }
        });
    }

    const SITE_HEALTH_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours
    function getSiteHealthCache() {
        try {
            const raw = GM_getValue(PREFIX + 'siteHealth', null);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            const now = Date.now();
            const live = {};
            Object.entries(parsed).forEach(([domain, entry]) => {
                if (now - (entry.ts || 0) < SITE_HEALTH_CACHE_TTL) live[domain] = entry;
            });
            return live;
        } catch { return {}; }
    }
    function setSiteHealthCache(cache) {
        GM_setValue(PREFIX + 'siteHealth', JSON.stringify(cache));
    }

    reg({
        key: 'searchButtons', name: 'Watch search buttons', group: 'Features',
        init() {
            if (!window.location.hostname.includes('imdb.com')) return;
            waitForTitleSurface().then(tc => {
                if (document.getElementById('enh-search-buttons')) return;
                const title = getTitleText();
                if (!title) return;
                const ctx = getLinkContext(title);
                const sites = getSiteList('watchSites', DEFAULT_WATCH_SITES);
                const wrap = makeEl('section', {
                    id:'enh-search-buttons',
                    role:'region',
                    'aria-label':'Watch movie and show sites',
                });
                const label = makeEl('div', { className:'enh-stream-label' },
                    makeEl('span', { className:'enh-stream-label__dot' }),
                    'WATCH MOVIES & SHOWS'
                );
                const row = makeEl('div', { className:'enh-search-row' });
                sites.forEach(site => {
                    const url = site.storeQuery ? getCinebyHost() : applyLinkTemplate(site.url, ctx);
                    const btn = makeEl('a', {
                        href:url,
                        target:'_blank',
                        rel:'noopener',
                        className:'enh-search-btn',
                        dataset:{ url, storeQuery:String(Boolean(site.storeQuery)) },
                        style:{ '--btn-color':site.color },
                        title:`Search ${site.name} for ${title}`,
                        'aria-label': `Open ${site.name} search for ${title}`,
                    }, makeEl('span', {}, site.name));
                    row.appendChild(btn);
                });
                wrap.appendChild(label);
                wrap.appendChild(row);
                appendTitleStackItem(wrap, TITLE_STACK_ORDER.searchButtons);
                wrap.querySelectorAll('.enh-search-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        if (btn.dataset.storeQuery === 'true') GM_setValue(CINEBY_QUERY_KEY, title);
                    });
                });
                this._probeButtons(row);
            }).catch(() => {});
        },
        async _probeButtons(row) {
            const cache = getSiteHealthCache();
            const buttons = Array.from(row.querySelectorAll('.enh-search-btn'));
            const toProbe = [];
            buttons.forEach(btn => {
                try {
                    const domain = new URL(btn.href).hostname;
                    const cached = cache[domain];
                    if (cached) {
                        if (!cached.alive) btn.classList.add('enh-search-btn--dead');
                    } else {
                        toProbe.push({ btn, domain });
                    }
                } catch { /* skip malformed URLs */ }
            });
            if (!toProbe.length) return;
            await Promise.all(toProbe.map(async ({ btn, domain }) => {
                const alive = await probeSiteHealth(btn.href);
                cache[domain] = { alive, ts: Date.now() };
                if (!alive) btn.classList.add('enh-search-btn--dead');
            }));
            setSiteHealthCache(cache);
        },
        destroy() { document.getElementById('enh-search-buttons')?.remove(); pruneTitleStack(); }
    });

    reg({
        key: 'externalLinks', name: 'External links bar', group: 'Features',
        init() {
            waitForTitleSurface().then(() => {
                if (document.getElementById('enh-external-links')) return;
                const title = getTitleText(), year = getTitleYear(), imdbId = getIMDbID();
                if (!title || !imdbId) return;
                const ctx = getLinkContext(title, imdbId, year);
                const links = getSiteList('externalSites', DEFAULT_EXTERNAL_SITES);
                const bar = makeEl('div', { id:'enh-external-links' });
                links.forEach(link => {
                    bar.appendChild(makeEl('a', {
                        href: applyLinkTemplate(link.url, ctx),
                        target:'_blank',
                        rel:'noopener',
                        className:'enh-ext-link',
                        style:{ '--link-color':link.color },
                    }, link.name));
                });
                appendTitleStackItem(bar, TITLE_STACK_ORDER.externalLinks);
            }).catch(() => {});
        },
        destroy() { document.getElementById('enh-external-links')?.remove(); pruneTitleStack(); }
    });

    reg({
        key: 'trailerPopover', name: 'Trailer popover', group: 'Features',
        _keydown: null,
        init() {
            if (!window.location.hostname.includes('imdb.com')) return;
            const t = getTheme();
            addCSS(`
                #enh-trailer-btn {
                    border: 1px solid ${t.bd1};
                    background: ${t.sf1};
                    color: ${t.tx1};
                    border-radius: 7px;
                    padding: 6px 12px;
                    cursor: pointer;
                    font: 700 12px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    transition: background .15s ease, border-color .15s ease, color .15s ease, transform .15s ease;
                }
                #enh-trailer-btn:hover { background:${t.sf2}; border-color:${t.accentBorder}; color:${t.accent}; transform:translateY(-1px); }
                #enh-trailer-overlay {
                    position: fixed; inset: 0; z-index: 2147483642;
                    display: flex; align-items: center; justify-content: center;
                    padding: 24px; background: rgba(0,0,0,.82);
                }
                #enh-trailer-dialog {
                    width: min(960px, calc(100vw - 32px));
                    background: ${t.sf0}; color: ${t.tx1};
                    border: 1px solid ${t.bd1}; border-radius: 12px;
                    box-shadow: ${t.sh3}; overflow: hidden;
                }
                .enh-trailer-header {
                    display: flex; justify-content: space-between; align-items: center; gap: 12px;
                    padding: 12px 14px; border-bottom: 1px solid ${t.bd0};
                }
                .enh-trailer-title { color: ${t.tx0}; font: 800 13px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
                .enh-trailer-close {
                    width: 30px; height: 30px; border-radius: 8px; cursor: pointer;
                    border: 1px solid ${t.bd1}; background: ${t.sf1}; color: ${t.tx2};
                    font: 800 16px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }
                .enh-trailer-close:hover { color:${t.tx0}; background:${t.sf2}; }
                .enh-trailer-body {
                    aspect-ratio: 16 / 9; background: ${t.bg};
                    display: flex; align-items: center; justify-content: center;
                    color: ${t.tx2}; font: 600 13px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }
                .enh-trailer-body iframe { width: 100%; height: 100%; border: 0; display: block; }
                .enh-trailer-fallback { color:${t.blue}!important; }
            `, 'enh-trailerPopover');

            waitForTitleSurface().then(() => {
                if (document.getElementById('enh-trailer-btn')) return;
                const btn = makeEl('button', {
                    id:'enh-trailer-btn',
                    type:'button',
                    'aria-haspopup':'dialog',
                    onClick: () => this._open(),
                }, 'Trailer');
                const extBar = document.getElementById('enh-external-links');
                if (extBar) extBar.appendChild(btn);
                else appendTitleStackItem(btn, TITLE_STACK_ORDER.trailerPopover);
            }).catch(() => {});
        },
        async _open() {
            const overlay = this._renderModal('Loading trailer...');
            const body = overlay.querySelector('.enh-trailer-body');
            try {
                const videoId = await this._getVideoId();
                body.replaceChildren(makeEl('iframe', {
                    src:`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`,
                    title:`${getTitleText()} trailer`,
                    allow:'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
                    allowfullscreen:'allowfullscreen',
                }));
            } catch {
                const url = getTrailerSearchUrl();
                body.replaceChildren(makeEl('a', {
                    href:url,
                    target:'_blank',
                    rel:'noopener',
                    className:'enh-trailer-fallback',
                }, 'Open trailer search on YouTube'));
            }
        },
        _renderModal(message) {
            document.getElementById('enh-trailer-overlay')?.remove();
            const close = () => {
                document.removeEventListener('keydown', this._keydown);
                document.getElementById('enh-trailer-overlay')?.remove();
            };
            this._keydown = (e) => { if (e.key === 'Escape') close(); };
            document.addEventListener('keydown', this._keydown);

            const overlay = makeEl('div', {
                id:'enh-trailer-overlay',
                role:'presentation',
                onClick: e => { if (e.target.id === 'enh-trailer-overlay') close(); },
            }, makeEl('div', {
                id:'enh-trailer-dialog',
                role:'dialog',
                'aria-modal':'true',
                'aria-label':'Trailer',
            },
                makeEl('div', { className:'enh-trailer-header' },
                    makeEl('div', { className:'enh-trailer-title' }, `${getTitleText()} trailer`),
                    makeEl('button', { type:'button', className:'enh-trailer-close', 'aria-label':'Close trailer', onClick:close }, 'x')
                ),
                makeEl('div', { className:'enh-trailer-body' }, message)
            ));
            document.body.appendChild(overlay);
            setTimeout(() => overlay.querySelector('.enh-trailer-close')?.focus(), 20);
            return overlay;
        },
        async _getVideoId() {
            const imdbId = getIMDbID();
            const cacheKey = imdbId ? `yt_${imdbId}` : '';
            const cached = cacheKey ? cacheGet(cacheKey) : null;
            if (cached?.videoId) return cached.videoId;
            if (cached?.unavailable) throw new Error('Trailer unavailable');

            const res = await httpGet(getTrailerSearchUrl(), {
                timeout: 12000,
                headers: { Accept:'text/html,application/xhtml+xml' },
            });
            const videoId = this._parseVideoId(res.responseText);
            if (!videoId) {
                if (cacheKey) cacheSetUnavailable(cacheKey);
                throw new Error('Trailer unavailable');
            }
            if (cacheKey) cacheSet(cacheKey, { videoId });
            return videoId;
        },
        _parseVideoId(html) {
            const seen = new Set();
            const matches = String(html || '').matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g);
            for (const match of matches) {
                if (seen.has(match[1])) continue;
                seen.add(match[1]);
                return match[1];
            }
            return '';
        },
        destroy() {
            removeCSS('enh-trailerPopover');
            document.removeEventListener('keydown', this._keydown);
            this._keydown = null;
            document.getElementById('enh-trailer-btn')?.remove();
            document.getElementById('enh-trailer-overlay')?.remove();
            pruneTitleStack();
        }
    });

    // ===================== EXPANDED LINK MENU =====================
    reg({
        key: 'expandedLinkMenu', name: 'Expanded link menu', group: 'Features',
        _DB: {
            'Movie Sites': [
                { n:'Letterboxd', u:'https://letterboxd.com/imdb/{{ID}}/' },
                { n:'TMDB', u:'https://www.themoviedb.org/search/movie?query={{T}}' },
                { n:'AllMovie', u:'http://www.allmovie.com/search/movies/{{T}}' },
                { n:'Box Office Mojo', u:'https://www.boxofficemojo.com/search/?q={{T}}' },
                { n:'Criticker', u:'https://www.criticker.com/?search=tt{{ID}}' },
                { n:'Trakt', u:'https://trakt.tv/search/imdb/{{ID}}?id_type={{TRAKT_TYPE}}' },
            ],
            'Reviews': [
                { n:'Rotten Tomatoes', u:'https://www.rottentomatoes.com/search?search={{T}}' },
                { n:'Metacritic', u:'https://www.metacritic.com/search/all/{{T}}/results' },
            ],
            'Search': [
                { n:'Google', u:'https://www.google.com/search?q={{T}}+{{Y}}' },
                { n:'DuckDuckGo', u:'https://duckduckgo.com/?q={{T}}+{{Y}}' },
                { n:'YouTube', u:'https://www.youtube.com/results?search_query={{T}}%20trailer' },
                { n:'Wikipedia', u:'https://en.wikipedia.org/w/index.php?search={{T}}' },
            ],
            'Subtitles': [
                { n:'OpenSubtitles', u:'https://www.opensubtitles.org/en/search/imdbid-{{ID}}' },
                { n:'OpenSubs.com', u:'https://www.opensubtitles.com/en/en/search-all/q-tt{{ID}}' },
                { n:'SubDL', u:'https://subdl.com/search/{{T}}' },
                { n:'YIFY-Subs', u:'https://yifysubtitles.ch/movie-imdb/{{ID}}', movieOnly:true },
            ],
            'TV': [
                { n:'TheTVDB', u:'https://www.thetvdb.com/search?query=tt{{ID}}' },
                { n:'TVMaze', u:'https://www.tvmaze.com/search?q={{T}}' },
                { n:'Ep Calendar', u:'https://episodecalendar.com/en/shows?q%5Bname_cont%5D={{T}}' },
            ],
            'Torrents': [
                { n:'YTS', u:'https://yts.mx/browse-movies/tt{{ID}}' },
                { n:'1337x', u:'https://1337x.to/search/{{T}}+{{Y}}/1/' },
            ],
        },
        _closeHandler: null,
        init() {
            waitFor('#enh-external-links').then(extBar => {
                const title = getTitleText(), year = getTitleYear(), imdbId = getIMDbID();
                if (!title || !imdbId) return;
                const buildUrl = (tpl) => tpl.replace(/\{\{ID\}\}/g, imdbId)
                    .replace(/\{\{TRAKT_TYPE\}\}/g, isTVType() ? 'show' : 'movie')
                    .replace(/\{\{T\}\}/g, encodeURIComponent(title)).replace(/\{\{Y\}\}/g, year);

                const container = makeEl('div', { id:'enh-link-menu-wrap' });
                const trigger = makeEl('button', {
                    id:'enh-link-menu-trigger', type:'button',
                    textContent:'More links',
                    'aria-haspopup':'true',
                    'aria-expanded':'false',
                    onClick: (e) => {
                        e.stopPropagation();
                        const visible = dropdown.classList.toggle('enh-visible');
                        trigger.setAttribute('aria-expanded', String(visible));
                    }
                });

                const dropdown = makeEl('div', { id:'enh-link-menu-dropdown', className:'enh-link-dropdown', role:'menu' });
                for (const [cat, links] of Object.entries(this._DB)) {
                    if (cat === 'TV' && !isTVType()) continue;
                    dropdown.appendChild(makeEl('div', { className:'enh-link-dropdown__cat' }, cat));
                    const row = makeEl('div', { className:'enh-link-dropdown__row' });
                    links.filter(l => !(l.movieOnly && isTVType())).forEach(l => row.appendChild(makeEl('a', {
                        href: buildUrl(l.u), target:'_blank', rel:'noopener', className:'enh-link-dropdown__item', role:'menuitem'
                    }, l.n)));
                    dropdown.appendChild(row);
                }

                container.appendChild(trigger);
                container.appendChild(dropdown);
                extBar.appendChild(container);

                this._closeHandler = (e) => {
                    if (!e.target.closest('#enh-link-menu-trigger') && !e.target.closest('#enh-link-menu-dropdown')) {
                        dropdown.classList.remove('enh-visible');
                        trigger.setAttribute('aria-expanded', 'false');
                    }
                };
                document.addEventListener('click', this._closeHandler);
            }).catch(() => {});
        },
        destroy() {
            if (this._closeHandler) document.removeEventListener('click', this._closeHandler);
            this._closeHandler = null;
            document.getElementById('enh-link-menu-wrap')?.remove();
        }
    });

    reg({
        key: 'watchedMarking', name: 'Watched / skip marks', group: 'Features',
        _observer: null,
        _clickHandler: null,
        _raf: 0,
        init() {
            if (!window.location.hostname.includes('imdb.com')) return;
            const t = getTheme();
            addCSS(`
                .enh-markable-card{position:relative!important}
                .enh-markable-card.enh-marked{opacity:.72;filter:saturate(.58);transition:opacity .15s ease,filter .15s ease}
                .enh-markable-card.enh-marked:hover,.enh-markable-card.enh-marked:focus-within{opacity:1;filter:none}
                .enh-mark-controls{
                    position:absolute;top:6px;left:6px;right:6px;z-index:20;
                    display:flex;gap:4px;align-items:center;justify-content:center;
                    opacity:0;transform:translateY(-2px);pointer-events:none;
                    transition:opacity .12s ease,transform .12s ease;
                }
                .enh-markable-card:hover .enh-mark-controls,
                .enh-markable-card:focus-within .enh-mark-controls,
                .enh-markable-card.enh-marked .enh-mark-controls{
                    opacity:1;transform:translateY(0);pointer-events:auto;
                }
                .enh-mark-btn{
                    min-width:0;height:24px;padding:0 7px;border-radius:6px;
                    border:1px solid ${t.bd1};background:${t.sf1};color:${t.tx1};
                    font:700 10px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                    cursor:pointer;box-shadow:${t.sh1};white-space:nowrap;
                }
                .enh-mark-btn:hover{border-color:${t.accentBorder};color:${t.accent}}
                .enh-mark-btn[data-active="true"]{background:${t.accent};border-color:${t.accent};color:#050505}
                .enh-mark-btn--skip[data-active="true"]{background:${t.red};border-color:${t.red};color:#fff}
                .enh-mark-badge{
                    position:absolute;left:6px;bottom:6px;z-index:19;
                    padding:4px 7px;border-radius:6px;background:${t.accent};color:#050505;
                    font:800 10px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                    box-shadow:${t.sh1};text-transform:uppercase;letter-spacing:.04em;
                    pointer-events:none;
                }
                .enh-mark-badge--skip{background:${t.red};color:#fff}
            `, 'enh-watchedMarking');

            this._clickHandler = (e) => {
                const btn = e.target.closest?.('[data-enh-mark-action]');
                if (!btn) return;
                const card = btn.closest('.enh-markable-card');
                const imdbId = card?.dataset.enhMarkId;
                if (!imdbId) return;
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation?.();
                const action = btn.dataset.enhMarkAction;
                const state = action === 'clear' ? '' : action;
                setUserMark(imdbId, state, card.dataset.enhMarkTitle || getTitleText());
                this._syncAll();
                showToast(state ? `Marked ${state}` : 'Mark cleared');
            };
            document.body.addEventListener('click', this._clickHandler, true);

            this._scan(document);
            this._observer = new MutationObserver(() => {
                cancelAnimationFrame(this._raf);
                this._raf = requestAnimationFrame(() => this._scan(document));
            });
            this._observer.observe(document.body, { childList: true, subtree: true });
        },
        _scan(root) {
            const seen = new Set();
            const currentId = getIMDbID();
            const heroPoster = document.querySelector('[data-testid="hero-media__poster"]');
            if (heroPoster && currentId) {
                this._decorate(heroPoster, currentId, getTitleText());
                seen.add(heroPoster);
            }

            const anchors = [];
            if (root?.matches?.('a[href*="/title/tt"]')) anchors.push(root);
            root?.querySelectorAll?.('a[href*="/title/tt"]').forEach(a => anchors.push(a));
            anchors.forEach(anchor => {
                const imdbId = anchor.href?.match(/\/title\/(tt\d+)/)?.[1];
                if (!imdbId) return;
                const card = this._findCard(anchor);
                if (!card || seen.has(card)) return;
                seen.add(card);
                this._decorate(card, imdbId, this._extractTitle(card, anchor));
            });
        },
        _findCard(anchor) {
            const posterCard = anchor.closest('.ipc-poster-card');
            if (posterCard) return posterCard;
            const summary = anchor.closest('.ipc-metadata-list-summary-item');
            if (summary?.querySelector('img')) return summary;
            const listItem = anchor.closest('li');
            if (listItem?.querySelector('img')) return listItem;
            const media = anchor.closest('[class*="poster"],[class*="Poster"],[class*="media"],[class*="Media"]');
            if (media?.querySelector('img')) return media;
            return null;
        },
        _extractTitle(card, anchor) {
            const fromImg = card.querySelector('img[alt]')?.alt?.replace(/^poster for\s+/i, '').trim();
            if (fromImg) return fromImg;
            const fromTitle = card.querySelector('.ipc-title__text,[data-testid*="title" i]')?.textContent?.trim();
            if (fromTitle) return fromTitle.replace(/^\d+\.\s*/, '');
            return anchor.textContent?.trim().replace(/^\d+\.\s*/, '') || '';
        },
        _decorate(card, imdbId, title) {
            if (!card || card.closest('#enh-settings-panel')) return;
            card.dataset.enhMarkId = imdbId;
            card.dataset.enhMarkTitle = title || imdbId;
            card.classList.add('enh-markable-card');

            if (!Array.from(card.children).some(child => child.classList?.contains('enh-mark-controls'))) {
                const controls = makeEl('div', { className: 'enh-mark-controls' },
                    makeEl('button', {
                        type: 'button',
                        className: 'enh-mark-btn enh-mark-btn--watched',
                        dataset: { enhMarkAction: 'watched' },
                        'aria-label': `Mark ${title || imdbId} as watched`,
                    }, 'Seen'),
                    makeEl('button', {
                        type: 'button',
                        className: 'enh-mark-btn enh-mark-btn--skip',
                        dataset: { enhMarkAction: 'skip' },
                        'aria-label': `Mark ${title || imdbId} as skipped`,
                    }, 'Skip'),
                    makeEl('button', {
                        type: 'button',
                        className: 'enh-mark-btn enh-mark-btn--clear',
                        dataset: { enhMarkAction: 'clear' },
                        'aria-label': `Clear mark for ${title || imdbId}`,
                    }, 'Clear')
                );
                card.appendChild(controls);
            }
            this._applyCardState(card);
        },
        _applyCardState(card) {
            const mark = getUserMark(card.dataset.enhMarkId);
            card.classList.toggle('enh-marked', Boolean(mark));
            card.classList.toggle('enh-marked--watched', mark === 'watched');
            card.classList.toggle('enh-marked--skip', mark === 'skip');
            card.querySelectorAll('.enh-mark-btn').forEach(btn => {
                btn.dataset.active = String(btn.dataset.enhMarkAction === mark);
            });

            let badge = Array.from(card.children).find(child => child.classList?.contains('enh-mark-badge'));
            if (!mark) {
                badge?.remove();
                return;
            }
            if (!badge) {
                badge = makeEl('div', { className: 'enh-mark-badge' });
                card.appendChild(badge);
            }
            badge.textContent = mark === 'watched' ? 'Watched' : 'Skip';
            badge.classList.toggle('enh-mark-badge--skip', mark === 'skip');
        },
        _syncAll() {
            document.querySelectorAll('.enh-markable-card').forEach(card => this._applyCardState(card));
            document.dispatchEvent(new CustomEvent('imdb-enhanced:marks-updated'));
        },
        destroy() {
            removeCSS('enh-watchedMarking');
            if (this._clickHandler) document.body.removeEventListener('click', this._clickHandler, true);
            this._clickHandler = null;
            this._observer?.disconnect();
            this._observer = null;
            cancelAnimationFrame(this._raf);
            document.querySelectorAll('.enh-markable-card').forEach(card => {
                card.classList.remove('enh-markable-card', 'enh-marked', 'enh-marked--watched', 'enh-marked--skip');
                delete card.dataset.enhMarkId;
                delete card.dataset.enhMarkTitle;
                card.querySelectorAll('.enh-mark-controls,.enh-mark-badge').forEach(el => el.remove());
            });
        }
    });

    reg({
        key: 'servarrIntegration', name: 'Servarr quick-add', group: 'Features',
        init() {
            if (!window.location.hostname.includes('imdb.com')) return;
            waitForTitleSurface().then(() => {
                if (document.getElementById('enh-servarr-actions')) return;
                const imdbId = getIMDbID(), title = getTitleText();
                if (!imdbId || !title) return;

                const type = getMediaType();
                const actions = [];
                if (!isTVType(type) && isServarrConfigured('radarr')) actions.push({ kind:'radarr', label:'Add Radarr' });
                if (isTVType(type) && isServarrConfigured('sonarr')) actions.push({ kind:'sonarr', label:'Add Sonarr' });
                if (!actions.length) return;

                const t = getTheme();
                addCSS(`
                    #enh-servarr-actions {
                        margin-top: 8px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
                    }
                    .enh-servarr-label {
                        font: 700 10px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        letter-spacing: .08em; color: ${t.tx3};
                    }
                    .enh-servarr-status {
                        display: inline-flex; align-items: center; gap: 5px;
                        font: 700 11px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        color: ${t.green}; padding: 0 4px;
                    }
                    .enh-servarr-status--dot {
                        width: 8px; height: 8px; border-radius: 50%; background: ${t.green};
                        box-shadow: 0 0 6px ${t.green};
                    }
                    .enh-servarr-btn {
                        display: inline-flex; align-items: center; justify-content: center;
                        min-height: 28px; padding: 0 11px; border-radius: 7px;
                        border: 1px solid ${t.bd1}; background: ${t.sf1}; color: ${t.tx1};
                        cursor: pointer; font: 700 11px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        transition: background .15s ease, border-color .15s ease, color .15s ease, transform .15s ease;
                    }
                    .enh-servarr-btn:hover { background: ${t.sf2}; border-color: ${t.accentBorder}; color: ${t.accent}; transform: translateY(-1px); }
                    .enh-servarr-btn:disabled { cursor: progress; opacity: .62; transform: none; }
                `, 'enh-servarrIntegration');

                const bar = makeEl('div', { id:'enh-servarr-actions' },
                    makeEl('div', { className:'enh-servarr-label' }, 'SERVARR')
                );
                actions.forEach(action => {
                    const btn = makeEl('button', {
                        type:'button',
                        className:'enh-servarr-btn',
                        dataset:{ kind:action.kind },
                        'aria-label': `${action.label} for ${title}`,
                        onClick: async () => {
                            const original = btn.textContent;
                            btn.disabled = true;
                            btn.textContent = 'Adding...';
                            try {
                                await this._add(action.kind, imdbId, title);
                                showToast(`${title} sent to ${action.kind === 'radarr' ? 'Radarr' : 'Sonarr'}`);
                                btn.textContent = 'Added';
                                btn.disabled = true;
                            } catch (error) {
                                console.warn('[IMDb Enhanced] Servarr add failed:', error);
                                showToast(`${action.kind === 'radarr' ? 'Radarr' : 'Sonarr'} add failed: ${getRequestErrorMessage(error)}`, 4500);
                                btn.disabled = false;
                                btn.textContent = original;
                            }
                        },
                    }, action.label);
                    bar.appendChild(btn);
                    this._checkLibrary(action.kind, imdbId, btn, bar);
                });
                appendTitleStackItem(bar, TITLE_STACK_ORDER.servarrIntegration);
            }).catch(() => {});
        },
        async _checkLibrary(kind, imdbId, btn, bar) {
            try {
                const path = kind === 'radarr' ? 'movie/lookup' : 'series/lookup';
                const response = await servarrRequest(kind, path, { query:{ term: `imdb:${imdbId}` } });
                const items = parseJSONResponse(response);
                if (!Array.isArray(items) || !items.length) return;
                const found = items.find(item => item.id && item.id > 0);
                if (found) {
                    btn.textContent = 'In Library';
                    btn.disabled = true;
                    const label = kind === 'radarr' ? 'Radarr' : 'Sonarr';
                    const status = makeEl('span', { className:'enh-servarr-status', title:`Already in ${label}` },
                        makeEl('span', { className:'enh-servarr-status--dot' }),
                    );
                    bar.insertBefore(status, btn);
                }
            } catch { /* library check is best-effort */ }
        },
        async _lookup(kind, imdbId, title) {
            const path = kind === 'radarr' ? 'movie/lookup' : 'series/lookup';
            const terms = [`imdb:${imdbId}`, `https://www.imdb.com/title/${imdbId}/`, title].filter(Boolean);
            for (const term of terms) {
                const response = await servarrRequest(kind, path, { query:{ term } });
                const items = parseJSONResponse(response);
                if (Array.isArray(items) && items.length) return items[0];
            }
            throw new Error('No matching title found');
        },
        async _add(kind, imdbId, title) {
            const cfg = getServarrConfig(kind);
            const item = await this._lookup(kind, imdbId, title);
            if (kind === 'radarr') {
                const body = {
                    ...item,
                    monitored: true,
                    qualityProfileId: cfg.qualityProfileId,
                    rootFolderPath: cfg.rootFolderPath,
                    minimumAvailability: item.minimumAvailability || 'released',
                    addOptions: { ...(item.addOptions || {}), searchForMovie: true },
                };
                await servarrRequest('radarr', 'movie', { method:'POST', body });
                return;
            }

            const seasons = Array.isArray(item.seasons)
                ? item.seasons.map(season => ({ ...season, monitored: true }))
                : [];
            const body = {
                ...item,
                monitored: true,
                seasonFolder: true,
                qualityProfileId: cfg.qualityProfileId,
                languageProfileId: cfg.languageProfileId,
                rootFolderPath: cfg.rootFolderPath,
                seasons,
                addOptions: {
                    ...(item.addOptions || {}),
                    monitor: 'all',
                    searchForMissingEpisodes: true,
                },
            };
            await servarrRequest('sonarr', 'series', { method:'POST', body });
        },
        destroy() {
            removeCSS('enh-servarrIntegration');
            document.getElementById('enh-servarr-actions')?.remove();
            pruneTitleStack();
        }
    });

    reg({
        key: 'mediaServerIntegration', name: 'Plex/Jellyfin/Emby indicator', group: 'Features',
        init() {
            if (!window.location.hostname.includes('imdb.com')) return;
            waitForTitleSurface().then(() => {
                if (document.getElementById('enh-media-server-status')) return;
                const imdbId = getIMDbID(), title = getTitleText(), year = getTitleYear();
                if (!imdbId || !title) return;

                const servers = getConfiguredMediaServers();
                if (!servers.length) return;

                const t = getTheme();
                addCSS(`
                    #enh-media-server-status {
                        margin-top: 8px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
                    }
                    .enh-media-server-label {
                        font: 700 10px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        letter-spacing: .08em; color: ${t.tx3};
                    }
                    .enh-media-server-pill {
                        min-height: 28px; display: inline-flex; align-items: center; gap: 6px;
                        border: 1px solid ${t.bd1}; border-radius: 7px; background: ${t.sf1};
                        color: ${t.tx2}; padding: 0 10px;
                        font: 700 11px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    }
                    .enh-media-server-pill__dot {
                        width: 8px; height: 8px; border-radius: 50%; background: ${t.tx3};
                    }
                    .enh-media-server-pill--found { color: ${t.green}; border-color: rgba(34,197,94,.35); background: rgba(34,197,94,.08); }
                    .enh-media-server-pill--found .enh-media-server-pill__dot { background: ${t.green}; box-shadow: 0 0 6px ${t.green}; }
                    .enh-media-server-pill--missing { color: ${t.tx3}; }
                    .enh-media-server-pill--error { color: ${t.red}; border-color: rgba(239,68,68,.35); background: rgba(239,68,68,.08); }
                    .enh-media-server-pill--error .enh-media-server-pill__dot { background: ${t.red}; }
                `, 'enh-mediaServerIntegration');

                const ctx = { imdbId, title, year };
                const bar = makeEl('div', { id:'enh-media-server-status' },
                    makeEl('div', { className:'enh-media-server-label' }, 'MEDIA SERVER')
                );
                servers.forEach(server => {
                    const state = makeEl('span', { className:'enh-media-server-pill__state' }, 'Checking');
                    const pill = makeEl('span', {
                        className:'enh-media-server-pill',
                        title:`Checking ${server.label} for ${title}`,
                    },
                        makeEl('span', { className:'enh-media-server-pill__dot' }),
                        makeEl('span', {}, server.label),
                        state
                    );
                    bar.appendChild(pill);
                    this._check(server, ctx).then(found => {
                        pill.classList.add(found ? 'enh-media-server-pill--found' : 'enh-media-server-pill--missing');
                        state.textContent = found ? 'In Library' : 'Not found';
                        pill.title = `${server.label}: ${found ? 'already in library' : 'not found'}`;
                    }).catch(error => {
                        pill.classList.add('enh-media-server-pill--error');
                        state.textContent = 'Unavailable';
                        pill.title = `${server.label}: ${getRequestErrorMessage(error)}`;
                    });
                });
                appendTitleStackItem(bar, TITLE_STACK_ORDER.mediaServerIntegration);
            }).catch(() => {});
        },
        async _check(server, ctx) {
            if (server.kind === 'plex') return this._checkPlex(server, ctx);
            return this._checkJellyfinEmby(server, ctx);
        },
        async _checkPlex(server, ctx) {
            const queries = [
                { query: ctx.imdbId, includeGuids:'1' },
                { query: ctx.title, includeGuids:'1' },
            ];
            for (const query of queries) {
                const response = await mediaServerRequest(server, '/library/search', { query });
                if (parsePlexItems(response.responseText).some(item => mediaItemMatches(item, ctx))) return true;
            }
            return false;
        },
        async _checkJellyfinEmby(server, ctx) {
            const common = {
                Recursive:'true',
                IncludeItemTypes:'Movie,Series',
                Fields:'ProviderIds,ProductionYear',
                Limit:'20',
            };
            const queries = [
                { ...common, AnyProviderIdEquals:`imdb.${ctx.imdbId}` },
                { ...common, SearchTerm:ctx.title },
            ];
            for (const query of queries) {
                const response = await mediaServerRequest(server, '/Items', { query });
                if (parseMediaServerItems(response.responseText).some(item => mediaItemMatches(item, ctx))) return true;
            }
            return false;
        },
        destroy() {
            removeCSS('enh-mediaServerIntegration');
            document.getElementById('enh-media-server-status')?.remove();
            pruneTitleStack();
        }
    });

    // #########################################################################
    //
    //  TV SHOW FEATURES
    //
    // #########################################################################

    reg({
        key: 'tvEpisodeTools', name: 'TV episode tools', group: 'TV',
        _clickHandler: null,
        init() {
            if (!isTVType() && !/\/title\/tt\d+\/episodes/i.test(location.pathname)) return;
            addCSS(`
                .enh-episode-spoiler {
                    filter: blur(5px);
                    cursor: pointer;
                    transition: filter .18s ease, opacity .18s ease;
                }
                .enh-episode-spoiler:hover { opacity: .9; }
                .enh-episode-spoiler.enh-revealed { filter: none; cursor: text; }
                #enh-best-episodes {
                    margin: 14px 0 18px;
                    padding: 14px;
                    border-radius: 10px;
                    border: 1px solid rgba(250,204,21,.2);
                    background: rgba(250,204,21,.07);
                    color: inherit;
                }
                #enh-best-episodes h3 {
                    margin: 0 0 10px;
                    font: 700 14px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                    color: #fde68a;
                }
                .enh-best-episodes-list {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 6px;
                    margin: 0;
                    padding: 0;
                    list-style: none;
                }
                .enh-best-episode {
                    display: grid;
                    grid-template-columns: auto 1fr auto;
                    gap: 8px;
                    align-items: center;
                    padding: 7px 9px;
                    border-radius: 8px;
                    background: rgba(255,255,255,.045);
                    border: 1px solid rgba(255,255,255,.07);
                }
                .enh-best-episode__rank,
                .enh-best-episode__rating {
                    color: #facc15;
                    font: 800 12px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                }
                .enh-best-episode__title {
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    color: inherit;
                    text-decoration: none;
                    font: 600 12px/1.25 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                }
                .enh-best-episode__title:hover { color: #fde68a; }
            `, 'enh-tvEpisodeTools');

            const run = () => {
                const episodes = this._collectEpisodes();
                this._blurPlots(episodes);
                this._renderBestEpisodes(episodes);
            };
            waitFor('main, body').then(run).catch(run);

            this._clickHandler = (e) => {
                const spoiler = e.target.closest?.('.enh-episode-spoiler');
                if (!spoiler) return;
                spoiler.classList.add('enh-revealed');
            };
            document.addEventListener('click', this._clickHandler);
        },
        _collectEpisodes() {
            const seriesId = getIMDbID();
            const seen = new Set();
            const episodes = [];
            const anchors = Array.from(document.querySelectorAll('a[href*="/title/tt"]'));

            anchors.forEach(anchor => {
                const match = anchor.href.match(/\/title\/(tt\d+)\//);
                const id = match?.[1];
                if (!id || id === seriesId || seen.has(id)) return;
                const card = this._findEpisodeCard(anchor);
                if (!card) return;

                const rating = this._parseRating(card);
                const episodeCode = card.textContent.match(/\bS(\d+)\s*\.\s*E(\d+)\b/i)?.[0] || '';
                const title = (anchor.querySelector('.ipc-title__text') || anchor).textContent.trim();
                const plot = this._findPlot(card);

                seen.add(id);
                episodes.push({ id, title, href:anchor.href, rating, episodeCode, plot });
            });

            return episodes;
        },
        _findEpisodeCard(anchor) {
            let node = anchor;
            for (let i = 0; i < 9 && node && node !== document.body; i++) {
                const text = node.textContent || '';
                const hasEpisodeCode = /\bS\d+\s*\.\s*E\d+\b/i.test(text);
                const hasRating = Boolean(node.querySelector?.('.ipc-rating-star--rating, [class*="rating"]'));
                const hasPlot = Boolean(this._findPlot(node));
                if (hasEpisodeCode && (hasRating || hasPlot)) return node;
                node = node.parentElement;
            }
            return anchor.closest('[data-testid*="episode" i], article, li');
        },
        _findPlot(card) {
            return card.querySelector?.('[class*="plot" i] p, [data-testid*="plot" i], .ipc-html-content-inner-div, .ipc-metadata-list-summary-item__plot') || null;
        },
        _parseRating(card) {
            const ratingText = card.querySelector?.('.ipc-rating-star--rating')?.textContent;
            const fromNode = parseFloat(ratingText);
            if (Number.isFinite(fromNode)) return fromNode;
            const text = card.textContent || '';
            const match = text.match(/\b(10(?:\.0)?|[1-9](?:\.\d)?)\s*\/\s*10\b/);
            return match ? parseFloat(match[1]) : null;
        },
        _blurPlots(episodes) {
            const plots = new Set(episodes.map(ep => ep.plot).filter(Boolean));
            if (/\/title\/tt\d+\/episodes/i.test(location.pathname)) {
                document.querySelectorAll('[class*="plot" i] p, [data-testid*="plot" i], .ipc-html-content-inner-div, .ipc-metadata-list-summary-item__plot')
                    .forEach(plot => plots.add(plot));
            }
            plots.forEach(plot => {
                if (!plot.classList.contains('enh-revealed')) {
                    plot.classList.add('enh-episode-spoiler');
                    plot.title = 'Click to reveal episode synopsis';
                }
            });
        },
        _renderBestEpisodes(episodes) {
            document.getElementById('enh-best-episodes')?.remove();
            const ranked = episodes
                .filter(ep => Number.isFinite(ep.rating))
                .sort((a, b) => b.rating - a.rating)
                .slice(0, 10);
            if (ranked.length < 10) return;

            const panel = makeEl('section', { id:'enh-best-episodes', 'aria-label':'Top rated episodes' });
            panel.appendChild(makeEl('h3', {}, 'Top rated episodes'));
            const list = makeEl('ol', { className:'enh-best-episodes-list' });
            ranked.forEach((ep, idx) => {
                list.appendChild(makeEl('li', { className:'enh-best-episode' },
                    makeEl('span', { className:'enh-best-episode__rank' }, String(idx + 1)),
                    makeEl('a', { className:'enh-best-episode__title', href:ep.href }, `${ep.episodeCode ? ep.episodeCode + ' ' : ''}${ep.title}`),
                    makeEl('span', { className:'enh-best-episode__rating' }, ep.rating.toFixed(1))
                ));
            });
            panel.appendChild(list);

            const anchor = getTitleActionAnchor() || document.querySelector('main h1')?.parentElement || document.querySelector('main');
            if (anchor) insertAfter(anchor, panel);
        },
        destroy() {
            removeCSS('enh-tvEpisodeTools');
            if (this._clickHandler) document.removeEventListener('click', this._clickHandler);
            this._clickHandler = null;
            document.querySelectorAll('.enh-episode-spoiler, .enh-revealed').forEach(el => {
                el.classList.remove('enh-episode-spoiler', 'enh-revealed');
                if (el.title === 'Click to reveal episode synopsis') el.removeAttribute('title');
            });
            document.getElementById('enh-best-episodes')?.remove();
        }
    });

    reg({
        key: 'tvShowEnhancements', name: 'TV show quick links', group: 'TV',
        init() {
            if (!isTVType()) return;
            addCSS(`
                #enh-tv-bar{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
                .enh-tv-chip{padding:4px 12px;border-radius:8px;
                    font:600 11px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                    color:#a78bfa;background:rgba(167,139,250,0.08);
                    border:1px solid rgba(167,139,250,0.15);text-decoration:none!important;
                    transition:background .12s ease,border-color .12s ease,color .12s ease,transform .12s ease}
                .enh-tv-chip:hover{background:rgba(167,139,250,0.18);color:#c4b5fd;border-color:rgba(167,139,250,0.3)}
            `, 'enh-tvShow');

            waitForTitleSurface().then(() => {
                if (document.getElementById('enh-tv-bar')) return;
                const imdbId = getIMDbID(), title = getTitleText();
                if (!imdbId) return;
                const bar = makeEl('div', { id: 'enh-tv-bar' });
                [
                    { l:'Episodes List', u:`https://www.imdb.com/title/${imdbId}/episodes/` },
                    { l:'TheTVDB', u:`https://www.thetvdb.com/search?query=tt${imdbId}` },
                    { l:'TVMaze', u:`https://www.tvmaze.com/search?q=${encodeURIComponent(title)}` },
                    { l:'Trakt', u:`https://trakt.tv/search/imdb/${imdbId}?id_type=show` },
                    { l:'Ep Calendar', u:`https://episodecalendar.com/en/shows?q%5Bname_cont%5D=${encodeURIComponent(title)}` },
                ].forEach(c => bar.appendChild(makeEl('a', { href:c.u, target:'_blank', rel:'noopener', className:'enh-tv-chip' }, c.l)));

                appendTitleStackItem(bar, TITLE_STACK_ORDER.tvShowEnhancements);
            }).catch(() => {});
        },
        destroy() { removeCSS('enh-tvShow'); document.getElementById('enh-tv-bar')?.remove(); pruneTitleStack(); }
    });

    reg({
        key: 'subtitleLinks', name: 'Subtitle links', group: 'TV',
        init() {
            const imdbId = getIMDbID(), title = getTitleText();
            if (!imdbId) return;
            waitFor('section[data-testid="Details"]').then(sec => {
                if (document.getElementById('enh-sub-row')) return;
                const row = makeEl('div', { id:'enh-sub-row', style: { marginTop:'12px', display:'flex', flexWrap:'wrap', gap:'6px', alignItems:'center' } });
                row.appendChild(makeEl('span', { style: { color:'#71717a', fontSize:'12px', fontWeight:'600', marginRight:'4px' } }, 'Subtitles:'));
                [
                    { n:'OpenSubtitles', u:`https://www.opensubtitles.org/en/search/imdbid-${imdbId}` },
                    { n:'OpenSubs.com', u:`https://www.opensubtitles.com/en/en/search-all/q-tt${imdbId}` },
                    { n:'SubDL', u:`https://subdl.com/search/${encodeURIComponent(title)}` },
                    { n:'YIFY-Subs', u:`https://yifysubtitles.ch/movie-imdb/${imdbId}`, movieOnly:true },
                    { n:'Addic7ed', u:`https://www.addic7ed.com/search.php?search=${encodeURIComponent(title)}&Submit=Search` },
                ].filter(s => !(s.movieOnly && isTVType())).forEach(s => row.appendChild(makeEl('a', {
                    href:s.u, target:'_blank', rel:'noopener', className:'enh-ext-link', style:{ '--link-color':'#22d3ee' }
                }, s.n)));
                sec.appendChild(row);
            }).catch(() => {});
        },
        destroy() { document.getElementById('enh-sub-row')?.remove(); }
    });

    // #########################################################################
    //
    //  UTILITY FEATURES
    //
    // #########################################################################

    reg({
        key: 'watchlistBatch', name: 'Watchlist batch ID copy', group: 'Utility',
        init() {
            if (!/\/user\/[^/]+\/watchlist/i.test(location.pathname)) return;
            if (document.getElementById('enh-watchlist-copy')) return;
            const t = getTheme();
            addCSS(`
                #enh-watchlist-copy {
                    position: sticky; top: 72px; z-index: 30;
                    display: inline-flex; align-items: center; justify-content: center;
                    min-height: 34px; margin: 12px 0; padding: 0 14px;
                    border-radius: 8px; border: 1px solid ${t.accentBorder};
                    background: ${t.accentMuted}; color: ${t.accent};
                    font: 800 12px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    cursor: pointer; box-shadow: ${t.sh1};
                }
                #enh-watchlist-copy:hover { background: ${t.sf2}; transform: translateY(-1px); }
            `, 'enh-watchlistBatch');

            const btn = makeEl('button', {
                id:'enh-watchlist-copy',
                type:'button',
                onClick: () => {
                    const ids = this._ids();
                    if (!ids.length) { showToast('No IMDb title IDs found'); return; }
                    GM_setClipboard(ids.join('\n'));
                    showToast(`Copied ${ids.length} IMDb IDs`);
                    btn.textContent = `Copy ${ids.length} IMDb IDs`;
                },
            }, `Copy ${this._ids().length || 'all'} IMDb IDs`);

            const target = document.querySelector('main') || document.body;
            target.insertBefore(btn, target.firstElementChild || null);
        },
        _ids() {
            const ids = Array.from(document.querySelectorAll('a[href*="/title/tt"]'))
                .map(a => a.href.match(/\/title\/(tt\d+)/)?.[1])
                .filter(Boolean);
            return [...new Set(ids)];
        },
        destroy() {
            removeCSS('enh-watchlistBatch');
            document.getElementById('enh-watchlist-copy')?.remove();
        }
    });

    function isListPage() {
        return /\/(watchlist|list\/|chart\/)/i.test(location.pathname);
    }

    function getListTitles() {
        const links = document.querySelectorAll('a[href*="/title/tt"]');
        const seen = new Set();
        const titles = [];
        links.forEach(a => {
            const idMatch = a.href.match(/\/title\/(tt\d+)/);
            if (!idMatch || seen.has(idMatch[1])) return;
            seen.add(idMatch[1]);
            const textEl = a.querySelector('[class*="title"]') || a;
            const name = (textEl.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120);
            if (name) titles.push({ id: idMatch[1], name });
        });
        return titles;
    }

    reg({
        key: 'listMultiSearch', name: 'List multi-search', group: 'Utility',
        init() {
            if (!isListPage()) return;
            if (document.getElementById('enh-multi-search')) return;
            const sites = getSiteList('watchSites', DEFAULT_WATCH_SITES);
            if (!sites.length) return;

            const t = getTheme();
            addCSS(`
                #enh-multi-search {
                    position: sticky; top: 112px; z-index: 29;
                    display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap;
                    margin: 6px 0 12px 0;
                }
                .enh-multi-search-label {
                    font: 700 10px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    letter-spacing: .08em; color: ${t.tx3};
                }
                .enh-multi-search-btn {
                    display: inline-flex; align-items: center; justify-content: center;
                    min-height: 30px; padding: 0 10px; border-radius: 7px;
                    border: 1px solid ${t.bd1}; background: ${t.sf1}; color: ${t.tx1};
                    cursor: pointer; font: 700 11px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    transition: background .15s ease, border-color .15s ease, color .15s ease, transform .15s ease;
                }
                .enh-multi-search-btn:hover { background: ${t.sf2}; border-color: ${t.accentBorder}; color: ${t.accent}; transform: translateY(-1px); }
                .enh-multi-search-btn:disabled { opacity: .5; cursor: wait; }
            `, 'enh-listMultiSearch');

            const bar = makeEl('div', { id:'enh-multi-search' },
                makeEl('span', { className:'enh-multi-search-label' }, 'SEARCH ALL ON')
            );
            sites.forEach(site => {
                const btn = makeEl('button', {
                    type:'button',
                    className:'enh-multi-search-btn',
                    style:{ '--btn-color': site.color },
                    onClick: () => this._searchAll(site, btn),
                }, site.name);
                bar.appendChild(btn);
            });
            const target = document.querySelector('main') || document.body;
            target.insertBefore(bar, target.firstElementChild?.nextSibling || null);
        },
        async _searchAll(site, btn) {
            const titles = getListTitles();
            if (!titles.length) { showToast('No titles found on this page'); return; }
            const max = Math.min(titles.length, 20);
            btn.disabled = true;
            btn.textContent = `Opening 0/${max}...`;
            let opened = 0;
            for (let i = 0; i < max; i++) {
                const title = titles[i];
                const ctx = getLinkContext(title.name, title.id, '');
                const url = site.storeQuery ? getCinebyHost() : applyLinkTemplate(site.url, ctx);
                if (site.storeQuery) GM_setValue(CINEBY_QUERY_KEY, title.name);
                window.open(url, '_blank', 'noopener');
                opened++;
                btn.textContent = `Opening ${opened}/${max}...`;
                if (i < max - 1) await new Promise(r => setTimeout(r, 800));
            }
            btn.textContent = `Opened ${opened} titles`;
            setTimeout(() => { btn.disabled = false; btn.textContent = site.name; }, 3000);
        },
        destroy() {
            removeCSS('enh-listMultiSearch');
            document.getElementById('enh-multi-search')?.remove();
        }
    });

    reg({
        key: 'quickCopyID', name: 'Quick copy IMDb ID', group: 'Utility',
        init() {
            waitForTitleSurface().then(titleEl => {
                if (document.getElementById('enh-copy-id')) return;
                const imdbId = getIMDbID();
                if (!imdbId) return;
                const btn = makeEl('button', {
                    id:'enh-copy-id', className:'enh-action-btn', type:'button',
                    title:`Copy ${imdbId}`, 'aria-label': `Copy IMDb ID ${imdbId}`,
                    innerHTML: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>${imdbId}</span>`,
                    onClick: () => { GM_setClipboard(imdbId); showToast(`Copied ${imdbId}`); }
                });
                appendTitleStackItem(btn, TITLE_STACK_ORDER.quickCopyID);
            }).catch(() => {});
        },
        destroy() { document.getElementById('enh-copy-id')?.remove(); pruneTitleStack(); }
    });

    reg({
        key: 'keyboardShortcuts', name: 'Optional keyboard shortcuts', group: 'Utility',
        _h: null,
        init() {
            this._h = (e) => {
                if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName) || e.target.isContentEditable) return;
                if (e.key === '?') { e.preventDefault(); toggleSettings(); }
                else if (e.key === 'c' && !e.ctrlKey && !e.metaKey) { const id = getIMDbID(); if (id) { GM_setClipboard(id); showToast(`Copied ${id}`); } }
                else if (e.key === 'r') { document.querySelector('[data-testid="hero-rating-bar__aggregate-rating"]')?.scrollIntoView({behavior:'smooth',block:'center'}); }
                else if (e.key === 't') { window.scrollTo({top:0,behavior:'smooth'}); }
                else if (e.key === 'Escape') { const o = document.getElementById('enh-settings-overlay'); if (o?.classList.contains('enh-visible')) toggleSettings(); }
            };
            document.addEventListener('keydown', this._h);
        },
        destroy() { if (this._h) document.removeEventListener('keydown', this._h); }
    });

    // #########################################################################
    //
    //  GLOBAL STYLES
    //
    // #########################################################################
    function injectGlobalStyles() {
        const t = getTheme();
        addCSS(`
/* ════ Toast ════ */
#enh-toast {
    position: fixed; bottom: 24px; right: 24px;
    background: ${t.sf1}; color: ${t.tx0};
    padding: 10px 20px; border-radius: 10px; z-index: 2147483647;
    font: 600 13px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    box-shadow: ${t.sh3};
    border: 1px solid ${t.bd1};
    transform: translateY(20px); opacity: 0;
    transition: transform .3s cubic-bezier(.4,0,.2,1), opacity .3s ease;
    pointer-events: none;
}
#enh-toast.visible { transform: translateY(0); opacity: 1; }

/* ════ Stream Panel ════ */
#enh-title-stack {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    margin: 12px 0 14px;
    max-width: min(100%, 920px);
}
#enh-title-stack > * { width: 100%; }
#enh-title-stack #enh-copy-id {
    width: auto;
    margin: 0;
}
#enh-title-stack #enh-search-buttons,
#enh-title-stack #enh-external-links,
#enh-title-stack #enh-tv-bar {
    margin: 0;
}

#enh-search-buttons {
    margin: 12px 0 8px;
    padding: 10px 12px 11px;
    background: ${t.sf0};
    border: 1px solid ${t.accentBorder};
    border-radius: 10px;
    box-shadow: ${t.sh1};
}
.enh-stream-label {
    display: flex; align-items: center; gap: 6px;
    font: 700 9px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    text-transform: uppercase; letter-spacing: 0.14em;
    color: ${t.tx2};
    margin: 0 0 8px 2px;
}
.enh-stream-label__dot {
    color: ${t.accent}; font-size: 10px; line-height: 1;
}
.enh-search-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(112px, 1fr));
    gap: 6px;
}
.enh-search-btn {
    display: flex; align-items: center; justify-content: center;
    min-height: 38px;
    padding: 8px 8px;
    background: color-mix(in srgb, var(--btn-color) 14%, ${t.sf1});
    border: 1px solid color-mix(in srgb, var(--btn-color) 24%, transparent);
    border-radius: 8px;
    color: color-mix(in srgb, var(--btn-color) 88%, #fff);
    font: 600 12px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    cursor: pointer; transition: background .18s cubic-bezier(.4,0,.2,1), border-color .18s ease, color .18s ease, transform .18s cubic-bezier(.4,0,.2,1), box-shadow .18s ease; outline: none;
    text-decoration: none !important;
    text-align: center; white-space: nowrap; min-width: 0;
}
.enh-search-btn:hover {
    background: color-mix(in srgb, var(--btn-color) 26%, ${t.sf1});
    border-color: color-mix(in srgb, var(--btn-color) 48%, transparent);
    transform: translateY(-2px);
    box-shadow: 0 4px 14px color-mix(in srgb, var(--btn-color) 22%, transparent);
}
.enh-search-btn:active { transform: translateY(0); }
.enh-search-btn--dead {
    opacity: .35; text-decoration: line-through; pointer-events: auto;
    filter: grayscale(.6);
}
.enh-search-btn--dead::after {
    content: ' (offline)'; font-size: 10px; opacity: .7; margin-left: 3px;
}

/* ════ External Links ════ */
#enh-external-links {
    display: flex; flex-wrap: wrap; align-items: center; gap: 5px;
    margin: 6px 0 4px;
}
.enh-ext-link {
    padding: 4px 11px; border-radius: 6px;
    font: 500 11px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: color-mix(in srgb, var(--link-color) 78%, ${t.tx1}) !important;
    background: color-mix(in srgb, var(--link-color) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--link-color) 14%, transparent);
    text-decoration: none !important;
    transition: background .15s ease, border-color .15s ease, color .15s ease, transform .15s cubic-bezier(.4,0,.2,1);
}
.enh-ext-link:hover {
    background: color-mix(in srgb, var(--link-color) 20%, transparent);
    border-color: color-mix(in srgb, var(--link-color) 32%, transparent);
    color: #fff !important;
    transform: translateY(-1px);
}

/* ════ More Links trigger (lives in external-links row) ════ */
#enh-link-menu-wrap { position: relative; display: inline-flex; margin-left: auto; }
#enh-link-menu-trigger {
    padding: 4px 11px; border-radius: 6px;
    font: 600 11px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: ${t.tx1};
    background: ${t.sf1};
    border: 1px solid ${t.bd1};
    cursor: pointer;
    transition: background .15s ease, border-color .15s ease, color .15s ease, transform .15s cubic-bezier(.4,0,.2,1);
}
#enh-link-menu-trigger:hover {
    background: ${t.accentMuted};
    border-color: ${t.accentBorder};
    color: ${t.accent};
    transform: translateY(-1px);
}
#enh-link-menu-wrap .enh-link-dropdown { left: auto; right: 0; }

/* ════ Expanded Link Dropdown ════ */
.enh-link-dropdown {
    position: absolute; top: calc(100% + 8px); left: 0; min-width: 340px;
    background: ${t.sf1}; border: 1px solid ${t.bd1};
    border-radius: 12px; padding: 14px 16px; z-index: 100000;
    box-shadow: ${t.sh3}; display: none;
}
.enh-link-dropdown.enh-visible { display: block; }
.enh-link-dropdown__cat {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .08em; color: ${t.tx3}; padding: 10px 0 4px;
    border-top: 1px solid ${t.bd0}; margin-top: 4px;
}
.enh-link-dropdown__cat:first-child { border-top: none; margin-top: 0; }
.enh-link-dropdown__row { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 4px; }
.enh-link-dropdown__item {
    padding: 4px 10px; border-radius: 6px;
    font: 500 11px/1.5 -apple-system, sans-serif;
    color: ${t.tx2} !important;
    background: ${t.sf0}; border: 1px solid ${t.bd0};
    text-decoration: none !important;
    transition: background .15s ease, border-color .15s ease, color .15s ease, transform .15s cubic-bezier(.4,0,.2,1);
}
.enh-link-dropdown__item:hover {
    background: ${t.accentMuted}; border-color: ${t.accentBorder};
    color: ${t.accent} !important; transform: translateY(-1px);
}

/* ════ Copy ID ════ */
#enh-copy-id {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 10px; margin-left: 10px;
    background: ${t.sf1}; border: 1px solid ${t.bd1};
    border-radius: 6px; cursor: pointer; color: ${t.tx2};
    font: 500 12px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    transition: background .15s ease, border-color .15s ease, color .15s ease; vertical-align: middle;
}
#enh-copy-id:hover {
    background: ${t.accentMuted}; border-color: ${t.accentBorder};
    color: ${t.accent};
}
#enh-copy-id svg { flex-shrink: 0; }

/* ════ Score Widgets ════ */
.enh-score-widget {
    display: inline-flex; flex-direction: column; align-items: center;
    padding: 8px 16px; min-width: 80px;
}
.enh-score-widget--availability {
    min-width: 132px; max-width: 220px;
}
.enh-score-widget__label {
    font-size: 10px; font-weight: 600; letter-spacing: .05em;
    color: ${t.tx2}; margin-bottom: 4px; text-transform: uppercase;
}
.enh-score-widget__score {
    display: flex; align-items: center; gap: 4px; text-decoration: none !important;
    color: var(--score-color) !important; font-size: 20px; font-weight: 800;
    transition: transform .15s cubic-bezier(.4,0,.2,1), opacity .15s ease;
}
.enh-score-widget__score:hover { transform: translateY(-1px); }
.enh-score-widget__score--availability {
    justify-content: center; max-width: 100%;
}
.enh-score-widget__icon { font-size: 18px; }
.enh-score-widget__value { color: var(--score-color); }
.enh-score-widget__value--availability {
    max-width: 150px; white-space: normal; text-align: left;
    font-size: 12px; line-height: 1.25;
}
.enh-score-widget__badge {
    display: inline-block; padding: 2px 10px; border-radius: 6px;
    font-size: 18px; font-weight: 800; min-width: 36px; text-align: center;
}
.enh-score-widget__badge--outline {
    border: 1px solid currentColor;
    background: color-mix(in srgb, currentColor 10%, transparent);
    font-size: 11px;
    line-height: 1.4;
    min-width: 24px;
    padding: 2px 7px;
}
.enh-score-widget__sub { font-size: 10px; color: ${t.tx3}; margin-top: 2px; }
.enh-score-widget--muted { opacity: .82; }
.enh-score-widget__skeleton {
    width: 58px; height: 24px; border-radius: 6px;
    background: linear-gradient(90deg, ${t.sf1}, ${t.sf2}, ${t.sf1});
    background-size: 180% 100%;
    animation: enh-shimmer 1.1s ease-in-out infinite;
}
@keyframes enh-shimmer {
    0% { background-position: 120% 0; }
    100% { background-position: -120% 0; }
}
.enh-histogram-chart {
    display: flex; align-items: flex-end; gap: 2px; height: 36px; min-width: 80px;
}
.enh-histogram-col {
    flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%;
    justify-content: flex-end; cursor: default;
}
.enh-histogram-bar {
    width: 100%; min-width: 5px; border-radius: 2px 2px 0 0;
    background: ${t.accent}; opacity: .7;
    transition: opacity .15s ease;
}
.enh-histogram-col:hover .enh-histogram-bar { opacity: 1; }
.enh-histogram-label {
    font: 600 8px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: ${t.tx3}; margin-top: 2px;
}

/* ════ Settings Overlay ════ */
#enh-settings-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.78);
    z-index: 2147483640; opacity: 0;
    transition: opacity .3s ease; pointer-events: none;
}
#enh-settings-overlay.enh-visible { opacity: 1; pointer-events: auto; }

/* ════ Settings Panel ════ */
#enh-settings-panel {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%) scale(0.96);
    background: ${t.sf0}; color: ${t.tx1};
    border: 1px solid ${t.bd1};
    border-radius: 12px; z-index: 2147483641;
    width: min(560px, calc(100vw - 32px)); max-height: min(82vh, 760px);
    box-shadow: ${t.sh3};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    opacity: 0;
    transition: transform .3s cubic-bezier(.4,0,.2,1), opacity .25s ease;
    overflow: hidden; display: flex; flex-direction: column;
}
#enh-settings-overlay.enh-visible #enh-settings-panel {
    transform: translate(-50%, -50%) scale(1); opacity: 1;
}
.enh-settings-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 18px 24px 14px;
    border-bottom: 1px solid ${t.bd0}; flex-shrink: 0;
}
.enh-settings-header h2 {
    font-size: 16px; font-weight: 700; margin: 0;
    color: ${t.accent}; letter-spacing: -0.02em;
}
.enh-settings-subtitle {
    margin: 4px 0 0;
    color: ${t.tx2};
    font-size: 12px;
    line-height: 1.45;
}
.enh-settings-close {
    background: ${t.sf1}; border: 1px solid ${t.bd0};
    width: 32px; height: 32px; border-radius: 8px;
    color: ${t.tx2}; cursor: pointer; font-size: 18px;
    display: flex; align-items: center; justify-content: center;
    transition: background .15s ease, border-color .15s ease, color .15s ease;
}
.enh-settings-close:hover { background: ${t.sf2}; color: ${t.tx0}; }

.enh-settings-body { padding: 8px 24px 20px; overflow-y: auto; flex: 1; }

.enh-settings-group-label {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .08em; color: ${t.tx3};
    padding: 16px 0 6px;
}
.enh-settings-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 0; gap: 12px;
    border-bottom: 1px solid ${t.bd0};
}
.enh-settings-row:last-child { border-bottom: none; }
.enh-settings-label { font-size: 13px; font-weight: 500; color: ${t.tx1}; }
.enh-settings-row-copy { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.enh-settings-help { font-size: 11px; line-height: 1.35; color: ${t.tx3}; max-width: 360px; }

/* Toggle switch */
.enh-toggle { position: relative; width: 40px; height: 22px; flex-shrink: 0; }
.enh-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
.enh-toggle-track {
    position: absolute; inset: 0;
    background: ${t.sf2}; border-radius: 8px;
    transition: background .2s ease; cursor: pointer;
}
.enh-toggle-track::after {
    content: ''; position: absolute; top: 2px; left: 2px;
    width: 18px; height: 18px;
    background: ${t.tx3}; border-radius: 50%;
    transition: transform .2s cubic-bezier(.4,0,.2,1), background .2s ease;
}
.enh-toggle input:checked + .enh-toggle-track { background: ${t.accentMuted}; }
.enh-toggle input:checked + .enh-toggle-track::after {
    transform: translateX(18px); background: ${t.accent};
}
.enh-toggle input:focus-visible + .enh-toggle-track {
    outline: 2px solid ${t.accent};
    outline-offset: 2px;
}

/* ════ Theme Swatches ════ */
.enh-theme-selector { display: flex; gap: 8px; }
.enh-theme-swatch {
    width: 30px; height: 30px; border-radius: 8px; cursor: pointer;
    border: 2px solid transparent;
    padding: 0;
    appearance: none;
    transition: border-color .15s ease, box-shadow .15s ease, transform .15s cubic-bezier(.4,0,.2,1); position: relative;
    box-shadow: inset 0 0 0 1px ${t.bd1};
}
.enh-theme-swatch.active { border-color: ${t.accent}; box-shadow: 0 0 12px ${t.accentMuted}; }
.enh-theme-swatch:hover { transform: translateY(-1px); }
.enh-theme-swatch::after {
    content: attr(data-label); position: absolute; bottom: calc(100% + 6px); left: 50%;
    transform: translateX(-50%); font-size: 9px; font-weight: 600;
    color: ${t.tx2}; white-space: nowrap;
    opacity: 0; transition: opacity .12s ease; pointer-events: none;
}
.enh-theme-swatch:hover::after { opacity: 1; }

/* ════ Settings Footer ════ */
.enh-settings-footer {
    padding: 12px 24px; border-top: 1px solid ${t.bd0};
    display: flex; justify-content: space-between; align-items: center;
    flex-shrink: 0; gap: 8px;
}
.enh-settings-footer span { font-size: 11px; color: ${t.tx3}; }
.enh-settings-footer-actions { display: flex; gap: 6px; }
.enh-settings-footer-btn {
    padding: 5px 14px; border-radius: 6px;
    font: 500 11px -apple-system, sans-serif;
    background: ${t.sf1}; border: 1px solid ${t.bd1};
    color: ${t.tx2}; cursor: pointer;
    transition: background .15s ease, border-color .15s ease, color .15s ease, transform .15s cubic-bezier(.4,0,.2,1);
}
.enh-settings-footer-btn:hover { background: ${t.sf2}; color: ${t.tx0}; border-color: ${t.bd2}; }
.enh-settings-footer-note { text-align: right; max-width: 160px; line-height: 1.35; }
.enh-import-panel {
    margin: 14px 0 4px;
    padding: 12px;
    border: 1px solid ${t.bd1};
    border-radius: 10px;
    background: ${t.sf1};
}
.enh-import-label {
    display: block;
    margin-bottom: 8px;
    color: ${t.tx1};
    font: 600 12px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.enh-import-textarea {
    width: 100%;
    min-height: 116px;
    resize: vertical;
    border-radius: 8px;
    border: 1px solid ${t.bd1};
    background: ${t.bg};
    color: ${t.tx1};
    padding: 10px;
    font: 500 12px/1.45 ui-monospace, SFMono-Regular, Consolas, monospace;
    outline: none;
}
.enh-import-textarea:focus { border-color: ${t.accentBorder}; box-shadow: 0 0 0 2px ${t.accentMuted}; }
.enh-import-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }

/* ════ Site Editors ════ */
.enh-site-editor {
    margin: 14px 0 4px;
    padding: 12px;
    border: 1px solid ${t.bd1};
    border-radius: 10px;
    background: ${t.sf1};
}
.enh-site-editor__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
}
.enh-site-editor__title {
    color: ${t.tx1};
    font: 700 12px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.enh-site-editor__actions { display: flex; gap: 6px; flex-shrink: 0; }
.enh-site-editor__rows { display: flex; flex-direction: column; gap: 7px; }
.enh-site-row {
    display: grid;
    grid-template-columns: minmax(88px, .7fr) minmax(160px, 1.4fr) 34px 30px;
    gap: 6px;
    align-items: center;
}
.enh-site-input {
    min-width: 0;
    height: 30px;
    border-radius: 7px;
    border: 1px solid ${t.bd1};
    background: ${t.bg};
    color: ${t.tx1};
    padding: 0 8px;
    font: 500 11px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    outline: none;
}
.enh-site-color {
    width: 34px;
    height: 30px;
    border: 1px solid ${t.bd1};
    border-radius: 7px;
    background: ${t.bg};
    padding: 2px;
    cursor: pointer;
}
.enh-site-remove {
    width: 30px;
    height: 30px;
    border-radius: 7px;
    border: 1px solid ${t.bd1};
    background: ${t.sf0};
    color: ${t.tx2};
    cursor: pointer;
    font: 700 15px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.enh-site-remove:hover { background: ${t.sf2}; color: ${t.tx0}; }
.enh-site-input:focus,
.enh-site-color:focus {
    border-color: ${t.accentBorder};
    box-shadow: 0 0 0 2px ${t.accentMuted};
}

/* ════ Mark Review Panel ════ */
.enh-marks-panel {
    margin: 14px 0 4px;
    padding: 12px;
    border: 1px solid ${t.bd1};
    border-radius: 10px;
    background: ${t.sf1};
}
.enh-marks-panel__header {
    display: flex; justify-content: space-between; align-items: center;
    gap: 10px; margin-bottom: 10px;
}
.enh-marks-panel__title { color: ${t.tx1}; font: 700 12px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
.enh-marks-panel__count { color: ${t.tx3}; font: 600 11px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
.enh-marks-panel__rows { display: flex; flex-direction: column; gap: 6px; max-height: 220px; overflow: auto; }
.enh-mark-row {
    display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto;
    gap: 6px; align-items: center;
    padding: 7px; border: 1px solid ${t.bd0}; border-radius: 8px;
    background: ${t.sf0};
}
.enh-mark-row__title { min-width: 0; color: ${t.tx1}; font: 600 11px/1.25 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.enh-mark-row__id { color: ${t.tx3}; font-weight: 500; margin-left: 4px; }
.enh-mark-row__state {
    padding: 3px 7px; border-radius: 999px;
    background: ${t.accentMuted}; color: ${t.accent};
    font: 800 10px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    text-transform: uppercase; letter-spacing: .04em;
}
.enh-mark-row__state--skip { background: ${t.redMuted}; color: ${t.red}; }
.enh-mark-row__link {
    color: ${t.blue} !important; text-decoration: none !important;
    font: 700 11px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.enh-mark-row__clear {
    width: 26px; height: 26px; border-radius: 7px;
    border: 1px solid ${t.bd1}; background: ${t.sf1}; color: ${t.tx2};
    cursor: pointer; font: 800 13px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.enh-mark-row__clear:hover { border-color: ${t.red}; color: ${t.red}; }
.enh-marks-empty { color: ${t.tx3}; font: 500 11px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

/* ════ Servarr Settings ════ */
.enh-servarr-panel {
    margin: 14px 0 4px;
    padding: 12px;
    border: 1px solid ${t.bd1};
    border-radius: 10px;
    background: ${t.sf1};
}
.enh-servarr-section + .enh-servarr-section { margin-top: 14px; padding-top: 14px; border-top: 1px solid ${t.bd0}; }
.enh-servarr-title { color: ${t.tx1}; font: 700 12px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin-bottom: 8px; }
.enh-servarr-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.enh-servarr-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.enh-servarr-field--wide { grid-column: 1 / -1; }
.enh-servarr-field label { color: ${t.tx2}; font: 700 10px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; text-transform: uppercase; letter-spacing: .04em; }
.enh-servarr-input {
    min-width: 0; height: 30px; border-radius: 7px;
    border: 1px solid ${t.bd1}; background: ${t.bg}; color: ${t.tx1};
    padding: 0 8px; font: 500 11px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    outline: none;
}
.enh-servarr-input:focus { border-color: ${t.accentBorder}; box-shadow: 0 0 0 2px ${t.accentMuted}; }
.enh-servarr-note { margin-top: 10px; color: ${t.tx3}; font: 500 11px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

/* ════ FAB ════ */
#enh-settings-fab {
    position: fixed; bottom: 20px; left: 20px;
    width: 44px; height: 44px;
    background: ${t.sf1}; border: 1px solid ${t.bd1};
    border-radius: 12px; cursor: pointer; z-index: 2147483630;
    display: flex; align-items: center; justify-content: center;
    color: ${t.tx2};
    box-shadow: ${t.sh2};
    transition: background .2s ease, border-color .2s ease, color .2s ease, transform .2s cubic-bezier(.4,0,.2,1), box-shadow .2s ease;
}
#enh-settings-fab:hover {
    background: ${t.sf2}; border-color: ${t.accentBorder};
    color: ${t.accent}; transform: translateY(-2px);
    box-shadow: ${t.sh3};
}
.enh-search-btn:focus-visible,
.enh-ext-link:focus-visible,
#enh-trailer-btn:focus-visible,
.enh-trailer-close:focus-visible,
#enh-watchlist-copy:focus-visible,
#enh-link-menu-trigger:focus-visible,
.enh-link-dropdown__item:focus-visible,
#enh-copy-id:focus-visible,
.enh-mark-btn:focus-visible,
.enh-mark-row__clear:focus-visible,
.enh-site-remove:focus-visible,
.enh-servarr-input:focus-visible,
.enh-settings-footer-btn:focus-visible,
.enh-settings-close:focus-visible,
.enh-theme-swatch:focus-visible,
#enh-settings-fab:focus-visible {
    outline: 2px solid ${t.accent};
    outline-offset: 2px;
}
@media (max-width: 640px) {
    #enh-search-buttons { padding: 10px; }
    .enh-search-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    #enh-external-links { gap: 6px; }
    #enh-link-menu-wrap { margin-left: 0; width: 100%; }
    #enh-link-menu-trigger { width: 100%; text-align: center; }
    .enh-link-dropdown {
        position: fixed;
        left: 16px !important;
        right: 16px !important;
        top: auto;
        bottom: 76px;
        min-width: 0;
        max-height: 58vh;
        overflow: auto;
    }
    .enh-settings-header,
    .enh-settings-footer { padding-left: 16px; padding-right: 16px; }
    .enh-settings-body { padding-left: 16px; padding-right: 16px; }
    .enh-settings-footer { align-items: flex-start; flex-direction: column; }
    .enh-settings-footer-note { text-align: left; max-width: none; }
    .enh-site-row { grid-template-columns: 1fr 1fr 34px 30px; }
    .enh-mark-row { grid-template-columns: minmax(0, 1fr) auto auto; }
    .enh-mark-row__link { display: none; }
    .enh-servarr-grid { grid-template-columns: 1fr; }
    .enh-servarr-field--wide { grid-column: auto; }
}
        `, 'enh-global');
    }

    // #########################################################################
    //
    //  SETTINGS PANEL
    //
    // #########################################################################
    let settingsOpen = false;
    let lastFocusedElement = null;

    function getSettingsFocusables(root) {
        if (!root) return [];
        return [...root.querySelectorAll('button, [href], input, textarea, [tabindex]:not([tabindex="-1"])')]
            .filter(el => !el.disabled && el.offsetParent !== null);
    }

    function refreshFeature(key) {
        const feature = features.find(f => f.key === key);
        if (!feature || !get(key)) return;

        const linkMenu = key === 'externalLinks' ? features.find(f => f.key === 'expandedLinkMenu') : null;
        if (linkMenu && get('expandedLinkMenu')) linkMenu.destroy?.();

        try {
            feature.destroy?.();
            feature.init();
            if (linkMenu && get('expandedLinkMenu')) linkMenu.init();
        } catch (e) {
            console.warn(`[IMDb Enhanced] refresh ${key}:`, e);
        }
    }

    function createSiteEditor({ title, key, defaults, featureKey }) {
        const editor = makeEl('div', { className:'enh-site-editor' });
        const rows = makeEl('div', { className:'enh-site-editor__rows' });

        const readRows = () => Array.from(rows.querySelectorAll('.enh-site-row')).map(row => ({
            name: row.querySelector('[data-field="name"]')?.value || '',
            url: row.querySelector('[data-field="url"]')?.value || '',
            color: row.querySelector('[data-field="color"]')?.value || '#6366f1',
            storeQuery: row.dataset.storeQuery === 'true',
        }));

        const save = () => {
            setSiteList(key, readRows());
            refreshFeature(featureKey);
        };

        const addRow = (site = {}) => {
            const row = makeEl('div', {
                className:'enh-site-row',
                dataset:{ storeQuery:String(Boolean(site.storeQuery)) },
            });
            const nameInput = makeEl('input', {
                type:'text',
                className:'enh-site-input',
                dataset:{ field:'name' },
                'aria-label': `${title} site name`,
            });
            nameInput.value = site.name || 'New site';

            const urlInput = makeEl('input', {
                type:'url',
                className:'enh-site-input',
                dataset:{ field:'url' },
                'aria-label': `${title} URL template`,
            });
            urlInput.value = site.url || 'https://example.com/search?q={{TITLE}}';

            const colorInput = makeEl('input', {
                type:'color',
                className:'enh-site-color',
                dataset:{ field:'color' },
                'aria-label': `${title} color`,
            });
            colorInput.value = normalizeColor(site.color);

            const remove = makeEl('button', {
                type:'button',
                className:'enh-site-remove',
                title:'Remove site',
                'aria-label':'Remove site',
                onClick: () => { row.remove(); save(); },
            }, 'x');

            [nameInput, urlInput, colorInput].forEach(input => input.addEventListener('change', save));
            row.appendChild(nameInput);
            row.appendChild(urlInput);
            row.appendChild(colorInput);
            row.appendChild(remove);
            rows.appendChild(row);
        };

        const add = makeEl('button', {
            type:'button',
            className:'enh-settings-footer-btn',
            onClick: () => { addRow(); save(); },
        }, 'Add');
        const reset = makeEl('button', {
            type:'button',
            className:'enh-settings-footer-btn',
            onClick: () => {
                rows.replaceChildren();
                defaults.forEach(site => addRow(site));
                save();
                showToast(`${title} reset to defaults`);
            },
        }, 'Reset');

        editor.appendChild(makeEl('div', { className:'enh-site-editor__header' },
            makeEl('div', { className:'enh-site-editor__title' }, title),
            makeEl('div', { className:'enh-site-editor__actions' }, add, reset)
        ));

        getSiteList(key, defaults).forEach(site => addRow(site));
        editor.appendChild(rows);
        return editor;
    }

    function createSettingsInput({ key, label, type = 'text', wide = false, placeholder = '', refreshKey = 'servarrIntegration' }) {
        const id = `enh-setting-${key}`;
        const input = makeEl('input', {
            id,
            name:key,
            type,
            className:'enh-servarr-input',
            placeholder,
            autocomplete: type === 'password' ? 'new-password' : 'off',
            spellcheck:'false',
        });
        input.value = get(key) || '';
        input.addEventListener('change', () => {
            set(key, input.value.trim());
            if (refreshKey) refreshFeature(refreshKey);
        });
        return makeEl('div', { className:'enh-servarr-field' + (wide ? ' enh-servarr-field--wide' : '') },
            makeEl('label', { for:id }, label),
            input
        );
    }

    function createCinebySettingsPanel() {
        const select = makeEl('select', {
            id:'enh-cineby-host',
            className:'enh-servarr-input',
            'aria-label':'Preferred Cineby host',
            onChange: () => {
                set('cinebyHost', select.value);
                refreshFeature('searchButtons');
            },
        });
        CINEBY_HOSTS.forEach(host => {
            const option = makeEl('option', { value:host.url }, host.label);
            option.selected = host.url === getCinebyHost();
            select.appendChild(option);
        });
        return makeEl('div', { className:'enh-servarr-panel' },
            makeEl('div', { className:'enh-servarr-section' },
                makeEl('div', { className:'enh-servarr-title' }, 'Cineby'),
                makeEl('div', { className:'enh-servarr-field enh-servarr-field--wide' },
                    makeEl('label', { for:'enh-cineby-host' }, 'Preferred host'),
                    select
                ),
                makeEl('div', { className:'enh-servarr-note' },
                    `Search handoff uses the local ${CINEBY_QUERY_KEY} storage key and clears it after auto-fill.`
                )
            )
        );
    }

    function createServarrSettingsPanel() {
        const section = ({ title, fields }) => {
            const grid = makeEl('div', { className:'enh-servarr-grid' }, ...fields.map(createSettingsInput));
            return makeEl('div', { className:'enh-servarr-section' },
                makeEl('div', { className:'enh-servarr-title' }, title),
                grid
            );
        };

        const panel = makeEl('form', {
            className:'enh-servarr-panel',
            autocomplete:'off',
        },
            section({
                title:'Radarr',
                fields:[
                    { key:'radarrUrl', label:'URL', wide:true, placeholder:'http://localhost:7878' },
                    { key:'radarrApiKey', label:'API key', type:'password', wide:true },
                    { key:'radarrRootFolderPath', label:'Root folder', wide:true, placeholder:'/movies' },
                    { key:'radarrQualityProfileId', label:'Quality profile ID', type:'number' },
                ],
            }),
            section({
                title:'Sonarr',
                fields:[
                    { key:'sonarrUrl', label:'URL', wide:true, placeholder:'http://localhost:8989' },
                    { key:'sonarrApiKey', label:'API key', type:'password', wide:true },
                    { key:'sonarrRootFolderPath', label:'Root folder', wide:true, placeholder:'/tv' },
                    { key:'sonarrQualityProfileId', label:'Quality profile ID', type:'number' },
                    { key:'sonarrLanguageProfileId', label:'Language profile ID', type:'number' },
                ],
            }),
            makeEl('div', { className:'enh-servarr-note' },
                'API keys are stored locally in plain text. This build allows userscript requests only to localhost and 127.0.0.1.'
            )
        );
        panel.addEventListener('submit', e => e.preventDefault());
        return panel;
    }

    function createMediaServerSettingsPanel() {
        const mediaField = field => createSettingsInput({ ...field, refreshKey:'mediaServerIntegration' });
        const section = ({ title, fields }) => {
            const grid = makeEl('div', { className:'enh-servarr-grid' }, ...fields.map(mediaField));
            return makeEl('div', { className:'enh-servarr-section' },
                makeEl('div', { className:'enh-servarr-title' }, title),
                grid
            );
        };

        const panel = makeEl('form', {
            className:'enh-servarr-panel',
            autocomplete:'off',
        },
            section({
                title:'Plex',
                fields:[
                    { key:'plexUrl', label:'URL', wide:true, placeholder:'http://localhost:32400' },
                    { key:'plexToken', label:'Token', type:'password', wide:true },
                ],
            }),
            section({
                title:'Jellyfin',
                fields:[
                    { key:'jellyfinUrl', label:'URL', wide:true, placeholder:'http://localhost:8096' },
                    { key:'jellyfinApiKey', label:'API key', type:'password', wide:true },
                ],
            }),
            section({
                title:'Emby',
                fields:[
                    { key:'embyUrl', label:'URL', wide:true, placeholder:'http://localhost:8096' },
                    { key:'embyApiKey', label:'API key', type:'password', wide:true },
                ],
            }),
            makeEl('div', { className:'enh-servarr-note' },
                'Media server checks use IMDb provider IDs first, then title and year. This build allows userscript requests only to localhost and 127.0.0.1.'
            )
        );
        panel.addEventListener('submit', e => e.preventDefault());
        return panel;
    }

    function createMarksPanel() {
        const panel = makeEl('div', { className:'enh-marks-panel' });
        const count = makeEl('div', { className:'enh-marks-panel__count' });
        const rows = makeEl('div', { className:'enh-marks-panel__rows' });
        const clearAll = makeEl('button', {
            type:'button',
            className:'enh-settings-footer-btn',
            onClick: () => {
                const entries = getUserMarkEntries();
                if (!entries.length) return;
                setUserMarks({});
                refreshFeature('watchedMarking');
                render();
                showToast(`Cleared ${entries.length} saved title marks`);
            },
        }, 'Clear all');

        const render = () => {
            const entries = getUserMarkEntries();
            count.textContent = `${entries.length} saved`;
            clearAll.disabled = entries.length === 0;
            rows.replaceChildren();
            if (!entries.length) {
                rows.appendChild(makeEl('div', { className:'enh-marks-empty' }, 'No local title marks yet.'));
                return;
            }
            entries.forEach(([id, record]) => {
                const title = record.title || id;
                const state = record.state === 'watched' ? 'Watched' : 'Skip';
                const titleEl = makeEl('div', { className:'enh-mark-row__title', title },
                    title,
                    record.title ? makeEl('span', { className:'enh-mark-row__id' }, id) : ''
                );
                const stateEl = makeEl('div', {
                    className:'enh-mark-row__state' + (record.state === 'skip' ? ' enh-mark-row__state--skip' : ''),
                }, state);
                const open = makeEl('a', {
                    href:`https://www.imdb.com/title/${id}/`,
                    target:'_blank',
                    rel:'noopener',
                    className:'enh-mark-row__link',
                }, 'Open');
                const clear = makeEl('button', {
                    type:'button',
                    className:'enh-mark-row__clear',
                    title:`Clear ${title}`,
                    'aria-label':`Clear mark for ${title}`,
                    onClick: () => {
                        setUserMark(id, '');
                        refreshFeature('watchedMarking');
                        render();
                        showToast('Mark cleared');
                    },
                }, 'x');
                rows.appendChild(makeEl('div', { className:'enh-mark-row' }, titleEl, stateEl, open, clear));
            });
        };

        panel.appendChild(makeEl('div', { className:'enh-marks-panel__header' },
            makeEl('div', { className:'enh-marks-panel__title' }, 'My title marks'),
            makeEl('div', { className:'enh-site-editor__actions' }, count, clearAll)
        ));
        panel.appendChild(rows);
        document.addEventListener('imdb-enhanced:marks-updated', render);
        render();
        return panel;
    }

    function createSettingsPanel() {
        if (document.getElementById('enh-settings-overlay')) return;
        const overlay = makeEl('div', { id: 'enh-settings-overlay', 'aria-hidden':'true' });
        overlay.innerHTML = `<div id="enh-settings-panel">
            <div class="enh-settings-header">
                <div>
                    <h2 id="enh-settings-title">IMDb Enhanced</h2>
                    <p class="enh-settings-subtitle">Cleaner IMDb pages, calmer controls, and local-only preferences.</p>
                </div>
                <button type="button" class="enh-settings-close" title="Close settings" aria-label="Close settings">&times;</button>
            </div>
            <div class="enh-settings-body" id="enh-settings-body"></div>
            <div class="enh-settings-footer">
                <span>Version ${VERSION}</span>
                <div class="enh-settings-footer-actions">
                    <button type="button" class="enh-settings-footer-btn" id="enh-export-btn" title="Copy all settings to clipboard">Export</button>
                    <button type="button" class="enh-settings-footer-btn" id="enh-import-btn" title="Import settings from JSON">Import</button>
                    <button type="button" class="enh-settings-footer-btn" id="enh-clearcache-btn" title="Clear cached third-party lookups">Clear cache</button>
                </div>
                <span class="enh-settings-footer-note">Stored locally in your userscript manager.</span>
            </div>
        </div>`;

        const panel = overlay.querySelector('#enh-settings-panel');
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-labelledby', 'enh-settings-title');
        panel.setAttribute('tabindex', '-1');

        const body = overlay.querySelector('#enh-settings-body');

        // Theme Selector
        body.appendChild(makeEl('div', { className:'enh-settings-group-label' }, 'Theme'));
        const themeRow = makeEl('div', { className:'enh-settings-row' });
        const themeCopy = makeEl('div', { className:'enh-settings-row-copy' },
            makeEl('span', { className:'enh-settings-label' }, 'Theme variant'),
            makeEl('span', { className:'enh-settings-help' }, 'Choose the tonal base for IMDb Enhanced surfaces.')
        );
        themeRow.appendChild(themeCopy);
        const themeSelector = makeEl('div', { className:'enh-theme-selector' });
        const curTheme = getActiveThemeId();
        [
            { id:'dark', color:'#101014', label:'Dark' },
            { id:'oled', color:'#000000', label:'OLED' },
            { id:'midnight', color:'#0a0e1c', label:'Midnight' },
            { id:'light', color:'#f6f7f9', label:'Light' },
            { id:'highContrast', color:'linear-gradient(135deg,#000 0 42%,#ffd400 42% 62%,#fff 62%)', label:'High contrast' },
        ].forEach(th => {
            const sw = makeEl('button', {
                type:'button',
                className:'enh-theme-swatch' + (curTheme === th.id ? ' active' : ''),
                style: { background:th.color },
                dataset: { label:th.label, theme:th.id },
                title: th.label,
                'aria-label': `Use ${th.label} theme`,
                'aria-pressed': String(curTheme === th.id),
                onClick: () => {
                    set('themeAuto', false);
                    set('themeVariant', th.id);
                    applyThemeStyles();
                }
            });
            themeSelector.appendChild(sw);
        });
        themeRow.appendChild(themeSelector);
        body.appendChild(themeRow);

        const autoThemeRow = makeEl('div', { className:'enh-settings-row' });
        autoThemeRow.appendChild(makeEl('div', { className:'enh-settings-row-copy' },
            makeEl('span', { className:'enh-settings-label' }, 'Follow system theme'),
            makeEl('span', { className:'enh-settings-help' }, 'Uses Light for OS light mode and Dark for OS dark mode.')
        ));
        const autoThemeToggle = makeEl('label', { className:'enh-toggle' });
        const autoThemeInput = makeEl('input', { id:'enh-theme-auto', type:'checkbox', 'aria-label':'Follow system theme' });
        autoThemeInput.checked = get('themeAuto');
        autoThemeInput.addEventListener('change', () => {
            set('themeAuto', autoThemeInput.checked);
            applyThemeStyles();
        });
        autoThemeToggle.appendChild(autoThemeInput);
        autoThemeToggle.appendChild(makeEl('div', { className:'enh-toggle-track' }));
        autoThemeRow.appendChild(autoThemeToggle);
        body.appendChild(autoThemeRow);

        // Feature Toggles
        const groups = {};
        features.forEach(f => { if (!groups[f.group]) groups[f.group] = []; groups[f.group].push(f); });
        for (const [gName, gFeatures] of Object.entries(groups)) {
            body.appendChild(makeEl('div', { className:'enh-settings-group-label' }, gName));
            gFeatures.forEach(f => {
                const row = makeEl('div', { className:'enh-settings-row' });
                row.appendChild(makeEl('div', { className:'enh-settings-row-copy' },
                    makeEl('span', { className:'enh-settings-label' }, f.name),
                    makeEl('span', { className:'enh-settings-help' }, FEATURE_DETAILS[f.key] || '')
                ));
                const toggle = makeEl('label', { className:'enh-toggle' });
                const input = makeEl('input', { type:'checkbox', 'aria-label': f.name });
                input.checked = get(f.key);
                const track = makeEl('div', { className:'enh-toggle-track' });
                input.addEventListener('change', () => {
                    set(f.key, input.checked);
                    if (input.checked) { try { f.init(); } catch(e) { console.warn(e); } }
                    else f.destroy?.();
                });
                toggle.appendChild(input); toggle.appendChild(track);
                row.appendChild(toggle); body.appendChild(row);
            });
        }

        body.appendChild(makeEl('div', { className:'enh-settings-group-label' }, 'Link sites'));
        body.appendChild(createCinebySettingsPanel());
        body.appendChild(createSiteEditor({
            title:'Watch search sites',
            key:'watchSites',
            defaults:DEFAULT_WATCH_SITES,
            featureKey:'searchButtons',
        }));
        body.appendChild(createSiteEditor({
            title:'External link sites',
            key:'externalSites',
            defaults:DEFAULT_EXTERNAL_SITES,
            featureKey:'externalLinks',
        }));
        body.appendChild(makeEl('div', { className:'enh-settings-group-label' }, 'Servarr'));
        body.appendChild(createServarrSettingsPanel());
        body.appendChild(makeEl('div', { className:'enh-settings-group-label' }, 'Media servers'));
        body.appendChild(createMediaServerSettingsPanel());
        body.appendChild(makeEl('div', { className:'enh-settings-group-label' }, 'Local marks'));
        body.appendChild(createMarksPanel());

        const importPanel = makeEl('div', { className:'enh-import-panel', hidden:'hidden' },
            makeEl('label', { className:'enh-import-label', for:'enh-import-textarea' }, 'Paste exported settings JSON'),
            makeEl('textarea', {
                id:'enh-import-textarea',
                className:'enh-import-textarea',
                spellcheck:'false',
                placeholder:'{ "modernUI": true, "themeVariant": "dark" }'
            }),
            makeEl('div', { className:'enh-import-actions' },
                makeEl('button', { type:'button', className:'enh-settings-footer-btn', id:'enh-import-apply' }, 'Apply import'),
                makeEl('button', { type:'button', className:'enh-settings-footer-btn', id:'enh-import-cancel' }, 'Cancel')
            )
        );
        body.appendChild(importPanel);

        // Event handlers
        overlay.querySelector('.enh-settings-close').addEventListener('click', toggleSettings);
        overlay.addEventListener('click', e => { if (e.target === overlay) toggleSettings(); });
        overlay.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                e.preventDefault();
                if (settingsOpen) toggleSettings();
                return;
            }
            if (e.key !== 'Tab') return;
            const focusables = getSettingsFocusables(overlay);
            if (!focusables.length) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        });
        overlay.querySelector('#enh-export-btn').addEventListener('click', () => {
            const data = {};
            for (const key of Object.keys(DEFAULTS)) data[key] = get(key);
            data.themeVariant = get('themeVariant');
            GM_setClipboard(JSON.stringify(data, null, 2));
            showToast('Settings copied to clipboard');
        });
        overlay.querySelector('#enh-import-btn').addEventListener('click', () => {
            importPanel.hidden = false;
            overlay.querySelector('#enh-import-textarea').focus();
        });
        overlay.querySelector('#enh-import-cancel').addEventListener('click', () => {
            importPanel.hidden = true;
            overlay.querySelector('#enh-import-textarea').value = '';
            overlay.querySelector('#enh-import-btn').focus();
        });
        overlay.querySelector('#enh-import-apply').addEventListener('click', () => {
            const input = overlay.querySelector('#enh-import-textarea').value.trim();
            if (!input) { showToast('Paste settings JSON before importing'); return; }
            try {
                const data = JSON.parse(input);
                for (const [k, v] of Object.entries(data)) {
                    if (k in DEFAULTS || k === 'themeVariant') set(k, v);
                }
                showToast('Settings imported. Reloading...');
                setTimeout(() => location.reload(), 1000);
            } catch { showToast('Import failed. Check the JSON and try again.'); }
        });
        overlay.querySelector('#enh-clearcache-btn').addEventListener('click', () => {
            try {
                const allKeys = GM_listValues();
                let cleared = 0;
                allKeys.forEach(k => {
                    if (k.startsWith('cache_')) {
                        if (typeof GM_deleteValue === 'function') GM_deleteValue(k);
                        else GM_setValue(k, null);
                        cleared++;
                    }
                });
                showToast(`Cleared ${cleared} cached entries. Reload to re-fetch.`);
            } catch { showToast('Cache cleared'); }
        });

        document.body.appendChild(overlay);
    }

    function createFAB() {
        if (document.getElementById('enh-settings-fab')) return;
        const fab = makeEl('button', {
            id:'enh-settings-fab', type:'button',
            title:'IMDb Enhanced settings', 'aria-label':'Open IMDb Enhanced settings',
            'aria-haspopup':'dialog', 'aria-expanded':'false',
            innerHTML: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
            onClick: toggleSettings,
        });
        document.body.appendChild(fab);
    }

    function toggleSettings() {
        settingsOpen = !settingsOpen;
        const overlay = document.getElementById('enh-settings-overlay');
        const panel = document.getElementById('enh-settings-panel');
        overlay?.classList.toggle('enh-visible', settingsOpen);
        overlay?.setAttribute('aria-hidden', String(!settingsOpen));
        document.getElementById('enh-settings-fab')?.setAttribute('aria-expanded', String(settingsOpen));
        document.documentElement.style.overflow = settingsOpen ? 'hidden' : '';
        if (settingsOpen) {
            lastFocusedElement = document.activeElement;
            setTimeout(() => (getSettingsFocusables(overlay)[0] || panel)?.focus(), 40);
        } else {
            lastFocusedElement?.focus?.();
        }
    }

    // =========================================================================
    //  CINEBY AUTO-FILL
    // =========================================================================
    function handleCineby() {
        if (!window.location.hostname.includes('cineby')) return;
        const legacyKey = 'movieTitle';
        const t = GM_getValue(CINEBY_QUERY_KEY, '') || GM_getValue(legacyKey, '');
        if (!t) return;
        setTimeout(() => {
            const input = document.querySelector('input[type="search"],input[type="text"],input[placeholder*="search" i]');
            if (input) {
                input.value = t;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                GM_setValue(CINEBY_QUERY_KEY, '');
                GM_setValue(legacyKey, '');
            }
        }, 600);
    }

    // =========================================================================
    //  INIT
    // =========================================================================
    let activeRouteKey = null;
    let routeInitCount = 0;
    let routerInstalled = false;
    let routeTimer = null;
    let initTimer = null;

    function isIMDbHost() {
        return window.location.hostname.includes('imdb.com');
    }

    function isNonTitlePage() {
        return /\/(watchlist|list\/|chart\/)/i.test(location.pathname);
    }

    function shouldInitFeature(feature) {
        if (!isNonTitlePage()) return true;
        return ['modernUI', 'compactHeader', 'watchlistBatch', 'listMultiSearch', 'keyboardShortcuts'].includes(feature.key);
    }

    function getRouteKey() {
        return `${window.location.hostname}${window.location.pathname}${window.location.search}`;
    }

    function destroyRouteFeatures() {
        features.forEach(f => {
            try { f.destroy?.(); }
            catch (e) { console.warn(`[IMDb Enhanced] destroy ${f.key}:`, e); }
        });
        document.getElementById('enh-toast')?.remove();
    }

    function scheduleInit(delay = 350) {
        clearTimeout(initTimer);
        initTimer = setTimeout(init, delay);
    }

    function scheduleRouteInit() {
        clearTimeout(routeTimer);
        routeTimer = setTimeout(() => {
            if (activeRouteKey !== getRouteKey()) scheduleInit(350);
        }, 250);
    }

    function installSPARouter() {
        if (routerInstalled || !isIMDbHost()) return;
        routerInstalled = true;

        ['pushState', 'replaceState'].forEach(method => {
            const original = history[method];
            if (original.__imdbEnhancedWrapped) return;
            const wrapped = function (...args) {
                const result = original.apply(this, args);
                scheduleRouteInit();
                return result;
            };
            wrapped.__imdbEnhancedWrapped = true;
            history[method] = wrapped;
        });

        window.addEventListener('popstate', scheduleRouteInit);
    }

    function init() {
        if (window.location.hostname.includes('cineby')) { handleCineby(); return; }
        if (!isIMDbHost()) return;

        const routeKey = getRouteKey();
        if (activeRouteKey === routeKey) return;
        if (activeRouteKey) destroyRouteFeatures();
        activeRouteKey = routeKey;
        _ldData = null;
        cacheGC();

        injectGlobalStyles();
        const enabledFeatures = features.filter(f => get(f.key) && shouldInitFeature(f));
        enabledFeatures.forEach(f => {
            try { f.init(); } catch (e) { console.warn(`[IMDb Enhanced] ${f.key}:`, e); }
        });
        createSettingsPanel();
        createFAB();
        routeInitCount += 1;
        console.info(`[IMDb Enhanced] v${VERSION} — init #${routeInitCount}; ${enabledFeatures.length} features enabled`);
    }

    if (isIMDbHost()) installSPARouter();
    // Let IMDb's Next.js hydration settle before mutating title-page DOM.
    if (document.readyState === 'complete') scheduleInit(250);
    else window.addEventListener('load', () => scheduleInit(250), { once:true });

})();
