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
        collectProviderIds,
        mediaItemMatches,
        parseMediaServerItems,
        getLinkedTitleId,
        getPageSurface,
        shouldInitFeature,
        createFeatureGuard,
        normalizeUrlTemplate,
        normalizeTrustedUrl,
        normalizeSite,
        buildListSearchEntries,
        getEnhancementScrollBehavior,
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
    let sandboxAbortedRequestCount = 0;
    const sandbox = {
        console,
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
        },
        history: {},
        MutationObserver: class {
            constructor(callback) { this.callback = callback; }
            observe() {}
            disconnect() {}
        },
        GM_getValue: (_key, fallback) => fallback,
        GM_setValue: () => {},
        GM_addStyle: () => {},
        GM_setClipboard: () => {},
        GM_xmlhttpRequest: () => ({ abort: () => { sandboxAbortedRequestCount += 1; } }),
        GM_listValues: () => [],
        GM_deleteValue: () => {},
        GM_webRequest: rules => { sandbox.webRequestRules = rules; },
    };
    vm.runInNewContext(instrumented, sandbox, { filename: scriptPath });
    sandbox.window.__enhTest.getCapturedWebRequestRules = () => sandbox.webRequestRules || [];
    sandbox.window.__enhTest.getAbortedRequestCount = () => sandboxAbortedRequestCount;
    sandbox.window.__enhTest.setReducedMotion = value => { prefersReducedMotion = Boolean(value); };
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
});

test('fragile selectors and global Cineby key stay removed', () => {
    assert(!/\.sc-|sc-[0-9a-fA-F]+|sc-[a-z0-9]+/.test(script), 'hashed styled-components selectors should stay removed');
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

test('async feature guards expire across route changes and route generations', () => {
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
    assert((script.match(/createFeatureGuard\(this\)/g) || []).length >= 15, 'async feature entry points should be route guarded');
    assert(script.includes("pending.catch(report)"), 'async feature initialization failures should be handled');
    assert(script.includes("startFeature(feature, { context:'settings', notify:true })"), 'settings-triggered feature failures should be visible');
});

test('watched marks only decorate canonical title links', () => {
    const hooks = loadScriptTestHooks();
    assert.strictEqual(hooks.getLinkedTitleId('/title/tt0133093/?ref_=home'), 'tt0133093');
    assert.strictEqual(hooks.getLinkedTitleId('/de/title/tt0133093/'), 'tt0133093');
    assert.strictEqual(hooks.getLinkedTitleId('/showtimes/title/tt0133093/2026-08-30'), '');
    assert.strictEqual(hooks.getLinkedTitleId('/title/tt0133093/releaseinfo/'), '');
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

test('default watch sites are all live domains', () => {
    const deadDomains = ['popcornmovies.org', 'xprime.su', 'aether.mom', 'rivestream.app', 'cineby.sc', 'cineby.gd', 'cineby.app'];
    deadDomains.forEach(domain => {
        assert(!script.includes(domain), `dead domain ${domain} should be removed`);
    });
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
    assert(script.includes("return /^search$/i.test(label.trim())"), 'Cineby handoff should open the current search control');
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
