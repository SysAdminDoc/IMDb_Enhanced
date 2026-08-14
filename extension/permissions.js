'use strict';

/* Firefox grants Manifest V3 host permissions only after the user opts in, so an
   otherwise healthy install can look completely dead. This popup reports the real
   permission state and requests the missing origins from a user gesture, which is
   the only context `permissions.request` accepts. Chromium grants the same origins
   at install time, so there the popup simply reports that access is already in
   place. */

const api = typeof browser !== 'undefined' ? browser : chrome;
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
    grant.textContent = state === 'granted' ? 'Site access granted' : 'Grant site access';
}

async function refresh() {
    const origins = requiredOrigins();
    if (!origins.length) {
        show('granted', 'Site access granted', 'No additional site access is required.');
        return;
    }
    const granted = await contains(origins);
    if (granted) {
        show('granted', 'Site access granted',
            'IMDb Enhanced is active. Open or reload an IMDb page and use the gear icon for settings.');
        return;
    }
    show('missing', 'Site access needed',
        'IMDb Enhanced needs access to IMDb before it can style pages, block ad shells, or look up scores.');
}

grant.addEventListener('click', async () => {
    grant.disabled = true;
    const accepted = await request(requiredOrigins());
    if (!accepted) {
        show('missing', 'Site access needed',
            'Access was not granted. IMDb Enhanced stays inactive until you allow it to run on IMDb.');
        return;
    }
    await refresh();
    detail.textContent = 'Access granted. Reload any IMDb tabs that were already open.';
});

refresh();
