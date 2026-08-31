/* Recovery page logic. Bundled by scripts/build-extension.js into
   extension/recovery.js, after the storage bridge and the userscript body, so the
   canonical settings helpers reach it through the recovery hook rather than being
   reimplemented here. `core` is provided by the generated wrapper.

   Everything on this page has to work with IMDb access revoked, because that is one
   of the states it exists to repair — so nothing here touches a content script, an
   IMDb tab, or an injected DOM. */
'use strict';

const $ = id => document.getElementById(id);
const statusRegion = $('status');

let statusTimer = null;
function say(message, tone = 'info') {
    statusRegion.textContent = message;
    statusRegion.dataset.tone = tone;
    clearTimeout(statusTimer);
    // Cleared rather than left standing, so a stale success cannot be read as the
    // result of a later action.
    statusTimer = setTimeout(() => {
        statusRegion.textContent = '';
        statusRegion.dataset.tone = 'info';
    }, 12000);
}

function copyText(text) {
    if (!navigator.clipboard?.writeText) return Promise.reject(new Error('Clipboard unavailable'));
    return navigator.clipboard.writeText(text);
}

/* ---- Version and permission state -------------------------------------------- */

$('version').textContent = core.VERSION;
try { $('build-version').textContent = chrome.runtime.getManifest().version; }
catch { $('build-version').textContent = 'unknown'; }

/* Every render here is wrapped, and each runs after the page's own controls are wired.
   This page exists to be usable when everything else is broken, so a throw while drawing
   one section must not take the buttons in the next one with it — an unguarded
   chrome.permissions call placed ahead of the listeners left the page rendered and every
   action dead, with nothing on screen to say why. */
function guard(label, render) {
    try { render(); }
    catch (error) {
        console.warn(`[IMDb Enhanced] recovery: ${label} failed`, error);
        say(`The ${label} section could not be read, but the actions below still work.`, 'error');
    }
}

function renderPermissions() {
    const list = $('permission-list');
    list.textContent = '';
    const banner = $('imdb-access');
    if (!chrome.permissions?.getAll) {
        banner.dataset.state = 'missing';
        $('imdb-access-text').textContent = 'Site access could not be read in this browser.';
        return;
    }
    /* chrome.* is promise-based on Chromium and callback-based on Gecko; the callback
       form is accepted by both, which is the same reason the background uses it. */
    chrome.permissions.getAll(granted => {
        const origins = (granted?.origins || []).slice().sort();
        const imdb = origins.some(origin => origin.includes('imdb.com'));
        banner.dataset.state = imdb ? 'granted' : 'missing';
        $('imdb-access-text').textContent = imdb
            ? 'IMDb access is granted.'
            : 'IMDb access is not granted, so the extension cannot run on IMDb pages.';
        // The action beside the banner has to match it: opening IMDb when the extension
        // cannot run there is a dead end, so offer the repair instead.
        $('open-imdb').hidden = false;
        $('open-imdb').textContent = imdb ? 'Open IMDb settings' : 'Grant IMDb access';
        $('open-imdb').dataset.mode = imdb ? 'open' : 'grant';
        if (!origins.length) {
            const item = document.createElement('li');
            item.textContent = 'No host access is currently granted.';
            list.appendChild(item);
            return;
        }
        origins.forEach(origin => {
            const item = document.createElement('li');
            item.textContent = origin;
            list.appendChild(item);
        });
    });
}

$('open-imdb').addEventListener('click', async () => {
    // With IMDb access revoked there is no injected settings panel to open, so the same
    // control repairs the access first. This page has the gesture and the API to do it.
    if ($('open-imdb').dataset.mode === 'grant') {
        const granted = await permissionsFor(['https://www.imdb.com/*']).request();
        say(granted
            ? 'IMDb access granted. Open or reload an IMDb page.'
            : 'IMDb access was not granted, so the extension still cannot run there.', granted ? 'ok' : 'error');
        renderPermissions();
        if (!granted) return;
    }
    chrome.tabs.create({ url: 'https://www.imdb.com/' });
});

/* ---- Per-feature site access ---------------------------------------------------- */

/* This is the only surface where granting can happen at all: permissions.request needs
   both an extension page and a live user gesture. A content script has the gesture but
   not the API — chrome.permissions is not exposed to content scripts — and the
   background has the API but no gesture. So the settings panel on IMDb reports state
   and sends people here. */
const permissionsFor = origins => ({
    contains: () => new Promise(r => chrome.permissions.contains({ origins }, v => { void chrome.runtime.lastError; r(v === true); })),
    request: () => new Promise(r => chrome.permissions.request({ origins }, v => { void chrome.runtime.lastError; r(v === true); })),
    remove: () => new Promise(r => chrome.permissions.remove({ origins }, v => { void chrome.runtime.lastError; r(v === true); })),
});

function featureLabel(key) {
    const detail = core.FEATURE_DETAILS?.[key] || '';
    const first = detail.split('. ')[0];
    return first ? `${first.replace(/\.$/, '')}` : key;
}

/* Firefox's built-in data-consent experience. The manifest declares websiteContent as
   optional because an enabled score lookup sends the title and year read from the page to
   a third party, and Mozilla's guidance is that an optional declaration has to be
   requested before the data is collected.

   It is deliberately its own control rather than part of a feature's Grant button: a
   request for data-collection permissions cannot include any other optional permission,
   so it can never be bundled with an origin request. It is also add-on wide rather than
   per feature, which matches how it reads to a user.

   Chromium ignores the key entirely, so the row is feature-detected from whether
   permissions.getAll() reports a data_collection field at all — not from a browser
   sniff. */
const DATA_COLLECTION = ['websiteContent'];

function supportsDataConsent() {
    return new Promise(resolve => {
        try {
            chrome.permissions.getAll(granted => {
                void chrome.runtime.lastError;
                resolve(Boolean(granted) && Object.prototype.hasOwnProperty.call(granted, 'data_collection'));
            });
        } catch { resolve(false); }
    });
}

function dataConsent() {
    return {
        contains: () => new Promise(r => chrome.permissions.contains({ data_collection: DATA_COLLECTION },
            v => { void chrome.runtime.lastError; r(v === true); })),
        request: () => new Promise(r => chrome.permissions.request({ data_collection: DATA_COLLECTION },
            v => { void chrome.runtime.lastError; r(v === true); })),
        remove: () => new Promise(r => chrome.permissions.remove({ data_collection: DATA_COLLECTION },
            v => { void chrome.runtime.lastError; r(v === true); })),
    };
}

async function renderDataConsentRow(list) {
    if (!(await supportsDataConsent())) return;
    const api = dataConsent();

    const row = document.createElement('div');
    row.className = 'access-row';
    const copy = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'access-name';
    name.textContent = 'Sending page details to score services';
    const detail = document.createElement('div');
    detail.className = 'access-detail';
    detail.textContent = 'A score or availability lookup sends the title and year from the page you are on to the service it is looking them up in.';
    const state = document.createElement('div');
    state.className = 'access-state';
    copy.append(name, detail, state);

    const button = document.createElement('button');
    button.type = 'button';

    const paint = async () => {
        const granted = await api.contains();
        state.dataset.state = granted ? 'granted' : 'missing';
        state.textContent = granted
            ? 'Allowed.'
            : 'Not allowed, so those lookups should stay off.';
        button.textContent = granted ? 'Withdraw' : 'Allow';
        button.className = granted ? '' : 'primary';
        button.setAttribute('aria-label', granted
            ? 'Withdraw consent for sending page details to score services'
            : 'Allow sending page details to score services');
    };

    button.addEventListener('click', async () => {
        button.disabled = true;
        try {
            if (await api.contains()) {
                await api.remove();
                say('Consent withdrawn. Turn off the score and availability lookups too.', 'ok');
            } else if (await api.request()) {
                say('Consent recorded.', 'ok');
            } else {
                say('Consent was not given, so those lookups should stay off.', 'error');
            }
        } catch (error) {
            say(error?.message || 'The consent could not be changed.', 'error');
        } finally {
            button.disabled = false;
            await paint();
            button.focus();
        }
    });

    row.append(copy, button);
    list.appendChild(row);
    await paint();
}

function renderAccessList() {
    const list = $('access-list');
    list.textContent = '';
    // Rendered first: it governs what the origin grants below are for.
    renderDataConsentRow(list);
    Object.keys(core.FEATURE_ORIGIN_GROUPS || {}).forEach(key => {
        const origins = core.getFeatureOrigins(key);
        if (!origins.length) return;

        const row = document.createElement('div');
        row.className = 'access-row';
        const copy = document.createElement('div');
        const name = document.createElement('div');
        name.className = 'access-name';
        name.textContent = featureLabel(key);
        const detail = document.createElement('div');
        detail.className = 'access-detail';
        detail.textContent = core.describeFeatureOrigins(key);
        const state = document.createElement('div');
        state.className = 'access-state';
        copy.append(name, detail, state);

        const button = document.createElement('button');
        button.type = 'button';
        const api = permissionsFor(origins);

        const paint = async () => {
            const granted = await api.contains();
            const enabled = Boolean(core.getSetting(key));
            state.dataset.state = granted ? 'granted' : 'missing';
            state.textContent = granted
                ? (enabled ? 'Granted, and the feature is on.' : 'Granted, but the feature is switched off.')
                : (enabled ? 'Not granted, so this feature cannot work yet.' : 'Not granted.');
            button.textContent = granted ? 'Revoke' : 'Grant';
            button.className = granted ? '' : 'primary';
            button.setAttribute('aria-label',
                `${granted ? 'Revoke' : 'Grant'} access to ${core.describeFeatureOrigins(key)}`);
        };

        button.addEventListener('click', async () => {
            button.disabled = true;
            try {
                if (await api.contains()) {
                    /* Give back only what nothing else still needs: the identity resolver
                       is shared by three score sources and loopback by both local
                       integrations. */
                    const releasable = core.releasableOriginsFor(key);
                    if (releasable.length) await permissionsFor(releasable).remove();
                    say(`Access to ${core.describeFeatureOrigins(key)} revoked.`, 'ok');
                } else if (await api.request()) {
                    say(`Access to ${core.describeFeatureOrigins(key)} granted. Reload any open IMDb tabs.`, 'ok');
                } else {
                    say('Access was not granted, so that feature still cannot run.', 'error');
                }
            } catch (error) {
                say(error?.message || 'The permission could not be changed.', 'error');
            } finally {
                button.disabled = false;
                await paint();
                renderPermissions();
                // Focus stays where the user left it rather than falling to the body.
                button.focus();
            }
        });

        row.append(copy, button);
        list.appendChild(row);
        paint();
    });
}

/* ---- Storage summary ---------------------------------------------------------- */

function renderSummary() {
    let marks = 'unavailable';
    try { marks = String(Object.keys(core.getUserMarks(true) || {}).length); }
    catch { /* reported as unavailable */ }
    $('mark-count').textContent = marks;
    try { $('cache-summary').textContent = `${core.cacheCount()} entries · ${core.formatCacheBytes(core.cacheBytes())}`; }
    catch { $('cache-summary').textContent = 'unavailable'; }
}

/* ---- Diagnostics -------------------------------------------------------------- */

$('copy-diagnostics').addEventListener('click', async () => {
    try {
        await copyText(core.buildDiagnosticsReport());
        say('Diagnostics report copied.', 'ok');
    } catch {
        say('The diagnostics report could not be copied. Check this page’s clipboard permission.', 'error');
    }
});

/* ---- Backup ------------------------------------------------------------------- */

$('export').addEventListener('click', async () => {
    try {
        const payload = core.getExportSettings();
        await copyText(JSON.stringify(payload, null, 2));
        const omitted = payload[core.EXPORT_REDACTED_KEY] || [];
        say(omitted.length
            ? `Backup copied. ${omitted.length} integration ${omitted.length === 1 ? 'credential was' : 'credentials were'} left out.`
            : 'Backup copied.', 'ok');
    } catch (error) {
        say(error?.message || 'The backup could not be created.', 'error');
    }
});

const securePanel = $('secure-panel');
$('secure-export').addEventListener('click', () => {
    const opening = securePanel.hidden;
    securePanel.hidden = !opening;
    $('secure-export').setAttribute('aria-expanded', String(opening));
    if (opening) $('secure-passphrase').focus();
    else { $('secure-passphrase').value = ''; $('secure-passphrase-confirm').value = ''; }
});
$('secure-apply').addEventListener('click', async () => {
    const passphrase = $('secure-passphrase').value;
    if (passphrase !== $('secure-passphrase-confirm').value) {
        say('The two passphrases do not match.', 'error');
        return;
    }
    $('secure-apply').disabled = true;
    try {
        await copyText(await core.createEncryptedBackup(passphrase));
        $('secure-passphrase').value = '';
        $('secure-passphrase-confirm').value = '';
        securePanel.hidden = true;
        $('secure-export').setAttribute('aria-expanded', 'false');
        say('Encrypted backup copied. Keep the passphrase; it cannot be recovered.', 'ok');
    } catch (error) {
        say(error?.message || 'The encrypted backup could not be created.', 'error');
    } finally { $('secure-apply').disabled = false; }
});

/* ---- Restore ------------------------------------------------------------------ */

const restoreInput = $('restore-input');
const restorePassphraseRow = $('restore-passphrase-row');

restoreInput.addEventListener('input', () => {
    const raw = restoreInput.value.trim();
    let encrypted = false;
    if (raw.startsWith('{') && raw.includes('imdbEnhancedEncryptedBackup')) {
        try { encrypted = core.isEncryptedBackup(JSON.parse(raw)); }
        catch { encrypted = false; }
    }
    restorePassphraseRow.hidden = !encrypted;
    if (!encrypted) $('restore-passphrase').value = '';
});

$('restore').addEventListener('click', async () => {
    const raw = restoreInput.value.trim();
    if (!raw) { say('Paste a backup before restoring.', 'error'); return; }
    $('restore').disabled = true;
    try {
        let data = JSON.parse(raw);
        // Decryption completes before any entry is prepared, so a wrong passphrase or
        // an altered file cannot partially apply.
        if (core.isEncryptedBackup(data)) data = await core.readEncryptedBackup(data, $('restore-passphrase').value);
        const { entries, ignored } = core.prepareSettingsImport(data);
        const restored = core.applySettingsImport(entries);
        restoreInput.value = '';
        $('restore-passphrase').value = '';
        restorePassphraseRow.hidden = true;
        renderSummary();
        say(`Restored ${restored} settings${ignored ? `; skipped ${ignored} unrecognized` : ''}.`, 'ok');
    } catch (error) {
        say(error instanceof SyntaxError
            ? 'That is not valid JSON. Nothing was changed.'
            : error?.message || 'The restore failed. Nothing was changed.', 'error');
    } finally { $('restore').disabled = false; }
});

/* ---- Reset, with a real undo -------------------------------------------------- */

/* A reset here is the last resort of someone whose settings are already broken, so it
   captures the current values first and keeps them in memory for one undo. The undo is
   the same transactional write the restore path uses, so a failed undo rolls back
   rather than half-applying. */
let undoEntries = null;
let undoTimer = null;

function clearUndo() {
    undoEntries = null;
    clearTimeout(undoTimer);
    $('undo-row').hidden = true;
}

$('reset').addEventListener('click', () => {
    const panel = $('reset-panel');
    const opening = panel.hidden;
    panel.hidden = !opening;
    $('reset').setAttribute('aria-expanded', String(opening));
    if (opening) $('reset-confirm').focus();
});

$('reset-cancel').addEventListener('click', () => {
    $('reset-panel').hidden = true;
    $('reset').setAttribute('aria-expanded', 'false');
    $('reset').focus();
});

$('reset-confirm').addEventListener('click', () => {
    let snapshot;
    try {
        // Taken with credentials, because an undo that silently dropped them would be
        // worse than no undo at all.
        const current = core.getExportSettings({ includeCredentials: true });
        snapshot = core.prepareSettingsImport(current).entries;
    } catch (error) {
        say(`Current settings could not be read, so reset was not attempted: ${error?.message || 'unknown error'}`, 'error');
        return;
    }
    try {
        const count = core.applySettingsImport(core.getDefaultSettingsEntries());
        /* Keep the FIRST snapshot. A second reset before undoing would otherwise capture
           the already-reset state, so the undo would cheerfully report putting N settings
           back while restoring the defaults over what the user actually had. */
        if (!undoEntries) undoEntries = snapshot;
        $('reset-panel').hidden = true;
        $('reset').setAttribute('aria-expanded', 'false');
        $('undo-row').hidden = false;
        renderSummary();
        say(`Reset ${count} settings. Undo is available until you leave this page.`, 'ok');
        clearTimeout(undoTimer);
        undoTimer = setTimeout(clearUndo, 5 * 60 * 1000);
        // Focus would otherwise fall to the body when the panel it was in disappears.
        $('undo').focus();
    } catch (error) {
        say(error?.message || 'The reset failed and previous settings were restored.', 'error');
        $('reset').focus();
    }
});

$('undo').addEventListener('click', () => {
    if (!undoEntries) return;
    try {
        const restored = core.applySettingsImport(undoEntries);
        clearUndo();
        renderSummary();
        renderAccessList();
        say(`Undone. ${restored} settings were put back.`, 'ok');
    } catch (error) {
        say(error?.message || 'The undo failed. Nothing was changed.', 'error');
    }
    // The undo row is now gone, so send focus somewhere real rather than the body.
    $('reset').focus();
});

/* Rendered last, and each guarded on its own, so a section that cannot be read leaves
   every control above it working. */
guard('status', renderPermissions);
guard('site access', renderAccessList);
guard('storage', renderSummary);
