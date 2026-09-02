import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = process.env.IMDB_ENH_FIXTURE_DIR
    ? path.resolve(process.env.IMDB_ENH_FIXTURE_DIR)
    : path.join(root, 'tests', 'fixtures');
const artifactDir = path.join(root, 'tests', 'artifacts', 'dom-fixtures');
const userscript = fs.readFileSync(path.join(root, 'IMDb_Enhanced.user.js'), 'utf8');
const { applyStoreProfile } = createRequire(import.meta.url)('../scripts/build-extension.js');

let Window;
try {
    if (process.env.IMDB_ENH_FORCE_NO_HAPPY_DOM === '1') {
        const forced = new Error("Cannot find package 'happy-dom'");
        forced.code = 'ERR_MODULE_NOT_FOUND';
        throw forced;
    }
    ({ Window } = await import('happy-dom'));
} catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND' && /happy-dom/.test(String(error?.message))) {
        console.log('ok - DOM fixture harness skipped (run npm install to enable happy-dom checks)');
        process.exit(0);
    }
    throw error;
}

const instrumented = userscript.replace(/\}\)\(\);\s*$/, `globalThis.__imdbEnhancedDomTest = {
    getIMDbID,
    getTitleText,
    getTitleYear,
    getMediaType,
    getLDData,
    getIMDbRating,
    getUserMarks,
    setUserMark,
    logAdditionalViewing,
    countSeenEpisodes,
    readCardMarkMetadata,
    readCurrentTitleMarkMetadata,
    getHistogramData,
    readLoadedEpisodes,
    readPersonBirthDate,
    collectMarkFilterCards,
    readCardRating,
    summarizeCollectionRuntime,
    describeCollectionRuntime,
    getPageSurface,
    getWatchlistServiceChoices,
    getWatchlistServices,
    boundedImageVariant,
    createSettingsPanel,
    getStoredSetting: key => get(key),
    /* What init() does to the structured-data memo on a route change. happy-dom cannot
       navigate, so a fixture that needs a second page says so this way. */
    forgetStructuredData: () => { _ldData = null; _ldRoute = ''; },
    setStoredSetting: (key, value) => set(key, value),
    createFAB,
    showFirstRunNotice,
    createLocalStatsPanel,
    destroySettingsChrome,
    summarizeLocalStats,
    parseRTSearchCandidates,
    parseLetterboxdSearchCandidates,
    collectMetacriticCandidates,
    parseJustWatchSearchCandidates,
    rankScoreCorrectionCandidates,
    appendScoreCorrectionAction,
    getScoreCorrection,
    setScoreCorrection,
    cacheSet,
    cacheGet,
    getAvailabilityCacheKey,
    collectCastNameIds,
    paintCastAges: (years, releaseYear) => {
        const feature = features.find(candidate => candidate.key === 'castAges');
        feature._paintCastAges(years, releaseYear);
    },
    renderAirsOn: data => {
        const feature = features.find(candidate => candidate.key === 'airsOn');
        feature._render(data);
    },
    renderAvailability: data => {
        const feature = features.find(candidate => candidate.key === 'streamAvailability');
        feature._render(data);
    },
    cancelPendingRouteWork,
    stopAllFeatures: () => features.forEach(stopFeature),
    initFeature: key => {
        const feature = features.find(candidate => candidate.key === key);
        if (!feature) throw new Error('Unknown feature: ' + key);
        return startFeature(feature, { context:'fixture' });
    },
    runFeature: async key => {
        const feature = features.find(candidate => candidate.key === key);
        if (!feature) throw new Error('Unknown feature: ' + key);
        advanceFeatureGeneration(feature);
        await feature.init();
    },
    /* What the page's own MutationObserver does when IMDb replaces something: walk
       the document again and repaint from the marks as they are now. */
    rescanLinkMarks: () => {
        const feature = features.find(candidate => candidate.key === 'markLinkTint');
        feature._scan(document);
    },
    rescanMarks: () => {
        const feature = features.find(candidate => candidate.key === 'watchedMarking');
        feature._scan(document);
    },
    stopFeature: key => {
        const feature = features.find(candidate => candidate.key === key);
        if (feature) stopFeature(feature);
    },
};
})();`);
assert.notEqual(instrumented, userscript, 'DOM fixture hook injection did not find the userscript boundary');

const manifest = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'manifest.json'), 'utf8'));
const fixtureByName = new Map(manifest.pages.map(page => [page.name, page]));
/* Every surface the suite reads has to be there. Not an exact list: capturing a new
   surface is the first step of covering one, and failing the whole suite on a fixture
   nothing reads yet turns that first step into a broken build. */
['title', 'title-ratings', 'episodes', 'person', 'chart'].forEach(name =>
    assert.ok(fixtureByName.has(name), `fixture manifest must cover the ${name} surface`));
/* What is listed has to be on disk, though. A manifest entry with no file is a capture
   that half happened, and every test reading it would fail somewhere less obvious. */
manifest.pages.forEach(page => assert.ok(fs.existsSync(path.join(fixtureDir, `${page.name}.html`)),
    `${page.name} is in the manifest with no captured file beside it`));

function requireSelector(document, selector) {
    const node = document.querySelector(selector);
    assert.ok(node, `selector "${selector}" did not match the fixture DOM`);
    return node;
}

async function abortWindow(window) {
    // happy-dom can leave its abort promise unresolved after an assertion interrupts
    // DOM work. Its abort call clears resources synchronously, so bound only the wait.
    try {
        await Promise.race([
            window.happyDOM.abort(),
            new Promise(resolve => setTimeout(resolve, 250)),
        ]);
    } finally {
        window.close();
    }
}

async function waitForSelector(window, selector, timeout = 500) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
        const node = window.document.querySelector(selector);
        if (node) return node;
        await new Promise(resolve => window.setTimeout(resolve, 5));
    }
    return requireSelector(window.document, selector);
}

function installUserscriptGlobals(window) {
    const store = new Map();
    window.__fixtureRequests = [];
    window.GM_getValue = (key, fallback) => store.has(key) ? store.get(key) : fallback;
    window.GM_setValue = (key, value) => { store.set(key, structuredClone(value)); };
    window.GM_deleteValue = key => { store.delete(key); };
    window.GM_listValues = () => [...store.keys()];
    window.GM_setClipboard = () => {};
    window.GM_webRequest = () => {};
    window.GM_xmlhttpRequest = options => {
        window.__fixtureRequests.push(options);
        window.queueMicrotask(() => options?.onerror?.({ error:'fixture network disabled' }));
        return { abort() {} };
    };
}

await runFixture('title', async (window, hooks) => {
    const nativeRating = requireSelector(window.document,
        '[data-testid="hero-rating-bar__aggregate-rating"]');
    const nativeRateButton = requireSelector(window.document,
        '[data-testid="hero-rating-bar__user-rating"]');
    let nativeRateClicks = 0;
    nativeRateButton.addEventListener('click', () => { nativeRateClicks += 1; });
    const nativeHost = nativeRating.parentElement;

    await hooks.runFeature('editorialTitleSurface');
    const rail = await waitForSelector(window, '#enh-editorial-score-rail');
    assert.equal(nativeRating.parentElement, rail,
        'the editorial surface should adopt IMDb rating controls');
    Array.from(window.document.querySelectorAll('.enh-title-page-actions button'))
        .find(button => button.textContent === 'Rate').click();
    assert.equal(nativeRateClicks, 1,
        'the editorial Rate action must invoke IMDb\'s own rating control');

    const lateWidget = window.document.createElement('div');
    lateWidget.className = 'enh-score-widget';
    rail.appendChild(lateWidget);

    const makeReplacementHero = label => {
        const hero = window.document.createElement('section');
        hero.dataset.testid = 'hero-parent';
        const rating = window.document.createElement('div');
        rating.dataset.testid = 'hero-rating-bar__aggregate-rating';
        rating.textContent = label;
        const popularity = window.document.createElement('div');
        popularity.dataset.testid = 'hero-rating-bar__popularity';
        popularity.textContent = 'Popular';
        hero.append(rating, popularity);
        return { hero, rating };
    };
    const hydrated = makeReplacementHero('Hydrated rating');
    nativeHost.replaceWith(hydrated.hero);
    const hydrationStarted = Date.now();
    while (hydrated.rating.parentElement !== rail && Date.now() - hydrationStarted < 500) {
        await new Promise(resolve => window.setTimeout(resolve, 5));
    }
    assert.equal(hydrated.rating.parentElement, rail,
        'a replacement IMDb rating control should be adopted into the editorial rail');
    assert.equal(rail.querySelectorAll('[data-testid="hero-rating-bar__aggregate-rating"]').length, 1,
        'replacing the IMDb hero must not duplicate its aggregate rating control');
    assert.equal(rail.querySelectorAll('[data-testid="hero-rating-bar__popularity"]').length, 1,
        'replacing the IMDb hero must not duplicate its popularity control');
    assert.equal(hydrated.hero.classList.contains('enh-editorial-native-hidden'), true,
        'a replacement IMDb hero should stay hidden while the editorial surface is active');

    /* Replace the hero again and tear down before the mutation observer can run. The
       destroy path must discover the live host instead of trusting its last snapshot. */
    const final = makeReplacementHero('Final rating');
    hydrated.hero.replaceWith(final.hero);
    hooks.stopFeature('editorialTitleSurface');

    assert.equal(lateWidget.isConnected, true,
        'a score widget created after the editorial surface must stay connected');
    assert.equal(lateWidget.parentElement, final.hero,
        'a late score widget must return to the current native rating host');
    assert.equal(final.hero.classList.contains('enh-native-score-rail'), true,
        'the restored native rating host must retain its responsive layout hook');
});

await runFixture('title', async (window, hooks) => {
    requireSelector(window.document, '[data-testid="hero-media__poster"] img').remove();
    await hooks.runFeature('editorialTitleSurface');

    const hero = await waitForSelector(window, '.enh-editorial-hero');
    assert.equal(hero.classList.contains('enh-editorial-hero--no-poster'), true,
        'a title without artwork should use the no-poster editorial grid');
    assert.equal(hero.querySelector('.enh-editorial-poster'), null,
        'a title without artwork must not render an empty poster card');

    hooks.stopFeature('editorialTitleSurface');
});

/* The store profile is a build, not a setting, so the only honest way to exercise it is
   to run the code the store build actually ships. `source` takes the transformed script;
   `extension` installs the chrome surface the userscript uses to decide it is an
   extension, since the per-feature access line only exists there. */
async function runFixture(name, run, { source = instrumented, extension = null } = {}) {
    const definition = fixtureByName.get(name);
    assert.ok(definition, `fixture "${name}" is missing from manifest.json`);
    const fixturePath = path.join(fixtureDir, `${name}.html`);
    const html = fs.readFileSync(fixturePath, 'utf8');
    const window = new Window({
        url: 'https://example.test/',
        width: 1440,
        height: 900,
        console: { ...console, info() {}, warn() {} },
        settings: { disableJavaScriptFileLoading:true, disableCSSFileLoading:true, disableIframePageLoading:true },
    });
    window.document.write(html);
    window.document.close();
    installUserscriptGlobals(window);
    if (extension) window.chrome = extension;
    window.eval(source);
    // Let the userscript's queued boot observe the neutral host before switching the
    // fixture URL. Otherwise happy-dom runs the delayed boot after setURL(), starts every
    // default feature, and leaves four 60-second visibility waits behind the focused test.
    await new Promise(resolve => window.setTimeout(resolve, 0));
    window.happyDOM.setURL(definition.url);

    try {
        await run(window, window.__imdbEnhancedDomTest);
        /* The working set beside every pass, because the day this suite ate the machine
           it was one fixture's growth and only a per-fixture number showed which. */
        console.log(`ok - happy-dom ${name} fixture [rss ${Math.round(process.memoryUsage.rss()/1048576)} MB]`);
    } catch (error) {
        fs.mkdirSync(artifactDir, { recursive:true });
        const artifactPath = path.join(artifactDir, `${name}.html`);
        fs.writeFileSync(artifactPath, window.document.documentElement.outerHTML, 'utf8');
        const detail = `${name}: ${error.message}\nDOM artifact: ${path.relative(root, artifactPath)}`;
        error.message = detail;
        if (typeof error.stack === 'string') {
            const stackBody = error.stack.slice(error.stack.indexOf('\n'));
            error.stack = `${error.name}: ${detail}${stackBody}`;
        }
        throw error;
    } finally {
        window.__imdbEnhancedDomTest?.stopAllFeatures();
        window.__imdbEnhancedDomTest?.cancelPendingRouteWork();
        await abortWindow(window);
    }
}

/* The other shape the same lie takes: load fires with no framed window at all. The
   listener is once-only, so this needs its own frame and therefore its own window. */
await runFixture('title', async (window, hooks) => {
    const observer = window.IntersectionObserver;
    window.IntersectionObserver = class {
        constructor(callback) { this.callback = callback; }
        observe(element) { this.callback([{ isIntersecting:true, target:element }]); }
        disconnect() {}
        unobserve() {}
    };
    try {
        window.GM_setValue('imdb_enh_movieChatBoard', true);
        await hooks.runFeature('movieChatBoard');
        const section = window.document.getElementById('enh-moviechat');
        const frame = section.querySelector('iframe');
        assert.ok(frame, 'the frame should exist before the load is faked');
        Object.defineProperty(frame, 'contentWindow', { configurable:true, get: () => null });
        frame.dispatchEvent(new window.Event('load'));
        assert.equal(section.querySelector('iframe'), null,
            'a load that framed no window is not a board either');
        assert.match(section.textContent, /could not be shown/);
    } finally {
        hooks.stopFeature('movieChatBoard');
        window.GM_setValue('imdb_enh_movieChatBoard', false);
        window.IntersectionObserver = observer;
    }
});

/* IE-26: a film that belongs to a series lists the rest of it in order. A film that
   belongs to nothing, or whose "series" is only itself, has no watch order to show — and
   that is the answer that has to produce no section at all. */
await runFixture('title', async (window, hooks) => {
    const observer = window.IntersectionObserver;
    window.IntersectionObserver = class {
        constructor(callback) { this.callback = callback; }
        observe(element) { this.callback([{ isIntersecting:true, target:element }]); }
        disconnect() {}
        unobserve() {}
    };
    const answer = rows => {
        window.GM_xmlhttpRequest = options => {
            window.queueMicrotask(() => options.onload?.({
                status: 200,
                finalUrl: options.url,
                responseText: JSON.stringify({ results:{ bindings:rows } }),
            }));
            return { abort() {} };
        };
    };
    try {
        window.GM_setValue('imdb_enh_collectionPanel', true);

        // A series that is only this film is not a watch order.
        answer([{ imdb:{ value:'tt0133093' }, label:{ value:'The Matrix' }, year:{ value:'1999' }, ordinal:{ value:'1' } }]);
        await hooks.runFeature('collectionPanel');
        assert.equal(window.document.getElementById('enh-collection'), null,
            'a series of one must not render a watch order');

        // A real series does, in its declared order, with the current film marked.
        hooks.cacheSet('series_tt0133093', null, 1);
        answer([
            { imdb:{ value:'tt0234215' }, label:{ value:'The Matrix Reloaded' }, year:{ value:'2003' }, ordinal:{ value:'2' } },
            { imdb:{ value:'tt0133093' }, label:{ value:'The Matrix' }, year:{ value:'1999' }, ordinal:{ value:'1' } },
        ]);
        await hooks.runFeature('collectionPanel');
        const section = window.document.getElementById('enh-collection');
        assert.ok(section, 'a series of more than one renders');
        const items = [...section.querySelectorAll('.enh-collection__item')];
        assert.deepEqual(items.map(item => item.textContent),
            ['The Matrix (1999)', 'The Matrix Reloaded (2003)'], 'in the order the series declares');
        assert.equal(items[0].getAttribute('aria-current'), 'true', 'the film you are on is marked');
        assert.equal(items[0].querySelector('a'), null, 'and is not a link to itself');
        assert.equal(items[1].querySelector('a').getAttribute('href'), '/title/tt0234215/');

        hooks.stopFeature('collectionPanel');
        assert.equal(window.document.getElementById('enh-collection'), null,
            'switching it off takes the section away');
    } finally {
        window.GM_setValue('imdb_enh_collectionPanel', false);
        window.IntersectionObserver = observer;
    }
});

/* IE-25: the services worth interrupting someone for are the ones the daily check has
   actually walked past in this region — a list of service names written into the source
   would be a list that is wrong in most of the world. On the first day it is empty and
   the panel says why. The control belongs to the extension, because the alarm behind it
   does. */
await runFixture('title', async (window, hooks) => {
    window.GM_setValue('imdb_enh_watchlistAlertState', {
        checkedAt: 1, cursor: 0, seen: {}, services: ['Hulu', 'Netflix'],
    });
    assert.deepEqual(Array.from(hooks.getWatchlistServiceChoices()), ['Hulu', 'Netflix'],
        'the choices come from what the checks have seen');

    hooks.createSettingsPanel();
    const card = [...window.document.querySelectorAll('.enh-settings-card')]
        .find(node => /Watchlist alerts/.test(node.textContent));
    assert.ok(card, 'the extension build offers the control');
    const boxes = [...card.querySelectorAll('input[type="checkbox"]')];
    assert.deepEqual(boxes.map(box => box.parentElement.textContent), ['Hulu', 'Netflix']);
    assert.equal(boxes.every(box => !box.checked), true, 'nothing is chosen for you');

    boxes[1].checked = true;
    boxes[1].dispatchEvent(new window.Event('change', { bubbles:true }));
    assert.deepEqual(Array.from(hooks.getWatchlistServices()), ['Netflix'],
        'ticking one records it');

    boxes[1].checked = false;
    boxes[1].dispatchEvent(new window.Event('change', { bubbles:true }));
    assert.deepEqual(Array.from(hooks.getWatchlistServices()), [],
        'and unticking it takes it back out');

    hooks.destroySettingsChrome();
    window.GM_setValue('imdb_enh_watchlistAlertState', null);
}, { extension:{ runtime:{ id:'test', getManifest: () => ({ version:'0.0.0' }) }, i18n:{} } });

/* And the same panel in a userscript build, which has no worker to run the alarm behind
   the control: a picker for a background job that cannot run is worse than no picker. */
await runFixture('title', async (window, hooks) => {
    window.GM_setValue('imdb_enh_watchlistAlertState', { checkedAt:1, cursor:0, seen:{}, services:['Hulu'] });
    hooks.createSettingsPanel();
    const overlay = window.document.getElementById('enh-settings-overlay');
    assert.ok(overlay, 'the panel itself still opens');
    assert.equal(/Watchlist alerts/.test(overlay.textContent), false,
        'a userscript build must not offer the control');
    hooks.destroySettingsChrome();
    window.GM_setValue('imdb_enh_watchlistAlertState', null);
});

/* IE-123: the structured-data memo used to be cleared only by init(), which runs about
   600 ms after a pushState. Inside that window a title-to-title navigation served the
   previous title's year and media type to everything that asked — including the identity
   check every score source validates its match with, which then cached the wrong answer
   under the new title's id for a week. */
await runFixture('title', async (window, hooks) => {
    assert.equal(hooks.getTitleYear(), '1999', 'the fixture title is dated 1999');
    assert.equal(hooks.getMediaType(), 'movie');

    // The page IMDb swaps in, with the address changed and no init run yet.
    const replacement = window.document.querySelector('script[type="application/ld+json"]');
    assert.ok(replacement, 'the fixture should carry structured data to replace');
    replacement.textContent = JSON.stringify({
        '@context':'https://schema.org',
        '@type':'TVSeries',
        url:'/title/tt0903747/',
        name:'Breaking Bad',
        datePublished:'2008-01-20',
        genre:['Crime', 'Drama'],
    });
    window.happyDOM.setURL('https://www.imdb.com/title/tt0903747/');

    assert.equal(hooks.getTitleYear(), '2008',
        'the year must come from the page that is on screen, not the one that was');
    assert.equal(hooks.getMediaType(), 'series',
        'and so must the media type, which decides which sources are asked at all');
});

/* The order IMDb actually uses: the address changes first and the page is swapped in
   afterwards. Between the two the document still holds the previous title's data, and
   re-parsing it under the new route key is how the old year gets pinned to the new
   title — which is the defect the route key alone did not fix. */
await runFixture('title', async (window, hooks) => {
    const script = window.document.querySelector('script[type="application/ld+json"]');
    assert.ok(script, 'the fixture should carry structured data');
    assert.equal(hooks.getLDData().name, 'The Matrix');

    window.happyDOM.setURL('https://www.imdb.com/title/tt0903747/');
    /* The structured data is the thing that must not be believed here: it decides the
       media type and the year that every score source validates its match against. The
       visible DOM still shows the old page, and reading a year off it is honest — reading
       the old title's data as though it described the new one is not. */
    assert.equal(Object.keys(hooks.getLDData()).length, 0,
        'data that names another title is no answer at all, not the previous answer');

    script.textContent = JSON.stringify({
        '@context':'https://schema.org',
        '@type':'TVSeries',
        url:'/title/tt0903747/',
        name:'Breaking Bad',
        datePublished:'2008-01-20',
    });
    assert.equal(hooks.getLDData().name, 'Breaking Bad', 'and the real one the moment it lands');
    assert.equal(hooks.getTitleYear(), '2008');
    assert.equal(hooks.getMediaType(), 'series',
        'which is what decides whether a film source is asked about a series');
});

/* A route with no title id in it cannot be checked against the data at all, so nothing
   is remembered there — which is what stops a title's data following a reader onto a
   chart or a search page. */
await runFixture('title', async (window, hooks) => {
    assert.equal(hooks.getLDData().name, 'The Matrix');
    window.happyDOM.setURL('https://www.imdb.com/chart/top/');
    assert.equal(hooks.getLDData().name, 'The Matrix',
        'the page still holds that data, so it is still what is read');

    /* But it was not remembered: replacing the page changes the answer immediately,
       rather than after whatever cleared the memo next ran. */
    window.document.querySelector('script[type="application/ld+json"]').remove();
    assert.equal(Object.keys(hooks.getLDData()).length, 0,
        'an unverifiable parse is answered with, never memoized');
});

/* A page that has not rendered its structured data yet must not poison every later read:
   nothing is remembered until there is something to remember. */
await runFixture('title', async (window, hooks) => {
    const script = window.document.querySelector('script[type="application/ld+json"]');
    const original = script.textContent;
    script.remove();
    // The visible page still carries a year, so the structured read is what is checked.
    assert.equal(Object.keys(hooks.getLDData()).length, 0, 'no data, no answer');

    const replacement = window.document.createElement('script');
    replacement.type = 'application/ld+json';
    replacement.textContent = original;
    window.document.body.appendChild(replacement);
    assert.equal(hooks.getLDData().name, 'The Matrix', 'and the read that follows still works');
});

/* The half of the gate that costs nothing: a board nobody has scrolled to is a heading
   and a link, and contacts MovieChat not at all. */
await runFixture('title', async (window, hooks) => {
    const observer = window.IntersectionObserver;
    window.IntersectionObserver = class {
        constructor() {}
        observe() {}
        disconnect() {}
        unobserve() {}
    };
    try {
        window.GM_setValue('imdb_enh_movieChatBoard', true);
        hooks.runFeature('movieChatBoard');
        for (let tick = 0; tick < 5; tick += 1) await new Promise(resolve => window.setTimeout(resolve, 0));
        assert.ok(window.document.getElementById('enh-moviechat'), 'the section itself is mounted');
        assert.equal(window.document.querySelector('#enh-moviechat iframe'), null,
            'and nothing is requested until it is scrolled to');
    } finally {
        hooks.stopFeature('movieChatBoard');
        window.GM_setValue('imdb_enh_movieChatBoard', false);
        window.IntersectionObserver = observer;
    }
});

/* IE-23: the board is someone else's page inside this one, so it says so before anything
   loads, and it has to survive the day MovieChat adds a framing header — which fires no
   error event, only silence. happy-dom does not load iframes, so the frame here never
   reports itself loaded, which is exactly the case the timeout exists for. */
await runFixture('title', async (window, hooks) => {
    /* happy-dom's IntersectionObserver never reports an intersection, so it is replaced
       with one whose answer this test controls: the gate is what is being exercised, and
       both of its answers matter. */
    const observer = window.IntersectionObserver;
    let intersects = false;
    window.IntersectionObserver = class {
        constructor(callback) { this.callback = callback; }
        observe(element) { if (intersects) this.callback([{ isIntersecting:true, target:element }]); }
        disconnect() {}
        unobserve() {}
    };
    try {
        // The feature is off by default, and its own guard checks the setting.
        window.GM_setValue('imdb_enh_movieChatBoard', true);
        intersects = true;
        await hooks.runFeature('movieChatBoard');
        // The visibility gate resolves on a microtask, so let it settle before looking.
        for (let tick = 0; tick < 5; tick += 1) await new Promise(resolve => window.setTimeout(resolve, 0));
        const section = window.document.getElementById('enh-moviechat');
        assert.ok(section, 'the section should be mounted on a title page');
        assert.match(section.textContent, /Hosted by MovieChat/,
            'and say whose page it is before anything is loaded');

        const link = section.querySelector('.enh-moviechat__link');
        assert.equal(link.getAttribute('href'), 'https://moviechat.org/tt0133093');
        assert.equal(link.getAttribute('rel'), 'noopener noreferrer');

        const frame = section.querySelector('iframe');
        assert.ok(frame, 'the frame is created once the section is visible');
        assert.equal(frame.getAttribute('src'), 'https://moviechat.org/tt0133093');
        assert.equal(frame.getAttribute('referrerpolicy'), 'no-referrer');
        /* What protects the page here is what this attribute does NOT contain:
           allow-top-navigation would let the board navigate the IMDb tab away. Pinned as
           a set, because a token added beside the ones that belong here is exactly the
           change nobody would notice. */
        assert.deepEqual(frame.getAttribute('sandbox').split(' ').sort(),
            ['allow-forms', 'allow-popups', 'allow-same-origin', 'allow-scripts']);

        /* A refusal fires load, not error, and leaves the frame on the about:blank it
           started from — which is readable, unlike a board that actually loaded. That is
           the difference the fallback turns on, so it is what this drives. */
        Object.defineProperty(frame, 'contentWindow', {
            configurable: true,
            get: () => ({ location: { href: 'about:blank' } }),
        });
        frame.dispatchEvent(new window.Event('load'));
        assert.equal(section.querySelector('iframe'), null,
            'a frame that framed nothing must not be left sitting there empty');
        assert.match(section.textContent, /could not be shown/,
            'and the section must say so');
        assert.ok(section.querySelector('.enh-moviechat__link'),
            'with the link out still there');

        hooks.stopFeature('movieChatBoard');
        window.GM_setValue('imdb_enh_movieChatBoard', false);
        assert.ok(window.document.getElementById('enh-moviechat') === null,
            'and switching it off takes the whole section away');
    } finally {
        window.IntersectionObserver = observer;
    }
});

/* IE-112: IMDb suppresses the context menu over gallery images, which is why Save image
   as does nothing there. Stopping the event before their handler runs is the whole fix,
   and it must not itself prevent anything: the point is to let the browser do what it
   would do anywhere else. */
await runFixture('title', async (window, hooks) => {
    const gallery = window.document.createElement('div');
    gallery.innerHTML = '<div data-testid="media-viewer"><img alt="Poster" src="about:blank"></div>';
    window.document.body.appendChild(gallery);
    const image = gallery.querySelector('img');

    /* Registered first, the way document_start puts it ahead of the page's own scripts.
       That order is the mechanism: among listeners on the same node in the same phase the
       earlier one runs first, and stopping immediately is what keeps the rest from
       running at all. */
    hooks.initFeature('restoreImageContextMenu');

    /* Where a site actually suppresses this. A listener on a container is defeated by
       stopping propagation at all; ones on window and on document in the capture phase
       are not, because propagation has not begun leaving that node — those need the
       immediate form, and need this listener to have been registered first. */
    let suppressed = 0;
    const suppress = event => { suppressed += 1; event.preventDefault(); };
    gallery.addEventListener('contextmenu', suppress);
    window.addEventListener('contextmenu', suppress, true);
    window.document.addEventListener('contextmenu', suppress, true);
    const event = new window.MouseEvent('contextmenu', { bubbles:true, cancelable:true });
    assert.equal(event.cancelable, true, 'the event has to be cancellable for the next check to mean anything');
    image.dispatchEvent(event);
    assert.equal(suppressed, 0, 'their handler must never see the event');
    assert.equal(event.defaultPrevented, false,
        'and nothing of ours may prevent it either, or the menu still will not open');

    /* The other two things the selector names, which the img case never reaches. The
       viewer draws its own surface around the photograph and a picture element wraps one,
       so a right-click can land on either of them rather than on the img, and either arm
       could be deleted with the check above still passing. */
    const viewer = gallery.querySelector('[data-testid="media-viewer"]');
    const onViewer = new window.MouseEvent('contextmenu', { bubbles:true, cancelable:true });
    viewer.dispatchEvent(onViewer);
    assert.equal(suppressed, 0, 'the viewer surface around a photograph counts as the photograph');

    const responsive = window.document.createElement('picture');
    responsive.innerHTML = '<source srcset="about:blank"><img alt="Still" src="about:blank">';
    gallery.appendChild(responsive);
    const onPicture = new window.MouseEvent('contextmenu', { bubbles:true, cancelable:true });
    responsive.dispatchEvent(onPicture);
    assert.equal(suppressed, 0, 'and so does a picture element wrapping one');

    /* Only over pictures. A page-wide swallow would take the context menu away from every
       link and every piece of text on IMDb, which is a much larger change than the one
       being asked for. */
    const paragraph = window.document.createElement('p');
    paragraph.textContent = 'Not an image';
    gallery.appendChild(paragraph);
    const elsewhere = new window.MouseEvent('contextmenu', { bubbles:true, cancelable:true });
    paragraph.dispatchEvent(elsewhere);
    assert.equal(suppressed, 3, 'the page keeps all of its own handling everywhere else');

    hooks.stopFeature('restoreImageContextMenu');
    const after = new window.MouseEvent('contextmenu', { bubbles:true, cancelable:true });
    image.dispatchEvent(after);
    assert.equal(suppressed, 6, 'switching it off gives all three handlers back over images too');
    gallery.remove();
});

/* IE-107: the marks for a show's episodes were in the store and its own page said nothing
   about them. The count comes from the marks; the total comes from what IMDb already ships
   with the page, or is left unsaid. */
/* Structured data is read once per route, the way a real page is only parsed once, so a
   block cannot change what kind of title it is halfway through. Each case gets its own
   window, and each sets the page up before anything reads it. */
const episodeBadge = window => window.document.querySelector('.enh-episode-badge');

function makeSeriesPage(window, episodes) {
    const ld = window.document.querySelector('script[type="application/ld+json"]');
    assert.ok(ld, 'the fixture carries structured data to work from');
    const id = JSON.parse(ld.textContent).url.match(/(tt\d+)/)[1];
    ld.textContent = JSON.stringify({
        '@type':'TVSeries',
        url:`https://www.imdb.com/title/${id}/`,
        name:'A Show',
        ...(episodes ? { numberOfEpisodes:episodes } : {}),
    });
    return id;
}

function seedEpisodeMarks(hooks, seriesId) {
    hooks.setStoredSetting('userMarks', {
        tt0959621:{ v:2, state:'watched', title:'Pilot', ts:1, series:seriesId },
        tt0959622:{ v:2, state:'watched', title:'Second', ts:2, series:seriesId },
        // A Skip is a decision not to watch an episode, so it is not progress through one.
        tt0959623:{ v:2, state:'skip', title:'Skipped', ts:3, series:seriesId },
        // Another show's episode, which this one must not count.
        tt0994359:{ v:2, state:'watched', title:'Elsewhere', ts:4, series:'tt0306414' },
    });
    /* Written straight into storage, which is the one door that does not clear the marks
       cache the way saving a mark does. Everything reading them next would otherwise see
       whatever this window had already loaded. */
    hooks.getUserMarks(true);
}

/* IE-105: a rewatch is a thing the store can hold and the page could not say. The button
   for it belongs on something already Seen and nowhere else, and the count has to show up
   where somebody would look for it.

   Both features share this window. A happy-dom page over the captured fixture is not
   cheap, and a suite that opens one per assertion runs the process out of memory. */
await runFixture('title', async (window, hooks) => {
    window.GM_setValue('imdb_enh_watchedMarking', true);
    /* A film has no episodes to have watched, whatever the store holds. Checked here
       rather than in its own window, because a fixture window is not cheap. */
    seedEpisodeMarks(hooks, hooks.getIMDbID());
    hooks.initFeature('watchedMarking');
    assert.ok(episodeBadge(window) === null, 'a film says nothing about episodes');
    hooks.stopFeature('watchedMarking');
    hooks.setStoredSetting('userMarks', {});
    hooks.initFeature('watchedMarking');

    const card = window.document.querySelector('.enh-markable-card[data-enh-mark-id]');
    assert.ok(card, 'the feature decorates something on a title page');
    const id = card.dataset.enhMarkId;

    /* IE-107: only an episode list says what its cards are episodes of. A title page
       carries "More like this" rows, and stamping this page's id onto those would make
       every recommendation an episode of the film you were looking at. */
    assert.equal(hooks.getPageSurface(), 'title');
    assert.ok(hooks.getIMDbID(), 'and this page does have an id to stamp, so the check means something');
    assert.equal(hooks.readCardMarkMetadata(card, 'tt0111161').series, undefined,
        'a card on a title page belongs to no series');
    const again = card.querySelector('[data-enh-mark-action="again"]');
    const shown = node => window.getComputedStyle(node).display !== 'none';

    assert.ok(again, 'the control exists on every card it might apply to');
    assert.ok(!shown(again), 'and stays out of the way until there is a viewing to add to');

    card.querySelector('[data-enh-mark-action="watched"]').click();
    assert.equal(hooks.getUserMarks(true)[id].state, 'watched');
    assert.ok(shown(again), 'once it is Seen, logging another viewing is offered');
    /* One viewing is what a Seen mark already says, so the badge stays a plain label
       until there are two. */
    const badge = card.querySelector('.enh-mark-badge');
    assert.doesNotMatch(badge.textContent, /x\d/i, 'a single viewing is not a count of anything');

    /* Today is already logged by the Seen mark, so the button has to say so rather than
       silently doing nothing. */
    again.click();
    assert.equal(hooks.getUserMarks(true)[id].viewings.length, 1,
        'a second click on the same day is not a second viewing');

    /* A viewing on another day is. Seeded as an older date so the button's own "today"
       is genuinely new, which is the path a person takes on a rewatch. */
    hooks.setStoredSetting('userMarks', {
        [id]:{ v:2, state:'watched', title:'Seen before', ts:1, viewings:[{ date:'2019-04-02' }] },
    });
    hooks.stopFeature('watchedMarking');
    hooks.initFeature('watchedMarking');
    const repainted = window.document.querySelector(`.enh-markable-card[data-enh-mark-id="${id}"]`);
    repainted.querySelector('[data-enh-mark-action="again"]').click();
    assert.equal(hooks.getUserMarks(true)[id].viewings.length, 2, 'today joins the older date');
    assert.match(repainted.querySelector('.enh-mark-badge').textContent, /x2/i,
        'and the badge carries the rewatch count without waiting for a reload');

    /* A refused write is a third thing, and it used to be reported as the second: the
       storage layer said what went wrong, and the message that followed replaced it with
       "already logged today". Somebody is told their viewing is safe when nothing was
       stored, and the only explanation is wiped off the screen. */
    const realSetValue = window.GM_setValue;
    window.GM_setValue = (key, value) => {
        if (key === 'imdb_enh_userMarks') throw new Error('quota');
        return realSetValue(key, value);
    };
    try {
        hooks.setStoredSetting('userMarks', {
            [id]:{ v:2, state:'watched', title:'Seen before', ts:1, viewings:[{ date:'2018-01-02' }] },
        });
    } catch { /* the seed goes through the same door and is refused too; that is the point */ }
    window.GM_setValue = realSetValue;
    hooks.setStoredSetting('userMarks', {
        [id]:{ v:2, state:'watched', title:'Seen before', ts:1, viewings:[{ date:'2018-01-02' }] },
    });
    hooks.getUserMarks(true);
    window.GM_setValue = (key, value) => {
        if (key === 'imdb_enh_userMarks') throw new Error('quota');
        return realSetValue(key, value);
    };
    hooks.stopFeature('watchedMarking');
    hooks.initFeature('watchedMarking');
    window.document.querySelector(`.enh-markable-card[data-enh-mark-id="${id}"] [data-enh-mark-action="again"]`).click();
    const toast = window.document.getElementById('enh-toast');
    assert.ok(toast, 'a refused write still says something');
    assert.doesNotMatch(toast.textContent, /already logged/i,
        'and what it says is not that the viewing is already safely recorded');
    window.GM_setValue = realSetValue;

    /* IE-107 from here: the same page, turned into a series. The marks for a show's
       episodes were in the store and its own page said nothing about them. */
    hooks.stopFeature('watchedMarking');
    hooks.forgetStructuredData();
    const seriesId = makeSeriesPage(window, 0);
    seedEpisodeMarks(hooks, seriesId);
    hooks.initFeature('watchedMarking');
    const episodes = episodeBadge(window);
    assert.ok(episodes, 'a series with episode marks says how many were watched');
    assert.match(episodes.textContent, /\b2\b/,
        'the two that were watched, not the skip and not the other show');
    assert.doesNotMatch(episodes.textContent, /\bof\b/i,
        'and no total, because nothing on this page says what it is');

    /* The page does carry the total sometimes, and it is read from the data IMDb ships
       with the page rather than asked for, which is the whole constraint on this.
       Repainted the way the page's own observer repaints it rather than by restarting the
       feature, which is both what happens on a real page and the only way this fixture
       survives: a happy-dom window does not give the memory back between restarts. */
    hooks.forgetStructuredData();
    makeSeriesPage(window, 62);
    hooks.rescanMarks();
    assert.match(episodeBadge(window).textContent, /2\D+62/,
        'seen against the total the page already carries');

    /* A total smaller than the count is a total for something else, or a page mid-render.
       "Seen 2 of 1 episodes" reads as a bug in the count rather than in the page. */
    hooks.forgetStructuredData();
    makeSeriesPage(window, 1);
    hooks.rescanMarks();
    assert.doesNotMatch(episodeBadge(window).textContent, /\bof\b/i,
        'a total below the count is not a total, and nothing is claimed');
    assert.match(episodeBadge(window).textContent, /\b2\b/, 'the count itself still stands');

    // Nothing marked, nothing said. An empty badge is worse than no badge.
    hooks.setStoredSetting('userMarks', {});
    hooks.getUserMarks(true);
    hooks.rescanMarks();
    assert.ok(episodeBadge(window) === null, 'a show with no episode marks carries no badge');

    hooks.stopFeature('watchedMarking');
    assert.ok(episodeBadge(window) === null, 'switching the feature off takes it away');
    window.GM_setValue('imdb_enh_watchedMarking', false);
    hooks.setStoredSetting('userMarks', {});

    /* The other half of the link: an episode's own page names its series in the same
       structured data everything else here is read from, so marking an episode Seen from
       that page records what it belongs to at no cost and with no request. */
    hooks.forgetStructuredData();
    const ld = window.document.querySelector('script[type="application/ld+json"]');
    ld.textContent = JSON.stringify({
        '@type':'TVEpisode',
        url:`https://www.imdb.com/title/${seriesId}/`,
        name:'An episode',
        partOfSeries:{ '@type':'TVSeries', url:'https://www.imdb.com/title/tt0306414/' },
    });
    assert.equal(hooks.readCurrentTitleMarkMetadata(seriesId).series, 'tt0306414',
        'an episode page records the show it belongs to');

    /* And a page that names itself as its own series records nothing, or a series would
       count its own page as one of its episodes. */
    hooks.forgetStructuredData();
    ld.textContent = JSON.stringify({
        '@type':'TVSeries',
        url:`https://www.imdb.com/title/${seriesId}/`,
        name:'A Show',
        partOfSeries:{ '@type':'TVSeries', url:`https://www.imdb.com/title/${seriesId}/` },
    });
    assert.equal(hooks.readCurrentTitleMarkMetadata(seriesId).series, undefined,
        'a title is never an episode of itself');
});

/* IE-116: marks only ever showed on cards with a poster, and most links to a title on
   IMDb are not that. Trivia, plot text, awards and review bodies are plain anchors, so a
   title somebody had already watched read exactly like one they had not. */
await runFixture('title', async (window, hooks) => {
    const trivia = window.document.createElement('section');
    trivia.innerHTML = '<p>Compare <a href="/title/tt0133093/">The Matrix</a>, '
        + '<a href="/title/tt2395385/">a skipped one</a> and '
        + '<a href="/title/tt0111161/">one with no mark</a>.</p>';
    window.document.body.appendChild(trivia);
    const link = id => trivia.querySelector(`a[href="/title/${id}/"]`);
    const mark = anchor => anchor.getAttribute('data-enh-link-mark');

    window.GM_setValue('imdb_enh_watchedMarking', true);
    hooks.setStoredSetting('userMarks', {
        tt0133093:{ v:2, state:'watched', title:'The Matrix', ts:1,
            note:'Worth another look', viewings:[{ date:'2019-04-02' }, { date:'2024-01-15' }] },
        tt2395385:{ v:2, state:'skip', title:'Passed', ts:2 },
    });
    hooks.getUserMarks(true);

    assert.equal(hooks.getStoredSetting('markLinkTint'), false,
        'off by default: it writes on every title link on the page');
    window.GM_setValue('imdb_enh_markLinkTint', true);
    hooks.initFeature('markLinkTint');

    assert.equal(mark(link('tt0133093')), 'watched', 'a plain link to something seen says so');
    assert.equal(mark(link('tt2395385')), 'skip', 'and one to something skipped');
    assert.equal(mark(link('tt0111161')), null, 'an unmarked title is left exactly as it was');

    /* The tooltip carries what the tint cannot: how many times, and whether there is a
       note waiting that the person has probably forgotten writing. */
    assert.match(link('tt0133093').title, /seen/i);
    assert.match(link('tt0133093').title, /x2/i, 'the rewatch count');
    assert.match(link('tt0133093').title, /note/i, 'and that a note is there');
    assert.doesNotMatch(link('tt0133093').title, /Worth another look/,
        'but not the note itself, which is not what a link tooltip is for');

    /* Never over a tooltip IMDb wrote. Somebody hovering a link to read what the site
       says about it should still get that. */
    const owned = link('tt0111161');
    owned.title = 'IMDb says something here';
    hooks.setStoredSetting('userMarks', {
        ...hooks.getUserMarks(true),
        tt0111161:{ v:2, state:'watched', title:'Shawshank', ts:3 },
    });
    hooks.getUserMarks(true);
    window.document.dispatchEvent(new window.CustomEvent('imdb-enhanced:marks-updated'));
    assert.equal(mark(owned), 'watched', 'it is still marked');
    assert.equal(owned.title, 'IMDb says something here', 'and IMDb keeps its own tooltip');

    /* The tooltip has to keep up with the record. A rewatch and a note change neither the
       state nor the address, so keying the repaint on the state alone left the link saying
       "Local seen" forever, which is exactly what this feature promises it says. */
    hooks.setStoredSetting('userMarks', {
        ...hooks.getUserMarks(true),
        tt2395385:{ v:2, state:'skip', title:'Passed', ts:2, note:'not for me' },
    });
    hooks.getUserMarks(true);
    window.document.dispatchEvent(new window.CustomEvent('imdb-enhanced:marks-updated'));
    assert.match(link('tt2395385').title, /note/i, 'a note written later reaches the tooltip');
    hooks.setStoredSetting('userMarks', {
        ...hooks.getUserMarks(true),
        tt2395385:{ v:2, state:'skip', title:'Passed', ts:2 },
    });
    hooks.getUserMarks(true);
    window.document.dispatchEvent(new window.CustomEvent('imdb-enhanced:marks-updated'));
    assert.doesNotMatch(link('tt2395385').title, /note/i, 'and deleting it takes the words away again');

    /* IMDb's SPA reuses anchor nodes and rewrites their href. Without noticing that, a
       link that used to point at something seen keeps the underline and the tooltip while
       pointing somewhere the person has never marked. */
    const reused = link('tt0133093');
    reused.setAttribute('href', '/title/tt9999999/');
    await new Promise(resolve => window.setTimeout(resolve, 0));
    assert.equal(mark(reused), null, 'an anchor pointed somewhere else loses the mark that was not its');
    assert.equal(reused.title, '', 'and the tooltip that went with it');
    reused.setAttribute('href', '/title/tt0133093/');
    await new Promise(resolve => window.setTimeout(resolve, 0));
    assert.equal(mark(reused), 'watched', 'and gets it back when it points there again');

    /* The hard case: moved between two titles the tooltip describes identically. Nothing
       visible changes, so only knowing which title it was decorated for catches it, and
       without that the extension is holding a mark against the wrong film. */
    hooks.setStoredSetting('userMarks', {
        ...hooks.getUserMarks(true),
        tt0068646:{ v:2, state:'watched', title:'Another seen one', ts:9 },
    });
    hooks.getUserMarks(true);
    reused.setAttribute('href', '/title/tt0111161/');
    await new Promise(resolve => window.setTimeout(resolve, 0));
    const plainLabel = reused.title;
    reused.setAttribute('href', '/title/tt0068646/');
    await new Promise(resolve => window.setTimeout(resolve, 0));
    assert.equal(reused.title, plainLabel, 'the two read the same, which is what makes this hard');
    assert.equal(reused.getAttribute('data-enh-link-mark-id'), 'tt0068646',
        'a link moved between two identical-looking marks follows the title it points at');
    reused.setAttribute('href', '/title/tt0133093/');
    await new Promise(resolve => window.setTimeout(resolve, 0));

    /* This script's own interface is not a page to decorate, and an anchor that ends up
       inside it has to be cleaned rather than skipped: skipping leaves whatever was
       written on it before it moved. */
    const panel = window.document.createElement('div');
    panel.id = 'enh-settings-panel';
    window.document.body.appendChild(panel);
    const inPanel = link('tt2395385');
    assert.equal(mark(inPanel), 'skip', 'decorated where it was');
    panel.appendChild(inPanel);
    hooks.rescanLinkMarks();
    assert.equal(mark(inPanel), null, 'and cleaned when it lands somewhere this does not decorate');
    assert.equal(inPanel.title, '', 'tooltip included');
    trivia.querySelector('p').appendChild(inPanel);
    panel.remove();
    hooks.rescanLinkMarks();
    assert.equal(mark(inPanel), 'skip', 'and decorated again once it is back on the page');

    /* A card already carries a badge and a set of controls. Underlining its title as well
       says the same thing twice in the same place. */
    const card = window.document.createElement('div');
    card.className = 'enh-markable-card';
    card.innerHTML = '<a href="/title/tt0133093/">On a card</a>';
    window.document.body.appendChild(card);
    hooks.rescanLinkMarks();
    assert.equal(mark(card.querySelector('a')), null,
        'a link inside a decorated card is left to that card');

    /* An idle page has to stay idle. This writes into the subtree its own observer
       watches, so an unconditional write is a repaint that feeds itself. */
    let records = 0;
    const watcher = new window.MutationObserver(list => { records += list.length; });
    watcher.observe(window.document.documentElement, { childList:true, subtree:true, attributes:true });
    hooks.rescanLinkMarks();
    hooks.rescanLinkMarks();
    await new Promise(resolve => window.setTimeout(resolve, 0));
    watcher.disconnect();
    assert.equal(records, 0, 'scanning a page whose marks have not changed writes nothing at all');

    hooks.stopFeature('markLinkTint');
    assert.equal(mark(link('tt0133093')), null, 'switching it off takes the marks off the links');
    assert.equal(link('tt0133093').title, '', 'and the tooltip it added with them');
    assert.equal(owned.title, 'IMDb says something here', 'while leaving IMDb\'s alone');

    /* IE-120: how old the billed cast were when a title came out. The captured fixture
       keeps the cast section and the sanitiser strips its rows, so the rows are built
       here; what matters is that a name IMDb links to is matched to what Wikidata knew
       about it, and that somebody it did not know gets nothing rather than a guess. */
    const cast = window.document.createElement('div');
    cast.innerHTML = '<div data-testid="title-cast-item"><a href="/name/nm0000206/">Keanu Reeves</a></div>'
        + '<div data-testid="title-cast-item"><a href="/name/nm0000401/">Laurence Fishburne</a></div>'
        + '<div data-testid="title-cast-item"><a href="/name/nm0005251/">Somebody Unknown</a></div>';
    window.document.body.appendChild(cast);
    const items = [...cast.querySelectorAll('[data-testid="title-cast-item"]')];

    assert.deepEqual(Array.from(hooks.collectCastNameIds(cast)),
        ['nm0000206', 'nm0000401', 'nm0005251'],
        'the names come from the links the page already carries');

    /* A full cast list runs to hundreds. The query is bounded, so the walk that feeds it
       has to stop in the same place, or the ceiling is enforced by throwing work away
       after doing it. */
    const long = window.document.createElement('div');
    long.innerHTML = Array.from({ length:60 }, (_, index) =>
        `<div data-testid="title-cast-item"><a href="/name/nm${String(2000000 + index).padStart(7, '0')}/">x</a></div>`).join('');
    window.document.body.appendChild(long);
    assert.equal(hooks.collectCastNameIds(long).length, 18,
        'the walk stops at the same ceiling the query has');
    long.remove();

    hooks.paintCastAges({ nm0000206:1964, nm0000401:1961 }, 1999);
    assert.match(items[0].textContent, /was ~35/, 'born in 1964, released in 1999');
    assert.match(items[1].textContent, /was ~38/);
    assert.ok(items[2].querySelector('.enh-cast-age') === null,
        'somebody Wikidata does not know gets nothing at all');

    // Painted once. This runs over a list that IMDb re-renders as it loads.
    hooks.paintCastAges({ nm0000206:1964, nm0000401:1961 }, 1999);
    assert.equal(items[0].querySelectorAll('.enh-cast-age').length, 1, 'and not again on a second pass');

    hooks.stopFeature('castAges');
    assert.ok(cast.querySelector('.enh-cast-age') === null, 'switching it off takes the ages away');
    cast.remove();

    trivia.remove();
    card.remove();
    window.GM_setValue('imdb_enh_markLinkTint', false);
    window.GM_setValue('imdb_enh_watchedMarking', false);
    hooks.setStoredSetting('userMarks', {});
});

/* IE-115: the featured review puts one stranger's opinion above the fold, and which one
   is not a choice anybody made. Hiding it must leave the way into the reviews intact, or
   the toggle trades an irritation for a missing section. */
await runFixture('title', async (window, hooks) => {
    const section = window.document.querySelector('section[data-testid="UserReviews"]');
    assert.ok(section, 'the fixture carries the reviews section');
    /* The captured fixture holds the section and its heading; the cards themselves are
       stripped by the sanitiser, so the two shapes IMDb has shipped them in are built
       here. Either match alone is enough, so both are exercised. */
    section.insertAdjacentHTML('beforeend',
        '<div data-testid="reviews-header"><a href="/title/tt0133093/reviews/">1.2K reviews</a></div>'
        + '<article class="user-review-item"><span>Semantic markup</span></article>'
        + '<div data-testid="review-card-parent"><span>Testid markup</span></div>');
    const cards = [...section.querySelectorAll('article, [data-testid="review-card-parent"]')];
    assert.equal(cards.length, 2, 'both shapes are on the page before anything hides them');
    const shown = node => window.getComputedStyle(node).display !== 'none';

    assert.equal(hooks.getStoredSetting('removeFeaturedReview'), false,
        'off by default: the section as IMDb ships it is what most people expect');
    assert.ok(cards.every(shown), 'and nothing is hidden until it is switched on');

    window.GM_setValue('imdb_enh_removeFeaturedReview', true);
    hooks.initFeature('removeFeaturedReview');
    assert.ok(!cards.some(shown), 'both shapes of review card go');
    assert.ok(shown(section), 'the section itself stays');
    assert.ok(shown(section.querySelector('h2, h3')), 'so does its heading');
    const link = section.querySelector('a[href*="/reviews"]');
    assert.ok(shown(link) && shown(link.parentElement),
        'and the way through to all of them, which is the point of leaving the section');

    hooks.stopFeature('removeFeaturedReview');
    assert.ok(cards.every(shown), 'switching it off gives the reviews back');
    window.GM_setValue('imdb_enh_removeFeaturedReview', false);
});

/* IE-114: a fresh install says nothing about itself. Nothing on IMDb explains the gear
   button, an unpacked extension has no store listing to explain it either, and a
   userscript has no listing at all, so the first page a new install renders is the only
   chance to point at where the settings live. Once, and then never again. */
await runFixture('title', async (window, hooks) => {
    const notice = () => window.document.getElementById('enh-first-run');
    assert.ok(notice() === null, 'nothing is shown before the first init asks for it');

    /* It points at the gear button, so it says nothing until there is one, and it must
       not spend the one time it gets to say anything on a page with nothing to point at. */
    hooks.showFirstRunNotice();
    assert.ok(notice() === null, 'no gear button, nothing to point at');
    assert.equal(window.GM_getValue('imdb_enh_firstRunSeen', false), false,
        'and the one chance to say it is not spent on a page that could not');

    hooks.createFAB();
    hooks.showFirstRunNotice();
    const shown = notice();
    assert.ok(shown, 'a new install is told the extension is running');
    assert.equal(shown.getAttribute('role'), 'status',
        'announced politely rather than as an alert, and never as a dialog');
    assert.match(shown.textContent, /gear/i, 'and told where the settings are');
    assert.notEqual(window.document.activeElement, shown.querySelector('button'),
        'reading a page must not have focus taken away from it');
    assert.ok(window.document.getElementById('enh-settings-fab'),
        'the thing it points at has to be on the page by the time it says so');

    /* Dismissed by hand. The dismiss button is the whole reason this is not a toast: a
       toast is click-through by design so it cannot swallow a click meant for IMDb. */
    shown.querySelector('button').click();
    assert.ok(notice() === null, 'clicking dismiss takes it away');

    /* And it is recorded, so the second page load of an install that has already been
       greeted says nothing. This is the whole feature: a welcome that repeats is worse
       than no welcome. */
    hooks.showFirstRunNotice();
    assert.ok(notice() === null, 'once per install, not once per page');
    assert.equal(window.GM_getValue('imdb_enh_firstRunSeen', false), true,
        'the flag lives outside the defaults, so resetting settings cannot bring it back');

    /* An update notice already occupies that corner and says something more useful. */
    window.GM_setValue('imdb_enh_firstRunSeen', false);
    const update = window.document.createElement('div');
    update.id = 'enh-update-notice';
    window.document.body.appendChild(update);
    hooks.showFirstRunNotice();
    assert.ok(notice() === null, 'the two never stack in the same corner');
    update.remove();

    /* Shown once more now the corner is free, which proves the check above was about the
       update notice rather than the flag having quietly been set anyway. */
    hooks.showFirstRunNotice();
    assert.ok(notice(), 'and it is still owed to somebody who has not seen it');
    notice().remove();
    hooks.destroySettingsChrome();
});

/* IE-21: the preview has to appear for someone tabbing through the cast list, not only
   for a mouse, and it has to come down again. A feature that only answers mouseover is
   the half of this that is easy to write and useless with a keyboard. */
await runFixture('title', async (window, hooks) => {
    const cast = window.document.createElement('div');
    cast.innerHTML = '<a href="/name/nm0000206/"><div data-testid="title-cast-item__avatar">'
        + '<img alt="Keanu Reeves" src="https://m.media-amazon.com/images/M/MV5BCAST._V1_QL75_UX140_.jpg">'
        + '</div></a>';
    window.document.body.appendChild(cast);
    const thumbnail = cast.querySelector('img');
    const link = cast.querySelector('a');

    hooks.initFeature('imageZoom');

    // Hover.
    thumbnail.dispatchEvent(new window.MouseEvent('mouseover', { bubbles:true }));
    let overlay = window.document.querySelector('.enh-zoom');
    assert.ok(overlay, 'hovering a cast thumbnail should show a preview');
    assert.equal(overlay.querySelector('img').getAttribute('src'),
        'https://m.media-amazon.com/images/M/MV5BCAST._V1_QL90_UY800_.jpg',
        'and it should ask for a bounded variant, not the original');

    thumbnail.dispatchEvent(new window.MouseEvent('mouseout', { bubbles:true }));
    assert.equal(window.document.querySelector('.enh-zoom'), null, 'and take it down again');

    // Keyboard: focus reaches the link, not the image inside it.
    link.dispatchEvent(new window.FocusEvent('focusin', { bubbles:true }));
    overlay = window.document.querySelector('.enh-zoom');
    assert.ok(overlay, 'tabbing to the cast link should show the same preview');

    window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
    assert.equal(window.document.querySelector('.enh-zoom'), null, 'and Escape should dismiss it');

    /* A variant IMDb does not have answers with an error rather than a picture, and an
       empty frame beside the thumbnail is worse than no feature at all. */
    const broken = window.document.querySelector('.enh-zoom__image');
    assert.equal(broken, null, 'nothing should be showing at this point');
    thumbnail.dispatchEvent(new window.MouseEvent('mouseover', { bubbles:true }));
    window.document.querySelector('.enh-zoom__image').dispatchEvent(new window.Event('error'));
    assert.equal(window.document.querySelector('.enh-zoom'), null,
        'an image that will not load takes its own overlay down');

    /* The poster is the other half of what the item names, and it is reached by its own
       test id rather than by being inside a cast row. */
    const poster = window.document.querySelector('[data-testid="hero-media__poster"] img');
    assert.ok(poster, 'the fixture should carry the hero poster');
    poster.setAttribute('src', 'https://m.media-amazon.com/images/M/MV5BPOSTER._V1_QL75_UX190_.jpg');
    poster.dispatchEvent(new window.MouseEvent('mouseover', { bubbles:true }));
    assert.ok(window.document.querySelector('.enh-zoom'), 'hovering the poster shows a preview too');
    poster.dispatchEvent(new window.MouseEvent('mouseout', { bubbles:true }));

    /* IE-121: the same preview on the two engine shapes it has to serve. happy-dom
       has no showPopover, so what runs first here is the fallback every engine
       without the top layer gets — the absolute placement and the arithmetic. */
    thumbnail.dispatchEvent(new window.MouseEvent('mouseover', { bubbles:true }));
    const unpromoted = requireSelector(window.document, '.enh-zoom');
    assert.equal(unpromoted.getAttribute('popover'), null,
        'an engine without showPopover must not carry a popover attribute');
    assert.ok(unpromoted.style.left && unpromoted.style.top,
        'and it keeps positioning itself the way it always has');
    assert.equal(thumbnail.style.getPropertyValue('anchor-name'), '',
        "and leaves nothing behind on IMDb's own element");
    thumbnail.dispatchEvent(new window.MouseEvent('mouseout', { bubbles:true }));

    const shownPopovers = [];
    const hiddenPopovers = [];
    window.HTMLElement.prototype.showPopover = function showPopover() { shownPopovers.push(this); };
    window.HTMLElement.prototype.hidePopover = function hidePopover() { hiddenPopovers.push(this); };
    try {
        thumbnail.dispatchEvent(new window.MouseEvent('mouseover', { bubbles:true }));
        const promoted = requireSelector(window.document, '.enh-zoom');
        assert.equal(promoted.getAttribute('popover'), 'manual',
            'an engine with the top layer promotes the preview into it');
        assert.equal(shownPopovers[0], promoted,
            'and actually shows it, rather than labelling an element the UA sheet hides');
        assert.equal(promoted.style.getPropertyValue('position-anchor'), '',
            'the preview does not use an anchor that can carry it beyond the viewport');
        assert.equal(thumbnail.style.getPropertyValue('anchor-name'), '',
            "and never writes a temporary name onto IMDb's thumbnail");
        assert.ok(promoted.style.left && promoted.style.top,
            'the viewport-clamped placement also owns top-layer previews');
        thumbnail.dispatchEvent(new window.MouseEvent('mouseout', { bubbles:true }));
        assert.equal(hiddenPopovers[0], promoted, 'and it leaves the top layer on the way out');
        assert.equal(thumbnail.style.getPropertyValue('anchor-name'), '',
            "and the name comes back off IMDb's element");
    } finally {
        delete window.HTMLElement.prototype.showPopover;
        delete window.HTMLElement.prototype.hidePopover;
    }

    /* The engine shape in between: showPopover but no anchor positioning, which is every
       Firefox before 147 and every Safari before 26. The top layer's containing block is
       the viewport, so a surface that positions itself against a thumbnail has to stay
       out of it there. happy-dom answers CSS.supports with yes for anything, so the
       answer is stubbed on the prototype the window hands out a fresh CSS object from. */
    const cssPrototype = Object.getPrototypeOf(window.CSS);
    const realSupports = cssPrototype.supports;
    window.HTMLElement.prototype.showPopover = function showPopover() { shownPopovers.push(this); };
    window.HTMLElement.prototype.hidePopover = function hidePopover() { hiddenPopovers.push(this); };
    cssPrototype.supports = property => property !== 'anchor-name';
    try {
        const shownBefore = shownPopovers.length;
        thumbnail.dispatchEvent(new window.MouseEvent('mouseover', { bubbles:true }));
        const unanchored = requireSelector(window.document, '.enh-zoom');
        assert.equal(unanchored.getAttribute('popover'), 'manual',
            'an engine that cannot anchor can still put the measured preview in the top layer');
        assert.equal(shownPopovers.length, shownBefore + 1, 'and shows it there');
        assert.ok(unanchored.style.left && unanchored.style.top,
            'while keeping the same viewport-clamped placement');
        assert.equal(thumbnail.style.getPropertyValue('anchor-name'), '',
            'and nothing is written onto the thumbnail');
        thumbnail.dispatchEvent(new window.MouseEvent('mouseout', { bubbles:true }));
    } finally {
        cssPrototype.supports = realSupports;
        delete window.HTMLElement.prototype.showPopover;
        delete window.HTMLElement.prototype.hidePopover;
    }

    /* A popover attribute on an element that would not open is worse than no promotion:
       the UA stylesheet hides it. Refusing to show has to leave nothing behind. */
    window.HTMLElement.prototype.showPopover = function showPopover() { throw new Error('not showable'); };
    window.HTMLElement.prototype.hidePopover = function hidePopover() {};
    try {
        thumbnail.dispatchEvent(new window.MouseEvent('mouseover', { bubbles:true }));
        const refused = requireSelector(window.document, '.enh-zoom');
        assert.equal(refused.getAttribute('popover'), null,
            'a refused showPopover must take the attribute back off');
        assert.equal(refused.style.getPropertyValue('position-anchor'), '');
        assert.equal(thumbnail.style.getPropertyValue('anchor-name'), '');
        assert.ok(refused.style.left && refused.style.top,
            'and the preview still appears, placed the old way');
        thumbnail.dispatchEvent(new window.MouseEvent('mouseout', { bubbles:true }));
    } finally {
        delete window.HTMLElement.prototype.showPopover;
        delete window.HTMLElement.prototype.hidePopover;
    }

    /* An image IMDb serves from somewhere else, or under a name with no transform in it,
       is left alone rather than rewritten into an address that means something else. */
    thumbnail.setAttribute('src', 'https://example.test/poster.jpg');
    thumbnail.dispatchEvent(new window.MouseEvent('mouseover', { bubbles:true }));
    assert.equal(window.document.querySelector('.enh-zoom'), null,
        'an image that is not theirs gets no preview');

    hooks.stopFeature('imageZoom');
    thumbnail.setAttribute('src', 'https://m.media-amazon.com/images/M/MV5BCAST._V1_QL75_UX140_.jpg');
    thumbnail.dispatchEvent(new window.MouseEvent('mouseover', { bubbles:true }));
    assert.equal(window.document.querySelector('.enh-zoom'), null,
        'and a feature that is off listens to nothing');
    cast.remove();

    /* IE-121: the expanded link menu is the anchored dropdown with a keyboard contract
       of its own — arrow keys, Escape back to the trigger, Tab out. Promoting it into
       the top layer must not change any of that. */
    hooks.initFeature('expandedLinkMenu');
    const menuTrigger = await waitForSelector(window, '#enh-link-menu-trigger');
    const menuDropdown = requireSelector(window.document, '#enh-link-menu-dropdown');
    menuTrigger.click();
    assert.ok(menuDropdown.classList.contains('enh-visible'), 'the menu opens');
    assert.equal(menuDropdown.getAttribute('popover'), null,
        'without showPopover it stays a z-indexed absolute box');
    menuTrigger.click();

    const menuShown = [];
    const menuHidden = [];
    window.HTMLElement.prototype.showPopover = function showPopover() { menuShown.push(this); };
    window.HTMLElement.prototype.hidePopover = function hidePopover() { menuHidden.push(this); };
    try {
        menuTrigger.click();
        assert.equal(menuDropdown.getAttribute('popover'), 'manual', 'and the top layer where there is one');
        assert.equal(menuShown[0], menuDropdown, 'shown, not merely labelled');
        assert.equal(menuTrigger.style.getPropertyValue('anchor-name'),
            menuDropdown.style.getPropertyValue('position-anchor'),
            'anchored to the button that opened it');
        assert.ok(menuDropdown.classList.contains('enh-visible'),
            'the class that carries the display stays, so a fallback rule still applies');
        /* Opening an already-open menu — what ArrowDown on the trigger does — must not
           try to show a popover twice. */
        menuTrigger.dispatchEvent(new window.KeyboardEvent('keydown', { key:'ArrowDown', bubbles:true }));
        assert.equal(menuShown.length, 1, 'a second open does not show the same popover again');

        menuDropdown.dispatchEvent(new window.KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
        assert.equal(menuHidden[0], menuDropdown, 'Escape takes it out of the top layer');
        assert.equal(menuDropdown.getAttribute('popover'), null);
        assert.equal(menuTrigger.getAttribute('aria-expanded'), 'false');
        assert.equal(menuTrigger.style.getPropertyValue('anchor-name'), '');
    } finally {
        delete window.HTMLElement.prototype.showPopover;
        delete window.HTMLElement.prototype.hidePopover;
        hooks.stopFeature('expandedLinkMenu');
    }
});

await runFixture('title', async (window, hooks) => {
    assert.equal(hooks.getPageSurface(), 'title');
    assert.equal(hooks.getIMDbID(), 'tt0133093');
    assert.equal(hooks.getTitleText(), 'The Matrix');
    assert.equal(hooks.getTitleYear(), '1999');
    assert.equal(hooks.getMediaType(), 'movie');
    assert.equal(Number(hooks.getIMDbRating()), 8.7);
    requireSelector(window.document, '[data-testid="hero__primary-text"]');

    const correctionFixture = requireSelector(window.document, '#score-correction-fixtures').content;
    const correctionCandidates = [
        ['rottenTomatoes', hooks.parseRTSearchCandidates(
            requireSelector(correctionFixture, '[data-provider="rottenTomatoes"]').innerHTML, 'movie')],
        ['letterboxd', hooks.parseLetterboxdSearchCandidates(
            requireSelector(correctionFixture, '[data-provider="letterboxd"]').innerHTML)],
        ['metacritic', hooks.collectMetacriticCandidates(
            JSON.parse(requireSelector(correctionFixture, '[data-provider="metacritic"]').textContent).data.items, 'movie')],
        ['justWatch', hooks.parseJustWatchSearchCandidates(
            requireSelector(correctionFixture, '[data-provider="justWatch"]').innerHTML, 'movie', 'us')],
    ];
    correctionCandidates.forEach(([provider, candidates]) => {
        assert.deepEqual(Array.from(candidates, candidate => candidate.year), [1982, 2011]);
        assert.equal(hooks.rankScoreCorrectionCandidates(provider, candidates, 'The Thing', 1982)[0].year, 1982);
    });

    const correctionWidget = window.document.createElement('div');
    correctionWidget.className = 'enh-score-widget';
    requireSelector(window.document, '[data-testid="hero-rating-bar__aggregate-rating"]').appendChild(correctionWidget);
    const rtCandidates = hooks.rankScoreCorrectionCandidates(
        'rottenTomatoes', correctionCandidates[0][1], 'The Thing', 1982);
    hooks.appendScoreCorrectionAction(correctionWidget, 'rottenTomatoes', 'inlineRTScore', {
        loadCandidates:async () => rtCandidates,
        onApplied:() => {},
    });
    const correctionTrigger = requireSelector(correctionWidget, '.enh-score-correction-trigger');
    assert.match(correctionTrigger.getAttribute('aria-controls') || '', /rottenTomatoes-tt0133093$/);
    correctionTrigger.click();
    await waitForSelector(window, '.enh-score-correction__choice');
    assert.match(correctionWidget.style.marginBottom, /8px/,
        'an open correction panel must reserve room before the next score widget');
    assert.equal(requireSelector(correctionWidget, '.enh-score-correction').getAttribute('popover'), null,
        'IE-121: without showPopover the panel stays where the absolute placement puts it');
    requireSelector(correctionWidget, '.enh-score-correction').dispatchEvent(
        new window.KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
    assert.equal(correctionWidget.querySelector('.enh-score-correction'), null,
        'Escape must close the inline correction dialog');
    assert.equal(correctionWidget.style.marginBottom, '',
        'closing the correction panel must release its temporary score-rail space');
    correctionTrigger.click();
    await waitForSelector(window, '.enh-score-correction__choice');
    const manualInput = requireSelector(correctionWidget, '.enh-score-correction__input');
    manualInput.value = 'https://www.rottentomatoes.com/m/the_thing_1982';
    Array.from(correctionWidget.querySelectorAll('button'))
        .find(button => button.textContent === 'Save URL').click();
    assert.equal(hooks.getScoreCorrection('tt0133093', 'rottenTomatoes').url,
        'https://www.rottentomatoes.com/m/the_thing_1982');

    correctionTrigger.click();
    await waitForSelector(window, '.enh-score-correction__choice');
    const candidateChoice = Array.from(correctionWidget.querySelectorAll('.enh-score-correction__choice'))
        .find(button => /1982/.test(button.textContent));
    assert.ok(candidateChoice, 'the correction panel must list the exact-year candidate');
    candidateChoice.click();
    assert.equal(hooks.getScoreCorrection('tt0133093', 'rottenTomatoes').year, 1982);

    correctionTrigger.click();
    await waitForSelector(window, '.enh-score-correction__choice');
    Array.from(correctionWidget.querySelectorAll('button'))
        .find(button => button.textContent === 'No entry').click();
    assert.equal(hooks.getScoreCorrection('tt0133093', 'rottenTomatoes').mode, 'none');

    /* IE-121: the same panel on an engine that has the top layer. Escape and the focus
       return are the panel's own, not the platform's, so both have to still work. */
    const shownPanels = [];
    window.HTMLElement.prototype.showPopover = function showPopover() { shownPanels.push(this); };
    window.HTMLElement.prototype.hidePopover = function hidePopover() {};
    try {
        correctionTrigger.click();
        const panel = await waitForSelector(window, '.enh-score-correction');
        assert.equal(panel.getAttribute('popover'), 'manual', 'the panel is promoted into the top layer');
        assert.equal(shownPanels[0], panel, 'and shown there');
        const anchorName = panel.style.getPropertyValue('position-anchor');
        assert.match(anchorName, /^--enh-anchor-\d+$/, 'anchored rather than left in the page corner');
        assert.equal(correctionTrigger.style.getPropertyValue('anchor-name'), anchorName,
            'and anchored to the Wrong? button that opened it');
        panel.dispatchEvent(new window.KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
        assert.equal(correctionWidget.querySelector('.enh-score-correction'), null,
            'Escape must still close a panel that lives in the top layer');
        assert.equal(correctionTrigger.style.getPropertyValue('anchor-name'), '',
            'and the anchor name must not outlive the panel');
    } finally {
        delete window.HTMLElement.prototype.showPopover;
        delete window.HTMLElement.prototype.hidePopover;
    }

    const requestsBeforeSuppression = window.__fixtureRequests.length;
    assert.equal(hooks.initFeature('inlineRTScore'), true);
    const suppressedWidget = await waitForSelector(window, '#enh-rt-widget');
    assert.match(suppressedWidget.textContent, /Marked as no entry/);
    assert.equal(window.__fixtureRequests.length, requestsBeforeSuppression,
        'a saved no-entry choice must suppress provider retries');
    hooks.stopFeature('inlineRTScore');
    correctionWidget.remove();

    // Provider-backed fixtures must advance immediately to their deterministic response.
    // Visibility itself is not under test here, and happy-dom never intersects a node.
    window.IntersectionObserver = undefined;
    const imdbId = 'tt0133093';
    const useFixtureResponse = responder => {
        window.GM_xmlhttpRequest = options => {
            window.__fixtureRequests.push(options);
            window.queueMicrotask(() => {
                const response = responder(options);
                options.onload?.({ status:200, responseText:'', finalUrl:options.url, ...response });
            });
            return { abort() {} };
        };
    };

    const rtWrongIdentity = `<script type="application/ld+json">${JSON.stringify({
        '@type':'Movie', name:'Wrong Film', dateCreated:'2020',
        url:'https://www.rottentomatoes.com/m/wrong-film',
        aggregateRating:{ ratingValue:'99' },
    })}</script>`;
    assert(hooks.setScoreCorrection(imdbId, 'rottenTomatoes', {
        mode:'url', url:'https://www.rottentomatoes.com/m/the_matrix', title:'The Matrix', year:1999,
    }));
    useFixtureResponse(() => ({
        responseText:rtWrongIdentity,
        finalUrl:'https://www.rottentomatoes.com/search?search=the%20matrix',
    }));
    await hooks.runFeature('inlineRTScore');
    assert.match(requireSelector(window.document, '#enh-rt-widget').textContent,
        /Saved Rotten Tomatoes match unavailable/,
        'a correction redirected to a search page must not bless unrelated score markup');
    assert.equal(hooks.cacheGet(`rt_${imdbId}`), null,
        'an invalid Rotten Tomatoes final URL must not populate the title cache');
    hooks.stopFeature('inlineRTScore');

    const lbWrongIdentity = `<script type="application/ld+json">${JSON.stringify({
        '@type':'Movie', name:'Wrong Film', dateCreated:'2020',
        url:'https://letterboxd.com/film/wrong-film/',
        aggregateRating:{ ratingValue:'4.99', ratingCount:1 },
    })}</script>`;
    assert(hooks.setScoreCorrection(imdbId, 'letterboxd', {
        mode:'url', url:'https://letterboxd.com/film/the-matrix/', title:'The Matrix', year:1999,
    }));
    useFixtureResponse(() => ({
        responseText:lbWrongIdentity,
        finalUrl:'https://letterboxd.com/films/popular/',
    }));
    await hooks.runFeature('inlineLetterboxdScore');
    assert.match(requireSelector(window.document, '#enh-lb-widget').textContent,
        /Saved Letterboxd match unavailable/,
        'a correction redirected away from a title must not bless unrelated score markup');
    assert.equal(hooks.cacheGet(`lb_${imdbId}`), null,
        'an invalid Letterboxd final URL must not populate the title cache');
    hooks.stopFeature('inlineLetterboxdScore');

    // Availability cache misses must advance immediately to the offline request stub.
    const justWatchCache = {
        providers:['Netflix'],
        url:'https://www.justwatch.com/us/movie/the-matrix',
    };
    const tmdbCache = {
        source:'tmdb',
        region:'US',
        providers:['Max'],
        offers:{ stream:['Max'], rent:[], buy:[] },
        url:'https://www.themoviedb.org/movie/603/watch?locale=US',
    };
    hooks.cacheSet(hooks.getAvailabilityCacheKey(imdbId, 'justwatch', 'US'), justWatchCache);
    hooks.cacheSet(hooks.getAvailabilityCacheKey(imdbId, 'tmdb', 'US'), tmdbCache);

    window.GM_setValue('imdb_enh_availabilitySource', 'tmdb');
    window.GM_setValue('imdb_enh_availabilityRegion', 'US');
    await hooks.runFeature('streamAvailability');
    let availabilityWidget = requireSelector(window.document, '#enh-jw-widget');
    assert.match(availabilityWidget.textContent, /TMDB.*Max/s);
    assert.doesNotMatch(availabilityWidget.textContent, /Netflix/,
        'a cached JustWatch answer must not render while TMDB is selected');
    hooks.stopFeature('streamAvailability');

    window.GM_setValue('imdb_enh_availabilitySource', 'justwatch');
    await hooks.runFeature('streamAvailability');
    availabilityWidget = requireSelector(window.document, '#enh-jw-widget');
    assert.match(availabilityWidget.textContent, /JW.*Netflix/s);
    assert.doesNotMatch(availabilityWidget.textContent, /TMDB|Max/,
        'a cached TMDB answer and its attribution must not render while JustWatch is selected');
    hooks.stopFeature('streamAvailability');

    window.GM_setValue('imdb_enh_availabilitySource', 'tmdb');
    window.GM_setValue('imdb_enh_availabilityRegion', 'GB');
    await hooks.runFeature('streamAvailability');
    availabilityWidget = requireSelector(window.document, '#enh-jw-widget');
    assert.doesNotMatch(availabilityWidget.textContent, /Max/,
        'changing region must not render the previous region\'s cached TMDB answer');
    hooks.stopFeature('streamAvailability');

    window.GM_deleteValue(`cache_${hooks.getAvailabilityCacheKey(imdbId, 'justwatch', 'US')}`);
    hooks.cacheSet(`jw_${imdbId}`, {
        providers:['Legacy Stream'],
        url:'https://www.justwatch.com/us/movie/legacy',
    });
    window.GM_setValue('imdb_enh_availabilitySource', 'justwatch');
    window.GM_setValue('imdb_enh_availabilityRegion', 'US');
    const requestsBeforeLegacyRead = window.__fixtureRequests.length;
    await hooks.runFeature('streamAvailability');
    availabilityWidget = requireSelector(window.document, '#enh-jw-widget');
    assert.doesNotMatch(availabilityWidget.textContent, /Legacy Stream/,
        'the source-blind legacy cache key must be ignored after upgrade');
    assert.ok(window.__fixtureRequests.length > requestsBeforeLegacyRead,
        'ignoring a legacy cache entry must continue to a fresh provider lookup');
    hooks.stopFeature('streamAvailability');

    hooks.renderAvailability({
        source:'tmdb',
        region:'US',
        providers:['Max'],
        offers:{ stream:['Max'], rent:[], buy:[] },
        url:'https://www.themoviedb.org/movie/603/watch?locale=US',
    });
    let availabilityLink = requireSelector(window.document, '#enh-jw-widget a');
    assert.equal(availabilityLink.href, 'https://www.themoviedb.org/movie/603/watch?locale=US',
        'a TMDB payload must retain its validated TMDB watch link');
    assert.match(requireSelector(window.document, '#enh-jw-widget').textContent, /TMDB.*Via TMDB.*JustWatch/s,
        'TMDB data must keep its source label and required attribution');

    /* IE-119: where a show airs, with the link back their licence asks for. */
    hooks.renderAirsOn({
        network:'AMC', country:'US', streaming:false,
        url:'https://www.tvmaze.com/shows/169/breaking-bad',
    });
    const airsWidget = requireSelector(window.document, '#enh-tvmaze-widget');
    assert.match(airsWidget.textContent, /AIRS ON/, 'a broadcast network is where it airs');
    assert.match(airsWidget.textContent, /AMC \(US\)/, 'named with the country it airs in');
    assert.match(airsWidget.textContent, /TVmaze/, 'and credited, which their licence requires');
    assert.equal(requireSelector(window.document, '#enh-tvmaze-widget a').href,
        'https://www.tvmaze.com/shows/169/breaking-bad',
        'with the link back that credit is satisfied by');

    hooks.renderAirsOn({ network:'Netflix', country:'', streaming:true, url:'' });
    const streamsWidget = requireSelector(window.document, '#enh-tvmaze-widget');
    assert.match(streamsWidget.textContent, /STREAMS ON/,
        'a streaming original does not air anywhere');
    assert.doesNotMatch(streamsWidget.textContent, /\(\)/, 'and claims no country it does not have');
    assert.ok(window.document.querySelector('#enh-tvmaze-widget a') === null,
        'an answer with no usable link is still worth showing, without one');
    requireSelector(window.document, '#enh-tvmaze-widget').remove();

    /* IE-118: when it reached home. Only what TMDB holds for this region, and a film with
       no digital date says nothing rather than borrowing the theatrical one. */
    hooks.renderAvailability({
        source:'tmdb',
        region:'US',
        providers:['Max'],
        offers:{ stream:['Max'], rent:[], buy:[] },
        url:'https://www.themoviedb.org/movie/603/watch?locale=US',
        releases:{ digital:'2006-11-14', physical:'1999-09-21' },
    });
    let withReleases = requireSelector(window.document, '#enh-jw-widget').textContent;
    assert.match(withReleases, /Digital release: 2006-11-14/);
    assert.match(withReleases, /On disc: 1999-09-21/);

    hooks.renderAvailability({
        source:'tmdb',
        region:'US',
        providers:['Max'],
        offers:{ stream:['Max'], rent:[], buy:[] },
        url:'https://www.themoviedb.org/movie/603/watch?locale=US',
        releases:{ physical:'1999-09-21' },
    });
    withReleases = requireSelector(window.document, '#enh-jw-widget').textContent;
    assert.doesNotMatch(withReleases, /Digital release/, 'a date TMDB does not hold is not shown');
    assert.match(withReleases, /On disc: 1999-09-21/, 'while the one it does hold still is');

    hooks.renderAvailability({
        source:'tmdb',
        region:'US',
        providers:['Max'],
        offers:{ stream:['Max'], rent:[], buy:[] },
        url:'https://www.themoviedb.org/movie/603/watch?locale=US',
        releases:{ digital:'nonsense' },
    });
    assert.doesNotMatch(requireSelector(window.document, '#enh-jw-widget').textContent, /Digital release/,
        'and a stored value that is not a date is not rendered as one');

    hooks.renderAvailability({
        source:'tmdb',
        region:'US',
        providers:['Max'],
        offers:{ stream:['Max'], rent:[], buy:[] },
        url:'https://www.justwatch.com/us/movie/the-matrix',
    });
    availabilityLink = requireSelector(window.document, '#enh-jw-widget a');
    assert.equal(availabilityLink.href, 'https://www.themoviedb.org/search?query=The%20Matrix',
        'a TMDB payload must reject a watch link outside the TMDB trust boundary');

    hooks.renderAvailability({
        providers:['Netflix'],
        url:'https://www.justwatch.com/us/movie/the-matrix',
    });
    availabilityLink = requireSelector(window.document, '#enh-jw-widget a');
    assert.equal(availabilityLink.href, 'https://www.justwatch.com/us/movie/the-matrix',
        'a JustWatch payload must retain its JustWatch trust boundary');
    assert.match(requireSelector(window.document, '#enh-jw-widget').textContent, /JW.*Via JustWatch/s);
    assert.doesNotMatch(requireSelector(window.document, '#enh-jw-widget').textContent, /TMDB/,
        'TMDB attribution must never appear on JustWatch data');
    requireSelector(window.document, '#enh-jw-widget').remove();

    const justWatchHtml = '<meta name="description" content="Watch The Matrix online on Netflix today">'
        + `<script type="application/ld+json">${JSON.stringify({
            '@type':'Movie', name:'The Matrix', dateCreated:'1999-03-31',
        })}</script>`;
    assert(hooks.setScoreCorrection(imdbId, 'justWatch', {
        mode:'url', url:'https://www.justwatch.com/gb/movie/the-matrix', title:'The Matrix', year:1999,
    }));
    useFixtureResponse(options => ({ responseText:justWatchHtml, finalUrl:options.url }));
    window.GM_setValue('imdb_enh_availabilitySource', 'justwatch');
    window.GM_setValue('imdb_enh_availabilityRegion', 'US');
    const requestsBeforeUsCorrection = window.__fixtureRequests.length;
    await hooks.runFeature('streamAvailability');
    const usCorrectionRequests = window.__fixtureRequests.slice(requestsBeforeUsCorrection);
    assert.equal(usCorrectionRequests.length, 1);
    assert.equal(usCorrectionRequests[0].url, 'https://www.justwatch.com/us/movie/the-matrix',
        'a saved GB title must be requested through the active US region');
    assert.equal(hooks.cacheGet(hooks.getAvailabilityCacheKey(imdbId, 'justwatch', 'US')).url,
        'https://www.justwatch.com/us/movie/the-matrix');
    hooks.stopFeature('streamAvailability');

    window.GM_setValue('imdb_enh_availabilityRegion', 'GB');
    const requestsBeforeGbCorrection = window.__fixtureRequests.length;
    await hooks.runFeature('streamAvailability');
    const gbCorrectionRequests = window.__fixtureRequests.slice(requestsBeforeGbCorrection);
    assert.equal(gbCorrectionRequests.length, 1);
    assert.equal(gbCorrectionRequests[0].url, 'https://www.justwatch.com/gb/movie/the-matrix',
        'the same saved title must follow a later region change');
    assert.equal(hooks.cacheGet(hooks.getAvailabilityCacheKey(imdbId, 'justwatch', 'GB')).url,
        'https://www.justwatch.com/gb/movie/the-matrix');
    hooks.stopFeature('streamAvailability');
    assert(hooks.setScoreCorrection(imdbId, 'justWatch', null));

    const tmdbGbKey = hooks.getAvailabilityCacheKey(imdbId, 'tmdb', 'GB');
    window.GM_deleteValue(`cache_${tmdbGbKey}`);
    window.GM_setValue('imdb_enh_availabilitySource', 'tmdb');
    window.GM_setValue('imdb_enh_availabilityRegion', 'GB');
    window.GM_setValue('imdb_enh_tmdbReadToken', 'fixture-token');
    const tmdbStub = kind => options => ({
        responseText:JSON.stringify(
            options.url.includes('/3/find/')
                ? (kind === 'tv'
                    ? { movie_results:[], tv_results:[{ id:1396 }], tv_episode_results:[] }
                    : { movie_results:[{ id:603 }], tv_results:[], tv_episode_results:[] })
                : options.url.includes('/release_dates')
                    ? { results:[{ iso_3166_1:'GB', release_dates:[
                        { type:4, release_date:'2006-11-14T00:00:00.000Z' },
                    ] }] }
                    : { results:{ GB:{
                        link:'https://www.themoviedb.org/movie/603/watch?locale=GB',
                        flatrate:[], ads:[], rent:[], buy:[],
                    } } }),
    });
    useFixtureResponse(tmdbStub('movie'));
    const requestsBeforeTmdbNoOffer = window.__fixtureRequests.length;
    await hooks.runFeature('streamAvailability');
    availabilityWidget = requireSelector(window.document, '#enh-jw-widget');
    assert.match(availabilityWidget.textContent, /TMDB.*Not streamable in GB.*TMDB APIs.*JustWatch/s,
        'a fresh TMDB no-offer answer must retain its source, region, and attribution');
    availabilityLink = requireSelector(window.document, '#enh-jw-widget a');
    assert.equal(availabilityLink.href, 'https://www.themoviedb.org/movie/603/watch?locale=GB',
        'a fresh TMDB no-offer answer must link back to TMDB');
    /* IE-118 adds the third: the identity, the providers, and when it reached home. Kept
       exact, because this is the number that decides how much of somebody else's API a
       page visit costs. */
    const tmdbRequests = window.__fixtureRequests.slice(requestsBeforeTmdbNoOffer);
    assert.equal(tmdbRequests.length, 3,
        'a fresh TMDB answer needs an identity, a provider and a release-date request');
    assert.equal(tmdbRequests.filter(request => request.url.includes('/release_dates')).length, 1,
        'exactly one of them asks when it reached home');

    /* And none for a series: TMDB has no release_dates endpoint for one, so asking would
       be a request that can only fail. */
    window.GM_deleteValue(`cache_${tmdbGbKey}`);
    hooks.stopFeature('streamAvailability');
    useFixtureResponse(tmdbStub('tv'));
    const requestsBeforeSeries = window.__fixtureRequests.length;
    await hooks.runFeature('streamAvailability');
    const seriesRequests = window.__fixtureRequests.slice(requestsBeforeSeries);
    assert.equal(seriesRequests.filter(request => request.url.includes('/release_dates')).length, 0,
        'a series is never asked when it came out on disc');
    assert.equal(seriesRequests.length, 2, 'and costs the two requests it always did');
    window.GM_deleteValue(`cache_${tmdbGbKey}`);
    hooks.stopFeature('streamAvailability');
    useFixtureResponse(tmdbStub('movie'));
    await hooks.runFeature('streamAvailability');
    assert.match(requireSelector(window.document, '#enh-jw-widget').textContent,
        /Digital release: 2006-11-14/,
        'and the date the request went for is the one on the page');
    /* Cached with the rest of the answer, so a second visit says the same thing without
       asking again. */
    const cachedTmdb = hooks.cacheGet(tmdbGbKey);
    /* The nested object comes from the sandbox realm, so it is spread too: comparing it
       by reference reports a structure that matches as a mismatch. */
    assert.deepEqual({ ...cachedTmdb, releases:{ ...cachedTmdb.releases } }, {
        unavailable:true,
        reason:'region',
        source:'tmdb',
        region:'GB',
        url:'https://www.themoviedb.org/movie/603/watch?locale=GB',
        releases:{ digital:'2006-11-14' },
    });
    hooks.stopFeature('streamAvailability');

    const requestsBeforeCachedTmdb = window.__fixtureRequests.length;
    await hooks.runFeature('streamAvailability');
    availabilityWidget = requireSelector(window.document, '#enh-jw-widget');
    assert.match(availabilityWidget.textContent, /TMDB.*Not streamable in GB.*TMDB APIs.*JustWatch/s,
        'the cached TMDB no-offer answer must retain its source and region');
    assert.equal(requireSelector(window.document, '#enh-jw-widget a').href,
        'https://www.themoviedb.org/movie/603/watch?locale=GB',
        'the cached TMDB no-offer answer must not fall back to JustWatch');
    assert.equal(window.__fixtureRequests.length, requestsBeforeCachedTmdb,
        'a fresh cached no-offer answer must not contact TMDB again');
    hooks.stopFeature('streamAvailability');

    /* And the same on the answer that does list offers, which is the common one. Cached
       with it, so a second visit says when it reached home without asking again. */
    window.GM_deleteValue(`cache_${tmdbGbKey}`);
    useFixtureResponse(options => ({
        responseText:JSON.stringify(
            options.url.includes('/3/find/')
                ? { movie_results:[{ id:603 }], tv_results:[], tv_episode_results:[] }
                : options.url.includes('/release_dates')
                    ? { results:[{ iso_3166_1:'GB', release_dates:[
                        { type:5, release_date:'1999-09-21T00:00:00.000Z' },
                    ] }] }
                    : { results:{ GB:{
                        link:'https://www.themoviedb.org/movie/603/watch?locale=GB',
                        flatrate:[{ provider_name:'Max' }], ads:[], rent:[], buy:[],
                    } } }),
    }));
    await hooks.runFeature('streamAvailability');
    assert.match(requireSelector(window.document, '#enh-jw-widget').textContent,
        /On Max[\s\S]*On disc: 1999-09-21/,
        'an answer with offers carries the release date beside them');
    const cachedOffers = hooks.cacheGet(tmdbGbKey);
    assert.deepEqual({ ...cachedOffers.releases }, { physical:'1999-09-21' },
        'and it is cached with them, so a second visit does not ask again');
    hooks.stopFeature('streamAvailability');

    const emptyStats = hooks.createLocalStatsPanel();
    window.document.body.appendChild(emptyStats);
    assert.match(emptyStats.textContent, /No local viewing history yet/,
        'a fresh install must render the local-stats empty state');
    emptyStats.remove();

    assert.equal(hooks.initFeature('collapsibleSections'), true);
    assert.equal(hooks.initFeature('quickCopyID'), true);
    assert.equal(hooks.initFeature('titleNotes'), true);
    assert.equal(hooks.initFeature('watchedMarking'), true);
    requireSelector(window.document, 'section[data-testid="title-cast"] .enh-collapse-btn');
    const copy = await waitForSelector(window, '#enh-copy-id');
    assert.match(copy.textContent, /tt0133093/, 'quick-copy init must render the current title id');
    const note = await waitForSelector(window, '#enh-title-note-input');
    assert.match(note.getAttribute('aria-label') || '', /The Matrix/, 'private-note init must name the title');
    requireSelector(window.document, '[data-testid="hero-media__poster"] .enh-mark-btn--watched').click();
    const mark = hooks.getUserMarks().tt0133093;
    assert.equal(mark.year, 1999);
    assert.equal(mark.imdbRating, 8.7);
    assert.equal(mark.runtime, 136);
    assert.deepEqual(Array.from(mark.genres), ['Action', 'Sci-Fi']);
    const stats = hooks.summarizeLocalStats(hooks.getUserMarks());
    assert.equal(stats.seen, 1);
    assert.equal(stats.viewings, 1);

    window.GM_setValue('imdb_enh_availabilitySource', 'justwatch');
    window.GM_xmlhttpRequest = options => {
        window.__fixtureRequests.push(options);
        window.queueMicrotask(() => options.onerror?.({ error:'fixture network disabled' }));
        return { abort() {} };
    };
    hooks.createSettingsPanel();
    requireSelector(window.document, '#enh-local-stats-title');
    const regionInput = requireSelector(window.document, '#enh-setting-availabilityRegion');
    const regionField = regionInput.closest('.enh-servarr-field');
    assert.equal(regionField.hidden, false,
        'the region control must be visible when JustWatch is selected');
    const availabilitySource = requireSelector(window.document, '#enh-availability-source');
    availabilitySource.value = 'tmdb';
    availabilitySource.dispatchEvent(new window.Event('change', { bubbles:true }));
    assert.equal(regionField.hidden, false,
        'switching to TMDB must keep the shared region control visible');
    availabilitySource.value = 'justwatch';
    availabilitySource.dispatchEvent(new window.Event('change', { bubbles:true }));
    assert.equal(regionField.hidden, false,
        'switching back to JustWatch must keep the shared region control visible');
    assert.match(requireSelector(window.document, '.enh-stats-card').textContent, /Action/,
        'the rendered stats view must include metadata captured from the marked title');
    assert.match(requireSelector(window.document, '.enh-stats-card').textContent, /2:16/,
        'the rendered stats view must include known runtime');
    assert.equal(requireSelector(window.document, '#enh-csv-apply').disabled, true,
        'CSV apply must stay blocked until a preview has run');
    assert.match(requireSelector(window.document, '#enh-csv-file').closest('.enh-settings-card').textContent,
        /does not change IMDb Watched status/,
        'the rendered import control must distinguish local history from the IMDb account');
    const csvTextarea = requireSelector(window.document, '#enh-csv-textarea');
    csvTextarea.value = 'Const,Your Rating,Date Rated,Title\ntt0133093,9,2026-01-02,The Matrix';
    csvTextarea.dispatchEvent(new window.Event('input', { bubbles:true }));
    requireSelector(window.document, '#enh-csv-preview-btn').click();
    assert.match(requireSelector(window.document, '#enh-csv-preview').textContent, /1 row across 1 title/,
        'CSV preview must execute in the rendered Data page');
    assert.equal(requireSelector(window.document, '#enh-csv-apply').disabled, false,
        'a valid CSV preview must enable the transactional import action');

    /* Deleting a mark is the one action here that destroys something the user typed, and
       it used to be final. What has to come back is the whole record, not the identifier:
       a note and a viewing history restored as an empty stub would still read as a
       successful undo from the row count alone. */
    const markRows = () => Array.from(window.document.querySelectorAll('.enh-mark-row'));
    const undoButton = () => Array.from(window.document.querySelectorAll('.enh-settings-footer-btn'))
        .find(node => node.textContent === 'Undo delete');
    window.GM_setValue('imdb_enh_userMarks', {
        tt0133093: { state:'watched', title:'The Matrix', ts:10, note:'rewatch with the commentary', viewings:[{ date:'2026-01-02' }] },
        tt0903747: { state:'skip', title:'Breaking Bad', ts:20 },
    });
    window.document.dispatchEvent(new window.CustomEvent('imdb-enhanced:marks-updated'));
    assert.equal(markRows().length, 2, 'both seeded marks must render as rows');
    assert.equal(undoButton().hidden, true, 'nothing is offered back before anything is deleted');

    requireSelector(markRows()[0], '.enh-mark-row__clear').click();
    assert.equal(markRows().length, 1, 'removing a row must drop that record');
    assert.equal(undoButton().hidden, false, 'and must offer it back');

    requireSelector(markRows()[0], '.enh-mark-row__clear').click();
    assert.equal(markRows().length, 0, 'removing the last row must empty the list');

    undoButton().click();
    const restored = hooks.getUserMarks();
    assert.equal(Object.keys(restored).length, 2,
        'the snapshot covers the run, so both removals come back together');
    assert.equal(restored.tt0133093.note, 'rewatch with the commentary',
        'a restored record must keep the note that was deleted with it');
    // Compared field by field: the restored record crosses the sandbox realm boundary, so
    // its prototype is not this realm's and a deep-equal on the array shape fails on that
    // alone while the dates it carries are identical.
    assert.equal(restored.tt0133093.viewings.length, 1,
        'and the viewing history, which nothing else could rebuild');
    assert.equal(restored.tt0133093.viewings[0].date, '2026-01-02',
        'restored with the date it was logged under');
    assert.equal(restored.tt0903747.state, 'skip', 'a Skip must not come back as a Seen');
    assert.equal(undoButton().hidden, true, 'a consumed undo stops being offered');

    /* Clear all is the same path without the second click that used to guard it. */
    requireSelector(window.document, '.enh-settings-footer-btn--danger').click();
    assert.equal(hooks.getUserMarks() && Object.keys(hooks.getUserMarks()).length, 0,
        'Clear all must empty the store on one press now that the deletion is reversible');
    undoButton().click();
    assert.equal(Object.keys(hooks.getUserMarks()).length, 2, 'and put every record back');

    /* The offer has to end when anything else writes the marks, or it stops being an undo
       and becomes a way to delete whatever arrived after it. Adversarial review found this
       live: Clear all, then Import from page, then Undo destroyed everything imported. */
    requireSelector(window.document, '.enh-settings-footer-btn--danger').click();
    assert.equal(undoButton().hidden, false, 'the offer stands immediately after the deletion');
    window.GM_setValue('imdb_enh_userMarks', { tt1375666: { state:'watched', title:'Inception', ts:99 } });
    window.document.dispatchEvent(new window.CustomEvent('imdb-enhanced:marks-updated'));
    assert.equal(undoButton().hidden, true,
        'a write this panel did not make must end the offer rather than be swallowed by it');
    undoButton().click();
    assert.deepEqual(Object.keys(hooks.getUserMarks()), ['tt1375666'],
        'and pressing it anyway must not resurrect the store from before that write');

    window.GM_setValue('imdb_enh_userMarks', {});
    window.document.dispatchEvent(new window.CustomEvent('imdb-enhanced:marks-updated'));

    /* The mobile-link redirect had a stored setting, a reader at document-start and the
       README's word that it could be switched off, and no control anywhere: the only way
       to turn it off was to hand-edit a settings backup and import it. */
    const mobileToggle = requireSelector(window.document, '#enh-desktop-from-mobile-toggle');
    assert.equal(mobileToggle.checked, true, 'the redirect is on unless it has been turned off');
    mobileToggle.checked = false;
    mobileToggle.dispatchEvent(new window.Event('change', { bubbles:true }));
    assert.equal(window.GM_getValue('imdb_enh_desktopFromMobileLinks'), false,
        'unticking it has to reach the value the document-start redirect reads');
    mobileToggle.checked = true;
    mobileToggle.dispatchEvent(new window.Event('change', { bubbles:true }));
    assert.equal(window.GM_getValue('imdb_enh_desktopFromMobileLinks'), true,
        'and ticking it back on restores the redirect');

    hooks.destroySettingsChrome();

    ['watchedMarking', 'titleNotes', 'quickCopyID', 'collapsibleSections'].forEach(hooks.stopFeature);
});

await runFixture('title-ratings', async (window, hooks) => {
    assert.equal(hooks.getPageSurface(), 'ratings');
    requireSelector(window.document, '[data-testid="rating-button__aggregate-rating__score"]');
    const histogram = Array.from(hooks.getHistogramData() || []);
    assert.equal(histogram.length, 10, 'selector "script[type=application/json]" must expose ten rating buckets');
    assert.equal(histogram[9].rating, 10);
    assert.equal(histogram[9].voteCount, 841000);
});

await runFixture('episodes', async (window, hooks) => {
    assert.equal(hooks.getPageSurface(), 'episodes');
    requireSelector(window.document, 'article.episode-item-wrapper');
    const episodes = Array.from(hooks.readLoadedEpisodes(window.document));
    assert.equal(episodes.length, 3, 'selector "article.episode-item-wrapper" must expose the loaded season');
    assert.deepEqual(episodes.map(episode => episode.id), ['tt0959621', 'tt1054724', 'tt1054725']);
    assert.equal(episodes[0].label, 'S1.E1 Pilot');

    /* IE-107: every card on this page is an episode of the show whose page it is, and
       this page's own id is the show's. Marking one Seen records that, which is the only
       way a series page can later count its own episodes without asking IMDb anything. */
    const card = requireSelector(window.document, 'article.episode-item-wrapper');
    const metadata = hooks.readCardMarkMetadata(card, 'tt0959621');
    assert.equal(metadata.series, hooks.getIMDbID(),
        'a mark made from the episode list belongs to the series that list is of');

    /* IMDb puts "More to explore" and a recently-viewed rail on the same tab. Those cards
       are films, and stamping them made a film somebody marked from a rail count as an
       episode of the show whose page they happened to be on. */
    const rail = window.document.createElement('div');
    rail.innerHTML = '<div class="ipc-poster-card"><a href="/title/tt0111161/">'
        + '<img alt="poster"></a></div>';
    window.document.body.appendChild(rail);
    const railCard = rail.querySelector('.ipc-poster-card');
    assert.equal(hooks.readCardMarkMetadata(railCard, 'tt0111161').series, undefined,
        'a film in a rail beside the episode list is not an episode of the show');

    /* A card carrying this page's own id is read as the page itself, which is where the
       check against a title being an episode of itself lives. */
    assert.equal(hooks.readCardMarkMetadata(card, hooks.getIMDbID()).series, undefined,
        'a show is never an episode of itself');
    rail.remove();
});

await runFixture('person', async (window, hooks) => {
    assert.equal(hooks.getPageSurface(), 'name');
    requireSelector(window.document, '[data-testid="birth-and-death-birthdate"]');
    assert.deepEqual({ ...hooks.readPersonBirthDate(window.document) }, {
        iso:'1964-09-02',
        deceased:false,
    });
});

await runFixture('chart', async (window, hooks) => {
    assert.equal(hooks.getPageSurface(), 'collection');
    const firstRow = requireSelector(window.document, 'li.ipc-metadata-list-summary-item');
    assert.equal(hooks.readCardRating(firstRow), 9.3);
    const cards = Array.from(hooks.collectMarkFilterCards(window.document));
    assert.equal(cards.length, 3, 'selector "a[href*=\\"/title/tt\\"]" must expose every chart row');
    const rows = Array.from(window.document.querySelectorAll('li.ipc-metadata-list-summary-item'));
    const summary = { ...hooks.summarizeCollectionRuntime(rows) };
    assert.deepEqual(summary, { counted:2, missing:1, minutes:317, total:3 });
    assert.equal(hooks.describeCollectionRuntime(summary),
        '3 titles · 5:17 total from 2 · 1 without a listed runtime');
    assert.equal(hooks.initFeature('watchedMarking'), true);
    (await waitForSelector(window, 'li.ipc-metadata-list-summary-item .enh-mark-btn--watched')).click();
    const stored = hooks.getUserMarks().tt0111161;
    assert.deepEqual({ year:stored.year, imdbRating:stored.imdbRating, runtime:stored.runtime }, {
        year:1994, imdbRating:9.3, runtime:142,
    }, 'a real collection-card mark click must retain the metadata already rendered in that row');
    hooks.stopFeature('watchedMarking');
});

/* IE-99: a store build does not ship the Letterboxd or JustWatch parsers, and its
   manifest never declares their origins. The settings row for such a feature used to
   offer a Grant button that could not possibly succeed. Exercised against the script the
   store build actually ships, with the chrome surface that makes the access line exist at
   all. (Rotten Tomatoes and Metacritic are no longer excluded there — OMDb answers both
   from an API — so Letterboxd is the feature with no source in that build.) */
{
    const storeSource = applyStoreProfile(instrumented);
    assert.notEqual(storeSource, instrumented, 'the store transform must rewrite the script it is given');
    const permissionQuestions = [];
    const chromeStub = {
        runtime: {
            id: 'imdb-enhanced-store-fixture',
            lastError: undefined,
            sendMessage(message, callback) {
                permissionQuestions.push(message && message.type);
                if (typeof callback === 'function') callback({ granted:false, ok:false });
            },
        },
    };
    await runFixture('title', async (window, hooks) => {
        hooks.createSettingsPanel();
        const rowFor = label => {
            const found = Array.from(window.document.querySelectorAll('.enh-settings-row'))
                .find(row => row.querySelector('.enh-settings-label')?.textContent === label);
            assert.ok(found, `settings row "${label}" was not rendered`);
            return found;
        };
        const excluded = rowFor('Letterboxd scores');
        const excludedAccess = excluded.querySelector('.enh-settings-access');
        assert.ok(excludedAccess, 'an excluded feature must still say why it cannot work');
        assert.equal(excludedAccess.textContent, 'Not available in this build (Letterboxd)');
        assert.equal(excludedAccess.dataset.state, 'excluded');
        assert.equal(excluded.querySelector('.enh-settings-access-btn'), null,
            'a build that excludes the source must not offer to request access to it');
        assert.doesNotMatch(excludedAccess.textContent, /needs access to/,
            'an excluded feature must not be reported as a missing grant');

        const shipped = rowFor('Streaming availability');
        await new Promise(resolve => window.setTimeout(resolve, 0));
        const shippedAccess = shipped.querySelector('.enh-settings-access');
        assert.ok(shippedAccess, 'a feature that does ship must still report its access state');
        assert.equal(shippedAccess.dataset.state, 'missing',
            'TMDB survives the store cut, so availability is a grant question, not an exclusion');
        assert.ok(shipped.querySelector('.enh-settings-access-btn'),
            'and it keeps the affordance that can actually resolve it');
        assert.ok(permissionQuestions.includes('imdb-enhanced:permissions-contains'),
            'the shipped feature must have asked the background about a real grant');
        hooks.destroySettingsChrome();
    }, { source:storeSource, extension:chromeStub });
    console.log('ok - a store build names the sources it cannot ship instead of asking for access to them');
}

/* IE-110: the store build ships no Rotten Tomatoes or Metacritic parser and asks for
   neither origin, so both widgets answer from OMDb's API with a key of the user's own.
   Rendered from the real feature against the real fixture, because the thing being
   checked is what ends up on the page — including the credit OMDb's licence requires. */
{
    const storeSource = applyStoreProfile(instrumented);
    await runFixture('title', async (window, hooks) => {
        /* Nothing is laid out here, so happy-dom's IntersectionObserver never reports an
           intersection and the score features would wait out their 60-second visibility
           timeout. Removing it takes the documented no-observer path instead. */
        delete window.IntersectionObserver;
        window.GM_setValue('imdb_enh_omdbApiKey', 'OMDB-KEY-VALUE');
        const sent = [];
        window.GM_xmlhttpRequest = options => {
            sent.push(options);
            window.queueMicrotask(() => options.onload?.({
                status: 200,
                finalUrl: options.url,
                responseText: JSON.stringify({
                    Response:'True',
                    Metascore:'73',
                    Ratings:[
                        { Source:'Rotten Tomatoes', Value:'83%' },
                        { Source:'Metacritic', Value:'73/100' },
                    ],
                }),
            }));
            return { abort() {} };
        };

        await hooks.runFeature('inlineRTScore');
        const rt = await waitForSelector(window, '#enh-rt-widget');
        assert.match(rt.textContent, /83%/, 'a store build must still show the Tomatometer');
        assert.match(rt.textContent, /via OMDb/, 'and say where it came from');
        assert.match(rt.textContent, /CC BY-NC 4\.0/, 'and carry the credit OMDb asks for');

        await hooks.runFeature('inlineMetacriticScore');
        const mc = await waitForSelector(window, '#enh-mc-widget');
        assert.match(mc.textContent, /73/, 'the Metascore comes from the same answer');
        assert.match(mc.textContent, /via OMDb/);

        /* A "Wrong?" action fixes a title matched by search. OMDb matches by IMDb id and
           cannot land on another film, and the search endpoint the action would call is an
           origin this build does not declare, so offering it would be an affordance that
           could only fail. */
        assert.equal(rt.querySelector('.enh-score-correction-trigger'), null,
            'a build that matches by id must not offer to correct the match');
        assert.equal(mc.querySelector('.enh-score-correction-trigger'), null);

        /* The OMDb answer is cached under its own key. Writing it into rt_/mc_ as well
           would pin a reduced record — no audience score, no consensus, no page link —
           over the page parser for a week after a single failed lookup. */
        assert.equal(hooks.cacheGet('rt_tt0133093'), null,
            'an OMDb answer must not occupy the page parser\'s cache entry');
        assert.equal(hooks.cacheGet('mc_tt0133093'), null);
        assert.equal(hooks.cacheGet('omdb_tt0133093').rt, 83,
            'it is cached under its own key, so the second widget makes no second call');

        const hosts = [...new Set(sent.map(options => new window.URL(options.url).hostname))];
        assert.deepEqual(hosts, ['www.omdbapi.com'],
            'a store build must not reach for the pages it does not ship a parser for');
        assert.equal(sent.length, 1,
            'one OMDb call answers both widgets; the second reads the cached answer');
        hooks.stopFeature('inlineRTScore');
        hooks.stopFeature('inlineMetacriticScore');
    }, { source:storeSource });
    console.log('ok - a store build renders Rotten Tomatoes and Metacritic from OMDb');
}

/* Without a key there is nothing to authenticate with, so the widget says so and asks for
   one instead of showing an empty panel or a permanent loading state. */
{
    const storeSource = applyStoreProfile(instrumented);
    await runFixture('title', async (window, hooks) => {
        delete window.IntersectionObserver;
        const sent = [];
        window.GM_xmlhttpRequest = options => { sent.push(options); return { abort() {} }; };
        await hooks.runFeature('inlineRTScore');
        const rt = await waitForSelector(window, '#enh-rt-widget');
        assert.match(rt.textContent, /Needs an OMDb key/);
        assert.equal(sent.length, 0, 'and nothing may be requested without one');

        /* Storing a key changes which services the feature contacts, so every row that
           reports access is stale the moment it is saved. Nothing used to say so. */
        const repaints = [];
        window.document.addEventListener('imdb-enhanced:permissions-changed', () => repaints.push(1));
        hooks.createSettingsPanel();
        const keyField = requireSelector(window.document, '#enh-setting-omdbApiKey');
        keyField.value = 'OMDB-KEY-VALUE';
        keyField.dispatchEvent(new window.Event('change', { bubbles:true }));
        assert.equal(repaints.length, 1,
            'saving a credential must tell the access rows to re-read');
        hooks.destroySettingsChrome();
        hooks.stopFeature('inlineRTScore');
    }, { source:storeSource });
    console.log('ok - a store build with no OMDb key says so rather than showing nothing');
}

/* Drive the real catch path. This proves both parts of the failure contract: the broken
   selector is named and the artifact path points to a DOM file that was actually written. */
{
    const artifactPath = path.join(artifactDir, 'title.html');
    let failure = null;
    try {
        await runFixture('title', async window => {
            requireSelector(window.document, '[data-testid="deliberately-missing"]');
        });
    } catch (error) {
        failure = error;
    }
    assert.ok(failure, 'the deliberate selector failure must reach the artifact-writing path');
    assert.match(failure.message, /\[data-testid="deliberately-missing"\]/);
    assert.match(failure.message, /DOM artifact: tests[\\/]artifacts[\\/]dom-fixtures[\\/]title\.html/);
    assert.equal(fs.existsSync(artifactPath), true, 'the reported DOM artifact must exist');
    assert.match(fs.readFileSync(artifactPath, 'utf8'), /The Matrix/,
        'the artifact must contain the rendered fixture DOM');
    fs.rmSync(artifactPath, { force:true });
    console.log('ok - selector failures name the offending selector and write the reported DOM artifact');
}
