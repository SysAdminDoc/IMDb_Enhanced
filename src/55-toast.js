    // =========================================================================
    //  TOAST
    // =========================================================================
    /* Screen readers announce changes to a live region that is already in the
       accessibility tree; inserting a node that *is* the region is unreliable. Every
       non-visual confirmation in the product goes through showToast, so the region is
       created once and only its text changes. The visible toast stays a separate,
       aria-hidden element so its enter/exit animation cannot disturb announcements. */
    let toastTimers = [];
    function ensureToastAnnouncer() {
        const existing = document.getElementById('enh-toast-announcer');
        if (existing) return existing;
        if (!document.body) return null;
        const announcer = makeEl('div', {
            id:'enh-toast-announcer', role:'status', 'aria-live':'polite', 'aria-atomic':'true',
        });
        document.body.appendChild(announcer);
        return announcer;
    }

    /* Score widgets resolve long after the page settles and are rebuilt in place, so
       they cannot host their own live region — a region only speaks if it already
       existed in the accessibility tree when its text changed. One persistent
       announcer, created up front, reports each result as it lands. */
    /* An unpacked extension has no update mechanism — Chrome only allows off-store
       hosting on Linux — so the build that cannot update itself at least says so.
       The service worker records what the published userscript reports; this only
       reads that record. The userscript build never runs any of it. */
    function getUpdateNotice() {
        if (!IS_EXTENSION_BUILD || get('updateNotice') === false) return null;
        const state = GM_getValue(PREFIX + 'updateState', null);
        if (!state || typeof state !== 'object' || !state.available) return null;
        const latest = String(state.latest || '').slice(0, 20);
        if (!/^[0-9]+(?:\.[0-9]+){0,3}$/.test(latest)) return null;
        return latest === String(get('updateDismissedVersion') || '') ? null : latest;
    }

    function showUpdateNotice() {
        const latest = getUpdateNotice();
        if (!latest || document.getElementById('enh-update-notice') || !document.body) return;
        const notice = makeEl('div', { id:'enh-update-notice', role:'status' },
            makeEl('span', {}, t('text_update_available', [latest, VERSION])),
            makeEl('a', {
                className:'enh-update-notice__link',
                href:'https://github.com/SysAdminDoc/IMDb_Enhanced/releases',
                target:'_blank', rel:'noopener noreferrer',
            }, t('text_get_it')),
            makeEl('button', {
                type:'button', className:'enh-update-notice__dismiss', 'aria-label':t('aria_dismiss_the_update_notice', [latest]),
                onClick: () => {
                    trySaveSetting('updateDismissedVersion', latest, { notify:false });
                    document.getElementById('enh-update-notice')?.remove();
                },
            }, t('label_dismiss'))
        );
        document.body.appendChild(notice);
    }

    /* IE-114: nothing on the page says this is installed. An unpacked extension has no
       store listing to explain the gear button, and a userscript has none either, so the
       first covered page a new install renders is the only chance to say where the
       settings are. Once, then never again.

       Deliberately not a toast: a toast cannot be clicked away (it sits over the page
       with pointer-events off so it never swallows a click meant for IMDb) and 2.5
       seconds is not long enough to read something you have never seen. This is the
       shape the update notice already uses. */
    const FIRST_RUN_KEY = 'firstRunSeen';
    const FIRST_RUN_NOTICE_MS = 12000;

    /* Kept out of DEFAULTS on purpose. Resetting settings restores every default, which
       would make this a "reset your settings to see the welcome again" button; wiping
       storage removes it along with everything else, which is a new install and should
       greet somebody again. */
    function firstRunNoticeSeen() {
        try { return GM_getValue(PREFIX + FIRST_RUN_KEY, false) === true; }
        catch { return true; }
    }

    function showFirstRunNotice() {
        if (firstRunNoticeSeen()) return;
        if (!document.body || document.getElementById('enh-first-run')) return;
        /* It points at the gear button, so it waits for one. Ordering this after the
           button is created in init would do the same thing until somebody moved a line;
           asking for the thing being pointed at cannot be reordered wrong. */
        if (!document.getElementById('enh-settings-fab')) return;
        // One corner, one message: the update notice is already there and says more.
        if (document.getElementById('enh-update-notice')) return;
        /* Recorded before it is shown. A page closed while the notice was up has still
           had the notice, and if the write cannot land there is nothing that remembers
           anything, so saying it again is the honest result rather than a bug. */
        try { GM_setValue(PREFIX + FIRST_RUN_KEY, true); }
        catch (error) { console.warn('[IMDb Enhanced] could not record the first run:', error); }

        const dismiss = () => document.getElementById('enh-first-run')?.remove();
        const notice = makeEl('div', { id:'enh-first-run', role:'status' },
            makeEl('span', {}, t('text_first_run_active')),
            makeEl('button', {
                type:'button', className:'enh-update-notice__dismiss',
                'aria-label':t('aria_dismiss_the_welcome_notice'),
                onClick: dismiss,
            }, t('label_dismiss'))
        );
        document.body.appendChild(notice);
        // Goes away on its own for anybody who read it and carried on scrolling.
        setTimeout(dismiss, FIRST_RUN_NOTICE_MS);
    }

    function ensureScoreAnnouncer() {
        const existing = document.getElementById('enh-score-announcer');
        if (existing) return existing;
        if (!document.body) return null;
        const announcer = makeEl('div', {
            id:'enh-score-announcer', role:'status', 'aria-live':'polite', 'aria-atomic':'true',
        });
        document.body.appendChild(announcer);
        return announcer;
    }

    function announceScore(source, value) {
        const announcer = ensureScoreAnnouncer();
        if (!announcer) return;
        announcer.textContent = value ? `${source}: ${value}` : `${source} unavailable`;
    }

    function showToast(msg, duration = 2500) {
        const message = String(msg ?? '');
        toastTimers.splice(0).forEach(clearTimeout);
        const announcer = ensureToastAnnouncer();
        if (announcer) announcer.textContent = message;

        document.getElementById('enh-toast')?.remove();
        if (!document.body) return;
        const t = makeEl('div', { id:'enh-toast', 'aria-hidden':'true' }, message);
        document.body.appendChild(t);
        /* The toast carries the highest z-index in the script on purpose, and the top
           layer paints above every z-index there is — so the moment anything else was
           promoted, a toast raised while it was open went behind it. Promoted last, it
           is on top of the top layer too. Nothing is lost where popovers are unsupported:
           the z-index still decides it there. */
        showInTopLayer(t);
        requestAnimationFrame(() => t.classList.add('visible'));
        toastTimers.push(setTimeout(() => {
            t.classList.remove('visible');
            toastTimers.push(setTimeout(() => {
                t.remove();
                if (announcer) announcer.textContent = '';
            }, 350));
        }, duration));
    }

    function trySaveSetting(key, value, { notify = true } = {}) {
        try { return set(key, value); }
        catch (error) {
            if (notify) {
                console.warn(`[IMDb Enhanced] setting write failed (${key}):`, error);
                showToast(t('toast_could_not_save_locally_check_permissions', [STORAGE_HOST_LABEL]), 4500);
            }
            try { document.dispatchEvent(new CustomEvent('imdb-enhanced:settings-save-failed', { detail:{ key } })); }
            catch { /* the write result is still returned to its control */ }
            return false;
        }
    }

    function copyTextToClipboard(text) {
        try {
            GM_setClipboard(String(text ?? ''));
            return true;
        } catch (error) {
            console.warn('[IMDb Enhanced] clipboard write failed:', error);
            return false;
        }
    }

    /* Userscript managers write the clipboard synchronously, so a failure is already
       the thrown value above. The extension build can only learn of a refusal after
       the call returned true, so it announces the one that actually failed. Host-gated:
       only IMDb owns this presentation layer. */
    if (isIMDbHost()) {
        document.addEventListener('imdb-enhanced:clipboard-failed', () => {
            showToast(COPY_FAILURE_MESSAGE, 4500);
        });
    }

