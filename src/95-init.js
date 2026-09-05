    // =========================================================================
    //  INIT
    // =========================================================================
    let activeRouteKey = null;
    let activeRouteGeneration = 0;
    let routeInitCount = 0;
    let routerInstalled = false;
    let routeTimer = null;
    let initTimer = null;

    function isIMDbHost(hostname = window.location.hostname) {
        return String(hostname || '').toLowerCase() === 'www.imdb.com';
    }

    /* A link shared from a phone points at m.imdb.com, and opening it on a computer lands
       on a page this script deliberately does not run on and that nobody chose. The same
       path on the desktop host is where the person was going.

       Never on a phone, though: this is about a desktop browser being sent somewhere it
       did not ask for, and doing the reverse to somebody actually holding a phone would
       be the same mistake pointed the other way. A coarse primary pointer on a narrow
       viewport is what a phone is. */
    const MOBILE_IMDB_HOST = 'm.imdb.com';
    const DESKTOP_IMDB_HOST = 'www.imdb.com';

    const HANDHELD_MAX_EDGE = 820;
    const DESKTOP_REDIRECT_MARK = 'imdb_enh_desktop_redirect';
    // Long enough to cover a bounce and a reload, short enough that a link clicked
    // again later is a new journey rather than the same loop.
    const DESKTOP_REDIRECT_LOOP_MS = 30000;

    /* The short edge, not the width. A phone held sideways is 844 CSS pixels across and
       would read as a computer measured on width alone, and a tablet would change its
       answer when somebody turned it over. The shorter side does not move. */
    function shortViewportEdge(view) {
        const width = Number(view.innerWidth);
        const height = Number(view.innerHeight);
        const viewport = [width, height].filter(value => Number.isFinite(value) && value > 0);
        if (viewport.length === 2) return Math.min(...viewport);
        /* A tab that has not been painted yet reports zero. The screen is still the
           device's, so ask it rather than guessing from a measurement that does not exist. */
        const screenWidth = Number(view.screen?.width);
        const screenHeight = Number(view.screen?.height);
        const physical = [screenWidth, screenHeight].filter(value => Number.isFinite(value) && value > 0);
        if (physical.length === 2) return Math.min(...physical);
        return viewport[0] ?? physical[0] ?? 0;
    }

    function looksLikeHandheld(view = window) {
        try {
            const coarse = view.matchMedia?.('(pointer: coarse)')?.matches === true;
            if (!coarse) return false;
            const edge = shortViewportEdge(view);
            /* Nothing measurable and a coarse pointer: treat it as a phone. The cost of
               being wrong here is a desktop browser staying on the mobile page, which the
               person can leave. The other way round takes a phone off the page it asked
               for and onto one built for a mouse. */
            if (!(edge > 0)) return true;
            return edge <= HANDHELD_MAX_EDGE;
        } catch { return true; }
    }

    /* IMDb sends some visitors back to the mobile host, and two redirects that disagree
       with each other loop until the tab gives up. One rewrite per tab per address. */
    function claimDesktopRedirect(target, view = window, now = Date.now()) {
        try {
            const store = view.sessionStorage;
            if (!store) return true;
            /* A loop bounces back within a moment; somebody opening the same link again
               half an hour later meant it. A permanent claim could not tell the two
               apart and refused the second one for the rest of the session, so the
               address the person deliberately clicked sat there doing nothing. */
            const stored = String(store.getItem(DESKTOP_REDIRECT_MARK) || '');
            const [when, claimed = ''] = stored.split(' ');
            /* A claim written before this carried a timestamp, and a clock that has been
               put back makes the age negative. Neither says the loop is over, so a claim
               on this exact address holds unless the time it names has genuinely passed.
               Refusing once too often leaves somebody on a page they can navigate away
               from; allowing once too often is the loop this exists to stop. */
            const age = now - Number(when);
            const unreadable = !Number.isFinite(age) || age < 0;
            const expired = !unreadable && age >= DESKTOP_REDIRECT_LOOP_MS;
            if ((claimed || stored) === target && !expired) {
                /* A claim written before the stamp existed, or one whose time is in the
                   future because the clock moved, cannot say how long ago it was made.
                   It holds this once and is restamped, so it expires from now instead of
                   sitting on that address for the rest of the session. */
                if (unreadable) store.setItem(DESKTOP_REDIRECT_MARK, `${now} ${target}`);
                return false;
            }
            store.setItem(DESKTOP_REDIRECT_MARK, `${now} ${target}`);
            return true;
        } catch { return true; }
    }

    function desktopUrlForMobile(href, view = window) {
        let parsed;
        try { parsed = new URL(String(href || '')); }
        catch { return ''; }
        if (parsed.hostname.toLowerCase() !== MOBILE_IMDB_HOST) return '';
        if (parsed.protocol !== 'https:') return '';
        /* Credentials in the address belong to the host they were typed for. Carrying them
           to a different one hands them to somebody who was never offered them, and a real
           IMDb link has neither those nor a port. */
        if (parsed.username || parsed.password || parsed.port) return '';
        if (looksLikeHandheld(view)) return '';
        parsed.hostname = DESKTOP_IMDB_HOST;
        // Path, query and fragment are what the person was after; only the host changes.
        return parsed.href;
    }

    const UNIVERSAL_FEATURE_KEYS = new Set([
        'modernUI', 'compactHeader', 'widerLayout', 'keyboardShortcuts',
        /* A link to a title is a link to a title wherever IMDb draws it, and the point of
           this one is the surfaces no card ever reaches. */
        'markLinkTint',
        /* Cards are everywhere IMDb draws them, and the thumbnails this enlarges are on
           every one of those surfaces. */
        'largerThumbnails',
    ]);
    /* Private marks belong anywhere IMDb renders title cards, not only on a title
       page: charts, lists, watchlists, person filmographies, episode lists, and
       search results are exactly where knowing what you already watched or
       dismissed changes what you click. */
    const COLLECTION_FEATURE_KEYS = new Set([
        ...UNIVERSAL_FEATURE_KEYS, 'watchlistBatch', 'collectionExport', 'listMultiSearch', 'listRuntimeSummary',
        'watchedMarking', 'markFilters', 'dimLowRated', 'listRoulette',
        /* Deciding what to open from a list is exactly where knowing a title is already
           in your library saves opening it, and the title page already says so. */
        'rowIntegrationState',
    ]);
    const SECONDARY_PAGE_FEATURE_KEYS = new Set([
        ...UNIVERSAL_FEATURE_KEYS, 'collapsibleSections', 'expandSummaries', 'quickNav',
        // Person pages carry a filmography, which is exactly the long card list marks
        // are useful for narrowing.
        'watchedMarking', 'markFilters', 'castAges',
        /* A full cast list and a person's filmography are where the thumbnails are;
           covering only the title page's top-billed row misses most of them. */
        'imageZoom',
    ]);
    /* A filmography is a list of titles, so the library badge belongs there. An episode
       list, a season grid and a full-credits page are not: their rows are episodes and
       people, and no media server or request service is keyed by an episode id. Putting
       this in SECONDARY_PAGE_FEATURE_KEYS reached all four, which would have meant 250
       futile requests to somebody's local service for every episode list opened. */
    const NAME_PAGE_FEATURE_KEYS = new Set([
        ...SECONDARY_PAGE_FEATURE_KEYS, 'rowIntegrationState',
    ]);
    const EPISODE_LIST_FEATURE_KEYS = new Set([
        ...SECONDARY_PAGE_FEATURE_KEYS, 'tvEpisodeTools', 'seasonProgress', 'episodeSubtitles',
    ]);
    /* The ratings tab is a title subpage that additionally owns IMDb's episode grid. */
    const RATINGS_FEATURE_KEYS = new Set([
        ...SECONDARY_PAGE_FEATURE_KEYS, 'episodeHeatmap', 'ratingGap',
    ]);
    /* Search, advanced search, and the homepage are browse surfaces: they carry
       IMDb's own cards rather than one title, so they take presentation and
       cleanup work without any title-scoped control. */
    const BROWSE_FEATURE_KEYS = new Set([
        ...UNIVERSAL_FEATURE_KEYS, 'watchedMarking', 'markFilters', 'dimLowRated',
    ]);

    function getPageSurface() {
        const path = location.pathname;
        const locale = '(?:[a-z]{2}(?:-[a-z]{2})?/)?';
        if (new RegExp(`^/${locale}title/tt\\d+/episodes/?$`, 'i').test(path)) return 'episodes';
        if (new RegExp(`^/${locale}title/tt\\d+/ratings/?$`, 'i').test(path)) return 'ratings';
        if (new RegExp(`^/${locale}title/tt\\d+/?$`, 'i').test(path)) return 'title';
        if (new RegExp(`^/${locale}title/tt\\d+/`, 'i').test(path)) return 'title-subpage';
        if (new RegExp(`^/${locale}name/nm\\d+`, 'i').test(path)) return 'name';
        /* A person's own ratings and their own lists index are card lists like any other,
           and they are the longest ones an account holder has. Reading a page somebody
           already opened is what every other collection surface does here; nothing walks
           pagination and nothing is stored beyond what a visible row shows. The title
           tabs are matched above, so /title/tt.../ratings never reaches this line. */
        if (/\/(watchlist|list\/|chart\/)/i.test(path)) return 'collection';
        if (new RegExp(`^/${locale}user/ur\\d+/(?:ratings|lists)(?:/|$)`, 'i').test(path)) return 'collection';
        if (new RegExp(`^/${locale}(?:find|search)(?:/|$)`, 'i').test(path)) return 'search';
        if (new RegExp(`^/${locale}$`, 'i').test(path)) return 'home';
        return 'other';
    }

    function shouldInitFeature(feature) {
        if (feature.group === 'Cleanup') return true;
        const surface = getPageSurface();
        // episodeHeatmap would otherwise wait out its selector timeout on every title page.
        /* ratingGap needs the vote distribution, which IMDb stopped shipping on title
           pages — verified 2026-08-15 that no script there carries histogramData. */
        /* rowIntegrationState is scoped to lists, charts and filmographies, which is what
           its description promises. A title page already carries the full integration bar
           for the title it is about, so badging the recommendation carousel underneath
           would be a second answer to a question already answered above it. */
        if (surface === 'title') return !['watchlistBatch', 'listMultiSearch', 'listRuntimeSummary', 'markFilters', 'dimLowRated', 'listRoulette', 'episodeHeatmap', 'ratingGap', 'rowIntegrationState'].includes(feature.key);
        if (surface === 'episodes') return EPISODE_LIST_FEATURE_KEYS.has(feature.key);
        if (surface === 'ratings') return RATINGS_FEATURE_KEYS.has(feature.key);
        if (surface === 'collection') return COLLECTION_FEATURE_KEYS.has(feature.key);
        /* A person page carries a filmography, which is exactly the long card list these
           two are for. A title subpage — full credits, reviews, technical — carries one
           title and a breadcrumb back to it, so a "Private marks" filter over a single
           card, or a dim pass over one poster, is noise on a page that has no collection
           to work on. */
        if (surface === 'title-subpage') {
            return SECONDARY_PAGE_FEATURE_KEYS.has(feature.key)
                && !['markFilters', 'dimLowRated'].includes(feature.key);
        }
        if (surface === 'name') return NAME_PAGE_FEATURE_KEYS.has(feature.key);
        if (surface === 'search' || surface === 'home') return BROWSE_FEATURE_KEYS.has(feature.key);
        return UNIVERSAL_FEATURE_KEYS.has(feature.key);
    }

    function getRouteKey() {
        return `${window.location.hostname}${window.location.pathname}${window.location.search}`;
    }

    function createFeatureGuard(feature) {
        const routeKey = getRouteKey();
        const routeGeneration = activeRouteGeneration;
        const featureGeneration = featureGenerations.get(feature) || 0;
        return () => activeRouteGeneration === routeGeneration
            && (featureGenerations.get(feature) || 0) === featureGeneration
            && getRouteKey() === routeKey
            && get(feature.key)
            && shouldInitFeature(feature);
    }

    function destroyRouteFeatures() {
        cancelPendingRouteWork();
        features.forEach(f => {
            try { stopFeature(f); }
            catch (e) { console.warn(`[IMDb Enhanced] destroy ${f.key}:`, e); }
        });
        // The announcer outlives routes on purpose — a live region has to already be
        // in the accessibility tree to announce — but its timers must not.
        toastTimers.splice(0).forEach(clearTimeout);
        document.getElementById('enh-toast')?.remove();
        destroySettingsChrome();
    }

    function scheduleInit(delay = 350) {
        clearTimeout(initTimer);
        initTimer = setTimeout(init, delay);
    }

    function scheduleRouteInit() {
        clearTimeout(routeTimer);
        routeTimer = setTimeout(() => {
            if (activeRouteKey !== getRouteKey()) scheduleInit(350);
        }, 250);
    }

    function installSPARouter() {
        if (routerInstalled || !isIMDbHost()) return;
        routerInstalled = true;

        ['pushState', 'replaceState'].forEach(method => {
            const original = history[method];
            if (original.__imdbEnhancedWrapped) return;
            const wrapped = function (...args) {
                const result = original.apply(this, args);
                scheduleRouteInit();
                return result;
            };
            wrapped.__imdbEnhancedWrapped = true;
            history[method] = wrapped;
        });

        window.addEventListener('popstate', scheduleRouteInit);
    }

    function init() {
        if (!isIMDbHost()) return;

        const routeKey = getRouteKey();
        if (activeRouteKey === routeKey) return;
        if (activeRouteKey) destroyRouteFeatures();
        activeRouteKey = routeKey;
        activeRouteGeneration += 1;
        // Belt and braces: getLDData drops it on a route change on its own, and this
        // additionally re-reads a page that was replaced under the same address.
        _ldData = null;
        _ldRoute = '';
        cacheGC();
        /* Before any feature reads a setting, so a migration cannot race a consumer.
           A failure leaves the stored version untouched and is retried next load. */
        try { runSettingsMigrations(); }
        catch (error) { console.warn('[IMDb Enhanced] settings migration deferred:', error); }
        try { getSectionCollapseState(); }
        catch (error) { console.warn('[IMDb Enhanced] section-state migration deferred:', error); }

        injectGlobalStyles();
        // Installed before anything can announce: a live region only speaks if it was
        // already in the accessibility tree when its text changed.
        ensureToastAnnouncer();
        // Same rule as the toast region: it only speaks if it was already in the
        // accessibility tree when its text changed, so it cannot be created on demand.
        ensureScoreAnnouncer();
        showUpdateNotice();
        const enabledFeatures = features.filter(f => get(f.key) && shouldInitFeature(f));
        enabledFeatures.forEach(feature => startFeature(feature, { context:'route' }));
        createSettingsPanel();
        createFAB();
        // After the gear exists, because the notice points at it.
        showFirstRunNotice();
        routeInitCount += 1;
        console.info(`[IMDb Enhanced] v${VERSION} — init #${routeInitCount}; ${enabledFeatures.length} features enabled`);
    }

    /* The extension's recovery page needs backup, restore, reset and diagnostics to
       behave exactly as they do in the settings panel, and a second implementation of
       them would be a second set of bugs. It is a separate document, so it cannot reach
       into this closure on its own; the build generates a page that defines this hook
       before loading this file, and nothing else ever sets it. Everywhere else the hook
       is absent and this is dead code.

       Deliberately narrow: storage-layer operations only. No feature, DOM, or route
       function is handed out, because the recovery page has no page to act on. */
    if (typeof globalThis.__imdbEnhancedRecoveryHook === 'function') {
        try {
            globalThis.__imdbEnhancedRecoveryHook({
                VERSION,
                // One catalog for both documents, so the page cannot drift from the panel.
                t,
                tCount,
                getExportSettings,
                createEncryptedBackup,
                readEncryptedBackup,
                isEncryptedBackup,
                prepareSettingsImport,
                applySettingsImport,
                getDefaultSettingsEntries,
                buildDiagnosticsReport,
                cacheCount,
                cacheBytes,
                compareCsvWatchlists,
                getRatingRamp,
                settingsTextTooLarge,
                SCORE_CORRECTION_URL_LIMIT,
                SCORE_CORRECTION_JSON_BYTES_MAX,
                SCORE_CORRECTION_PROVIDER_COUNT,
                isListPage,
                storedBytes,
                formatCacheBytes,
                getUserMarks,
                EXPORT_REDACTED_KEY,
                // The options page is the only surface that can actually grant an
                // optional origin, so it needs to know which feature wants what.
                FEATURE_ORIGIN_GROUPS,
                FEATURE_DETAILS,
                FEATURE_KEYWORDS,
                getFeatureOrigins,
                describeFeatureOrigins,
                describeFeatureConsent,
                releasableOriginsFor,
                getSetting: key => get(key),
            });
        } catch (error) {
            console.warn('[IMDb Enhanced] recovery hook failed:', error);
        }
    }

    /* The extension gets a recovery page it can open from the toolbar. A userscript has
       no such surface, and every settings action lived behind a floating button that
       only exists once a feature successfully rendered on an IMDb page — so a selector
       break or a disabled feature could put backup and reset out of reach. The manager's
       own menu is the equivalent escape hatch, and it reuses the same helpers the
       settings panel does rather than a second implementation.

       Registered only on IMDb, because that is the only place the userscript runs. */
    let pendingResetUndo = null;
    function registerManagerMenuCommands() {
        if (typeof GM_registerMenuCommand !== 'function' || !isIMDbHost()) return;
        const register = (label, handler) => {
            try { GM_registerMenuCommand(label, handler); }
            catch (error) { console.warn(`[IMDb Enhanced] menu command "${label}" unavailable:`, error); }
        };
        register(t('aria_open_imdb_enhanced_settings'), () => {
            if (!document.getElementById('enh-settings-overlay')) createSettingsPanel();
            if (!settingsOpen) toggleSettings();
        });
        register(t('menu_copy_settings_backup'), () => {
            try {
                const payload = getExportSettings();
                const omitted = payload[EXPORT_REDACTED_KEY] || [];
                if (!copyTextToClipboard(JSON.stringify(payload, null, 2))) {
                    showToast(COPY_FAILURE_MESSAGE, 4500);
                    return;
                }
                showToast(omitted.length
                    ? tCount('recovery_backup_copied_omitting', omitted.length)
                    : t('recovery_backup_copied'), omitted.length ? 5000 : 2500);
            } catch (error) {
                showToast(error?.message || t('recovery_the_backup_could_not_be_created'), 4500);
            }
        });
        register(t('text_restore_a_settings_backup'), () => {
            if (!document.getElementById('enh-settings-overlay')) createSettingsPanel();
            if (!settingsOpen) toggleSettings();
            // Land on Data with the restore panel already open, so the command finishes
            // the journey rather than dropping the user at the front of the settings.
            requestAnimationFrame(() => {
                document.getElementById('enh-settings-tab-data')?.click();
                requestAnimationFrame(() => document.getElementById('enh-import-btn')?.click());
            });
        });
        /* Registered once, up front, rather than from inside the reset handler. Doing it
           there added a command per reset; Violentmonkey and Tampermonkey replace by
           caption, but a manager that does not dedupe would accumulate one every time. */
        register(t('text_undo_the_last_settings_reset'), () => {
            if (!pendingResetUndo) { showToast(t('toast_there_is_no_reset_to_undo')); return; }
            try {
                const restored = applySettingsImport(pendingResetUndo);
                pendingResetUndo = null;
                showToast(t('toast_undone_settings_were_put_back_reloading', [restored]));
                setTimeout(() => location.reload(), 1000);
            } catch (error) {
                showToast(error?.message || t('recovery_the_undo_failed_nothing_was_changed'), 5000);
            }
        });
        register(t('menu_reset_all_settings'), () => {
            let snapshot;
            try { snapshot = prepareSettingsImport(getExportSettings({ includeCredentials:true })).entries; }
            catch (error) {
                showToast(t('toast_current_settings_could_not_be_read', [error?.message || 'unknown error']), 5000);
                return;
            }
            try {
                const count = applySettingsImport(getDefaultSettingsEntries());
                /* Keep the FIRST snapshot. A second reset before undoing would capture
                   the already-reset state, and the undo would then report putting N
                   settings back while writing defaults over what the user really had. */
                if (!pendingResetUndo) pendingResetUndo = snapshot;
                showToast(t('toast_reset_settings_use_the_manager_menu', [count]), 8000);
            } catch (error) {
                showToast(error?.message || t('recovery_the_reset_failed_and_previous_settings_were'), 5000);
            }
        });
    }
    registerManagerMenuCommands();

    /* Before anything else has a chance to paint. A shared link from a phone lands on
       IMDb's mobile host, which this script does not run on and which nobody chose; the
       same path on the desktop host is where the person was going. Replaced rather than
       assigned, so the back button does not bounce between the two. */
    if (get('desktopFromMobileLinks') !== false) {
        const desktop = desktopUrlForMobile(location.href);
        if (desktop && claimDesktopRedirect(desktop)) {
            location.replace(desktop);
            return;
        }
    }

    if (isIMDbHost()) installSPARouter();
    // Let IMDb's Next.js hydration settle before mutating title-page DOM.
    if (document.readyState === 'complete') scheduleInit(250);
    else window.addEventListener('load', () => scheduleInit(250), { once:true });

})();
