const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const scriptPath = path.join(root, 'IMDb_Enhanced.user.js');

const script = fs.readFileSync(scriptPath, 'utf8');

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
    assert(!/@connect\s+\*/.test(script), 'wildcard @connect should not return');
    assert(/@noframes/.test(script), '@noframes should remain present');
    assert(!/@match\s+https:\/\/m\.imdb\.com\/\*/.test(script), 'mobile wildcard match should stay scoped');
    assert(/@updateURL/.test(script), '@updateURL should be present for update channel');
    assert(/@downloadURL/.test(script), '@downloadURL should be present for update channel');
});

test('fragile selectors and global Cineby key stay removed', () => {
    assert(!/\.sc-|sc-[0-9a-fA-F]+|sc-[a-z0-9]+/.test(script), 'hashed styled-components selectors should stay removed');
    assert(!/GM_setValue\('movieTitle'/.test(script), 'Cineby should not write the global movieTitle key');
});

test('core features remain registered', () => {
    [
        'streamAvailability',
        'watchedMarking',
        'servarrIntegration',
        'watchlistBatch',
        'themeAuto',
        'getRTSlugCandidates',
        'cacheGC',
    ].forEach(token => assert(script.includes(token), `${token} missing`));
});

test('version strings match', () => {
    const metaVersion = script.match(/@version\s+(\S+)/)?.[1];
    const constVersion = script.match(/const VERSION\s*=\s*'([^']+)'/)?.[1];
    assert(metaVersion, 'metadata @version must exist');
    assert.strictEqual(metaVersion, constVersion, `version mismatch: @version=${metaVersion} vs VERSION=${constVersion}`);
});

test('default watch sites are all live domains', () => {
    const deadDomains = ['popcornmovies.org', 'xprime.su', 'aether.mom', 'rivestream.app', 'cineby.sc', 'cineby.gd', 'cineby.app'];
    deadDomains.forEach(domain => {
        assert(!script.includes(domain), `dead domain ${domain} should be removed`);
    });
});

test('cineby uses current domain', () => {
    assert(script.includes('cineby.at'), 'cineby.at should be the active Cineby domain');
});

console.log('All tests passed.');
