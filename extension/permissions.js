'use strict';

/* Firefox grants Manifest V3 host permissions only after the user opts in, so an
   otherwise healthy install can look completely dead. This popup reports the real
   permission state and requests the missing origins from a user gesture, which is
   the only context `permissions.request` accepts. Chromium grants the same origins
   at install time, so there the popup simply reports that access is already in
   place. */

const api = typeof browser !== 'undefined' ? browser : chrome;

/* The markup carries the English so the page still reads if the i18n API answers with
   nothing; every tagged element is refilled from the catalog when it does answer. */
const t = key => {
    try { return api.i18n?.getMessage?.(key) || key; }
    catch { return key; }
};
document.querySelectorAll('[data-i18n]').forEach(element => {
    const text = t(element.dataset.i18n);
    if (text !== element.dataset.i18n) element.textContent = text;
});
document.documentElement.lang = api.i18n?.getUILanguage?.() || 'en';
const stateEl = document.getElementById('state');
const stateText = document.getElementById('state-text');
const detail = document.getElementById('detail');
const grant = document.getElementById('grant');

function requiredOrigins() {
    const manifest = api.runtime.getManifest();
    return Array.isArray(manifest.host_permissions) ? manifest.host_permissions : [];
}

function contains(origins) {
    return new Promise(resolve => {
        try {
            const result = api.permissions.contains({ origins }, value => resolve(value !== false));
            if (result && typeof result.then === 'function') result.then(value => resolve(value !== false), () => resolve(false));
        } catch {
            resolve(false);
        }
    });
}

function request(origins) {
    return new Promise(resolve => {
        try {
            const result = api.permissions.request({ origins }, value => resolve(value === true));
            if (result && typeof result.then === 'function') result.then(value => resolve(value === true), () => resolve(false));
        } catch {
            resolve(false);
        }
    });
}

function show(state, message, description) {
    stateEl.dataset.state = state;
    stateText.textContent = message;
    if (description) detail.textContent = description;
    grant.disabled = state !== 'missing';
    grant.textContent = state === 'granted' ? t('permissions_site_access_granted') : t('permissions_grant_site_access');
}

async function refresh() {
    const origins = requiredOrigins();
    if (!origins.length) {
        show('granted', t('permissions_site_access_granted'), t('permissions_no_additional_access_required'));
        return;
    }
    const granted = await contains(origins);
    if (granted) {
        show('granted', t('permissions_site_access_granted'), t('permissions_active_reload_note'));
        return;
    }
    show('missing', t('permissions_site_access_needed'), t('permissions_needs_access_note'));
}

grant.addEventListener('click', async () => {
    grant.disabled = true;
    const accepted = await request(requiredOrigins());
    if (!accepted) {
        show('missing', t('permissions_site_access_needed'), t('permissions_access_declined_note'));
        return;
    }
    await refresh();
    detail.textContent = t('permissions_access_granted_note');
});

refresh();
