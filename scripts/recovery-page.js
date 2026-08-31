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

function renderPermissions() {
    const list = $('permission-list');
    list.textContent = '';
    /* chrome.* is promise-based on Chromium and callback-based on Gecko; the callback
       form is accepted by both, which is the same reason the background uses it. */
    chrome.permissions.getAll(granted => {
        const origins = (granted?.origins || []).slice().sort();
        const imdb = origins.some(origin => origin.includes('imdb.com'));
        const banner = $('imdb-access');
        banner.dataset.state = imdb ? 'granted' : 'missing';
        $('imdb-access-text').textContent = imdb
            ? 'IMDb access is granted.'
            : 'IMDb access is not granted, so the extension cannot run on IMDb pages.';
        $('open-imdb').hidden = false;
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
renderPermissions();

$('open-imdb').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://www.imdb.com/' });
});

/* ---- Storage summary ---------------------------------------------------------- */

function renderSummary() {
    let marks = 'unavailable';
    try { marks = String(Object.keys(core.getUserMarks(true) || {}).length); }
    catch { /* reported as unavailable */ }
    $('mark-count').textContent = marks;
    try { $('cache-summary').textContent = `${core.cacheCount()} entries · ${core.formatCacheBytes(core.cacheBytes())}`; }
    catch { $('cache-summary').textContent = 'unavailable'; }
}
renderSummary();

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
        undoEntries = snapshot;
        $('reset-panel').hidden = true;
        $('reset').setAttribute('aria-expanded', 'false');
        $('undo-row').hidden = false;
        renderSummary();
        say(`Reset ${count} settings. Undo is available until you leave this page.`, 'ok');
        clearTimeout(undoTimer);
        undoTimer = setTimeout(clearUndo, 5 * 60 * 1000);
    } catch (error) {
        say(error?.message || 'The reset failed and previous settings were restored.', 'error');
    }
});

$('undo').addEventListener('click', () => {
    if (!undoEntries) return;
    try {
        const restored = core.applySettingsImport(undoEntries);
        clearUndo();
        renderSummary();
        say(`Undone. ${restored} settings were put back.`, 'ok');
    } catch (error) {
        say(error?.message || 'The undo failed. Nothing was changed.', 'error');
    }
});
