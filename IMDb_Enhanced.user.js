// ==UserScript==
// @name         IMDb Enhanced
// @namespace    https://github.com/SysAdminDoc
// @version      2.11.0
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
// @match        https://www.imdb.com/*/user/*/watchlist*
// @match        https://www.imdb.com/*/list/*
// @match        https://www.imdb.com/*/chart/*
// @match        https://www.imdb.com/find*
// @match        https://www.imdb.com/search/*
// @match        https://www.imdb.com/*/find*
// @match        https://www.imdb.com/*/search/*
// @match        https://www.imdb.com/
// @match        https://www.imdb.com/?*
// @match        https://www.cineby.at/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @grant        GM_listValues
// @grant        GM_deleteValue
// @grant        GM_webRequest
// @connect      www.rottentomatoes.com
// @connect      backend.metacritic.com
// @connect      letterboxd.com
// @connect      www.justwatch.com
// @connect      www.youtube.com
// @connect      query.wikidata.org
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
    const VERSION = '2.11.0';
    const PREFIX  = 'imdb_enh_';
    const CINEBY_QUERY_KEY = PREFIX + 'cineby_query';
    const CINEBY_QUERY_TTL = 10 * 60 * 1000;
    const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
    const CACHE_UNAVAILABLE_TTL = 24 * 60 * 60 * 1000; // 24 hours
    const CACHE_SCHEMA_VERSION = 3;
    const CACHE_MAX_ENTRIES = 120;
    const CACHE_GC_WRITE_INTERVAL = 10;
    const CACHE_ENTRY_TEXT_LIMIT = 256 * 1024;
    const USER_MARKS_MAX = 5000;
    const USER_MARKS_SCAN_LIMIT = USER_MARKS_MAX * 2;
    const USER_MARK_TITLE_LIMIT = 160;
    const LOCAL_LOOKUP_RESULT_LIMIT = 100;
    const LOCAL_PROVIDER_ID_LIMIT = 32;
    const LOOKUP_TITLE_TEXT_LIMIT = 500;
    const PROVIDER_ID_TEXT_LIMIT = 256;
    const SERVARR_SEASON_LIMIT = 500;
    const REQUEST_ERROR_TEXT_LIMIT = 240;
    const EXTERNAL_RESULT_SCAN_LIMIT = 100;
    const STRUCTURED_DATA_SCRIPT_LIMIT = 50;
    const STRUCTURED_DATA_NODE_LIMIT = 1000;
    const STRUCTURED_DATA_TYPE_LIMIT = 20;
    const STRUCTURED_DATA_CLASSIFICATION_ITEM_LIMIT = 50;
    const STRUCTURED_DATA_CLASSIFICATION_TEXT_LIMIT = 2000;
    const TITLE_YEAR_RELEASE_EVENT_LIMIT = 50;
    const TITLE_YEAR_INLINE_LIMIT = 100;
    const EXTERNAL_STRUCTURED_DATA_NODE_LIMIT = 100;
    const STRUCTURED_DATA_TEXT_LIMIT = 2 * 1024 * 1024;
    const EXTERNAL_RESPONSE_TEXT_LIMIT = 8 * 1024 * 1024;
    const LOCAL_RESPONSE_TEXT_LIMIT = 4 * 1024 * 1024;
    const SITE_LIST_LIMIT = 50;
    const COLLECTION_LINK_SCAN_LIMIT = 5000;
    const LIST_SEARCH_TITLE_LIMIT = 20;
    const URL_TEMPLATE_TEXT_LIMIT = 4096;
    const SETTING_TEXT_LIMIT = 4096;
    const SETTINGS_IMPORT_TEXT_LIMIT = 4 * 1024 * 1024;
    const SITE_CATEGORY_OPTIONS = [
        { key:'watch', label:'Watch', description:'Find the movie or show to watch.' },
        { key:'reviews', label:'Reviews & ratings', description:'Critics, audience scores, and discussion.' },
        { key:'availability', label:'Availability', description:'See where the title is streaming.' },
        { key:'trailers', label:'Trailers & video', description:'Trailers, clips, and video results.' },
        { key:'info', label:'Info & research', description:'Cast, credits, facts, and reference.' },
        { key:'other', label:'Other', description:'A custom destination.' },
    ];
    const SITE_CATEGORY_KEYS = new Set(SITE_CATEGORY_OPTIONS.map(option => option.key));
    const SITE_CATEGORY_LABELS = Object.fromEntries(SITE_CATEGORY_OPTIONS.map(option => [option.key, option.label]));
    const URL_TEMPLATE_KEYS = new Set([
        'TITLE', 'TITLE_RAW', 'TITLE_DASH', 'TITLE_SLUG',
        'IMDB_ID', 'IMDB_NUM', 'TRAKT_TYPE', 'YEAR',
    ]);
    const AD_SHELL_SELECTOR = [
        '.nas-slot',
        '.slot_wrapper',
        '[id^="div-gpt-ad-"]',
        '[id^="ape_"][id$="_placement"]',
        '[aria-label="Bottom Sponsored Advertisement"]',
        'iframe[aria-label="Sponsored Content"]',
        '.sponsored_label',
        '.sponsored-content',
        '#promoted-partner-bar',
        '#sis_pixel_sitewide',
        '#cookie_sync_pixel_sitewide',
        'iframe[src*="amazon-adsystem.com/iu3"]',
        'iframe[src*="amazon-adsystem.com/iui3"]',
    ].join(',');
    const AD_REQUEST_RULES = [{
        selector: {
            include: [
                '*://*.amazon-adsystem.com/*',
                '*://*.advertising.amazon.dev/*',
                '*://images-na.ssl-images-amazon.com/images/S/sash/*.html*',
                '*://sb.scorecardresearch.com/*',
                '*://fls-na.amazon.com/*',
                '*://unagi.amazon.com/*',
                '*://unagi-na.amazon.com/*',
            ],
        },
        action: 'cancel',
    }];
    const TITLE_STACK_ORDER = {
        quickCopyID: 10,
        searchButtons: 20,
        externalLinks: 30,
        expandedLinkMenu: 31,
        trailerPopover: 32,
        servarrIntegration: 35,
        mediaServerIntegration: 36,
        tvShowEnhancements: 40,
    };
    const CINEBY_HOSTS = [
        { label:'Cineby', url:'https://www.cineby.at/' },
    ];
    const DEFAULT_WATCH_SITES = [
        { name:'Cineby', color:'#6366f1', url:CINEBY_HOSTS[0].url, category:'watch', storeQuery:true },
        { name:'StreamXTV', color:'#10b981', url:'https://www.streamxtv.tech/search?q={{TITLE}}', category:'watch' },
        { name:'LookMovie2', color:'#f59e0b', url:'https://www.lookmovie2.to/movies/search/?q={{TITLE}}', category:'watch' },
        { name:'CinemaOS', color:'#ef4444', url:'https://cinemaos.live/search?q={{TITLE}}', category:'watch' },
        { name:'LivNet', color:'#ec4899', url:'https://livnet.pages.dev/search?q={{TITLE}}', category:'watch' },
        { name:'Flixer', color:'#06b6d4', url:'https://flixer.su/search?q={{TITLE}}', category:'watch' },
        { name:'Cine.su', color:'#14b8a6', url:'https://cine.su/en/search', category:'watch' },
        { name:'Fmovies+', color:'#f97316', url:'https://fmovies.gd/search/{{TITLE_DASH}}', category:'watch' },
        { name:'UFlix', color:'#8b5cf6', url:'https://uflix.to/', category:'watch' },
        { name:'FlixMomo', color:'#22c55e', url:'https://flixmomo.app/', category:'watch' },
        { name:'Movies2Watch', color:'#fb7185', url:'https://movies2watch.vc/', category:'watch' },
        { name:'WatchLuna', color:'#0ea5e9', url:'https://watchluna.com/movies', category:'watch' },
        { name:'1Movies', color:'#e11d48', url:'https://1movies.stream/home', category:'watch' },
    ];
    const DEFAULT_EXTERNAL_SITES = [
        { name:'Rotten Tomatoes', color:'#fa320a', url:'https://www.rottentomatoes.com/search?search={{TITLE}}', category:'reviews' },
        { name:'Letterboxd', color:'#00d735', url:'https://letterboxd.com/imdb/{{IMDB_ID}}/', category:'reviews', movieOnly:true },
        { name:'TMDB', color:'#01b4e4', url:'https://www.themoviedb.org/search?query={{TITLE}}', category:'info' },
        { name:'YouTube', color:'#ff0000', url:'https://www.youtube.com/results?search_query={{TITLE}}%20trailer', category:'trailers' },
        { name:'Wikipedia', color:'#636466', url:'https://en.wikipedia.org/w/index.php?search={{TITLE}}+{{YEAR}}', category:'info' },
        { name:'JustWatch', color:'#fbc500', url:'https://www.justwatch.com/us/search?q={{TITLE}}', category:'availability' },
        { name:'Trakt', color:'#ed1c24', url:'https://app.trakt.tv/search?query={{TITLE}}', category:'reviews' },
    ];

    const DEFAULTS = {
        // Cleanup
        removeAds: true, removeProUpsell: true, removeNewsSection: true,
        removeRelatedInterests: true, removeContribution: true,
        removeSponsoredRecs: true, removeAppBanner: true,
        // Appearance
        modernUI: true, editorialTitleSurface: true, compactHeader: true, enhancedRatingDisplay: true,
        widerLayout: true, ratingColorCoding: true,
        // Theme
        themeVariant: 'dark', // dark | oled | midnight | light | highContrast
        themeAuto: false,
        // Sections
        collapsibleSections: true, sectionCollapseState: {}, spoilerBlur: false, quickNav: true,
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
        seerrUrl: 'http://localhost:5055', seerrApiKey: '',
        radarrUrl: 'http://localhost:7878', radarrApiKey: '',
        radarrRootFolderPath: '', radarrQualityProfileId: '1',
        sonarrUrl: 'http://localhost:8989', sonarrApiKey: '',
        sonarrRootFolderPath: '', sonarrQualityProfileId: '1',
        mediaServerIntegration: false,
        plexUrl: 'http://localhost:32400', plexToken: '',
        jellyfinUrl: 'http://localhost:8096', jellyfinApiKey: '',
        embyUrl: 'http://localhost:8096', embyApiKey: '',
        // TV
        tvEpisodeTools: true, tvShowEnhancements: true, subtitleLinks: true,
        castAges: true,
        // Utility
        quickCopyID: true, watchlistBatch: true, listMultiSearch: true,
        keyboardShortcuts: false,
    };
    const LOCAL_SERVICE_URL_KEYS = new Set([
        'radarrUrl', 'sonarrUrl', 'seerrUrl', 'plexUrl', 'jellyfinUrl', 'embyUrl',
    ]);
    const POSITIVE_INTEGER_SETTING_KEYS = new Set([
        'radarrQualityProfileId', 'sonarrQualityProfileId',
    ]);
    const CREDENTIAL_SETTING_KEYS = new Set([
        'radarrApiKey', 'sonarrApiKey', 'seerrApiKey', 'plexToken', 'jellyfinApiKey', 'embyApiKey',
    ]);
    const COLLAPSIBLE_SECTION_IDS = [
        'title-cast', 'UserReviews', 'MoreLikeThis', 'Details', 'BoxOffice',
        'TechSpecs', 'DidYouKnow', 'videos-section', 'Photos',
    ];

    const FEATURE_DETAILS = {
        removeAds: 'Hides current IMDb ad placements, sponsored shells, and tracking pixels as early as userscript timing allows.',
        removeProUpsell: 'Hides explicit IMDbPro prompts and links from title and name pages while preserving list controls.',
        removeNewsSection: 'Keeps the page focused by removing IMDb news modules.',
        removeRelatedInterests: 'Hides broad interest recommendations that dilute title and cast pages.',
        removeContribution: 'Removes contribution calls to action from detail pages.',
        removeSponsoredRecs: 'Suppresses sponsored recommendation blocks where IMDb inserts them.',
        removeAppBanner: 'Hides app-install prompts shown on desktop pages.',
        modernUI: 'Applies the selected theme, typography, focus, and component treatment.',
        editorialTitleSurface: 'Rebuilds title pages into a stable editorial hero with dedicated action, rating, and research regions.',
        compactHeader: 'Slims the IMDb header while keeping it readable and stable.',
        enhancedRatingDisplay: 'Elevates IMDb rating and popularity blocks with clearer emphasis.',
        widerLayout: 'Uses more horizontal room across normal desktop window sizes.',
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
        castAges: 'Shows a living person’s current age next to their birth date. IMDb already prints the age at death for people who have died.',
        watchedMarking: 'Adds private Seen and Skip marks on title cards across titles, charts, lists, watchlists, filmographies, and search results. Marks stay in this userscript and do not change IMDb Watched.',
        servarrIntegration: 'Adds optional local Radarr/Sonarr quick-add buttons with library status indicator when API settings are configured.',
        mediaServerIntegration: 'Checks configured local Plex, Jellyfin, and Emby servers and shows whether the title is already in your library.',
        tvEpisodeTools: 'Surfaces the highest-rated episodes; synopsis blur remains opt-in through Spoiler blur on plot.',
        tvShowEnhancements: 'Adds TV-specific lookup shortcuts on series pages.',
        subtitleLinks: 'Adds subtitle lookup links in the details section.',
        quickCopyID: 'Adds a visible IMDb ID copy button beside the title.',
        watchlistBatch: 'Adds a watchlist-page button that copies all visible IMDb title IDs.',
        listMultiSearch: 'Builds a popup-safe queue of up to 20 title links on watchlist, list, and chart pages.',
        keyboardShortcuts: 'Optional. Enables ? for settings, c to copy, r for rating, and t for top.',
    };

    // =========================================================================
    //  STORAGE HELPERS
    // =========================================================================
    const get = (k) => GM_getValue(PREFIX + k, DEFAULTS[k]);
    const set = (k, v) => {
        GM_setValue(PREFIX + k, v);
        try { document.dispatchEvent(new CustomEvent('imdb-enhanced:settings-saved', { detail:{ key:k } })); }
        catch { /* persistence succeeded; notification is best-effort */ }
        return true;
    };
    let cacheWritesSinceGC = 0;
    let userMarksCache = null;

    function parseCacheEntry(raw, now = Date.now()) {
        if (typeof raw !== 'string' || !raw || raw.length > CACHE_ENTRY_TEXT_LIMIT) return null;
        try {
            const entry = JSON.parse(raw);
            const ts = Number(entry?.ts);
            const ttl = Number(entry?.ttl);
            if (!entry || entry.schema !== CACHE_SCHEMA_VERSION
                || !Number.isFinite(ts) || ts <= 0 || ts > now + 60000
                || !Number.isFinite(ttl) || ttl <= 0 || ttl > CACHE_TTL
                || now - ts > ttl) return null;
            return { ...entry, ts, ttl };
        } catch { return null; }
    }

    function cacheGet(key) {
        try {
            const storageKey = 'cache_' + key;
            const raw = GM_getValue(storageKey, null);
            if (!raw) return null;
            const entry = parseCacheEntry(raw);
            if (!entry) {
                if (typeof GM_deleteValue === 'function') GM_deleteValue(storageKey);
                return null;
            }
            return entry.data;
        } catch {
            try {
                if (typeof GM_deleteValue === 'function') GM_deleteValue('cache_' + key);
            } catch { /* best-effort malformed cache cleanup */ }
            return null;
        }
    }
    function cacheSet(key, data, ttl = CACHE_TTL) {
        try {
            const serialized = JSON.stringify({ data, ts: Date.now(), ttl, schema:CACHE_SCHEMA_VERSION });
            if (serialized.length > CACHE_ENTRY_TEXT_LIMIT) {
                console.warn('[IMDb Enhanced] cache entry exceeded the storage limit');
                return false;
            }
            GM_setValue('cache_' + key, serialized);
            cacheWritesSinceGC += 1;
            if (cacheWritesSinceGC >= CACHE_GC_WRITE_INTERVAL) {
                cacheWritesSinceGC = 0;
                cacheGC(true);
            }
            return true;
        } catch (error) {
            console.warn('[IMDb Enhanced] cache write failed:', error);
            return false;
        }
    }
    function cacheSetUnavailable(key) {
        cacheSet(key, { unavailable: true }, CACHE_UNAVAILABLE_TTL);
    }
    function cacheGC(force = false) {
        if (cacheGC._ran && !force) return;
        cacheGC._ran = true;
        try {
            const legacySiteHealthKey = PREFIX + 'siteHealth';
            const legacyStorageKeys = [legacySiteHealthKey, PREFIX + 'sonarrLanguageProfileId'];
            if (typeof GM_deleteValue === 'function') {
                legacyStorageKeys.forEach(key => {
                    if (GM_getValue(key, null) !== null) GM_deleteValue(key);
                });
            }
            const now = Date.now();
            const live = [];
            GM_listValues().forEach(storageKey => {
                if (!storageKey.startsWith('cache_')) return;
                try {
                    const raw = GM_getValue(storageKey, null);
                    const entry = parseCacheEntry(raw, now);
                    if (!entry) {
                        if (typeof GM_deleteValue === 'function') GM_deleteValue(storageKey);
                        return;
                    }
                    live.push({ storageKey, ts:entry.ts });
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
    /* IMDb's own account-backed Watched control. The captured 2026 desktop DOM
       exposes it as `data-testid="watched-button-tt<id>"` with an accessible
       label of "Mark <title> as watched" while the title is unwatched. Only the
       unwatched wording is confirmed against a live capture, so the reader below
       treats a title as watched exclusively when the control positively says so;
       an unrecognized label is reported as unknown rather than watched. Guessing
       the other way would silently invent Seen marks the user never made. */
    const NATIVE_WATCHED_SELECTOR = '[data-testid^="watched-button-tt"]';
    const NATIVE_WATCHED_ON = /(?:remove\b[^]*\bfrom\s+watched|mark\b[^]*\bas\s+(?:not\s+watched|unwatched)|^\s*watched\s*$)/i;
    const NATIVE_WATCHED_OFF = /mark\b[^]*\bas\s+watched/i;
    const NATIVE_WATCHED_SCAN_LIMIT = 5000;

    function readNativeWatchedControl(button) {
        if (!button) return null;
        const testId = String(button.getAttribute('data-testid') || '');
        const imdbId = /^watched-button-(tt\d{5,12})$/i.exec(testId)?.[1];
        if (!imdbId) return null;
        const label = String(button.getAttribute('aria-label') || '').slice(0, 300);
        const text = String(button.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300);
        let watched = null;
        if (NATIVE_WATCHED_OFF.test(label) || NATIVE_WATCHED_OFF.test(text)) watched = false;
        else if (NATIVE_WATCHED_ON.test(label) || NATIVE_WATCHED_ON.test(text)) watched = true;
        const named = /^mark\s+(.+?)\s+as\s+(?:not\s+)?(?:un)?watched$/i.exec(label)
            || /^remove\s+(.+?)\s+from\s+watched$/i.exec(label);
        return { imdbId, watched, title:named?.[1]?.trim().slice(0, 160) || '' };
    }

    function collectNativeWatchedTitles(scope = document) {
        const found = new Map();
        const buttons = scope?.querySelectorAll?.(NATIVE_WATCHED_SELECTOR) || [];
        let inspected = 0;
        for (const button of buttons) {
            if (++inspected > NATIVE_WATCHED_SCAN_LIMIT) break;
            const state = readNativeWatchedControl(button);
            if (!state || state.watched !== true) continue;
            if (!found.has(state.imdbId)) found.set(state.imdbId, state.title);
        }
        return found;
    }

    function normalizeUserMark(record) {
        if (record === 'watched' || record === 'skip') return { state: record, title: '', ts: 0 };
        if (!record || typeof record !== 'object') return null;
        const state = record.state === 'watched' || record.state === 'skip' ? record.state : '';
        if (!state) return null;
        const timestamp = Number(record.ts);
        return {
            state,
            title: String(record.title || '').trim().slice(0, USER_MARK_TITLE_LIMIT),
            ts:Number.isFinite(timestamp) && timestamp >= 0 && timestamp <= Date.now() + 60000 ? timestamp : 0,
        };
    }
    function normalizeUserMarkEntries(source) {
        const entries = [];
        let inspected = 0;
        for (const id in source) {
            if (!Object.prototype.hasOwnProperty.call(source, id)) continue;
            if (inspected >= USER_MARKS_SCAN_LIMIT) break;
            inspected += 1;
            if (!/^tt\d+$/.test(id)) continue;
            const normalized = normalizeUserMark(source[id]);
            if (normalized) entries.push([id, normalized]);
        }
        return entries
            .sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0))
            .slice(0, USER_MARKS_MAX);
    }
    function getUserMarks(forceRefresh = false) {
        if (forceRefresh) userMarksCache = null;
        if (userMarksCache) return userMarksCache;
        const raw = get('userMarks');
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            userMarksCache = {};
            return userMarksCache;
        }
        userMarksCache = Object.fromEntries(normalizeUserMarkEntries(raw));
        return userMarksCache;
    }
    function setUserMarks(marks, notifyFailure = true) {
        const source = marks && typeof marks === 'object' && !Array.isArray(marks) ? marks : {};
        const normalized = Object.fromEntries(normalizeUserMarkEntries(source));
        if (!trySaveSetting('userMarks', normalized, { notify:notifyFailure })) return false;
        userMarksCache = normalized;
        return true;
    }
    function getUserMark(imdbId) {
        return getUserMarks()[imdbId]?.state || '';
    }
    function setUserMark(imdbId, state, title = '', notifyFailure = true) {
        if (!/^tt\d+$/.test(imdbId || '')) return false;
        const marks = { ...getUserMarks(true) };
        if (state === 'watched' || state === 'skip') {
            marks[imdbId] = { state, title: String(title || '').trim().slice(0, USER_MARK_TITLE_LIMIT), ts: Date.now() };
        } else {
            delete marks[imdbId];
        }
        return setUserMarks(marks, notifyFailure);
    }
    function getUserMarkEntries() {
        return Object.entries(getUserMarks()).sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0));
    }
    function normalizeSectionCollapseState(value) {
        if (!value || Array.isArray(value) || typeof value !== 'object') return {};
        const state = {};
        COLLAPSIBLE_SECTION_IDS.forEach(id => {
            if (typeof value[id] === 'boolean') state[id] = value[id];
        });
        return state;
    }
    function getSectionCollapseState() {
        const state = normalizeSectionCollapseState(get('sectionCollapseState'));
        let migrated = false;
        const legacyKeys = [];
        COLLAPSIBLE_SECTION_IDS.forEach(id => {
            const legacyKey = 'enh_coll_' + id;
            try {
                const legacy = GM_getValue(legacyKey, null);
                if (typeof legacy === 'boolean' && !(id in state)) {
                    state[id] = legacy;
                    migrated = true;
                }
                if (legacy !== null) legacyKeys.push(legacyKey);
            } catch { /* inspect remaining legacy keys */ }
        });
        if (migrated) set('sectionCollapseState', state);
        if (typeof GM_deleteValue === 'function') {
            legacyKeys.forEach(key => {
                try { GM_deleteValue(key); } catch { /* migration is already durable */ }
            });
        }
        return state;
    }
    function setSectionCollapsed(id, collapsed, notifyFailure = true) {
        if (!COLLAPSIBLE_SECTION_IDS.includes(id)) return false;
        const state = getSectionCollapseState();
        state[id] = Boolean(collapsed);
        return trySaveSetting('sectionCollapseState', state, { notify:notifyFailure });
    }

    // =========================================================================
    //  DOM UTILITIES
    // =========================================================================
    const pendingRouteWorkCancels = new Set();

    function cancelPendingRouteWork() {
        [...pendingRouteWorkCancels].forEach(cancel => cancel());
    }

    function waitForMatch(find, timeout) {
        return new Promise((resolve, reject) => {
            const el = find();
            if (el) return resolve(el);
            const root = document.body || document.documentElement;
            if (!root) return reject();
            let settled = false;
            let timer = null;
            const obs = new MutationObserver(() => {
                const next = find();
                if (next) finish(resolve, next);
            });
            const cancel = () => finish(reject, new Error('Route changed'));
            const finish = (handler, value) => {
                if (settled) return;
                settled = true;
                obs.disconnect();
                clearTimeout(timer);
                pendingRouteWorkCancels.delete(cancel);
                handler(value);
            };
            pendingRouteWorkCancels.add(cancel);
            obs.observe(root, { childList: true, subtree: true });
            timer = setTimeout(() => finish(reject, new Error('Timed out waiting for page content')), timeout);
        });
    }

    function waitFor(sel, timeout = 8000) {
        return waitForMatch(() => document.querySelector(sel), timeout);
    }

    function getFocusableElements(root) {
        if (!root) return [];
        return [...root.querySelectorAll(
            'button, [href], input, select, textarea, iframe, [tabindex]:not([tabindex="-1"])'
        )].filter(element => !element.disabled
            && element.getAttribute('aria-hidden') !== 'true'
            && element.offsetParent !== null);
    }

    function restoreElementAttributes(element, attributes) {
        if (!element || !attributes) return;
        attributes.forEach((value, attribute) => {
            if (value === null) element.removeAttribute(attribute);
            else element.setAttribute(attribute, value);
        });
    }

    function getEnhancementScrollBehavior() {
        return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
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

    function getEditorialPosterSource(root = document) {
        const poster = root?.querySelector?.('[data-testid="hero-media__poster"] img');
        const source = poster?.currentSrc || poster?.src || poster?.getAttribute?.('src') || '';
        try {
            const url = new URL(source, location.href);
            return /^https?:$/.test(url.protocol) ? url.href : '';
        } catch { return ''; }
    }

    function getEditorialBackdropValue(source) {
        if (!source) return '';
        return `url("${source.replace(/["\\)]/g, character => `\\${character}`)}")`;
    }

    function getEditorialMetadata() {
        const ld = getLDData();
        const values = [];
        const rawType = Array.isArray(ld?.['@type']) ? ld['@type'].join(' ') : String(ld?.['@type'] || '');
        const type = isTVType()
            ? (rawType.includes('TVMiniSeries') ? 'TV Mini Series' : 'TV Series')
            : 'Movie';
        if (type) values.push(type);
        const year = getTitleYear();
        if (year) values.push(year);
        const nativeMeta = document.querySelector('[data-testid="hero__pageTitle"]')?.textContent || '';
        const contentRating = typeof ld?.contentRating === 'string'
            ? ld.contentRating.trim()
            : nativeMeta.match(/\b(?:TV-Y|TV-Y7|TV-G|TV-PG|TV-14|TV-MA|G|PG|PG-13|R|NC-17)\b/i)?.[0] || '';
        if (contentRating) values.push(contentRating);
        const duration = String(ld?.duration || '').match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/i);
        if (duration) {
            const hours = Number(duration[1] || 0);
            const minutes = Number(duration[2] || 0);
            const formatted = hours ? `${hours}h${minutes ? ` ${minutes}m` : ''}` : minutes ? `${minutes}m` : '';
            if (formatted) values.push(formatted);
        }
        return values;
    }

    function getEditorialSynopsis() {
        const plot = document.querySelector('[data-testid="plot-l"], [data-testid="plot-xl"], [data-testid="plot"]');
        const visible = plot?.textContent?.replace(/\s+/g, ' ').trim();
        if (visible) return visible.slice(0, 900);
        try {
            const description = String(getLDData()?.description || '').replace(/\s+/g, ' ').trim();
            return description.slice(0, 900);
        } catch { return ''; }
    }

    function getEditorialLinkData(selector, limit = 4) {
        const links = [];
        for (const anchor of document.querySelectorAll(selector)) {
            if (links.length >= limit) break;
            const label = anchor.textContent?.replace(/\s+/g, ' ').trim();
            if (!label) continue;
            try {
                const url = new URL(anchor.href, location.href);
                if (url.origin !== location.origin) continue;
                links.push({ label, href:url.href });
            } catch { /* ignore incomplete hydration links */ }
        }
        return links;
    }

    function ensureEditorialSurface() {
        const existing = document.getElementById('enh-editorial-surface');
        if (existing) return existing;
        const nativeHero = document.querySelector('section[data-testid="hero-parent"]');
        const imdbId = getIMDbID();
        const title = getTitleText();
        if (!nativeHero?.parentElement || !imdbId || !title) return null;

        const posterSource = getEditorialPosterSource(nativeHero);
        const surface = makeEl('section', {
            id:'enh-editorial-surface',
            className:'enh-editorial-surface',
            role:'region',
            'aria-label':`${title} title surface`,
        });
        if (posterSource) surface.style.setProperty('--enh-editorial-backdrop', getEditorialBackdropValue(posterSource));

        const subnav = makeEl('div', { className:'enh-editorial-subnav' });
        const subnavLeft = makeEl('nav', { className:'enh-editorial-subnav__left', 'aria-label':'Title navigation' });
        if (isTVType()) {
            subnavLeft.appendChild(makeEl('a', {
                href:`/title/${imdbId}/episodes/`,
                className:'enh-editorial-subnav__link',
            }, 'Episode guide'));
        }
        const subnavRight = makeEl('nav', { className:'enh-editorial-subnav__right', 'aria-label':'Title topics' });
        [
            ['Cast & crew', `/title/${imdbId}/fullcredits/`],
            ['User reviews', `/title/${imdbId}/reviews/`],
            ['Trivia', `/title/${imdbId}/trivia/`],
        ].forEach(([label, href]) => subnavRight.appendChild(makeEl('a', {
            href, className:'enh-editorial-subnav__link',
        }, label)));
        subnav.append(subnavLeft, subnavRight);

        const poster = makeEl('div', { className:'enh-editorial-poster' });
        if (posterSource) {
            poster.appendChild(makeEl('img', {
                src:posterSource,
                alt:`${title} poster`,
                loading:'eager',
            }));
        }

        const identity = makeEl('div', { className:'enh-editorial-identity' },
            makeEl('h1', { className:'enh-editorial-title' }, title),
            makeEl('div', { className:'enh-editorial-meta' }, getEditorialMetadata().join('  ·  ')),
            makeEl('div', { id:'enh-editorial-action-slot' }),
            makeEl('div', { id:'enh-editorial-standalone-slot' })
        );
        const scoreRail = makeEl('div', {
            id:'enh-editorial-score-rail',
            role:'group',
            'aria-label':'Title ratings and availability',
        });
        const hero = makeEl('div', { className:'enh-editorial-hero' }, poster, identity, scoreRail);

        const about = makeEl('section', {
            className:'enh-editorial-about',
            'aria-labelledby':'enh-editorial-about-title',
        }, makeEl('h2', { id:'enh-editorial-about-title' }, 'About this title'));
        const synopsis = getEditorialSynopsis();
        if (synopsis) about.appendChild(makeEl('p', { className:'enh-editorial-synopsis' }, synopsis));
        const cast = getEditorialLinkData('[data-testid="title-cast-item"] a', 3);
        if (cast.length) {
            const row = makeEl('div', { className:'enh-editorial-detail-row' }, makeEl('strong', {}, 'Stars'));
            cast.forEach((person, index) => {
                if (index) row.appendChild(makeEl('span', { className:'enh-editorial-detail-separator', 'aria-hidden':'true' }, '·'));
                row.appendChild(makeEl('a', { href:person.href }, person.label));
            });
            about.appendChild(row);
        }
        about.appendChild(makeEl('a', {
            href:`/title/${imdbId}/fullcredits/`,
            className:'enh-editorial-about-link',
        }, 'View full cast & crew'));

        const watch = makeEl('section', {
            className:'enh-editorial-watch',
            'aria-labelledby':'enh-editorial-watch-title',
        },
            makeEl('div', { className:'enh-editorial-watch__header' },
                makeEl('h2', { id:'enh-editorial-watch-title' }, 'Where to watch'),
                makeEl('p', {}, 'Reviews, availability, trailers and research')
            ),
            makeEl('div', { id:'enh-editorial-research-slot' })
        );
        const details = makeEl('div', { className:'enh-editorial-details' }, about, watch);
        surface.append(subnav, hero, details);
        nativeHero.parentElement.insertBefore(surface, nativeHero);
        return surface;
    }

    function refreshEditorialSurface(surface, nativeHero = document) {
        if (!surface) return;
        const title = getTitleText();
        const titleNode = surface.querySelector('.enh-editorial-title');
        if (title && titleNode && titleNode.textContent !== title) {
            titleNode.textContent = title;
            surface.setAttribute('aria-label', `${title} title surface`);
            const poster = surface.querySelector('.enh-editorial-poster img');
            if (poster) poster.alt = `${title} poster`;
        }

        const posterSource = getEditorialPosterSource(nativeHero);
        const poster = surface.querySelector('.enh-editorial-poster');
        if (posterSource && poster) {
            let image = poster.querySelector('img');
            if (!image) {
                image = makeEl('img', {
                    src:posterSource,
                    alt:`${title || 'Title'} poster`,
                    loading:'eager',
                });
                poster.appendChild(image);
            } else if (image.src !== posterSource) {
                image.src = posterSource;
            }
            surface.style.setProperty('--enh-editorial-backdrop', getEditorialBackdropValue(posterSource));
        }

        const metadataNode = surface.querySelector('.enh-editorial-meta');
        const metadata = getEditorialMetadata().join('  ·  ');
        if (metadataNode && metadata && metadataNode.textContent !== metadata) metadataNode.textContent = metadata;

        const about = surface.querySelector('.enh-editorial-about');
        const synopsis = getEditorialSynopsis();
        if (about && synopsis) {
            const synopsisNode = about.querySelector('.enh-editorial-synopsis');
            if (synopsisNode) {
                if (synopsisNode.textContent !== synopsis) synopsisNode.textContent = synopsis;
            } else {
                about.insertBefore(makeEl('p', { className:'enh-editorial-synopsis' }, synopsis), about.querySelector('.enh-editorial-about-link'));
            }
        }

        const cast = getEditorialLinkData('[data-testid="title-cast-item"] a', 3);
        if (about && cast.length) {
            const signature = cast.map(person => `${person.label}|${person.href}`).join('||');
            if (about.dataset.editorialCastSignature !== signature) {
                const row = makeEl('div', { className:'enh-editorial-detail-row' }, makeEl('strong', {}, 'Stars'));
                cast.forEach((person, index) => {
                    if (index) row.appendChild(makeEl('span', { className:'enh-editorial-detail-separator', 'aria-hidden':'true' }, '·'));
                    row.appendChild(makeEl('a', { href:person.href }, person.label));
                });
                const current = about.querySelector('.enh-editorial-detail-row');
                if (current) current.replaceWith(row);
                else about.insertBefore(row, about.querySelector('.enh-editorial-about-link'));
                about.dataset.editorialCastSignature = signature;
            }
        }

        const subnavLeft = surface.querySelector('.enh-editorial-subnav__left');
        const episodeLink = subnavLeft?.querySelector('a[href*="/episodes/"]');
        if (isTVType() && subnavLeft && !episodeLink) {
            subnavLeft.appendChild(makeEl('a', {
                href:`/title/${getIMDbID()}/episodes/`,
                className:'enh-editorial-subnav__link',
            }, 'Episode guide'));
        } else if (!isTVType()) {
            episodeLink?.remove();
        }
    }

    function insertAfter(anchor, node) {
        if (!anchor?.parentElement || !node) return false;
        anchor.parentElement.insertBefore(node, anchor.nextSibling);
        return true;
    }

    function getOrCreateTitleStack() {
        const existing = document.getElementById('enh-title-stack');
        if (existing) return existing;
        const standalone = document.getElementById('enh-editorial-standalone-slot');
        if (standalone) {
            const stack = makeEl('div', { id:'enh-title-stack' });
            standalone.appendChild(stack);
            return stack;
        }
        const anchor = getTitleActionAnchor();
        if (!anchor) return null;
        const stack = makeEl('div', { id:'enh-title-stack' });
        return insertAfter(anchor, stack) ? stack : null;
    }

    function appendTitleStackItem(node, order) {
        if (!node) return false;
        const slot = node.id === 'enh-search-buttons'
            ? document.getElementById('enh-editorial-action-slot')
            : node.id === 'enh-external-links'
                ? document.getElementById('enh-editorial-research-slot')
                : null;
        const stack = slot || getOrCreateTitleStack();
        if (!stack) return false;
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
        return waitForMatch(getTitleSurface, timeout);
    }

    const pendingStyles = new Map();
    const themedStyleFactories = new Map();

    function addCSS(css, id) {
        let s = document.getElementById(id) || pendingStyles.get(id);
        if (s) { s.textContent = css; return s; }
        s = document.createElement('style');
        s.id = id; s.textContent = css;
        const attach = () => {
            const target = document.head || document.documentElement;
            if (!target) return false;
            target.appendChild(s);
            pendingStyles.delete(id);
            return true;
        };
        if (!attach()) {
            pendingStyles.set(id, s);
            const observer = new MutationObserver(() => {
                if (!pendingStyles.has(id)) { observer.disconnect(); return; }
                if (attach()) observer.disconnect();
            });
            observer.observe(document, { childList:true, subtree:true });
        }
        return s;
    }
    function addThemedCSS(factory, id) {
        themedStyleFactories.set(id, factory);
        return addCSS(factory(getTheme()), id);
    }
    function refreshThemedStyles() {
        themedStyleFactories.forEach((factory, id) => {
            if (document.getElementById(id) || pendingStyles.has(id)) addCSS(factory(getTheme()), id);
        });
    }
    function removeCSS(id) {
        document.getElementById(id)?.remove();
        pendingStyles.get(id)?.remove();
        pendingStyles.delete(id);
        themedStyleFactories.delete(id);
    }

    function injectEarlyAdShell() {
        if (!isIMDbHost() || !get('removeAds')) return;
        setAdRequestBlocking(true);
        addCSS(`${AD_SHELL_SELECTOR} {
            display: none !important;
            visibility: hidden !important;
            width: 0 !important;
            min-width: 0 !important;
            max-width: 0 !important;
            height: 0 !important;
            min-height: 0 !important;
            max-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            overflow: hidden !important;
            pointer-events: none !important;
        }`, 'enh-early-ad-shell');
    }

    let adRequestRulesRegistered = false;
    function setAdRequestBlocking(enabled) {
        if (typeof GM_webRequest !== 'function' || adRequestRulesRegistered === enabled) return false;
        try {
            GM_webRequest(enabled ? AD_REQUEST_RULES : [], () => {});
            adRequestRulesRegistered = enabled;
            return true;
        } catch { return false; }
    }

    injectEarlyAdShell();

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

    function normalizeSiteCategory(value, fallback = 'other') {
        const category = String(value || '').trim().toLowerCase();
        return SITE_CATEGORY_KEYS.has(category) ? category : fallback;
    }

    function getSiteCategoryLabel(category) {
        return SITE_CATEGORY_LABELS[normalizeSiteCategory(category)] || SITE_CATEGORY_LABELS.other;
    }

    function groupSitesByCategory(sites) {
        const groups = [];
        const byCategory = new Map();
        (Array.isArray(sites) ? sites : []).forEach(site => {
            const category = normalizeSiteCategory(site?.category);
            let group = byCategory.get(category);
            if (!group) {
                group = { category, sites:[] };
                byCategory.set(category, group);
                groups.push(group);
            }
            group.sites.push(site);
        });
        return groups;
    }

    function normalizeUrlTemplate(url) {
        const value = String(url || '').trim();
        if (!value || value.length > URL_TEMPLATE_TEXT_LIMIT || !/^https?:\/\//i.test(value)) return '';
        try {
            const parsed = new URL(value);
            const safeProtocol = /^https?:$/i.test(parsed.protocol);
            if (!safeProtocol || !parsed.hostname || parsed.username || parsed.password) return '';

            const tokens = Array.from(value.matchAll(/\{\{([^{}]+)\}\}/g));
            if (tokens.some(match => !URL_TEMPLATE_KEYS.has(match[1]))) return '';
            const remainder = value.replace(/\{\{[^{}]+\}\}/g, '');
            if (/[{}]/.test(remainder)) return '';

            const authorityStart = value.indexOf('//') + 2;
            const relativeEnd = value.slice(authorityStart).search(/[\\/?#]/);
            const authorityEnd = relativeEnd < 0 ? value.length : authorityStart + relativeEnd;
            const authority = value.slice(authorityStart, authorityEnd);
            return /\{\{[^{}]+\}\}/.test(authority) ? '' : value;
        } catch { return ''; }
    }

    function normalizeTrustedUrl(value, rootDomain, fallback) {
        try {
            const parsed = new URL(String(value || ''));
            const hostname = parsed.hostname.toLowerCase();
            const trustedHost = hostname === rootDomain || hostname.endsWith(`.${rootDomain}`);
            return parsed.protocol === 'https:' && trustedHost && !parsed.username && !parsed.password
                ? parsed.href
                : fallback;
        } catch { return fallback; }
    }

    function getCinebyHost() {
        const saved = normalizeUrlTemplate(get('cinebyHost'));
        return CINEBY_HOSTS.some(host => host.url === saved) ? saved : CINEBY_HOSTS[0].url;
    }

    function isCinebyHandoffUrl(value) {
        const normalized = normalizeUrlTemplate(value);
        if (!normalized) return false;
        try {
            const candidate = new URL(normalized);
            return CINEBY_HOSTS.some(host => {
                const approved = new URL(host.url);
                return candidate.origin === approved.origin
                    && candidate.pathname.replace(/\/+$/, '') === approved.pathname.replace(/\/+$/, '')
                    && !candidate.search
                    && !candidate.hash;
            });
        } catch { return false; }
    }

    function clearCinebyQueryKey(key) {
        try {
            if (typeof GM_deleteValue === 'function') GM_deleteValue(key);
            else GM_setValue(key, '');
        } catch { /* best-effort stale handoff cleanup */ }
    }

    let cinebyHandoffFailure = '';
    function parseCinebyQuery(raw, acceptLegacy = false) {
        if (!raw) return '';
        let payload = raw;
        if (typeof raw === 'string') {
            try {
                const parsed = JSON.parse(raw);
                if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
                    return acceptLegacy ? raw.trim().slice(0, 200) : '';
                }
                payload = parsed;
            } catch { return acceptLegacy ? raw.trim().slice(0, 200) : ''; }
        }
        if (!payload || Array.isArray(payload) || typeof payload !== 'object') return '';
        const timestamp = Number(payload.ts);
        const age = Date.now() - timestamp;
        if (!Number.isFinite(timestamp) || age < -60000 || age > CINEBY_QUERY_TTL) return '';
        return String(payload.title || '').trim().slice(0, 200);
    }

    function getCinebyHandoffFailureMessage() {
        return cinebyHandoffFailure === 'pending'
            ? 'Another Cineby title is still opening. Wait for that tab, then try again.'
            : 'Could not prepare the Cineby title handoff. Check userscript storage permissions or quota.';
    }

    function storeCinebyQuery(title) {
        cinebyHandoffFailure = '';
        const normalized = String(title || '').trim().slice(0, 200);
        if (!normalized) {
            cinebyHandoffFailure = 'invalid';
            return false;
        }
        try {
            if (parseCinebyQuery(GM_getValue(CINEBY_QUERY_KEY, ''))) {
                cinebyHandoffFailure = 'pending';
                return false;
            }
            GM_setValue(CINEBY_QUERY_KEY, JSON.stringify({ title:normalized, ts:Date.now() }));
            return true;
        } catch {
            cinebyHandoffFailure = 'storage';
            return false;
        }
    }

    function takeCinebyQuery() {
        const legacyKey = 'movieTitle';
        let raw = '';
        try { raw = GM_getValue(CINEBY_QUERY_KEY, '') || GM_getValue(legacyKey, ''); }
        catch { return ''; }
        clearCinebyQueryKey(CINEBY_QUERY_KEY);
        clearCinebyQueryKey(legacyKey);
        return parseCinebyQuery(raw, true);
    }

    function normalizeSite(site, fallbackColor = '#6366f1', fallbackCategory = 'other') {
        const name = String(site?.name || '').trim().slice(0, 40);
        const url = normalizeUrlTemplate(site?.url);
        if (!name || !url) return null;
        const storeQuery = isCinebyHandoffUrl(url);
        let movieOnly = false;
        try {
            const hostname = new URL(url).hostname.toLowerCase();
            if (hostname === 'letterboxd.com' || hostname.endsWith('.letterboxd.com')) movieOnly = true;
        } catch { /* URL validity was already checked above */ }
        return {
            name,
            url,
            color: normalizeColor(site?.color, fallbackColor),
            category: normalizeSiteCategory(site?.category, storeQuery ? 'watch' : fallbackCategory),
            enabled: site?.enabled !== false,
            ...(storeQuery ? { storeQuery:true } : {}),
            ...(movieOnly ? { movieOnly:true } : {}),
        };
    }

    function filterSitesForMediaType(sites, tv = isTVType()) {
        return sites.filter(site => !(tv && site.movieOnly));
    }

    function normalizeLocalServiceUrl(value) {
        const raw = String(value || '').trim();
        if (!raw || raw.length > SETTING_TEXT_LIMIT) return '';
        const normalized = normalizeServarrBaseUrl(raw);
        return isLocalServiceUrl(normalized) ? normalized : '';
    }

    function normalizeCredentialValue(value) {
        const credential = String(value || '').trim();
        if (!credential || credential.length > SETTING_TEXT_LIMIT || /[\u0000-\u001f\u007f]/.test(credential)) return '';
        return credential;
    }

    function normalizeImportedSetting(key, value) {
        if (!Object.prototype.hasOwnProperty.call(DEFAULTS, key)) return null;
        const fallback = DEFAULTS[key];

        if (key === 'themeVariant') {
            return ['dark', 'oled', 'midnight', 'light', 'highContrast'].includes(value)
                ? { key, value }
                : null;
        }
        if (key === 'cinebyHost') {
            const normalized = normalizeUrlTemplate(value);
            return CINEBY_HOSTS.some(host => host.url === normalized)
                ? { key, value:normalized }
                : null;
        }
        if (LOCAL_SERVICE_URL_KEYS.has(key)) {
            if (typeof value !== 'string') return null;
            const raw = value.trim();
            const normalized = normalizeLocalServiceUrl(raw);
            return !raw || normalized ? { key, value:normalized } : null;
        }
        if (POSITIVE_INTEGER_SETTING_KEYS.has(key)) {
            if (value === '') return { key, value:'' };
            const number = Number(value);
            return Number.isSafeInteger(number) && number > 0
                ? { key, value:String(number) }
                : null;
        }
        if (CREDENTIAL_SETTING_KEYS.has(key)) {
            if (typeof value !== 'string') return null;
            const raw = value.trim();
            const normalized = normalizeCredentialValue(raw);
            return !raw || normalized ? { key, value:normalized } : null;
        }
        if (key === 'sectionCollapseState') {
            if (!value || Array.isArray(value) || typeof value !== 'object') return null;
            const normalized = normalizeSectionCollapseState(value);
            return Object.keys(value).length && !Object.keys(normalized).length
                ? null
                : { key, value:normalized };
        }
        if (key === 'userMarks') {
            if (!value || Array.isArray(value) || typeof value !== 'object') return null;
            return { key, value:Object.fromEntries(normalizeUserMarkEntries(value)) };
        }
        if (typeof fallback === 'boolean') {
            return typeof value === 'boolean' ? { key, value } : null;
        }
        if (Array.isArray(fallback)) {
            if (!Array.isArray(value)) return null;
            const limited = value.slice(0, SITE_LIST_LIMIT);
            const fallbackCategory = key === 'watchSites' ? 'watch' : 'other';
            const normalized = limited.map(site => normalizeSite(site, '#6366f1', fallbackCategory)).filter(Boolean);
            if (normalized.length !== limited.length) return null;
            return {
                key,
                value:normalized,
            };
        }
        if (typeof fallback === 'string') {
            return typeof value === 'string' ? { key, value:value.slice(0, SETTING_TEXT_LIMIT) } : null;
        }
        return null;
    }

    function prepareSettingsImport(data) {
        if (!data || Array.isArray(data) || typeof data !== 'object') {
            throw new Error('Settings JSON must be an object.');
        }
        const entries = [];
        let ignored = 0;
        Object.entries(data).forEach(([key, value]) => {
            const normalized = normalizeImportedSetting(key, value);
            if (normalized) entries.push(normalized);
            else ignored++;
        });
        if (!entries.length) throw new Error('No valid recognized settings were found.');
        return { entries, ignored };
    }

    function cloneSettingValue(value) {
        if (Array.isArray(value)) return value.map(cloneSettingValue);
        if (value && typeof value === 'object') {
            return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, cloneSettingValue(nested)]));
        }
        return value;
    }

    function getDefaultSettingsEntries() {
        return Object.entries(DEFAULTS).map(([key, value]) => ({ key, value:cloneSettingValue(value) }));
    }

    function getExportSettings() {
        const data = {};
        Object.keys(DEFAULTS).forEach(key => {
            let current = get(key);
            if (key === 'userMarks') current = getUserMarks();
            else if (key === 'sectionCollapseState') current = getSectionCollapseState();
            else if (key === 'watchSites') current = getSiteList(key, DEFAULT_WATCH_SITES);
            else if (key === 'externalSites') current = getSiteList(key, DEFAULT_EXTERNAL_SITES);
            const normalized = normalizeImportedSetting(key, current);
            data[key] = cloneSettingValue(normalized ? normalized.value : DEFAULTS[key]);
        });
        return data;
    }

    function applySettingsImport(entries) {
        let snapshots;
        try {
            const storedKeys = typeof GM_listValues === 'function' ? new Set(GM_listValues()) : null;
            snapshots = new Map(entries.map(({ key }) => [key, {
                exists:storedKeys ? storedKeys.has(PREFIX + key) : true,
                value:get(key),
            }]));
        } catch {
            throw new Error('Current settings could not be read; no changes were made.');
        }

        const touched = [];
        try {
            entries.forEach(({ key, value }) => {
                touched.push(key);
                GM_setValue(PREFIX + key, value);
            });
        } catch (cause) {
            let rollbackFailed = false;
            [...touched].reverse().forEach(key => {
                try {
                    const snapshot = snapshots.get(key);
                    if (!snapshot.exists && typeof GM_deleteValue === 'function') GM_deleteValue(PREFIX + key);
                    else GM_setValue(PREFIX + key, snapshot.value);
                }
                catch { rollbackFailed = true; }
            });
            console.warn('[IMDb Enhanced] settings import write failed:', cause);
            try { document.dispatchEvent(new CustomEvent('imdb-enhanced:settings-save-failed')); }
            catch { /* rollback result is reported by the caller */ }
            throw new Error(rollbackFailed
                ? 'Import failed and automatic recovery was incomplete. Reload before changing settings.'
                : 'Import could not be saved; previous settings were restored.');
        }

        entries.forEach(({ key }) => {
            if (key === 'userMarks') userMarksCache = null;
            try {
                document.dispatchEvent(new CustomEvent('imdb-enhanced:settings-saved', { detail:{ key } }));
            } catch { /* persistence succeeded; notification is best-effort */ }
        });
        return entries.length;
    }

    function getSiteList(key, defaults) {
        const value = get(key);
        const fallbackCategory = key === 'watchSites' ? 'watch' : 'other';
        if (Array.isArray(value)) return value.slice(0, SITE_LIST_LIMIT).map(site => normalizeSite(site, '#6366f1', fallbackCategory)).filter(Boolean);
        return defaults.slice(0, SITE_LIST_LIMIT).map(site => normalizeSite(site, '#6366f1', fallbackCategory)).filter(Boolean);
    }

    function setSiteList(key, sites, notifyFailure = true) {
        const fallbackCategory = key === 'watchSites' ? 'watch' : 'other';
        const normalized = sites.slice(0, SITE_LIST_LIMIT).map(site => normalizeSite(site, '#6366f1', fallbackCategory)).filter(Boolean);
        return trySaveSetting(key, normalized, { notify:notifyFailure });
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
    function getLinkedTitleId(href) {
        try {
            const path = new URL(href, location.origin || 'https://www.imdb.com').pathname;
            return path.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?title\/(tt\d+)\/?$/i)?.[1] || '';
        } catch { return ''; }
    }
    function getTitleText() {
        return (document.querySelector('[data-testid="hero__primary-text"]') ||
                document.querySelector('h1'))?.textContent?.trim() || '';
    }

    function appendBoundedObjectChildren(queue, node, limit) {
        if (!node || typeof node !== 'object') return;
        let inspected = 0;
        for (const key in node) {
            if (queue.length >= limit || inspected >= limit) break;
            inspected += 1;
            if (!Object.prototype.hasOwnProperty.call(node, key)) continue;
            const value = node[key];
            if (value && typeof value === 'object') queue.push(value);
        }
    }

    function toBoundedText(value, limit) {
        const text = typeof value === 'string' ? value : (value == null ? '' : String(value));
        return text.length <= limit ? text : '';
    }

    function getBoundedStructuredStrings(value, itemLimit, textLimit = STRUCTURED_DATA_CLASSIFICATION_TEXT_LIMIT) {
        const values = Array.isArray(value) ? value : [value];
        const strings = [];
        let totalLength = 0;
        for (let index = 0; index < values.length && index < itemLimit && totalLength < textLimit; index++) {
            const item = values[index];
            if (typeof item !== 'string' && typeof item !== 'number') continue;
            const text = String(item).trim();
            if (!text) continue;
            const bounded = text.slice(0, textLimit - totalLength);
            strings.push(bounded);
            totalLength += bounded.length;
        }
        return strings;
    }

    function parseIMDbTitleStructuredData(scriptTexts) {
        let fallback = null;
        let inspectedScripts = 0;
        for (const text of scriptTexts || []) {
            if (inspectedScripts >= STRUCTURED_DATA_SCRIPT_LIMIT) break;
            inspectedScripts += 1;
            let parsed;
            try {
                const source = toBoundedText(text, STRUCTURED_DATA_TEXT_LIMIT);
                if (!source) continue;
                parsed = JSON.parse(source);
            }
            catch { continue; }

            const queue = [parsed];
            for (let index = 0; index < queue.length && index < STRUCTURED_DATA_NODE_LIMIT; index++) {
                const node = queue[index];
                if (!node || typeof node !== 'object') continue;
                if (!Array.isArray(node)) {
                    const types = getBoundedStructuredStrings(node['@type'], STRUCTURED_DATA_TYPE_LIMIT);
                    if (types.some(type => ['Movie', 'TVSeries', 'TVEpisode', 'TVMiniSeries'].includes(type))) return node;
                    if (!fallback && node.name && (node.aggregateRating || node.datePublished || node.startDate)) fallback = node;
                }
                appendBoundedObjectChildren(queue, node, STRUCTURED_DATA_NODE_LIMIT);
            }
        }
        return fallback || {};
    }

    let _ldData = null;
    function getLDData() {
        if (_ldData) return _ldData;
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
            .slice(0, STRUCTURED_DATA_SCRIPT_LIMIT);
        const selected = parseIMDbTitleStructuredData(scripts.map(script => script.textContent));
        if (Object.keys(selected).length) _ldData = selected;
        return _ldData || {};
    }

    function yearFromText(text) {
        return String(text || '').match(/\b(18|19|20)\d{2}\b/)?.[0] || '';
    }

    function getStructuredTitleYear(ld) {
        for (const candidate of [ld?.datePublished, ld?.releaseDate, ld?.startDate, ld?.dateCreated]) {
            const year = yearFromText(candidate);
            if (year) return year;
        }
        const releaseEvents = Array.isArray(ld?.releasedEvent) ? ld.releasedEvent : [ld?.releasedEvent].filter(Boolean);
        for (let index = 0; index < releaseEvents.length && index < TITLE_YEAR_RELEASE_EVENT_LIMIT; index++) {
            const event = releaseEvents[index];
            for (const candidate of [event?.startDate, event?.endDate]) {
                const year = yearFromText(candidate);
                if (year) return year;
            }
        }
        return '';
    }

    function getTitleYear() {
        const ld = getLDData();
        const structuredYear = getStructuredTitleYear(ld);
        if (structuredYear) return structuredYear;

        const inlines = document.querySelectorAll('[data-testid="hero-subnav-bar-left-block"] a, section[data-testid="hero-parent"] a[href*="releaseinfo"], main h1 ~ ul a');
        let inspectedInlines = 0;
        for (const a of inlines) {
            if (inspectedInlines >= TITLE_YEAR_INLINE_LIMIT) break;
            inspectedInlines += 1;
            const match = a.textContent.match(/\b(19|20)\d{2}\b/);
            if (match) return match[0];
        }
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

    function getStructuredMediaType(ld) {
        const types = getBoundedStructuredStrings(ld?.['@type'], STRUCTURED_DATA_TYPE_LIMIT);
        if (types.includes('TVEpisode') || ld?.partOfSeries || ld?.partOfSeason) return 'episode';
        if (types.includes('TVSeries') || types.includes('TVMiniSeries')) {
            if (types.includes('TVMiniSeries')) return 'miniseries';
            const classification = [
                ...getBoundedStructuredStrings(ld?.name, 1),
                ...getBoundedStructuredStrings(ld?.description, 1),
                ...getBoundedStructuredStrings(ld?.keywords, STRUCTURED_DATA_CLASSIFICATION_ITEM_LIMIT),
            ];
            return classification.some(text => /mini[-\s]?series/i.test(text)) ? 'miniseries' : 'series';
        }
        const genres = getBoundedStructuredStrings(ld?.genre, STRUCTURED_DATA_CLASSIFICATION_ITEM_LIMIT);
        if (genres.some(genre => /short/i.test(genre))) return 'short';
        return 'movie';
    }

    function getMediaType() {
        return getStructuredMediaType(getLDData());
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

    function trySaveSetting(key, value, { notify = true } = {}) {
        try { return set(key, value); }
        catch (error) {
            if (notify) {
                console.warn(`[IMDb Enhanced] setting write failed (${key}):`, error);
                showToast('Could not save locally. Check userscript storage permissions or quota.', 4500);
            }
            try { document.dispatchEvent(new CustomEvent('imdb-enhanced:settings-save-failed', { detail:{ key } })); }
            catch { /* the write result is still returned to its control */ }
            return false;
        }
    }

    function copyTextToClipboard(text) {
        try {
            GM_setClipboard(String(text ?? ''));
            return true;
        } catch (error) {
            console.warn('[IMDb Enhanced] clipboard write failed:', error);
            return false;
        }
    }

    // =========================================================================
    //  ASYNC HTTP
    // =========================================================================
    function httpRequest(url, opts = {}) {
        return new Promise((resolve, reject) => {
            const {
                body,
                cancelOnRouteChange = false,
                headers: providedHeaders = {},
                ...requestOptions
            } = opts;
            const hasBody = body !== undefined;
            const headers = {
                ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
                ...providedHeaders,
            };
            let settled = false;
            let requestHandle = null;
            const finish = (handler, value) => {
                if (settled) return;
                settled = true;
                pendingRouteWorkCancels.delete(cancel);
                handler(value);
            };
            const cancel = () => {
                try { requestHandle?.abort?.(); } catch { /* request still rejects below */ }
                finish(reject, new Error('Route changed'));
            };
            if (cancelOnRouteChange) pendingRouteWorkCancels.add(cancel);
            try {
                requestHandle = GM_xmlhttpRequest({
                    ...requestOptions,
                    method: requestOptions.method || 'GET',
                    url,
                    anonymous: true,
                    timeout: requestOptions.timeout || 10000,
                    headers,
                    data: hasBody ? JSON.stringify(body) : requestOptions.data,
                    onload: r => finish(r.status >= 400 ? reject : resolve, r),
                    onerror: error => finish(reject, error),
                    ontimeout: error => finish(reject, error),
                    onabort: error => finish(reject, error || new Error('Request aborted')),
                });
            } catch (error) {
                finish(reject, error);
            }
        });
    }
    function httpGet(url, opts = {}) {
        return httpRequest(url, { ...opts, method: 'GET' });
    }
    function parseJSONResponse(response, maxLength = LOCAL_RESPONSE_TEXT_LIMIT) {
        const raw = typeof response?.responseText === 'string' ? response.responseText : '';
        if (raw.length > maxLength) throw new Error('Response was too large');
        try { return JSON.parse(raw || 'null'); }
        catch { throw new Error('Response was not valid JSON'); }
    }
    function normalizeRequestErrorText(value) {
        if (typeof value !== 'string' && typeof value !== 'number') return '';
        return String(value).trim().replace(/\s+/g, ' ').slice(0, REQUEST_ERROR_TEXT_LIMIT);
    }
    function getRequestErrorMessage(error) {
        const responseText = typeof error?.responseText === 'string' ? error.responseText : '';
        if (responseText && responseText.length <= 100000) {
            try {
                const body = JSON.parse(responseText);
                const candidates = Array.isArray(body)
                    ? [body[0]?.errorMessage, body[0]?.message]
                    : [body?.message, body?.errorMessage, body?.error?.message, body?.error];
                for (const candidate of candidates) {
                    const message = normalizeRequestErrorText(candidate);
                    if (message) return message;
                }
            } catch { /* use status fallback */ }
        }
        const status = Number(error?.status);
        if (Number.isInteger(status) && status >= 100 && status <= 599) return `HTTP ${status}`;
        return normalizeRequestErrorText(error?.message) || 'Request failed';
    }
    function normalizeServarrBaseUrl(value) {
        const raw = String(value || '').trim().replace(/\/+$/, '');
        if (!raw) return '';
        try {
            const url = new URL(raw);
            if (!/^https?:$/i.test(url.protocol) || url.username || url.password || url.search || url.hash) return '';
            return url.href.replace(/\/+$/, '');
        } catch { return ''; }
    }
    function isLocalServiceUrl(baseUrl) {
        try {
            const url = new URL(baseUrl);
            const host = url.hostname.toLowerCase();
            return /^https?:$/i.test(url.protocol)
                && (host === 'localhost' || host === '127.0.0.1')
                && !url.username && !url.password && !url.search && !url.hash;
        } catch { return false; }
    }
    function isLocalServarrUrl(baseUrl) {
        return isLocalServiceUrl(baseUrl);
    }
    function toPositiveInteger(value, fallback = 1) {
        const parsed = Number(value);
        return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
    }
    function getServarrConfig(kind) {
        const prefix = kind === 'sonarr' ? 'sonarr' : 'radarr';
        const baseUrl = normalizeLocalServiceUrl(get(`${prefix}Url`));
        return {
            kind: prefix,
            baseUrl,
            apiKey: normalizeCredentialValue(get(`${prefix}ApiKey`)),
            rootFolderPath: String(get(`${prefix}RootFolderPath`) || '').trim().slice(0, SETTING_TEXT_LIMIT),
            qualityProfileId: toPositiveInteger(get(`${prefix}QualityProfileId`), 0),
        };
    }
    function isServarrConfigured(kind) {
        const cfg = getServarrConfig(kind);
        return Boolean(cfg.baseUrl && cfg.apiKey && cfg.rootFolderPath && cfg.qualityProfileId);
    }
    function getServarrAddOptions(item) {
        return item?.addOptions && typeof item.addOptions === 'object' && !Array.isArray(item.addOptions)
            ? item.addOptions
            : {};
    }
    function buildRadarrAddBody(item, cfg) {
        const source = item && typeof item === 'object' && !Array.isArray(item) ? item : {};
        return {
            ...source,
            monitored: true,
            qualityProfileId: cfg.qualityProfileId,
            rootFolderPath: cfg.rootFolderPath,
            minimumAvailability: source.minimumAvailability || 'released',
            addOptions: { ...getServarrAddOptions(source), searchForMovie:true },
        };
    }
    function buildSonarrAddBody(item, cfg) {
        const source = item && typeof item === 'object' && !Array.isArray(item) ? item : {};
        const seasons = Array.isArray(source.seasons)
            ? source.seasons.slice(0, SERVARR_SEASON_LIMIT)
                .filter(season => season && typeof season === 'object' && !Array.isArray(season))
                .map(season => ({ ...season, monitored:true }))
            : [];
        return {
            ...source,
            monitored: true,
            seasonFolder: true,
            qualityProfileId: cfg.qualityProfileId,
            rootFolderPath: cfg.rootFolderPath,
            seasons,
            addOptions: {
                ...getServarrAddOptions(source),
                monitor: 'all',
                searchForMissingEpisodes: true,
            },
        };
    }
    /* Overseerr and Jellyseerr expose the same v1 API, and a request there is often
       what a user actually wants: it goes through their approval workflow instead
       of writing straight into Radarr/Sonarr. The instance also resolves an IMDb ID
       to TMDB itself, so this integration needs no third-party API key of its own.
       Media status uses Overseerr's documented enum. */
    const SEERR_STATUS = { UNKNOWN:1, PENDING:2, PROCESSING:3, PARTIALLY_AVAILABLE:4, AVAILABLE:5 };
    const SEERR_SEASON_LIMIT = 100;

    function getSeerrConfig() {
        return {
            baseUrl: normalizeLocalServiceUrl(get('seerrUrl')),
            apiKey: normalizeCredentialValue(get('seerrApiKey')),
        };
    }
    function isSeerrConfigured() {
        const cfg = getSeerrConfig();
        return Boolean(cfg.baseUrl && cfg.apiKey);
    }
    function mapSeerrMediaState(mediaInfo) {
        const status = Number(mediaInfo?.status) || 0;
        if (status === SEERR_STATUS.AVAILABLE) return 'library';
        if (status === SEERR_STATUS.PARTIALLY_AVAILABLE) return 'partial';
        if (status === SEERR_STATUS.PROCESSING) return 'processing';
        if (status === SEERR_STATUS.PENDING) return 'queued';
        return 'add';
    }
    function selectSeerrSearchResult(results, imdbId, mediaType) {
        if (!Array.isArray(results)) return null;
        const wanted = mediaType === 'tv' ? 'tv' : 'movie';
        for (const item of results.slice(0, EXTERNAL_RESULT_SCAN_LIMIT)) {
            if (!item || typeof item !== 'object') continue;
            if (String(item.mediaType || '').toLowerCase() !== wanted) continue;
            const id = Number(item.id);
            if (!Number.isInteger(id) || id <= 0) continue;
            return { tmdbId:id, mediaInfo:item.mediaInfo || null };
        }
        return null;
    }
    function buildSeerrRequestBody(mediaType, tmdbId, seasons = []) {
        const id = Number(tmdbId);
        if (!Number.isInteger(id) || id <= 0) return null;
        const body = { mediaType: mediaType === 'tv' ? 'tv' : 'movie', mediaId:id };
        if (body.mediaType === 'tv') {
            const list = Array.isArray(seasons)
                ? [...new Set(seasons.map(Number).filter(value => Number.isInteger(value) && value > 0))].slice(0, SEERR_SEASON_LIMIT)
                : [];
            body.seasons = list.length ? list : 'all';
        }
        return body;
    }
    async function seerrRequest(path, opts = {}) {
        const cfg = getSeerrConfig();
        if (!isLocalServarrUrl(cfg.baseUrl)) {
            throw new Error('Only localhost and 127.0.0.1 Overseerr/Jellyseerr URLs are allowed by this userscript build.');
        }
        return httpRequest(buildLocalServiceUrl(cfg.baseUrl, `api/v1/${String(path).replace(/^\/+/, '')}`, opts.query), {
            method: opts.method || 'GET',
            body: opts.body,
            timeout: opts.timeout || 15000,
            cancelOnRouteChange: Boolean(opts.cancelOnRouteChange),
            headers: {
                Accept: 'application/json',
                'X-Api-Key': cfg.apiKey,
                ...(opts.body ? { 'Content-Type':'application/json' } : {}),
                ...(opts.headers || {}),
            },
        });
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
            cancelOnRouteChange: Boolean(opts.cancelOnRouteChange),
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
            baseUrl: normalizeLocalServiceUrl(get(def.urlKey)),
            token: normalizeCredentialValue(get(def.tokenKey)),
        };
    }
    function getConfiguredMediaServers() {
        return ['plex', 'jellyfin', 'emby']
            .map(getMediaServerConfig)
            .filter(cfg => cfg?.baseUrl && cfg.token);
    }
    function normalizeIMDbProviderId(value) {
        const source = toBoundedText(value, PROVIDER_ID_TEXT_LIMIT);
        return source.match(/tt\d+/i)?.[0]?.toLowerCase() || '';
    }
    function normalizeLookupTitle(value) {
        const source = toBoundedText(value, LOOKUP_TITLE_TEXT_LIMIT);
        if (!source) return '';
        return source
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/&/g, ' and ')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }
    function collectProviderIds(item = {}) {
        const ids = [
            item.imdbId, item.imdbID, item.ImdbId,
            item.guid, item.Guid, item.key, item.ratingKey,
        ].filter(Boolean);
        const providerIds = item.providerIds || item.ProviderIds;
        if (Array.isArray(providerIds)) {
            ids.push(...providerIds.slice(0, Math.max(0, LOCAL_PROVIDER_ID_LIMIT - ids.length)));
        } else if (providerIds && typeof providerIds === 'object') {
            for (const key in providerIds) {
                if (!Object.prototype.hasOwnProperty.call(providerIds, key)) continue;
                ids.push(providerIds[key]);
                if (ids.length >= LOCAL_PROVIDER_ID_LIMIT) break;
            }
        }
        return ids.slice(0, LOCAL_PROVIDER_ID_LIMIT).map(normalizeIMDbProviderId).filter(Boolean);
    }
    function mediaItemMatches(item, ctx) {
        const imdbId = normalizeIMDbProviderId(ctx?.imdbId);
        const itemProviderIds = collectProviderIds(item);
        if (imdbId && itemProviderIds.length) return itemProviderIds.includes(imdbId);

        const itemTitle = normalizeLookupTitle(item?.title || item?.Name || item?.name || item?.OriginalTitle);
        const wantedTitle = normalizeLookupTitle(ctx?.title);
        if (!itemTitle || itemTitle !== wantedTitle) return false;

        const itemYear = Number(item?.year || item?.ProductionYear || item?.productionYear) || 0;
        const wantedYear = Number(ctx?.year) || 0;
        return !wantedYear || Boolean(itemYear) && Math.abs(itemYear - wantedYear) <= 1;
    }
    function selectServarrLookupResult(items, ctx, requireExisting = false) {
        if (!Array.isArray(items)) return null;
        return items.slice(0, LOCAL_LOOKUP_RESULT_LIMIT).find(item =>
            (!requireExisting || toPositiveInteger(item?.id, 0) > 0)
            && mediaItemMatches(item, ctx)
        ) || null;
    }
    function parsePlexItems(xmlText) {
        try {
            const source = toBoundedText(xmlText, LOCAL_RESPONSE_TEXT_LIMIT);
            if (!source) return [];
            const doc = new DOMParser().parseFromString(source, 'application/xml');
            const nodes = doc.querySelectorAll('Video,Directory');
            const items = [];
            for (let index = 0; index < nodes.length && index < LOCAL_LOOKUP_RESULT_LIMIT; index++) {
                const node = nodes[index];
                const providerIds = [toBoundedText(node.getAttribute('guid'), PROVIDER_ID_TEXT_LIMIT)];
                const guids = node.querySelectorAll('Guid');
                for (let guidIndex = 0; guidIndex < guids.length && guidIndex < LOCAL_PROVIDER_ID_LIMIT - 1; guidIndex++) {
                    providerIds.push(toBoundedText(guids[guidIndex].getAttribute('id'), PROVIDER_ID_TEXT_LIMIT));
                }
                items.push({
                    title:toBoundedText(
                        node.getAttribute('title') || node.getAttribute('originalTitle'),
                        LOOKUP_TITLE_TEXT_LIMIT
                    ),
                    year: Number(node.getAttribute('year')) || 0,
                    providerIds,
                });
            }
            return items;
        } catch { return []; }
    }
    function parseMediaServerItems(payload) {
        try {
            const source = typeof payload === 'string' ? toBoundedText(payload, LOCAL_RESPONSE_TEXT_LIMIT) : null;
            if (typeof payload === 'string' && !source) return [];
            const data = source !== null ? JSON.parse(source || '{}') : (payload || {});
            const items = Array.isArray(data) ? data : (Array.isArray(data.Items) ? data.Items : []);
            return items.slice(0, LOCAL_LOOKUP_RESULT_LIMIT).map(item => ({
                title:toBoundedText(item.Name || item.OriginalTitle || item.SeriesName, LOOKUP_TITLE_TEXT_LIMIT),
                year: Number(item.ProductionYear) || 0,
                providerIds: collectProviderIds(item),
            }));
        } catch { return []; }
    }
    async function mediaServerRequest(cfg, path, opts = {}) {
        if (!isLocalServiceUrl(cfg.baseUrl)) {
            throw new Error('Only localhost and 127.0.0.1 media server URLs are allowed by this userscript build.');
        }
        const query = { ...(opts.query || {}) };
        const headers = cfg.kind === 'plex'
            ? { Accept:'application/xml', 'X-Plex-Token':cfg.token, ...(opts.headers || {}) }
            : { Accept:'application/json', 'X-Emby-Token': cfg.token, ...(opts.headers || {}) };
        return httpRequest(buildLocalServiceUrl(cfg.baseUrl, path, query), {
            method: opts.method || 'GET',
            timeout: opts.timeout || 12000,
            cancelOnRouteChange: Boolean(opts.cancelOnRouteChange),
            headers,
        });
    }

    // =========================================================================
    //  FEATURE REGISTRY
    // =========================================================================
    const features = [];
    const featureGenerations = new WeakMap();
    function reg(f) { features.push(f); }
    function advanceFeatureGeneration(feature) {
        const generation = (featureGenerations.get(feature) || 0) + 1;
        featureGenerations.set(feature, generation);
        return generation;
    }
    function stopFeature(feature) {
        advanceFeatureGeneration(feature);
        feature.destroy?.();
    }
    function startFeature(feature, { context = 'init', notify = false } = {}) {
        const generation = advanceFeatureGeneration(feature);
        const report = error => {
            console.warn(`[IMDb Enhanced] ${context} ${feature.key}:`, error);
            if (notify) showToast(`${feature.name} could not start. Reload and try again.`, 4500);
        };
        const rejectCurrentGeneration = error => {
            if (featureGenerations.get(feature) === generation) {
                advanceFeatureGeneration(feature);
                try { feature.destroy?.(); }
                catch (cleanupError) { console.warn(`[IMDb Enhanced] cleanup ${feature.key}:`, cleanupError); }
            }
            report(error);
        };
        try {
            const pending = feature.init();
            if (pending && typeof pending.catch === 'function') pending.catch(rejectCurrentGeneration);
            return true;
        } catch (error) {
            rejectCurrentGeneration(error);
            return false;
        }
    }

    // #########################################################################
    //
    //  CLEANUP FEATURES
    //
    // #########################################################################

    reg({
        key: 'removeAds', name: 'Hide ads and sponsored shells', group: 'Cleanup',
        init() { injectEarlyAdShell(); },
        destroy() {
            if (get('removeAds')) return;
            removeCSS('enh-early-ad-shell');
            setAdRequestBlocking(false);
        }
    });

    reg({
        key: 'removeProUpsell', name: 'Hide IMDbPro upsells', group: 'Cleanup',
        css: `[data-testid="hero-subnav-bar-imdb-pro-link"],[data-testid="hero-proupsell"],
            a[href*="pro.imdb.com"],[class*="ProUpsell"],[class*="proupsell"]{display:none!important}`,
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
        css: `.footer__app,.imdb-footer__open-in-app-button,[class*="AppBanner"]{display:none!important}`,
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
            tx2:    '#aaaab8',  // secondary / muted
            tx3:    '#9090a2',  // tertiary text
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
            heroScrim: 'rgba(16,16,20,0.86)',
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
            tx2:    '#a0a0b0',
            tx3:    '#8b8b9c',
            accent: '#f5c518',
            accentMuted: 'rgba(245,197,24,0.10)',
            accentBorder: 'rgba(245,197,24,0.18)',
            blue:   '#3d98e0',
            blueHi: '#6cb8ff',
            blueMuted: 'rgba(61,152,224,0.08)',
            red:    '#d63850',
            redMuted: 'rgba(214,56,80,0.08)',
            green:  '#30c47c',
            heroScrim: 'rgba(0,0,0,0.90)',
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
            tx2:    '#a0acce',
            tx3:    '#939fc5',
            accent: '#f5c518',
            accentMuted: 'rgba(245,197,24,0.10)',
            accentBorder: 'rgba(245,197,24,0.20)',
            blue:   '#5eaaff',
            blueHi: '#8ec8ff',
            blueMuted: 'rgba(94,170,255,0.10)',
            red:    '#f06070',
            redMuted: 'rgba(240,96,112,0.10)',
            green:  '#48e098',
            heroScrim: 'rgba(10,14,28,0.88)',
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
            tx2:    '#475569',
            tx3:    '#536175',
            accent: '#a76500',
            accentMuted: 'rgba(167,101,0,0.12)',
            accentBorder: 'rgba(167,101,0,0.28)',
            blue:   '#0f6fbf',
            blueHi: '#07599c',
            blueMuted: 'rgba(15,111,191,0.10)',
            red:    '#b91c1c',
            redMuted: 'rgba(185,28,28,0.10)',
            green:  '#047857',
            heroScrim: 'rgba(246,247,249,0.84)',
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
            heroScrim: 'rgba(0,0,0,0.94)',
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
    function applyThemeStyles(options = {}) {
        if (!isIMDbHost()) return;
        const activeId = getActiveThemeId();
        if (get('modernUI')) addCSS(getThemeCSS(activeId), 'enh-modernUI');
        else {
            removeCSS('enh-modernUI');
            removeCSS('enh-early-shell');
            delete document.documentElement.dataset.imdbEnhanced;
        }
        injectGlobalStyles();
        injectEarlyThemeShell();
        if (options.refreshDependent !== false) refreshThemedStyles();
        updateThemeControls(activeId);
    }
    function setupThemeAutoSync() {
        if (!isIMDbHost() || setupThemeAutoSync._done || typeof window.matchMedia !== 'function') return;
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

/* Keep IMDb's own component tokens in the selected palette. IMDb scopes many
   of these variables to native surfaces, so body color alone cannot prevent
   white cards with black text from leaking into a dark theme. */
html[data-imdb-enhanced="active"] {
    --ipt-base-bg: ${t.bg};
    --ipt-base-color: ${t.bg};
    --ipt-base-shade1-bg: ${t.sf1};
    --ipt-base-shade1-color: ${t.sf1};
    --ipt-base-shade2-bg: ${t.sf2};
    --ipt-base-shade2-color: ${t.sf2};
    --ipt-base-shade3-bg: ${t.sf1};
    --ipt-base-shade3-color: ${t.sf1};
    --ipt-baseAlt-bg: ${t.sf0};
    --ipt-baseAlt-color: ${t.sf0};
    --ipt-baseAlt-shade1-bg: ${t.sf1};
    --ipt-baseAlt-shade1-color: ${t.sf1};
    --ipt-baseAlt-shade2-bg: ${t.sf2};
    --ipt-baseAlt-shade2-color: ${t.sf2};
    --ipt-baseAlt-shade3-bg: ${t.sf1};
    --ipt-baseAlt-shade3-color: ${t.sf1};
    --ipt-on-base-color: ${t.tx0};
    --ipt-on-base-textPrimary-color: ${t.tx0};
    --ipt-on-base-textSecondary-color: ${t.tx1};
    --ipt-on-base-textHint-color: ${t.tx2};
    --ipt-on-base-textDisabled-color: ${t.tx3};
    --ipt-on-baseAlt-color: ${t.tx0};
    --ipt-on-baseAlt-textPrimary-color: ${t.tx0};
    --ipt-on-baseAlt-textSecondary-color: ${t.tx1};
    --ipt-on-baseAlt-textHint-color: ${t.tx2};
    --ipt-on-baseAlt-textDisabled-color: ${t.tx3};
    --ipt-on-baseAlt-accent2-color: ${t.blue};
    --ipc-pageSection-base-bg: ${t.sf0};
    --ipc-pageSection-baseAlt-bg: ${t.sf0};
    --ipc-listCard-base-bg: ${t.sf1};
    --ipc-listCard-baseAlt-bg: ${t.sf0};
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
    position: relative !important;
    background: ${t.bg} !important;
    border-radius: 0 !important;
    padding-top: 30px !important;
    padding-bottom: 28px !important;
    border-bottom: 1px solid ${t.bd0} !important;
    box-shadow: inset 0 -18px 34px -34px ${t.tx0} !important;
}
section[data-testid="hero-parent"]::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background-image: linear-gradient(90deg, ${t.bg} 0%, color-mix(in srgb, ${t.bg} 88%, transparent) 40%, color-mix(in srgb, ${t.bg} 28%, transparent) 100%), var(--enh-hero-backdrop, none);
    background-position: center, center;
    background-size: 100% 100%, cover;
    opacity: .36;
    filter: saturate(.82) contrast(.96);
}
section[data-testid="hero-parent"] > * { position: relative; z-index: 1; }
section[data-testid="hero-parent"] [data-testid="hero__pageTitle"] {
    max-width: min(100%, 820px) !important;
    margin-bottom: 16px !important;
}
section[data-testid="hero-parent"] [data-testid="hero__primary-text"] {
    font-size: clamp(42px, 5vw, 72px) !important;
    font-weight: 800 !important;
    letter-spacing: -0.045em !important;
    line-height: .98 !important;
}
section[data-testid="hero-parent"] [data-testid="hero-media__poster"] {
    border-radius: 12px !important;
    overflow: hidden !important;
}
section[data-testid="hero-parent"] [data-testid="hero-media__poster"] img {
    border-radius: 12px !important;
    box-shadow: 0 18px 42px rgba(0,0,0,.34) !important;
}

/* Transparent base sections (prevent double-backgrounds) */
section.ipc-page-section.ipc-page-section--base { background: transparent !important; }
section.ipc-page-section.ipc-page-section--none { background: transparent !important; }

/* Native page surfaces and cards. These stable IMDb primitives are shared by
   cast, user-list, poll, recommendation, and sidebar content. */
section.ipc-page-section--baseAlt:not([data-testid="hero-parent"]),
div.ipc-page-section--baseAlt {
    background: ${t.sf0} !important;
    color: ${t.tx1} !important;
    border-color: ${t.bd1} !important;
}
.ipc-list-card,
.ipc-slate-card,
.ipc-poster-card,
.ipc-primary-image-list-card {
    background: ${t.sf0} !important;
    background-color: ${t.sf0} !important;
    color: ${t.tx1} !important;
    border-color: ${t.bd1} !important;
}
.ipc-list-card:hover,
.ipc-slate-card:hover,
.ipc-poster-card:hover,
.ipc-primary-image-list-card:hover {
    background-color: ${t.sf1} !important;
}
.ipc-list-card .text-on-light,
.ipc-slate-card .text-on-light,
.ipc-primary-image-list-card .text-on-light,
.ipc-list-card [class*="metadata"],
.ipc-list-card [class*="description"],
.ipc-list-card [class*="secondary"],
.ipc-slate-card [class*="metadata"],
.ipc-slate-card [class*="description"],
.ipc-slate-card [class*="secondary"],
.ipc-primary-image-list-card__content,
.ipc-primary-image-list-card__title-metadata,
.ipc-primary-image-list-card__secondary-text--attribute {
    color: ${t.tx2} !important;
}
.ipc-list-card a,
.ipc-slate-card a,
.ipc-primary-image-list-card a,
.ipc-primary-image-list-card__secondary-text--clickable {
    color: ${t.blue} !important;
}
.ipc-list-card h3,
.ipc-list-card h3 *,
.ipc-list-card .ipc-title__text,
.ipc-list-card [class*="list-card__title"],
.ipc-list-card [class*="title-text"],
.ipc-slate-card h3,
.ipc-slate-card h3 *,
.ipc-slate-card .ipc-title__text,
.ipc-slate-card [class*="slate-card__title"],
.ipc-slate-card [class*="title-text"],
.ipc-primary-image-list-card__title {
    color: ${t.tx0} !important;
}
.ipc-list-card h3:hover,
.ipc-list-card h3:hover *,
.ipc-list-card [class*="title"]:hover,
.ipc-slate-card h3:hover,
.ipc-slate-card h3:hover *,
.ipc-slate-card [class*="title"]:hover,
.ipc-primary-image-list-card__title:hover {
    color: ${t.blueHi} !important;
}
.ipc-btn--core-base,
.ipc-btn--core-baseAlt {
    background: ${t.sf1} !important;
    border-color: ${t.bd1} !important;
    color: ${t.tx1} !important;
}

/* Cast cards use generated classes for the text, so anchor inheritance is
   intentionally pinned to stable data-testid/class hooks. */
[data-testid="title-cast-item__actor"] {
    color: ${t.tx0} !important;
}
[data-testid="title-cast-item__actor"]:hover {
    color: ${t.blueHi} !important;
}
[data-testid="title-cast-item"] .title-cast-item__characters-list,
[data-testid="title-cast-item"] .title-cast-item__characters-list * {
    color: ${t.blue} !important;
}
[data-testid="title-cast-item"] [data-testid*="eps-toggle"],
[data-testid="title-cast-item"] > div:last-child span {
    color: ${t.tx2} !important;
}

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
        if (!isIMDbHost() || !get('modernUI')) return;
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
        init() {
            injectEarlyThemeShell();
            applyThemeStyles({ refreshDependent: false });
            const isCurrent = createFeatureGuard(this);
            waitForTitleSurface().then(() => {
                if (!isCurrent()) return;
                const hero = document.querySelector('section[data-testid="hero-parent"]');
                const poster = hero?.querySelector('[data-testid="hero-media__poster"] img');
                const source = poster?.currentSrc || poster?.src || '';
                if (!hero || !source) return;
                try {
                    const url = new URL(source, location.href);
                    if (!/^https?:$/.test(url.protocol)) return;
                    const escaped = url.href.replace(/["\\)]/g, character => `\\${character}`);
                    hero.style.setProperty('--enh-hero-backdrop', `url("${escaped}")`);
                    this._heroBackdrop = hero;
                } catch { /* an unavailable poster should not block the title surface */ }
            }).catch(() => {});
        },
        destroy() {
            this._heroBackdrop?.style.removeProperty('--enh-hero-backdrop');
            this._heroBackdrop = null;
            removeCSS('enh-modernUI');
            removeCSS('enh-early-shell');
            delete document.documentElement.dataset.imdbEnhanced;
        }
    });

    reg({
        key: 'editorialTitleSurface', name: 'Editorial title layout', group: 'Appearance',
        _observer: null,
        _surface: null,
        _nativeHero: null,
        _nativeRatingState: [],
        _syncQueued: false,
        init() {
            if (!isIMDbHost() || getPageSurface() !== 'title') return;
            const isCurrent = createFeatureGuard(this);
            this._nativeRatingState = [];
            const mount = () => {
                if (!isCurrent()) return false;
                const surface = ensureEditorialSurface();
                const rail = surface?.querySelector('#enh-editorial-score-rail');
                if (!surface || !rail) return false;
                this._surface = surface;
                this._nativeHero = document.querySelector('section[data-testid="hero-parent"]');
                const sync = () => {
                    if (!isCurrent() || !rail.isConnected) return;
                    refreshEditorialSurface(surface, this._nativeHero || document);
                    const standalone = surface.querySelector('#enh-editorial-standalone-slot');
                    const legacyStack = document.getElementById('enh-title-stack');
                    if (standalone && legacyStack && !surface.contains(legacyStack)) {
                        Array.from(legacyStack.children).forEach(node => {
                            if (node.id === 'enh-search-buttons' || node.id === 'enh-external-links') {
                                const order = Number(node.dataset.titleStackOrder);
                                const fallback = node.id === 'enh-search-buttons'
                                    ? TITLE_STACK_ORDER.searchButtons
                                    : TITLE_STACK_ORDER.externalLinks;
                                appendTitleStackItem(node, Number.isFinite(order) ? order : fallback);
                            } else standalone.appendChild(node);
                        });
                        legacyStack.remove();
                    }
                    ['enh-search-buttons', 'enh-external-links'].forEach(id => {
                        const node = document.getElementById(id);
                        if (!node || surface.contains(node)) return;
                        const order = Number(node.dataset.titleStackOrder);
                        const fallback = id === 'enh-search-buttons'
                            ? TITLE_STACK_ORDER.searchButtons
                            : TITLE_STACK_ORDER.externalLinks;
                        appendTitleStackItem(node, Number.isFinite(order) ? order : fallback);
                    });
                    pruneTitleStack();
                    [
                        document.querySelector('[data-testid="hero-rating-bar__aggregate-rating"]'),
                        document.querySelector('[data-testid="hero-rating-bar__popularity"]'),
                    ].forEach(node => {
                        if (!node || rail.contains(node)) return;
                        if (!this._nativeRatingState.some(state => state.node === node)) {
                            this._nativeRatingState.push({ node, parent:node.parentElement });
                        }
                        rail.appendChild(node);
                    });
                    document.querySelectorAll('.enh-score-widget').forEach(widget => {
                        if (!rail.contains(widget)) rail.appendChild(widget);
                    });
                };
                this._sync = sync;
                sync();
                this._observer = new MutationObserver(() => {
                    if (this._syncQueued) return;
                    this._syncQueued = true;
                    queueMicrotask(() => {
                        this._syncQueued = false;
                        sync();
                    });
                });
                this._observer.observe(document.body, { childList:true, subtree:true });
                this._nativeHero?.classList.add('enh-editorial-native-hidden');
                return true;
            };
            if (!mount()) waitForTitleSurface().then(mount).catch(() => {});
        },
        destroy() {
            this._observer?.disconnect();
            this._observer = null;
            this._sync = null;
            this._syncQueued = false;
            this._nativeHero?.classList.remove('enh-editorial-native-hidden');
            this._nativeRatingState.forEach(({ node, parent }) => {
                if (node?.isConnected && parent?.isConnected && !parent.contains(node)) parent.appendChild(node);
            });

            const preserved = [];
            const addChildren = parent => Array.from(parent?.children || []).forEach(node => {
                if (node.id === 'enh-title-stack') Array.from(node.children).forEach(child => preserved.push(child));
                else preserved.push(node);
            });
            addChildren(this._surface?.querySelector('#enh-editorial-action-slot'));
            addChildren(this._surface?.querySelector('#enh-editorial-research-slot'));
            addChildren(this._surface?.querySelector('#enh-editorial-standalone-slot'));
            this._surface?.remove();
            const seen = new Set();
            preserved.forEach(node => {
                if (!node || seen.has(node)) return;
                seen.add(node);
                const order = Number(node.dataset.titleStackOrder);
                appendTitleStackItem(node, Number.isFinite(order) ? order : TITLE_STACK_ORDER.externalLinks);
            });
            this._surface = null;
            this._nativeHero = null;
            this._nativeRatingState = [];
            pruneTitleStack();
        }
    });

    reg({
        key: 'compactHeader', name: 'Compact header', group: 'Appearance',
        init() {
            addThemedCSS(t => `
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
            addThemedCSS(t => `
                [data-testid="hero-rating-bar__aggregate-rating"] {
                    background: transparent !important;
                    border: 0 !important;
                    border-radius: 0 !important;
                    padding: 12px 20px !important;
                    box-shadow: none !important;
                    min-width: 150px !important;
                    border-left: 1px solid ${t.bd0} !important;
                    transition: color .2s ease !important;
                }
                [data-testid="hero-rating-bar__aggregate-rating"]:hover {
                    background: ${t.sf0} !important;
                }
                [data-testid="hero-rating-bar__aggregate-rating__score"] span:first-child {
                    font-size: 1.6em !important; font-weight: 800 !important;
                }
                [data-testid="hero-rating-bar__popularity"] {
                    background: transparent !important;
                    border: 0 !important;
                    border-radius: 0 !important;
                    padding: 12px 20px !important;
                    min-width: 150px !important;
                    border-left: 1px solid ${t.bd0} !important;
                }
            `, 'enh-enhRating');
        },
        destroy() { removeCSS('enh-enhRating'); }
    });

    reg({ key: 'widerLayout', name: 'Wider desktop layout', group: 'Appearance',
        css: `
/* ── Full-width containers ── */
.ipc-page-content-container--center { max-width: 100% !important; padding: 0 32px !important; }
.ipc-page-section--base.celwidget { width: 100% !important; max-width: 100% !important; }
.ipc-page-grid { max-width: 100% !important; width: 100% !important; padding: 0 32px !important; }
.ipc-page-content-container--full { max-width: 100% !important; width: 100% !important; }
.ipc-page-wrapper { max-width: 100% !important; }
[data-testid="atf-wrapper-bg"] { max-width: 100% !important; }

/* ── Poster card compaction ── */
div.ipc-rating-star-group.ipc-poster-card__rating-star-group {
    padding: 0 !important; margin: 0 !important;
}
a.ipc-poster-card__title.ipc-poster-card__title--clamp-2.ipc-poster-card__title--clickable {
    padding: 0 !important; margin: 0 !important;
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
    function getHexLuminance(value) {
        const match = String(value || '').trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
        if (!match) return null;
        const hex = match[1].length === 3
            ? match[1].split('').map(channel => channel + channel).join('')
            : match[1];
        const channels = [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
            .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    }
    function readableTextColor(background) {
        const backgroundLuminance = getHexLuminance(background);
        if (backgroundLuminance === null) return '#fff';
        const darkLuminance = getHexLuminance('#050505');
        const darkContrast = (backgroundLuminance + 0.05) / (darkLuminance + 0.05);
        const lightContrast = 1.05 / (backgroundLuminance + 0.05);
        return darkContrast >= lightContrast ? '#050505' : '#fff';
    }
    function ratingColor(val) {
        const n = parseFloat(val);
        const [bg, label] = isNaN(n) ? ['#555', 'N/A']
            : n >= 8.0 ? ['#22c55e', 'Great']
                : n >= 7.0 ? ['#84cc16', 'Good']
                    : n >= 6.0 ? ['#eab308', 'Average']
                        : n >= 5.0 ? ['#f97316', 'Below Avg']
                            : ['#ef4444', 'Poor'];
        return { bg, text:readableTextColor(bg), label };
    }
    function mcColor(s) { return s >= 75 ? '#6c3' : s >= 50 ? '#ffbd3f' : s >= 25 ? '#ff6874' : '#f00'; }
    function rtColorFn(s) { return s >= 60 ? '#fa320a' : '#6b7280'; }
    function lbColor(s) { return s >= 4 ? '#00e054' : s >= 3 ? '#40bcf4' : s >= 2 ? '#ff8000' : '#ff6874'; }
    function formatScore(n) {
        return Number(n).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    }
    function boundedScore(value, maximum) {
        if (value === null || value === undefined || value === '') return null;
        const score = Number(value);
        return Number.isFinite(score) && score >= 0 && score <= maximum ? score : null;
    }
    function formatCount(n) {
        const count = Number(n);
        if (!Number.isFinite(count) || count <= 0) return '';
        if (count >= 1000000) return `${(count / 1000000).toFixed(count >= 10000000 ? 0 : 1)}M`;
        if (count >= 1000) return `${Math.round(count / 1000)}K`;
        return String(count);
    }
    function decodeHTML(text) {
        /* A detached textarea parses its content as raw character data, so entities
           decode while markup stays literal text and nothing can execute. The
           element is never inserted into the document. */
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
    function normalizeYouTubeVideoId(value) {
        const videoId = String(value || '');
        return /^[a-zA-Z0-9_-]{11}$/.test(videoId) ? videoId : '';
    }
    function isTrailerTitleMatch(candidateTitle, title) {
        const candidate = normalizeLookupTitle(candidateTitle);
        const wanted = normalizeLookupTitle(title);
        if (!candidate || !wanted) return false;
        if (candidate === wanted) return true;

        const descriptor = /^(?:official|trailer|teaser|final|main|original|international|theatrical|red|band|hd|uhd|4k|remaster(?:ed)?|\d{4}|\d+(?:st|nd|rd|th))\b/;
        if (candidate.startsWith(`${wanted} `)) {
            return descriptor.test(candidate.slice(wanted.length + 1));
        }
        if (candidate.endsWith(` ${wanted}`)) {
            return /\b(?:trailer|teaser)\b/.test(candidate.slice(0, -(wanted.length + 1)));
        }
        return false;
    }
    function parseYouTubeTrailerVideoId(html, title, year) {
        const wantedTitle = normalizeLookupTitle(title);
        if (!wantedTitle) return '';
        const source = toBoundedText(html, EXTERNAL_RESPONSE_TEXT_LIMIT);
        if (!source) return '';
        const wantedYear = Number(year) || 0;
        const candidates = [];
        const renderers = source.matchAll(
            /"videoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})"[\s\S]{0,4000}?"title":\{"runs":\[\{"text":"((?:\\.|[^"\\])*)"/g
        );
        let inspected = 0;
        for (const match of renderers) {
            if (inspected >= EXTERNAL_RESULT_SCAN_LIMIT) break;
            inspected += 1;
            let candidateTitle = '';
            try { candidateTitle = JSON.parse(`"${match[2]}"`); }
            catch { continue; }
            const normalized = normalizeLookupTitle(candidateTitle);
            if (!isTrailerTitleMatch(candidateTitle, title) || !/\b(?:trailer|teaser)\b/i.test(candidateTitle)) continue;
            const candidateYear = Number(yearFromText(candidateTitle)) || 0;
            if (wantedYear && candidateYear && Math.abs(candidateYear - wantedYear) > 1) continue;
            const score = (normalized === wantedTitle || normalized.startsWith(`${wantedTitle} `) ? 4 : 2)
                + (wantedYear && candidateYear ? 3 : 0)
                + (/\bofficial\b/i.test(candidateTitle) ? 2 : 0)
                + (/\btrailer\b/i.test(candidateTitle) ? 1 : 0);
            candidates.push({ videoId:match[1], score });
        }
        candidates.sort((a, b) => b.score - a.score);
        return normalizeYouTubeVideoId(candidates[0]?.videoId);
    }
    function compactProviders(providers, limit = 2) {
        const clean = [];
        const seen = new Set();
        const shownLimit = Number.isSafeInteger(limit) && limit > 0 ? limit : 2;
        let inspected = 0;
        for (const provider of Array.isArray(providers) ? providers : []) {
            if (inspected >= STRUCTURED_DATA_CLASSIFICATION_ITEM_LIMIT) break;
            inspected += 1;
            if (typeof provider !== 'string' && typeof provider !== 'number') continue;
            const name = String(provider || '').trim().replace(/\s+/g, ' ').slice(0, 120);
            const identity = name.toLowerCase();
            if (name && !seen.has(identity)) {
                seen.add(identity);
                clean.push(name);
            }
        }
        if (clean.length <= shownLimit + 1) return { providers: clean, extra: 0 };
        return { providers: clean.slice(0, shownLimit), extra: clean.length - shownLimit };
    }
    function formatProviderSummary(providers) {
        const { providers: shown, extra } = compactProviders(providers);
        const summary = shown.join(', ');
        return extra > 0 ? `${summary} +${extra}` : summary;
    }

    function getHTMLAttribute(attributes, name) {
        const escaped = String(name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const match = String(attributes || '').match(new RegExp(`\\b${escaped}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
        return match ? decodeHTML(match[2]) : '';
    }

    function parseRTSearchResult(html, title, year, type = 'movie') {
        const source = toBoundedText(html, EXTERNAL_RESPONSE_TEXT_LIMIT);
        if (!source) return null;
        const candidates = [];
        const rows = source.matchAll(/<search-page-media-row\b([^>]*)>([\s\S]*?)<\/search-page-media-row>/gi);
        let inspected = 0;
        for (const row of rows) {
            if (inspected >= EXTERNAL_RESULT_SCAN_LIMIT) break;
            inspected += 1;
            const titleAnchor = row[2].match(/<a\b([^>]*\bslot\s*=\s*["']title["'][^>]*)>([\s\S]*?)<\/a>/i);
            if (!titleAnchor) continue;
            const href = normalizeTrustedUrl(getHTMLAttribute(titleAnchor[1], 'href'), 'rottentomatoes.com', '');
            if (!href) continue;
            const path = new URL(href).pathname;
            if (type === 'tv' ? !path.startsWith('/tv/') : !path.startsWith('/m/')) continue;
            const candidateTitle = decodeHTML(titleAnchor[2].replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
            const score = Number(getHTMLAttribute(row[1], 'tomatometer-score'));
            if (!candidateTitle || !Number.isFinite(score) || score < 0 || score > 100) continue;
            const candidateYear = Number(
                getHTMLAttribute(row[1], 'release-year') || getHTMLAttribute(row[1], 'start-year')
            ) || 0;
            candidates.push({
                title:candidateTitle,
                year:candidateYear,
                tomatometer:score,
                audience:null,
                consensus:null,
                url:href,
            });
        }

        const wantedTitle = normalizeLookupTitle(title);
        const exact = candidates.filter(candidate => normalizeLookupTitle(candidate.title) === wantedTitle);
        const wantedYear = Number(year) || 0;
        if (wantedYear) {
            const yearMatch = exact.find(candidate => candidate.year && Math.abs(candidate.year - wantedYear) <= 1);
            return yearMatch || null;
        }
        return exact.length === 1 ? exact[0] : null;
    }

    /* Cross-site score lookups used to start from a title search, which is where
       nearly every historical identity defect came from: remakes, sequels sharing
       a prefix, and same-name titles all rank plausibly. Wikidata publishes the
       mapping outright — P345 is the IMDb ID, and each title's item carries the
       Rotten Tomatoes, Metacritic, and TMDB identifiers alongside it — over a
       keyless, CORS-open SPARQL endpoint. Resolving the ID first turns a fuzzy
       search into a direct fetch; when Wikidata has no mapping, the validated
       search path still runs unchanged. */
    const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';
    const WIKIDATA_ID_TTL = 30 * 24 * 60 * 60 * 1000;
    const WIKIDATA_RESPONSE_LIMIT = 256 * 1024;
    const EXTERNAL_ID_PATTERNS = {
        rt: /^(?:m|tv)\/[a-z0-9][a-z0-9_-]{0,120}$/i,
        metacritic: /^(?:movie|tv)\/[a-z0-9][a-z0-9._-]{0,120}$/i,
        tmdb: /^(?:movie|tv)\/\d{1,12}$/i,
    };

    function buildWikidataIdQuery(imdbId) {
        if (!/^tt\d{5,12}$/.test(String(imdbId || ''))) return '';
        return `SELECT ?rt ?mc ?tmdbMovie ?tmdbTv WHERE {`
            + ` ?item wdt:P345 "${imdbId}".`
            + ` OPTIONAL { ?item wdt:P1258 ?rt. }`
            + ` OPTIONAL { ?item wdt:P1712 ?mc. }`
            + ` OPTIONAL { ?item wdt:P4947 ?tmdbMovie. }`
            + ` OPTIONAL { ?item wdt:P4983 ?tmdbTv. }`
            + ` } LIMIT 1`;
    }

    function normalizeExternalId(kind, value) {
        const raw = String(value ?? '').trim().replace(/^\/+|\/+$/g, '');
        const pattern = EXTERNAL_ID_PATTERNS[kind];
        if (!raw || raw.length > 128 || !pattern) return '';
        return pattern.test(raw) ? raw : '';
    }

    function parseWikidataExternalIds(responseText) {
        const raw = typeof responseText === 'string' ? responseText : '';
        if (!raw || raw.length > WIKIDATA_RESPONSE_LIMIT) return {};
        let payload = null;
        try { payload = JSON.parse(raw); } catch { return {}; }
        const row = payload?.results?.bindings?.[0];
        if (!row || typeof row !== 'object') return {};
        const read = key => (row[key] && typeof row[key].value === 'string' ? row[key].value : '');
        const ids = {};
        const rt = normalizeExternalId('rt', read('rt'));
        if (rt) ids.rt = rt;
        const metacritic = normalizeExternalId('metacritic', read('mc'));
        if (metacritic) ids.metacritic = metacritic;
        const tmdbMovie = read('tmdbMovie');
        const tmdbTv = read('tmdbTv');
        const tmdb = normalizeExternalId('tmdb', tmdbMovie ? `movie/${tmdbMovie}` : tmdbTv ? `tv/${tmdbTv}` : '');
        if (tmdb) ids.tmdb = tmdb;
        return ids;
    }

    async function resolveExternalIds(imdbId, isCurrent = () => true) {
        const query = buildWikidataIdQuery(imdbId);
        if (!query) return {};
        const cacheKey = 'xid_' + imdbId;
        const cached = cacheGet(cacheKey);
        if (cached) return cached.unavailable ? {} : cached;
        try {
            const res = await httpGet(`${WIKIDATA_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`, {
                headers: { Accept:'application/sparql-results+json' },
                cancelOnRouteChange: true,
            });
            if (!isCurrent()) return {};
            const ids = parseWikidataExternalIds(res.responseText);
            if (Object.keys(ids).length) cacheSet(cacheKey, ids, WIKIDATA_ID_TTL);
            else cacheSetUnavailable(cacheKey);
            return ids;
        } catch {
            return {};
        }
    }

    /* Slugs share prefixes — `movie/the-matrix` is a substring of
       `movie/the-matrix-remake` — so a mapped identifier only counts when it
       occupies whole path segments. */
    function metacriticUrlUsesSlug(url, slug) {
        const path = String(url || '').slice(0, 512);
        if (!path || !slug) return false;
        const normalized = `/${path.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+/, '')}`;
        return normalized.startsWith(`/${slug}/`) || normalized === `/${slug}`;
    }

    function selectMetacriticResult(items, title, year, type = 'movie', mappedSlug = '') {
        if (!Array.isArray(items)) return null;
        const wantedTitle = normalizeLookupTitle(title);
        const expectedType = type === 'tv' ? 'show' : 'movie';
        const exact = items.slice(0, EXTERNAL_RESULT_SCAN_LIMIT).filter(item =>
            normalizeLookupTitle(item?.title) === wantedTitle
            && String(item?.type || '').toLowerCase() === expectedType
        );
        const slug = normalizeExternalId('metacritic', mappedSlug);
        if (slug) {
            const bySlug = exact.find(item => metacriticUrlUsesSlug(item?.criticScoreSummary?.url, slug));
            if (bySlug) return bySlug;
        }
        const wantedYear = Number(year) || 0;
        if (!wantedYear) return exact.length === 1 ? exact[0] : null;
        const yearMatch = exact.find(item => {
            const itemYear = Number(yearFromText(item?.releaseDate || item?.premiereDate || item?.year)) || 0;
            return itemYear && Math.abs(itemYear - wantedYear) <= 1;
        });
        return yearMatch || null;
    }

    function isMatchingTitleIdentity(candidate, title, year) {
        if (normalizeLookupTitle(candidate?.title) !== normalizeLookupTitle(title)) return false;
        const wantedYear = Number(year) || 0;
        const candidateYear = Number(candidate?.year) || 0;
        return !wantedYear || Boolean(candidateYear) && Math.abs(candidateYear - wantedYear) <= 1;
    }

    function parseRTDetailPage(html, title, year, type = 'movie', fallbackUrl = '') {
        const source = toBoundedText(html, EXTERNAL_RESPONSE_TEXT_LIMIT);
        if (!source) return null;
        const expectedType = type === 'tv' ? 'tv' : 'movie';
        let detail = null;
        const scripts = source.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>\s*([\s\S]*?)<\/script>/gi);
        let inspectedScripts = 0;
        for (const script of scripts) {
            if (inspectedScripts >= STRUCTURED_DATA_SCRIPT_LIMIT) break;
            inspectedScripts += 1;
            try {
                const scriptText = toBoundedText(script[1], STRUCTURED_DATA_TEXT_LIMIT);
                if (!scriptText) continue;
                const parsed = JSON.parse(scriptText);
                const queue = [parsed];
                for (let index = 0; index < queue.length && index < EXTERNAL_STRUCTURED_DATA_NODE_LIMIT; index++) {
                    const item = queue[index];
                    if (!item || typeof item !== 'object') continue;
                    if (Array.isArray(item)) {
                        appendBoundedObjectChildren(queue, item, EXTERNAL_STRUCTURED_DATA_NODE_LIMIT);
                        continue;
                    }
                    const types = getBoundedStructuredStrings(item['@type'], STRUCTURED_DATA_TYPE_LIMIT);
                    const itemType = types.includes('Movie') ? 'movie'
                        : types.some(value => ['TVSeries', 'TVShow'].includes(value)) ? 'tv'
                            : '';
                    if (itemType === expectedType && isMatchingTitleIdentity({
                        title:item.name,
                        year:Number(yearFromText(item.dateCreated || item.datePublished || item.startDate)) || 0,
                    }, title, year)) {
                        detail = item;
                        break;
                    }
                    appendBoundedObjectChildren(queue, item, EXTERNAL_STRUCTURED_DATA_NODE_LIMIT);
                }
            } catch { /* inspect the next structured-data block */ }
            if (detail) break;
        }
        if (!detail) return null;

        const aggregate = boundedScore(detail.aggregateRating?.ratingValue, 100);
        let tomatometer = aggregate === null ? null : Math.round(aggregate);
        const scoreMatch = source.match(/tomatometer[^}]*?"value"\s*:\s*(\d+)/i);
        if (tomatometer === null && scoreMatch) {
            const value = boundedScore(scoreMatch[1], 100);
            if (value !== null) tomatometer = value;
        }
        if (tomatometer === null) return null;

        const audienceMatch = source.match(/audienceScore[^}]*?"value"\s*:\s*(\d+)/i);
        const audience = boundedScore(audienceMatch?.[1], 100);
        const consensusMatch = source.match(/critics-consensus[^>]*>([^<]+)</i)
            || source.match(/"criticsConsensus"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
        const consensus = consensusMatch
            ? decodeHTML(consensusMatch[1]).replace(/\\"/g, '"').trim().slice(0, 500)
            : null;
        let candidateUrl = fallbackUrl;
        try { candidateUrl = new URL(detail.url || fallbackUrl, 'https://www.rottentomatoes.com').href; }
        catch { /* retain the trusted request URL */ }
        const url = normalizeTrustedUrl(candidateUrl, 'rottentomatoes.com', fallbackUrl);
        return { tomatometer, audience, consensus, url };
    }

    function parseLetterboxdDetailPage(html, title, year, fallbackUrl) {
        const source = toBoundedText(html, EXTERNAL_RESPONSE_TEXT_LIMIT);
        if (!source) return null;
        let detail = null;
        const scripts = source.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>\s*([\s\S]*?)<\/script>/gi);
        let inspectedScripts = 0;
        for (const script of scripts) {
            if (inspectedScripts >= STRUCTURED_DATA_SCRIPT_LIMIT) break;
            inspectedScripts += 1;
            try {
                const scriptText = toBoundedText(script[1], STRUCTURED_DATA_TEXT_LIMIT);
                if (!scriptText) continue;
                const parsed = JSON.parse(scriptText);
                const queue = [parsed];
                for (let index = 0; index < queue.length && index < EXTERNAL_STRUCTURED_DATA_NODE_LIMIT; index++) {
                    const item = queue[index];
                    if (!item || typeof item !== 'object') continue;
                    if (Array.isArray(item)) {
                        appendBoundedObjectChildren(queue, item, EXTERNAL_STRUCTURED_DATA_NODE_LIMIT);
                        continue;
                    }
                    const types = getBoundedStructuredStrings(item['@type'], STRUCTURED_DATA_TYPE_LIMIT);
                    if (types.includes('Movie') && isMatchingTitleIdentity({
                        title:item.name,
                        year:Number(yearFromText(item.dateCreated || item.datePublished)) || 0,
                    }, title, year)) {
                        detail = item;
                        break;
                    }
                    appendBoundedObjectChildren(queue, item, EXTERNAL_STRUCTURED_DATA_NODE_LIMIT);
                }
            } catch { /* inspect the next structured-data block */ }
            if (detail) break;
        }
        if (!detail) return null;

        let score = boundedScore(detail.aggregateRating?.ratingValue, 5);
        if (score === null) {
            const meta = source.match(/<meta[^>]+name=["']twitter:data2["'][^>]+content=["']([^"']+)["']/i);
            score = boundedScore(parseFloat(meta?.[1]), 5);
        }
        if (score === null) return null;
        const rawCount = Number(detail.aggregateRating?.ratingCount);
        const ratingCount = Number.isSafeInteger(rawCount) && rawCount >= 0 ? rawCount : null;
        let candidateUrl = fallbackUrl;
        try { candidateUrl = new URL(detail.url || detail['@id'] || fallbackUrl, 'https://letterboxd.com').href; }
        catch { /* retain the trusted IMDb-ID lookup URL */ }
        const trusted = normalizeTrustedUrl(candidateUrl, 'letterboxd.com', fallbackUrl);
        const url = trusted && new URL(trusted).pathname.startsWith('/film/') ? trusted : fallbackUrl;
        return { score, ratingCount, url };
    }

    function parseJustWatchSearchResult(html, title, year, typePath = 'movie') {
        const source = toBoundedText(html, EXTERNAL_RESPONSE_TEXT_LIMIT);
        if (!source) return '';
        const candidates = [];
        const anchors = source.matchAll(/<a\b([^>]*\bclass\s*=\s*["'][^"']*title-list-row__column-header[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi);
        let inspected = 0;
        for (const anchor of anchors) {
            if (inspected >= EXTERNAL_RESULT_SCAN_LIMIT) break;
            inspected += 1;
            const rawHref = getHTMLAttribute(anchor[1], 'href');
            let candidateUrl = '';
            try { candidateUrl = new URL(rawHref, 'https://www.justwatch.com').href; } catch { /* reject malformed result URLs */ }
            const href = normalizeTrustedUrl(candidateUrl, 'justwatch.com', '');
            if (!href) continue;
            const path = new URL(href).pathname;
            if (!path.startsWith(`/us/${typePath}/`)) continue;
            const titleMatch = anchor[2].match(/<span\b[^>]*\bclass\s*=\s*["'][^"']*header-title[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
            if (!titleMatch) continue;
            const yearMatch = anchor[2].match(/<span\b[^>]*\bclass\s*=\s*["'][^"']*header-year[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
            candidates.push({
                title:decodeHTML(titleMatch[1].replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim(),
                year:Number(yearFromText(yearMatch?.[1])) || 0,
                url:href,
            });
        }
        const exact = candidates.filter(candidate => isMatchingTitleIdentity(candidate, title, year));
        return exact.length === 1 ? exact[0].url : '';
    }

    function parseJustWatchIdentity(html) {
        const source = toBoundedText(html, EXTERNAL_RESPONSE_TEXT_LIMIT);
        if (!source) return null;
        const scripts = source.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>\s*([\s\S]*?)<\/script>/gi);
        let inspectedScripts = 0;
        for (const script of scripts) {
            if (inspectedScripts >= STRUCTURED_DATA_SCRIPT_LIMIT) break;
            inspectedScripts += 1;
            try {
                const scriptText = toBoundedText(script[1], STRUCTURED_DATA_TEXT_LIMIT);
                if (!scriptText) continue;
                const parsed = JSON.parse(scriptText);
                const roots = Array.isArray(parsed) ? parsed.slice(0, EXTERNAL_RESULT_SCAN_LIMIT) : [parsed];
                for (const item of roots) {
                    const types = getBoundedStructuredStrings(item?.['@type'], STRUCTURED_DATA_TYPE_LIMIT);
                    const type = types.includes('Movie') ? 'movie'
                        : types.some(value => ['TVSeries', 'TVShow'].includes(value)) ? 'tv-show'
                            : '';
                    if (!type || !item?.name) continue;
                    return {
                        title:String(item.name),
                        year:Number(yearFromText(item.dateCreated || item.datePublished || item.startDate)) || 0,
                        type,
                    };
                }
            } catch { /* inspect the next structured-data block */ }
        }
        return null;
    }

    function collectJustWatchProviderNames(root, maxNodes = 2000, maxProviders = 50) {
        const providers = [];
        const queue = [root];
        const add = value => {
            const name = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 120);
            if (name && !providers.some(existing => existing.toLowerCase() === name.toLowerCase())) providers.push(name);
        };
        for (let index = 0; index < queue.length && index < maxNodes && providers.length < maxProviders; index++) {
            const node = queue[index];
            if (!node || typeof node !== 'object') continue;
            if (Array.isArray(node)) {
                node.slice(0, Math.max(0, maxNodes - queue.length)).forEach(value => queue.push(value));
                continue;
            }
            const offeredBy = node.offeredBy;
            if (Array.isArray(offeredBy)) {
                let inspectedOffers = 0;
                for (const item of offeredBy) {
                    if (providers.length >= maxProviders || inspectedOffers >= maxProviders) break;
                    inspectedOffers += 1;
                    add(item?.name);
                }
            }
            else add(offeredBy?.name);
            appendBoundedObjectChildren(queue, node, maxNodes);
        }
        return providers.slice(0, maxProviders);
    }

    function parseJustWatchAvailability(html, url, expected) {
        if (!html) return null;
        const source = toBoundedText(html, EXTERNAL_RESPONSE_TEXT_LIMIT);
        if (!source) return null;
        const identity = parseJustWatchIdentity(source);
        if (!identity || identity.type !== expected.typePath || !isMatchingTitleIdentity(identity, expected.title, expected.year)) {
            return null;
        }
        const providers = [];
        const addProviders = values => {
            for (const value of values || []) {
                if (providers.length >= 50) break;
                providers.push(value);
            }
        };

        const metaTag = source.match(/<meta[^>]+name=["']description["'][^>]*>/i)?.[0] || '';
        const content = metaTag.match(/\scontent=["']([^"']+)["']/i)?.[1] || '';
        const desc = decodeHTML(content);
        const availability = desc.match(/\bonline on (.+?) today\b/i)?.[1];
        if (availability) {
            addProviders(availability
                .replace(/\s+[–-]\s+including.*$/i, '')
                .replace(/\bincluding.*$/i, '')
                .replace(/\s*,?\s+and\s+/gi, ',')
                .split(',')
                .map(name => name.trim())
                .filter(Boolean));
        }

        const ldScripts = source.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>\s*([\s\S]*?)<\/script>/gi);
        let inspectedScripts = 0;
        for (const script of ldScripts) {
            if (inspectedScripts >= STRUCTURED_DATA_SCRIPT_LIMIT || providers.length >= 50) break;
            inspectedScripts += 1;
            try {
                const scriptText = toBoundedText(script[1], STRUCTURED_DATA_TEXT_LIMIT);
                if (!scriptText) continue;
                addProviders(collectJustWatchProviderNames(JSON.parse(scriptText), 2000, 50 - providers.length));
            } catch { /* ignore malformed structured data */ }
        }

        const unique = compactProviders(providers, 12).providers;
        return unique.length ? { providers:unique, url } : null;
    }

    reg({
        key: 'ratingColorCoding', name: 'Rating quality labels', group: 'Appearance',
        init() {
            const isCurrent = createFeatureGuard(this);
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
                if (!isCurrent()) return;
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

    function waitUntilVisible(el, isCurrent) {
        if (!el || !isCurrent()) return Promise.resolve(false);
        if (typeof IntersectionObserver === 'undefined') return Promise.resolve(true);
        return new Promise(resolve => {
            let settled = false;
            let timer = null;
            const observer = new IntersectionObserver(entries => {
                if (!isCurrent()) { finish(false); return; }
                if (entries.some(entry => entry.isIntersecting)) finish(true);
            }, { rootMargin: '200px' });
            const cancel = () => finish(false);
            const finish = value => {
                if (settled) return;
                settled = true;
                observer.disconnect();
                clearTimeout(timer);
                pendingRouteWorkCancels.delete(cancel);
                resolve(value);
            };
            pendingRouteWorkCancels.add(cancel);
            observer.observe(el);
            timer = setTimeout(() => finish(false), 60000);
        });
    }

    function findRatingBar() {
        const editorialRail = document.getElementById('enh-editorial-score-rail');
        if (editorialRail) return editorialRail;
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

    async function waitForRatingBar(isCurrent) {
        const current = findRatingBar();
        if (current) return current;
        try {
            await waitFor('[data-testid="hero-rating-bar__aggregate-rating"]', 12000);
        } catch { return null; }
        return isCurrent() ? findRatingBar() : null;
    }

    function normalizeHistogramData(value) {
        if (!Array.isArray(value)) return null;
        const buckets = new Map();
        value.slice(0, 100).forEach(bucket => {
            const rating = Number(bucket?.rating);
            const votes = Number(bucket?.voteCount ?? bucket?.count);
            if (!Number.isInteger(rating) || rating < 1 || rating > 10) return;
            if (!Number.isFinite(votes) || votes < 0) return;
            buckets.set(rating, Math.round(votes));
        });
        if (buckets.size < 2) return null;
        return Array.from({ length:10 }, (_, index) => ({
            rating:index + 1,
            voteCount:buckets.get(index + 1) || 0,
        }));
    }

    function findHistogramData(root, maxNodes = 10000) {
        const queue = [root];
        for (let index = 0; index < queue.length && index < maxNodes; index++) {
            const node = queue[index];
            if (!node || typeof node !== 'object') continue;
            const direct = normalizeHistogramData(node.histogramData)
                || normalizeHistogramData(node.ratingsSummary?.histogramData);
            if (direct) return direct;
            appendBoundedObjectChildren(queue, node, maxNodes);
        }
        return null;
    }

    function parseHistogramScriptTexts(scriptTexts) {
        let inspectedScripts = 0;
        for (const text of scriptTexts || []) {
            if (inspectedScripts >= STRUCTURED_DATA_SCRIPT_LIMIT) break;
            inspectedScripts += 1;
            const source = toBoundedText(text, STRUCTURED_DATA_TEXT_LIMIT);
            if (!source || (!source.includes('histogramData') && !source.includes('ratingsSummary'))) continue;
            try {
                const data = findHistogramData(JSON.parse(source));
                if (data) return data;
            } catch { /* inspect the next application-data block */ }
        }
        return null;
    }

    function getHistogramData() {
        const scripts = Array.from(document.querySelectorAll('script[type="application/json"]'))
            .slice(0, STRUCTURED_DATA_SCRIPT_LIMIT);
        return parseHistogramScriptTexts(scripts.map(script => script.textContent));
    }

    reg({
        key: 'ratingHistogram', name: 'Rating histogram', group: 'Scores',
        async init() {
            const isCurrent = createFeatureGuard(this);
            if (document.getElementById('enh-histogram')) return;
            const bar = await waitForRatingBar(isCurrent);
            if (!bar || !isCurrent() || document.getElementById('enh-histogram')) return;
            const histogram = getHistogramData();
            if (!histogram?.length) return;

            const maxVotes = Math.max(...histogram.map(bucket => bucket.voteCount), 1);
            const w = makeEl('div', { id: 'enh-histogram', className: 'enh-score-widget' });
            const label = makeEl('div', { className: 'enh-score-widget__label' }, 'VOTES');
            const chart = makeEl('div', {
                className:'enh-histogram-chart', role:'list',
                'aria-label':'IMDb vote distribution from 1 to 10',
            });
            histogram.forEach(bucket => {
                const { rating, voteCount:votes } = bucket;
                const pct = Math.max((votes / maxVotes) * 100, 2);
                const description = `${rating} out of 10: ${votes.toLocaleString()} votes`;
                const col = makeEl('div', {
                    className:'enh-histogram-col', role:'listitem', title:description, 'aria-label':description,
                },
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
            const isCurrent = createFeatureGuard(this);
            const imdbId = getIMDbID(), title = getTitleText(), year = getTitleYear();
            if (!imdbId || !title) return;

            const cacheKey = 'rt_' + imdbId;
            const cached = cacheGet(cacheKey);
            const bar = await waitForRatingBar(isCurrent);
            if (!bar || !isCurrent()) return;
            if (cached) {
                if (cached.unavailable) this._renderUnavailable();
                else this._render(cached);
                return;
            }
            if (!await waitUntilVisible(bar, isCurrent) || !isCurrent()) return;
            this._renderLoading();

            const type = isTVType() ? 'tv' : 'movie';
            if (!isCurrent()) return;

            /* A Wikidata-mapped identifier names the exact Rotten Tomatoes page,
               so the search step and its ranking guesswork can be skipped. The
               detail parser still has to agree on title, type, and year before
               anything is cached, so a stale mapping cannot mislabel a title. */
            const mapped = await resolveExternalIds(imdbId, isCurrent);
            if (!isCurrent()) return;
            if (mapped.rt) {
                try {
                    const mappedUrl = `https://www.rottentomatoes.com/${mapped.rt}`;
                    const mappedRes = await httpGet(mappedUrl, { cancelOnRouteChange:true });
                    if (!isCurrent()) return;
                    const resolvedUrl = normalizeTrustedUrl(mappedRes.finalUrl, 'rottentomatoes.com', mappedUrl);
                    const mappedData = parseRTDetailPage(mappedRes.responseText, title, year, type, resolvedUrl);
                    if (mappedData) {
                        cacheSet(cacheKey, mappedData);
                        this._render(mappedData);
                        return;
                    }
                } catch { /* fall through to the validated search path */ }
                if (!isCurrent()) return;
            }

            try {
                const searchUrl = `https://www.rottentomatoes.com/search?search=${encodeURIComponent(title)}`;
                const res2 = await httpGet(searchUrl, { cancelOnRouteChange:true });
                if (!isCurrent()) return;
                const result = parseRTSearchResult(res2.responseText, title, year, type);
                if (result) {
                    let data = result;
                    try {
                        const detailRes = await httpGet(result.url, { cancelOnRouteChange:true });
                        if (!isCurrent()) return;
                        const resolvedUrl = normalizeTrustedUrl(detailRes.finalUrl, 'rottentomatoes.com', result.url);
                        data = parseRTDetailPage(detailRes.responseText, title, year, type, resolvedUrl) || result;
                    } catch { /* the identity-bound search score remains usable */ }
                    cacheSet(cacheKey, data); this._render(data);
                    return;
                }
            } catch { /* handled below */ }
            if (!isCurrent()) return;
            cacheSetUnavailable(cacheKey);
            this._renderUnavailable();
        },
        _render(data) {
            document.getElementById('enh-rt-widget')?.remove();
            const bar = findRatingBar();
            if (!bar) return;
            const score = boundedScore(data.tomatometer, 100);
            const audience = boundedScore(data.audience, 100);
            const hasScore = score !== null;
            const hasAudience = audience !== null;
            const color = hasScore ? rtColorFn(score) : '';
            const consensus = String(data.consensus || '').trim().slice(0, 500);
            const fallbackUrl = `https://www.rottentomatoes.com/search?search=${encodeURIComponent(getTitleText())}`;
            const href = normalizeTrustedUrl(data.url, 'rottentomatoes.com', fallbackUrl);
            const w = makeEl('div', { id: 'enh-rt-widget', className: 'enh-score-widget' });
            const scoreLink = makeEl('a', {
                href,
                target:'_blank', rel:'noopener noreferrer', className:'enh-score-widget__score',
                style:hasScore ? { '--score-color':color } : {},
                ...(consensus ? { title:consensus } : {}),
            },
                makeEl('span', { className:'enh-score-widget__badge enh-score-widget__badge--outline' }, 'RT'),
                makeEl('span', { className:'enh-score-widget__value' }, hasScore ? `${score}%` : '--')
            );
            w.append(makeEl('div', { className:'enh-score-widget__label' }, 'TOMATOMETER'), scoreLink);
            if (hasAudience) w.appendChild(makeEl('div', { className:'enh-score-widget__sub' }, `Audience: ${audience}%`));
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
                   target="_blank" rel="noopener noreferrer" class="enh-score-widget__score">
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
            const isCurrent = createFeatureGuard(this);
            if (isTVType()) return;
            const imdbId = getIMDbID(), title = getTitleText(), year = getTitleYear();
            if (!imdbId || !title) return;

            const cacheKey = 'lb_' + imdbId;
            const cached = cacheGet(cacheKey);
            const bar = await waitForRatingBar(isCurrent);
            if (!bar || !isCurrent()) return;
            if (cached) {
                if (cached.unavailable) this._renderUnavailable();
                else this._render(cached);
                return;
            }
            if (!await waitUntilVisible(bar, isCurrent) || !isCurrent()) return;
            this._renderLoading();

            const lookupUrl = `https://letterboxd.com/imdb/${imdbId}/`;
            try {
                const res = await httpGet(lookupUrl, { cancelOnRouteChange:true });
                if (!isCurrent()) return;
                const resolvedUrl = normalizeTrustedUrl(res.finalUrl, 'letterboxd.com', lookupUrl);
                const data = parseLetterboxdDetailPage(res.responseText, title, year, resolvedUrl);
                if (data) {
                    cacheSet(cacheKey, data);
                    this._render(data);
                    return;
                }
            } catch { /* handled below */ }

            if (!isCurrent()) return;
            cacheSetUnavailable(cacheKey);
            this._renderUnavailable();
        },
        _render(data) {
            document.getElementById('enh-lb-widget')?.remove();
            const bar = findRatingBar();
            if (!bar) return;
            const score = boundedScore(data.score, 5);
            if (score === null) { this._renderUnavailable(); return; }
            const color = lbColor(score);
            const count = formatCount(data.ratingCount);
            const fallbackUrl = `https://letterboxd.com/imdb/${getIMDbID()}/`;
            const href = normalizeTrustedUrl(data.url, 'letterboxd.com', fallbackUrl);
            const w = makeEl('div', { id: 'enh-lb-widget', className: 'enh-score-widget' });
            w.append(
                makeEl('div', { className:'enh-score-widget__label' }, 'LETTERBOXD'),
                makeEl('a', {
                    href, target:'_blank', rel:'noopener noreferrer', className:'enh-score-widget__score',
                    style:{ '--score-color':color },
                },
                    makeEl('span', { className:'enh-score-widget__badge enh-score-widget__badge--outline' }, 'LB'),
                    makeEl('span', { className:'enh-score-widget__value' }, formatScore(score))
                ),
                makeEl('div', { className:'enh-score-widget__sub' }, count ? `${count} ratings` : 'Average rating')
            );
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
                   target="_blank" rel="noopener noreferrer" class="enh-score-widget__score">
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
            const isCurrent = createFeatureGuard(this);
            const imdbId = getIMDbID(), title = getTitleText(), year = getTitleYear();
            if (!imdbId || !title) return;

            const cacheKey = 'mc_' + imdbId;
            const cached = cacheGet(cacheKey);
            const bar = await waitForRatingBar(isCurrent);
            if (!bar || !isCurrent()) return;
            if (cached) {
                if (cached.unavailable) this._renderUnavailable();
                else this._render(cached);
                return;
            }
            if (!await waitUntilVisible(bar, isCurrent) || !isCurrent()) return;
            this._renderLoading();

            const mapped = await resolveExternalIds(imdbId, isCurrent);
            if (!isCurrent()) return;
            const mediaType = isTVType() ? 'tv' : 'movie';
            const typeId = mediaType === 'tv' ? '1' : '2';
            const url = `https://backend.metacritic.com/finder/metacritic/search/${encodeURIComponent(title)}/web?componentName=search-tabs&componentDisplayName=Search+Page+Tab+Filters&componentType=FilterConfig&mcoTypeId=${typeId}&offset=0&limit=10`;

            try {
                const res = await httpGet(url, { cancelOnRouteChange:true });
                if (!isCurrent()) return;
                const source = toBoundedText(res.responseText, EXTERNAL_RESPONSE_TEXT_LIMIT);
                if (!source) throw new Error('Response was too large or empty');
                const obj = JSON.parse(source);
                const items = obj?.data?.items || [];
                /* Where Wikidata names the Metacritic slug, prefer the result that
                   actually points at it; search rank alone has never been an
                   identity guarantee. */
                const best = selectMetacriticResult(items, title, year, mediaType, mapped.metacritic);
                if (best) {
                    const score = boundedScore(best.criticScoreSummary?.score, 100);
                    const userScore = boundedScore(best.userScoreSummary?.score, 10);
                    const fallbackUrl = `https://www.metacritic.com/search/${encodeURIComponent(title)}/`;
                    let candidateUrl = fallbackUrl;
                    if (best.criticScoreSummary?.url) {
                        try {
                            candidateUrl = new URL(
                                String(best.criticScoreSummary.url).replace('/critic-reviews/', '/'),
                                'https://www.metacritic.com'
                            ).href;
                        } catch { /* retain trusted fallback */ }
                    }
                    const metaUrl = normalizeTrustedUrl(candidateUrl, 'metacritic.com', fallbackUrl);
                    const d = { score, userScore, url: metaUrl, title: best.title };
                    cacheSet(cacheKey, d); this._render(d);
                    return;
                }
            } catch { /* handled below */ }
            if (!isCurrent()) return;
            cacheSetUnavailable(cacheKey);
            this._renderUnavailable();
        },
        _render(data) {
            document.getElementById('enh-mc-widget')?.remove();
            const bar = findRatingBar();
            if (!bar) return;
            const score = boundedScore(data.score, 100);
            const userScore = boundedScore(data.userScore, 10);
            const hasScore = score !== null;
            const hasUserScore = userScore !== null;
            const color = hasScore ? mcColor(score) : '';
            const fallbackUrl = `https://www.metacritic.com/search/${encodeURIComponent(getTitleText())}/`;
            const href = normalizeTrustedUrl(data.url, 'metacritic.com', fallbackUrl);
            const w = makeEl('div', { id: 'enh-mc-widget', className: 'enh-score-widget' });
            w.append(
                makeEl('div', { className:'enh-score-widget__label' }, 'METASCORE'),
                makeEl('a', {
                    href, target:'_blank', rel:'noopener noreferrer', className:'enh-score-widget__score',
                    style:hasScore ? { '--score-color':color } : {},
                }, makeEl('span', {
                    className:'enh-score-widget__badge' + (hasScore ? '' : ' enh-score-widget__badge--outline'),
                    style:hasScore ? { background:color, color:readableTextColor(color) } : {},
                }, hasScore ? String(score) : '--'))
            );
            if (hasUserScore) {
                w.appendChild(makeEl('div', { className:'enh-score-widget__sub' }, `User: ${userScore.toFixed(1)}`));
            }
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
                   target="_blank" rel="noopener noreferrer" class="enh-score-widget__score">
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
            const isCurrent = createFeatureGuard(this);
            const imdbId = getIMDbID(), title = getTitleText();
            if (!imdbId || !title) return;

            const cacheKey = 'jw_' + imdbId;
            const cached = cacheGet(cacheKey);
            const bar = await waitForRatingBar(isCurrent);
            if (!bar || !isCurrent()) return;
            if (cached) {
                if (cached.unavailable) this._renderUnavailable();
                else this._render(cached);
                return;
            }
            if (!await waitUntilVisible(bar, isCurrent) || !isCurrent()) return;
            this._renderLoading();

            const headers = { Accept: 'text/html,application/xhtml+xml' };
            const directUrl = getJustWatchDetailUrl(title);
            try {
                const res = await httpGet(directUrl, { headers, timeout: 12000, cancelOnRouteChange:true });
                if (!isCurrent()) return;
                const resolvedUrl = normalizeTrustedUrl(res.finalUrl, 'justwatch.com', directUrl);
                const data = this._parse(res.responseText, resolvedUrl, { title, year:getTitleYear(), typePath:getJustWatchTypePath() });
                if (data) {
                    cacheSet(cacheKey, data);
                    this._render(data);
                    return;
                }
            } catch { /* fall back to search below */ }

            try {
                const searchUrl = getJustWatchSearchUrl(title);
                const searchRes = await httpGet(searchUrl, { headers, timeout: 12000, cancelOnRouteChange:true });
                if (!isCurrent()) return;
                const year = getTitleYear();
                const typePath = getJustWatchTypePath();
                const detailUrl = parseJustWatchSearchResult(searchRes.responseText, title, year, typePath);
                if (detailUrl) {
                    const detailRes = await httpGet(detailUrl, { headers, timeout: 12000, cancelOnRouteChange:true });
                    if (!isCurrent()) return;
                    const resolvedUrl = normalizeTrustedUrl(detailRes.finalUrl, 'justwatch.com', detailUrl);
                    const data = this._parse(detailRes.responseText, resolvedUrl, { title, year, typePath });
                    if (data) {
                        cacheSet(cacheKey, data);
                        this._render(data);
                        return;
                    }
                }
            } catch { /* handled below */ }

            if (!isCurrent()) return;
            cacheSetUnavailable(cacheKey);
            this._renderUnavailable();
        },
        _parse(html, url, expected) {
            return parseJustWatchAvailability(html, url, expected);
        },
        _render(data) {
            document.getElementById('enh-jw-widget')?.remove();
            const bar = findRatingBar();
            if (!bar) return;
            const providers = Array.isArray(data.providers) ? data.providers : [];
            const summary = formatProviderSummary(providers);
            if (!summary) { this._renderUnavailable(); return; }
            const href = normalizeTrustedUrl(data.url, 'justwatch.com', getJustWatchSearchUrl());

            const w = makeEl('div', { id: 'enh-jw-widget', className: 'enh-score-widget enh-score-widget--availability' },
                makeEl('div', { className: 'enh-score-widget__label' }, 'STREAMING'),
                makeEl('a', {
                    href,
                    target: '_blank',
                    rel: 'noopener noreferrer',
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
                    rel: 'noopener noreferrer',
                    className: 'enh-score-widget__score enh-score-widget__score--availability',
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
        _ids: COLLAPSIBLE_SECTION_IDS,
        init() {
            addThemedCSS(t => `
                .enh-collapse-btn{position:absolute;top:12px;right:12px;width:28px;height:28px;
                    background:${t.sf1};border:1px solid ${t.bd1};
                    border-radius:6px;cursor:pointer;color:${t.tx3};font-size:16px;z-index:10;
                    display:flex;align-items:center;justify-content:center;transition:background .12s ease,border-color .12s ease,color .12s ease,transform .12s ease;
                    line-height:1;padding:0}
                .enh-collapse-btn:hover{background:${t.sf2};border-color:${t.accentBorder};color:${t.tx0}}
                .enh-section--collapsed>*:not(.ipc-title):not(.enh-collapse-btn):not([class*="title"]):not(h3):not(header){display:none!important}
                .enh-section--collapsed{min-height:auto!important;padding-bottom:12px!important}
                section[data-testid]{position:relative}
            `, 'enh-collapsible');

            const collapseState = getSectionCollapseState();
            this._ids.forEach(id => {
                const sec = document.querySelector(`section[data-testid="${id}"]`);
                if (!sec || sec.querySelector('.enh-collapse-btn')) return;
                const collapsed = Boolean(collapseState[id]);
                if (collapsed) sec.classList.add('enh-section--collapsed');
                const sectionLabel = sec.querySelector('.ipc-title__text, h2, h3')?.textContent?.trim() || id;
                const btn = makeEl('button', {
                    className: 'enh-collapse-btn', type: 'button', title: collapsed ? 'Expand section' : 'Collapse section',
                    'aria-expanded': String(!collapsed),
                    'aria-label': `${collapsed ? 'Expand' : 'Collapse'} ${sectionLabel}`,
                    textContent: collapsed ? '+' : '-',
                    onClick: () => {
                        const now = !sec.classList.contains('enh-section--collapsed');
                        if (!setSectionCollapsed(id, now)) return;
                        sec.classList.toggle('enh-section--collapsed', now);
                        btn.textContent = now ? '+' : '-';
                        btn.title = now ? 'Expand section' : 'Collapse section';
                        btn.setAttribute('aria-expanded', String(!now));
                        btn.setAttribute('aria-label', `${now ? 'Expand' : 'Collapse'} ${sectionLabel}`);
                    }
                });
                sec.insertBefore(btn, sec.firstChild);
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
        _plot: null,
        _plotAttributes: null,
        _revealHandler: null,
        _revealKeyHandler: null,
        init() {
            addThemedCSS(t => `
                .enh-blur{cursor:pointer;user-select:none;position:relative}
                .enh-blur,.enh-blur *{color:transparent!important;text-shadow:0 0 7px ${t.tx1}}
                .enh-blur::after{content:'Click or press Enter to reveal';position:absolute;top:50%;left:50%;
                    transform:translate(-50%,-50%);color:${t.accent};font-weight:700;font-size:12px;text-shadow:none;
                    background:${t.sf2};border:1px solid ${t.accentBorder};box-shadow:${t.sh1};padding:4px 12px;border-radius:6px;pointer-events:none;
                    opacity:1;transition:opacity .3s ease}
                .enh-blur:focus-visible{outline:2px solid ${t.accent};outline-offset:3px}
            `, 'enh-spoilerBlur');

            const plotFull = document.querySelector('[data-testid="plot-l"],[data-testid="plot-xl"]');
            if (plotFull && plotFull.textContent.length > 200) {
                this._plot = plotFull;
                this._plotAttributes = new Map(
                    ['role', 'tabindex', 'aria-pressed', 'aria-label', 'title']
                        .map(attribute => [attribute, plotFull.getAttribute(attribute)])
                );
                plotFull.classList.add('enh-blur');
                plotFull.setAttribute('role', 'button');
                plotFull.setAttribute('tabindex', '0');
                plotFull.setAttribute('aria-pressed', 'false');
                plotFull.setAttribute('aria-label', 'Reveal plot synopsis');
                plotFull.title = 'Click or press Enter to reveal plot synopsis';
                const reveal = () => {
                    if (plotFull.classList.contains('enh-revealed')) return;
                    plotFull.classList.add('enh-revealed');
                    plotFull.classList.remove('enh-blur');
                    restoreElementAttributes(plotFull, this._plotAttributes);
                    showToast('Plot synopsis revealed');
                };
                this._revealHandler = event => {
                    if (event.target.closest?.('a,button,input,select,textarea')) return;
                    reveal();
                };
                this._revealKeyHandler = event => {
                    if (event.target !== plotFull || !['Enter', ' '].includes(event.key)) return;
                    event.preventDefault();
                    reveal();
                };
                plotFull.addEventListener('click', this._revealHandler);
                plotFull.addEventListener('keydown', this._revealKeyHandler);
            }
        },
        destroy() {
            removeCSS('enh-spoilerBlur');
            this._plot?.removeEventListener('click', this._revealHandler);
            this._plot?.removeEventListener('keydown', this._revealKeyHandler);
            [this._plot].filter(Boolean).forEach(element => {
                element.classList.remove('enh-blur', 'enh-revealed');
                restoreElementAttributes(element, this._plotAttributes);
            });
            this._plot = null;
            this._plotAttributes = null;
            this._revealHandler = null;
            this._revealKeyHandler = null;
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
            addThemedCSS(t => `
                #enh-quicknav{position:fixed;right:18px;top:50%;transform:translateY(-50%);
                    z-index:99999;display:flex;flex-direction:column;gap:5px;padding:6px;
                    background:${t.sf0};border:1px solid ${t.bd0};border-radius:14px;box-shadow:${t.sh2}}
                .enh-qn-dot{width:70px;min-height:34px;border-radius:8px;
                    background:transparent;border:1px solid transparent;
                    color:${t.tx3};font-size:10px;font-weight:700;letter-spacing:.01em;cursor:pointer;
                    display:flex;align-items:center;justify-content:center;transition:background .15s ease,border-color .15s ease,color .15s ease,transform .15s ease;
                    text-decoration:none;position:relative;padding:0 5px;font-family:inherit}
                .enh-qn-dot:hover,.enh-qn-dot:focus-visible{background:${t.accentMuted};border-color:${t.accentBorder};
                    color:${t.accent};transform:translateX(-2px)}
                .enh-qn-dot::before{content:attr(data-label);position:absolute;right:calc(100% + 8px);
                    padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;
                    background:${t.sf1};color:${t.tx1};white-space:nowrap;border:1px solid ${t.bd1};
                    opacity:0;transform:translateX(4px);pointer-events:none;transition:opacity .15s ease,transform .15s ease}
                .enh-qn-dot:hover::before,.enh-qn-dot:focus-visible::before{opacity:1;transform:translateX(0)}
                @media(max-width:1200px){#enh-quicknav{display:none}}
            `, 'enh-quickNav');

            const nav = makeEl('nav', { id:'enh-quicknav', 'aria-label':'On this page' });
            this._navItems.forEach(s => {
                const sec = document.querySelector(`section[data-testid="${s.id}"]`);
                if (!sec) return;
                nav.appendChild(makeEl('button', {
                    className:'enh-qn-dot', type:'button', dataset:{ label:s.label }, textContent:s.label,
                    title: s.label, 'aria-label': `Jump to ${s.label}`,
                    onClick: () => sec.scrollIntoView({ behavior:getEnhancementScrollBehavior(), block:'start' })
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

    reg({
        key: 'searchButtons', name: 'Watch search buttons', group: 'Features',
        init() {
            if (!isIMDbHost()) return;
            const isCurrent = createFeatureGuard(this);
            waitForTitleSurface().then(() => {
                if (!isCurrent()) return;
                if (document.getElementById('enh-search-buttons')) return;
                const title = getTitleText();
                if (!title) return;
                const ctx = getLinkContext(title);
                const sites = getSiteList('watchSites', DEFAULT_WATCH_SITES).filter(site => site.enabled !== false);
                if (!sites.length) return;
                const wrap = makeEl('section', {
                    id:'enh-search-buttons',
                    role:'region',
                    'aria-label':'Watch movie and show sites',
                });
                const label = makeEl('div', { className:'enh-stream-label' },
                    makeEl('span', { className:'enh-stream-label__dot' }),
                    'WATCH'
                );
                const groups = makeEl('div', { className:'enh-link-groups' });
                const siteGroups = groupSitesByCategory(sites);
                const primaryGroup = siteGroups.find(groupData => groupData.category === 'watch') || siteGroups[0];
                const primarySite = primaryGroup?.sites?.[0];
                const createSiteButton = (site, className = 'enh-search-btn') => {
                    const url = site.storeQuery ? getCinebyHost() : applyLinkTemplate(site.url, ctx);
                    const primary = className.includes('enh-search-btn--primary');
                    const contents = primary
                        ? [
                            makeEl('span', { className:'enh-search-btn__action' }, 'Watch'),
                            makeEl('span', { className:'enh-search-btn__site' }, site.name),
                            makeEl('span', { className:'enh-search-btn__arrow', 'aria-hidden':'true' }, '→'),
                        ]
                        : [makeEl('span', {}, site.name)];
                    return makeEl('a', {
                        href:url,
                        target:'_blank',
                        rel:'noopener noreferrer',
                        className,
                        dataset:{ url, storeQuery:String(Boolean(site.storeQuery)) },
                        style:{ '--btn-color':site.color },
                        title:`Search ${site.name} for ${title}`,
                        'aria-label': `Open ${site.name} search for ${title}`,
                    }, ...contents);
                };
                const findNativeTitleAction = patterns => {
                    const hero = document.querySelector('section[data-testid="hero-parent"]') || document;
                    const candidates = hero.querySelectorAll('button, a, [role="button"]');
                    let inspected = 0;
                    for (const candidate of candidates) {
                        if (++inspected > 200 || candidate.id?.startsWith('enh-') || candidate.closest?.('[id^="enh-"]')) continue;
                        const haystack = [candidate.getAttribute('aria-label'), candidate.getAttribute('title'), candidate.textContent]
                            .filter(Boolean).join(' ').slice(0, 400).toLowerCase();
                        if (patterns.some(pattern => haystack.includes(pattern))) return candidate;
                    }
                    return null;
                };
                const actions = makeEl('div', { id:'enh-editorial-actions' });
                if (primarySite) actions.appendChild(createSiteButton(primarySite, 'enh-search-btn enh-search-btn--primary'));
                actions.appendChild(makeEl('button', {
                    type:'button',
                    className:'enh-editorial-action',
                    onClick: () => {
                        const rating = document.querySelector('[data-testid="hero-rating-bar__aggregate-rating"]');
                        rating?.scrollIntoView({ behavior:getEnhancementScrollBehavior(), block:'center' });
                        rating?.querySelector('button, a, [tabindex]:not([tabindex="-1"])')?.focus?.();
                    },
                }, 'Rate'));
                actions.appendChild(makeEl('button', {
                    type:'button',
                    className:'enh-editorial-action',
                    onClick: () => {
                        const watchlist = findNativeTitleAction(['watchlist', 'watch list', 'add to watch']);
                        if (watchlist) watchlist.click();
                        else showToast('IMDb watchlist controls are unavailable on this title surface', 3500);
                    },
                }, 'Add to watchlist'));

                const secondarySites = sites.filter(site => site !== primarySite);
                if (secondarySites.length) {
                    const options = makeEl('details', { className:'enh-watch-options' });
                    options.appendChild(makeEl('summary', { className:'enh-watch-options__summary' },
                        makeEl('span', {}, 'More watch options'),
                        makeEl('span', { className:'enh-watch-options__count' }, `${secondarySites.length} sites`)
                    ));
                    const optionGroups = makeEl('div', { className:'enh-watch-options__groups' });
                    groupSitesByCategory(secondarySites).forEach(groupData => {
                        const group = makeEl('div', { className:'enh-link-group' });
                        if (groupData.category !== 'watch') {
                            group.appendChild(makeEl('div', { className:'enh-link-group__label' }, getSiteCategoryLabel(groupData.category)));
                        }
                        const row = makeEl('div', { className:'enh-search-row enh-search-row--compact' });
                        groupData.sites.forEach(site => row.appendChild(createSiteButton(site, 'enh-search-btn enh-search-btn--compact')));
                        group.appendChild(row);
                        optionGroups.appendChild(group);
                    });
                    options.appendChild(optionGroups);
                    groups.appendChild(options);
                }
                wrap.appendChild(label);
                wrap.appendChild(actions);
                wrap.appendChild(groups);
                appendTitleStackItem(wrap, TITLE_STACK_ORDER.searchButtons);
                wrap.querySelectorAll('.enh-search-btn').forEach(btn => {
                    btn.addEventListener('click', event => {
                        if (btn.dataset.storeQuery !== 'true' || storeCinebyQuery(title)) return;
                        event.preventDefault();
                        showToast(getCinebyHandoffFailureMessage(), 4500);
                    });
                });
            }).catch(() => {});
        },
        destroy() {
            const wrap = document.getElementById('enh-search-buttons');
            const trailer = wrap?.querySelector('#enh-trailer-btn');
            const menu = wrap?.querySelector('#enh-link-menu-wrap');
            if (trailer) appendTitleStackItem(trailer, TITLE_STACK_ORDER.trailerPopover);
            if (menu) {
                menu.classList.add('enh-link-menu-wrap--standalone');
                appendTitleStackItem(menu, TITLE_STACK_ORDER.expandedLinkMenu);
            }
            wrap?.remove();
            pruneTitleStack();
        }
    });

    reg({
        key: 'externalLinks', name: 'External links bar', group: 'Features',
        init() {
            const isCurrent = createFeatureGuard(this);
            waitForTitleSurface().then(() => {
                if (!isCurrent()) return;
                if (document.getElementById('enh-external-links')) return;
                const title = getTitleText(), year = getTitleYear(), imdbId = getIMDbID();
                if (!title || !imdbId) return;
                const ctx = getLinkContext(title, imdbId, year);
                const links = filterSitesForMediaType(getSiteList('externalSites', DEFAULT_EXTERNAL_SITES))
                    .filter(link => link.enabled !== false);
                const bar = makeEl('section', {
                    id:'enh-external-links',
                    role:'region',
                    'aria-label':'Where to watch and research',
                });
                bar.appendChild(makeEl('div', { className:'enh-external-links__header' },
                    makeEl('div', { className:'enh-external-links__title' }, 'Where to watch'),
                    makeEl('div', { className:'enh-external-links__hint' }, 'Reviews, availability, trailers and research')
                ));
                const externalGroups = makeEl('div', { className:'enh-external-groups' });
                groupSitesByCategory(links).forEach(groupData => {
                    const group = makeEl('div', {
                        className:'enh-external-group',
                        dataset:{ category:groupData.category },
                    });
                    group.appendChild(makeEl('div', { className:'enh-link-group__label' }, getSiteCategoryLabel(groupData.category)));
                    const row = makeEl('div', { className:'enh-external-group__row' });
                    groupData.sites.forEach(link => {
                        row.appendChild(makeEl('a', {
                            href: applyLinkTemplate(link.url, ctx),
                            target:'_blank',
                            rel:'noopener noreferrer',
                            className:'enh-ext-link',
                            style:{ '--link-color':link.color },
                            'aria-label': `Open ${getSiteCategoryLabel(link.category)} link: ${link.name}`,
                        }, link.name));
                    });
                    group.appendChild(row);
                    externalGroups.appendChild(group);
                });
                bar.appendChild(externalGroups);
                appendTitleStackItem(bar, TITLE_STACK_ORDER.externalLinks);
                const trailer = document.getElementById('enh-trailer-btn');
                const menu = document.getElementById('enh-link-menu-wrap');
                if (trailer) bar.appendChild(trailer);
                if (menu) {
                    menu.classList.remove('enh-link-menu-wrap--standalone');
                    bar.appendChild(menu);
                }
            }).catch(() => {});
        },
        destroy() {
            const bar = document.getElementById('enh-external-links');
            const trailer = bar?.querySelector('#enh-trailer-btn');
            const menu = bar?.querySelector('#enh-link-menu-wrap');
            if (trailer) appendTitleStackItem(trailer, TITLE_STACK_ORDER.trailerPopover);
            if (menu) {
                menu.classList.add('enh-link-menu-wrap--standalone');
                appendTitleStackItem(menu, TITLE_STACK_ORDER.expandedLinkMenu);
            }
            bar?.remove();
            pruneTitleStack();
        }
    });

    reg({
        key: 'trailerPopover', name: 'Trailer popover', group: 'Features',
        _keydown: null,
        _focusin: null,
        _lastFocused: null,
        _previousOverflow: '',
        _modalOpen: false,
        _modalGeneration: 0,
        init() {
            if (!isIMDbHost()) return;
            const isCurrent = createFeatureGuard(this);
            addThemedCSS(t => `
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
                if (!isCurrent()) return;
                if (document.getElementById('enh-trailer-btn')) return;
                const btn = makeEl('button', {
                    id:'enh-trailer-btn',
                    type:'button',
                    'aria-haspopup':'dialog',
                    'aria-controls':'enh-trailer-dialog',
                    'aria-expanded':'false',
                    onClick: () => this._open(),
                }, 'Trailer');
                const editorialActions = document.getElementById('enh-editorial-actions');
                const extBar = document.getElementById('enh-external-links');
                if (editorialActions) editorialActions.appendChild(btn);
                else if (extBar) extBar.appendChild(btn);
                else appendTitleStackItem(btn, TITLE_STACK_ORDER.trailerPopover);
            }).catch(() => {});
        },
        async _open() {
            const overlay = this._renderModal('Loading trailer...');
            const generation = this._modalGeneration;
            const body = overlay.querySelector('.enh-trailer-body');
            try {
                const videoId = normalizeYouTubeVideoId(await this._getVideoId());
                if (!videoId) throw new Error('Trailer unavailable');
                if (generation !== this._modalGeneration || !body.isConnected) return;
                body.replaceChildren(makeEl('iframe', {
                    src:`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`,
                    title:`${getTitleText()} trailer`,
                    allow:'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
                    allowfullscreen:'allowfullscreen',
                }));
            } catch {
                if (generation !== this._modalGeneration || !body.isConnected) return;
                const url = getTrailerSearchUrl();
                body.replaceChildren(makeEl('a', {
                    href:url,
                    target:'_blank',
                    rel:'noopener noreferrer',
                    className:'enh-trailer-fallback',
                }, 'Open trailer search on YouTube'));
            }
        },
        _renderModal(message) {
            if (this._modalOpen) this._closeModal(false);
            document.getElementById('enh-trailer-overlay')?.remove();
            this._modalOpen = true;
            this._modalGeneration += 1;
            this._lastFocused = document.activeElement;
            this._previousOverflow = document.documentElement.style.overflow;
            document.documentElement.style.overflow = 'hidden';
            document.getElementById('enh-trailer-btn')?.setAttribute('aria-expanded', 'true');
            const close = () => this._closeModal();
            this._keydown = event => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    close();
                    return;
                }
                if (event.key !== 'Tab') return;
                const dialog = document.getElementById('enh-trailer-dialog');
                const focusables = getFocusableElements(dialog);
                if (!focusables.length) {
                    event.preventDefault();
                    dialog?.focus();
                    return;
                }
                const first = focusables[0];
                const last = focusables[focusables.length - 1];
                const focusOutside = !dialog?.contains(document.activeElement);
                if (event.shiftKey && (document.activeElement === first || focusOutside)) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && (document.activeElement === last || focusOutside)) {
                    event.preventDefault();
                    first.focus();
                }
            };
            document.addEventListener('keydown', this._keydown);
            this._focusin = event => {
                const dialog = document.getElementById('enh-trailer-dialog');
                if (!this._modalOpen || !dialog || dialog.contains(event.target)) return;
                const focusables = getFocusableElements(dialog);
                (focusables[0] || dialog).focus();
            };
            document.addEventListener('focusin', this._focusin);

            const overlay = makeEl('div', {
                id:'enh-trailer-overlay',
                role:'presentation',
                onClick: e => { if (e.target.id === 'enh-trailer-overlay') close(); },
            }, makeEl('div', {
                id:'enh-trailer-dialog',
                role:'dialog',
                'aria-modal':'true',
                'aria-labelledby':'enh-trailer-title',
                tabindex:'-1',
            },
                makeEl('div', { className:'enh-trailer-header' },
                    makeEl('div', { className:'enh-trailer-title', id:'enh-trailer-title' }, `${getTitleText()} trailer`),
                    makeEl('button', { type:'button', className:'enh-trailer-close', 'aria-label':'Close trailer', onClick:close }, '×')
                ),
                makeEl('div', { className:'enh-trailer-body' },
                    makeEl('div', { role:'status', 'aria-live':'polite' }, message)
                )
            ));
            document.body.appendChild(overlay);
            setTimeout(() => overlay.querySelector('.enh-trailer-close')?.focus(), 20);
            return overlay;
        },
        _closeModal(restoreFocus = true) {
            const wasOpen = this._modalOpen;
            this._modalOpen = false;
            this._modalGeneration += 1;
            document.removeEventListener('keydown', this._keydown);
            document.removeEventListener('focusin', this._focusin);
            this._keydown = null;
            this._focusin = null;
            document.getElementById('enh-trailer-overlay')?.remove();
            document.getElementById('enh-trailer-btn')?.setAttribute('aria-expanded', 'false');
            if (wasOpen) document.documentElement.style.overflow = this._previousOverflow;
            if (wasOpen && restoreFocus) this._lastFocused?.focus?.();
            this._lastFocused = null;
            this._previousOverflow = '';
        },
        async _getVideoId() {
            const imdbId = getIMDbID();
            const cacheKey = imdbId ? `yt_${imdbId}` : '';
            const cached = cacheKey ? cacheGet(cacheKey) : null;
            const cachedVideoId = normalizeYouTubeVideoId(cached?.videoId);
            if (cachedVideoId) return cachedVideoId;
            if (cached?.unavailable) throw new Error('Trailer unavailable');

            const res = await httpGet(getTrailerSearchUrl(), {
                timeout: 12000,
                cancelOnRouteChange: true,
                headers: { Accept:'text/html,application/xhtml+xml' },
            });
            const videoId = parseYouTubeTrailerVideoId(res.responseText, getTitleText(), getTitleYear());
            if (!videoId) {
                if (cacheKey) cacheSetUnavailable(cacheKey);
                throw new Error('Trailer unavailable');
            }
            if (cacheKey) cacheSet(cacheKey, { videoId });
            return videoId;
        },
        destroy() {
            this._closeModal(false);
            removeCSS('enh-trailerPopover');
            document.getElementById('enh-trailer-btn')?.remove();
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
                { n:'AllMovie', u:'https://www.allmovie.com/search/movies/{{T}}' },
                { n:'Box Office Mojo', u:'https://www.boxofficemojo.com/search/?q={{T}}' },
                { n:'Criticker', u:'https://www.criticker.com/?search={{ID}}' },
                { n:'Trakt', u:'https://app.trakt.tv/search?query={{T}}' },
            ],
            'Reviews': [
                { n:'Rotten Tomatoes', u:'https://www.rottentomatoes.com/search?search={{T}}' },
                { n:'Metacritic', u:'https://www.metacritic.com/search/{{T}}/' },
            ],
            'Search': [
                { n:'Google', u:'https://www.google.com/search?q={{T}}+{{Y}}' },
                { n:'DuckDuckGo', u:'https://duckduckgo.com/?q={{T}}+{{Y}}' },
                { n:'YouTube', u:'https://www.youtube.com/results?search_query={{T}}%20trailer' },
                { n:'Wikipedia', u:'https://en.wikipedia.org/w/index.php?search={{T}}' },
            ],
            'Subtitles': [
                { n:'OpenSubtitles', u:'https://www.opensubtitles.org/en/search/imdbid-{{ID_NUM}}' },
                { n:'OpenSubs.com', u:'https://www.opensubtitles.com/en/en/search-all/q-{{ID}}' },
                { n:'SubDL', u:'https://subdl.com/search/{{T}}' },
                { n:'YIFY-Subs', u:'https://yifysubtitles.ch/movie-imdb/{{ID}}', movieOnly:true },
            ],
            'TV': [
                { n:'TheTVDB', u:'https://www.thetvdb.com/search?query={{ID}}' },
                { n:'TVMaze', u:'https://www.tvmaze.com/search?q={{T}}' },
                { n:'Ep Calendar', u:'https://episodecalendar.com/en/shows?q%5Bname_cont%5D={{T}}' },
            ],
            'Torrents': [
                { n:'1337x', u:'https://1337x.to/search/{{T}}+{{Y}}/1/' },
            ],
        },
        _closeHandler: null,
        init() {
            const isCurrent = createFeatureGuard(this);
            waitForTitleSurface().then(() => {
                if (!isCurrent()) return;
                if (document.getElementById('enh-link-menu-wrap')) return;
                const title = getTitleText(), year = getTitleYear(), imdbId = getIMDbID();
                if (!title || !imdbId) return;
                const buildUrl = (tpl) => tpl.replace(/\{\{ID\}\}/g, imdbId)
                    .replace(/\{\{ID_NUM\}\}/g, imdbId.replace(/^tt/, ''))
                    .replace(/\{\{TRAKT_TYPE\}\}/g, isTVType() ? 'show' : 'movie')
                    .replace(/\{\{T\}\}/g, encodeURIComponent(title)).replace(/\{\{Y\}\}/g, year);

                const container = makeEl('div', { id:'enh-link-menu-wrap' });
                let dropdown = null;
                const getItems = () => Array.from(dropdown?.querySelectorAll('[role="menuitem"]') || []);
                const setCurrentItem = item => {
                    getItems().forEach(candidate => { candidate.tabIndex = candidate === item ? 0 : -1; });
                };
                const closeMenu = (focusTrigger = false) => {
                    dropdown?.classList.remove('enh-visible');
                    trigger.setAttribute('aria-expanded', 'false');
                    getItems().forEach(item => { item.tabIndex = -1; });
                    if (focusTrigger) trigger.focus();
                };
                const openMenu = (focusItem = 'none') => {
                    dropdown?.classList.add('enh-visible');
                    trigger.setAttribute('aria-expanded', 'true');
                    const items = getItems();
                    const item = focusItem === 'last' ? items[items.length - 1] : items[0];
                    if (item) {
                        setCurrentItem(item);
                        if (focusItem !== 'none') item.focus();
                    }
                };
                const trigger = makeEl('button', {
                    id:'enh-link-menu-trigger', type:'button',
                    textContent:'More links',
                    'aria-haspopup':'menu',
                    'aria-controls':'enh-link-menu-dropdown',
                    'aria-expanded':'false',
                    onClick: (e) => {
                        e.stopPropagation();
                        if (dropdown.classList.contains('enh-visible')) closeMenu();
                        else openMenu();
                    }
                });
                trigger.addEventListener('keydown', event => {
                    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
                    event.preventDefault();
                    openMenu(event.key === 'ArrowUp' ? 'last' : 'first');
                });

                dropdown = makeEl('div', {
                    id:'enh-link-menu-dropdown', className:'enh-link-dropdown', role:'menu',
                    'aria-labelledby':'enh-link-menu-trigger',
                });
                for (const [cat, links] of Object.entries(this._DB)) {
                    if (cat === 'TV' && !isTVType()) continue;
                    if (cat === 'Movie Sites' && isTVType()) continue;
                    dropdown.appendChild(makeEl('div', { className:'enh-link-dropdown__cat' }, cat));
                    const row = makeEl('div', { className:'enh-link-dropdown__row', role:'group', 'aria-label':cat });
                    links.filter(l => !(l.movieOnly && isTVType())).forEach(l => row.appendChild(makeEl('a', {
                        href: buildUrl(l.u), target:'_blank', rel:'noopener noreferrer', className:'enh-link-dropdown__item',
                        role:'menuitem', tabindex:'-1',
                    }, l.n)));
                    dropdown.appendChild(row);
                }
                dropdown.addEventListener('keydown', event => {
                    const items = getItems();
                    const current = items.indexOf(document.activeElement);
                    let next = null;
                    if (event.key === 'ArrowDown') next = (current + 1) % items.length;
                    if (event.key === 'ArrowUp') next = (current - 1 + items.length) % items.length;
                    if (event.key === 'Home') next = 0;
                    if (event.key === 'End') next = items.length - 1;
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        closeMenu(true);
                        return;
                    }
                    if (event.key === 'Tab') {
                        closeMenu();
                        return;
                    }
                    if (next === null || !items.length) return;
                    event.preventDefault();
                    setCurrentItem(items[next]);
                    items[next].focus();
                });
                dropdown.addEventListener('click', event => {
                    if (event.target.closest?.('[role="menuitem"]')) closeMenu();
                });

                container.appendChild(trigger);
                container.appendChild(dropdown);
                const editorialActions = document.getElementById('enh-editorial-actions');
                const extBar = document.getElementById('enh-external-links');
                if (editorialActions) editorialActions.appendChild(container);
                else if (extBar) extBar.appendChild(container);
                else {
                    container.classList.add('enh-link-menu-wrap--standalone');
                    appendTitleStackItem(container, TITLE_STACK_ORDER.expandedLinkMenu);
                }

                this._closeHandler = (e) => {
                    if (!e.target.closest('#enh-link-menu-trigger') && !e.target.closest('#enh-link-menu-dropdown')) {
                        closeMenu();
                    }
                };
                document.addEventListener('click', this._closeHandler);
            }).catch(() => {});
        },
        destroy() {
            if (this._closeHandler) document.removeEventListener('click', this._closeHandler);
            this._closeHandler = null;
            document.getElementById('enh-link-menu-wrap')?.remove();
            pruneTitleStack();
        }
    });

    reg({
        key: 'watchedMarking', name: 'Private seen / skip marks', group: 'Features',
        _observer: null,
        _clickHandler: null,
        _raf: 0,
        _pendingScanRoots: null,
        init() {
            if (!isIMDbHost()) return;
            addThemedCSS(t => `
                .enh-markable-card{position:relative!important}
                .enh-markable-card.enh-marked img{opacity:.72;filter:saturate(.58);transition:opacity .15s ease,filter .15s ease}
                .enh-markable-card.enh-marked:hover img,.enh-markable-card.enh-marked:focus-within img{opacity:1;filter:none}
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
                .enh-mark-btn[data-active="true"]{background:${t.accent};border-color:${t.accent};color:${readableTextColor(t.accent)}}
                .enh-mark-btn--skip[data-active="true"]{background:${t.red};border-color:${t.red};color:${readableTextColor(t.red)}}
                .enh-mark-badge{
                    position:absolute;left:6px;bottom:6px;z-index:19;
                    padding:4px 7px;border-radius:6px;background:${t.accent};color:${readableTextColor(t.accent)};
                    font:800 10px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                    box-shadow:${t.sh1};text-transform:uppercase;letter-spacing:.04em;
                    pointer-events:none;
                }
                .enh-mark-badge--skip{background:${t.red};color:${readableTextColor(t.red)}}
                /* IMDb draws its own Watched control on the same corner of a card.
                   Where one is present, the local controls and badge step aside so
                   the native account action stays clickable and unambiguous. */
                .enh-markable-card[data-enh-native-watched="true"] .enh-mark-controls{top:44px}
                .enh-markable-card[data-enh-native-watched="true"] .enh-mark-badge{left:auto;right:6px}
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
                const state = action === 'clear' || getUserMark(imdbId) === action ? '' : action;
                if (!setUserMark(imdbId, state, card.dataset.enhMarkTitle || getTitleText())) return;
                this._syncAll();
                showToast(state
                    ? `Saved locally as ${state === 'watched' ? 'Seen' : 'Skip'} — IMDb Watched was not changed`
                    : 'Local mark cleared');
            };
            document.body.addEventListener('click', this._clickHandler, true);

            this._scan(document);
            this._pendingScanRoots = new Set();
            this._observer = new MutationObserver(mutations => {
                mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
                    if (node?.matches || node?.querySelectorAll) this._pendingScanRoots.add(node);
                }));
                if (!this._pendingScanRoots.size) return;
                if (this._pendingScanRoots.size > 50) {
                    this._pendingScanRoots.clear();
                    this._pendingScanRoots.add(document);
                }
                cancelAnimationFrame(this._raf);
                this._raf = requestAnimationFrame(() => {
                    const roots = [...this._pendingScanRoots];
                    this._pendingScanRoots.clear();
                    roots.forEach(root => {
                        if (root === document || root.isConnected !== false) this._scan(root);
                    });
                });
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
                const imdbId = getLinkedTitleId(anchor.href);
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
            card.dataset.enhNativeWatched = String(Boolean(card.querySelector(NATIVE_WATCHED_SELECTOR)));

            if (!Array.from(card.children).some(child => child.classList?.contains('enh-mark-controls'))) {
                const controls = makeEl('div', { className: 'enh-mark-controls' },
                    makeEl('button', {
                        type: 'button',
                        className: 'enh-mark-btn enh-mark-btn--watched',
                        dataset: { enhMarkAction: 'watched' },
                        'aria-pressed': 'false',
                        title: 'Save a private local Seen mark',
                        'aria-label': `Save a private Seen mark for ${title || imdbId}; does not change IMDb Watched`,
                    }, 'Seen'),
                    makeEl('button', {
                        type: 'button',
                        className: 'enh-mark-btn enh-mark-btn--skip',
                        dataset: { enhMarkAction: 'skip' },
                        'aria-pressed': 'false',
                        title: 'Save a private local Skip mark',
                        'aria-label': `Save a private Skip mark for ${title || imdbId}; does not change IMDb Watched`,
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
                const action = btn.dataset.enhMarkAction;
                const active = action === mark;
                btn.dataset.active = String(active);
                if (action === 'watched' || action === 'skip') {
                    const stateLabel = action === 'watched' ? 'watched' : 'skipped';
                    btn.setAttribute('aria-pressed', String(active));
                    btn.setAttribute('aria-label', active
                        ? `${card.dataset.enhMarkTitle} has a private local ${stateLabel} mark; activate to clear`
                        : `Save a private ${stateLabel} mark for ${card.dataset.enhMarkTitle}; does not change IMDb Watched`);
                } else if (action === 'clear') {
                    btn.disabled = !mark;
                }
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
            badge.textContent = mark === 'watched' ? 'Local seen' : 'Local skip';
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
            this._pendingScanRoots?.clear();
            this._pendingScanRoots = null;
            document.querySelectorAll('.enh-markable-card').forEach(card => {
                card.classList.remove('enh-markable-card', 'enh-marked', 'enh-marked--watched', 'enh-marked--skip');
                delete card.dataset.enhMarkId;
                delete card.dataset.enhMarkTitle;
                delete card.dataset.enhNativeWatched;
                card.querySelectorAll('.enh-mark-controls,.enh-mark-badge').forEach(el => el.remove());
            });
        }
    });

    reg({
        key: 'servarrIntegration', name: 'Servarr quick-add', group: 'Features',
        init() {
            if (!isIMDbHost()) return;
            const isCurrent = createFeatureGuard(this);
            waitForTitleSurface().then(() => {
                if (!isCurrent()) return;
                if (document.getElementById('enh-servarr-actions')) return;
                const imdbId = getIMDbID(), title = getTitleText(), year = getTitleYear();
                if (!imdbId || !title) return;

                const type = getMediaType();
                const actions = [];
                if (!isTVType(type) && isServarrConfigured('radarr')) actions.push({ kind:'radarr', label:'Add Radarr' });
                if (isTVType(type) && isServarrConfigured('sonarr')) actions.push({ kind:'sonarr', label:'Add Sonarr' });
                if (isSeerrConfigured()) actions.push({ kind:'seerr', label:'Request' });
                if (!actions.length) return;

                addThemedCSS(t => `
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
                    .enh-servarr-btn:disabled { cursor: progress; transform: none; }
                    /* The button reports where a title stands rather than only what
                       the click does, so state reads at a glance. Colours stay on
                       the border and a leading dot; label text keeps the tested
                       theme foreground instead of inheriting a status hue. */
                    .enh-servarr-btn[data-state] { gap: 6px; }
                    .enh-servarr-btn[data-state]::before {
                        content: ''; width: 7px; height: 7px; border-radius: 50%; background: currentColor; opacity: .85;
                    }
                    .enh-servarr-btn[data-state="add"]::before { background: ${t.tx3}; }
                    .enh-servarr-btn[data-state="pending"]::before { background: ${t.accent}; }
                    .enh-servarr-btn[data-state="queued"]::before,
                    .enh-servarr-btn[data-state="processing"]::before,
                    .enh-servarr-btn[data-state="partial"]::before { background: ${t.accent}; }
                    .enh-servarr-btn[data-state="library"]::before,
                    .enh-servarr-btn[data-state="done"]::before { background: ${t.green}; }
                    .enh-servarr-btn[data-state="library"],
                    .enh-servarr-btn[data-state="done"] { border-color: ${t.green}; }
                    .enh-servarr-btn[data-state="queued"],
                    .enh-servarr-btn[data-state="processing"],
                    .enh-servarr-btn[data-state="partial"] { border-color: ${t.accent}; }
                    .enh-servarr-btn[data-state="library"]:disabled,
                    .enh-servarr-btn[data-state="queued"]:disabled,
                    .enh-servarr-btn[data-state="processing"]:disabled,
                    .enh-servarr-btn[data-state="partial"]:disabled,
                    .enh-servarr-btn[data-state="done"]:disabled { cursor: default; opacity: 1; }
                    .enh-servarr-btn[data-state="pending"]:disabled { opacity: .72; }
                `, 'enh-servarrIntegration');

                const bar = makeEl('div', { id:'enh-servarr-actions' },
                    makeEl('div', { className:'enh-servarr-label' }, 'SERVARR')
                );
                actions.forEach(action => {
                    const btn = makeEl('button', {
                        type:'button',
                        className:'enh-servarr-btn',
                        dataset:{ kind:action.kind, state:'add' },
                        'aria-label': `${action.label} for ${title}`,
                        'aria-live':'polite',
                        'aria-atomic':'true',
                        onClick: async () => {
                            const original = btn.textContent;
                            const originalLabel = btn.getAttribute('aria-label');
                            const service = action.kind === 'radarr' ? 'Radarr'
                                : action.kind === 'sonarr' ? 'Sonarr' : 'Overseerr';
                            const busyVerb = action.kind === 'seerr' ? 'Requesting' : 'Adding';
                            this._setState(btn, 'pending', `${busyVerb}...`, `${busyVerb} ${title} through ${service}`, { busy:true });
                            try {
                                const done = action.kind === 'seerr'
                                    ? await this._request(imdbId, title, year, isCurrent)
                                    : await this._add(action.kind, imdbId, title, year, isCurrent);
                                if (!done || !isCurrent()) return;
                                showToast(action.kind === 'seerr'
                                    ? `${title} requested through ${service}`
                                    : `${title} sent to ${service}`);
                                this._setState(btn, 'done',
                                    action.kind === 'seerr' ? 'Requested' : 'Added',
                                    action.kind === 'seerr'
                                        ? `${title} has been requested through ${service}`
                                        : `${title} added to ${service}`);
                            } catch (error) {
                                if (!isCurrent()) return;
                                console.warn('[IMDb Enhanced] integration action failed:', error);
                                showToast(`${service} ${action.kind === 'seerr' ? 'request' : 'add'} failed: ${getRequestErrorMessage(error)}`, 4500);
                                this._setState(btn, 'add', original, originalLabel, { enabled:true });
                            }
                        },
                    }, action.label);
                    bar.appendChild(btn);
                    if (action.kind === 'seerr') this._checkSeerr({ imdbId, title, year, type }, btn, isCurrent);
                    else this._checkLibrary(action.kind, { imdbId, title, year }, btn, bar, isCurrent);
                });
                appendTitleStackItem(bar, TITLE_STACK_ORDER.servarrIntegration);
            }).catch(() => {});
        },
        _setState(btn, state, text, label, { busy = false, enabled = false } = {}) {
            if (!btn) return;
            btn.dataset.state = state;
            if (text) btn.textContent = text;
            if (label) btn.setAttribute('aria-label', label);
            btn.disabled = !enabled;
            if (busy) btn.setAttribute('aria-busy', 'true');
            else btn.removeAttribute('aria-busy');
        },
        async _checkSeerr(ctx, btn, isCurrent) {
            try {
                const mediaType = isTVType(ctx.type) ? 'tv' : 'movie';
                const response = await seerrRequest('search', {
                    query:{ query: ctx.imdbId },
                    cancelOnRouteChange:true,
                });
                if (!isCurrent()) return;
                const payload = parseJSONResponse(response);
                const match = selectSeerrSearchResult(payload?.results, ctx.imdbId, mediaType);
                if (!match) return;
                btn.dataset.tmdbId = String(match.tmdbId);
                const state = mapSeerrMediaState(match.mediaInfo);
                if (state === 'add') return;
                const copy = {
                    library:['Available', `${ctx.title} is already available`],
                    partial:['Partly available', `${ctx.title} is partly available`],
                    processing:['Processing', `${ctx.title} is being processed`],
                    queued:['Requested', `${ctx.title} has already been requested`],
                }[state];
                if (copy) this._setState(btn, state, copy[0], copy[1]);
            } catch { /* status is best-effort; the request button still works */ }
        },
        async _request(imdbId, title, year, isCurrent) {
            const mediaType = isTVType(getMediaType()) ? 'tv' : 'movie';
            let tmdbId = Number(document.querySelector(`#enh-servarr-actions [data-kind="seerr"]`)?.dataset.tmdbId) || 0;
            if (!tmdbId) {
                const response = await seerrRequest('search', { query:{ query:imdbId }, cancelOnRouteChange:true });
                if (!isCurrent()) return false;
                const match = selectSeerrSearchResult(parseJSONResponse(response)?.results, imdbId, mediaType);
                if (!match) throw new Error('The Overseerr instance did not recognize this IMDb title');
                tmdbId = match.tmdbId;
            }
            const body = buildSeerrRequestBody(mediaType, tmdbId);
            if (!body) throw new Error('The Overseerr instance returned an unusable title id');
            if (!isCurrent()) return false;
            /* httpRequest owns serialization; pre-stringifying here would encode the
               body twice and send Overseerr a JSON string where it expects an object. */
            await seerrRequest('request', { method:'POST', body });
            return true;
        },
        async _checkLibrary(kind, ctx, btn, bar, isCurrent) {
            try {
                const path = kind === 'radarr' ? 'movie/lookup' : 'series/lookup';
                const response = await servarrRequest(kind, path, {
                    query:{ term: `imdb:${ctx.imdbId}` },
                    cancelOnRouteChange:true,
                });
                if (!isCurrent()) return;
                const items = parseJSONResponse(response);
                if (!Array.isArray(items) || !items.length) return;
                const found = selectServarrLookupResult(items, ctx, true);
                if (found) {
                    const label = kind === 'radarr' ? 'Radarr' : 'Sonarr';
                    this._setState(btn, 'library', 'In Library', `${ctx.title} is already in ${label}`);
                }
            } catch { /* library check is best-effort */ }
        },
        async _lookup(kind, ctx, isCurrent) {
            const path = kind === 'radarr' ? 'movie/lookup' : 'series/lookup';
            const terms = [
                `imdb:${ctx.imdbId}`,
                `https://www.imdb.com/title/${ctx.imdbId}/`,
                ctx.title,
            ].filter(Boolean);
            for (const term of terms) {
                if (!isCurrent()) return null;
                const response = await servarrRequest(kind, path, {
                    query:{ term },
                    cancelOnRouteChange:true,
                });
                if (!isCurrent()) return null;
                const items = parseJSONResponse(response);
                const item = selectServarrLookupResult(items, ctx);
                if (item) return item;
            }
            if (!isCurrent()) return null;
            throw new Error('No matching title found');
        },
        async _add(kind, imdbId, title, year, isCurrent) {
            const item = await this._lookup(kind, { imdbId, title, year }, isCurrent);
            if (!item || !isCurrent()) return false;
            const cfg = getServarrConfig(kind);
            if (kind === 'radarr') {
                const body = buildRadarrAddBody(item, cfg);
                await servarrRequest('radarr', 'movie', { method:'POST', body });
                return true;
            }

            const body = buildSonarrAddBody(item, cfg);
            await servarrRequest('sonarr', 'series', { method:'POST', body });
            return true;
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
            if (!isIMDbHost()) return;
            const isCurrent = createFeatureGuard(this);
            waitForTitleSurface().then(() => {
                if (!isCurrent()) return;
                if (document.getElementById('enh-media-server-status')) return;
                const imdbId = getIMDbID(), title = getTitleText(), year = getTitleYear();
                if (!imdbId || !title) return;

                const servers = getConfiguredMediaServers();
                if (!servers.length) return;

                addThemedCSS(t => `
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
                        role:'status',
                        'aria-live':'polite',
                        'aria-atomic':'true',
                    },
                        makeEl('span', { className:'enh-media-server-pill__dot', 'aria-hidden':'true' }),
                        makeEl('span', {}, server.label),
                        state
                    );
                    bar.appendChild(pill);
                    this._check(server, ctx).then(found => {
                        if (!isCurrent()) return;
                        pill.classList.add(found ? 'enh-media-server-pill--found' : 'enh-media-server-pill--missing');
                        state.textContent = found ? 'In Library' : 'Not found';
                        pill.title = `${server.label}: ${found ? 'already in library' : 'not found'}`;
                    }).catch(error => {
                        if (!isCurrent()) return;
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
                const response = await mediaServerRequest(server, '/library/search', { query, cancelOnRouteChange:true });
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
                const response = await mediaServerRequest(server, '/Items', { query, cancelOnRouteChange:true });
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
        _keydownHandler: null,
        _plotAttributes: null,
        init() {
            if (!isTVType() && !/\/title\/tt\d+\/episodes/i.test(location.pathname)) return;
            const isCurrent = createFeatureGuard(this);
            this._plotAttributes = new Map();
            addThemedCSS(t => `
                .enh-episode-spoiler {
                    filter: blur(5px);
                    cursor: pointer;
                    transition: filter .18s ease, opacity .18s ease;
                }
                .enh-episode-spoiler:hover { opacity: .9; }
                .enh-episode-spoiler:focus-visible { outline: 2px solid ${t.accent}; outline-offset: 3px; }
                #enh-best-episodes {
                    margin: 14px 0 18px;
                    padding: 14px;
                    border-radius: 10px;
                    border: 1px solid ${t.accentBorder};
                    background: ${t.accentMuted};
                    color: inherit;
                }
                #enh-best-episodes h3 {
                    margin: 0 0 10px;
                    font: 700 14px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                    color: ${t.accent};
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
                    background: ${t.sf1};
                    border: 1px solid ${t.bd0};
                }
                .enh-best-episode__rank,
                .enh-best-episode__rating {
                    color: ${t.accent};
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
                .enh-best-episode__title:hover { color: ${t.accent}; }
            `, 'enh-tvEpisodeTools');

            const run = () => {
                if (!isCurrent()) return;
                const episodes = this._collectEpisodes();
                if (get('spoilerBlur')) this._blurPlots(episodes);
                this._renderBestEpisodes(episodes);
            };
            waitFor('main, body').then(run).catch(() => { if (isCurrent()) run(); });

            this._clickHandler = (e) => {
                const spoiler = e.target.closest?.('.enh-episode-spoiler');
                if (!spoiler) return;
                if (e.target.closest?.('a,button,input,select,textarea')) return;
                this._revealPlot(spoiler);
            };
            this._keydownHandler = event => {
                const spoiler = event.target.closest?.('.enh-episode-spoiler');
                if (!spoiler || event.target !== spoiler || !['Enter', ' '].includes(event.key)) return;
                event.preventDefault();
                this._revealPlot(spoiler);
            };
            document.addEventListener('click', this._clickHandler);
            document.addEventListener('keydown', this._keydownHandler);
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
                    if (!this._plotAttributes.has(plot)) {
                        this._plotAttributes.set(plot, new Map(
                            ['role', 'tabindex', 'aria-pressed', 'aria-label', 'title']
                                .map(attribute => [attribute, plot.getAttribute(attribute)])
                        ));
                    }
                    plot.classList.add('enh-episode-spoiler');
                    plot.setAttribute('role', 'button');
                    plot.setAttribute('tabindex', '0');
                    plot.setAttribute('aria-pressed', 'false');
                    plot.setAttribute('aria-label', 'Reveal episode synopsis');
                    plot.title = 'Click or press Enter to reveal episode synopsis';
                }
            });
        },
        _revealPlot(plot) {
            if (!plot || plot.classList.contains('enh-revealed')) return;
            plot.classList.add('enh-revealed');
            plot.classList.remove('enh-episode-spoiler');
            restoreElementAttributes(plot, this._plotAttributes?.get(plot));
            showToast('Episode synopsis revealed');
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
            if (this._keydownHandler) document.removeEventListener('keydown', this._keydownHandler);
            this._clickHandler = null;
            this._keydownHandler = null;
            this._plotAttributes?.forEach((attributes, el) => {
                el.classList.remove('enh-episode-spoiler', 'enh-revealed');
                restoreElementAttributes(el, attributes);
            });
            this._plotAttributes?.clear();
            this._plotAttributes = null;
            document.getElementById('enh-best-episodes')?.remove();
        }
    });

    reg({
        key: 'tvShowEnhancements', name: 'TV show quick links', group: 'TV',
        init() {
            if (!isTVType()) return;
            const isCurrent = createFeatureGuard(this);
            addThemedCSS(t => `
                #enh-tv-bar{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
                .enh-tv-chip{padding:4px 12px;border-radius:8px;
                    font:600 11px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                    color:${t.blue};background:${t.blueMuted};
                    border:1px solid ${t.bd1};text-decoration:none!important;
                    transition:background .12s ease,border-color .12s ease,color .12s ease,transform .12s ease}
                .enh-tv-chip:hover{background:${t.sf2};color:${t.blueHi};border-color:${t.accentBorder}}
            `, 'enh-tvShow');

            waitForTitleSurface().then(() => {
                if (!isCurrent()) return;
                if (document.getElementById('enh-tv-bar')) return;
                const imdbId = getIMDbID(), title = getTitleText();
                if (!imdbId) return;
                const bar = makeEl('div', { id: 'enh-tv-bar' });
                [
                    { l:'Episodes List', u:`https://www.imdb.com/title/${imdbId}/episodes/` },
                    { l:'TheTVDB', u:`https://www.thetvdb.com/search?query=${imdbId}` },
                    { l:'TVMaze', u:`https://www.tvmaze.com/search?q=${encodeURIComponent(title)}` },
                    { l:'Trakt', u:`https://app.trakt.tv/search?query=${encodeURIComponent(title)}` },
                    { l:'Ep Calendar', u:`https://episodecalendar.com/en/shows?q%5Bname_cont%5D=${encodeURIComponent(title)}` },
                ].forEach(c => bar.appendChild(makeEl('a', { href:c.u, target:'_blank', rel:'noopener noreferrer', className:'enh-tv-chip' }, c.l)));

                appendTitleStackItem(bar, TITLE_STACK_ORDER.tvShowEnhancements);
            }).catch(() => {});
        },
        destroy() { removeCSS('enh-tvShow'); document.getElementById('enh-tv-bar')?.remove(); pruneTitleStack(); }
    });

    reg({
        key: 'subtitleLinks', name: 'Subtitle links', group: 'TV',
        init() {
            const isCurrent = createFeatureGuard(this);
            const imdbId = getIMDbID(), title = getTitleText();
            if (!imdbId) return;
            addThemedCSS(t => `
                #enh-sub-row{margin-top:12px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
                .enh-sub-row__label{color:${t.tx2};font-size:12px;font-weight:600;margin-right:4px}
                .enh-sub-link{--link-color:${t.blue}}
            `, 'enh-subtitleLinks');
            waitFor('section[data-testid="Details"]').then(sec => {
                if (!isCurrent()) return;
                if (document.getElementById('enh-sub-row')) return;
                const row = makeEl('div', { id:'enh-sub-row' });
                row.appendChild(makeEl('span', { className:'enh-sub-row__label' }, 'Subtitles:'));
                [
                    { n:'OpenSubtitles', u:`https://www.opensubtitles.org/en/search/imdbid-${imdbId.replace(/^tt/, '')}` },
                    { n:'OpenSubs.com', u:`https://www.opensubtitles.com/en/en/search-all/q-${imdbId}` },
                    { n:'SubDL', u:`https://subdl.com/search/${encodeURIComponent(title)}` },
                    { n:'YIFY-Subs', u:`https://yifysubtitles.ch/movie-imdb/${imdbId}`, movieOnly:true },
                    { n:'Addic7ed', u:`https://www.addic7ed.com/search.php?search=${encodeURIComponent(title)}&Submit=Search` },
                ].filter(s => !(s.movieOnly && isTVType())).forEach(s => row.appendChild(makeEl('a', {
                    href:s.u, target:'_blank', rel:'noopener noreferrer', className:'enh-ext-link enh-sub-link'
                }, s.n)));
                sec.appendChild(row);
            }).catch(() => {});
        },
        destroy() { removeCSS('enh-subtitleLinks'); document.getElementById('enh-sub-row')?.remove(); }
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
            addThemedCSS(t => `
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
                    if (!copyTextToClipboard(ids.join('\n'))) {
                        showToast('Copy failed. Check the userscript clipboard permission.', 4500);
                        return;
                    }
                    showToast(`Copied ${ids.length} IMDb IDs`);
                    btn.textContent = `Copy ${ids.length} IMDb IDs`;
                },
            }, `Copy ${this._ids().length || 'all'} IMDb IDs`);

            const target = document.querySelector('main') || document.body;
            target.insertBefore(btn, target.firstElementChild || null);
        },
        _ids() {
            return getListTitleIdsFromLinks(document.querySelectorAll('a[href*="/title/tt"]'));
        },
        destroy() {
            removeCSS('enh-watchlistBatch');
            document.getElementById('enh-watchlist-copy')?.remove();
        }
    });

    function isListPage() {
        return /\/(watchlist|list\/|chart\/)/i.test(location.pathname);
    }

    function getListTitleIdsFromLinks(links) {
        const ids = new Set();
        let inspected = 0;
        for (const link of links || []) {
            if (inspected >= COLLECTION_LINK_SCAN_LIMIT) break;
            inspected += 1;
            const id = getLinkedTitleId(link.href);
            if (id) ids.add(id);
        }
        return [...ids];
    }

    function getListTitlesFromLinks(links) {
        const seen = new Set();
        const titles = [];
        let inspected = 0;
        for (const link of links || []) {
            if (inspected >= COLLECTION_LINK_SCAN_LIMIT || titles.length >= LIST_SEARCH_TITLE_LIMIT) break;
            inspected += 1;
            const id = getLinkedTitleId(link.href);
            if (!id || seen.has(id)) continue;
            const textEl = link.querySelector('[class*="title"]') || link;
            const name = (textEl.textContent || '').trim().replace(/\s+/g, ' ')
                .replace(/^\d+\.\s+/, '').slice(0, 120);
            if (!name) continue;
            seen.add(id);
            titles.push({ id, name });
        }
        return titles;
    }

    function getListTitles() {
        return getListTitlesFromLinks(document.querySelectorAll('a[href*="/title/tt"]'));
    }

    function buildListSearchEntries(site, titles) {
        return titles.slice(0, LIST_SEARCH_TITLE_LIMIT).map(title => ({
            ...title,
            url: site.storeQuery
                ? getCinebyHost()
                : applyLinkTemplate(site.url, getLinkContext(title.name, title.id, '')),
        }));
    }

    reg({
        key: 'listMultiSearch', name: 'List multi-search', group: 'Utility',
        init() {
            if (!isListPage()) return;
            if (document.getElementById('enh-multi-search')) return;
            const sites = getSiteList('watchSites', DEFAULT_WATCH_SITES);
            if (!sites.length) return;

            addThemedCSS(t => `
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
                #enh-multi-search-queue {
                    margin: 0 0 18px; padding: 14px; max-width: 980px;
                    border: 1px solid ${t.bd1}; border-radius: 10px;
                    background: ${t.sf0}; color: ${t.tx1}; box-shadow: ${t.sh1};
                    outline: none;
                }
                .enh-multi-search-queue__header {
                    display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
                    margin-bottom: 12px;
                }
                .enh-multi-search-queue__title {
                    margin: 0 0 4px; color: ${t.tx0};
                    font: 800 14px/1.25 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }
                .enh-multi-search-queue__description,
                .enh-multi-search-queue__status {
                    margin: 0; color: ${t.tx2};
                    font: 500 11px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }
                .enh-multi-search-queue__status { margin-top: 5px; color: ${t.accent}; font-weight: 700; }
                .enh-multi-search-queue__actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
                .enh-multi-search-queue__action {
                    min-height: 32px; display: inline-flex; align-items: center; justify-content: center;
                    padding: 0 10px; border: 1px solid ${t.bd1}; border-radius: 7px;
                    background: ${t.sf1}; color: ${t.tx1} !important; text-decoration: none !important;
                    cursor: pointer; font: 750 11px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }
                .enh-multi-search-queue__action:hover { background: ${t.sf2}; border-color: ${t.accentBorder}; color: ${t.accent} !important; }
                .enh-multi-search-queue__action[aria-disabled="true"] { opacity: .48; cursor: default; pointer-events: none; }
                .enh-multi-search-queue__list {
                    list-style: none; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 6px; max-height: 340px; overflow: auto; margin: 0; padding: 0 2px 0 0;
                }
                .enh-multi-search-queue__item {
                    min-width: 0; border: 1px solid ${t.bd0}; border-radius: 8px; background: ${t.sf1};
                }
                .enh-multi-search-queue__item--opened { background: ${t.sf0}; border-color: ${t.bd1}; }
                .enh-multi-search-queue__item--opened .enh-multi-search-queue__link { color: ${t.tx3} !important; }
                .enh-multi-search-queue__link {
                    min-height: 40px; display: flex; align-items: center; justify-content: space-between; gap: 10px;
                    padding: 7px 9px; color: ${t.tx1} !important; text-decoration: none !important;
                    font: 650 11px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }
                .enh-multi-search-queue__link:hover { color: ${t.accent} !important; }
                .enh-multi-search-queue__link-meta { color: ${t.tx3}; font-size: 9px; font-weight: 750; white-space: nowrap; }
                .enh-multi-search-queue__action:focus-visible,
                .enh-multi-search-queue__link:focus-visible {
                    outline: 2px solid ${t.accent}; outline-offset: 2px;
                }
            `, 'enh-listMultiSearch');

            const bar = makeEl('div', { id:'enh-multi-search' },
                makeEl('span', { className:'enh-multi-search-label' }, 'SEARCH ALL ON')
            );
            sites.forEach(site => {
                const btn = makeEl('button', {
                    type:'button',
                    className:'enh-multi-search-btn',
                    style:{ '--btn-color': site.color },
                    'aria-label': `Prepare visible titles for ${site.name}`,
                    onClick: () => this._showQueue(site, btn),
                }, site.name);
                bar.appendChild(btn);
            });
            const target = document.querySelector('main') || document.body;
            target.insertBefore(bar, target.firstElementChild?.nextSibling || null);
        },
        _prepareEntry(site, entry) {
            if (!site.storeQuery || storeCinebyQuery(entry.name)) return true;
            showToast(getCinebyHandoffFailureMessage(), 4500);
            return false;
        },
        _showQueue(site, trigger) {
            const titles = getListTitles();
            if (!titles.length) { showToast('No titles found on this page'); return; }
            const entries = buildListSearchEntries(site, titles);
            document.getElementById('enh-multi-search-queue')?.remove();

            const opened = new Set();
            let nextIndex = 0;
            const queue = makeEl('section', {
                id:'enh-multi-search-queue', role:'region', tabindex:'-1',
                'aria-label':`${site.name} search queue`,
            });
            const status = makeEl('p', {
                className:'enh-multi-search-queue__status', role:'status', 'aria-live':'polite',
            }, `0 of ${entries.length} opened`);
            const list = makeEl('ol', { className:'enh-multi-search-queue__list' });
            const openNext = makeEl('a', {
                className:'enh-multi-search-queue__action', target:'_blank', rel:'noopener noreferrer',
            });

            const updateNext = () => {
                while (nextIndex < entries.length && opened.has(nextIndex)) nextIndex++;
                const entry = entries[nextIndex];
                if (!entry) {
                    openNext.removeAttribute('href');
                    openNext.removeAttribute('target');
                    openNext.setAttribute('aria-disabled', 'true');
                    openNext.textContent = 'All opened';
                    return;
                }
                openNext.href = entry.url;
                openNext.target = '_blank';
                openNext.removeAttribute('aria-disabled');
                openNext.textContent = `Open next (${nextIndex + 1} of ${entries.length})`;
                openNext.setAttribute('aria-label', `Open ${entry.name} on ${site.name} in a new tab`);
            };
            const markOpened = index => {
                opened.add(index);
                list.children[index]?.classList.add('enh-multi-search-queue__item--opened');
                status.textContent = `${opened.size} of ${entries.length} opened`;
                updateNext();
            };

            entries.forEach((entry, index) => {
                const link = makeEl('a', {
                    href:entry.url, target:'_blank', rel:'noopener noreferrer',
                    className:'enh-multi-search-queue__link',
                    'aria-label':`Open ${entry.name} on ${site.name} in a new tab`,
                },
                    makeEl('span', {}, entry.name),
                    makeEl('span', { className:'enh-multi-search-queue__link-meta' }, `${entry.id} · New tab`)
                );
                link.addEventListener('click', event => {
                    if (!this._prepareEntry(site, entry)) {
                        event.preventDefault();
                        return;
                    }
                    setTimeout(() => markOpened(index), 0);
                });
                list.appendChild(makeEl('li', { className:'enh-multi-search-queue__item' }, link));
            });

            openNext.addEventListener('click', event => {
                const entry = entries[nextIndex];
                if (!entry) { event.preventDefault(); return; }
                const index = nextIndex;
                if (!this._prepareEntry(site, entry)) {
                    event.preventDefault();
                    return;
                }
                setTimeout(() => markOpened(index), 0);
            });

            const copy = makeEl('button', {
                type:'button', className:'enh-multi-search-queue__action',
                onClick: () => {
                    const text = site.storeQuery
                        ? entries.map(entry => `${entry.name} (${entry.id})`).join('\n')
                        : entries.map(entry => entry.url).join('\n');
                    if (copyTextToClipboard(text)) {
                        showToast(site.storeQuery ? `Copied ${entries.length} titles` : `Copied ${entries.length} search links`);
                    } else showToast('Copy failed. Try the individual links instead.', 4500);
                },
            }, site.storeQuery ? 'Copy title list' : 'Copy all links');
            const close = makeEl('button', {
                type:'button', className:'enh-multi-search-queue__action',
                onClick: () => { queue.remove(); trigger.focus(); },
            }, 'Close');

            const limited = titles.length > entries.length ? ` First ${entries.length} of ${titles.length} visible titles are shown.` : '';
            queue.append(
                makeEl('div', { className:'enh-multi-search-queue__header' },
                    makeEl('div', {},
                        makeEl('h3', { className:'enh-multi-search-queue__title' }, `${site.name} search queue`),
                        makeEl('p', { className:'enh-multi-search-queue__description' },
                            `Browsers allow one new tab per click.${limited}`
                        ),
                        status
                    ),
                    makeEl('div', { className:'enh-multi-search-queue__actions' }, openNext, copy, close)
                ),
                list
            );
            const bar = trigger.closest('#enh-multi-search');
            if (!insertAfter(bar, queue)) return;
            updateNext();
            queue.scrollIntoView({ block:'nearest' });
            queue.focus({ preventScroll:true });
        },
        destroy() {
            removeCSS('enh-listMultiSearch');
            document.getElementById('enh-multi-search')?.remove();
            document.getElementById('enh-multi-search-queue')?.remove();
        }
    });

    /* Verified against live person pages on 2026-08-14: IMDb already prints the age
       at death next to a death date (`birth-and-death-death-age`), but a living
       person's page shows only the birth date. So the only gap worth filling is the
       current age, and it can be computed from data the page already carries — the
       embedded application state exposes an ISO `birthDate.date`, with the visible
       `birth-and-death-birthdate` text as a fallback. No extra requests. */
    function computeCurrentAge(birthISO, now = new Date()) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthISO || ''));
        if (!match) return null;
        const [, y, m, d] = match.map(Number);
        const year = Number(y);
        if (!year || year < 1800) return null;
        const birth = new Date(Date.UTC(year, m - 1, d));
        if (Number.isNaN(birth.getTime()) || birth.getUTCMonth() !== m - 1 || birth.getUTCDate() !== d) return null;
        let age = now.getUTCFullYear() - year;
        const beforeBirthday = now.getUTCMonth() < m - 1
            || (now.getUTCMonth() === m - 1 && now.getUTCDate() < d);
        if (beforeBirthday) age -= 1;
        return age >= 0 && age <= 130 ? age : null;
    }

    function readPersonBirthDate(doc = document) {
        const script = doc.getElementById('__NEXT_DATA__');
        const text = typeof script?.textContent === 'string' ? script.textContent : '';
        if (text && text.length <= EXTERNAL_RESPONSE_TEXT_LIMIT) {
            const index = text.indexOf('"birthDate"');
            if (index >= 0) {
                const iso = /"date":"(\d{4}-\d{2}-\d{2})"/.exec(text.slice(index, index + 400));
                if (iso) return { iso:iso[1], deceased:/"deathStatus":"(?!ALIVE)/.test(text.slice(0, 200000)) };
            }
        }
        return null;
    }

    reg({
        key: 'castAges', name: 'Person age', group: 'Features',
        init() {
            if (!isIMDbHost() || getPageSurface() !== 'name') return;
            const isCurrent = createFeatureGuard(this);
            const birth = readPersonBirthDate();
            if (!birth || birth.deceased) return;
            const age = computeCurrentAge(birth.iso);
            if (age === null) return;
            const host = document.querySelector('[data-testid="birth-and-death-birthdate"]');
            if (!host || !isCurrent() || host.querySelector('.enh-person-age')) return;
            addThemedCSS(t => `
                .enh-person-age { color: ${t.tx2}; font-weight: 700; margin-left: 6px; }
            `, 'enh-castAges');
            host.appendChild(makeEl('span', { className:'enh-person-age' }, `(age ${age})`));
        },
        destroy() {
            removeCSS('enh-castAges');
            document.querySelectorAll('.enh-person-age').forEach(node => node.remove());
        }
    });

    reg({
        key: 'quickCopyID', name: 'Quick copy IMDb ID', group: 'Utility',
        init() {
            const isCurrent = createFeatureGuard(this);
            waitForTitleSurface().then(() => {
                if (!isCurrent()) return;
                if (document.getElementById('enh-copy-id')) return;
                const imdbId = getIMDbID();
                if (!imdbId) return;
                const btn = makeEl('button', {
                    id:'enh-copy-id', className:'enh-action-btn', type:'button',
                    title:`Copy ${imdbId}`, 'aria-label': `Copy IMDb ID ${imdbId}`,
                    innerHTML: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>${imdbId}</span>`,
                    onClick: () => showToast(copyTextToClipboard(imdbId)
                        ? `Copied ${imdbId}`
                        : 'Copy failed. Check the userscript clipboard permission.', 4500)
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
                if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
                if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName) || e.target.isContentEditable) return;
                if (document.getElementById('enh-trailer-overlay')) return;
                if (settingsOpen) {
                    if (e.key === 'Escape') { e.preventDefault(); toggleSettings(); }
                    return;
                }
                if (e.key === '?') { e.preventDefault(); toggleSettings(); }
                else if (e.key === 'c') {
                    const id = getIMDbID();
                    if (id) showToast(copyTextToClipboard(id)
                        ? `Copied ${id}`
                        : 'Copy failed. Check the userscript clipboard permission.', 4500);
                }
                else if (e.key === 'r') { document.querySelector('[data-testid="hero-rating-bar__aggregate-rating"]')?.scrollIntoView({ behavior:getEnhancementScrollBehavior(), block:'center' }); }
                else if (e.key === 't') { window.scrollTo({ top:0, behavior:getEnhancementScrollBehavior() }); }
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

/* ════ Editorial Title Surface ════ */
section[data-testid="hero-parent"].enh-editorial-native-hidden { display: none !important; }
#enh-editorial-surface {
    position: relative; z-index: 7; isolation: isolate; overflow: hidden;
    width: 100%; max-width: 1600px; margin: 0 auto; padding: 0 40px 28px;
    color: ${t.tx1}; background-color: ${t.bg};
    background-image: var(--enh-editorial-backdrop, none);
    background-position: center; background-size: cover; background-blend-mode: normal;
    border-bottom: 1px solid ${t.bd0};
}
#enh-editorial-surface::before {
    content: ''; position: absolute; inset: 0; z-index: 0;
    background: ${t.heroScrim}; pointer-events: none;
}
#enh-editorial-surface > * { position: relative; z-index: 1; }
.enh-editorial-subnav {
    display: flex; align-items: center; justify-content: space-between; gap: 20px;
    min-height: 58px; border-bottom: 1px solid ${t.bd0};
}
.enh-editorial-subnav__left,
.enh-editorial-subnav__right { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; min-width: 0; }
.enh-editorial-subnav__right { justify-content: flex-end; }
.enh-editorial-subnav__link {
    color: ${t.blue} !important; font: 700 13px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    text-decoration: none !important; white-space: nowrap;
}
.enh-editorial-subnav__link:hover { color: ${t.blueHi} !important; }
.enh-editorial-hero {
    display: grid; grid-template-columns: 240px minmax(300px, 1fr) minmax(330px, .82fr);
    align-items: center; gap: 30px; min-height: 470px; padding: 34px 0 38px;
}
.enh-editorial-poster {
    width: 240px; aspect-ratio: 2 / 3; overflow: hidden;
    border: 1px solid ${t.bd1}; border-radius: 12px; background: ${t.sf1}; box-shadow: ${t.sh3};
}
.enh-editorial-poster img { display: block; width: 100%; height: 100%; object-fit: cover; }
.enh-editorial-identity { min-width: 0; display: flex; flex-direction: column; align-items: flex-start; }
.enh-editorial-title {
    max-width: 100%; margin: 0; color: ${t.tx0};
    font: 800 clamp(42px, 5vw, 72px)/.98 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    letter-spacing: -.045em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.enh-editorial-meta {
    margin-top: 15px; color: ${t.tx2}; font: 600 14px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
#enh-editorial-action-slot { width: min(100%, 340px); margin-top: 24px; }
#enh-editorial-standalone-slot { width: min(100%, 340px); }
#enh-editorial-standalone-slot > #enh-title-stack {
    display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 100%; margin: 0;
}
#enh-editorial-standalone-slot > #enh-title-stack > * { width: 100%; }
#enh-editorial-score-rail {
    display: flex; flex-direction: column; align-self: stretch; justify-content: center;
    min-width: 0; padding-left: 24px; border-left: 1px solid ${t.bd0};
}
#enh-editorial-score-rail > [data-testid="hero-rating-bar__aggregate-rating"],
#enh-editorial-score-rail > [data-testid="hero-rating-bar__popularity"],
#enh-editorial-score-rail > .enh-score-widget {
    display: flex !important; align-items: flex-start !important; justify-content: center !important;
    min-width: 0 !important; max-width: none !important; padding: 15px 0 !important;
    background: transparent !important; border: 0 !important; border-bottom: 1px solid ${t.bd0} !important;
    border-radius: 0 !important; box-shadow: none !important;
}
#enh-editorial-score-rail > :last-child { border-bottom: 0 !important; }
#enh-editorial-score-rail .enh-score-widget__label { margin-bottom: 4px; }
#enh-editorial-score-rail .enh-score-widget__score { justify-content: flex-start; }
#enh-editorial-score-rail .enh-score-widget__value--availability { max-width: 260px; }
.enh-editorial-details {
    display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
    border-top: 1px solid ${t.bd0};
}
.enh-editorial-about { min-width: 0; padding: 25px 38px 10px 0; }
.enh-editorial-watch { min-width: 0; padding: 25px 0 10px 38px; border-left: 1px solid ${t.bd0}; }
.enh-editorial-about h2,
.enh-editorial-watch h2 {
    margin: 0; color: ${t.tx0}; font: 750 23px/1.15 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    letter-spacing: -.02em;
}
.enh-editorial-watch__header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px; margin-bottom: 16px; }
.enh-editorial-watch__header p { margin: 0; color: ${t.tx3}; font: 500 12px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
.enh-editorial-synopsis { max-width: 720px; margin: 14px 0 18px; color: ${t.tx1}; font: 400 15px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
.enh-editorial-detail-row {
    display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px;
    padding: 11px 0; border-top: 1px solid ${t.bd0}; color: ${t.tx2};
    font: 600 13px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.enh-editorial-detail-row strong { min-width: 48px; color: ${t.tx0}; }
.enh-editorial-detail-row a,
.enh-editorial-about-link { color: ${t.blue} !important; text-decoration: none !important; }
.enh-editorial-detail-row a:hover,
.enh-editorial-about-link:hover { color: ${t.blueHi} !important; }
.enh-editorial-detail-separator { color: ${t.tx3}; }
.enh-editorial-about-link { display: inline-flex; margin-top: 10px; font: 700 12px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
#enh-editorial-research-slot #enh-external-links { padding: 0; border: 0; }
#enh-editorial-research-slot #enh-external-links .enh-external-links__header { display: none; }
#enh-editorial-research-slot .enh-external-groups { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 20px; }
#enh-editorial-research-slot .enh-external-group { padding: 10px 0; }

@media (max-width: 1250px) {
    #enh-editorial-surface { padding-left: 24px; padding-right: 24px; }
    .enh-editorial-hero { grid-template-columns: 190px minmax(260px, 1fr); gap: 24px; }
    .enh-editorial-poster { width: 190px; }
    #enh-editorial-score-rail { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 18px; padding: 14px 0 0; border-top: 1px solid ${t.bd0}; border-left: 0; }
    #enh-editorial-score-rail > [data-testid="hero-rating-bar__aggregate-rating"],
    #enh-editorial-score-rail > [data-testid="hero-rating-bar__popularity"],
    #enh-editorial-score-rail > .enh-score-widget { border-bottom: 0 !important; border-left: 1px solid ${t.bd0} !important; padding: 8px 14px !important; }
    #enh-editorial-score-rail > :first-child { border-left: 0 !important; }
}
@media (max-width: 760px) {
    #enh-editorial-surface { padding-left: 18px; padding-right: 18px; }
    .enh-editorial-subnav { align-items: flex-start; flex-direction: column; justify-content: center; gap: 8px; padding: 12px 0; }
    .enh-editorial-subnav__right { justify-content: flex-start; gap: 10px; }
    .enh-editorial-hero { grid-template-columns: 1fr; gap: 20px; padding-top: 24px; }
    .enh-editorial-poster { width: 150px; }
    .enh-editorial-title { font-size: clamp(36px, 12vw, 56px); white-space: normal; }
    #enh-editorial-action-slot, #enh-editorial-standalone-slot { width: 100%; }
    #enh-editorial-score-rail { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .enh-editorial-details { grid-template-columns: 1fr; }
    .enh-editorial-about { padding: 22px 0 10px; }
    .enh-editorial-watch { padding: 22px 0 10px; border-top: 1px solid ${t.bd0}; border-left: 0; }
    #enh-editorial-research-slot .enh-external-groups { grid-template-columns: 1fr; }
}
@media (max-width: 480px) {
    #enh-editorial-score-rail { grid-template-columns: 1fr; }
    #enh-editorial-score-rail > [data-testid="hero-rating-bar__aggregate-rating"],
    #enh-editorial-score-rail > [data-testid="hero-rating-bar__popularity"],
    #enh-editorial-score-rail > .enh-score-widget { border-left: 0 !important; border-bottom: 1px solid ${t.bd0} !important; padding: 12px 0 !important; }
}

/* ════ Stream Panel ════ */
#enh-title-stack {
    display: grid;
    grid-template-columns: minmax(230px, 300px) minmax(0, 1fr);
    align-items: start;
    column-gap: 28px;
    row-gap: 16px;
    margin: 18px 0 24px;
    max-width: min(100%, 1120px);
}
#enh-title-stack > * { width: 100%; min-width: 0; }
#enh-title-stack #enh-copy-id {
    grid-column: 1 / -1;
    width: fit-content;
    margin: 0;
}
#enh-title-stack #enh-search-buttons { grid-column: 1; }
#enh-title-stack #enh-external-links { grid-column: 2; }
#enh-title-stack #enh-tv-bar,
#enh-title-stack #enh-servarr-actions,
#enh-title-stack #enh-media-server-status {
    grid-column: 1 / -1;
}
#enh-title-stack #enh-search-buttons,
#enh-title-stack #enh-external-links,
#enh-title-stack #enh-tv-bar,
#enh-title-stack #enh-servarr-actions,
#enh-title-stack #enh-media-server-status {
    margin: 0;
}

#enh-search-buttons {
    padding: 0;
    background: transparent;
    border: 0;
    border-radius: 0;
    box-shadow: none;
}
.enh-stream-label {
    display: flex; align-items: center; gap: 6px;
    font: 700 10px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    text-transform: uppercase; letter-spacing: 0.14em;
    color: ${t.tx3};
    margin: 0 0 10px 2px;
}
.enh-stream-label__dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: ${t.accent}; box-shadow: 0 0 0 4px ${t.accentMuted};
}
#enh-editorial-actions { display: flex; flex-direction: column; gap: 6px; }
.enh-editorial-action {
    display: flex; align-items: center; justify-content: flex-start;
    width: 100%; min-height: 40px; padding: 8px 14px;
    background: ${t.sf1}; border: 1px solid ${t.bd1}; border-radius: 8px;
    color: ${t.tx1}; cursor: pointer; text-align: left;
    font: 700 12px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    transition: background .15s ease, border-color .15s ease, color .15s ease, transform .15s ease;
}
.enh-editorial-action:hover,
.enh-editorial-action:focus-visible {
    background: ${t.sf2}; border-color: ${t.accentBorder}; color: ${t.accent};
    transform: translateY(-1px);
}
#enh-editorial-actions #enh-trailer-btn,
#enh-editorial-actions #enh-link-menu-wrap {
    width: 100%; margin: 0;
}
#enh-editorial-actions #enh-trailer-btn,
#enh-editorial-actions #enh-link-menu-trigger {
    width: 100%; min-height: 40px; padding: 8px 14px;
    text-align: left; border-radius: 8px;
}
#enh-editorial-actions #enh-link-menu-wrap { display: flex; }
#enh-editorial-actions #enh-link-menu-wrap .enh-link-dropdown {
    top: auto; bottom: calc(100% + 8px); left: 0; right: auto;
    max-height: min(60vh, 520px); overflow: auto;
}
.enh-link-groups { display: flex; flex-direction: column; gap: 8px; }
.enh-link-group { min-width: 0; }
.enh-link-group__label {
    margin: 0 0 5px 2px;
    color: ${t.tx3};
    font: 700 9px/1.1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    letter-spacing: .1em;
    text-transform: uppercase;
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
    background: ${t.sf1};
    border: 1px solid ${t.bd1};
    border-radius: 8px;
    color: ${t.tx1};
    font: 600 12px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    cursor: pointer; transition: background .18s cubic-bezier(.4,0,.2,1), border-color .18s ease, color .18s ease, transform .18s cubic-bezier(.4,0,.2,1), box-shadow .18s ease; outline: none;
    text-decoration: none !important;
    text-align: center; white-space: nowrap; min-width: 0;
}
.enh-search-btn:hover {
    background: ${t.sf2};
    border-color: ${t.accentBorder};
    color: ${t.tx0};
    transform: translateY(-1px);
    box-shadow: ${t.sh1};
}
.enh-search-btn:active { transform: translateY(0); }
.enh-search-btn--primary {
    display: grid; grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center; justify-content: initial; gap: 10px;
    min-height: 58px; padding: 10px 14px;
    background: ${t.accent}; border-color: ${t.accent};
    color: ${readableTextColor(t.accent)};
    box-shadow: 0 10px 26px ${t.accentMuted};
    text-align: left;
}
.enh-search-btn--primary:hover {
    background: ${t.accent}; border-color: ${t.accent};
    color: ${readableTextColor(t.accent)};
    filter: brightness(1.08); box-shadow: 0 12px 30px ${t.accentMuted};
}
.enh-search-btn__action { font-size: 15px; font-weight: 800; }
.enh-search-btn__site {
    overflow: hidden; text-overflow: ellipsis;
    font-size: 11px; font-weight: 600; opacity: .78;
}
.enh-search-btn__arrow { font-size: 18px; line-height: 1; opacity: .86; }
.enh-watch-options {
    overflow: hidden; border: 1px solid ${t.bd1};
    border-radius: 8px; background: ${t.sf0};
}
.enh-watch-options__summary {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    min-height: 38px; padding: 8px 11px; cursor: pointer;
    color: ${t.tx1}; font: 700 11px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    list-style: none;
}
.enh-watch-options__summary::-webkit-details-marker { display: none; }
.enh-watch-options__summary::after { content: '+'; color: ${t.tx3}; font-size: 16px; line-height: 1; }
.enh-watch-options[open] .enh-watch-options__summary::after { content: '−'; color: ${t.accent}; }
.enh-watch-options__summary:hover { color: ${t.accent}; background: ${t.sf1}; }
.enh-watch-options__count { color: ${t.tx3}; font-weight: 600; margin-left: auto; }
.enh-watch-options__groups {
    display: flex; flex-direction: column; gap: 10px;
    padding: 0 10px 10px; border-top: 1px solid ${t.bd0};
}
.enh-search-row--compact { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px; }
.enh-search-btn--compact {
    min-height: 32px; padding: 6px 8px; justify-content: flex-start;
    background: color-mix(in srgb, var(--btn-color) 8%, ${t.sf1});
    border-color: color-mix(in srgb, var(--btn-color) 18%, ${t.bd1});
    font-size: 11px; text-align: left;
}
.enh-search-btn--compact:hover {
    background: color-mix(in srgb, var(--btn-color) 16%, ${t.sf2});
    border-color: color-mix(in srgb, var(--btn-color) 34%, ${t.accentBorder});
}
/* ════ External Links ════ */
#enh-external-links {
    min-width: 0; padding: 0 0 0 26px;
    border-left: 1px solid ${t.bd0};
}
.enh-external-links__header {
    display: flex; flex-wrap: wrap; align-items: baseline; gap: 9px;
    padding-bottom: 10px; border-bottom: 1px solid ${t.bd0};
}
.enh-external-links__title {
    color: ${t.tx0}; font: 700 18px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.enh-external-links__hint { color: ${t.tx3}; font: 500 11px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
.enh-external-groups { display: flex; flex-direction: column; }
.enh-external-group { display: flex; flex-direction: column; gap: 7px; min-width: 0; padding: 12px 0; border-bottom: 1px solid ${t.bd0}; }
.enh-external-group:last-child { border-bottom: 0; }
.enh-external-group__row { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; }
.enh-ext-link {
    padding: 7px 11px; border-radius: 7px;
    font: 600 11px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: ${t.tx1} !important;
    background: ${t.sf1}; border: 1px solid ${t.bd1};
    text-decoration: none !important;
    transition: background .15s ease, border-color .15s ease, color .15s ease, transform .15s cubic-bezier(.4,0,.2,1);
}
.enh-ext-link:hover {
    background: ${t.sf2};
    border-color: ${t.accentBorder};
    color: ${t.tx0} !important;
    transform: translateY(-1px);
}
#enh-external-links > #enh-trailer-btn,
#enh-external-links > #enh-link-menu-wrap {
    margin-top: 10px;
}

@media (max-width: 900px) {
    #enh-title-stack {
        grid-template-columns: minmax(0, 1fr);
        max-width: 100%;
        gap: 14px;
    }
    #enh-title-stack #enh-search-buttons,
    #enh-title-stack #enh-external-links,
    #enh-title-stack #enh-tv-bar,
    #enh-title-stack #enh-servarr-actions,
    #enh-title-stack #enh-media-server-status {
        grid-column: 1;
    }
    #enh-external-links {
        padding: 16px 0 0;
        border-left: 0;
        border-top: 1px solid ${t.bd0};
    }
}
@media (max-width: 560px) {
    .enh-search-row--compact { grid-template-columns: minmax(0, 1fr); }
    .enh-external-links__header { display: block; }
    .enh-external-links__hint { margin-top: 5px; }
}

/* ════ More Links trigger (lives in external-links row) ════ */
#enh-link-menu-wrap { position: relative; display: inline-flex; margin-left: auto; }
#enh-link-menu-wrap.enh-link-menu-wrap--standalone { width: auto; margin-left: 0; }
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
    padding: 12px 20px; min-width: 104px;
    border-left: 1px solid ${t.bd0};
}
.enh-score-widget--availability {
    min-width: 150px; max-width: 240px;
}
.enh-score-widget__label {
    font-size: 10px; font-weight: 600; letter-spacing: .05em;
    color: ${t.tx2}; margin-bottom: 4px; text-transform: uppercase;
}
.enh-score-widget__score {
    display: flex; align-items: center; gap: 4px; text-decoration: none !important;
    color: var(--score-color, ${t.tx2}) !important; font-size: 18px; font-weight: 800;
    transition: transform .15s cubic-bezier(.4,0,.2,1), opacity .15s ease;
}
.enh-score-widget__score:hover { transform: translateY(-1px); }
.enh-score-widget__score--availability {
    justify-content: center; max-width: 100%;
}
.enh-score-widget__icon { font-size: 18px; }
.enh-score-widget__value { color: var(--score-color, ${t.tx2}); }
.enh-score-widget__value--availability {
    max-width: 150px; white-space: normal; text-align: left;
    font-size: 12px; line-height: 1.25;
}
.enh-score-widget__badge {
    display: inline-block; padding: 2px 9px; border-radius: 6px;
    font-size: 16px; font-weight: 800; min-width: 34px; text-align: center;
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
.enh-score-widget--muted { --score-color: ${t.tx2}; }
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
    background: rgba(3,5,8,0.86);
    z-index: 2147483640; opacity: 0; visibility: hidden;
    transition: opacity .22s ease, visibility 0s linear .22s; pointer-events: none;
}
#enh-settings-overlay.enh-visible {
    opacity: 1; visibility: visible; pointer-events: auto;
    transition-delay: 0s;
}

/* ════ Settings Panel ════ */
#enh-settings-panel {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%) scale(0.985);
    background: ${t.sf0}; color: ${t.tx1};
    border: 1px solid ${t.bd1};
    border-radius: 16px; z-index: 2147483641;
    width: min(1120px, calc(100vw - 48px));
    height: min(850px, calc(100vh - 40px));
    box-shadow: ${t.sh3};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    opacity: 0;
    transition: transform .22s cubic-bezier(.4,0,.2,1), opacity .2s ease;
    overflow: hidden; display: flex; flex-direction: column;
}
#enh-settings-overlay.enh-visible #enh-settings-panel {
    transform: translate(-50%, -50%) scale(1); opacity: 1;
}
.enh-settings-header {
    display: flex; justify-content: space-between; align-items: center;
    min-height: 72px;
    padding: 18px 22px;
    border-bottom: 1px solid ${t.bd0}; flex-shrink: 0;
    background: color-mix(in srgb, ${t.sf1} 34%, ${t.sf0});
}
.enh-settings-header h2 {
    font-size: 17px; font-weight: 780; margin: 0;
    color: ${t.tx0}; letter-spacing: -0.015em;
}
.enh-settings-subtitle {
    margin: 3px 0 0;
    color: ${t.tx2};
    font-size: 10px;
    line-height: 1.35;
}
.enh-settings-header-actions {
    display: flex; align-items: center; gap: 12px;
}
.enh-settings-save-state {
    display: inline-flex; align-items: center; gap: 7px;
    color: ${t.tx2};
    font-size: 11px; font-weight: 600;
}
.enh-settings-save-state::before {
    content: ''; width: 7px; height: 7px; border-radius: 50%;
    background: ${t.green}; box-shadow: 0 0 0 3px color-mix(in srgb, ${t.green} 14%, transparent);
}
.enh-settings-save-state--error { color: ${t.red}; }
.enh-settings-save-state--error::before {
    background: ${t.red}; box-shadow: 0 0 0 3px color-mix(in srgb, ${t.red} 14%, transparent);
}
.enh-settings-close {
    background: ${t.sf1}; border: 1px solid ${t.bd1};
    width: 34px; height: 34px; padding: 0; border-radius: 9px;
    color: ${t.tx2}; cursor: pointer;
    font: 500 22px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    display: flex; align-items: center; justify-content: center;
    transition: background .15s ease, border-color .15s ease, color .15s ease;
}
.enh-settings-close:hover { background: ${t.sf2}; color: ${t.tx0}; }

.enh-settings-shell { display: flex; min-height: 0; flex: 1; }
.enh-settings-nav {
    width: 216px; flex: 0 0 216px;
    padding: 18px 12px;
    background: color-mix(in srgb, ${t.sf1} 54%, ${t.sf0});
    border-right: 1px solid ${t.bd0};
}
.enh-settings-nav-btn {
    position: relative; width: 100%; min-height: 42px;
    display: flex; align-items: center;
    padding: 0 14px 0 18px; margin: 3px 0;
    border: 0; border-radius: 8px;
    background: transparent; color: ${t.tx2}; cursor: pointer;
    font: 650 13px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    text-align: left;
    transition: background .15s ease, color .15s ease, transform .15s ease;
}
.enh-settings-nav-btn::after {
    content: ''; width: 5px; height: 5px; margin-right: 11px; order: -1;
    border-radius: 50%; background: ${t.bd2};
    transition: background .15s ease, box-shadow .15s ease;
}
.enh-settings-nav-btn:hover { background: ${t.sf1}; color: ${t.tx0}; transform: translateX(1px); }
.enh-settings-nav-btn[aria-selected="true"] {
    background: ${t.sf2}; color: ${t.tx0};
}
.enh-settings-nav-btn[aria-selected="true"]::before {
    content: ''; position: absolute; left: 0; top: 8px; bottom: 8px;
    width: 3px; border-radius: 2px; background: ${t.accent};
}
.enh-settings-nav-btn[aria-selected="true"]::after {
    background: ${t.accent}; box-shadow: 0 0 0 3px ${t.accentMuted};
}
.enh-settings-main { min-width: 0; flex: 1; overflow: hidden; }
.enh-settings-body { height: 100%; padding: 28px 30px 34px; overflow-y: auto; }
.enh-settings-page[hidden] { display: none !important; }
.enh-settings-page-header { margin: 0 0 22px; }
.enh-settings-page-title {
    margin: 0; color: ${t.tx0};
    font: 780 26px/1.15 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    letter-spacing: -.025em;
}
.enh-settings-page-description {
    margin: 6px 0 0; color: ${t.tx2};
    font: 500 13px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.enh-settings-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.enh-settings-grid--three { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.enh-settings-grid--experience { grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr); align-items: start; }
.enh-settings-stack { display: flex; flex-direction: column; gap: 14px; }
.enh-settings-card {
    min-width: 0; padding: 18px;
    border: 1px solid ${t.bd1}; border-radius: 12px;
    background: color-mix(in srgb, ${t.sf1} 78%, ${t.sf0});
}
.enh-settings-card--flush { padding: 0; overflow: hidden; }
.enh-settings-card--span { grid-column: 1 / -1; }
.enh-settings-card-header {
    display: flex; justify-content: space-between; align-items: flex-start;
    gap: 12px; margin-bottom: 12px;
}
.enh-settings-card-title {
    color: ${t.tx0};
    font: 740 16px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.enh-settings-card-description {
    margin-top: 3px; color: ${t.tx3};
    font: 500 11px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.enh-settings-card-actions { display: flex; align-items: center; gap: 8px; }
.enh-settings-route-badge {
    flex-shrink: 0; padding: 4px 7px; border-radius: 6px;
    background: ${t.sf2}; color: ${t.tx2};
    font: 700 9px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    text-transform: uppercase; letter-spacing: .05em;
}

.enh-settings-group-label {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .08em; color: ${t.tx3};
    padding: 16px 0 6px;
}
.enh-settings-row {
    display: flex; align-items: center; justify-content: space-between;
    min-height: 54px; padding: 9px 0; gap: 12px;
    border-bottom: 1px solid ${t.bd0};
}
.enh-settings-row:last-child { border-bottom: none; }
.enh-settings-label { font-size: 13px; font-weight: 650; color: ${t.tx1}; }
.enh-settings-row-copy { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.enh-settings-help { font-size: 10px; line-height: 1.35; color: ${t.tx3}; max-width: 420px; }
.enh-settings-card--compact .enh-settings-row { min-height: 42px; padding: 6px 0; }
.enh-settings-card--compact .enh-settings-help { display: none; }

/* Toggle switch */
.enh-toggle { position: relative; width: 40px; height: 22px; flex-shrink: 0; }
.enh-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
.enh-toggle-track {
    position: absolute; inset: 0;
    background: ${t.sf2}; border-radius: 999px;
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
.enh-theme-selector { display: grid; grid-template-columns: repeat(5, minmax(64px, 1fr)); gap: 12px; margin-top: 14px; }
.enh-theme-option { display: flex; flex-direction: column; gap: 6px; color: ${t.tx2}; font-size: 10px; text-align: center; }
.enh-theme-swatch {
    width: 100%; height: 54px; border-radius: 10px; cursor: pointer;
    border: 2px solid transparent;
    padding: 0;
    appearance: none;
    transition: border-color .15s ease, box-shadow .15s ease, transform .15s cubic-bezier(.4,0,.2,1); position: relative;
    box-shadow: inset 0 0 0 1px ${t.bd1};
}
.enh-theme-swatch.active { border-color: ${t.accent}; box-shadow: 0 0 12px ${t.accentMuted}; }
.enh-theme-swatch:hover { transform: translateY(-1px); }
.enh-theme-auto-row { margin-top: 14px; padding-top: 14px; border-top: 1px solid ${t.bd0}; }
.enh-settings-page--experience .enh-settings-card { padding: 18px; }
.enh-settings-page--experience .enh-settings-card--compact .enh-settings-row { min-height: 45px; padding: 6px 0; }
.enh-settings-page--experience .enh-settings-help { display: none; }
.enh-settings-page--experience .enh-settings-grid--experience { gap: 14px; }

.enh-score-preview { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); }
.enh-score-preview-item { padding: 14px 10px; text-align: center; border-right: 1px solid ${t.bd0}; }
.enh-score-preview-item:last-child { border-right: 0; }
.enh-score-preview-value { color: ${t.tx0}; font-size: 18px; font-weight: 800; }
.enh-score-preview-label { margin-top: 4px; color: ${t.tx3}; font-size: 10px; }
.enh-settings-callout {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 14px; border: 1px solid ${t.bd1}; border-radius: 10px;
    background: color-mix(in srgb, ${t.sf1} 72%, ${t.sf0}); color: ${t.tx2}; font-size: 11px; line-height: 1.45;
}
.enh-settings-callout strong { color: ${t.tx0}; }
.enh-settings-kbd {
    display: inline-flex; min-width: 26px; min-height: 26px; align-items: center; justify-content: center;
    padding: 0 7px; border: 1px solid ${t.bd2}; border-radius: 6px;
    background: ${t.sf0}; color: ${t.tx1}; font: 700 11px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
}
.enh-data-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 12px; }
.enh-data-summary-item { padding: 14px; border: 1px solid ${t.bd1}; border-radius: 10px; background: ${t.sf1}; }
.enh-data-summary-label { color: ${t.tx0}; font-size: 13px; font-weight: 700; }
.enh-data-summary-value { margin-top: 4px; color: ${t.tx2}; font-size: 11px; }

/* ════ Settings Footer ════ */
.enh-settings-footer {
    min-height: 42px; padding: 9px 22px; border-top: 1px solid ${t.bd0};
    display: flex; justify-content: space-between; align-items: center;
    flex-shrink: 0; gap: 8px;
}
.enh-settings-footer span { font-size: 11px; color: ${t.tx3}; }
.enh-settings-footer-actions { display: flex; gap: 6px; }
.enh-settings-footer-btn {
    min-height: 32px; padding: 6px 12px; border-radius: 8px;
    font: 600 11px -apple-system, sans-serif;
    background: ${t.sf1}; border: 1px solid ${t.bd1};
    color: ${t.tx2}; cursor: pointer;
    transition: background .15s ease, border-color .15s ease, color .15s ease, transform .15s cubic-bezier(.4,0,.2,1);
}
.enh-settings-footer-btn:hover { background: ${t.sf2}; color: ${t.tx0}; border-color: ${t.bd2}; }
.enh-settings-footer-btn:disabled { opacity: .45; cursor: not-allowed; }
.enh-settings-footer-btn--danger { color: ${t.red}; }
.enh-settings-footer-note { text-align: right; line-height: 1.35; }
.enh-data-actions { display: grid; gap: 8px; }
.enh-data-actions .enh-settings-footer-btn { width: 100%; text-align: left; }
.enh-import-panel {
    margin: 12px 0 0;
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
.enh-sites-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.enh-sites-grid--single { grid-template-columns: minmax(0, 1fr); }
.enh-site-editor {
    margin: 0;
    padding: 0;
    border: 1px solid ${t.bd1};
    border-radius: 12px;
    background: color-mix(in srgb, ${t.sf1} 78%, ${t.sf0});
    min-width: 0;
    overflow: hidden;
}
.enh-site-editor__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 16px 18px 12px;
    border-bottom: 1px solid ${t.bd0};
}
.enh-site-editor__title {
    color: ${t.tx0};
    font: 740 16px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.enh-site-editor__title-wrap { display: flex; align-items: center; gap: 8px; min-width: 0; }
.enh-site-editor__actions { display: flex; gap: 6px; flex-shrink: 0; }
.enh-site-editor__hint { margin: 0; padding: 10px 18px; color: ${t.tx3}; font: 500 11px/1.35 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; border-bottom: 1px solid ${t.bd0}; }
.enh-site-editor__columns,
.enh-site-row {
    display: grid;
    grid-template-columns: 42px minmax(120px, .7fr) minmax(150px, .85fr) minmax(240px, 1.4fr) 36px 58px 58px;
    gap: 8px;
    align-items: center;
}
.enh-site-editor__columns {
    padding: 10px 18px 8px;
    color: ${t.tx3};
    font: 700 9px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    letter-spacing: .06em;
    text-transform: uppercase;
    border-bottom: 1px solid ${t.bd0};
}
.enh-site-editor__rows { display: flex; flex-direction: column; gap: 0; max-height: 380px; overflow: auto; padding: 0 18px; }
.enh-site-row {
    min-height: 52px;
    border-bottom: 1px solid ${t.bd0};
}
.enh-site-row:last-child { border-bottom: 0; }
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
.enh-site-select { appearance: auto; padding: 0 5px; }
.enh-site-visibility { display: inline-flex; align-items: center; justify-content: center; min-width: 30px; height: 30px; cursor: pointer; }
.enh-site-enabled { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
.enh-site-visibility__dot { width: 16px; height: 16px; border-radius: 5px; border: 1px solid ${t.bd2}; background: ${t.sf0}; box-shadow: inset 0 0 0 3px ${t.sf0}; transition: background .15s ease, border-color .15s ease, box-shadow .15s ease; }
.enh-site-enabled:checked + .enh-site-visibility__dot { background: ${t.accent}; border-color: ${t.accent}; box-shadow: inset 0 0 0 3px ${t.sf0}; }
.enh-site-enabled:focus-visible + .enh-site-visibility__dot { outline: 2px solid ${t.accent}; outline-offset: 2px; }
.enh-site-order { display: inline-flex; gap: 3px; }
.enh-site-order-btn { width: 27px; height: 30px; padding: 0; border-radius: 7px; border: 1px solid ${t.bd1}; background: ${t.sf0}; color: ${t.tx2}; cursor: pointer; font: 700 13px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
.enh-site-order-btn:hover:not(:disabled) { background: ${t.sf2}; color: ${t.tx0}; border-color: ${t.bd2}; }
.enh-site-order-btn:disabled { opacity: .32; cursor: not-allowed; }
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
    min-width: 58px;
    height: 30px;
    border-radius: 7px;
    border: 1px solid ${t.bd1};
    background: ${t.sf0};
    color: ${t.tx2};
    cursor: pointer;
    font: 650 10px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.enh-site-remove:hover { background: ${t.sf2}; color: ${t.tx0}; }
.enh-site-input:focus,
.enh-site-color:focus {
    border-color: ${t.accentBorder};
    box-shadow: 0 0 0 2px ${t.accentMuted};
}
.enh-site-input--invalid,
.enh-site-input--invalid:focus {
    border-color: ${t.red};
    box-shadow: 0 0 0 2px ${t.redMuted};
}
@media (max-width: 900px) {
    .enh-site-editor__columns,
    .enh-site-row { grid-template-columns: 34px minmax(100px, .7fr) minmax(130px, .85fr) minmax(190px, 1.35fr) 34px 54px 54px; }
}
@media (max-width: 1100px) {
    #enh-settings-panel { width: min(1120px, calc(100vw - 28px)); }
    .enh-settings-body { padding-left: 20px; padding-right: 20px; }
    .enh-site-editor__columns,
    .enh-site-row { grid-template-columns: 34px minmax(100px, .7fr) minmax(125px, .8fr) minmax(180px, 1.2fr) 32px 52px 52px; gap: 6px; }
}
@media (max-width: 820px) {
    #enh-settings-panel { height: min(850px, calc(100vh - 24px)); }
    .enh-settings-nav { width: 174px; flex-basis: 174px; }
    .enh-settings-body { padding: 22px 16px 28px; }
    .enh-settings-grid--three,
    .enh-integration-summary,
    .enh-integration-grid { grid-template-columns: minmax(0, 1fr); }
    .enh-site-editor__columns,
    .enh-site-row { grid-template-columns: 32px minmax(90px, .7fr) minmax(116px, .8fr) minmax(150px, 1.15fr) 30px 48px 50px; gap: 5px; }
}

/* ════ Mark Review Panel ════ */
.enh-marks-panel {
    margin: 0;
    padding: 14px;
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
    min-width: 58px; height: 28px; padding: 0 8px; border-radius: 7px;
    border: 1px solid ${t.bd1}; background: ${t.sf1}; color: ${t.tx2};
    cursor: pointer; font: 650 10px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.enh-mark-row__clear:hover { border-color: ${t.red}; color: ${t.red}; }
.enh-marks-empty { color: ${t.tx3}; font: 500 11px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

/* ════ Servarr Settings ════ */
.enh-integration-summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.enh-integration-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; align-items: start; }
.enh-integration-card { min-width: 0; }
.enh-integration-card > .enh-servarr-panel {
    margin-top: 8px; padding: 0; border: 0; border-radius: 0; background: transparent;
}
.enh-integration-card .enh-servarr-grid { gap: 6px; }
.enh-integration-card .enh-servarr-section + .enh-servarr-section { margin-top: 10px; padding-top: 10px; }
.enh-integration-card .enh-servarr-input { height: 28px; }
.enh-integration-tabs {
    display: flex; gap: 4px; margin: 0 0 10px; padding-bottom: 8px;
    border-bottom: 1px solid ${t.bd0};
}
.enh-integration-tab {
    min-height: 30px; padding: 0 10px; border: 0; border-radius: 6px;
    background: transparent; color: ${t.tx2}; cursor: pointer;
    font: 650 11px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.enh-integration-tab:hover { background: ${t.sf2}; color: ${t.tx0}; }
.enh-integration-tab[aria-selected="true"] {
    background: ${t.accentMuted}; color: ${t.accent};
}
.enh-servarr-panel {
    margin: 0;
    padding: 14px 0 0;
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
.enh-editorial-action:focus-visible,
.enh-editorial-subnav__link:focus-visible,
.enh-editorial-detail-row a:focus-visible,
.enh-editorial-about-link:focus-visible,
#enh-trailer-btn:focus-visible,
.enh-trailer-close:focus-visible,
#enh-watchlist-copy:focus-visible,
#enh-link-menu-trigger:focus-visible,
.enh-link-dropdown__item:focus-visible,
#enh-copy-id:focus-visible,
.enh-mark-btn:focus-visible,
.enh-mark-row__clear:focus-visible,
.enh-collapse-btn:focus-visible,
.enh-qn-dot:focus-visible,
.enh-tv-chip:focus-visible,
.enh-best-episode__title:focus-visible,
.enh-site-remove:focus-visible,
.enh-site-order-btn:focus-visible,
.enh-site-visibility:focus-within,
.enh-site-select:focus-visible,
.enh-integration-tab:focus-visible,
.enh-servarr-input:focus-visible,
.enh-settings-footer-btn:focus-visible,
.enh-settings-nav-btn:focus-visible,
.enh-settings-close:focus-visible,
.enh-theme-swatch:focus-visible,
#enh-settings-fab:focus-visible {
    outline: 2px solid ${t.accent};
    outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
    [id^="enh-"], [id^="enh-"]::before, [id^="enh-"]::after,
    [class^="enh-"], [class^="enh-"]::before, [class^="enh-"]::after,
    [class*=" enh-"], [class*=" enh-"]::before, [class*=" enh-"]::after {
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.001ms !important;
        transition-delay: 0s !important;
    }
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
    let previousDocumentOverflow = '';
    let activeSettingsPage = 'experience';
    let settingsPanelCleanup = null;

    function refreshFeature(key) {
        const feature = features.find(f => f.key === key);
        if (!feature || !get(key) || !shouldInitFeature(feature)) return;

        const linkMenu = key === 'externalLinks' ? features.find(f => f.key === 'expandedLinkMenu') : null;

        try {
            if (linkMenu && get('expandedLinkMenu')) stopFeature(linkMenu);
            stopFeature(feature);
            startFeature(feature, { context:'refresh', notify:true });
            if (linkMenu && get('expandedLinkMenu')) startFeature(linkMenu, { context:'refresh', notify:true });
        } catch (e) {
            console.warn(`[IMDb Enhanced] refresh ${key}:`, e);
            showToast(`${feature.name} could not refresh. Reload and try again.`, 4500);
        }
    }

    function createSiteEditor({ title, key, defaults, featureKey }) {
        const editor = makeEl('div', { className:'enh-site-editor' });
        const rows = makeEl('div', { className:'enh-site-editor__rows' });
        const columns = makeEl('div', { className:'enh-site-editor__columns', 'aria-hidden':'true' },
            makeEl('span', {}, 'Visible'),
            makeEl('span', {}, 'Name'),
            makeEl('span', {}, 'Purpose'),
            makeEl('span', {}, 'URL template'),
            makeEl('span', {}, 'Color'),
            makeEl('span', {}, 'Move'),
            makeEl('span', {}, 'Remove')
        );
        const defaultCategory = key === 'watchSites' ? 'watch' : 'other';
        const count = makeEl('span', {
            className:'enh-settings-route-badge', role:'status', 'aria-live':'polite', 'aria-atomic':'true',
        });
        let add = null;
        let lastSaveFailure = '';
        const updateOrderButtons = () => {
            const rowList = [...rows.children];
            rowList.forEach((row, index) => {
                const up = row.querySelector('[data-action="up"]');
                const down = row.querySelector('[data-action="down"]');
                if (up) up.disabled = index === 0;
                if (down) down.disabled = index === rowList.length - 1;
            });
        };
        const updateCount = () => {
            const siteRows = [...rows.querySelectorAll('.enh-site-row')];
            const total = siteRows.length;
            const visible = siteRows.filter(row => row.querySelector('[data-field="enabled"]')?.checked).length;
            count.textContent = total ? `${visible}/${total} visible` : '0 sites';
            count.title = `${visible} of ${total} destinations appear on IMDb pages`;
            if (add) add.disabled = total >= SITE_LIST_LIMIT;
            updateOrderButtons();
        };

        const readRows = () => Array.from(rows.querySelectorAll('.enh-site-row')).map(row => ({
            name: row.querySelector('[data-field="name"]')?.value || '',
            url: row.querySelector('[data-field="url"]')?.value || '',
            color: row.querySelector('[data-field="color"]')?.value || '#6366f1',
            category: row.querySelector('[data-field="category"]')?.value || defaultCategory,
            enabled: row.querySelector('[data-field="enabled"]')?.checked !== false,
        }));

        const validateRows = () => {
            let valid = true;
            rows.querySelectorAll('.enh-site-row').forEach(row => {
                const nameInput = row.querySelector('[data-field="name"]');
                const urlInput = row.querySelector('[data-field="url"]');
                const categoryInput = row.querySelector('[data-field="category"]');
                const nameValid = Boolean(nameInput?.value.trim());
                const urlValid = Boolean(normalizeUrlTemplate(urlInput?.value));
                const categoryValid = SITE_CATEGORY_KEYS.has(categoryInput?.value);
                [[nameInput, nameValid], [urlInput, urlValid], [categoryInput, categoryValid]].forEach(([input, inputValid]) => {
                    input?.classList.toggle('enh-site-input--invalid', !inputValid);
                    input?.setAttribute('aria-invalid', String(!inputValid));
                });
                valid = valid && nameValid && urlValid && categoryValid;
            });
            return valid;
        };

        const save = (refresh = true) => {
            lastSaveFailure = '';
            if (!validateRows()) {
                lastSaveFailure = 'validation';
                return false;
            }
            if (!setSiteList(key, readRows(), refresh)) {
                lastSaveFailure = 'storage';
                return false;
            }
            if (refresh) refreshFeature(featureKey);
            updateCount();
            return true;
        };

        const addRow = (site = {}) => {
            const row = makeEl('div', { className:'enh-site-row', role:'group' });
            const enabledInput = makeEl('input', {
                type:'checkbox',
                className:'enh-site-enabled',
                dataset:{ field:'enabled' },
                'aria-label':'Show destination on IMDb pages',
            });
            enabledInput.checked = site.enabled !== false;
            const visibility = makeEl('label', {
                className:'enh-site-visibility',
                title:'Show or hide this destination on IMDb pages',
            }, enabledInput, makeEl('span', { className:'enh-site-visibility__dot', 'aria-hidden':'true' }));
            const nameInput = makeEl('input', {
                type:'text',
                className:'enh-site-input',
                dataset:{ field:'name' },
                'aria-label':'Destination name',
                placeholder:'Site name',
                maxlength:'40',
            });
            nameInput.value = site.name || '';

            const categoryInput = makeEl('select', {
                className:'enh-site-input enh-site-select',
                dataset:{ field:'category' },
                'aria-label':'Destination category',
            }, ...SITE_CATEGORY_OPTIONS.map(option => makeEl('option', { value:option.key }, option.label)));
            categoryInput.value = normalizeSiteCategory(site.category, defaultCategory);

            const urlInput = makeEl('input', {
                type:'url',
                className:'enh-site-input',
                dataset:{ field:'url' },
                'aria-label':'URL template',
                placeholder:'https://example.com/search?q={{TITLE}}',
                maxlength:String(URL_TEMPLATE_TEXT_LIMIT),
            });
            urlInput.value = site.url || '';

            const colorInput = makeEl('input', {
                type:'color',
                className:'enh-site-color',
                dataset:{ field:'color' },
                'aria-label':'Destination color',
            });
            colorInput.value = normalizeColor(site.color);

            const moveRow = direction => {
                const target = direction === 'up' ? row.previousElementSibling : row.nextElementSibling;
                if (!target) return;
                const previousOrder = [...rows.children];
                if (direction === 'up') rows.insertBefore(row, target);
                else rows.insertBefore(target, row);
                if (save()) {
                    nameInput.focus();
                    return;
                }
                rows.replaceChildren(...previousOrder);
                updateCount();
                if (lastSaveFailure === 'validation') {
                    showToast('Finish or remove the incomplete site row before changing the order');
                }
            };
            const moveUp = makeEl('button', {
                type:'button',
                className:'enh-site-order-btn',
                dataset:{ action:'up' },
                title:'Move destination up',
                'aria-label':'Move destination up',
                onClick: () => moveRow('up'),
            }, '↑');
            const moveDown = makeEl('button', {
                type:'button',
                className:'enh-site-order-btn',
                dataset:{ action:'down' },
                title:'Move destination down',
                'aria-label':'Move destination down',
                onClick: () => moveRow('down'),
            }, '↓');
            const order = makeEl('span', { className:'enh-site-order' }, moveUp, moveDown);

            const remove = makeEl('button', {
                type:'button',
                className:'enh-site-remove',
                title:'Remove site',
                'aria-label':'Remove destination',
                onClick: () => {
                    const next = row.nextSibling;
                    const previous = row.previousSibling;
                    const destination = nameInput.value.trim() || 'Destination';
                    row.remove();
                    if (save()) {
                        const focusTarget = next?.querySelector?.('[data-field="name"]')
                            || previous?.querySelector?.('[data-field="name"]')
                            || add;
                        focusTarget?.focus();
                        showToast(`${destination} removed from ${title}`);
                        return;
                    }
                    rows.insertBefore(row, next?.parentNode === rows ? next : null);
                    updateCount();
                    remove.focus();
                    if (lastSaveFailure === 'validation') {
                        showToast('Finish or remove the incomplete site row before changing the list');
                    }
                },
            }, 'Remove');

            const updateRowLabel = () => {
                const destination = nameInput.value.trim() || 'new destination';
                const category = getSiteCategoryLabel(categoryInput.value);
                row.setAttribute('aria-label', `${destination} in ${title}`);
                row.setAttribute('aria-description', category);
                enabledInput.setAttribute('aria-label', `Show ${destination} on IMDb pages`);
                remove.setAttribute('aria-label', `Remove ${destination} from ${title}`);
                moveUp.setAttribute('aria-label', `Move ${destination} up`);
                moveDown.setAttribute('aria-label', `Move ${destination} down`);
            };
            nameInput.addEventListener('input', updateRowLabel);
            categoryInput.addEventListener('change', updateRowLabel);

            [nameInput, urlInput, categoryInput, colorInput, enabledInput].forEach(input => {
                input.addEventListener('input', () => save(false));
                input.addEventListener('change', () => {
                    if (!save(true) && lastSaveFailure === 'validation') {
                        showToast('Enter a name, valid HTTP(S) URL, category, and supported template tokens');
                    }
                    updateCount();
                });
            });
            row.appendChild(visibility);
            row.appendChild(nameInput);
            row.appendChild(urlInput);
            row.appendChild(categoryInput);
            row.appendChild(colorInput);
            row.appendChild(order);
            row.appendChild(remove);
            rows.appendChild(row);
            updateRowLabel();
            return row;
        };

        add = makeEl('button', {
            type:'button',
            className:'enh-settings-footer-btn',
            onClick: () => {
                if (rows.children.length >= SITE_LIST_LIMIT) {
                    showToast(`A site list can contain up to ${SITE_LIST_LIMIT} destinations`);
                    return;
                }
                const row = addRow();
                updateCount();
                row.querySelector('[data-field="name"]')?.focus();
            },
        }, 'Add destination');
        const reset = makeEl('button', {
            type:'button',
            className:'enh-settings-footer-btn',
            onClick: () => {
                const previousRows = Array.from(rows.children);
                rows.replaceChildren();
                defaults.forEach(site => addRow(site));
                if (!save()) {
                    rows.replaceChildren(...previousRows);
                    updateCount();
                    return;
                }
                showToast(`${title} reset to defaults`);
            },
        }, 'Reset');

        editor.appendChild(makeEl('div', { className:'enh-site-editor__header' },
            makeEl('div', { className:'enh-site-editor__title-wrap' },
                makeEl('div', { className:'enh-site-editor__title' }, title), count
            ),
            makeEl('div', { className:'enh-site-editor__actions' }, add, reset)
        ));
        editor.appendChild(makeEl('div', { className:'enh-site-editor__hint' },
            'Edit every destination directly. Hide, categorize, reorder, or remove links without changing the rest of IMDb Enhanced.'
        ));

        getSiteList(key, defaults).forEach(site => addRow(site));
        updateCount();
        editor.appendChild(columns);
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
            ...(type === 'number'
                ? { min:'1', step:'1' }
                : { maxlength:String(SETTING_TEXT_LIMIT) }),
        });
        input.value = String(get(key) || '').slice(0, SETTING_TEXT_LIMIT);
        const persist = (notifyFailure = false) => {
            const raw = input.value.trim();
            if (LOCAL_SERVICE_URL_KEYS.has(key)) {
                const normalized = normalizeLocalServiceUrl(raw);
                const valid = !raw || Boolean(normalized);
                input.classList.toggle('enh-site-input--invalid', !valid);
                input.setAttribute('aria-invalid', String(!valid));
                if (!valid) {
                    if (notifyFailure) showToast('Use a localhost or 127.0.0.1 HTTP(S) URL without embedded credentials');
                    return false;
                }
                return trySaveSetting(key, normalized, { notify:notifyFailure });
            }
            if (POSITIVE_INTEGER_SETTING_KEYS.has(key) && raw) {
                const number = Number(raw);
                const valid = Number.isSafeInteger(number) && number > 0;
                input.classList.toggle('enh-site-input--invalid', !valid);
                input.setAttribute('aria-invalid', String(!valid));
                if (!valid) {
                    if (notifyFailure) showToast('Use a positive whole-number profile ID');
                    return false;
                }
                return trySaveSetting(key, String(number), { notify:notifyFailure });
            }
            if (CREDENTIAL_SETTING_KEYS.has(key)) {
                const normalized = normalizeCredentialValue(raw);
                const valid = !raw || Boolean(normalized);
                input.classList.toggle('enh-site-input--invalid', !valid);
                input.setAttribute('aria-invalid', String(!valid));
                if (!valid) {
                    if (notifyFailure) showToast('Credentials must be at most 4,096 characters without control characters');
                    return false;
                }
                return trySaveSetting(key, normalized, { notify:notifyFailure });
            }
            input.classList.remove('enh-site-input--invalid');
            input.setAttribute('aria-invalid', 'false');
            return trySaveSetting(key, raw.slice(0, SETTING_TEXT_LIMIT), { notify:notifyFailure });
        };
        if (LOCAL_SERVICE_URL_KEYS.has(key)) {
            const initial = input.value.trim();
            const valid = !initial || Boolean(normalizeLocalServiceUrl(initial));
            input.classList.toggle('enh-site-input--invalid', !valid);
            input.setAttribute('aria-invalid', String(!valid));
        }
        input.addEventListener('input', () => persist(false));
        input.addEventListener('change', () => {
            if (!persist(true)) return;
            if (refreshKey) refreshFeature(refreshKey);
        });
        return makeEl('div', { className:'enh-servarr-field' + (wide ? ' enh-servarr-field--wide' : '') },
            makeEl('label', { for:id }, label),
            input
        );
    }

    function createIntegrationTabs(sections, fieldFactory, namespace) {
        const panel = makeEl('form', { className:'enh-servarr-panel', autocomplete:'off' });
        const tabs = makeEl('div', { className:'enh-integration-tabs', role:'tablist', 'aria-label':`${namespace} services` });
        const panels = new Map();
        const buttons = new Map();
        const select = id => {
            panels.forEach((section, sectionId) => { section.hidden = sectionId !== id; });
            buttons.forEach((button, buttonId) => {
                const selected = buttonId === id;
                button.setAttribute('aria-selected', String(selected));
                button.tabIndex = selected ? 0 : -1;
            });
        };

        sections.forEach((definition, index) => {
            const tabId = `enh-${namespace}-tab-${definition.id}`;
            const panelId = `enh-${namespace}-panel-${definition.id}`;
            const button = makeEl('button', {
                type:'button', className:'enh-integration-tab', id:tabId, role:'tab',
                'aria-controls':panelId, 'aria-selected':String(index === 0),
                onClick:() => select(definition.id),
            }, definition.title);
            button.tabIndex = index === 0 ? 0 : -1;
            button.addEventListener('keydown', event => {
                const ordered = sections.map(item => item.id);
                const current = ordered.indexOf(definition.id);
                let next = null;
                if (event.key === 'ArrowRight') next = (current + 1) % ordered.length;
                if (event.key === 'ArrowLeft') next = (current - 1 + ordered.length) % ordered.length;
                if (event.key === 'Home') next = 0;
                if (event.key === 'End') next = ordered.length - 1;
                if (next === null) return;
                event.preventDefault();
                select(ordered[next]);
                buttons.get(ordered[next])?.focus();
            });
            const section = makeEl('div', {
                className:'enh-servarr-section', id:panelId, role:'tabpanel', 'aria-labelledby':tabId,
            }, makeEl('div', { className:'enh-servarr-grid' }, ...definition.fields.map(fieldFactory)));
            section.hidden = index !== 0;
            tabs.appendChild(button);
            buttons.set(definition.id, button);
            panels.set(definition.id, section);
        });

        panel.appendChild(tabs);
        panels.forEach(section => panel.appendChild(section));
        return panel;
    }

    function createServarrSettingsPanel() {
        const panel = createIntegrationTabs([
            {
                id:'radarr', title:'Radarr', fields:[
                    { key:'radarrUrl', label:'URL', wide:true, placeholder:'http://localhost:7878' },
                    { key:'radarrApiKey', label:'API key', type:'password', wide:true },
                    { key:'radarrRootFolderPath', label:'Root folder', wide:true, placeholder:'/movies' },
                    { key:'radarrQualityProfileId', label:'Quality profile ID', type:'number' },
                ],
            },
            {
                id:'sonarr', title:'Sonarr', fields:[
                    { key:'sonarrUrl', label:'URL', wide:true, placeholder:'http://localhost:8989' },
                    { key:'sonarrApiKey', label:'API key', type:'password', wide:true },
                    { key:'sonarrRootFolderPath', label:'Root folder', wide:true, placeholder:'/tv' },
                    { key:'sonarrQualityProfileId', label:'Quality profile ID', type:'number' },
                ],
            },
            {
                id:'seerr', title:'Overseerr', fields:[
                    { key:'seerrUrl', label:'URL', wide:true, placeholder:'http://localhost:5055' },
                    { key:'seerrApiKey', label:'API key', type:'password', wide:true },
                ],
            },
        ], createSettingsInput, 'servarr');
        panel.appendChild(makeEl('div', { className:'enh-servarr-note' },
            'Credentials stay local and requests are limited to localhost or 127.0.0.1. '
            + 'Overseerr and Jellyseerr both use these fields; a request there goes through your instance\'s approval workflow '
            + 'instead of writing straight into Radarr or Sonarr, and your instance resolves the IMDb ID itself.'
        ));
        panel.addEventListener('submit', e => e.preventDefault());
        return panel;
    }

    function createMediaServerSettingsPanel() {
        const mediaField = field => createSettingsInput({ ...field, refreshKey:'mediaServerIntegration' });
        const panel = createIntegrationTabs([
            {
                id:'plex', title:'Plex', fields:[
                    { key:'plexUrl', label:'URL', wide:true, placeholder:'http://localhost:32400' },
                    { key:'plexToken', label:'Token', type:'password', wide:true },
                ],
            },
            {
                id:'jellyfin', title:'Jellyfin', fields:[
                    { key:'jellyfinUrl', label:'URL', wide:true, placeholder:'http://localhost:8096' },
                    { key:'jellyfinApiKey', label:'API key', type:'password', wide:true },
                ],
            },
            {
                id:'emby', title:'Emby', fields:[
                    { key:'embyUrl', label:'URL', wide:true, placeholder:'http://localhost:8096' },
                    { key:'embyApiKey', label:'API key', type:'password', wide:true },
                ],
            },
        ], mediaField, 'media');
        panel.appendChild(makeEl('div', { className:'enh-servarr-note' },
            'Checks match IMDb IDs first, then title and year. Credentials stay local.'
        ));
        panel.addEventListener('submit', e => e.preventDefault());
        return panel;
    }

    function createMarksPanel(registerCleanup = () => {}) {
        const panel = makeEl('div', { className:'enh-marks-panel' });
        const count = makeEl('div', { className:'enh-marks-panel__count' });
        const rows = makeEl('div', { className:'enh-marks-panel__rows' });
        let clearAllArmed = false;
        let clearAllTimer = null;
        const disarmClearAll = () => {
            clearTimeout(clearAllTimer);
            clearAllTimer = null;
            clearAllArmed = false;
            clearAll.textContent = 'Clear all';
            clearAll.setAttribute('aria-label', 'Clear all saved title marks');
        };
        const clearAll = makeEl('button', {
            type:'button',
            className:'enh-settings-footer-btn enh-settings-footer-btn--danger',
            'aria-label':'Clear all saved title marks',
            onClick: () => {
                const entries = getUserMarkEntries();
                if (!entries.length) return;
                if (!clearAllArmed) {
                    clearAllArmed = true;
                    clearAll.textContent = `Confirm clear ${entries.length}`;
                    clearAll.setAttribute('aria-label', `Confirm clearing ${entries.length} saved title marks`);
                    clearAllTimer = setTimeout(disarmClearAll, 5000);
                    showToast('Press the clear button again within 5 seconds to remove every mark');
                    return;
                }
                if (!setUserMarks({})) return;
                refreshFeature('watchedMarking');
                render();
                showToast(`Cleared ${entries.length} saved title marks`);
            },
        }, 'Clear all');

        /* One-way: IMDb's account Watched state can seed local Seen marks, never
           the reverse. Existing marks win, so an imported title can never
           overwrite a deliberate Skip. */
        const importNative = makeEl('button', {
            type:'button',
            className:'enh-settings-footer-btn',
            'aria-label':'Import IMDb Watched titles shown on this page into private Seen marks',
            onClick: () => {
                const found = collectNativeWatchedTitles(document);
                if (!found.size) {
                    showToast('No IMDb Watched titles found on this page. Sign in and open a list, chart, or title that shows the Watched control.');
                    return;
                }
                const marks = { ...getUserMarks(true) };
                let imported = 0;
                let kept = 0;
                found.forEach((title, id) => {
                    if (marks[id]) { kept++; return; }
                    marks[id] = { state:'watched', title:String(title || '').trim().slice(0, USER_MARK_TITLE_LIMIT), ts:Date.now() };
                    imported++;
                });
                if (!imported) {
                    showToast(`All ${kept} IMDb Watched ${kept === 1 ? 'title' : 'titles'} on this page already have a local mark`);
                    return;
                }
                if (!setUserMarks(marks)) return;
                refreshFeature('watchedMarking');
                render();
                showToast(kept
                    ? `Imported ${imported} as local Seen; kept ${kept} existing ${kept === 1 ? 'mark' : 'marks'}`
                    : `Imported ${imported} IMDb Watched ${imported === 1 ? 'title' : 'titles'} as local Seen`);
            },
        }, 'Import from page');

        const render = () => {
            disarmClearAll();
            const entries = getUserMarkEntries();
            count.textContent = `${entries.length} saved`;
            const summary = document.getElementById('enh-data-marks-count');
            if (summary) summary.textContent = `${entries.length} ${entries.length === 1 ? 'title' : 'titles'}`;
            clearAll.disabled = entries.length === 0;
            rows.replaceChildren();
            if (!entries.length) {
                rows.appendChild(makeEl('div', { className:'enh-marks-empty' }, 'No local title marks yet.'));
                return;
            }
            entries.forEach(([id, record]) => {
                const title = record.title || id;
                const state = record.state === 'watched' ? 'Local seen' : 'Local skip';
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
                    rel:'noopener noreferrer',
                    className:'enh-mark-row__link',
                }, 'Open');
                const clear = makeEl('button', {
                    type:'button',
                    className:'enh-mark-row__clear',
                    title:`Clear ${title}`,
                    'aria-label':`Clear mark for ${title}`,
                    onClick: () => {
                        if (!setUserMark(id, '')) return;
                        refreshFeature('watchedMarking');
                        render();
                        showToast('Mark cleared');
                    },
                }, 'Remove');
                rows.appendChild(makeEl('div', { className:'enh-mark-row' }, titleEl, stateEl, open, clear));
            });
        };

        panel.appendChild(makeEl('div', { className:'enh-marks-panel__header' },
            makeEl('div', { className:'enh-marks-panel__title' }, 'Private title marks'),
            makeEl('div', { className:'enh-site-editor__actions' }, count, importNative, clearAll)
        ));
        panel.appendChild(makeEl('div', { className:'enh-servarr-note' },
            'These marks stay on this device and never change your IMDb account. '
            + 'Import from page copies the IMDb Watched titles visible on the page behind the settings dialog into local Seen marks; '
            + 'existing marks are kept, and nothing is ever sent back to IMDb.'
        ));
        panel.appendChild(rows);
        document.addEventListener('imdb-enhanced:marks-updated', render);
        registerCleanup(() => {
            document.removeEventListener('imdb-enhanced:marks-updated', render);
            clearTimeout(clearAllTimer);
        });
        render();
        return panel;
    }

    function createSettingsPanel() {
        if (document.getElementById('enh-settings-overlay')) return;
        const cleanupTasks = [];
        const registerCleanup = cleanup => cleanupTasks.push(cleanup);
        const overlay = makeEl('div', { id:'enh-settings-overlay', 'aria-hidden':'true' });
        overlay.innerHTML = `<div id="enh-settings-panel">
            <div class="enh-settings-header">
                <div>
                    <h2 id="enh-settings-title">IMDb Enhanced</h2>
                    <p class="enh-settings-subtitle">Focused controls for your IMDb workspace.</p>
                </div>
                <div class="enh-settings-header-actions">
                    <span class="enh-settings-save-state" id="enh-settings-save-state" role="status" aria-live="polite" aria-atomic="true">Saved locally</span>
                    <button type="button" class="enh-settings-close" title="Close settings" aria-label="Close settings">×</button>
                </div>
            </div>
            <div class="enh-settings-shell">
                <nav class="enh-settings-nav" id="enh-settings-nav" role="tablist" aria-label="Settings sections" aria-orientation="vertical"></nav>
                <div class="enh-settings-main">
                    <div class="enh-settings-body" id="enh-settings-body"></div>
                </div>
            </div>
            <div class="enh-settings-footer">
                <span>Version ${VERSION}</span>
                <span>Changes save automatically.</span>
                <span class="enh-settings-footer-note">Stored in your userscript manager.</span>
            </div>
        </div>`;

        const panel = overlay.querySelector('#enh-settings-panel');
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-labelledby', 'enh-settings-title');
        panel.setAttribute('tabindex', '-1');

        const nav = overlay.querySelector('#enh-settings-nav');
        const body = overlay.querySelector('#enh-settings-body');
        const saveState = overlay.querySelector('#enh-settings-save-state');
        const pageMeta = [
            { id:'experience', label:'Experience', title:'Experience', description:'Shape how IMDb looks and feels.' },
            { id:'ratings', label:'Ratings', title:'Ratings', description:'Bring trusted scores into the title page.' },
            { id:'tools', label:'Tools', title:'Tools', description:'Turn on only the shortcuts and title-page utilities you use.' },
            { id:'sites', label:'Sites', title:'Sites', description:'Choose where title searches and research links open.' },
            { id:'integrations', label:'Integrations', title:'Integrations', description:'Connect the local services you already run.' },
            { id:'data', label:'Data', title:'Data', description:'Review, back up, or clear what IMDb Enhanced stores locally.' },
        ];
        const pages = new Map();
        let savedTimer = null;

        const markSaved = () => {
            saveState.classList.remove('enh-settings-save-state--error');
            saveState.textContent = 'Saved';
            clearTimeout(savedTimer);
            savedTimer = setTimeout(() => { saveState.textContent = 'Saved locally'; }, 1200);
        };
        const markSaveFailed = () => {
            clearTimeout(savedTimer);
            saveState.classList.add('enh-settings-save-state--error');
            saveState.textContent = 'Save failed';
        };
        document.addEventListener('imdb-enhanced:settings-saved', markSaved);
        document.addEventListener('imdb-enhanced:settings-save-failed', markSaveFailed);
        registerCleanup(() => {
            document.removeEventListener('imdb-enhanced:settings-saved', markSaved);
            document.removeEventListener('imdb-enhanced:settings-save-failed', markSaveFailed);
            clearTimeout(savedTimer);
        });
        const makePage = meta => {
            const section = makeEl('section', {
                className:'enh-settings-page',
                id:`enh-settings-page-${meta.id}`,
                role:'tabpanel',
                'aria-labelledby':`enh-settings-tab-${meta.id}`,
            }, makeEl('div', { className:'enh-settings-page-header' },
                makeEl('h3', { className:'enh-settings-page-title' }, meta.title),
                makeEl('p', { className:'enh-settings-page-description' }, meta.description)
            ));
            pages.set(meta.id, section);
            body.appendChild(section);
            return section;
        };
        const showPage = (id, focus = false) => {
            if (!pages.has(id)) id = 'experience';
            activeSettingsPage = id;
            pages.forEach((page, pageId) => { page.hidden = pageId !== id; });
            nav.querySelectorAll('.enh-settings-nav-btn').forEach(button => {
                const selected = button.dataset.settingsPage === id;
                button.setAttribute('aria-selected', String(selected));
                button.tabIndex = selected ? 0 : -1;
                if (selected && focus) button.focus();
            });
            body.scrollTop = 0;
        };
        const makeCard = (title, description = '', badge = '') => makeEl('div', { className:'enh-settings-card' },
            makeEl('div', { className:'enh-settings-card-header' },
                makeEl('div', {},
                    makeEl('div', { className:'enh-settings-card-title' }, title),
                    description ? makeEl('div', { className:'enh-settings-card-description' }, description) : null
                ),
                badge ? makeEl('span', { className:'enh-settings-route-badge' }, badge) : null
            )
        );
        const makeFeatureRow = feature => {
            const row = makeEl('div', { className:'enh-settings-row' },
                makeEl('div', { className:'enh-settings-row-copy' },
                    makeEl('span', { className:'enh-settings-label' }, feature.name),
                    makeEl('span', { className:'enh-settings-help' }, FEATURE_DETAILS[feature.key] || '')
                )
            );
            const toggle = makeEl('label', { className:'enh-toggle' });
            const input = makeEl('input', { type:'checkbox', 'aria-label':feature.name });
            input.checked = get(feature.key);
            input.addEventListener('change', () => {
                const enabled = input.checked;
                if (!trySaveSetting(feature.key, enabled)) {
                    input.checked = !enabled;
                    return;
                }
                if (enabled && shouldInitFeature(feature)) {
                    startFeature(feature, { context:'settings', notify:true });
                } else if (!enabled) {
                    stopFeature(feature);
                }
                markSaved();
            });
            toggle.append(input, makeEl('span', { className:'enh-toggle-track' }));
            row.appendChild(toggle);
            return row;
        };
        const makeFeatureCard = (title, description, badge, keys, compact = false) => {
            const card = makeCard(title, description, badge);
            if (compact) card.classList.add('enh-settings-card--compact');
            keys.map(key => features.find(feature => feature.key === key)).filter(Boolean).forEach(feature => card.appendChild(makeFeatureRow(feature)));
            return card;
        };
        const makeFeatureSummaryCard = (title, description, badge, key) => {
            const feature = features.find(item => item.key === key);
            const card = makeCard(title, description, '');
            const row = makeFeatureRow(feature);
            const toggle = row.querySelector('.enh-toggle');
            const actions = makeEl('div', { className:'enh-settings-card-actions' },
                makeEl('span', { className:'enh-settings-route-badge' }, badge), toggle
            );
            card.querySelector('.enh-settings-card-header').appendChild(actions);
            return card;
        };

        pageMeta.forEach(meta => {
            const button = makeEl('button', {
                type:'button',
                className:'enh-settings-nav-btn',
                id:`enh-settings-tab-${meta.id}`,
                role:'tab',
                dataset:{ settingsPage:meta.id },
                'aria-controls':`enh-settings-page-${meta.id}`,
                'aria-selected':'false',
                onClick: () => showPage(meta.id),
            }, meta.label);
            button.addEventListener('keydown', event => {
                const buttons = Array.from(nav.querySelectorAll('.enh-settings-nav-btn'));
                const current = buttons.indexOf(button);
                let next = null;
                if (event.key === 'ArrowDown') next = (current + 1) % buttons.length;
                if (event.key === 'ArrowUp') next = (current - 1 + buttons.length) % buttons.length;
                if (event.key === 'Home') next = 0;
                if (event.key === 'End') next = buttons.length - 1;
                if (next === null) return;
                event.preventDefault();
                buttons[next].click();
                buttons[next].focus();
            });
            nav.appendChild(button);
            makePage(meta);
        });

        const experiencePage = pages.get('experience');
        experiencePage.classList.add('enh-settings-page--experience');
        const themeCard = makeCard('Appearance', 'Choose the tonal base for IMDb Enhanced surfaces.');
        const themeSelector = makeEl('div', { className:'enh-theme-selector' });
        const curTheme = getActiveThemeId();
        [
            { id:'dark', color:'#101014', label:'Dark' },
            { id:'oled', color:'#000000', label:'OLED' },
            { id:'midnight', color:'#0a0e1c', label:'Midnight' },
            { id:'light', color:'#f6f7f9', label:'Light' },
            { id:'highContrast', color:'linear-gradient(135deg,#000 0 42%,#ffd400 42% 62%,#fff 62%)', label:'High contrast' },
        ].forEach(theme => {
            const swatch = makeEl('button', {
                type:'button',
                className:'enh-theme-swatch' + (curTheme === theme.id ? ' active' : ''),
                style:{ background:theme.color },
                dataset:{ label:theme.label, theme:theme.id },
                title:theme.label,
                'aria-label':`Use ${theme.label} theme`,
                'aria-pressed':String(curTheme === theme.id),
                onClick: () => {
                    try { applySettingsImport([
                        { key:'themeAuto', value:false },
                        { key:'themeVariant', value:theme.id },
                    ]); }
                    catch {
                        showToast('Could not save the theme. Previous settings were restored.', 4500);
                        return;
                    }
                    applyThemeStyles();
                    markSaved();
                },
            });
            themeSelector.appendChild(makeEl('div', { className:'enh-theme-option' }, swatch, makeEl('span', {}, theme.label)));
        });
        themeCard.appendChild(themeSelector);
        const autoThemeRow = makeEl('div', { className:'enh-settings-row enh-theme-auto-row' },
            makeEl('div', { className:'enh-settings-row-copy' },
                makeEl('span', { className:'enh-settings-label' }, 'Follow system theme'),
                makeEl('span', { className:'enh-settings-help' }, 'Uses Light for OS light mode and Dark for OS dark mode.')
            )
        );
        const autoThemeToggle = makeEl('label', { className:'enh-toggle' });
        const autoThemeInput = makeEl('input', { id:'enh-theme-auto', type:'checkbox', 'aria-label':'Follow system theme' });
        autoThemeInput.checked = get('themeAuto');
        autoThemeInput.addEventListener('change', () => {
            const enabled = autoThemeInput.checked;
            if (!trySaveSetting('themeAuto', enabled)) {
                autoThemeInput.checked = !enabled;
                return;
            }
            applyThemeStyles();
            markSaved();
        });
        autoThemeToggle.append(autoThemeInput, makeEl('span', { className:'enh-toggle-track' }));
        autoThemeRow.appendChild(autoThemeToggle);
        themeCard.appendChild(autoThemeRow);
        experiencePage.appendChild(themeCard);
        const experienceGrid = makeEl('div', { className:'enh-settings-grid enh-settings-grid--experience', style:{ marginTop:'12px' } });
        experienceGrid.appendChild(makeFeatureCard('Clean up', 'Remove noise so you can focus on what matters.', 'All pages', [
            'removeAds', 'removeProUpsell', 'removeNewsSection', 'removeRelatedInterests',
            'removeContribution', 'removeSponsoredRecs', 'removeAppBanner',
        ], true));
        experienceGrid.appendChild(makeFeatureCard('Tune the interface', 'Refine how content looks and is presented.', 'Desktop', [
            'modernUI', 'editorialTitleSurface', 'compactHeader', 'enhancedRatingDisplay', 'widerLayout', 'ratingColorCoding',
            'collapsibleSections', 'spoilerBlur', 'quickNav',
        ], true));
        experiencePage.appendChild(experienceGrid);

        const ratingsPage = pages.get('ratings');
        const previewCard = makeCard('Preview', 'Sample source values — not live title data.');
        const preview = makeEl('div', { className:'enh-score-preview' });
        [
            ['8.7 /10', 'IMDb'], ['88%', 'Rotten Tomatoes'], ['4.2 /5', 'Letterboxd'], ['73 /100', 'Metacritic'], ['4 services', 'Streaming'],
        ].forEach(([value, label]) => preview.appendChild(makeEl('div', { className:'enh-score-preview-item' },
            makeEl('div', { className:'enh-score-preview-value' }, value),
            makeEl('div', { className:'enh-score-preview-label' }, label)
        )));
        previewCard.appendChild(preview);
        ratingsPage.append(previewCard,
            makeEl('div', { style:{ marginTop:'12px' } }, makeFeatureCard('Score sources', 'Choose which ratings and availability information to show.', 'Title pages', [
                'ratingHistogram', 'inlineRTScore', 'inlineLetterboxdScore', 'inlineMetacriticScore', 'streamAvailability',
            ])),
            makeEl('div', { className:'enh-settings-callout', style:{ marginTop:'12px' } },
                makeEl('strong', {}, 'Privacy'),
                'Fetched only on IMDb title pages. Responses are cached locally.'
            )
        );

        const toolsPage = pages.get('tools');
        toolsPage.appendChild(makeEl('div', { className:'enh-settings-grid enh-settings-grid--three' },
            makeFeatureCard('Title tools', 'Actions placed near a movie or show title.', 'Title pages', [
                'searchButtons', 'externalLinks', 'trailerPopover', 'expandedLinkMenu', 'watchedMarking',
            ]),
            makeFeatureCard('TV & episodes', 'Focused tools for series and episode lists.', 'TV', [
                'tvEpisodeTools', 'tvShowEnhancements', 'subtitleLinks',
            ]),
            makeFeatureCard('Lists & shortcuts', 'Batch actions and quick navigation.', 'Lists', [
                'watchlistBatch', 'listMultiSearch', 'quickCopyID', 'keyboardShortcuts',
            ])
        ));
        toolsPage.appendChild(makeEl('div', { className:'enh-settings-callout', style:{ marginTop:'12px', justifyContent:'center' } },
            makeEl('strong', {}, 'When “Optional keyboard shortcuts” is enabled'),
            makeEl('span', { className:'enh-settings-kbd' }, '?'), 'Open settings',
            makeEl('span', { className:'enh-settings-kbd', style:{ marginLeft:'20px' } }, 'C'), 'Copy IMDb ID'
        ));

        const sitesPage = pages.get('sites');
        sitesPage.appendChild(makeEl('div', { className:'enh-settings-callout' },
            makeEl('strong', {}, 'Cineby handoff'),
            'The exact Cineby root uses a one-time local title handoff. Edit or remove its row below to use an ordinary URL template.'
        ));
        const sitesGrid = makeEl('div', { className:'enh-sites-grid enh-sites-grid--single', style:{ marginTop:'12px' } },
            createSiteEditor({ title:'Watch & stream', key:'watchSites', defaults:DEFAULT_WATCH_SITES, featureKey:'searchButtons' }),
            createSiteEditor({ title:'Research & reviews', key:'externalSites', defaults:DEFAULT_EXTERNAL_SITES, featureKey:'externalLinks' })
        );
        sitesPage.append(sitesGrid, makeEl('div', { className:'enh-settings-callout', style:{ marginTop:'12px' } },
            makeEl('strong', {}, 'Templates'),
            'URL templates support {{TITLE}}, {{IMDB_ID}}, {{YEAR}}, and the tokens documented in the README. Categories include Watch, Reviews & ratings, Availability, Trailers & video, Info & research, and Other.'
        ));

        const integrationsPage = pages.get('integrations');
        integrationsPage.appendChild(makeEl('div', { className:'enh-integration-summary' },
            makeFeatureSummaryCard('Servarr quick-add', 'Add movies to Radarr and shows to Sonarr.', 'Local', 'servarrIntegration'),
            makeFeatureSummaryCard('Media server indicator', 'Check Plex, Jellyfin, and Emby libraries.', 'Local', 'mediaServerIntegration')
        ));
        integrationsPage.appendChild(makeEl('div', { className:'enh-settings-callout', style:{ marginTop:'12px' } },
            makeEl('strong', {}, 'Private by design'),
            'Requests go directly from your browser to the local URLs you provide.'
        ));
        const integrationGrid = makeEl('div', { className:'enh-integration-grid', style:{ marginTop:'12px' } });
        const servarrCard = makeCard('Radarr & Sonarr', 'Configure local quick-add destinations.');
        servarrCard.classList.add('enh-integration-card');
        servarrCard.appendChild(createServarrSettingsPanel());
        const mediaCard = makeCard('Media servers', 'Configure local library checks.');
        mediaCard.classList.add('enh-integration-card');
        mediaCard.appendChild(createMediaServerSettingsPanel());
        integrationGrid.append(servarrCard, mediaCard);
        integrationsPage.appendChild(integrationGrid);

        const dataPage = pages.get('data');
        const cacheCount = () => {
            try {
                return GM_listValues().filter(key =>
                    key.startsWith('cache_') && GM_getValue(key, null) !== null
                ).length;
            }
            catch { return 0; }
        };
        const dataSummary = makeEl('div', { className:'enh-data-summary' },
            makeEl('div', { className:'enh-data-summary-item' },
                makeEl('div', { className:'enh-data-summary-label' }, 'Preferences'),
                makeEl('div', { className:'enh-data-summary-value' }, 'Stored locally')
            ),
            makeEl('div', { className:'enh-data-summary-item' },
                makeEl('div', { className:'enh-data-summary-label' }, 'Private marks'),
                makeEl('div', { className:'enh-data-summary-value', id:'enh-data-marks-count' }, `${getUserMarkEntries().length} titles`)
            ),
            makeEl('div', { className:'enh-data-summary-item' },
                makeEl('div', { className:'enh-data-summary-label' }, 'Score cache'),
                makeEl('div', { className:'enh-data-summary-value', id:'enh-data-cache-count' }, `${cacheCount()} cached entries`)
            )
        );
        dataPage.appendChild(dataSummary);
        const importPanel = makeEl('div', { className:'enh-import-panel', id:'enh-import-panel', hidden:'hidden' },
            makeEl('label', { className:'enh-import-label', for:'enh-import-textarea' }, 'Paste exported settings JSON'),
            makeEl('textarea', {
                id:'enh-import-textarea', className:'enh-import-textarea', spellcheck:'false', maxlength:String(SETTINGS_IMPORT_TEXT_LIMIT),
                placeholder:'{ "modernUI": true, "themeVariant": "dark" }',
            }),
            makeEl('div', { className:'enh-import-actions' },
                makeEl('button', { type:'button', className:'enh-settings-footer-btn', id:'enh-import-apply' }, 'Apply import'),
                makeEl('button', { type:'button', className:'enh-settings-footer-btn', id:'enh-import-cancel' }, 'Cancel')
            )
        );
        const resetPanel = makeEl('div', {
            className:'enh-import-panel', id:'enh-reset-panel', hidden:'hidden', role:'alert',
        },
            makeEl('div', { className:'enh-import-label' }, 'Reset every setting?'),
            makeEl('div', { className:'enh-settings-card-description' },
                'This clears title marks and local integration credentials. Export a backup first if you may need them.'
            ),
            makeEl('div', { className:'enh-import-actions' },
                makeEl('button', {
                    type:'button', className:'enh-settings-footer-btn enh-settings-footer-btn--danger', id:'enh-reset-apply',
                }, 'Reset everything'),
                makeEl('button', { type:'button', className:'enh-settings-footer-btn', id:'enh-reset-cancel' }, 'Cancel')
            )
        );
        const backupCard = makeCard('Backup & restore', 'JSON includes preferences, sites, and local integration credentials.');
        backupCard.appendChild(makeEl('div', { className:'enh-data-actions' },
            makeEl('button', { type:'button', className:'enh-settings-footer-btn', id:'enh-export-btn', title:'Copy all settings to clipboard' }, 'Export settings'),
            makeEl('button', {
                type:'button', className:'enh-settings-footer-btn', id:'enh-import-btn', title:'Import settings from JSON',
                'aria-controls':'enh-import-panel', 'aria-expanded':'false',
            }, 'Import settings'),
            makeEl('button', {
                type:'button', className:'enh-settings-footer-btn enh-settings-footer-btn--danger',
                id:'enh-reset-btn', title:'Reset preferences, title marks, and integration credentials',
                'aria-controls':'enh-reset-panel', 'aria-expanded':'false',
            }, 'Reset all settings')
        ));
        backupCard.appendChild(importPanel);
        backupCard.appendChild(resetPanel);
        const cacheCard = makeCard('Cached lookups', 'Scores and availability lookups are cached locally for up to seven days.');
        cacheCard.append(
            makeEl('button', { type:'button', className:'enh-settings-footer-btn', id:'enh-clearcache-btn', title:'Clear cached third-party lookups' }, 'Clear cache'),
            makeEl('div', { className:'enh-settings-card-description', id:'enh-cache-status', style:{ marginTop:'8px' } }, `${cacheCount()} entries currently cached.`)
        );
        dataPage.appendChild(makeEl('div', { className:'enh-settings-grid' },
            createMarksPanel(registerCleanup),
            makeEl('div', { className:'enh-settings-stack' }, backupCard, cacheCard)
        ));
        dataPage.appendChild(makeEl('div', { className:'enh-settings-callout', style:{ marginTop:'12px' } },
            makeEl('strong', {}, 'Local only'),
            'Nothing is sent to an IMDb Enhanced account or cloud service.'
        ));

        const setDataDisclosureState = openPanel => {
            const importOpen = openPanel === 'import';
            const resetOpen = openPanel === 'reset';
            importPanel.hidden = !importOpen;
            resetPanel.hidden = !resetOpen;
            overlay.querySelector('#enh-import-btn').setAttribute('aria-expanded', String(importOpen));
            overlay.querySelector('#enh-reset-btn').setAttribute('aria-expanded', String(resetOpen));
        };

        overlay.querySelector('.enh-settings-close').addEventListener('click', toggleSettings);
        overlay.addEventListener('click', event => { if (event.target === overlay) toggleSettings(); });
        overlay.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                if (settingsOpen) toggleSettings();
                return;
            }
            if (event.key !== 'Tab') return;
            const focusables = getFocusableElements(overlay);
            if (!focusables.length) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        });
        const containSettingsFocus = event => {
            if (!settingsOpen || overlay.contains(event.target)) return;
            const activeTab = overlay.querySelector(`.enh-settings-nav-btn[data-settings-page="${activeSettingsPage}"]`);
            (activeTab || getFocusableElements(overlay)[0] || panel).focus();
        };
        document.addEventListener('focusin', containSettingsFocus);
        registerCleanup(() => document.removeEventListener('focusin', containSettingsFocus));
        overlay.querySelector('#enh-export-btn').addEventListener('click', () => {
            try {
                const serialized = JSON.stringify(getExportSettings(), null, 2);
                if (serialized.length > SETTINGS_IMPORT_TEXT_LIMIT) {
                    showToast('Settings exceed the 4 MB backup limit. Remove stale title marks or oversized destinations first.', 5000);
                    return;
                }
                const copied = copyTextToClipboard(serialized);
                showToast(copied
                    ? 'Settings copied to clipboard'
                    : 'Export copy failed. Check the userscript clipboard permission.', copied ? 2500 : 4500);
            } catch (error) {
                console.warn('[IMDb Enhanced] settings export failed:', error);
                showToast('Settings could not be read for export. No backup was copied.', 4500);
            }
        });
        overlay.querySelector('#enh-import-btn').addEventListener('click', () => {
            setDataDisclosureState('import');
            requestAnimationFrame(() => {
                importPanel.scrollIntoView({ block:'nearest' });
                overlay.querySelector('#enh-import-textarea').focus();
            });
        });
        overlay.querySelector('#enh-import-cancel').addEventListener('click', () => {
            setDataDisclosureState('');
            overlay.querySelector('#enh-import-textarea').value = '';
            overlay.querySelector('#enh-import-btn').focus();
        });
        overlay.querySelector('#enh-reset-btn').addEventListener('click', () => {
            setDataDisclosureState('reset');
            overlay.querySelector('#enh-import-textarea').value = '';
            requestAnimationFrame(() => overlay.querySelector('#enh-reset-apply').focus());
        });
        overlay.querySelector('#enh-reset-cancel').addEventListener('click', () => {
            setDataDisclosureState('');
            overlay.querySelector('#enh-reset-btn').focus();
        });
        overlay.querySelector('#enh-reset-apply').addEventListener('click', () => {
            try {
                const reset = applySettingsImport(getDefaultSettingsEntries());
                showToast(`Reset ${reset} settings. Reloading...`);
                setTimeout(() => location.reload(), 1000);
            } catch (error) {
                showToast(error.message || 'Reset failed. Previous settings were restored.', 4500);
            }
        });
        overlay.querySelector('#enh-import-apply').addEventListener('click', () => {
            const raw = overlay.querySelector('#enh-import-textarea').value.trim();
            if (!raw) { showToast('Paste settings JSON before importing'); return; }
            if (raw.length > SETTINGS_IMPORT_TEXT_LIMIT) { showToast('Import is too large. Use a complete export under 4 MB.'); return; }
            try {
                const data = JSON.parse(raw);
                const { entries, ignored } = prepareSettingsImport(data);
                const imported = applySettingsImport(entries);
                const skipped = ignored ? `; skipped ${ignored} invalid or unknown` : '';
                showToast(`Imported ${imported} settings${skipped}. Reloading...`);
                setTimeout(() => location.reload(), 1000);
            } catch (error) {
                const message = error instanceof SyntaxError
                    ? 'Import failed. Check the JSON syntax and try again.'
                    : error.message || 'Import failed. No settings were changed.';
                showToast(message);
            }
        });
        overlay.querySelector('#enh-clearcache-btn').addEventListener('click', () => {
            let keys;
            try { keys = GM_listValues().filter(key => key.startsWith('cache_')); }
            catch {
                showToast('Cache could not be read or cleared.', 4500);
                return;
            }
            let cleared = 0;
            let failed = 0;
            keys.forEach(key => {
                try {
                    if (typeof GM_deleteValue === 'function') GM_deleteValue(key);
                    else GM_setValue(key, null);
                    cleared++;
                } catch { failed++; }
            });
            const remaining = cacheCount();
            overlay.querySelector('#enh-data-cache-count').textContent = `${remaining} cached entries`;
            overlay.querySelector('#enh-cache-status').textContent = remaining
                ? `${remaining} entries remain.`
                : 'No cached entries.';
            if (!keys.length) showToast('Cache is already empty');
            else if (failed) showToast(`Cleared ${cleared} cached entries; ${failed} could not be removed.`, 4500);
            else showToast(`Cleared ${cleared} cached entries. Reload to re-fetch.`);
        });

        showPage(activeSettingsPage);
        document.body.appendChild(overlay);
        settingsPanelCleanup = () => {
            cleanupTasks.splice(0).forEach(cleanup => cleanup());
            settingsPanelCleanup = null;
        };
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
        if (settingsOpen) {
            lastFocusedElement = document.activeElement;
            previousDocumentOverflow = document.documentElement.style.overflow;
            document.documentElement.style.overflow = 'hidden';
            const activeTab = overlay?.querySelector(`.enh-settings-nav-btn[data-settings-page="${activeSettingsPage}"]`);
            setTimeout(() => (activeTab || getFocusableElements(overlay)[0] || panel)?.focus(), 40);
        } else {
            const importPanel = document.getElementById('enh-import-panel');
            const resetPanel = document.getElementById('enh-reset-panel');
            if (importPanel) importPanel.hidden = true;
            if (resetPanel) resetPanel.hidden = true;
            document.getElementById('enh-import-btn')?.setAttribute('aria-expanded', 'false');
            document.getElementById('enh-reset-btn')?.setAttribute('aria-expanded', 'false');
            const importTextarea = document.getElementById('enh-import-textarea');
            if (importTextarea) importTextarea.value = '';
            document.documentElement.style.overflow = previousDocumentOverflow;
            lastFocusedElement?.focus?.();
        }
    }

    function destroySettingsChrome() {
        settingsPanelCleanup?.();
        if (settingsOpen) document.documentElement.style.overflow = previousDocumentOverflow;
        settingsOpen = false;
        document.getElementById('enh-settings-overlay')?.remove();
        document.getElementById('enh-settings-fab')?.remove();
        lastFocusedElement = null;
        previousDocumentOverflow = '';
    }

    // =========================================================================
    //  CINEBY AUTO-FILL
    // =========================================================================
    async function handleCineby() {
        if (!isCinebyHost()) return;
        const t = takeCinebyQuery();
        if (!t) return;
        const findVisibleInput = () => Array.from(document.querySelectorAll(
            'input[type="search"],input[placeholder*="search" i]'
        )).find(input => input.offsetParent !== null);
        const findSearchButton = () => Array.from(document.querySelectorAll('button,[role="button"]')).find(button => {
            const label = button.getAttribute('aria-label') || button.textContent || '';
            return button.offsetParent !== null && /^search$/i.test(label.trim());
        });
        const fill = input => {
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            if (setter) setter.call(input, t);
            else input.value = t;
            input.dispatchEvent(new InputEvent('input', { bubbles:true, inputType:'insertText', data:t }));
            input.dispatchEvent(new Event('change', { bubbles:true }));
            input.focus();
        };

        try {
            const target = await waitForMatch(() => findVisibleInput() || findSearchButton(), 8000);
            if (target.tagName === 'INPUT') { fill(target); return; }
            target.click();
            fill(await waitForMatch(findVisibleInput, 5000));
        } catch (error) {
            console.warn('[IMDb Enhanced] Cineby search UI was unavailable; discarded the one-time handoff.', error);
        }
    }

    // =========================================================================
    //  INIT
    // =========================================================================
    let activeRouteKey = null;
    let activeRouteGeneration = 0;
    let routeInitCount = 0;
    let routerInstalled = false;
    let routeTimer = null;
    let initTimer = null;

    function isIMDbHost(hostname = window.location.hostname) {
        return String(hostname || '').toLowerCase() === 'www.imdb.com';
    }

    function isCinebyHost(hostname = window.location.hostname) {
        return String(hostname || '').toLowerCase() === 'www.cineby.at';
    }

    const UNIVERSAL_FEATURE_KEYS = new Set([
        'modernUI', 'compactHeader', 'widerLayout', 'keyboardShortcuts',
    ]);
    /* Private marks belong anywhere IMDb renders title cards, not only on a title
       page: charts, lists, watchlists, person filmographies, episode lists, and
       search results are exactly where knowing what you already watched or
       dismissed changes what you click. */
    const COLLECTION_FEATURE_KEYS = new Set([
        ...UNIVERSAL_FEATURE_KEYS, 'watchlistBatch', 'listMultiSearch', 'watchedMarking',
    ]);
    const SECONDARY_PAGE_FEATURE_KEYS = new Set([
        ...UNIVERSAL_FEATURE_KEYS, 'collapsibleSections', 'quickNav', 'watchedMarking', 'castAges',
    ]);
    const EPISODE_LIST_FEATURE_KEYS = new Set([
        ...SECONDARY_PAGE_FEATURE_KEYS, 'tvEpisodeTools',
    ]);
    /* Search, advanced search, and the homepage are browse surfaces: they carry
       IMDb's own cards rather than one title, so they take presentation and
       cleanup work without any title-scoped control. */
    const BROWSE_FEATURE_KEYS = new Set([
        ...UNIVERSAL_FEATURE_KEYS, 'watchedMarking',
    ]);

    function getPageSurface() {
        const path = location.pathname;
        const locale = '(?:[a-z]{2}(?:-[a-z]{2})?/)?';
        if (new RegExp(`^/${locale}title/tt\\d+/episodes/?$`, 'i').test(path)) return 'episodes';
        if (new RegExp(`^/${locale}title/tt\\d+/?$`, 'i').test(path)) return 'title';
        if (new RegExp(`^/${locale}title/tt\\d+/`, 'i').test(path)) return 'title-subpage';
        if (new RegExp(`^/${locale}name/nm\\d+`, 'i').test(path)) return 'name';
        if (/\/(watchlist|list\/|chart\/)/i.test(path)) return 'collection';
        if (new RegExp(`^/${locale}(?:find|search)(?:/|$)`, 'i').test(path)) return 'search';
        if (new RegExp(`^/${locale}$`, 'i').test(path)) return 'home';
        return 'other';
    }

    function shouldInitFeature(feature) {
        if (feature.group === 'Cleanup') return true;
        const surface = getPageSurface();
        if (surface === 'title') return !['watchlistBatch', 'listMultiSearch'].includes(feature.key);
        if (surface === 'episodes') return EPISODE_LIST_FEATURE_KEYS.has(feature.key);
        if (surface === 'collection') return COLLECTION_FEATURE_KEYS.has(feature.key);
        if (surface === 'name' || surface === 'title-subpage') return SECONDARY_PAGE_FEATURE_KEYS.has(feature.key);
        if (surface === 'search' || surface === 'home') return BROWSE_FEATURE_KEYS.has(feature.key);
        return UNIVERSAL_FEATURE_KEYS.has(feature.key);
    }

    function getRouteKey() {
        return `${window.location.hostname}${window.location.pathname}${window.location.search}`;
    }

    function createFeatureGuard(feature) {
        const routeKey = getRouteKey();
        const routeGeneration = activeRouteGeneration;
        const featureGeneration = featureGenerations.get(feature) || 0;
        return () => activeRouteGeneration === routeGeneration
            && (featureGenerations.get(feature) || 0) === featureGeneration
            && getRouteKey() === routeKey
            && get(feature.key)
            && shouldInitFeature(feature);
    }

    function destroyRouteFeatures() {
        cancelPendingRouteWork();
        features.forEach(f => {
            try { stopFeature(f); }
            catch (e) { console.warn(`[IMDb Enhanced] destroy ${f.key}:`, e); }
        });
        document.getElementById('enh-toast')?.remove();
        destroySettingsChrome();
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
        if (isCinebyHost()) { handleCineby(); return; }
        if (!isIMDbHost()) return;

        const routeKey = getRouteKey();
        if (activeRouteKey === routeKey) return;
        if (activeRouteKey) destroyRouteFeatures();
        activeRouteKey = routeKey;
        activeRouteGeneration += 1;
        _ldData = null;
        cacheGC();
        try { getSectionCollapseState(); }
        catch (error) { console.warn('[IMDb Enhanced] section-state migration deferred:', error); }

        injectGlobalStyles();
        const enabledFeatures = features.filter(f => get(f.key) && shouldInitFeature(f));
        enabledFeatures.forEach(feature => startFeature(feature, { context:'route' }));
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
