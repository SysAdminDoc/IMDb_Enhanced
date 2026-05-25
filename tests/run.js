const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const scriptPath = path.join(root, 'IMDb_Enhanced.user.js');
const roadmapPath = path.join(root, 'RESEARCH_FEATURE_PLAN.md');

const script = fs.readFileSync(scriptPath, 'utf8');
const roadmap = fs.readFileSync(roadmapPath, 'utf8');

function test(name, fn) {
    try {
        fn();
        console.log(`ok - ${name}`);
    } catch (error) {
        console.error(`not ok - ${name}`);
        throw error;
    }
}

test('userscript parses', () => {
    execFileSync(process.execPath, ['--check', scriptPath], { stdio: 'pipe' });
});

test('metadata stays distribution-safe', () => {
    assert(!/@updateURL|@downloadURL/.test(script), 'dead update/download URLs should not return');
    assert(!/@connect\s+\*/.test(script), 'wildcard @connect should not return');
    assert(/@noframes/.test(script), '@noframes should remain present');
    assert(!/@match\s+https:\/\/m\.imdb\.com\/\*/.test(script), 'mobile wildcard match should stay scoped');
});

test('fragile selectors and global Cineby key stay removed', () => {
    assert(!/\.sc-|sc-[0-9a-fA-F]+|sc-[a-z0-9]+/.test(script), 'hashed styled-components selectors should stay removed');
    assert(!/GM_setValue\('movieTitle'/.test(script), 'Cineby should not write the global movieTitle key');
});

test('core P2 features remain registered', () => {
    [
        'streamAvailability',
        'watchedMarking',
        'servarrIntegration',
        'themeAuto',
        'getRTSlugCandidates',
        'cacheGC',
    ].forEach(token => assert(script.includes(token), `${token} missing`));
});

test('roadmap P0-P2 tasks are complete', () => {
    const openPriority = roadmap.match(/- \[ \] \*\*P[0-2]\*\*/g);
    assert(!openPriority, `open P0-P2 tasks remain: ${(openPriority || []).join(', ')}`);
});

console.log('All tests passed.');
