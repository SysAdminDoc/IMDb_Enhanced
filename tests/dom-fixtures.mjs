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
    stopFeature: key => {
        const feature = features.find(candidate => candidate.key === key);
        if (feature) stopFeature(feature);
    },
};
})();`);
assert.notEqual(instrumented, userscript, 'DOM fixture hook injection did not find the userscript boundary');

const manifest = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'manifest.json'), 'utf8'));
const fixtureByName = new Map(manifest.pages.map(page => [page.name, page]));
assert.deepEqual([...fixtureByName.keys()], ['title', 'title-ratings', 'episodes', 'person', 'chart'],
    'fixture manifest must cover every supported DOM surface');

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
        console.log(`ok - happy-dom ${name} fixture`);
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
        assert.equal(window.document.getElementById('enh-moviechat'), null,
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

/* IE-105: a rewatch is a thing the store can hold and the page could not say. The button
   for it belongs on something already Seen and nowhere else, and the count has to show up
   where somebody would look for it. */
await runFixture('title', async (window, hooks) => {
    window.GM_setValue('imdb_enh_watchedMarking', true);
    hooks.initFeature('watchedMarking');
    const card = window.document.querySelector('.enh-markable-card[data-enh-mark-id]');
    assert.ok(card, 'the feature decorates something on a title page');
    const id = card.dataset.enhMarkId;
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

    hooks.stopFeature('watchedMarking');
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
    assert.equal(notice(), null, 'nothing is shown before the first init asks for it');

    /* It points at the gear button, so it says nothing until there is one, and it must
       not spend the one time it gets to say anything on a page with nothing to point at. */
    hooks.showFirstRunNotice();
    assert.equal(notice(), null, 'no gear button, nothing to point at');
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
    assert.equal(notice(), null, 'clicking dismiss takes it away');

    /* And it is recorded, so the second page load of an install that has already been
       greeted says nothing. This is the whole feature: a welcome that repeats is worse
       than no welcome. */
    hooks.showFirstRunNotice();
    assert.equal(notice(), null, 'once per install, not once per page');
    assert.equal(window.GM_getValue('imdb_enh_firstRunSeen', false), true,
        'the flag lives outside the defaults, so resetting settings cannot bring it back');

    /* An update notice already occupies that corner and says something more useful. */
    window.GM_setValue('imdb_enh_firstRunSeen', false);
    const update = window.document.createElement('div');
    update.id = 'enh-update-notice';
    window.document.body.appendChild(update);
    hooks.showFirstRunNotice();
    assert.equal(notice(), null, 'the two never stack in the same corner');
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
    requireSelector(correctionWidget, '.enh-score-correction').dispatchEvent(
        new window.KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
    assert.equal(correctionWidget.querySelector('.enh-score-correction'), null,
        'Escape must close the inline correction dialog');
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
    useFixtureResponse(options => ({
        responseText:JSON.stringify(options.url.includes('/3/find/')
            ? { movie_results:[{ id:603 }], tv_results:[], tv_episode_results:[] }
            : { results:{ GB:{
                link:'https://www.themoviedb.org/movie/603/watch?locale=GB',
                flatrate:[], ads:[], rent:[], buy:[],
            } } }),
    }));
    const requestsBeforeTmdbNoOffer = window.__fixtureRequests.length;
    await hooks.runFeature('streamAvailability');
    availabilityWidget = requireSelector(window.document, '#enh-jw-widget');
    assert.match(availabilityWidget.textContent, /TMDB.*Not streamable in GB.*TMDB APIs.*JustWatch/s,
        'a fresh TMDB no-offer answer must retain its source, region, and attribution');
    availabilityLink = requireSelector(window.document, '#enh-jw-widget a');
    assert.equal(availabilityLink.href, 'https://www.themoviedb.org/movie/603/watch?locale=GB',
        'a fresh TMDB no-offer answer must link back to TMDB');
    assert.equal(window.__fixtureRequests.length - requestsBeforeTmdbNoOffer, 2,
        'a fresh TMDB answer needs one identity request and one provider request');
    assert.deepEqual({ ...hooks.cacheGet(tmdbGbKey) }, {
        unavailable:true,
        reason:'region',
        source:'tmdb',
        region:'GB',
        url:'https://www.themoviedb.org/movie/603/watch?locale=GB',
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
