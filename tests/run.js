const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const scriptPath = path.join(root, 'IMDb_Enhanced.user.js');
const packagePath = path.join(root, 'package.json');
const readmePath = path.join(root, 'README.md');

const script = fs.readFileSync(scriptPath, 'utf8');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const readme = fs.readFileSync(readmePath, 'utf8');

function test(name, fn) {
    try {
        fn();
        console.log(`ok - ${name}`);
    } catch (error) {
        console.error(`not ok - ${name}`);
        throw error;
    }
}

/* withheldCredentials reproduces the one context that matters most and was never covered:
   a content script in an extension build, where the bridge answers whether a credential is
   set but never hands back its value. Six call sites read get() there and concluded
   "not configured", which is how an encrypted backup came to carry empty strings. */
function loadScriptTestHooks({ withoutDeleteValue = false, withheldCredentials = false } = {}) {
    const instrumented = script.replace(/\}\)\(\);\s*$/, `window.__enhTest = {
        normalizeIMDbProviderId,
        normalizeLookupTitle,
        toBoundedText,
        parseIMDbTitleStructuredData,
        getStructuredTitleYear,
        getStructuredMediaType,
        normalizeHistogramData,
        findHistogramData,
        parseHistogramScriptTexts,
        collectProviderIds,
        mediaItemMatches,
        selectServarrLookupResult,
        mapSeerrMediaState,
        selectSeerrSearchResult,
        buildSeerrRequestBody,
        parseMediaServerItems,
        parseJSONResponse,
        getRequestErrorMessage,
        getLinkedTitleId,
        findNativeTitleAction,
        extractHistogramValues,
        computeUnweightedMean,
        describeRatingGap,
        getUpdateNotice,
        runSettingsMigrations,
        readSettingsSchemaVersion,
        SETTINGS_SCHEMA_VERSION,
        getExportSettings,
        prepareSettingsImport,
        readHeatmapSeasons,
        readLoadedEpisodes,
        buildEpisodeSubtitleUrl,
        buildEpisodeSubtitleExport,
        summarizeSeasonProgress,
        describeSeasonProgress,
        summarizeHeatmapSeason,
        buildDiagnosticsReport,
        prepareSettingsImport,
        readCredential,
        canReadCredentials,
        getFeatureFailures,
        recordFeatureFailure,
        classifyFailure,
        describeRequestFailure,
        DEFAULTS,
        httpGet,
        getFailureJournal,
        clearFailureJournal,
        formatFailureJournal,
        FAILURE_CATEGORIES,
        NATIVE_WATCHLIST_SELECTORS,
        isIMDbHost,
        getPageSurface,
        shouldInitFeature,
        createFeatureGuard,
        advanceFeatureGeneration,
        startFeature,
        normalizeUrlTemplate,
        normalizeLocalServiceUrl,
        normalizeCredentialValue,
        isLocalServiceUrl,
        normalizeTrustedUrl,
        normalizeSite,
        normalizeSiteCategory,
        groupSitesByCategory,
        getSiteList,
        filterSitesForMediaType,
        boundedScore,
        parseRTSearchResult,
        parseRTDetailPage,
        readRTScoreField,
        parseLetterboxdDetailPage,
        selectMetacriticResult,
        buildWikidataIdQuery,
        parseWikidataExternalIds,
        normalizeExternalId,
        parseJustWatchSearchResult,
        parseJustWatchIdentity,
        parseJustWatchAvailability,
        collectJustWatchProviderNames,
        compactProviders,
        isTrailerTitleMatch,
        normalizeYouTubeVideoId,
        parseYouTubeTrailerVideoId,
        getListTitleIdsFromLinks,
        getListTitlesFromLinks,
        readCardRating,
        normalizeDimThreshold,
        DIM_THRESHOLD_OPTIONS,
        setTextIfChanged,
        MARK_FILTERS,
        countMarkFilters,
        markMatchesFilter,
        collectMarkFilterCards,
        parseRuntimeMinutes,
        summarizeCollectionRuntime,
        formatRuntimeTotal,
        describeCollectionRuntime,
        COLLECTION_LINK_SCAN_LIMIT,
        buildListSearchEntries,
        getEnhancementScrollBehavior,
        truncateAtWord,
        applyThemeStyles,
        setupThemeAutoSync,
        THEMES,
        getHexLuminance,
        readableTextColor,
        ratingColor,
        copyTextToClipboard,
        getFocusableElements,
        prepareSettingsImport,
        applySettingsImport,
        FMHY_WATCH_CATALOG,
        SITE_LIST_LIMIT,
        cacheSet,
        cacheGet,
        cacheGetStale,
        isReachabilityFailure,
        cacheGC,
        cacheCount,
        cacheBytes,
        encodedByteLength,
        readCacheUsage,
        CACHE_TOTAL_BYTE_BUDGET,
        CACHE_MAX_ENTRIES,
        resolveExternalIds,
        CACHE_TTL,
        CACHE_MAX_TTL,
        WIKIDATA_ID_TTL,
        computeCurrentAge,
        getUserMarks,
        setUserMarks,
        setUserMark,
        getUserMark,
        getUserNote,
        setUserNote,
        normalizeUserNote,
        USER_MARK_NOTE_LIMIT,
        readPersonBirthDate,
        isPersonDeceased,
        EPISODE_CODE_PATTERN,
        readNativeWatchedControl,
        collectNativeWatchedTitles,
        normalizeUserMarkEntries,
        USER_MARKS_SCAN_LIMIT,
        getSectionCollapseState,
        setSectionCollapsed,
        getDefaultSettingsEntries,
        getExportSettings,
        createEncryptedBackup,
        readEncryptedBackup,
        isEncryptedBackup,
        CREDENTIAL_SETTING_KEYS,
        EXPORT_REDACTED_KEY,
        EXPORT_METADATA_KEYS,
        FEATURE_ORIGIN_GROUPS,
        OPTIONAL_ORIGINS,
        REQUIRED_ORIGINS,
        getFeatureOrigins,
        describeFeatureOrigins,
        describeFeatureConsent,
        describeOriginHosts,
        parseTmdbFind,
        parseTmdbWatchProviders,
        getAvailabilitySource,
        getTmdbRegion,
        isTmdbConfigured,
        originsHeldByOtherEnabledFeatures,
        releasableOriginsFor,
        BACKUP_ENVELOPE_KEY,
        getFeatureKeys: () => features.map(feature => feature.key),
        FEATURE_DETAILS,
        SETTINGS_IMPORT_TEXT_LIMIT,
        CACHE_ENTRY_TEXT_LIMIT,
        SETTING_TEXT_LIMIT,
        mediaServerRequest,
        getServarrConfig,
        isServarrConfigured,
        buildRadarrAddBody,
        buildSonarrAddBody,
        seerrRequest,
        servarrRequest,
        toPositiveInteger,
        httpRequest,
        waitFor,
        cancelPendingRouteWork,
        getPendingRouteWorkCount: () => pendingRouteWorkCancels.size,
        setAdRequestBlocking,
        setTestPath: path => { location.pathname = path; },
        advanceRouteGeneration: () => { activeRouteGeneration += 1; }
    };
})();`);
    assert.notStrictEqual(instrumented, script, 'test hook injection failed');

    const location = { hostname: 'example.test', pathname: '/', search: '' };
    let prefersReducedMotion = false;
    let sandboxWriteCount = 0;
    let sandboxFailWriteAt = null;
    let sandboxFailAllWrites = false;
    const sandboxDocumentListeners = [];
    const sandboxDispatchedEvents = [];
    const sandboxToasts = [];
    /* Just enough element for the code that reports a problem to the user to run all the
       way through. It is not a DOM: nothing here is asserted on for layout, only for the
       text a failure puts in front of someone. */
    const makeSandboxElement = tag => {
        const children = [];
        const attributes = new Map();
        const classes = new Set();
        const element = {
            tagName: String(tag || 'div').toUpperCase(),
            children,
            dataset: {},
            style: { setProperty() {} },
            className: '',
            innerHTML: '',
            textContent: '',
            classList: {
                add: name => classes.add(name),
                remove: name => classes.delete(name),
                contains: name => classes.has(name),
            },
            setAttribute: (name, value) => { attributes.set(name, String(value)); },
            getAttribute: name => (attributes.has(name) ? attributes.get(name) : null),
            removeAttribute: name => { attributes.delete(name); },
            addEventListener() {},
            removeEventListener() {},
            appendChild: node => {
                children.push(node);
                if (node && node.nodeType === 3) element.textContent += node.textContent;
                return node;
            },
            removeChild: node => node,
            remove() {},
        };
        return element;
    };
    let sandboxClipboardFailure = false;
    let sandboxMediaListenerCount = 0;
    const sandboxValues = new Map();
    const sandboxRequests = [];
    let sandboxAbortedRequestCount = 0;
    const sandbox = {
        console: { ...console, warn: () => {} },
        URL,
        setTimeout: () => 0,
        clearTimeout: () => {},
        // Never invoked: these tests assert what a failure puts on screen, not how it
        // animates, and running the callbacks would only tear the element down again.
        requestAnimationFrame: () => 0,
        cancelAnimationFrame: () => {},
        window: {
            location,
            addEventListener: () => {},
            matchMedia: () => ({
                matches: prefersReducedMotion,
                addEventListener: () => { sandboxMediaListenerCount += 1; },
            }),
        },
        location,
        navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TestRunner/1.0' },
        document: {
            readyState: 'loading',
            // Enough of a body for the toast path to run to completion. Without it any
            // code that reports a failure to the user threw inside the harness, so tests
            // had to opt out of notification and stopped exercising the real call shape.
            body: {
                appendChild: node => {
                    if (node && typeof node.getAttribute === 'function' && node.getAttribute('id') === 'enh-toast') {
                        sandboxToasts.push(String(node.textContent || ''));
                    }
                    return node;
                },
                removeChild: node => node,
                contains: () => false,
            },
            documentElement: {},
            getElementById: () => null,
            querySelector: () => null,
            querySelectorAll: () => [],
            // Recorded rather than discarded: the cache's quota-recovery path is a
            // document listener, and a stub that drops registrations makes it untestable.
            addEventListener: (type, listener) => { sandboxDocumentListeners.push({ type, listener }); },
            removeEventListener: (type, listener) => {
                const index = sandboxDocumentListeners.findIndex(e => e.type === type && e.listener === listener);
                if (index >= 0) sandboxDocumentListeners.splice(index, 1);
            },
            // Recorded, not discarded: several recovery paths signal a repaint by
            // dispatching, and a stub that swallows them makes the signal untestable.
            dispatchEvent: event => { sandboxDispatchedEvents.push(event?.type || String(event)); return true; },
            createTextNode: text => ({ nodeType: 3, textContent: String(text) }),
            createElement: tag => {
                if (tag !== 'textarea') return makeSandboxElement(tag);
                let value = '';
                return {
                    set innerHTML(html) {
                        value = String(html)
                            .replace(/&amp;/g, '&')
                            .replace(/&quot;/g, '"')
                            .replace(/&#39;|&apos;/g, "'")
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>');
                    },
                    get value() { return value; },
                };
            },
        },
        history: {},
        // Encrypted backups are built on Web Crypto; Node exposes the same API, so the
        // envelope is produced and opened by the real primitives rather than a stand-in.
        crypto: globalThis.crypto,
        TextEncoder,
        TextDecoder,
        Uint8Array,
        btoa: value => Buffer.from(String(value), 'binary').toString('base64'),
        atob: value => Buffer.from(String(value), 'base64').toString('binary'),
        MutationObserver: class {
            constructor(callback) { this.callback = callback; }
            observe() {}
            disconnect() {}
        },
        CustomEvent: class {
            constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
        },
        GM_getValue: (key, fallback) => sandboxValues.has(key) ? sandboxValues.get(key) : fallback,
        GM_setValue: (key, value) => {
            sandboxWriteCount += 1;
            if (sandboxFailAllWrites) throw new Error('simulated storage quota exceeded');
            if (sandboxWriteCount === sandboxFailWriteAt) throw new Error('simulated settings write failure');
            sandboxValues.set(key, value);
        },
        GM_addStyle: () => {},
        GM_setClipboard: () => {
            if (sandboxClipboardFailure) throw new Error('simulated clipboard failure');
        },
        GM_xmlhttpRequest: options => {
            sandboxRequests.push(options);
            return { abort: () => { sandboxAbortedRequestCount += 1; } };
        },
        GM_listValues: () => [...sandboxValues.keys()],
        GM_webRequest: rules => { sandbox.webRequestRules = rules; },
    };
    /* Not every manager exposes GM_deleteValue, and the userscript guards each call for
       that reason. Omitting it here lets those guards be exercised rather than assumed. */
    if (!withoutDeleteValue) sandbox.GM_deleteValue = key => { sandboxValues.delete(key); };
    /* The two things that together make a context an untrusted extension one: chrome with
       a runtime id, which is what IS_EXTENSION_BUILD tests, and the bridge's boolean-only
       answer standing in for every credential read. GM_getValue withholds the value the
       same way the real mirror does, so nothing here can cheat by reading around it. */
    if (withheldCredentials) {
        const credentialKeys = new Set([...(script.match(/const CREDENTIAL_SETTING_KEYS = new Set\(\[([\s\S]*?)\]\);/) || [])[1]
            .matchAll(/'([^']+)'/g)].map(match => `imdb_enh_${match[1]}`));
        const readValue = sandbox.GM_getValue;
        sandbox.GM_getValue = (key, fallback) => (credentialKeys.has(key) ? fallback : readValue(key, fallback));
        sandbox.chrome = { runtime: { id: 'test-extension-id' } };
        sandbox.__imdbEnhancedCredentialConfigured = key =>
            typeof sandboxValues.get(key) === 'string' && sandboxValues.get(key).trim() !== '';
    }
    vm.runInNewContext(instrumented, sandbox, { filename: scriptPath });
    sandbox.window.__enhTest.getCapturedWebRequestRules = () => sandbox.webRequestRules || [];
    sandbox.window.__enhTest.getAbortedRequestCount = () => sandboxAbortedRequestCount;
    sandbox.window.__enhTest.setReducedMotion = value => { prefersReducedMotion = Boolean(value); };
    sandbox.window.__enhTest.seedStoredSetting = (key, value) => sandboxValues.set(`imdb_enh_${key}`, value);
    sandbox.window.__enhTest.seedRawStorage = (key, value) => sandboxValues.set(key, value);
    sandbox.window.__enhTest.getStoredSetting = key => sandboxValues.get(`imdb_enh_${key}`);
    sandbox.window.__enhTest.failSettingWriteAt = offset => { sandboxFailWriteAt = sandboxWriteCount + offset; };
    // A quota that stays full: every write throws until it is turned back off. The
    // offset form above cannot express this, and a cache retry would sail past it.
    sandbox.window.__enhTest.failAllSettingWrites = value => { sandboxFailAllWrites = Boolean(value); };
    sandbox.window.__enhTest.setClipboardFailure = value => { sandboxClipboardFailure = Boolean(value); };
    sandbox.window.__enhTest.getStorageKeys = () => [...sandboxValues.keys()];
    sandbox.window.__enhTest.getRawStorage = key => sandboxValues.get(key);
    sandbox.window.__enhTest.getDispatchedEvents = () => [...sandboxDispatchedEvents];
    sandbox.window.__enhTest.getToasts = () => [...sandboxToasts];
    // The MV3 bridge reports a rejected write through this event, naming the key. The
    // sandbox is a synchronous manager, so this is how that path gets exercised.
    sandbox.window.__enhTest.dispatchStorageFailure = key => {
        sandboxDocumentListeners
            .filter(entry => entry.type === 'imdb-enhanced:settings-save-failed')
            .forEach(entry => entry.listener({ type:entry.type, detail:{ key } }));
    };
    sandbox.window.__enhTest.getCapturedRequests = () => [...sandboxRequests];
    sandbox.window.__enhTest.setTestHostname = hostname => { location.hostname = hostname; };
    /* Builds a minimal hero subtree so control-resolution can be exercised for real
       rather than asserted against the source text. Each node carries the attributes
       findNativeTitleAction actually reads, and matching is limited to the selector
       shapes the userscript uses. */
    sandbox.window.__enhTest.setHeroFixture = nodes => {
        const elements = (nodes || []).map(node => ({
            id: node.id || '',
            attrs: { 'data-testid': node.testid || null, 'aria-label': node.ariaLabel || null, title: node.title || null },
            textContent: node.text || '',
            getAttribute(name) { return this.attrs[name] ?? null; },
            closest: () => null,
            matches(selector) {
                const exact = selector.match(/^\[data-testid="([^"]+)"\]$/);
                if (exact) return this.attrs['data-testid'] === exact[1];
                const prefix = selector.match(/^\[data-testid\^="([^"]+)"\]$/);
                if (prefix) return String(this.attrs['data-testid'] || '').startsWith(prefix[1]);
                return false;
            },
        }));
        const hero = {
            querySelector: selector => elements.find(el => el.matches(selector)) || null,
            querySelectorAll: () => elements,
        };
        sandbox.document.querySelector = selector =>
            (selector === 'section[data-testid="hero-parent"]' ? hero : null);
        sandbox.document.querySelectorAll = () => elements;
    };
    sandbox.window.__enhTest.clearHeroFixture = () => {
        sandbox.document.querySelector = () => null;
        sandbox.document.querySelectorAll = () => [];
    };
    sandbox.window.__enhTest.getMediaListenerCount = () => sandboxMediaListenerCount;
    return sandbox.window.__enhTest;
}

test('userscript parses', () => {
    execFileSync(process.execPath, ['--check', scriptPath], { stdio: 'pipe' });
});

test('metadata stays distribution-safe', () => {
    assert(!/@connect\s+\*/.test(script), 'wildcard @connect should not return');
    assert(!/@grant\s+GM_addStyle/.test(script), 'unused style-injection permission should stay removed');
    assert(/@noframes/.test(script), '@noframes should remain present');
    assert(!/@match\s+https:\/\/m\.imdb\.com\//.test(script), 'desktop-only userscript must not match mobile IMDb');
    assert(/@updateURL/.test(script), '@updateURL should be present for update channel');
    assert(/@downloadURL/.test(script), '@downloadURL should be present for update channel');
    [
        'https://www.imdb.com/*/user/*/watchlist*',
        'https://www.imdb.com/*/list/*',
        'https://www.imdb.com/*/chart/*',
    ].forEach(pattern => assert(script.includes(`@match        ${pattern}`), `localized collection match missing: ${pattern}`));
    const hooks = loadScriptTestHooks();
    assert(hooks.isIMDbHost('www.imdb.com'));
    assert(!hooks.isIMDbHost('not-imdb.com'), 'IMDb host checks must not use substring trust');
});

test('IMDb theme work stays off foreign hosts', () => {
    const hooks = loadScriptTestHooks();
    hooks.setTestHostname('not-imdb.example');
    hooks.setupThemeAutoSync();
    assert.strictEqual(hooks.getMediaListenerCount(), 0, 'a non-IMDb host must not retain an IMDb theme listener');
    hooks.setTestHostname('www.imdb.com');
    hooks.setupThemeAutoSync();
    hooks.setupThemeAutoSync();
    assert.strictEqual(hooks.getMediaListenerCount(), 1, 'IMDb should install exactly one system-theme listener');
    assert(
        /function applyThemeStyles\(options = \{\}\) \{\s*if \(!isIMDbHost\(\)\) return;/.test(script),
        'theme repainting must reject non-IMDb hosts'
    );
});

/* IMDb machine-translates page copy, so an English label match finds nothing for those
   users. Verified live 2026-08-15: on /hi/title/tt0903747/ the watchlist button renders
   "वॉचलिस्ट में जोड़ें" and the previous text-only lookup returned null, which stranded the
   editorial layout (default on) with no way to add a title to a watchlist. */
test('native title controls resolve by test id rather than English label text', () => {
    const hooks = loadScriptTestHooks();
    const patterns = ['watchlist', 'watch list', 'add to watch'];

    hooks.setHeroFixture([
        { testid: 'tm-box-wl-button', text: 'वॉचलिस्ट में जोड़ें40.9 लाख यूज़र द्वारा जोड़े गए' },
    ]);
    const localized = hooks.findNativeTitleAction(patterns, hooks.NATIVE_WATCHLIST_SELECTORS);
    assert(localized, 'a translated watchlist control must still be found');
    assert.strictEqual(localized.getAttribute('data-testid'), 'tm-box-wl-button');

    // The same lookup without the selector list is exactly the old behaviour.
    assert.strictEqual(
        hooks.findNativeTitleAction(patterns),
        null,
        'the fixture must genuinely defeat text matching, or this test proves nothing'
    );

    hooks.setHeroFixture([
        { testid: 'poster-watchlist-ribbon-add', ariaLabel: 'Zur Watchlist hinzufügen' },
    ]);
    assert.strictEqual(
        hooks.findNativeTitleAction(patterns, hooks.NATIVE_WATCHLIST_SELECTORS)?.getAttribute('data-testid'),
        'poster-watchlist-ribbon-add',
        'the poster ribbon is the fallback when the hero button is absent'
    );

    // Test ids win over an earlier decoy, and enhancement-owned nodes stay excluded.
    hooks.setHeroFixture([
        { id: 'enh-decoy', testid: 'tm-box-wl-button', text: 'Add to watchlist' },
        { testid: 'poster-watchlist-ribbon-add', ariaLabel: 'Add to Watchlist' },
    ]);
    const skipped = hooks.findNativeTitleAction(patterns, hooks.NATIVE_WATCHLIST_SELECTORS);
    assert.strictEqual(skipped.getAttribute('data-testid'), 'poster-watchlist-ribbon-add',
        'controls this script injected must never be treated as IMDb’s own');

    hooks.clearHeroFixture();
    assert.strictEqual(
        hooks.findNativeTitleAction(patterns, hooks.NATIVE_WATCHLIST_SELECTORS),
        null,
        'an absent control must resolve to null rather than throwing'
    );

    // A prefix match would also catch poster-watchlist-ribbon-added, whose click removes.
    assert.deepStrictEqual(
        Array.from(hooks.NATIVE_WATCHLIST_SELECTORS),
        ['[data-testid="tm-box-wl-button"]', '[data-testid="poster-watchlist-ribbon-add"]'],
        'the ribbon must be matched in its add state so a click cannot remove the title'
    );
});

/* A feature whose selectors stopped matching used to fail to the console only, so the
   user saw a missing feature and had nothing to report with. */
test('feature failures are retained and reportable without leaking secrets', () => {
    const hooks = loadScriptTestHooks();
    assert.deepStrictEqual(Array.from(hooks.getFeatureFailures()), [], 'no failures before anything runs');

    const broken = { key:'streamAvailability', name:'Streaming availability', init(){ throw new Error('hero-parent selector matched nothing'); } };
    assert.strictEqual(hooks.startFeature(broken, { context:'route' }), false);
    const failures = Array.from(hooks.getFeatureFailures());
    assert.strictEqual(failures.length, 1, 'a route-time failure must be retained, not only logged');
    assert.strictEqual(failures[0].key, 'streamAvailability');
    assert.strictEqual(failures[0].context, 'route');
    assert(failures[0].message.includes('selector matched nothing'), 'the cause must survive into the report');

    hooks.seedStoredSetting('radarrApiKey', 'SUPER-SECRET-RADARR-KEY');
    hooks.seedStoredSetting('plexToken', 'SUPER-SECRET-PLEX-TOKEN');
    hooks.seedStoredSetting('userMarks', { tt0903747:{ state:'watched', title:'Breaking Bad', ts:1 } });
    const report = hooks.buildDiagnosticsReport();

    assert(report.includes('IMDb Enhanced diagnostics'), 'the report should say what it is');
    assert(report.includes('route streamAvailability: hero-parent selector matched nothing'),
        'the failure belongs in the report');
    assert(/Radarr: configured/.test(report), 'configured integrations are reported as booleans');
    assert(/Plex: configured/.test(report), 'configured integrations are reported as booleans');
    assert(!report.includes('SUPER-SECRET-RADARR-KEY'), 'credentials must never reach the clipboard');
    assert(!report.includes('SUPER-SECRET-PLEX-TOKEN'), 'credentials must never reach the clipboard');
    assert(!report.includes('Breaking Bad'), 'marked titles are private and must not be reported');
    assert(report.includes('marks stored: 1'), 'a count is the useful, non-identifying form');
    /* cacheCount() used to live inside the settings-panel closure, so calling it from
       module scope threw a ReferenceError that the report swallowed as "unavailable". */
    assert(/cache entries: \d+/.test(report), 'the cache count must resolve, not report unavailable');
    assert(!/\?/.test(report.split('\n').find(line => line.startsWith('page:')) || ''),
        'the page line must carry no query string');
});

/* IMDb renders the whole-series grid itself on /ratings/ but leaves every cell the
   same colour. Ratings are read from the link text because IMDb translates the
   aria-label — the same trap that broke the watchlist lookup. */
test('the episode heatmap reads ratings from link text and scopes to the ratings route', () => {
    const hooks = loadScriptTestHooks();

    hooks.setTestPath('/title/tt0903747/ratings/');
    assert.strictEqual(hooks.getPageSurface(), 'ratings');
    assert(hooks.shouldInitFeature({ key:'episodeHeatmap', group:'TV' }), 'the heatmap belongs on the ratings route');
    assert(hooks.shouldInitFeature({ key:'modernUI', group:'Appearance' }), 'themes must still apply there');
    hooks.setTestPath('/hi/title/tt0903747/ratings/');
    assert.strictEqual(hooks.getPageSurface(), 'ratings', 'localized ratings routes must classify the same');
    hooks.setTestPath('/title/tt0903747/');
    assert(!hooks.shouldInitFeature({ key:'episodeHeatmap', group:'TV' }), 'the grid only exists on the ratings route');

    // Live cell shape: td > div > a, rating in the link text, translated aria-label.
    const cell = (text, label) => ({
        querySelector: () => ({ textContent: text }),
        _label: label,
    });
    const table = {
        querySelectorAll: () => [
            { querySelectorAll: () => [cell('9.0', 'सीज़न 1 एपिसोड 1, रेटिंग 9.0'), cell('8.6'), cell('')] },
            { querySelectorAll: () => [cell('7.9'), cell('5.1')] },
        ],
    };
    const seasons = Array.from(hooks.readHeatmapSeasons(table)).map(s => Array.from(s).map(e => e.rating));
    assert.deepStrictEqual(seasons, [[9, 8.6], [7.9, 5.1]], 'unrated cells are skipped, translated labels ignored');
    assert.strictEqual(hooks.summarizeHeatmapSeason([{ rating:9 }, { rating:8 }]), 8.5);
    assert.strictEqual(hooks.summarizeHeatmapSeason([]), null);
});

/* The cache has been versioned since v2.6; settings were not, so a future change to a
   stored value's shape would be coerced back to its default with no record. */
test('settings carry a schema version that gates migration and import', () => {
    const hooks = loadScriptTestHooks();

    assert.strictEqual(hooks.runSettingsMigrations(), hooks.SETTINGS_SCHEMA_VERSION);
    assert.strictEqual(hooks.getStoredSetting('settingsSchemaVersion'), hooks.SETTINGS_SCHEMA_VERSION,
        'the version must be recorded so a later build can detect the shape it is reading');

    const backup = hooks.getExportSettings();
    assert.strictEqual(backup.settingsSchemaVersion, hooks.SETTINGS_SCHEMA_VERSION,
        'a backup must state the schema it was written against');

    // A backup this build cannot understand is refused, not silently coerced.
    assert.throws(
        () => hooks.prepareSettingsImport({ ...backup, settingsSchemaVersion: hooks.SETTINGS_SCHEMA_VERSION + 5 }),
        /newer version/i,
        'a newer backup must be refused rather than partially applied');

    /* First real use of the hook: a retired feature's preference is deleted rather
       than orphaned in storage, where export would carry it forever. */
    const upgrading = loadScriptTestHooks();
    upgrading.seedRawStorage('imdb_enh_ratingHistogram', true);
    upgrading.seedStoredSetting('settingsSchemaVersion', 1);
    upgrading.runSettingsMigrations();
    assert.strictEqual(upgrading.getStoredSetting('settingsSchemaVersion'), upgrading.SETTINGS_SCHEMA_VERSION,
        'a pending migration advances the stored version');
    assert(!upgrading.getStorageKeys().includes('imdb_enh_ratingHistogram'),
        'the retired preference must be removed by the migration');

    // Its own export still round-trips, and the marker is not treated as a setting.
    const prepared = hooks.prepareSettingsImport(backup);
    assert.strictEqual(prepared.ignored, 0, 'the schema marker must not count as an unrecognized field');
});

/* Forced colours drop box-shadow outright, so a ring drawn as a shadow vanishes; the
   product also ships a high-contrast theme, which made the absence of any forced-colors
   handling the larger gap. */
test('themes honour forced colours and a request for more contrast', () => {
    const globalStyles = script.slice(script.indexOf('FOCUS STATES (accessibility)'));
    const forced = globalStyles.slice(globalStyles.indexOf('@media (forced-colors: active)'));
    assert(forced.indexOf('outline: 3px solid Highlight') < forced.indexOf('@media (prefers-contrast'),
        'forced colours must restore a focus ring in a system colour');
    assert(/box-shadow: none !important/.test(forced.slice(0, forced.indexOf('@media (prefers-contrast'))),
        'shadow-based decoration must not be relied on under forced colours');
    assert(/ButtonText !important/.test(forced.slice(0, forced.indexOf('@media (prefers-contrast'))),
        'rating and heatmap colours must stay legible against a substituted palette');
    const contrast = globalStyles.slice(globalStyles.indexOf('@media (prefers-contrast: more)'));
    assert(/backdrop-filter: none !important/.test(contrast.slice(0, 400)),
        'a request for more contrast must drop the glass surfaces');
});

/* Score widgets resolve after the page settles and are rebuilt in place. A live region
   only speaks if it already existed when its text changed — the same rule that made the
   toast announcer persistent — so it must be installed at init, not on first result. */
test('score results are announced through a region that exists before any result', () => {
    const initSource = script.slice(script.indexOf('function init()'));
    const body = initSource.slice(0, initSource.indexOf('installSPARouter'));
    assert(body.includes('ensureScoreAnnouncer()'),
        'the score region must be installed during init, not created on first announcement');
    assert(script.includes("id:'enh-score-announcer', role:'status', 'aria-live':'polite', 'aria-atomic':'true'"),
        'the region must be a polite atomic status');
    assert(/#enh-toast-announcer, #enh-score-announcer \{/.test(script),
        'the region must use the visually-hidden rule that avoids the negative-margin guard');
    ['Rotten Tomatoes', 'Letterboxd', 'Metascore'].forEach(source => {
        assert(script.includes(`announceScore('${source}'`), `${source} results must be announced`);
    });
    assert.strictEqual((script.match(/'aria-busy':'true'/g) || []).length, 4,
        'every loading score widget must report itself busy');
});

/* The zero-dependency, no-telemetry posture is a real differentiator after the 2025-26
   extension-compromise wave, and it was documented nowhere. */
test('README states the trust posture the build actually has', () => {
    assert(/No telemetry, ever/.test(readme), 'the absence of telemetry must be stated, not implied');
    assert(/No runtime dependencies/.test(readme), 'the zero-dependency posture must be stated');
    assert(/No remote code/.test(readme), 'the absence of remote code must be stated');
    assert(/Verifying a build/.test(readme), 'readers need a way to check a build against its tag');
    // The claims have to stay true: a dependency block would silently falsify them.
    assert(!packageJson.dependencies, 'README claims zero runtime dependencies');
    assert(!packageJson.devDependencies, 'README claims the build uses only the Node standard library');
});

/* An unpacked extension can never update itself and Chrome only permits off-store
   hosting on Linux, so noticing and saying so is the only available mitigation. */
test('the update notice is extension-only, dismissible, and validates what it renders', () => {
    const hooks = loadScriptTestHooks();
    // The userscript build updates through its manager and must never run this.
    hooks.seedRawStorage('imdb_enh_updateState', { available:true, latest:'2.99.0' });
    assert.strictEqual(hooks.getUpdateNotice(), null, 'the userscript build must not show an update notice');

    assert.strictEqual((script.match(/id:'enh-update-notice'/g) || []).length, 1,
        'the notice element id must be unique — the settings toggle must not reuse it');
    assert(script.includes("id:'enh-update-notice-toggle'"), 'the settings control needs its own id');
    assert(/if \(IS_EXTENSION_BUILD\) \{[\s\S]{0,400}?Tell me about new versions/.test(script),
        'the control belongs only in the build that can be stale');
    // A version string is interpolated into the page, so it is validated on read.
    assert(/\^\[0-9\]\+\(\?:\\.\[0-9\]\+\)\{0,3\}\$/.test(script),
        'the reported version must be shape-checked before it reaches the DOM');
});

/* IMDb publishes the unweighted mean only on /ratings/; the gap against the weighted
   figure it displays is the clearest public signal of vote brigading. It is computable
   from the buckets the histogram already draws — no request, no new selector, and no
   dependence on the translated "Unweighted mean" label. */
/* IMDb's ratings payload is ~736 KB and histogramData sits deeper than the graph
   walk's node budget, so the distribution read as absent on the one route that still
   publishes it. Verified live 2026-08-15. */
test('the rating distribution is sliced out of an oversized application-data blob', () => {
    const hooks = loadScriptTestHooks();
    const values = Array.from({ length:10 }, (_, i) => `{"formattedVoteCount":"1K","voteCount":${(i + 1) * 10},"rating":${i + 1}}`).join(',');
    const blob = `{"deep":{"pad":"${'x'.repeat(50000)}","histogramData":{"titleId":"tt0133093","histogramValues":[${values}]}}}`;

    const parsed = Array.from(hooks.extractHistogramValues(blob) || []);
    assert.strictEqual(parsed.length, 10, 'all ten buckets should survive the slice');
    assert.strictEqual(parsed[9].rating, 10);
    assert.strictEqual(parsed[9].voteCount, 100);

    assert.strictEqual(hooks.extractHistogramValues('{"nothing":1}'), null, 'an absent key yields nothing');
    assert.strictEqual(hooks.extractHistogramValues('{"histogramValues":[{"rating":1}'), null,
        'an unterminated array must not hang or throw');
    // The ceiling rejects a pathological array rather than scanning the whole document.
    assert.strictEqual(hooks.extractHistogramValues(`{"histogramValues":[${'0,'.repeat(30000)}0]}`), null,
        'an oversized array is refused, not parsed');
});

test('the unweighted mean is derived from histogram buckets', () => {
    const hooks = loadScriptTestHooks();
    const buckets = (counts) => counts.map((voteCount, i) => ({ rating: i + 1, voteCount }));

    // Reproduces IMDb's own published figure for tt0903747 (9.2 unweighted, 9.5 shown).
    const breakingBad = buckets([0, 0, 0, 0, 0, 0, 8300, 6800, 12000, 81000]);
    const mean = hooks.computeUnweightedMean(breakingBad);
    assert(mean >= 9.4 && mean <= 10, `skewed 10-heavy distribution should read high, got ${mean}`);

    assert.strictEqual(hooks.computeUnweightedMean(buckets([10, 0, 0, 0, 0, 0, 0, 0, 0, 10])), 5.5,
        'a symmetric 1/10 split averages 5.5');
    assert.strictEqual(hooks.computeUnweightedMean([]), null, 'no buckets means no answer');
    assert.strictEqual(hooks.computeUnweightedMean(null), null);
    assert.strictEqual(hooks.computeUnweightedMean([{ rating:5, voteCount:0 }]), null,
        'zero total votes must not divide by zero');
    // Malformed or out-of-range buckets are skipped rather than poisoning the mean.
    assert.strictEqual(
        hooks.computeUnweightedMean([{ rating:10, voteCount:1 }, { rating:99, voteCount:1000 }, { rating:'x', voteCount:5 }]),
        10,
        'ratings outside 1-10 and non-numeric counts are ignored');

    assert(/sits 0\.3 above it/.test(hooks.describeRatingGap(8.4, 8.7)), 'a positive gap reads as weighting above the raw mean');
    /* Verified live 2026-08-15: title pages no longer carry histogram data at all
       (the only script containing histogramData was the injected userscript itself),
       so the comparison belongs on the ratings route where IMDb still publishes it. */
    hooks.setTestPath('/title/tt0133093/ratings/');
    assert(hooks.shouldInitFeature({ key:'ratingGap', group:'Scores' }), 'the gap belongs on the ratings route');
    hooks.setTestPath('/title/tt0133093/');
    assert(!hooks.shouldInitFeature({ key:'ratingGap', group:'Scores' }), 'title pages carry no distribution to compare');
    /* The standalone chart is retired: IMDb stopped publishing the distribution on
       title pages, and draws its own chart where the data moved. */
    assert(!/key: 'ratingHistogram'/.test(script), 'the retired widget must no longer be registered');
    // Deletes go through dropStoredKey, which guards for managers lacking GM_deleteValue.
    assert(/to: 2,\s*run\(\) \{ dropStoredKey\(`\$\{PREFIX\}ratingHistogram`\); \}/.test(script),
        'its stored preference must be migrated away, not orphaned');
    assert(/sits 0\.5 below it/.test(hooks.describeRatingGap(9.0, 8.5)), 'a negative gap reads as weighting below');
    assert(/same as the displayed rating/.test(hooks.describeRatingGap(8.0, 8.0)), 'no gap says so plainly');
    assert.strictEqual(hooks.describeRatingGap(null, 8.7), null, 'no unweighted mean means no claim');
});

/* The certification chip beside the title is already read from the parents-guide
   link (IMDb_Enhanced.user.js reads it from the hero); this exposes the page behind it. */
test('the title surface links to first-party subpages including the parents guide', () => {
    ['fullcredits', 'reviews', 'trivia', 'parentalguide'].forEach(route => {
        assert(script.includes(`/title/\${imdbId}/${route}/`), `${route} should be reachable from the title surface`);
    });
    assert(script.includes("['Parents guide', `/title/${imdbId}/parentalguide/`]"),
        'the parents guide needs a readable label, not a bare route');
});

test('IMDb title data selection ignores unrelated or malformed structured data', () => {
    const hooks = loadScriptTestHooks();
    const selected = hooks.parseIMDbTitleStructuredData([
        '{malformed',
        JSON.stringify({ '@type':'BreadcrumbList', name:'Breadcrumbs' }),
        JSON.stringify({ '@graph':[
            { '@type':'Organization', name:'IMDb' },
            { '@type':'TVMiniSeries', name:'Chernobyl', datePublished:'2019-05-06', aggregateRating:{ ratingValue:9.3 } },
        ] }),
    ]);
    assert.strictEqual(selected.name, 'Chernobyl');
    assert.strictEqual(selected['@type'], 'TVMiniSeries');
    const oversizedGraph = Array.from({ length:1200 }, (_, index) => ({ '@type':'Thing', name:`Noise ${index}` }));
    oversizedGraph.push({ '@type':'Movie', name:'Outside the scan budget', datePublished:'2026-01-01' });
    assert.deepStrictEqual(
        Object.keys(hooks.parseIMDbTitleStructuredData([JSON.stringify({ '@graph':oversizedGraph })])),
        [],
        'structured-data traversal must not keep expanding past its node budget'
    );
    const releaseEvents = Array.from({ length:51 }, () => ({}));
    releaseEvents[49] = { startDate:'1999-03-31' };
    releaseEvents[50] = { startDate:'2001-01-01' };
    assert.strictEqual(hooks.getStructuredTitleYear({ releasedEvent:releaseEvents }), '1999');
    releaseEvents[49] = {};
    assert.strictEqual(
        hooks.getStructuredTitleYear({ releasedEvent:releaseEvents }),
        '',
        'title-year extraction must not traverse release-event arrays past its finite budget'
    );
    assert(script.includes('inspectedInlines >= TITLE_YEAR_INLINE_LIMIT'), 'inline title-year fallbacks should have a finite scan budget');
    const oversizedTypes = Array(21).fill('Thing');
    oversizedTypes[20] = 'Movie';
    assert.deepStrictEqual(
        Object.keys(hooks.parseIMDbTitleStructuredData([JSON.stringify({ '@type':oversizedTypes })])),
        [],
        'title selection must not scan unbounded type arrays'
    );
    const keywords = Array(51).fill('ongoing');
    keywords[49] = 'mini-series';
    keywords[50] = 'mini-series outside budget';
    assert.strictEqual(hooks.getStructuredMediaType({ '@type':'TVSeries', keywords }), 'miniseries');
    keywords[49] = 'ongoing';
    assert.strictEqual(hooks.getStructuredMediaType({ '@type':'TVSeries', keywords }), 'series', 'series classification should bound keyword arrays');
    const genres = Array(51).fill('Drama');
    genres[49] = 'Short';
    genres[50] = 'Short Film';
    assert.strictEqual(hooks.getStructuredMediaType({ '@type':'Movie', genre:genres }), 'short');
    genres[49] = 'Drama';
    assert.strictEqual(hooks.getStructuredMediaType({ '@type':'Movie', genre:genres }), 'movie', 'movie classification should bound genre arrays');
    assert(script.includes('if (Object.keys(selected).length) _ldData = selected'), 'an early empty scan must not prevent a later structured-data retry');
});

test('rating histogram extraction is bounded and normalizes a 1-10 distribution', () => {
    const hooks = loadScriptTestHooks();
    const raw = Array.from({ length:10 }, (_, index) => ({
        rating:String(index + 1),
        count:String((index + 1) * 100),
    }));
    raw.push({ rating:11, count:999999 }, { rating:5, count:-1 }, { rating:'bad', count:100 });
    const histogram = hooks.findHistogramData({ props:{ pageProps:{ ratingsSummary:{ histogramData:raw } } } });
    assert.strictEqual(histogram.length, 10);
    assert.strictEqual(histogram[0].rating, 1);
    assert.strictEqual(histogram[0].voteCount, 100);
    assert.strictEqual(histogram[9].voteCount, 1000);
    assert.strictEqual(hooks.findHistogramData({ histogramData:[{ rating:1, count:10 }] }), null, 'one malformed bucket must not become a chart');
    const payload = JSON.stringify({ ratingsSummary:{ histogramData:raw } });
    assert.strictEqual(
        hooks.parseHistogramScriptTexts(['x'.repeat(2 * 1024 * 1024 + 1), payload])?.length,
        10,
        'an oversized inline script should be skipped without hiding a later bounded histogram'
    );
    assert.strictEqual(
        hooks.parseHistogramScriptTexts(Array(50).fill('{}').concat(payload)),
        null,
        'histogram discovery should not inspect scripts beyond its finite budget'
    );
    assert(/function findHistogramData[\s\S]*?appendBoundedObjectChildren\(queue, node, maxNodes\)/.test(script), 'histogram traversal must not materialize every child before slicing');
    /* The standalone chart is retired; the distribution now reaches users as the
       weighted-vs-unweighted comparison, which must still carry its own meaning. */
    assert(script.includes("makeEl('div', { id:'enh-rating-gap', role:'note' }"),
        'the rating comparison should expose itself as a note to assistive technology');
});

test('fragile selectors stay removed', () => {
    assert(!/\.sc-|sc-[0-9a-fA-F]+|sc-[a-z0-9]+/.test(script), 'hashed styled-components selectors should stay removed');
    assert(!/\.bRimta\b/.test(script), 'observed generated IMDb class selectors should stay removed');
    assert(!/margin[^;]*-[0-9]+px/.test(script), 'layout styling should not pull poster content over adjacent rows');
    assert(!/GM_setValue\('movieTitle'/.test(script), 'the retired global movieTitle key must never be written again');
});

test('ad cleanup preserves core media and covers current IMDb shells', () => {
    /* The intent is that IMDb's own player is never classified as advertising. Scope
       the check to the ad selector list rather than the whole file, so legitimate uses
       — the editorial surface re-homes the player instead of losing it — still pass. */
    const adSelector = script.slice(script.indexOf('const AD_SHELL_SELECTOR'), script.indexOf('const AD_REQUEST_RULES'));
    assert(!adSelector.includes('inline-video-playback-container'), 'native IMDb video must never be treated as an ad');
    assert(!/removeAds[\s\S]{0,600}?inline-video-playback-container/.test(script), 'ad cleanup must not target the native player');
    [
        'AD_SHELL_SELECTOR',
        'Bottom Sponsored Advertisement',
        'sis_pixel_sitewide',
        'cookie_sync_pixel_sitewide',
        'promoted-partner-bar',
        'enh-early-ad-shell',
        'AD_REQUEST_RULES',
        'GM_webRequest',
        'advertising.amazon.dev',
        'scorecardresearch.com',
    ].forEach(token => assert(script.includes(token), `${token} missing from ad-shell cleanup`));
    assert(script.indexOf('injectEarlyAdShell();') < script.indexOf("key: 'removeAds'"), 'ad shell should be injected before normal feature initialization');
    assert(script.includes('const pendingStyles = new Map()'), 'document-start style attachment guard missing');
    assert(
        /key: 'removeAds'[\s\S]*?destroy\(\) \{\s*if \(get\('removeAds'\)\) return;/.test(script),
        'SPA route teardown must not unregister an enabled request blocker or remove its early shell'
    );

    const hooks = loadScriptTestHooks();
    assert(hooks.setAdRequestBlocking(true), 'supported managers should register request rules');
    const rules = hooks.getCapturedWebRequestRules();
    assert.strictEqual(rules.length, 1, 'request blocking should register one scoped rule group');
    const includes = Array.from(rules[0].selector.include);
    assert(includes.some(pattern => pattern.includes('amazon-adsystem.com')), 'Amazon ad-system request rule missing');
    assert(includes.some(pattern => pattern.includes('scorecardresearch.com')), 'Comscore request rule missing');
    assert(hooks.setAdRequestBlocking(false), 'request rules should unregister when cleanup is disabled');
    assert.strictEqual(hooks.getCapturedWebRequestRules().length, 0, 'request rules should be cleared');
});

test('appearance styling preserves IMDb account and footer controls', () => {
    assert(!/footer\.imdb-footer\s*\{\s*display:\s*none/i.test(script), 'modern styling must not hide IMDb legal/footer navigation');
    assert(!/div\.nav__userMenu\s*\{\s*display:\s*none/i.test(script), 'modern styling must not hide the sign-in/account menu');
    assert(!/FavoritePeopleCTA[^\n]+display:\s*none/i.test(script), 'modern styling must not hide favorite-person controls');
    assert(!/tm-box-addtolist-button[^\n]+display:\s*none/i.test(script), 'IMDb list/watchlist controls must not be classified as IMDbPro upsells');
    assert(!/#announcement-text[^\n]+display:\s*none/i.test(script), 'IMDb search suggestion announcements must remain available to assistive technology');
});

test('feature activation is scoped to the current IMDb surface', () => {
    const hooks = loadScriptTestHooks();

    hooks.setTestPath('/name/nm0000206/');
    assert.strictEqual(hooks.getPageSurface(), 'name');
    assert(hooks.shouldInitFeature({ key:'removeAds', group:'Cleanup' }), 'cleanup should run on name pages');
    assert(!hooks.shouldInitFeature({ key:'searchButtons', group:'Features' }), 'title watch buttons should not run on name pages');

    hooks.setTestPath('/chart/top/');
    assert.strictEqual(hooks.getPageSurface(), 'collection');
    assert(hooks.shouldInitFeature({ key:'removeAds', group:'Cleanup' }), 'cleanup should run on collection pages');
    assert(hooks.shouldInitFeature({ key:'listMultiSearch', group:'Utility' }), 'list tools should run on collection pages');
    assert(!hooks.shouldInitFeature({ key:'trailerPopover', group:'Features' }), 'title trailer tools should not run on collection pages');

    hooks.setTestPath('/title/tt0903747/episodes/');
    assert.strictEqual(hooks.getPageSurface(), 'episodes');
    assert(hooks.shouldInitFeature({ key:'tvEpisodeTools', group:'TV' }), 'episode tools should run on episode lists');
    assert(!hooks.shouldInitFeature({ key:'searchButtons', group:'Features' }), 'series watch buttons should not attach to episode-list headings');

    hooks.setTestPath('/title/tt0133093/');
    assert.strictEqual(hooks.getPageSurface(), 'title');
    assert(hooks.shouldInitFeature({ key:'searchButtons', group:'Features' }), 'title tools should run on title pages');

    hooks.setTestPath('/de/title/tt0133093/');
    assert.strictEqual(hooks.getPageSurface(), 'title', 'localized title routes should retain title features');

    hooks.setTestPath('/fr/name/nm0000206/');
    assert.strictEqual(hooks.getPageSurface(), 'name', 'localized name routes should retain secondary-page scoping');
});

test('private marks decorate title cards on every card-bearing surface', () => {
    const hooks = loadScriptTestHooks();
    const marks = { key:'watchedMarking', group:'Features' };

    [
        ['/chart/top/', 'charts'],
        ['/list/ls048549284/', 'custom lists'],
        ['/user/ur47264037/watchlist/', 'watchlists'],
        ['/name/nm0000206/', 'person filmographies'],
        ['/title/tt0903747/episodes/', 'episode lists'],
        ['/title/tt0133093/', 'title pages'],
    ].forEach(([path, label]) => {
        hooks.setTestPath(path);
        assert(hooks.shouldInitFeature(marks), `private marks should run on ${label}`);
    });
});

test('a living person shows a current age computed from page data alone', () => {
    const hooks = loadScriptTestHooks();
    const at = iso => new Date(iso + 'T12:00:00Z');

    assert.strictEqual(hooks.computeCurrentAge('1964-09-02', at('2026-08-14')), 61, 'a birthday already passed this year counts');
    assert.strictEqual(hooks.computeCurrentAge('1964-12-25', at('2026-08-14')), 61, 'a birthday still ahead this year is not counted yet');
    assert.strictEqual(hooks.computeCurrentAge('1964-08-14', at('2026-08-14')), 62, 'the birthday itself counts');
    assert.strictEqual(hooks.computeCurrentAge('1889-04-16', at('2026-08-14')), null, 'ages beyond a plausible lifespan are rejected');
    assert.strictEqual(hooks.computeCurrentAge('not-a-date'), null);
    assert.strictEqual(hooks.computeCurrentAge('1964-02-31', at('2026-08-14')), null, 'impossible calendar dates are rejected');
    assert.strictEqual(hooks.computeCurrentAge(''), null);

    // The feature reads the page it is already on; it must never fan out per person.
    assert(/key: 'castAges'[\s\S]*?getPageSurface\(\) !== 'name'/.test(script), 'person ages belong to person pages');
    assert(!/key: 'castAges'[\s\S]{0,1200}httpGet\(/.test(script), 'person ages must not issue network requests');
    assert(/if \(!birth \|\| birth\.deceased\) return;/.test(script), 'IMDb already prints age at death, so the feature must skip those pages');
});

test('Overseerr requests report media state and build valid bodies', () => {
    const hooks = loadScriptTestHooks();

    // Overseerr's documented media status enum.
    assert.strictEqual(hooks.mapSeerrMediaState({ status:5 }), 'library');
    assert.strictEqual(hooks.mapSeerrMediaState({ status:4 }), 'partial');
    assert.strictEqual(hooks.mapSeerrMediaState({ status:3 }), 'processing');
    assert.strictEqual(hooks.mapSeerrMediaState({ status:2 }), 'queued');
    assert.strictEqual(hooks.mapSeerrMediaState({ status:1 }), 'add');
    assert.strictEqual(hooks.mapSeerrMediaState(null), 'add', 'an unknown status must stay actionable');

    const results = [
        { mediaType:'person', id:99 },
        { mediaType:'tv', id:1396, mediaInfo:{ status:2 } },
    ];
    const picked = hooks.selectSeerrSearchResult(results, 'tt0903747', 'tv');
    assert.strictEqual(picked.tmdbId, 1396, 'the matching media type should decide the result');
    assert.strictEqual(hooks.selectSeerrSearchResult(results, 'tt0133093', 'movie'), null, 'a mismatched media type must not be requested');
    assert.strictEqual(hooks.selectSeerrSearchResult([{ mediaType:'movie', id:0 }], 'tt0133093', 'movie'), null, 'invalid ids must be rejected');

    assert.strictEqual(JSON.stringify(hooks.buildSeerrRequestBody('movie', 603)), JSON.stringify({ mediaType:'movie', mediaId:603 }));
    assert.strictEqual(JSON.stringify(hooks.buildSeerrRequestBody('tv', 1396)),
        JSON.stringify({ mediaType:'tv', mediaId:1396, seasons:'all' }), 'series default to every season');
    assert.strictEqual(JSON.stringify(hooks.buildSeerrRequestBody('tv', 1396, [1, 2, 2, -3])),
        JSON.stringify({ mediaType:'tv', mediaId:1396, seasons:[1, 2] }), 'season lists are deduplicated and bounded');
    assert.strictEqual(hooks.buildSeerrRequestBody('movie', 'not-a-number'), null, 'a bad id must not produce a request body');

    // The Overseerr URL and key must obey the same boundaries as every other
    // local integration, at edit time and at import time.
    assert(script.includes("'radarrUrl', 'sonarrUrl', 'seerrUrl'"), 'the Overseerr URL must be localhost-validated like its peers');
    assert(script.includes("'radarrApiKey', 'sonarrApiKey', 'seerrApiKey'"), 'the Overseerr key must be credential-normalized like its peers');
    assert(script.includes('Only localhost and 127.0.0.1 Overseerr/Jellyseerr URLs are allowed'), 'the Overseerr request boundary must enforce loopback');

    /* httpRequest serializes the body itself. A caller that pre-stringifies gets its
       payload encoded twice, and Overseerr receives a JSON string instead of an object
       — which is what shipped in 2.11.0. Assert the wire format, not the call shape. */
    hooks.seedStoredSetting('seerrUrl', 'http://localhost:5055');
    hooks.seedStoredSetting('seerrApiKey', 'test-key');
    hooks.seerrRequest('request', { method:'POST', body:hooks.buildSeerrRequestBody('movie', 603) }).catch(() => {});
    const seerrPost = hooks.getCapturedRequests().at(-1);
    assert.strictEqual(seerrPost.method, 'POST');
    assert.strictEqual(seerrPost.url, 'http://localhost:5055/api/v1/request');
    const seerrPayload = JSON.parse(seerrPost.data);
    assert.strictEqual(typeof seerrPayload, 'object', 'the request body must reach Overseerr as an object, not a JSON string');
    assert.strictEqual(seerrPayload.mediaType, 'movie');
    assert.strictEqual(seerrPayload.mediaId, 603);
    assert(!/_request[\s\S]{0,400}?body:JSON\.stringify\(body\)/.test(script), 'the Overseerr request must not pre-serialize its body');
});

test('resolved service identifiers survive their own cache and are fetched once', () => {
    const hooks = loadScriptTestHooks();

    /* Identifiers outlive scores, so the envelope ceiling has to be the long TTL.
       Validating against CACHE_TTL made every successful mapping unreadable on the
       first read back, which turned the lookup into a permanent per-visit request. */
    assert(hooks.WIKIDATA_ID_TTL > hooks.CACHE_TTL, 'identifier mappings should outlive volatile score data');
    assert(hooks.WIKIDATA_ID_TTL <= hooks.CACHE_MAX_TTL, 'the identifier TTL must fit inside the envelope ceiling');

    assert(hooks.cacheSet('xid_tt0133093', { rt:'m/matrix' }, hooks.WIKIDATA_ID_TTL), 'the mapping should persist');
    assert.strictEqual(JSON.stringify(hooks.cacheGet('xid_tt0133093')), JSON.stringify({ rt:'m/matrix' }),
        'a mapping written with its own TTL must be readable again');
    assert(hooks.cacheSet('xid_over', { rt:'m/x' }, hooks.CACHE_MAX_TTL + 1), 'an oversized envelope still writes');
    assert.strictEqual(hooks.cacheGet('xid_over'), null, 'an envelope above the ceiling must still be rejected');

    // Both score features resolve the same title concurrently; that must be one query.
    const before = hooks.getCapturedRequests().length;
    const first = hooks.resolveExternalIds('tt1375666');
    const second = hooks.resolveExternalIds('tt1375666');
    first.catch(() => {});
    second.catch(() => {});
    const issued = hooks.getCapturedRequests().slice(before)
        .filter(request => String(request.url || '').includes('query.wikidata.org'));
    assert.strictEqual(issued.length, 1, 'concurrent consumers must share one Wikidata lookup');
});

test('Wikidata resolves external service IDs without trusting arbitrary values', () => {
    const hooks = loadScriptTestHooks();

    const query = hooks.buildWikidataIdQuery('tt0133093');
    assert(query.includes('wdt:P345 "tt0133093"'), 'the query should look the title up by its IMDb ID');
    ['P1258', 'P1712', 'P4947', 'P4983'].forEach(property => {
        assert(query.includes(property), `the query should request ${property}`);
    });
    assert.strictEqual(hooks.buildWikidataIdQuery('not-an-id'), '', 'malformed IMDb IDs must not reach the endpoint');
    assert.strictEqual(hooks.buildWikidataIdQuery('tt0133093" } INJECT {'), '', 'query text must not be user-controlled');

    const response = JSON.stringify({ results:{ bindings:[{
        rt:{ value:'m/matrix' },
        mc:{ value:'movie/the-matrix' },
        tmdbMovie:{ value:'603' },
    }] } });
    assert.strictEqual(JSON.stringify(hooks.parseWikidataExternalIds(response)),
        JSON.stringify({ rt:'m/matrix', metacritic:'movie/the-matrix', tmdb:'movie/603' }));

    const tvResponse = JSON.stringify({ results:{ bindings:[{ tmdbTv:{ value:'1396' } }] } });
    assert.strictEqual(JSON.stringify(hooks.parseWikidataExternalIds(tvResponse)), JSON.stringify({ tmdb:'tv/1396' }));

    assert.strictEqual(JSON.stringify(hooks.parseWikidataExternalIds('not json')), '{}', 'malformed payloads must degrade to no mapping');
    assert.strictEqual(JSON.stringify(hooks.parseWikidataExternalIds(JSON.stringify({ results:{ bindings:[] } }))), '{}', 'an empty result set means no mapping');

    // A mapping is remote data, so it has to satisfy the shape of a real slug
    // before it can be pasted into a URL.
    const hostile = JSON.stringify({ results:{ bindings:[{
        rt:{ value:'../../evil' },
        mc:{ value:'https://evil.example/movie/x' },
    }] } });
    assert.strictEqual(JSON.stringify(hooks.parseWikidataExternalIds(hostile)), '{}', 'path traversal and absolute URLs must be rejected');
    assert.strictEqual(hooks.normalizeExternalId('rt', 'm/' + 'a'.repeat(400)), '', 'oversized identifiers must be rejected');
    assert.strictEqual(hooks.normalizeExternalId('rt', 'x/matrix'), '', 'unknown Rotten Tomatoes sections must be rejected');
    assert.strictEqual(hooks.normalizeExternalId('tmdb', 'movie/603'), 'movie/603');
});

test('a mapped Metacritic slug outranks search order', () => {
    const hooks = loadScriptTestHooks();
    const items = [
        { title:'The Matrix', type:'movie', releaseDate:'1999-03-31', criticScoreSummary:{ url:'/movie/the-matrix-remake/critic-reviews/' } },
        { title:'The Matrix', type:'movie', releaseDate:'1999-03-31', criticScoreSummary:{ url:'/movie/the-matrix/critic-reviews/' } },
    ];
    const picked = hooks.selectMetacriticResult(items, 'The Matrix', 1999, 'movie', 'movie/the-matrix');
    assert.strictEqual(picked.criticScoreSummary.url, '/movie/the-matrix/critic-reviews/', 'the mapped slug should decide between equal-looking results');

    const unmapped = hooks.selectMetacriticResult(items, 'The Matrix', 1999, 'movie');
    assert(unmapped, 'without a mapping the existing title/type/year selection still applies');
});

test('native IMDb Watched state is read only when the control positively says so', () => {
    const hooks = loadScriptTestHooks();
    const button = (testId, label, text = '') => ({
        getAttribute: name => (name === 'data-testid' ? testId : name === 'aria-label' ? label : null),
        textContent: text,
    });

    // The one state confirmed against a captured live title page.
    const unwatched = hooks.readNativeWatchedControl(
        button('watched-button-tt2085059', 'Mark Black Mirror as watched', 'Mark as watched'));
    assert.strictEqual(unwatched.imdbId, 'tt2085059', 'the IMDb ID should come from the native test id');
    assert.strictEqual(unwatched.watched, false, '"Mark as watched" means the title is NOT watched');
    assert.strictEqual(unwatched.title, 'Black Mirror', 'the accessible label should yield the title');

    assert.strictEqual(
        hooks.readNativeWatchedControl(button('watched-button-tt0133093', 'Remove The Matrix from watched')).watched,
        true, 'a removal label marks the title as watched');
    assert.strictEqual(
        hooks.readNativeWatchedControl(button('watched-button-tt0133093', 'Mark The Matrix as not watched')).watched,
        true, 'an undo label marks the title as watched');
    assert.strictEqual(
        hooks.readNativeWatchedControl(button('watched-button-tt0133093', '', 'Watched')).watched,
        true, 'a bare Watched label marks the title as watched');
    assert.strictEqual(
        hooks.readNativeWatchedControl(button('watched-button-tt0133093', 'Some future wording')).watched,
        null, 'unrecognized wording must stay unknown rather than defaulting to watched');
    assert.strictEqual(
        hooks.readNativeWatchedControl(button('some-other-button-tt0133093', 'Watched')),
        null, 'only IMDb watched controls should be read');

    const scope = {
        querySelectorAll: () => [
            button('watched-button-tt0133093', 'Remove The Matrix from watched'),
            button('watched-button-tt2085059', 'Mark Black Mirror as watched', 'Mark as watched'),
            button('watched-button-tt0903747', 'Unknown future wording'),
        ],
    };
    const collected = hooks.collectNativeWatchedTitles(scope);
    assert.deepStrictEqual([...collected.keys()], ['tt0133093'], 'only positively watched titles should be collected');
    assert.strictEqual(collected.get('tt0133093'), 'The Matrix');
});

test('browse surfaces receive presentation and cleanup without title tools', () => {
    const hooks = loadScriptTestHooks();

    const browsePaths = [
        ['/find', 'search'],
        ['/find/', 'search'],
        ['/search/title/', 'search'],
        ['/search/name/', 'search'],
        ['/de/search/title/', 'search'],
        ['/es/find', 'search'],
        ['/', 'home'],
        ['/de/', 'home'],
    ];

    browsePaths.forEach(([path, expected]) => {
        hooks.setTestPath(path);
        assert.strictEqual(hooks.getPageSurface(), expected, `${path} should classify as ${expected}`);
        assert(hooks.shouldInitFeature({ key:'removeAds', group:'Cleanup' }), `cleanup should run on ${path}`);
        assert(hooks.shouldInitFeature({ key:'modernUI', group:'Appearance' }), `themes should run on ${path}`);
        assert(hooks.shouldInitFeature({ key:'compactHeader', group:'Appearance' }), `header styling should run on ${path}`);
        assert(!hooks.shouldInitFeature({ key:'searchButtons', group:'Features' }), `title watch buttons must not run on ${path}`);
        assert(!hooks.shouldInitFeature({ key:'trailerPopover', group:'Features' }), `trailer tools must not run on ${path}`);
        assert(!hooks.shouldInitFeature({ key:'listMultiSearch', group:'Utility' }), `list queue tools must not run on ${path}`);
        assert(hooks.shouldInitFeature({ key:'watchedMarking', group:'Features' }), `private marks should decorate cards on ${path}`);
    });

    hooks.setTestPath('/search/title/?title_type=feature');
    assert.strictEqual(hooks.getPageSurface(), 'search', 'query strings must not change advanced-search classification');

    hooks.setTestPath('/title/tt0133093/');
    assert.strictEqual(hooks.getPageSurface(), 'title', 'title routes must not be absorbed by browse matching');
});

test('userscript and extension cover the browse routes they classify', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extension', 'manifest.json'), 'utf8'));
    const matches = manifest.content_scripts[0].matches;
    const required = [
        'https://www.imdb.com/find*',
        'https://www.imdb.com/search/*',
        'https://www.imdb.com/*/find*',
        'https://www.imdb.com/*/search/*',
        'https://www.imdb.com/',
    ];
    required.forEach(pattern => {
        assert(script.includes(`// @match        ${pattern}`), `userscript metadata must match ${pattern}`);
        assert(matches.includes(pattern), `extension manifest must match ${pattern}`);
    });
});

test('async feature guards expire across route and feature generations', () => {
    const hooks = loadScriptTestHooks();
    const feature = { key:'searchButtons', group:'Features' };

    hooks.setTestPath('/title/tt0133093/');
    const guard = hooks.createFeatureGuard(feature);
    assert(guard(), 'new title-route feature guard should start active');

    hooks.setTestPath('/name/nm0000206/');
    assert(!guard(), 'feature guard should expire after the route changes');

    hooks.setTestPath('/title/tt0133093/');
    assert(guard(), 'same route key remains current until a new route lifecycle begins');
    hooks.advanceRouteGeneration();
    assert(!guard(), 'route generation should prevent stale A-to-B-to-A callbacks');

    const refreshedFeature = { key:'searchButtons', group:'Features' };
    const refreshGuard = hooks.createFeatureGuard(refreshedFeature);
    assert(refreshGuard(), 'current feature instance should begin active');
    hooks.advanceFeatureGeneration(refreshedFeature);
    assert(!refreshGuard(), 'feature generation should prevent stale off-to-on callbacks on one route');
});

test('pending route work and lazy score lookups are cancellable', () => {
    const hooks = loadScriptTestHooks();
    hooks.waitFor('#never-present').catch(() => {});
    assert.strictEqual(hooks.getPendingRouteWorkCount(), 1, 'missing content should register cancellable route work');
    hooks.cancelPendingRouteWork();
    assert.strictEqual(hooks.getPendingRouteWorkCount(), 0, 'route cancellation should release pending DOM work immediately');

    hooks.httpRequest('https://example.test/slow', { cancelOnRouteChange:true }).catch(() => {});
    assert.strictEqual(hooks.getPendingRouteWorkCount(), 1, 'route-scoped HTTP should register cancellable work');
    hooks.cancelPendingRouteWork();
    assert.strictEqual(hooks.getPendingRouteWorkCount(), 0, 'route cancellation should release pending HTTP work');
    assert.strictEqual(hooks.getAbortedRequestCount(), 1, 'route cancellation should abort manager HTTP when supported');

    assert(script.includes('pendingRouteWorkCancels'), 'pending route-work registry missing');
    assert(script.includes('cancelPendingRouteWork();'), 'route teardown must cancel pending observers');
    assert(script.includes('waitForRatingBar(isCurrent)'), 'score widgets should wait for a current rating surface');
    assert(script.includes('waitUntilVisible(bar, isCurrent)'), 'third-party score requests should remain lazy and route-aware');
    assert(script.includes('timer = setTimeout(() => finish(false), 60000)'), 'offscreen visibility waits should release themselves after a bounded interval');
    assert((script.match(/createFeatureGuard\(this\)/g) || []).length >= 15, 'async feature entry points should be route guarded');
    assert(script.includes('pending.catch(rejectCurrentGeneration)'), 'async feature initialization failures should invalidate their lifecycle');
    let failedDestroyCount = 0;
    assert.strictEqual(hooks.startFeature({
        key:'brokenFeature', name:'Broken feature',
        init() { throw new Error('simulated init failure'); },
        destroy() { failedDestroyCount += 1; },
    }), false, 'synchronous feature startup failures should be reported');
    assert.strictEqual(failedDestroyCount, 1, 'a partially initialized feature should clean itself up after failure');
    let staleReject;
    let staleDestroyCount = 0;
    const staleFeature = {
        key:'staleFeature', name:'Stale feature',
        init:() => ({ catch:handler => { staleReject = handler; } }),
        destroy() { staleDestroyCount += 1; },
    };
    assert(hooks.startFeature(staleFeature));
    hooks.advanceFeatureGeneration(staleFeature);
    staleReject(new Error('late rejection'));
    assert.strictEqual(staleDestroyCount, 0, 'an old rejection must not destroy a newer feature generation');
    assert(script.includes('stopFeature(feature)'), 'settings refresh and disable paths should invalidate prior feature instances');
    assert(script.includes("startFeature(feature, { context:'settings', notify:true })"), 'settings-triggered feature failures should be visible');
    assert(script.includes("startFeature(feature, { context:'refresh', notify:true })"), 'settings-triggered feature refresh failures should be visible');
    assert(
        /const done = action\.kind === 'seerr'\s*\?\s*await this\._request\(imdbId, title, year, isCurrent\)\s*:\s*await this\._add\(action\.kind, imdbId, title, year, isCurrent\);\s*if \(!done \|\| !isCurrent\(\)\) return;/.test(script),
        'Servarr and Overseerr results must not update a later route'
    );
    assert(
        /await seerrRequest\('search', \{ query:\{ query:imdbId \}, cancelOnRouteChange:true \}\);\s*if \(!isCurrent\(\)\) return false;/.test(script),
        'Overseerr identity lookups must be cancellable and route guarded before a request is sent'
    );
    assert(
        /async _lookup\(kind, ctx, isCurrent\)[\s\S]*?query:\{ term \},\s*cancelOnRouteChange:true,[\s\S]*?if \(!isCurrent\(\)\) return null;/.test(script),
        'Servarr lookup requests must be cancellable and route guarded'
    );
    assert(
        /const item = await this\._lookup\(kind, \{ imdbId, title, year \}, isCurrent\);\s*if \(!item \|\| !isCurrent\(\)\) return false;/.test(script),
        'Servarr must not start an add request after its title route expires'
    );
});

test('watched marks only decorate canonical title links', () => {
    const hooks = loadScriptTestHooks();
    assert.strictEqual(hooks.getLinkedTitleId('/title/tt0133093/?ref_=home'), 'tt0133093');
    assert.strictEqual(hooks.getLinkedTitleId('/de/title/tt0133093/'), 'tt0133093');
    assert.strictEqual(hooks.getLinkedTitleId('/showtimes/title/tt0133093/2026-08-30'), '');
    assert.strictEqual(hooks.getLinkedTitleId('/title/tt0133093/releaseinfo/'), '');
    assert(script.includes('IMDb Watched was not changed'), 'local mark feedback should distinguish itself from IMDb\'s native Watched state');
    // Written through the guarded setter, since this runs from a document-wide observer.
    assert(script.includes("setTextIfChanged(badge, mark === 'watched' ? 'Local seen' : 'Local skip')"),
        'visible local badges should not impersonate native IMDb Watched');
});

test('local marks are cached and bounded while DOM rescans stay mutation-scoped', () => {
    const hooks = loadScriptTestHooks();
    const marks = {};
    for (let index = 0; index < 5003; index++) {
        marks[`tt${String(index).padStart(7, '0')}`] = { state:'watched', title:`Title ${index}`, ts:index };
    }
    hooks.seedStoredSetting('userMarks', marks);
    const normalized = hooks.getUserMarks();
    assert.strictEqual(Object.keys(normalized).length, 5000, 'normal use should retain at most 5,000 local marks');
    assert(!normalized.tt0000000, 'oldest excess marks should be discarded first');
    assert(normalized.tt0005002, 'newest marks should be retained');
    const oversizedMarks = {};
    for (let index = 0; index <= hooks.USER_MARKS_SCAN_LIMIT; index++) {
        oversizedMarks[`tt${String(index).padStart(7, '0')}`] = { state:'watched', title:`Title ${index}`, ts:index };
    }
    const boundedEntries = hooks.normalizeUserMarkEntries(oversizedMarks);
    assert.strictEqual(boundedEntries.length, 5000, 'mark normalization should retain only the configured maximum');
    assert(boundedEntries.some(([id]) => id === 'tt0009999'), 'newest records inside the scan budget should survive');
    assert(!boundedEntries.some(([id]) => id === 'tt0010000'), 'records outside the finite scan budget should not be inspected');
    assert(!script.includes('Object.entries(raw).forEach'), 'stored mark reads must not materialize an unbounded entry array');
    assert(!script.includes('Object.entries(source)\n            .map'), 'mark writes must not materialize an unbounded entry array');
    hooks.setUserMark('tt9999999', 'watched', 'Newest');
    assert.strictEqual(Object.keys(hooks.getStoredSetting('userMarks')).length, 5000, 'new writes should preserve the mark bound');
    const failingHooks = loadScriptTestHooks();
    failingHooks.failSettingWriteAt(1);
    assert.strictEqual(
        failingHooks.setUserMark('tt0133093', 'watched', 'The Matrix', false),
        false,
        'mark writes should report storage failure instead of claiming success'
    );
    assert.strictEqual(failingHooks.getStoredSetting('userMarks'), undefined, 'failed mark writes must not update the local cache contract');
    const mergingHooks = loadScriptTestHooks();
    mergingHooks.seedStoredSetting('userMarks', {
        tt0133093:{ state:'watched', title:'The Matrix', ts:1 },
    });
    mergingHooks.getUserMarks();
    mergingHooks.seedStoredSetting('userMarks', {
        tt0133093:{ state:'watched', title:'The Matrix', ts:1 },
        tt0078748:{ state:'skip', title:'Alien', ts:2 },
    });
    assert(mergingHooks.setUserMark('tt0083658', 'watched', 'Blade Runner'));
    assert.deepStrictEqual(
        Object.keys(mergingHooks.getStoredSetting('userMarks')).sort(),
        ['tt0078748', 'tt0083658', 'tt0133093'].sort(),
        'a tab should merge a new mark into storage changed by another tab after its last read'
    );
    assert(script.includes('mutation.addedNodes.forEach'), 'watched-mark observer should scan added subtrees');
    assert(script.includes('this._pendingScanRoots.size > 50'), 'large mutation batches should retain a bounded full-scan fallback');
});

test('lookup caches remain bounded and storage failures do not hide fetched results', () => {
    const hooks = loadScriptTestHooks();
    hooks.seedRawStorage('cache_legacy', JSON.stringify({ data:{ score:99 }, ts:Date.now(), ttl:60000 }));
    assert.strictEqual(hooks.cacheGet('legacy'), null, 'pre-validation cache schemas should be invalidated');
    assert(!hooks.getStorageKeys().includes('cache_legacy'), 'invalidated legacy cache entries should be deleted');
    hooks.seedRawStorage('cache_bad_ttl', JSON.stringify({ data:{ score:99 }, ts:Date.now(), ttl:'forever', schema:3 }));
    assert.strictEqual(hooks.cacheGet('bad_ttl'), null, 'non-numeric cache lifetimes must not bypass expiry');
    assert(!hooks.getStorageKeys().includes('cache_bad_ttl'), 'malformed cache lifetimes should be deleted');
    hooks.seedRawStorage('cache_future', JSON.stringify({ data:{ score:99 }, ts:Date.now() + 120000, ttl:60000, schema:3 }));
    assert.strictEqual(hooks.cacheGet('future'), null, 'future-dated cache entries must not persist indefinitely');
    hooks.seedRawStorage('cache_oversized', 'x'.repeat(hooks.CACHE_ENTRY_TEXT_LIMIT + 1));
    assert.strictEqual(hooks.cacheGet('oversized'), null, 'oversized cache text must not reach JSON parsing');
    assert(!hooks.getStorageKeys().includes('cache_oversized'), 'oversized cache entries should be deleted');
    assert.strictEqual(
        hooks.cacheSet('oversized_write', { value:'x'.repeat(hooks.CACHE_ENTRY_TEXT_LIMIT) }),
        false,
        'oversized cache values must not be persisted'
    );
    assert(!hooks.getStorageKeys().includes('cache_oversized_write'), 'rejected cache writes must not consume storage');
    for (let index = 0; index < 135; index++) hooks.cacheSet(`test_${index}`, { index });
    const cacheKeys = hooks.getStorageKeys().filter(key => key.startsWith('cache_'));
    assert(cacheKeys.length <= 129, `cache exceeded bounded GC window: ${cacheKeys.length}`);
    assert.strictEqual(hooks.cacheGet('test_134')?.index, 134, 'newest cached result should survive pruning');
    assert(script.includes('CACHE_SCHEMA_VERSION = 3'), 'cache schema invalidation marker missing');
    assert.strictEqual((script.match(/function parseCacheEntry\(/g) || []).length, 1, 'cache reads and GC should share one envelope validator');

    /* parseCacheEntry adds `expired`, computed from the clock at read time. The access
       re-stamp wrote the parsed object straight back, so that derived field landed on
       disk where it means nothing and only grows the envelope. */
    const stamping = loadScriptTestHooks();
    const day = 24 * 60 * 60 * 1000;
    stamping.seedRawStorage('cache_restamped', JSON.stringify({
        data:{ value:'live' },
        ts: Date.now() - (2 * day),
        // Older than the access-stamp interval, so the next read re-stamps it.
        at: Date.now() - (3 * day),
        ttl: 7 * day,
        schema: 3,
    }));
    assert.strictEqual(stamping.cacheGet('restamped')?.value, 'live', 'a live entry must still read back');
    const restamped = JSON.parse(stamping.getRawStorage('cache_restamped'));
    assert(!Object.prototype.hasOwnProperty.call(restamped, 'expired'),
        'a field derived from the clock must not be persisted');
    assert(restamped.at > Date.now() - (2 * 60 * 1000), 'the access stamp must actually have been refreshed');
    assert.strictEqual(restamped.ttl, 7 * day, 're-stamping must not disturb the stored envelope');

    /* This assertion previously required cacheSet to give up on the first thrown write.
       That encoded the absence of the recovery path, not a guarantee anyone depends on:
       a single transient rejection is exactly what eviction-then-retry exists to absorb.
       The contract that matters is that a write which cannot succeed still returns false
       without throwing, which the persistent-quota test below now pins. */
    const failingHooks = loadScriptTestHooks();
    failingHooks.failSettingWriteAt(1);
    assert.strictEqual(failingHooks.cacheSet('quota', { value:true }), true,
        'one transient write rejection should be recovered by the eviction retry');
    assert.strictEqual(failingHooks.cacheGet('quota')?.value, true, 'the recovered write must actually be readable');
});

/* IE-78: 120 entries x 256 KiB permits ~30 MiB against a 10 MiB default quota, so the
   entry count never binds before the quota does. */
test('the cache is bounded in bytes and evicts least-recently-accessed entries', () => {
    const hooks = loadScriptTestHooks();
    assert(hooks.CACHE_TOTAL_BYTE_BUDGET <= 6 * 1024 * 1024,
        'the aggregate budget must stay under the 10 MiB default extension quota');

    // Accounting is in encoded UTF-8 bytes, not UTF-16 code units.
    assert.strictEqual(hooks.encodedByteLength('abc'), 3);
    assert.strictEqual(hooks.encodedByteLength('é'), 2, 'a two-byte character must not count as one');
    assert.strictEqual(hooks.encodedByteLength('☃'), 3);
    assert.strictEqual(hooks.encodedByteLength('😀'), 4, 'an astral character must not count as two');

    // Fill well past the byte budget with entries large enough that the count limit
    // cannot be what stops it, then confirm the aggregate is actually enforced.
    const payload = 'x'.repeat(200 * 1024);
    for (let index = 0; index < 60; index += 1) hooks.cacheSet(`bulk_${index}`, { payload, index });
    const usage = hooks.readCacheUsage();
    assert(usage.bytes <= hooks.CACHE_TOTAL_BYTE_BUDGET,
        `aggregate cache bytes exceeded the budget: ${usage.bytes} > ${hooks.CACHE_TOTAL_BYTE_BUDGET}`);
    assert(usage.entries.length <= hooks.CACHE_MAX_ENTRIES, 'the entry ceiling must still hold');
    assert(usage.entries.length < 60, 'entries must actually have been evicted');
    assert.strictEqual(hooks.cacheGet('bulk_59')?.index, 59, 'the newest write must survive its own eviction pass');
    assert.strictEqual(hooks.cacheGet('bulk_0'), null, 'the oldest entry should have been evicted first');

    // Nothing outside the cache keyspace is an eviction candidate.
    const survivor = loadScriptTestHooks();
    survivor.seedStoredSetting('userMarks', { tt0133093:{ state:'watched', ts:Date.now() } });
    survivor.seedStoredSetting('radarrApiKey', 'secret-key');
    survivor.seedStoredSetting('themeVariant', 'midnight');
    for (let index = 0; index < 60; index += 1) survivor.cacheSet(`bulk_${index}`, { payload, index });
    survivor.cacheGC(true);
    assert.strictEqual(survivor.getStoredSetting('radarrApiKey'), 'secret-key', 'credentials are never eviction candidates');
    assert.strictEqual(survivor.getStoredSetting('themeVariant'), 'midnight', 'settings are never eviction candidates');
    assert(survivor.getStoredSetting('userMarks'), 'private marks are never eviction candidates');
});

test('eviction order follows last access, not write order', () => {
    const hooks = loadScriptTestHooks();
    const payload = 'x'.repeat(200 * 1024);
    for (let index = 0; index < 20; index += 1) hooks.cacheSet(`aged_${index}`, { payload, index });
    /* Age every entry an hour so the next read re-stamps it, then touch the oldest.
       Without access stamping it would be first out; with it, it must outlive newer
       entries that were never read. */
    const hour = 60 * 60 * 1000;
    hooks.getStorageKeys().filter(key => key.startsWith('cache_')).forEach(key => {
        const entry = JSON.parse(hooks.getRawStorage(key));
        hooks.seedRawStorage(key, JSON.stringify({ ...entry, ts:entry.ts - 2 * hour, at:entry.at - 2 * hour }));
    });
    assert(hooks.cacheGet('aged_0'), 'the oldest entry should still be readable before eviction');
    for (let index = 20; index < 40; index += 1) hooks.cacheSet(`aged_${index}`, { payload, index });
    assert(hooks.cacheGet('aged_0'), 'a recently read entry must outlive never-read entries written after it');
});

/* In the extension build GM_setValue cannot be synchronous, so cacheSet's write returns
   normally and the rejection arrives later. Without a path that reacts to it, the whole
   quota-recovery layer was userscript-only: the extension would report success, never
   evict, and never tell anyone — in the one build where a 10 MiB quota makes it likely. */
test('an asynchronously reported cache write failure still evicts and reports', () => {
    const hooks = loadScriptTestHooks();
    const payload = 'x'.repeat(200 * 1024);
    for (let index = 0; index < 25; index += 1) hooks.cacheSet(`late_${index}`, { payload, index });
    const before = hooks.readCacheUsage();
    assert(before.entries.length > 6, 'the cache needs entries for the eviction to be observable');

    /* The bridge reports the storage key it was handed, which carries the prefix. This
       test used to pass the bare setting name, which is the shape only the synchronous
       userscript path produces — so it asserted the recovery worked in exactly the build
       where it could not run. Both shapes are exercised now. */
    hooks.dispatchStorageFailure('imdb_enh_cache_late_24');
    const after = hooks.readCacheUsage();
    assert(after.entries.length < before.entries.length,
        'a reported cache write failure must make room rather than leaving the cache full');
    assert(after.entries.length <= Math.floor(hooks.CACHE_MAX_ENTRIES / 4),
        'recovery should fall back to a fraction of the budget, as the synchronous path does');
    const failures = hooks.getFeatureFailures().filter(entry => entry.key === 'cache');
    assert(failures.length, 'the user must be told the cache is not being written');
    assert(!/late_24/.test(failures[failures.length - 1].message), 'the report must not carry the cache key');

    const bare = loadScriptTestHooks();
    for (let index = 0; index < 25; index += 1) bare.cacheSet(`late_${index}`, { payload, index });
    const beforeBare = bare.readCacheUsage();
    bare.dispatchStorageFailure('cache_late_24');
    assert(bare.readCacheUsage().entries.length < beforeBare.entries.length,
        'the synchronous manager names the setting without a prefix and must still recover');

    // A settings failure is the settings UI's business, not the cache's.
    const settings = loadScriptTestHooks();
    settings.cacheSet('kept', { value:true });
    settings.dispatchStorageFailure('imdb_enh_themeVariant');
    assert.strictEqual(settings.getFeatureFailures().filter(entry => entry.key === 'cache').length, 0,
        'a settings write failure must not be reported as a cache problem');
    assert(settings.cacheGet('kept'), 'a settings write failure must not evict the cache');
});

/* Defect found by adversarial review: in the extension the marks write is optimistic.
   The bridge cannot throw, so setUserMarks adopted the new marks into its cache, every
   counter and badge reported them as saved, and a reload lost them with no warning. */
test('a marks write reported as failed afterwards is not left showing as saved', () => {
    const hooks = loadScriptTestHooks();
    const kept = { tt0000001:{ v:1, state:'watched', title:'Kept', ts:Date.now() } };
    assert(hooks.setUserMarks(kept), 'the seeding write should succeed');

    /* Reproduces the extension exactly. The optimistic write reports success and the
       cache adopts the new mark, but storage still holds only what was there before,
       so the late failure event is the only thing that can correct the page. */
    assert(hooks.setUserMarks({ ...kept, tt0000002:{ v:1, state:'watched', title:'Never stored', ts:Date.now() } }),
        'the optimistic write reports success, which is the whole problem');
    assert.strictEqual(hooks.getUserMark('tt0000002'), 'watched', 'the cache adopted it');
    hooks.seedRawStorage('imdb_enh_userMarks', kept);

    hooks.dispatchStorageFailure('imdb_enh_userMarks');
    assert.strictEqual(hooks.getUserMark('tt0000002'), '',
        'the cache must stop reporting a mark that was never stored');
    assert.strictEqual(hooks.getUserMark('tt0000001'), 'watched',
        'marks that really are stored must survive the correction');
    assert(hooks.getDispatchedEvents().includes('imdb-enhanced:marks-updated'),
        'everything painted from the marks must be told to repaint');

    // A different key's failure is not the marks' business.
    const other = loadScriptTestHooks();
    other.setUserMarks(kept);
    other.dispatchStorageFailure('imdb_enh_themeVariant');
    assert.strictEqual(other.getUserMark('tt0000001'), 'watched',
        'an unrelated write failure must not discard the marks cache');
});

/* Defect found by adversarial review: Remove was a note write followed by a mark write,
   so a failure between them destroyed the note and kept the mark. */
test('removing a mark and its note is a single write', () => {
    const hooks = loadScriptTestHooks();
    hooks.setUserMarks({ tt0000002:{ v:1, state:'watched', title:'Godfather', ts:Date.now(), note:'the baptism scene' } });
    assert.strictEqual(hooks.getUserNote('tt0000002'), 'the baptism scene', 'the note should seed');

    hooks.failAllSettingWrites(true);
    const remaining = { ...hooks.getUserMarks(true) };
    delete remaining.tt0000002;
    assert.strictEqual(hooks.setUserMarks(remaining), false, 'the removal must report failure');
    hooks.failAllSettingWrites(false);
    assert.strictEqual(hooks.getUserNote('tt0000002'), 'the baptism scene',
        'a failed removal must leave the note intact rather than destroying half the record');
    assert.strictEqual(hooks.getUserMark('tt0000002'), 'watched',
        'a failed removal must leave the mark intact');
});

test('a persistently full quota reports a scrubbed failure and a recovery action', () => {
    const hooks = loadScriptTestHooks();
    hooks.cacheSet('warm', { value:'kept' });
    hooks.failAllSettingWrites(true);
    assert.strictEqual(hooks.cacheSet('doomed', { value:true }), false,
        'a write that cannot succeed must report failure rather than throw');
    hooks.failAllSettingWrites(false);
    const failures = hooks.getFeatureFailures().filter(entry => entry.key === 'cache');
    assert(failures.length, 'a persistent quota failure must be recorded for diagnostics');
    const message = failures[failures.length - 1].message;
    assert(/quota/i.test(message), 'the recorded failure should name the quota');
    assert(!/doomed/.test(message), 'the failure record must not carry the cache key');
    assert(!/kept/.test(message), 'the failure record must not carry cached payload data');
    // The recovery action the message points at has to exist.
    assert(script.includes("id:'enh-clearcache-btn'"), 'the recovery control named by the quota toast must exist');
    assert(/Settings → Data → Clear cache frees it/.test(script), 'the quota toast should name the recovery path');
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extension', 'manifest.json'), 'utf8'));
    assert(!(manifest.permissions || []).includes('unlimitedStorage'),
        'the byte budget exists so the build never needs unlimitedStorage');
});

test('settings use six accessible desktop destinations', () => {
    ['experience', 'ratings', 'tools', 'sites', 'integrations', 'data'].forEach(page => {
        assert(script.includes(`id:'${page}'`), `settings page ${page} missing`);
    });
    assert(script.includes('role="tablist"'), 'settings navigation tablist missing');
    assert(script.includes("role:'tabpanel'"), 'settings tab panels missing');
    assert(/#enh-settings-overlay\s*\{[^}]*visibility:\s*hidden/s.test(script), 'closed settings must leave the tab order');
    assert(/#enh-settings-overlay\.enh-visible\s*\{[^}]*visibility:\s*visible/s.test(script), 'open settings must restore visibility');
    assert(script.includes('maxlength:String(SETTINGS_IMPORT_TEXT_LIMIT)'), 'import size guard missing');
    assert(script.includes('raw.length > SETTINGS_IMPORT_TEXT_LIMIT'), 'import parser must enforce the same size guard');
    assert(script.includes('Settings could not be read for export. No backup was copied.'), 'export read failures should remain visible');
    assert(script.includes('Changes save automatically.'), 'automatic-save status missing');
    assert(script.includes('id="enh-settings-save-state" role="status" aria-live="polite" aria-atomic="true"'), 'automatic-save feedback should be announced');
    assert(script.includes("document.addEventListener('imdb-enhanced:settings-save-failed', markSaveFailed)"), 'storage failures should update the persistent save indicator');
    assert(script.includes("saveState.textContent = 'Save failed'"), 'failed writes must not leave a saved-state claim visible');
    assert(!script.includes('<main class="enh-settings-main">'), 'settings dialog must not add a second page-level main landmark');
    assert(script.includes('When “Optional keyboard shortcuts” is enabled'), 'disabled-by-default shortcut hints must disclose their prerequisite');
    assert(script.includes("'aria-controls':'enh-import-panel', 'aria-expanded':'false'"), 'import disclosure state missing');
    assert(script.includes("'aria-controls':'enh-reset-panel', 'aria-expanded':'false'"), 'reset disclosure state missing');
    assert(script.includes('const setDataDisclosureState = openPanel =>'), 'data subpanels should share one disclosure-state owner');
    assert(script.includes("showToast('Cache could not be read or cleared.', 4500)"), 'cache failures should remain visible');
    assert(script.includes('else if (failed) showToast(`Cleared ${cleared} cached entries; ${failed} could not be removed.`'), 'partial cache deletion must not claim complete success');
    assert(script.includes('if (!trySaveSetting(feature.key, enabled))'), 'feature toggles should revert when storage fails');
    assert(script.includes("showToast('Could not save the theme. Previous settings were restored.'"), 'multi-key theme changes should report transactional rollback');
    assert(script.includes('rows.insertBefore(row, next?.parentNode === rows ? next : null)'), 'failed site removal should restore its row');
    assert(/const previousRows = Array\.from\(rows\.children\);[\s\S]*?rows\.replaceChildren\(\.\.\.previousRows\);/.test(script), 'failed site reset should restore the prior editor rows');
    assert(script.includes('if (!settingsOpen || overlay.contains(event.target)) return'), 'settings should recapture focus that leaves the modal');
    assert(script.includes('createMarksPanel(registerCleanup)'), 'settings-owned document listeners should join the panel cleanup lifecycle');
    assert(script.includes("document.removeEventListener('imdb-enhanced:marks-updated', render)"), 'marks listener must be removed when settings are rebuilt');
    assert(script.includes("document.removeEventListener('imdb-enhanced:settings-saved', markSaved)"), 'save listener must be removed when settings are rebuilt');
    assert(script.includes("document.removeEventListener('focusin', containSettingsFocus)"), 'focus containment listener must be removed when settings are rebuilt');
    assert(/function destroyRouteFeatures\(\)[\s\S]*?destroySettingsChrome\(\);/.test(script), 'route teardown should rebuild settings without retaining document listeners');
    assert(/function destroySettingsChrome\(\)[\s\S]*?document\.documentElement\.style\.overflow = previousDocumentOverflow/.test(script), 'route teardown must restore scroll if settings were open');
});

test('settings visual system keeps the redesigned control hierarchy', () => {
    assert(script.includes('className:\'enh-site-editor__columns\''), 'site editors should expose readable column labels');
    ['Clean up', 'Tune the interface', 'Preview', 'Watch & stream', 'Research & reviews', 'Add destination'].forEach(label => {
        assert(script.includes(label), `redesigned settings label missing: ${label}`);
    });
    assert(script.includes('grid-template-columns: 42px minmax(120px, .7fr)'), 'site editor rows should use the spacious table layout');
    assert(script.includes('border-radius: 999px'), 'settings toggles should use the compact pill treatment');
    assert(script.includes('width: min(1120px, calc(100vw - 48px))'), 'settings workspace should use the wider desktop canvas');
});

test('trailer dialog contains focus, restores page state, and ignores stale lookups', () => {
    const hooks = loadScriptTestHooks();
    let selector = '';
    const visible = { disabled:false, getAttribute:() => null, offsetParent:{} };
    const hidden = { disabled:false, getAttribute:() => null, offsetParent:null };
    const disabled = { disabled:true, getAttribute:() => null, offsetParent:{} };
    assert.deepStrictEqual(
        Array.from(hooks.getFocusableElements({ querySelectorAll:value => { selector = value; return [visible, hidden, disabled]; } })),
        [visible],
        'focus collection should exclude hidden and disabled controls'
    );
    assert(selector.includes('select') && selector.includes('iframe'), 'dialog focus collection should include selects and embedded players');
    assert(script.includes("'aria-controls':'enh-trailer-dialog'"), 'trailer opener should reference its dialog');
    assert(script.includes("'aria-expanded':'false'"), 'trailer opener should expose expanded state');
    assert(script.includes("'aria-labelledby':'enh-trailer-title'"), 'trailer dialog should use its visible title');
    assert(script.includes('this._lastFocused?.focus?.()'), 'closing the trailer should restore its opener');
    assert(script.includes("document.documentElement.style.overflow = this._previousOverflow"), 'closing the trailer should restore page scrolling');
    assert(script.includes('generation !== this._modalGeneration || !body.isConnected'), 'closed trailer lookups must not render late results');
    assert(script.includes("document.addEventListener('focusin', this._focusin)"), 'iframe focus exits should be returned to the trailer dialog');
    assert(script.includes("document.removeEventListener('focusin', this._focusin)"), 'trailer focus containment should be cleaned up on close');

    const searchHtml = `
        {"videoId":"AAAAAAAAAAA"},
        {"videoRenderer":{"videoId":"BBBBBBBBBBB","title":{"runs":[{"text":"The Matrix Reloaded (2003) Official Trailer"}]}}},
        {"videoRenderer":{"videoId":"vKQi3bBA1y8","title":{"runs":[{"text":"The Matrix (1999) Official Trailer #1"}]}}}`;
    assert.strictEqual(hooks.parseYouTubeTrailerVideoId(searchHtml, 'The Matrix', 1999), 'vKQi3bBA1y8');
    assert.strictEqual(hooks.normalizeYouTubeVideoId('vKQi3bBA1y8'), 'vKQi3bBA1y8');
    assert.strictEqual(hooks.normalizeYouTubeVideoId('../watch?v=x'), '', 'cached embed IDs must stay exact');
    assert(script.includes('const cachedVideoId = normalizeYouTubeVideoId(cached?.videoId)'), 'cached trailer IDs must be revalidated before embedding');
    assert.strictEqual(hooks.parseYouTubeTrailerVideoId(searchHtml, 'Alien', 1979), '', 'unrelated first video IDs must not autoplay');
    assert(!script.includes('_parseVideoId(html)'), 'unscoped first-video parsing should stay removed');
    assert(!hooks.isTrailerTitleMatch('It Ends with Us Official Trailer', 'It'), 'a generic title must not match a longer movie title');
    assert(hooks.isTrailerTitleMatch('It (2017) Official Trailer', 'It'), 'release and trailer descriptors should remain valid after an exact title');
    const genericHtml = [
        '"videoRenderer":{"videoId":"wrongvideo1","title":{"runs":[{"text":"It Ends with Us Official Trailer"}]}}',
        '"videoRenderer":{"videoId":"rightvideo1","title":{"runs":[{"text":"It (2017) Official Trailer"}]}}',
    ].join('');
    assert.strictEqual(hooks.parseYouTubeTrailerVideoId(genericHtml, 'It', 2017), 'rightvideo1');
    const excessiveHtml = Array.from({ length:100 }, (_, index) =>
        `"videoRenderer":{"videoId":"${String(index).padStart(11, '0')}","title":{"runs":[{"text":"Noise ${index} Official Trailer"}]}}`
    ).join('') + '"videoRenderer":{"videoId":"rightvideo1","title":{"runs":[{"text":"It (2017) Official Trailer"}]}}';
    assert.strictEqual(
        hooks.parseYouTubeTrailerVideoId(excessiveHtml, 'It', 2017),
        '',
        'trailer parsing must stop after its bounded result budget'
    );
});

test('secondary interactions expose complete keyboard and toggle semantics', () => {
    assert(script.includes("'aria-haspopup':'menu'"), 'expanded links should identify their menu popup');
    assert(script.includes("'aria-controls':'enh-link-menu-dropdown'"), 'expanded-link trigger should reference its popup');
    ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Escape', 'Tab'].forEach(key => {
        assert(script.includes(`event.key === '${key}'`) || script.includes(`'${key}'`), `expanded links missing ${key} handling`);
    });
    assert(script.includes("role:'group', 'aria-label':cat"), 'menu categories should expose labeled groups');
    assert(script.includes("'aria-pressed': 'false'"), 'watched and skip controls should expose toggle state');
    assert(script.includes("getUserMark(imdbId) === action ? '' : action"), 'active watched/skip controls should toggle off');
    assert(script.includes("plotFull.addEventListener('keydown', this._revealKeyHandler)"), 'plot reveal should support keyboard activation');
    assert(script.includes("document.addEventListener('keydown', this._keydownHandler)"), 'episode reveals should support keyboard activation');
    assert(script.includes("['Enter', ' '].includes(event.key)"), 'spoiler controls should support Enter and Space');
    assert(script.includes('restoreElementAttributes(plotFull, this._plotAttributes)'), 'revealed plots should restore their original non-button semantics');
    assert(script.includes("plot.classList.remove('enh-episode-spoiler')"), 'revealed episode plots should leave the keyboard tab order');
    assert(!script.includes("querySelectorAll('.enh-episode-spoiler, .enh-revealed')"), 'episode cleanup must not mutate another feature\'s revealed state');
    assert(script.includes('sec.insertBefore(btn, sec.firstChild)'), 'visually top-aligned collapse controls should also come first in section tab order');
    assert(script.includes("makeEl('nav', { id:'enh-quicknav', 'aria-label':'On this page' })"), 'quick navigation should expose a named navigation landmark');
    assert(script.includes("className:'enh-qn-dot', type:'button'"), 'scripted section jumps should use button semantics rather than fake hash links');
});

test('independent title tools survive external-link toggles', () => {
    assert(script.includes('expandedLinkMenu: 31'), 'expanded links need their own title-stack position');
    assert(
        /const trailer = bar\?\.querySelector\('#enh-trailer-btn'\);[\s\S]*?appendTitleStackItem\(trailer, TITLE_STACK_ORDER\.trailerPopover\)/.test(script),
        'disabling external links must preserve the independently enabled trailer control'
    );
    assert(
        /const menu = bar\?\.querySelector\('#enh-link-menu-wrap'\);[\s\S]*?appendTitleStackItem\(menu, TITLE_STACK_ORDER\.expandedLinkMenu\)/.test(script),
        'disabling external links must preserve the independently enabled expanded menu'
    );
    assert(
        /key: 'expandedLinkMenu'[\s\S]*?waitForTitleSurface\(\)[\s\S]*?enh-link-menu-wrap--standalone/.test(script),
        'expanded links must remain usable without the external-links bar'
    );
});

test('editorial title surface keeps primary actions and configurable destinations available', () => {
    assert(script.includes("id:'enh-editorial-actions'"), 'title actions should have a dedicated editorial dock');
    assert(script.includes("enh-search-btn enh-search-btn--primary"), 'watch destinations should expose one primary action');
    assert(script.includes("className:'enh-watch-options'"), 'secondary watch destinations should stay available in a disclosure');
    /* The region is named for what it holds — its defaults are Rotten Tomatoes,
       Letterboxd, TMDB, Wikipedia and Trakt, so "Where to watch" described the
       neighbouring watch section instead. */
    assert(script.includes("'aria-label':'Reviews and research'"), 'research links should expose a named category surface');
    assert(!/'Where to watch'/.test(script), 'the research region must not reuse the watch section heading');
    assert(script.includes("textContent:s.label"), 'section navigation should show readable labels instead of cryptic glyphs');
    /* The exclusion moved into isEnhancementNode() so the test-id path shares it; the
       behaviour itself is proven in "native title controls resolve by test id". */
    assert(script.includes("node?.closest?.('[id^=\"enh-\"]')"), 'native action discovery should not recurse into enhancement controls');
    assert(script.includes("editorialActions.appendChild(btn)"), 'the trailer action should join the editorial action dock when available');
    assert(/key: 'searchButtons'[\s\S]*?const trailer = wrap\?\.querySelector\('#enh-trailer-btn'\)/.test(script), 'search cleanup should preserve independent trailer controls');
});

test('editorial title layout owns a stable full-width title surface', () => {
    assert(script.includes("key: 'editorialTitleSurface'"), 'editorial title layout feature is not registered');
    assert(script.includes("id:'enh-editorial-surface'"), 'editorial title surface root is missing');
    assert(script.includes("section[data-testid=\"hero-parent\"].enh-editorial-native-hidden"), 'native hero should be hidden after its content is rehomed');
    assert(script.includes("id:'enh-editorial-action-slot'"), 'editorial hero needs a dedicated action slot');
    assert(script.includes("id:'enh-editorial-score-rail'"), 'editorial hero needs a dedicated score rail');
    assert(script.includes("id:'enh-editorial-research-slot'"), 'editorial details need a dedicated research slot');
    assert(/#enh-editorial-surface\s*\{[^}]*z-index:\s*7/.test(script), 'editorial surface must sit above IMDb backdrop overlays');
    assert(script.includes('refreshEditorialSurface(surface, this._nativeHero || document)'), 'hydrated poster and title data should refresh the surface');
    assert(/const synopsisNode = about\.querySelector\('\.enh-editorial-synopsis'\);[\s\S]*?if \(synopsisNode\)[\s\S]*?synopsisNode\.textContent !== synopsis/.test(script), 'surface hydration must not rewrite identical synopsis text');
    assert(script.includes("appendTitleStackItem(node, Number.isFinite(order) ? order : fallback)"), 'late title controls should be rehomed into the editorial surface');
    assert(/function findRatingBar\(\)[\s\S]*?const editorialRail = document\.getElementById\('enh-editorial-score-rail'\)[\s\S]*?if \(editorialRail\) return editorialRail/.test(script), 'rating features should target the editorial score rail');
});

test('blur is opt-in and never part of the default title or episode experience', () => {
    assert(/sectionCollapseState: \{\}, spoilerBlur: false/.test(script), 'plot spoiler blur must be disabled by default');
    assert(/const episodes = this\._collectEpisodes\(\);[\s\S]*?if \(get\('spoilerBlur'\)\) this\._blurPlots\(episodes\);/.test(script), 'episode synopsis blur must respect the opt-in setting');
    assert(readme.includes('Synopsis blur is opt-in and off by default.'), 'README should explain the non-blurring default');
});

test('all enhancements respect the operating-system reduced-motion preference', () => {
    const hooks = loadScriptTestHooks();
    assert.strictEqual(hooks.getEnhancementScrollBehavior(), 'smooth');
    hooks.setReducedMotion(true);
    assert.strictEqual(hooks.getEnhancementScrollBehavior(), 'auto');
    assert(script.includes('[id^="enh-"]::before'), 'global enhancement motion override missing');
    assert(script.includes('transition-delay: 0s !important'), 'reduced-motion transitions should start immediately');
    assert(!/scrollIntoView\(\{[^}]*behavior:\s*['"]smooth['"]/s.test(script), 'enhancement scrolling must honor reduced motion');
    assert(!/window\.scrollTo\(\{[^}]*behavior:\s*['"]smooth['"]/s.test(script), 'shortcut scrolling must honor reduced motion');
    assert(!readme.includes('WCAG AAA compliant'), 'README must not claim unverified conformance');
});

test('theme changes repaint feature styles without restarting behavior', () => {
    assert(script.includes('const themedStyleFactories = new Map()'), 'theme-aware feature styles need a shared registry');
    assert(script.includes('refreshThemedStyles();'), 'theme application should repaint registered feature styles');
    assert(!script.includes('refreshThemeDependentFeatures'), 'theme changes must not restart feature lifecycles or network checks');
    assert((script.match(/addThemedCSS\(t =>/g) || []).length >= 12, 'all feature-local theme styles should use the repaint registry');
    assert(!script.includes('background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);'), 'collapse controls must not retain dark-only surfaces');
    assert(script.includes('.enh-qn-dot:hover,.enh-qn-dot:focus-visible'), 'quick navigation should expose its tooltip and theme state to keyboard focus');
    assert(!script.includes('.enh-blur{filter:blur(6px)'), 'plot blur must not blur its own reveal instruction');
    assert(/key: 'spoilerBlur'[\s\S]*?addThemedCSS\(t =>/.test(script), 'plot reveal chrome should repaint with the active theme');
    assert(/key: 'subtitleLinks'[\s\S]*?addThemedCSS\(t =>[\s\S]*?enh-sub-row__label/.test(script), 'subtitle links should use the active theme instead of fixed dark text');
    assert(script.includes("removeCSS('enh-subtitleLinks')"), 'subtitle theme styles should clean up with the feature');
});

test('theme text tokens remain readable on elevated surfaces', () => {
    const hooks = loadScriptTestHooks();
    const luminance = hex => {
        const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
            .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const contrast = (foreground, background) => {
        const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
        return (values[0] + 0.05) / (values[1] + 0.05);
    };
    Object.entries(hooks.THEMES).forEach(([id, theme]) => {
        assert(contrast(theme.tx2, theme.sf2) >= 4.5, `${id} secondary text is too faint on elevated surfaces`);
        assert(contrast(theme.tx3, theme.sf2) >= 4.5, `${id} tertiary text is too faint on elevated surfaces`);
        assert(theme.heroScrim, `${id} needs an explicit hero scrim`);
    });
    ['dark', 'oled', 'midnight'].forEach(id => {
        const theme = hooks.THEMES[id];
        assert(hooks.getHexLuminance(theme.bg) <= 0.01, `${id} should remain a genuinely dark canvas`);
        assert(hooks.getHexLuminance(theme.bg) < hooks.getHexLuminance(theme.sf0), `${id} surface elevation should start above the canvas`);
        assert(hooks.getHexLuminance(theme.sf0) < hooks.getHexLuminance(theme.sf1), `${id} nested surfaces should step upward`);
        assert(hooks.getHexLuminance(theme.sf1) < hooks.getHexLuminance(theme.sf2), `${id} active surfaces should step upward`);
    });
    assert(script.includes('background-blend-mode: normal;'), 'editorial artwork must not be multiplied into black on OLED');
    assert(!script.includes('--score-color:#8888a0'), 'unavailable score links should inherit the current theme instead of fixed dark-theme gray');
    assert(script.includes('.enh-score-widget--muted { --score-color: ${t.tx2}; }'), 'unavailable score links should use the readable secondary token');
    assert(!script.includes('.enh-score-widget--muted { opacity:'), 'muted status widgets should not reduce all text below the theme contrast target');
});

test('theme overrides native IMDb surfaces and generated card text', () => {
    assert(script.includes('--ipc-listCard-base-bg: ${t.sf1};'), 'native list-card surface token should follow the active theme');
    assert(script.includes('--ipc-pageSection-baseAlt-bg: ${t.sf0};'), 'native baseAlt section token should follow the active theme');
    assert(/\.ipc-list-card,\s*\.ipc-slate-card,\s*\.ipc-poster-card/.test(script), 'shared native card surfaces need an explicit dark-theme override');
    assert(script.includes('.ipc-primary-image-list-card__title'), 'image list card titles need a theme-aware foreground');
    assert(script.includes('[data-testid="title-cast-item__actor"]'), 'cast actor names need a stable theme-aware foreground');
    assert(script.includes('.text-on-light'), 'native light-surface utility classes need to be remapped inside themed cards');
});

test('branded controls keep readable text across themes and score states', () => {
    const hooks = loadScriptTestHooks();
    const contrast = (foreground, background) => {
        const values = [hooks.getHexLuminance(foreground), hooks.getHexLuminance(background)].sort((a, b) => b - a);
        return (values[0] + 0.05) / (values[1] + 0.05);
    };
    [4.5, 5.5, 6.5, 7.5, 8.5, NaN].forEach(score => {
        const state = hooks.ratingColor(score);
        assert(contrast(state.text, state.bg) >= 4.5, `${state.label} rating badge text is too faint`);
    });
    Object.values(hooks.THEMES).forEach(theme => {
        [theme.accent, theme.red].forEach(background => {
            const text = hooks.readableTextColor(background);
            assert(contrast(text, background) >= 4.5, `${background} status badge needs a readable foreground`);
        });
    });
    assert(script.includes('.enh-search-btn {') && script.includes('color: ${t.tx1};'), 'watch buttons should use the tested theme foreground');
    assert(script.includes('.enh-ext-link:hover') && script.includes('color: ${t.tx0} !important;'), 'external-link hover should retain theme-aware text');
    assert(!script.includes('color-mix(in srgb, var(--btn-color) 88%, #fff)'), 'brand colors must not define watch-button text contrast');
    assert(!script.includes('.enh-markable-card.enh-marked{opacity:'), 'mark state must not fade an entire interactive card');
    assert(script.includes('.enh-markable-card.enh-marked img{opacity:'), 'mark state may distinguish poster imagery without fading controls or text');
    assert(!script.includes('.enh-multi-search-queue__item--opened { opacity:'), 'opened queue links must remain readable and interactive');
    assert(script.includes('.enh-multi-search-queue__item--opened .enh-multi-search-queue__link { color: ${t.tx3} !important; }'), 'opened queue links should use a tested semantic text token');
});

test('optional keyboard shortcuts do not collide with browser or modal commands', () => {
    assert(script.includes('e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey'), 'modified and repeated key events should bypass shortcuts');
    assert(script.includes("document.getElementById('enh-trailer-overlay')"), 'page shortcuts should pause while the trailer dialog is open');
    assert(/if \(settingsOpen\) \{[\s\S]*?if \(e\.key === 'Escape'\)[\s\S]*?return;/m.test(script), 'settings should own keyboard input while open');
    assert(!script.includes("e.key === 'c' && !e.ctrlKey"), 'copy collision checks should remain centralized for every shortcut');
});

test('settings imports validate first and roll back partial storage failures', () => {
    const hooks = loadScriptTestHooks();
    const prepared = hooks.prepareSettingsImport({
        modernUI:false,
        themeVariant:'light',
        radarrUrl:'http://localhost:7878/',
        plexUrl:'https://media.example.test/',
        cinebyHost:'https://example.test/',
        watchSites:[{ name:'Broken', url:'https://' }],
        unknownSetting:true,
    });
    assert.strictEqual(prepared.entries.length, 3, 'only valid recognized settings should be prepared');
    assert.strictEqual(prepared.ignored, 4, 'invalid and unknown settings should be reported');
    assert.strictEqual(
        prepared.entries.find(entry => entry.key === 'radarrUrl').value,
        'http://localhost:7878',
        'local service URLs should be canonicalized before writes'
    );

    hooks.seedStoredSetting('modernUI', true);
    hooks.seedStoredSetting('themeVariant', 'dark');
    hooks.failSettingWriteAt(2);
    assert.throws(
        () => hooks.applySettingsImport(prepared.entries.slice(0, 2)),
        /previous settings were restored/,
        'partial writes should report successful rollback'
    );
    assert.strictEqual(hooks.getStoredSetting('modernUI'), true, 'first partial write was not rolled back');
    assert.strictEqual(hooks.getStoredSetting('themeVariant'), 'dark', 'failed-key snapshot was not restored');

    const absentHooks = loadScriptTestHooks();
    absentHooks.seedStoredSetting('modernUI', true);
    absentHooks.failSettingWriteAt(2);
    assert.throws(
        () => absentHooks.applySettingsImport(prepared.entries.slice(0, 2)),
        /previous settings were restored/
    );
    assert.strictEqual(absentHooks.getStoredSetting('modernUI'), true, 'existing values should survive rollback');
    assert(!absentHooks.getStorageKeys().includes('imdb_enh_themeVariant'), 'rollback should restore an absent key as absent');

    assert.strictEqual(hooks.applySettingsImport(prepared.entries.slice(0, 2)), 2);
    assert.strictEqual(hooks.getStoredSetting('modernUI'), false);
    assert.strictEqual(hooks.getStoredSetting('themeVariant'), 'light');
    assert.throws(
        () => hooks.prepareSettingsImport({ plexUrl:'https://user:secret@localhost:32400/' }),
        /No valid recognized settings/,
        'credential-bearing service URLs must be rejected'
    );
    assert.throws(
        () => hooks.prepareSettingsImport({ plexToken:'secret\r\nX-Injected: yes' }),
        /No valid recognized settings/,
        'credential header values with embedded controls must be rejected'
    );
    assert.throws(
        () => hooks.prepareSettingsImport({ radarrApiKey:'k'.repeat(hooks.SETTING_TEXT_LIMIT + 1) }),
        /No valid recognized settings/,
        'oversized credential imports should be rejected instead of silently truncated'
    );
});

test('remembered section state participates in backup and migrates legacy keys', () => {
    const hooks = loadScriptTestHooks();
    hooks.seedRawStorage('enh_coll_Details', true);
    const migrated = hooks.getSectionCollapseState();
    assert.strictEqual(migrated.Details, true);
    assert.strictEqual(hooks.getStorageKeys().includes('enh_coll_Details'), false, 'legacy section key should be removed');
    assert.strictEqual(hooks.getStoredSetting('sectionCollapseState').Details, true, 'migrated state should use normal settings storage');
    assert(hooks.setSectionCollapsed('Details', false));
    assert.strictEqual(hooks.getStoredSetting('sectionCollapseState').Details, false);

    const prepared = hooks.prepareSettingsImport({
        sectionCollapseState:{ Details:true, Unknown:true, Photos:'yes' },
    });
    assert.strictEqual(prepared.entries[0].value.Details, true);
    assert.strictEqual(Object.keys(prepared.entries[0].value).length, 1, 'unknown or non-boolean section states should be ignored');
    assert(script.includes('sectionCollapseState: {}'), 'remembered section state should be included in exported defaults');
    assert(script.includes('try { getSectionCollapseState(); }'), 'legacy section state should migrate even when collapsible sections are disabled');

    const failingHooks = loadScriptTestHooks();
    failingHooks.seedRawStorage('enh_coll_Details', true);
    failingHooks.failSettingWriteAt(1);
    assert.throws(() => failingHooks.getSectionCollapseState(), /simulated settings write failure/);
    assert(failingHooks.getStorageKeys().includes('enh_coll_Details'), 'legacy state must survive a failed schema write');

    const failingControlHooks = loadScriptTestHooks();
    failingControlHooks.failSettingWriteAt(1);
    assert.strictEqual(failingControlHooks.setSectionCollapsed('Details', true, false), false, 'collapse state should report normal-write failure');
    assert.strictEqual(failingControlHooks.getStoredSetting('sectionCollapseState'), undefined, 'failed collapse writes must leave storage unchanged');
});

test('settings exports are canonical and fully re-importable', () => {
    const hooks = loadScriptTestHooks();
    hooks.seedStoredSetting('userMarks', { tt0133093:'watched' });
    hooks.seedRawStorage('enh_coll_Photos', true);
    hooks.seedStoredSetting('radarrQualityProfileId', '-3');
    const exported = hooks.getExportSettings();
    assert.strictEqual(exported.userMarks.tt0133093.state, 'watched', 'legacy marks should export in current schema form');
    assert.strictEqual(exported.sectionCollapseState.Photos, true, 'legacy section state should be included in export');
    assert.strictEqual(exported.radarrQualityProfileId, '1', 'invalid legacy values should export as safe defaults');
    const prepared = hooks.prepareSettingsImport(exported);
    assert.strictEqual(prepared.ignored, 0, 'a generated export should never contain fields its importer rejects');
    /* The export also carries metadata that describes the payload rather than being a
       restorable setting: the schema marker and the list of credentials it redacted. */
    const metadataKeys = Object.keys(exported).filter(key => hooks.EXPORT_METADATA_KEYS.has(key));
    assert.strictEqual(metadataKeys.length, 2, 'the export should carry the schema marker and the redaction manifest');
    assert.strictEqual(prepared.entries.length, Object.keys(exported).length - metadataKeys.length,
        'every exported setting except the payload metadata should be restorable');
    assert(script.includes('const serialized = JSON.stringify(payload, null, 2);'), 'clipboard export should use canonical schema data');

    const legacyPrepared = hooks.prepareSettingsImport({
        userMarks:{
            tt0133093:'watched',
            tt0078748:{ state:'skip', title:'A'.repeat(200), ts:Date.now() + 120000 },
        },
    }).entries[0].value;
    assert.strictEqual(legacyPrepared.tt0133093.state, 'watched', 'legacy string marks should remain importable');
    assert.strictEqual(legacyPrepared.tt0078748.title.length, 160, 'imported mark titles should use the runtime storage bound');
    assert.strictEqual(legacyPrepared.tt0078748.ts, 0, 'future-dated mark order should be neutralized');

    const maximumHooks = loadScriptTestHooks();
    const maximumMarks = {};
    for (let index = 0; index < 5000; index++) {
        maximumMarks[`tt${String(index).padStart(7, '0')}`] = {
            state:index % 2 ? 'watched' : 'skip', title:'T'.repeat(160), ts:index,
        };
    }
    /* Derived from the real limit, not a copy of what it used to be: when the site-list
       ceiling went 50 -> 250 for the FMHY catalog, a hard-coded 50 quietly stopped
       testing the maximum this guarantee is about. */
    const maximumSites = Array.from({ length:maximumHooks.SITE_LIST_LIMIT }, (_, index) => ({
        name:`Site ${index}`,
        url:`https://example.com/${'a'.repeat(4000)}?q={{TITLE}}&i=${index}`,
        color:'#6366f1',
    }));
    maximumHooks.seedStoredSetting('userMarks', maximumMarks);
    maximumHooks.seedStoredSetting('watchSites', maximumSites);
    maximumHooks.seedStoredSetting('externalSites', maximumSites);
    ['radarrApiKey', 'sonarrApiKey', 'plexToken', 'jellyfinApiKey', 'embyApiKey'].forEach(key => {
        maximumHooks.seedStoredSetting(key, 'k'.repeat(4096));
    });
    const maximumExportText = JSON.stringify(maximumHooks.getExportSettings(), null, 2);
    assert(
        maximumExportText.length <= maximumHooks.SETTINGS_IMPORT_TEXT_LIMIT,
        `maximum supported export (${maximumExportText.length}) exceeded import limit (${maximumHooks.SETTINGS_IMPORT_TEXT_LIMIT})`
    );
    assert.strictEqual(
        maximumHooks.prepareSettingsImport(JSON.parse(maximumExportText)).ignored,
        0,
        'a maximum supported export should still pass the importer'
    );
});

test('settings reset is explicit, complete, and isolated from live defaults', () => {
    const hooks = loadScriptTestHooks();
    const first = hooks.getDefaultSettingsEntries();
    const second = hooks.getDefaultSettingsEntries();
    assert(first.length > 50, 'reset should cover the complete settings schema');
    first.find(entry => entry.key === 'watchSites').value[0].name = 'Mutated';
    assert.notStrictEqual(
        second.find(entry => entry.key === 'watchSites').value[0].name,
        'Mutated',
        'reset snapshots must not share nested values with defaults or each other'
    );
    const resetMarks = second.find(entry => entry.key === 'userMarks');
    assert(resetMarks && Object.keys(resetMarks.value).length === 0, 'reset must clear local title marks');
    ['radarrApiKey', 'sonarrApiKey', 'plexToken', 'jellyfinApiKey', 'embyApiKey'].forEach(key => {
        assert.strictEqual(second.find(entry => entry.key === key).value, '', `${key} should reset to empty`);
    });
    assert(script.includes("id:'enh-reset-panel', hidden:'hidden', role:'alert'"), 'reset should use an explicit inline warning');
    assert(script.includes('Export a backup first if you may need them.'), 'reset warning should offer recovery guidance');
    assert(!/\bconfirm\s*\(/.test(script), 'reset must not reintroduce browser confirmation dialogs');
    assert(script.includes('clearAllTimer = setTimeout(disarmClearAll, 5000)'), 'bulk mark deletion should require a bounded second action');
    assert(script.includes('Press the clear button again within 5 seconds'), 'bulk mark deletion should explain its recovery window');
});

test('core features remain registered', () => {
    [
        'streamAvailability',
        'watchedMarking',
        'servarrIntegration',
        'watchlistBatch',
        'themeAuto',
        'cacheGC',
    ].forEach(token => assert(script.includes(token), `${token} missing`));
});

test('polish: focus rings, scoped layout rules, and reachable help copy', () => {
    const focusStart = script.indexOf('.enh-search-btn:focus-visible');
    const focusBlock = script.slice(focusStart, script.indexOf('@media (prefers-reduced-motion', focusStart));
    ['.enh-multi-search-btn', '.enh-servarr-btn', '.enh-watch-options__summary', '.enh-mark-row__link']
        .forEach(selector => assert(focusBlock.includes(`${selector}:focus-visible`), `${selector} needs the shared focus ring`));

    /* The collapse button is absolutely positioned inside nine known sections; the rule
       used to give every section[data-testid] on the page a containing block. */
    assert(!/^\s*section\[data-testid\]\{position:relative\}/m.test(script), 'the containing block must not apply page-wide');
    assert(script.includes('COLLAPSIBLE_SECTION_IDS.map(id => `section[data-testid="${id}"]`)'), 'it should be generated from the id list');

    // Density is fine; hiding the copy from assistive technology as well is not.
    assert(!/\.enh-settings-card--compact \.enh-settings-help \{ display: none; \}/.test(script), 'help copy must stay in the accessibility tree');
    assert(script.includes("'aria-describedby':helpId"), 'each toggle should point at its description');
    assert(/className:'enh-settings-row', \.\.\.\(detail \? \{ title:detail \}/.test(script), 'the row should carry the description as a tooltip');

    // Status pills derive both surface and foreground from the theme, like every peer.
    assert(!/rgba\(34,197,94/.test(script) && !/rgba\(239,68,68/.test(script), 'status pills must not hardcode colours');

    // Replaced components should not keep shipping their stylesheets.
    assert(!script.includes('.enh-servarr-status'), 'dead servarr status rules should be gone');
    assert(!script.includes('.enh-score-widget__icon'), 'dead score icon rule should be gone');
});

test('polish: truncation, certifications, and dependent settings', () => {
    const hooks = loadScriptTestHooks();

    // A hard slice ended mid-word with no sign that anything had been removed.
    assert.strictEqual(hooks.truncateAtWord('short text', 900), 'short text');
    const long = 'word '.repeat(400).trim();
    const cut = hooks.truncateAtWord(long, 900);
    assert(cut.length <= 901 && cut.endsWith('…'), 'a truncated synopsis should be marked');
    assert(!/\s…$/.test(cut) && !cut.includes('wor…'), 'truncation should land on a word boundary');
    assert(script.includes("className:'enh-editorial-title', title }"), 'an ellipsized heading needs its full text available');

    /* The certification fallback matched a rating pattern against the page heading,
       which is the title — so a title containing "PG" reported a PG certificate. */
    assert(!/nativeMeta\.match/.test(script), 'the title-text rating fallback must be gone');
    assert(script.includes("a[href*=\"parentalguide\"]"), 'certifications should come from the element IMDb publishes them in');

    // A setting another feature reads at run time has to restart that feature.
    assert(/const FEATURE_DEPENDENTS = \{[\s\S]{0,320}?spoilerBlur:\['tvEpisodeTools'\]/.test(script),
        'spoiler blur should declare its dependent');
    // The mark filter reads watchedMarking at init and draws nothing without it, so the
    // filter bar has to appear and disappear with that toggle rather than after a reload.
    // Both of these read watchedMarking at init and render nothing without it, so both
    // have to appear and disappear with that toggle rather than after a reload.
    assert(/const FEATURE_DEPENDENTS = \{[\s\S]{0,320}?watchedMarking:\['markFilters', 'seasonProgress'\]/.test(script),
        'private marks should declare every feature that depends on them');
    assert(script.includes('(FEATURE_DEPENDENTS[feature.key] || []).forEach(refreshFeature);'), 'toggling must refresh dependents');
});

test('the editorial layout keeps IMDb\'s own hero video', () => {
    const surface = script.slice(script.indexOf("key: 'editorialTitleSurface'"), script.indexOf("key: 'compactHeader'"));
    /* The repo already established that inline-video-playback-container is core media
       rather than an ad. Hiding the native hero took it off the page entirely, and the
       Trailer popover is a separate opt-in fetching a guessed YouTube match. */
    assert(surface.includes('inline-video-playback-container'), 'the native player must be re-homed, not hidden');
    assert(surface.includes("surface.querySelector('#enh-editorial-media-slot')"), 'it needs a slot in the rebuilt surface');
    assert(script.includes("id:'enh-editorial-media-slot'"), 'the surface should build that slot');
    assert(script.includes('#enh-editorial-media-slot:empty { display: none; }'), 'titles without video must not show an empty frame');
    // Adoption is reversible: destroy restores every borrowed node to its own parent.
    assert(surface.includes('this._adoptedNodes.push({ node, parent:node.parentElement })'), 'adopted nodes must record their origin');
    assert(surface.includes('parent.appendChild(node)'), 'destroy must return adopted nodes to the native hero');
});

test('site editing does not commit a durable write per keystroke', () => {
    const editor = script.slice(script.indexOf('function createSiteEditor'), script.indexOf('function createSettingsInput'));
    /* save() revalidates every row, re-reads every row, renormalizes them, and commits.
       Running that per keystroke scales with the whole 50-destination list rather than
       the edited row, and costs a storage round trip per character in the extension. */
    assert(!/addEventListener\('input', \(\) => save\(false\)\)/.test(editor), 'typing must not commit directly');
    assert(editor.includes('scheduleSave()'), 'typed edits should be debounced');
    assert(editor.includes('validateRow(row)'), 'typing should only revalidate the edited row');
    assert(editor.includes('cancelScheduledSave();'), 'a committed change must cancel the pending debounce');
    assert(editor.includes('registerEditorCleanup(cancelScheduledSave)'), 'a pending write must not outlive the panel');
    assert(script.includes('const SITE_EDITOR_SAVE_DELAY'), 'the debounce delay should be a named bound');
    // Blur still commits synchronously, so nothing is lost when the dialog closes.
    assert(/addEventListener\('change', \(\) => \{[\s\S]{0,200}?save\(true\)/.test(editor), 'change must still commit immediately');
});

test('user-facing copy names the right host for each build', () => {
    /* One source ships as both a userscript and an extension, so a message that names
       the userscript manager is wrong and unactionable for extension users. */
    const runtimeCopy = script.slice(script.indexOf('const VERSION'));
    [
        'userscript manager',
        'userscript clipboard permission',
        'userscript storage permissions',
        'this userscript build',
        'as early as userscript timing allows',
        'Marks stay in this userscript',
    ].forEach(phrase => assert(!runtimeCopy.includes(phrase), `build-specific copy leaked: ${phrase}`));
    assert(script.includes('const STORAGE_HOST_LABEL'), 'a build-neutral storage label should exist');
    assert(script.includes("IS_EXTENSION_BUILD ? 'extension storage' : 'userscript storage'"),
        'the label must resolve per build');
    assert(script.includes('const COPY_FAILURE_MESSAGE'), 'clipboard failures should share one build-neutral message');
});

test('toast announcements reuse one live region', () => {
    /* Assistive technology announces changes to a region already in the accessibility
       tree; inserting a node that carries aria-live is unreliable. Every confirmation
       in the product goes through showToast, so this is the whole announcement path. */
    const toast = script.slice(script.indexOf('function ensureToastAnnouncer'), script.indexOf('function trySaveSetting'));
    assert(toast.includes("id:'enh-toast-announcer'"), 'a dedicated live region should exist');
    assert(toast.includes("'aria-live':'polite'") && toast.includes("'aria-atomic':'true'"),
        'the region needs polite atomic announcements');
    assert(toast.includes('announcer.textContent = message'), 'showToast must update the region rather than replace it');
    assert(/makeEl\('div', \{ id:'enh-toast', 'aria-hidden':'true' \}/.test(toast),
        'the animated toast should be hidden from assistive technology so only the region speaks');
    assert(script.includes('#enh-toast-announcer'), 'the region needs a visually-hidden rule');
    assert(!/#enh-toast-announcer \{[^}]*display:\s*none/.test(script),
        'display:none would remove the region from the accessibility tree');
    assert(script.includes('toastTimers.splice(0).forEach(clearTimeout)'), 'route teardown must cancel pending toast timers');
    // Creating the region and setting its text in the same tick is the same
    // anti-pattern, so it has to be installed during init, before anything can speak.
    const init = script.slice(script.indexOf('function init() {'));
    assert(init.includes('ensureToastAnnouncer();'), 'the live region must exist before the first announcement');
});

test('a deceased person never gets a current age', () => {
    const hooks = loadScriptTestHooks();
    const makeDoc = (json, hasDeathElement) => ({
        getElementById: id => (id === '__NEXT_DATA__' ? { textContent:json } : null),
        querySelector: () => (hasDeathElement ? {} : null),
    });
    const birth = '"birthDate":{"date":"1930-08-05"}';

    // IMDb's own rendered death markers are authoritative and cost nothing to read.
    assert.strictEqual(hooks.readPersonBirthDate(makeDoc(`{${birth}}`, true)).deceased, true,
        'a rendered death date must be believed even when the payload says nothing');

    /* The old check sliced a fixed 200,000-character prefix, so a payload whose
       deathStatus sat beyond it reported a dead person as living. */
    const far = `{${birth},"pad":"${'x'.repeat(250000)}","deathStatus":"DEAD"}`;
    assert.strictEqual(hooks.readPersonBirthDate(makeDoc(far, false)).deceased, true,
        'deathStatus beyond the first 200KB must still be found');

    const alive = `{${birth},"deathStatus":"ALIVE"}`;
    assert.strictEqual(hooks.readPersonBirthDate(makeDoc(alive, false)).deceased, false);
    assert.strictEqual(hooks.readPersonBirthDate(makeDoc(alive, false)).iso, '1930-08-05');
    assert.strictEqual(hooks.readPersonBirthDate(makeDoc('{"noBirth":1}', false)), null);
    assert(!script.includes('text.slice(0, 200000)'), 'the fixed prefix scan should be gone');
});

test('episode discovery requires an episode code on every path', () => {
    const hooks = loadScriptTestHooks();
    assert(hooks.EPISODE_CODE_PATTERN.test('S1.E3 Pilot'), 'a normal episode code should match');
    assert(hooks.EPISODE_CODE_PATTERN.test('s12 . e4'), 'spacing variants should match');
    assert(!hooks.EPISODE_CODE_PATTERN.test('The Matrix Reloaded 7.2'), 'a recommendation card is not an episode');
    assert(!hooks.EPISODE_CODE_PATTERN.global, 'a shared pattern must not carry lastIndex between calls');

    /* The ancestor walk demanded an episode code; its fallback did not, so any <li>
       with a rating — recommendations, shovelers — could enter the episode set. */
    const walk = script.slice(script.indexOf('_findEpisodeCard(anchor) {'), script.indexOf('_findPlot(card) {'));
    assert(walk.includes('EPISODE_CODE_PATTERN.test(card.textContent'), 'the fallback must require an episode code too');
    assert(!/return anchor\.closest\('\[data-testid\*="episode" i\], article, li'\);/.test(walk),
        'the unguarded fallback return must be gone');
});

test('title page actions survive without any watch destination', () => {
    /* The editorial layout hides IMDb's hero, so the stand-ins for Rate and Add to
       watchlist have to belong to that feature. Owning them from searchButtons meant
       turning off Watch buttons — or hiding every watch site, which returns early at
       `if (!sites.length)` — left the page with no rating or watchlist control. */
    const surface = script.slice(
        script.indexOf("key: 'editorialTitleSurface'"),
        script.indexOf("key: 'compactHeader'"));
    assert(surface.includes('createTitlePageActions()'), 'the surface that hides the hero must mount the replacement actions');
    assert(surface.includes('enh-editorial-native-hidden'), 'this test should still be guarding the feature that hides the native hero');

    const watchButtons = script.slice(
        script.indexOf("key: 'searchButtons'"),
        script.indexOf("key: 'externalLinks'"));
    assert(watchButtons.includes('if (!sites.length) return;'), 'the early return this protects against should still exist');
    assert(!watchButtons.includes("'Add to watchlist'"), 'the watchlist action must not depend on the watch-site list');
    assert(!watchButtons.includes("}, 'Rate'"), 'the rate action must not depend on the watch-site list');

    // Teardown must be symmetric: the stand-ins go when the native hero comes back,
    // and the watch button goes with its own feature even from a dock it does not own.
    assert(surface.includes(".enh-title-page-actions')?.remove()"), 'page actions must be removed when the native hero returns');
    assert(watchButtons.includes("getElementById('enh-primary-watch-btn')?.remove()"), 'the primary watch button must be removed from a shared dock');
    assert(watchButtons.includes("getElementById('enh-watch-label')?.remove()"), 'the watch heading must be removed from a shared dock');
});

test('every registered feature is reachable from the settings workspace', () => {
    const hooks = loadScriptTestHooks();
    /* makeFeatureCard resolves its keys with features.find(...).filter(Boolean), so a
       key that is never listed is dropped in silence rather than erroring — which is
       how a default-on feature shipped with no way to turn it off. */
    const panel = script.slice(
        script.indexOf('function createSettingsPanel()'),
        script.indexOf('function createFAB()'));
    assert(panel.length > 1000, 'the settings panel source should be locatable');
    hooks.getFeatureKeys().forEach(key => {
        assert(panel.includes(`'${key}'`), `${key} has no control in the settings workspace`);
        assert(hooks.FEATURE_DETAILS[key], `${key} has no description for its settings row`);
    });
});

test('version strings match', () => {
    const metaVersion = script.match(/@version\s+(\S+)/)?.[1];
    const constVersion = script.match(/const VERSION\s*=\s*'([^']+)'/)?.[1];
    assert(metaVersion, 'metadata @version must exist');
    assert.strictEqual(metaVersion, constVersion, `version mismatch: @version=${metaVersion} vs VERSION=${constVersion}`);
    assert.strictEqual(packageJson.version, metaVersion, 'package.json version must match userscript version');
    assert(readme.includes(`badge/version-${metaVersion}-blue`), 'README version badge must match userscript version');
});

test('retired watch-site domains stay removed', () => {
    /* cineby.at is not in this list because the schema-3 migration legitimately names
       it while scrubbing stored rows; a dedicated test below pins its removal from the
       defaults, catalog, and metadata instead. */
    const deadDomains = [
        'popcornmovies.org', 'xprime.su', 'aether.mom',
        'cineby.sc', 'cineby.gd', 'cineby.app', 'cinevids.site',
        'streamxtv.tech', 'livnet.pages.dev', 'uflix.to', 'flixmomo.app',
        'movies2watch.vc', 'watchluna.com', '1movies.stream',
        /* Both answered 200 while redirecting onto the retiring Cineby domain, which the
           destination health report caught and a status check never would. */
        'fmovies.gd', 'cineplay.to',
    ];
    deadDomains.forEach(domain => {
        assert(!script.includes(domain), `dead domain ${domain} should be removed`);
    });
    assert(!script.includes('yts.mx'), 'DNS-dead expanded destinations should stay removed');
    assert(!script.includes('metacritic.com/search/all/'), 'retired Metacritic search paths should stay removed');
    assert(!script.includes("u:'http://www.allmovie.com"), 'expanded external links should not downgrade to HTTP');
});

test('watch links avoid unreliable background origin probes', () => {
    assert(!script.includes('probeSiteHealth'), 'favicon health probes should stay removed');
    assert(!script.includes('_probeButtons'), 'watch buttons should not launch background health requests');
    assert(!script.includes('/favicon.ico?'), 'watch-site origins must not receive automatic favicon probes');
    assert(script.includes("const legacySiteHealthKey = PREFIX + 'siteHealth'"), 'legacy health cache cleanup missing');
});

test('current Sonarr integration excludes retired language profiles', () => {
    const hooks = loadScriptTestHooks();
    assert.strictEqual(
        (script.match(/sonarrLanguageProfileId/g) || []).length,
        1,
        'the retired Sonarr setting should remain only as an orphaned-storage cleanup key'
    );
    assert(!/languageProfileId:\s*cfg\./.test(script), 'current Sonarr add payloads must not send a no-op language profile');
    hooks.seedRawStorage('imdb_enh_sonarrLanguageProfileId', '7');
    hooks.cacheGC(true);
    assert(!hooks.getStorageKeys().includes('imdb_enh_sonarrLanguageProfileId'), 'retired stored language-profile IDs should be cleaned up');
});

test('custom site templates require complete HTTP or HTTPS URLs', () => {
    const hooks = loadScriptTestHooks();
    assert.strictEqual(hooks.normalizeUrlTemplate('https://example.com/search?q={{TITLE}}'), 'https://example.com/search?q={{TITLE}}');
    assert.strictEqual(hooks.normalizeUrlTemplate('http://localhost:8080/search'), 'http://localhost:8080/search');
    assert.strictEqual(hooks.normalizeUrlTemplate('https://'), '');
    assert.strictEqual(hooks.normalizeUrlTemplate('https:\\example.com\\search'), '', 'backslash-style URLs must not bypass authority validation');
    assert.strictEqual(hooks.normalizeUrlTemplate('javascript:alert(1)'), '');
    assert.strictEqual(hooks.normalizeUrlTemplate('file:///tmp/search'), '');
    assert.strictEqual(hooks.normalizeUrlTemplate('https://user:secret@example.com/search'), '');
    assert.strictEqual(
        hooks.normalizeUrlTemplate('https://{{TITLE}}.example.com/search'),
        '',
        'page-derived template values must not control the destination origin'
    );
    assert.strictEqual(
        hooks.normalizeUrlTemplate('https://example.com/search?q={{TITEL}}'),
        '',
        'unknown template-token typos must not save as silently empty values'
    );
    assert.strictEqual(hooks.normalizeUrlTemplate('https://example.com/{{title}}'), '', 'lowercase unknown tokens must be rejected');
    assert.strictEqual(hooks.normalizeUrlTemplate('https://example.com/{{TITLE_RAW}}'), 'https://example.com/{{TITLE_RAW}}');
    assert.strictEqual(hooks.normalizeUrlTemplate(`https://example.com/${'a'.repeat(4090)}`), '', 'oversized URL templates must be rejected');
    assert.strictEqual(hooks.normalizeSite({ name:'Broken', url:'https://' }), null);
    assert.strictEqual(
        hooks.normalizeSite({ name:'Legacy Cineby', url:'https://www.cineby.at/', storeQuery:true }).storeQuery,
        undefined,
        'the retired storeQuery transport flag must be stripped from imported and stored rows'
    );
    assert.strictEqual(
        hooks.normalizeSite({ name:'Edited Letterboxd', url:'https://www.themoviedb.org/search?query={{TITLE}}', movieOnly:true }).movieOnly,
        undefined,
        'editing the Letterboxd row to another service must remove its invisible movie-only scope'
    );
    const letterboxd = hooks.normalizeSite({ name:'Letterboxd', url:'https://letterboxd.com/imdb/{{IMDB_ID}}/' });
    assert.strictEqual(letterboxd.movieOnly, true, 'Letterboxd custom/default links should remain movie-scoped');
    assert.deepStrictEqual(
        Array.from(hooks.filterSitesForMediaType([letterboxd, { name:'TMDB' }], true), site => site.name),
        ['TMDB'],
        'movie-only external sites should stay off TV title pages'
    );
    assert(script.includes("if (cat === 'Movie Sites' && isTVType()) continue"), 'expanded movie-only links should stay off TV pages');
    assert(script.includes("url:'https://www.themoviedb.org/search?query={{TITLE}}'"), 'default TMDB search should cover movies and TV');
    const oversizedSites = Array.from({ length:hooks.SITE_LIST_LIMIT + 10 }, (_, index) => ({
        name:`Site ${index}`, url:`https://example.com/${index}?q={{TITLE}}`, color:'#6366f1',
    }));
    hooks.seedStoredSetting('watchSites', oversizedSites);
    assert.strictEqual(hooks.getSiteList('watchSites', []).length, hooks.SITE_LIST_LIMIT, 'runtime custom-site lists must honor the import/UI bound');
    assert(script.includes('add.disabled = total >= SITE_LIST_LIMIT'), 'site editor should expose the destination limit before adding another row');
});

test('site destinations support purpose, visibility, and ordering metadata', () => {
    const hooks = loadScriptTestHooks();
    assert.strictEqual(hooks.normalizeSiteCategory('reviews'), 'reviews');
    assert.strictEqual(hooks.normalizeSiteCategory('unknown', 'watch'), 'watch');
    const hidden = hooks.normalizeSite({
        name:'Hidden review',
        url:'https://reviews.example/search?q={{TITLE}}',
        category:'reviews',
        enabled:false,
    });
    assert.strictEqual(hidden.category, 'reviews');
    assert.strictEqual(hidden.enabled, false);
    const groups = hooks.groupSitesByCategory([
        { name:'Watch A', category:'watch' },
        { name:'Review A', category:'reviews' },
        { name:'Watch B', category:'watch' },
    ]);
    assert.strictEqual(
        JSON.stringify(groups.map(group => [group.category, Array.from(group.sites, site => site.name)])),
        JSON.stringify([['watch', ['Watch A', 'Watch B']], ['reviews', ['Review A']]]),
        'site grouping should preserve category and configured order'
    );
    [
        'https://www.rivestream.app/search?q={{TITLE}}',
        'https://cinejoy.to/search?q={{TITLE}}',
        'https://www.movy.bz/browse?q={{TITLE}}',
        'https://flixer.su/search?q={{TITLE}}',
        'https://watch.corsflix.net/search?q={{TITLE}}',
        'https://shuttletv.su/search?q={{TITLE}}',
        'https://zstream.mov/search?q={{TITLE}}',
        'https://aether.ist/search?q={{TITLE}}',
        'https://www.1shows.org/search?q={{TITLE}}',
        'https://cinemaos.live/search?q={{TITLE}}',
        'https://hydrahd.ws/search?q={{TITLE}}',
        'https://cinestream.kje.us/search?q={{TITLE}}',
        'https://bingr.one/search?q={{TITLE}}',
        'https://www.lookmovie2.to/movies/search/?q={{TITLE}}',
        'https://cine.su/en/search',
    ].forEach(url => assert(script.includes(url), `${url} should be available in the default watch destinations`));
    /* Hiding a destination has to hide it everywhere it is offered — the control says
       "on IMDb pages", and collection pages are IMDb pages. Assert both consumers of
       watchSites filter, not just the title-page one. */
    ['searchButtons', 'listMultiSearch'].forEach(key => {
        const feature = script.slice(script.indexOf(`key: '${key}'`), script.indexOf(`key: '${key}'`) + 2500);
        assert(/getSiteList\('watchSites', DEFAULT_WATCH_SITES\)[\s\S]{0,200}?filter\(site => site\.enabled !== false\)/.test(feature),
            `${key} must honour per-destination visibility`);
    });
    assert(script.includes("dataset:{ field:'category' }"), 'site editors should expose category selection');
    assert(script.includes("dataset:{ field:'enabled' }"), 'site editors should expose per-destination visibility');
    assert(script.includes("dataset:{ action:'up' }"), 'site editors should expose destination ordering');

    /* The header row and every data row share one grid template, so their cell order
       is a single contract: transposing two cells both mislabels the fields and gives
       a column the track width sized for a different one. Compare the two sequences
       rather than pinning either of them literally. */
    const headerLabels = script
        .slice(script.indexOf("className:'enh-site-editor__columns'"))
        .split('\n')
        .slice(0, 9)
        .map(line => line.match(/makeEl\('span', \{\}, '([^']+)'\)/)?.[1])
        .filter(Boolean);
    const cellOrder = script
        .slice(script.indexOf('row.appendChild(visibility);'))
        .split('\n')
        .slice(0, 7)
        .map(line => line.match(/row\.appendChild\((\w+)\)/)?.[1])
        .filter(Boolean);
    const cellToColumn = {
        visibility:'Visible', nameInput:'Name', categoryInput:'Purpose',
        urlInput:'URL template', colorInput:'Color', order:'Move', remove:'Remove',
    };
    assert.strictEqual(headerLabels.length, 7, 'the editor should declare seven columns');
    assert.strictEqual(
        JSON.stringify(cellOrder.map(cell => cellToColumn[cell])),
        JSON.stringify(headerLabels),
        'site editor cells must appear in the same order as the column headers');
});

test('third-party response links stay on trusted HTTPS domains', () => {
    const hooks = loadScriptTestHooks();
    const fallback = 'https://letterboxd.com/imdb/tt0133093/';
    assert.strictEqual(
        hooks.normalizeTrustedUrl('https://letterboxd.com/film/the-matrix/', 'letterboxd.com', fallback),
        'https://letterboxd.com/film/the-matrix/'
    );
    assert.strictEqual(
        hooks.normalizeTrustedUrl('https://user:secret@letterboxd.com/film/the-matrix/', 'letterboxd.com', fallback),
        fallback,
        'trusted-domain response links must still reject embedded credentials'
    );
    assert.strictEqual(
        hooks.normalizeTrustedUrl('https://boxd.it/abc', 'letterboxd.com', fallback),
        fallback,
        'unlisted redirect domains should not cross the render trust boundary'
    );
    assert.strictEqual(hooks.normalizeTrustedUrl('javascript:alert(1)', 'letterboxd.com', fallback), fallback);
    assert.strictEqual(hooks.normalizeTrustedUrl('http://letterboxd.com/film/test/', 'letterboxd.com', fallback), fallback);
    assert.strictEqual(hooks.normalizeTrustedUrl('https://letterboxd.com.evil.test/', 'letterboxd.com', fallback), fallback);
    assert(!script.includes('href="${data.url'), 'external response URLs must not be interpolated into HTML');
    assert(!script.includes('titleAttr.replace'), 'external consensus text must not be interpolated into HTML attributes');
    ['letterboxd.com', 'metacritic.com', 'justwatch.com'].forEach(domain => {
        assert(script.includes(`normalizeTrustedUrl(data.url, '${domain}'`), `${domain} render allowlist missing`);
    });
});

test('new-tab handoffs suppress opener and referrer data', () => {
    assert(!script.includes("rel:'noopener'"), 'compact code-built links should include noreferrer');
    assert(!script.includes("rel: 'noopener'"), 'spaced code-built links should include noreferrer');
    assert(!script.includes('rel="noopener"'), 'HTML-built links should include noreferrer');
    assert((script.match(/noopener noreferrer/g) || []).length >= 15, 'external handoffs should use the shared privacy relationship');
});

test('Rotten Tomatoes search fallback requires an exact title and year', () => {
    const hooks = loadScriptTestHooks();
    const html = `
        <search-page-media-row release-year="1999" tomatometer-score="83">
            <a href="https://www.rottentomatoes.com/m/matrix" slot="title"> The Matrix </a>
        </search-page-media-row>
        <search-page-media-row release-year="2021" tomatometer-score="63">
            <a href="https://www.rottentomatoes.com/m/the_matrix_resurrections" slot="title">The Matrix Resurrections</a>
        </search-page-media-row>
        <search-page-media-row start-year="1993" tomatometer-score="55">
            <a href="https://www.rottentomatoes.com/tv/matrix" slot="title">The Matrix</a>
        </search-page-media-row>`;
    const result = hooks.parseRTSearchResult(html, 'The Matrix', 1999, 'movie');
    assert(result, 'exact movie result should be parsed');
    assert.strictEqual(result.tomatometer, 83);
    assert.strictEqual(result.url, 'https://www.rottentomatoes.com/m/matrix');
    assert.strictEqual(hooks.parseRTSearchResult(html, 'The Matrix', 2021, 'movie'), null, 'a different title must not satisfy a matching year');
    assert.strictEqual(hooks.parseRTSearchResult(html, 'The Matrix', 1993, 'tv').tomatometer, 55, 'movie and TV results must stay separated');
    assert.strictEqual(hooks.parseRTSearchResult(html, 'Matrix', 1999, 'movie'), null, 'partial title matches must be rejected');
    assert.strictEqual(
        hooks.parseRTSearchResult('<search-page-media-row tomatometer-score="92"><a slot="title" href="https://www.rottentomatoes.com/m/amelie">Amelie</a></search-page-media-row>', 'Amélie', 2001, 'movie'),
        null,
        'a missing result year must not satisfy a year-qualified IMDb title'
    );
    assert.strictEqual(hooks.normalizeLookupTitle('Amélie'), hooks.normalizeLookupTitle('Amelie'), 'accent variants should retain title identity');
    assert(!script.includes('responseText.match(/"tomatoScore"'), 'unscoped first-score fallback should stay removed');
});

test('Rotten Tomatoes direct slugs require detail-page identity', () => {
    const hooks = loadScriptTestHooks();
    const html = `<script type="application/ld+json">${JSON.stringify({
        '@type':'Movie', name:'The Matrix', dateCreated:'1999-03-31',
        url:'https://www.rottentomatoes.com/m/matrix',
        aggregateRating:{ ratingValue:'83' },
    })}</script><div data-qa="critics-consensus">A genre-defining classic.</div>`;
    const result = hooks.parseRTDetailPage(html, 'The Matrix', 1999, 'movie', 'https://www.rottentomatoes.com/m/the_matrix');
    assert.strictEqual(result.tomatometer, 83);
    assert.strictEqual(result.url, 'https://www.rottentomatoes.com/m/matrix');
    assert.strictEqual(hooks.parseRTDetailPage(html, 'Matrix', 1999, 'movie', ''), null, 'a plausible slug must not replace exact title identity');
    assert.strictEqual(hooks.parseRTDetailPage(html, 'The Matrix', 2021, 'movie', ''), null, 'a remake year must not reuse another film score');
    assert.strictEqual(hooks.parseRTDetailPage(html, 'The Matrix', 1999, 'tv', ''), null, 'movie detail data must not satisfy a TV lookup');
    assert(!script.includes('getRTSlugCandidates'), 'Rotten Tomatoes should not probe speculative title slugs');
    assert(script.includes('parseRTDetailPage(detailRes.responseText'), 'search-selected detail pages should still be identity validated');
});

test('Letterboxd IMDb lookups retain movie identity and bounded scores', () => {
    const hooks = loadScriptTestHooks();
    const fallback = 'https://letterboxd.com/imdb/tt0133093/';
    const html = `<script type="application/ld+json">${JSON.stringify({
        '@type':'Movie', name:'The Matrix', dateCreated:'1999-03-24',
        url:'https://letterboxd.com/film/the-matrix/',
        aggregateRating:{ ratingValue:'4.18', ratingCount:3007846 },
    })}</script>`;
    const result = hooks.parseLetterboxdDetailPage(html, 'The Matrix', 1999, fallback);
    assert.strictEqual(result.score, 4.18);
    assert.strictEqual(result.ratingCount, 3007846);
    assert.strictEqual(result.url, 'https://letterboxd.com/film/the-matrix/');
    assert.strictEqual(hooks.parseLetterboxdDetailPage(html, 'Matrix', 1999, fallback), null);
    assert.strictEqual(hooks.parseLetterboxdDetailPage(html, 'The Matrix', 2021, fallback), null);
    assert.strictEqual(hooks.boundedScore('5.01', 5), null);
    assert.strictEqual(hooks.boundedScore('4.2', 5), 4.2);
});

test('Metacritic lookup selection requires exact title, type, and year context', () => {
    const hooks = loadScriptTestHooks();
    const items = [
        { title:'The Thing', releaseDate:'2011-10-14', type:'movie' },
        { title:'The Thing', releaseDate:'1982-06-25', type:'movie' },
        { title:'The Thing', releaseDate:'2005-01-01', type:'show' },
        { title:'Thing', releaseDate:'1982-01-01', type:'movie' },
    ];
    assert.strictEqual(hooks.selectMetacriticResult(items, 'The Thing', 1982, 'movie'), items[1]);
    assert.strictEqual(hooks.selectMetacriticResult(items, 'The Thing', 2005, 'tv'), items[2]);
    assert.strictEqual(hooks.selectMetacriticResult(items, 'The Thing', 1995, 'movie'), null, 'remake results must not cross years');
    assert.strictEqual(hooks.selectMetacriticResult(items, 'Thing', 2011, 'movie'), null, 'different exact titles must not be substituted by year');
    assert.strictEqual(
        hooks.selectMetacriticResult([{ title:'The Thing', type:'movie' }], 'The Thing', 1982, 'movie'),
        null,
        'a missing result year must not satisfy a year-qualified IMDb title'
    );
    assert(!script.includes('const best = items[0]'), 'first-result Metacritic selection should stay removed');
});

test('JustWatch direct and fallback pages preserve title identity', () => {
    const hooks = loadScriptTestHooks();
    const searchHtml = `
        <a href="https://www.justwatch.com/us/movie/the-thing-1982" class="title-list-row__column-header">
            <span class="header-title">The Thing</span><span class="header-year">(1982)</span>
        </a>
        <a class="title-list-row__column-header" href="https://www.justwatch.com/us/movie/the-thing">
            <span class="header-title">The Thing</span><span class="header-year">(2011)</span>
        </a>
        <a href="https://www.justwatch.com/us/tv-show/the-thing" class="title-list-row__column-header">
            <span class="header-title">The Thing</span><span class="header-year">(2005)</span>
        </a>`;
    assert.strictEqual(
        hooks.parseJustWatchSearchResult(searchHtml, 'The Thing', 1982, 'movie'),
        'https://www.justwatch.com/us/movie/the-thing-1982'
    );
    assert.strictEqual(hooks.parseJustWatchSearchResult(searchHtml, 'The Thing', 1995, 'movie'), '');
    assert.strictEqual(
        hooks.parseJustWatchSearchResult('<a href="/us/movie/the-thing" class="title-list-row__column-header"><span class="header-title">The Thing</span></a>', 'The Thing', 1982, 'movie'),
        '',
        'a missing result year must not satisfy a year-qualified IMDb title'
    );
    assert.strictEqual(
        hooks.parseJustWatchSearchResult(searchHtml, 'The Thing', 2005, 'tv-show'),
        'https://www.justwatch.com/us/tv-show/the-thing'
    );

    const movieIdentity = hooks.parseJustWatchIdentity(`
        <script type="application/ld+json">{"@type":"Movie","name":"The Thing","dateCreated":"1982-06-25"}</script>`);
    assert.strictEqual(movieIdentity.title, 'The Thing');
    assert.strictEqual(movieIdentity.year, 1982);
    assert.strictEqual(movieIdentity.type, 'movie');
    const providers = hooks.collectJustWatchProviderNames({ offers:[
        { offeredBy:{ name:'Netflix' } },
        { offeredBy:[{ name:'Max' }, { name:'netflix' }] },
    ] });
    assert.deepStrictEqual(Array.from(providers), ['Netflix', 'Max']);
    const cachedProviders = Array.from({ length:52 }, (_, index) => `Provider ${index} ${'x'.repeat(150)}`);
    cachedProviders[1] = cachedProviders[0].toUpperCase();
    const compacted = hooks.compactProviders(cachedProviders);
    assert.strictEqual(compacted.providers.length, 2);
    assert(compacted.providers.every(name => name.length <= 120), 'cached provider labels should be bounded at render time');
    assert.strictEqual(compacted.extra, 47, 'provider compaction should inspect only 50 cached entries and deduplicate them');
    const excessive = hooks.collectJustWatchProviderNames({
        offers:Array.from({ length:75 }, (_, index) => ({ offeredBy:{ name:`Provider ${index}` } })),
    });
    assert.strictEqual(excessive.length, 50, 'provider traversal should enforce its output budget');
    const detailIdentity = JSON.stringify({ '@type':'Movie', name:'The Thing', dateCreated:'1982-06-25' });
    const providerScript = index => `<script type="application/ld+json">${JSON.stringify({ offers:[{
        offeredBy:{ name:`Provider ${index}` },
    }] })}</script>`;
    const excessiveScripts = `<script type="application/ld+json">${detailIdentity}</script>`
        + Array.from({ length:49 }, (_, index) => providerScript(index)).join('')
        + providerScript(50);
    const availability = hooks.parseJustWatchAvailability(
        excessiveScripts,
        'https://www.justwatch.com/us/movie/the-thing-1982',
        { title:'The Thing', year:1982, typePath:'movie' }
    );
    assert(availability, 'bounded provider parsing should retain data inside the script budget');
    assert(!availability.providers.includes('Provider 50'), 'provider extraction must stop after its script budget');
    const oversizedDescription = `<meta name="description" content="Watch The Thing online on ${Array.from(
        { length:75 }, (_, index) => `Meta Provider ${index}`
    ).join(', ')} today"><script type="application/ld+json">${detailIdentity}</script>`;
    assert(
        hooks.parseJustWatchAvailability(
            oversizedDescription,
            'https://www.justwatch.com/us/movie/the-thing-1982',
            { title:'The Thing', year:1982, typePath:'movie' }
        ).providers.length <= 13,
        'meta-description providers should be capped before display compaction'
    );
    assert(!script.includes('_firstDetailPath'), 'first-path JustWatch fallback should stay removed');
    assert(!script.includes('_collectProviderNames'), 'recursive provider traversal should stay removed');
});

test('third-party search and structured-data parsers enforce finite scan budgets', () => {
    const hooks = loadScriptTestHooks();
    assert.strictEqual(hooks.toBoundedText('12345', 4), '', 'oversized text must be rejected before parsing');
    assert.strictEqual(hooks.toBoundedText('1234', 4), '1234');
    assert.throws(
        () => hooks.parseJSONResponse({ responseText:'{"payload":"too large"}' }, 10),
        /too large/,
        'oversized local JSON must be rejected before JSON.parse'
    );
    const rtNoise = Array.from({ length:100 }, (_, index) => `
        <search-page-media-row release-year="2000" tomatometer-score="50">
            <a slot="title" href="https://www.rottentomatoes.com/m/noise_${index}">Noise ${index}</a>
        </search-page-media-row>`).join('');
    const rtMatch = `
        <search-page-media-row release-year="1999" tomatometer-score="83">
            <a slot="title" href="https://www.rottentomatoes.com/m/matrix">The Matrix</a>
        </search-page-media-row>`;
    assert.strictEqual(hooks.parseRTSearchResult(rtNoise + rtMatch, 'The Matrix', 1999, 'movie'), null);

    const justWatchNoise = Array.from({ length:100 }, (_, index) => `
        <a class="title-list-row__column-header" href="/us/movie/noise-${index}">
            <span class="header-title">Noise ${index}</span><span class="header-year">(2000)</span>
        </a>`).join('');
    const justWatchMatch = `
        <a class="title-list-row__column-header" href="/us/movie/the-matrix">
            <span class="header-title">The Matrix</span><span class="header-year">(1999)</span>
        </a>`;
    assert.strictEqual(hooks.parseJustWatchSearchResult(justWatchNoise + justWatchMatch, 'The Matrix', 1999), '');

    const metacriticItems = Array.from({ length:100 }, (_, index) => ({
        title:`Noise ${index}`, type:'movie', releaseDate:'2000-01-01',
    }));
    metacriticItems.push({ title:'The Matrix', type:'movie', releaseDate:'1999-03-31' });
    assert.strictEqual(hooks.selectMetacriticResult(metacriticItems, 'The Matrix', 1999), null);

    const emptyScripts = '<script type="application/ld+json">{}</script>'.repeat(50);
    const rtDetail = `<script type="application/ld+json">${JSON.stringify({
        '@type':'Movie', name:'The Matrix', dateCreated:'1999-03-31', aggregateRating:{ ratingValue:83 },
    })}</script>`;
    assert.strictEqual(hooks.parseRTDetailPage(emptyScripts + rtDetail, 'The Matrix', 1999), null);
    assert.strictEqual(hooks.parseJustWatchIdentity(emptyScripts + `<script type="application/ld+json">${JSON.stringify({
        '@type':'Movie', name:'The Matrix', dateCreated:'1999-03-31',
    })}</script>`), null);
    assert.strictEqual(
        hooks.parseJustWatchAvailability(
            emptyScripts + rtDetail,
            'https://www.justwatch.com/us/movie/the-matrix',
            { title:'The Matrix', year:1999, typePath:'movie' }
        ),
        null,
        'availability parsing must share the structured-data script budget'
    );
    const oversizedExternalTypes = Array(21).fill('Thing');
    oversizedExternalTypes[20] = 'Movie';
    const oversizedTypeDetail = `<script type="application/ld+json">${JSON.stringify({
        '@type':oversizedExternalTypes,
        name:'The Matrix',
        dateCreated:'1999-03-31',
        aggregateRating:{ ratingValue:4.5, ratingCount:1000 },
    })}</script>`;
    assert.strictEqual(hooks.parseRTDetailPage(oversizedTypeDetail, 'The Matrix', 1999), null, 'RT type classification should stay bounded');
    assert.strictEqual(hooks.parseLetterboxdDetailPage(oversizedTypeDetail, 'The Matrix', 1999), null, 'Letterboxd type classification should stay bounded');
    assert.strictEqual(hooks.parseJustWatchIdentity(oversizedTypeDetail), null, 'JustWatch type classification should stay bounded');
    [
        'parseYouTubeTrailerVideoId', 'parseRTSearchResult', 'parseRTDetailPage',
        'parseLetterboxdDetailPage', 'parseJustWatchSearchResult', 'parseJustWatchIdentity',
        'parseJustWatchAvailability',
    ].forEach(name => assert(
        new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]{0,300}?toBoundedText\\(`).test(script),
        `${name} must reject oversized response text before regex or JSON work`
    ));
});

test('list multi-search builds a popup-safe link queue', () => {
    const hooks = loadScriptTestHooks();
    const titleLinks = [
        { href:'https://www.imdb.com/title/tt0133093/', textContent:'', querySelector:() => null },
        { href:'https://www.imdb.com/title/tt0133093/', textContent:'17. The Matrix', querySelector:() => null },
    ];
    assert.deepStrictEqual(
        Array.from(hooks.getListTitlesFromLinks(titleLinks), entry => ({ ...entry })),
        [{ id:'tt0133093', name:'The Matrix' }],
        'an empty poster link must not consume the title ID, and chart rank must not pollute the title query'
    );
    const manyLinks = Array.from({ length:25 }, (_, index) => ({
        href:`https://www.imdb.com/title/tt${String(index + 1).padStart(7, '0')}/`,
        textContent:`Title ${index + 1}`,
        querySelector:() => null,
    }));
    assert.strictEqual(hooks.getListTitlesFromLinks(manyLinks).length, 20, 'title extraction should stop once the queue is full');
    assert.deepStrictEqual(
        Array.from(hooks.getListTitleIdsFromLinks(manyLinks.slice(0, 2))),
        ['tt0000001', 'tt0000002'],
        'batch ID extraction should preserve first-seen order'
    );
    assert(/function getListTitlesFromLinks[\s\S]*?inspected >= COLLECTION_LINK_SCAN_LIMIT/.test(script), 'list title discovery needs a finite link-scan budget');
    assert(/function getListTitleIdsFromLinks[\s\S]*?inspected >= COLLECTION_LINK_SCAN_LIMIT/.test(script), 'batch ID discovery needs a finite link-scan budget');
    const titles = Array.from({ length: 24 }, (_, index) => ({
        id:`tt${String(index + 1).padStart(7, '0')}`,
        name:`Title ${index + 1}`,
    }));
    const entries = hooks.buildListSearchEntries({
        name:'Search',
        url:'https://example.com/?q={{TITLE}}&id={{IMDB_ID}}',
    }, titles);
    assert.strictEqual(entries.length, 20, 'queue should cap visible titles at 20');
    assert.strictEqual(entries[0].url, 'https://example.com/?q=Title%201&id=tt0000001');
    assert(!script.includes("window.open(url, '_blank'"), 'timer-driven popup loop should stay removed');
    assert(!script.includes('setTimeout(r, 800)'), 'delayed popup loop should stay removed');
    [
        'enh-multi-search-queue',
        'Browsers allow one new tab per click.',
        'Copy all links',
        'Open next',
        "target:'_blank', rel:'noopener noreferrer'",
    ].forEach(token => assert(script.includes(token), `${token} missing from popup-safe queue`));
});

test('Trakt links use the current web-app search route', () => {
    assert(script.includes('https://app.trakt.tv/search?query='), 'current Trakt search route missing');
    assert(!script.includes('trakt.tv/search/imdb/'), 'retired Trakt IMDb route should not return');
});

test('built-in lookup links do not duplicate IMDb ID prefixes', () => {
    assert(!/tt\{\{ID\}\}/.test(script), 'built-in templates must not prepend tt to a full IMDb ID');
    assert(!/tt\$\{imdbId\}/.test(script), 'runtime links must not prepend tt to a full IMDb ID');
    assert(script.includes("imdbId.replace(/^tt/, '')"), 'numeric-only lookup routes should strip the tt prefix explicitly');
});

test('Cineby stays retired outside the migration that scrubs it', () => {
    assert(!script.includes('@match        https://www.cineby.at/*'), 'the retired Cineby route must not be matched');
    assert(!script.includes('handleCineby'), 'the Cineby auto-fill surface should be gone');
    assert(!script.includes('storeCinebyQuery'), 'the Cineby handoff writer should be gone');
    assert(!script.includes('cinebyHost:'), 'the Cineby host preference should not ship in defaults');
    const defaultsBlock = script.match(/const DEFAULT_WATCH_SITES = \[[\s\S]*?\n    \];/)?.[0] || '';
    assert(defaultsBlock, 'the default watch-site constant should exist');
    assert(!/cineby/i.test(defaultsBlock), 'Cineby must not be a default watch destination');
    const catalogBlock = script.match(/const FMHY_WATCH_CATALOG = \[[\s\S]*?\n    \];/)?.[0] || '';
    assert(catalogBlock, 'the FMHY catalog constant should exist');
    assert(!/cineby\.at/.test(catalogBlock), 'Cineby must not be offered by the catalog');
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extension', 'manifest.json'), 'utf8'));
    assert(!JSON.stringify(manifest).includes('cineby'), 'the extension manifest must not request Cineby access');
    const background = fs.readFileSync(path.join(root, 'extension', 'background.js'), 'utf8');
    assert(!background.includes('cineby'), 'the extension background allowlist must not include Cineby');
    assert(!/cineby/i.test(readme), 'the README must not document Cineby');
});

test('schema-3 migration scrubs Cineby leftovers from storage', () => {
    /* A stored site list is a snapshot of the defaults at the time the user first saved
       one, and the Cineby row's URL changed three times before it was retired. Matching
       only the newest hostname left every earlier snapshot with a dead row, and the
       migration runs once so it never gets a second chance. */
    const historicalUrls = [
        'https://www.cineby.at/',
        'https://www.cineby.at/search',
        'https://cineby.at/',
        'https://www.cineby.sc/search',
        'https://www.cineby.gd/search',
        'https://www.cineby.app/search',
    ];
    historicalUrls.forEach(url => {
        const hooks = loadScriptTestHooks();
        hooks.seedStoredSetting('settingsSchemaVersion', 2);
        hooks.seedStoredSetting('cinebyHost', 'https://www.cineby.at/');
        hooks.seedStoredSetting('cineby_query', JSON.stringify({ title:'Alien', ts:Date.now() }));
        hooks.seedRawStorage('movieTitle', 'Alien');
        hooks.seedStoredSetting('watchSites', [
            { name:'Cineby', url, color:'#6366f1', category:'watch', storeQuery:true },
            { name:'Kept', url:'https://example.com/search?q={{TITLE}}', color:'#10b981', category:'watch', storeQuery:true },
        ]);
        assert.strictEqual(hooks.runSettingsMigrations(), hooks.SETTINGS_SCHEMA_VERSION);
        assert.strictEqual(hooks.getStoredSetting('cinebyHost'), undefined, 'the host preference should be deleted');
        assert.strictEqual(hooks.getStoredSetting('cineby_query'), undefined, 'a pending handoff payload should be deleted');
        assert(!hooks.getStorageKeys().includes('movieTitle'), 'the legacy global handoff key should be deleted');
        const migrated = hooks.getStoredSetting('watchSites');
        assert.strictEqual(migrated.length, 1, `a stored Cineby row at ${url} survived the migration`);
        assert.strictEqual(migrated[0].name, 'Kept');
        assert(!('storeQuery' in migrated[0]), 'surviving rows should lose the retired transport flag');
    });

    // A lookalike domain is somebody else's site and must not be swept up.
    const lookalike = loadScriptTestHooks();
    lookalike.seedStoredSetting('settingsSchemaVersion', 2);
    lookalike.seedStoredSetting('watchSites', [
        { name:'CinebyTV', url:'https://cinebytv.com/', color:'#6366f1', category:'watch' },
        { name:'Not Cineby', url:'https://cineby.at.example.com/', color:'#6366f1', category:'watch' },
    ]);
    lookalike.runSettingsMigrations();
    assert.strictEqual(lookalike.getStoredSetting('watchSites').length, 2,
        'domains that merely contain the retired name must survive');

    // Restoring a pre-v2.15 backup must not put the dead destination back.
    const importing = loadScriptTestHooks();
    const prepared = importing.prepareSettingsImport({
        watchSites: [
            { name:'Cineby', url:'https://www.cineby.sc/search', color:'#6366f1', category:'watch' },
            { name:'Kept', url:'https://example.com/search?q={{TITLE}}', color:'#10b981', category:'watch' },
        ],
    });
    const restored = prepared.entries.find(entry => entry.key === 'watchSites');
    assert(restored, 'a watchSites list containing a retired row must still import, not be rejected wholesale');
    assert.strictEqual(restored.value.length, 1, 'an old backup must not resurrect the retired destination');
    assert.strictEqual(restored.value[0].name, 'Kept');
});

test('a manager without GM_deleteValue does not stall the migration chain', () => {
    /* The version marker only advances once every pending step succeeds, so a throw here
       is not a skipped migration — it is the same failure on every single load. */
    const hooks = loadScriptTestHooks({ withoutDeleteValue: true });
    hooks.seedStoredSetting('settingsSchemaVersion', 1);
    hooks.seedStoredSetting('cinebyHost', 'https://www.cineby.at/');
    assert.strictEqual(hooks.runSettingsMigrations(), hooks.SETTINGS_SCHEMA_VERSION,
        'migrations must complete without GM_deleteValue');
    assert.strictEqual(hooks.getStoredSetting('settingsSchemaVersion'), hooks.SETTINGS_SCHEMA_VERSION);
    assert(!hooks.getStoredSetting('cinebyHost'), 'the retired preference must still be cleared');
});

test('the FMHY catalog offers valid, unique, addable destinations', () => {
    const hooks = loadScriptTestHooks();
    const catalog = hooks.FMHY_WATCH_CATALOG;
    assert(Array.isArray(catalog) && catalog.length >= 5, 'the catalog should ship its wiki section groups');
    const names = new Set();
    let total = 0;
    catalog.forEach(group => {
        assert(typeof group.group === 'string' && group.group.trim(), 'every catalog group needs a label');
        assert(Array.isArray(group.sites) && group.sites.length, 'every catalog group needs sites');
        group.sites.forEach(site => {
            total += 1;
            const normalized = hooks.normalizeSite({ ...site, category:'watch' });
            assert(normalized, `catalog entry ${site.name} must survive site normalization`);
            assert.strictEqual(normalized.name, site.name, `catalog entry name ${site.name} must fit the stored length`);
            const lower = site.name.toLowerCase();
            assert(!names.has(lower), `catalog entry ${site.name} is duplicated`);
            names.add(lower);
        });
    });
    assert(total >= 150, `the catalog should carry the full FMHY streaming list (got ${total})`);
    assert(total <= hooks.SITE_LIST_LIMIT, 'every catalog entry must be addable within the site-list limit');
    /* save() validates every row, so an incomplete row left elsewhere in the editor also
       fails an Add. Blaming storage for that sends the user after the wrong thing. */
    const addHandler = script.slice(script.indexOf("className:'enh-site-catalog__add'"));
    assert(/lastSaveFailure === 'validation'[\s\S]{0,160}?incomplete site row/.test(addHandler.slice(0, 1600)),
        'a failed catalog add must distinguish an invalid row from a storage failure');
    /* Filtering hides entries with the hidden property. The UA stylesheet's [hidden]
       rule loses to the entry's own display declaration, so without this the filter
       leaves every entry of a matching group on screen. */
    assert(script.includes('.enh-site-catalog__entry[hidden] { display: none; }'),
        'filtered catalog entries need a hidden rule that outranks their display value');
});

test('default watch sites resolve to catalog services with live-checked routes', () => {
    const hooks = loadScriptTestHooks();
    const defaults = hooks.getDefaultSettingsEntries().find(entry => entry.key === 'watchSites').value;
    assert(defaults.length >= 12, 'a healthy default set should survive the FMHY refresh');
    const catalogNames = new Set();
    hooks.FMHY_WATCH_CATALOG.forEach(group => group.sites.forEach(site => catalogNames.add(site.name.toLowerCase())));
    defaults.forEach(site => {
        assert(catalogNames.has(site.name.toLowerCase()), `default ${site.name} should exist in the FMHY catalog`);
        assert(hooks.normalizeSite(site), `default ${site.name} must normalize cleanly`);
    });
});

test('settings preserve host scroll state and complete nested tab keyboard support', () => {
    assert(script.includes("previousDocumentOverflow = document.documentElement.style.overflow"), 'settings should capture the host page overflow value');
    assert(script.includes('document.documentElement.style.overflow = previousDocumentOverflow'), 'settings should restore the host page overflow value');
    assert(script.includes("if (event.key === 'Home') next = 0;"), 'nested tabs should support Home');
    assert(script.includes("if (event.key === 'End') next = ordered.length - 1;"), 'nested tabs should support End');
    assert(script.includes('enh-site-input--invalid'), 'invalid custom site fields need a visible state');
    assert(!script.includes("site.name || 'New site'"), 'adding a custom site must not persist a fake destination name');
    assert(!script.includes("site.url || 'https://example.com/search?q={{TITLE}}'"), 'example URLs must remain placeholders rather than live saved destinations');
    assert(script.includes("maxlength:'40'"), 'destination names should enforce their stored length in the editor');
    assert(script.includes('maxlength:String(URL_TEMPLATE_TEXT_LIMIT)'), 'destination URLs should enforce their stored length in the editor');
    assert(script.includes('{ maxlength:String(SETTING_TEXT_LIMIT) }'), 'integration text and credential fields should expose their storage bound');
    assert(script.includes("const row = makeEl('div', { className:'enh-site-row', role:'group' })"), 'each repeated destination row should expose group context');
    assert(script.includes("row.setAttribute('aria-label', `${destination} in ${title}`)"), 'destination groups should name their row and list');
    assert(script.includes("remove.setAttribute('aria-label', `Remove ${destination} from ${title}`)"), 'remove controls should follow edited destination names');
    assert(script.includes("nameInput.addEventListener('input', updateRowLabel)"), 'destination group names should follow row-name edits');
    assert(/className:'enh-settings-route-badge', role:'status', 'aria-live':'polite'/.test(script), 'destination counts should announce list changes');
    assert(script.includes("previous?.querySelector?.('[data-field=\"name\"]')"), 'successful destination removal should move focus to a surviving row');
    assert(script.includes('remove.focus();'), 'failed destination removal should restore focus to the reinserted control');
    assert(
        /onClick: \(\) => \{[\s\S]*?rows\.children\.length >= SITE_LIST_LIMIT[\s\S]*?const row = addRow\(\);\s*updateCount\(\);[\s\S]*?\.focus\(\);\s*\}/.test(script),
        'Add should create and focus an unsaved draft row'
    );
    assert(
        /const importPanel = document\.getElementById\('enh-import-panel'\);[\s\S]*?importPanel\.hidden = true;[\s\S]*?resetPanel\.hidden = true;[\s\S]*?importTextarea\.value = '';/.test(script),
        'closing settings must clear sensitive import text and cancel destructive subflows'
    );
});

test('clipboard actions report manager failures instead of claiming success', () => {
    const hooks = loadScriptTestHooks();
    assert.strictEqual(hooks.copyTextToClipboard('tt0133093'), true);
    hooks.setClipboardFailure(true);
    assert.strictEqual(hooks.copyTextToClipboard('sensitive export'), false);
    assert.strictEqual((script.match(/GM_setClipboard\(/g) || []).length, 1, 'clipboard writes should pass through the guarded helper');
});

test('Greasy Fork distribution guardrails stay intact', () => {
    assert(!/@require\s+/i.test(script), '@require should not be used');
    assert(!/@resource\s+/i.test(script), '@resource should not be used');
    assert(!/@connect\s+\*/i.test(script), 'wildcard @connect should not return');
    assert(!/@connect\s+www\.opensubtitles\.org/i.test(script), 'ordinary subtitle links should not retain cross-origin request permission');
    assert(!/\beval\s*\(/.test(script), 'eval should not be used');
    assert(!/\bnew\s+Function\s*\(/.test(script), 'new Function should not be used');
    assert(!/createElement\(['"]script['"]\)/.test(script), 'dynamic script tags should not be created');
    assert(!/\bconfirm\s*\(/.test(script), 'confirmation dialogs should not be used');
});

test('cross-origin requests omit destination cookies', () => {
    const hooks = loadScriptTestHooks();
    hooks.httpRequest('https://www.youtube.com/results?search_query=Alien').catch(() => {});
    const request = hooks.getCapturedRequests().at(-1);
    assert(request, 'request was not created');
    assert.strictEqual(request.anonymous, true, 'public lookups should not carry destination cookies');
    assert.strictEqual((script.match(/GM_xmlhttpRequest\(/g) || []).length, 1, 'requests should stay behind the shared privacy boundary');
});

test('media server integration is configurable and local-only', () => {
    [
        'mediaServerIntegration',
        'plexUrl',
        'plexToken',
        'jellyfinUrl',
        'jellyfinApiKey',
        'embyUrl',
        'embyApiKey',
        '/library/search',
        'AnyProviderIdEquals',
    ].forEach(token => assert(script.includes(token), `${token} missing`));
    assert(script.includes('Only localhost and 127.0.0.1 media server URLs are allowed'), 'media server local-only guard missing');
    assert(/className:'enh-media-server-pill',[\s\S]*?role:'status',[\s\S]*?'aria-live':'polite'/.test(script), 'async media-server state should be announced');
    assert(script.includes("className:'enh-media-server-pill__dot', 'aria-hidden':'true'"), 'decorative media-server dots should stay out of the accessibility tree');
    assert(script.includes("this._setState(btn, 'library', 'In Library', `${ctx.title} is already in ${label}`)"), 'Servarr library state should replace the stale Add accessible name');
    assert(/_setState\(btn, state, text, label[\s\S]*?if \(label\) btn\.setAttribute\('aria-label', label\)/.test(script), 'every integration state change must carry its accessible name');
    assert(script.includes("btn.setAttribute('aria-busy', 'true')"), 'Servarr adds should expose their pending state');
});

test('local-service credentials stay out of request URLs', () => {
    const hooks = loadScriptTestHooks();
    assert.strictEqual(hooks.normalizeLocalServiceUrl('http://localhost:32400/library'), 'http://localhost:32400/library');
    assert.strictEqual(hooks.normalizeLocalServiceUrl('http://localhost:32400/?token=secret'), '', 'local base URLs must reject query credentials');
    assert.strictEqual(hooks.normalizeLocalServiceUrl('http://localhost:32400/#secret'), '', 'local base URLs must reject fragments');
    assert.strictEqual(hooks.isLocalServiceUrl('ftp://localhost/library'), false, 'request guards must reject non-HTTP localhost URLs');
    assert.strictEqual(hooks.isLocalServiceUrl('http://user:secret@localhost/library'), false, 'request guards must reject embedded URL credentials');
    assert.strictEqual(hooks.isLocalServiceUrl('http://localhost/library?token=secret'), false, 'request guards must reject query-bearing base URLs');
    assert.strictEqual(hooks.normalizeCredentialValue('secret\r\nX-Injected: yes'), '', 'header credentials must reject embedded controls');
    assert.strictEqual(
        hooks.normalizeLocalServiceUrl(`http://localhost/${'x'.repeat(hooks.SETTING_TEXT_LIMIT)}`),
        '',
        'oversized local service URLs must be rejected before parsing or storage'
    );
    hooks.mediaServerRequest({
        kind:'plex', label:'Plex', baseUrl:'http://localhost:32400', token:'plex-secret',
    }, '/library/sections', { query:{ type:'movie' } }).catch(() => {});
    const requests = hooks.getCapturedRequests();
    const request = requests[requests.length - 1];
    assert(request, 'Plex request was not created');
    assert.strictEqual(request.headers['X-Plex-Token'], 'plex-secret');
    assert(!request.url.includes('plex-secret'), 'Plex token must not appear in the request URL');
    assert.strictEqual(new URL(request.url).searchParams.get('type'), 'movie');
    assert.strictEqual(hooks.toPositiveInteger('-4'), 1, 'legacy negative profile IDs should fall back safely');
    assert.strictEqual(hooks.toPositiveInteger('7'), 7);

    hooks.seedStoredSetting('radarrUrl', 'http://localhost:7878');
    hooks.seedStoredSetting('radarrApiKey', 'radarr-secret');
    hooks.seedStoredSetting('radarrRootFolderPath', '/movies');
    hooks.seedStoredSetting('radarrQualityProfileId', '');
    assert.strictEqual(hooks.getServarrConfig('radarr').qualityProfileId, 0, 'a visibly blank profile field must stay unconfigured');
    assert.strictEqual(hooks.isServarrConfigured('radarr'), false, 'blank profile IDs must not silently fall back to profile 1');
    hooks.seedStoredSetting('radarrUrl', 'https://remote.example.test');
    hooks.seedStoredSetting('radarrQualityProfileId', '1');
    assert.strictEqual(hooks.isServarrConfigured('radarr'), false, 'legacy remote service URLs must stay inert even when other fields are complete');
    hooks.seedStoredSetting('radarrUrl', 'http://localhost:7878');
    hooks.seedStoredSetting('radarrApiKey', 'secret\r\nX-Injected: yes');
    assert.strictEqual(hooks.isServarrConfigured('radarr'), false, 'malformed stored header credentials must keep the integration inert');
    const servarrConfig = { qualityProfileId:7, rootFolderPath:'/media' };
    const sonarrBody = hooks.buildSonarrAddBody({
        seasons:Array.from({ length:502 }, (_, index) => ({ seasonNumber:index })),
        addOptions:['invalid'],
    }, servarrConfig);
    assert.strictEqual(sonarrBody.seasons.length, 500, 'Sonarr add payloads should cap local lookup season arrays');
    assert(sonarrBody.seasons.every(season => season.monitored === true), 'retained Sonarr seasons should be monitored');
    assert.deepStrictEqual(
        { ...sonarrBody.addOptions },
        { monitor:'all', searchForMissingEpisodes:true },
        'array-valued lookup addOptions must not spread numeric keys into a Sonarr request'
    );
    const radarrBody = hooks.buildRadarrAddBody({ addOptions:['invalid'] }, servarrConfig);
    assert.deepStrictEqual({ ...radarrBody.addOptions }, { searchForMovie:true }, 'Radarr add options should require a plain object');
});

test('media server matching handles provider IDs and title fallback', () => {
    const hooks = loadScriptTestHooks();
    assert.strictEqual(hooks.normalizeIMDbProviderId('imdb://tt0133093'), 'tt0133093');
    assert.strictEqual(hooks.normalizeIMDbProviderId(`imdb://${'x'.repeat(300)}tt0133093`), '', 'oversized provider IDs should be rejected before regex work');
    assert.strictEqual(hooks.normalizeLookupTitle('The Matrix'), 'the matrix');
    assert.strictEqual(hooks.normalizeLookupTitle('x'.repeat(501)), '', 'oversized identity titles should be rejected before Unicode normalization');
    assert(hooks.mediaItemMatches(
        { providerIds: ['imdb://tt0133093'] },
        { imdbId: 'tt0133093', title: 'The Matrix', year: 1999 }
    ), 'Plex-style GUID match failed');
    assert(hooks.mediaItemMatches(
        { Name: 'The Matrix', ProductionYear: 1999, ProviderIds: {} },
        { imdbId: 'tt0133093', title: 'The Matrix', year: 1999 }
    ), 'title/year fallback match failed');
    assert(!hooks.mediaItemMatches(
        { Name: 'The Matrix Reloaded', ProductionYear: 2003, ProviderIds: {} },
        { imdbId: 'tt0133093', title: 'The Matrix', year: 1999 }
    ), 'different title should not match');
    assert(!hooks.mediaItemMatches(
        { Name:'The Matrix', ProductionYear:1999, ProviderIds:{ Imdb:'tt9999999' } },
        { imdbId:'tt0133093', title:'The Matrix', year:1999 }
    ), 'a conflicting provider ID must not fall through to title matching');
    assert(!hooks.mediaItemMatches(
        { Name:'The Matrix', ProviderIds:{} },
        { imdbId:'tt0133093', title:'The Matrix', year:1999 }
    ), 'a missing local-library year must not satisfy a year-qualified title');

    const lookup = hooks.selectServarrLookupResult([
        { id:5, imdbId:'tt0084787', title:'The Thing', year:1982 },
        { id:0, imdbId:'tt0905372', title:'The Thing', year:2011 },
    ], { imdbId:'tt0905372', title:'The Thing', year:2011 });
    assert.strictEqual(lookup.imdbId, 'tt0905372', 'Servarr lookup should not accept result zero or a wrong remake');
    assert.strictEqual(
        hooks.selectServarrLookupResult([lookup], { imdbId:'tt0905372', title:'The Thing', year:2011 }, true),
        null,
        'library status should require an existing matched item'
    );

    const parsed = hooks.parseMediaServerItems(JSON.stringify({
        Items: [{ Name: 'Alien', ProductionYear: 1979, ProviderIds: { Imdb: 'tt0078748' } }],
    }));
    assert.strictEqual(parsed.length, 1, 'Jellyfin/Emby item parser failed');
    assert(hooks.mediaItemMatches(parsed[0], { imdbId: 'tt0078748', title: 'Alien', year: 1979 }), 'parsed item did not match');
    assert.strictEqual(
        hooks.parseMediaServerItems({ Items:[{ Name:'x'.repeat(501) }] })[0].title,
        '',
        'oversized local response titles should not survive parser normalization'
    );

    const oversized = hooks.parseMediaServerItems({
        Items: Array.from({ length:150 }, (_, index) => ({
            Name:`Item ${index}`,
            ProviderIds:Object.fromEntries(Array.from({ length:50 }, (__, idIndex) => [`Provider${idIndex}`, `tt${String(idIndex).padStart(7, '0')}`])),
        })),
    });
    assert.strictEqual(oversized.length, 100, 'local media responses should cap parsed result work');
    assert(oversized[0].providerIds.length <= 32, 'local media provider IDs should be bounded per result');
    const plexParserSource = script.slice(script.indexOf('function parsePlexItems'), script.indexOf('function parseMediaServerItems'));
    assert(/for \(let index = 0; index < nodes\.length && index < LOCAL_LOOKUP_RESULT_LIMIT; index\+\+\)/.test(plexParserSource), 'Plex parsing should iterate only the retained result budget');
    assert(!plexParserSource.includes('Array.from'), 'Plex parsing should not materialize every matching XML node');

    const lateMatch = Array.from({ length:101 }, (_, index) => ({
        id:index + 1,
        imdbId:index === 100 ? 'tt0133093' : `tt${String(index).padStart(7, '0')}`,
        title:index === 100 ? 'The Matrix' : `Item ${index}`,
        year:index === 100 ? 1999 : 2000,
    }));
    assert.strictEqual(
        hooks.selectServarrLookupResult(lateMatch, { imdbId:'tt0133093', title:'The Matrix', year:1999 }),
        null,
        'Servarr matching should not scan an unbounded local response'
    );
});

/* Found by adversarial review. On an IMDb page the bridge keeps credential values out of
   the content script's world, and six things went on reading them with get(): the
   encrypted backup carried empty strings while reporting success, restoring one wiped the
   real keys, the plain export's "left out" warning never fired, and the diagnostics report
   told every extension user their integrations were not set up. */
test('a credential this context cannot read is never treated as absent', () => {
    const hooks = loadScriptTestHooks({ withheldCredentials:true });
    hooks.seedStoredSetting('radarrApiKey', 'RADARR-SECRET');
    hooks.seedStoredSetting('plexToken', 'PLEX-SECRET');

    // The premise: this context genuinely cannot see the values.
    assert.strictEqual(hooks.readCredential('radarrApiKey').value, '', 'the value must be withheld here');
    assert.strictEqual(hooks.readCredential('radarrApiKey').configured, true, 'but it is configured');
    assert.strictEqual(hooks.readCredential('radarrApiKey').readable, false);
    assert.strictEqual(hooks.readCredential('seerrApiKey').configured, false, 'an unset one stays unset');

    /* A backup that promises credentials and carries empty strings is worse than none:
       restoring it destroyed the real ones. It refuses instead. */
    assert.throws(() => hooks.getExportSettings({ includeCredentials:true }), /CREDENTIALS_UNREADABLE/,
        'a credential-bearing backup cannot be made where the credentials cannot be read');

    // The plain export must still name what it left out, which is what tells someone why
    // Radarr stopped working after they restored it.
    const plain = hooks.getExportSettings();
    const omitted = Array.from(plain[hooks.EXPORT_REDACTED_KEY] || []);
    assert(omitted.includes('radarrApiKey') && omitted.includes('plexToken'),
        'a stored credential must be named as omitted even when its value is unreadable');
    assert(!omitted.includes('seerrApiKey'), 'an empty one must not be listed as though it were set');
    assert(!JSON.stringify(plain).includes('RADARR-SECRET'), 'and the value itself never travels');

    // The diagnostics report must agree with reality rather than with what get() can see.
    const report = hooks.buildDiagnosticsReport();
    assert(/Radarr: configured/.test(report), 'a configured integration must report as configured');
    assert(/Overseerr: not configured/.test(report), 'an unconfigured one must still say so');
    assert(!report.includes('RADARR-SECRET'), 'and the report never carries the value');
});

/* A local-service request in an extension build cannot carry the key itself, so it names
   it and the worker attaches it. Nothing asserted that it was named: replacing the whole
   credentialHeader with null left the suite green, which would have shipped an extension
   that sends Radarr and Sonarr no API key at all. */
test('a local-service request names the credential it needs', async () => {
    const hooks = loadScriptTestHooks({ withheldCredentials:true });
    hooks.seedStoredSetting('radarrUrl', 'http://localhost:7878');
    hooks.seedStoredSetting('radarrApiKey', 'RADARR-SECRET');
    hooks.seedStoredSetting('radarrRootFolderPath', '/movies');
    hooks.seedStoredSetting('radarrQualityProfileId', '1');
    assert.strictEqual(hooks.isServarrConfigured('radarr'), true,
        'a stored key must count as configured even where its value cannot be read');

    const before = hooks.getCapturedRequests().length;
    hooks.servarrRequest(hooks.getServarrConfig('radarr'), 'movie').catch(() => {});
    const issued = hooks.getCapturedRequests().slice(before);
    assert.strictEqual(issued.length, 1, 'the request should have been issued');
    const sent = issued[0];
    assert.strictEqual(sent.credentialHeader?.name, 'X-Api-Key',
        'the request must name the header the service expects');
    assert.strictEqual(sent.credentialHeader?.ref, 'radarrApiKey',
        'and which stored key holds it, or the worker has nothing to attach');
    assert.strictEqual(sent.headers['X-Api-Key'], undefined,
        'and must not carry the value, which this context cannot read anyway');
    assert(!JSON.stringify(sent).includes('RADARR-SECRET'), 'no part of the request may carry the secret');
});

test('restoring a backup never blanks a credential it does not carry', () => {
    const hooks = loadScriptTestHooks();
    hooks.seedStoredSetting('radarrApiKey', 'RADARR-SECRET');
    hooks.seedStoredSetting('plexToken', 'PLEX-SECRET');

    /* The shape an extension-made encrypted backup used to have: the keys present, the
       values empty. Applying it wiped both real credentials with no warning. */
    const { entries } = hooks.prepareSettingsImport({
        radarrApiKey:'', plexToken:'', sonarrApiKey:'', themeVariant:'oled',
    });
    const keys = Array.from(entries).map(entry => entry.key);
    assert(!keys.includes('radarrApiKey'), 'an empty credential is not an instruction to clear one');
    assert(!keys.includes('plexToken'));
    assert(keys.includes('themeVariant'), 'everything else still imports');

    hooks.applySettingsImport(Array.from(entries));
    assert.strictEqual(hooks.getRawStorage('imdb_enh_radarrApiKey'), 'RADARR-SECRET',
        'restoring must leave a working key alone');
    assert.strictEqual(hooks.getRawStorage('imdb_enh_plexToken'), 'PLEX-SECRET');

    // A backup that really does carry one still restores it.
    const real = hooks.prepareSettingsImport({ radarrApiKey:'NEW-SECRET' });
    hooks.applySettingsImport(Array.from(real.entries));
    assert.strictEqual(hooks.getRawStorage('imdb_enh_radarrApiKey'), 'NEW-SECRET',
        'a credential that is actually present must still be restored');
});

/* Found by adversarial review. Wrapping a manager's response object in a real Error fixed
   classification and broke two things that read the original: the refusal categories all
   became "network", which made every deliberate refusal look like an outage, and errorType
   was dropped, which made all four blocked-redirect sentences unreachable. Both are driven
   through the real rejection here rather than through a hand-built object, which is how
   they passed while being dead. */
test('a refusal by the worker is not an outage, and still says what it was', () => {
    const hooks = loadScriptTestHooks();
    const refusals = [
        ['redirect_blocked', 'Blocked: the service tried to redirect a request carrying your API key.'],
        ['redirect_changed_origin', 'Blocked: the service redirected to a different site.'],
        ['redirect_destination_not_allowed', 'Blocked: the service redirected somewhere this extension does not allow.'],
        ['redirect_crossed_trust_boundary', 'Blocked: the service redirected between a local and a public address.'],
    ];
    refusals.forEach(([errorType, sentence]) => {
        const failure = hooks.describeRequestFailure('network', { errorType, message:'Failed to fetch' }, 'https://x.test/');
        assert.strictEqual(hooks.classifyFailure(failure), 'permission',
            `${errorType} is the worker refusing, not the service being unreachable`);
        assert.strictEqual(hooks.isReachabilityFailure(failure), false,
            `${errorType} must not offer a stale score with a retry that can only be refused again`);
        assert.strictEqual(hooks.getRequestErrorMessage(failure), sentence,
            `${errorType} must still reach the user as its own sentence`);
    });
    // An invalid URL is a refusal too, not a service that could not be reached.
    const invalid = hooks.describeRequestFailure('network', { errorType:'invalid_url', message:'Invalid HTTP(S) request' }, 'https://x.test/');
    assert.strictEqual(hooks.isReachabilityFailure(invalid), false, 'a refused URL is not an outage');
    // The genuine reachability failures must keep working, or the fallback is dead again.
    ['network', 'timeout'].forEach(errorType => {
        const failure = hooks.describeRequestFailure('network', { errorType, message:'Failed to fetch' }, 'https://x.test/');
        assert.strictEqual(hooks.isReachabilityFailure(failure), true,
            `${errorType} really is the service being unreachable`);
    });
    // A body the local service sent still outranks the generic wording.
    const withBody = hooks.describeRequestFailure('network',
        { errorType:'network', responseText:JSON.stringify({ message:'Movie already exists' }) }, 'http://localhost:7878/');
    assert.strictEqual(hooks.getRequestErrorMessage(withBody), 'Movie already exists',
        'a service that explained itself must still be quoted');
});

/* Found by adversarial review. A lookup abandoned because the user navigated rejected
   with a bare Error, which classified as unclassified — so every navigation away looked
   like a defect in the failure journal, and the reachability check could not tell it from
   one. Driven through the real cancellation rather than a hand-built error. */
test('a lookup abandoned by navigation is recorded as a cancellation', async () => {
    const hooks = loadScriptTestHooks();
    const pending = hooks.httpGet('https://www.rottentomatoes.com/m/matrix', { cancelOnRouteChange:true });
    const settled = pending.then(() => null, error => error);
    hooks.cancelPendingRouteWork();
    const error = await settled;
    assert(error, 'the request must reject when its route goes away');
    assert.strictEqual(hooks.classifyFailure(error), 'aborted',
        'navigating away is a cancellation, not an unclassified failure');
    assert.strictEqual(hooks.isReachabilityFailure(error), false,
        'and must never offer a stale score, since nothing was wrong with the provider');
    assert(!/rottentomatoes|matrix/i.test(String(error.message)),
        'the message must not carry what was being looked up');
});

/* Found by adversarial review. The cache treats any cache_-prefixed key as an eviction
   candidate and deletes what it cannot parse, so a setting that ever collides with that
   prefix would be silently destroyed. Nothing collides today; this fails on the day one
   does, which is the only day it matters. */
test('no setting can be mistaken for a cache entry', () => {
    const hooks = loadScriptTestHooks();
    const colliding = Object.keys(hooks.DEFAULTS || {}).filter(key => key.startsWith('cache_'));
    assert.deepStrictEqual(Array.from(colliding), [],
        'a setting named cache_* would be treated as an evictable cache entry');
    assert(script.includes("return key.startsWith('cache_') && !Object.prototype.hasOwnProperty.call(DEFAULTS, key);"),
        'and the guard must exclude anything that is a real setting, not just check the prefix');
});

test('local request errors stay concise and text-only', () => {
    const hooks = loadScriptTestHooks();
    const longMessage = `  ${'failure '.repeat(80)}\nretry  `;
    const message = hooks.getRequestErrorMessage({ responseText:JSON.stringify({ message:longMessage }) });
    assert(message.length <= 240, 'local response errors should be length bounded');
    assert(!message.includes('\n'), 'local response errors should collapse whitespace');
    assert.strictEqual(
        hooks.getRequestErrorMessage({ responseText:JSON.stringify({ error:{ code:'bad' } }), status:503 }),
        'HTTP 503',
        'structured error objects should not render as [object Object]'
    );
    assert.strictEqual(
        hooks.getRequestErrorMessage({ status:{ code:500 } }),
        'Request failed',
        'non-numeric status values should not be coerced into UI text'
    );
});

/* IE-13 (critic + audience half): the audience score was read with a pattern that looks
   for "value", but Rotten Tomatoes ships "score". It therefore never matched, and the
   audience half of the widget has been quietly absent rather than merely unavailable. */
test('Rotten Tomatoes critic and audience scores are read from the payload it ships', () => {
    const hooks = loadScriptTestHooks();

    /* Copied from the live page on 2026-08-31, including the field order and the quoted
       numerals, because the exact shape is the thing that was wrong. */
    const payload = '"audienceScore":{"averageRating":"3.6","bandedRatingCount":"250,000+ Ratings",'
        + '"likedCount":142778,"notLikedCount":24632,"reviewCount":1307885,"score":"85","scoreType":"ALL"},'
        + '"criticsScore":{"certified":true,"score":"83","sentiment":"POSITIVE"}';

    assert.strictEqual(hooks.readRTScoreField(payload, 'audienceScore', 'score'), 85);
    assert.strictEqual(hooks.readRTScoreField(payload, 'criticsScore', 'score'), 83);
    // averageRating is a 0-5 figure, not a percentage, so it must not be read as a score.
    assert.strictEqual(hooks.readRTScoreField(payload, 'audienceScore', 'nonexistent'), null);
    assert.strictEqual(hooks.readRTScoreField(payload, 'missingObject', 'score'), null);
    // The match must not wander out of its object into the next one's field.
    assert.strictEqual(hooks.readRTScoreField('"emptyObject":{},"criticsScore":{"score":"83"}', 'emptyObject', 'score'), null,
        'an object without the field must not borrow a neighbour\'s');

    const full = `<html><head>
        <script type="application/ld+json">${JSON.stringify({
            '@type':'Movie', name:'The Matrix', datePublished:'1999-03-31',
            url:'/m/the_matrix',
        })}</script>
        </head><body><script>{${payload}}</script></body></html>`;
    const parsed = hooks.parseRTDetailPage(full, 'The Matrix', 1999, 'movie', 'https://www.rottentomatoes.com/m/the_matrix');
    assert(parsed, 'the identity-matched detail page should parse');
    assert.strictEqual(parsed.audience, 85, 'the audience score must reach the widget');
    assert.strictEqual(parsed.tomatometer, 83, 'the critics score is the fallback when JSON-LD carries none');

    // A page whose identity does not match is still rejected outright.
    assert.strictEqual(
        hooks.parseRTDetailPage(full, 'Some Other Film', 2011, 'movie', 'https://www.rottentomatoes.com/m/x'),
        null, 'identity checking must not be weakened by the new fields');

    // The widget already renders both; the data is what was missing.
    assert(script.includes('const hasAudience = audience !== null;'), 'the widget distinguishes having an audience score');
    assert(!/audienceScore\[\^\}\]\*\?"value"/.test(script), 'the pattern that never matched must be gone');
});

/* IE-15: every episode has its own IMDb id and both subtitle services index by it, so a
   link per row needs no lookup at all. */
test('episode subtitle links are plain anchors and export in bulk', () => {
    const hooks = loadScriptTestHooks();

    assert.strictEqual(hooks.buildEpisodeSubtitleUrl('tt0959621'),
        'https://www.opensubtitles.com/en/en/search-all/q-tt0959621');
    // Never build a link from something that is not an IMDb id.
    ['', null, 'nm0000206', 'tt', '../../etc', 'tt123 x'].forEach(bad => {
        assert.strictEqual(hooks.buildEpisodeSubtitleUrl(bad), '', `${bad} must not become a link`);
    });

    const rows = [
        { id:'tt0959621', label:'S1.E1 ∙ Pilot' },
        { id:'tt1054724', label:'S1.E2' },
        { id:'nm0000206', label:'not an episode' },
    ];
    const exported = hooks.buildEpisodeSubtitleExport(rows);
    assert.strictEqual(exported.split('\n').length, 2, 'only real episodes are exported');
    assert(exported.startsWith('S1.E1 ∙ Pilot\thttps://www.opensubtitles.com/en/en/search-all/q-tt0959621'),
        'each line pairs the episode with its link');

    const feature = script.slice(script.indexOf("key: 'episodeSubtitles'"));
    const body = feature.slice(0, feature.indexOf('destroy() {') + 400);
    /* Plain anchors, never a request. opensubtitles.org sits behind an anti-bot wall that
       a person's click passes and a fetch never will, and fetching would need a @connect
       grant this project deliberately does not hold. */
    ['httpGet', 'httpRequest', 'GM_xmlhttpRequest', 'fetch('].forEach(token => {
        assert(!body.includes(token), `subtitle links must not ${token}`);
    });
    assert(!/@connect\s+opensubtitles/.test(script), 'no cross-origin grant may be added for subtitles');
    assert(body.includes("rel:'noopener noreferrer'"), 'outbound links must not leak opener or referrer');
    assert(body.includes("target:'_blank'"), 'a subtitle link should open beside the episode list');
    // Rows arrive with a season tab swap, and the link must not be added twice.
    assert(body.includes("row.node.querySelector?.('.enh-ep-sub')"), 'a row must not gain two links');
    assert(body.includes('new MutationObserver'), 'a season swap must be picked up');
    assert(body.includes("this._observer?.disconnect()"), 'the observer must be torn down with the route');
});

/* IE-83: per-episode marking does not scale to a season, let alone a series. */
test('season progress counts the loaded season and batches marks in one transaction', () => {
    const hooks = loadScriptTestHooks();
    const row = (id, label) => ({ id, label, node:{} });
    const rows = [row('tt0959621', 'S1.E1 ∙ Pilot'), row('tt1054724', 'S1.E2'), row('tt1054725', 'S1.E3')];

    let summary = hooks.summarizeSeasonProgress(rows, {});
    assert.deepStrictEqual([summary.total, summary.watched, summary.skipped], [3, 0, 0]);
    assert.strictEqual(summary.next.id, 'tt0959621', 'the next episode is the first unmarked one');
    assert.strictEqual(hooks.describeSeasonProgress(summary), 'Seen 0/3 loaded');

    summary = hooks.summarizeSeasonProgress(rows, {
        tt0959621:{ state:'watched' }, tt1054724:{ state:'skip' },
    });
    assert.deepStrictEqual([summary.watched, summary.skipped], [1, 1]);
    assert.strictEqual(summary.next.id, 'tt1054725', 'a skipped episode is not the next one to watch');
    assert.strictEqual(hooks.describeSeasonProgress(summary), 'Seen 1/3 loaded · 1 skipped');

    const done = hooks.summarizeSeasonProgress(rows, {
        tt0959621:{ state:'watched' }, tt1054724:{ state:'watched' }, tt1054725:{ state:'watched' },
    });
    assert.strictEqual(done.next, null, 'a finished season has no next episode');
    assert.strictEqual(hooks.describeSeasonProgress({ total:0, watched:0, skipped:0, next:null }), '',
        'no loaded rows renders nothing rather than 0/0');

    const feature = script.slice(script.indexOf("key: 'seasonProgress'"));
    const body = feature.slice(0, feature.indexOf("key: 'listRoulette'"));
    /* Counts and copy both say "loaded", because a season list renders one page at a
       time and nothing here fetches the rest. Quietly completing the set would be doing
       something nobody asked for. */
    assert(body.includes('Mark loaded season seen') && body.includes('Clear loaded season'),
        'the wording must not imply the whole season was touched');
    assert(script.includes('`Seen ${summary.watched}/${summary.total} loaded`'), 'counts are over loaded rows');
    ['httpRequest', 'httpGet', 'GM_xmlhttpRequest', 'fetch('].forEach(token => {
        assert(!body.includes(token), `batch marking must not ${token}`);
    });
    // One write for the whole batch, not one per episode.
    assert.strictEqual((body.match(/setUserMarks\(/g) || []).length, 2,
        'the batch and its undo are one transaction each');
    assert(!/rows\.forEach[\s\S]{0,400}?setUserMark\(/.test(body), 'the batch must not write per row');
    /* Undo restores the rows this batch touched and nothing else. These three assertions
       used to require the opposite — a whole-store snapshot, restored wholesale — which
       is the defect: any mark made anywhere while Undo was still armed was deleted by it,
       with no second undo. The assertions were wrong, not the code they were written
       against, so they are replaced rather than relaxed. */
    assert(body.includes('const before = getUserMarks(true);'), 'the batch must snapshot before writing');
    assert(/this\._pending = rows\.map\(row => \(\{ id:row\.id, previous:before\[row\.id\] \}\)\)/.test(body),
        'undo must remember only the rows this batch changed');
    assert(/const current = \{ \.\.\.getUserMarks\(true\) \};/.test(body),
        'undo must re-read the live marks rather than restoring a stale snapshot over them');
    // A failed write changes nothing and says so.
    assert(/if \(!setUserMarks\(marks\)\) \{[\s\S]{0,160}?Nothing was changed/.test(body),
        'a rejected batch must report that nothing changed');
    /* The 5,000-mark ceiling can silently drop the oldest, so the result is verified.
       The batch rows always carry the freshest timestamps and so are never the ones
       dropped: the old assertion required a message that counted them, which could not
       fire. What a full store actually loses is the oldest marks from elsewhere. */
    assert(body.includes('USER_MARKS_MAX'), 'the batch must account for the mark ceiling');
    assert(/const evicted = Object\.keys\(before\)\.filter\(id => !touched\.has\(id\) && !stored\[id\]\)\.length/.test(body),
        'the batch must count the marks the ceiling actually pushed out');
    assert(body.includes('were pushed out by the'), 'and say so rather than claim a clean success');
    // Clearing a season must not take notes with it.
    assert(/normalizeUserNote\(marks\[row\.id\]\?\.note\)/.test(body), 'clearing must preserve a note');
    // No confirmation dialog anywhere.
    assert(!/confirm\(|window\.confirm/.test(body), 'no confirmation dialog may be introduced');
    assert(body.includes('#enh-season-progress[hidden] { display: none; }'),
        'a display-setting rule needs its hidden companion');
    assert(body.includes("this._observer?.disconnect()"), 'the season-tab observer must be torn down');

    /* The structure above is only worth asserting if the semantics it encodes hold, so
       run the batch-then-undo shape against the real store. A mark made between the
       batch and the undo stands for anything the user does while the button is armed:
       a card's Seen toggle, the settings marks panel, another tab. */
    const store = loadScriptTestHooks();
    const stamp = Date.now();
    const episodes = ['tt1000001', 'tt1000002', 'tt1000003'];
    store.setUserMarks({ tt2000000:{ v:1, state:'skip', title:'Older, untouched', ts:stamp - 5000 } });

    const before = store.getUserMarks(true);
    const batched = { ...before };
    episodes.forEach(id => { batched[id] = { v:1, state:'watched', title:id, ts:stamp }; });
    assert(store.setUserMarks(batched), 'the batch write should succeed');
    const pending = episodes.map(id => ({ id, previous:before[id] }));

    store.setUserMark('tt3000000', 'watched', 'Marked while undo was armed');
    assert.strictEqual(store.getUserMark('tt3000000'), 'watched', 'the later mark should be stored');

    const current = { ...store.getUserMarks(true) };
    pending.forEach(({ id, previous }) => {
        if (previous) current[id] = previous;
        else delete current[id];
    });
    assert(store.setUserMarks(current), 'the undo write should succeed');

    episodes.forEach(id => assert.strictEqual(store.getUserMark(id), '', `undo must clear ${id}`));
    assert.strictEqual(store.getUserMark('tt3000000'), 'watched',
        'undo must not delete a mark made after the batch');
    assert.strictEqual(store.getUserMark('tt2000000'), 'skip',
        'undo must leave marks the batch never touched alone');
});

/* IE-20: decision fatigue is why long watchlists stop getting used. */
test('the roulette picks from what is visible and never navigates', () => {
    const feature = script.slice(script.indexOf("key: 'listRoulette'"));
    const body = feature.slice(0, feature.indexOf("key: 'listMultiSearch'"));

    // It highlights and scrolls. It must not open anything: choosing is the user's job.
    assert(body.includes("classList.add('enh-roulette-pick')"), 'the pick must be highlighted');
    assert(body.includes('scrollIntoView'), 'the pick must be scrolled to');
    assert(!/window\.open|location\.href\s*=|\.click\(\)/.test(body),
        'the roulette must never navigate or open anything on its own');
    assert(body.includes('Nothing was opened.'), 'and it should say so');

    // Only rows the page is actually showing: a filtered-out row is not a candidate,
    // or the pick scrolls to something invisible.
    assert(body.includes('entry.card.offsetParent !== null'), 'a hidden row must not be picked');
    assert(body.includes('!entry.duplicate'), 'a title rendered twice must not be twice as likely');
    assert(/this\._skipMarked\.checked && marks\[entry\.id\]\?\.state/.test(body),
        'the option to skip already-marked titles must consult the marks');
    // Honest empty states rather than a silent no-op.
    assert(body.includes('Nothing left that you have not already marked.'), 'an exhausted list must say so');
    assert(body.includes('No titles on this page to pick from.'), 'an empty list must say so');
    // Respects the OS motion preference, like every other scripted scroll here.
    assert(body.includes('getEnhancementScrollBehavior()'), 'scrolling must honour reduced motion');
    // Text written into an observed subtree, guarded like the rest.
    assert.strictEqual((body.match(/^\s*(?!\/\/)[^\n]*\.textContent\s*=/gm) || []).length, 0,
        'result text must go through the guarded setter');
    assert(body.includes('#enh-roulette[hidden] { display: none; }'),
        'a display-setting rule needs its hidden companion');
});

/* IE-85: a transient provider failure turned a bounded expired value into no result at
   all, when it could have been shown honestly with its date. */
test('an unreachable provider falls back to a labelled cached value', () => {
    const hooks = loadScriptTestHooks();
    const day = 24 * 60 * 60 * 1000;

    // Fresh values are returned normally and are not "stale".
    hooks.cacheSet('rt_tt0133093', { tomatometer: 88 });
    assert.strictEqual(hooks.cacheGet('rt_tt0133093').tomatometer, 88);
    assert.strictEqual(hooks.cacheGetStale('rt_tt0133093'), null, 'a live value is not a fallback');

    /* An expired value must survive a cacheGet rather than being deleted by it — that
       read happens first on every page, so deleting there would destroy the fallback
       before anything could use it. */
    const writtenAt = Date.now() - (10 * day);
    hooks.seedRawStorage('cache_rt_tt0111161', JSON.stringify({
        data:{ tomatometer: 91 }, ts: writtenAt, at: writtenAt, ttl: 7 * day, schema: 3,
    }));
    assert.strictEqual(hooks.cacheGet('rt_tt0111161'), null, 'an expired value is not a current value');
    assert(hooks.getStorageKeys().includes('cache_rt_tt0111161'), 'reading must not destroy the fallback');
    const stale = hooks.cacheGetStale('rt_tt0111161');
    assert.strictEqual(stale.data.tomatometer, 91);
    assert.strictEqual(stale.ts, writtenAt, 'the fallback must carry the date it was written');

    /* The ceiling is absolute, whatever the entry's own shorter TTL was. The key here
       must match what cacheGetStale builds ('cache_' + key) — an earlier version of this
       seeded `cache_rt_ancient` and then read `ancient`, so it passed against a missing
       entry and proved nothing. */
    const ancient = Date.now() - (hooks.CACHE_MAX_TTL + day);
    hooks.seedRawStorage('cache_rt_ancient', JSON.stringify({
        data:{ tomatometer: 50 }, ts: ancient, at: ancient, ttl: 7 * day, schema: 3,
    }));
    assert(hooks.getStorageKeys().includes('cache_rt_ancient'), 'the fixture must exist for this to mean anything');
    assert.strictEqual(hooks.cacheGetStale('rt_ancient'), null, 'a fallback may not outlive the envelope ceiling');
    // And one a day inside the ceiling still is a fallback, so the bound is the reason.
    const justInside = Date.now() - (hooks.CACHE_MAX_TTL - day);
    hooks.seedRawStorage('cache_rt_inside', JSON.stringify({
        data:{ tomatometer: 51 }, ts: justInside, at: justInside, ttl: 7 * day, schema: 3,
    }));
    assert.strictEqual(hooks.cacheGetStale('rt_inside')?.data.tomatometer, 51,
        'an expired value inside the ceiling must still be usable, or the test above proves nothing');

    // "We asked and there was nothing" is not worth re-showing as a cached score.
    hooks.seedRawStorage('cache_rt_none', JSON.stringify({
        data:{ unavailable: true }, ts: writtenAt, at: writtenAt, ttl: 24 * 60 * 60 * 1000, schema: 3,
    }));
    assert.strictEqual(hooks.cacheGetStale('rt_none'), null, 'an unavailable sentinel is not a fallback');

    // A corrupt entry is not a fallback either.
    hooks.seedRawStorage('cache_rt_corrupt', '{not json');
    assert.strictEqual(hooks.cacheGetStale('rt_corrupt'), null);

    /* Only a failure to REACH the provider qualifies. A mismatch or an unparseable
       response means the lookup worked and the answer was absent, so an old score would
       contradict what the service just said — and those paths do not throw at all. */
    assert.strictEqual(hooks.isReachabilityFailure(new Error('Failed to fetch')), true);
    assert.strictEqual(hooks.isReachabilityFailure(new Error('The request timed out')), true);
    assert.strictEqual(hooks.isReachabilityFailure(new Error('Unexpected token < in JSON')), false,
        'a parse failure must not resurrect an old value');
    assert.strictEqual(hooks.isReachabilityFailure(null), false,
        'an identity mismatch throws nothing, so no error means no fallback');

    // Expired entries are evicted before any live one competing for the same budget.
    const evicting = loadScriptTestHooks();
    const payload = 'x'.repeat(200 * 1024);
    for (let i = 0; i < 20; i += 1) evicting.cacheSet(`live_${i}`, { payload, i });
    const old = Date.now() - (10 * day);
    for (let i = 0; i < 20; i += 1) {
        evicting.seedRawStorage(`cache_dead_${i}`, JSON.stringify({
            data:{ payload }, ts: old, at: Date.now(), ttl: 7 * day, schema: 3,
        }));
    }
    evicting.cacheGC(true);
    const surviving = evicting.getStorageKeys().filter(k => k.startsWith('cache_'));
    assert(surviving.some(k => k.startsWith('cache_live_')), 'live values must survive');
    assert(surviving.filter(k => k.startsWith('cache_dead_')).length
        < surviving.filter(k => k.startsWith('cache_live_')).length,
        'expired fallbacks are worth less than live values and go first');

    // Every score source uses the shared fallback, and it labels what it rendered.
    assert.strictEqual((script.match(/await renderStaleScore\(this, cacheKey, lookupError, isCurrent\)/g) || []).length, 4,
        'all four score sources must offer the fallback');
    assert.strictEqual((script.match(/\} catch \{ \/\* handled below \*\/ \}/g) || []).length, 0,
        'the failure must be captured, not discarded, or its kind cannot be judged');
    const helper = script.slice(script.indexOf('function renderStaleScore'));
    assert(helper.includes("new Date(stale.ts).toISOString().slice(0, 10)"), 'the fallback must show its date');
    assert(helper.includes('`Cached ${date}`'), 'the fallback must say it is cached');
    assert(helper.includes('refreshFeature(feature.key)'), 'the fallback must offer a retry');
    /* Asserted as the literal guard, not as an ordering: indexOf returns -1 when the call
       is gone, and -1 sorts before everything, so an ordering check passes against a
       version that removed the gate entirely. */
    assert(helper.includes('if (!isReachabilityFailure(error)) return false;'),
        'the fallback must be gated on the failure being a reachability failure');
    assert(helper.indexOf('isReachabilityFailure') < helper.indexOf('cacheGetStale'),
        'and that gate must come before an old value is even looked up');
    /* A missing host grant is refused with the same opaque TypeError as a dead host, so
       without this the fallback fired for it: the widget showed last week's score with a
       Retry that could never succeed, the unavailable state that names the real problem
       was never reached, and nothing was recorded. */
    assert(helper.includes('if (!await hasFeatureOrigins(feature.key)) return false;'),
        'a failure that is really a missing host grant must not be dressed up as an outage');
    /* Tripwires, and named as such. Each of these was deleted wholesale in a mutation run
       and the suite stayed green, because the surrounding checks were loose enough to
       match the mutant. They are exact rather than behavioural because rendering these
       needs a real rating bar; the behaviour itself was verified in a loaded extension
       with the grant withheld against a live provider. */
    assert.strictEqual((script.match(/this\._renderUnavailable\(blocked \? 'access' : 'unavailable'\)/g) || []).length, 4,
        'every score lookup must distinguish a missing grant from an outage when it gives up');
    assert(script.includes("if (reason !== 'access') {"),
        'the unavailable note must keep a branch for a missing grant');
    assert(script.includes("'Site access not granted'"), 'and say so in those words');
    assert(/if \(!supportsOptionalPermissions\(\)\) return;\s*\n\s*widget\.appendChild/.test(script),
        'the Grant access button must stay out of a build that cannot grant anything');
    assert(/if \(await hasFeatureOrigins\(featureKey\)\) \{\s*\n\s*cacheSetUnavailable\(cacheKey\);/.test(script),
        'a lookup blocked only by a missing grant must record nothing, so the next visit retries');
    assert(helper.indexOf('hasFeatureOrigins') < helper.indexOf('cacheGetStale'),
        'the grant check must come before an old value is looked up');
    /* Presence first, then order. indexOf returns -1 when the guard is gone and -1 sorts
       before everything, so an ordering check alone passes against a version that deleted
       the guard entirely. */
    assert(helper.includes('if (!isCurrent()) return true;'),
        'the grant check is asynchronous, so the page must be rechecked before painting');
    assert(helper.indexOf('if (!isCurrent()) return true;') < helper.indexOf('feature._render(stale.data)'),
        'and that recheck must come before anything is painted');

    /* A script manager hands its callbacks a response object with no name and no message.
       classifyFailure read those, so every provider outage in the userscript build came
       back unclassified, isReachabilityFailure said false, and this whole feature was
       extension-only. The cause is now stated on the rejection. */
    ['onerror', 'ontimeout', 'onabort'].forEach(callback => {
        assert(new RegExp(`${callback}: response => finish\\(reject, describeRequestFailure\\(`).test(script),
            `${callback} must state the cause rather than reject with the manager's own object`);
    });
    const hooks2 = loadScriptTestHooks();
    const managerResponse = { status:0, readyState:4, responseText:'', error:'Network Error' };
    assert.strictEqual(hooks2.classifyFailure(managerResponse), 'unknown',
        'a bare manager response really does carry nothing to classify');
    assert.strictEqual(hooks2.classifyFailure(hooks2.describeRequestFailure('network', managerResponse, 'https://www.rottentomatoes.com/x')), 'network',
        'a network failure raised by this script must classify as network');
    assert.strictEqual(hooks2.classifyFailure(hooks2.describeRequestFailure('timeout', managerResponse, 'https://www.rottentomatoes.com/x')), 'timeout',
        'a timeout must classify as a timeout, not as unclassified');
    assert.strictEqual(hooks2.classifyFailure(hooks2.describeRequestFailure('aborted', {}, 'https://www.rottentomatoes.com/x')), 'aborted',
        'a cancelled request must stay a cancellation');
    // The bridge routes every failure through onerror, so its own classification wins.
    assert.strictEqual(hooks2.classifyFailure(hooks2.describeRequestFailure('network', { errorType:'timeout', message:'Timed out' }, 'https://x.test/')), 'timeout',
        'the background knows a timeout from a dead host and the callback that fired does not');
    /* This required "network", which was wrong twice over: those categories had never
       been network, and calling them that made isReachabilityFailure true for a request
       the worker deliberately refused, so a blocked redirect rendered a stale score with
       a Retry that could only be refused again. See the refusal test above. */
    assert.strictEqual(hooks2.classifyFailure(hooks2.describeRequestFailure('network', { errorType:'redirect_blocked', message:'Blocked' }, 'https://x.test/')), 'permission',
        'a refusal by the worker is a permission failure, not the service being unreachable');
    // A failure travels to the journal and the diagnostics report, so it carries no title.
    const described = hooks2.describeRequestFailure('network', managerResponse, 'https://www.rottentomatoes.com/m/the_matrix');
    assert(!/the_matrix/.test(String(described.message)), 'a failure message must not carry what was looked up');
});

/* IE-87: destinations rot, and an earlier attempt at noticing that from the user's
   browser leaked browsing intent and could not tell a dead host from a missing favicon.
   This is a developer command instead. */
test('the destination health report classifies without guessing or leaking', () => {
    const checker = require('../scripts/check-destinations.js');

    // The sample is a fixed placeholder, never anything a user was looking at.
    assert.strictEqual(checker.SAMPLE.IMDB_ID, 'tt0133093');
    const script = fs.readFileSync(path.join(root, 'scripts', 'check-destinations.js'), 'utf8');
    // `location` alone would match the redirect Location header this legitimately reads.
    assert(!/getTitleText|getIMDbID|window\.location|document\.|GM_getValue/.test(script),
        'the report must never read the page a user is on, or their stored settings');
    // Advisory: a bot wall says nothing about whether a browser can reach the site.
    assert(script.includes('process.exit(0)'), 'the report must not fail a release on its own');
    assert(!/writeFileSync\([^)]*IMDb_Enhanced\.user\.js/.test(script),
        'the report must never edit a destination list');

    /* A challenge page is small and says so near the top. Matching the phrase anywhere
       flagged Wikipedia and Letterboxd, whose ordinary copy mentions captchas and
       JavaScript — and a report with false alarms in it stops being read. */
    const realWall = '<html><head><title>Just a moment...</title></head><body>checking your browser</body></html>';
    assert.strictEqual(checker.classifyBody(200, realWall), checker.CATEGORY.BOT_BLOCKED);
    const bigPageMentioningCaptcha = `<html><head><title>Search results</title></head><body>${'result '.repeat(20000)}captcha</body></html>`;
    assert.strictEqual(checker.classifyBody(200, bigPageMentioningCaptcha), checker.CATEGORY.OK,
        'a large results page that merely mentions a captcha is not a bot wall');

    assert.strictEqual(checker.classifyBody(404, '<html>nope</html>'), checker.CATEGORY.NOT_FOUND);
    assert.strictEqual(checker.classifyBody(503, '<html>oops</html>'), checker.CATEGORY.SERVER_ERROR);
    assert.strictEqual(checker.classifyBody(403, '<html>forbidden</html>'), checker.CATEGORY.AUTH_REQUIRED);
    assert.strictEqual(checker.classifyBody(200, '<html>No results found</html>'), checker.CATEGORY.SEMANTIC_MISMATCH);
    assert.strictEqual(checker.classifyBody(200, '<html>not available in your country</html>'), checker.CATEGORY.GEO_BLOCKED);
    // The four review reasons the acceptance asks to keep distinct really are distinct.
    assert.strictEqual(new Set([
        checker.CATEGORY.BOT_BLOCKED, checker.CATEGORY.AUTH_REQUIRED,
        checker.CATEGORY.GEO_BLOCKED, checker.CATEGORY.SEMANTIC_MISMATCH,
    ]).size, 4);
    Object.values(checker.CATEGORY).filter(c => c !== checker.CATEGORY.OK).forEach(category => {
        assert(checker.NEEDS_REVIEW[category], `${category} needs a plain-language review reason`);
    });

    assert.strictEqual(checker.classifyNetworkError({ cause:{ code:'ENOTFOUND' } }), checker.CATEGORY.DNS_ERROR);
    assert.strictEqual(checker.classifyNetworkError({ name:'TimeoutError' }), checker.CATEGORY.TIMEOUT);
    assert.strictEqual(checker.classifyNetworkError({ cause:{ code:'CERT_HAS_EXPIRED' } }), checker.CATEGORY.TLS_ERROR);

    // Templates expand against the placeholder, not against empty strings.
    assert.strictEqual(checker.expand('https://x.test/s?q={{TITLE}}&y={{YEAR}}'),
        'https://x.test/s?q=The%20Matrix&y=1999');
    assert(checker.collectDestinations({ includeCatalog:false }).length >= 20,
        'the report should cover every shipped default');
    assert(checker.collectDestinations({ includeCatalog:true }).length
        > checker.collectDestinations({ includeCatalog:false }).length,
        '--catalog must widen the check');
});

/* IE-70: notes are paywalled by every tracker that offers them and absent from IMDb, and
   they fit the existing marks store exactly — same bound, same normalizer, same backup. */
test('a title can carry a private note that survives backup and never leaks', () => {
    const hooks = loadScriptTestHooks();

    // A note can exist without a Seen/Skip state; requiring one would discard it.
    assert(hooks.setUserNote('tt0133093', 'the one with the twist', 'The Matrix'));
    assert.strictEqual(hooks.getUserNote('tt0133093'), 'the one with the twist');
    assert.strictEqual(hooks.getUserMark('tt0133093'), '', 'a note must not invent a Seen mark');

    // Marking, then clearing the mark, must not take the note with it.
    assert(hooks.setUserMark('tt0133093', 'watched', 'The Matrix'));
    assert.strictEqual(hooks.getUserNote('tt0133093'), 'the one with the twist', 'marking must preserve the note');
    assert(hooks.setUserMark('tt0133093', ''));
    assert.strictEqual(hooks.getUserNote('tt0133093'), 'the one with the twist', 'unmarking must preserve the note');
    assert.strictEqual(hooks.getUserMark('tt0133093'), '');

    // Clearing the last of both removes the record rather than leaving an empty one to
    // be counted, exported, and pushed against the storage bound forever.
    assert(hooks.setUserNote('tt0133093', ''));
    assert(!Object.prototype.hasOwnProperty.call(hooks.getUserMarks(true), 'tt0133093'),
        'a record with neither a mark nor a note must not persist');

    // Bounded and sanitized like every other stored string.
    const long = 'x'.repeat(hooks.USER_MARK_NOTE_LIMIT + 200);
    hooks.setUserNote('tt0111161', long, 'Shawshank');
    assert.strictEqual(hooks.getUserNote('tt0111161').length, hooks.USER_MARK_NOTE_LIMIT, 'notes must be bounded');
    hooks.setUserNote('tt0111161', 'line one\r\nline two\n\n\n\nline three  ');
    assert.strictEqual(hooks.getUserNote('tt0111161'), 'lineone\nline two\n\nline three',
        'control characters are stripped, newlines normalized, runs collapsed');
    assert.strictEqual(hooks.normalizeUserNote(12345), '', 'a non-string note is not a note');

    // Records are versioned so a later field is a migration, not a rewrite.
    const record = hooks.getUserMarks(true).tt0111161;
    assert.strictEqual(record.v, 1, 'mark records must carry their version');

    // Round-trips through backup and restore with everything else.
    const backup = hooks.getExportSettings();
    assert.strictEqual(backup.userMarks.tt0111161.note, hooks.getUserNote('tt0111161'),
        'a note must be included in a backup');
    const restored = hooks.prepareSettingsImport(backup).entries.find(e => e.key === 'userMarks');
    assert.strictEqual(restored.value.tt0111161.note, hooks.getUserNote('tt0111161'),
        'a note must survive import unchanged');

    // A legacy record with no note still normalizes, and a note-only import is accepted.
    const legacy = hooks.prepareSettingsImport({
        userMarks:{ tt0068646:'watched', tt0071562:{ note:'sequel', title:'Part II' } },
    }).entries[0].value;
    assert.strictEqual(legacy.tt0068646.state, 'watched');
    assert.strictEqual(legacy.tt0068646.note, undefined, 'a record without a note gains no empty one');
    assert.strictEqual(legacy.tt0071562.note, 'sequel', 'a note-only record must import');
    assert.strictEqual(legacy.tt0071562.state, '', 'a note-only record has no state');

    /* Notes never leave the browser. The diagnostics report is the one thing a user is
       invited to paste in public, and it already reduces marks to a count. */
    hooks.setUserNote('tt0133093', 'SECRET-NOTE-TEXT', 'The Matrix');
    const report = hooks.buildDiagnosticsReport();
    assert(!report.includes('SECRET-NOTE-TEXT'), 'a note must never reach the diagnostics report');
    assert(!hooks.formatFailureJournal().includes('SECRET-NOTE-TEXT'), 'a note must never reach the journal');

    // Rendered as text rather than markup, since a note is arbitrary user input.
    assert(script.includes("className:'enh-mark-row__note'"), 'the marks panel must show notes');
    assert(!/enh-mark-row__note[\s\S]{0,200}?innerHTML/.test(script), 'a note must never be set as HTML');
    // The editor lives on title pages and is bounded at the input too.
    assert(script.includes("maxlength:String(USER_MARK_NOTE_LIMIT)"), 'the note field must enforce the stored bound');
    assert(script.includes("id:'enh-title-note'"), 'title pages need a note editor');

    /* Remove used to clear the note and then the mark, as two separate writes. A failure
       between them destroyed the note and kept the mark, which is neither what was asked
       for nor something the user can undo. One write, or the record survives whole. */
    const clearHandler = script.slice(script.indexOf("className:'enh-mark-row__clear'"));
    const clearBody = clearHandler.slice(0, clearHandler.indexOf("}, 'Remove')"));
    assert(!/setUserNote\([^)]*\)\s*\|\|\s*!setUserMark\(/.test(clearBody),
        'removing a record must not be a note write followed by a mark write');
    assert.strictEqual((clearBody.match(/setUserMarks\(|setUserMark\(|setUserNote\(/g) || []).length, 1,
        'removing a record must be a single write');
    assert(/delete remaining\[id\];/.test(clearBody), 'and it must drop the whole record, note included');
});

/* IE-74: the trailer modal's Escape and Tab handling are document-level, so both go dead
   the moment focus enters the cross-origin YouTube embed. Keystrokes there are unreachable
   by design, so this needs a focus answer rather than another handler. */
test('the trailer modal stays closable when focus is inside the embed', () => {
    const modal = script.slice(script.indexOf('_renderModal(message)'));
    const body = modal.slice(0, modal.indexOf('_closeModal(restoreFocus'));

    /* One sentinel, after the embed. The close button already precedes the iframe in DOM
       order, so tabbing backward out of the embed reaches it directly and a sentinel
       before the dialog would never receive focus. Dead code that looks like a safety net
       is worse than none. */
    assert(body.includes("makeSentinel('after')"), 'focus leaving the embed forward must be caught');
    assert(!body.includes("makeSentinel('before')"), 'a sentinel that can never receive focus must not exist');
    assert(body.indexOf('enh-trailer-close') < body.indexOf("className:'enh-trailer-body'"),
        'the close button must precede the embed, which is what makes one sentinel enough');
    assert(/const makeSentinel = position => makeEl\('div', \{[\s\S]{0,240}?tabindex:'0'/.test(body),
        'a sentinel has to be focusable to catch anything');
    assert(/onFocus: \(\) => \{ document\.querySelector\('#enh-trailer-dialog \.enh-trailer-close'\)\?\.focus\(\); \}/.test(body),
        'a focused sentinel must hand focus to the close button');
    /* Excluded from the focus trap by class, not by aria-hidden on a focusable element,
       which is an accessibility violation in its own right. */
    assert(!/makeSentinel[\s\S]{0,260}?'aria-hidden'/.test(body),
        'a focusable sentinel must not claim to be hidden from assistive technology');
    assert(script.includes("!element.classList?.contains('enh-trailer-sentinel')"),
        'the trap must skip sentinels so its first and last are unchanged');

    // No second close control: the existing visible one is what has to be reachable, so
    // count the control itself rather than every mention of its class.
    assert.strictEqual((script.match(/className:'enh-trailer-close'/g) || []).length, 1,
        'the modal must keep exactly one close control, not gain a duplicate');
    // Closing still returns focus to whatever opened it.
    assert(script.includes('if (wasOpen && restoreFocus) this._lastFocused?.focus?.();'),
        'closing must restore the opener focus');
    // The sentinel must not be positioned with a negative margin; the layout guard
    // rejects those, and the size-and-clip form is what the rest of the file uses.
    assert(/\.enh-trailer-sentinel \{[^}]*clip-path: inset\(50%\)/.test(script),
        'the sentinel must be hidden without a negative margin');
});

/* IE-11: fade what you would skip past, without making anything harder to read. */
test('low-rated cards dim their artwork only, and unrated cards are left alone', () => {
    const hooks = loadScriptTestHooks();
    const row = text => ({
        querySelector: selector => {
            if (selector === '.ipc-rating-star--imdb') {
                return text === null ? null : {
                    textContent: text,
                    querySelector: inner => (inner === '.ipc-rating-star--rating' ? { textContent:text } : null),
                };
            }
            return null;
        },
    });
    assert.strictEqual(hooks.readCardRating(row('9.3')), 9.3);
    assert.strictEqual(hooks.readCardRating(row('5,8')), 5.8, 'a comma decimal must parse; some locales render it');
    assert.strictEqual(hooks.readCardRating(row('7')), 7);
    assert.strictEqual(hooks.readCardRating(row('')), null);
    assert.strictEqual(hooks.readCardRating(row(null)), null, 'a card with no rating element is unrated');
    assert.strictEqual(hooks.readCardRating(row('Rate')), null, 'the rate prompt is not a score');
    assert.strictEqual(hooks.readCardRating(row('12.5')), null, 'a value outside the scale is not a score');

    assert.strictEqual(hooks.normalizeDimThreshold('7.0'), '7.0');
    assert.strictEqual(hooks.normalizeDimThreshold('99'), '6.0', 'an unknown threshold falls back to the default');
    assert.strictEqual(hooks.normalizeDimThreshold(null), '6.0');

    const defaults = Object.fromEntries(hooks.getDefaultSettingsEntries().map(e => [e.key, e.value]));
    assert.strictEqual(defaults.dimLowRated, false, 'an opinion about other people\'s taste must be opt-in');

    const feature = script.slice(script.indexOf("key: 'dimLowRated'"));
    const body = feature.slice(0, feature.indexOf("key: 'markFilters'"));
    // Artwork only: dimming the title or its score would fail the contrast the rest of
    // the product holds to, and this is meant to be skimmable, not unreadable.
    assert(/\.enh-dim-low img \{ opacity/.test(body), 'only the image may be dimmed');
    assert(!/\.enh-dim-low \{ opacity/.test(body), 'the card itself must not be dimmed');
    assert(/\.enh-dim-low:hover img[^}]*opacity: 1/.test(body), 'hover must restore the artwork');
    assert(/:focus-within img[^}]*opacity: 1/.test(body), 'keyboard focus must restore the artwork too');
    assert(/forced-colors: active[^}]*opacity: 1/.test(body), 'forced colours must not be dimmed');
    assert(body.includes('rating !== null && rating < threshold'),
        'an unrated card must not be treated as low-rated');
    assert(body.includes("this._observer?.disconnect()"), 'the observer must be torn down with the route');
});

/* IE-82: marks decorated cards but could not narrow a collection, which is where a long
   chart or watchlist most needs them. */
test('private marks can filter a collection without a request', () => {
    const hooks = loadScriptTestHooks();
    // Sandbox arrays are cross-realm, so compare contents rather than identity.
    assert.strictEqual(hooks.MARK_FILTERS.map(filter => filter.id).join(','), 'all,unseen,watched,skip');

    const marks = {
        tt0000001:{ state:'watched' },
        tt0000002:{ state:'skip' },
        tt0000003:{ state:'watched' },
    };
    const card = id => ({ card:{ dataset:{ enhMarkId:id } }, id, duplicate:false });
    const cards = ['tt0000001', 'tt0000002', 'tt0000003', 'tt0000004', 'tt0000005'].map(card);
    assert.deepStrictEqual({ ...hooks.countMarkFilters(cards, marks) },
        { all:5, unseen:2, watched:2, skip:1 });

    // Counts are over unique titles: some surfaces render a title twice.
    const withDuplicate = [...cards, { ...card('tt0000001'), duplicate:true }];
    assert.strictEqual(hooks.countMarkFilters(withDuplicate, marks).all, 5,
        'a title rendered twice must be counted once');

    assert(hooks.markMatchesFilter('watched', 'all'));
    assert(hooks.markMatchesFilter(undefined, 'all'));
    assert(hooks.markMatchesFilter(undefined, 'unseen'));
    assert(hooks.markMatchesFilter('', 'unseen'), 'a cleared mark counts as unseen');
    assert(!hooks.markMatchesFilter('watched', 'unseen'));
    assert(!hooks.markMatchesFilter('skip', 'unseen'));
    assert(hooks.markMatchesFilter('watched', 'watched'));
    assert(!hooks.markMatchesFilter('watched', 'skip'));

    /* Rows are resolved from their own title links, never from the cards the marks
       feature has decorated. Those sets differ: decoration walks the page progressively,
       so on a 250-row chart it was half done when a filter ran and "Seen" showed the 2
       marked titles plus 125 rows the filter had never seen. Caught only on the live
       page, because a fixture decorates everything instantly. */
    const collector = script.slice(script.indexOf('function collectMarkFilterCards'));
    const collectorBody = collector.slice(0, collector.indexOf('\n    function countMarkFilters'));
    assert(collectorBody.includes("querySelectorAll?.('a[href*=\"/title/tt\"]')"),
        'the filter must see every row on the page, not only the decorated ones');
    assert(!collectorBody.includes('enh-markable-card'),
        'the filter must not depend on how far another feature has decorated');
    assert(collectorBody.includes('getLinkedTitleId(link.href)'),
        'row ids must come from the shared bounded title-link parser');
    assert(collectorBody.includes('COLLECTION_LINK_SCAN_LIMIT'), 'the row scan needs the collection budget');

    /* Assigning textContent is a replace-all — the old text node goes, a new one arrives,
       even for an identical string — so it queues a childList record. A paint driven by a
       MutationObserver that writes text into the subtree it observes therefore re-triggers
       itself: measured at ~60 repaints per second on an idle page, which also drove the
       dim-low-rated observer watching the same root. Every such write must be guarded. */
    assert.strictEqual(hooks.setTextIfChanged({ textContent:'5' }, '5'), false,
        'an unchanged write must not touch the DOM at all');
    const node = { textContent:'5' };
    assert.strictEqual(hooks.setTextIfChanged(node, 6), true);
    assert.strictEqual(node.textContent, '6');

    const feature = script.slice(script.indexOf("key: 'markFilters'"));
    const body = feature.slice(0, feature.indexOf("key: 'servarrIntegration'"));
    // Every text write inside an observed subtree, in every observer-driven paint.
    [
        { name:'markFilters', region:body },
        { name:'listRuntimeSummary', region:script.slice(script.indexOf("key: 'listRuntimeSummary'"), script.indexOf("key: 'listMultiSearch'")) },
    ].forEach(({ name, region }) => {
        assert(region.includes('new MutationObserver'), `${name} should be observer-driven`);
        const unguarded = region.match(/^\s*(?!\/\/)[^\n]*\.textContent\s*=/gm) || [];
        assert.strictEqual(unguarded.length, 0,
            `${name} writes textContent inside the subtree it observes: ${unguarded.join(' | ')}`);
    });
    // The bar's own display outranks the UA [hidden] rule, so hiding it needs its own rule.
    assert(body.includes('#enh-mark-filters[hidden] { display: none; }'),
        'an empty filter bar must actually hide, not merely carry the attribute');

    /* Surfaces: the acceptance names lists, charts, watchlists, search and person pages.
       A title subpage carries one title plus a breadcrumb back to it, so a filter over a
       single card is noise — and it did render there. */
    hooks.setTestPath('/title/tt0133093/fullcredits/');
    assert.strictEqual(hooks.getPageSurface(), 'title-subpage');
    assert(!hooks.shouldInitFeature({ key:'markFilters', group:'Utility' }),
        'the filter must not appear on a title subpage');
    assert(!hooks.shouldInitFeature({ key:'dimLowRated', group:'Appearance' }),
        'dimming has nothing to do on a title subpage');
    hooks.setTestPath('/name/nm0000206/');
    assert.strictEqual(hooks.getPageSurface(), 'name');
    assert(hooks.shouldInitFeature({ key:'markFilters', group:'Utility' }),
        'a filmography is exactly the long list this is for');
    hooks.setTestPath('/chart/top/');
    assert(hooks.shouldInitFeature({ key:'markFilters', group:'Utility' }));
    hooks.setTestPath('/search/title/');
    assert(hooks.shouldInitFeature({ key:'markFilters', group:'Utility' }));
    /* A season's episode list is routed here too, and every row is an <article> matching
       none of the card selectors — so the bar rendered with all counts at zero, stayed
       hidden, and kept a document-wide observer running for nothing. Episodes do carry
       marks, from the season bar's batch buttons and from each episode's own page.
       Measured in a loaded extension on an 8-row season with 2 seen and 1 skipped:
       before, All 0 / Unseen 0 / Seen 0 / Skipped 0 and the bar hidden; after,
       All 8 / Unseen 5 / Seen 2 / Skipped 1, and the Seen filter leaves 2 rows visible. */
    hooks.setTestPath('/title/tt0306414/episodes/');
    assert.strictEqual(hooks.getPageSurface(), 'episodes');
    assert(hooks.shouldInitFeature({ key:'markFilters', group:'Utility' }),
        'a season list is a long card list too');
    assert(/const MARK_FILTER_ROW_SELECTOR = `[^`]*\$\{EPISODE_ROW_SELECTOR\}`/.test(script),
        'the filter must be able to resolve an episode row, or it is a hidden bar with a live observer');
    // One definition, not two copies: a duplicated selector is how one of them rots.
    assert.strictEqual((script.match(/'article\.episode-item-wrapper'/g) || []).length, 1,
        'the episode row selector must be declared once');
    // Pure DOM over cards already present: no request of any kind.
    ['httpRequest', 'GM_xmlhttpRequest', 'fetch(', 'graphql'].forEach(token => {
        assert(!body.includes(token), `filtering must not ${token}`);
    });
    // Order is preserved because cards are hidden in place, never moved.
    ['appendChild', 'insertBefore', 'sort('].forEach(token => {
        assert(!new RegExp(`${token.replace('(', '\\(')}[^\\n]*card`).test(body), `filtering must not reorder cards (${token})`);
    });
    /* A class with !important, not the hidden property: these are IMDb's own list items
       and they carry their own display, which the UA [hidden] rule loses to. */
    assert(body.includes('.enh-mark-filtered-out { display: none !important; }'),
        'hiding must outrank the row\'s own display');
    assert(body.includes("classList.toggle('enh-mark-filtered-out', !match)"), 'non-matching rows are hidden in place');
    // Everything comes back when the feature stops, whatever filter was active.
    assert(/document\.querySelectorAll\('\.enh-mark-filtered-out'\)\.forEach\(node => node\.classList\.remove/.test(body),
        'teardown must restore every hidden row');
    // Recount as rows load and as marks change.
    assert(body.includes("document.addEventListener('imdb-enhanced:marks-updated'"), 'marks changes must recount');
    assert(body.includes('new MutationObserver(schedule)'), 'lazy-loaded rows must recount');
    assert(body.includes("this._observer?.disconnect()"), 'the observer must be torn down with the route');
    // Keyboard: a radiogroup that only responds to clicks is a set of buttons in costume.
    assert(body.includes("role:'radiogroup'") && body.includes("role:'radio'"), 'the filter needs group semantics');
    ['ArrowRight', 'ArrowLeft', 'Home', 'End'].forEach(key => {
        assert(body.includes(`'${key}'`), `the radiogroup must handle ${key}`);
    });
    assert(body.includes('button.tabIndex = checked ? 0 : -1'), 'a radiogroup exposes one tab stop');
    assert(body.includes('__empty'), 'an empty result needs to say so');
    // Without marks there is nothing to filter, so the bar must not appear at all.
    assert(body.includes("if (!get('watchedMarking')) return;"), 'the filter depends on marks being on');
});

/* IE-17: "how long is this list" is answerable from data already on the page. */
test('collection runtime totals are summed and say what they could not count', () => {
    const hooks = loadScriptTestHooks();

    assert.strictEqual(hooks.parseRuntimeMinutes('2h 22m'), 142);
    assert.strictEqual(hooks.parseRuntimeMinutes('3h'), 180);
    assert.strictEqual(hooks.parseRuntimeMinutes('45m'), 45);
    // Every other cell in the same metadata list must read as "no runtime", or a year
    // would be summed as minutes.
    ['1994', '2008–2013', 'R', 'TV-MA', 'TV Series', '', 'Not Rated'].forEach(text => {
        assert.strictEqual(hooks.parseRuntimeMinutes(text), 0, `${text} must not parse as a runtime`);
    });
    assert.strictEqual(hooks.parseRuntimeMinutes('99h 99m'), 0, 'an implausible row must be rejected, not summed');

    assert.strictEqual(hooks.formatRuntimeTotal(142), '2:22');
    assert.strictEqual(hooks.formatRuntimeTotal(60), '1:00');
    assert.strictEqual(hooks.formatRuntimeTotal(5), '0:05');
    assert.strictEqual(hooks.formatRuntimeTotal(0), '0:00');

    /* Rows shaped like the live DOM. Verified 2026-08-31: a film row's metadata reads
       ["1994", "2h 22m", "R"], a series row ["2008–2013", "TV-MA", "TV Series"] with no
       runtime at all, so a list of series is legitimately partial. */
    const row = cells => ({
        querySelectorAll: () => cells.map(text => ({ textContent:text })),
    });
    const films = [row(['1994', '2h 22m', 'R']), row(['1972', '2h 55m', 'R'])];
    assert.deepStrictEqual(
        { ...hooks.summarizeCollectionRuntime(films) },
        { counted:2, missing:0, minutes:317, total:2 });
    assert.strictEqual(hooks.describeCollectionRuntime(hooks.summarizeCollectionRuntime(films)), '2 titles · 5:17 total');

    const mixed = [...films, row(['2008–2013', 'TV-MA', 'TV Series'])];
    assert.strictEqual(
        hooks.describeCollectionRuntime(hooks.summarizeCollectionRuntime(mixed)),
        '3 titles · 5:17 total from 2 · 1 without a listed runtime',
        'a partial total must say how much it could not count rather than under-reporting silently');

    const seriesOnly = [row(['2008–2013', 'TV-MA', 'TV Series'])];
    assert.strictEqual(hooks.describeCollectionRuntime(hooks.summarizeCollectionRuntime(seriesOnly)),
        '1 title · no runtimes listed');
    assert.strictEqual(hooks.describeCollectionRuntime(hooks.summarizeCollectionRuntime([])), '',
        'an empty collection renders nothing rather than a zero');

    // The same finite budget the other collection scans use.
    const many = Array.from({ length:hooks.COLLECTION_LINK_SCAN_LIMIT + 25 }, () => row(['1994', '1h 0m', 'R']));
    assert.strictEqual(hooks.summarizeCollectionRuntime(many).total, hooks.COLLECTION_LINK_SCAN_LIMIT,
        'the runtime scan must honour the collection link budget');

    // Stable IMDb component class, never the hashed styled-components wrapper beside it.
    assert(script.includes("COLLECTION_METADATA_SELECTOR = '.cli-title-metadata'"),
        'runtime parsing must hang off a stable class');
    assert(/#enh-runtime-summary[\s\S]{0,120}?role:'status'/.test(script) || script.includes("id:'enh-runtime-summary', role:'status'"),
        'the total must announce itself when it changes');
    // Collection pages append rows as you scroll, so a total computed once goes stale.
    const feature = script.slice(script.indexOf("key: 'listRuntimeSummary'"));
    assert(/new MutationObserver/.test(feature.slice(0, 2500)), 'the total must recount as rows load');
    assert(/this\._observer\?\.disconnect\(\)/.test(feature.slice(0, 3500)), 'the observer must be torn down with the route');
});

/* IE-84: the in-memory failure list vanished on reload, so the failures worth
   correlating — an intermittent provider, a selector that breaks on some routes — were
   the ones a user could never report. */
test('the failure journal survives a reload and carries no free text', () => {
    const hooks = loadScriptTestHooks();
    hooks.setTestPath('/title/tt0133093/');

    /* The privacy guarantee is structural: entries hold a category, never a message. A
       real error string can carry the title, the full lookup URL with its query, DOM
       text, or a token a local service echoed back. Feed exactly those in. */
    const leaky = [
        new Error('Failed to fetch https://www.rottentomatoes.com/search?search=The%20Matrix&apikey=SECRET123'),
        new Error('Cannot read properties of null reading "The Dark Knight"'),
        new Error('Radarr said: {"apiKey":"abcdef123456","title":"Inception"}'),
        new Error('Unexpected token < in JSON at position 0'),
    ];
    leaky.forEach((error, index) => hooks.recordFeatureFailure({ key:`feature${index}` }, 'init', error));

    const stored = hooks.getStoredSetting('failureJournal');
    assert(Array.isArray(stored) && stored.length === leaky.length, 'failures must persist to storage');
    const serialized = JSON.stringify(stored);
    ['SECRET123', 'abcdef123456', 'The Matrix', 'The Dark Knight', 'Inception', 'rottentomatoes.com', 'search?search']
        .forEach(secret => assert(!serialized.includes(secret), `the journal leaked ${secret}`));
    stored.forEach(entry => {
        assert.deepStrictEqual(Object.keys(entry).sort(), ['build', 'category', 'key', 'route', 'ts', 'v'],
            'a journal entry must carry no field beyond its fixed shape');
        assert(hooks.FAILURE_CATEGORIES.includes(entry.category), `unknown category ${entry.category}`);
    });

    // Classification is useful, not just safe.
    assert.strictEqual(hooks.classifyFailure(new Error('Failed to fetch')), 'network');
    assert.strictEqual(hooks.classifyFailure(new Error('Cannot read properties of null')), 'selector');
    assert.strictEqual(hooks.classifyFailure(new Error('Unexpected token < in JSON')), 'parse');
    assert.strictEqual(hooks.classifyFailure(new Error('quota exceeded')), 'storage');
    assert.strictEqual(hooks.classifyFailure({ name:'AbortError', message:'' }), 'aborted');
    assert.strictEqual(hooks.classifyFailure(new Error('')), 'unknown');

    // Bounded, and the bound keeps the newest.
    for (let index = 0; index < 40; index += 1) {
        hooks.recordFeatureFailure({ key:`bulk${index}` }, 'route', new Error('Failed to fetch'));
    }
    const bounded = hooks.getFailureJournal();
    assert.strictEqual(bounded.length, 20, 'the journal must stay at its bound');
    assert.strictEqual(bounded[bounded.length - 1].key, 'bulk39', 'the newest failure must survive');

    // A stored entry of a different shape is dropped, not half-read.
    hooks.seedStoredSetting('failureJournal', [
        { v:0, ts:Date.now(), key:'legacy', category:'network' },
        { v:1, ts:Date.now(), key:'good', category:'network', route:'title', build:'2.15.0' },
        { v:1, ts:Date.now(), key:'bad category', category:'nonsense', route:'title', build:'2.15.0' },
        { v:1, ts:Date.now(), key:'has space', category:'network', route:'title', build:'2.15.0' },
        'not an object',
    ]);
    const survivors = hooks.getFailureJournal();
    assert.deepStrictEqual(survivors.map(entry => entry.key), ['good'],
        'only entries matching the current shape may be read back');

    // Copyable, clearable, and cleared by a full reset.
    assert(hooks.formatFailureJournal().includes('good'), 'the journal must render for copying');
    assert(hooks.clearFailureJournal());
    assert.strictEqual(hooks.getFailureJournal().length, 0);
    assert.strictEqual(hooks.formatFailureJournal(), 'No failures recorded.');

    hooks.recordFeatureFailure({ key:'later' }, 'init', new Error('Failed to fetch'));
    hooks.applySettingsImport(hooks.getDefaultSettingsEntries());
    assert.strictEqual(hooks.getFailureJournal().length, 0, 'a full reset must clear the journal');

    // It is an array setting but not a site list, so it needs its own normalizer.
    const roundTrip = hooks.prepareSettingsImport({
        failureJournal:[{ v:1, ts:Date.now(), key:'kept', category:'network', route:'title', build:'2.15.0' }],
    });
    assert.strictEqual(roundTrip.entries[0].value.length, 1,
        'the journal must survive import rather than being normalized as a site list');

    assert(script.includes("id:'enh-journal-copy'") && script.includes("id:'enh-journal-clear'"),
        'the journal needs copy and clear controls');
});

/* IE-75: the extension required every score, ad, video and loopback origin at install
   even with the feature switched off, so the install prompt described a far broader reach
   than the product had. */
test('external access is requested per feature, not demanded at install', () => {
    const hooks = loadScriptTestHooks();
    const groups = hooks.FEATURE_ORIGIN_GROUPS;

    // Every group belongs to a real setting, or it is asking for something nothing uses.
    const defaults = Object.fromEntries(hooks.getDefaultSettingsEntries().map(entry => [entry.key, entry.value]));
    Object.keys(groups).forEach(key => {
        assert(Object.prototype.hasOwnProperty.call(defaults, key),
            `${key} declares origins but is not a setting`);
        assert(groups[key].length, `${key} declares an empty origin group`);
    });
    // Conversely, every feature that talks to a third party must declare it.
    ['inlineRTScore', 'inlineMetacriticScore', 'inlineLetterboxdScore', 'streamAvailability',
        'trailerPopover', 'servarrIntegration', 'mediaServerIntegration'].forEach(key => {
        assert(groups[key]?.length, `${key} reaches a third party but declares no origins`);
    });
    assert(!hooks.OPTIONAL_ORIGINS.includes('https://www.imdb.com/*'),
        'IMDb is required, so it must not also be optional');

    /* Wikidata is the shared identity resolver for three score sources and loopback is
       shared by both local integrations, so turning one off must not revoke access the
       others still depend on. */
    const shared = 'https://query.wikidata.org/*';
    ['inlineRTScore', 'inlineMetacriticScore', 'inlineLetterboxdScore'].forEach(key => {
        assert(groups[key].includes(shared), `${key} resolves identity through Wikidata and must declare it`);
    });
    hooks.seedStoredSetting('inlineMetacriticScore', true);
    hooks.seedStoredSetting('inlineLetterboxdScore', false);
    hooks.seedStoredSetting('streamAvailability', false);
    const stillHeld = hooks.originsHeldByOtherEnabledFeatures('inlineRTScore');
    assert(stillHeld.has(shared), 'a shared origin another enabled source needs must not be released');
    assert(!stillHeld.has('https://www.rottentomatoes.com/*'), 'an origin only this feature needs is releasable');
    // The set the release path actually hands to permissions.remove, not just the helper.
    assert.deepStrictEqual([...hooks.releasableOriginsFor('inlineRTScore')], ['https://www.rottentomatoes.com/*'],
        'disabling one score source must not revoke the resolver its siblings still use');
    hooks.seedStoredSetting('inlineMetacriticScore', false);
    hooks.seedStoredSetting('inlineLetterboxdScore', false);
    assert.deepStrictEqual(
        [...hooks.releasableOriginsFor('inlineRTScore')].sort(),
        ['https://query.wikidata.org/*', 'https://www.rottentomatoes.com/*'],
        'once no sibling needs it, the shared resolver is released too');

    /* Origin patterns are not user-facing text, and neither are hostnames. This used to
       require "www.rottentomatoes.com and query.wikidata.org": those are the hosts the
       code calls, not the services a reader recognizes, and "backend.metacritic.com" read
       like something had gone wrong. The providers declare a name; use it. */
    assert.strictEqual(hooks.describeFeatureOrigins('inlineRTScore'), 'Rotten Tomatoes and Wikidata');
    assert.strictEqual(hooks.describeFeatureOrigins('inlineMetacriticScore'), 'Metacritic and Wikidata',
        'the service is Metacritic, whatever its API host is called');
    assert.strictEqual(hooks.describeFeatureOrigins('servarrIntegration'), 'your own computer',
        'four loopback patterns should read as one plain phrase');
    assert(!/\*/.test(hooks.describeFeatureOrigins('removeAds')), 'wildcards must not reach the user');
    /* The only sentence this name appears in is "needs access to ...", so naming the hosts
       accurately still reads as though the extension wanted to advertise. It says what the
       access is for instead. */
    assert.strictEqual(hooks.describeFeatureOrigins('removeAds'), 'the ad and tracking hosts it blocks');
    assert(!/https?:\/\/|\.com|\.org/.test(hooks.describeFeatureOrigins('inlineRTScore')),
        'no part of a URL may reach the user');
    /* A feature with origins but no provider declaration still has to say something true,
       so a new origin group reads sensibly before it is declared. */
    assert.strictEqual(hooks.describeOriginHosts(['https://example.test/*', 'http://127.0.0.1/*']).join('|'),
        'example.test|your own computer',
        'an undeclared group falls back to hostnames rather than naming nothing');

    // What is sent, shown where the grant is actually made.
    const consent = hooks.describeFeatureConsent('inlineRTScore');
    assert.strictEqual(consent.length, 2, 'each provider behind a feature states its own case');
    assert(consent.every(sentence => /\.$/.test(sentence)), 'consent lines must read as sentences');
    assert(consent.some(sentence => /Rotten Tomatoes/.test(sentence)), 'and name the service they describe');
    // Array.from first: a collection returned from the sandbox has a different realm's
    // prototype, so deepStrictEqual rejects it even when the contents match.
    assert.strictEqual(Array.from(hooks.describeFeatureConsent('nonexistentFeature')).length, 0,
        'a feature with no declared provider claims nothing about what it sends');

    /* THE defect this guards: chrome.permissions is not exposed to content scripts. They
       get runtime, storage, i18n, extension, csi, dom and loadTimes and nothing else. A
       capability probe for `chrome.permissions` therefore fails permanently in the one
       place the settings panel runs, which silently turned every check into "granted" and
       made the whole layer dead code — while a browser check passed, because that check
       had injected a fake chrome.permissions of its own. */
    const permissionRegion = script.slice(script.indexOf('OPTIONAL HOST PERMISSIONS'));
    const permissionLayer = permissionRegion.slice(0, permissionRegion.indexOf('function refreshFeature'));
    // Comments stripped first: this region explains the trap at length, and matching the
    // explanation would make the guard unfixable.
    const permissionCode = permissionLayer.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    assert(!/chrome\.permissions/.test(permissionCode),
        'the content script must never touch chrome.permissions; it does not have it');
    assert(!/chrome\.permissions/.test(script.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')),
        'nothing in the injected script may call an API content scripts are not given');
    assert(permissionLayer.includes('Boolean(chrome.runtime?.sendMessage)'),
        'support must be probed on an API content scripts actually have');
    assert(permissionLayer.includes("askBackground('imdb-enhanced:permissions-contains'"),
        'permission state must be read through the background, which has the API');
    assert(permissionLayer.includes("askBackground('imdb-enhanced:permissions-remove'"),
        'releasing must go through the background too');
    /* permissions.request needs an extension page AND a gesture. A content script has the
       gesture but not the page; the background has the page but no gesture. So no
       request helper may exist here at all. */
    assert(!/function requestFeatureOrigins/.test(script),
        'a content script cannot request a permission; that belongs on the options page');
    assert(!script.includes("'imdb-enhanced:permissions-request'"),
        'a proxied request would fail: a service worker has no user gesture to offer');

    // Anchored on makeFeatureRow: the site editor also registers a change handler, and
    // slicing from the first match in the file lands on that one instead.
    const featureRow = script.slice(script.indexOf('const makeFeatureRow = feature =>'));
    const body = featureRow.slice(0, featureRow.indexOf('const FEATURE_DEPENDENTS'));
    assert(body.includes('await hasFeatureOrigins(feature.key)'), 'the row must report the real access state');
    assert(body.includes('openOptionsPage()'), 'the row must offer a route to the only surface that can grant');
    assert(body.includes('Not working yet: needs access to'),
        'a feature that is on but cannot reach its service must say so rather than look broken');
    assert(body.includes('releaseFeatureOrigins(feature.key)'),
        'disabling a feature must hand back access nothing else needs');
    assert(body.includes("document.addEventListener('imdb-enhanced:permissions-changed', paintAccess)"),
        'access can change on the options page while this panel is open');

    // Granting lives on the options page, which has both the page and the gesture.
    const recoveryPage = fs.readFileSync(path.join(root, 'scripts', 'recovery-page.js'), 'utf8');
    assert(recoveryPage.includes('chrome.permissions.request'), 'the options page must be able to grant');
    assert(recoveryPage.includes('chrome.permissions.remove'), 'the options page must be able to revoke');
    assert(recoveryPage.includes('renderAccessList'), 'the options page must list each feature\'s access');
    assert(recoveryPage.includes('core.releasableOriginsFor(key)'),
        'revoking one feature must not take an origin its siblings still need');
    /* It returned true the instant it posted the message, so every caller announced that
       a page had opened even when the worker was gone. Tripwire: stubbing the message
       round trip here would be testing the stub. */
    assert(script.includes("const response = await askBackground('imdb-enhanced:open-options');"),
        'opening the options page must wait for the worker that opens it');
    assert(script.includes('return response?.ok === true;'), 'and report what it actually said');
    assert(!/if \(openOptionsPage\(\)\)/.test(script),
        'no caller may treat the answer as synchronous');

    /* A permission gap cached as "unavailable" for 24 hours outlives the fix, so a lookup
       that failed only for want of a grant records nothing. */
    assert(script.includes('async function cacheUnavailableUnlessBlocked'),
        'a blocked lookup must not poison the cache');
    /* Six: the three score sources, and availability three times over because its TMDB
       branch has to record an empty region separately from a failed lookup. The count is
       only a tripwire for a new lookup that forgot the guard, so the structural check
       below is the one that carries the meaning. */
    assert.strictEqual((script.match(/cacheUnavailableUnlessBlocked\(this\.key, cacheKey\)/g) || []).length, 6,
        'every score and availability lookup must use the guarded form');
    /* The unguarded form. Recording "unavailable" for 24 hours when the only problem was a
       missing grant outlives the fix, so no lookup may reach for it directly. */
    const lookupRegion = script.slice(script.indexOf("key: 'inlineRTScore'"), script.indexOf("key: 'trailerPopover'"));
    assert(lookupRegion.length > 1000, 'the lookup region should span the score features');
    assert(!/[^s]cacheSetUnavailable\(/.test(lookupRegion),
        'a lookup must go through the guard rather than record unavailability itself');
});

/* IE-91: availability from TMDB's documented API instead of by parsing JustWatch's page.
   The shapes below are the ones TMDB's published reference describes, checked on
   2026-08-31: /3/find/{id}?external_source=imdb_id answers with five result arrays, and
   /3/{type}/{id}/watch/providers answers with results keyed by country. */
test('TMDB availability resolves an IMDb id and reads only the chosen region', () => {
    const hooks = loadScriptTestHooks();

    // An IMDb id identifies one thing. Anything else is treated as no answer rather than
    // guessed at, because showing another title's streaming services is worse than none.
    const movie = hooks.parseTmdbFind({
        movie_results:[{ id:603, title:'The Matrix' }],
        person_results:[], tv_results:[], tv_episode_results:[], tv_season_results:[],
    });
    assert.strictEqual(movie.type, 'movie');
    assert.strictEqual(movie.id, 603);
    assert.strictEqual(hooks.parseTmdbFind({ movie_results:[], tv_results:[{ id:1396 }] }).type, 'tv',
        'a series resolves as a series, which is a different endpoint');
    assert.strictEqual(hooks.parseTmdbFind({ movie_results:[{ id:1 }], tv_results:[{ id:2 }] }), null,
        'an ambiguous answer is no answer');
    assert.strictEqual(hooks.parseTmdbFind({ movie_results:[], tv_results:[] }), null,
        'nothing found is not an answer either');
    /* An episode id resolves to its series, which is a different title with different
       offers, so it is deliberately not followed. */
    assert.strictEqual(hooks.parseTmdbFind({ movie_results:[], tv_results:[], tv_episode_results:[{ id:62085 }] }), null,
        'an episode must not silently become its series');
    /* Coercion here would be a way to address the wrong title: Number(true) is 1, and
       /3/movie/1/watch/providers is a real record for a real film. */
    assert.strictEqual(hooks.parseTmdbFind({ movie_results:[{ id:'603' }] }), null, 'an id must already be a number');
    assert.strictEqual(hooks.parseTmdbFind({ movie_results:[{ id:true }] }), null, 'and true is not 1');
    assert.strictEqual(hooks.parseTmdbFind({ movie_results:[{ id:6.5 }] }), null, 'nor a fraction an id');
    assert.strictEqual(hooks.parseTmdbFind(null), null);
    assert.strictEqual(hooks.parseTmdbFind('not an object'), null);

    const payload = {
        id: 603,
        results: {
            US: {
                link:'https://www.justwatch.com/us/movie/the-matrix',
                flatrate:[{ provider_name:'Max' }, { provider_name:'Netflix' }],
                ads:[{ provider_name:'Tubi' }],
                rent:[{ provider_name:'Apple TV' }],
                buy:[{ provider_name:'Amazon Video' }],
            },
            FR: { link:'https://www.justwatch.com/fr/film/matrix', flatrate:[{ provider_name:'Canal+' }] },
        },
    };
    const us = hooks.parseTmdbWatchProviders(payload, 'US');
    assert.strictEqual(Array.from(us.providers).join(', '), 'Max, Netflix, Tubi',
        'subscription and ad-supported answer "already included"; rent and buy are a different question');
    assert.strictEqual(us.url, 'https://www.justwatch.com/us/movie/the-matrix');
    // Rendering another country's services as though they were yours is the failure here.
    assert.strictEqual(Array.from(hooks.parseTmdbWatchProviders(payload, 'FR').providers).join(', '), 'Canal+');
    assert.strictEqual(Array.from(hooks.parseTmdbWatchProviders(payload, 'DE').providers).length, 0,
        'a region TMDB knows nothing about is empty, not a fallback to another country');
    assert.strictEqual(hooks.parseTmdbWatchProviders(null, 'US'), null);
    assert.strictEqual(hooks.parseTmdbWatchProviders({}, 'US'), null, 'a payload with no results is no answer');

    // The same bounds the page-parsing path applies, so the newer source cannot be the
    // one that lets an oversized response through to the renderer.
    const flood = { results:{ US:{ link:'', flatrate:Array.from({ length:400 }, (_, i) => ({ provider_name:`Service ${i}` })) } } };
    assert.strictEqual(Array.from(hooks.parseTmdbWatchProviders(flood, 'US').providers).length, 50,
        'the provider list is bounded');
    const longName = { results:{ US:{ link:'', flatrate:[{ provider_name:'x'.repeat(500) }] } } };
    assert.strictEqual(Array.from(hooks.parseTmdbWatchProviders(longName, 'US').providers)[0].length, 120,
        'a single name is bounded too');
    const dupes = { results:{ US:{ link:'', flatrate:[{ provider_name:'Max' }], ads:[{ provider_name:'MAX' }] } } };
    assert.strictEqual(Array.from(hooks.parseTmdbWatchProviders(dupes, 'US').providers).length, 1,
        'the same service listed twice is one service');

    // Region and source both fall back to something safe rather than to undefined.
    assert.strictEqual(hooks.getTmdbRegion(), 'US', 'an unset region defaults rather than sending nothing');
    hooks.seedStoredSetting('availabilityRegion', 'gb');
    assert.strictEqual(hooks.getTmdbRegion(), 'GB', 'a region is normalized, not passed through');
    hooks.seedStoredSetting('availabilityRegion', 'not a region');
    assert.strictEqual(hooks.getTmdbRegion(), 'US', 'nonsense falls back');
    assert.strictEqual(hooks.getAvailabilitySource(), 'justwatch', 'the default source is unchanged');
    hooks.seedStoredSetting('availabilitySource', 'tmdb');
    assert.strictEqual(hooks.getAvailabilitySource(), 'tmdb');
    hooks.seedStoredSetting('availabilitySource', 'something else');
    assert.strictEqual(hooks.getAvailabilitySource(), 'justwatch', 'an unknown source is not honoured');

    /* Choosing TMDB without a token must say so. Quietly reading JustWatch's page instead
       would defeat the only reason to choose TMDB. */
    /* Sliced forward from the feature, not to the script's first _renderLoading: that one
       belongs to an earlier score source, which made this region empty and every
       assertion over it vacuous. */
    const featureStart = script.indexOf("key: 'streamAvailability'");
    assert(featureStart > 0, 'the availability feature must be findable');
    const body = script.slice(featureStart, script.indexOf('_render(data) {', featureStart));
    assert(body.length > 500, 'the availability init region should not be empty');
    assert(/if \(result\.unconfigured\) \{ this\._renderUnavailable\('unconfigured'\); return; \}/.test(body),
        'an unconfigured adapter must report itself, not fall through');
    assert(!/unconfigured[\s\S]{0,400}getJustWatchDetailUrl/.test(body),
        'and must not reach the page-parsing path on its way out');
    assert(body.includes("if (getAvailabilitySource() === 'tmdb')"),
        'the source is a choice, not a fallback order');
    /* A token TMDB rejects is the one part of this the user can fix. Left to the generic
       path it read as "availability unavailable", which points at the wrong thing. */
    assert(body.includes("if (tmdbError?.tmdbRejected) { this._renderUnavailable('rejected'); return; }"),
        'a rejected token must be reported as a rejected token');
    assert(/status === 401 \|\| status === 403/.test(script), 'and recognized from what TMDB actually answers');
    assert(script.includes("'TMDB rejected this token'"), 'in words that say which end the problem is at');
    assert(script.includes("reason === 'rejected' ? 'Replace token' : 'Add token'"),
        'and offer the action that matches');

    /* The region was read but never declared, so "your region" was permanently US and the
       setting could not be exported, imported, or changed. */
    assert.strictEqual(hooks.DEFAULTS.availabilityRegion, 'US', 'the region must be a real setting');
    assert(script.includes("key:'availabilityRegion',"), 'and have a control that sets it');
    hooks.seedStoredSetting('availabilityRegion', 'GB');
    const gbPayload = { results:{ US:{ link:'', flatrate:[{ provider_name:'Max' }] }, GB:{ link:'', flatrate:[{ provider_name:'Now' }] } } };
    assert.strictEqual(Array.from(hooks.parseTmdbWatchProviders(gbPayload, hooks.getTmdbRegion()).providers).join(''), 'Now',
        'a chosen region must actually be the one read');

    // Both attributions are required by the terms, and both are rendered with the data.
    const attribution = script.match(/attribution: 'This extension uses TMDB[^']*'/);
    assert(attribution, 'the TMDB provider must declare its attribution');
    assert(/not endorsed, certified, or otherwise approved by TMDB/.test(attribution[0]),
        "TMDB's API terms mandate that disclaimer verbatim");
    assert(/JustWatch/.test(attribution[0]),
        'the watch-provider endpoint separately requires the data be credited to JustWatch');
    assert(script.includes("appendProviderAttribution(w, 'tmdb')"),
        'the credit must render wherever the data does');
    assert(script.includes('const text = PROVIDERS[providerId]?.attribution;'),
        'and come from the provider declaration rather than being written out beside the widget');

    // The token is a credential, so the extension build never lets the page read it.
    assert(hooks.CREDENTIAL_SETTING_KEYS.has('tmdbReadToken'),
        'the TMDB token must be handled as a credential');
    assert(/credentialHeader: \{ name:'Authorization', ref:token\.ref \}/.test(script),
        'the request names the header and the stored key, never a value');
    assert(!/credentialHeader:[^}]*prefix/.test(script),
        'the scheme is the background\'s to add, since nothing here can read the value it wraps');
});

/* IE-79: a userscript has no toolbar surface, so the manager's menu is its equivalent
   of the extension's recovery page — reachable when the in-page settings button is not. */
test('userscript managers get backup, restore, reset-with-undo and settings commands', () => {
    assert(script.includes('// @grant        GM_registerMenuCommand'), 'menu commands need their grant');
    [
        'Open IMDb Enhanced settings',
        'Copy settings backup (no credentials)',
        'Restore a settings backup',
        'Reset all settings (with undo)',
        'Undo the last settings reset',
    ].forEach(label => assert(script.includes(`'${label}'`), `menu command missing: ${label}`));
    // Absent in a manager that does not implement it, and absent off IMDb.
    assert(script.includes("typeof GM_registerMenuCommand !== 'function' || !isIMDbHost()"),
        'menu registration must tolerate a manager without the API and stay off other hosts');
    // The reset command must capture an undo snapshot before it destroys anything, and
    // that snapshot must include credentials or the undo silently loses them.
    const command = script.slice(script.indexOf("register('Reset all settings (with undo)'"));
    const body = command.slice(0, command.indexOf("register('Undo"));
    assert(body.indexOf('getExportSettings({ includeCredentials:true })') < body.indexOf('applySettingsImport(getDefaultSettingsEntries())'),
        'the undo snapshot must be taken before the reset writes');
    assert(/snapshot = prepareSettingsImport\(getExportSettings\(\{ includeCredentials:true \}\)\)/.test(body),
        'an undo that dropped credentials would be worse than no undo');
    // The commands reuse the canonical helpers rather than a second implementation.
    ['getExportSettings', 'applySettingsImport', 'prepareSettingsImport', 'getDefaultSettingsEntries'].forEach(name => {
        assert.strictEqual((script.match(new RegExp(`function ${name}\\(`, 'g')) || []).length, 1,
            `${name} must exist once; the menu commands must not fork it`);
    });
});

/* IE-81: the README advertised a retired title-page histogram, an end-of-life Node
   floor, and a `git checkout v<version>` rollback against a repository with no tags.
   Documentation drifts silently, so the claims that can be checked are checked. */
test('public documentation matches what the project actually ships', () => {
    // Node floor is declared once, in package.json, and the README quotes it.
    const declared = packageJson.engines?.node;
    assert(declared, 'package.json must declare the Node floor the README quotes');
    const floor = /^>=\s*(\d+)/.exec(declared)?.[1];
    assert(floor, `package.json engines.node should be a >=MAJOR range, got ${declared}`);
    assert(Number(floor) >= 20, 'the declared Node floor must not be an end-of-life release');
    const readmeFloor = /Install Node\.js (\d+) or newer/.exec(readme)?.[1];
    assert.strictEqual(readmeFloor, floor,
        `the README's Node floor (${readmeFloor}) must match package.json engines.node (${declared})`);

    // The vote-distribution widget was retired in v2.14.0; only the ratings-route
    // comparison survives, and the README must not promise the widget.
    assert(!/Rating histogram shows/.test(readme), 'the README must not advertise the retired title-page histogram');
    assert(!/Aggregated-score, histogram,/.test(readme), 'the Ratings page description must not list a retired widget');
    // The key survives in exactly one place: the migration that deletes stored copies.
    assert.strictEqual((script.match(/\bratingHistogram\b/g) || []).length, 1,
        'the retired histogram key should remain only in the migration that removes it');

    // Nothing may point at a release artifact or tag that does not exist. Both are
    // IE-27's job; until it lands, saying otherwise sends people to a 404.
    const tags = execFileSync('git', ['tag', '--list'], { cwd:root, encoding:'utf8' }).trim();
    if (!tags) {
        assert(!/git checkout v<version>/.test(readme),
            'the README documents tag-based rollback but the repository has no tags');
        assert(/no git tags or GitHub releases yet/i.test(readme),
            'the README should say plainly that no tags or releases exist yet');
    }

    // Every npm script the README names has to exist.
    const scripts = Object.keys(packageJson.scripts || {});
    [...readme.matchAll(/`?npm run ([a-z:]+)`?/g)].map(match => match[1]).forEach(name => {
        assert(scripts.includes(name), `README references a missing npm script: ${name}`);
    });

    // Version strings agree across every surface that states one.
    const metaVersion = /@version\s+([0-9.]+)/.exec(script)?.[1];
    assert.strictEqual(packageJson.version, metaVersion);
    assert(readme.includes(`badge/version-${metaVersion}-blue`), 'the README badge must match');
    assert(JSON.parse(fs.readFileSync(path.join(root, 'extension', 'manifest.json'), 'utf8')).version === metaVersion,
        'the extension manifest must match');
    assert(fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8').includes(`## ${metaVersion} —`),
        'CHANGELOG.md must carry an entry for the current version');
});

/* Encrypted-backup cases need real Web Crypto, which is promise-based, so they are
   collected and awaited after the synchronous suite rather than being fired off inside
   test() where a rejection would be swallowed and reported as a pass. */
const asyncTests = [];
function asyncTest(name, fn) { asyncTests.push({ name, fn }); }

asyncTest('a normal backup omits every integration credential and says which', async () => {
    const hooks = loadScriptTestHooks();
    const credentialKeys = [...hooks.CREDENTIAL_SETTING_KEYS];
    assert(credentialKeys.length >= 6, 'the credential key set should still cover every integration');
    credentialKeys.forEach((key, index) => hooks.seedStoredSetting(key, `secret-${index}`));

    const backup = hooks.getExportSettings();
    const serialized = JSON.stringify(backup);
    credentialKeys.forEach(key => {
        assert(!Object.prototype.hasOwnProperty.call(backup, key), `${key} must not appear in a normal backup`);
    });
    credentialKeys.forEach((key, index) => {
        assert(!serialized.includes(`secret-${index}`), `the value of ${key} leaked into a normal backup`);
    });
    /* The sandbox has its own realm, so an array it produced fails deepStrictEqual
       against a host array on prototype identity alone. Compare contents. */
    assert.strictEqual(
        [...(backup[hooks.EXPORT_REDACTED_KEY] || [])].sort().join(','),
        credentialKeys.slice().sort().join(','),
        'a normal backup must list the credentials it left out'
    );

    // An unconfigured credential is not "omitted" — saying so would imply it existed.
    const empty = loadScriptTestHooks();
    assert.strictEqual([...(empty.getExportSettings()[empty.EXPORT_REDACTED_KEY] || [])].length, 0,
        'a profile with no credentials configured should report nothing redacted');

    // The redaction manifest is metadata, not a setting: it must round-trip cleanly.
    assert.strictEqual(hooks.prepareSettingsImport(backup).ignored, 0,
        'the redaction manifest must not count as an unrecognized field');
});

asyncTest('importing a redacted backup leaves credentials already on the device intact', async () => {
    const hooks = loadScriptTestHooks();
    hooks.seedStoredSetting('radarrApiKey', 'live-radarr-key');
    hooks.seedStoredSetting('plexToken', 'live-plex-token');
    hooks.seedStoredSetting('themeVariant', 'dark');

    const fromAnotherDevice = loadScriptTestHooks();
    fromAnotherDevice.seedStoredSetting('themeVariant', 'midnight');
    const redacted = fromAnotherDevice.getExportSettings();

    const { entries } = hooks.prepareSettingsImport(redacted);
    hooks.applySettingsImport(entries);
    assert.strictEqual(hooks.getStoredSetting('themeVariant'), 'midnight', 'the imported settings should apply');
    assert.strictEqual(hooks.getStoredSetting('radarrApiKey'), 'live-radarr-key',
        'a redacted backup must not wipe a credential the device already has');
    assert.strictEqual(hooks.getStoredSetting('plexToken'), 'live-plex-token',
        'a redacted backup must not wipe a credential the device already has');
});

asyncTest('an encrypted backup round-trips credentials under its passphrase', async () => {
    const hooks = loadScriptTestHooks();
    hooks.seedStoredSetting('radarrApiKey', 'radarr-secret-value');
    hooks.seedStoredSetting('plexToken', 'plex-secret-value');
    hooks.seedStoredSetting('themeVariant', 'oled');

    const envelope = await hooks.createEncryptedBackup('correct horse battery');
    assert(!envelope.includes('radarr-secret-value'), 'the ciphertext must not contain the plaintext credential');
    assert(!envelope.includes('plex-secret-value'), 'the ciphertext must not contain the plaintext credential');

    const parsed = JSON.parse(envelope);
    assert(hooks.isEncryptedBackup(parsed), 'the envelope must identify itself');
    assert.strictEqual(parsed.kdf.name, 'PBKDF2');
    assert.strictEqual(parsed.kdf.hash, 'SHA-256');
    assert(parsed.kdf.iterations >= 100000, 'the key-derivation cost must not be trivial');
    assert.strictEqual(parsed.cipher.name, 'AES-GCM');

    const opened = await hooks.readEncryptedBackup(parsed, 'correct horse battery');
    assert.strictEqual(opened.radarrApiKey, 'radarr-secret-value');
    assert.strictEqual(opened.plexToken, 'plex-secret-value');
    assert.strictEqual(opened.themeVariant, 'oled');
    // The decrypted payload is an ordinary settings object the normal importer accepts.
    assert.strictEqual(hooks.prepareSettingsImport(opened).ignored, 0);

    // Salt and nonce must be fresh per export, or two backups of one passphrase leak.
    const second = JSON.parse(await hooks.createEncryptedBackup('correct horse battery'));
    assert.notStrictEqual(parsed.kdf.salt, second.kdf.salt, 'each backup needs a fresh salt');
    assert.notStrictEqual(parsed.cipher.iv, second.cipher.iv, 'each backup needs a fresh nonce');
    assert.notStrictEqual(parsed.ciphertext, second.ciphertext, 'identical input must not produce identical ciphertext');
});

asyncTest('a wrong passphrase or tampered envelope fails before anything is written', async () => {
    const hooks = loadScriptTestHooks();
    hooks.seedStoredSetting('radarrApiKey', 'original-key');
    hooks.seedStoredSetting('themeVariant', 'dark');
    const envelope = JSON.parse(await hooks.createEncryptedBackup('the-right-passphrase'));

    const snapshot = () => ({
        key: hooks.getStoredSetting('radarrApiKey'),
        theme: hooks.getStoredSetting('themeVariant'),
    });
    const before = snapshot();

    await assert.rejects(
        () => hooks.readEncryptedBackup(envelope, 'the-wrong-passphrase'),
        /Wrong passphrase|altered/i,
        'a wrong passphrase must be refused'
    );
    assert.deepStrictEqual(snapshot(), before, 'a wrong passphrase must not change stored settings');

    // Flip one base64 character of the ciphertext: AES-GCM authenticates, so this is a
    // decryption failure rather than garbage that reaches the importer.
    const bytes = Buffer.from(envelope.ciphertext, 'base64');
    bytes[Math.floor(bytes.length / 2)] ^= 0xff;
    const tampered = { ...envelope, ciphertext: bytes.toString('base64') };
    await assert.rejects(
        () => hooks.readEncryptedBackup(tampered, 'the-right-passphrase'),
        /Wrong passphrase|altered/i,
        'a tampered ciphertext must be refused'
    );
    assert.deepStrictEqual(snapshot(), before, 'a tampered backup must not change stored settings');

    await assert.rejects(() => hooks.readEncryptedBackup(envelope, ''), /passphrase/i,
        'an empty passphrase must be refused rather than attempted');
    await assert.rejects(
        () => hooks.readEncryptedBackup({ ...envelope, [hooks.BACKUP_ENVELOPE_KEY]: 99 }, 'the-right-passphrase'),
        /newer version/i,
        'an envelope format from a future build must be refused, not mis-derived'
    );
    await assert.rejects(
        () => hooks.readEncryptedBackup({ ...envelope, kdf:{ ...envelope.kdf, iterations:1 } }, 'the-right-passphrase'),
        /key-derivation cost/i,
        'a downgraded key-derivation cost must be refused'
    );
    await assert.rejects(
        () => hooks.createEncryptedBackup('short'),
        /at least/i,
        'a trivially short passphrase must be refused'
    );
    assert.deepStrictEqual(snapshot(), before, 'no refusal path may write anything');
});

asyncTest('the Data page exposes both export paths and clears passphrases on close', () => {
    assert(script.includes("id:'enh-secure-export-btn'"), 'the encrypted export needs its own explicit action');
    assert(script.includes("id:'enh-import-passphrase'"), 'an encrypted import needs a passphrase field');
    /* The passphrase row is revealed by toggling .hidden, and its own display rule
       outranks the UA [hidden] rule — without this it is visible on every import. */
    assert(script.includes('.enh-backup-passphrase[hidden] { display: none; }'),
        'a hidden-toggled row that sets its own display needs a matching hidden rule');
    assert(/if \(!secureOpen\) \{[\s\S]{0,220}?enh-secure-passphrase'\)\.value = '';/.test(script),
        'closing the panel must clear the passphrase, as it already does for pasted JSON');
    assert(script.includes('await readEncryptedBackup(data, overlay.querySelector'),
        'the import path must decrypt before preparing entries');
    assert(/isEncryptedBackup\(data\)\) \{[\s\S]{0,200}?readEncryptedBackup/.test(script),
        'decryption must happen before prepareSettingsImport is reached');
    assert(!/getExportSettings\(\{ includeCredentials:true \}\)/.test(
        script.slice(script.indexOf("id:'enh-export-btn'"), script.indexOf("id:'enh-secure-export-btn'"))),
        'the ordinary export must never request credentials');
});

(async () => {
    for (const { name, fn } of asyncTests) {
        try {
            await fn();
            console.log(`ok - ${name}`);
        } catch (error) {
            console.error(`not ok - ${name}`);
            console.error(error);
            process.exit(1);
        }
    }
    console.log('All tests passed.');
})();
