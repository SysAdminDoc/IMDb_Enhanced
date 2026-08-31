#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, 'design', 'mockups');
const fixture = fs.readFileSync(path.join(root, 'tests', 'fixtures', 'title.html'), 'utf8');
const userscript = fs.readFileSync(path.join(root, 'IMDb_Enhanced.user.js'), 'utf8');

const PLAYWRIGHT = process.env.IMDB_ENH_PLAYWRIGHT
    || 'C:/Users/--/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.js';
const CHROMIUM = process.env.IMDB_ENH_CHROMIUM
    || 'C:/Users/--/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';

async function main() {
    const { chromium } = require(PLAYWRIGHT);
    fs.mkdirSync(outputDir, { recursive:true });
    const browser = await chromium.launch({ executablePath:CHROMIUM, headless:true });
    const context = await browser.newContext({
        locale:'en-US',
        viewport:{ width:1440, height:900 },
        deviceScaleFactor:1,
        reducedMotion:'reduce',
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error));
    await page.route('https://www.imdb.com/**', route => route.fulfill({
        status:200,
        contentType:'text/html; charset=utf-8',
        body:fixture,
    }));
    await page.addInitScript({ content:`
        const screenshotStore = new Map();
        window.GM_getValue = (key, fallback) => screenshotStore.has(key) ? screenshotStore.get(key) : fallback;
        window.GM_setValue = (key, value) => screenshotStore.set(key, structuredClone(value));
        window.GM_deleteValue = key => screenshotStore.delete(key);
        window.GM_listValues = () => [...screenshotStore.keys()];
        window.GM_setClipboard = () => {};
        window.GM_webRequest = () => {};
        window.GM_xmlhttpRequest = options => {
            queueMicrotask(() => options && options.onerror && options.onerror({ error:'offline screenshot fixture' }));
            return { abort() {} };
        };
        ${userscript}
    ` });
    await page.goto('https://www.imdb.com/title/tt0133093/', { waitUntil:'domcontentloaded' });
    await page.locator('#enh-settings-fab').click();
    await page.locator('#enh-settings-tab-data').click();
    for (const theme of ['oled', 'midnight', 'light', 'highContrast', 'dark']) {
        await page.locator('#enh-settings-tab-experience').click();
        await page.locator(`.enh-theme-swatch[data-theme="${theme}"]`).click();
        await page.locator('#enh-settings-tab-data').click();
        if (!await page.locator('#enh-csv-textarea').isVisible()) {
            throw new Error(`CSV import controls disappeared under the ${theme} theme.`);
        }
    }
    await page.locator('#enh-csv-file').setInputFiles({
        name:'imdb-ratings.csv',
        mimeType:'text/csv',
        buffer:Buffer.from('Const,Your Rating,Date Rated,Title\ntt0133093,9,2026-01-02,The Matrix'),
    });
    await page.locator('#enh-csv-preview').filter({ hasText:'1 row across 1 title' }).waitFor();
    if (!await page.locator('#enh-csv-apply').isEnabled()) {
        throw new Error('A valid uploaded CSV did not enable the import action.');
    }
    await page.addStyleTag({ content:'* { animation: none !important; transition: none !important; }' });
    await page.screenshot({ path:path.join(outputDir, 'built-data-1440x900.png') });
    await page.locator('#enh-settings-panel').screenshot({ path:path.join(outputDir, 'built-data-panel-1000x812.png') });
    if (pageErrors.length) throw pageErrors[0];
    await browser.close();
    process.stdout.write('Captured Data settings screenshots from the offline title fixture.\n');
}

main().catch(error => {
    process.stderr.write(`settings screenshot capture failed: ${error?.stack || error}\n`);
    process.exit(1);
});
