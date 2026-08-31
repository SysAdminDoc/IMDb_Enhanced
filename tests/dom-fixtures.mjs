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
    getIMDbRating,
    getUserMarks,
    getHistogramData,
    readLoadedEpisodes,
    readPersonBirthDate,
    collectMarkFilterCards,
    readCardRating,
    summarizeCollectionRuntime,
    describeCollectionRuntime,
    getPageSurface,
    createSettingsPanel,
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

/* IE-99: a store build does not ship the Rotten Tomatoes, Metacritic, Letterboxd or
   JustWatch parsers, and its manifest never declares their origins. The settings row for
   such a feature used to offer a Grant button that could not possibly succeed. Exercised
   against the script the store build actually ships, with the chrome surface that makes
   the access line exist at all. */
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
        const excluded = rowFor('Rotten Tomatoes scores');
        const excludedAccess = excluded.querySelector('.enh-settings-access');
        assert.ok(excludedAccess, 'an excluded feature must still say why it cannot work');
        assert.equal(excludedAccess.textContent, 'Not available in this build (Rotten Tomatoes)');
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
