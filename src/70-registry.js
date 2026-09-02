    // =========================================================================
    //  FEATURE REGISTRY
    // =========================================================================
    const features = [];
    const featureGenerations = new WeakMap();
    function reg(f) { features.push(f); }
    function advanceFeatureGeneration(feature) {
        const generation = (featureGenerations.get(feature) || 0) + 1;
        featureGenerations.set(feature, generation);
        return generation;
    }
    function stopFeature(feature) {
        advanceFeatureGeneration(feature);
        feature.destroy?.();
    }
    /* IMDb rewrites its DOM without notice, so a feature whose selectors stopped
       matching is the expected failure — not an exceptional one. Route activation
       used to report those to the console only, which meant the user simply saw a
       missing feature and had nothing to send anyone. Failures are now retained for
       the diagnostics report and announced once per route, so one broken feature
       cannot produce a stack of toasts. */
    const FEATURE_FAILURE_LIMIT = 20;
    const featureFailures = [];
    let announcedFailureRoute = -1;

    /* The in-memory list above disappears on reload, so the failures worth correlating —
       an intermittent provider, a selector that breaks only on some routes — were exactly
       the ones a user could never report. The journal below survives.

       It records a *category*, never a message. That is the whole privacy design: an
       error string can contain the title being viewed, a full lookup URL with its query,
       DOM text, or a token echoed back by a local service, and scrubbing free text is a
       game you lose eventually. Storing an enum means there is nothing to scrub, and the
       category is what actually tells you whether IMDb changed its markup or a provider
       went down. */
    const FAILURE_JOURNAL_ENTRY_VERSION = 1;
    const FAILURE_CATEGORIES = [
        'selector', 'network', 'http', 'rate_limited', 'storage', 'parse', 'permission', 'timeout', 'aborted', 'unknown',
    ];
    const FAILURE_CATEGORY_SET = new Set(FAILURE_CATEGORIES);
    const FAILURE_CATEGORY_LABELS = {
        selector: t('journal_selector'),
        network: t('journal_network'),
        http: t('journal_http'),
        rate_limited: t('journal_rate_limited'),
        storage: t('journal_storage'),
        parse: t('journal_parse'),
        permission: t('journal_permission'),
        timeout: t('journal_timeout'),
        aborted: t('journal_aborted'),
        unknown: t('journal_unknown'),
    };

    /* Every failure this script raises says what kind it is. The classifier below can
       read English prose as a last resort, which is right for an error the browser or a
       script manager raised and wrong for one of ours: our messages come from the
       catalog, so under any other locale the words it matches on are simply not there
       and every one of them would be filed as unknown. The category is stored, so that
       is a journal that means something different depending on the reader's language. */
    function failure(category, message) {
        const error = new Error(message);
        error.imdbEnhancedCategory = category;
        return error;
    }

    /* Classification reads the error, but only ever emits one of the fixed categories
       above — no substring of the message is retained. */
    function classifyFailure(error) {
        /* A failure raised by this script says what it was. Reading that beats matching
           prose, which cannot work at all for a script manager's response object: it has
           no name and no message and stringifies to [object Object]. */
        const declared = String(error?.imdbEnhancedCategory || '');
        if (FAILURE_CATEGORY_SET.has(declared)) return declared;
        const name = String(error?.name || '');
        if (name === 'AbortError') return 'aborted';
        const text = String(error?.message || error || '').toLowerCase();
        if (!text) return 'unknown';
        if (/quota|storage|exceeded the storage|indexeddb/.test(text)) return 'storage';
        if (/permission|denied|not allowed|blocked:/.test(text)) return 'permission';
        if (/timed out|timeout/.test(text)) return 'timeout';
        if (/abort/.test(text)) return 'aborted';
        if (/failed to fetch|networkerror|network|http \d{3}|request failed|connection/.test(text)) return 'network';
        if (/json|parse|unexpected token|malformed|invalid/.test(text)) return 'parse';
        if (/null|undefined|not a function|selector|queryselector|cannot read/.test(text)) return 'selector';
        return 'unknown';
    }

    function normalizeJournalEntry(entry) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
        // A stored entry from a different shape is dropped rather than half-read.
        if (Number(entry.v) !== FAILURE_JOURNAL_ENTRY_VERSION) return null;
        const ts = Number(entry.ts);
        if (!Number.isFinite(ts) || ts <= 0 || ts > Date.now() + 60000) return null;
        const category = String(entry.category || '');
        if (!FAILURE_CATEGORY_SET.has(category)) return null;
        const key = String(entry.key || '').slice(0, 40);
        if (!/^[A-Za-z0-9_]+$/.test(key)) return null;
        const route = String(entry.route || '').slice(0, 24);
        if (!/^[a-z-]*$/.test(route)) return null;
        const build = String(entry.build || '').slice(0, 20);
        if (!/^[0-9a-z.\-+]*$/i.test(build)) return null;
        return { v:FAILURE_JOURNAL_ENTRY_VERSION, ts, build, key, route, category };
    }

    function getFailureJournal() {
        const stored = get('failureJournal');
        if (!Array.isArray(stored)) return [];
        return stored.slice(-FEATURE_FAILURE_LIMIT).map(normalizeJournalEntry).filter(Boolean);
    }

    function appendFailureJournal(key, category) {
        try {
            const entry = normalizeJournalEntry({
                v: FAILURE_JOURNAL_ENTRY_VERSION,
                ts: Date.now(),
                build: VERSION,
                key,
                // The route class, never the path: a path carries the title id and any
                // query string that came with it.
                route: getPageSurface(),
                category,
            });
            if (!entry) return;
            const next = [...getFailureJournal(), entry].slice(-FEATURE_FAILURE_LIMIT);
            GM_setValue(PREFIX + 'failureJournal', next);
        } catch { /* a journal that cannot be written must never break the feature */ }
    }

    function clearFailureJournal() {
        try {
            GM_setValue(PREFIX + 'failureJournal', []);
            return true;
        } catch { return false; }
    }

    function formatFailureJournal() {
        const entries = getFailureJournal();
        if (!entries.length) return t('journal_empty');
        return entries.map(entry => {
            const when = new Date(entry.ts).toISOString().replace('T', ' ').slice(0, 19);
            return `${when}  v${entry.build}  ${entry.route || 'unknown'}  ${entry.key}: ${FAILURE_CATEGORY_LABELS[entry.category]}`;
        }).join('\n');
    }

    function recordFeatureFailure(feature, context, error) {
        const category = classifyFailure(error);
        featureFailures.push({
            key: feature.key,
            context,
            message: toBoundedText(error && error.message ? error.message : error, 200) || 'Unknown error',
            category,
        });
        if (featureFailures.length > FEATURE_FAILURE_LIMIT) {
            featureFailures.splice(0, featureFailures.length - FEATURE_FAILURE_LIMIT);
        }
        appendFailureJournal(feature.key, category);
    }

    function getFeatureFailures() {
        return featureFailures.map(entry => ({ ...entry }));
    }

    /* A bug report a user can read before they send it, and that carries nothing they
       would not want to publish. Credentials are reported as configured/not, never as
       values; private marks contribute a count and no titles; and the page is reduced
       to its path so query strings and fragments cannot leak. Nothing is transmitted —
       this only ever reaches the clipboard. */
    const DIAGNOSTIC_CREDENTIAL_KEYS = [
        ['Radarr', 'radarrApiKey'], ['Sonarr', 'sonarrApiKey'], ['Overseerr', 'seerrApiKey'],
        ['Plex', 'plexToken'], ['Jellyfin', 'jellyfinApiKey'], ['Emby', 'embyApiKey'],
    ];

    function buildDiagnosticsReport() {
        const featureState = features.map(feature => ({ key: feature.key, on: get(feature.key) !== false }));
        const enabled = featureState.filter(entry => entry.on).map(entry => entry.key);
        const disabled = featureState.filter(entry => !entry.on).map(entry => entry.key);
        const integrations = DIAGNOSTIC_CREDENTIAL_KEYS
            // Asked of readCredential: a content script cannot read a credential value, so
            // reading get() here told every extension user their integrations were not set
            // up, while the same report from the options page said the opposite.
            .map(([label, key]) => `${label}: ${readCredential(key).configured ? 'configured' : 'not configured'}`);
        let markCount = 'unavailable';
        // Force a re-read: a diagnostics snapshot must describe storage, not a
        // page-lifetime render cache that may predate the problem being reported.
        try { markCount = String(Object.keys(getUserMarks(true) || {}).length); } catch { /* reported as unavailable */ }
        let cached = 'unavailable';
        try { cached = `${cacheCount()} (${formatCacheBytes(cacheBytes())} of ${formatCacheBytes(CACHE_TOTAL_BYTE_BUDGET)})`; }
        catch { /* reported as unavailable */ }
        const failures = getFeatureFailures();
        return [
            'IMDb Enhanced diagnostics',
            `version: ${VERSION}`,
            `build: ${IS_EXTENSION_BUILD ? 'extension' : 'userscript'}`,
            `page: ${toBoundedText(location.pathname, 120) || '/'}`,
            `surface: ${getPageSurface()}`,
            `theme: ${toBoundedText(get('themeVariant'), 40)}${get('themeAuto') ? ' (auto)' : ''}`,
            `language: ${toBoundedText(document.documentElement?.lang, 20) || 'unknown'}`,
            `userAgent: ${toBoundedText(navigator.userAgent, 200)}`,
            `marks stored: ${markCount}`,
            `cache entries: ${cached}`,
            `features off: ${disabled.length ? disabled.join(', ') : 'none'}`,
            `features on: ${enabled.length ? enabled.join(', ') : 'none'}`,
            `integrations: ${integrations.join(', ')}`,
            failures.length
                ? `recent failures:\n${failures.map(f => `  - ${f.context} ${f.key}: ${f.message}`).join('\n')}`
                : 'recent failures: none',
            `failure journal:\n${formatFailureJournal().split('\n').map(line => `  ${line}`).join('\n')}`,
        ].join('\n');
    }

    function startFeature(feature, { context = 'init', notify = false } = {}) {
        const generation = advanceFeatureGeneration(feature);
        const report = error => {
            console.warn(`[IMDb Enhanced] ${context} ${feature.key}:`, error);
            recordFeatureFailure(feature, context, error);
            // Announcing must never mask the failure it is announcing.
            try {
                if (notify) {
                    showToast(t('toast_could_not_start_reload_and_try', [feature.name]), 4500);
                } else if (announcedFailureRoute !== activeRouteGeneration) {
                    announcedFailureRoute = activeRouteGeneration;
                    showToast(t('toast_could_not_start_on_this_page', [feature.name]), 5000);
                }
            } catch (toastError) {
                console.warn('[IMDb Enhanced] failure notice:', toastError);
            }
        };
        const rejectCurrentGeneration = error => {
            if (featureGenerations.get(feature) === generation) {
                advanceFeatureGeneration(feature);
                try { feature.destroy?.(); }
                catch (cleanupError) { console.warn(`[IMDb Enhanced] cleanup ${feature.key}:`, cleanupError); }
            }
            report(error);
        };
        try {
            const pending = feature.init();
            if (pending && typeof pending.catch === 'function') pending.catch(rejectCurrentGeneration);
            return true;
        } catch (error) {
            rejectCurrentGeneration(error);
            return false;
        }
    }

