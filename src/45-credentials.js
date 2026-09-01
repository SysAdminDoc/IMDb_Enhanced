    // =========================================================================
    //  ENCRYPTED CREDENTIAL BACKUP
    // =========================================================================
    /* Versioned so a future parameter change (iteration count, cipher) can be detected
       rather than silently mis-derived. Salt and nonce are generated per export: reusing
       either across two backups of the same passphrase is what breaks AES-GCM. */
    const BACKUP_ENVELOPE_KEY = 'imdbEnhancedEncryptedBackup';
    const BACKUP_ENVELOPE_VERSION = 1;
    /* OWASP's current PBKDF2-SHA256 recommendation. The envelope records the cost it
       was written with and the reader accepts a wide range, so raising this strands no
       existing backup: an older one derives at its own recorded count. */
    const BACKUP_KDF_ITERATIONS = 600000;
    const BACKUP_SALT_BYTES = 16;
    const BACKUP_IV_BYTES = 12;
    const BACKUP_MIN_PASSPHRASE_LENGTH = 8;

    function getCryptoSubtle() {
        const provider = typeof crypto !== 'undefined' ? crypto : null;
        if (!provider?.subtle || typeof provider.getRandomValues !== 'function') {
            throw failure('unknown', t('error_backup_no_web_crypto'));
        }
        return provider;
    }

    function bytesToBase64(bytes) {
        let binary = '';
        // Chunked: spreading a large array into String.fromCharCode overflows the stack.
        for (let index = 0; index < bytes.length; index += 8192) {
            binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
        }
        return btoa(binary);
    }

    function base64ToBytes(text) {
        const binary = atob(String(text || ''));
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
        return bytes;
    }

    async function deriveBackupKey(provider, passphrase, salt, iterations) {
        const material = await provider.subtle.importKey(
            'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']
        );
        return provider.subtle.deriveKey(
            { name:'PBKDF2', salt, iterations, hash:'SHA-256' },
            material,
            { name:'AES-GCM', length:256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    async function createEncryptedBackup(passphrase) {
        const secret = String(passphrase ?? '');
        if (secret.length < BACKUP_MIN_PASSPHRASE_LENGTH) {
            throw new Error(`Use a passphrase of at least ${BACKUP_MIN_PASSPHRASE_LENGTH} characters.`);
        }
        const provider = getCryptoSubtle();
        const salt = provider.getRandomValues(new Uint8Array(BACKUP_SALT_BYTES));
        const iv = provider.getRandomValues(new Uint8Array(BACKUP_IV_BYTES));
        const key = await deriveBackupKey(provider, secret, salt, BACKUP_KDF_ITERATIONS);
        const plaintext = new TextEncoder().encode(JSON.stringify(getExportSettings({ includeCredentials:true })));
        const ciphertext = new Uint8Array(await provider.subtle.encrypt({ name:'AES-GCM', iv }, key, plaintext));
        return JSON.stringify({
            [BACKUP_ENVELOPE_KEY]: BACKUP_ENVELOPE_VERSION,
            kdf: { name:'PBKDF2', hash:'SHA-256', iterations:BACKUP_KDF_ITERATIONS, salt:bytesToBase64(salt) },
            cipher: { name:'AES-GCM', iv:bytesToBase64(iv) },
            ciphertext: bytesToBase64(ciphertext),
        }, null, 2);
    }

    function isEncryptedBackup(data) {
        return Boolean(data && typeof data === 'object' && !Array.isArray(data)
            && Object.prototype.hasOwnProperty.call(data, BACKUP_ENVELOPE_KEY));
    }

    /* Returns the decrypted settings object. Every failure here — wrong passphrase, a
       tampered ciphertext, an envelope from a future build — throws before the caller
       reaches prepareSettingsImport, so nothing is ever partially applied. AES-GCM
       authenticates, so tampering fails as a decryption error rather than as garbage. */
    async function readEncryptedBackup(data, passphrase) {
        const version = Number(data?.[BACKUP_ENVELOPE_KEY]);
        if (!Number.isInteger(version) || version < 1) throw failure('unknown', t('error_backup_unrecognized'));
        if (version > BACKUP_ENVELOPE_VERSION) {
            throw new Error(`This encrypted backup was written by a newer version of IMDb Enhanced (format ${version}). Update first, then import.`);
        }
        const kdf = data.kdf || {};
        const cipher = data.cipher || {};
        if (kdf.name !== 'PBKDF2' || kdf.hash !== 'SHA-256' || cipher.name !== 'AES-GCM') {
            throw failure('selector', t('error_backup_unsupported_parameters'));
        }
        const iterations = Number(kdf.iterations);
        if (!Number.isInteger(iterations) || iterations < 1000 || iterations > 5000000) {
            throw failure('unknown', t('error_backup_bad_kdf_cost'));
        }
        const secret = String(passphrase ?? '');
        if (!secret) throw failure('unknown', t('error_backup_passphrase_required'));
        const provider = getCryptoSubtle();
        let salt;
        let iv;
        let ciphertext;
        try {
            salt = base64ToBytes(kdf.salt);
            iv = base64ToBytes(cipher.iv);
            ciphertext = base64ToBytes(data.ciphertext);
        } catch { throw failure('parse', t('error_backup_malformed')); }
        if (salt.length < 8 || iv.length !== BACKUP_IV_BYTES || !ciphertext.length) {
            throw failure('parse', t('error_backup_malformed'));
        }
        const key = await deriveBackupKey(provider, secret, salt, iterations);
        let plaintext;
        try {
            plaintext = await provider.subtle.decrypt({ name:'AES-GCM', iv }, key, ciphertext);
        } catch {
            throw failure('unknown', t('error_backup_wrong_passphrase'));
        }
        try { return JSON.parse(new TextDecoder().decode(plaintext)); }
        catch { throw failure('parse', t('error_backup_not_settings_json')); }
    }

    function applySettingsImport(entries) {
        let snapshots;
        try {
            const storedKeys = typeof GM_listValues === 'function' ? new Set(GM_listValues()) : null;
            snapshots = new Map(entries.map(({ key }) => [key, {
                exists:storedKeys ? storedKeys.has(PREFIX + key) : true,
                value:get(key),
            }]));
        } catch {
            throw failure('unknown', t('error_settings_unreadable'));
        }

        const touched = [];
        try {
            entries.forEach(({ key, value }) => {
                touched.push(key);
                GM_setValue(PREFIX + key, value);
            });
        } catch (cause) {
            let rollbackFailed = false;
            [...touched].reverse().forEach(key => {
                try {
                    const snapshot = snapshots.get(key);
                    if (!snapshot.exists && typeof GM_deleteValue === 'function') GM_deleteValue(PREFIX + key);
                    else GM_setValue(PREFIX + key, snapshot.value);
                }
                catch { rollbackFailed = true; }
            });
            console.warn('[IMDb Enhanced] settings import write failed:', cause);
            try { document.dispatchEvent(new CustomEvent('imdb-enhanced:settings-save-failed')); }
            catch { /* rollback result is reported by the caller */ }
            throw new Error(rollbackFailed
                ? t('error_import_recovery_incomplete')
                : t('error_import_rolled_back'));
        }

        entries.forEach(({ key }) => {
            if (key === 'userMarks') userMarksCache = null;
            try {
                document.dispatchEvent(new CustomEvent('imdb-enhanced:settings-saved', { detail:{ key } }));
            } catch { /* persistence succeeded; notification is best-effort */ }
        });
        return entries.length;
    }

    function getSiteList(key, defaults) {
        const value = get(key);
        const fallbackCategory = key === 'watchSites' ? 'watch' : 'other';
        if (Array.isArray(value)) {
            const current = key === 'watchSites' ? migrateWatchSiteList(value) : value;
            return current.slice(0, SITE_LIST_LIMIT).map(site => normalizeSite(site, '#6366f1', fallbackCategory)).filter(Boolean);
        }
        return defaults.slice(0, SITE_LIST_LIMIT).map(site => normalizeSite(site, '#6366f1', fallbackCategory)).filter(Boolean);
    }

    function setSiteList(key, sites, notifyFailure = true) {
        const fallbackCategory = key === 'watchSites' ? 'watch' : 'other';
        const normalized = sites.slice(0, SITE_LIST_LIMIT).map(site => normalizeSite(site, '#6366f1', fallbackCategory)).filter(Boolean);
        return trySaveSetting(key, normalized, { notify:notifyFailure });
    }

    function getLinkContext(title = getTitleText(), imdbId = getIMDbID(), year = getTitleYear()) {
        const rawTitle = title || '';
        return {
            TITLE: encodeURIComponent(rawTitle),
            TITLE_RAW: rawTitle,
            TITLE_DASH: encodeURIComponent(rawTitle.replace(/\s+/g, '-')),
            TITLE_SLUG: rawTitle.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-'),
            IMDB_ID: imdbId || '',
            IMDB_NUM: (imdbId || '').replace(/^tt/, ''),
            TRAKT_TYPE: isTVType() ? 'show' : 'movie',
            YEAR: year || '',
        };
    }

    function getWatchSearchTitle(fallbackTitle = getTitleText(), ld = getLDData(), root = document) {
        if (getStructuredMediaType(ld) !== 'episode') return fallbackTitle || '';
        const structuredSeries = [
            ld?.partOfSeries?.name,
            ld?.partOfSeason?.partOfSeries?.name,
        ].find(value => typeof value === 'string' && value.trim());
        if (structuredSeries) return structuredSeries.trim();
        const linkedSeries = root?.querySelector?.(
            '[data-testid="hero-title-block__series-link"], a[data-testid*="series"][href*="/title/tt"]'
        )?.textContent?.trim();
        return linkedSeries || fallbackTitle || '';
    }

    function getWatchLinkContext(title = getTitleText(), imdbId = getIMDbID(), year = getTitleYear()) {
        return getLinkContext(getWatchSearchTitle(title), imdbId, year);
    }

    function applyLinkTemplate(template, ctx) {
        return String(template || '').replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => ctx[key] ?? '');
    }
