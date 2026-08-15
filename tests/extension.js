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
assert(content.includes('chrome.storage.local.get(null)'), 'extension content must preload extension storage');
assert(content.includes('globalThis.GM_xmlhttpRequest'), 'extension bridge must provide the shared request API');
/* The userscript's cross-tab defences (setUserMark's forced re-read, the single-slot
   Cineby handoff) assume GM_getValue reflects live manager storage. A snapshot silently
   turns those into no-ops, so the mirror has to track storage for the page lifetime. */
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
const awaitIndex = content.indexOf('await chrome.storage.local.get(null)');
assert(preludeIndex > 0 && preludeIndex < awaitIndex, 'the boot gate must be set before the first await');
assert(content.includes('setTimeout(__clearBoot,'), 'a storage failure must never leave the page hidden');
assert(content.indexOf('__clearBoot();') > awaitIndex, 'the gate must clear once real settings are known');
assert(content.includes("const VERSION = '" + pkg.version + "'"), 'generated content must include the current source');
assert(!/\beval\s*\(/.test(content), 'MV3 content must not depend on eval');
assert(background.includes('declarativeNetRequest.updateDynamicRules'), 'background worker must manage dynamic ad rules');
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
const permissionsScript = fs.readFileSync(path.join(root, 'extension', 'permissions.js'), 'utf8');
assert(permissionsScript.includes('permissions.request'), 'the popup must be able to request the opt-in origins');
assert(permissionsScript.includes('getManifest'), 'the popup must derive origins from the manifest rather than a second hard-coded list');

console.log(`Extension manifest and generated content are valid at v${pkg.version}.`);
