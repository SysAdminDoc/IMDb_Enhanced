import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = process.env.IMDB_ENH_FIXTURE_DIR
    ? path.resolve(process.env.IMDB_ENH_FIXTURE_DIR)
    : path.join(root, 'tests', 'fixtures');
const artifactDir = path.join(root, 'tests', 'artifacts', 'dom-fixtures');
const userscript = fs.readFileSync(path.join(root, 'IMDb_Enhanced.user.js'), 'utf8');

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
    cancelPendingRouteWork,
    stopAllFeatures: () => features.forEach(stopFeature),
    initFeature: key => {
        const feature = features.find(candidate => candidate.key === key);
        if (!feature) throw new Error('Unknown feature: ' + key);
        return startFeature(feature, { context:'fixture' });
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
    window.GM_getValue = (key, fallback) => store.has(key) ? store.get(key) : fallback;
    window.GM_setValue = (key, value) => { store.set(key, structuredClone(value)); };
    window.GM_deleteValue = key => { store.delete(key); };
    window.GM_listValues = () => [...store.keys()];
    window.GM_setClipboard = () => {};
    window.GM_webRequest = () => {};
    window.GM_xmlhttpRequest = options => {
        window.queueMicrotask(() => options?.onerror?.({ error:'fixture network disabled' }));
        return { abort() {} };
    };
}

async function runFixture(name, run) {
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
    window.eval(instrumented);
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

    hooks.createSettingsPanel();
    requireSelector(window.document, '#enh-local-stats-title');
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
