const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

/* The rest of this file asserts as it goes; the archive cases below are named so a
   failure says which one, and so they cannot stop the file at the first problem. */
let packFailures = 0;
function test(name, fn) {
    try { fn(); console.log(`ok - ${name}`); }
    catch (error) { packFailures += 1; console.error(`not ok - ${name}`); console.error(error); }
}

/* Reads the entry names out of a finished archive using the central directory, which is
   what a reader does — rather than trusting the writer to say what it wrote. */
function readZipEntries(archive) {
    const zlib = require('zlib');
    const end = archive.length - 22;
    if (archive.readUInt32LE(end) !== 0x06054b50) throw new Error('end-of-central-directory record expected');
    const count = archive.readUInt16LE(end + 10);
    let offset = archive.readUInt32LE(end + 16);
    const entries = [];
    for (let index = 0; index < count; index += 1) {
        if (archive.readUInt32LE(offset) !== 0x02014b50) throw new Error('central directory entry expected');
        const method = archive.readUInt16LE(offset + 10);
        const time = archive.readUInt16LE(offset + 12);
        const date = archive.readUInt16LE(offset + 14);
        const crc = archive.readUInt32LE(offset + 16);
        const compressedSize = archive.readUInt32LE(offset + 20);
        const size = archive.readUInt32LE(offset + 24);
        const nameLength = archive.readUInt16LE(offset + 28);
        const extraLength = archive.readUInt16LE(offset + 30);
        const commentLength = archive.readUInt16LE(offset + 32);
        const localOffset = archive.readUInt32LE(offset + 42);
        const name = archive.toString('utf8', offset + 46, offset + 46 + nameLength);

        /* Follow the offset the directory gives and read the file the way a reader does,
           rather than trusting the directory to describe itself. */
        if (archive.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`local header expected for ${name}`);
        if (archive.readUInt16LE(localOffset + 8) !== method) throw new Error(`${name}: method disagrees with the directory`);
        if (archive.readUInt32LE(localOffset + 14) !== crc) throw new Error(`${name}: CRC disagrees with the directory`);
        if (archive.readUInt32LE(localOffset + 18) !== compressedSize) throw new Error(`${name}: compressed size disagrees`);
        if (archive.readUInt32LE(localOffset + 22) !== size) throw new Error(`${name}: uncompressed size disagrees`);
        const localNameLength = archive.readUInt16LE(localOffset + 26);
        const localExtraLength = archive.readUInt16LE(localOffset + 28);
        const dataAt = localOffset + 30 + localNameLength + localExtraLength;
        const payload = archive.subarray(dataAt, dataAt + compressedSize);
        const body = method === 8 ? zlib.inflateRawSync(payload) : Buffer.from(payload);
        if (body.length !== size) throw new Error(`${name}: decompressed to ${body.length} bytes, not ${size}`);
        const { crc32 } = require('../scripts/pack.js');
        if (crc32(body) !== crc) throw new Error(`${name}: CRC does not match the bytes it describes`);

        entries.push({ name, body, method, time, date });
        offset += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
}

function readZipNames(archive) {
    return readZipEntries(archive).map(entry => entry.name);
}

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extension', 'manifest.json'), 'utf8'));
const content = fs.readFileSync(path.join(root, 'extension', 'content.js'), 'utf8');
const background = fs.readFileSync(path.join(root, 'extension', 'background.js'), 'utf8');
const source = fs.readFileSync(path.join(root, 'IMDb_Enhanced.user.js'), 'utf8');

assert.strictEqual(manifest.manifest_version, 3, 'extension must use Manifest V3');
assert.strictEqual(manifest.version, pkg.version, 'extension manifest version must match package version');
assert(manifest.permissions.includes('storage'), 'extension storage permission missing');
assert(manifest.permissions.includes('declarativeNetRequestWithHostAccess'), 'extension request-blocking permission missing');
assert.strictEqual(manifest.icons['16'], 'icons/icon16.png', 'extension 16px icon missing');
assert.strictEqual(manifest.icons['128'], 'icons/icon128.png', 'extension 128px icon missing');
assert.strictEqual(manifest.action.default_icon['16'], 'icons/icon16.png', 'toolbar icon missing');
new Set([
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
]).forEach(iconPath => {
    assert(fs.existsSync(path.join(root, 'extension', iconPath)), `extension icon asset missing: ${iconPath}`);
});
/* Where the content script runs was the last list kept by hand beside the userscript's
   own @match block, and the two had already parted company: the mobile host could be
   deleted from the manifest with every test green and the feature dead in the shipped
   package. Projected now, and compared here in both directions. */
const userscriptMatches = [...source.matchAll(/^\/\/ @match\s+(\S+)$/gm)].map(match => match[1]);
assert(userscriptMatches.length >= 15, 'the userscript should declare its pages');
assert.deepStrictEqual(manifest.content_scripts[0].matches, userscriptMatches,
    'the extension must run exactly where the userscript says it runs');
assert(userscriptMatches.includes('https://m.imdb.com/*'),
    'including IMDb\'s mobile host, which is where the desktop redirect has to run');

/* And the script must not treat that host as one it styles: the boot rules hide the body
   until real settings arrive, which on a page nothing will restyle is a blank screen for
   anybody who turned the redirect off or is holding a phone. */
assert(/__host === 'www\.imdb\.com'/.test(content.slice(0, 1200)),
    'the boot blanking must be scoped to the host it actually restyles');
assert(/html\[data-imdb-enhanced-booting\] body \{ visibility: hidden/.test(
    fs.readFileSync(path.join(root, 'extension', 'boot.css'), 'utf8')),
    'and the rule it gates should still be the one that hides the page');

/* IE-75: the install prompt is what a user reads to decide whether to trust this, and it
   used to describe every score, ad, video and loopback origin whether or not the feature
   was on. IMDb is the only thing the extension cannot work without. */
/* Both of IMDb's own hosts, and nothing else. The mobile one carries a single job — send
   a desktop browser to the page it was actually looking for — and asking permission to
   leave a page nobody chose would be a strange prompt to write. */
assert.deepStrictEqual(manifest.host_permissions, ['https://www.imdb.com/*', 'https://m.imdb.com/*'],
    'only IMDb access may be required at install');
[
    'https://backend.metacritic.com/*', 'https://www.rottentomatoes.com/*',
    'https://letterboxd.com/*', 'https://www.justwatch.com/*', 'https://www.youtube.com/*',
    'https://query.wikidata.org/*', 'https://*.amazon-adsystem.com/*',
    'http://localhost/*', 'http://127.0.0.1/*',
].forEach(origin => {
    assert(manifest.optional_host_permissions.includes(origin), `${origin} should be optional, not required`);
    assert(!manifest.host_permissions.includes(origin), `${origin} must not be required at install`);
});
/* Derived from the userscript's feature map, never maintained beside it: a hand-kept
   second list is how a feature quietly keeps a permission it no longer uses. */
assert(/const FEATURE_PROVIDERS = \{[\s\S]*?\n    \};/.test(source),
    'the userscript must declare which providers each feature needs');
assert(/const FEATURE_ORIGIN_GROUPS = Object\.fromEntries\(/.test(source),
    'the origin groups must be projected from the provider declarations, not kept beside them');
/* Collected from the declaration region by text, independently of how the build computes
   the union, so this catches a feature group the manifest forgot and a manifest entry no
   feature asks for. */
const originRegion = source.match(/const LOOPBACK_ORIGINS = \[[\s\S]*?const TRANSMITTED_DATA_CATEGORIES = [\s\S]*?\)\]\.sort\(\);/);
assert(originRegion, 'the origin declarations must stay in one readable region');
const declaredOrigins = [...new Set((originRegion[0].match(/'(https?:\/\/[^']+)'/g) || []).map(s => s.slice(1, -1)))]
    .filter(origin => !manifest.host_permissions.includes(origin));
assert.deepStrictEqual(
    manifest.optional_host_permissions.slice().sort(),
    declaredOrigins.slice().sort(),
    'the manifest optional origins must be exactly the union of the feature groups');
assert(source.includes('const OPTIONAL_ORIGINS = [...new Set(Object.values(FEATURE_ORIGIN_GROUPS).flat())]'),
    'the optional origin list must be derived structurally, not enumerated by hand');

/* IE-90: a provider's origins, cache lifetime, what it transmits, what the panel says
   about it, the credit it requires, and the builds it may ship in were maintained in four
   places that drifted with nothing to catch it. One declaration is the source now, and an
   incomplete one has to stop the build rather than surface later as a blank line in the
   settings panel or an origin nobody can account for. */
const REQUIRED_PROVIDER_FIELDS = ['label', 'origins', 'transmits', 'consent', 'ttl', 'attribution', 'profiles'];
const providerRegion = originRegion[0];
assert(/const PROVIDERS = \{/.test(providerRegion), 'the providers must be declared in that same region');
const providerIds = [...providerRegion.matchAll(/^\s{8}(\w+): \{$/gm)].map(match => match[1]);
assert(providerIds.length >= 8, `expected every provider to be declared, found ${providerIds.length}`);
providerIds.forEach(id => {
    const body = providerRegion.slice(providerRegion.indexOf(`        ${id}: {`));
    const declaration = body.slice(0, body.indexOf('\n        },'));
    REQUIRED_PROVIDER_FIELDS.forEach(field => {
        assert(new RegExp(`^\\s{12}${field}:`, 'm').test(declaration),
            `provider "${id}" does not declare ${field}`);
    });
});
assert(source.includes("const WIKIDATA_ID_TTL = PROVIDERS.wikidata.ttl;"),
    'a cache lifetime must come from the provider that owns it, not be restated at the call site');

/* The build is the thing that has to fail, so exercise it rather than trusting the shape
   above. Each mutation is applied to a copy of the source and the generator is asked to
   read it; a build that accepts any of these has stopped being a gate. */
const { validateProviders } = require('../scripts/build-extension.js');
assert.strictEqual(typeof validateProviders, 'function', 'the provider validator must be reachable to test');
const soundRegistry = () => ({
    PROVIDERS: {
        alpha: { label:'Alpha', origins:['https://alpha.test/*'], transmits:'websiteContent', consent:'Sends the title.', ttl:1000, attribution:'', profiles:['default'] },
    },
    FEATURE_PROVIDERS: { someFeature:['alpha'] },
    OPTIONAL_ORIGINS: ['https://alpha.test/*'],
    DISTRIBUTION_PROFILES: ['default', 'store'],
    PROVIDER_REQUIRED_FIELDS: REQUIRED_PROVIDER_FIELDS,
    TRANSMITTED_DATA_CATEGORIES: ['websiteContent'],
});
assert.doesNotThrow(() => validateProviders(soundRegistry()), 'a complete registry must pass');
[
    ['a missing field', r => { delete r.PROVIDERS.alpha.consent; }, /missing the required field "consent"/],
    ['no origins', r => { r.PROVIDERS.alpha.origins = []; }, /declares no origins/],
    ['an empty label', r => { r.PROVIDERS.alpha.label = ''; }, /label and a consent sentence/],
    ['a negative lifetime', r => { r.PROVIDERS.alpha.ttl = -1; }, /unusable cache lifetime/],
    ['no profile', r => { r.PROVIDERS.alpha.profiles = []; }, /at least one distribution profile/],
    ['an unknown profile', r => { r.PROVIDERS.alpha.profiles = ['beta']; }, /unknown distribution profile/],
    ['a feature naming a provider that does not exist', r => { r.FEATURE_PROVIDERS.someFeature = ['ghost']; }, /undeclared provider "ghost"/],
    ['an origin belonging to no provider', r => { r.OPTIONAL_ORIGINS.push('https://stray.test/*'); }, /belong to no provider/],
].forEach(([name, break_, expected]) => {
    const registry = soundRegistry();
    break_(registry);
    assert.throws(() => validateProviders(registry), expected, `the build must refuse ${name}`);
});
assert.strictEqual(manifest.background.service_worker, 'background.js');
assert.strictEqual(manifest.content_scripts[0].js[0], 'content.js');
assert.strictEqual(manifest.content_scripts[0].run_at, 'document_start');
assert(manifest.content_scripts[0].matches.includes('https://www.imdb.com/title/*'), 'title route content scope missing');
assert(!manifest.content_scripts[0].matches.includes('https://www.imdb.com/*'), 'extension content scope must not include IMDb homepage');

assert(!content.includes('==UserScript=='), 'generated extension content must not retain userscript metadata');
assert(content.includes("__storage('get', null)"), 'extension content must preload extension storage');
assert(content.includes('chrome.storage.local[method](arg, done)'), 'storage calls must use the callback form both engines accept');
assert(content.includes('globalThis.GM_xmlhttpRequest'), 'extension bridge must provide the shared request API');
/* The userscript's cross-tab defences (setUserMark's forced re-read) assume
   GM_getValue reflects live manager storage. A snapshot silently turns those into
   no-ops, so the mirror has to track storage for the page lifetime. */
assert(content.includes('chrome.storage.onChanged.addListener'), 'extension bridge must follow storage changes made by other tabs');
assert(/__state\[key\]\s*=\s*change\.newValue/.test(content), 'storage changes from other tabs must update the bridge mirror');
assert(content.includes('__pendingChanges'), 'storage changes arriving during the initial read must not be dropped');
/* Every save-failure path in the userscript keys off GM_setValue throwing, and
   copyTextToClipboard reports success from its call returning. A swallowed promise
   rejection turns both into optimistic lies about durable state. */
assert(content.includes('imdb-enhanced:settings-save-failed'), 'a rejected extension storage write must reach the save-state UI');
assert(!/chrome\.storage\.local\.(set|remove)\([^)]*\)\.catch\(\(\) => \{\}\)/.test(content), 'extension storage writes must not swallow rejections');
assert(content.includes('imdb-enhanced:clipboard-failed'), 'a refused clipboard write must be reported rather than dropped');
assert(!/navigator\.clipboard\.writeText\([^)]*\)\.catch\(\(\) => \{\}\)/.test(content), 'clipboard rejections must not be swallowed');
/* Five call sites read finalUrl to re-validate a URL after redirects; the bridge
   previously emitted only the platform-native responseURL, so every one fell back. */
assert(content.includes('finalUrl:String(response.responseURL'), 'the bridge must expose finalUrl for post-redirect URL validation');
/* Everything after the bridge's await runs with the parser already going, so the
   anti-flash rules have to arrive through content_scripts.css, which the browser
   applies synchronously at document_start. */
const bootCss = fs.readFileSync(path.join(root, 'extension', 'boot.css'), 'utf8');
assert.deepStrictEqual(manifest.content_scripts[0].css, ['boot.css'], 'boot styles must be injected synchronously by the browser');
assert(fs.existsSync(path.join(root, 'extension', 'boot.css')), 'the generated boot stylesheet must ship');
assert(bootCss.includes('html[data-imdb-enhanced-booting] body { visibility: hidden !important; }'),
    'the boot gate must suppress the pre-theme flash');
assert(bootCss.includes('.nas-slot'), 'boot rules must be generated from the userscript ad selectors');
const preludeIndex = content.indexOf("setAttribute('data-imdb-enhanced-booting'");
const awaitIndex = content.indexOf("await __storage('get', null)");
assert(preludeIndex > 0 && preludeIndex < awaitIndex, 'the boot gate must be set before the first await');
assert(content.includes('setTimeout(__clearBoot,'), 'a storage failure must never leave the page hidden');
assert(content.indexOf('__clearBoot();') > awaitIndex, 'the gate must clear once real settings are known');
assert(content.includes("const VERSION = '" + pkg.version + "'"), 'generated content must include the current source');
assert(!/\beval\s*\(/.test(content), 'MV3 content must not depend on eval');
/* The generated file is what ships, so the build-neutral copy has to survive
   generation — an extension user must never be told to check a userscript manager. */
assert(!content.includes('userscript manager'), 'generated content must not name a userscript manager');
assert(!content.includes('userscript clipboard permission'), 'generated content must not name a userscript clipboard grant');
assert(background.includes("callApi(chrome.declarativeNetRequest, 'updateDynamicRules'"), 'background worker must manage dynamic ad rules');
assert(background.includes('function callApi('), 'background API calls must work on both callback- and promise-style engines');
/* Dynamic rules outlive extension updates, so a build must clear the whole reserved
   band rather than only the ids it happens to know about. */
assert(background.includes('AD_RULE_ID_CAPACITY'), 'ad rule removal must cover a reserved id band');
assert(!manifest.host_permissions.includes('https://www.metacritic.com/*'), 'only origins that are actually requested should be granted');
assert(!background.includes("'www.metacritic.com'"), 'the proxy allowlist must not carry an origin nothing fetches');
assert(background.includes("credentials: 'omit'"), 'background requests must omit destination credentials');
assert(background.includes("ALLOWED_CONTENT_HOSTS"), 'background messages must be sender-scoped');
assert(source.includes("category:'watch'"), 'userscript source should remain the extension source of truth');

// Firefox implements MV3 with event pages and opt-in host permissions, so its
// manifest must diverge from the Chromium one in exactly these ways.
const { toFirefoxManifest, FIREFOX_ADDON_ID, FIREFOX_COPIED_FILES, MESSAGE_CATALOG, localeFiles, localeFileNames, PSEUDO_LOCALE } = require('../scripts/build-extension.js');
const firefox = toFirefoxManifest(manifest);
assert.deepStrictEqual(firefox.background, { scripts:['background.js'] }, 'Firefox needs an event page, not a service worker');
assert.strictEqual(firefox.browser_specific_settings.gecko.id, FIREFOX_ADDON_ID, 'Firefox build needs a stable add-on id');
assert.strictEqual(firefox.browser_specific_settings.gecko.strict_min_version, '142.0', 'the data-collection declaration AMO requires needs Firefox 140+ (Android 142+)');
/* Nothing is required because with every optional feature off, nothing is transmitted.
   But "none" full stop was not true: an enabled score or availability lookup sends the
   title and year read from the page to a third party, which is page content leaving the
   browser. It is declared optional because it happens only for sources the user turns
   on, and those now request their origins at that moment. */
assert.deepStrictEqual(
    firefox.browser_specific_settings.gecko.data_collection_permissions,
    { required:['none'], optional:['websiteContent'] },
    'the data-collection declaration must match what enabled lookups actually transmit');
assert.strictEqual(firefox.action.default_popup, 'permissions.html', 'Firefox needs a surface that can request opt-in host permissions');
assert.strictEqual(firefox.minimum_chrome_version, undefined, 'Chromium-only keys must not ship to Firefox');
assert.strictEqual(firefox.manifest_version, 3, 'Firefox build must remain Manifest V3');
assert.deepStrictEqual(firefox.host_permissions, manifest.host_permissions, 'both builds must request the same origins');
assert.deepStrictEqual(firefox.content_scripts, manifest.content_scripts, 'both builds must cover the same routes');
FIREFOX_COPIED_FILES.forEach(name => {
    assert(fs.existsSync(path.join(root, 'extension', name)), `Firefox build input missing: ${name}`);
});
/* The behavioural coverage for these lives in tests/background.js, which executes the
   worker. These two only guard against the hardening being deleted wholesale, since a
   background.js that no longer classifies redirects would still load and answer. */
/* 'manual' rather than 'error': both stop the hop, but only 'manual' is distinguishable
   from an unreachable host, which browsers report with the identical opaque TypeError. */
assert(background.includes("redirect: carriesCredentials ? 'manual' : 'follow'"),
    'a credential-bearing privileged fetch must not follow redirects');
assert(background.includes("response.type === 'opaqueredirect'"),
    'a stopped redirect must be recognized from the response, not inferred from an error message');
assert(background.includes('const landed = describeRequestUrl(landedUrl);'),
    'the privileged fetch must re-validate the URL a response actually came from');

/* IE-79: the toolbar action was inert, so every recovery action depended on the content
   script having injected into an IMDb page — the exact thing that is broken when someone
   needs to reset or restore. */
assert.strictEqual(manifest.options_ui?.page, 'recovery.html', 'the extension needs a recovery page');
assert.strictEqual(manifest.options_ui?.open_in_tab, true, 'the recovery page needs room to work, not a popup');
assert(fs.existsSync(path.join(root, 'extension', 'recovery.html')), 'recovery.html must ship');
assert(fs.existsSync(path.join(root, 'extension', 'recovery.js')), 'recovery.js must be generated');
assert(background.includes('chrome.action?.onClicked'), 'the toolbar action must do something');
assert(background.includes('openOptionsPage'), 'the toolbar action must open the recovery page');
const recovery = fs.readFileSync(path.join(root, 'extension', 'recovery.js'), 'utf8');
/* The point of the recovery page is that it is the SAME settings layer, not a second
   implementation. It gets there by loading the userscript body behind the same bridge
   and taking the helpers from the recovery hook. */
assert(recovery.includes('__imdbEnhancedRecoveryHook'), 'the recovery page must receive canonical helpers through the hook');
assert(recovery.includes("__storage('get', null)"), 'the recovery page must use the same storage bridge');
[
    'getExportSettings', 'prepareSettingsImport', 'applySettingsImport',
    'getDefaultSettingsEntries', 'buildDiagnosticsReport', 'createEncryptedBackup',
].forEach(name => {
    assert(recovery.includes(name), `the recovery page must reuse the canonical ${name}`);
    /* Reused, not reimplemented: each helper is defined exactly once in the bundle,
       by the userscript body it loads. */
    assert.strictEqual(
        (recovery.match(new RegExp(`function ${name}\\(`, 'g')) || []).length, 1,
        `${name} must be defined once in the recovery bundle, not reimplemented`);
});
const recoveryHtml = fs.readFileSync(path.join(root, 'extension', 'recovery.html'), 'utf8');
['export', 'restore', 'reset', 'undo', 'copy-diagnostics', 'open-imdb', 'secure-export'].forEach(id => {
    assert(recoveryHtml.includes(`id="${id}"`), `the recovery page is missing its ${id} control`);
});
// Every control is a real button, so keyboard activation needs no extra handling.
assert(!/<div[^>]*\srole="button"/.test(recoveryHtml), 'recovery controls must be real buttons, not div roles');
// The same [hidden]-vs-display trap that bit the catalog and the passphrase row.
assert(/\[hidden\] \{ display: none !important; \}/.test(recoveryHtml),
    'the recovery page toggles .hidden on panels that set their own display');

/* IE-90: an optional data-collection declaration has to be requested before the data is
   collected, and Mozilla's rule is that such a request cannot include any other optional
   permission — so it can never be bundled with an origin grant. */
const recoverySource = fs.readFileSync(path.join(root, 'scripts', 'recovery-page.js'), 'utf8');
assert(recoverySource.includes("chrome.permissions.request({ data_collection: DATA_COLLECTION }"),
    'the declared optional data collection must actually be requested');
assert(!/request\(\{[^}]*data_collection[^}]*origins/.test(recoverySource)
    && !/request\(\{[^}]*origins[^}]*data_collection/.test(recoverySource),
    'a data-collection request may not carry any other optional permission');
// Feature-detected from the API's own response, never from a browser sniff: Chromium
// ignores the key, so the control simply does not appear there.
assert(recoverySource.includes("hasOwnProperty.call(granted, 'data_collection')"),
    'the consent control must be feature-detected, not browser-sniffed');
assert(!/isFirefox|browser !== undefined \? true/.test(recoverySource), 'no browser sniffing');

const permissionsScript = fs.readFileSync(path.join(root, 'extension', 'permissions.js'), 'utf8');
assert(fs.readFileSync(path.join(root, 'extension', 'permissions.html'), 'utf8').includes('recovery.html'),
    'Firefox opens the popup instead of the action handler, so it needs a link to the recovery page');
assert(permissionsScript.includes('permissions.request'), 'the popup must be able to request the opt-in origins');
assert(permissionsScript.includes('getManifest'), 'the popup must derive origins from the manifest rather than a second hard-coded list');

/* What is on disk, relative to a build directory, in a stable order. Checking only that
   the expected names are present cannot see a file an older build left behind, and that
   file goes into the uploaded zip. The generators empty their output directory first; this
   is what proves they did. */
function listBuildFiles(dir, prefix = '') {
    return fs.readdirSync(dir, { withFileTypes:true })
        .flatMap(entry => (entry.isDirectory()
            ? listBuildFiles(path.join(dir, entry.name), `${prefix}${entry.name}/`)
            : [`${prefix}${entry.name}`]))
        .sort();
}

/* The Firefox assertions above check a manifest computed in this process, which says
   nothing about the directory that actually ships. Read the built files instead — a
   stale extension-firefox/ is otherwise indistinguishable from a broken generator
   without rebuilding by hand. `npm test` builds it with --firefox first. */
const firefoxDir = path.join(root, 'extension-firefox');
assert(fs.existsSync(firefoxDir),
    'extension-firefox/ is missing; npm test must build it with --firefox before validating it');
const builtFirefoxManifest = JSON.parse(fs.readFileSync(path.join(firefoxDir, 'manifest.json'), 'utf8'));
assert.strictEqual(builtFirefoxManifest.version, pkg.version, 'the built Firefox manifest is a release behind');
assert.deepStrictEqual(builtFirefoxManifest, firefox, 'the built Firefox manifest diverges from the generator');
assert.strictEqual(
    fs.readFileSync(path.join(firefoxDir, 'content.js'), 'utf8'),
    content,
    'both builds must ship the same generated content script');
assert.strictEqual(
    fs.readFileSync(path.join(firefoxDir, 'boot.css'), 'utf8'),
    bootCss,
    'the Firefox build must ship the same synchronous boot stylesheet');
assert.deepStrictEqual(
    listBuildFiles(firefoxDir),
    [
        'boot.css', 'content.js', 'manifest.json', 'recovery.js',
        ...FIREFOX_COPIED_FILES,
        ...localeFileNames(),
        ...Object.values(builtFirefoxManifest.icons || {}),
        ...Object.values(builtFirefoxManifest.action?.default_icon || {}),
    ].filter((name, index, all) => all.indexOf(name) === index).sort(),
    'the Firefox build directory must hold exactly what the generator emits');

/* IE-89: in an extension build a secret must not reach the page's tab at all, so the
   content bundle keeps credential values out of its own storage mirror and the settings
   field cannot be pre-filled from one. The two lists that make that work are written in
   different files and would drift apart silently, so tie them together here. */
const credentialKeys = (source.match(/const CREDENTIAL_SETTING_KEYS = new Set\(\[([\s\S]*?)\]\);/) || [])[1];
assert(credentialKeys, 'the userscript must declare which settings are credentials');
const credentialNames = [...credentialKeys.matchAll(/'([^']+)'/g)].map(m => m[1]).sort();
assert(credentialNames.length >= 6, 'every integration secret must be listed as a credential');
/* Each credential is now bound to the destination it may reach, so the allowlist is the
   keys of that map. A key with no binding cannot be injected anywhere. */
const bindingBlock = (background.match(/const CREDENTIAL_DESTINATIONS = new Map\(\[([\s\S]*?)\]\);/) || [])[1];
assert(bindingBlock, 'the background worker must bind each credential to a destination');
assert.deepStrictEqual(
    [...bindingBlock.matchAll(/\['(imdb_enh_[^']+)'/g)].map(m => m[1]).sort(),
    credentialNames.map(name => `imdb_enh_${name}`).sort(),
    'the background bindings and the credential settings must name the same keys');
assert(background.includes('const CREDENTIAL_STORAGE_KEYS = new Set(CREDENTIAL_DESTINATIONS.keys());'),
    'the injectable keys must be exactly the bound ones, not a second list');
/* Two credentials leave the machine, each to exactly one host over TLS. Every other one
   is bound to loopback, so no request to a public host can ask for it. */
assert(/\['imdb_enh_tmdbReadToken', \{ host: 'api\.themoviedb\.org', header: 'Authorization', scheme: 'Bearer ' \}\]/.test(background),
    'the TMDB token must be bound to TMDB, to the header it rides in, and to the scheme it is sent under');
/* The header name is the binding's too, not the calling page's, so every key that is sent
   as a header has to name one. A binding that forgot would attach nothing at all. */
[...bindingBlock.matchAll(/\['(imdb_enh_[^']+)', \{([\s\S]*?)\}\]/g)].forEach(([, key, body]) => {
    if (/\bquery:/.test(body)) return;
    assert(/\bheader: '/.test(body), `${key} must name the header its value is sent in`);
});
/* OMDb takes its key only in the query string, so its binding names the parameter rather
   than a header scheme. The name is the worker's, not the caller's, for the same reason
   the scheme is. */
assert(/\['imdb_enh_omdbApiKey', \{ host: 'www\.omdbapi\.com', query: 'apikey' \}\]/.test(background),
    'the OMDb key must be bound to OMDb and to the parameter it is carried in');
const offMachine = [...bindingBlock.matchAll(/\['(imdb_enh_[^']+)', \{ host:/g)].map(m => m[1]).sort();
assert.deepStrictEqual(offMachine, ['imdb_enh_omdbApiKey', 'imdb_enh_tmdbReadToken'],
    'no other credential may be bound to an off-machine destination without being noticed here');
/* A key carried in the URL is a secret in the address, so the address the response came
   from must never be handed back to the page that could not read the key in the first
   place. */
assert(background.includes('const finalUrl = credentialInUrl ? url : landedUrl;'),
    'a URL-carried credential must not be reported back in the response URL');
/* The worker used to keep its own copy of the hosts it would fetch, which meant a newly
   declared provider was silently refused by the one component that has to reach it. */
assert(!background.includes('const ALLOWED_REQUEST_HOSTS = new Set(['),
    'the request hosts must come from the manifest, not a second hand-kept list');
assert(background.includes('function getAllowedRequestHosts()'),
    'the worker must derive the hosts it will fetch from the origins the manifest declares');

assert(content.includes('__TRUSTED_CONTEXT = false'), 'the content bundle must run as an untrusted context');
assert(recovery.includes('__TRUSTED_CONTEXT = true'),
    'the options page owns backup and restore, so it keeps full storage access');
/* The redaction has to happen where the mirror is filled, not where it is read: a value
   that reaches __state at all is readable by anything running in that world. */
assert(/__TRUSTED_CONTEXT[\s\S]{0,400}CREDENTIAL_KEYS/.test(content),
    'the untrusted mirror must drop credential values as it is populated');
assert(content.includes('__imdbEnhancedCredentialConfigured'),
    'an untrusted context needs a way to learn a credential exists without reading it');
/* Guards against the settings field going back to reading the value to decide what to
   show, which is what made the redaction pointless before. */
assert(/const writeOnly = isCredential && !credential\.value && credential\.configured/.test(source),
    'a stored credential must render as write-only rather than as an empty, unconfigured field');
assert(source.includes('credentialHeader'), 'requests must name the credential they need, not carry it');
assert(!/headers\[[^\]]*\]\s*=\s*(?:get|getSetting)\(\s*'(?:radarr|sonarr|seerr|plex|jellyfin|emby)/i.test(source),
    'no request may build a header from a credential value read in the page context');

/* IE-92: the store profile. Asserted against the generated output rather than the source,
   because what a reviewer reads is the file that ships. `npm test` builds it first. */
const { applyStoreProfile, computeStoreBuild, STORE_COPIED_FILES, PROVIDER_REGISTRY: originLists } = require('../scripts/build-extension.js');
const storeContent = applyStoreProfile(content);
assert(storeContent.includes("const DISTRIBUTION_PROFILE = 'store';"),
    'a store build must know which build it is, so it can say why a source is missing');
assert(!content.includes("const DISTRIBUTION_PROFILE = 'store';"),
    'and the ordinary build must not claim to be one');
assert(/const DEFAULT_WATCH_SITES = \[\];/.test(storeContent),
    'a store listing may not ship default watch destinations');
assert(/const FMHY_WATCH_CATALOG = \[\];/.test(storeContent),
    'nor the catalog they are chosen from');
['rivestream', 'cinejoy.to', 'lookmovie2', 'hydrahd', 'cine.su'].forEach(host => {
    assert(!storeContent.includes(host), `a watch destination survived the store cut: ${host}`);
    assert(content.includes(host), `${host} should still be in the ordinary build, or this proves nothing`);
});

/* An excluded provider is a capability, not data: its origins are not requested, so the
   build cannot reach it whatever its code says, and the feature reports itself unavailable
   and names the missing source. Deleting the parser too would leave nothing able to render
   that explanation. */
const storeExcluded = Object.entries(originLists.PROVIDERS)
    .filter(([, provider]) => !provider.profiles.includes('store'))
    .map(([id]) => id);
assert(storeExcluded.length >= 4, `expected the page-parsing providers to be excluded, got ${storeExcluded.join(', ') || 'none'}`);
assert(storeExcluded.includes('rottenTomatoes') && storeExcluded.includes('justWatch'),
    'a provider read by parsing someone else\'s page must not ship to a store');
const storeDropped = new Set(storeExcluded.flatMap(id => originLists.PROVIDERS[id].origins));
const storeOrigins = manifest.optional_host_permissions.filter(origin => !storeDropped.has(origin));
assert(storeOrigins.length < manifest.optional_host_permissions.length,
    'excluding providers must actually drop origins, or the two are out of step');
assert(storeOrigins.includes('https://api.themoviedb.org/*'),
    'an API-based provider must survive, or availability has no source at all in a store build');
storeExcluded.forEach(id => {
    originLists.PROVIDERS[id].origins.forEach(origin => {
        assert(!storeOrigins.includes(origin), `store build still requests ${origin} for excluded ${id}`);
    });
});
assert(source.includes('function featureExcludedByProfile(key)'),
    'a feature whose providers are all excluded must be able to know it');
/* One per score widget, read from the map that names them rather than written down: a
   fixed number stops covering the next source someone adds. */
const scoreWidgetCount = Object.keys(
    // eslint-disable-next-line no-new-func
    new Function(`${source.match(/const SCORE_WIDGET_IDS = \{[\s\S]*?\n    \};/)[0]}\nreturn SCORE_WIDGET_IDS;`)()
).length;
assert(scoreWidgetCount >= 4, 'the score widgets should be discoverable');
assert.strictEqual((source.match(/if \(featureExcludedByProfile\(this\.key\)\) \{ this\._renderUnavailable\('excluded'\); return; \}/g) || []).length, scoreWidgetCount,
    'and every score lookup must check before it starts');
assert(source.includes('function describeProfileExclusion(key)'),
    'and say which source is missing rather than just going quiet');

/* Everything above computes the store profile in this process, which says nothing about
   the directory that gets zipped and uploaded. extension-firefox/ is read from disk for
   exactly this reason and extension-store/ was not, so a stale or hand-edited store build
   was undetectable. `npm test` builds it with --store first. */
const storeDir = path.join(root, 'extension-store');
assert(fs.existsSync(storeDir),
    'extension-store/ is missing; npm test must build it with --store before validating it');
const store = computeStoreBuild();
Object.entries(store.files).forEach(([name, expected]) => {
    assert.strictEqual(
        fs.readFileSync(path.join(storeDir, name), 'utf8'),
        expected,
        `extension-store/${name} diverges from the generator; run npm run build:store`);
});
assert.deepStrictEqual(
    listBuildFiles(storeDir),
    [
        ...Object.keys(store.files),
        ...STORE_COPIED_FILES,
        ...localeFileNames(),
        ...Object.values(store.manifest.icons || {}),
        ...Object.values(store.manifest.action?.default_icon || {}),
    ].filter((name, index, all) => all.indexOf(name) === index).sort(),
    'the store build directory must hold exactly what the generator emits');
/* The listing text is read before the code is. Reusing the default description would
   advertise score widgets this build deliberately leaves out. */
assert.notStrictEqual(store.manifest.description, manifest.description,
    'the store build must describe what it ships, not what the full build ships');
assert(store.manifest.description.length <= 132,
    'Chrome truncates a manifest description past 132 characters');
store.excluded.forEach(id => {
    const label = originLists.PROVIDERS[id].label;
    assert(!store.manifest.description.toLowerCase().includes(label.toLowerCase()),
        `the store description advertises ${label}, which that build excludes`);
});
/* The other capability the store build cuts has no provider behind it, so no label to
   match: applyStoreProfile empties the watch-destination lists. */
assert(!/destination|watch site|streaming site|catalogue|catalog|directory/i.test(store.manifest.description),
    'the store description must not advertise the watch-destination catalog it omits');
/* And the positive half: everything this build answers with comes from a service the user
   supplies a key for, so the listing has to say which. A reviewer reads the description
   before the manifest. */
const keyedStoreProviders = Object.entries(originLists.PROVIDERS)
    .filter(([id, provider]) => provider.profiles.includes('store') && /needs your own/i.test(provider.consent)
        && Object.values(originLists.FEATURE_PROVIDERS).some(list => list.includes(id)))
    .map(([, provider]) => provider.label);
assert(keyedStoreProviders.length >= 2,
    'the store build answers from keyed services, or this check is watching the wrong thing');
keyedStoreProviders.forEach(label => {
    assert(store.manifest.description.includes(label),
        `the store description must name ${label}, which is where its data comes from`);
});

/* IE-86: one catalog, two consumers. The userscript embeds it; the extension builds emit
   it as _locales so chrome.i18n can answer from an installed translation. They cannot
   drift because the second is generated from the first, and this is where that is proved
   against the files that actually ship. */
assert.strictEqual(manifest.default_locale, 'en',
    'a package with _locales must name the locale every lookup falls back to');
const emittedLocales = localeFiles();
assert.deepStrictEqual(Object.keys(emittedLocales).sort(), ['en', PSEUDO_LOCALE].sort(),
    'the build emits English and the pseudo-locale, and nothing else');
[
    ['extension', path.join(root, 'extension')],
    ['extension-firefox', firefoxDir],
    ['extension-store', storeDir],
].forEach(([name, dir]) => {
    Object.entries(emittedLocales).forEach(([locale, expected]) => {
        const file = path.join(dir, '_locales', locale, 'messages.json');
        assert(fs.existsSync(file), `${name} is missing _locales/${locale}/messages.json`);
        assert.deepStrictEqual(JSON.parse(fs.readFileSync(file, 'utf8')), expected,
            `${name}'s ${locale} catalog diverges from the generator`);
    });
});
const englishMessages = emittedLocales.en;
assert.deepStrictEqual(Object.keys(englishMessages).sort(), Object.keys(MESSAGE_CATALOG).sort(),
    'the emitted English catalog must be exactly the catalog in the source');
Object.entries(englishMessages).forEach(([name, entry]) => {
    assert.strictEqual(entry.message, MESSAGE_CATALOG[name], `${name} was emitted with different text`);
    assert(/^[A-Za-z0-9_@]+$/.test(name), `message key ${name} uses characters chrome.i18n rejects`);
});
/* The pseudo-locale exists so a build loaded under it shows which strings still come from
   the source rather than the catalog: those are the ones that are not bracketed. It is
   generated from English, so it can never fall behind it. */
const pseudo = emittedLocales[PSEUDO_LOCALE];
assert.deepStrictEqual(Object.keys(pseudo).sort(), Object.keys(englishMessages).sort(),
    'the pseudo-locale must cover every key, or it cannot show what is missing');
Object.entries(pseudo).forEach(([name, entry]) => {
    assert(entry.message.startsWith('[!! ') && entry.message.endsWith(' !!]'),
        `${name} is not marked in the pseudo-locale`);
    assert(entry.message.includes(englishMessages[name].message),
        `${name}'s pseudo text must contain the English it was made from`);
});

console.log(`Extension manifest and generated content are valid at v${pkg.version}, for all three builds.`);

/* ---- Release archives --------------------------------------------------------------
   IE-27. The zip writer is in this repository rather than from a package, so it is the
   repository's job to prove it writes zips: the format is checked against its own
   structure, and the archives are opened again by an independent reader in the same
   suite. */
const pack = require('../scripts/pack.js');

test('the zip writer produces something a reader can open', () => {
    const target = path.join(os.tmpdir(), `imdb-enh-pack-${process.pid}.zip`);
    const body = Buffer.from('hello '.repeat(200), 'utf8');
    const archive = pack.writeZip([
        { name:'a.txt', body },
        { name:'nested/b.bin', body:Buffer.from([0, 1, 2, 3, 255]) },
    ], target);

    // Local header, central directory and end-of-central-directory, in that order.
    assert.strictEqual(archive.readUInt32LE(0), 0x04034b50, 'it must start with a local file header');
    const endOffset = archive.length - 22;
    assert.strictEqual(archive.readUInt32LE(endOffset), 0x06054b50, 'and end with the central directory record');
    assert.strictEqual(archive.readUInt16LE(endOffset + 10), 2, 'which counts every entry');

    /* The offset in the end record has to point at the central directory, or a reader
       finds nothing however well-formed the rest is. */
    const directoryOffset = archive.readUInt32LE(endOffset + 16);
    assert.strictEqual(archive.readUInt32LE(directoryOffset), 0x02014b50);

    // A repeated string compresses; five random-ish bytes do not, and are stored instead.
    assert.strictEqual(archive.readUInt16LE(8), 8, 'compressible content is deflated');
    assert(archive.length < body.length, 'and the archive is smaller than the file it holds');

    /* And what a reader gets back is what went in. This is the check the first version of
       these tests was missing: everything above reads the writer's own description of
       itself, and a size or a CRC that lies about the payload passes all of it. */
    const readBack = readZipEntries(archive);
    assert.deepStrictEqual(readBack.map(entry => entry.name), ['a.txt', 'nested/b.bin']);
    assert(readBack[0].body.equals(body), 'the deflated entry decompresses to what it held');
    assert(readBack[1].body.equals(Buffer.from([0, 1, 2, 3, 255])), 'and so does the stored one');

    /* The timestamp is fixed rather than taken from the clock, which is what makes two
       builds of the same source identical — and a same-tick comparison cannot see a
       clock-derived one, so it is read out of the header instead. */
    readBack.forEach(entry => {
        assert.strictEqual(entry.time, 0, `${entry.name} must carry the fixed time`);
        assert.strictEqual(entry.date, 0x21, `${entry.name} must carry the fixed date`);
    });

    fs.unlinkSync(target);
});

test('the CRC matches what every other zip tool computes', () => {
    /* The one value in the format that cannot be checked by reading the file back with
       the same code that wrote it. These are the published check values. */
    assert.strictEqual(pack.crc32(Buffer.from('', 'utf8')), 0);
    assert.strictEqual(pack.crc32(Buffer.from('123456789', 'utf8')), 0xcbf43926);
    assert.strictEqual(pack.crc32(Buffer.from('The quick brown fox jumps over the lazy dog', 'utf8')), 0x414fa339);
});

test('two packs of the same build are byte-identical', () => {
    /* Checksums beside an archive are worth nothing if the archive changes every time it
       is built. A zip records a timestamp per entry, so both are fixed. */
    const dir = path.join(root, 'extension-store');
    const first = path.join(os.tmpdir(), `imdb-enh-a-${process.pid}.zip`);
    const second = path.join(os.tmpdir(), `imdb-enh-b-${process.pid}.zip`);
    const a = pack.packDirectory(dir, first);
    const b = pack.packDirectory(dir, second);
    assert(a.equals(b), 'the same input must produce the same bytes');
    fs.unlinkSync(first);
    fs.unlinkSync(second);
});

test('an archive carries what the manifest declares and nothing else', () => {
    /* A build directory is not a package. extension/ is written into rather than emptied,
       so it holds whatever has ever been put there — and packing the directory shipped
       exactly that, including an 875 KB icon master the build's own comment says has no
       business in a distributable. */
    const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'imdb-enh-pack-'));
    const store = path.join(root, 'extension-store');
    pack.listFiles(store).forEach(name => {
        const destination = path.join(staging, name);
        fs.mkdirSync(path.dirname(destination), { recursive:true });
        fs.copyFileSync(path.join(store, name), destination);
    });
    fs.writeFileSync(path.join(staging, '.env.local'), 'TMDB_TOKEN=secret\n');
    fs.writeFileSync(path.join(staging, 'notes.txt.bak'), 'scratch');
    fs.mkdirSync(path.join(staging, 'icons'), { recursive:true });
    fs.writeFileSync(path.join(staging, 'icons', 'icon-master.png'), Buffer.alloc(64, 7));

    const target = path.join(os.tmpdir(), `imdb-enh-decl-${process.pid}.zip`);
    const names = readZipNames(pack.packDirectory(staging, target));
    ['.env.local', 'notes.txt.bak', 'icons/icon-master.png'].forEach(name => {
        assert(!names.includes(name), `${name} must not reach a package`);
    });
    // And everything the manifest actually names is there.
    ['manifest.json', 'content.js', 'background.js', 'icons/icon128.png', '_locales/en/messages.json']
        .forEach(name => assert(names.includes(name), `${name} must be packed`));

    /* The extension's own pages, and what they load. A package whose options page is
       missing installs and then does nothing when somebody opens it, which is exactly the
       state the recovery page exists to rescue people from. */
    const storeManifest = JSON.parse(fs.readFileSync(path.join(store, 'manifest.json'), 'utf8'));
    const optionsPage = storeManifest.options_ui?.page;
    assert(optionsPage, 'the build should declare an options page');
    assert(names.includes(optionsPage), `${optionsPage} must be packed`);
    const pageScript = /<script src="([^"]+)"/.exec(fs.readFileSync(path.join(store, optionsPage), 'utf8'))?.[1];
    assert(pageScript, 'the options page should load a script');
    assert(names.includes(pageScript), `${pageScript} must be packed with the page that loads it`);

    /* A manifest that names a file which is not there is a broken package. Filtering it
       out quietly is how that ships. */
    fs.rmSync(path.join(staging, 'background.js'));
    assert.throws(() => pack.packDirectory(staging, target), /is missing background\.js/,
        'a package missing a file the manifest names must fail the build, not ship');

    fs.unlinkSync(target);
    fs.rmSync(staging, { recursive:true, force:true });
});

test('the source archive carries what a rebuild needs and no build output', () => {
    const target = path.join(os.tmpdir(), `imdb-enh-src-${process.pid}.zip`);
    pack.packSource(target);
    const names = readZipNames(fs.readFileSync(target));

    ['IMDb_Enhanced.user.js', 'package.json', 'package-lock.json', 'README.md', 'LICENSE',
        'extension/manifest.json', 'extension/background.js', 'scripts/build-extension.js', 'scripts/pack.js',
        'scripts/build-userscript.js']
        .forEach(name => assert(names.includes(name), `the source archive must carry ${name}`));

    /* The userscript is assembled from src/, so an archive holding one without the other
       cannot be rebuilt or checked. Every module travels, not a named subset of them. */
    const modules = fs.readdirSync(path.join(__dirname, '..', 'src')).sort();
    assert(modules.length > 1, 'src/ should hold the split source');
    modules.forEach(name => assert(names.includes(`src/${name}`),
        `the source archive must carry src/${name}`));

    /* The generated profiles are outputs. Shipping them would let a source archive
       disagree with what building it produces, which is the one thing a source
       submission exists to rule out. */
    /* Everything the build writes is an output of the very build a reviewer is being
       asked to reproduce. An archive that carries them can disagree with what building it
       produces, which is the one thing a source submission exists to rule out. */
    ['extension-store/manifest.json', 'extension-firefox/manifest.json',
        'extension/content.js', 'extension/recovery.js', 'extension/boot.css',
        'extension/_locales/en/messages.json']
        .forEach(name => assert(!names.includes(name), `${name} is generated and must not be in the source archive`));

    /* The icon master is not one of them, which this test used to claim. Nothing writes it
       and nothing reads it at build time: it is the artwork the four shipped PNGs were cut
       from, so a source archive without it cannot produce them again. It stays out of the
       installable package, where it would be most of the download and do nothing. */
    assert(names.includes('extension/icons/icon-master.png'),
        'the artwork the shipped icons came from is source, not build output');
    assert(!names.some(name => name.startsWith('node_modules/')), 'and neither are dependencies');
    assert(!names.some(name => name.startsWith('dist/')), 'nor the archives themselves');

    // Sorted, because the order entries are written in is part of being deterministic.
    assert.deepStrictEqual(names, [...names].sort(), 'entries are written in a fixed order');
    fs.unlinkSync(target);
});

if (packFailures) {
    console.error(`${packFailures} release-archive check(s) failed.`);
    process.exit(1);
}
