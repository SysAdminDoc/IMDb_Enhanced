#!/usr/bin/env node
/* Chrome 149 stopped :hover and :active matching on an ancestor when the hovered element
 * is in the top layer (developer.chrome.com/release-notes/149). Every promoted surface in
 * this extension is a popover, and two of them are anchored to a trigger, so a rule that
 * styled a trigger from a wrapper's hover state would have silently stopped working.
 *
 *   node scripts/probe-top-layer.js
 *
 * Developer-run, never part of `npm test`: it needs a browser. It reports three things per
 * surface - whether the trigger still styles on its own hover, whether hovering inside the
 * open popover still reaches an ancestor, and whether the surface still dismisses.
 *
 * The second answer is expected to be NO on 149 and later. That is the change itself, not
 * a fault, and the probe carries a positive control that depends on the old behaviour so a
 * clean report cannot come from a probe that measures nothing.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const PLAYWRIGHT = process.env.IMDB_ENH_PLAYWRIGHT
    || 'C:/Users/--/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.js';
const CHROMIUM = process.env.IMDB_ENH_CHROMIUM
    || 'C:/Users/--/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';

/* Reproduces the shape the extension uses: a wrapper, a trigger inside it, and a panel
   that is a DOM descendant of the wrapper but is promoted into the top layer. The control
   rule styles the trigger from the WRAPPER's hover state, which is exactly what crossing
   the boundary breaks. */
const PAGE = `<!doctype html><meta charset="utf-8"><style>
    body { margin: 0; font: 14px system-ui; }
    .wrap { display: inline-block; padding: 20px; }
    .trigger { padding: 8px 14px; border: 1px solid #888; background: #eee; color: rgb(0, 0, 0); }
    /* Its own hover. This must keep working: it never crosses anything. */
    .trigger:hover { color: rgb(0, 128, 0); }
    /* The wrapper's hover, reaching down to the trigger. This is the positive control:
       when the hovered element is the promoted panel, a browser before 149 matched this
       and 149 and later do not. */
    .wrap:hover .trigger { background: rgb(255, 0, 0); }
    .panel { position: fixed; top: 120px; left: 20px; margin: 0; border: 1px solid #444; background: #fff; padding: 12px; }
    .panel:not(:popover-open):not(.forced) { display: none; }
</style>
<div class="wrap" id="wrap">
    <button class="trigger" id="trigger" type="button">Trigger</button>
    <div class="panel" id="panel"><button id="inside" type="button">Inside the panel</button></div>
</div>`;

async function main() {
    const { chromium } = require(PLAYWRIGHT);
    const browser = await chromium.launch({ executablePath: CHROMIUM, headless: true });
    const version = browser.version();
    const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
    await page.setContent(PAGE);

    const colourOf = (selector, property) => page.evaluate(
        ([target, prop]) => getComputedStyle(document.querySelector(target)).getPropertyValue(prop),
        [selector, property]);

    const report = [];

    // 1. In the top layer, hovering inside the panel: does the wrapper's rule still reach?
    await page.evaluate(() => {
        const panel = document.getElementById('panel');
        panel.setAttribute('popover', 'manual');
        panel.showPopover();
    });
    await page.hover('#inside');
    const crossedPromoted = await colourOf('#trigger', 'background-color');

    // 2. The same page with the panel NOT promoted, which is the pre-149 behaviour.
    await page.evaluate(() => {
        const panel = document.getElementById('panel');
        panel.hidePopover();
        panel.removeAttribute('popover');
        panel.classList.add('forced');
    });
    await page.hover('#inside');
    const crossedPlain = await colourOf('#trigger', 'background-color');

    /* The control. If these two agree, the probe is not measuring the boundary at all -
       either the browser predates the change or the fixture stopped exercising it - and
       every other answer below is worthless. */
    const controlWorks = crossedPromoted !== crossedPlain;
    report.push(['positive control', controlWorks
        ? `the boundary is observable here (promoted ${crossedPromoted}, in-flow ${crossedPlain})`
        : `NOT OBSERVABLE: both read ${crossedPromoted} - the rest of this report means nothing`]);

    // 3. The trigger's own hover, which is what this extension's rules actually use.
    await page.evaluate(() => {
        const panel = document.getElementById('panel');
        panel.classList.remove('forced');
        panel.setAttribute('popover', 'manual');
        panel.showPopover();
    });
    await page.hover('#trigger');
    const ownHover = await colourOf('#trigger', 'color');
    report.push(['trigger own :hover with the panel promoted',
        ownHover === 'rgb(0, 128, 0)' ? 'still applies' : `BROKEN: ${ownHover}`]);

    // 4. Dismissal: a manual popover must still close on demand.
    const dismissed = await page.evaluate(() => {
        const panel = document.getElementById('panel');
        panel.hidePopover();
        return !panel.matches(':popover-open');
    });
    report.push(['manual popover dismissal', dismissed ? 'closes on demand' : 'BROKEN: stayed open']);

    /* 5. What the extension actually writes. Every rule that styles a trigger has to do it
          from the trigger itself; one that reaches through a wrapper would be the rule the
          149 change breaks. */
    /* Every source file, not one of them. Rules that style a promoted surface live in the
       feature modules as often as in the shared stylesheet, and reading only the shared one
       reported "nothing depends on this" with the other twenty-one files unexamined. The
       child and sibling combinators count too: `.x:hover>.y` crosses the same boundary as
       `.x:hover .y`, and a pattern requiring whitespace missed it. */
    const sources = fs.readdirSync(path.join(root, 'src'))
        .filter(name => name.endsWith('.js'))
        .map(name => [name, fs.readFileSync(path.join(root, 'src', name), 'utf8')]);
    const crossing = [];
    sources.forEach(([name, source]) => {
        [...source.matchAll(/([^\n{};]*:hover[^\n{};]*)\{/g)]
            .map(match => match[1].trim())
            .filter(selector => /:hover\s*(?:[>+~]\s*)?[.#[a-z]/i.test(selector))
            .filter(selector => /menu|correction|trailer|zoom|toast|overlay|popover|dropdown/i.test(selector))
            .forEach(selector => crossing.push(`${name}: ${selector}`));
    });
    report.push([`descendant rules driven by an ancestor hover on a promoted surface (${sources.length} files scanned)`,
        crossing.length ? `FOUND: ${crossing.join(' | ')}` : 'none - nothing here depends on the old behaviour']);

    /* And the surface itself, on the real fixture with the real script, because the
       reproduction above only proves what the pattern does - not that this extension still
       uses that pattern. The link menu is the anchored one: its dropdown is promoted and
       positioned against its trigger, which is the arrangement 149 changed. */
    const fixture = fs.readFileSync(path.join(root, 'tests', 'fixtures', 'title.html'), 'utf8');
    const userscript = fs.readFileSync(path.join(root, 'IMDb_Enhanced.user.js'), 'utf8');
    const live = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await live.route('https://www.imdb.com/**', route => route.fulfill({
        status: 200, contentType: 'text/html; charset=utf-8', body: fixture,
    }));
    await live.addInitScript({ content: [
        'const probeStore = new Map();',
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
    await live.goto('https://www.imdb.com/title/tt0133093/', { waitUntil: 'domcontentloaded' });

    const menu = live.locator('#enh-link-menu-trigger');
    await menu.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    if (await menu.count()) {
        await menu.click();
        const promoted = await live.evaluate(() => {
            const dropdown = document.getElementById('enh-link-menu-dropdown');
            return Boolean(dropdown && dropdown.matches(':popover-open'));
        });
        /* The trigger has a 150ms colour transition, so a computed style read straight
           after moving the pointer is a colour part way between the two and reads as
           whichever end it started from. Both samples are taken after it has settled. */
        const colourNow = () => live.evaluate(() =>
            getComputedStyle(document.getElementById('enh-link-menu-trigger')).color);
        const settle = () => live.waitForTimeout(300);
        await live.mouse.move(5, 5);
        await settle();
        const resting = await colourNow();
        await menu.hover();
        await settle();
        const hovered = await colourNow();
        await live.mouse.move(5, 5);
        await live.mouse.click(5, 5);
        await settle();
        const closed = await live.evaluate(() => {
            const dropdown = document.getElementById('enh-link-menu-dropdown');
            return !dropdown || !dropdown.matches(':popover-open');
        });
        report.push(['link menu', [
            promoted ? 'reaches the top layer' : 'not promoted here',
            hovered !== resting
                ? `the trigger still styles on hover while open (${resting} to ${hovered})`
                : `BROKEN: hover reads ${hovered}, the same as at rest`,
            closed ? 'dismisses on an outside click' : 'BROKEN: stayed open',
        ].join('; ')]);
    } else {
        report.push(['link menu', 'BROKEN: the trigger never appeared']);
    }
    await live.close();

    await browser.close();

    const major = Number((/\b(\d+)\./.exec(version) || [])[1]) || 0;
    process.stdout.write(`Chromium ${version}${major >= 149 ? '' : ' - BEFORE 149, so this says nothing about the change'}\n`);
    report.forEach(([label, answer]) => process.stdout.write(`  ${label}\n      ${answer}\n`));
    /* Anywhere in the line, not at the start of it: the live-surface row joins three
       answers with a semicolon, so a BROKEN in the second or third position was printed
       and then ignored, and the script exited zero saying nothing was wrong. */
    const broken = report.some(([, answer]) => /BROKEN|FOUND/.test(answer));
    if (!controlWorks || major < 149) {
        process.stderr.write(major < 149
            ? '\nThis browser predates the change; run it on 149 or later.\n'
            : '\nThe positive control did not fire. Fix the probe before trusting it.\n');
        process.exit(1);
    }
    process.stdout.write(broken ? '\nSomething here needs fixing.\n' : '\nNo surface depends on the behaviour Chrome 149 removed.\n');
    process.exit(broken ? 1 : 0);
}

main().catch(error => {
    process.stderr.write(`top-layer probe failed: ${error && error.message}\n`);
    process.exit(1);
});
