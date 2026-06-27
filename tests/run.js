const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const scriptPath = path.join(root, 'IMDb_Enhanced.user.js');
const packagePath = path.join(root, 'package.json');
const readmePath = path.join(root, 'README.md');

const script = fs.readFileSync(scriptPath, 'utf8');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const readme = fs.readFileSync(readmePath, 'utf8');

function test(name, fn) {
    try {
        fn();
        console.log(`ok - ${name}`);
    } catch (error) {
        console.error(`not ok - ${name}`);
        throw error;
    }
}

function loadScriptTestHooks() {
    const instrumented = script.replace(/\}\)\(\);\s*$/, `window.__enhTest = {
        normalizeIMDbProviderId,
        normalizeLookupTitle,
        collectProviderIds,
        mediaItemMatches,
        parseMediaServerItems
    };
})();`);
    assert.notStrictEqual(instrumented, script, 'test hook injection failed');

    const location = { hostname: 'example.test', pathname: '/' };
    const sandbox = {
        console,
        URL,
        setTimeout: () => 0,
        clearTimeout: () => {},
        window: { location, addEventListener: () => {} },
        location,
        document: { readyState: 'loading' },
        history: {},
        GM_getValue: (_key, fallback) => fallback,
        GM_setValue: () => {},
        GM_addStyle: () => {},
        GM_setClipboard: () => {},
        GM_xmlhttpRequest: () => {},
        GM_listValues: () => [],
        GM_deleteValue: () => {},
    };
    vm.runInNewContext(instrumented, sandbox, { filename: scriptPath });
    return sandbox.window.__enhTest;
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
    assert.strictEqual(packageJson.version, metaVersion, 'package.json version must match userscript version');
    assert(readme.includes(`badge/version-${metaVersion}-blue`), 'README version badge must match userscript version');
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

test('Greasy Fork distribution guardrails stay intact', () => {
    assert(!/@require\s+/i.test(script), '@require should not be used');
    assert(!/@resource\s+/i.test(script), '@resource should not be used');
    assert(!/@connect\s+\*/i.test(script), 'wildcard @connect should not return');
    assert(!/\beval\s*\(/.test(script), 'eval should not be used');
    assert(!/\bnew\s+Function\s*\(/.test(script), 'new Function should not be used');
    assert(!/createElement\(['"]script['"]\)/.test(script), 'dynamic script tags should not be created');
    assert(!/\bconfirm\s*\(/.test(script), 'confirmation dialogs should not be used');
});

test('media server integration is configurable and local-only', () => {
    [
        'mediaServerIntegration',
        'plexUrl',
        'plexToken',
        'jellyfinUrl',
        'jellyfinApiKey',
        'embyUrl',
        'embyApiKey',
        '/library/search',
        'AnyProviderIdEquals',
    ].forEach(token => assert(script.includes(token), `${token} missing`));
    assert(script.includes('Only localhost and 127.0.0.1 media server URLs are allowed'), 'media server local-only guard missing');
});

test('media server matching handles provider IDs and title fallback', () => {
    const hooks = loadScriptTestHooks();
    assert.strictEqual(hooks.normalizeIMDbProviderId('imdb://tt0133093'), 'tt0133093');
    assert(hooks.mediaItemMatches(
        { providerIds: ['imdb://tt0133093'] },
        { imdbId: 'tt0133093', title: 'The Matrix', year: 1999 }
    ), 'Plex-style GUID match failed');
    assert(hooks.mediaItemMatches(
        { Name: 'The Matrix', ProductionYear: 1999, ProviderIds: {} },
        { imdbId: 'tt0133093', title: 'The Matrix', year: 1999 }
    ), 'title/year fallback match failed');
    assert(!hooks.mediaItemMatches(
        { Name: 'The Matrix Reloaded', ProductionYear: 2003, ProviderIds: {} },
        { imdbId: 'tt0133093', title: 'The Matrix', year: 1999 }
    ), 'different title should not match');

    const parsed = hooks.parseMediaServerItems(JSON.stringify({
        Items: [{ Name: 'Alien', ProductionYear: 1979, ProviderIds: { Imdb: 'tt0078748' } }],
    }));
    assert.strictEqual(parsed.length, 1, 'Jellyfin/Emby item parser failed');
    assert(hooks.mediaItemMatches(parsed[0], { imdbId: 'tt0078748', title: 'Alien', year: 1979 }), 'parsed item did not match');
});

console.log('All tests passed.');
