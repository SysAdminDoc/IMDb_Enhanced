#!/usr/bin/env node
/* Captures real IMDb DOM into tests/fixtures/, so the extractors can be tested against
 * markup IMDb actually served rather than against a hand-written approximation that
 * agrees with the parser by construction.
 *
 *   node scripts/capture-fixtures.js
 *
 * Developer-run, never part of `npm test`: it needs a browser and the network, and IMDb
 * answers non-browser clients with a challenge page, so it cannot be a merge gate. The
 * captured files are committed; the suite reads them offline.
 *
 * What is kept: <head>'s structured-data and application-data scripts, plus <main>. What
 * is dropped: stylesheets, images, and every other script. That keeps a fixture around
 * 100-300 KB instead of ~1 MB while preserving everything the extractors read — the
 * parsers only ever look at JSON-LD, __NEXT_DATA__-style JSON blobs, and rendered markup.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'tests', 'fixtures');

/* One representative page per surface the extractors run on. Long-lived, heavily
   trafficked titles, so a re-capture years from now still finds them. */
const PAGES = [
    { name: 'title', url: 'https://www.imdb.com/title/tt0133093/' },
    { name: 'title-ratings', url: 'https://www.imdb.com/title/tt0133093/ratings/' },
    { name: 'episodes', url: 'https://www.imdb.com/title/tt0903747/episodes/?season=1' },
    { name: 'person', url: 'https://www.imdb.com/name/nm0000206/' },
    { name: 'chart', url: 'https://www.imdb.com/chart/top/' },
    /* IMDb's reference view is a different page for the same title: its own layout, its
       own class names, and none of the testids the main title page is built from. */
    { name: 'reference', url: 'https://www.imdb.com/title/tt0133093/reference/' },
];

/* Capture one page rather than all of them. Re-capturing everything to add a surface
   rewrites five committed fixtures against whatever IMDb shipped today, which is a large
   unrelated diff and a suite full of failures that have nothing to do with the change. */
const ONLY = process.argv.slice(2).filter(argument => !argument.startsWith('-'));
const SELECTED = ONLY.length ? PAGES.filter(page => ONLY.includes(page.name)) : PAGES;
if (!SELECTED.length) {
    process.stderr.write(`No fixture named ${ONLY.join(', ')}. Known: ${PAGES.map(page => page.name).join(', ')}
`);
    process.exit(1);
}

const PLAYWRIGHT = process.env.IMDB_ENH_PLAYWRIGHT
    || 'C:/Users/--/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.js';
const CHROMIUM = process.env.IMDB_ENH_CHROMIUM
    || 'C:/Users/--/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';

/* Runs in the page. Passed as a function rather than a string so it is not re-parsed
   twice on the way there — an earlier version went through eval() and silently produced
   empty captures, which is exactly the failure a fixture is supposed to prevent, so the
   size of every capture is asserted below. */
function extractFixture() {
    const scripts = [];
    // Structured data and embedded application data: everything the extractors read
    // that is not rendered markup.
    document.querySelectorAll('script[type="application/ld+json"], script[type="application/json"]')
        .forEach(node => {
            scripts.push({ type: node.type, id: node.id || '', text: node.textContent || '' });
        });
    const main = document.querySelector('main');
    const clone = main ? main.cloneNode(true) : null;
    if (clone) {
        // Stylesheets, scripts and vectors are weight without meaning here. An <img> is
        // kept, with its src blanked, because some parsers check that one exists.
        clone.querySelectorAll('script, style, link, noscript, svg, iframe').forEach(n => n.remove());
        clone.querySelectorAll('img, source').forEach(n => {
            n.removeAttribute('srcset');
            if (n.getAttribute('src')) n.setAttribute('src', 'about:blank');
        });
        /* Class names are load-bearing — the selectors under test are built from them —
           but inline styles and IMDb's telemetry data-* attributes are not, and they are
           a third of the bytes. data-testid is kept: several extractors select on it.
           Measured on the title page: 1.28 MB raw, 344 KB after the removals above,
           225 KB after this. */
        clone.querySelectorAll('*').forEach(node => {
            node.removeAttribute('style');
            [...node.attributes].forEach(attribute => {
                if (/^data-(?!testid)/.test(attribute.name)) node.removeAttribute(attribute.name);
            });
        });
    }
    return {
        lang: document.documentElement.lang || 'en-US',
        title: document.title,
        scripts,
        main: clone ? clone.outerHTML : '',
        bodyLength: document.body.innerHTML.length,
    };
}

async function main() {
    const { chromium } = require(PLAYWRIGHT);
    fs.mkdirSync(outDir, { recursive: true });
    /* A persistent profile, because a fresh one is served IMDb's "Human Verification"
       wall rather than the page — a realistic user agent and viewport are not enough.
       Reusing a warm profile across runs is what gets past it; the first run on a cold
       one may need a person to clear the challenge once, which is a large part of why
       this is a developer command and could never be a merge gate. */
    const profileDir = process.env.IMDB_ENH_PROFILE
        || path.join(require('os').tmpdir(), 'imdb-enhanced-fixture-profile');
    fs.mkdirSync(profileDir, { recursive: true });
    const context = await chromium.launchPersistentContext(profileDir, {
        executablePath: CHROMIUM,
        headless: true,
        locale: 'en-US',
        viewport: { width: 1440, height: 900 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    });
    const browser = { close: () => context.close() };
    const manifest = [];

    for (const page of SELECTED) {
        const tab = await context.newPage();
        process.stderr.write(`capturing ${page.name} …\n`);
        await tab.goto(page.url, { waitUntil: 'domcontentloaded' });
        // IMDb hydrates after load; the rendered markup is the point of this.
        await tab.waitForTimeout(6000);
        const captured = await tab.evaluate(extractFixture);
        /* A capture that came back empty is worthless and, worse, would make every
           assertion built on it pass vacuously. Fail the run instead. */
        /* A capture that came back empty is worthless and, worse, would make every
           assertion built on it pass vacuously. Fail the run and name the likely cause:
           a challenge page is short and titled as one. */
        if (!captured.main || captured.main.length < 2000) {
            const wall = /verification|just a moment|robot|captcha/i.test(captured.title);
            throw new Error(`${page.name}: captured <main> is ${captured.main.length} bytes `
                + `(body ${captured.bodyLength}, title "${captured.title}").`
                + (wall
                    ? ' IMDb served its bot wall. Run once with headless:false on this profile and clear it by hand,'
                        + ' or point IMDB_ENH_PROFILE at a browser profile that has already been through it.'
                    : ' The page did not render.'));
        }
        const head = captured.scripts
            .map(s => `<script type="${s.type}"${s.id ? ` id="${s.id}"` : ''}>${s.text}<\/script>`)
            .join('\n');
        const html = `<!DOCTYPE html>
<html lang="${captured.lang}">
<head>
<meta charset="utf-8">
<title>${captured.title.replace(/[<>]/g, '')}</title>
${head}
</head>
<body>
${captured.main}
</body>
</html>
`;
        const file = path.join(outDir, `${page.name}.html`);
        fs.writeFileSync(file, html, 'utf8');
        manifest.push({ name: page.name, url: page.url, bytes: Buffer.byteLength(html) });
        process.stderr.write(`  ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB\n`);
        await tab.close();
    }

    /* Merged rather than replaced, so capturing one surface does not delete the record
       of the four this run did not touch. */
    const previous = fs.existsSync(path.join(outDir, 'manifest.json'))
        ? JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf8')).pages || []
        : [];
    const written = new Set(manifest.map(entry => entry.name));
    const merged = [...previous.filter(entry => !written.has(entry.name)), ...manifest]
        .sort((a, b) => PAGES.findIndex(page => page.name === a.name) - PAGES.findIndex(page => page.name === b.name));

    fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify({
        capturedAt: new Date().toISOString(),
        note: 'Captured by scripts/capture-fixtures.js from live IMDb. Re-capture when a selector regression is confirmed against the live site.',
        pages: merged,
    }, null, 2)}\n`, 'utf8');

    await browser.close();
    process.stderr.write(`\nWrote ${manifest.length} fixtures to tests/fixtures/\n`);
}

main().catch(error => {
    process.stderr.write(`fixture capture failed: ${error?.stack || error}\n`);
    process.exit(1);
});
