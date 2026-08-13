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

function loadScriptTestHooks() {
    const instrumented = script.replace(/\}\)\(\);\s*$/, `window.__enhTest = {
        normalizeIMDbProviderId,
        normalizeLookupTitle,
        parseIMDbTitleStructuredData,
        normalizeHistogramData,
        findHistogramData,
        collectProviderIds,
        mediaItemMatches,
        parseMediaServerItems,
        getLinkedTitleId,
        isIMDbHost,
        isCinebyHost,
        getPageSurface,
        shouldInitFeature,
        createFeatureGuard,
        advanceFeatureGeneration,
        normalizeUrlTemplate,
        normalizeTrustedUrl,
        normalizeSite,
        filterSitesForMediaType,
        boundedScore,
        parseRTSearchResult,
        parseRTDetailPage,
        parseLetterboxdDetailPage,
        selectMetacriticResult,
        parseJustWatchSearchResult,
        parseJustWatchIdentity,
        collectJustWatchProviderNames,
        buildListSearchEntries,
        getEnhancementScrollBehavior,
        getFocusableElements,
        prepareSettingsImport,
        applySettingsImport,
        storeCinebyQuery,
        takeCinebyQuery,
        cacheSet,
        cacheGet,
        getUserMarks,
        setUserMark,
        getSectionCollapseState,
        setSectionCollapsed,
        getDefaultSettingsEntries,
        mediaServerRequest,
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
    const sandboxValues = new Map();
    const sandboxRequests = [];
    let sandboxAbortedRequestCount = 0;
    const sandbox = {
        console: { ...console, warn: () => {} },
        URL,
        setTimeout: () => 0,
        clearTimeout: () => {},
        window: {
            location,
            addEventListener: () => {},
            matchMedia: () => ({ matches: prefersReducedMotion }),
        },
        location,
        document: {
            readyState: 'loading',
            body: {},
            documentElement: {},
            querySelector: () => null,
            querySelectorAll: () => [],
            dispatchEvent: () => true,
            createElement: tag => {
                if (tag !== 'textarea') return {};
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
            if (sandboxWriteCount === sandboxFailWriteAt) throw new Error('simulated settings write failure');
            sandboxValues.set(key, value);
        },
        GM_addStyle: () => {},
        GM_setClipboard: () => {},
        GM_xmlhttpRequest: options => {
            sandboxRequests.push(options);
            return { abort: () => { sandboxAbortedRequestCount += 1; } };
        },
        GM_listValues: () => [...sandboxValues.keys()],
        GM_deleteValue: key => { sandboxValues.delete(key); },
        GM_webRequest: rules => { sandbox.webRequestRules = rules; },
    };
    vm.runInNewContext(instrumented, sandbox, { filename: scriptPath });
    sandbox.window.__enhTest.getCapturedWebRequestRules = () => sandbox.webRequestRules || [];
    sandbox.window.__enhTest.getAbortedRequestCount = () => sandboxAbortedRequestCount;
    sandbox.window.__enhTest.setReducedMotion = value => { prefersReducedMotion = Boolean(value); };
    sandbox.window.__enhTest.seedStoredSetting = (key, value) => sandboxValues.set(`imdb_enh_${key}`, value);
    sandbox.window.__enhTest.seedRawStorage = (key, value) => sandboxValues.set(key, value);
    sandbox.window.__enhTest.getStoredSetting = key => sandboxValues.get(`imdb_enh_${key}`);
    sandbox.window.__enhTest.failSettingWriteAt = offset => { sandboxFailWriteAt = sandboxWriteCount + offset; };
    sandbox.window.__enhTest.getStorageKeys = () => [...sandboxValues.keys()];
    sandbox.window.__enhTest.getCapturedRequests = () => [...sandboxRequests];
    return sandbox.window.__enhTest;
}

test('userscript parses', () => {
    execFileSync(process.execPath, ['--check', scriptPath], { stdio: 'pipe' });
});

test('metadata stays distribution-safe', () => {
    assert(!/@connect\s+\*/.test(script), 'wildcard @connect should not return');
    assert(/@noframes/.test(script), '@noframes should remain present');
    assert(!/@match\s+https:\/\/m\.imdb\.com\//.test(script), 'desktop-only userscript must not match mobile IMDb');
    assert(/@updateURL/.test(script), '@updateURL should be present for update channel');
    assert(/@downloadURL/.test(script), '@downloadURL should be present for update channel');
    const hooks = loadScriptTestHooks();
    assert(hooks.isIMDbHost('www.imdb.com'));
    assert(!hooks.isIMDbHost('not-imdb.com'), 'IMDb host checks must not use substring trust');
    assert(hooks.isCinebyHost('www.cineby.at'));
    assert(!hooks.isCinebyHost('cineby.example'), 'Cineby host checks must stay exact');
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
    assert(script.includes("'aria-label':'IMDb vote distribution from 1 to 10'"), 'histogram should expose its meaning to assistive technology');
});

test('fragile selectors and global Cineby key stay removed', () => {
    assert(!/\.sc-|sc-[0-9a-fA-F]+|sc-[a-z0-9]+/.test(script), 'hashed styled-components selectors should stay removed');
    assert(!/\.bRimta\b/.test(script), 'observed generated IMDb class selectors should stay removed');
    assert(!/margin[^;]*-[0-9]+px/.test(script), 'layout styling should not pull poster content over adjacent rows');
    assert(!/GM_setValue\('movieTitle'/.test(script), 'Cineby should not write the global movieTitle key');
});

test('ad cleanup preserves core media and covers current IMDb shells', () => {
    assert(!script.includes('[data-testid="inline-video-playback-container"]'), 'native IMDb video must never be treated as an ad');
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
    assert(script.includes('stopFeature(feature)'), 'settings refresh and disable paths should invalidate prior feature instances');
    assert(script.includes("startFeature(feature, { context:'settings', notify:true })"), 'settings-triggered feature failures should be visible');
});

test('watched marks only decorate canonical title links', () => {
    const hooks = loadScriptTestHooks();
    assert.strictEqual(hooks.getLinkedTitleId('/title/tt0133093/?ref_=home'), 'tt0133093');
    assert.strictEqual(hooks.getLinkedTitleId('/de/title/tt0133093/'), 'tt0133093');
    assert.strictEqual(hooks.getLinkedTitleId('/showtimes/title/tt0133093/2026-08-30'), '');
    assert.strictEqual(hooks.getLinkedTitleId('/title/tt0133093/releaseinfo/'), '');
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
    hooks.setUserMark('tt9999999', 'watched', 'Newest');
    assert.strictEqual(Object.keys(hooks.getStoredSetting('userMarks')).length, 5000, 'new writes should preserve the mark bound');
    assert(script.includes('mutation.addedNodes.forEach'), 'watched-mark observer should scan added subtrees');
    assert(script.includes('this._pendingScanRoots.size > 50'), 'large mutation batches should retain a bounded full-scan fallback');
});

test('lookup caches remain bounded and storage failures do not hide fetched results', () => {
    const hooks = loadScriptTestHooks();
    hooks.seedRawStorage('cache_legacy', JSON.stringify({ data:{ score:99 }, ts:Date.now(), ttl:60000 }));
    assert.strictEqual(hooks.cacheGet('legacy'), null, 'pre-validation cache schemas should be invalidated');
    assert(!hooks.getStorageKeys().includes('cache_legacy'), 'invalidated legacy cache entries should be deleted');
    for (let index = 0; index < 135; index++) hooks.cacheSet(`test_${index}`, { index });
    const cacheKeys = hooks.getStorageKeys().filter(key => key.startsWith('cache_'));
    assert(cacheKeys.length <= 129, `cache exceeded bounded GC window: ${cacheKeys.length}`);
    assert.strictEqual(hooks.cacheGet('test_134')?.index, 134, 'newest cached result should survive pruning');
    assert(script.includes('CACHE_SCHEMA_VERSION = 2'), 'cache schema invalidation marker missing');

    const failingHooks = loadScriptTestHooks();
    failingHooks.failSettingWriteAt(1);
    assert.strictEqual(failingHooks.cacheSet('quota', { value:true }), false, 'cache write errors should be non-fatal');
});

test('settings use six accessible desktop destinations', () => {
    ['experience', 'ratings', 'tools', 'sites', 'integrations', 'data'].forEach(page => {
        assert(script.includes(`id:'${page}'`), `settings page ${page} missing`);
    });
    assert(script.includes('role="tablist"'), 'settings navigation tablist missing');
    assert(script.includes("role:'tabpanel'"), 'settings tab panels missing');
    assert(/#enh-settings-overlay\s*\{[^}]*visibility:\s*hidden/s.test(script), 'closed settings must leave the tab order');
    assert(/#enh-settings-overlay\.enh-visible\s*\{[^}]*visibility:\s*visible/s.test(script), 'open settings must restore visibility');
    assert(script.includes("maxlength:'100000'"), 'import size guard missing');
    assert(script.includes('Changes save automatically.'), 'automatic-save status missing');
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

    assert.strictEqual(hooks.applySettingsImport(prepared.entries.slice(0, 2)), 2);
    assert.strictEqual(hooks.getStoredSetting('modernUI'), false);
    assert.strictEqual(hooks.getStoredSetting('themeVariant'), 'light');
    assert.throws(
        () => hooks.prepareSettingsImport({ plexUrl:'https://user:secret@localhost:32400/' }),
        /No valid recognized settings/,
        'credential-bearing service URLs must be rejected'
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
});

test('core features remain registered', () => {
    [
        'streamAvailability',
        'watchedMarking',
        'servarrIntegration',
        'watchlistBatch',
        'themeAuto',
        'getRTSlugCandidates',
        'cacheGC',
    ].forEach(token => assert(script.includes(token), `${token} missing`));
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
    const deadDomains = [
        'popcornmovies.org', 'xprime.su', 'aether.mom', 'rivestream.app',
        'cineby.sc', 'cineby.gd', 'cineby.app', 'cinevids.site',
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

test('custom site templates require complete HTTP or HTTPS URLs', () => {
    const hooks = loadScriptTestHooks();
    assert.strictEqual(hooks.normalizeUrlTemplate('https://example.com/search?q={{TITLE}}'), 'https://example.com/search?q={{TITLE}}');
    assert.strictEqual(hooks.normalizeUrlTemplate('http://localhost:8080/search'), 'http://localhost:8080/search');
    assert.strictEqual(hooks.normalizeUrlTemplate('https://'), '');
    assert.strictEqual(hooks.normalizeUrlTemplate('javascript:alert(1)'), '');
    assert.strictEqual(hooks.normalizeUrlTemplate('file:///tmp/search'), '');
    assert.strictEqual(hooks.normalizeUrlTemplate('https://user:secret@example.com/search'), '');
    assert.strictEqual(hooks.normalizeSite({ name:'Broken', url:'https://' }), null);
    const letterboxd = hooks.normalizeSite({ name:'Letterboxd', url:'https://letterboxd.com/imdb/{{IMDB_ID}}/' });
    assert.strictEqual(letterboxd.movieOnly, true, 'Letterboxd custom/default links should remain movie-scoped');
    assert.deepStrictEqual(
        Array.from(hooks.filterSitesForMediaType([letterboxd, { name:'TMDB' }], true), site => site.name),
        ['TMDB'],
        'movie-only external sites should stay off TV title pages'
    );
    assert(script.includes("if (cat === 'Movie Sites' && isTVType()) continue"), 'expanded movie-only links should stay off TV pages');
    assert(script.includes("url:'https://www.themoviedb.org/search?query={{TITLE}}'"), 'default TMDB search should cover movies and TV');
});

test('third-party response links stay on trusted HTTPS domains', () => {
    const hooks = loadScriptTestHooks();
    const fallback = 'https://letterboxd.com/imdb/tt0133093/';
    assert.strictEqual(
        hooks.normalizeTrustedUrl('https://letterboxd.com/film/the-matrix/', 'letterboxd.com', fallback),
        'https://letterboxd.com/film/the-matrix/'
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
    const excessive = hooks.collectJustWatchProviderNames({
        offers:Array.from({ length:75 }, (_, index) => ({ offeredBy:{ name:`Provider ${index}` } })),
    });
    assert.strictEqual(excessive.length, 50, 'provider traversal should enforce its output budget');
    assert(!script.includes('_firstDetailPath'), 'first-path JustWatch fallback should stay removed');
    assert(!script.includes('_collectProviderNames'), 'recursive provider traversal should stay removed');
});

test('list multi-search builds a popup-safe link queue', () => {
    const hooks = loadScriptTestHooks();
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
    const cinebyEntries = hooks.buildListSearchEntries({ storeQuery:true }, titles.slice(0, 1));
    assert.strictEqual(cinebyEntries[0].url, 'https://www.cineby.at/', 'Cineby queue should retain its controlled-input handoff');
    assert(!script.includes("window.open(url, '_blank'"), 'timer-driven popup loop should stay removed');
    assert(!script.includes('setTimeout(r, 800)'), 'delayed popup loop should stay removed');
    [
        'enh-multi-search-queue',
        'Browsers allow one new tab per click.',
        'Copy all links',
        'Open next',
        "target:'_blank', rel:'noopener'",
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

test('cineby uses current domain', () => {
    assert(script.includes('cineby.at'), 'cineby.at should be the active Cineby domain');
    assert(script.includes('// @match        https://www.cineby.at/*'), 'Cineby root route should be matched');
    assert(script.includes("url:'https://www.cineby.at/'"), 'Cineby handoff should target the live root route');
    assert(script.includes("/^search$/i.test(label.trim())"), 'Cineby handoff should open the current search control');
});

test('Cineby handoffs are short-lived and consumed only once', () => {
    const hooks = loadScriptTestHooks();
    assert(hooks.storeCinebyQuery('The Matrix'));
    const payload = JSON.parse(hooks.getStoredSetting('cineby_query'));
    assert.strictEqual(payload.title, 'The Matrix');
    assert(Number.isFinite(payload.ts), 'handoff timestamp missing');
    assert.strictEqual(hooks.takeCinebyQuery(), 'The Matrix');
    assert.strictEqual(hooks.getStoredSetting('cineby_query'), undefined, 'consumed handoff should be deleted immediately');

    hooks.seedStoredSetting('cineby_query', JSON.stringify({ title:'Stale title', ts:0 }));
    assert.strictEqual(hooks.takeCinebyQuery(), '', 'expired handoffs should not fill a later Cineby visit');
    assert.strictEqual(hooks.getStoredSetting('cineby_query'), undefined, 'expired handoff should also be deleted');

    hooks.seedStoredSetting('cineby_query', '1917');
    assert.strictEqual(hooks.takeCinebyQuery(), '1917', 'numeric legacy movie titles should survive migration');
});

test('settings preserve host scroll state and complete nested tab keyboard support', () => {
    assert(script.includes("previousDocumentOverflow = document.documentElement.style.overflow"), 'settings should capture the host page overflow value');
    assert(script.includes('document.documentElement.style.overflow = previousDocumentOverflow'), 'settings should restore the host page overflow value');
    assert(script.includes("if (event.key === 'Home') next = 0;"), 'nested tabs should support Home');
    assert(script.includes("if (event.key === 'End') next = ordered.length - 1;"), 'nested tabs should support End');
    assert(script.includes('enh-site-input--invalid'), 'invalid custom site fields need a visible state');
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
});

test('local-service credentials stay out of request URLs', () => {
    const hooks = loadScriptTestHooks();
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
});

test('media server matching handles provider IDs and title fallback', () => {
    const hooks = loadScriptTestHooks();
    assert.strictEqual(hooks.normalizeIMDbProviderId('imdb://tt0133093'), 'tt0133093');
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

    const parsed = hooks.parseMediaServerItems(JSON.stringify({
        Items: [{ Name: 'Alien', ProductionYear: 1979, ProviderIds: { Imdb: 'tt0078748' } }],
    }));
    assert.strictEqual(parsed.length, 1, 'Jellyfin/Emby item parser failed');
    assert(hooks.mediaItemMatches(parsed[0], { imdbId: 'tt0078748', title: 'Alien', year: 1979 }), 'parsed item did not match');
});

console.log('All tests passed.');
