#!/usr/bin/env node
/* How long the card decorators actually block the main thread on a long list.
 *
 *   node scripts/probe-decoration.js            # 250 rows
 *   node scripts/probe-decoration.js --rows=10  # the short list, to check nothing regressed
 *
 * Developer-run, never part of `npm test`: it needs a browser.
 *
 * Measured with the Long Animation Frames API rather than a stopwatch around the call.
 * A stopwatch measures the function; LoAF measures what the user experiences, which is the
 * whole frame including the style and layout work the decoration causes. It also attributes
 * the time, so a slow frame that belongs to the fixture's own rendering is not blamed on
 * this extension.
 *
 * The number to beat is 50ms: past that a frame is long enough that a click during it feels
 * dropped, which is the whole reason to care about a 250-row list at all.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const PLAYWRIGHT = process.env.IMDB_ENH_PLAYWRIGHT
    || 'C:/Users/--/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.js';
const CHROMIUM = process.env.IMDB_ENH_CHROMIUM
    || 'C:/Users/--/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';

const LONG_FRAME_MS = 50;

function rowsArgument() {
    const found = process.argv.find(argument => argument.startsWith('--rows='));
    const value = Number(found ? found.slice('--rows='.length) : 250);
    return Number.isSafeInteger(value) && value > 0 && value <= 1000 ? value : 250;
}

/* The captured chart with its list grown to the requested length. IMDb's own rows are the
   template, so the markup the decorators walk is the markup IMDb serves. */
function buildFixture(rows) {
    const html = fs.readFileSync(path.join(root, 'tests', 'fixtures', 'chart.html'), 'utf8');
    const open = html.indexOf('<li class="ipc-metadata-list-summary-item"');
    if (open < 0) throw new Error('the chart fixture no longer contains a row to clone');
    const close = html.indexOf('</li>', open) + '</li>'.length;
    const template = html.slice(open, close);
    const clones = [];
    for (let index = 0; index < rows; index += 1) {
        clones.push(template
            .replace(/tt\d{7}/g, `tt7${String(index).padStart(6, '0')}`)
            .replace(/>\d+\.\s/, `>${index + 1}. `));
    }
    return html.slice(0, open) + clones.join('\n') + html.slice(close);
}

async function main() {
    const rows = rowsArgument();
    const { chromium } = require(PLAYWRIGHT);
    const userscript = fs.readFileSync(path.join(root, 'IMDb_Enhanced.user.js'), 'utf8');
    const fixture = buildFixture(rows);

    const browser = await chromium.launch({ executablePath: CHROMIUM, headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.route('https://www.imdb.com/**', route => route.fulfill({
        status: 200, contentType: 'text/html; charset=utf-8', body: fixture,
    }));

    /* Marks on a quarter of the rows: an undecorated list and a fully marked one are both
       easier than the mixed case, where every card takes a different path. */
    /* --baseline runs the same page with the card features off, so the fixture's own
       rendering cost can be subtracted from the number. Without it, a long frame the list
       would have produced anyway gets blamed on this extension. */
    const baseline = process.argv.includes('--baseline');
    const marks = {};
    for (let index = 0; index < rows; index += 4) {
        marks[`tt7${String(index).padStart(6, '0')}`] =
            { v: 2, state: index % 8 === 0 ? 'watched' : 'skip', title: `Row ${index}`, ts: index };
    }

    await page.addInitScript({ content: [
        'window.__loaf = [];',
        'try {',
        '    new PerformanceObserver(list => {',
        '        list.getEntries().forEach(entry => window.__loaf.push({',
        '            duration: entry.duration,',
        '            blocking: entry.blockingDuration,',
        '            scripts: (entry.scripts || []).map(script => ({',
        '                duration: script.duration,',
        '                source: String(script.sourceURL || script.invoker || "unknown"),',
        '            })),',
        '        }));',
        '    }).observe({ type: "long-animation-frame", buffered: true });',
        '} catch (error) { window.__loafUnsupported = String(error && error.message); }',
        `const probeStore = new Map(Object.entries(${JSON.stringify({
            imdb_enh_userMarks: marks,
            imdb_enh_watchedMarking: !baseline,
            imdb_enh_markFilters: !baseline,
            imdb_enh_dimLowRated: !baseline,
            imdb_enh_markLinkTint: !baseline,
        })}));`,
        'window.GM_getValue = (key, fallback) => probeStore.has(key) ? probeStore.get(key) : fallback;',
        'window.GM_setValue = (key, value) => probeStore.set(key, structuredClone(value));',
        'window.GM_deleteValue = key => probeStore.delete(key);',
        'window.GM_listValues = () => [...probeStore.keys()];',
        'window.GM_setClipboard = () => {};',
        'window.GM_webRequest = () => {};',
        'window.GM_xmlhttpRequest = options => {',
        '    queueMicrotask(() => options && options.onerror && options.onerror({ error:"offline probe" }));',
        '    return { abort() {} };',
        '};',
        userscript,
    ].join('\n') });

    await page.goto('https://www.imdb.com/chart/top/', { waitUntil: 'domcontentloaded' });
    // The boot is scheduled, and the decorators run from an observer after that.
    if (!baseline) {
        await page.waitForFunction(() => document.querySelectorAll('.enh-markable-card').length > 0,
            null, { timeout: 20000 }).catch(() => {});
    }
    await page.waitForTimeout(2500);

    const result = await page.evaluate(() => ({
        unsupported: window.__loafUnsupported || null,
        decorated: document.querySelectorAll('.enh-markable-card').length,
        rows: document.querySelectorAll('li.ipc-metadata-list-summary-item').length,
        frames: window.__loaf,
    }));
    await browser.close();

    if (result.unsupported) {
        process.stderr.write(`long-animation-frame is not available here: ${result.unsupported}\n`);
        process.exit(1);
    }
    process.stdout.write(`${result.rows} rows, ${result.decorated} decorated\n`);
    if (!result.frames.length) {
        process.stdout.write('No long animation frames at all.\n');
        process.exit(0);
    }
    /* Attributed, because a long frame caused by the fixture's own rendering is not this
       extension's to answer for. The userscript is injected as an init script, so its work
       is attributed to the document rather than to a file of its own; the marker is the
       presence of a script entry at all on a frame where cards were decorated. */
    const ours = result.frames.filter(frame => frame.scripts.some(script =>
        /IMDb_Enhanced|about:blank|^$|unknown|document/i.test(script.source)));
    const worst = result.frames.reduce((high, frame) => Math.max(high, frame.duration), 0);
    const worstBlocking = result.frames.reduce((high, frame) => Math.max(high, frame.blocking || 0), 0);
    process.stdout.write(`${result.frames.length} long frames, worst ${worst.toFixed(1)}ms (blocking ${worstBlocking.toFixed(1)}ms)\n`);
    result.frames
        .slice()
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5)
        .forEach(frame => {
            const attributed = frame.scripts
                .map(script => `${script.source.slice(0, 60)} ${script.duration.toFixed(1)}ms`)
                .join(', ') || 'no script attributed';
            process.stdout.write(`  ${frame.duration.toFixed(1)}ms  ${attributed}\n`);
        });
    process.stdout.write(ours.length
        ? `\n${ours.length} of them carry script work.\n`
        : '\nNone of them carry attributed script work.\n');
    process.exit(worstBlocking > LONG_FRAME_MS ? 1 : 0);
}

main().catch(error => {
    process.stderr.write(`decoration probe failed: ${error && error.message}\n`);
    process.exit(1);
});
