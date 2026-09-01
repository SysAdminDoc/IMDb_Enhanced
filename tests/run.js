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

/* Sentences a person reads now live in the message catalog rather than at the call site,
   so a claim about what someone is told is two claims: the catalog carries the sentence,
   and the code that fires uses that key. Looking the key up by its text keeps these
   assertions readable and survives a key being renamed. */
const messageCatalog = (() => {
    const block = /const MESSAGES = Object\.freeze\(\{[\s\S]*?\n    \}\);/.exec(script);
    if (!block) throw new Error('the message catalog could not be read from the userscript');
    // eslint-disable-next-line no-new-func
    return new Function(`${block[0]}\nreturn MESSAGES;`)();
})();

/* Every file that reads the catalog. The recovery page is bundled into the extension's
   own document by the build and reaches the lookup through the recovery hook. */
const MESSAGE_CONSUMERS = [
    path.join(__dirname, '..', 'scripts', 'recovery-page.js'),
    path.join(__dirname, '..', 'extension', 'permissions.js'),
    /* The worker shows one string of its own. It cannot reach the userscript's lookup,
       but chrome.i18n serves the same generated _locales, so the key lives here too. */
    path.join(__dirname, '..', 'extension', 'background.js'),
];

/* The extension's own documents carry their English in the markup so they stay readable
   when the settings layer cannot load, and name the catalog entry that replaces it. */
const MESSAGE_PAGES = [
    path.join(__dirname, '..', 'extension', 'recovery.html'),
    path.join(__dirname, '..', 'extension', 'permissions.html'),
];
const MESSAGE_PAGE_SCRIPTS = [
    path.join(__dirname, '..', 'scripts', 'recovery-page.js'),
    path.join(__dirname, '..', 'extension', 'permissions.js'),
];
const taggedPageCopy = () => MESSAGE_PAGES.flatMap(file => {
    const markup = fs.readFileSync(file, 'utf8');
    return [...markup.matchAll(/<([a-z0-9]+)[^<>]*?\sdata-i18n="([A-Za-z0-9_@]+)"[^<>]*>([^<]*)<\/\1>/g)]
        .map(match => ({ file:path.basename(file), key:match[2], text:match[3].trim() }));
});

function messageKeyFor(text) {
    const entry = Object.entries(messageCatalog).find(([, value]) => value === text);
    assert(entry, `no catalog entry carries the message: ${text}`);
    return entry[0];
}

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
/* storeProfile runs the script the store build actually ships, through the same
   transform scripts/build-extension.js applies, rather than a second description of it. */
const { applyStoreProfile } = require('../scripts/build-extension.js');

function loadScriptTestHooks({ withoutDeleteValue = false, withheldCredentials = false, storeProfile = false, extensionI18n = null } = {}) {
    const source = storeProfile ? applyStoreProfile(script) : script;
    const instrumented = source.replace(/\}\)\(\);\s*$/, `window.__enhTest = {
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
        recordLookupFailure,
        classifyFailure,
        describeRequestFailure,
        DEFAULTS,
        t,
        tCount,
        MESSAGES,
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
        parseRTSearchCandidates,
        parseRTSearchResult,
        parseRTDetailPage,
        readRTScoreField,
        parseLetterboxdDetailPage,
        parseLetterboxdSearchCandidates,
        getLetterboxdSearchUrl,
        buildLetterboxdCandidateQuery,
        parseLetterboxdWikidataCandidates,
        selectMetacriticResult,
        collectMetacriticCandidates,
        buildWikidataIdQuery,
        parseWikidataExternalIds,
        normalizeExternalId,
        parseJustWatchSearchCandidates,
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
        readCardMarkMetadata,
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
        cacheUnavailableUnlessBlocked,
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
        normalizeScoreCorrectionUrl,
        resolveScoreCorrectionResponseUrl,
        getJustWatchCorrectionRequestUrl,
        resolveJustWatchCorrectionResponseUrl,
        scoreCorrectionUrlsMatch,
        normalizeScoreCorrections,
        getScoreCorrections,
        getScoreCorrection,
        setScoreCorrection,
        rankScoreCorrectionCandidates,
        SCORE_CORRECTION_CANDIDATE_LIMIT,
        SCORE_CORRECTION_TITLE_LIMIT,
        computeCurrentAge,
        getUserMarks,
        setUserMarks,
        setUserMark,
        logAdditionalViewing,
        countViewings,
        countSeenEpisodes,
        readCurrentTitleMarkMetadata,
        getUserMark,
        getUserNote,
        setUserNote,
        normalizeUserMark,
        normalizeUserNote,
        USER_MARK_RECORD_VERSION,
        USER_MARK_VIEWINGS_MAX,
        USER_MARKS_MAX,
        USER_MARK_NOTE_LIMIT,
        readPersonBirthDate,
        isPersonDeceased,
        EPISODE_CODE_PATTERN,
        readNativeWatchedControl,
        collectNativeWatchedTitles,
        normalizeUserMarkEntries,
        USER_MARKS_SCAN_LIMIT,
        parseCsvTable,
        prepareCsvMarkImport,
        describeCsvMarkImport,
        CSV_IMPORT_ROW_LIMIT,
        CSV_IMPORT_TEXT_LIMIT,
        CSV_IMPORT_TEXT_MB,
        summarizeLocalStats,
        LOCAL_STATS_GROUP_LIMIT,
        readCurrentTitleMarkMetadata,
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
        parseTmdbReleaseDates,
        fetchTmdbAvailability,
        parseOmdbRatings,
        fetchOmdbRatings,
        isOmdbConfigured,
        getAvailabilitySource,
        getEffectiveAvailabilitySource,
        featureExcludedByProfile,
        providerAllowedHere,
        PROVIDERS,
        describeProfileExclusion,
        getAvailabilityRegion,
        getAvailabilityCacheKey,
        getJustWatchSearchUrl,
        isTmdbConfigured,
        desktopUrlForMobile,
        claimDesktopRedirect,
        computeTrimmedMean,
        buildMarksCsv,
        buildLetterboxdCsv,
        scopedRules,
        setStoredSetting: (key, value) => set(key, value),
        readSettingsPanelText: () => document.getElementById('enh-settings-overlay')?.textContent || '',
        normalizeWatchlistSnapshot,
        getWatchlistSnapshot,
        collectWatchlistTitles,
        buildCollectionQuery,
        parseCollectionEntries,
        SECONDARY_PAGE_FEATURE_KEYS,
        collectAniListCandidates,
        getAniListIdFromUrl,
        parseAniListEntry,
        SCORE_CORRECTION_PROVIDERS,
        getMovieChatUrl,
        boundedImageVariant,
        parseAniListSearch,
        getFeature: key => features.find(feature => feature.key === key),
        FEATURE_PROVIDERS,
        SCORE_WIDGET_IDS,
        isAnimatedTitle,
        isAnimeTitle,
        originsHeldByOtherEnabledFeatures,
        releasableOriginsFor,
        BACKUP_ENVELOPE_KEY,
        getFeatureKeys: () => features.map(feature => feature.key),
        getFeatureNames: () => features.map(feature => [feature.key, feature.name]),
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
    assert.notStrictEqual(instrumented, source, 'test hook injection failed');

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
    /* An extension build with a locale installed. IS_EXTENSION_BUILD is what decides
       whether the lookup consults chrome.i18n at all, so the runtime id has to be there
       as well as the API. */
    if (extensionI18n) {
        sandbox.chrome = { runtime: { id: 'test-extension-id' }, i18n: extensionI18n };
    }
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

test('DOM fixtures skip cleanly when the optional DOM dependency is absent', () => {
    const output = execFileSync(process.execPath, [path.join(root, 'tests', 'dom-fixtures.mjs')], {
        encoding:'utf8',
        env:{ ...process.env, IMDB_ENH_FORCE_NO_HAPPY_DOM:'1' },
    });
    assert.match(output, /DOM fixture harness skipped/);
});

test('metadata stays distribution-safe', () => {
    assert(!/@connect\s+\*/.test(script), 'wildcard @connect should not return');
    assert(!/@grant\s+GM_addStyle/.test(script), 'unused style-injection permission should stay removed');
    assert(/@noframes/.test(script), '@noframes should remain present');
    assert(/@match\s+https:\/\/m\.imdb\.com\//.test(script),
        'the mobile host is matched so a shared link can be sent to the desktop site');
    assert(/function isIMDbHost[\s\S]{0,200}=== 'www\.imdb\.com'/.test(script),
        'and nothing else runs there: every feature is gated on the desktop host alone');
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

    const correctionUpgrade = loadScriptTestHooks();
    correctionUpgrade.seedStoredSetting('settingsSchemaVersion', 3);
    correctionUpgrade.seedStoredSetting('scoreCorrections', {
        tt0084787:{ rottenTomatoes:{
            mode:'url', url:'https://www.rottentomatoes.com/m/the_thing', title:'The Thing', year:1982, ts:1,
        } },
        unsafe:{ rottenTomatoes:{ mode:'url', url:'javascript:alert(1)', ts:1 } },
    });
    correctionUpgrade.runSettingsMigrations();
    assert.strictEqual(correctionUpgrade.getStoredSetting('settingsSchemaVersion'), correctionUpgrade.SETTINGS_SCHEMA_VERSION);
    assert.deepStrictEqual(Object.keys(correctionUpgrade.getStoredSetting('scoreCorrections')), ['tt0084787'],
        'schema 4 must normalize any prerelease correction records before declaring them supported');

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
    /* One per score widget, derived rather than counted: a hand-written number stops
       covering the next widget someone adds and says nothing when it does. */
    const widgetCount = Object.keys(loadScriptTestHooks().SCORE_WIDGET_IDS).length;
    assert(widgetCount >= 4, 'the score widgets should be discoverable');
    assert.strictEqual((script.match(/'aria-busy':'true'/g) || []).length, widgetCount,
        'every loading score widget must report itself busy');
});

/* The zero-runtime-dependency, no-telemetry posture is a real differentiator after
   the 2025-26 extension-compromise wave, and it was documented nowhere. */
test('README states the trust posture the build actually has', () => {
    assert(/No telemetry, ever/.test(readme), 'the absence of telemetry must be stated, not implied');
    assert(/No runtime dependencies/.test(readme), 'the zero-dependency posture must be stated');
    assert(/No remote code/.test(readme), 'the absence of remote code must be stated');
    assert(/Verifying a build/.test(readme), 'readers need a way to check a build against its tag');
    // The shipped files stay dependency-free. happy-dom is pinned for offline tests only.
    assert(!packageJson.dependencies, 'README claims zero runtime dependencies');
    assert.deepStrictEqual(packageJson.devDependencies, { 'happy-dom':'20.12.0' },
        'happy-dom must remain the only development dependency');
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
    // The control's label is a catalog entry, so it is found by key and read from there.
    const updateBlock = script.slice(script.indexOf('if (IS_EXTENSION_BUILD) {', script.indexOf('enh-update-notice-toggle') - 3000));
    const updateControl = [...updateBlock.slice(0, 900).matchAll(/t\('([A-Za-z0-9_@]+)'\)/g)].map(match => match[1]);
    assert(updateControl.some(key => /new versions/i.test(messageCatalog[key] || '')),
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
    /* The label is a catalog entry now, so what has to hold is that the route is paired
       with one and that the entry carries words. */
    const parentsGuide = /\[t\('([A-Za-z0-9_@]+)'\), `\/title\/\$\{imdbId\}\/parentalguide\/`\]/.exec(script);
    assert(parentsGuide, 'the parents guide needs a readable label, not a bare route');
    assert(messageCatalog[parentsGuide[1]]?.trim(),
        'and the label it is paired with has to say something');
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
    assert(Object.values(messageCatalog).some(text => text.includes('IMDb Watched was not changed')),
        'local mark feedback should distinguish itself from IMDb\'s native Watched state');
    /* Written through the guarded setter, since this runs from a document-wide observer,
       and the labels it chooses between both have to say the mark is local. Read from the
       block rather than pinned as one expression: the previous version matched the exact
       ternary and failed the moment a rewatch count was added beside the label, which is
       a change to neither of the things it is here to protect. */
    const badgeBlock = script.slice(script.indexOf('let badge = Array.from(card.children)'));
    const badgeWrite = badgeBlock.slice(0, badgeBlock.indexOf("badge.classList.toggle('enh-mark-badge--skip'"));
    assert(badgeWrite.includes('setTextIfChanged(badge,'),
        'the badge label must be written through the guarded setter');
    const badgeKeys = [...badgeWrite.matchAll(/t\('(settings_local_[a-z]+)'\)/g)].map(match => match[1]);
    assert.deepStrictEqual([...new Set(badgeKeys)].sort(), ['settings_local_seen', 'settings_local_skip'],
        'and it must choose between exactly the two local labels');
    badgeKeys.forEach(key => {
        assert(/^local /i.test(messageCatalog[key] || ''),
            'visible local badges should not impersonate native IMDb Watched');
    });
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

test('versioned marks retain bounded viewing history and statistics metadata', () => {
    const hooks = loadScriptTestHooks();
    const legacyTimestamp = Date.UTC(2024, 1, 3, 12);
    const migrated = JSON.parse(JSON.stringify(hooks.normalizeUserMark({
        v:1, state:'watched', title:'Legacy title', ts:legacyTimestamp,
    })));
    assert.strictEqual(hooks.USER_MARK_RECORD_VERSION, 2);
    assert.strictEqual(migrated.v, 2);
    assert.deepStrictEqual(migrated.viewings, [{ date:'2024-02-03' }],
        'a legacy Seen timestamp should become one explicit viewing event');

    const rich = JSON.parse(JSON.stringify(hooks.normalizeUserMark({
        v:2,
        state:'watched',
        title:'The Matrix',
        ts:Date.UTC(2026, 7, 31, 12),
        viewings:[
            { date:'2025-01-02', rating:8.5 },
            { date:'2025-01-02', rating:8.5 },
            { date:'2026-02-30', rating:9 },
        ],
        rating:9,
        year:1999,
        genres:['Action', 'Sci-Fi', 'action'],
        imdbRating:8.7,
        runtime:136,
    })));
    assert.deepStrictEqual(rich.viewings, [{ date:'2025-01-02', rating:8.5 }]);
    assert.deepStrictEqual(rich.genres, ['Action', 'Sci-Fi']);
    assert.strictEqual(rich.rating, 9);
    assert.strictEqual(rich.year, 1999);
    assert.strictEqual(rich.imdbRating, 8.7);
    assert.strictEqual(rich.runtime, 136);

    hooks.seedStoredSetting('userMarks', { tt0133093:rich });
    assert(hooks.setUserMark('tt0133093', 'watched', 'The Matrix'));
    let stored = hooks.getStoredSetting('userMarks').tt0133093;
    assert.strictEqual(stored.year, 1999, 'changing a mark must preserve imported year metadata');
    assert.deepStrictEqual(Array.from(stored.genres), ['Action', 'Sci-Fi'], 'changing a mark must preserve imported genres');
    assert(stored.viewings.some(viewing => viewing.date === '2025-01-02'), 'changing a mark must preserve old viewings');
    assert(hooks.setUserNote('tt0133093', 'Keep this'));
    stored = hooks.getStoredSetting('userMarks').tt0133093;
    assert.strictEqual(stored.runtime, 136, 'editing a note must preserve imported runtime metadata');
    assert.strictEqual(stored.note, 'Keep this');
});

test('local statistics aggregate bounded history without inventing missing data', () => {
    const hooks = loadScriptTestHooks();
    const stats = JSON.parse(JSON.stringify(hooks.summarizeLocalStats({
        tt0133093:{
            v:2, state:'watched', title:'The Matrix', ts:3,
            viewings:[{ date:'2025-01-02', rating:9 }, { date:'2026-02-03', rating:9 }],
            rating:9, year:1999, genres:['Action', 'Sci-Fi'], imdbRating:8.7, runtime:136,
        },
        tt0078748:{
            v:2, state:'watched', title:'Alien', ts:2,
            viewings:[{ date:'2025-04-05', rating:7 }],
            rating:7, year:1979, genres:['Horror', 'sci-fi'], imdbRating:8.5, runtime:117,
        },
        tt0084787:{ v:2, state:'skip', title:'The Thing', ts:4, year:1982, genres:['Horror'] },
        tt0111161:{ v:2, state:'watched', title:'Shawshank', ts:5 },
    })));
    assert.strictEqual(stats.seen, 3);
    assert.strictEqual(stats.skipped, 1);
    assert.strictEqual(stats.viewings, 3);
    assert.strictEqual(stats.undatedSeen, 1, 'a Seen mark with no date must stay explicitly undated');
    assert.deepStrictEqual(stats.years, [
        { label:'2025', count:2 },
        { label:'2026', count:1 },
    ]);
    assert.deepStrictEqual(stats.topGenres, [
        { label:'Sci-Fi', count:2 },
        { label:'Action', count:1 },
        { label:'Horror', count:1 },
    ], 'Skip-only metadata must not influence viewing-history genres');
    assert.deepStrictEqual(stats.decades, [
        { label:'1990s', count:1 },
        { label:'1970s', count:1 },
    ]);
    assert.strictEqual(stats.ratingPairs, 2);
    assert.strictEqual(stats.ratingDelta, -0.6);
    assert.strictEqual(stats.runtimeMinutes, 253);
    assert.strictEqual(stats.historyTitles, 3);
    assert.strictEqual(stats.reviewYear, null, 'a year review requires ten dated viewings');

    const skippedAfterViewing = hooks.summarizeLocalStats({
        tt1000001:{
            v:2, state:'skip', title:'Seen before it was skipped', ts:1,
            viewings:[{ date:'2024-05-01' }], year:2004,
        },
    });
    assert.strictEqual(skippedAfterViewing.seen, 0);
    assert.strictEqual(skippedAfterViewing.historyTitles, 1);
    assert.strictEqual(skippedAfterViewing.metadataTitles, 1,
        'metadata coverage must use the history-title denominator when a former Seen title is now skipped');

    const review = hooks.summarizeLocalStats({
        tt1000000:{
            v:2, state:'watched', title:'Rewatched', ts:1,
            viewings:Array.from({ length:10 }, (_, index) => ({ date:`2026-01-${String(index + 1).padStart(2, '0')}` })),
        },
    });
    assert.strictEqual(review.reviewYear.label, '2026');
    assert.strictEqual(review.reviewYear.count, 10);

    const crowdedYears = {};
    for (let year = 2016; year <= 2023; year += 1) {
        crowdedYears[`tt${year}000`] = {
            v:2, state:'watched', title:String(year), ts:year,
            viewings:Array.from({ length:11 }, (_, index) => ({
                date:`${year}-01-${String(index + 1).padStart(2, '0')}`,
            })),
        };
    }
    crowdedYears.tt2026000 = {
        v:2, state:'watched', title:'2026', ts:2026,
        viewings:Array.from({ length:10 }, (_, index) => ({
            date:`2026-01-${String(index + 1).padStart(2, '0')}`,
        })),
    };
    const crowdedReview = hooks.summarizeLocalStats(crowdedYears);
    assert.strictEqual(crowdedReview.years.length, hooks.LOCAL_STATS_GROUP_LIMIT);
    assert.strictEqual(crowdedReview.years.some(item => item.label === '2026'), false,
        'the display list should stay bounded when more than eight years have activity');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(crowdedReview.reviewYear)), { label:'2026', count:10 },
        'year-review eligibility must be calculated before the display list is truncated');
    assert.strictEqual(hooks.summarizeLocalStats({}).markedTitles, 0, 'fresh installs need a real empty state');
    assert.strictEqual(stats.topGenres.length <= hooks.LOCAL_STATS_GROUP_LIMIT, true);
});

test('CSV import maps IMDb and Letterboxd headers without relying on column positions', () => {
    const hooks = loadScriptTestHooks();
    const imdb = hooks.prepareCsvMarkImport([
        '\uFEFFConst,Your Rating,Date Rated,Title,Original Title,Title Type,IMDb Rating,Runtime (mins),Year,Genres',
        'tt0133093,9,2026-01-02,"The Matrix, Reloaded",The Matrix Reloaded,Movie,8.7,138,2003,"Action, Sci-Fi"',
    ].join('\r\n'), {});
    assert.strictEqual(imdb.source, 'IMDb');
    assert.strictEqual(imdb.importedRows, 1);
    assert.strictEqual(imdb.importedTitles, 1);
    const imdbMark = JSON.parse(JSON.stringify(imdb.marks.tt0133093));
    assert.strictEqual(imdbMark.title, 'The Matrix, Reloaded');
    assert.strictEqual(imdbMark.rating, 9);
    assert.strictEqual(imdbMark.year, 2003);
    assert.strictEqual(imdbMark.imdbRating, 8.7);
    assert.strictEqual(imdbMark.runtime, 138);
    assert.deepStrictEqual(imdbMark.genres, ['Action', 'Sci-Fi']);
    assert.deepStrictEqual(imdbMark.viewings, [{ date:'2026-01-02', rating:9 }]);

    const letterboxd = hooks.prepareCsvMarkImport([
        'imdbID,Title,Year,Rating,Rating10,WatchedDate',
        'tt0078748,Alien,1979,4.5,8,2025-03-01',
        'tt0078748,Alien,1979,4,7,2026-03-02',
    ].join('\n'), {});
    const letterboxdMark = JSON.parse(JSON.stringify(letterboxd.marks.tt0078748));
    assert.strictEqual(letterboxd.source, 'Letterboxd');
    assert.strictEqual(letterboxd.importedRows, 2);
    assert.strictEqual(letterboxd.importedTitles, 1);
    assert.deepStrictEqual(letterboxdMark.viewings, [
        { date:'2025-03-01', rating:8 },
        { date:'2026-03-02', rating:7 },
    ], 'repeated rows for one title should retain separate viewing dates');
    assert.strictEqual(letterboxdMark.rating, 7, 'the later Rating10 column should win');

    const reversed = hooks.prepareCsvMarkImport([
        'imdbID,Title,Year,Rating10,Rating,WatchedDate',
        'tt0083658,Blade Runner,1982,8,4.5,2025-04-03',
    ].join('\n'), {});
    assert.strictEqual(reversed.marks.tt0083658.rating, 9,
        'the later Rating column should win and convert the five-star value');
});

test('CSV import reports every storage bound instead of silently dropping history', () => {
    const hooks = loadScriptTestHooks();
    const viewingRows = Array.from({ length:hooks.USER_MARK_VIEWINGS_MAX + 1 }, (_, index) => {
        const date = new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10);
        return `tt0133093,${date},The Matrix`;
    });
    const bounded = hooks.prepareCsvMarkImport([
        'Const,Date Rated,Title',
        ...viewingRows,
    ].join('\n'), {});
    assert.strictEqual(bounded.importedRows, hooks.USER_MARK_VIEWINGS_MAX + 1);
    assert.strictEqual(bounded.marks.tt0133093.viewings.length, hooks.USER_MARK_VIEWINGS_MAX);
    assert.strictEqual(bounded.droppedViewings, 1);
    assert.match(hooks.describeCsvMarkImport(bounded), /1 viewing event over the 100-per-title limit not retained/);

    /* The export is a row per viewing, so the largest file it can write is every mark
       carrying its full history. An importer that stops short of that reads back part of
       a library and calls it a success, which is how a restore loses a third of somebody's
       marks with a cheerful summary. Both ceilings have to clear it: the row cap, and the
       size cap that used to be the settings backup's 4 MB and refused every full library
       outright while making the row cap unreachable. */
    assert(hooks.CSV_IMPORT_ROW_LIMIT >= hooks.USER_MARKS_MAX * hooks.USER_MARK_VIEWINGS_MAX,
        'the importer must be able to read back the biggest file the exporter can write');

    /* Built at a hundredth of full size and multiplied out. The whole thing is 25 MB and
       half a million rows, which is a two-minute test for one number; the shape of a row
       is what decides the answer and that is what is measured here. */
    const everyDate = Array.from({ length:hooks.USER_MARK_VIEWINGS_MAX },
        (_, index) => ({ date:new Date(Date.UTC(2020, 0, index + 1)).toISOString().slice(0, 10) }));
    const sampleTitles = Math.round(hooks.USER_MARKS_MAX / 100);
    const sample = {};
    for (let index = 0; index < sampleTitles; index += 1) {
        sample[`tt${String(1000000 + index).padStart(7, '0')}`] = {
            v:2, state:'watched', title:`A film with an ordinary sort of title ${index}`,
            ts:1, year:1999, viewings:everyDate,
        };
    }
    const sampleCsv = hooks.buildMarksCsv(Object.entries(sample));
    const maximalBytes = sampleCsv.length * (hooks.USER_MARKS_MAX / sampleTitles);
    assert(maximalBytes < hooks.CSV_IMPORT_TEXT_LIMIT,
        `a full library exports to about ${Math.round(maximalBytes / 1048576)} MB, over the import ceiling`);

    /* And the real trip at that shape: every title carrying its full history, read back
       whole rather than cut off at a row cap. */
    const restored = hooks.prepareCsvMarkImport(sampleCsv, {});
    assert.strictEqual(restored.truncatedRows, 0, 'nothing of it is cut off');
    assert.strictEqual(Object.keys(restored.marks).length, sampleTitles,
        'every title comes back, not the ones that fitted');
    assert.strictEqual(restored.marks.tt1000000.viewings.length, hooks.USER_MARK_VIEWINGS_MAX,
        'with every date behind it');

    /* And when a file really is longer than that, the rows past the end are reported as
       what they are. Rolled up with the rows that could not be parsed, "skipped" reads as
       a few bad lines rather than as titles that are not in the store at all. */
    const rowLimited = hooks.prepareCsvMarkImport(
        'Const,Title\n' + 'tt1,x\n'.repeat(hooks.CSV_IMPORT_ROW_LIMIT + 2), {});
    assert.strictEqual(rowLimited.importedRows, hooks.CSV_IMPORT_ROW_LIMIT);
    assert.strictEqual(rowLimited.truncatedRows, 2);
    assert.strictEqual(rowLimited.skippedRows, 0, 'nothing was wrong with those rows; there were too many');
    assert.match(hooks.describeCsvMarkImport(rowLimited), /2 rows past the limit were not read/);

    assert.throws(
        () => hooks.parseCsvTable('Const,Title\n' + 'x'.repeat(hooks.CSV_IMPORT_TEXT_LIMIT)),
        new RegExp(`under ${hooks.CSV_IMPORT_TEXT_MB} MB`),
        'the text-size ceiling should fail before parsing an oversized CSV'
    );

    /* A file cut short and a file full of rows that could not be read are different
       problems with different answers. Rolled together, somebody is sent looking for bad
       rows in a file that had none. */
    assert.match(hooks.describeCsvMarkImport({ importedRows:0, skippedRows:0, truncatedRows:7 }),
        /7 rows past the limit/, 'a file that was only too long says so');
    assert.doesNotMatch(hooks.describeCsvMarkImport({ importedRows:0, skippedRows:0, truncatedRows:7 }),
        /skipped/i, 'and does not call them skipped');
    assert.match(hooks.describeCsvMarkImport({ importedRows:0, skippedRows:3, truncatedRows:7 }),
        /3[\s\S]*7 rows past the limit/, 'a file with both says both');
});

test('generic CSV rows resolve only against unambiguous stored title identities', () => {
    const hooks = loadScriptTestHooks();
    const current = {
        tt0133093:{ v:2, state:'watched', title:'The Matrix', year:1999, ts:1 },
        tt0084787:{ v:2, state:'watched', title:'The Thing', year:1982, ts:2 },
        tt0902272:{ v:2, state:'watched', title:'The Thing', year:2011, ts:3 },
    };
    const prepared = hooks.prepareCsvMarkImport([
        'Title,Year,Rating,WatchedDate',
        'The Matrix,1999,4.5,2025-05-01',
        'The Thing,,4,2025-05-02',
        'Unknown,2020,3,2025-05-03',
    ].join('\n'), current);
    assert.strictEqual(prepared.importedRows, 1);
    assert.strictEqual(prepared.importedTitles, 1);
    assert.strictEqual(prepared.resolvedRows, 1);
    assert.strictEqual(prepared.skippedRows, 2);
    assert.strictEqual(prepared.marks.tt0133093.rating, 9);
    assert.match(hooks.describeCsvMarkImport(prepared), /1 matched to titles already stored here/);
    assert.match(hooks.describeCsvMarkImport(prepared), /2 skipped/);
    assert.throws(
        () => hooks.parseCsvTable('Const,Title\ntt0133093,"The Matrix'),
        /quoted field/,
        'malformed CSV must fail before producing any import entries'
    );
});

test('CSV mark writes use the existing rollback transaction', () => {
    const hooks = loadScriptTestHooks();
    const original = { tt0078748:{ v:2, state:'skip', title:'Alien', ts:1 } };
    hooks.seedStoredSetting('userMarks', original);
    const prepared = hooks.prepareCsvMarkImport([
        'Const,Your Rating,Date Rated,Title',
        'tt0133093,9,2026-01-02,The Matrix',
    ].join('\n'), original);
    hooks.failSettingWriteAt(1);
    assert.throws(
        () => hooks.applySettingsImport([{ key:'userMarks', value:prepared.marks }]),
        /previous settings were restored/,
        'a failed CSV write should report transaction recovery'
    );
    assert.deepStrictEqual(hooks.getStoredSetting('userMarks'), original,
        'a failed CSV write must leave the previous mark store intact');
    assert(script.includes("id:'enh-csv-file'"), 'the Data page should accept a CSV file');
    assert(script.includes("id:'enh-csv-preview-btn'"), 'CSV import must require a preview before apply');
    assert(script.includes('This does not change IMDb Watched status'),
        'the UI must distinguish local import from IMDb Labs account import');
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
    assert(script.includes(`saveState.textContent = t('${messageKeyFor('Save failed')}')`),
        'failed writes must not leave a saved-state claim visible');
    assert(!script.includes('<main class="enh-settings-main">'), 'settings dialog must not add a second page-level main landmark');
    assert(script.includes('When “Optional keyboard shortcuts” is enabled'), 'disabled-by-default shortcut hints must disclose their prerequisite');
    assert(script.includes("'aria-controls':'enh-import-panel', 'aria-expanded':'false'"), 'import disclosure state missing');
    assert(script.includes("'aria-controls':'enh-reset-panel', 'aria-expanded':'false'"), 'reset disclosure state missing');
    assert(script.includes('const setDataDisclosureState = openPanel =>'), 'data subpanels should share one disclosure-state owner');
    assert(script.includes(`showToast(t('${messageKeyFor('Cache could not be read or cleared.')}'), 4500)`),
        'cache failures should remain visible');
    assert(script.includes(`else if (failed) showToast(t('${messageKeyFor('Cleared $1 cached entries; $2 could not be removed.')}', [cleared, failed])`),
        'partial cache deletion must not claim complete success');
    assert(script.includes('if (!trySaveSetting(feature.key, enabled))'), 'feature toggles should revert when storage fails');
    assert(script.includes(`showToast(t('${messageKeyFor('Could not save the theme. Previous settings were restored.')}')`),
        'multi-key theme changes should report transactional rollback');
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
    /* The group is labelled with the heading a person reads, which is now the resolved
       message rather than the key the group is stored under. */
    assert(script.includes("role:'group', 'aria-label':heading"), 'menu categories should expose labeled groups');
    assert(script.includes("'aria-pressed': 'false'"), 'watched and skip controls should expose toggle state');
    assert(script.includes("getUserMark(imdbId) === action ? '' : action"), 'active watched/skip controls should toggle off');
    assert(script.includes("plotFull.addEventListener('keydown', this._revealKeyHandler)"), 'plot reveal should support keyboard activation');
    assert(script.includes("document.addEventListener('keydown', this._keydownHandler)"), 'episode reveals should support keyboard activation');
    assert(script.includes("['Enter', ' '].includes(event.key)"), 'spoiler controls should support Enter and Space');
    assert(script.includes('restoreElementAttributes(plotFull, this._plotAttributes)'), 'revealed plots should restore their original non-button semantics');
    assert(script.includes("plot.classList.remove('enh-episode-spoiler')"), 'revealed episode plots should leave the keyboard tab order');
    assert(!script.includes("querySelectorAll('.enh-episode-spoiler, .enh-revealed')"), 'episode cleanup must not mutate another feature\'s revealed state');
    assert(script.includes('sec.insertBefore(btn, sec.firstChild)'), 'visually top-aligned collapse controls should also come first in section tab order');
    assert(script.includes(`makeEl('nav', { id:'enh-quicknav', 'aria-label':t('${messageKeyFor('On this page')}') })`),
        'quick navigation should expose a named navigation landmark');
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
    assert(script.includes(`'aria-label':t('${messageKeyFor('Reviews and research')}')`),
        'research links should expose a named category surface');
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
    /* A feature that reads watchedMarking at init renders nothing without it, so it has
       to appear and disappear with that toggle rather than after a reload. Derived from
       the features that actually read it rather than compared against a written-out list:
       the list was pinned as one literal, so adding a third reader passed the assertion by
       failing it for the wrong reason and would have passed again once the literal was
       updated, whether or not the new feature had been added to the map. */
    const dependents = new Set();
    for (const match of script.matchAll(/if \(!get\('watchedMarking'\)\) return;/g)) {
        const before = script.slice(0, match.index);
        const key = [...before.matchAll(/\bkey: '([A-Za-z0-9_]+)'/g)].pop()?.[1];
        assert(key, 'every reader of the marks toggle sits inside a registered feature');
        dependents.add(key);
    }
    assert(dependents.size >= 3, 'the readers of the marks toggle should still be found');
    const declared = /watchedMarking:\[([^\]]*)\]/.exec(script)?.[1] || '';
    dependents.forEach(key => assert(declared.includes(`'${key}'`),
        `${key} reads the marks toggle at init and must be declared as depending on it`));
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

/* IE-12: a title has to be identified as anime before anything is asked about it, from
   what the page already carries and nothing else. The cost of a wrong yes is a request to
   a service that has no entry for the film, fired on every animated title someone opens,
   so the gate is tested from the direction of the false positives rather than the hits. */
test('anime is identified from the page, and animation alone is not enough', () => {
    const hooks = loadScriptTestHooks();
    const linkTo = href => ({ querySelector: selector => (selector.includes(href) ? {} : null) });
    const noLinks = { querySelector: () => null };
    const japan = linkTo('country_of_origin=JP');

    // Animated and Japanese, which is the definition people use.
    assert.strictEqual(hooks.isAnimeTitle({ genre:['Animation', 'Action'] }, japan), true);
    // Animated with the keyword IMDb carries, for a co-production whose country line is a list.
    assert.strictEqual(hooks.isAnimeTitle({ genre:['Animation'], keywords:'anime, based on manga' }, noLinks), true);
    assert.strictEqual(hooks.isAnimeTitle({ genre:['Animation'], keywords:['light novel'] }, noLinks), true);

    /* The false positives, which are the whole reason this is strict. */
    assert.strictEqual(hooks.isAnimeTitle({ genre:['Animation', 'Family'] }, noLinks), false,
        'an animated film from anywhere else is not anime');
    assert.strictEqual(hooks.isAnimeTitle({ genre:['Drama'] }, japan), false,
        'a live-action Japanese film is not anime');
    assert.strictEqual(hooks.isAnimeTitle({ genre:['Documentary'], keywords:'anime industry' }, noLinks), false,
        'a documentary about anime is not anime');

    /* IMDb joins keywords with commas, and plenty of Western animation carries a keyword
       that merely mentions the word. A keyword has to BE one of these, not contain one:
       an animated comedy keyworded "parody of anime" would otherwise fire a request to a
       service that has never heard of it. */
    assert.strictEqual(hooks.isAnimeTitle({ genre:['Animation', 'Comedy'], keywords:'parody of anime, satire' }, noLinks), false,
        'a parody of anime is not anime');
    assert.strictEqual(hooks.isAnimeTitle({ genre:['Animation', 'Documentary'], keywords:'manga artist, biography' }, noLinks), false,
        'a film about a manga artist is not manga');
    assert.strictEqual(hooks.isAnimeTitle({ genre:['Animation'], keywords:'anime convention' }, noLinks), false);
    assert.strictEqual(hooks.isAnimeTitle({ genre:['Animation'], keywords:'anime style' }, noLinks), false);
    // And the real ones still are, wherever they sit in the joined list.
    assert.strictEqual(hooks.isAnimeTitle({ genre:['Animation'], keywords:'shounen, based on manga, school' }, noLinks), true);
    assert.strictEqual(hooks.isAnimeTitle({ genre:['Animation'], keywords:'  ANIME  ' }, noLinks), true,
        'their casing and padding are not meaning');
    assert.strictEqual(hooks.isAnimeTitle({}, japan), false, 'no genre is not a yes');
    assert.strictEqual(hooks.isAnimeTitle(null, noLinks), false);

    /* "Animation" is the whole genre, not a substring of one: IMDb has no genre that
       contains it, but a keyword or a description might, and this reads genres only. */
    assert.strictEqual(hooks.isAnimatedTitle({ genre:['Stop-motion animation'] }), false);
    assert.strictEqual(hooks.isAnimatedTitle({ genre:[' Animation '] }), true, 'padding is not meaning');

    /* The country comes from the href IMDb builds to its own search, never from the words
       beside it, so the answer is the same on a translated IMDb. */
    assert.strictEqual(hooks.isAnimeTitle({ genre:['Animation'] }, linkTo('country_of_origin=US')), false);
    const script = fs.readFileSync(path.join(__dirname, '..', 'IMDb_Enhanced.user.js'), 'utf8');
    assert(!/JAPAN_ORIGIN_SELECTOR[\s\S]{0,200}textContent/.test(script),
        'the country must be read from the link, not from the label next to it');

    // A page that throws on an odd selector must answer no rather than take the page down.
    assert.strictEqual(hooks.isAnimeTitle({ genre:['Animation'] }, { querySelector() { throw new Error('bad root'); } }), false);
});

/* IE-12: AniList answers a search with several anime and the first is not the one on
   screen. Verified live 2026-08-31 against graphql.anilist.co: "Akira" returns the 1988
   film, an unaired TV remake with a null score, and an unrelated OVA whose romaji title
   merely contains the word; "Spirited Away" comes back with that as its English title and
   "Sen to Chihiro no Kamikakushi" as its romaji one. */
test('an AniList answer is matched against the title on the page', () => {
    const hooks = loadScriptTestHooks();
    const akira = { data:{ Page:{ media:[
        { title:{ romaji:'AKIRA', english:'Akira' }, averageScore:79, seasonYear:1988, siteUrl:'https://anilist.co/anime/47' },
        { title:{ romaji:'AKIRA (Shin Anime)', english:null }, averageScore:null, seasonYear:null, siteUrl:'https://anilist.co/anime/126016' },
        { title:{ romaji:'Yuuwaku Countdown: Kagami AKIRA', english:'Countdown: Akira Complex' }, averageScore:50, seasonYear:1997, siteUrl:'https://anilist.co/anime/4608' },
    ] } } };
    const matched = hooks.parseAniListSearch(akira, 'Akira', '1988');
    assert.strictEqual(matched.score, 79);
    assert.strictEqual(matched.url, 'https://anilist.co/anime/47');

    // Position is not identity: the same set with the film last still resolves to it.
    const reordered = { data:{ Page:{ media:[akira.data.Page.media[2], akira.data.Page.media[0]] } } };
    assert.strictEqual(hooks.parseAniListSearch(reordered, 'Akira', '1988').score, 79);

    // A title AniList knows only by its English name.
    const spirited = { data:{ Page:{ media:[
        { title:{ romaji:'Sen to Chihiro no Kamikakushi', english:'Spirited Away' }, averageScore:86, seasonYear:2001, siteUrl:'https://anilist.co/anime/199' },
    ] } } };
    assert.strictEqual(hooks.parseAniListSearch(spirited, 'Spirited Away', '2001').score, 86);

    // The wrong year is the wrong title, however close the name is.
    assert.strictEqual(hooks.parseAniListSearch(akira, 'Akira', '2020'), null);
    // A year the page does not know is not a reason to accept anything.
    assert.strictEqual(hooks.parseAniListSearch(akira, 'Akira', '').score, 79);

    /* AniList leaves seasonYear null on titles it dates only through startDate — verified
       live 2026-08-31: Belle to Kaijuu Ouji answers seasonYear null, startDate.year 1976.
       Reading only the first threw the right entry away and cached the rejection. */
    const datedByStart = { data:{ Page:{ media:[
        { title:{ romaji:'Belle to Kaijuu Ouji' }, averageScore:47, seasonYear:null, startDate:{ year:1976 }, siteUrl:'https://anilist.co/anime/6301' },
    ] } } };
    assert.strictEqual(hooks.parseAniListSearch(datedByStart, 'Belle to Kaijuu Ouji', '1976').score, 47,
        'a title dated only by startDate is still that title');
    // And a genuinely undated entry still cannot satisfy a page that knows the year.
    const undated = { data:{ Page:{ media:[
        { title:{ romaji:'Akira' }, averageScore:79, seasonYear:null, startDate:{ year:null }, siteUrl:'https://anilist.co/anime/47' },
    ] } } };
    assert.strictEqual(hooks.parseAniListSearch(undated, 'Akira', '1988'), null);

    /* averageScore is null for anything unrated, which is normal for a title that has
       not aired. That is an absent answer, not a zero. */
    const unrated = { data:{ Page:{ media:[
        { title:{ romaji:'Akira', english:'Akira' }, averageScore:null, seasonYear:1988, siteUrl:'https://anilist.co/anime/47' },
    ] } } };
    assert.strictEqual(hooks.parseAniListSearch(unrated, 'Akira', '1988'), null);

    // A search that matched nothing comes back as an empty list rather than an error.
    assert.strictEqual(hooks.parseAniListSearch({ data:{ Page:{ media:[] } } }, 'Akira', '1988'), null);
    assert.strictEqual(hooks.parseAniListSearch(null, 'Akira', '1988'), null);
    assert.strictEqual(hooks.parseAniListSearch({ data:{ Page:{ media:'not a list' } } }, 'Akira', ''), null);
    assert.strictEqual(hooks.parseAniListSearch({ errors:[{ message:'bad request' }] }, 'Akira', ''), null);

    /* The link is theirs, so it is validated like every other address this renders. An
       entry whose siteUrl points somewhere else is still a score, with no link. */
    const spoofed = { data:{ Page:{ media:[
        { title:{ romaji:'Akira' }, averageScore:79, seasonYear:1988, siteUrl:'https://evil.example.com/anime/47' },
    ] } } };
    const unlinked = hooks.parseAniListSearch(spoofed, 'Akira', '1988');
    assert.strictEqual(unlinked.score, 79);
    assert.strictEqual(unlinked.url, '', 'an address that is not theirs is dropped, not rendered');

    // A score outside the scale is not a score.
    const impossible = { data:{ Page:{ media:[
        { title:{ romaji:'Akira' }, averageScore:1000, seasonYear:1988, siteUrl:'https://anilist.co/anime/47' },
    ] } } };
    assert.strictEqual(hooks.parseAniListSearch(impossible, 'Akira', '1988'), null);
});

/* The whole point of the gate is that a title which is not anime costs nothing. */
test('the anime score asks nothing about a title that is not anime', () => {
    const hooks = loadScriptTestHooks();
    const feature = hooks.getFeature('inlineAnimeScore');
    assert(feature, 'the feature should be registered');
    assert.strictEqual(hooks.DEFAULTS.inlineAnimeScore, false, 'it is a second opinion, so it is opt-in');

    /* The gate is the first thing after the page identifiers, before the cache read, the
       rating bar and every await — so nothing downstream can fire a request first. */
    const body = script.slice(script.indexOf("key: 'inlineAnimeScore'"));
    const init = body.slice(0, body.indexOf('        _render(data) {'));
    const gateAt = init.indexOf('if (!isAnimeTitle()) return;');
    assert(gateAt >= 0, 'the feature must ask whether the title is anime at all');
    assert(gateAt < init.indexOf('httpRequest('),
        'the gate must come before the request');
    assert(gateAt < init.indexOf('_renderLoading()'),
        'and before anything is drawn, so a non-anime page is untouched');
    /* But after the page has settled: the country link lives in the details block, which
       is one of the last parts to arrive, and asking before it exists answers no for a
       title that is one. Nothing between the two contacts anybody. */
    const waitAt = init.indexOf('await waitForRatingBar(isCurrent)');
    assert(waitAt >= 0 && waitAt < gateAt,
        'the gate must be asked after the page has settled, not at the first tick');
    assert(!/httpRequest\(|httpGet\(/.test(init.slice(0, gateAt)),
        'and nothing before it may contact anyone');

    // AniList is declared as the provider, so its origin is asked for with the feature.
    assert.deepStrictEqual(Array.from(hooks.FEATURE_PROVIDERS.inlineAnimeScore), ['anilist']);
    assert.deepStrictEqual(Array.from(hooks.PROVIDERS.anilist.origins), ['https://graphql.anilist.co/*']);
    assert(hooks.PROVIDERS.anilist.profiles.includes('store'),
        'a keyless documented API with no page parsing can ship in a store build');
});

/* IE-21: IMDb encodes the size it wants into the file name, so a larger picture costs one
   string rewrite and no request to ask what exists. Stripping the transform entirely
   yields the original, which readers have measured at 7644px and 32 MB — the thing this
   must never do. */
test('a zoomed image asks for a bounded variant, never the original', () => {
    const hooks = loadScriptTestHooks();
    const thumb = 'https://m.media-amazon.com/images/M/MV5BABC._V1_QL75_UX140_CR0,1,140,207_.jpg';

    const zoomed = hooks.boundedImageVariant(thumb);
    assert.strictEqual(zoomed, 'https://m.media-amazon.com/images/M/MV5BABC._V1_QL90_UY800_.jpg');
    assert(/_UY\d+_/.test(zoomed), 'the request must name a height, or it is the original');
    assert(!/\._V1_\./.test(zoomed), 'an empty transform is the original, which is tens of megabytes');

    // The bound holds whatever it is asked for.
    assert(/_UY1600_/.test(hooks.boundedImageVariant(thumb, 99999)), 'an absurd height is clamped, not honoured');
    assert(/_UY200_/.test(hooks.boundedImageVariant(thumb, 1)), 'and so is a useless one');
    assert(/_UY800_/.test(hooks.boundedImageVariant(thumb, 'not a number')));

    // A query string on the original is not carried into the request.
    assert.strictEqual(hooks.boundedImageVariant(`${thumb}?tracking=1`),
        'https://m.media-amazon.com/images/M/MV5BABC._V1_QL90_UY800_.jpg');

    /* Only their host, only their grammar. Anything else is left alone rather than
       rewritten into a URL that means something different. */
    assert.strictEqual(hooks.boundedImageVariant('https://evil.example.com/images/M/x._V1_QL75_.jpg'), '',
        'the rewrite belongs to one host');
    assert.strictEqual(hooks.boundedImageVariant('http://m.media-amazon.com/images/M/x._V1_QL75_.jpg'), '',
        'and to https');
    assert.strictEqual(hooks.boundedImageVariant('https://m.media-amazon.com/images/M/plain.jpg'), '',
        'a name without the transform marker is not guessed at');
    assert.strictEqual(hooks.boundedImageVariant('https://m.media-amazon.com/images/M/x._V1_.svg'), '',
        'and neither is a type their transform does not serve');
    assert.strictEqual(hooks.boundedImageVariant(''), '');
    assert.strictEqual(hooks.boundedImageVariant(null), '');
    assert.strictEqual(hooks.boundedImageVariant('not a url at all'), '');
    /* Credentials in an address are refused everywhere else in this file, and this one
       ends up as an img src like any other. */
    assert.strictEqual(hooks.boundedImageVariant('https://user:pass@m.media-amazon.com/images/M/x._V1_QL75_UX140_.jpg'), '',
        'an address carrying credentials is not rewritten, it is refused');

    /* Never smaller than what is already on screen: on a HiDPI display currentSrc is
       IMDb's 2x variant, and a flat 800 would hand back a worse picture than the
       thumbnail it is meant to enlarge. */
    assert(/_UY1200_/.test(hooks.boundedImageVariant('https://m.media-amazon.com/images/M/x._V1_UY1200_.jpg')),
        'a source already larger than the default is not downgraded');
    assert(/_UY1600_/.test(hooks.boundedImageVariant('https://m.media-amazon.com/images/M/x._V1_UY2000_.jpg')),
        'though the ceiling still binds above it');
    assert(/_UY1600_/.test(hooks.boundedImageVariant('https://m.media-amazon.com/images/M/x._V1_UY9000_.jpg')),
        'and the ceiling still holds');
    assert(/_UY800_/.test(hooks.boundedImageVariant('https://m.media-amazon.com/images/M/x._V1_UX140_.jpg')),
        'a small source still gets the default');

    /* Both surfaces the item names. Only one of them was covered. */
    // The list itself contains ], so the capture has to run to the join that closes it.
    const selector = /const ZOOM_THUMBNAIL_SELECTOR = \[([\s\S]*?)\]\.join/.exec(script)?.[1] || '';
    assert(/hero-media__poster/.test(selector), 'the poster is half of what this is for');
    assert(/title-cast-item__avatar/.test(selector), 'and the cast photos are the other half');
    /* A cast list and a filmography are where the thumbnails are; the title page's
       top-billed row is a fraction of them. */
    assert(hooks.SECONDARY_PAGE_FEATURE_KEYS.has('imageZoom'),
        'the zoom must reach full credits and person pages');

    /* Every listener it installs must come off again, or they accumulate on every route
       change for the life of the tab. */
    const body = script.slice(script.indexOf("key: 'imageZoom'"));
    const feature = body.slice(0, body.indexOf("    reg({", 10));
    const added = [...feature.matchAll(/(?:document|window)\.addEventListener\('([a-z]+)'/g)].map(match => match[1]).sort();
    const removed = [...feature.matchAll(/(?:document|window)\.removeEventListener\('([a-z]+)'/g)].map(match => match[1]).sort();
    assert(added.length >= 6, 'the zoom listens on the document and the window');
    assert.deepStrictEqual(removed, added, 'and every one of them is taken off again');

    // Off until asked for: it changes what hovering a picture does.
    assert.strictEqual(hooks.DEFAULTS.imageZoom, false);
    /* Positioned against the document, because IMDb's cards make their own stacking
       contexts and a z-index inside one cannot escape it. */
    /* Its rules are written once and emitted in both a plain and a scoped form, so the
       declaration is asserted where it is written rather than in one of the two outputs. */
    assert(/scopedRules\('\.enh-zoom'[\s\S]{0,220}position: absolute;/.test(script),
        'the preview must not be positioned inside the card it came from');
});

/* IE-23: IMDb closed its boards in 2017 and MovieChat keeps one per IMDb id. Checked live
   2026-08-31: /tt0133093 answers 301 to /tt0133093/The-Matrix, and the final page carries
   no X-Frame-Options and no Content-Security-Policy — framing works by their omission,
   not by their policy, so the fallback is a requirement rather than polish. */
test('the message board is addressed by IMDb id and never guessed at', () => {
    const hooks = loadScriptTestHooks();
    assert.strictEqual(hooks.getMovieChatUrl('tt0133093'), 'https://moviechat.org/tt0133093');

    // Only an IMDb id. Anything else would be a URL assembled out of page text.
    ['', null, 'nm0000206', 'tt', 'tt12', 'tt0133093/../evil', 'https://evil.example.com', '../../etc']
        .forEach(value => assert.strictEqual(hooks.getMovieChatUrl(value), '', `${value} is not an IMDb id`));

    assert.strictEqual(hooks.DEFAULTS.movieChatBoard, false, 'someone else\'s page inside this one is opt-in');

    /* A refused frame fires no error event in any browser, so a timeout is the only
       signal there is that the board did not appear. */
    const body = script.slice(script.indexOf("key: 'movieChatBoard'"));
    const feature = body.slice(0, body.indexOf('        destroy() {'));
    assert(/setTimeout\(giveUp, MOVIECHAT_LOAD_TIMEOUT\)/.test(feature),
        'the fallback must be driven by a timeout, not by an error event');
    assert(!/addEventListener\('error'/.test(feature),
        'an error event would never fire for a framing refusal, so nothing may depend on one');
    // And the section must not fetch anything: the frame is the only thing that contacts them.
    assert(!/httpGet|httpRequest|GM_xmlhttpRequest/.test(feature),
        'the board is framed, never fetched');
    // Nothing loads until it is scrolled to.
    const gateAt = feature.indexOf('waitUntilVisible(section, isCurrent)');
    assert(gateAt >= 0, 'the section must wait to be seen before it loads anything');
    assert(gateAt < feature.indexOf('src:url'),
        'the frame must be created after the section is visible, not before');
});

/* IE-12: a wrong match had no way back. Every other score source offers Wrong?, a pasted
   URL and No entry; AniList now does too, and a saved choice is read by id rather than by
   searching again, since the search's first answer is what was wrong to begin with. */
test('an AniList match can be corrected like every other source', () => {
    const hooks = loadScriptTestHooks();
    assert(hooks.SCORE_CORRECTION_PROVIDERS.anilist, 'AniList must be a correctable source');

    // The candidate list is the same search, kept whole instead of filtered to one answer.
    const payload = { data:{ Page:{ media:[
        { title:{ romaji:'AKIRA', english:'Akira' }, averageScore:79, seasonYear:1988, siteUrl:'https://anilist.co/anime/47' },
        { title:{ romaji:'Yuuwaku Countdown', english:null }, averageScore:50, startDate:{ year:1997 }, siteUrl:'https://anilist.co/anime/4608' },
        { title:{ romaji:'No link' }, averageScore:60, seasonYear:2000, siteUrl:'https://evil.example.com/anime/9' },
    ] } } };
    const candidates = hooks.collectAniListCandidates(payload);
    assert.strictEqual(candidates.length, 2, 'an entry whose address is not theirs is not offerable');
    assert.strictEqual(candidates[0].title, 'Akira');
    assert.strictEqual(candidates[0].year, 1988);
    assert.strictEqual(candidates[1].year, 1997, 'a title dated only by startDate still carries its year');
    assert.strictEqual(hooks.collectAniListCandidates(null).length, 0);
    assert.strictEqual(hooks.collectAniListCandidates({ data:{ Page:{ media:'nope' } } }).length, 0);

    /* A pasted address is only accepted if it is an AniList anime page, and the id is
       taken from the address rather than from anything the page said. */
    assert.strictEqual(hooks.getAniListIdFromUrl('https://anilist.co/anime/47'), 47);
    assert.strictEqual(hooks.getAniListIdFromUrl('https://anilist.co/anime/47/Akira'), 47);
    ['https://anilist.co/user/someone', 'https://anilist.co/anime/', 'https://evil.example.com/anime/47',
        'http://anilist.co/anime/47', '', null, 'javascript:alert(1)']
        .forEach(value => {
            assert.strictEqual(hooks.getAniListIdFromUrl(value), 0, `${value} is not an anime page`);
            /* And it is refused as an address, not merely unreadable as an id: the
               correction stores what is accepted here and renders it as a link. */
            assert.strictEqual(hooks.normalizeScoreCorrectionUrl('anilist', value), '',
                `${value} must not be storable as a corrected match`);
        });
    assert.strictEqual(hooks.normalizeScoreCorrectionUrl('anilist', 'https://anilist.co/anime/47/Akira'),
        'https://anilist.co/anime/47/Akira', 'their own anime page is');

    // A corrected entry is read whole, and an unrated one is still no answer.
    const corrected = hooks.parseAniListEntry({ data:{ Media:{ averageScore:86, siteUrl:'https://anilist.co/anime/199' } } });
    assert.strictEqual(corrected.score, 86);
    assert.strictEqual(corrected.url, 'https://anilist.co/anime/199');
    assert.strictEqual(hooks.parseAniListEntry({ data:{ Media:{ averageScore:null, siteUrl:'https://anilist.co/anime/1' } } }), null);
    assert.strictEqual(hooks.parseAniListEntry({ data:{ Media:null } }), null);
    assert.strictEqual(hooks.parseAniListEntry(null), null);

    /* The saved choice must be honoured by reading that entry, not by running the search
       whose first answer is what the correction exists to overrule. */
    const body = script.slice(script.indexOf("key: 'inlineAnimeScore'"));
    const init = body.slice(0, body.indexOf('        _render(data) {'));
    const correctedAt = init.indexOf("correction?.mode === 'url'");
    assert(correctedAt >= 0, 'a saved title URL must have its own path');
    assert(init.indexOf('ANILIST_BY_ID_QUERY') > correctedAt,
        'and that path must look the entry up by id');
    assert(init.indexOf('ANILIST_BY_ID_QUERY') < init.indexOf('let lookupError'),
        'before the ordinary search, which it replaces rather than supplements');
});

/* IE-26: which films are in the same series, in order. Verified live 2026-08-31 against
   query.wikidata.org: tt0796366 returns fourteen Star Trek films with their IMDb ids,
   English labels, years and P1545 ordinals. Their data is open, so every field it hands
   back is treated as something a stranger typed. */
test('a franchise is ordered by its own numbering, then by year', () => {
    const hooks = loadScriptTestHooks();

    const query = hooks.buildCollectionQuery('tt0796366');
    assert(query.includes('wdt:P179'), 'the series link is what makes them siblings');
    assert(query.includes('pq:P1545'), 'and the ordinal is what puts them in order');
    assert(query.includes('"tt0796366"'), 'the page id is the only input');
    // A page with no IMDb id asks nothing at all.
    ['', null, 'nm0000206', 'tt', '" } DELETE { ?s ?p ?o } WHERE {'].forEach(value =>
        assert.strictEqual(hooks.buildCollectionQuery(value), '', `${value} must not become a query`));

    const answer = JSON.stringify({ results:{ bindings:[
        { imdb:{ value:'tt1408101' }, label:{ value:'Star Trek Into Darkness' }, year:{ value:'2013' }, ordinal:{ value:'12' } },
        { imdb:{ value:'tt0079945' }, label:{ value:'Star Trek: The Motion Picture' }, year:{ value:'1979' }, ordinal:{ value:'1' } },
        { imdb:{ value:'tt0084726' }, label:{ value:'Star Trek II: The Wrath of Khan' }, year:{ value:'1982' }, ordinal:{ value:'2' } },
    ] } });
    const ordered = hooks.parseCollectionEntries(answer);
    assert.deepStrictEqual(Array.from(ordered.map(entry => entry.id)),
        ['tt0079945', 'tt0084726', 'tt1408101'], 'declared order wins over the order they arrived in');

    /* A series with no numbering is still a series, and release year is the order people
       mean in that case. */
    const undeclared = JSON.stringify({ results:{ bindings:[
        { imdb:{ value:'tt0000003' }, label:{ value:'Third' }, year:{ value:'2003' } },
        { imdb:{ value:'tt0000001' }, label:{ value:'First' }, year:{ value:'1999' } },
    ] } });
    assert.deepStrictEqual(Array.from(hooks.parseCollectionEntries(undeclared).map(entry => entry.id)),
        ['tt0000001', 'tt0000003']);
    // A numbered entry sorts ahead of an unnumbered one rather than behind an absent zero.
    const mixed = JSON.stringify({ results:{ bindings:[
        { imdb:{ value:'tt0000009' }, label:{ value:'Unnumbered' }, year:{ value:'1990' } },
        { imdb:{ value:'tt0000008' }, label:{ value:'Numbered' }, year:{ value:'2020' }, ordinal:{ value:'2' } },
    ] } });
    assert.deepStrictEqual(Array.from(hooks.parseCollectionEntries(mixed).map(entry => entry.id)),
        ['tt0000008', 'tt0000009']);

    /* Anyone can edit Wikidata, so anything that is not an IMDb id is not one. */
    const hostile = JSON.stringify({ results:{ bindings:[
        { imdb:{ value:'javascript:alert(1)' }, label:{ value:'Bad' }, year:{ value:'2000' } },
        { imdb:{ value:'../../evil' }, label:{ value:'Worse' } },
        { imdb:{ value:'tt0084726' }, label:{ value:'' } },
        { imdb:{ value:'tt0079945' }, label:{ value:'Fine' }, year:{ value:'1979' } },
        { imdb:{ value:'tt0079945' }, label:{ value:'Duplicate' }, year:{ value:'1979' } },
    ] } });
    const cleaned = hooks.parseCollectionEntries(hostile);
    assert.deepStrictEqual(Array.from(cleaned.map(entry => entry.id)), ['tt0079945'],
        'only real ids, with a title, once each');

    assert.strictEqual(hooks.parseCollectionEntries('not json').length, 0);
    assert.strictEqual(hooks.parseCollectionEntries('').length, 0);
    assert.strictEqual(hooks.parseCollectionEntries('{"results":{"bindings":"nope"}}').length, 0);

    assert.strictEqual(hooks.DEFAULTS.collectionPanel, false, 'a whole section of other films is opt-in');
    assert.deepStrictEqual(Array.from(hooks.FEATURE_PROVIDERS.collectionPanel), ['wikidata'],
        'it asks Wikidata and nobody else');

    /* A film in no series answers with itself or with nothing, and that answer is cached
       too so the next visit does not ask again. */
    const body = script.slice(script.indexOf("key: 'collectionPanel'"));
    const init = body.slice(0, body.indexOf('        _render(entries, imdbId) {'));
    assert(/cacheSet\(cacheKey, \{ entries \}, CACHE_MAX_TTL\)/.test(init),
        'the answer is kept for the long TTL, including when it is empty');
    assert(/entries\.length > 1/.test(init),
        'a series of one is not a watch order');
    /* Its own placeholder, not main: main is on screen the moment the page loads, so
       observing that is not a gate at all. */
    const gateAt = init.indexOf('await waitUntilVisible(placeholder, isCurrent)');
    assert(gateAt >= 0, 'the panel must wait on something that is not already visible');
    assert(!/waitUntilVisible\((?:host|document)/.test(init),
        'and not on the page container, which is visible from the first paint');
    assert(gateAt < init.indexOf('httpGet('),
        'and nothing is asked until there is somewhere to show the answer');
});

/* IE-25: the page's only job is to write down what is on the watchlist, because the
   checking happens with every IMDb tab closed. A watchlist can be thousands of titles and
   each one would be a scheduled request on somebody else's API, so what is written down
   is bounded, and every id in it is checked on the way back out. */
test('the watchlist snapshot is bounded, validated, and never emptied by an empty page', () => {
    const hooks = loadScriptTestHooks();

    const good = hooks.normalizeWatchlistSnapshot({
        v:1, ts:1700000000000, titles:{ tt0133093:{ title:'The Matrix' }, tt0903747:{ title:'Breaking Bad' } },
    });
    assert.strictEqual(Object.keys(good.titles).length, 2);
    assert.strictEqual(good.titles.tt0133093.title, 'The Matrix');

    // Anything that is not an id, or has no title, is not a watchlist entry.
    const dirty = hooks.normalizeWatchlistSnapshot({
        v:1, ts:1, titles:{
            'javascript:alert(1)':{ title:'Bad' },
            '../../evil':{ title:'Worse' },
            nm0000206:{ title:'A person' },
            tt0133093:{ title:'' },
            tt0903747:{ title:'Breaking Bad' },
        },
    });
    assert.deepStrictEqual(Array.from(Object.keys(dirty.titles)), ['tt0903747']);

    // A snapshot from a shape this build does not know is not read at all.
    assert.strictEqual(hooks.normalizeWatchlistSnapshot({ v:99, titles:{} }), null);
    assert.strictEqual(hooks.normalizeWatchlistSnapshot({ v:1, titles:'nope' }), null);
    assert.strictEqual(hooks.normalizeWatchlistSnapshot(null), null);
    assert.strictEqual(hooks.normalizeWatchlistSnapshot([]), null);
    // And an unreadable one reads as empty rather than throwing at whoever asked.
    assert.deepStrictEqual(Array.from(Object.keys(hooks.getWatchlistSnapshot().titles)), []);

    /* The bound is the whole reason this is safe to check on a schedule. */
    const huge = { v:1, ts:1, titles:{} };
    for (let index = 0; index < 500; index += 1) {
        huge.titles[`tt${String(1000000 + index).padStart(7, '0')}`] = { title:`Title ${index}` };
    }
    assert.strictEqual(Object.keys(hooks.normalizeWatchlistSnapshot(huge).titles).length, 200,
        'a thousand-title watchlist must not become a thousand scheduled requests');

    /* An empty read is far more likely to be a page that has not finished than a
       watchlist someone emptied, and writing it would silence the alerts for good. */
    const body = script.slice(script.indexOf("key: 'watchlistAlerts'"));
    const feature = body.slice(0, body.indexOf('        destroy() {'));
    assert(/if \(!Object\.keys\(titles\)\.length\) return;/.test(feature),
        'an empty read must not overwrite the snapshot');

    /* The userscript has no worker, so it must not offer a feature that needs one. */
    assert(!hooks.getFeatureKeys().includes('watchlistAlerts'),
        'the userscript build must not register it at all');

    assert(script.includes('if (IS_EXTENSION_BUILD) {\n        reg({\n            key: \'watchlistAlerts\''),
        'and the registration itself must be what is conditional');
    assert.strictEqual(hooks.DEFAULTS.watchlistAlerts, false, 'a background job is opt-in');
});

/* IE-25: the record of somebody's watchlist is data about them, so "Reset all settings"
   has to reach it and a backup has to show it exists. Left out of DEFAULTS it was neither
   resettable nor visible anywhere — a list of up to 200 titles they could not see and
   could not clear. */
test('the watchlist record is reset and exported like every other stored thing', () => {
    const hooks = loadScriptTestHooks();
    hooks.setStoredSetting('watchlistSnapshot', {
        v:1, ts:1, titles:{ tt0133093:{ title:'The Matrix' } },
    });
    hooks.setStoredSetting('watchlistAlertState', { checkedAt:1, cursor:'tt0133093', seen:{ tt0133093:['Netflix'] } });

    // Visible: a backup shows it exists rather than leaving it as a hidden record.
    const backup = hooks.getExportSettings();
    assert(Object.prototype.hasOwnProperty.call(backup, 'watchlistSnapshot'),
        'a backup must account for it');
    assert.strictEqual(Object.keys(backup.watchlistSnapshot.titles).length, 1);

    // Clearable: reset writes every default, and these are among them.
    const cleared = hooks.getDefaultSettingsEntries();
    const snapshot = cleared.find(entry => entry.key === 'watchlistSnapshot');
    const state = cleared.find(entry => entry.key === 'watchlistAlertState');
    assert(snapshot && state, 'reset must cover both of them');
    assert.strictEqual(Object.keys(snapshot.value).length, 0, 'and reset them to nothing');
    assert.strictEqual(Object.keys(state.value).length, 0);

    /* Restoring one keeps the shape the page and the worker agreed on rather than
       whatever a file happened to hold, and the per-title availability history is not
       restored at all: it is a record of what a schedule saw, not a preference. */
    const restored = hooks.prepareSettingsImport({
        watchlistSnapshot: { v:1, ts:1, titles:{ 'javascript:alert(1)':{ title:'Bad' }, tt0903747:{ title:'Breaking Bad' } } },
        watchlistAlertState: { seen:{ tt0903747:['Netflix'] } },
    });
    const importedSnapshot = restored.entries.find(entry => entry.key === 'watchlistSnapshot');
    assert.deepStrictEqual(Array.from(Object.keys(importedSnapshot.value.titles)), ['tt0903747'],
        'a restored snapshot is validated, not trusted');
    const importedState = restored.entries.find(entry => entry.key === 'watchlistAlertState');
    assert.strictEqual(Object.keys(importedState.value).length, 0,
        'and what a schedule saw is not something a backup puts back');
    assert.strictEqual(restored.ignored, 0, 'both are recognized fields');
});

/* IE-73: an injected widget lives inside IMDb's cascade and has to win by specificity
   alone, which is how the same z-index and card-primitive fights keep coming back. @scope
   gives rules written inside a widget proximity over rules written further away. It
   reached Baseline in December 2025 and the Firefox build's floor is older, so the rules
   ship in both forms — and the whole point is that the two cannot disagree. */
test('scoped widget rules are emitted twice from one source and say the same thing', () => {
    const hooks = loadScriptTestHooks();
    const css = hooks.scopedRules('.enh-thing', {
        '': 'color: red;',
        '.enh-thing__part': 'display: block;',
    });

    // The plain form, which every engine reads.
    assert(css.includes('.enh-thing { color: red; }'));
    assert(css.includes('.enh-thing .enh-thing__part { display: block; }'));

    /* Deliberately not behind @supports at-rule(@scope): Gecko implements @scope but
       not that support query, so the wrapper hid the feature from the one engine whose
       floor made the fallback necessary. An engine that does not know the at-rule
       discards it by the ordinary CSS error-handling rules, which is all the guard was
       ever doing. Checked in a browser, not assumed. */
    assert(/@scope \(\.enh-thing\) \{/.test(css), 'the scoped form is emitted');
    assert(!/@supports/.test(css),
        'and not behind a query that is false on an engine which supports @scope');
    assert(css.includes(':scope { color: red; }'));
    assert(css.includes(':scope .enh-thing__part { display: block; }'));

    /* The two forms are generated from the same map, so every declaration appears in
       both. A rule that exists in only one of them is the drift this shape exists to
       prevent. */
    const declarations = [...css.matchAll(/\{ ([^{}]+) \}/g)].map(match => match[1].trim());
    const counted = new Map();
    declarations.forEach(body => counted.set(body, (counted.get(body) || 0) + 1));
    counted.forEach((count, body) => {
        assert.strictEqual(count, 2, `"${body}" must appear in both the plain and the scoped form`);
    });

    /* The widgets that use it. The older ones keep their own selectors: converting them
       is not this item, and a half-converted stylesheet is worse than either. */
    ['.enh-collection', '.enh-moviechat', '.enh-zoom'].forEach(root => {
        assert(script.includes(`scopedRules('${root}'`), `${root} should scope its rules`);
    });

    /* And the guard is required rather than decorative: the Firefox build declares a
       floor older than the version that shipped @scope. */
    const firefoxFloor = Number(/const FIREFOX_MIN_VERSION = '(\d+)/.exec(
        fs.readFileSync(path.join(__dirname, '..', 'scripts', 'build-extension.js'), 'utf8'))?.[1]);
    assert(Number.isFinite(firefoxFloor), 'the Firefox floor should be readable');
    assert(firefoxFloor < 146,
        'if the floor ever reaches 146 the support query is no longer needed and this should say so');
});

/* IE-106: a spreadsheet is the shape people asked for, and two things have to be right
   before it is safe to hand someone a file: a field that contains a comma, a quote or a
   newline has to survive the trip, and a field that starts with = + - or @ is a formula
   to a spreadsheet rather than text. Somebody else's film title should not run when the
   file is opened. */
test('exported marks quote awkward values and defuse formulas', () => {
    const hooks = loadScriptTestHooks();
    const entries = [
        ['tt0133093', { state:'watched', title:'The Matrix', ts:Date.UTC(2024, 0, 15), note:'Rewatch, with commas' }],
        ['tt0903747', { state:'skip', title:'Say "hello"', ts:Date.UTC(2023, 5, 2), note:'A note\nover two lines' }],
        ['tt0111161', { state:'watched', title:'=cmd|calc', ts:0, note:'+1' }],
    ];

    const csv = hooks.buildMarksCsv(entries);
    const lines = csv.split('\r\n');
    assert.strictEqual(lines[0],
        'Const,State,Title,Year,Genres,Your Rating,Title Rating,IMDb Rating,Runtime (mins),Watched Date,Marked On,Series,Note',
        'the header is the documented one');
    /* Every column the store holds, not the five it used to write. Read back through the
       parser rather than compared as a string, so the check is about the values. */
    const headerCells = hooks.parseCsvTable(csv)[0];
    const firstRow = hooks.parseCsvTable(csv)[1];
    assert.strictEqual(headerCells.length, firstRow.length, 'a row has a cell per column');
    const cell = name => firstRow[headerCells.indexOf(name)];
    assert.strictEqual(cell('Const'), 'tt0133093');
    assert.strictEqual(cell('State'), 'watched');
    assert.strictEqual(cell('Title'), 'The Matrix');
    assert.strictEqual(cell('Marked On'), '2024-01-15');
    assert.strictEqual(cell('Note'), 'Rewatch, with commas', 'a comma is quoted and comes back whole');

    // A quote is doubled inside a quoted field, which is what RFC 4180 says.
    assert(csv.includes('"Say ""hello"""'), 'quotes are doubled, not escaped with a backslash');
    // A newline stays inside its field rather than becoming a new record.
    assert(csv.includes('"A note\nover two lines"'), 'a newline is quoted rather than breaking the row');

    /* The formula cases. A tab is what spreadsheets read as "this is text" and what
       importers strip, so the value is not mangled for anything that is not a
       spreadsheet. */
    assert(csv.includes('\t=cmd|calc'), 'a title beginning with = is not handed over as a formula');
    assert(csv.includes('\t+1'), 'and neither is a note beginning with +');
    assert(!csv.includes(',=cmd'), 'the raw formula must not appear unprefixed');

    ['=1+1', '+1', '-1', '@SUM(A1)'].forEach(value => {
        const row = hooks.buildMarksCsv([['tt0000001', { state:'watched', title:value, ts:0, note:'' }]]);
        assert(row.includes(`\t${value}`), `${value} must be defused`);
    });
    // And an ordinary value is left exactly as it is.
    assert(hooks.buildMarksCsv([['tt0000001', { state:'watched', title:'Alien', ts:0, note:'' }]])
        .includes(',Alien,'), 'a plain title is not decorated');
});

/* The other half: the two columns Letterboxd's importer reads. */
test('the Letterboxd export carries seen titles and their viewing dates', () => {
    const hooks = loadScriptTestHooks();
    const csv = hooks.buildLetterboxdCsv([
        ['tt0133093', { state:'watched', title:'The Matrix', ts:Date.UTC(2024, 0, 15),
            viewings:[{ date:'2020-05-01' }, { date:'2024-01-15' }] }],
        ['tt0903747', { state:'skip', title:'Skipped', ts:Date.UTC(2023, 5, 2) }],
        ['tt0111161', { state:'watched', title:'No viewings', ts:Date.UTC(2022, 2, 3) }],
    ]);
    const lines = csv.split('\r\n');
    assert.strictEqual(lines[0], 'imdbID,WatchedDate', 'the header Letterboxd reads');

    /* A rewatch is a row each, which is how Letterboxd records one. */
    assert(lines.includes('tt0133093,2020-05-01'));
    assert(lines.includes('tt0133093,2024-01-15'));

    /* A Skip is a decision not to watch something. Importing it as watched would be a
       lie about somebody's history. */
    assert(!csv.includes('tt0903747'), 'a skipped title is not something you have seen');

    // A Seen title with no logged viewing falls back to when it was marked.
    assert(lines.includes('tt0111161,2022-03-03'));

    // Nothing to export is a header and nothing else, rather than a malformed file.
    assert.strictEqual(hooks.buildLetterboxdCsv([]), 'imdbID,WatchedDate');
});

/* An export this extension cannot read back is not an export. The importer knew neither
   the Timestamp column nor the Note column, so a file it had just written lost every date
   and every note on the way in — and the formula guard was never removed, so a title like
   "-30-" grew another tab on every trip. */
test('an exported CSV reads back into the same marks', () => {
    const hooks = loadScriptTestHooks();
    const entries = [
        ['tt0133093', { state:'watched', title:'The Matrix', ts:Date.UTC(2024, 0, 15), note:'A note, with a comma' }],
        ['tt0044337', { state:'watched', title:'-30-', ts:Date.UTC(2023, 5, 2), note:'' }],
        ['tt2395385', { state:'skip', title:'+1', ts:Date.UTC(2022, 2, 3), note:'Say "no"' }],
    ];

    let csv = hooks.buildMarksCsv(entries);
    const first = hooks.prepareCsvMarkImport(csv, {});
    assert.strictEqual(first.importedRows, 3, 'every row is readable');

    /* Titles IMDb really carries. Each of them starts with a character a spreadsheet
       reads as a formula, and each has to survive unchanged. */
    assert.strictEqual(first.marks.tt0044337.title, '-30-', 'the guard is removed, not accumulated');
    assert.strictEqual(first.marks.tt2395385.title, '+1');
    assert.strictEqual(first.marks.tt0133093.title, 'The Matrix');

    // The columns the export writes and the import used to ignore.
    assert.strictEqual(first.marks.tt0133093.note, 'A note, with a comma');
    assert.strictEqual(first.marks.tt2395385.note, 'Say "no"', 'a quoted quote comes back as one quote');
    assert(String(first.marks.tt0133093.viewings?.[0]?.date || '').startsWith('2024-01-15'),
        'and the date, which the importer did not recognize at all');

    /* The trip has to be stable, not merely survivable: exporting what was imported and
       importing that again must produce the same titles. */
    csv = hooks.buildMarksCsv(Object.entries(first.marks));
    const second = hooks.prepareCsvMarkImport(csv, {});
    assert.strictEqual(second.marks.tt0044337.title, '-30-', 'a second trip adds nothing');
    assert.strictEqual(second.marks.tt2395385.title, '+1');
    assert.strictEqual(second.marks.tt0133093.note, 'A note, with a comma');
});

/* "Everything the extension stores" wrote five of the eleven things a record holds, so a
   person who exported and imported lost the year, the genres, the runtime, the rating and
   every viewing but the last. The file said so on its own header row and nobody noticed,
   because the round-trip test only ever put those five fields in. */
test('an exported CSV carries every field a mark record holds', () => {
    const hooks = loadScriptTestHooks();
    const record = {
        v:2, state:'watched', title:'Blade Runner', ts:Date.UTC(2024, 0, 15),
        note:'Seen it twice', year:1982, genres:['Sci-Fi', 'Thriller'],
        rating:9, imdbRating:8.1, runtime:117,
        viewings:[{ date:'2019-04-02', rating:8 }, { date:'2024-01-15', rating:9 }],
    };
    const csv = hooks.buildMarksCsv([['tt0083658', record]]);

    /* A viewing is a row, which is the only way more than one of them survives a file.
       Counted through the parser: splitting on line breaks counts the ones inside a
       quoted note as rows of their own, so the count would be about the notes. */
    assert.strictEqual(hooks.parseCsvTable(csv).length, 3, 'a header and a row per viewing');

    const back = hooks.prepareCsvMarkImport(csv, {}).marks.tt0083658;
    assert.strictEqual(back.title, 'Blade Runner');
    assert.strictEqual(back.year, 1982, 'the year came back');
    assert.deepStrictEqual(Array.from(back.genres), ['Sci-Fi', 'Thriller'], 'and the genres');
    assert.strictEqual(back.imdbRating, 8.1);
    assert.strictEqual(back.runtime, 117);
    assert.strictEqual(back.note, 'Seen it twice');
    assert.deepStrictEqual(Array.from(back.viewings, viewing => `${viewing.date}@${viewing.rating}`),
        ['2019-04-02@8', '2024-01-15@9'], 'both viewings, each with the rating given that time');

    /* The state has to survive too, which is the one thing the list above does not check:
       with the watched arm gone every row of this extension's own export came back with
       no state at all, so nothing in the library read as Seen. */
    assert.strictEqual(back.state, 'watched', 'and it is still something the person watched');

    /* A skip has a date it was decided on and no date it was watched on. Without a column
       of its own that date became the moment of the import. */
    const skip = hooks.prepareCsvMarkImport(
        hooks.buildMarksCsv([['tt2395385', { state:'skip', title:'Passed', ts:Date.UTC(2022, 2, 3) }]]), {},
    ).marks.tt2395385;
    assert.strictEqual(skip.state, 'skip');
    assert.strictEqual(new Date(skip.ts).toISOString().slice(0, 10), '2022-03-03',
        'the day it was marked, not the day it was imported');
    assert(!skip.viewings?.length, 'and a skip with nothing watched stays that way');

    /* A Skip can hold viewings: marking something Seen and later Skip keeps the dates it
       was watched on. The export wrote them and the import threw every one away, so a
       backup-and-restore destroyed the history behind any title somebody had since
       decided against, and reported it as a complete success. */
    const rewatched = hooks.prepareCsvMarkImport(hooks.buildMarksCsv([
        ['tt0088763', { state:'skip', title:'Seen, then skipped', ts:Date.UTC(2024, 0, 2),
            viewings:[{ date:'2018-07-07', rating:8 }, { date:'2021-03-01' }] }],
    ]), {}).marks.tt0088763;
    assert.strictEqual(rewatched.state, 'skip', 'the decision stands');
    assert.deepStrictEqual(Array.from(rewatched.viewings, viewing => `${viewing.date}@${viewing.rating ?? ''}`),
        ['2018-07-07@8', '2021-03-01@'], 'and every date behind it comes back');
    assert.strictEqual(rewatched.rating, undefined,
        'a rating given at one viewing is not promoted into a score for the title');

    /* A record can hold a note with no state at all. Read back as watched it would put a
       film into somebody's history that they had only written a note against. */
    const noteOnly = hooks.prepareCsvMarkImport(
        hooks.buildMarksCsv([['tt0111161', { state:'', title:'Only a note', ts:Date.UTC(2023, 1, 1),
            note:'Meant to watch this', viewings:[{ date:'2021-06-09' }] }]]), {},
    ).marks.tt0111161;
    assert.strictEqual(noteOnly.state, '', 'an empty State column means no state, not watched');
    assert.strictEqual(noteOnly.note, 'Meant to watch this');
    /* Clearing a Seen mark keeps the note and the dates it was watched on, so those rows
       carry a viewing date under an empty state and have to be read as one. */
    assert.strictEqual(noteOnly.viewings?.[0]?.date, '2021-06-09',
        'and the history behind the note is not thrown away with the state');

    /* A rating on the record with nothing logged against a particular viewing still has to
       reach the file, or the only thing the person scored comes back blank. */
    const rated = hooks.prepareCsvMarkImport(
        hooks.buildMarksCsv([['tt0068646', { state:'watched', title:'Scored', ts:Date.UTC(2024, 4, 4),
            rating:7.5 }]]), {},
    ).marks.tt0068646;
    assert.strictEqual(rated.rating, 7.5, 'the rating survives without a viewing to hang it on');
    /* And it stays the title's rating rather than being stamped onto viewings that were
       never scored. Writing it into every row invented a score for each date, which is a
       first-trip rewrite of somebody's history that a second trip cannot undo. */
    const unscored = hooks.prepareCsvMarkImport(hooks.buildMarksCsv([
        ['tt0071562', { state:'watched', title:'Unscored viewings', ts:Date.UTC(2024, 0, 2),
            rating:7.5, viewings:[{ date:'2019-04-02' }, { date:'2024-01-02' }] }],
    ]), {}).marks.tt0071562;
    assert.strictEqual(unscored.rating, 7.5, 'the title keeps its score');
    assert.deepStrictEqual(Array.from(unscored.viewings, viewing => viewing.rating), [undefined, undefined],
        'and neither viewing gains one it never had');

    /* A file from anywhere else has one rating column and it means both, which is how
       IMDb's own ratings export has always been read. That must not change. */
    const foreign = hooks.prepareCsvMarkImport(
        'Const,Your Rating,Date Rated,Title\r\ntt0068646,9,2024-03-04,The Godfather', {}).marks.tt0068646;
    assert.strictEqual(foreign.rating, 9, 'one rating column still sets the title score');
    assert.strictEqual(foreign.viewings?.[0]?.rating, 9, 'and the viewing it describes');

    /* A State column this does not recognise is still a file about titles somebody
       watched. Reading "Completed" as no state put the row in the store showing as
       unmarked everywhere, which is worse than the guess it replaced. */
    const foreignState = hooks.prepareCsvMarkImport(
        'Const,Status,Watched Date\r\ntt0110912,Completed,2024-01-15', {}).marks.tt0110912;
    assert.strictEqual(foreignState.state, 'watched',
        'only an empty cell means no state; an unfamiliar word is not a reason to forget the row');

    /* A guess must not overwrite something known. "Want to watch" is as plausible a value
       as "Completed", and reading it as watched would turn a whole watchlist into history
       over marks somebody had made deliberately. */
    const overExisting = hooks.prepareCsvMarkImport(
        'Const,Status,Title\r\ntt0133093,Want to watch,The Matrix\r\ntt2395385,Planned,Passed', {
            tt0133093:{ v:2, state:'skip', title:'The Matrix', ts:1 },
            tt2395385:{ v:2, state:'watched', title:'Passed', ts:2 },
        }).marks;
    assert.strictEqual(overExisting.tt0133093.state, 'skip', 'a deliberate Skip survives a word nobody knows');
    assert.strictEqual(overExisting.tt2395385.state, 'watched', 'and so does a deliberate Seen');

    /* A rating cell that is not a rating means the row was misread, and importing the rest
       of it would attach the wrong year or note to a title. */
    const badRating = hooks.prepareCsvMarkImport(
        'Const,State,Title Rating,Title\r\ntt0068646,watched,eleven,The Godfather', {});
    assert.strictEqual(badRating.importedRows, 0, 'a row with an unreadable rating is not imported');
    assert.strictEqual(badRating.skippedRows, 1, 'and is reported as skipped');

    /* Letterboxd and IMDb export files with no State column at all, and every row in one
       of those is something the person watched. That default has to stay. */
    const letterboxd = hooks.prepareCsvMarkImport(
        'imdbID,WatchedDate\r\ntt0133093,2024-01-15', {}).marks.tt0133093;
    assert.strictEqual(letterboxd.state, 'watched', 'a file without the column is a list of what was seen');

    /* A note with a line break in it is one row, and the count the import reports back has
       to say so. Counting rows by looking for line breaks turns one imported title into
       three and the person is told about work that never happened. */
    const wrapped = hooks.prepareCsvMarkImport(hooks.buildMarksCsv([
        ['tt0080684', { state:'watched', title:'Wrapped', ts:Date.UTC(2024, 0, 2),
            note:'First line\nsecond line\nthird' }],
    ]), {});
    assert.strictEqual(wrapped.totalRows, 1, 'a note over three lines is still one row');
    assert.strictEqual(wrapped.importedRows, 1);
    assert.strictEqual(wrapped.marks.tt0080684.note, 'First line\nsecond line\nthird',
        'and the note comes back with its line breaks');
});

/* The two hazards the export defends against, checked against values a spreadsheet
   actually evaluates rather than the shapes that are easy to test. */
test('the formula guard is not fooled by leading whitespace', () => {
    const hooks = loadScriptTestHooks();
    const guarded = hooks.buildMarksCsv([['tt0000001', { state:'watched', title:' =1+1', ts:0, note:'' }]]);
    assert(guarded.includes('\t =1+1') || guarded.includes('"\t =1+1"'),
        'a space before the equals sign does not stop a spreadsheet evaluating it');

    // A line separator that is not \n still ends a line for a reader, so it is quoted.
    const separated = hooks.buildMarksCsv([['tt0000002', { state:'watched', title:'a\u2028b', ts:0, note:'' }]]);
    assert(separated.includes('"a\u2028b"'), 'U+2028 is quoted like any other line break');
});

/* IE-111: a review-bombed title is bombed at 1 and defended at 10, and both ends are
   where a handful of people move a mean furthest. The same arithmetic without those two
   buckets says what the middle of the audience thought. It is derived from buckets IMDb
   publishes, so it is labelled as derived and never replaces the score on the page. */
test('the trimmed mean drops the two ends of the scale and says it is derived', () => {
    const hooks = loadScriptTestHooks();
    const bucket = (rating, voteCount) => ({ rating, voteCount });

    /* A bombing: a thousand 1s under an otherwise well-liked film. The plain mean is
       dragged down; the trimmed one is not. */
    const bombed = [bucket(1, 1000), bucket(7, 500), bucket(8, 500)];
    assert.strictEqual(hooks.computeUnweightedMean(bombed), 4.3);
    assert.strictEqual(hooks.computeTrimmedMean(bombed), 7.5, 'the 1s are left out');

    // And the defence at the other end is left out too, not only the attack.
    const defended = [bucket(1, 1000), bucket(7, 500), bucket(10, 1000)];
    assert.strictEqual(hooks.computeTrimmedMean(defended), 7,
        'a 10 counts no more than a 1 does');

    // A distribution with nothing at either end is unchanged by the trim.
    const ordinary = [bucket(6, 100), bucket(7, 200), bucket(8, 100)];
    assert.strictEqual(hooks.computeTrimmedMean(ordinary), hooks.computeUnweightedMean(ordinary));

    /* The edges. Every vote at one end leaves nothing to average, and a made-up number
       would be worse than saying nothing. */
    assert.strictEqual(hooks.computeTrimmedMean([bucket(1, 5000)]), null, 'all 1s trims to nothing');
    assert.strictEqual(hooks.computeTrimmedMean([bucket(10, 5000)]), null, 'and so does all 10s');
    assert.strictEqual(hooks.computeTrimmedMean([bucket(1, 100), bucket(10, 100)]), null);
    assert.strictEqual(hooks.computeTrimmedMean([]), null);
    assert.strictEqual(hooks.computeTrimmedMean(null), null);
    // Junk in a bucket is skipped rather than counted as a zero.
    assert.strictEqual(hooks.computeTrimmedMean([bucket('x', 100), bucket(5, 100)]), 5);
    assert.strictEqual(hooks.computeTrimmedMean([bucket(5, -100), bucket(5, 100)]), 5);

    /* The number has to come from an audience. A review-bombed title can have nearly all
       its votes at the two ends, and the mean of the handful left says nothing about
       anybody while looking exactly like an answer — which is the misleading case this
       whole line exists to avoid producing. */
    assert.strictEqual(hooks.computeTrimmedMean([bucket(1, 100000), bucket(7, 5)]), null,
        'five surviving votes is not a second opinion');
    assert.strictEqual(hooks.computeTrimmedMean([bucket(9, 1), bucket(10, 900000)]), null,
        'and neither is one');
    // A small share of a large vote count is still too small a share.
    assert.strictEqual(hooks.computeTrimmedMean([bucket(1, 100000), bucket(7, 1000)]), null,
        'one percent of the votes does not describe the audience');
    // But a genuine minority does: six percent of a large count is thousands of people.
    assert.strictEqual(hooks.computeTrimmedMean([bucket(1, 94000), bucket(7, 6000)]), 7);

    /* The rounding is part of the answer: a mean of 7.25 is reported to one decimal like
       every other rating on the page. */
    assert.strictEqual(hooks.computeTrimmedMean([bucket(7, 300), bucket(8, 100)]), 7.3,
        'the mean is rounded to one decimal, not printed raw');

    /* What the line says. The trimmed figure is additional, labelled, and the displayed
       rating is still the thing being compared against. */
    const line = hooks.describeRatingGap(4.3, 6.5, 7.5);
    assert(/Unweighted 4\.3/.test(line), 'the unweighted mean is still there');
    assert(/1s and 10s/.test(line), 'and the trim is described rather than implied');
    assert(/7\.5/.test(line));
    assert(/derived/i.test(line), 'and marked as derived, because nobody gave that score');

    // Nothing extra when the two means agree: a second identical number is noise.
    const same = hooks.describeRatingGap(7, 7, 7);
    assert(!/1s and 10s/.test(same), 'an unchanged trim is not worth a clause');
    // And nothing at all when there is no trimmed mean to report.
    assert(!/1s and 10s/.test(hooks.describeRatingGap(4.3, 6.5, null)));

    /* Both means come from one read of the page, or the line could describe two
       different distributions. */
    const feature = script.slice(script.indexOf("key: 'ratingGap'"));
    const init = feature.slice(0, feature.indexOf('destroy()'));
    assert.strictEqual((init.match(/getHistogramData\(\)/g) || []).length, 1,
        'the buckets are read once and both means computed from them');
});

/* IE-113: a link shared from a phone points at IMDb's mobile host, and opening it on a
   computer lands on a page this script does not run on and that nobody chose. The same
   path on the desktop host is where the person was going. */
test('a mobile IMDb address is rewritten to the desktop one, path and all', () => {
    const hooks = loadScriptTestHooks();
    const desktopView = { matchMedia: () => ({ matches:false }), innerWidth: 1440 };

    assert.strictEqual(
        hooks.desktopUrlForMobile('https://m.imdb.com/title/tt0133093/', desktopView),
        'https://www.imdb.com/title/tt0133093/');
    // The query and the fragment are part of where somebody was going.
    assert.strictEqual(
        hooks.desktopUrlForMobile('https://m.imdb.com/title/tt0133093/?ref_=nv_sr_1#reviews', desktopView),
        'https://www.imdb.com/title/tt0133093/?ref_=nv_sr_1#reviews');
    assert.strictEqual(
        hooks.desktopUrlForMobile('https://m.imdb.com/', desktopView),
        'https://www.imdb.com/');

    // Only that host, and only over TLS.
    ['https://www.imdb.com/title/tt0133093/', 'https://evil.example.com/title/tt1/',
        'http://m.imdb.com/title/tt1/', 'https://notm.imdb.com/', '', null, 'not a url']
        .forEach(value => assert.strictEqual(hooks.desktopUrlForMobile(value, desktopView), '',
            `${value} must not be rewritten`));

    /* Never on a phone. Sending somebody holding a phone to the desktop site is the same
       mistake pointed the other way, so a coarse pointer on a narrow viewport is left
       alone — and a coarse pointer on a large screen, which is a touchscreen laptop or a
       television, is not a phone. */
    const phone = { matchMedia: query => ({ matches: query === '(pointer: coarse)' }), innerWidth: 390 };
    assert.strictEqual(hooks.desktopUrlForMobile('https://m.imdb.com/title/tt1/', phone), '',
        'a phone keeps the site built for it');
    const touchLaptop = { matchMedia: query => ({ matches: query === '(pointer: coarse)' }), innerWidth: 1600 };
    assert.strictEqual(hooks.desktopUrlForMobile('https://m.imdb.com/title/tt1/', touchLaptop),
        'https://www.imdb.com/title/tt1/', 'a touchscreen laptop is not a phone');
    // A view with no coarse pointer at all is a computer, which is the default.
    assert.strictEqual(hooks.desktopUrlForMobile('https://m.imdb.com/title/tt1/', {}),
        'https://www.imdb.com/title/tt1/');

    /* Measured on the short edge. The same phone turned sideways is 844 pixels across and
       read on width alone would be sent to the desktop site mid-scroll, and a tablet would
       change its answer every time somebody rotated it. */
    const coarse = query => ({ matches: query === '(pointer: coarse)' });
    [
        ['a phone held sideways', { matchMedia: coarse, innerWidth: 844, innerHeight: 390 }],
        ['a tablet upright', { matchMedia: coarse, innerWidth: 820, innerHeight: 1180 }],
        ['the same tablet sideways', { matchMedia: coarse, innerWidth: 1180, innerHeight: 820 }],
        /* A tab that has not painted reports zero. Asking the screen instead beats
           concluding from a measurement that does not exist. */
        ['a tab that has not painted yet',
            { matchMedia: coarse, innerWidth: 0, innerHeight: 0, screen: { width: 390, height: 844 } }],
        /* And with nothing measurable at all, a coarse pointer is enough to leave alone.
           A computer left on the mobile page can navigate away; a phone taken off the page
           it asked for and dropped on a layout built for a mouse cannot undo that. */
        ['a coarse pointer and nothing to measure', { matchMedia: coarse }],
    ].forEach(([label, view]) => assert.strictEqual(
        hooks.desktopUrlForMobile('https://m.imdb.com/title/tt1/', view), '',
        `${label} keeps the site built for it`));

    /* The screen has to be the answer and not merely a way of reaching the phone verdict:
       an unpainted tab on a touchscreen laptop measures zero too, and reading the screen
       is the only thing that tells the two apart. */
    assert.strictEqual(hooks.desktopUrlForMobile('https://m.imdb.com/title/tt1/',
        { matchMedia: coarse, innerWidth: 0, innerHeight: 0, screen: { width: 1920, height: 1080 } }),
        'https://www.imdb.com/title/tt1/',
        'an unpainted tab on a touchscreen laptop is still not a phone');

    /* Credentials in an address belong to the host they were typed for; carrying them to
       another one hands them to somebody who was never offered them. A real IMDb link has
       neither those nor a port. */
    ['https://user:secret@m.imdb.com/title/tt1/', 'https://user@m.imdb.com/title/tt1/',
        'https://m.imdb.com:8443/title/tt1/']
        .forEach(value => assert.strictEqual(hooks.desktopUrlForMobile(value, desktopView), '',
            `${value} must not be carried to another host`));

    /* IMDb sends some visitors back to the mobile host, and two redirects that disagree
       loop until the tab gives up. The second attempt at the same address is refused. */
    const store = new Map();
    const tab = { sessionStorage: {
        getItem: key => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
    } };
    assert.strictEqual(hooks.claimDesktopRedirect('https://www.imdb.com/title/tt1/', tab), true,
        'the first rewrite goes ahead');
    assert.strictEqual(hooks.claimDesktopRedirect('https://www.imdb.com/title/tt1/', tab), false,
        'the second one for the same address does not');
    assert.strictEqual(hooks.claimDesktopRedirect('https://www.imdb.com/title/tt2/', tab), true,
        'a different page is a different journey');

    /* And the refusal expires. A claim that never lifts cannot tell "IMDb bounced me
       back" from "the person opened that link again", so the same address clicked later
       in the same tab sat on the mobile page doing nothing for the rest of the session. */
    const later = Date.now() + 60000;
    assert.strictEqual(hooks.claimDesktopRedirect('https://www.imdb.com/title/tt2/', tab, later), true,
        'the same link a minute later is a fresh journey, not a loop');
    assert.strictEqual(hooks.claimDesktopRedirect('https://www.imdb.com/title/tt2/', tab, later + 1000), false,
        'and the loop guard still holds inside the window');
    /* A claim written before this carried a timestamp still holds. Reading it as "no time,
       so not recent" let the exact bounce this exists to stop through once, on the first
       load after an upgrade, which is when a session is most likely to be mid-loop. */
    const upgraded = new Map([['imdb_enh_desktop_redirect', 'https://www.imdb.com/title/tt5/']]);
    const upgradedTab = { sessionStorage: {
        getItem: key => (upgraded.has(key) ? upgraded.get(key) : null),
        setItem: (key, value) => upgraded.set(key, String(value)),
    } };
    assert.strictEqual(hooks.claimDesktopRedirect('https://www.imdb.com/title/tt5/', upgradedTab), false,
        'a claim from before the stamp existed is still a claim');

    /* A stamp from the future says nothing about how long ago the claim was made, so it
       is not treated as old. Measuring the gap without its sign would call an hour's
       difference expired either way round and hand the loop back. */
    assert.strictEqual(hooks.claimDesktopRedirect('https://www.imdb.com/title/tt2/', tab, later - 3600000),
        false, 'a clock put back an hour does not reopen the loop');

    // Private modes throw on the first touch of session storage; that must not stop the fix.
    assert.strictEqual(hooks.claimDesktopRedirect('https://www.imdb.com/title/tt1/',
        { get sessionStorage() { throw new Error('denied'); } }), true,
        'a browser that refuses session storage still gets the redirect');
    assert(/claimDesktopRedirect\(desktop\)/.test(script),
        'and the boot path must actually consult it');

    /* A view that cannot answer the question at all is left alone. A browser that throws
       on matchMedia or on screen tells you nothing about the device, and the cost of
       guessing wrong is asymmetric: a computer left on the mobile page can navigate away,
       a phone dropped on a layout built for a mouse cannot undo that. */
    const hostile = {
        get matchMedia() { throw new Error('blocked'); },
        innerWidth: 1920, innerHeight: 1080,
    };
    assert.strictEqual(hooks.desktopUrlForMobile('https://m.imdb.com/title/tt1/', hostile), '',
        'a view that throws is not read as a desktop');

    assert.strictEqual(hooks.DEFAULTS.desktopFromMobileLinks, true, 'on by default');
    /* And switchable off: somebody who wants the mobile layout on a desktop should keep
       it, and a redirect with no way out is a hijack rather than a convenience. */
    const boot = script.slice(script.indexOf('registerManagerMenuCommands();', script.length - 4000));
    assert(/get\('desktopFromMobileLinks'\) !== false/.test(boot),
        'the redirect must consult the setting rather than always firing');

    /* It has to happen before anything paints, and it has to replace rather than push, or
       the back button bounces between the two hosts forever. */
    assert(/location\.replace\(desktop\)/.test(script), 'the history entry is replaced, not added to');
    assert(boot.indexOf('desktopUrlForMobile(location.href)') < boot.indexOf('installSPARouter()'),
        'and before the router or any feature starts');
});

/* IE-107: a series page knew nothing about the episodes of it somebody had watched, even
   though the marks were in the store. They are keyed by the episode's own id and carried
   no way back to the show, so the link has to be recorded when the mark is made. */
test('an episode mark records the series it belongs to', () => {
    const hooks = loadScriptTestHooks();
    const marks = {
        tt0959621:{ v:2, state:'watched', title:'Pilot', ts:1, series:'tt0903747' },
        tt0959622:{ v:2, state:'watched', title:'Cat in the Bag', ts:2, series:'tt0903747' },
        // A Skip is a decision not to watch an episode, so it is not progress through one.
        tt0959623:{ v:2, state:'skip', title:'Skipped one', ts:3, series:'tt0903747' },
        // Another show entirely, and a film that belongs to nothing.
        tt0994359:{ v:2, state:'watched', title:'Other show', ts:4, series:'tt0306414' },
        tt0133093:{ v:2, state:'watched', title:'The Matrix', ts:5 },
    };
    assert.strictEqual(hooks.countSeenEpisodes('tt0903747', marks), 2,
        'only the episodes of this show that were actually watched');
    assert.strictEqual(hooks.countSeenEpisodes('tt0306414', marks), 1);
    assert.strictEqual(hooks.countSeenEpisodes('tt0000001', marks), 0, 'a show with none says none');
    assert.strictEqual(hooks.countSeenEpisodes('', marks), 0, 'and neither does a missing id');
    assert.strictEqual(hooks.countSeenEpisodes('not-an-id', marks), 0);

    /* Stored only when it is a real id and not the record's own. A record pointing at
       itself would count a series page as one of its own episodes. */
    assert.strictEqual(hooks.normalizeUserMark({ state:'watched', ts:1, series:'tt0903747' }).series,
        'tt0903747');
    assert.strictEqual(hooks.normalizeUserMark({ state:'watched', ts:1, series:'nonsense' }).series,
        undefined, 'junk in the field is dropped rather than stored');
    assert.strictEqual(hooks.normalizeUserMark({ state:'watched', ts:1 }).series, undefined,
        'and a mark made before this shipped simply does not carry one');

    /* Saving a mark has to actually write the field. Everything above works on records
       that already carry it, so the one line that puts it there when somebody clicks Seen
       could be deleted with all of it still passing. */
    hooks.setStoredSetting('userMarks', {});
    assert.strictEqual(hooks.setUserMark('tt0959621', 'watched', 'Pilot', true,
        { series:'tt0903747', year:2008 }), true);
    assert.strictEqual(hooks.getUserMarks(true).tt0959621.series, 'tt0903747',
        'marking an episode Seen records the show it belongs to');
    assert.strictEqual(hooks.countSeenEpisodes('tt0903747', hooks.getUserMarks(true)), 1);
    hooks.setStoredSetting('userMarks', {});

    /* It has to survive a backup. A restore that lost the link would leave every series
       page reporting nothing while the episode marks were all still there. */
    const csv = hooks.buildMarksCsv(Object.entries(marks));
    const back = hooks.prepareCsvMarkImport(csv, {}).marks;
    assert.strictEqual(back.tt0959621.series, 'tt0903747', 'the link comes back');
    assert.strictEqual(back.tt0133093.series, undefined, 'and a film still belongs to nothing');
    assert.strictEqual(hooks.countSeenEpisodes('tt0903747', back), 2, 'so the count survives too');

    /* A file can say anything, so the reader refuses what both writers refuse. A row
       claiming a title is an episode of itself would make a series page count its own
       page, and the value would survive every trip after that. */
    const selfReferential = hooks.prepareCsvMarkImport(
        'Const,State,Title,Series\r\ntt0903747,watched,Breaking Bad,tt0903747', {}).marks.tt0903747;
    assert.strictEqual(selfReferential.state, 'watched', 'the mark itself is still imported');
    assert.strictEqual(selfReferential.series, undefined, 'a title is never an episode of itself');
    assert.strictEqual(hooks.countSeenEpisodes('tt0903747', { tt0903747:selfReferential }), 0);
});

/* IE-105: watching something twice is the ordinary case a Seen mark could not describe.
   Marking it again only moved the single date it held, which is the complaint people write
   to IMDb about their own check-ins. */
test('a second viewing is added to a title rather than replacing the first', () => {
    const hooks = loadScriptTestHooks();
    hooks.setStoredSetting('userMarks', {});
    assert.strictEqual(hooks.setUserMark('tt0133093', 'watched', 'The Matrix'), true);
    assert.strictEqual(hooks.countViewings(hooks.getUserMarks(true).tt0133093), 1,
        'marking it Seen logs the first viewing');

    assert.strictEqual(hooks.logAdditionalViewing('tt0133093', '2019-04-02'), 2,
        'a second date is a second viewing');
    assert.deepStrictEqual(
        Array.from(hooks.getUserMarks(true).tt0133093.viewings, viewing => viewing.date).slice(0, 1),
        ['2019-04-02'], 'and the earlier one sorts first rather than overwriting anything');

    /* Twice on the same day is once. Compared by date: the merge keeps a rated and an
       unrated entry for one day as two, so counting them would let a second click on the
       same day through. */
    assert.strictEqual(hooks.logAdditionalViewing('tt0133093', '2019-04-02'), 0,
        'the same date again is not another viewing');
    assert.strictEqual(hooks.countViewings(hooks.getUserMarks(true).tt0133093), 2);

    // Only against something already Seen. A first viewing is what the Seen button is.
    assert.strictEqual(hooks.setUserMark('tt2395385', 'skip', 'Passed'), true);
    assert.strictEqual(hooks.logAdditionalViewing('tt2395385', '2024-01-01'), 0,
        'a skipped title has no viewing to add to');
    assert.strictEqual(hooks.logAdditionalViewing('tt0000001', '2024-01-01'), 0,
        'and neither has one that was never marked');
    assert.strictEqual(hooks.logAdditionalViewing('tt0133093', 'not a date'), 0,
        'a date that is not one is refused rather than stored');

    /* At the ceiling the oldest makes room. The count stops moving there, so the caller
       has to be able to tell that from "nothing happened" or it says the wrong thing. */
    const dates = Array.from({ length:hooks.USER_MARK_VIEWINGS_MAX },
        (_, index) => new Date(Date.UTC(2020, 0, index + 1)).toISOString().slice(0, 10));
    hooks.setStoredSetting('userMarks', {
        tt0111161:{ v:2, state:'watched', title:'Full', ts:1, viewings:dates.map(date => ({ date })) },
    });
    assert.strictEqual(hooks.getUserMarks(true).tt0111161.viewings.length, hooks.USER_MARK_VIEWINGS_MAX);
    assert.strictEqual(hooks.logAdditionalViewing('tt0111161', '2026-06-06'), hooks.USER_MARK_VIEWINGS_MAX,
        'the new date is stored and the count holds at the ceiling');
    const kept = Array.from(hooks.getUserMarks(true).tt0111161.viewings, viewing => viewing.date);
    assert(kept.includes('2026-06-06'), 'the new viewing is there');
    assert(!kept.includes(dates[0]), 'and the oldest is the one that made room');
    hooks.setStoredSetting('userMarks', {});
});

/* IE-114: the fixture exercises the notice by calling it, which says nothing about
   whether anything on a real page ever does. Deleting the one call from init left the
   feature completely dead with every test still passing. */
test('the first-run notice is wired into the page setup', () => {
    const start = script.indexOf('function init() {');
    assert(start > 0, 'init must still be there to wire anything into');
    const body = script.slice(start, script.indexOf('\n    }\n', start));
    assert(/\bshowFirstRunNotice\(\)/.test(body),
        'init has to call it, or nobody who installs this ever sees it');
    assert(/\bcreateFAB\(\)/.test(body), 'and create the gear button it points at');
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
    // The group's identity is what the rule tests; its heading is a separate lookup.
    assert(script.includes("if (cat === 'movies' && isTVType()) continue"), 'expanded movie-only links should stay off TV pages');
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
        // The headers are catalog entries, so the label is what the key resolves to.
        .map(line => line.match(/makeEl\('span', \{\}, t\('([A-Za-z0-9_@]+)'\)\)/)?.[1])
        .filter(Boolean)
        .map(key => messageCatalog[key]);
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
    ['letterboxd.com', 'metacritic.com'].forEach(domain => {
        assert(script.includes(`normalizeTrustedUrl(data.url, '${domain}'`), `${domain} render allowlist missing`);
    });
    assert.match(script, /fromTmdb\s*\?\s*'themoviedb\.org'\s*:\s*'justwatch\.com'/,
        'availability render allowlist must follow the payload source');
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

test('score corrections persist outside cache storage and survive settings export', () => {
    const hooks = loadScriptTestHooks();
    const imdbId = 'tt0084787';
    assert.strictEqual(
        hooks.normalizeScoreCorrectionUrl('rottenTomatoes', 'https://www.rottentomatoes.com/m/the_thing'),
        'https://www.rottentomatoes.com/m/the_thing'
    );
    assert.strictEqual(hooks.normalizeScoreCorrectionUrl('rottenTomatoes', 'https://www.rottentomatoes.com/search?q=thing'), '',
        'a search page must not become a title override');
    assert.strictEqual(hooks.normalizeScoreCorrectionUrl('letterboxd', 'http://letterboxd.com/film/the-thing/'), '',
        'manual overrides must require HTTPS');
    assert.strictEqual(hooks.normalizeScoreCorrectionUrl('metacritic', 'https://metacritic.com/movie/the-thing/'),
        'https://metacritic.com/movie/the-thing/');
    assert(hooks.scoreCorrectionUrlsMatch('metacritic',
        'https://metacritic.com/movie/the-thing?ref=manual#scores',
        'https://www.metacritic.com/movie/the-thing/'),
    'provider host aliases and trailing slashes must still identify the same saved title');
    assert.strictEqual(
        hooks.normalizeScoreCorrectionUrl('metacritic', 'https://metacritic.com/movie/the-thing?ref=manual#scores'),
        'https://metacritic.com/movie/the-thing',
        'identity overrides must discard tracking queries and fragments'
    );
    assert.strictEqual(hooks.normalizeScoreCorrectionUrl('justWatch', 'https://www.justwatch.com/gb/movie/the-thing'),
        'https://www.justwatch.com/gb/movie/the-thing');
    assert.strictEqual(hooks.normalizeScoreCorrectionUrl('justWatch', 'https://justwatch.com.evil.test/us/movie/the-thing'), '');
    assert.strictEqual(
        hooks.resolveScoreCorrectionResponseUrl(
            'rottenTomatoes', {}, 'https://www.rottentomatoes.com/m/the_thing'),
        'https://www.rottentomatoes.com/m/the_thing',
        'a response without redirect metadata may retain the validated request URL'
    );
    assert.strictEqual(
        hooks.resolveScoreCorrectionResponseUrl(
            'rottenTomatoes', { finalUrl:'https://www.rottentomatoes.com/search?search=thing' },
            'https://www.rottentomatoes.com/m/the_thing'),
        '',
        'an invalid same-host final URL must not fall back to the requested title URL'
    );
    assert.strictEqual(
        hooks.resolveScoreCorrectionResponseUrl(
            'letterboxd', { finalUrl:'https://example.test/film/the-thing/' },
            'https://letterboxd.com/film/the-thing/'),
        '',
        'a foreign final URL must not inherit the identity of the requested title'
    );
    assert.strictEqual(
        hooks.getJustWatchCorrectionRequestUrl('https://www.justwatch.com/gb/movie/the-thing', 'US'),
        'https://www.justwatch.com/us/movie/the-thing',
        'a saved JustWatch title must be requested in the active region'
    );
    assert.strictEqual(
        hooks.resolveJustWatchCorrectionResponseUrl(
            { finalUrl:'https://www.justwatch.com/us/movie/the-thing' },
            'https://www.justwatch.com/us/movie/the-thing', 'US'),
        'https://www.justwatch.com/us/movie/the-thing'
    );
    assert.strictEqual(
        hooks.resolveJustWatchCorrectionResponseUrl(
            { finalUrl:'https://www.justwatch.com/gb/movie/the-thing' },
            'https://www.justwatch.com/us/movie/the-thing', 'US'),
        '',
        'a redirect back to the saved region must not be cached under the active region'
    );

    assert(hooks.cacheSet(`rt_${imdbId}`, { tomatometer:12 }), 'the volatile score fixture must be stored');
    assert(hooks.setScoreCorrection(imdbId, 'rottenTomatoes', {
        mode:'url',
        url:'https://www.rottentomatoes.com/m/the_thing',
        title:'The Thing',
        year:1982,
    }));
    assert.strictEqual(hooks.cacheGet(`rt_${imdbId}`), null, 'changing identity must invalidate the old score cache');
    const saved = hooks.getScoreCorrection(imdbId, 'rottenTomatoes');
    assert.strictEqual(saved.mode, 'url');
    assert.strictEqual(saved.title, 'The Thing');
    assert.strictEqual(saved.year, 1982);
    assert(hooks.setScoreCorrection(imdbId, 'letterboxd', { mode:'none' }));
    assert.strictEqual(hooks.getScoreCorrection(imdbId, 'letterboxd').mode, 'none');

    const justWatchUsKey = hooks.getAvailabilityCacheKey(imdbId, 'justwatch', 'US');
    const justWatchGbKey = hooks.getAvailabilityCacheKey(imdbId, 'justwatch', 'GB');
    assert(hooks.cacheSet(justWatchUsKey, { providers:['US service'] }));
    assert(hooks.cacheSet(justWatchGbKey, { providers:['GB service'] }));
    assert(hooks.cacheSet(`jw_${imdbId}`, { providers:['Legacy service'] }));
    assert(hooks.setScoreCorrection(imdbId, 'justWatch', { mode:'none' }));
    assert.strictEqual(hooks.cacheGet(justWatchUsKey), null,
        'a JustWatch correction must invalidate the title in every cached region');
    assert.strictEqual(hooks.cacheGet(justWatchGbKey), null,
        'regional cache invalidation must not stop after the first match');
    assert.strictEqual(hooks.cacheGet(`jw_${imdbId}`), null,
        'correction invalidation must also remove the source-blind legacy key');

    hooks.cacheGC(true);
    assert.strictEqual(hooks.getScoreCorrection(imdbId, 'rottenTomatoes').url,
        'https://www.rottentomatoes.com/m/the_thing', 'cache collection must not touch durable identity choices');
    const backup = hooks.getExportSettings();
    assert.strictEqual(backup.scoreCorrections[imdbId].letterboxd.mode, 'none');
    const restored = hooks.prepareSettingsImport(backup).entries
        .find(entry => entry.key === 'scoreCorrections')?.value;
    assert.strictEqual(restored[imdbId].rottenTomatoes.year, 1982,
        'ordinary settings restore must retain the selected match');

    const oversized = {};
    for (let index = 0; index < hooks.SCORE_CORRECTION_TITLE_LIMIT + 25; index += 1) {
        oversized[`tt${String(10000 + index)}`] = {
            rottenTomatoes:{ mode:'none', ts:index + 1 },
        };
    }
    oversized.notAnIMDbId = { rottenTomatoes:{ mode:'none', ts:Date.now() } };
    const bounded = hooks.normalizeScoreCorrections(oversized);
    assert.strictEqual(Object.keys(bounded).length, hooks.SCORE_CORRECTION_TITLE_LIMIT,
        'imported correction maps must retain only the newest bounded title set');
    assert(!Object.prototype.hasOwnProperty.call(bounded, 'notAnIMDbId'));
    assert(hooks.setScoreCorrection(imdbId, 'rottenTomatoes', null), 'automatic matching must be restorable');
    assert.strictEqual(hooks.getScoreCorrection(imdbId, 'rottenTomatoes'), null);
});

test('every external provider exposes bounded alternate title candidates', () => {
    const hooks = loadScriptTestHooks();
    const rtHtml = [1982, 2011].map(year => `
        <search-page-media-row release-year="${year}" tomatometer-score="${year === 1982 ? 84 : 35}">
            <a slot="title" href="https://www.rottentomatoes.com/m/the_thing_${year}">The Thing</a>
        </search-page-media-row>`).join('');
    const letterboxdHtml = [1982, 2011].map(year => `
        <a href="/film/the-thing-${year}/" data-film-name="The Thing" data-film-release-year="${year}">
            <img alt="The Thing (${year})">
        </a>`).join('');
    const justWatchHtml = [1982, 2011].map(year => `
        <a class="title-list-row__column-header" href="/us/movie/the-thing-${year}">
            <span class="header-title">The Thing</span><span class="header-year">(${year})</span>
        </a>`).join('');
    const metacriticItems = [1982, 2011].map(year => ({
        title:'The Thing',
        type:'movie',
        releaseDate:`${year}-06-25`,
        criticScoreSummary:{ score:year === 1982 ? 59 : 49, url:`/movie/the-thing-${year}/critic-reviews/` },
        userScoreSummary:{ score:year === 1982 ? 8.4 : 6.2 },
    }));
    const providers = [
        ['rottenTomatoes', hooks.parseRTSearchCandidates(rtHtml, 'movie')],
        ['letterboxd', hooks.parseLetterboxdSearchCandidates(letterboxdHtml)],
        ['metacritic', hooks.collectMetacriticCandidates(metacriticItems, 'movie')],
        ['justWatch', hooks.parseJustWatchSearchCandidates(justWatchHtml, 'movie', 'us')],
    ];
    providers.forEach(([provider, candidates]) => {
        assert.deepStrictEqual(Array.from(candidates, candidate => candidate.year), [1982, 2011],
            `${provider} must retain both same-title years for correction`);
        const ranked = hooks.rankScoreCorrectionCandidates(provider, candidates, 'The Thing', 1982);
        assert.strictEqual(ranked[0].year, 1982, `${provider} should put the exact year first`);
        assert(ranked.length <= hooks.SCORE_CORRECTION_CANDIDATE_LIMIT,
            `${provider} candidate output must stay bounded`);
    });
    assert.strictEqual(hooks.getLetterboxdSearchUrl('The Thing'),
        'https://letterboxd.com/search/films/the-thing/',
        'Letterboxd search paths must use the slug form its site accepts');
    const escapedQuery = hooks.buildLetterboxdCandidateQuery('A "Title" } UNION { ?x ?y ?z');
    assert(escapedQuery.includes('A \\"Title\\" } UNION { ?x ?y ?z"@en'),
        'Wikidata candidate titles must remain inside one escaped string literal');
    const mappedLetterboxd = hooks.parseLetterboxdWikidataCandidates(JSON.stringify({
        results:{ bindings:[
            { letterboxd:{ value:'the-thing' }, year:{ value:'1982' } },
            { letterboxd:{ value:'the-thing-2011' }, year:{ value:'2011' } },
            { letterboxd:{ value:'https://evil.test/' }, year:{ value:'2011' } },
        ] },
    }), 'The Thing');
    assert.deepStrictEqual(Array.from(mappedLetterboxd, candidate => candidate.year), [1982, 2011]);
    const excess = Array.from({ length:hooks.SCORE_CORRECTION_CANDIDATE_LIMIT + 20 }, (_, index) => ({
        title:'The Thing', year:1982 + index,
        url:`https://www.rottentomatoes.com/m/the_thing_${index}`,
    }));
    assert.strictEqual(
        hooks.rankScoreCorrectionCandidates('rottenTomatoes', excess, 'The Thing', 1982).length,
        hooks.SCORE_CORRECTION_CANDIDATE_LIMIT
    );

    [
        ['inlineRTScore', 'rottenTomatoes'],
        ['inlineLetterboxdScore', 'letterboxd'],
        ['inlineMetacriticScore', 'metacritic'],
        ['streamAvailability', 'justWatch'],
    ].forEach(([feature, provider]) => {
        assert(new RegExp(`key: '${feature}'[\\s\\S]{0,14000}?appendScoreCorrectionAction\\(w, '${provider}'`).test(script),
            `${feature} must render the correction action`);
        assert(new RegExp(`key: '${feature}'[\\s\\S]{0,5000}?correction\\?\\.mode === 'none'`).test(script),
            `${feature} must stop before lookup when no entry is saved`);
    });
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
        'parseYouTubeTrailerVideoId', 'parseRTSearchCandidates', 'parseRTDetailPage',
        'parseLetterboxdDetailPage', 'parseLetterboxdSearchCandidates', 'parseJustWatchSearchCandidates', 'parseJustWatchIdentity',
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
    assert(script.includes(`row.setAttribute('aria-label', t('${messageKeyFor('$1 in $2')}', [destination, title]))`),
        'destination groups should name their row and list');
    assert(script.includes(`remove.setAttribute('aria-label', t('${messageKeyFor('Remove $1 from $2')}', [destination, title]))`),
        'remove controls should follow edited destination names');
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
    /* The label and the accessible name are catalog entries; what has to hold is that the
       library state supplies both, and that the accessible name names the title. */
    const libraryState = /_setState\(btn, 'library', t\('([A-Za-z0-9_@]+)'\), t\('([A-Za-z0-9_@]+)', \[ctx\.title, label\]\)\)/.exec(script);
    assert(libraryState, 'Servarr library state should replace the stale Add accessible name');
    assert(messageCatalog[libraryState[1]]?.trim(), 'the library state needs a visible label');
    assert(/\$1/.test(messageCatalog[libraryState[2]] || ''),
        'its accessible name has to carry the title, not just the service');
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
    const missingGrant = hooks.describeRequestFailure('network', {
        errorType:'permission_not_granted',
        message:'Access to this service has not been granted',
    }, 'https://api.themoviedb.org/');
    assert.strictEqual(hooks.classifyFailure(missingGrant), 'permission',
        'a missing optional-origin grant is a refusal, not an outage');
    assert.strictEqual(hooks.isReachabilityFailure(missingGrant), false,
        'a grant refusal must not render a stale provider answer');
    assert.strictEqual(hooks.getRequestErrorMessage(missingGrant),
        'Access to this service has not been granted');
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
    const buttonText = [...body.matchAll(/\}, t\('([A-Za-z0-9_@]+)'\)\)/g)]
        .map(match => messageCatalog[match[1]] || '');
    assert(buttonText.filter(text => /loaded/i.test(text)).length >= 2,
        'the wording must not imply the whole season was touched');
    assert(/loaded/i.test(messageCatalog[/parts = \[t\('([A-Za-z0-9_@]+)'/.exec(script)?.[1]] || ''),
        'counts are over loaded rows');
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
    const rejected = /if \(!setUserMarks\(marks\)\) \{[\s\S]{0,220}?t\('([A-Za-z0-9_@]+)'\)/.exec(body);
    assert(rejected && /nothing was changed/i.test(messageCatalog[rejected[1]] || ''),
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
    const said = [...body.matchAll(/t\('([A-Za-z0-9_@]+)'/g)].map(match => messageCatalog[match[1]] || '');
    assert(said.some(text => text.includes('Nothing was opened.')), 'and it should say so');

    // Only rows the page is actually showing: a filtered-out row is not a candidate,
    // or the pick scrolls to something invisible.
    assert(body.includes('entry.card.offsetParent !== null'), 'a hidden row must not be picked');
    assert(body.includes('!entry.duplicate'), 'a title rendered twice must not be twice as likely');
    assert(/this\._skipMarked\.checked && marks\[entry\.id\]\?\.state/.test(body),
        'the option to skip already-marked titles must consult the marks');
    // Honest empty states rather than a silent no-op.
    const emptyStates = [...body.matchAll(/t\('([A-Za-z0-9_@]+)'\)/g)].map(match => messageCatalog[match[1]] || '');
    assert(emptyStates.includes('Nothing left that you have not already marked.'), 'an exhausted list must say so');
    assert(emptyStates.includes('No titles on this page to pick from.'), 'an empty list must say so');
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
    /* One per score widget, derived: a fixed number stops covering the next source
       someone adds, and says nothing at all when it does. */
    const scoreSources = Object.keys(loadScriptTestHooks().SCORE_WIDGET_IDS).length;
    assert.strictEqual((script.match(/await renderStaleScore\(this, cacheKey, lookupError, isCurrent\)/g) || []).length, scoreSources,
        'every score source must offer the fallback');
    assert.strictEqual((script.match(/\} catch \{ \/\* handled below \*\/ \}/g) || []).length, 0,
        'the failure must be captured, not discarded, or its kind cannot be judged');
    const helper = script.slice(script.indexOf('function renderStaleScore'));
    assert(helper.includes("new Date(stale.ts).toISOString().slice(0, 10)"), 'the fallback must show its date');
    const cachedNote = /t\('([A-Za-z0-9_@]+)', \[date\]\)/.exec(helper);
    assert(cachedNote && /^cached /i.test(messageCatalog[cachedNote[1]] || ''),
        'the fallback must say it is cached');
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
    assert.strictEqual((script.match(/this\._renderUnavailable\(blocked \? 'access' : 'unavailable'\)/g) || []).length, scoreSources,
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
    assert.strictEqual(record.v, hooks.USER_MARK_RECORD_VERSION, 'mark records must carry their version');

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
    const metadataRow = row('8.7');
    metadataRow.querySelectorAll = () => [
        { textContent:'1999' },
        { textContent:'2h 16m' },
        { textContent:'R' },
    ];
    assert.deepStrictEqual({ ...hooks.readCardMarkMetadata(metadataRow, 'tt0133093') }, {
        year:1999,
        imdbRating:8.7,
        runtime:136,
    }, 'marking a collection card should cache the metadata IMDb already rendered');

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
    /* One per score widget plus the TMDB failure branch, which is the second way the
       availability widget can give up. Provider failures must pass the error so an
       authentication refusal cannot become a 24-hour unavailable answer. An empty TMDB
       region stores its structured source-and-region answer directly, so it does not go
       through the failure-only helper. Derived, so the next source someone adds is
       covered instead of silently exempt. */
    const guardedLookups = Object.keys(loadScriptTestHooks().SCORE_WIDGET_IDS).length + 1;
    assert.strictEqual((script.match(/cacheUnavailableUnlessBlocked\(this\.key, cacheKey(?:, (?:lookupError|tmdbError))?\)/g) || []).length, guardedLookups,
        'every score and availability lookup must use the guarded form');
    assert.strictEqual((script.match(/cacheUnavailableUnlessBlocked\(this\.key, cacheKey, lookupError\)/g) || []).length, guardedLookups - 1,
        'each ordinary provider failure must pass its real error to the cache guard');
    assert.strictEqual((script.match(/cacheUnavailableUnlessBlocked\(this\.key, cacheKey, tmdbError\)/g) || []).length, 1,
        'the TMDB failure must pass its real error to the cache guard');
    assert.strictEqual((script.match(/cacheUnavailableUnlessBlocked\(this\.key, cacheKey\)/g) || []).length, 0,
        'the failure-only guard must never be called without the provider error');
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
    /* Ambiguity is judged before anything is discarded. Filtering first let a malformed
       sibling be dropped rather than counted, so two answers became one and whichever id
       happened to parse was used. */
    assert.strictEqual(hooks.parseTmdbFind({ movie_results:[{ id:603 }, { id:'x' }] }), null,
        'two results are two results, even when one of them is malformed');
    assert.strictEqual(hooks.parseTmdbFind({ movie_results:[{ id:603 }], tv_results:[{ id:null }] }), null,
        'across the two arrays as well');
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
    /* IE-13: the three are different answers and the panel used to flatten them into one
       line, so a title you could rent but not stream read as unavailable. */
    assert.strictEqual(Array.from(us.offers.stream).join(', '), 'Max, Netflix, Tubi');
    assert.strictEqual(Array.from(us.offers.rent).join(', '), 'Apple TV');
    assert.strictEqual(Array.from(us.offers.buy).join(', '), 'Amazon Video');
    // One service offering a title three ways is one service, counted once.
    const everywhere = { results:{ US:{ link:'', flatrate:[{ provider_name:'Max' }], rent:[{ provider_name:'Max' }], buy:[{ provider_name:'Max' }] } } };
    const once = hooks.parseTmdbWatchProviders(everywhere, 'US');
    assert.strictEqual(Array.from(once.offers.stream).join(''), 'Max');
    assert.strictEqual(Array.from(once.offers.rent).length, 0, 'the same service is not listed twice');
    // A region with rent but no streaming is still an answer.
    const rentOnly = { results:{ US:{ link:'', rent:[{ provider_name:'Apple TV' }] } } };
    const parsedRentOnly = hooks.parseTmdbWatchProviders(rentOnly, 'US');
    assert.strictEqual(Array.from(parsedRentOnly.offers.stream).length, 0);
    assert.strictEqual(Array.from(parsedRentOnly.offers.rent).join(''), 'Apple TV');
    // Rendering another country's services as though they were yours is the failure here.
    assert.strictEqual(Array.from(hooks.parseTmdbWatchProviders(payload, 'FR').providers).join(', '), 'Canal+');
    assert.strictEqual(Array.from(hooks.parseTmdbWatchProviders(payload, 'DE').providers).length, 0,
        'a region TMDB knows nothing about is empty, not a fallback to another country');

    /* IE-118: when a film reached home is a question IMDb does not answer above the fold
       and TMDB does. Their type codes are documented: 4 digital, 5 physical. */
    const releasePayload = {
        id: 603,
        results: [
            { iso_3166_1:'US', release_dates: [
                { type:3, release_date:'1999-03-31T00:00:00.000Z' },
                { type:5, release_date:'1999-09-21T00:00:00.000Z' },
                { type:4, release_date:'2006-11-14T00:00:00.000Z' },
                // A re-release years later is not the answer to "when can I watch it".
                { type:4, release_date:'2020-05-01T00:00:00.000Z' },
            ] },
            { iso_3166_1:'FR', release_dates: [{ type:4, release_date:'2007-02-02T00:00:00.000Z' }] },
        ],
    };
    const usReleases = hooks.parseTmdbReleaseDates(releasePayload, 'US');
    assert.strictEqual(usReleases.digital, '2006-11-14', 'the earliest digital date, not the latest');
    assert.strictEqual(usReleases.physical, '1999-09-21');
    assert.strictEqual(hooks.parseTmdbReleaseDates(releasePayload, 'FR').physical, undefined,
        'a country with no disc date says nothing about one');
    assert.strictEqual(hooks.parseTmdbReleaseDates(releasePayload, 'DE'), null,
        'and a country TMDB knows nothing about is not answered from another one');
    assert.strictEqual(hooks.parseTmdbReleaseDates(
        { results:[{ iso_3166_1:'US', release_dates:[{ type:3, release_date:'1999-03-31' }] }] }, 'US'), null,
        'a theatrical date is not a release at home');
    assert.strictEqual(hooks.parseTmdbReleaseDates(
        { results:[{ iso_3166_1:'US', release_dates:[{ type:4, release_date:'not a date' }] }] }, 'US'), null,
        'and a date that is not one is dropped rather than rendered');
    [null, {}, { results:'nonsense' }].forEach(value =>
        assert.strictEqual(hooks.parseTmdbReleaseDates(value, 'US'), null, 'a broken payload is not an answer'));

    /* Movies only. There is no release_dates endpoint for a series, so nothing is asked
       for one, and the request rides on the same cached answer as the offers. */
    assert(/if \(found\.type === 'movie'\) \{/.test(script),
        'the release-date request must be asked only for a film');
    assert(/answer\.releases = releases;/.test(script),
        'and its answer must travel with the one that is already cached');

    /* IE-13: JustWatch keys its whole site by region, and every URL said /us whoever was
       asking. The same stored setting drives both sources; JustWatch wants it lowercase
       in the path, TMDB uppercase in its results. */
    hooks.seedStoredSetting('availabilityRegion', 'GB');
    assert(hooks.getJustWatchSearchUrl('The Matrix').startsWith('https://www.justwatch.com/gb/'),
        'the search URL must follow the chosen region');
    assert.strictEqual(hooks.getAvailabilityRegion(), 'GB', 'while TMDB gets it uppercase');
    hooks.seedStoredSetting('availabilityRegion', 'US');
    assert(hooks.getJustWatchSearchUrl('The Matrix').startsWith('https://www.justwatch.com/us/'),
        'and the default still works');
    // Said out loud rather than rendered as nothing, which read as broken.
    assert(script.includes('`Not streamable in ${region}`'),
        'a region with no offers must say so');
    /* Both paths reach it: a lookup that came back with nothing for this region, and a
       cached entry that turns out to hold nothing. Counted rather than matched once,
       because either alone satisfies a substring check while the other has regressed. */
    assert.strictEqual((script.match(/this\._renderUnavailable\('region',/g) || []).length, 2,
        'every path that finds no offers must say so rather than reporting a generic failure');
    assert(/\[\['Rent', rent\], \['Buy', buy\]\]/.test(script),
        'renting and buying must be listed apart from streaming');
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
    assert.strictEqual(hooks.getAvailabilityRegion(), 'US', 'an unset region defaults rather than sending nothing');
    hooks.seedStoredSetting('availabilityRegion', 'gb');
    assert.strictEqual(hooks.getAvailabilityRegion(), 'GB', 'a region is normalized, not passed through');
    hooks.seedStoredSetting('availabilityRegion', 'not a region');
    assert.strictEqual(hooks.getAvailabilityRegion(), 'US', 'nonsense falls back');
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
    /* The branch reads the effective source, not the stored preference. A build that
       cannot ship JustWatch would otherwise take the JustWatch branch and fail against an
       origin it does not have. It is still a choice, not a fallback order: the preference
       only gives way when this build cannot honour it at all. */
    assert(body.includes('const availabilitySource = getEffectiveAvailabilitySource()')
        && body.includes("if (availabilitySource === 'tmdb')"),
        'the source is a choice, but a build that cannot ship one must use the other');
    assert.strictEqual(hooks.getAvailabilitySource(), hooks.getEffectiveAvailabilitySource(),
        'where both sources are shippable the preference is honoured exactly');
    /* A token TMDB rejects is the one part of this the user can fix. Left to the generic
       path it read as "availability unavailable", which points at the wrong thing. */
    assert(body.includes("if (tmdbError?.tmdbRejected) { this._renderUnavailable('rejected'); return; }"),
        'a rejected token must be reported as a rejected token');
    assert(/status === 401 \|\| status === 403/.test(script), 'and recognized from what TMDB actually answers');
    const rejectedNote = /reason === 'rejected' \? t\('([A-Za-z0-9_@]+)'\) : t\('([A-Za-z0-9_@]+)'\)\)\);/.exec(script);
    assert(rejectedNote && /rejected/i.test(messageCatalog[rejectedNote[1]] || ''),
        'in words that say which end the problem is at');
    const rejectedAction = /reason === 'rejected' \? t\('([A-Za-z0-9_@]+)'\) : t\('([A-Za-z0-9_@]+)'\)\)\);/g;
    const actions = [...script.matchAll(rejectedAction)].map(match => [messageCatalog[match[1]], messageCatalog[match[2]]]);
    assert(actions.some(([replace, add]) => /replace/i.test(replace || '') && /add/i.test(add || '')),
        'and offer the action that matches');

    /* The region was read but never declared, so "your region" was permanently US and the
       setting could not be exported, imported, or changed. */
    assert.strictEqual(hooks.DEFAULTS.availabilityRegion, 'US', 'the region must be a real setting');
    assert(script.includes("key:'availabilityRegion',"), 'and have a control that sets it');
    hooks.seedStoredSetting('availabilityRegion', 'GB');
    const gbPayload = { results:{ US:{ link:'', flatrate:[{ provider_name:'Max' }] }, GB:{ link:'', flatrate:[{ provider_name:'Now' }] } } };
    assert.strictEqual(Array.from(hooks.parseTmdbWatchProviders(gbPayload, hooks.getAvailabilityRegion()).providers).join(''), 'Now',
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

/* The store-profile exclusion message, asserted by running the transformed script rather
   than by reading the source. The settings-row half of this lives in the happy-dom suite,
   which skips itself wholesale on a checkout without the optional DOM package; this half
   runs everywhere. */
test('a store build names the source it cannot ship', () => {
    const hooks = loadScriptTestHooks({ storeProfile:true });
    assert.strictEqual(hooks.featureExcludedByProfile('inlineLetterboxdScore'), true,
        'a feature whose only source is read by parsing a page is not in a store build');
    assert.strictEqual(hooks.describeProfileExclusion('inlineLetterboxdScore'),
        'Not available in this build (Letterboxd)');
    assert.strictEqual(hooks.featureExcludedByProfile('streamAvailability'), false,
        'availability still has a source there, so it is a grant question rather than an exclusion');
    assert.deepStrictEqual(Array.from(hooks.getFeatureOrigins('streamAvailability')),
        ['https://api.themoviedb.org/*'],
        'and it asks only for the origin that build can use');

    /* Rotten Tomatoes and Metacritic are not excluded there any more: OMDb answers both
       from an API, so the store build asks for OMDb's origin and nothing else for them. */
    assert.strictEqual(hooks.featureExcludedByProfile('inlineRTScore'), false,
        'a store build has an OMDb-backed source for Rotten Tomatoes');
    assert.deepStrictEqual(Array.from(hooks.getFeatureOrigins('inlineRTScore')).sort(),
        ['https://query.wikidata.org/*', 'https://www.omdbapi.com/*'],
        'and it never asks for the page it cannot read');
    assert.deepStrictEqual(Array.from(hooks.getFeatureOrigins('inlineMetacriticScore')).sort(),
        ['https://query.wikidata.org/*', 'https://www.omdbapi.com/*']);

    // The ordinary build excludes nothing, or the assertions above prove only that the
    // transform ran.
    const normal = loadScriptTestHooks();
    assert.strictEqual(normal.featureExcludedByProfile('inlineLetterboxdScore'), false);
});

/* The metadata block is the userscript's host_permissions, and it was hand-kept beside a
   provider registry that already says which hosts get contacted. Two API providers were
   added to the registry and never to the header, so a script manager blocked or prompted
   for every request to them and the feature could not work at all. Derived from the
   registry here, in both directions: a host the code contacts must be declared, and a
   host that is declared must belong to something that contacts it. */
test('the userscript declares exactly the hosts its providers contact', () => {
    const hooks = loadScriptTestHooks();
    /* Every line in the block is a // line. A script manager reads the block as a run of
       them and what it does with anything else is undefined: a block comment explaining a
       @match line sat inside here, and a parser that stops at the first line it cannot
       read would have dropped every declaration after it. */
    const metadata = script.slice(script.indexOf('// ==UserScript=='),
        script.indexOf('// ==/UserScript==') + '// ==/UserScript=='.length).split('\n');
    assert(metadata.length > 40, 'the block should be the real one');
    metadata.forEach(line => assert(/^\/\/(\s|$)/.test(line.replace(/\r$/, '')),
        `the metadata block holds only // lines, not: ${line}`));
    const declared = [...script.matchAll(/^\/\/ @connect\s+(\S+)$/gm)].map(match => match[1]).sort();
    assert(declared.length >= 8, 'the metadata block must declare the hosts this script calls');
    const fromProviders = [...new Set(Object.values(hooks.PROVIDERS)
        .filter(provider => provider.transmits !== 'none')
        .flatMap(provider => provider.origins)
        .map(origin => origin.replace(/^https?:\/\//, '').replace(/\/\*$/, '').replace(/^\*\./, '')))];
    /* The loopback origins are four patterns for two hosts, and the ad hosts are blocked
       rather than called, so neither set maps one-to-one. Both are declared through the
       providers that do call them. */
    const localServiceHosts = ['localhost', '127.0.0.1'];
    const expected = [...new Set([...fromProviders, ...localServiceHosts])].sort();
    assert.deepStrictEqual(declared, expected,
        'every host a provider contacts must be declared, and nothing else may be');
});

/* IE-86: one catalog, and a lookup that has to answer the same way in a userscript with
   no i18n API, in an extension with one, and in a locale that carries only some of the
   keys. */
test('a message resolves through the catalog and falls back to English', () => {
    const hooks = loadScriptTestHooks();
    const grantKey = messageKeyFor('Grant site access on the page that just opened, then reload this one.');
    assert.strictEqual(hooks.t(grantKey),
        'Grant site access on the page that just opened, then reload this one.');
    // Positional substitutions, the shape chrome.i18n.getMessage takes.
    const clearedKey = messageKeyFor('Cleared $1 saved title marks');
    assert.strictEqual(hooks.t(clearedKey, [12]), 'Cleared 12 saved title marks');
    assert.strictEqual(hooks.t(clearedKey, 12), 'Cleared 12 saved title marks',
        'a single substitution need not be wrapped in an array');
    // A key nothing carries reports itself rather than rendering an empty control.
    assert.strictEqual(hooks.t('no_such_message_key'), 'no_such_message_key');

    /* Every key is reachable and every message is a non-empty string a translator can
       work with. A blank entry is a control with no label. */
    Object.entries(hooks.MESSAGES).forEach(([key, text]) => {
        assert(/^[A-Za-z0-9_@]+$/.test(key), `message key ${key} uses characters chrome.i18n rejects`);
        assert(typeof text === 'string' && text.trim(), `message ${key} has no text`);
        assert.strictEqual(hooks.t(key).length > 0, true);
    });

    /* Every key the code asks for exists, and every key the catalog carries is asked for.
       An orphan in either direction is a string nobody sees or a control with no words. */
    /* The catalog serves the userscript and the extension's own pages, so an entry only
       one of them asks for is not an orphan. The recovery page reaches the lookup through
       the hook and the permissions popup goes straight to chrome.i18n; both write the key
       as a literal, which is the whole reason this check can be exact. */
    const asking = [script, ...MESSAGE_CONSUMERS.map(file => fs.readFileSync(file, 'utf8'))].join('\n');
    const requested = new Set([...asking.matchAll(/\bt\('([A-Za-z0-9_@]+)'/g)].map(match => match[1]));
    /* The worker has no t(): it goes straight to chrome.i18n, which reads the same
       generated _locales, so a key it asks for that way is asked for. */
    [...asking.matchAll(/getMessage\??\.?\('([A-Za-z0-9_@]+)'/g)].forEach(match => requested.add(match[1]));
    taggedPageCopy().forEach(entry => requested.add(entry.key));
    const declared = new Set(Object.keys(hooks.MESSAGES));
    const missing = [...requested].filter(key => !declared.has(key));
    assert.deepStrictEqual(missing, [], 'the code asks for messages the catalog does not carry');
    const countKeys = new Set([...asking.matchAll(/\btCount\('([A-Za-z0-9_@]+)'/g)]
        .flatMap(match => [`${match[1]}_one`, `${match[1]}_other`]));
    const unused = [...declared].filter(key => !requested.has(key) && !countKeys.has(key));
    assert.deepStrictEqual(unused, [], 'the catalog carries messages nothing asks for');
});

/* In an extension build the lookup goes to chrome.i18n first, and what it does with the
   answer decides whether an installed translation is honoured and whether a locale that
   is missing a key silently blanks the control. */
test('an extension build reads the installed locale and falls back deterministically', () => {
    const asked = [];
    const translatedKey = messageKeyFor('Grant site access on the page that just opened, then reload this one.');
    const untranslatedKey = messageKeyFor('Cleared $1 saved title marks');
    const hooks = loadScriptTestHooks({
        extensionI18n: {
            getMessage(key, substitutions) {
                asked.push([key, substitutions]);
                if (key === translatedKey) return 'ZUGRIFF GEWAEHREN';
                return '';
            },
        },
    });
    /* Provider consent and feature copy are resolved while the script evaluates, so the
       lookup is used before this test asks for anything. Reading a call by position was
       reading whichever key the source happened to resolve first; what the assertion is
       about is the arguments a given key arrives with. */
    const callFor = key => {
        const call = asked.find(([asked_key]) => asked_key === key);
        assert(call, `getMessage was never asked for ${key}`);
        return Array.from(call).map(part => (Array.isArray(part) ? Array.from(part) : part));
    };
    assert.strictEqual(hooks.t(translatedKey), 'ZUGRIFF GEWAEHREN',
        'an installed translation must win over the embedded English');
    assert.deepStrictEqual(callFor(translatedKey), [translatedKey, []]);
    assert.strictEqual(hooks.t(untranslatedKey, [3]), 'Cleared 3 saved title marks',
        'a key the locale does not carry falls back to English, substitutions and all');
    assert.deepStrictEqual(callFor(untranslatedKey), [untranslatedKey, ['3']],
        'substitutions reach getMessage as strings, which is what it accepts');
});

/* The settings panel is where most of the words are, and they came from three data
   tables rather than from call sites: every feature's name and description, and every
   provider's consent sentence. A key that resolves to itself is the failure this catches
   — a settings row labelled "feature_removeAds_name" is worse than the English it
   replaced, and nothing else in the suite would notice. Checked in both directions so a
   renamed feature cannot leave its sentences behind in the catalog either. */
test('every feature and provider gets its words from the catalog', () => {
    const hooks = loadScriptTestHooks();
    const declared = new Set(Object.keys(hooks.MESSAGES));
    const expected = new Set();

    /* One feature needs a background worker, so the userscript does not register it and
       its words are still shipped for the build that does. Named, rather than excusing
       everything in FEATURE_DETAILS: that seeded the set this check compares against and
       left it unable to notice a feature that had stopped being registered at all. */
    const EXTENSION_ONLY_FEATURES = ['watchlistAlerts'];
    EXTENSION_ONLY_FEATURES.forEach(key => {
        assert(hooks.FEATURE_DETAILS[key], `${key} is named here but has no description`);
        expected.add(`feature_${key}_name`);
        expected.add(`feature_${key}_detail`);
    });
    hooks.getFeatureNames().forEach(([key, name]) => {
        expected.add(`feature_${key}_name`);
        expected.add(`feature_${key}_detail`);
        assert(declared.has(`feature_${key}_name`), `${key} has no catalog entry for its label`);
        assert(declared.has(`feature_${key}_detail`), `${key} has no catalog entry for its description`);
        // t returns the key itself when nothing carries it, which is what a broken lookup shows.
        assert.notStrictEqual(name, `feature_${key}_name`, `${key} renders its own catalog key as a label`);
        assert(name && name.trim(), `${key} has no label`);
        assert.notStrictEqual(hooks.FEATURE_DETAILS[key], `feature_${key}_detail`,
            `${key} renders its own catalog key as a description`);
    });

    Object.entries(hooks.PROVIDERS).forEach(([id, provider]) => {
        expected.add(`provider_${id}_consent`);
        assert(declared.has(`provider_${id}_consent`), `${id} has no catalog entry for its consent line`);
        assert.notStrictEqual(provider.consent, `provider_${id}_consent`,
            `${id} shows its own catalog key where the consent sentence belongs`);
        /* Almost every label is a brand name a translator must leave exactly as it is, so
           only the ones that are a description of something get a catalog entry. */
        if (declared.has(`provider_${id}_label`)) {
            expected.add(`provider_${id}_label`);
            assert.notStrictEqual(provider.label, `provider_${id}_label`,
                `${id} shows its own catalog key where its name belongs`);
        }
        /* An empty attribution means the provider asks for no credit. One that asks for
           credit has to say so in the catalog like everything else. */
        if (provider.attribution) {
            expected.add(`provider_${id}_attribution`);
            assert(declared.has(`provider_${id}_attribution`), `${id} has no catalog entry for its credit line`);
            assert.notStrictEqual(provider.attribution, `provider_${id}_attribution`,
                `${id} shows its own catalog key where the credit line belongs`);
        }
    });

    const stranded = [...declared]
        .filter(key => /^(feature|provider)_/.test(key) && !expected.has(key));
    assert.deepStrictEqual(stranded, [],
        'the catalog carries feature or provider text for something that no longer exists');
});

/* The recovery page keeps its English in the markup on purpose: it exists to be usable
   when the settings layer will not load, and in that state nothing runs to fill anything
   in. That makes the same sentence exist twice, so the two are held in step here rather
   than left to drift — and the page must actually refill them when it can. */
test('the extension pages and the catalog carry the same words', () => {
    const tagged = taggedPageCopy();
    assert(tagged.length >= 20, 'the recovery page copy should be tagged for translation');
    tagged.forEach(entry => {
        assert(messageCatalog[entry.key] !== undefined,
            `${entry.file} names ${entry.key}, which the catalog does not carry`);
        assert.strictEqual(messageCatalog[entry.key], entry.text,
            `${entry.file} and the catalog disagree about ${entry.key}`);
    });

    MESSAGE_PAGE_SCRIPTS.forEach(file => {
        assert(/document\.querySelectorAll\('\[data-i18n\]'\)/.test(fs.readFileSync(file, 'utf8')),
            `${path.basename(file)} has to refill its tagged copy from the catalog, or tagging it changes nothing`);
    });
});

/* The permissions popup is its own document with no access to the userscript's closure,
   so it reads the catalog straight from the i18n API. Run it against a stub and watch what
   it asks for: a page that merely carries data-i18n attributes and never consults the API
   looks identical in the source and shows English to everyone. */
test('the permissions popup fills its copy from the installed locale', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'extension', 'permissions.js'), 'utf8');
    const asked = [];
    const element = (id, i18n) => ({
        id,
        dataset: i18n ? { i18n } : {},
        textContent: 'ORIGINAL',
        disabled: false,
        addEventListener() {},
    });
    const grant = element('grant', 'permissions_grant_site_access');
    const tagged = [grant, element('title-line', 'permissions_page_title')];
    const byId = {
        state: element('state'),
        'state-text': element('state-text'),
        detail: element('detail'),
        grant,
    };
    const documentStub = {
        documentElement: { lang:'en' },
        getElementById: id => byId[id],
        querySelectorAll: selector => (selector === '[data-i18n]' ? tagged : []),
    };
    const chromeStub = {
        i18n: {
            getMessage(key) { asked.push(key); return `[${key}]`; },
            getUILanguage() { return 'de'; },
        },
        runtime: { getManifest: () => ({ host_permissions:[] }) },
        permissions: { contains: (_options, callback) => { callback(true); } },
    };
    vm.runInNewContext(source, { document:documentStub, chrome:chromeStub, console });

    assert(asked.includes('permissions_grant_site_access'),
        'the popup must ask the i18n API for its copy rather than shipping English only');
    assert.strictEqual(tagged[1].textContent, '[permissions_page_title]',
        'and put the answer back into the element it tagged');
    assert.strictEqual(documentStub.documentElement.lang, 'de',
        'the document has to declare the language it is actually showing');
});

/* The gate. Everything above says the catalog works; this says nothing is left outside
   it. It tokenizes the source — properly, because the first version of this check split
   lines on a regex and a three-character literal like 'div' desynchronised every quote
   after it — and reports any string that reads like something a person is shown and is
   not on its way through t().

   Adding a hard-coded sentence to a feature is what this catches, months from now, when
   nobody remembers the rule. The exclusions are named individually below and each one is
   a decision rather than a rule. */
const readableStrings = source => {
    const found = [];
    let index = 0;
    let line = 1;
    const isEscaped = position => {
        let slashes = 0;
        while (position - slashes - 1 >= 0 && source[position - slashes - 1] === '\\') slashes += 1;
        return slashes % 2 === 1;
    };
    while (index < source.length) {
        const ch = source[index];
        if (ch === '\n') { line += 1; index += 1; continue; }
        if (ch === '/' && source[index + 1] === '/') {
            while (index < source.length && source[index] !== '\n') index += 1;
            continue;
        }
        if (ch === '/' && source[index + 1] === '*') {
            index += 2;
            while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
                if (source[index] === '\n') line += 1;
                index += 1;
            }
            index += 2;
            continue;
        }
        if (ch === "'" || ch === '"') {
            const openedAt = index;
            const openLine = line;
            index += 1;
            while (index < source.length) {
                if (source[index] === '\n') break;
                if (source[index] === ch && !isEscaped(index)) break;
                index += 1;
            }
            if (source[index] === ch) {
                found.push({
                    line: openLine,
                    text: source.slice(openedAt + 1, index).replace(/\\'/g, "'").replace(/\\"/g, '"'),
                    before: source.slice(Math.max(0, openedAt - 60), openedAt),
                    after: source.slice(index + 1, index + 3),
                });
                index += 1;
            }
            continue;
        }
        /* Template literals are read for their attribute values and text nodes rather
           than as one string, because that is what the score widgets build markup with. */
        if (ch === '`') {
            const openLine = line;
            const start = index;
            index += 1;
            while (index < source.length && !(source[index] === '`' && !isEscaped(index))) {
                if (source[index] === '\n') line += 1;
                index += 1;
            }
            const body = source.slice(start + 1, index);
            index += 1;
            [
                ...body.matchAll(/(?:aria-label|title|placeholder|alt)="([^"${}]*)"/g),
                ...body.matchAll(/>([^<>${}]+)</g),
            ].forEach(match => found.push({ line:openLine, text:match[1].trim(), before:'`markup`', after:'' }));
            /* And the plain kind: the chunks between its substitutions are the sentence
               someone reads, so they are judged by where the literal itself sits. */
            if (!/[<>]/.test(body)) {
                body.split(/\$\{[^{}]*\}/).forEach(chunk => found.push({
                    line: openLine,
                    text: chunk.trim(),
                    before: source.slice(Math.max(0, start - 60), start),
                    after: '',
                }));
            }
            continue;
        }
        index += 1;
    }
    return found;
};

test('every sentence in the source comes from the catalog', () => {
    /* A name is a name in every language. */
    const BRANDS = new Set([
        'IMDb', 'IMDb Enhanced', 'Rotten Tomatoes', 'Metacritic', 'Letterboxd', 'JustWatch',
        'TMDB', 'OMDb', 'YouTube', 'Wikidata', 'Plex', 'Jellyfin', 'Emby', 'Radarr', 'Sonarr',
        'Overseerr', 'AniList', 'ANILIST', 'RT', 'LB', 'MC', 'AL', 'TOMATOMETER', 'LETTERBOXD', 'METASCORE', 'SERVARR',
        'Box Office Mojo', 'Ep Calendar', 'Box Office',
    ]);
    /* Named one at a time, because each is a reason rather than a rule. */
    const DELIBERATE = new Map([
        ['add to watch', "IMDb's own control text, matched against the page"],
        ['watch list', "IMDb's own control text, matched against the page"],
        ['watchlist', "IMDb's own control text, matched against the page"],
        ['Bottom Sponsored Advertisement', "IMDb's own aria-label, matched as a selector"],
        ['Sponsored Content', "IMDb's own aria-label, matched as a selector"],
        ['Route changed', 'an abort reason carried inside an error, never shown as itself'],
        ['Unknown error', 'written into a stored journal entry, which keeps its own locale'],
        ['IMDb Enhanced diagnostics', 'a bug report, read by whoever receives it'],
        ['not configured', 'part of that same report'],
        ['configured', 'part of that same report'],
        ['unknown', 'part of that same report'],
        ['accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
            'an iframe allow list, which is syntax'],
    ]);

    /* What position a string is in decides whether anyone reads it. These are the ones
       that reach a person: an element's text, a label, a title, an accessible name, a
       toast, a status line. A selector, a key, a class name and a URL are none of them. */
    const SHOWN = /(?:\b(?:label|title|placeholder|alt)\s*:\s*|textContent\s*=\s*|setTextIfChanged\([^,]+,\s*|showToast\(\s*|say\(\s*|setAttribute\('aria-label',\s*|'aria-label'\s*:\s*|make(?:Card|FeatureCard|FeatureSummaryCard)\(\s*|register\(\s*|\}, )$/;

    const readsLikeSomethingShown = text => {
        if (!text || text.length < 3) return false;
        if (BRANDS.has(text) || DELIBERATE.has(text)) return false;
        if (!/[A-Za-z]{2}/.test(text)) return false;
        if (/^https?:|^\/|^#|^\.|^--|^[a-z-]+\/[a-z-]+$/.test(text)) return false;
        // A selector, a class, a data attribute, a CSS value, a storage key.
        if (/[[\]{}<>=~^]|\bpx\b|\brem\b|^[a-z]+(-[a-z0-9]+)+$|^[a-z]+([A-Z][a-z0-9]*)+$/.test(text)) return false;
        if (/^[a-z]+$/.test(text) && !/\s/.test(text)) return false;
        return true;
    };

    const sources = [
        ['IMDb_Enhanced.user.js', script],
        ...MESSAGE_CONSUMERS.map(file => [path.basename(file), fs.readFileSync(file, 'utf8')]),
    ];

    const stranded = [];
    sources.forEach(([name, source]) => {
        const lines = source.split('\n');
        /* The watch destinations and the FMHY catalog are several hundred service names,
           and a service is called what it is called everywhere. */
        const sitesStart = lines.findIndex(line => line.includes('const DEFAULT_WATCH_SITES = ['));
        const sitesEnd = lines.findIndex(line => line.includes('const CATALOG_ROW_COLORS = ['));
        const catalogStart = lines.findIndex(line => line.includes('const MESSAGES = Object.freeze({'));
        const catalogEnd = lines.findIndex((line, index) => index > catalogStart && /^    \}\);$/.test(line));
        readableStrings(source).forEach(entry => {
            if (catalogStart >= 0 && entry.line > catalogStart && entry.line <= catalogEnd + 1) return;
            if (sitesStart >= 0 && entry.line > sitesStart && entry.line <= sitesEnd + 1) return;
            if (!readsLikeSomethingShown(entry.text)) return;
            if (entry.after.startsWith(':')) return;
            if (entry.before !== '`markup`' && !SHOWN.test(entry.before)) return;
            stranded.push(`${name}:${entry.line}: ${entry.text}`);
        });
    });
    assert.deepStrictEqual(stranded, [],
        'these words are written where they are shown instead of coming from the catalog');

    /* The other half of the same rule. Choosing a noun or a verb with a ternary produces
       correct English and nothing else: how many forms a count has, and which words
       change, belong to the language. tCount and a pair of keys, every time. */
    const pluralByTernary = sources.flatMap(([name, source]) =>
        [...source.matchAll(/=== 1 \? '[^']+' : '[^']+'/g)]
            .map(match => `${name}: ${match[0]}`)
            .filter(found => !found.endsWith("=== 1 ? '_one' : '_other'")));
    assert.deepStrictEqual(pluralByTernary, [],
        'a count-dependent sentence needs tCount and its _one/_other keys, not a ternary');

    /* An error this script raises carries its own category. The classifier can fall back
       to reading English out of a message, which is right for one the browser raised and
       wrong for one of ours: our words come from the catalog, so under another locale
       they are simply not the words it matches on, and the category is stored. */
    const untypedThrows = [...script.matchAll(/new Error\(t(?:Count)?\('([A-Za-z0-9_@]+)'/g)]
        .map(match => match[1]);
    assert.deepStrictEqual(untypedThrows, [],
        'a failure raised with catalog text must declare its category through failure()');
});

/* The one rule that keeps translation from changing behaviour: nothing decides what to do
   by matching text a person reads. */
test('no route or selector logic matches a translated string', () => {
    const catalogText = new Set(Object.values(messageCatalog));
    const compared = [...script.matchAll(/(?:textContent|innerText|label|title)\s*===\s*'([^']+)'/g)]
        .map(match => match[1]);
    compared.forEach(text => {
        assert(!catalogText.has(text), `code compares against the displayed string: ${text}`);
    });
    // Route detection reads IMDb's own test ids and paths, never words.
    assert(!/getPageSurface[\s\S]{0,600}textContent/.test(script),
        'route classification must not read displayed text');
});

/* IE-110: OMDb answers Rotten Tomatoes and Metacritic for one IMDb id in a single call.
   Their Ratings array names its sources and omits the ones it has nothing for, so it is
   read by name and every shape it can take has to survive that. */
test('OMDb ratings are read by source name and bounded', () => {
    const hooks = loadScriptTestHooks();
    const full = hooks.parseOmdbRatings({
        Response:'True',
        Metascore:'73',
        Ratings:[
            { Source:'Internet Movie Database', Value:'8.7/10' },
            { Source:'Rotten Tomatoes', Value:'83%' },
            { Source:'Metacritic', Value:'73/100' },
        ],
    });
    assert.strictEqual(full.rt, 83);
    assert.strictEqual(full.metacritic, 73);

    // Position is not identity: the array order is theirs and it changes.
    const reordered = hooks.parseOmdbRatings({
        Ratings:[{ Source:'Metacritic', Value:'40/100' }, { Source:'Rotten Tomatoes', Value:'12%' }],
    });
    assert.strictEqual(reordered.rt, 12);
    assert.strictEqual(reordered.metacritic, 40);

    // A source they have nothing for is simply absent from the array.
    const noRT = hooks.parseOmdbRatings({ Ratings:[{ Source:'Metacritic', Value:'55/100' }] });
    assert.strictEqual(noRT.rt, null, 'an absent source is absent, not zero');
    assert.strictEqual(noRT.metacritic, 55);
    // Metascore is the same number by another name, and it is there when the array is not.
    assert.strictEqual(hooks.parseOmdbRatings({ Metascore:'64', Ratings:[] }).metacritic, 64);
    assert.strictEqual(hooks.parseOmdbRatings({ Metascore:'N/A', Ratings:[] }).metacritic, null,
        'their placeholder for "no score" is a string, not a number');

    // Their own error envelope, and everything that is not an answer at all.
    assert.strictEqual(hooks.parseOmdbRatings({ Response:'False', Error:'Invalid API key!' }), null);
    assert.strictEqual(hooks.parseOmdbRatings(null), null);
    assert.strictEqual(hooks.parseOmdbRatings('not an object'), null);
    assert.strictEqual(hooks.parseOmdbRatings({ Ratings:'not an array' }).rt, null);
    // Values outside the scale are not scores.
    assert.strictEqual(hooks.parseOmdbRatings({ Ratings:[{ Source:'Rotten Tomatoes', Value:'830%' }] }).rt, null);
    assert.strictEqual(hooks.parseOmdbRatings({ Ratings:[{ Source:'Rotten Tomatoes', Value:'8.3/10' }] }).rt, null,
        'a value in another scale is not a percentage');
});

/* The origin is asked for only where OMDb can actually answer: a build without the page
   parser, or an install that entered a key. Otherwise it would be consent for a service
   that is never called. */
test('OMDb is asked for only where it is the source', () => {
    const hooks = loadScriptTestHooks();
    assert.strictEqual(hooks.isOmdbConfigured(), false);
    assert.deepStrictEqual(
        Array.from(hooks.getFeatureOrigins('inlineRTScore')).sort(),
        ['https://query.wikidata.org/*', 'https://www.rottentomatoes.com/*'],
        'an install with no OMDb key must not be asked for OMDb access');
    assert.strictEqual(hooks.describeFeatureOrigins('inlineRTScore'), 'Rotten Tomatoes and Wikidata');

    hooks.seedStoredSetting('omdbApiKey', 'a-key');
    assert.strictEqual(hooks.isOmdbConfigured(), true);
    assert.deepStrictEqual(
        Array.from(hooks.getFeatureOrigins('inlineRTScore')).sort(),
        ['https://query.wikidata.org/*', 'https://www.omdbapi.com/*', 'https://www.rottentomatoes.com/*'],
        'a stored key makes OMDb a source this feature may use');
    assert.deepStrictEqual(
        Array.from(hooks.getFeatureOrigins('inlineMetacriticScore')).sort(),
        ['https://backend.metacritic.com/*', 'https://query.wikidata.org/*', 'https://www.omdbapi.com/*']);
    // A feature OMDb cannot answer for is unaffected either way.
    assert.deepStrictEqual(
        Array.from(hooks.getFeatureOrigins('inlineLetterboxdScore')).sort(),
        ['https://letterboxd.com/*', 'https://query.wikidata.org/*']);
});

/* IE-101: a guard the suite could not tell was there. Availability declares two sources
   but contacts one, and the narrowing that expresses that was asserted only as source
   text. Deleting it left every check green while the build asked for consent to an origin
   it never calls. */
test('availability asks for the origin of the source it will actually use', () => {
    const hooks = loadScriptTestHooks();
    hooks.seedStoredSetting('availabilitySource', 'justwatch');
    assert.deepStrictEqual(Array.from(hooks.getFeatureOrigins('streamAvailability')), ['https://www.justwatch.com/*'],
        'the unchosen source must not be requested');
    assert.strictEqual(hooks.describeFeatureOrigins('streamAvailability'), 'JustWatch',
        'and the settings row must name one service, not both');
    assert.strictEqual(hooks.describeFeatureConsent('streamAvailability').length, 1,
        'consent covers what is actually contacted');

    hooks.seedStoredSetting('availabilitySource', 'tmdb');
    assert.deepStrictEqual(Array.from(hooks.getFeatureOrigins('streamAvailability')), ['https://api.themoviedb.org/*'],
        'switching source switches which origin is asked for');
    assert.strictEqual(hooks.describeFeatureOrigins('streamAvailability'), 'TMDB');

    /* Every other feature keeps all of its declared providers: the narrowing is specific
       to availability, where the two sources answer the same question. */
    assert.deepStrictEqual(
        Array.from(hooks.getFeatureOrigins('inlineRTScore')).sort(),
        ['https://query.wikidata.org/*', 'https://www.rottentomatoes.com/*'],
        'a feature whose providers are used together keeps all of them');
});

/* IE-92: a build may exclude a provider, and the features that depended on it have to say
   so rather than blaming something else. Getting this wrong once already: counting the
   Wikidata resolver as a reason Rotten Tomatoes still worked meant the widget reported a
   missing host grant for something the build itself had decided. */
test('a provider a build excludes is reported as excluded, not as something else', () => {
    const hooks = loadScriptTestHooks();

    // In this build nothing is excluded, so nothing may claim to be.
    ['inlineRTScore', 'inlineMetacriticScore', 'inlineLetterboxdScore', 'streamAvailability'].forEach(key => {
        assert.strictEqual(hooks.featureExcludedByProfile(key), false,
            `${key} must not report itself excluded from the build that ships it`);
    });
    assert.strictEqual(hooks.providerAllowedHere('rottenTomatoes'), true);
    assert.strictEqual(hooks.providerAllowedHere('tmdb'), true);

    /* The distinction the store profile turns on. An auxiliary provider makes a lookup
       faster; it never makes one possible, so it cannot stand in for the site whose score
       is being shown. */
    const registry = hooks.PROVIDERS;
    assert.strictEqual(registry.wikidata.auxiliary, true, 'the id resolver is auxiliary');
    ['rottenTomatoes', 'metacritic', 'letterboxd', 'justWatch', 'tmdb'].forEach(id => {
        assert(!registry[id].auxiliary, `${id} answers the question and cannot be auxiliary`);
    });
    /* Which providers a store build drops, read from the declarations rather than listed
       again: everything read by parsing someone's page, and nothing that is an API. */
    const storeExcluded = Object.keys(registry).filter(id => !registry[id].profiles.includes('store'));
    assert.deepStrictEqual(Array.from(storeExcluded).sort(),
        ['justWatch', 'letterboxd', 'metacritic', 'rottenTomatoes'],
        'a store build drops exactly the page-parsing providers');
    assert(registry.tmdb.profiles.includes('store'),
        'and keeps the API one, or availability has no source there at all');
    assert(registry.wikidata.profiles.includes('store') && registry.localServices.profiles.includes('store'),
        'a resolver and your own machine are shippable anywhere');

    // The exclusion names the source that is missing, not the resolver that is not.
    const described = hooks.describeProfileExclusion('inlineRTScore');
    assert(!/Wikidata/.test(described), 'an auxiliary provider is not why a feature is unavailable');
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
    /* Located by the key its label comes from, and bounded by the next command rather
       than by one named command, since the catalog does not fix their order. */
    const resetKey = messageKeyFor('Reset all settings (with undo)');
    const command = script.slice(script.indexOf(`register(t('${resetKey}')`));
    const body = command.slice(0, command.indexOf('register(', 10));
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
    assert(Number(floor) >= 22, 'the declared Node floor must not be an end-of-life release (Node 20 ended 2026-04-30)');
    /* npm writes the root engines block into the lockfile too, and only rewrites it on
       the next install. Committed and disagreeing is the state nothing else notices. */
    const lockfile = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
    assert.strictEqual(lockfile.packages?.['']?.engines?.node, declared,
        'the lockfile\'s copy of the Node floor must match package.json');
    const readmeFloor = /Install Node\.js (\d+) or newer/.exec(readme)?.[1];
    assert.strictEqual(readmeFloor, floor,
        `the README's Node floor (${readmeFloor}) must match package.json engines.node (${declared})`);

    /* The AMO validator's rules change between its own releases, so an unpinned run is
       not a repeatable result and "lints clean" stops meaning anything. web-ext is not a
       devDependency — the trust posture above keeps that list at one entry — so the pin
       lives in the documented invocation. */
    const unpinnedLinter = readme.match(/web-ext(?!@\d)/g) || [];
    assert.deepStrictEqual(unpinnedLinter, [],
        'every web-ext invocation the README documents must name the version it was run with');
    assert(/npx web-ext@\d+\.\d+\.\d+ lint/.test(readme),
        'the README must document how the Firefox build is linted');
    // The Firefox build declares optional website content; claiming otherwise was false.
    assert(!/declares no data collection/.test(readme),
        'the README must not claim the Firefox build declares no data collection');

    /* The README named two destinations the code had already replaced, because both
       redirected onto a retired domain. A list written out by hand in prose drifts from
       the list in the code the moment either changes, so it is derived from the code. */
    const shippedDefaults = [...(/const DEFAULT_WATCH_SITES = \[([\s\S]*?)\n    \];/.exec(script)?.[1] || '')
        .matchAll(/name:'([^']+)'/g)].map(match => match[1]);
    assert(shippedDefaults.length >= 10, 'the default watch destinations must be readable from the source');
    const readmeDefaults = (/The defaults \(([^)]+)\)/.exec(readme)?.[1] || '').split(', ').filter(Boolean);
    assert.deepStrictEqual(readmeDefaults, shippedDefaults,
        'the README must name exactly the watch destinations the build ships, in the same order');

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
    assert(fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8').includes(`## ${metaVersion} (`),
        'CHANGELOG.md must carry an entry for the current version');
});

/* Encrypted-backup cases need real Web Crypto, which is promise-based, so they are
   collected and awaited after the synchronous suite rather than being fired off inside
   test() where a rejection would be swallowed and reported as a pass. */
const asyncTests = [];
function asyncTest(name, fn) { asyncTests.push({ name, fn }); }

/* IE-97: manager onload callbacks also carry HTTP failures. Treating every onload as a
   success left 500 responses unjournaled and let 401/403 responses become cached
   "unavailable" answers. Drive the actual rejection so returning the raw response fails. */
asyncTest('provider HTTP failures reject, classify, journal, and protect authentication retries', async () => {
    const hooks = loadScriptTestHooks();
    const rejectStatus = async (status, responseText = '') => {
        const pending = hooks.httpGet('https://www.rottentomatoes.com/m/http-status-test');
        const request = hooks.getCapturedRequests().at(-1);
        assert(request?.onload, 'the real request callback must be captured');
        request.onload({
            status,
            responseText,
            finalUrl:'https://www.rottentomatoes.com/m/http-status-test',
        });
        return pending.then(() => null, error => error);
    };

    const outage = await rejectStatus(500, JSON.stringify({ message:'Provider maintenance' }));
    assert(outage, 'HTTP 500 must reject rather than resolve a raw response');
    assert.strictEqual(hooks.classifyFailure(outage), 'http');
    assert.strictEqual(outage.status, 500);
    assert.strictEqual(hooks.isReachabilityFailure(outage), true,
        'server errors qualify for the bounded stale-value fallback');
    assert.strictEqual(hooks.getRequestErrorMessage(outage), 'Provider maintenance',
        'a concise JSON body must outrank the generic status');
    hooks.recordLookupFailure({ key:'inlineRTScore' }, outage);
    assert.strictEqual(hooks.getFailureJournal().at(-1)?.category, 'http',
        'the lookup journal must retain the HTTP category');

    const noBody = await rejectStatus(503, '<html>not JSON</html>');
    assert.strictEqual(hooks.getRequestErrorMessage(noBody), 'HTTP 503',
        'an unusable body must fall back to the status');

    const providerKeys = [
        'inlineRTScore',
        'inlineLetterboxdScore',
        'inlineMetacritic',
        'streamAvailability',
    ];
    for (const status of [401, 403]) {
        const refusal = await rejectStatus(status, '');
        assert(refusal, `HTTP ${status} must reject`);
        assert.strictEqual(hooks.classifyFailure(refusal), 'http');
        assert.strictEqual(hooks.isReachabilityFailure(refusal), false,
            `HTTP ${status} is not a reachability failure`);
        for (const featureKey of providerKeys) {
            const cacheKey = `auth_${featureKey}_${status}`;
            assert.strictEqual(
                await hooks.cacheUnavailableUnlessBlocked(featureKey, cacheKey, refusal),
                false,
                `HTTP ${status} must remain retryable for ${featureKey}`
            );
            assert.strictEqual(hooks.cacheGet(cacheKey), null,
                `HTTP ${status} must not cache unavailable for ${featureKey}`);
            assert(!hooks.getStorageKeys().includes(`cache_${cacheKey}`),
                `HTTP ${status} must not write a sentinel for ${featureKey}`);
        }
    }
});

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

/* IE-110: no key, no request. The same rule the TMDB adapter follows, and the same
   reason: a lookup that cannot be authenticated is a lookup not worth making. */
asyncTest('the OMDb adapter makes no request at all without a key', async () => {
    const hooks = loadScriptTestHooks();
    const before = hooks.getCapturedRequests().length;
    const outcome = await Promise.race([
        hooks.fetchOmdbRatings('tt0133093', () => true),
        new Promise(resolve => setImmediate(() => resolve({ reachedTheNetwork:true }))),
    ]);
    assert.strictEqual(outcome.unconfigured, true, 'a missing key must be reported, not attempted');
    assert.deepStrictEqual(Array.from(hooks.getCapturedRequests().slice(before)), [],
        'and nothing may leave before that is known');

    /* With a key the request goes to OMDb, carrying the IMDb id and nothing read off the
       page. Under a script manager the value is readable, so it rides on the URL here;
       the extension build sends only the reference, which tests/background.js covers. */
    hooks.seedStoredSetting('omdbApiKey', 'OMDB-KEY-VALUE');
    hooks.fetchOmdbRatings('tt0133093', () => true);
    const attempted = hooks.getCapturedRequests().slice(before);
    assert.strictEqual(attempted.length, 1, 'a stored key must actually be used');
    assert.strictEqual(attempted[0].url,
        'https://www.omdbapi.com/?i=tt0133093&apikey=OMDB-KEY-VALUE');
    assert.strictEqual(attempted[0].credentialQuery.ref, 'omdbApiKey',
        'and the reference travels too, for the build that cannot read the value');
    assert(!/The Matrix|1999/.test(String(attempted[0].url)),
        'only the id is sent, never the title read from the page');
});

/* A key their API refuses is the one part of this a person can fix, so it is reported as
   that rather than as the service being unavailable. */
asyncTest('an OMDb key the API refuses is reported as a refused key', async () => {
    const hooks = loadScriptTestHooks();
    hooks.seedStoredSetting('omdbApiKey', 'WRONG-KEY');
    const before = hooks.getCapturedRequests().length;
    const pending = hooks.fetchOmdbRatings('tt0133093', () => true);
    const sent = hooks.getCapturedRequests()[before];
    sent.onload({ status:401, responseText:'{"Response":"False","Error":"Invalid API key!"}', finalUrl:sent.url });
    assert.strictEqual((await pending).rejected, true);
});

/* A title OMDb has no Rotten Tomatoes entry for is a real answer, not a failure: the
   widget has to say the score is absent rather than sit on a loading state. */
asyncTest('an OMDb answer with no Rotten Tomatoes entry is still an answer', async () => {
    const hooks = loadScriptTestHooks();
    hooks.seedStoredSetting('omdbApiKey', 'OMDB-KEY-VALUE');
    const before = hooks.getCapturedRequests().length;
    const pending = hooks.fetchOmdbRatings('tt0133093', () => true);
    const sent = hooks.getCapturedRequests()[before];
    sent.onload({
        status:200,
        responseText:JSON.stringify({ Response:'True', Metascore:'73', Ratings:[{ Source:'Metacritic', Value:'73/100' }] }),
        finalUrl:sent.url,
    });
    const answer = await pending;
    assert.strictEqual(answer.rt, null);
    assert.strictEqual(answer.metacritic, 73);
    // One call, one cache entry, read by both widgets rather than fetched twice.
    assert.strictEqual(hooks.cacheGet('omdb_tt0133093').metacritic, 73);
    const second = await hooks.fetchOmdbRatings('tt0133093', () => true);
    assert.strictEqual(second.metacritic, 73);
    assert.strictEqual(hooks.getCapturedRequests().length, before + 1,
        'the second reader must use the cached answer, not a second lookup');
});

/* IE-110: the early return that stops a TMDB lookup before it starts. It was asserted
   only as source text, so deleting it kept the suite green while the adapter issued a
   request with no credential on it. */
asyncTest('the TMDB adapter makes no request at all without a token', async () => {
    const hooks = loadScriptTestHooks();
    hooks.seedStoredSetting('availabilitySource', 'tmdb');
    const before = hooks.getCapturedRequests().length;
    /* Raced against a turn of the loop: the sandbox never answers a request, so a build
       that got past the guard would hang rather than fail, and a hang reads as a broken
       harness rather than as the defect it is. */
    const outcome = await Promise.race([
        hooks.fetchTmdbAvailability('tt0133093', () => true),
        new Promise(resolve => setImmediate(() => resolve({ reachedTheNetwork:true }))),
    ]);
    assert.strictEqual(outcome.unconfigured, true,
        'an unconfigured token must be reported, not attempted');
    assert.deepStrictEqual(Array.from(hooks.getCapturedRequests().slice(before)), [],
        'and no request may leave before that is known');

    // With a token the same call does reach the network, or the check above proves nothing.
    hooks.seedStoredSetting('tmdbReadToken', 'a-token');
    hooks.fetchTmdbAvailability('tt0133093', () => true);
    const attempted = hooks.getCapturedRequests().slice(before);
    assert.strictEqual(attempted.length, 1, 'a configured token must actually be used');
    assert(String(attempted[0].url).startsWith('https://api.themoviedb.org/'),
        'and used against TMDB');
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
    assert(parsed.kdf.iterations >= 600000,
        'the key-derivation cost must meet the current OWASP floor for PBKDF2-SHA256');
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

/* Written by the build that derived at 310,000 iterations, kept verbatim. Raising the
   writer's cost must not strand a backup somebody already has, and the only way to know
   that is to open one rather than to re-encrypt with today's parameters and call it old. */
const LEGACY_KDF_ENVELOPE = Object.freeze({
    imdbEnhancedEncryptedBackup: 1,
    kdf: { name:'PBKDF2', hash:'SHA-256', iterations:310000, salt:'AxQlNkdYaXqLnK2+z+DxAg==' },
    cipher: { name:'AES-GCM', iv:'CyhFYn+cudbzEC1K' },
    ciphertext: 'lDREHVJD9ZVBugCjWFdNRJRdylpJdyzV5xmAXWKeD/zz/FBC+qAIka/VEpxpUeq/pXIHV+ztW958yUrRZJw8i26zkyM8MeRule8=',
});

asyncTest('a backup written at the old key-derivation cost still opens', async () => {
    const hooks = loadScriptTestHooks();
    assert.strictEqual(LEGACY_KDF_ENVELOPE.kdf.iterations, 310000,
        'the fixture must keep the old cost, or it proves nothing about compatibility');
    const opened = await hooks.readEncryptedBackup(LEGACY_KDF_ENVELOPE, 'legacy-310k-passphrase');
    assert.strictEqual(opened.radarrApiKey, 'legacy-radarr-key');
    assert.strictEqual(opened.themeVariant, 'oled');
    await assert.rejects(
        () => hooks.readEncryptedBackup(LEGACY_KDF_ENVELOPE, 'not-the-passphrase'),
        /Wrong passphrase|altered/i,
        'the old envelope is still authenticated, not merely readable');
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
