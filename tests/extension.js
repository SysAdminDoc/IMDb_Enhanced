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
assert(content.includes("const VERSION = '" + pkg.version + "'"), 'generated content must include the current source');
assert(!/\beval\s*\(/.test(content), 'MV3 content must not depend on eval');
assert(background.includes('declarativeNetRequest.updateDynamicRules'), 'background worker must manage dynamic ad rules');
assert(background.includes("credentials: 'omit'"), 'background requests must omit destination credentials');
assert(background.includes("ALLOWED_CONTENT_HOSTS"), 'background messages must be sender-scoped');
assert(source.includes("category:'watch'"), 'userscript source should remain the extension source of truth');

console.log(`Extension manifest and generated content are valid at v${pkg.version}.`);
