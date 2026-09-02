#!/usr/bin/env node
/* The chart and episode surfaces, under every theme, with marks present.
 *
 *   node scripts/capture-surface-screenshots.js
 *
 * Developer-run, never part of `npm test`: it needs a browser.
 *
 * The polish harness beside this one renders the title fixture only, which left the mark
 * controls on cards, the Seen and Skip badges, the episode heatmap chips and the season
 * progress bar checked by reading the code. Reading the code is how a control ends up
 * legible in the theme it was written against and unreadable in the other four.
 *
 * It writes a screenshot per surface per theme, and it also measures. A picture nobody
 * opens proves nothing, so the failures worth catching are found here instead: text that
 * does not meet WCAG AA against what is actually painted behind it, and an injected
 * control that has escaped the card it belongs to. Both are reported per theme, and a
 * non-zero exit means one of them fired.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, 'design', 'surfaces');
const PLAYWRIGHT = process.env.IMDB_ENH_PLAYWRIGHT
    || 'C:/Users/--/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.js';
const CHROMIUM = process.env.IMDB_ENH_CHROMIUM
    || 'C:/Users/--/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';

const THEMES = ['dark', 'oled', 'midnight', 'light', 'highContrast'];

const MARKS = {
    tt0111161: { v:2, state:'watched', title:'The Shawshank Redemption', ts:1788177600000, year:1994, rating:10, imdbRating:9.3, runtime:142, viewings:[{ date:'2026-01-02', rating:10 }, { date:'2026-06-02', rating:10 }] },
    tt0068646: { v:2, state:'skip', title:'The Godfather', ts:1780000000000, year:1972, imdbRating:9.2 },
    tt0903747: { v:2, state:'watched', title:'Breaking Bad', ts:1770000000000, kind:'series', rating:9, imdbRating:9.5 },
};

/* Read from what is painted, not from the declaration. A theme sets colours through
   custom properties and color-mix, and both serialise in forms a naive parse gets wrong;
   compositing every ancestor's background down to an opaque one is the only way to know
   what a reader is actually looking at. */
const PROBE = `() => {
    const parse = value => {
        const match = /rgba?\\(([^)]+)\\)/.exec(value || '');
        if (!match) return null;
        const parts = match[1].split(/[\\s,/]+/).filter(Boolean).map(Number);
        if (parts.length < 3 || parts.some(part => !Number.isFinite(part))) return null;
        return { r:parts[0], g:parts[1], b:parts[2], a:parts.length > 3 ? parts[3] : 1 };
    };
    const over = (top, bottom) => ({
        r: top.r * top.a + bottom.r * (1 - top.a),
        g: top.g * top.a + bottom.g * (1 - top.a),
        b: top.b * top.a + bottom.b * (1 - top.a),
        a: 1,
    });
    const luminance = colour => {
        const channel = value => {
            const v = value / 255;
            return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        };
        return channel(colour.r) * 0.2126 + channel(colour.g) * 0.7152 + channel(colour.b) * 0.0722;
    };
    const contrast = (a, b) => {
        const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
        return (high + 0.05) / (low + 0.05);
    };
    /* Seeded from what the page is actually painted on rather than from white: on a dark
       theme every control whose ancestors are all transparent was being measured against a
       white page that does not exist. Returns null where an image or a gradient is in the
       stack, because a number computed against a colour that is not there is worse than no
       number - those are reported separately instead. */
    const backdropOf = element => {
        const root = parse(getComputedStyle(document.documentElement).backgroundColor)
            || parse(getComputedStyle(document.body).backgroundColor)
            || { r:255, g:255, b:255, a:1 };
        let stack = { ...root, a:1 };
        let painted = false;
        const chain = [];
        for (let node = element; node && node.nodeType === 1; node = node.parentElement) chain.push(node);
        for (const node of chain.reverse()) {
            const style = getComputedStyle(node);
            if (style.backgroundImage && style.backgroundImage !== 'none') return null;
            const colour = parse(style.backgroundColor);
            if (colour && colour.a > 0) { stack = over(colour, stack); painted = true; }
        }
        /* A control lying over a poster has no ancestor background at all; the image
           behind it is a sibling and cannot be composited from here. */
        return painted ? stack : null;
    };

    const lowContrast = [];
    const escaped = [];
    const unmeasurable = [];
    document.querySelectorAll('[class*="enh-"], [id^="enh-"]').forEach(element => {
        const box = element.getBoundingClientRect();
        if (!box.width || !box.height) return;
        const style = getComputedStyle(element);
        if (style.visibility === 'hidden' || style.display === 'none') return;
        /* Effective opacity, not the element's own. The mark controls are a group faded to
           zero until the card is hovered, and every button inside one is fully opaque in
           its own right - measuring those is measuring something nobody can see. */
        let effective = 1;
        for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
            effective *= Number(getComputedStyle(node).opacity);
        }
        if (effective < 0.1) return;

        /* Only elements that hold text of their own. A wrapper inherits a colour it never
           paints with, and reporting it would bury the real findings. */
        const ownText = [...element.childNodes]
            .filter(node => node.nodeType === 3 && node.textContent.trim())
            .map(node => node.textContent.trim())
            .join(' ');
        if (ownText) {
            const foreground = parse(style.color);
            if (foreground) {
                const size = parseFloat(style.fontSize) || 16;
                const bold = Number(style.fontWeight) >= 700;
                // WCAG's large-text allowance: 18pt, or 14pt bold.
                const large = size >= 24 || (bold && size >= 18.66);
                const needed = large ? 3 : 4.5;
                /* backdropOf(element), not of its parent: a control paints its own
                   background and that is what its text sits on. Excluding it made every
                   button on a card report the same 1.07:1 against the page. */
                const behind = backdropOf(element);
                if (!behind) {
                    unmeasurable.push({
                        selector: element.id ? '#' + element.id : '.' + [...element.classList].join('.'),
                        text: ownText.slice(0, 40),
                    });
                    return;
                }
                const seen = contrast(over(foreground, behind), behind);
                if (seen < needed) {
                    lowContrast.push({
                        selector: element.id ? '#' + element.id : '.' + [...element.classList].join('.'),
                        text: ownText.slice(0, 40),
                        ratio: Math.round(seen * 100) / 100,
                        needed,
                    });
                }
            }
        }

        /* An injected control that has left the card it belongs to. Absolutely positioned
           badges and control rows are where this happens, and it is invisible in code. */
        const host = element.closest('.enh-markable-card, .enh-heatmap-cell, li.ipc-metadata-list-summary-item');
        if (host && host !== element && (style.position === 'absolute' || style.position === 'fixed')) {
            const hostBox = host.getBoundingClientRect();
            const slack = 2;
            if (box.left < hostBox.left - slack || box.right > hostBox.right + slack
                || box.top < hostBox.top - slack || box.bottom > hostBox.bottom + slack) {
                escaped.push({
                    selector: element.id ? '#' + element.id : '.' + [...element.classList].join('.'),
                    by: Math.round(Math.max(
                        hostBox.left - box.left, box.right - hostBox.right,
                        hostBox.top - box.top, box.bottom - hostBox.bottom)),
                });
            }
        }
    });
    /* Rendered elements only. Counting the injected <style> tags meant the "nothing was
       injected" guard could never fire, since those are always there. */
    const injected = [...document.querySelectorAll('[class*="enh-"], [id^="enh-"]')]
        .filter(node => node.tagName !== 'STYLE' && node.getBoundingClientRect().width > 0).length;
    return { lowContrast, escaped, unmeasurable, injected };
}`;

async function main() {
    const { chromium } = require(PLAYWRIGHT);
    const userscript = fs.readFileSync(path.join(root, 'IMDb_Enhanced.user.js'), 'utf8');
    fs.mkdirSync(outputDir, { recursive:true });

    const surfaces = [
        { name:'chart', fixture:'chart.html', url:'https://www.imdb.com/chart/top/' },
        { name:'episodes', fixture:'episodes.html', url:'https://www.imdb.com/title/tt0903747/episodes/?season=1' },
    ];

    const browser = await chromium.launch({ executablePath:CHROMIUM, headless:true });
    let failures = 0;

    for (const surface of surfaces) {
        const body = fs.readFileSync(path.join(root, 'tests', 'fixtures', surface.fixture), 'utf8');
        const context = await browser.newContext({
            locale:'en-US', viewport:{ width:1440, height:900 }, deviceScaleFactor:1, reducedMotion:'reduce',
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://www.imdb.com/**', route => route.fulfill({
            status:200, contentType:'text/html; charset=utf-8', body,
        }));
        await page.addInitScript({ content: [
            `const surfaceStore = new Map(Object.entries(${JSON.stringify({
                imdb_enh_userMarks: MARKS,
                imdb_enh_watchedMarking: true,
                imdb_enh_markFilters: true,
                imdb_enh_dimLowRated: true,
                imdb_enh_episodeHeatmap: true,
                imdb_enh_seasonProgress: true,
                imdb_enh_listRuntimeSummary: true,
                imdb_enh_collectionExport: true,
            })}));`,
            'window.GM_getValue = (key, fallback) => surfaceStore.has(key) ? surfaceStore.get(key) : fallback;',
            'window.GM_setValue = (key, value) => surfaceStore.set(key, structuredClone(value));',
            'window.GM_deleteValue = key => surfaceStore.delete(key);',
            'window.GM_listValues = () => [...surfaceStore.keys()];',
            'window.GM_setClipboard = () => {};',
            'window.GM_webRequest = () => {};',
            'window.GM_xmlhttpRequest = options => {',
            '    queueMicrotask(() => options && options.onerror && options.onerror({ error:"offline capture" }));',
            '    return { abort() {} };',
            '};',
            userscript,
        ].join('\n') });
        await page.goto(surface.url, { waitUntil:'domcontentloaded' });
        await page.waitForTimeout(1500);

        for (const theme of THEMES) {
            /* Through the panel's own swatch, not by writing the setting and hoping.
               Nothing listens for a settings-saved event to re-theme - the only thing that
               repaints is the swatch handler - so setting the value directly produced five
               byte-identical screenshots of the dark theme and a contrast report that
               covered one palette while claiming five. */
            await page.locator('#enh-settings-fab').click();
            await page.locator('#enh-settings-tab-experience').click();
            await page.locator(`.enh-theme-swatch[data-theme="${theme}"]`).click();
            await page.locator('.enh-settings-close').click();
            /* Themes transition. A measurement taken before they settle is a colour part
               way between two palettes, which is neither of the ones anybody sees. */
            await page.waitForTimeout(600);

            const file = path.join(outputDir, `${surface.name}-${theme}.png`);
            await page.screenshot({ path:file, fullPage:false });

            // Called, not returned: evaluate() with a string evaluates an expression, and
            // a bare arrow function expression is a function object it cannot serialise.
            const found = await page.evaluate(`(${PROBE})()`);
            const label = `${surface.name} / ${theme}`;
            if (!found.injected) {
                process.stdout.write(`  ${label}: NOTHING INJECTED - the capture is of a bare page\n`);
                failures += 1;
                continue;
            }
            if (!found.lowContrast.length && !found.escaped.length) {
                const note = found.unmeasurable.length
                    ? ` (${found.unmeasurable.length} sit over artwork and cannot be measured from the DOM)`
                    : '';
                process.stdout.write(`  ${label}: ${found.injected} rendered elements, all readable and inside their cards${note}\n`);
                continue;
            }
            failures += found.lowContrast.length + found.escaped.length;
            found.lowContrast.forEach(entry => process.stdout.write(
                `  ${label}: ${entry.selector} "${entry.text}" is ${entry.ratio}:1, needs ${entry.needed}\n`));
            found.escaped.forEach(entry => process.stdout.write(
                `  ${label}: ${entry.selector} sits ${entry.by}px outside its card\n`));
        }
        if (errors.length) {
            process.stdout.write(`  ${surface.name}: page errors - ${errors.slice(0, 3).join(' | ')}\n`);
            failures += errors.length;
        }
        await context.close();
    }

    await browser.close();
    process.stdout.write(`\nWrote ${surfaces.length * THEMES.length} screenshots to ${path.relative(root, outputDir)}\n`);
    process.stdout.write(failures ? `${failures} defect(s) to fix.\n` : 'No contrast or containment defects.\n');
    process.exit(failures ? 1 : 0);
}

main().catch(error => {
    process.stderr.write(`surface capture failed: ${error && error.message}\n`);
    process.exit(1);
});
