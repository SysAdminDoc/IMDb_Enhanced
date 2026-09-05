    // =========================================================================
    //  STORAGE HELPERS
    // =========================================================================
    const get = (k) => GM_getValue(PREFIX + k, DEFAULTS[k]);
    const set = (k, v) => {
        GM_setValue(PREFIX + k, v);
        try { document.dispatchEvent(new CustomEvent('imdb-enhanced:settings-saved', { detail:{ key:k } })); }
        catch { /* persistence succeeded; notification is best-effort */ }
        return true;
    };
    let cacheWritesSinceGC = 0;
    let userMarksCache = null;

    /* Storage quotas are counted in bytes, so the budget has to be too. TextEncoder is
       present in every target engine; the fallback keeps the accounting honest anywhere
       it is not, and deliberately over- rather than under-counts by resolving a lone
       surrogate to the 3-byte replacement character. */
    function encodedByteLength(text) {
        const value = String(text ?? '');
        if (typeof TextEncoder === 'function') {
            try { return new TextEncoder().encode(value).length; }
            catch { /* fall through to the manual count */ }
        }
        let bytes = 0;
        for (let index = 0; index < value.length; index += 1) {
            const code = value.codePointAt(index);
            if (code > 0xffff) index += 1;
            if (code < 0x80) bytes += 1;
            else if (code < 0x800) bytes += 2;
            else if (code < 0x10000) bytes += 3;
            else bytes += 4;
        }
        return bytes;
    }

    /* A failed write is announced with three different key shapes: trySaveSetting names
       the setting ('cache_rt_tt1'), while the extension bridge only ever sees the storage
       key it was handed ('imdb_enh_cache_rt_tt1'). Every listener below compares against
       setting names, so the prefix comes off here. Without this the whole extension-side
       recovery path was dead — the one build where a 10 MiB quota makes it likely. */
    function settingKeyFromFailure(key) {
        if (typeof key !== 'string') return '';
        return key.startsWith(PREFIX) ? key.slice(PREFIX.length) : key;
    }
    /* Stripping the prefix widened this: a setting literally named cache_* would now match
       and become an eviction candidate, and readCacheUsage deletes what it classifies as a
       cache key and cannot parse. No such setting exists, and this makes sure one added
       later cannot be silently destroyed by the cache. */
    function isCacheStorageKey(storageKey) {
        const key = settingKeyFromFailure(storageKey);
        return key.startsWith('cache_') && !Object.prototype.hasOwnProperty.call(DEFAULTS, key);
    }

    /* `allowExpired` keeps an entry whose TTL has run out but which is still inside the
       envelope ceiling, marked `expired`. A provider that is briefly unreachable is the
       one case where last week's score is worth more than nothing at all, provided it is
       labelled as old — but only readers that ask for it ever see one. */
    function parseCacheEntry(raw, now = Date.now(), { allowExpired = false } = {}) {
        // .length is a cheap pre-filter only: a string can never encode to fewer bytes
        // than it has code units, so this rejects nothing the byte check would keep.
        if (typeof raw !== 'string' || !raw || raw.length > CACHE_ENTRY_TEXT_LIMIT) return null;
        try {
            const entry = JSON.parse(raw);
            const ts = Number(entry?.ts);
            const ttl = Number(entry?.ttl);
            if (!entry || entry.schema !== CACHE_SCHEMA_VERSION
                || !Number.isFinite(ts) || ts <= 0 || ts > now + 60000
                || !Number.isFinite(ttl) || ttl <= 0 || ttl > CACHE_MAX_TTL) return null;
            const age = now - ts;
            const expired = age > ttl;
            // The ceiling is absolute: a fallback can never be older than the envelope
            // itself is allowed to be, whatever its own shorter TTL was.
            if (expired && (!allowExpired || age > CACHE_MAX_TTL)) return null;
            // Entries written before access stamping fall back to their write time,
            // which orders them correctly against anything newer.
            const rawAccess = Number(entry.at);
            const at = Number.isFinite(rawAccess) && rawAccess > 0 && rawAccess <= now + 60000
                ? rawAccess
                : ts;
            return { ...entry, ts, ttl, at, expired };
        } catch { return null; }
    }

    /* The write path only needs to know whether it is near a ceiling, and answering that
       by parsing up to 120 entries of up to 256 KiB each would put tens of megabytes of
       JSON.parse on every cache write. Sizes come from the raw strings instead; the full
       parsing walk below runs only once that says eviction is actually due. Expired
       entries are counted here, which errs toward evicting slightly early rather than
       overshooting the quota. */
    function measureCacheBytes(excludeKey = null) {
        let bytes = 0;
        let count = 0;
        GM_listValues().forEach(storageKey => {
            if (!isCacheStorageKey(storageKey) || storageKey === excludeKey) return;
            let raw = null;
            try { raw = GM_getValue(storageKey, null); }
            catch { return; }
            if (typeof raw !== 'string' || !raw) return;
            bytes += encodedByteLength(storageKey) + encodedByteLength(raw);
            count += 1;
        });
        return { bytes, count };
    }

    /* One walk of the cache keyspace: total bytes plus every live entry with the access
       stamp eviction orders by. Only `cache_`-prefixed keys are ever inspected, which is
       what keeps settings, private marks, notes, and credentials — all written under
       PREFIX — outside the eviction candidate set by construction rather than by a
       filter someone could later loosen. */
    function readCacheUsage(now = Date.now()) {
        const entries = [];
        let bytes = 0;
        GM_listValues().forEach(storageKey => {
            if (!isCacheStorageKey(storageKey)) return;
            let raw = null;
            try { raw = GM_getValue(storageKey, null); }
            catch { return; }
            if (raw === null || raw === undefined) return;
            // Expired entries are retained as stale-if-error fallbacks until the envelope
            // ceiling, so they are counted here and evicted before any live entry.
            const entry = parseCacheEntry(raw, now, { allowExpired:true });
            if (!entry) {
                try {
                    if (typeof GM_deleteValue === 'function') GM_deleteValue(storageKey);
                } catch { /* best-effort expired/malformed cleanup */ }
                return;
            }
            const size = encodedByteLength(storageKey) + encodedByteLength(raw);
            bytes += size;
            entries.push({ storageKey, ts:entry.ts, at:entry.at, bytes:size, expired:entry.expired });
        });
        return { bytes, entries };
    }

    /* Evict least-recently-accessed first until the cache fits both ceilings. Returns
       the bytes reclaimed so a failed write can tell whether retrying is worth it. */
    function evictCacheEntries(usage, { byteBudget = CACHE_TOTAL_BYTE_BUDGET, maxEntries = CACHE_MAX_ENTRIES } = {}) {
        /* Expired entries go first whatever their access time: they are only kept as a
           fallback for an unreachable provider, so they are worth strictly less than any
           live value competing for the same budget. */
        const ordered = usage.entries.slice().sort((a, b) =>
            (Number(Boolean(b.expired)) - Number(Boolean(a.expired)))
            || (a.at - b.at)
            || (a.ts - b.ts));
        let bytes = usage.bytes;
        let count = ordered.length;
        let reclaimed = 0;
        for (const entry of ordered) {
            if (bytes <= byteBudget && count <= maxEntries) break;
            try {
                if (typeof GM_deleteValue === 'function') GM_deleteValue(entry.storageKey);
                else GM_setValue(entry.storageKey, '');
            } catch { continue; }
            bytes -= entry.bytes;
            reclaimed += entry.bytes;
            count -= 1;
            entry.evicted = true;
        }
        usage.entries = usage.entries.filter(entry => !entry.evicted);
        usage.bytes = bytes;
        return reclaimed;
    }

    let cacheQuotaFailureNotified = false;
    /* A full quota is the one cache failure a user can act on, and it silently cost them
       every score lookup until now. Report it once per page — scrubbed to the byte
       figures, never the key or payload — and hand them the control that fixes it. */
    function reportCacheQuotaFailure(bytes) {
        /* Once per page, journal entry included. Sustained quota pressure rejects a write
           on every lookup, and recording each one filled all 20 journal slots with
           identical rows — evicting the feature failures the journal exists to keep. */
        if (cacheQuotaFailureNotified) return;
        cacheQuotaFailureNotified = true;
        try {
            recordFeatureFailure({ key:'cache' }, 'storage', bytes > 0
                ? `cache write of ${bytes} bytes failed after eviction; storage quota appears full`
                : t('text_a_cache_write_was_rejected_by_storage'));
        } catch { /* the toast below is the part the user needs */ }
        try {
            showToast(t('toast_is_full_so_lookups_are_not', [STORAGE_HOST_LABEL]), 6000);
        } catch { /* console warning already recorded the failure */ }
    }

    /* Under a script manager GM_setValue is synchronous, so cacheSet learns about a full
       quota from the write throwing and evicts and retries right there. The extension
       bridge cannot be synchronous — chrome.storage.local is a promise — so that write
       returns normally and the rejection arrives later. Without this the entire recovery
       path was userscript-only: the extension would report the write as successful, never
       evict, and never tell the user, which is the one build where a 10 MiB quota makes it
       likely. The bridge names the failing key, so only cache failures are handled here;
       settings failures belong to the settings UI. */
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('imdb-enhanced:settings-save-failed', event => {
            const key = event?.detail?.key;
            if (!isCacheStorageKey(key)) return;
            try {
                // The mirror has already rolled the failed entry back, so this measures
                // what is really stored and makes room for the next write.
                evictCacheEntries(readCacheUsage(), {
                    byteBudget: Math.floor(CACHE_TOTAL_BYTE_BUDGET / 4),
                    maxEntries: Math.floor(CACHE_MAX_ENTRIES / 4),
                });
            } catch (error) {
                console.warn('[IMDb Enhanced] cache eviction after a failed write did not complete:', error);
            }
            reportCacheQuotaFailure(0);
        });
    }

    /* Returns a value that is expired but still inside the envelope ceiling, with the
       date it was written, or null. Used only after a lookup failed to reach its service:
       a provider being briefly unreachable is the one case where last week's score beats
       nothing, and only if it is shown as old. An `unavailable` sentinel is never
       returned — "we asked and there was nothing" is not a value worth re-showing. */
    function cacheGetStale(key) {
        try {
            const raw = GM_getValue('cache_' + key, null);
            if (!raw) return null;
            const entry = parseCacheEntry(raw, Date.now(), { allowExpired:true });
            if (!entry || !entry.expired || entry.data?.unavailable) return null;
            return { data: entry.data, ts: entry.ts };
        } catch { return null; }
    }

    function cacheGet(key) {
        try {
            const storageKey = 'cache_' + key;
            const raw = GM_getValue(storageKey, null);
            if (!raw) return null;
            const now = Date.now();
            // Parsed permissively so an expired-but-usable value is left in place for
            // cacheGetStale; deleting it here would destroy the fallback on first read.
            const entry = parseCacheEntry(raw, now, { allowExpired:true });
            if (!entry) {
                if (typeof GM_deleteValue === 'function') GM_deleteValue(storageKey);
                return null;
            }
            if (entry.expired) return null;
            if (now - entry.at >= CACHE_ACCESS_STAMP_INTERVAL) {
                /* parseCacheEntry adds `expired`, which is derived from the clock. Writing
                   the parsed object back put that on disk, where it is meaningless and
                   only grows the envelope. Only the stored fields are re-stamped. */
                const { expired, ...stored } = entry;
                try { GM_setValue(storageKey, JSON.stringify({ ...stored, at:now })); }
                catch { /* the value is still usable; only eviction order degrades */ }
            }
            return entry.data;
        } catch {
            try {
                if (typeof GM_deleteValue === 'function') GM_deleteValue('cache_' + key);
            } catch { /* best-effort malformed cache cleanup */ }
            return null;
        }
    }
    function cacheSet(key, data, ttl = CACHE_TTL) {
        const storageKey = 'cache_' + key;
        let serialized;
        try {
            const now = Date.now();
            serialized = JSON.stringify({ data, ts:now, at:now, ttl, schema:CACHE_SCHEMA_VERSION });
        } catch (error) {
            console.warn('[IMDb Enhanced] cache value could not be serialized:', error);
            return false;
        }
        const entryBytes = encodedByteLength(serialized) + encodedByteLength(storageKey);
        if (entryBytes > CACHE_ENTRY_TEXT_LIMIT) {
            console.warn('[IMDb Enhanced] cache entry exceeded the per-entry storage limit');
            return false;
        }
        /* Make room before writing rather than after: the point of the budget is that
           the write itself stays inside the quota. The cheap measurement decides whether
           that is even necessary, so the parsing walk stays off the common path. A key
           being overwritten is excluded from the total — it is about to be replaced, not
           added to. */
        try {
            const rough = measureCacheBytes(storageKey);
            if (rough.bytes + entryBytes > CACHE_TOTAL_BYTE_BUDGET || rough.count + 1 > CACHE_MAX_ENTRIES) {
                const usage = readCacheUsage();
                const existing = usage.entries.find(entry => entry.storageKey === storageKey);
                if (existing) {
                    usage.bytes -= existing.bytes;
                    usage.entries = usage.entries.filter(entry => entry !== existing);
                }
                evictCacheEntries(usage, {
                    byteBudget: CACHE_TOTAL_BYTE_BUDGET - entryBytes,
                    maxEntries: CACHE_MAX_ENTRIES - 1,
                });
            }
        } catch (error) {
            console.warn('[IMDb Enhanced] cache accounting failed:', error);
        }
        const write = () => {
            GM_setValue(storageKey, serialized);
            cacheWritesSinceGC += 1;
            if (cacheWritesSinceGC >= CACHE_GC_WRITE_INTERVAL) {
                cacheWritesSinceGC = 0;
                cacheGC(true);
            }
            return true;
        };
        try { return write(); }
        catch (error) {
            console.warn('[IMDb Enhanced] cache write failed:', error);
            /* The manager rejected the write even though the accounting said it fits,
               so the real quota is tighter than the budget. Drop to a fraction of it and
               try once; a second failure is the user's to resolve. */
            try {
                evictCacheEntries(readCacheUsage(), {
                    byteBudget: Math.floor(CACHE_TOTAL_BYTE_BUDGET / 4),
                    maxEntries: Math.floor(CACHE_MAX_ENTRIES / 4),
                });
            } catch { /* the retry below still reports honestly */ }
            try { return write(); }
            catch (retryError) {
                console.warn('[IMDb Enhanced] cache write failed after eviction:', retryError);
                reportCacheQuotaFailure(entryBytes);
                return false;
            }
        }
    }
    /* The cache has carried a schema version since v2.6 and rejects entries that do not
       match it. Settings never had one, so a future change to a stored value's shape
       would be silently coerced back to its default by normalizeImportedSetting with no
       record that it happened. Version them, and give migrations one ordered place to
       live instead of the ad hoc one-offs scattered through startup.

       Adding a migration: bump SETTINGS_SCHEMA_VERSION and append { to, run } here. run()
       may throw — the version is only advanced once every pending step has succeeded, so
       a failed migration is retried on the next load rather than skipped. */
    /* A stored watchSites array is a snapshot of whatever the defaults were the first
       time that user saved a site list, and Cineby's default row moved across four
       registrable domains and two paths over this project's history. Matching only the
       newest hostname left anyone who customized their list before 2026-06-20 with a dead
       row that, with storeQuery now stripped, opens a dead homepage with no title. The
       migration runs once, so it gets no second chance to catch them. Every domain the
       row has ever used is matched, with or without a subdomain, and anchored so a
       lookalike host belonging to somebody else is not swept up. */
    const RETIRED_CINEBY_HOST = /(?:^|\.)cineby\.(?:at|sc|gd|app)$/i;
    function isRetiredCinebyUrl(value) {
        try { return RETIRED_CINEBY_HOST.test(new URL(String(value || '')).hostname); }
        catch { return false; }
    }

    /* Not every manager exposes GM_deleteValue. A migration that calls it directly throws
       a ReferenceError, and because the schema marker only advances once every pending
       step has succeeded, that is not a skipped migration — it is the same failure on
       every load, forever. Every migration deletes through this. */
    function dropStoredKey(key) {
        if (typeof GM_deleteValue === 'function') GM_deleteValue(key);
        else GM_setValue(key, '');
    }

    const SETTINGS_SCHEMA_VERSION = 5;
    const SETTINGS_SCHEMA_KEY = 'settingsSchemaVersion';
    /* Describes the export rather than being a setting, so import must skip it the way
       it skips the schema marker — otherwise a redacted backup reports its own manifest
       as an unrecognized field. */
    const EXPORT_REDACTED_KEY = 'redactedCredentialKeys';
    const EXPORT_METADATA_KEYS = new Set([SETTINGS_SCHEMA_KEY, EXPORT_REDACTED_KEY]);
    const SETTINGS_MIGRATIONS = [
        {
            /* v2: the standalone vote-distribution chart is retired. IMDb stopped
               publishing the distribution on title pages, where the widget lived, and
               draws its own chart on the ratings tab, where the data moved — so the
               widget had nowhere left to be useful. Its preference is deleted rather
               than left behind as an orphan key that export would carry forever. */
            to: 2,
            run() { dropStoredKey(`${PREFIX}ratingHistogram`); },
        },
        {
            /* v3: Cineby shut down at the end of August 2026, taking its special-cased
               title handoff with it. The host preference, any pending handoff payload
               (current and legacy key), and stored Cineby rows all go; surviving rows
               are rewritten without the retired storeQuery transport flag so exports
               stop carrying it. */
            to: 3,
            run() {
                dropStoredKey(`${PREFIX}cinebyHost`);
                dropStoredKey(`${PREFIX}cineby_query`);
                dropStoredKey('movieTitle');
                const stored = GM_getValue(`${PREFIX}watchSites`, null);
                if (!Array.isArray(stored)) return;
                const kept = stored
                    .filter(site => !isRetiredCinebyUrl(site?.url))
                    .map(site => {
                        if (!site || typeof site !== 'object' || !('storeQuery' in site)) return site;
                        const { storeQuery, ...rest } = site;
                        return rest;
                    });
                GM_setValue(`${PREFIX}watchSites`, kept);
            },
        },
        {
            /* v4: score identity choices are durable settings rather than cache entries.
               Advancing the schema keeps older builds from partially importing a backup
               whose per-title correction records they cannot preserve. */
            to: 4,
            run() {
                const key = `${PREFIX}scoreCorrections`;
                const stored = GM_getValue(key, null);
                if (stored !== null) GM_setValue(key, normalizeScoreCorrections(stored));
            },
        },
        {
            /* v5: the original watch-site pass accepted a successful homepage response
               as proof that a title query worked. Replace those exact shipped defaults
               in saved lists, and remove catalog homepages that cannot carry any IMDb
               context. Unrelated custom destinations are untouched. */
            to: 5,
            run() {
                const key = `${PREFIX}watchSites`;
                const stored = GM_getValue(key, null);
                if (Array.isArray(stored)) GM_setValue(key, migrateWatchSiteList(stored));
            },
        },
    ];

    function readSettingsSchemaVersion() {
        const stored = Number(GM_getValue(PREFIX + SETTINGS_SCHEMA_KEY, null));
        if (Number.isInteger(stored) && stored > 0) return stored;
        // A store with no marker predates versioning; treat it as the first schema.
        return GM_listValues().some(key => key.startsWith(PREFIX)) ? 1 : SETTINGS_SCHEMA_VERSION;
    }

    function runSettingsMigrations() {
        let from = readSettingsSchemaVersion();
        if (from >= SETTINGS_SCHEMA_VERSION) {
            if (from === SETTINGS_SCHEMA_VERSION) GM_setValue(PREFIX + SETTINGS_SCHEMA_KEY, SETTINGS_SCHEMA_VERSION);
            return from;
        }
        SETTINGS_MIGRATIONS
            .filter(step => step.to > from && step.to <= SETTINGS_SCHEMA_VERSION)
            .sort((a, b) => a.to - b.to)
            .forEach(step => { step.run(); from = step.to; });
        GM_setValue(PREFIX + SETTINGS_SCHEMA_KEY, from);
        return from;
    }

    function cacheSetUnavailable(key) {
        cacheSet(key, { unavailable: true }, CACHE_UNAVAILABLE_TTL);
    }
    /* A lookup that failed because its host access was never granted is not evidence the
       service had nothing for this title. Recording that as "unavailable" for 24 hours
       turns a permission gap the user can fix in a click into a day of wrong answers that
       survive the fix. Where access is missing, nothing is written, so the very next visit
       retries. Always true in the userscript build, which has no optional grants. */
    function isAuthenticationHttpFailure(error) {
        const status = Number(error?.status);
        return status === 401 || status === 403;
    }
    /* Three kinds of failure must not be written down as "this title has no entry there".
       An authentication problem is the user's to fix and the fix should take effect at
       once. A rate limit is the service asking for a pause, and the pause is already held
       by the request layer. A page whose structure has changed has not answered about this
       title at all. All three used to land in the same 24-hour sentinel, so the widget said
       what had actually happened once and then read back a bare "score unavailable" for a
       day — the message both of those changes existed to replace. */
    function isTransientLookupFailure(error, schemaChanged = false) {
        if (schemaChanged) return true;
        if (isAuthenticationHttpFailure(error)) return true;
        return classifyFailure(error) === 'rate_limited';
    }
    async function cacheUnavailableUnlessBlocked(featureKey, cacheKey, error = null, schemaChanged = false) {
        if (!cacheKey) return false;
        /* Fixing a credential or access policy should take effect on the next request.
           A 24-hour unavailable sentinel would preserve the rejected answer long after
           the cause was fixed, so authentication failures never write one. */
        if (isTransientLookupFailure(error, schemaChanged)) return false;
        if (await hasFeatureOrigins(featureKey)) {
            cacheSetUnavailable(cacheKey);
            return false;
        }
        return true;
    }
    /* Module scope because both the Data page and the diagnostics report need it;
       it previously lived inside the settings panel closure. */
    function cacheCount() {
        try {
            return GM_listValues().filter(key =>
                isCacheStorageKey(key) && GM_getValue(key, null) !== null
            ).length;
        }
        catch { return 0; }
    }
    /* Reported on the Data page and in diagnostics so a user can see the cache
       approaching its ceiling rather than only learning about it when a write fails. */
    function cacheBytes() {
        try { return readCacheUsage().bytes; }
        catch { return 0; }
    }
    /* The whole store, not only the cache. Marks and their viewing histories are most of
       it once a library grows, and a Data page that reported the cache alone made a store
       near its own bounds look nearly empty. Counted in UTF-8 bytes, because that is what
       the backend charges for. */
    function storedBytes() {
        try {
            let bytes = 0;
            GM_listValues().forEach(storageKey => {
                if (!String(storageKey).startsWith(PREFIX)) return;
                let raw = null;
                /* Every key through the store, marks included. Reading marks from the cache
                   instead was cheaper and wrong twice over: the cache is only invalidated by
                   this tab's own writes, so a second tab or the options page made the figure
                   stale, and it holds the normalised records rather than what is on disk, so
                   a legacy store of bare string marks reported two and a half times its real
                   size. This walk only runs when somebody opens the dialog, which is what
                   makes paying for it acceptable. */
                try { raw = GM_getValue(storageKey, null); }
                catch { return; }
                if (raw === null || raw === undefined) return;
                /* JSON, including a string's own quotes and escapes, because that is the
                   form the backend stores and charges for. */
                let text = '';
                try { text = JSON.stringify(raw) || ''; }
                catch { return; }
                bytes += encodedByteLength(storageKey) + encodedByteLength(text);
            });
            return bytes;
        }
        catch { return 0; }
    }
    function formatCacheBytes(bytes) {
        const value = Number(bytes) || 0;
        if (value < 1024) return `${value} B`;
        if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
        return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    }
    function cacheGC(force = false) {
        if (cacheGC._ran && !force) return;
        cacheGC._ran = true;
        try {
            const legacySiteHealthKey = PREFIX + 'siteHealth';
            const legacyStorageKeys = [legacySiteHealthKey, PREFIX + 'sonarrLanguageProfileId'];
            if (typeof GM_deleteValue === 'function') {
                legacyStorageKeys.forEach(key => {
                    if (GM_getValue(key, null) !== null) GM_deleteValue(key);
                });
            }
            // readCacheUsage drops expired and malformed entries as it walks, so this
            // only has to enforce the two ceilings on what survived.
            evictCacheEntries(readCacheUsage());
        } catch (e) {
            console.warn('[IMDb Enhanced] cache GC failed:', e);
        }
    }
    /* IMDb's own account-backed Watched control. The captured 2026 desktop DOM
       exposes it as `data-testid="watched-button-tt<id>"` with an accessible
       label of "Mark <title> as watched" while the title is unwatched. Only the
       unwatched wording is confirmed against a live capture, so the reader below
       treats a title as watched exclusively when the control positively says so;
       an unrecognized label is reported as unknown rather than watched. Guessing
       the other way would silently invent Seen marks the user never made. */
    const NATIVE_WATCHED_SELECTOR = '[data-testid^="watched-button-tt"]';
    const NATIVE_WATCHED_ON = /(?:remove\b[^]*\bfrom\s+watched|mark\b[^]*\bas\s+(?:not\s+watched|unwatched)|^\s*watched\s*$)/i;
    const NATIVE_WATCHED_OFF = /mark\b[^]*\bas\s+watched/i;
    const NATIVE_WATCHED_SCAN_LIMIT = 5000;

    function readNativeWatchedControl(button) {
        if (!button) return null;
        const testId = String(button.getAttribute('data-testid') || '');
        const imdbId = /^watched-button-(tt\d{5,12})$/i.exec(testId)?.[1];
        if (!imdbId) return null;
        const label = String(button.getAttribute('aria-label') || '').slice(0, 300);
        const text = String(button.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300);
        let watched = null;
        if (NATIVE_WATCHED_OFF.test(label) || NATIVE_WATCHED_OFF.test(text)) watched = false;
        else if (NATIVE_WATCHED_ON.test(label) || NATIVE_WATCHED_ON.test(text)) watched = true;
        const named = /^mark\s+(.+?)\s+as\s+(?:not\s+)?(?:un)?watched$/i.exec(label)
            || /^remove\s+(.+?)\s+from\s+watched$/i.exec(label);
        return { imdbId, watched, title:named?.[1]?.trim().slice(0, 160) || '' };
    }

    function collectNativeWatchedTitles(scope = document) {
        const found = new Map();
        const buttons = scope?.querySelectorAll?.(NATIVE_WATCHED_SELECTOR) || [];
        let inspected = 0;
        for (const button of buttons) {
            if (++inspected > NATIVE_WATCHED_SCAN_LIMIT) break;
            const state = readNativeWatchedControl(button);
            if (!state || state.watched !== true) continue;
            if (!found.has(state.imdbId)) found.set(state.imdbId, state.title);
        }
        return found;
    }

    /* A record is kept when it carries a Seen/Skip state OR a note. A note without a
       state is a real thing to want — "the one with the twist ending" against a title you
       have not watched — and requiring a state to hold one would silently discard it.

       Version 2 adds bounded viewing events and the metadata used by local statistics.
       A version-1 Seen mark gets one inferred viewing date from its original timestamp;
       imported version-2 rows never invent a date when their CSV does not provide one. */
    const USER_MARK_RECORD_VERSION = 2;
    function normalizeUserMarkRating(value) {
        if (value === '' || value === null || value === undefined) return null;
        const rating = Number(value);
        return Number.isFinite(rating) && rating >= 0.5 && rating <= 10
            ? Math.round(rating * 10) / 10
            : null;
    }
    function normalizeUserMarkYear(value) {
        if (value === '' || value === null || value === undefined) return null;
        const match = String(value).trim().match(/(?:^|\D)(\d{4})(?:\D|$)/);
        const year = match ? Number(match[1]) : Number(value);
        return Number.isSafeInteger(year) && year >= 1874 && year <= new Date().getUTCFullYear() + 5
            ? year
            : null;
    }
    function normalizeUserMarkRuntime(value) {
        if (value === '' || value === null || value === undefined) return null;
        const runtime = Number(value);
        return Number.isSafeInteger(runtime) && runtime > 0 && runtime <= 24 * 60
            ? runtime
            : null;
    }
    function normalizeUserMarkGenres(value) {
        const values = Array.isArray(value) ? value : String(value || '').split(/[,;|]/);
        const genres = [];
        const seen = new Set();
        for (const item of values) {
            const genre = String(item || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, USER_MARK_GENRE_TEXT_LIMIT);
            const key = genre.toLocaleLowerCase();
            if (!genre || seen.has(key)) continue;
            seen.add(key);
            genres.push(genre);
            if (genres.length >= USER_MARK_GENRES_MAX) break;
        }
        return genres;
    }
    function normalizeViewingDate(value) {
        const date = String(value || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
        const parsed = new Date(`${date}T00:00:00.000Z`);
        if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return '';
        return date <= new Date(Date.now() + 86400000).toISOString().slice(0, 10) ? date : '';
    }
    function normalizeViewingEvents(value) {
        if (!Array.isArray(value)) return [];
        const events = [];
        const seen = new Set();
        for (const item of value.slice(-USER_MARK_VIEWINGS_MAX * 2)) {
            const date = normalizeViewingDate(typeof item === 'string' ? item : item?.date);
            if (!date) continue;
            const rating = normalizeUserMarkRating(typeof item === 'object' ? item?.rating : null);
            const key = `${date}\u0000${rating ?? ''}`;
            if (seen.has(key)) continue;
            seen.add(key);
            events.push({ date, ...(rating !== null ? { rating } : {}) });
        }
        return events
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(-USER_MARK_VIEWINGS_MAX);
    }
    function mergeViewingEvents(...sources) {
        return normalizeViewingEvents(sources.flatMap(source => Array.isArray(source) ? source : []));
    }
    function viewingDateFromTimestamp(value) {
        const timestamp = Number(value);
        if (!Number.isFinite(timestamp) || timestamp <= 0 || timestamp > Date.now() + 60000) return '';
        return new Date(timestamp).toISOString().slice(0, 10);
    }
    /* IE-107: which series an episode belongs to. Marks are keyed by the episode's own id
       and carry no way back to the show, so a series page had no way to know that fourteen
       of the records in the store were its own episodes. Recorded when the mark is made,
       from the page that already knows: an episode page names its series in its structured
       data, and the episodes list is the series page.

       Never derived by asking IMDb for anything. A mark made before this shipped does not
       carry it, and the count says only what it can see. */
    function normalizeUserMarkSeries(value) {
        const id = String(value || '').trim();
        return /^tt\d+$/.test(id) ? id : '';
    }

    function mergeUserMarkMetadata(record, metadata) {
        const merged = { ...(record || {}) };
        if (!metadata || typeof metadata !== 'object') return merged;
        const year = normalizeUserMarkYear(metadata.year);
        const genres = normalizeUserMarkGenres(metadata.genres);
        const imdbRating = normalizeUserMarkRating(metadata.imdbRating);
        const runtime = normalizeUserMarkRuntime(metadata.runtime);
        if (year !== null) merged.year = year;
        if (genres.length) merged.genres = normalizeUserMarkGenres([...(merged.genres || []), ...genres]);
        if (imdbRating !== null) merged.imdbRating = imdbRating;
        if (runtime !== null) merged.runtime = runtime;
        const series = normalizeUserMarkSeries(metadata.series);
        if (series) merged.series = series;
        /* This merge is a whitelist, so a field the reader started producing has to be
           named here or it never reaches storage. Without this line the calendar export's
           whole primary path was unreachable: a series marked Seen recorded nothing that
           said it was a series. */
        if (metadata.kind === 'series') merged.kind = 'series';
        return merged;
    }
    function normalizeUserMark(record) {
        if (record === 'watched' || record === 'skip') {
            return { v: USER_MARK_RECORD_VERSION, state: record, title: '', ts: 0 };
        }
        if (!record || typeof record !== 'object') return null;
        const state = record.state === 'watched' || record.state === 'skip' ? record.state : '';
        const note = normalizeUserNote(record.note);
        const timestamp = Number(record.ts);
        const ts = Number.isFinite(timestamp) && timestamp >= 0 && timestamp <= Date.now() + 60000 ? timestamp : 0;
        let viewings = normalizeViewingEvents(record.viewings);
        if (!viewings.length && state === 'watched' && Number(record.v || 1) < USER_MARK_RECORD_VERSION) {
            const inferredDate = viewingDateFromTimestamp(ts);
            if (inferredDate) viewings = [{ date:inferredDate }];
        }
        if (!state && !note && !viewings.length) return null;
        const rating = normalizeUserMarkRating(record.rating);
        const year = normalizeUserMarkYear(record.year);
        const genres = normalizeUserMarkGenres(record.genres);
        const imdbRating = normalizeUserMarkRating(record.imdbRating);
        const runtime = normalizeUserMarkRuntime(record.runtime);
        const series = normalizeUserMarkSeries(record.series);
        // One value or nothing. Anything else a backup carries is dropped rather than kept.
        const kind = record.kind === 'series' ? 'series' : '';
        return {
            v: USER_MARK_RECORD_VERSION,
            state,
            title: String(record.title || '').trim().slice(0, USER_MARK_TITLE_LIMIT),
            ts,
            ...(note ? { note } : {}),
            ...(viewings.length ? { viewings } : {}),
            ...(rating !== null ? { rating } : {}),
            ...(year !== null ? { year } : {}),
            ...(genres.length ? { genres } : {}),
            ...(imdbRating !== null ? { imdbRating } : {}),
            ...(runtime !== null ? { runtime } : {}),
            ...(series ? { series } : {}),
            ...(kind ? { kind } : {}),
        };
    }
    /* Control characters are stripped rather than escaped: a note is rendered as text
       everywhere, and a stray newline run is the only formatting worth keeping. */
    function normalizeUserNote(value) {
        if (typeof value !== 'string') return '';
        return value
            .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
            .replace(/\r\n?/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim()
            .slice(0, USER_MARK_NOTE_LIMIT);
    }
    function normalizeUserMarkEntries(source) {
        const entries = [];
        let inspected = 0;
        for (const id in source) {
            if (!Object.prototype.hasOwnProperty.call(source, id)) continue;
            if (inspected >= USER_MARKS_SCAN_LIMIT) break;
            inspected += 1;
            if (!/^tt\d+$/.test(id)) continue;
            const normalized = normalizeUserMark(source[id]);
            if (normalized) entries.push([id, normalized]);
        }
        return entries
            .sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0))
            .slice(0, USER_MARKS_MAX);
    }
    function getUserMarks(forceRefresh = false) {
        if (forceRefresh) userMarksCache = null;
        if (userMarksCache) return userMarksCache;
        const raw = get('userMarks');
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            userMarksCache = {};
            return userMarksCache;
        }
        userMarksCache = Object.fromEntries(normalizeUserMarkEntries(raw));
        return userMarksCache;
    }
    function setUserMarks(marks, notifyFailure = true) {
        const source = marks && typeof marks === 'object' && !Array.isArray(marks) ? marks : {};
        const normalized = Object.fromEntries(normalizeUserMarkEntries(source));
        if (!trySaveSetting('userMarks', normalized, { notify:notifyFailure })) return false;
        userMarksCache = normalized;
        return true;
    }
    /* Under a script manager a failed write throws and setUserMarks returns false before
       the cache is touched. The extension bridge cannot throw — chrome.storage is async —
       so the write above "succeeds", the cache adopts marks that were never stored, and
       every counter and badge on the page reports them as saved until a reload silently
       loses them. The bridge names the key when the rejection lands; treat that as the
       real result of the write. */
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('imdb-enhanced:settings-save-failed', event => {
            if (settingKeyFromFailure(event?.detail?.key) !== 'userMarks') return;
            userMarksCache = null;
            // Repaint first. A page that still shows the marks as saved is the worse
            // failure, and it must not depend on the toast having somewhere to render.
            try { document.dispatchEvent(new CustomEvent('imdb-enhanced:marks-updated')); }
            catch (error) { console.warn('[IMDb Enhanced] could not request a marks repaint:', error); }
            try {
                showToast(t('toast_your_seen_and_skip_marks_were', [STORAGE_HOST_LABEL]), 6000);
            } catch (error) {
                console.warn('[IMDb Enhanced] could not report a failed marks write:', error);
            }
        });
    }
    function getUserMark(imdbId) {
        return getUserMarks()[imdbId]?.state || '';
    }
    function setUserMark(imdbId, state, title = '', notifyFailure = true, metadata = null) {
        if (!/^tt\d+$/.test(imdbId || '')) return false;
        const marks = { ...getUserMarks(true) };
        const existing = normalizeUserMark(marks[imdbId]) || {};
        const existingNote = normalizeUserNote(existing.note);
        if (state === 'watched' || state === 'skip') {
            const timestamp = Date.now();
            const date = state === 'watched' ? viewingDateFromTimestamp(timestamp) : '';
            marks[imdbId] = {
                ...mergeUserMarkMetadata(existing, metadata || readCurrentTitleMarkMetadata(imdbId)),
                state,
                title: String(title || existing.title || '').trim().slice(0, USER_MARK_TITLE_LIMIT),
                ts:timestamp,
                ...(date ? { viewings:mergeViewingEvents(existing.viewings, [{ date }]) } : {}),
                // Clearing a Seen/Skip mark must not silently discard a note written
                // against the same title.
                ...(existingNote ? { note:existingNote } : {}),
            };
        } else if (existingNote) {
            marks[imdbId] = { ...existing, state:'', ts: Date.now(), note:existingNote };
        } else {
            delete marks[imdbId];
        }
        return setUserMarks(marks, notifyFailure);
    }
    /* IE-105: watching something twice is the ordinary case a Seen mark could not
       describe. Marking it again only moved the one date it held, which is the complaint
       people write to IMDb about their own check-ins. The record has carried a list of
       viewing dates since v2; this is the way to add to it.

       Returns the number of dates held afterwards; 0 when there was nothing to add, and
       null when the write itself was refused. Those are three different things to say and
       one number cannot say them: reporting a rejected write as "already logged today"
       tells somebody their viewing is safe when nothing was stored, and the toast saying
       what really went wrong is wiped out by the one that follows it. */
    function countViewings(record) {
        return normalizeViewingEvents(record?.viewings).length;
    }

    function logAdditionalViewing(imdbId, date = viewingDateFromTimestamp(Date.now()), notifyFailure = true) {
        if (!/^tt\d+$/.test(imdbId || '')) return 0;
        if (!normalizeViewingDate(date)) return 0;
        const marks = { ...getUserMarks(true) };
        const existing = normalizeUserMark(marks[imdbId]);
        // Only against something already marked Seen: a first viewing is the Seen button.
        if (!existing || existing.state !== 'watched') return 0;
        const before = normalizeViewingEvents(existing.viewings);
        /* A second click on the same day is not a second viewing. Compared by date rather
           than by how many survive the merge: at the hundred-date ceiling the oldest is
           dropped to make room, so counting would read a real new viewing as a duplicate.
           Merging alone would not do either, because it keeps a rated and an unrated entry
           for the same day as two. */
        if (before.some(viewing => viewing.date === date)) return 0;
        const viewings = mergeViewingEvents(before, [{ date }]);
        marks[imdbId] = { ...existing, v:USER_MARK_RECORD_VERSION, viewings, ts:Date.now() };
        // Refused. setUserMarks has already said why, and saying anything else erases it.
        if (!setUserMarks(marks, notifyFailure)) return null;
        return viewings.length;
    }

    /* How much of a series has been watched, from marks alone. Counts records that name
       this series and are marked Seen; a Skip is a decision not to watch an episode, and
       counting one as progress would overstate what somebody has actually seen. */
    function countSeenEpisodes(seriesId, marks = getUserMarks()) {
        const id = normalizeUserMarkSeries(seriesId);
        if (!id) return 0;
        return Object.values(marks || {}).filter(record =>
            record?.state === 'watched' && normalizeUserMarkSeries(record.series) === id).length;
    }

    function getUserNote(imdbId) {
        return normalizeUserNote(getUserMarks()[imdbId]?.note);
    }
    /* A note can exist without a Seen/Skip state; clearing the last of both removes the
       record entirely rather than leaving an empty one to be counted and exported. */
    function setUserNote(imdbId, note, title = '', notifyFailure = true) {
        if (!/^tt\d+$/.test(imdbId || '')) return false;
        const marks = { ...getUserMarks(true) };
        const normalized = normalizeUserNote(note);
        const existing = normalizeUserMark(marks[imdbId]) || {};
        if (!normalized && !existing?.state) {
            delete marks[imdbId];
            return setUserMarks(marks, notifyFailure);
        }
        const { note:_oldNote, ...existingWithoutNote } = existing;
        marks[imdbId] = {
            ...existingWithoutNote,
            state: existing?.state || '',
            title: String(title || existing?.title || '').trim().slice(0, USER_MARK_TITLE_LIMIT),
            ts: Date.now(),
            ...(normalized ? { note:normalized } : {}),
        };
        return setUserMarks(marks, notifyFailure);
    }
    function getUserMarkEntries() {
        return Object.entries(getUserMarks()).sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0));
    }

    /* ---- CSV mark export ------------------------------------------------------------
       Asked for verbatim under IMDb's own Watched announcement and absent from the site.
       Two shapes: everything this stores, and the columns Letterboxd's importer reads, so
       the local list is portable to the tracker people move to.

       Two hazards, both handled here rather than left to whoever opens the file. A field
       holding a comma, a quote or a newline is quoted and its quotes doubled, which is
       what RFC 4180 says and what every reader expects. And a field whose first character
       is = + - or @ is a formula to a spreadsheet, not text: someone else's film title
       should not run when the file is opened, so those are prefixed with a tab, which
       spreadsheets treat as text and importers strip. */
    /* Tested against the value as a spreadsheet sees it: leading whitespace is ignored
       when it decides whether a cell is a formula, so a space before an equals sign is
       not a defence. */
    const CSV_FORMULA_LEAD = /^\s*[=+\-@]|^[\t\r]/;
    /* U+2028 and U+2029 end a line for a reader even though they are not \n, and a NUL
       truncates a field in more than one importer. All four are quoted. */
    const CSV_MUST_QUOTE = /["\,\n\r\u2028\u2029\u0000]/;

    function csvField(value) {
        let text = String(value ?? '');
        if (CSV_FORMULA_LEAD.test(text)) text = `\t${text}`;
        return CSV_MUST_QUOTE.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }

    function csvRow(values) {
        return values.map(csvField).join(',');
    }

    /* Everything the local store holds. A row per viewing rather than per title: a record
       keeps every date something was watched on, and a file that carried only the most
       recent one would quietly throw away the rest of somebody's history the first time
       they exported and imported it. The column names are the ones this extension's own
       importer reads, so a file it writes is a file it can read. */
    /* Two rating columns, because a record holds two different ratings and one column
       cannot say which is which. Your Rating is the score given at a particular viewing,
       so it is empty on a row for a viewing that was never scored; Title Rating is the
       one score held against the title. Writing the title's score into every viewing row
       invented a rating for each of them on the way back in. */
    const MARKS_CSV_HEADER = ['Const', 'State', 'Title', 'Year', 'Genres', 'Your Rating',
        'Title Rating', 'IMDb Rating', 'Runtime (mins)', 'Watched Date', 'Marked On', 'Series', 'Note'];

    function buildMarksCsv(entries = getUserMarkEntries()) {
        const rows = [csvRow(MARKS_CSV_HEADER)];
        entries.forEach(([id, record]) => {
            const markedOn = viewingDateFromTimestamp(Number(record?.ts));
            const viewings = Array.isArray(record?.viewings) ? record.viewings : [];
            /* A Seen title with nothing logged against it still happened, and the day it
               was marked is the best date there is. Every other record gets one row, with
               a row per viewing where there are any — including a Skip, which can hold the
               dates it was watched on before somebody decided against a rewatch. */
            const listed = viewings.length ? viewings
                : record?.state === 'watched' && markedOn ? [{ date:markedOn }]
                    : [null];
            listed.forEach(viewing => {
                rows.push(csvRow([
                    id,
                    record?.state || '',
                    record?.title || '',
                    record?.year ?? '',
                    // Semicolons, so a genre list is not a quoted field in every row.
                    (Array.isArray(record?.genres) ? record.genres : []).join('; '),
                    viewing?.rating ?? '',
                    record?.rating ?? '',
                    record?.imdbRating ?? '',
                    record?.runtime ?? '',
                    viewing?.date || '',
                    markedOn,
                    record?.series || '',
                    record?.note || '',
                ]));
            });
        });
        return rows.join('\r\n');
    }

    /* The two columns Letterboxd's importer reads. Only Seen titles: a Skip mark is a
       decision not to watch something, and importing it as watched would be a lie about
       somebody's history. A title with several logged viewings gets a row each, which is
       how Letterboxd records a rewatch. */
    function buildLetterboxdCsv(entries = getUserMarkEntries()) {
        const rows = [csvRow(['imdbID', 'WatchedDate'])];
        entries.forEach(([id, record]) => {
            if (record?.state !== 'watched') return;
            const dates = (Array.isArray(record.viewings) ? record.viewings : [])
                .map(viewing => String(viewing?.date || ''))
                .filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date));
            const fallback = viewingDateFromTimestamp(Number(record?.ts));
            const listed = dates.length ? dates : (fallback ? [fallback] : ['']);
            [...new Set(listed)].forEach(date => rows.push(csvRow([id, date])));
        });
        return rows.join('\r\n');
    }

    /* ---- Calendar export ------------------------------------------------------------
       IE-155: Simkl puts calendar sync behind its paid tier and TV Time closed in June
       2026, which leaves people who want the next episode in their own calendar with
       nowhere to get it. TVmaze is already a declared provider here, it is keyless, and it
       publishes every episode's air date for a show by IMDb id. The file is written on the
       device and handed straight to whatever calendar the person already uses.

       RFC 5545, properly: every line folded at 75 octets, every text value escaped, and
       one all-day VEVENT per episode. A calendar that refuses the file is worse than no
       file, and the escaping rules are exactly where a hand-written writer goes wrong. */
    const ICS_FOLD_OCTETS = 75;
    const ICS_TEXT_LIMIT = 300;
    const CALENDAR_SERIES_LIMIT = 20;

    /* Order matters: the backslash has to be doubled before anything else introduces one,
       or the escapes added below get escaped again. */
    function icsText(value) {
        /* Cut rather than dropped: toBoundedText returns nothing at all past its limit,
           which would have silently emptied a SUMMARY instead of shortening it. And the C0
           range is stripped, because RFC 5545 forbids it in a TEXT value and an episode
           name comes from a third party. */
        return String(value ?? '')
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
            .slice(0, ICS_TEXT_LIMIT)
            .replace(/\\/g, '\\\\')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,')
            .replace(/\r\n|\r|\n/g, '\\n');
    }

    /* Folded by octet, not by character: RFC 5545 counts bytes, and a line split in the
       middle of a multi-byte character is a line no parser can put back together. */
    function icsFold(line) {
        const encoder = new TextEncoder();
        const out = [];
        let current = '';
        let bytes = 0;
        for (const character of String(line)) {
            const size = encoder.encode(character).length;
            // One octet of the continuation's leading space is spent on every folded line.
            if (bytes + size > (out.length ? ICS_FOLD_OCTETS - 1 : ICS_FOLD_OCTETS)) {
                out.push(current);
                current = '';
                bytes = 0;
            }
            current += character;
            bytes += size;
        }
        out.push(current);
        return out.map((part, index) => (index ? ` ${part}` : part)).join('\r\n');
    }

    function icsDate(value) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
        return match ? `${match[1]}${match[2]}${match[3]}` : '';
    }

    function icsDayAfter(value) {
        const stamp = Date.parse(`${value}T00:00:00Z`);
        if (!Number.isFinite(stamp)) return '';
        return icsDate(new Date(stamp + 86400000).toISOString().slice(0, 10));
    }

    function icsStamp(now) {
        return `${new Date(now).toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
    }

    /* One all-day event per episode. DTEND is the day after DTSTART because an all-day
       VEVENT's end is exclusive - writing the same date makes a zero-length event that
       some calendars drop and others draw wrong. */
    function buildEpisodeCalendar(shows, now = Date.now()) {
        const stamp = icsStamp(now);
        const lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            `PRODID:-//IMDb Enhanced//${VERSION}//EN`,
            'CALSCALE:GREGORIAN',
            /* No METHOD. RFC 5546 makes ORGANIZER required alongside PUBLISH, and this
               file has no organizer to name: it is a published calendar, not an
               invitation. A plain VCALENDAR needs neither and importers stop warning. */
            `X-WR-CALNAME:${icsText(t('text_calendar_name'))}`,
        ];
        let events = 0;
        (Array.isArray(shows) ? shows : []).forEach(show => {
            const title = toBoundedText(show?.title, ICS_TEXT_LIMIT) || String(show?.id || '');
            (Array.isArray(show?.episodes) ? show.episodes : []).forEach(episode => {
                const start = icsDate(episode?.airdate);
                const end = start ? icsDayAfter(episode.airdate) : '';
                if (!start || !end) return;
                const season = Number(episode?.season) || 0;
                const number = Number(episode?.number) || 0;
                const code = season && number
                    ? `S${String(season).padStart(2, '0')}E${String(number).padStart(2, '0')}`
                    : '';
                const name = toBoundedText(episode?.name, ICS_TEXT_LIMIT);
                const summary = [title, code, name].filter(Boolean).join(' ');
                lines.push(
                    'BEGIN:VEVENT',
                    /* Stable across exports, so re-importing updates the event a person
                       already has rather than adding a second copy of it. */
                    `UID:imdb-enhanced-${show?.id || 'unknown'}-${season}-${number}@imdb-enhanced`,
                    `DTSTAMP:${stamp}`,
                    /* Both, because a stable UID on its own is not enough: with no
                       SEQUENCE and no LAST-MODIFIED, a re-import of the same UID reads as
                       unchanged, which is exactly wrong in the one case that matters -
                       TVmaze moving an air date. */
                    `LAST-MODIFIED:${stamp}`,
                    `SEQUENCE:${Math.floor(now / 86400000)}`,
                    `DTSTART;VALUE=DATE:${start}`,
                    `DTEND;VALUE=DATE:${end}`,
                    `SUMMARY:${icsText(summary)}`,
                    /* TVmaze's data is CC BY-SA and the credit is a condition of using it,
                       so it travels inside the file rather than only being shown here. */
                    `DESCRIPTION:${icsText(t('provider_tvmaze_attribution'))}`,
                    'TRANSP:TRANSPARENT',
                    'END:VEVENT'
                );
                events += 1;
            });
        });
        lines.push('END:VCALENDAR');
        return { events, text: `${lines.map(icsFold).join('\r\n')}\r\n` };
    }

    /* Which series to ask about. Two sources, both things the store actually knows rather
       than guesses: a title marked Seen on a series page records that it was a series, and
       an episode marked Seen records the series it belongs to. Newest first, so a bounded
       export covers what somebody is watching now. */
    function collectSeenSeriesIds(marks = getUserMarks(), limit = CALENDAR_SERIES_LIMIT) {
        const found = new Map();
        const entries = Object.entries(marks || {})
            .filter(([, record]) => record?.state === 'watched')
            .sort((a, b) => (Number(b[1]?.ts) || 0) - (Number(a[1]?.ts) || 0));
        for (const [id, record] of entries) {
            /* Set, not set-if-absent: a series first reached through one of its episodes
               is recorded with no title, and the mark on the show itself is the only thing
               that carries the name. Skipping it left every exported event summarised as a
               raw tt id. */
            if (record.kind === 'series') {
                const title = String(record.title || '').trim().slice(0, USER_MARK_TITLE_LIMIT);
                if (title || !found.has(id)) found.set(id, title);
            }
            const series = normalizeUserMarkSeries(record.series);
            if (series && !found.has(series)) found.set(series, '');
            /* Checked after both, since one pass can add two. Without the slice below a
               run could return twenty-one. */
            if (found.size >= limit) break;
        }
        return [...found.entries()].slice(0, limit).map(([id, title]) => ({ id, title }));
    }
