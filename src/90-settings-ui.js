    // #########################################################################
    //
    //  SETTINGS PANEL
    //
    // #########################################################################
    let settingsOpen = false;
    let lastFocusedElement = null;
    let previousDocumentOverflow = '';
    let activeSettingsPage = 'experience';
    let settingsPanelCleanup = null;

    // =========================================================================
    //  OPTIONAL HOST PERMISSIONS (extension builds only)
    // =========================================================================
    /* A script manager grants @connect at install and has no runtime equivalent, so all
       of this is inert there and the state readers report "granted" rather than
       inventing a restriction the platform does not have.

       In the extension this runs in a content script, which does NOT get
       chrome.permissions — content scripts are given runtime, storage, i18n, extension,
       csi, dom and loadTimes, and nothing else. Testing for `chrome.permissions` here
       therefore fails permanently, which silently turned every check below into "yes,
       granted" and made the whole layer dead code. State is read through the background
       instead, which does have the API. */
    const supportsOptionalPermissions = () =>
        IS_EXTENSION_BUILD && typeof chrome !== 'undefined' && Boolean(chrome.runtime?.sendMessage);

    function askBackground(type, payload = {}) {
        return new Promise(resolve => {
            try {
                chrome.runtime.sendMessage({ type, ...payload }, response => {
                    void chrome.runtime?.lastError;
                    resolve(response || null);
                });
            } catch { resolve(null); }
        });
    }

    /* A feature can declare more providers than it uses at once. Availability can read
       from JustWatch or from TMDB, and asking for both origins when only one is ever
       contacted would be asking for access that is never used. */
    // A provider whose declaration excludes this build is not available to it at all.
    function providerAllowedHere(id) {
        const profiles = PROVIDERS[id]?.profiles;
        return Array.isArray(profiles) && profiles.includes(DISTRIBUTION_PROFILE);
    }
    /* Judged on the providers that actually answer the question. Losing an auxiliary
       resolver slows a lookup down; losing the site whose score is being shown ends it.
       Counting them alike said Rotten Tomatoes still worked because Wikidata did, and the
       widget then blamed a missing grant for something the build had decided. */
    function featureExcludedByProfile(key) {
        const essential = (FEATURE_PROVIDERS[key] || []).filter(id => !PROVIDERS[id]?.auxiliary);
        return essential.length > 0 && !essential.some(providerAllowedHere);
    }
    /* Which source availability really reads. The stored preference is a preference: a
       build that cannot ship JustWatch uses the one it can rather than taking a branch
       that has no origin behind it. */
    function getEffectiveAvailabilitySource() {
        const preferred = getAvailabilitySource();
        const id = preferred === 'tmdb' ? 'tmdb' : 'justWatch';
        if (providerAllowedHere(id)) return preferred;
        if (providerAllowedHere('tmdb')) return 'tmdb';
        return providerAllowedHere('justWatch') ? 'justwatch' : preferred;
    }
    /* Which page parser OMDb stands in for, per feature. */
    const OMDB_BACKED_FEATURES = { inlineRTScore:'rottenTomatoes', inlineMetacriticScore:'metacritic' };
    /* OMDb is a second answer to a question another provider already answers, so asking
       for its origin unconditionally would be asking for access nothing uses. It is in
       play only where the parser is not shipped, or where a key has been entered. */
    function omdbInPlayFor(key) {
        const parser = OMDB_BACKED_FEATURES[key];
        if (!parser || !providerAllowedHere('omdb')) return false;
        return !providerAllowedHere(parser) || isOmdbConfigured();
    }
    function activeProvidersFor(key) {
        const declared = (FEATURE_PROVIDERS[key] || []).filter(providerAllowedHere);
        if (key === 'streamAvailability') {
            const preferred = getEffectiveAvailabilitySource() === 'tmdb' ? 'tmdb' : 'justWatch';
            return declared.includes(preferred) ? [preferred] : declared;
        }
        if (OMDB_BACKED_FEATURES[key] && !omdbInPlayFor(key)) return declared.filter(id => id !== 'omdb');
        return declared;
    }
    function getFeatureOrigins(key) {
        const active = activeProvidersFor(key);
        if (!active.length) return FEATURE_ORIGIN_GROUPS[key] || [];
        return [...new Set(active.flatMap(id => PROVIDERS[id]?.origins || []))];
    }

    /* Origin patterns are not something to put in front of a user. Loopback collapses to
       one plain phrase rather than four near-identical URLs. */
    // Fallback for a feature with origins but no provider declaration, so a new origin
    // group still reads sensibly before it is declared.
    function describeOriginHosts(origins) {
        const loopback = origins.some(origin => /\/\/(localhost|127\.0\.0\.1)\//.test(origin));
        const hosts = origins
            .filter(origin => !/\/\/(localhost|127\.0\.0\.1)\//.test(origin))
            .map(origin => origin.replace(/^https?:\/\//, '').replace(/\/\*$/, '').replace(/^\*\./, ''));
        return loopback ? [...hosts, 'your own computer'] : hosts;
    }

    function joinNames(names) {
        if (names.length <= 1) return names[0] || t('text_no_external_sites');
        if (names.length === 2) return t('text_two_items_joined', [names[0], names[1]]);
        return t('text_list_joined', [names.slice(0, -1).join(t('text_list_separator')), names[names.length - 1]]);
    }

    /* Named from the provider declarations. This used to format the origins, which meant
       telling people a feature needs "backend.metacritic.com and query.wikidata.org" —
       the hosts the code calls, not the services anyone recognizes, and the first of those
       reads like something has gone wrong. A feature whose origins belong to no declared
       provider still falls back to the hostnames, so a new group reads truthfully before
       it is declared rather than silently naming nothing. */
    function describeFeatureOrigins(key) {
        const labels = activeProvidersFor(key).map(id => PROVIDERS[id]?.label).filter(Boolean);
        return joinNames(labels.length ? [...new Set(labels)] : describeOriginHosts(getFeatureOrigins(key)));
    }

    /* Shown where access is actually requested. Naming the service says who is contacted;
       these sentences say what is sent, which is the part someone deciding needs. */
    function describeFeatureConsent(key) {
        return activeProvidersFor(key)
            .map(id => PROVIDERS[id]?.consent)
            .filter(Boolean)
            .filter((sentence, index, all) => all.indexOf(sentence) === index);
    }

    async function hasFeatureOrigins(key) {
        const origins = getFeatureOrigins(key);
        if (!origins.length || !supportsOptionalPermissions()) return true;
        const response = await askBackground('imdb-enhanced:permissions-contains', { origins });
        return response?.granted === true;
    }

    /* Granting cannot happen from here. permissions.request needs a user gesture *and* an
       extension page; a content script has the gesture but not the page, and the
       background has neither. So the settings row reports the real state and hands the
       user to the options page, which has both. */
    /* Async because it used to answer "yes" the instant it sent the message, so every
       caller announced that a page had opened even when the worker was gone or the call
       failed. The answer now comes back from the worker that did or did not open it. */
    async function openOptionsPage() {
        if (!supportsOptionalPermissions()) return false;
        const response = await askBackground('imdb-enhanced:open-options');
        return response?.ok === true;
    }

    /* Only give back what nothing else still needs. Wikidata is shared by three score
       sources and the loopback origins by both local integrations, so turning one off
       must not revoke access the others depend on. */
    function originsHeldByOtherEnabledFeatures(key) {
        return new Set(
            Object.entries(FEATURE_ORIGIN_GROUPS)
                .filter(([otherKey]) => otherKey !== key && get(otherKey) !== false && get(otherKey))
                .flatMap(([, origins]) => origins)
        );
    }

    function releasableOriginsFor(key) {
        const held = originsHeldByOtherEnabledFeatures(key);
        return getFeatureOrigins(key).filter(origin => !held.has(origin));
    }

    async function releaseFeatureOrigins(key) {
        if (!supportsOptionalPermissions()) return true;
        const origins = releasableOriginsFor(key);
        if (!origins.length) return true;
        const response = await askBackground('imdb-enhanced:permissions-remove', { origins });
        return response?.ok === true;
    }

    function refreshFeature(key) {
        const feature = features.find(f => f.key === key);
        if (!feature || !get(key) || !shouldInitFeature(feature)) return;

        const linkMenu = key === 'externalLinks' ? features.find(f => f.key === 'expandedLinkMenu') : null;

        try {
            if (linkMenu && get('expandedLinkMenu')) stopFeature(linkMenu);
            stopFeature(feature);
            startFeature(feature, { context:'refresh', notify:true });
            if (linkMenu && get('expandedLinkMenu')) startFeature(linkMenu, { context:'refresh', notify:true });
        } catch (e) {
            console.warn(`[IMDb Enhanced] refresh ${key}:`, e);
            showToast(t('toast_could_not_refresh_reload_and_try', [feature.name]), 4500);
        }
    }

    function createSiteEditor({ title, key, defaults, featureKey, catalog }, registerEditorCleanup = () => {}) {
        const editor = makeEl('div', { className:'enh-site-editor' });
        const rows = makeEl('div', { className:'enh-site-editor__rows' });
        let refreshCatalogStates = () => {};
        const columns = makeEl('div', { className:'enh-site-editor__columns', 'aria-hidden':'true' },
            makeEl('span', {}, t('settings_column_visible')),
            makeEl('span', {}, t('settings_column_name')),
            makeEl('span', {}, t('settings_column_purpose')),
            makeEl('span', {}, t('settings_column_url_template')),
            makeEl('span', {}, t('settings_column_color')),
            makeEl('span', {}, t('settings_column_move')),
            makeEl('span', {}, t('settings_column_remove'))
        );
        const defaultCategory = key === 'watchSites' ? 'watch' : 'other';
        const count = makeEl('span', {
            className:'enh-settings-route-badge', role:'status', 'aria-live':'polite', 'aria-atomic':'true',
        });
        let add = null;
        let lastSaveFailure = '';
        const updateOrderButtons = () => {
            const rowList = [...rows.children];
            rowList.forEach((row, index) => {
                const up = row.querySelector('[data-action="up"]');
                const down = row.querySelector('[data-action="down"]');
                if (up) up.disabled = index === 0;
                if (down) down.disabled = index === rowList.length - 1;
            });
        };
        const updateCount = () => {
            const siteRows = [...rows.querySelectorAll('.enh-site-row')];
            const total = siteRows.length;
            const visible = siteRows.filter(row => row.querySelector('[data-field="enabled"]')?.checked).length;
            count.textContent = total ? `${visible}/${total} visible` : '0 sites';
            count.title = `${visible} of ${total} destinations appear on IMDb pages`;
            if (add) add.disabled = total >= SITE_LIST_LIMIT;
            updateOrderButtons();
            refreshCatalogStates();
        };

        const readRows = () => Array.from(rows.querySelectorAll('.enh-site-row')).map(row => ({
            name: row.querySelector('[data-field="name"]')?.value || '',
            url: row.querySelector('[data-field="url"]')?.value || '',
            color: row.querySelector('[data-field="color"]')?.value || '#6366f1',
            category: row.querySelector('[data-field="category"]')?.value || defaultCategory,
            enabled: row.querySelector('[data-field="enabled"]')?.checked !== false,
        }));

        const validateRow = row => {
            const nameInput = row.querySelector('[data-field="name"]');
            const urlInput = row.querySelector('[data-field="url"]');
            const categoryInput = row.querySelector('[data-field="category"]');
            const nameValid = Boolean(nameInput?.value.trim());
            const urlValid = Boolean(normalizeUrlTemplate(urlInput?.value));
            const categoryValid = SITE_CATEGORY_KEYS.has(categoryInput?.value);
            [[nameInput, nameValid], [urlInput, urlValid], [categoryInput, categoryValid]].forEach(([input, inputValid]) => {
                input?.classList.toggle('enh-site-input--invalid', !inputValid);
                input?.setAttribute('aria-invalid', String(!inputValid));
            });
            return nameValid && urlValid && categoryValid;
        };

        const validateRows = () => Array.from(rows.querySelectorAll('.enh-site-row'))
            .reduce((valid, row) => validateRow(row) && valid, true);

        const save = (refresh = true) => {
            lastSaveFailure = '';
            if (!validateRows()) {
                lastSaveFailure = 'validation';
                return false;
            }
            if (!setSiteList(key, readRows(), refresh)) {
                lastSaveFailure = 'storage';
                return false;
            }
            if (refresh) refreshFeature(featureKey);
            updateCount();
            return true;
        };

        let saveTimer = null;
        const cancelScheduledSave = () => {
            clearTimeout(saveTimer);
            saveTimer = null;
        };
        const scheduleSave = () => {
            cancelScheduledSave();
            saveTimer = setTimeout(() => {
                saveTimer = null;
                save(false);
            }, SITE_EDITOR_SAVE_DELAY);
        };
        registerEditorCleanup(cancelScheduledSave);

        const addRow = (site = {}) => {
            const row = makeEl('div', { className:'enh-site-row', role:'group' });
            const enabledInput = makeEl('input', {
                type:'checkbox',
                className:'enh-site-enabled',
                dataset:{ field:'enabled' },
                'aria-label':t('aria_show_destination_on_imdb_pages'),
            });
            enabledInput.checked = site.enabled !== false;
            const visibility = makeEl('label', {
                className:'enh-site-visibility',
                title:t('settings_show_or_hide_this_destination_on_imdb'),
            }, enabledInput, makeEl('span', { className:'enh-site-visibility__dot', 'aria-hidden':'true' }));
            const nameInput = makeEl('input', {
                type:'text',
                className:'enh-site-input',
                dataset:{ field:'name' },
                'aria-label':t('aria_destination_name'),
                placeholder:t('field_site_name'),
                maxlength:'40',
            });
            nameInput.value = site.name || '';

            const categoryInput = makeEl('select', {
                className:'enh-site-input enh-site-select',
                dataset:{ field:'category' },
                'aria-label':t('aria_destination_category'),
            }, ...SITE_CATEGORY_OPTIONS.map(option => makeEl('option', { value:option.key }, option.label)));
            categoryInput.value = normalizeSiteCategory(site.category, defaultCategory);

            const urlInput = makeEl('input', {
                type:'url',
                className:'enh-site-input',
                dataset:{ field:'url' },
                'aria-label':t('aria_url_template'),
                placeholder:t('field_https_example_com_search_q_title'),
                maxlength:String(URL_TEMPLATE_TEXT_LIMIT),
            });
            urlInput.value = site.url || '';

            const colorInput = makeEl('input', {
                type:'color',
                className:'enh-site-color',
                dataset:{ field:'color' },
                'aria-label':t('aria_destination_color'),
            });
            colorInput.value = normalizeColor(site.color);

            const moveRow = direction => {
                const target = direction === 'up' ? row.previousElementSibling : row.nextElementSibling;
                if (!target) return;
                const previousOrder = [...rows.children];
                if (direction === 'up') rows.insertBefore(row, target);
                else rows.insertBefore(target, row);
                if (save()) {
                    nameInput.focus();
                    return;
                }
                rows.replaceChildren(...previousOrder);
                updateCount();
                if (lastSaveFailure === 'validation') {
                    showToast(t('toast_finish_or_remove_the_incomplete_site'));
                }
            };
            const moveUp = makeEl('button', {
                type:'button',
                className:'enh-site-order-btn',
                dataset:{ action:'up' },
                title:t('aria_move_destination_up'),
                'aria-label':t('aria_move_destination_up'),
                onClick: () => moveRow('up'),
            }, '↑');
            const moveDown = makeEl('button', {
                type:'button',
                className:'enh-site-order-btn',
                dataset:{ action:'down' },
                title:t('aria_move_destination_down'),
                'aria-label':t('aria_move_destination_down'),
                onClick: () => moveRow('down'),
            }, '↓');
            const order = makeEl('span', { className:'enh-site-order' }, moveUp, moveDown);

            const remove = makeEl('button', {
                type:'button',
                className:'enh-site-remove',
                title:t('settings_remove_site'),
                'aria-label':t('aria_remove_destination'),
                onClick: () => {
                    const next = row.nextSibling;
                    const previous = row.previousSibling;
                    const destination = nameInput.value.trim() || 'Destination';
                    row.remove();
                    if (save()) {
                        const focusTarget = next?.querySelector?.('[data-field="name"]')
                            || previous?.querySelector?.('[data-field="name"]')
                            || add;
                        focusTarget?.focus();
                        showToast(t('toast_destination_removed_from_list', [destination, title]));
                        return;
                    }
                    rows.insertBefore(row, next?.parentNode === rows ? next : null);
                    updateCount();
                    remove.focus();
                    if (lastSaveFailure === 'validation') {
                        showToast(t('toast_finish_or_remove_the_incomplete_site_2'));
                    }
                },
            }, t('settings_column_remove'));

            const updateRowLabel = () => {
                const destination = nameInput.value.trim() || 'new destination';
                const category = getSiteCategoryLabel(categoryInput.value);
                row.setAttribute('aria-label', t('aria_destination_row_in_list', [destination, title]));
                row.setAttribute('aria-description', category);
                enabledInput.setAttribute('aria-label', t('aria_show_on_imdb_pages', [destination]));
                remove.setAttribute('aria-label', t('aria_remove_destination_from_list', [destination, title]));
                moveUp.setAttribute('aria-label', t('aria_move_up', [destination]));
                moveDown.setAttribute('aria-label', t('aria_move_down', [destination]));
            };
            nameInput.addEventListener('input', updateRowLabel);
            categoryInput.addEventListener('change', updateRowLabel);

            /* Every keystroke used to revalidate all rows, re-read all rows, renormalize
               them, and commit a durable write — work that scales with the whole list
               rather than the edited row, and in the extension build costs a storage
               round trip per character. Typing now only paints this row's validity; the
               commit is debounced, and blur still commits synchronously. */
            [nameInput, urlInput, categoryInput, colorInput, enabledInput].forEach(input => {
                input.addEventListener('input', () => {
                    validateRow(row);
                    scheduleSave();
                });
                input.addEventListener('change', () => {
                    cancelScheduledSave();
                    if (!save(true) && lastSaveFailure === 'validation') {
                        showToast(t('toast_enter_a_name_valid_http_s'));
                    }
                    updateCount();
                });
            });
            /* Cell order must track the header row above it — the two share one grid
               template, so a transposition both mislabels the fields and hands the long
               URL template the narrow track sized for the category select. */
            row.appendChild(visibility);
            row.appendChild(nameInput);
            row.appendChild(categoryInput);
            row.appendChild(urlInput);
            row.appendChild(colorInput);
            row.appendChild(order);
            row.appendChild(remove);
            rows.appendChild(row);
            updateRowLabel();
            return row;
        };

        add = makeEl('button', {
            type:'button',
            className:'enh-settings-footer-btn',
            onClick: () => {
                if (rows.children.length >= SITE_LIST_LIMIT) {
                    showToast(t('toast_a_site_list_can_contain_up', [SITE_LIST_LIMIT]));
                    return;
                }
                const row = addRow();
                updateCount();
                row.querySelector('[data-field="name"]')?.focus();
            },
        }, t('settings_add_destination'));
        const reset = makeEl('button', {
            type:'button',
            className:'enh-settings-footer-btn',
            onClick: () => {
                const previousRows = Array.from(rows.children);
                rows.replaceChildren();
                defaults.forEach(site => addRow(site));
                if (!save()) {
                    rows.replaceChildren(...previousRows);
                    updateCount();
                    return;
                }
                showToast(t('toast_reset_to_defaults', [title]));
            },
        }, t('recovery_heading_reset'));

        editor.appendChild(makeEl('div', { className:'enh-site-editor__header' },
            makeEl('div', { className:'enh-site-editor__title-wrap' },
                makeEl('div', { className:'enh-site-editor__title' }, title), count
            ),
            makeEl('div', { className:'enh-site-editor__actions' }, add, reset)
        ));
        editor.appendChild(makeEl('div', { className:'enh-site-editor__hint' },
            t('settings_edit_every_destination_directly_hide_categorize')
        ));

        getSiteList(key, defaults).forEach(site => addRow(site));
        updateCount();
        editor.appendChild(columns);
        editor.appendChild(rows);

        /* Optional built-in catalog: verified title-search templates can be added, while
           homepage-only entries remain useful browse links without becoming IMDb search
           buttons that discard the title. Rows are keyed by name (case-insensitive) so
           an entry already in the list reads Added. */
        if (Array.isArray(catalog) && catalog.length) {
            const catalogEntries = [];
            let addedCount = 0;
            const listedNames = () => new Set(
                [...rows.querySelectorAll('[data-field="name"]')]
                    .map(input => input.value.trim().toLowerCase())
                    .filter(Boolean)
            );
            const filter = makeEl('input', {
                type:'search',
                className:'enh-site-input enh-site-catalog__filter',
                placeholder:t('field_filter_by_site_name_or_address'),
                'aria-label':t('aria_filter_catalog_destinations'),
            });
            const groupsWrap = makeEl('div', { className:'enh-site-catalog__groups' });
            const emptyNote = makeEl('div', { className:'enh-site-catalog__empty' }, t('text_no_catalog_sites_match_this_filter'));
            emptyNote.hidden = true;
            refreshCatalogStates = () => {
                const names = listedNames();
                const query = filter.value.trim().toLowerCase();
                const atLimit = rows.children.length >= SITE_LIST_LIMIT;
                let anyVisible = false;
                catalogEntries.forEach(entry => {
                    const matches = !query || entry.haystack.includes(query);
                    entry.row.hidden = !matches;
                    if (!entry.searchable) return;
                    const listed = names.has(entry.lowerName);
                    entry.button.disabled = listed || atLimit;
                    entry.button.textContent = listed ? 'Added' : 'Add';
                    entry.button.setAttribute('aria-label', listed
                        ? `${entry.site.name} is already in ${title}`
                        : `Add ${entry.site.name} to ${title}`);
                });
                catalog.forEach((groupData, groupIndex) => {
                    const groupEntries = catalogEntries.filter(entry => entry.groupIndex === groupIndex);
                    const groupVisible = groupEntries.some(entry => !entry.row.hidden);
                    const block = groupsWrap.children[groupIndex];
                    if (block) block.hidden = !groupVisible;
                    if (groupVisible) anyVisible = true;
                });
                emptyNote.hidden = anyVisible;
            };
            catalog.forEach((groupData, groupIndex) => {
                const block = makeEl('div', { className:'enh-site-catalog__group' },
                    makeEl('div', { className:'enh-site-catalog__group-label' }, groupData.group)
                );
                groupData.sites.forEach(site => {
                    let host = site.url;
                    try { host = new URL(site.url).hostname.replace(/^www\./, ''); }
                    catch { /* catalog URLs are static and valid; keep the raw string */ }
                    const searchable = hasWatchSearchTemplate(site.url);
                    const button = searchable
                        ? makeEl('button', {
                            type:'button',
                            className:'enh-site-catalog__add',
                            onClick: () => {
                                if (rows.children.length >= SITE_LIST_LIMIT) {
                                    showToast(t('toast_a_site_list_can_contain_up', [SITE_LIST_LIMIT]));
                                    return;
                                }
                                const row = addRow({
                                    name: site.name,
                                    url: site.url,
                                    color: CATALOG_ROW_COLORS[addedCount % CATALOG_ROW_COLORS.length],
                                    category: defaultCategory,
                                    enabled: true,
                                });
                                if (!save()) {
                                    row.remove();
                                    updateCount();
                                    /* save() validates every row, so an incomplete row the
                                       user left elsewhere in the editor fails this one too.
                                       Telling them to check storage sends them after the
                                       wrong thing entirely. */
                                    showToast(lastSaveFailure === 'validation'
                                        ? t('toast_finish_or_remove_the_incomplete_site_3', [site.name])
                                        : t('toast_could_not_save_destination', [site.name, STORAGE_HOST_LABEL]), 4500);
                                    return;
                                }
                                addedCount += 1;
                                updateCount();
                                showToast(t('toast_destination_added_to_list', [site.name, title]));
                            },
                        }, t('label_add'))
                        : makeEl('a', {
                            href:site.url,
                            target:'_blank',
                            rel:'noopener noreferrer',
                            className:'enh-site-catalog__add',
                            'aria-label':t('aria_open_link', [site.name, host]),
                        }, t('label_open'));
                    const row = makeEl('div', { className:'enh-site-catalog__entry' },
                        makeEl('span', { className:'enh-site-catalog__name' }, site.name),
                        makeEl('span', { className:'enh-site-catalog__host' }, host),
                        button
                    );
                    catalogEntries.push({
                        site,
                        row,
                        button,
                        searchable,
                        groupIndex,
                        lowerName: site.name.toLowerCase(),
                        haystack: `${site.name} ${host}`.toLowerCase(),
                    });
                    block.appendChild(row);
                });
                groupsWrap.appendChild(block);
            });
            filter.addEventListener('input', refreshCatalogStates);
            const picker = makeEl('details', { className:'enh-site-catalog' },
                makeEl('summary', { className:'enh-site-catalog__summary' },
                    makeEl('span', {}, t('settings_fmhy_streaming_catalog')),
                    makeEl('span', { className:'enh-settings-route-badge' },
                        `${catalogEntries.length} sites`)
                ),
                makeEl('div', { className:'enh-site-catalog__body' }, filter, emptyNote, groupsWrap)
            );
            refreshCatalogStates();
            editor.appendChild(picker);
        }
        return editor;
    }

    /* refreshKey takes one feature or several: the OMDb key feeds two score widgets,
       and saving it has to refresh both. */
    function createSettingsInput({ key, label, type = 'text', wide = false, placeholder = '', refreshKey = 'servarrIntegration' }) {
        const id = `enh-setting-${key}`;
        /* In the extension a credential is write-only here: the bridge keeps the value out
           of this world entirely, so the field cannot be pre-filled and must say whether
           one is stored instead of rendering an empty box that reads as "not set". */
        const isCredential = CREDENTIAL_SETTING_KEYS.has(key);
        const credential = isCredential ? readCredential(key) : null;
        const writeOnly = isCredential && !credential.value && credential.configured;
        const input = makeEl('input', {
            id,
            name:key,
            type,
            className:'enh-servarr-input',
            placeholder: writeOnly ? t('settings_saved_type_to_replace') : placeholder,
            autocomplete: type === 'password' ? 'new-password' : 'off',
            spellcheck:'false',
            ...(writeOnly ? { 'aria-describedby':`${id}-state` } : {}),
            ...(type === 'number'
                ? { min:'1', step:'1' }
                : { maxlength:String(SETTING_TEXT_LIMIT) }),
        });
        input.value = isCredential
            ? String(credential.value || '').slice(0, SETTING_TEXT_LIMIT)
            : String(get(key) || '').slice(0, SETTING_TEXT_LIMIT);
        const persist = (notifyFailure = false) => {
            const raw = input.value.trim();
            if (LOCAL_SERVICE_URL_KEYS.has(key)) {
                const normalized = normalizeLocalServiceUrl(raw);
                const valid = !raw || Boolean(normalized);
                input.classList.toggle('enh-site-input--invalid', !valid);
                input.setAttribute('aria-invalid', String(!valid));
                if (!valid) {
                    if (notifyFailure) showToast(t('toast_use_a_localhost_or_127_0'));
                    return false;
                }
                return trySaveSetting(key, normalized, { notify:notifyFailure });
            }
            if (POSITIVE_INTEGER_SETTING_KEYS.has(key) && raw) {
                const number = Number(raw);
                const valid = Number.isSafeInteger(number) && number > 0;
                input.classList.toggle('enh-site-input--invalid', !valid);
                input.setAttribute('aria-invalid', String(!valid));
                if (!valid) {
                    if (notifyFailure) showToast(t('toast_use_a_positive_whole_number_profile'));
                    return false;
                }
                return trySaveSetting(key, String(number), { notify:notifyFailure });
            }
            if (CREDENTIAL_SETTING_KEYS.has(key)) {
                const normalized = normalizeCredentialValue(raw);
                const valid = !raw || Boolean(normalized);
                input.classList.toggle('enh-site-input--invalid', !valid);
                input.setAttribute('aria-invalid', String(!valid));
                if (!valid) {
                    if (notifyFailure) showToast(t('toast_credentials_must_be_at_most_4'));
                    return false;
                }
                return trySaveSetting(key, normalized, { notify:notifyFailure });
            }
            input.classList.remove('enh-site-input--invalid');
            input.setAttribute('aria-invalid', 'false');
            return trySaveSetting(key, raw.slice(0, SETTING_TEXT_LIMIT), { notify:notifyFailure });
        };
        if (LOCAL_SERVICE_URL_KEYS.has(key)) {
            const initial = input.value.trim();
            const valid = !initial || Boolean(normalizeLocalServiceUrl(initial));
            input.classList.toggle('enh-site-input--invalid', !valid);
            input.setAttribute('aria-invalid', String(!valid));
        }
        input.addEventListener('input', () => persist(false));
        input.addEventListener('change', () => {
            if (!persist(true)) return;
            [].concat(refreshKey || []).forEach(refreshFeature);
            /* Storing a credential can add a service to what a feature contacts — an OMDb
               key does exactly that — so the rows that report access are stale the moment
               this returns. They listen for this; nothing used to send it. */
            if (isCredential) {
                try { document.dispatchEvent(new CustomEvent('imdb-enhanced:permissions-changed')); }
                catch { /* the row repaints on the next open */ }
            }
        });
        return makeEl('div', { className:'enh-servarr-field' + (wide ? ' enh-servarr-field--wide' : '') },
            makeEl('label', { for:id }, label),
            input,
            // Says a credential is stored without showing it, so an empty field is not
            // mistaken for an unconfigured integration.
            writeOnly
                ? makeEl('span', { className:'enh-servarr-note enh-servarr-note--saved', id:`${id}-state` },
                    t('settings_a_key_is_saved_on_this_device'))
                : null
        );
    }

    function createIntegrationTabs(sections, fieldFactory, namespace) {
        const panel = makeEl('form', { className:'enh-servarr-panel', autocomplete:'off' });
        const tabs = makeEl('div', { className:'enh-integration-tabs', role:'tablist', 'aria-label':t('aria_integration_service_tabs', [namespace]) });
        const panels = new Map();
        const buttons = new Map();
        const select = id => {
            panels.forEach((section, sectionId) => { section.hidden = sectionId !== id; });
            buttons.forEach((button, buttonId) => {
                const selected = buttonId === id;
                button.setAttribute('aria-selected', String(selected));
                button.tabIndex = selected ? 0 : -1;
            });
        };

        sections.forEach((definition, index) => {
            const tabId = `enh-${namespace}-tab-${definition.id}`;
            const panelId = `enh-${namespace}-panel-${definition.id}`;
            const button = makeEl('button', {
                type:'button', className:'enh-integration-tab', id:tabId, role:'tab',
                'aria-controls':panelId, 'aria-selected':String(index === 0),
                onClick:() => select(definition.id),
            }, definition.title);
            button.tabIndex = index === 0 ? 0 : -1;
            button.addEventListener('keydown', event => {
                const ordered = sections.map(item => item.id);
                const current = ordered.indexOf(definition.id);
                let next = null;
                if (event.key === 'ArrowRight') next = (current + 1) % ordered.length;
                if (event.key === 'ArrowLeft') next = (current - 1 + ordered.length) % ordered.length;
                if (event.key === 'Home') next = 0;
                if (event.key === 'End') next = ordered.length - 1;
                if (next === null) return;
                event.preventDefault();
                select(ordered[next]);
                buttons.get(ordered[next])?.focus();
            });
            const section = makeEl('div', {
                className:'enh-servarr-section', id:panelId, role:'tabpanel', 'aria-labelledby':tabId,
            }, makeEl('div', { className:'enh-servarr-grid' }, ...definition.fields.map(fieldFactory)));
            section.hidden = index !== 0;
            tabs.appendChild(button);
            buttons.set(definition.id, button);
            panels.set(definition.id, section);
        });

        panel.appendChild(tabs);
        panels.forEach(section => panel.appendChild(section));
        return panel;
    }

    function createServarrSettingsPanel() {
        const panel = createIntegrationTabs([
            {
                id:'radarr', title:'Radarr', fields:[
                    { key:'radarrUrl', label:t('label_url'), wide:true, placeholder:t('field_http_localhost_7878') },
                    { key:'radarrApiKey', label:t('settings_api_key'), type:'password', wide:true },
                    { key:'radarrRootFolderPath', label:t('settings_root_folder'), wide:true, placeholder:t('field_radarr_root_folder_hint') },
                    { key:'radarrQualityProfileId', label:t('settings_quality_profile_id'), type:'number' },
                ],
            },
            {
                id:'sonarr', title:'Sonarr', fields:[
                    { key:'sonarrUrl', label:t('label_url'), wide:true, placeholder:t('field_http_localhost_8989') },
                    { key:'sonarrApiKey', label:t('settings_api_key'), type:'password', wide:true },
                    { key:'sonarrRootFolderPath', label:t('settings_root_folder'), wide:true, placeholder:t('field_sonarr_root_folder_hint') },
                    { key:'sonarrQualityProfileId', label:t('settings_quality_profile_id'), type:'number' },
                ],
            },
            {
                id:'seerr', title:'Overseerr', fields:[
                    { key:'seerrUrl', label:t('label_url'), wide:true, placeholder:t('field_http_localhost_5055') },
                    { key:'seerrApiKey', label:t('settings_api_key'), type:'password', wide:true },
                ],
            },
        ], createSettingsInput, 'servarr');
        panel.appendChild(makeEl('div', { className:'enh-servarr-note' },
            t('settings_credentials_stay_local_and_requests_are_limited')
        ));
        panel.addEventListener('submit', e => e.preventDefault());
        return panel;
    }

    function createMediaServerSettingsPanel() {
        const mediaField = field => createSettingsInput({ ...field, refreshKey:'mediaServerIntegration' });
        const panel = createIntegrationTabs([
            {
                id:'plex', title:'Plex', fields:[
                    { key:'plexUrl', label:t('label_url'), wide:true, placeholder:t('field_http_localhost_32400') },
                    { key:'plexToken', label:t('label_token'), type:'password', wide:true },
                ],
            },
            {
                id:'jellyfin', title:'Jellyfin', fields:[
                    { key:'jellyfinUrl', label:t('label_url'), wide:true, placeholder:t('field_http_localhost_8096') },
                    { key:'jellyfinApiKey', label:t('settings_api_key'), type:'password', wide:true },
                ],
            },
            {
                id:'emby', title:'Emby', fields:[
                    { key:'embyUrl', label:t('label_url'), wide:true, placeholder:t('field_http_localhost_8096') },
                    { key:'embyApiKey', label:t('settings_api_key'), type:'password', wide:true },
                ],
            },
        ], mediaField, 'media');
        panel.appendChild(makeEl('div', { className:'enh-servarr-note' },
            t('settings_checks_match_imdb_ids_first_then_title')
        ));
        panel.addEventListener('submit', e => e.preventDefault());
        return panel;
    }

    function createMarksPanel(registerCleanup = () => {}) {
        const panel = makeEl('div', { className:'enh-marks-panel' });
        const count = makeEl('div', { className:'enh-marks-panel__count' });
        const rows = makeEl('div', { className:'enh-marks-panel__rows' });
        /* Removing a mark used to be final. The row's Remove dropped the record and its
           note in one write, and Clear all dropped every one of them behind a second click
           five seconds apart, which is a speed bump rather than consent — and no help at
           all to somebody who meant the row above. Both offer the deletion back instead.

           The snapshot is the store as it stood before the first deletion in the current
           run, not before the last one, so removing three rows and then changing your mind
           puts all three back. Undoing, or letting the offer lapse, starts the next one.

           The control lives in the panel rather than on the toast because the settings
           overlay traps Tab within itself: a button anywhere else is unreachable by
           keyboard for exactly as long as this panel is the thing on screen. */
        const MARK_UNDO_MS = 15000;
        let pendingUndo = null;
        let undoTimer = null;
        const forgetUndo = () => {
            clearTimeout(undoTimer);
            undoTimer = null;
            pendingUndo = null;
            undo.hidden = true;
        };
        const afterMarkWrite = () => {
            refreshFeature('watchedMarking');
            refreshFeature('titleNotes');
            render();
            document.dispatchEvent(new CustomEvent('imdb-enhanced:marks-updated'));
        };
        /* One write, and the snapshot is only kept once it has succeeded: offering to undo
           something that never happened would restore the store to a state it is already
           in and report it as a recovery. */
        const deleteMarks = (next, describe) => {
            const before = { ...getUserMarks(true) };
            if (!setUserMarks(next)) return false;
            if (!pendingUndo) pendingUndo = before;
            clearTimeout(undoTimer);
            undoTimer = setTimeout(forgetUndo, MARK_UNDO_MS);
            afterMarkWrite();
            undo.hidden = false;
            showToast(describe, 6000);
            return true;
        };
        const undo = makeEl('button', {
            type:'button',
            hidden:true,
            className:'enh-settings-footer-btn',
            'aria-label':t('aria_undo_the_last_mark_deletion'),
            onClick: () => {
                if (!pendingUndo) {
                    showToast(t('toast_that_undo_is_no_longer_available'));
                    undo.hidden = true;
                    return;
                }
                const snapshot = pendingUndo;
                const restored = Object.keys(snapshot).length;
                /* A refused write reports itself and leaves both the store and the cache
                   as they were, so the snapshot is kept for another try rather than
                   consumed by the attempt. */
                if (!setUserMarks(snapshot)) return;
                forgetUndo();
                afterMarkWrite();
                showToast(tCount('toast_marks_put_back', restored));
            },
        }, t('settings_undo_delete'));
        const clearAll = makeEl('button', {
            type:'button',
            className:'enh-settings-footer-btn enh-settings-footer-btn--danger',
            'aria-label':t('aria_clear_all_saved_title_marks'),
            onClick: () => {
                const entries = getUserMarkEntries();
                if (!entries.length) return;
                deleteMarks({}, tCount('toast_cleared_saved_title_marks', entries.length));
            },
        }, t('text_clear_all'));

        /* One-way: IMDb's account Watched state can seed local Seen marks, never
           the reverse. Existing marks win, so an imported title can never
           overwrite a deliberate Skip. */
        const importNative = makeEl('button', {
            type:'button',
            className:'enh-settings-footer-btn',
            'aria-label':t('aria_import_imdb_watched_titles_shown_on'),
            onClick: () => {
                const found = collectNativeWatchedTitles(document);
                if (!found.size) {
                    showToast(t('toast_no_imdb_watched_titles_found_on'));
                    return;
                }
                const marks = { ...getUserMarks(true) };
                let imported = 0;
                let kept = 0;
                found.forEach((title, id) => {
                    if (marks[id]) { kept++; return; }
                    marks[id] = { state:'watched', title:String(title || '').trim().slice(0, USER_MARK_TITLE_LIMIT), ts:Date.now() };
                    imported++;
                });
                if (!imported) {
                    showToast(tCount('toast_all_imdb_watched_on_this_page', kept));
                    return;
                }
                if (!setUserMarks(marks)) return;
                refreshFeature('watchedMarking');
                render();
                document.dispatchEvent(new CustomEvent('imdb-enhanced:marks-updated'));
                showToast(kept
                    ? tCount('toast_imported_keeping_existing', kept, [imported])
                    : tCount('toast_imported_watched_titles', imported));
            },
        }, t('settings_import_from_page'));

        const render = () => {
            const entries = getUserMarkEntries();
            count.textContent = t('text_saved_mark_count', [entries.length]);
            const summary = document.getElementById('enh-data-marks-count');
            if (summary) summary.textContent = tCount('text_title_count', entries.length);
            clearAll.disabled = entries.length === 0;
            rows.replaceChildren();
            if (!entries.length) {
                rows.appendChild(makeEl('div', { className:'enh-marks-empty' }, t('text_no_local_title_marks_yet')));
                return;
            }
            entries.forEach(([id, record]) => {
                const title = record.title || id;
                /* A record can now exist for a note alone, with no Seen or Skip, so the
                   badge has to describe that rather than mislabel it as one of the two. */
                const note = normalizeUserNote(record.note);
                const viewings = countViewings(record);
                const state = record.state === 'watched'
                    ? (viewings > 1
                        ? `${t('settings_local_seen')} ${t('text_times_count', [viewings])}`
                        : t('settings_local_seen'))
                    : record.state === 'skip' ? t('settings_local_skip')
                    : t('settings_note_only');
                const titleEl = makeEl('div', { className:'enh-mark-row__title', title },
                    title,
                    record.title ? makeEl('span', { className:'enh-mark-row__id' }, id) : ''
                );
                const stateEl = makeEl('div', {
                    className:'enh-mark-row__state'
                        + (record.state === 'skip' ? ' enh-mark-row__state--skip' : '')
                        + (record.state ? '' : ' enh-mark-row__state--note'),
                }, state);
                const open = makeEl('a', {
                    href:`https://www.imdb.com/title/${id}/`,
                    target:'_blank',
                    rel:'noopener noreferrer',
                    className:'enh-mark-row__link',
                }, t('label_open'));
                const clear = makeEl('button', {
                    type:'button',
                    className:'enh-mark-row__clear',
                    title:t('text_clear_title', [title]),
                    'aria-label':t('aria_clear_mark_for', [title]),
                    onClick: () => {
                        /* Clearing from here removes the record outright, note included,
                           because this is the list's Remove action rather than a way to
                           unset only the Seen/Skip half. One write, not two: as a note
                           removal followed by a mark removal, a failure between them
                           destroyed the note and kept the mark, which is the one outcome
                           the user did not ask for. */
                        const remaining = { ...getUserMarks(true) };
                        delete remaining[id];
                        deleteMarks(remaining, note
                            ? t('settings_mark_and_note_removed')
                            : t('settings_mark_cleared'));
                    },
                }, t('settings_column_remove'));
                const row = makeEl('div', { className:'enh-mark-row' }, titleEl, stateEl, open, clear);
                // Rendered as text, never markup: a note is arbitrary user input.
                if (note) row.appendChild(makeEl('div', { className:'enh-mark-row__note' }, note));
                rows.appendChild(row);
            });
        };

        panel.appendChild(makeEl('div', { className:'enh-marks-panel__header' },
            makeEl('div', { className:'enh-marks-panel__title' }, t('label_private_title_marks')),
            makeEl('div', { className:'enh-site-editor__actions' }, count, importNative, undo, clearAll)
        ));
        panel.appendChild(makeEl('div', { className:'enh-servarr-note' },
            t('settings_these_marks_stay_on_this_device_and')
        ));
        panel.appendChild(rows);
        document.addEventListener('imdb-enhanced:marks-updated', render);
        registerCleanup(() => {
            document.removeEventListener('imdb-enhanced:marks-updated', render);
            clearTimeout(undoTimer);
        });
        render();
        return panel;
    }

    function createLocalStatsList(title, items, emptyText) {
        const group = makeEl('div', { className:'enh-stats-group' }, makeEl('h4', {}, title));
        if (!items.length) {
            group.appendChild(makeEl('div', { className:'enh-settings-card-description' }, emptyText));
            return group;
        }
        const maximum = Math.max(...items.map(item => item.count), 1);
        items.forEach(item => {
            const width = `${Math.max(5, Math.round((item.count / maximum) * 100))}%`;
            group.appendChild(makeEl('div', {
                className:'enh-stats-row',
                'aria-label':`${item.label}: ${item.count}`,
            },
                makeEl('span', { className:'enh-stats-row__label', title:item.label }, item.label),
                makeEl('span', { className:'enh-stats-row__track', 'aria-hidden':'true' },
                    makeEl('span', { className:'enh-stats-row__fill', style:{ width } })
                ),
                makeEl('span', { className:'enh-stats-row__count' }, String(item.count))
            ));
        });
        return group;
    }

    function createLocalStatsPanel(registerCleanup = () => {}) {
        const card = makeEl('section', {
            className:'enh-settings-card enh-stats-card',
            'aria-labelledby':'enh-local-stats-title',
        });
        const render = () => {
            const stats = summarizeLocalStats(getUserMarks(true));
            card.replaceChildren(makeEl('div', { className:'enh-settings-card-header' },
                makeEl('div', {},
                    makeEl('h3', { className:'enh-settings-card-title', id:'enh-local-stats-title' }, t('label_local_stats')),
                    makeEl('p', { className:'enh-settings-card-description' },
                        t('settings_calculated_on_this_device_from_your_private'))
                ),
                makeEl('span', { className:'enh-settings-route-badge' }, t('settings_local_only'))
            ));
            if (!stats.markedTitles && !stats.viewings) {
                card.appendChild(makeEl('div', { className:'enh-stats-empty' },
                    t('settings_no_local_viewing_history_yet_mark_a')));
                return;
            }
            const overview = makeEl('div', { className:'enh-stats-overview' });
            [
                [stats.seen, t('settings_seen_titles')],
                [stats.skipped, t('settings_skipped_titles')],
                [stats.viewings, t('settings_dated_viewings')],
                [stats.rated, t('settings_personal_ratings')],
            ].forEach(([value, label]) => overview.appendChild(makeEl('div', { className:'enh-stats-metric' },
                makeEl('div', { className:'enh-stats-metric__value' }, String(value)),
                makeEl('div', { className:'enh-stats-metric__label' }, label)
            )));
            card.appendChild(overview);
            card.appendChild(makeEl('div', { className:'enh-stats-grid' },
                createLocalStatsList(t('settings_activity_by_year'), stats.years, t('settings_no_dated_viewings_yet')),
                createLocalStatsList(t('settings_top_genres'), stats.topGenres, t('settings_genres_appear_as_titles_are_marked_or')),
                createLocalStatsList(t('settings_release_decades'), stats.decades, t('settings_release_years_appear_as_titles_are_marked'))
            ));
            const insights = [];
            if (stats.ratingDelta !== null) {
                const delta = Math.abs(stats.ratingDelta).toFixed(2);
                insights.push(Math.abs(stats.ratingDelta) < 0.005
                    ? `Your ${stats.ratingPairs} comparable ratings match IMDb on average.`
                    : `Your ${stats.ratingPairs} comparable ratings run ${delta} ${stats.ratingDelta > 0 ? 'higher' : 'lower'} than IMDb on average.`);
            } else {
                insights.push(t('settings_rating_comparison_appears_after_a_title_has'));
            }
            if (stats.runtimeMinutes) insights.push(t('settings_runtime_known_across_seen', [formatRuntimeTotal(stats.runtimeMinutes)]));
            if (stats.reviewYear) insights.push(t('settings_year_has_dated_viewings', [stats.reviewYear.label, stats.reviewYear.count]));
            else insights.push(t('settings_a_year_review_appears_after_10_dated'));
            if (stats.undatedSeen) insights.push(tCount('settings_seen_without_viewing_date', stats.undatedSeen));
            card.appendChild(makeEl('div', { className:'enh-stats-insights' },
                makeEl('strong', {}, t('settings_coverage_label')),
                /* One sentence, not a lead-in plus a clause plus a verb chosen by a
                   ternary: which word changes with the count is a property of the
                   language, so the whole sentence has a singular and a plural form. */
                ` ${tCount('settings_history_metadata_coverage', stats.historyTitles, [stats.metadataTitles, insights.join(' ')])}`
            ));
        };
        document.addEventListener('imdb-enhanced:marks-updated', render);
        registerCleanup(() => document.removeEventListener('imdb-enhanced:marks-updated', render));
        render();
        return card;
    }

    function createSettingsPanel() {
        if (document.getElementById('enh-settings-overlay')) return;
        const cleanupTasks = [];
        const registerCleanup = cleanup => cleanupTasks.push(cleanup);
        const overlay = makeEl('div', { id:'enh-settings-overlay', 'aria-hidden':'true' });
        overlay.innerHTML = `<div id="enh-settings-panel">
            <div class="enh-settings-header">
                <div>
                    <h2 id="enh-settings-title">IMDb Enhanced</h2>
                    <p class="enh-settings-subtitle">${t('settings_panel_subtitle')}</p>
                </div>
                <div class="enh-settings-header-actions">
                    <span class="enh-settings-save-state" id="enh-settings-save-state" role="status" aria-live="polite" aria-atomic="true">${t('text_saved_locally')}</span>
                    <button type="button" class="enh-settings-close" title="${t('aria_close_settings')}" aria-label="${t('aria_close_settings')}">×</button>
                </div>
            </div>
            <div class="enh-settings-shell">
                <nav class="enh-settings-nav" id="enh-settings-nav" role="tablist" aria-label="${t('aria_settings_sections')}" aria-orientation="vertical"></nav>
                <div class="enh-settings-main">
                    <div class="enh-settings-body" id="enh-settings-body"></div>
                </div>
            </div>
            <div class="enh-settings-footer">
                <span>${t('settings_version', [VERSION])}</span>
                <span>${t('settings_changes_save_automatically')}</span>
                <span class="enh-settings-footer-note">${t('settings_stored_in', [STORAGE_HOST_LABEL])}</span>
            </div>
        </div>`;

        const panel = overlay.querySelector('#enh-settings-panel');
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-labelledby', 'enh-settings-title');
        panel.setAttribute('tabindex', '-1');

        const nav = overlay.querySelector('#enh-settings-nav');
        const body = overlay.querySelector('#enh-settings-body');
        const saveState = overlay.querySelector('#enh-settings-save-state');
        const pageMeta = [
            { id:'experience', label:t('label_experience'), title:t('label_experience'), description:'Shape how IMDb looks and feels.' },
            { id:'ratings', label:t('label_ratings'), title:t('label_ratings'), description:'Bring trusted scores into the title page.' },
            { id:'tools', label:t('label_tools'), title:t('label_tools'), description:'Turn on only the shortcuts and title-page utilities you use.' },
            { id:'sites', label:t('label_sites'), title:t('label_sites'), description:'Choose where title searches and research links open.' },
            { id:'integrations', label:t('label_integrations'), title:t('label_integrations'), description:'Connect the local services you already run.' },
            { id:'data', label:t('label_data'), title:t('label_data'), description:'Review, back up, or clear what IMDb Enhanced stores locally.' },
        ];
        const pages = new Map();
        let savedTimer = null;

        const markSaved = () => {
            saveState.classList.remove('enh-settings-save-state--error');
            saveState.textContent = t('text_settings_saved');
            clearTimeout(savedTimer);
            savedTimer = setTimeout(() => { saveState.textContent = t('text_saved_locally'); }, 1200);
        };
        const markSaveFailed = event => {
            /* The failure event now names its key, and cache writes share it. A rejected
               lookup-cache write is not a failed setting, and reporting it here told the
               user their preference had not saved when it had. The cache has its own
               handler for those. */
            if (isCacheStorageKey(event?.detail?.key)) return;
            clearTimeout(savedTimer);
            saveState.classList.add('enh-settings-save-state--error');
            saveState.textContent = t('text_save_failed');
        };
        document.addEventListener('imdb-enhanced:settings-saved', markSaved);
        document.addEventListener('imdb-enhanced:settings-save-failed', markSaveFailed);
        registerCleanup(() => {
            document.removeEventListener('imdb-enhanced:settings-saved', markSaved);
            document.removeEventListener('imdb-enhanced:settings-save-failed', markSaveFailed);
            clearTimeout(savedTimer);
        });
        const makePage = meta => {
            const section = makeEl('section', {
                className:'enh-settings-page',
                id:`enh-settings-page-${meta.id}`,
                role:'tabpanel',
                'aria-labelledby':`enh-settings-tab-${meta.id}`,
            }, makeEl('div', { className:'enh-settings-page-header' },
                makeEl('h3', { className:'enh-settings-page-title' }, meta.title),
                makeEl('p', { className:'enh-settings-page-description' }, meta.description)
            ));
            pages.set(meta.id, section);
            body.appendChild(section);
            return section;
        };
        const showPage = (id, focus = false) => {
            if (!pages.has(id)) id = 'experience';
            activeSettingsPage = id;
            pages.forEach((page, pageId) => { page.hidden = pageId !== id; });
            nav.querySelectorAll('.enh-settings-nav-btn').forEach(button => {
                const selected = button.dataset.settingsPage === id;
                button.setAttribute('aria-selected', String(selected));
                button.tabIndex = selected ? 0 : -1;
                if (selected && focus) button.focus();
            });
            body.scrollTop = 0;
        };
        const makeCard = (title, description = '', badge = '') => makeEl('div', { className:'enh-settings-card' },
            makeEl('div', { className:'enh-settings-card-header' },
                makeEl('div', {},
                    makeEl('div', { className:'enh-settings-card-title' }, title),
                    description ? makeEl('div', { className:'enh-settings-card-description' }, description) : null
                ),
                badge ? makeEl('span', { className:'enh-settings-route-badge' }, badge) : null
            )
        );
        const makeFeatureRow = feature => {
            const detail = FEATURE_DETAILS[feature.key] || '';
            const helpId = `enh-help-${feature.key}`;
            const row = makeEl('div', { className:'enh-settings-row', ...(detail ? { title:detail } : {}) },
                makeEl('div', { className:'enh-settings-row-copy' },
                    makeEl('span', { className:'enh-settings-label' }, feature.name),
                    makeEl('span', { className:'enh-settings-help', id:helpId }, detail)
                )
            );
            const toggle = makeEl('label', { className:'enh-toggle' });
            const input = makeEl('input', {
                type:'checkbox',
                'aria-label':feature.name,
                ...(detail ? { 'aria-describedby':helpId } : {}),
            });
            input.checked = get(feature.key);

            /* Features that reach a third party say so, and say whether that access is
               currently granted. Without this a denied request is indistinguishable from
               a broken feature.

               A build that does not ship a feature's source is a different state again.
               Asking for access there would name an origin the manifest does not declare,
               so the request could not succeed and the row would blame the user for a
               decision the build made. */
            const excludedByProfile = featureExcludedByProfile(feature.key);
            const origins = getFeatureOrigins(feature.key);
            let access = null;
            let grantButton = null;
            if (origins.length && supportsOptionalPermissions()) {
                access = makeEl('span', { className:'enh-settings-access', role:'status' });
                if (!excludedByProfile) {
                    grantButton = makeEl('button', {
                        type:'button',
                        className:'enh-settings-access-btn',
                        hidden:'hidden',
                        onClick: async () => {
                            if (await openOptionsPage()) showToast(t('toast_grant_then_return'), 5000);
                        },
                    }, t('settings_grant_access'));
                }
                const copy = row.querySelector('.enh-settings-row-copy');
                copy.appendChild(access);
                if (grantButton) copy.appendChild(grantButton);
            }
            const paintAccess = async () => {
                if (!access) return;
                if (excludedByProfile) {
                    access.dataset.state = 'excluded';
                    access.textContent = describeProfileExclusion(feature.key);
                    return;
                }
                if (!get(feature.key)) {
                    access.textContent = '';
                    access.dataset.state = 'off';
                    grantButton.hidden = true;
                    return;
                }
                const granted = await hasFeatureOrigins(feature.key);
                access.dataset.state = granted ? 'granted' : 'missing';
                access.textContent = granted
                    ? `Site access granted for ${describeFeatureOrigins(feature.key)}`
                    : `Not working yet: needs access to ${describeFeatureOrigins(feature.key)}.`;
                grantButton.hidden = granted;
                grantButton.setAttribute('aria-label', t('aria_grant_access_to', [feature.name, describeFeatureOrigins(feature.key)]));
            };
            paintAccess();
            /* Access can be granted or revoked on the options page while this panel is
               open, so the row re-reads rather than trusting what it painted at build. */
            if (access && !excludedByProfile) {
                document.addEventListener('imdb-enhanced:permissions-changed', paintAccess);
                registerCleanup(() => document.removeEventListener('imdb-enhanced:permissions-changed', paintAccess));
            }

            input.addEventListener('change', async () => {
                const enabled = input.checked;
                if (!trySaveSetting(feature.key, enabled)) {
                    input.checked = !enabled;
                    paintAccess();
                    return;
                }
                if (enabled && shouldInitFeature(feature)) {
                    startFeature(feature, { context:'settings', notify:true });
                } else if (!enabled) {
                    stopFeature(feature);
                    // Hand back what nothing else still needs, so a disabled feature
                    // stops being a standing grant.
                    releaseFeatureOrigins(feature.key);
                }
                (FEATURE_DEPENDENTS[feature.key] || []).forEach(refreshFeature);
                paintAccess();
                markSaved();
            });
            toggle.append(input, makeEl('span', { className:'enh-toggle-track' }));
            row.appendChild(toggle);
            return row;
        };
        /* tvEpisodeTools reads spoilerBlur at run time to decide whether to blur
           episode synopses, so toggling that setting has to restart it — otherwise the
           change only appears after a reload. */
        const FEATURE_DEPENDENTS = {
            spoilerBlur:['tvEpisodeTools'],
            // Both read watchedMarking at init and render nothing without it.
            watchedMarking:['markFilters', 'seasonProgress', 'markLinkTint'],
        };
        const makeFeatureCard = (title, description, badge, keys, compact = false) => {
            const card = makeCard(title, description, badge);
            if (compact) card.classList.add('enh-settings-card--compact');
            keys.map(key => features.find(feature => feature.key === key)).filter(Boolean).forEach(feature => card.appendChild(makeFeatureRow(feature)));
            return card;
        };
        const makeFeatureSummaryCard = (title, description, badge, key) => {
            const feature = features.find(item => item.key === key);
            const card = makeCard(title, description, '');
            const row = makeFeatureRow(feature);
            const toggle = row.querySelector('.enh-toggle');
            const actions = makeEl('div', { className:'enh-settings-card-actions' },
                makeEl('span', { className:'enh-settings-route-badge' }, badge), toggle
            );
            card.querySelector('.enh-settings-card-header').appendChild(actions);
            return card;
        };

        pageMeta.forEach(meta => {
            const button = makeEl('button', {
                type:'button',
                className:'enh-settings-nav-btn',
                id:`enh-settings-tab-${meta.id}`,
                role:'tab',
                dataset:{ settingsPage:meta.id },
                'aria-controls':`enh-settings-page-${meta.id}`,
                'aria-selected':'false',
                onClick: () => showPage(meta.id),
            }, meta.label);
            button.addEventListener('keydown', event => {
                const buttons = Array.from(nav.querySelectorAll('.enh-settings-nav-btn'));
                const current = buttons.indexOf(button);
                let next = null;
                if (event.key === 'ArrowDown') next = (current + 1) % buttons.length;
                if (event.key === 'ArrowUp') next = (current - 1 + buttons.length) % buttons.length;
                if (event.key === 'Home') next = 0;
                if (event.key === 'End') next = buttons.length - 1;
                if (next === null) return;
                event.preventDefault();
                buttons[next].click();
                buttons[next].focus();
            });
            nav.appendChild(button);
            makePage(meta);
        });

        const experiencePage = pages.get('experience');
        experiencePage.classList.add('enh-settings-page--experience');
        const themeCard = makeCard(t('settings_heading_appearance'), t('settings_choose_the_tonal_base_for_imdb_enhanced'));
        const themeSelector = makeEl('div', { className:'enh-theme-selector' });
        const curTheme = getActiveThemeId();
        [
            { id:'dark', color:'#101014', label:t('label_dark') },
            { id:'oled', color:'#000000', label:t('label_oled') },
            { id:'midnight', color:'#0a0e1c', label:t('label_midnight') },
            { id:'light', color:'#f6f7f9', label:t('label_light') },
            { id:'highContrast', color:'linear-gradient(135deg,#000 0 42%,#ffd400 42% 62%,#fff 62%)', label:t('label_high_contrast') },
        ].forEach(theme => {
            const swatch = makeEl('button', {
                type:'button',
                className:'enh-theme-swatch' + (curTheme === theme.id ? ' active' : ''),
                style:{ background:theme.color },
                dataset:{ label:theme.label, theme:theme.id },
                title:theme.label,
                'aria-label':t('aria_use_theme', [theme.label]),
                'aria-pressed':String(curTheme === theme.id),
                onClick: () => {
                    try { applySettingsImport([
                        { key:'themeAuto', value:false },
                        { key:'themeVariant', value:theme.id },
                    ]); }
                    catch {
                        showToast(t('toast_could_not_save_the_theme_previous'), 4500);
                        return;
                    }
                    applyThemeStyles();
                    markSaved();
                },
            });
            themeSelector.appendChild(makeEl('div', { className:'enh-theme-option' }, swatch, makeEl('span', {}, theme.label)));
        });
        themeCard.appendChild(themeSelector);
        const autoThemeRow = makeEl('div', { className:'enh-settings-row enh-theme-auto-row' },
            makeEl('div', { className:'enh-settings-row-copy' },
                makeEl('span', { className:'enh-settings-label' }, t('aria_follow_system_theme')),
                makeEl('span', { className:'enh-settings-help' }, t('text_uses_light_for_os_light_mode_and'))
            )
        );
        const autoThemeToggle = makeEl('label', { className:'enh-toggle' });
        const autoThemeInput = makeEl('input', { id:'enh-theme-auto', type:'checkbox', 'aria-label':t('aria_follow_system_theme') });
        autoThemeInput.checked = get('themeAuto');
        autoThemeInput.addEventListener('change', () => {
            const enabled = autoThemeInput.checked;
            if (!trySaveSetting('themeAuto', enabled)) {
                autoThemeInput.checked = !enabled;
                return;
            }
            applyThemeStyles();
            markSaved();
        });
        autoThemeToggle.append(autoThemeInput, makeEl('span', { className:'enh-toggle-track' }));
        autoThemeRow.appendChild(autoThemeToggle);
        themeCard.appendChild(autoThemeRow);
        experiencePage.appendChild(themeCard);
        const experienceGrid = makeEl('div', { className:'enh-settings-grid enh-settings-grid--experience', style:{ marginTop:'12px' } });
        experienceGrid.appendChild(makeFeatureCard(t('settings_clean_up'), t('settings_remove_noise_so_you_can_focus_on'), t('settings_all_pages'), [
            'removeAds', 'removeProUpsell', 'removeNewsSection', 'removeRelatedInterests',
            'removeContribution', 'removeSponsoredRecs', 'removeAppBanner', 'removeFeaturedReview',
        ], true));
        experienceGrid.appendChild(makeFeatureCard(t('settings_tune_the_interface'), t('settings_refine_how_content_looks_and_is_presented'), 'Desktop', [
            'modernUI', 'editorialTitleSurface', 'compactHeader', 'enhancedRatingDisplay', 'widerLayout', 'ratingColorCoding',
            'collapsibleSections', 'expandSummaries', 'spoilerBlur', 'quickNav', 'dimLowRated', 'imageZoom',
            'restoreImageContextMenu',
        ], true));
        experiencePage.appendChild(experienceGrid);
        /* The threshold belongs with the toggle it qualifies. Changing it restarts the
           feature so the page repaints, rather than waiting for a reload. */
        const dimThreshold = makeEl('select', {
            className:'enh-servarr-input',
            id:'enh-dim-threshold',
            'aria-label':t('aria_dim_titles_rated_below'),
            onChange: event => {
                const value = normalizeDimThreshold(event.target.value);
                event.target.value = value;
                if (!trySaveSetting('dimRatingThreshold', value)) return;
                refreshFeature('dimLowRated');
                markSaved();
            },
        }, ...DIM_THRESHOLD_OPTIONS.map(option => makeEl('option', { value:option }, option)));
        dimThreshold.value = normalizeDimThreshold(get('dimRatingThreshold'));
        experiencePage.appendChild(makeEl('div', { className:'enh-settings-callout' },
            makeEl('strong', {}, t('aria_dim_titles_rated_below')),
            dimThreshold,
            makeEl('span', { className:'enh-settings-card-description' },
                t('settings_applies_when_dim_low_rated_titles_is'))
        ));

        /* The two availability sources answer the same question by different means, so
           the choice belongs beside the toggle rather than buried with the integrations.
           The token is a credential like any other, which is what keeps it out of the
           page's reach in an extension build. */
        /* Which services are worth interrupting someone for. The list is what the
           scheduled checks have walked past in this region rather than a set of names
           written into this file, so on the first day it is empty and says why. */
        function createWatchlistAlertControl() {
            if (!IS_EXTENSION_BUILD) return null;
            const card = makeCard(t('settings_heading_watchlist_alerts'), t('settings_watchlist_alerts_note'));
            card.appendChild(makeEl('div', { className:'enh-settings-card-description' }, t('settings_watchlist_alerts_pace')));
            const list = makeEl('div', { className:'enh-settings-card-description' });
            const render = () => {
                list.replaceChildren();
                const choices = getWatchlistServiceChoices();
                if (!choices.length) {
                    list.appendChild(makeEl('span', {}, t('settings_watchlist_services_pending')));
                    return;
                }
                const chosen = new Set(getWatchlistServices());
                choices.forEach(name => {
                    const input = makeEl('input', {
                        type:'checkbox',
                        checked: chosen.has(name),
                        onChange: event => {
                            const next = new Set(getWatchlistServices());
                            if (event.target.checked) next.add(name);
                            else next.delete(name);
                            set('watchlistAlertServices', [...next]);
                            markSaved();
                        },
                    });
                    list.appendChild(makeEl('label', { className:'enh-settings-inline-choice' }, input, makeEl('span', {}, name)));
                });
            };
            render();
            card.appendChild(list);
            /* The permission has to be asked for from one of the extension's own pages,
               because a request needs a gesture there; the alarm has none. */
            card.appendChild(makeEl('button', {
                type:'button',
                className:'enh-settings-footer-btn',
                style:{ marginTop:'10px' },
                onClick: async () => {
                    if (await openOptionsPage()) showToast(t('toast_allow_notifications_there'), 5000);
                },
            }, t('settings_allow_notifications')));
            return card;
        }

        function createAvailabilitySourceControl() {
            const select = makeEl('select', {
                className:'enh-servarr-input',
                id:'enh-availability-source',
                'aria-label':t('aria_where_streaming_availability_comes_from'),
                onChange: event => {
                    const value = event.target.value === 'tmdb' ? 'tmdb' : 'justwatch';
                    event.target.value = value;
                    if (!trySaveSetting('availabilitySource', value)) return;
                    tokenField.hidden = value !== 'tmdb';
                    refreshFeature('streamAvailability');
                    markSaved();
                },
            },
                makeEl('option', { value:'justwatch' }, t('text_justwatch_reads_their_page')),
                makeEl('option', { value:'tmdb' }, t('text_tmdb_their_api_needs_your_token'))
            );
            select.value = getAvailabilitySource();
            const tokenField = createSettingsInput({
                key:'tmdbReadToken',
                label:t('settings_tmdb_read_access_token'),
                placeholder:t('field_paste_your_v4_read_access_token'),
                refreshKey:'streamAvailability',
                wide:true,
            });
            tokenField.hidden = getAvailabilitySource() !== 'tmdb';
            /* Two letters, because that is what TMDB keys its results by. Free text rather
               than a list of every country: the list would be another thing to keep in step
               with theirs, and an unrecognized code already falls back to US. */
            const regionField = createSettingsInput({
                key:'availabilityRegion',
                label:t('label_region'),
                placeholder:t('field_two_letter_country_code_such_as'),
                refreshKey:'streamAvailability',
            });
            return makeEl('div', { className:'enh-settings-callout' },
                makeEl('strong', {}, t('settings_where_availability_comes_from')),
                select,
                makeEl('span', { className:'enh-settings-card-description' },
                    t('settings_both_sources_use_the_two_letter_region')),
                tokenField,
                regionField
            );
        }

        const ratingsPage = pages.get('ratings');
        const previewCard = makeCard(t('settings_heading_preview'), t('settings_sample_source_values_not_live_title_data'));
        const preview = makeEl('div', { className:'enh-score-preview' });
        [
            ['8.7 /10', 'IMDb'], ['88%', t('settings_rotten_tomatoes')], ['4.2 /5', 'Letterboxd'], ['73 /100', 'Metacritic'], ['4 services', 'Streaming'],
        ].forEach(([value, label]) => preview.appendChild(makeEl('div', { className:'enh-score-preview-item' },
            makeEl('div', { className:'enh-score-preview-value' }, value),
            makeEl('div', { className:'enh-score-preview-label' }, label)
        )));
        previewCard.appendChild(preview);
        ratingsPage.append(previewCard,
            makeEl('div', { style:{ marginTop:'12px' } }, makeFeatureCard(t('settings_heading_score_sources'), t('settings_choose_which_ratings_and_availability'), t('settings_title_pages'), [
                'ratingGap', 'inlineRTScore', 'inlineLetterboxdScore', 'inlineMetacriticScore', 'inlineAnimeScore', 'streamAvailability',
            ])),
            createAvailabilitySourceControl(),
            createWatchlistAlertControl(),
            makeEl('div', { className:'enh-settings-callout', style:{ marginTop:'12px' } },
                makeEl('strong', {}, t('settings_rotten_tomatoes_and_metacritic_through_omdb')),
                makeEl('span', { className:'enh-settings-card-description' },
                    IS_STORE_BUILD
                        ? t('settings_this_build_does_not_read_rotten_tomatoes')
                        : t('settings_optional_scores_normally_come_from_reading_each')),
                createSettingsInput({
                    key:'omdbApiKey',
                    label:t('settings_omdb_api_key'),
                    placeholder:t('field_paste_your_omdb_key'),
                    refreshKey:['inlineRTScore', 'inlineMetacriticScore'],
                    wide:true,
                })
            ),
            makeEl('div', { className:'enh-settings-callout', style:{ marginTop:'12px' } },
                makeEl('strong', {}, t('label_privacy')),
                t('settings_fetched_only_on_imdb_title_pages_responses')
            )
        );

        const toolsPage = pages.get('tools');
        toolsPage.appendChild(makeEl('div', { className:'enh-settings-grid enh-settings-grid--three' },
            makeFeatureCard(t('settings_title_tools'), t('settings_actions_placed_near_a_movie_or_show'), t('settings_title_pages'), [
                'searchButtons', 'externalLinks', 'trailerPopover', 'expandedLinkMenu', 'watchedMarking', 'markLinkTint', 'titleNotes',
                'movieChatBoard', 'collectionPanel',
            ]),
            makeFeatureCard(t('settings_tv_episodes'), t('settings_focused_tools_for_series_and_episode_lists'), 'TV', [
                'tvEpisodeTools', 'tvShowEnhancements', 'subtitleLinks', 'episodeSubtitles',
                'episodeHeatmap', 'seasonProgress', 'airsOn',
            ]),
            makeFeatureCard(t('settings_lists_shortcuts'), t('settings_batch_actions_and_quick_navigation'), 'Lists', [
                'watchlistBatch', 'listMultiSearch', 'listRuntimeSummary', 'markFilters', 'listRoulette',
                'quickCopyID', 'keyboardShortcuts', 'watchlistAlerts',
            ]),
            makeFeatureCard(t('settings_heading_people'), t('settings_additions_to_cast_and_crew_pages'), t('settings_name_pages'), [
                'castAges',
            ])
        ));
        /* The redirect this switches runs at document-start on IMDb's mobile host, before
           any feature is initialized and on a page the registry never reaches, so it is
           not a registered feature and cannot be one. It still needs somewhere to be
           turned off: the setting existed, the README said you could switch it off, and
           the only way to actually do it was to hand-edit a settings backup and import it. */
        const mobileCard = makeCard(t('settings_heading_mobile_links'), t('settings_desktop_from_mobile_help'));
        const mobileRow = makeEl('div', { className:'enh-settings-row' },
            makeEl('div', { className:'enh-settings-row-copy' },
                makeEl('span', { className:'enh-settings-label' }, t('aria_open_mobile_links_on_the_desktop_site'))
            )
        );
        const mobileToggle = makeEl('label', { className:'enh-toggle' });
        const mobileInput = makeEl('input', {
            id:'enh-desktop-from-mobile-toggle',
            type:'checkbox',
            'aria-label':t('aria_open_mobile_links_on_the_desktop_site'),
        });
        mobileInput.checked = get('desktopFromMobileLinks') !== false;
        mobileInput.addEventListener('change', () => {
            const enabled = mobileInput.checked;
            if (!trySaveSetting('desktopFromMobileLinks', enabled)) {
                mobileInput.checked = !enabled;
                return;
            }
            markSaved();
        });
        mobileToggle.append(mobileInput, makeEl('span', { className:'enh-toggle-track' }));
        mobileRow.appendChild(mobileToggle);
        mobileCard.appendChild(mobileRow);
        toolsPage.appendChild(mobileCard);

        toolsPage.appendChild(makeEl('div', { className:'enh-settings-callout', style:{ justifyContent:'center' } },
            makeEl('strong', {}, t('settings_when_optional_keyboard_shortcuts_is_enabled')),
            makeEl('span', { className:'enh-settings-kbd' }, '?'), 'Open settings',
            makeEl('span', { className:'enh-settings-kbd', style:{ marginLeft:'20px' } }, 'C'), 'Copy IMDb ID'
        ));

        const sitesPage = pages.get('sites');
        sitesPage.appendChild(makeEl('div', { className:'enh-settings-callout' },
            makeEl('strong', {}, t('settings_fmhy_catalog')),
            t('settings_watch_stream_includes_a_built_in_catalog')
        ));
        const sitesGrid = makeEl('div', { className:'enh-sites-grid enh-sites-grid--single', style:{ marginTop:'12px' } },
            createSiteEditor({ title:t('settings_watch_stream'), key:'watchSites', defaults:DEFAULT_WATCH_SITES, featureKey:'searchButtons', catalog:FMHY_WATCH_CATALOG }, registerCleanup),
            createSiteEditor({ title:t('settings_research_reviews'), key:'externalSites', defaults:DEFAULT_EXTERNAL_SITES, featureKey:'externalLinks' }, registerCleanup)
        );
        sitesPage.append(sitesGrid, makeEl('div', { className:'enh-settings-callout' },
            makeEl('strong', {}, t('label_templates')),
            'URL templates support {{TITLE}}, {{IMDB_ID}}, {{YEAR}}, and the tokens documented in the README. Categories include Watch, Reviews & ratings, Availability, Trailers & video, Info & research, and Other.'
        ));

        const integrationsPage = pages.get('integrations');
        integrationsPage.appendChild(makeEl('div', { className:'enh-integration-summary' },
            makeFeatureSummaryCard(t('feature_servarrIntegration_name'), t('settings_add_movies_to_radarr_and_shows_to'), 'Local', 'servarrIntegration'),
            makeFeatureSummaryCard(t('settings_media_server_indicator'), t('settings_check_plex_jellyfin_and_emby_libraries'), 'Local', 'mediaServerIntegration')
        ));
        integrationsPage.appendChild(makeEl('div', { className:'enh-settings-callout' },
            makeEl('strong', {}, t('settings_private_by_design')),
            t('settings_requests_go_directly_from_your_browser_to')
        ));
        const integrationGrid = makeEl('div', { className:'enh-integration-grid', style:{ marginTop:'12px' } });
        const servarrCard = makeCard(t('settings_radarr_sonarr'), t('settings_configure_local_quick_add_destinations'));
        servarrCard.classList.add('enh-integration-card');
        servarrCard.appendChild(createServarrSettingsPanel());
        const mediaCard = makeCard(t('settings_media_servers'), t('settings_configure_local_library_checks'));
        mediaCard.classList.add('enh-integration-card');
        mediaCard.appendChild(createMediaServerSettingsPanel());
        integrationGrid.append(servarrCard, mediaCard);
        integrationsPage.appendChild(integrationGrid);

        const dataPage = pages.get('data');
        const dataSummary = makeEl('div', { className:'enh-data-summary' },
            makeEl('div', { className:'enh-data-summary-item' },
                makeEl('div', { className:'enh-data-summary-label' }, t('label_preferences')),
                makeEl('div', { className:'enh-data-summary-value' }, t('label_stored_locally'))
            ),
            makeEl('div', { className:'enh-data-summary-item' },
                makeEl('div', { className:'enh-data-summary-label' }, t('label_private_marks')),
                makeEl('div', { className:'enh-data-summary-value', id:'enh-data-marks-count' }, `${getUserMarkEntries().length} titles`)
            ),
            makeEl('div', { className:'enh-data-summary-item' },
                makeEl('div', { className:'enh-data-summary-label' }, t('label_score_cache')),
                makeEl('div', { className:'enh-data-summary-value', id:'enh-data-cache-count' },
                    `${cacheCount()} cached entries · ${formatCacheBytes(cacheBytes())}`)
            )
        );
        dataPage.appendChild(dataSummary);
        dataPage.appendChild(createLocalStatsPanel(registerCleanup));
        const importPanel = makeEl('div', { className:'enh-import-panel', id:'enh-import-panel', hidden:'hidden' },
            makeEl('label', { className:'enh-import-label', for:'enh-import-textarea' }, t('text_paste_exported_settings_json')),
            makeEl('textarea', {
                id:'enh-import-textarea', className:'enh-import-textarea', spellcheck:'false', maxlength:String(SETTINGS_IMPORT_TEXT_LIMIT),
                placeholder:t('field_modernui_true_themevariant_dark'),
            }),
            /* Revealed only when the pasted text turns out to be an encrypted envelope,
               so the ordinary paste-and-import path gains no extra field. */
            makeEl('div', { className:'enh-backup-passphrase', id:'enh-import-passphrase-row', hidden:'hidden' },
                makeEl('label', { className:'enh-import-label', for:'enh-import-passphrase' },
                    t('settings_this_backup_is_encrypted_enter_its_passphrase')),
                makeEl('input', {
                    type:'password', id:'enh-import-passphrase', className:'enh-servarr-input',
                    autocomplete:'off', spellcheck:'false', maxlength:'256',
                })
            ),
            makeEl('div', { className:'enh-import-actions' },
                makeEl('button', { type:'button', className:'enh-settings-footer-btn', id:'enh-import-apply' }, t('label_apply_import')),
                makeEl('button', { type:'button', className:'enh-settings-footer-btn', id:'enh-import-cancel' }, t('recovery_cancel'))
            )
        );
        const securePanel = makeEl('div', { className:'enh-import-panel', id:'enh-secure-export-panel', hidden:'hidden' },
            makeEl('div', { className:'enh-import-label' }, t('text_encrypted_backup_with_credentials')),
            makeEl('div', { className:'enh-settings-card-description' },
                t('settings_choose_a_passphrase_the_backup_is_encrypted')
            ),
            makeEl('div', { className:'enh-backup-passphrase' },
                makeEl('label', { className:'enh-import-label', for:'enh-secure-passphrase' }, t('recovery_passphrase')),
                makeEl('input', {
                    type:'password', id:'enh-secure-passphrase', className:'enh-servarr-input',
                    autocomplete:'new-password', spellcheck:'false', maxlength:'256',
                }),
                makeEl('label', { className:'enh-import-label', for:'enh-secure-passphrase-confirm' }, t('recovery_repeat_passphrase')),
                makeEl('input', {
                    type:'password', id:'enh-secure-passphrase-confirm', className:'enh-servarr-input',
                    autocomplete:'new-password', spellcheck:'false', maxlength:'256',
                })
            ),
            makeEl('div', { className:'enh-import-actions' },
                makeEl('button', { type:'button', className:'enh-settings-footer-btn', id:'enh-secure-export-apply' }, t('recovery_encrypt_and_copy')),
                makeEl('button', { type:'button', className:'enh-settings-footer-btn', id:'enh-secure-export-cancel' }, t('recovery_cancel'))
            )
        );
        const resetPanel = makeEl('div', {
            className:'enh-import-panel', id:'enh-reset-panel', hidden:'hidden', role:'alert',
        },
            makeEl('div', { className:'enh-import-label' }, t('label_reset_every_setting')),
            makeEl('div', { className:'enh-settings-card-description' },
                t('settings_this_clears_title_marks_and_local_integration')
            ),
            makeEl('div', { className:'enh-import-actions' },
                makeEl('button', {
                    type:'button', className:'enh-settings-footer-btn enh-settings-footer-btn--danger', id:'enh-reset-apply',
                }, t('settings_reset_everything')),
                makeEl('button', { type:'button', className:'enh-settings-footer-btn', id:'enh-reset-cancel' }, t('recovery_cancel'))
            )
        );
        let pendingCsvImport = null;
        const csvTextarea = makeEl('textarea', {
            id:'enh-csv-textarea', className:'enh-import-textarea', spellcheck:'false',
            /* The marks ceiling, not the settings one. At 4 MB a full library was
               refused at the door, and a paste over the limit was truncated by the
               browser and then reported as a successful partial import. */
            maxlength:String(CSV_IMPORT_TEXT_LIMIT),
            placeholder:t('field_const_your_rating_date_rated_title'),
        });
        const csvFile = makeEl('input', {
            type:'file', id:'enh-csv-file', className:'enh-csv-file', accept:'.csv,text/csv',
            'aria-label':t('aria_choose_an_imdb_or_letterboxd_csv'),
        });
        const csvPreview = makeEl('div', {
            className:'enh-csv-preview', id:'enh-csv-preview', role:'status', 'aria-live':'polite',
        }, t('settings_paste_csv_data_or_choose_a_file'));
        const csvApply = makeEl('button', {
            type:'button', className:'enh-settings-footer-btn', id:'enh-csv-apply', disabled:'disabled',
        }, t('settings_import_preview'));
        const resetCsvPreview = () => {
            pendingCsvImport = null;
            csvApply.disabled = true;
            csvPreview.textContent = t('text_preview_required_nothing_has_been_changed');
        };
        const previewCsv = () => {
            try {
                pendingCsvImport = prepareCsvMarkImport(csvTextarea.value, getUserMarks(true));
                csvPreview.textContent = describeCsvMarkImport(pendingCsvImport);
                csvApply.disabled = !pendingCsvImport.importedRows;
            } catch (error) {
                pendingCsvImport = null;
                csvApply.disabled = true;
                csvPreview.textContent = error.message || t('settings_csv_could_not_be_read');
            }
        };
        csvTextarea.addEventListener('input', resetCsvPreview);
        csvFile.addEventListener('change', async () => {
            const file = csvFile.files?.[0];
            if (!file) return;
            if (file.size > CSV_IMPORT_TEXT_LIMIT) {
                resetCsvPreview();
                csvPreview.textContent = t('text_csv_import_is_too_large_choose', [CSV_IMPORT_TEXT_MB]);
                return;
            }
            try {
                csvTextarea.value = await file.text();
                previewCsv();
            } catch {
                resetCsvPreview();
                csvPreview.textContent = t('text_the_selected_file_could_not_be');
            }
        });
        const csvPreviewButton = makeEl('button', {
            type:'button', className:'enh-settings-footer-btn', id:'enh-csv-preview-btn', onClick:previewCsv,
        }, t('settings_preview_csv'));
        csvApply.addEventListener('click', () => {
            if (!pendingCsvImport) { showToast(t('toast_preview_the_csv_before_importing')); return; }
            csvApply.disabled = true;
            try {
                // Re-merge against storage at the moment of the write. A preview left
                // open in one tab must not erase marks saved from another tab meanwhile.
                const prepared = prepareCsvMarkImport(csvTextarea.value, getUserMarks(true));
                if (!prepared.importedRows) throw failure('unknown', t('settings_no_importable_rows_were_found_nothing_was'));
                applySettingsImport([{ key:'userMarks', value:prepared.marks }]);
                document.dispatchEvent(new CustomEvent('imdb-enhanced:marks-updated'));
                const skipped = prepared.skippedRows ? ` ${prepared.skippedRows} rows were skipped.` : '';
                showToast(t('toast_imported_local_titles_from_csv_rows', [prepared.importedTitles, prepared.importedRows, skipped]), 5000);
                setTimeout(() => location.reload(), 1000);
            } catch (error) {
                csvApply.disabled = false;
                showToast(error.message || t('settings_csv_import_failed_previous_marks_were_restored'), 5000);
            }
        });
        const csvImportCard = makeCard(t('settings_import_viewing_history'),
            t('settings_imdb_and_letterboxd_exports_become_local_seen'));
        csvImportCard.append(
            makeEl('div', { className:'enh-settings-card-description' },
                t('settings_rows_should_carry_const_or_imdbid_a')),
            makeEl('label', { className:'enh-import-label', for:'enh-csv-file', style:{ marginTop:'10px' } }, t('label_choose_csv_file')),
            csvFile,
            makeEl('label', { className:'enh-import-label', for:'enh-csv-textarea', style:{ marginTop:'10px' } }, t('label_or_paste_csv_data')),
            csvTextarea,
            csvPreview,
            makeEl('div', { className:'enh-import-actions' }, csvPreviewButton, csvApply)
        );
        /* The marks as a spreadsheet, and as the two columns Letterboxd's importer
           reads. A backup is for coming back here; this is for leaving, which is a
           different thing and the one people actually asked for. */
        const marksCsvCard = makeCard(t('settings_heading_export_marks'), t('settings_export_marks_note'));
        const copyCsv = (build, label) => async () => {
            const csv = build(getUserMarkEntries());
            // The header is always there; what matters is whether anything followed it.
            const rows = csv.split('\r\n').length - 1;
            if (!rows) { showToast(t('toast_no_marks_to_export'), 3000); return; }
            if (!copyTextToClipboard(csv)) { showToast(COPY_FAILURE_MESSAGE, 4500); return; }
            showToast(t('toast_marks_copied', [label, rows]), 3000);
        };
        const downloadCsv = (build, filename) => () => {
            const csv = build(getUserMarkEntries());
            if (csv.split('\r\n').length - 1 === 0) { showToast(t('toast_no_marks_to_export'), 3000); return; }
            /* A BOM, because the single most likely destination is Excel, which reads a
               UTF-8 file without one as the local code page and turns every non-ASCII
               title into mojibake. Every other reader, including this extension's own
               importer, skips it. */
            const blob = new Blob([`\uFEFF${csv}`], { type:'text/csv;charset=utf-8' });
            const href = URL.createObjectURL(blob);
            const link = makeEl('a', { href, download:filename });
            document.body.appendChild(link);
            link.click();
            link.remove();
            // Released on the next turn so the download has taken the reference.
            setTimeout(() => URL.revokeObjectURL(href), 0);
        };
        marksCsvCard.appendChild(makeEl('div', { className:'enh-data-actions' },
            makeEl('button', {
                type:'button', className:'enh-settings-footer-btn', id:'enh-export-marks-csv',
                title:t('settings_export_marks_full_hint'),
                onClick: copyCsv(buildMarksCsv, t('settings_export_marks_full')),
            }, t('settings_export_marks_full')),
            makeEl('button', {
                type:'button', className:'enh-settings-footer-btn', id:'enh-export-marks-letterboxd',
                title:t('settings_export_marks_letterboxd_hint'),
                onClick: copyCsv(buildLetterboxdCsv, t('settings_export_marks_letterboxd')),
            }, t('settings_export_marks_letterboxd')),
            makeEl('button', {
                type:'button', className:'enh-settings-footer-btn', id:'enh-download-marks-csv',
                title:t('settings_download_marks_hint'),
                onClick: downloadCsv(buildMarksCsv, 'imdb-enhanced-marks.csv'),
            }, t('settings_download_marks')),
            makeEl('button', {
                type:'button', className:'enh-settings-footer-btn', id:'enh-download-marks-letterboxd',
                title:t('settings_download_marks_letterboxd_hint'),
                onClick: downloadCsv(buildLetterboxdCsv, 'letterboxd-import.csv'),
            }, t('settings_download_marks_letterboxd'))
        ));
        dataPage.appendChild(marksCsvCard);

        const backupCard = makeCard(t('settings_backup_restore'), t('settings_a_backup_covers_preferences_sites_and_title'));
        backupCard.appendChild(makeEl('div', { className:'enh-data-actions' },
            makeEl('button', { type:'button', className:'enh-settings-footer-btn', id:'enh-export-btn', title:t('text_copy_settings_to_the_clipboard_without_integration') }, t('label_export_settings')),
            makeEl('button', {
                type:'button', className:'enh-settings-footer-btn', id:'enh-secure-export-btn',
                title:t('settings_copy_a_passphrase_encrypted_backup_that'),
                'aria-controls':'enh-secure-export-panel', 'aria-expanded':'false',
            }, t('settings_export_with_credentials')),
            makeEl('button', {
                type:'button', className:'enh-settings-footer-btn', id:'enh-import-btn', title:t('text_import_settings_from_json'),
                'aria-controls':'enh-import-panel', 'aria-expanded':'false',
            }, t('settings_import_settings')),
            makeEl('button', {
                type:'button', className:'enh-settings-footer-btn enh-settings-footer-btn--danger',
                id:'enh-reset-btn', title:t('text_reset_preferences_title_marks_and_integration'),
                'aria-controls':'enh-reset-panel', 'aria-expanded':'false',
            }, t('settings_reset_all_settings'))
        ));
        backupCard.appendChild(importPanel);
        backupCard.appendChild(securePanel);
        backupCard.appendChild(resetPanel);
        const journalCard = makeCard(t('settings_failure_journal'),
            t('settings_the_last_20_feature_failures_kept_across'));
        journalCard.append(
            makeEl('pre', { className:'enh-journal', id:'enh-journal-body', tabindex:'0', role:'group', 'aria-label':t('aria_recorded_failures') },
                formatFailureJournal()),
            makeEl('div', { className:'enh-data-actions', style:{ marginTop:'10px' } },
                makeEl('button', { type:'button', className:'enh-settings-footer-btn', id:'enh-journal-copy' }, t('label_copy_journal')),
                makeEl('button', { type:'button', className:'enh-settings-footer-btn', id:'enh-journal-clear' }, t('label_clear_journal'))
            )
        );
        const cacheCard = makeCard(t('settings_cached_lookups'), t('settings_scores_and_availability_lookups_are_cached'));
        cacheCard.append(
            makeEl('button', { type:'button', className:'enh-settings-footer-btn', id:'enh-clearcache-btn', title:t('text_clear_cached_third_party_lookups') }, t('label_clear_cache')),
            makeEl('div', { className:'enh-settings-card-description', id:'enh-cache-status', style:{ marginTop:'8px' } },
                `${cacheCount()} entries currently cached, using ${formatCacheBytes(cacheBytes())} of ${formatCacheBytes(CACHE_TOTAL_BYTE_BUDGET)}. The oldest are dropped automatically as that fills.`)
        );
        /* Only the extension builds can be stale — the userscript updates through its
           manager — so the control exists only where it means something. */
        if (IS_EXTENSION_BUILD) {
            const updateCard = makeCard(t('settings_heading_updates'), t('settings_this_build_cannot_update_itself_so_it'));
            const updateRow = makeEl('div', { className:'enh-settings-row' },
                makeEl('div', { className:'enh-settings-row-copy' },
                    makeEl('span', { className:'enh-settings-label' }, t('aria_tell_me_about_new_versions')),
                    makeEl('span', { className:'enh-settings-help' }, t('text_reads_the_published_version_once_a_day'))
                )
            );
            const updateToggle = makeEl('label', { className:'enh-toggle' });
            const updateInput = makeEl('input', { id:'enh-update-notice-toggle', type:'checkbox', 'aria-label':t('aria_tell_me_about_new_versions') });
            updateInput.checked = get('updateNotice') !== false;
            updateInput.addEventListener('change', () => {
                const enabled = updateInput.checked;
                if (!trySaveSetting('updateNotice', enabled)) {
                    updateInput.checked = !enabled;
                    return;
                }
                if (!enabled) document.getElementById('enh-update-notice')?.remove();
                markSaved();
            });
            updateToggle.append(updateInput, makeEl('span', { className:'enh-toggle-track' }));
            updateRow.appendChild(updateToggle);
            updateCard.appendChild(updateRow);
            dataPage.appendChild(updateCard);
        }

        const diagnosticsCard = makeCard(t('settings_heading_diagnostics'), t('settings_a_readable_summary_for_bug_reports_credentials'));
        diagnosticsCard.append(
            makeEl('button', {
                type:'button', className:'enh-settings-footer-btn', id:'enh-diagnostics-btn',
                title:t('settings_copy_a_scrubbed_diagnostics_report_to_the'),
                onClick: () => {
                    const report = buildDiagnosticsReport();
                    showToast(copyTextToClipboard(report)
                        ? t('settings_diagnostics_copied_paste_it_into_your_report')
                        : COPY_FAILURE_MESSAGE, 4000);
                },
            }, t('settings_copy_diagnostics')),
            makeEl('div', { className:'enh-settings-card-description', id:'enh-diagnostics-status', style:{ marginTop:'8px' } },
                t('settings_nothing_is_transmitted_the_report_only_reaches'))
        );
        dataPage.appendChild(makeEl('div', { className:'enh-settings-grid' },
            createMarksPanel(registerCleanup),
            makeEl('div', { className:'enh-settings-stack' }, csvImportCard, backupCard, cacheCard, journalCard, diagnosticsCard)
        ));
        dataPage.appendChild(makeEl('div', { className:'enh-settings-callout' },
            makeEl('strong', {}, t('settings_local_only')),
            t('settings_nothing_is_sent_to_an_imdb_enhanced')
        ));

        const setDataDisclosureState = openPanel => {
            const importOpen = openPanel === 'import';
            const resetOpen = openPanel === 'reset';
            const secureOpen = openPanel === 'secure-export';
            importPanel.hidden = !importOpen;
            resetPanel.hidden = !resetOpen;
            securePanel.hidden = !secureOpen;
            overlay.querySelector('#enh-import-btn').setAttribute('aria-expanded', String(importOpen));
            overlay.querySelector('#enh-reset-btn').setAttribute('aria-expanded', String(resetOpen));
            overlay.querySelector('#enh-secure-export-btn').setAttribute('aria-expanded', String(secureOpen));
            // A passphrase must not survive its panel closing, the way pasted JSON does not.
            if (!secureOpen) {
                overlay.querySelector('#enh-secure-passphrase').value = '';
                overlay.querySelector('#enh-secure-passphrase-confirm').value = '';
            }
            if (!importOpen) {
                overlay.querySelector('#enh-import-passphrase').value = '';
                overlay.querySelector('#enh-import-passphrase-row').hidden = true;
            }
        };

        overlay.querySelector('.enh-settings-close').addEventListener('click', toggleSettings);
        overlay.addEventListener('click', event => { if (event.target === overlay) toggleSettings(); });
        overlay.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                if (settingsOpen) toggleSettings();
                return;
            }
            if (event.key !== 'Tab') return;
            const focusables = getFocusableElements(overlay);
            if (!focusables.length) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        });
        const containSettingsFocus = event => {
            if (!settingsOpen || overlay.contains(event.target)) return;
            const activeTab = overlay.querySelector(`.enh-settings-nav-btn[data-settings-page="${activeSettingsPage}"]`);
            (activeTab || getFocusableElements(overlay)[0] || panel).focus();
        };
        document.addEventListener('focusin', containSettingsFocus);
        registerCleanup(() => document.removeEventListener('focusin', containSettingsFocus));
        overlay.querySelector('#enh-export-btn').addEventListener('click', () => {
            try {
                const payload = getExportSettings();
                const serialized = JSON.stringify(payload, null, 2);
                if (serialized.length > SETTINGS_IMPORT_TEXT_LIMIT) {
                    showToast(t('toast_settings_exceed_the_4_mb_backup'), 5000);
                    return;
                }
                const copied = copyTextToClipboard(serialized);
                if (!copied) { showToast(COPY_FAILURE_MESSAGE, 4500); return; }
                // Naming what was left out is the point: a silent omission is how someone
                // restores a backup and then wonders why Radarr stopped working.
                const omitted = payload[EXPORT_REDACTED_KEY] || [];
                showToast(omitted.length
                    ? tCount('toast_settings_copied_omitting', omitted.length)
                    : t('settings_settings_copied_to_clipboard'), omitted.length ? 6000 : 2500);
            } catch (error) {
                console.warn('[IMDb Enhanced] settings export failed:', error);
                showToast(t('toast_settings_could_not_be_read_for'), 4500);
            }
        });
        overlay.querySelector('#enh-secure-export-btn').addEventListener('click', () => {
            setDataDisclosureState('secure-export');
            requestAnimationFrame(() => {
                securePanel.scrollIntoView({ block:'nearest' });
                overlay.querySelector('#enh-secure-passphrase').focus();
            });
        });
        overlay.querySelector('#enh-secure-export-cancel').addEventListener('click', () => {
            setDataDisclosureState('');
            overlay.querySelector('#enh-secure-export-btn').focus();
        });
        overlay.querySelector('#enh-secure-export-apply').addEventListener('click', async () => {
            const apply = overlay.querySelector('#enh-secure-export-apply');
            const passphrase = overlay.querySelector('#enh-secure-passphrase').value;
            const confirmation = overlay.querySelector('#enh-secure-passphrase-confirm').value;
            if (passphrase !== confirmation) { showToast(t('toast_the_two_passphrases_do_not_match'), 4000); return; }
            apply.disabled = true;
            try {
                const serialized = await createEncryptedBackup(passphrase);
                if (serialized.length > SETTINGS_IMPORT_TEXT_LIMIT) {
                    showToast(t('toast_settings_exceed_the_4_mb_backup_2'), 5000);
                    return;
                }
                const copied = copyTextToClipboard(serialized);
                if (!copied) { showToast(COPY_FAILURE_MESSAGE, 4500); return; }
                setDataDisclosureState('');
                showToast(t('toast_encrypted_backup_copied_keep_the_passphrase'), 6000);
            } catch (error) {
                console.warn('[IMDb Enhanced] encrypted export failed:', error);
                /* The credentials are deliberately unreachable from an IMDb page, so this
                   backup cannot be made here. It used to be made anyway, carrying empty
                   strings, and restoring it wiped the real keys. */
                if (error?.message === 'CREDENTIALS_UNREADABLE') {
                    showToast(t('toast_your_integration_keys_are_not_readable'), 7000);
                    if (await openOptionsPage()) setDataDisclosureState('');
                    return;
                }
                showToast(error?.message || t('settings_the_encrypted_backup_could_not_be_created'), 5000);
            } finally { apply.disabled = false; }
        });
        overlay.querySelector('#enh-import-btn').addEventListener('click', () => {
            setDataDisclosureState('import');
            requestAnimationFrame(() => {
                importPanel.scrollIntoView({ block:'nearest' });
                overlay.querySelector('#enh-import-textarea').focus();
            });
        });
        overlay.querySelector('#enh-import-cancel').addEventListener('click', () => {
            setDataDisclosureState('');
            overlay.querySelector('#enh-import-textarea').value = '';
            overlay.querySelector('#enh-import-btn').focus();
        });
        overlay.querySelector('#enh-reset-btn').addEventListener('click', () => {
            setDataDisclosureState('reset');
            overlay.querySelector('#enh-import-textarea').value = '';
            requestAnimationFrame(() => overlay.querySelector('#enh-reset-apply').focus());
        });
        overlay.querySelector('#enh-reset-cancel').addEventListener('click', () => {
            setDataDisclosureState('');
            overlay.querySelector('#enh-reset-btn').focus();
        });
        overlay.querySelector('#enh-reset-apply').addEventListener('click', () => {
            try {
                const reset = applySettingsImport(getDefaultSettingsEntries());
                showToast(t('toast_reset_settings_reloading', [reset]));
                setTimeout(() => location.reload(), 1000);
            } catch (error) {
                showToast(error.message || t('settings_reset_failed_previous_settings_were_restored'), 4500);
            }
        });
        /* Reveal the passphrase field as soon as the pasted text is recognizable as an
           encrypted envelope, rather than making the user press Apply to find out. */
        overlay.querySelector('#enh-import-textarea').addEventListener('input', () => {
            const raw = overlay.querySelector('#enh-import-textarea').value.trim();
            let encrypted = false;
            if (raw.startsWith('{') && raw.includes(BACKUP_ENVELOPE_KEY)) {
                try { encrypted = isEncryptedBackup(JSON.parse(raw)); }
                catch { encrypted = false; }
            }
            const row = overlay.querySelector('#enh-import-passphrase-row');
            if (row.hidden === encrypted) row.hidden = !encrypted;
            if (!encrypted) overlay.querySelector('#enh-import-passphrase').value = '';
        });
        overlay.querySelector('#enh-import-apply').addEventListener('click', async () => {
            const apply = overlay.querySelector('#enh-import-apply');
            const raw = overlay.querySelector('#enh-import-textarea').value.trim();
            if (!raw) { showToast(t('toast_paste_settings_json_before_importing')); return; }
            if (raw.length > SETTINGS_IMPORT_TEXT_LIMIT) { showToast(t('toast_import_is_too_large_use_a')); return; }
            apply.disabled = true;
            try {
                let data = JSON.parse(raw);
                /* Decryption happens first and completely. A wrong passphrase or an
                   altered file fails here, before prepareSettingsImport has produced a
                   single entry, so a bad import cannot be partially applied. */
                if (isEncryptedBackup(data)) {
                    data = await readEncryptedBackup(data, overlay.querySelector('#enh-import-passphrase').value);
                }
                const { entries, ignored } = prepareSettingsImport(data);
                const imported = applySettingsImport(entries);
                const skipped = ignored ? `; skipped ${ignored} invalid or unknown` : '';
                showToast(t('toast_imported_settings_reloading', [imported, skipped]));
                setTimeout(() => location.reload(), 1000);
            } catch (error) {
                const message = error instanceof SyntaxError
                    ? t('text_import_failed_check_the_json_syntax_and')
                    : error.message || t('text_import_failed_no_settings_were_changed');
                showToast(message, 5000);
            } finally { apply.disabled = false; }
        });
        overlay.querySelector('#enh-journal-copy').addEventListener('click', () => {
            showToast(copyTextToClipboard(formatFailureJournal())
                ? t('text_failure_journal_copied')
                : COPY_FAILURE_MESSAGE, 2500);
        });
        overlay.querySelector('#enh-journal-clear').addEventListener('click', () => {
            if (!clearFailureJournal()) {
                showToast(t('toast_the_journal_could_not_be_cleared', [STORAGE_HOST_LABEL]), 4500);
                return;
            }
            overlay.querySelector('#enh-journal-body').textContent = formatFailureJournal();
            showToast(t('toast_failure_journal_cleared'));
        });
        overlay.querySelector('#enh-clearcache-btn').addEventListener('click', () => {
            let keys;
            try { keys = GM_listValues().filter(key => key.startsWith('cache_')); }
            catch {
                showToast(t('toast_cache_could_not_be_read_or'), 4500);
                return;
            }
            let cleared = 0;
            let failed = 0;
            keys.forEach(key => {
                try {
                    if (typeof GM_deleteValue === 'function') GM_deleteValue(key);
                    else GM_setValue(key, null);
                    cleared++;
                } catch { failed++; }
            });
            const remaining = cacheCount();
            const remainingBytes = cacheBytes();
            overlay.querySelector('#enh-data-cache-count').textContent =
                t('text_cache_remaining', [remaining, formatCacheBytes(remainingBytes)]);
            overlay.querySelector('#enh-cache-status').textContent = remaining
                ? `${remaining} entries remain, using ${formatCacheBytes(remainingBytes)} of ${formatCacheBytes(CACHE_TOTAL_BYTE_BUDGET)}.`
                : t('text_no_cached_entries');
            if (!keys.length) showToast(t('toast_cache_is_already_empty'));
            else if (failed) showToast(t('toast_cleared_cached_entries_could_not_be', [cleared, failed]), 4500);
            else showToast(t('toast_cleared_cached_entries_reload_to_re', [cleared]));
        });

        showPage(activeSettingsPage);
        document.body.appendChild(overlay);
        settingsPanelCleanup = () => {
            cleanupTasks.splice(0).forEach(cleanup => cleanup());
            settingsPanelCleanup = null;
        };
    }

    function createFAB() {
        if (document.getElementById('enh-settings-fab')) return;
        const fab = makeEl('button', {
            id:'enh-settings-fab', type:'button',
            title:t('text_imdb_enhanced_settings'), 'aria-label':t('aria_open_imdb_enhanced_settings'),
            'aria-haspopup':'dialog', 'aria-expanded':'false',
            innerHTML: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
            onClick: toggleSettings,
        });
        document.body.appendChild(fab);
    }

    function toggleSettings() {
        settingsOpen = !settingsOpen;
        const overlay = document.getElementById('enh-settings-overlay');
        const panel = document.getElementById('enh-settings-panel');
        overlay?.classList.toggle('enh-visible', settingsOpen);
        overlay?.setAttribute('aria-hidden', String(!settingsOpen));
        /* The modal joins the top layer while open so nothing promoted earlier can sit
           on it, and anything transient still up on the page is put away first. */
        if (settingsOpen) {
            document.querySelectorAll('.enh-score-correction__close').forEach(button => button.click());
            document.querySelector('.enh-zoom')?.remove();
            if (overlay) showInTopLayer(overlay);
        } else if (overlay) {
            hideFromTopLayer(overlay);
        }
        document.getElementById('enh-settings-fab')?.setAttribute('aria-expanded', String(settingsOpen));
        if (settingsOpen) {
            lastFocusedElement = document.activeElement;
            previousDocumentOverflow = document.documentElement.style.overflow;
            document.documentElement.style.overflow = 'hidden';
            const activeTab = overlay?.querySelector(`.enh-settings-nav-btn[data-settings-page="${activeSettingsPage}"]`);
            setTimeout(() => (activeTab || getFocusableElements(overlay)[0] || panel)?.focus(), 40);
        } else {
            const importPanel = document.getElementById('enh-import-panel');
            const resetPanel = document.getElementById('enh-reset-panel');
            if (importPanel) importPanel.hidden = true;
            if (resetPanel) resetPanel.hidden = true;
            document.getElementById('enh-import-btn')?.setAttribute('aria-expanded', 'false');
            document.getElementById('enh-reset-btn')?.setAttribute('aria-expanded', 'false');
            const importTextarea = document.getElementById('enh-import-textarea');
            if (importTextarea) importTextarea.value = '';
            document.documentElement.style.overflow = previousDocumentOverflow;
            lastFocusedElement?.focus?.();
        }
    }

    function destroySettingsChrome() {
        settingsPanelCleanup?.();
        if (settingsOpen) document.documentElement.style.overflow = previousDocumentOverflow;
        settingsOpen = false;
        document.getElementById('enh-settings-overlay')?.remove();
        document.getElementById('enh-settings-fab')?.remove();
        lastFocusedElement = null;
        previousDocumentOverflow = '';
    }
