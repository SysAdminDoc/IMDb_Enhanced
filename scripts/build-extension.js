const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const extensionDir = path.join(root, 'extension');
const sourcePath = path.join(root, 'IMDb_Enhanced.user.js');
const manifestPath = path.join(extensionDir, 'manifest.json');
const contentPath = path.join(extensionDir, 'content.js');
const checkOnly = process.argv.includes('--check');
const buildFirefox = process.argv.includes('--firefox');
const buildStore = process.argv.includes('--store');
const storeDir = path.join(root, 'extension-store');
const firefoxDir = path.join(root, 'extension-firefox');
const FIREFOX_ADDON_ID = 'imdb-enhanced@sysadmindoc';
const FIREFOX_MIN_VERSION = '142.0';

const source = fs.readFileSync(sourcePath, 'utf8');
const metadata = source.match(/^\/\/ ==UserScript==[\s\S]*?^\/\/ ==\/UserScript==\r?\n?/m);
if (!metadata) throw new Error('Userscript metadata block was not found.');
// Slice from where the block actually starts; the m flag lets it begin off byte 0.
const sourceBody = source.slice(metadata.index + metadata[0].length);
if (!/^\(function \(\) \{/.test(sourceBody.trim())) throw new Error('Userscript body shape changed; extension build needs review.');

/* run_at:document_start exists so the ad and theme shells land before first paint, but
   the bridge must await chrome.storage.local and everything after that await runs with
   the parser already going — long enough for ad placeholders and IMDb's default light
   chrome to flash. The browser applies content_scripts.css synchronously before any
   script, so the boot rules live there and are gated on an attribute this prelude sets
   synchronously. The async pass clears it; a timer clears it too, so a storage failure
   can never leave the page hidden. */
const BOOT_ATTRIBUTE = 'data-imdb-enhanced-booting';
const BOOT_TIMEOUT_MS = 1500;

/* The manifest's origins are derived from the userscript's FEATURE_ORIGIN_GROUPS rather
   than maintained beside it. A hand-kept second list is how a feature quietly keeps a
   permission it no longer uses, or loses one it does — and the install prompt is the
   thing users read to decide whether to trust this at all. Evaluated rather than parsed,
   because the map is plain data built from a couple of shared constants. */
/* The provider declarations reference two cache constants defined earlier in the file.
   Reading them by name keeps the evaluated block small and self-contained: widening the
   capture to include everything in between would pull in code that cannot run outside
   the userscript's own scope. */
function readNumericConstant(name) {
    const match = source.match(new RegExp(`const ${name} = ([^;]+);`));
    if (!match) throw new Error(`${name} could not be read from the userscript.`);
    // eslint-disable-next-line no-new-func
    const value = new Function(`return (${match[1]});`)();
    if (!Number.isFinite(value)) throw new Error(`${name} did not evaluate to a number.`);
    return value;
}

function readOriginLists() {
    const block = source.match(/const LOOPBACK_ORIGINS = \[[\s\S]*?const TRANSMITTED_DATA_CATEGORIES = [\s\S]*?\)\]\.sort\(\);/);
    if (!block) throw new Error('The provider registry could not be read from the userscript.');
    /* The consent sentences and attribution lines are catalog entries now, so the block
       cannot be evaluated without the lookup that resolves them. English is the right
       answer here in every build: what this reader feeds is the manifest and Firefox's
       data-collection declaration, which are not localized files. */
    const preamble = [
        ...['CACHE_TTL', 'CACHE_MAX_TTL'].map(name => `const ${name} = ${readNumericConstant(name)};`),
        `const __messages = ${JSON.stringify(MESSAGE_CATALOG)};`,
        'const t = key => (Object.prototype.hasOwnProperty.call(__messages, key) ? __messages[key] : key);',
    ].join('\n');
    // eslint-disable-next-line no-new-func
    const evaluate = new Function(`${preamble}\n${block[0]}\nreturn { PROVIDERS, FEATURE_PROVIDERS, FEATURE_ORIGIN_GROUPS, REQUIRED_ORIGINS, OPTIONAL_ORIGINS, TRANSMITTED_DATA_CATEGORIES, DISTRIBUTION_PROFILES, PROVIDER_REQUIRED_FIELDS };`);
    const lists = evaluate();
    if (!lists.REQUIRED_ORIGINS.length) throw new Error('REQUIRED_ORIGINS is empty.');
    if (!lists.OPTIONAL_ORIGINS.length) throw new Error('OPTIONAL_ORIGINS is empty.');
    const overlap = lists.OPTIONAL_ORIGINS.filter(origin => lists.REQUIRED_ORIGINS.includes(origin));
    if (overlap.length) throw new Error(`Origins cannot be both required and optional: ${overlap.join(', ')}`);
    validateProviders(lists);
    return lists;
}

/* A provider that forgets a field, or a feature that names one that does not exist, is a
   build failure rather than something that shows up later as a blank line in the settings
   panel or an origin nobody can explain. */
function validateProviders({ PROVIDERS, FEATURE_PROVIDERS, OPTIONAL_ORIGINS, DISTRIBUTION_PROFILES, PROVIDER_REQUIRED_FIELDS, TRANSMITTED_DATA_CATEGORIES }) {
    const ids = Object.keys(PROVIDERS);
    if (!ids.length) throw new Error('No providers are declared.');
    ids.forEach(id => {
        const provider = PROVIDERS[id];
        PROVIDER_REQUIRED_FIELDS.forEach(field => {
            if (!Object.prototype.hasOwnProperty.call(provider, field)) {
                throw new Error(`Provider "${id}" is missing the required field "${field}".`);
            }
        });
        if (!Array.isArray(provider.origins) || !provider.origins.length) {
            throw new Error(`Provider "${id}" declares no origins.`);
        }
        if (!provider.label || !provider.consent) {
            throw new Error(`Provider "${id}" needs a label and a consent sentence a person can read.`);
        }
        if (!Number.isFinite(provider.ttl) || provider.ttl < 0) {
            throw new Error(`Provider "${id}" declares an unusable cache lifetime.`);
        }
        if (!Array.isArray(provider.profiles) || !provider.profiles.length) {
            throw new Error(`Provider "${id}" must name at least one distribution profile.`);
        }
        provider.profiles.forEach(profile => {
            if (!DISTRIBUTION_PROFILES.includes(profile)) {
                throw new Error(`Provider "${id}" names unknown distribution profile "${profile}".`);
            }
        });
    });
    Object.entries(FEATURE_PROVIDERS).forEach(([feature, providers]) => {
        providers.forEach(id => {
            if (!PROVIDERS[id]) throw new Error(`Feature "${feature}" names undeclared provider "${id}".`);
        });
    });
    // The other direction: an origin the manifest requests must belong to a provider,
    // or nothing can say why it is being asked for.
    const declared = new Set(ids.flatMap(id => PROVIDERS[id].origins));
    const orphans = OPTIONAL_ORIGINS.filter(origin => !declared.has(origin));
    if (orphans.length) throw new Error(`Requested origins belong to no provider: ${orphans.join(', ')}`);
    if (!TRANSMITTED_DATA_CATEGORIES.length) {
        throw new Error('No provider declares what it transmits, so the data-collection declaration would be empty.');
    }
}

/* Two different kinds of omission, and they need different treatment.

   The destination catalog is data. A store listing may not ship a directory of streaming
   sites, and "omitted" there has to mean absent when a reviewer reads the file, so it is
   cut out of the source rather than switched off inside it.

   An excluded provider is not data but a capability. Its origins are not requested, so
   the build cannot contact it whatever its code says, and the feature that depended on it
   reports itself unavailable and names which source is missing. Deleting the parser as
   well would leave nothing able to render that explanation, which is the behaviour the
   item asks for. So the guarantee proved here is that it cannot be reached, not that no
   line mentions it; the manifest is where that is enforced and where it is checked. */
function applyStoreProfile(body) {
    let out = body.replace(
        "const DISTRIBUTION_PROFILE = globalThis.__IMDB_ENHANCED_PROFILE === 'store' ? 'store' : 'default';",
        "const DISTRIBUTION_PROFILE = 'store';");
    if (out === body) throw new Error('The distribution profile marker was not found.');

    ['DEFAULT_WATCH_SITES', 'FMHY_WATCH_CATALOG'].forEach(name => {
        const pattern = new RegExp(`const ${name} = \\[[\\s\\S]*?\\n    \\];`);
        if (!pattern.test(out)) throw new Error(`${name} could not be found to omit.`);
        out = out.replace(pattern, `const ${name} = [];`);
    });

    /* Checked on the output, because the point is what ships. A destination that survived
       the cut would be exactly the thing a reviewer objects to. */
    const survivors = ['rivestream.app', 'cinejoy.to', 'lookmovie2.to', 'hydrahd', 'cinestream'];
    const found = survivors.filter(host => out.includes(host));
    if (found.length) throw new Error(`Store build still carries watch destinations: ${found.join(', ')}`);
    return out;
}

function readAdShellSelector() {
    const block = source.match(/const AD_SHELL_SELECTOR = \[([\s\S]*?)\]\.join\(','\);/);
    if (!block) throw new Error('AD_SHELL_SELECTOR could not be read from the userscript.');
    const selectors = [...block[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(match => match[1]);
    if (!selectors.length) throw new Error('AD_SHELL_SELECTOR appears to be empty.');
    return selectors;
}

function buildBootCss() {
    const scoped = readAdShellSelector().map(selector => `html[${BOOT_ATTRIBUTE}] ${selector}`);
    return `/* Generated by scripts/build-extension.js. Edit IMDb_Enhanced.user.js instead. */
/* Applied synchronously at document_start, before the storage-backed styles can load.
   The attribute is set by the content script's prelude and removed once real settings
   are known, or by its timeout if they never arrive. */
html[${BOOT_ATTRIBUTE}] body { visibility: hidden !important; }
${scoped.join(',\n')} {
    display: none !important;
}
`;
}

const prelude = String.raw`
    const __root = document.documentElement;
    const __clearBoot = () => { if (__root) __root.removeAttribute('${BOOT_ATTRIBUTE}'); };
    if (__root) __root.setAttribute('${BOOT_ATTRIBUTE}', '1');
    setTimeout(__clearBoot, ${BOOT_TIMEOUT_MS});
`;

/* Read from the userscript so the bridge and the exporter agree on what counts as a
   credential. A second hand-written list here is how one of them quietly stops covering
   a key the other still redacts. */
function readCredentialKeys() {
    const block = source.match(/const CREDENTIAL_SETTING_KEYS = new Set\(\[([\s\S]*?)\]\);/);
    if (!block) throw new Error('CREDENTIAL_SETTING_KEYS could not be read from the userscript.');
    const keys = [...block[1].matchAll(/'([A-Za-z0-9_]+)'/g)].map(match => match[1]);
    if (!keys.length) throw new Error('CREDENTIAL_SETTING_KEYS appears to be empty.');
    return keys;
}
const CREDENTIAL_KEYS = readCredentialKeys();

/* Same reason as the credential list: the bridge treats cache entries differently from
   settings, and a hand-written prefix here is how it quietly stops matching the one
   cacheSet actually writes under. */
function readCachePrefix() {
    const match = source.match(/const storageKey = '([a-z_]+)' \+ key;/);
    if (!match) throw new Error('The cache storage-key prefix could not be read from the userscript.');
    return match[1];
}
const CACHE_KEY_PREFIX = readCachePrefix();

/* The message catalog is data, so it is read out of the userscript rather than kept a
   second time here. Emitting it as _locales/en/messages.json is what lets chrome.i18n
   answer from an installed translation while the same entries stay embedded in the
   userscript, which has no i18n API at all. */
function readMessageCatalog() {
    const block = source.match(/const MESSAGES = Object\.freeze\(\{[\s\S]*?\n    \}\);/);
    if (!block) throw new Error('The message catalog could not be read from the userscript.');
    // eslint-disable-next-line no-new-func
    const messages = new Function(`${block[0]}\nreturn MESSAGES;`)();
    const names = Object.keys(messages);
    if (!names.length) throw new Error('The message catalog is empty.');
    names.forEach(name => {
        if (!/^[A-Za-z0-9_@]+$/.test(name)) {
            throw new Error(`Message key "${name}" uses characters chrome.i18n does not allow.`);
        }
        if (typeof messages[name] !== 'string' || !messages[name]) {
            throw new Error(`Message "${name}" has no text.`);
        }
    });
    return messages;
}
const MESSAGE_CATALOG = readMessageCatalog();

/* Two locale files ship. en is the catalog. en_XA is the pseudo-locale every platform
   reserves for exactly this: it never matches a real user's browser, and a build loaded
   under it shows which strings still come from the source instead of the catalog, because
   those are the ones that are not bracketed. Generated from en by one transform, so it
   cannot fall behind it. */
const PSEUDO_LOCALE = 'en_XA';
function pseudoLocalize(text) {
    // Substitutions are left exactly as they are: they are code, not words.
    return `[!! ${text} !!]`;
}
function localeFiles() {
    const toMessages = transform => Object.fromEntries(Object.entries(MESSAGE_CATALOG)
        .map(([name, text]) => [name, { message:transform(text) }]));
    return {
        'en': toMessages(text => text),
        [PSEUDO_LOCALE]: toMessages(pseudoLocalize),
    };
}
function writeLocales(dir) {
    Object.entries(localeFiles()).forEach(([locale, messages]) => {
        const localeDir = path.join(dir, '_locales', locale);
        fs.mkdirSync(localeDir, { recursive:true });
        fs.writeFileSync(path.join(localeDir, 'messages.json'), `${JSON.stringify(messages, null, 2)}\n`, 'utf8');
    });
}
function localeFileNames() {
    return Object.keys(localeFiles()).map(locale => `_locales/${locale}/messages.json`);
}

const bridgeFor = ({ trusted }) => String.raw`
    const __TRUSTED_CONTEXT = ${trusted ? 'true' : 'false'};
    const __CREDENTIAL_KEY_LIST = ${JSON.stringify(CREDENTIAL_KEYS.map(key => `imdb_enh_${key}`))};
    const __CACHE_KEY_PREFIX = ${JSON.stringify(CACHE_KEY_PREFIX)};
` + String.raw`
    /* Chromium MV3 returns promises from chrome.* while Gecko's chrome.* alias is
       callback-style, so calling .catch() on the return value is not portable —
       permissions.js in this same build already guards for both. The callback form is
       accepted by both engines, so every storage call goes through it. */
    const __storage = (method, arg) => new Promise((resolve, reject) => {
        const done = value => {
            const failure = chrome.runtime && chrome.runtime.lastError;
            if (failure) reject(new Error(failure.message || 'Extension storage failed'));
            else resolve(value);
        };
        try {
            const maybe = arg === undefined
                ? chrome.storage.local[method](done)
                : chrome.storage.local[method](arg, done);
            if (maybe && typeof maybe.then === 'function') maybe.then(resolve, reject);
        } catch (error) { reject(error); }
    });
    const __clone = value => {
        if (value === undefined || value === null) return value;
        try { return structuredClone(value); } catch { return JSON.parse(JSON.stringify(value)); }
    };
    /* The userscript treats GM_getValue as a live read of manager storage — setUserMark
       re-reads with getUserMarks(true) specifically so a second tab cannot clobber marks
       written by the first. A one-shot snapshot would silently break that contract, so
       the mirror follows chrome.storage.onChanged for the whole page lifetime. The
       listener is installed before the initial read and buffers until it lands, because
       another tab can write during that round trip. */
    const __state = Object.create(null);
    let __stateReady = false;
    const __pendingChanges = [];
    const __applyChanges = changes => {
        Object.entries(changes || {}).forEach(([key, change]) => {
            const has = change && Object.prototype.hasOwnProperty.call(change, 'newValue');
            /* A credential change updates only whether one is set. The delete matters:
               this listener also fires for a credential typed into the settings panel in
               this very tab, whose value GM_setValue put straight into the mirror. Without
               it the secret stayed readable in this world until the page was reloaded,
               which is the difference between "not in this tab" and "not in this tab yet". */
            if (!__TRUSTED_CONTEXT && __isCredentialKey(key)) {
                __recordCredential(key, has ? change.newValue : '');
                delete __state[key];
                return;
            }
            if (has) { __state[key] = change.newValue; __confirm(key, true, change.newValue); }
            else { delete __state[key]; __confirm(key, false); }
        });
    };
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') return;
        if (!__stateReady) { __pendingChanges.push(changes); return; }
        __applyChanges(changes);
    });
    /* Integration credentials never enter the content script's mirror. They are only ever
       needed by a request to a loopback service, and the background makes that request
       and can read storage itself — so there is no reason for the page's own world to
       hold a Radarr, Sonarr, Overseerr, Plex, Jellyfin or Emby key at all. What the
       content script gets instead is whether each one is set, which is all the settings
       UI needs to say "configured".

       The options page is different: it is an extension page, it is where the encrypted
       backup is produced, and a backup that silently omitted the credentials it promises
       to carry would be worse than no backup. The build stamps __TRUSTED_CONTEXT there
       and nowhere else. */
    const __CREDENTIAL_KEYS = new Set(__CREDENTIAL_KEY_LIST);
    const __isCredentialKey = key => __CREDENTIAL_KEYS.has(key);
    const __configuredCredentials = Object.create(null);
    const __recordCredential = (key, value) => {
        __configuredCredentials[key] = typeof value === 'string' && value.trim() !== '';
    };
    /* The last value storage confirmed for each key. Declared before the seed below,
       which is its first writer. */
    const __confirmed = Object.create(null);
    /* Presence only for a credential. GM_setValue deliberately keeps its value out of
       this world, so recording it here and restoring it on the next rejected write put
       back exactly what was being kept out. The redacted flag says the value is not ours
       to restore, which is different from there being no value. No backticks in this
       comment: it lives inside the bridge template literal. */
    /* A cache entry is disposable by construction: a reader that finds nothing asks the
       provider again. Shadowing its value here kept a second copy of every cached lookup
       in this world for the life of the page, and left a permanent record behind for
       every cache key that was ever deleted. Dropping the entry is the correct rollback
       for one, and it is what the reader is already built to handle. */
    const __isCacheKey = key => typeof key === 'string' && key.indexOf(__CACHE_KEY_PREFIX) === 0;
    const __confirm = (key, present, value) => {
        if (!__TRUSTED_CONTEXT && __isCredentialKey(key)) { __confirmed[key] = { present, redacted:true }; return; }
        if (__isCacheKey(key)) { delete __confirmed[key]; return; }
        __confirmed[key] = { present, value };
    };
    const __extensionState = await __storage('get', null).catch(() => ({}));
    Object.entries(__extensionState || {}).forEach(([key, value]) => {
        if (!__TRUSTED_CONTEXT && __isCredentialKey(key)) { __recordCredential(key, value); return; }
        __state[key] = value;
        __confirm(key, true, value);
    });
    __stateReady = true;
    __pendingChanges.splice(0).forEach(__applyChanges);
    /* Asked by the settings UI so it can show a credential as configured without ever
       holding it. Returns only a boolean. */
    /* Only where values are actually withheld. Defining it on the options page too made
       canReadCredentials() false there, so the one surface that can read credentials
       refused to produce the encrypted backup and sent the user to the page they were
       already on. */
    if (!__TRUSTED_CONTEXT) {
        globalThis.__imdbEnhancedCredentialConfigured = key => Boolean(__configuredCredentials[key]);
    }
    const __sendAdState = enabled => {
        try { chrome.runtime.sendMessage({ type:'imdb-enhanced:set-ad-blocking', enabled:enabled !== false }); }
        catch { /* the service worker may be asleep during teardown */ }
    };
    globalThis.GM_getValue = (key, fallback) => Object.prototype.hasOwnProperty.call(__state, key)
        ? __clone(__state[key])
        : __clone(fallback);
    /* The userscript's whole save-failure layer — trySaveSetting, the settings-import
       rollback, the "Save failed" header state — keys off GM_setValue throwing. A
       promise rejection swallowed here would make every one of those paths dead code
       and let the UI report "Saved" after a quota error. Storage is async, so the
       rejection is reported two ways: the failure event fires immediately, and the next
       synchronous write throws so the calling control sees it. */
    let __writeFailure = null;
    /* The failing key travels with the failure. A caller that manages its own storage
       budget — the lookup cache does — cannot act on "some write failed"; it has to know
       which one, and it cannot learn that from the next-call throw below, because that
       throw surfaces on whatever call happens to come next and may be a different key
       entirely, or be swallowed by a caller that legitimately ignores its own failures. */
    const __reportWriteFailure = (error, key) => {
        __writeFailure = error instanceof Error ? error : new Error(String(error && error.message || 'Extension storage write failed'));
        try { document.dispatchEvent(new CustomEvent('imdb-enhanced:settings-save-failed', { detail:{ key } })); }
        catch { /* the next synchronous write still surfaces it */ }
    };
    const __takeWriteFailure = () => {
        if (!__writeFailure) return;
        const error = __writeFailure;
        __writeFailure = null;
        throw error;
    };
    /* A rejected write means the value never reached storage. Leaving it in the mirror
       makes GM_getValue and GM_listValues describe a store that does not exist, which for
       the cache means its byte accounting counts bytes nothing is holding and it stops
       evicting when it should. The mirror is put back unless a later write to the same
       key has already replaced what we put there. */
    /* Identified by a per-write token rather than by the value written. __clone returns a
       primitive unchanged, so comparing values would let a rejected write roll back a
       later successful write of the same string or number — two identical values in
       flight is all it takes. */
    /* Rolls back to the last value storage actually confirmed, not to whatever the
       mirror held when this write started. Under sustained quota pressure that earlier
       value is itself an optimistic write that never landed, so restoring it left the
       page showing a mark that does not exist while telling the user twice that nothing
       was saved. Tracked synchronously: re-reading storage here would delay the failure
       event past the point where callers act on it. */
    let __writeSequence = 0;
    const __latestWrite = Object.create(null);
    const __rollbackMirror = (key, token) => {
        if (__latestWrite[key] !== token) return;
        const known = __confirmed[key];
        // A redacted entry means storage holds one but this world may not: leaving the
        // mirror without it is the correct restoration, not a lossy one.
        if (known && known.present && !known.redacted) __state[key] = known.value;
        else delete __state[key];
    };
    globalThis.GM_setValue = (key, value) => {
        __takeWriteFailure();
        const written = __clone(value);
        const token = ++__writeSequence;
        __latestWrite[key] = token;
        /* A credential typed into the settings panel goes to storage but never into this
           world's mirror. Writing it here first and clearing it when the change event came
           back left the secret readable in the page's tab for the rest of its life, which
           is exactly what keeping it out of the mirror was for. Only whether one is set is
           kept, so the field can still report itself as configured. */
        if (!__TRUSTED_CONTEXT && __isCredentialKey(key)) __recordCredential(key, written);
        else __state[key] = written;
        /* The failure event is what makes callers re-read, so it must not fire until
           the mirror is authoritative again. */
        __storage('set', { [key]:written })
            .then(() => { if (__latestWrite[key] === token) __confirm(key, true, written); })
            .catch(error => {
                __rollbackMirror(key, token);
                __reportWriteFailure(error, key);
            });
        if (key === 'imdb_enh_removeAds') __sendAdState(value !== false);
    };
    globalThis.GM_listValues = () => Object.keys(__state);
    globalThis.GM_deleteValue = key => {
        __takeWriteFailure();
        const token = ++__writeSequence;
        __latestWrite[key] = token;
        delete __state[key];
        __storage('remove', key)
            .then(() => { if (__latestWrite[key] === token) __confirm(key, false); })
            .catch(error => {
                __rollbackMirror(key, token);
                __reportWriteFailure(error, key);
            });
        if (key === 'imdb_enh_removeAds') __sendAdState(true);
    };
    /* copyTextToClipboard reports success from this call returning, so a rejected
       write has to be surfaced rather than dropped: the next copy throws, and the
       toast layer is told about the one that actually failed. */
    let __clipboardFailure = null;
    globalThis.GM_setClipboard = text => {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
        if (__clipboardFailure) {
            const error = __clipboardFailure;
            __clipboardFailure = null;
            throw error;
        }
        navigator.clipboard.writeText(String(text ?? '')).catch(error => {
            __clipboardFailure = error instanceof Error ? error : new Error('Clipboard write was refused');
            try { document.dispatchEvent(new CustomEvent('imdb-enhanced:clipboard-failed')); }
            catch { /* the next copy still throws */ }
        });
    };
    let __requestSequence = 0;
    globalThis.GM_xmlhttpRequest = (options = {}) => {
        const id = 'imdb_enh_req_' + Date.now() + '_' + (++__requestSequence);
        let settled = false;
        const finish = (callback, value) => {
            if (settled) return;
            settled = true;
            if (typeof callback === 'function') callback(value);
        };
        try {
            chrome.runtime.sendMessage({
                type:'imdb-enhanced:http',
                id,
                url:String(options.url || ''),
                method:String(options.method || 'GET'),
                headers:options.headers,
                /* A name and a storage key, never a value: the content script has no
                   credential to send. The background looks the key up and injects it only
                   into a request it has already validated as loopback. */
                credentialHeader:options.credentialHeader || null,
                /* One service takes its key only in the query string. Same rule as the
                   header form: a name and a storage key travel, never a value, and the
                   worker decides from its own binding where the value goes. */
                credentialQuery:options.credentialQuery || null,
                body:options.data,
                timeout:options.timeout,
            }, response => {
                if (settled) return;
                const runtimeError = chrome.runtime.lastError;
                if (runtimeError || !response) {
                    finish(options.onerror, { message:runtimeError?.message || 'Extension request failed' });
                    return;
                }
                if (Object.prototype.hasOwnProperty.call(response, 'responseText')) {
                    finish(options.onload, {
                        status:Number(response.status) || 0,
                        responseText:String(response.responseText || ''),
                        // finalUrl is the property every consumer reads; responseURL is
                        // kept as the platform-native alias.
                        finalUrl:String(response.responseURL || options.url || ''),
                        responseURL:String(response.responseURL || options.url || ''),
                    });
                    return;
                }
                finish(options.onerror, {
                    status:Number(response.status) || 0,
                    // The background classifies its refusals (redirect_blocked,
                    // redirect_changed_origin, …); losing that here would leave a
                    // blocked redirect indistinguishable from the site being down.
                    errorType:String(response.errorType || 'network'),
                    message:String(response.error || 'Request failed'),
                });
            });
        } catch (error) {
            finish(options.onerror, error);
        }
        return {
            abort() {
                if (settled) return;
                settled = true;
                try { chrome.runtime.sendMessage({ type:'imdb-enhanced:http-abort', id }); } catch { /* best effort */ }
                if (typeof options.onabort === 'function') options.onabort({ message:'Request aborted' });
            },
        };
    };
    /* Settings are known: the real stylesheets take over from the boot rules. */
    __clearBoot();
    __sendAdState(__state.imdb_enh_removeAds !== false);
`;

const content = `/* Generated by scripts/build-extension.js. Edit IMDb_Enhanced.user.js instead. */\n(async function imdbEnhancedExtensionBootstrap() {\n${prelude}
${bridgeFor({ trusted:false })}\n${sourceBody}\n})();\n`;

/* The recovery page is a separate document, so it cannot reach into the userscript's
   closure. Rather than reimplement backup, restore, reset and diagnostics — a second
   implementation being a second set of bugs — it loads the same body behind the same
   storage bridge and receives the storage-layer helpers through the recovery hook.
   The userscript's own init is inert here: it host-gates on www.imdb.com, and this
   page is served from the extension origin. */
const recoveryPagePath = path.join(__dirname, 'recovery-page.js');
const recoveryPageSource = fs.readFileSync(recoveryPagePath, 'utf8');
const recoveryPath = path.join(extensionDir, 'recovery.js');
const recovery = `/* Generated by scripts/build-extension.js from IMDb_Enhanced.user.js and
   scripts/recovery-page.js. Edit those instead. */
(async function imdbEnhancedRecoveryBootstrap() {
${prelude}
${bridgeFor({ trusted:true })}
    let core = null;
    globalThis.__imdbEnhancedRecoveryHook = api => { core = api; };
${sourceBody}
    delete globalThis.__imdbEnhancedRecoveryHook;
    if (!core) {
        document.getElementById('status').textContent =
            'The settings layer did not load, so recovery actions are unavailable. Reload this page.';
        return;
    }
${recoveryPageSource}
})();
`;
const bootCss = buildBootCss();
const bootCssPath = path.join(extensionDir, 'boot.css');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.version = packageJson.version;
const originLists = readOriginLists();
const { TRANSMITTED_DATA_CATEGORIES } = originLists;
/* Mandatory the moment _locales exists, and it is the locale every lookup falls
   back to. */
manifest.default_locale = 'en';
manifest.host_permissions = originLists.REQUIRED_ORIGINS;
manifest.optional_host_permissions = originLists.OPTIONAL_ORIGINS;
const serializedManifest = `${JSON.stringify(manifest, null, 2)}\n`;

/* Firefox implements Manifest V3 with event pages rather than service workers and
   asks the user to opt into host permissions after install, so its manifest needs
   its own background key, add-on id, and the permissions popup that Chromium does
   not require. Everything else — content script, background logic, icons — is the
   same build. */
function toFirefoxManifest(base) {
    const firefox = JSON.parse(JSON.stringify(base));
    firefox.background = { scripts:[base.background.service_worker] };
    firefox.browser_specific_settings = {
        gecko: {
            id: FIREFOX_ADDON_ID,
            strict_min_version: FIREFOX_MIN_VERSION,
            /* Nothing is required, because with every optional feature off the add-on
               transmits nothing: preferences, marks and cached lookups never leave local
               storage and there is no service to report to.
               `websiteContent` is declared as optional and is the truthful part. The old
               declaration was a flat "none", but an enabled score or availability lookup
               sends the title and year read from the IMDb page to a third-party service
               so it can find the matching entry. That is page content leaving the
               browser, and a user deciding whether to enable it deserves to see it said.
               It is optional because it happens only for the sources they switch on, and
               those now request their origins at that moment. */
            /* Derived from what the providers say they transmit, so adding one that sends
               something new cannot leave this declaration behind. */
            data_collection_permissions: { required:['none'], optional:[...TRANSMITTED_DATA_CATEGORIES] },
        },
    };
    firefox.action = { ...base.action, default_popup:'permissions.html' };
    delete firefox.minimum_chrome_version;
    return firefox;
}

const FIREFOX_COPIED_FILES = ['background.js', 'permissions.html', 'permissions.js', 'recovery.html'];

/* Emptied first, not merged into. A file an earlier build wrote and this one no
   longer emits — a renamed icon, a dropped page — otherwise stays on disk forever and
   ships inside the zip, and nothing that only checks for expected names can see it. */
function resetBuildDir(dir) {
    fs.rmSync(dir, { recursive:true, force:true });
    fs.mkdirSync(dir, { recursive:true });
}

function buildFirefoxBuild() {
    const firefoxManifest = toFirefoxManifest(manifest);
    resetBuildDir(firefoxDir);
    writeLocales(firefoxDir);
    fs.writeFileSync(path.join(firefoxDir, 'manifest.json'), `${JSON.stringify(firefoxManifest, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(firefoxDir, 'content.js'), content, 'utf8');
    fs.writeFileSync(path.join(firefoxDir, 'boot.css'), bootCss, 'utf8');
    fs.writeFileSync(path.join(firefoxDir, 'recovery.js'), recovery, 'utf8');
    FIREFOX_COPIED_FILES.forEach(name => {
        fs.copyFileSync(path.join(extensionDir, name), path.join(firefoxDir, name));
    });
    // Ship only the icons the manifest actually declares; the master artwork is a
    // source asset and has no business inside a distributable build.
    const shipped = new Set([
        ...Object.values(firefoxManifest.icons || {}),
        ...Object.values(firefoxManifest.action?.default_icon || {}),
    ]);
    shipped.forEach(relative => {
        const source = path.join(extensionDir, relative);
        if (!fs.existsSync(source)) return;
        const target = path.join(firefoxDir, relative);
        fs.mkdirSync(path.dirname(target), { recursive:true });
        fs.copyFileSync(source, target);
    });
    return firefoxManifest;
}

const STORE_COPIED_FILES = ['background.js', 'recovery.html'];

/* The listing text a reviewer reads has to match the build they are reading. The default
   description advertises score widgets and a directory of watch destinations, and the
   store build ships neither, so it needs its own sentence rather than the shared one.
   Chrome truncates a manifest description at 132 characters, so the length is checked
   here instead of being discovered at upload. */
const STORE_DESCRIPTION = 'Decluttered IMDb: private watch marks, scores and streaming from your own OMDb and TMDB keys, and ad-request blocking.';
const CHROME_DESCRIPTION_LIMIT = 132;

/* Same generator, same source, one transform. The store content bundle is the ordinary
   one with the destination catalog removed and the profile stamped, and its manifest asks
   for nothing on behalf of a provider that build excludes.

   Computing and writing are separate so the suite can compare what is on disk against
   what the generator says it should be. A stale extension-store/ is otherwise invisible. */
function computeStoreBuild() {
    const storeBody = applyStoreProfile(sourceBody);
    const storeContent = `/* Generated by scripts/build-extension.js --store. Edit IMDb_Enhanced.user.js instead. */\n(async function imdbEnhancedExtensionBootstrap() {\n${prelude}
${bridgeFor({ trusted:false })}\n${storeBody}\n})();\n`;

    const excluded = Object.keys(originLists.PROVIDERS)
        .filter(id => !originLists.PROVIDERS[id].profiles.includes('store'));
    const droppedOrigins = new Set(excluded.flatMap(id => originLists.PROVIDERS[id].origins));
    const storeManifest = JSON.parse(JSON.stringify(manifest));
    storeManifest.description = STORE_DESCRIPTION;
    storeManifest.optional_host_permissions = manifest.optional_host_permissions
        .filter(origin => !droppedOrigins.has(origin));
    if (storeManifest.optional_host_permissions.length === manifest.optional_host_permissions.length) {
        throw new Error('The store profile excludes providers but dropped no origins; the two are out of step.');
    }
    if (STORE_DESCRIPTION.length > CHROME_DESCRIPTION_LIMIT) {
        throw new Error(`The store description is ${STORE_DESCRIPTION.length} characters; Chrome allows ${CHROME_DESCRIPTION_LIMIT}.`);
    }
    /* A description that names a capability this build cannot deliver is the same defect
       as a manifest that asks for an origin it does not use, and a reviewer reads the
       description first. What matters is the capability, not the provider: Rotten Tomatoes
       scores ship here through OMDb even though the provider that reads their pages does
       not, so naming them is accurate. A provider whose every feature is dead in this
       build is the thing that may not be advertised. */
    const featuresNaming = id => Object.entries(originLists.FEATURE_PROVIDERS)
        .filter(([, providers]) => providers.includes(id))
        .map(([feature]) => feature);
    const featureWorksInStore = feature => (originLists.FEATURE_PROVIDERS[feature] || [])
        .filter(id => !originLists.PROVIDERS[id]?.auxiliary)
        .some(id => originLists.PROVIDERS[id].profiles.includes('store'));
    const advertisedButAbsent = excluded
        .filter(id => !featuresNaming(id).some(featureWorksInStore))
        .map(id => originLists.PROVIDERS[id].label)
        .filter(label => STORE_DESCRIPTION.toLowerCase().includes(label.toLowerCase()));
    if (advertisedButAbsent.length) {
        throw new Error(`The store description names sources this build excludes: ${advertisedButAbsent.join(', ')}`);
    }
    /* The other thing this build cuts is not a provider and so has no label to match:
       applyStoreProfile empties the watch-destination lists. A description promising a
       directory of streaming sites would pass the check above while advertising exactly
       what was removed. */
    const cutCatalogVocabulary = /destination|watch site|streaming site|catalogue|catalog|directory/i;
    if (cutCatalogVocabulary.test(STORE_DESCRIPTION)) {
        throw new Error('The store description advertises the watch-destination catalog, which that build omits.');
    }
    return {
        manifest:storeManifest,
        files: {
            'manifest.json': `${JSON.stringify(storeManifest, null, 2)}\n`,
            'content.js': storeContent,
            'boot.css': bootCss,
            'recovery.js': applyStoreProfile(recovery),
        },
        excluded,
    };
}

function buildStoreBuild() {
    const store = computeStoreBuild();
    resetBuildDir(storeDir);
    writeLocales(storeDir);
    Object.entries(store.files).forEach(([name, body]) => {
        fs.writeFileSync(path.join(storeDir, name), body, 'utf8');
    });
    STORE_COPIED_FILES.forEach(name => {
        fs.copyFileSync(path.join(extensionDir, name), path.join(storeDir, name));
    });
    const shipped = new Set([
        ...Object.values(store.manifest.icons || {}),
        ...Object.values(store.manifest.action?.default_icon || {}),
    ]);
    shipped.forEach(relative => {
        const from = path.join(extensionDir, relative);
        if (!fs.existsSync(from)) return;
        const to = path.join(storeDir, relative);
        fs.mkdirSync(path.dirname(to), { recursive:true });
        fs.copyFileSync(from, to);
    });
    return store;
}

/* Every path under a build directory, relative and sorted. Comparing the set, not
   just looking for the names that ought to be there, is what notices a file an older
   build wrote and this one no longer emits. */
function listBuildFiles(dir, prefix = '') {
    return fs.readdirSync(dir, { withFileTypes:true })
        .flatMap(entry => (entry.isDirectory()
            ? listBuildFiles(path.join(dir, entry.name), `${prefix}${entry.name}/`)
            : [`${prefix}${entry.name}`]))
        .sort();
}

function checkGeneratedProfile(dir, compute, rebuildCommand) {
    if (!fs.existsSync(dir)) return;
    const name = path.basename(dir);
    const { files, copied, manifest:profileManifest } = compute();
    // Locale files are generated from the catalog, not copied from extension/.
    const localeNames = new Set(localeFileNames());
    const expected = [
        ...Object.keys(files),
        ...copied,
        ...Object.values(profileManifest.icons || {}),
        ...Object.values(profileManifest.action?.default_icon || {}),
    ].filter((entry, index, all) => all.indexOf(entry) === index).sort();
    const actual = listBuildFiles(dir);
    if (actual.join('|') !== expected.join('|')) {
        throw new Error(`${name}/ holds ${actual.join(', ')} but the generator emits ${expected.join(', ')}; run ${rebuildCommand}.`);
    }
    Object.entries(files).forEach(([entry, body]) => {
        if (fs.readFileSync(path.join(dir, entry), 'utf8') !== body) {
            throw new Error(`${name}/${entry} is stale; run ${rebuildCommand}.`);
        }
    });
    /* The locale files are generated too, from the same catalog, and were checked by
       name alone: a directory whose messages.json no longer matched the source passed.
       They are what a translated build actually reads, so compare the bytes. */
    Object.entries(localeFiles()).forEach(([locale, messages]) => {
        const entry = `_locales/${locale}/messages.json`;
        const written = path.join(dir, '_locales', locale, 'messages.json');
        if (!fs.existsSync(written)) throw new Error(`${name}/${entry} is missing; run ${rebuildCommand}.`);
        if (fs.readFileSync(written, 'utf8') !== `${JSON.stringify(messages, null, 2)}\n`) {
            throw new Error(`${name}/${entry} is stale; run ${rebuildCommand}.`);
        }
    });
    /* Everything else in the directory is a copy of a file in extension/, including the
       background worker that holds the credential-injection code. Comparing the bytes is
       the only way to notice one that was edited in place. */
    const generated = new Set(Object.keys(files));
    expected.filter(entry => !generated.has(entry) && !localeNames.has(entry)).forEach(entry => {
        const master = path.join(extensionDir, entry);
        if (!fs.existsSync(master)) return;
        if (!fs.readFileSync(path.join(dir, entry)).equals(fs.readFileSync(master))) {
            throw new Error(`${name}/${entry} does not match extension/${entry}; run ${rebuildCommand}.`);
        }
    });
}

/* Exported so the GM contract suite can instantiate the real bridge instead of a
   paraphrase of it. The two fragments are inseparable: the bridge closes by calling
   __clearBoot(), which the prelude defines. */
const EXTENSION_BRIDGE_SOURCE = `${prelude}\n${bridgeFor({ trusted:false })}`;

module.exports = {
    validateProviders,
    // Exported so the suite can assert the store profile against the real declarations
    // rather than against a second copy of them.
    PROVIDER_REGISTRY: originLists,
    applyStoreProfile,
    computeStoreBuild,
    MESSAGE_CATALOG,
    localeFiles,
    localeFileNames,
    PSEUDO_LOCALE,
    STORE_COPIED_FILES,
    STORE_DESCRIPTION,
    toFirefoxManifest,
    FIREFOX_ADDON_ID,
    FIREFOX_MIN_VERSION,
    FIREFOX_COPIED_FILES,
    EXTENSION_BRIDGE_SOURCE,
};

if (require.main !== module) {
    // Imported for its manifest contract only; do not touch the working tree.
} else if (checkOnly) {
    const currentContent = fs.readFileSync(contentPath, 'utf8');
    const currentManifest = fs.readFileSync(manifestPath, 'utf8');
    if (currentContent !== content) throw new Error('extension/content.js is stale; run npm run build:extension.');
    if (fs.readFileSync(bootCssPath, 'utf8') !== bootCss) throw new Error('extension/boot.css is stale; run npm run build:extension.');
    if (fs.readFileSync(recoveryPath, 'utf8') !== recovery) throw new Error('extension/recovery.js is stale; run npm run build:extension.');
    if (currentManifest !== serializedManifest) throw new Error('extension/manifest.json is stale; run npm run build:extension.');
    /* The two profile directories are built on demand, so a fresh clone has neither and
       absent is not stale. One that IS on disk is checked here rather than in the test
       suite, because the suite regenerates them first and can therefore only ever read
       back what it just wrote. This is the check a hand-edited or left-over directory
       actually fails, and it runs before anything rebuilds them. */
    checkGeneratedProfile(firefoxDir, () => {
        const firefoxManifest = toFirefoxManifest(manifest);
        return {
            files: {
                'manifest.json': `${JSON.stringify(firefoxManifest, null, 2)}\n`,
                'content.js': content,
                'boot.css': bootCss,
                'recovery.js': recovery,
            },
            copied: [...FIREFOX_COPIED_FILES, ...localeFileNames()],
            manifest: firefoxManifest,
        };
    }, 'npm run build:firefox');
    checkGeneratedProfile(storeDir, () => {
        const store = computeStoreBuild();
        return { files:store.files, copied:[...STORE_COPIED_FILES, ...localeFileNames()], manifest:store.manifest };
    }, 'npm run build:store');
    console.log(`Extension build is current at v${packageJson.version}.`);
} else {
    fs.mkdirSync(extensionDir, { recursive:true });
    writeLocales(extensionDir);
    fs.writeFileSync(contentPath, content, 'utf8');
    fs.writeFileSync(bootCssPath, bootCss, 'utf8');
    fs.writeFileSync(recoveryPath, recovery, 'utf8');
    fs.writeFileSync(manifestPath, serializedManifest, 'utf8');
    console.log(`Built extension/content.js, extension/recovery.js and synchronized extension/manifest.json to v${packageJson.version}.`);
    if (buildFirefox) {
        buildFirefoxBuild();
        console.log(`Built extension-firefox/ for Firefox ${FIREFOX_MIN_VERSION}+ at v${packageJson.version}.`);
    }
    if (buildStore) {
        const { excluded } = buildStoreBuild();
        console.log(`Built extension-store/ at v${packageJson.version}, without ${excluded.join(', ') || 'nothing'}.`);
    }
}
