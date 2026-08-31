const assert = require('assert');
const fs = require('fs');
const path = require('path');

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
assert(manifest.host_permissions.includes('https://www.imdb.com/*'), 'IMDb host permission missing');
assert(manifest.host_permissions.includes('https://backend.metacritic.com/*'), 'Metacritic host permission missing');
assert(manifest.host_permissions.includes('https://*.amazon-adsystem.com/*'), 'ad-rule host permission missing');
assert(manifest.host_permissions.includes('http://localhost/*'), 'localhost host permission missing');
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
const { toFirefoxManifest, FIREFOX_ADDON_ID, FIREFOX_COPIED_FILES } = require('../scripts/build-extension.js');
const firefox = toFirefoxManifest(manifest);
assert.deepStrictEqual(firefox.background, { scripts:['background.js'] }, 'Firefox needs an event page, not a service worker');
assert.strictEqual(firefox.browser_specific_settings.gecko.id, FIREFOX_ADDON_ID, 'Firefox build needs a stable add-on id');
assert.strictEqual(firefox.browser_specific_settings.gecko.strict_min_version, '142.0', 'the data-collection declaration AMO requires needs Firefox 140+ (Android 142+)');
assert.deepStrictEqual(
    firefox.browser_specific_settings.gecko.data_collection_permissions,
    { required:['none'] },
    'Firefox reviews require an explicit data-collection declaration');
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
assert(background.includes('describeRequestUrl(finalUrl)'),
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

const permissionsScript = fs.readFileSync(path.join(root, 'extension', 'permissions.js'), 'utf8');
assert(fs.readFileSync(path.join(root, 'extension', 'permissions.html'), 'utf8').includes('recovery.html'),
    'Firefox opens the popup instead of the action handler, so it needs a link to the recovery page');
assert(permissionsScript.includes('permissions.request'), 'the popup must be able to request the opt-in origins');
assert(permissionsScript.includes('getManifest'), 'the popup must derive origins from the manifest rather than a second hard-coded list');

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
[...FIREFOX_COPIED_FILES, ...Object.values(builtFirefoxManifest.icons || {})].forEach(name => {
    assert(fs.existsSync(path.join(firefoxDir, name)), `Firefox build is missing ${name}`);
});

console.log(`Extension manifest and generated content are valid at v${pkg.version}, for both builds.`);
