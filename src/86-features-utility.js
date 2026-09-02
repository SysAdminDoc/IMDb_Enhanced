    // #########################################################################
    //
    //  UTILITY FEATURES
    //
    // #########################################################################

    reg({
        key: 'watchlistBatch', name: t('feature_watchlistBatch_name'), group: 'Utility',
        init() {
            if (!/\/user\/[^/]+\/watchlist/i.test(location.pathname)) return;
            if (document.getElementById('enh-watchlist-copy')) return;
            addThemedCSS(t => `
                #enh-watchlist-copy {
                    position: sticky; top: 72px; z-index: 30;
                    display: inline-flex; align-items: center; justify-content: center;
                    min-height: 34px; margin: 12px 0; padding: 0 14px;
                    border-radius: 8px; border: 1px solid ${t.accentBorder};
                    background: ${t.accentMuted}; color: ${t.accent};
                    font: 800 12px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    cursor: pointer; box-shadow: ${t.sh1};
                }
                #enh-watchlist-copy:hover { background: ${t.sf2}; transform: translateY(-1px); }
            `, 'enh-watchlistBatch');

            const btn = makeEl('button', {
                id:'enh-watchlist-copy',
                type:'button',
                onClick: () => {
                    const ids = this._ids();
                    if (!ids.length) { showToast(t('toast_no_imdb_title_ids_found')); return; }
                    if (!copyTextToClipboard(ids.join('\n'))) {
                        showToast(COPY_FAILURE_MESSAGE, 4500);
                        return;
                    }
                    showToast(t('toast_copied_imdb_ids', [ids.length]));
                    btn.textContent = t('text_copy_imdb_ids', [ids.length]);
                },
            }, t('text_copy_imdb_ids', [this._ids().length || t('text_all_of_them')]));

            const target = document.querySelector('main') || document.body;
            target.insertBefore(btn, target.firstElementChild || null);
        },
        _ids() {
            return getListTitleIdsFromLinks(document.querySelectorAll('a[href*="/title/tt"]'));
        },
        destroy() {
            removeCSS('enh-watchlistBatch');
            document.getElementById('enh-watchlist-copy')?.remove();
        }
    });

    function isListPage() {
        return /\/(watchlist|list\/|chart\/)/i.test(location.pathname);
    }

    /* IMDb renders each collection row's metadata as a short inline list — year, runtime,
       certificate — under `cli-title-metadata`. That class is one of IMDb's stable
       `cli-*` component names; the wrapper beside it is a hashed styled-components class
       and deliberately not used. Verified against /chart/top/ and /chart/toptv/ on
       2026-08-31: a film row reads ["1994", "2h 22m", "R"] while a series row reads
       ["2008–2013", "TV-MA", "TV Series"] with no runtime at all. Series therefore make a
       list legitimately partial rather than broken, which is why the summary says so
       rather than quietly under-reporting. */
    const COLLECTION_METADATA_SELECTOR = '.cli-title-metadata';
    const RUNTIME_PATTERN = /^(?:(\d{1,2})\s*h)?\s*(?:(\d{1,3})\s*m)?$/i;

    function parseRuntimeMinutes(text) {
        const value = String(text || '').trim();
        if (!value) return 0;
        const match = RUNTIME_PATTERN.exec(value);
        // Both groups absent means the pattern matched the empty string, which every
        // non-runtime cell (a year, a certificate) would also do.
        if (!match || (!match[1] && !match[2])) return 0;
        const minutes = (Number(match[1] || 0) * 60) + Number(match[2] || 0);
        // A single row cannot plausibly exceed a day; anything that does is a misparse.
        return Number.isFinite(minutes) && minutes > 0 && minutes <= 24 * 60 ? minutes : 0;
    }

    function summarizeCollectionRuntime(rows) {
        let counted = 0;
        let missing = 0;
        let minutes = 0;
        let inspected = 0;
        for (const row of rows || []) {
            if (inspected >= COLLECTION_LINK_SCAN_LIMIT) break;
            inspected += 1;
            const cells = row.querySelectorAll?.(`${COLLECTION_METADATA_SELECTOR} li, ${COLLECTION_METADATA_SELECTOR} span`) || [];
            let rowMinutes = 0;
            for (const cell of cells) {
                rowMinutes = parseRuntimeMinutes(cell.textContent);
                if (rowMinutes) break;
            }
            if (rowMinutes) { counted += 1; minutes += rowMinutes; }
            else missing += 1;
        }
        return { counted, missing, minutes, total:counted + missing };
    }

    function formatRuntimeTotal(minutes) {
        const whole = Math.max(0, Math.round(Number(minutes) || 0));
        const hours = Math.floor(whole / 60);
        return `${hours}:${String(whole % 60).padStart(2, '0')}`;
    }

    function describeCollectionRuntime(summary) {
        if (!summary.total) return '';
        const titles = tCount('text_title_count', summary.total);
        if (!summary.counted) return t('text_runtime_none_listed', [titles]);
        const total = t('text_runtime_total', [formatRuntimeTotal(summary.minutes)]);
        // Naming the shortfall matters more than the number: a list of series would
        // otherwise report a confidently wrong total.
        return summary.missing
            ? t('text_runtime_partial', [titles, total, summary.counted, summary.missing])
            : t('text_runtime_complete', [titles, total]);
    }

    function getListTitleIdsFromLinks(links) {
        const ids = new Set();
        let inspected = 0;
        for (const link of links || []) {
            if (inspected >= COLLECTION_LINK_SCAN_LIMIT) break;
            inspected += 1;
            const id = getLinkedTitleId(link.href);
            if (id) ids.add(id);
        }
        return [...ids];
    }

    function getListTitlesFromLinks(links) {
        const seen = new Set();
        const titles = [];
        let inspected = 0;
        for (const link of links || []) {
            if (inspected >= COLLECTION_LINK_SCAN_LIMIT || titles.length >= LIST_SEARCH_TITLE_LIMIT) break;
            inspected += 1;
            const id = getLinkedTitleId(link.href);
            if (!id || seen.has(id)) continue;
            const textEl = link.querySelector('[class*="title"]') || link;
            const name = (textEl.textContent || '').trim().replace(/\s+/g, ' ')
                .replace(/^\d+\.\s+/, '').slice(0, 120);
            if (!name) continue;
            seen.add(id);
            titles.push({ id, name });
        }
        return titles;
    }

    function getListTitles() {
        return getListTitlesFromLinks(document.querySelectorAll('a[href*="/title/tt"]'));
    }

    function buildListSearchEntries(site, titles) {
        return titles.slice(0, LIST_SEARCH_TITLE_LIMIT).map(title => ({
            ...title,
            url: applyLinkTemplate(site.url, getLinkContext(title.name, title.id, '')),
        }));
    }

    reg({
        key: 'listRuntimeSummary', name: t('feature_listRuntimeSummary_name'), group: 'Utility',
        init() {
            if (!isListPage()) return;
            if (document.getElementById('enh-runtime-summary')) return;
            const isCurrent = createFeatureGuard(this);

            addThemedCSS(t => `
                #enh-runtime-summary {
                    display: block; margin: 6px 0 10px;
                    color: ${t.tx2};
                    font: 600 12px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }
                #enh-runtime-summary:empty { display: none; }
                .enh-runtime-summary__partial { color: ${t.tx3}; font-weight: 500; }
            `, 'enh-runtime-summary-css');

            const summary = makeEl('div', {
                id:'enh-runtime-summary', role:'status', 'aria-live':'polite', 'aria-atomic':'true',
            });
            const rowsOf = () => document.querySelectorAll('li.ipc-metadata-list-summary-item');
            const paint = () => {
                if (!isCurrent()) return;
                /* Guarded: this node sits inside the subtree the observer below watches,
                   and an unguarded textContent write would re-trigger that observer on
                   every frame forever. */
                setTextIfChanged(summary, describeCollectionRuntime(summarizeCollectionRuntime(rowsOf())));
            };
            paint();
            const target = document.querySelector('main') || document.body;
            target.insertBefore(summary, target.firstElementChild?.nextSibling || null);

            /* Collection pages append rows as you scroll or press "50 more", so a total
               computed once goes stale the moment the list grows. Recount on mutation,
               debounced to a frame, and only while this feature instance owns the route. */
            let frame = null;
            const observer = new MutationObserver(() => {
                if (frame) return;
                frame = requestAnimationFrame(() => { frame = null; paint(); });
            });
            observer.observe(target, { childList:true, subtree:true });
            this._observer = observer;
            this._cancelFrame = () => { if (frame) cancelAnimationFrame(frame); frame = null; };
        },
        destroy() {
            this._observer?.disconnect();
            this._observer = null;
            this._cancelFrame?.();
            this._cancelFrame = null;
            document.getElementById('enh-runtime-summary')?.remove();
        },
    });

    function readLoadedEpisodes(root = document) {
        const rows = [];
        const seen = new Set();
        const nodes = root.querySelectorAll?.(EPISODE_ROW_SELECTOR) || [];
        let inspected = 0;
        for (const node of nodes) {
            if (inspected >= COLLECTION_LINK_SCAN_LIMIT) break;
            inspected += 1;
            const link = node.querySelector?.('a[href*="/title/tt"]');
            const id = getLinkedTitleId(link?.href || '');
            if (!id || seen.has(id)) continue;
            seen.add(id);
            const heading = node.querySelector?.('h4')?.textContent?.trim() || '';
            rows.push({ node, id, label:heading.slice(0, USER_MARK_TITLE_LIMIT) });
        }
        return rows;
    }

    function summarizeSeasonProgress(rows, marks) {
        const watched = rows.filter(row => marks[row.id]?.state === 'watched').length;
        const skipped = rows.filter(row => marks[row.id]?.state === 'skip').length;
        // The next thing to watch is the first row carrying no mark at all.
        const next = rows.find(row => !marks[row.id]?.state) || null;
        return { total:rows.length, watched, skipped, next };
    }

    function describeSeasonProgress(summary) {
        if (!summary.total) return '';
        const parts = [t('text_seen_of_loaded', [summary.watched, summary.total])];
        if (summary.skipped) parts.push(t('text_count_skipped', [summary.skipped]));
        return parts.join(t('text_summary_separator'));
    }

    /* Decision fatigue on a long watchlist is the whole reason those lists stop getting
       used. This picks one and takes you to it — it never navigates, because the point is
       to help you choose, not to choose for you. */
    reg({
        key: 'seasonProgress', name: t('feature_seasonProgress_name'), group: 'TV',
        init() {
            if (!isIMDbHost()) return;
            if (getPageSurface() !== 'episodes') return;
            if (!get('watchedMarking')) return;
            if (document.getElementById('enh-season-progress')) return;
            const isCurrent = createFeatureGuard(this);

            addThemedCSS(t => `
                #enh-season-progress {
                    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
                    margin: 8px 0 12px; padding: 9px 12px;
                    border: 1px solid ${t.bd1}; border-radius: 10px; background: ${t.sf0};
                }
                #enh-season-progress[hidden] { display: none; }
                .enh-season__count { color: ${t.tx1}; font: 700 12px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
                .enh-season__next { color: ${t.blue} !important; text-decoration: none !important;
                    font: 600 11px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
                .enh-season__next:hover { color: ${t.blueHi} !important; }
                .enh-season__btn {
                    height: 26px; padding: 0 10px; border-radius: 7px; cursor: pointer;
                    border: 1px solid ${t.bd1}; background: ${t.sf1}; color: ${t.tx2};
                    font: 650 10px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }
                .enh-season__btn:hover { background: ${t.sf2}; color: ${t.tx0}; }
                .enh-season__btn:focus-visible { outline: 2px solid ${t.accent}; outline-offset: 2px; }
                .enh-season__btn[hidden] { display: none; }
                .enh-season__note { color: ${t.tx3}; font: 500 10px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
                .enh-season__note:empty { display: none; }
            `, 'enh-season-progress-css');

            const count = makeEl('span', { className:'enh-season__count', role:'status', 'aria-live':'polite' });
            const next = makeEl('a', { className:'enh-season__next' });
            const note = makeEl('span', { className:'enh-season__note' });
            const undo = makeEl('button', {
                type:'button', className:'enh-season__btn', hidden:'hidden',
                onClick: () => this._undo(),
            }, t('label_undo'));
            const markAll = makeEl('button', {
                type:'button', className:'enh-season__btn',
                onClick: () => this._batch('watched'),
            }, t('text_mark_loaded_season_seen'));
            const clearAll = makeEl('button', {
                type:'button', className:'enh-season__btn',
                onClick: () => this._batch(''),
            }, t('text_clear_loaded_season'));

            const bar = makeEl('div', { id:'enh-season-progress', role:'region', 'aria-label':t('aria_season_progress') },
                count, next, markAll, clearAll, undo, note);

            this._paint = () => {
                if (!isCurrent()) return;
                const rows = readLoadedEpisodes();
                const summary = summarizeSeasonProgress(rows, getUserMarks());
                setTextIfChanged(count, describeSeasonProgress(summary));
                if (summary.next) {
                    next.href = `https://www.imdb.com/title/${summary.next.id}/`;
                    setTextIfChanged(next, t('text_next_episode', [summary.next.label || summary.next.id]));
                    next.hidden = false;
                } else {
                    next.removeAttribute('href');
                    setTextIfChanged(next, '');
                    next.hidden = true;
                }
                markAll.disabled = !rows.length;
                clearAll.disabled = !rows.length;
                bar.hidden = !rows.length;
            };
            this._paint();

            const target = document.querySelector('main') || document.body;
            target.insertBefore(bar, target.firstElementChild?.nextSibling || null);

            this._note = note;
            this._undoButton = undo;
            this._pending = null;

            /* One bounded transaction over the rows this season has rendered. Nothing is
               fetched to complete the set, so the counts and the wording both say
               "loaded" rather than implying the whole season was touched. */
            this._batch = state => {
                if (!isCurrent()) return;
                const rows = readLoadedEpisodes();
                if (!rows.length) return;
                const before = getUserMarks(true);
                const marks = { ...before };
                const batchTimestamp = Date.now();
                const batchDate = viewingDateFromTimestamp(batchTimestamp);
                rows.forEach(row => {
                    if (state === 'watched') {
                        const previous = normalizeUserMark(marks[row.id]) || {};
                        marks[row.id] = {
                            ...previous,
                            state:'watched',
                            title:row.label || previous.title || row.id,
                            ts:batchTimestamp,
                            ...(batchDate ? { viewings:mergeViewingEvents(previous.viewings, [{ date:batchDate }]) } : {}),
                            ...(normalizeUserNote(previous.note) ? { note:normalizeUserNote(previous.note) } : {}),
                        };
                    } else if (normalizeUserNote(marks[row.id]?.note)) {
                        // Clearing the season must not take a note with it.
                        marks[row.id] = { ...marks[row.id], state:'', ts:Date.now() };
                    } else {
                        delete marks[row.id];
                    }
                });
                if (!setUserMarks(marks)) {
                    // setUserMarks reports its own failure; nothing was written.
                    setTextIfChanged(note, t('text_nothing_was_changed'));
                    return;
                }
                /* Only what this batch touched, not a copy of the whole store. Undoing
                   from a full snapshot deleted every mark made anywhere else while the
                   button was still armed, with no second undo to get them back. */
                this._pending = rows.map(row => ({ id:row.id, previous:before[row.id] }));
                undo.hidden = false;
                refreshFeature('watchedMarking');
                this._paint();
                /* The store keeps the newest 5,000 marks. The rows written here carry the
                   freshest timestamps, so they are never the ones dropped; what a full
                   store loses is the oldest marks from elsewhere in the library. Counting
                   the batch would always report success, so count those instead. */
                const stored = getUserMarks(true);
                const touched = new Set(rows.map(row => row.id));
                const evicted = Object.keys(before).filter(id => !touched.has(id) && !stored[id]).length;
                /* Which verb, and how many forms the count needs, are two separate
                   questions and both belong to the language. The key names the action;
                   tCount picks the form. */
                const seen = state === 'watched';
                /* Each key written out rather than chosen into a variable: the check that
                   the catalog carries nothing unused, and nothing unused is asked for,
                   reads these call sites literally. A key assembled at runtime is one
                   neither half of that can see. */
                setTextIfChanged(note, evicted
                    ? (seen
                        ? tCount('text_season_marked_evicted', rows.length, [evicted, USER_MARKS_MAX])
                        : tCount('text_season_cleared_evicted', rows.length, [evicted, USER_MARKS_MAX]))
                    : (seen
                        ? tCount('text_season_marked', rows.length)
                        : tCount('text_season_cleared', rows.length)));
                showToast(seen
                    ? tCount('toast_season_marked', rows.length)
                    : tCount('toast_season_cleared', rows.length), 5000);
            };
            this._undo = () => {
                if (!this._pending) return;
                // Re-read rather than restore a snapshot: anything marked since the batch
                // is not this button's to revert.
                const current = { ...getUserMarks(true) };
                this._pending.forEach(({ id, previous }) => {
                    if (previous) current[id] = previous;
                    else delete current[id];
                });
                if (!setUserMarks(current)) return;
                this._pending = null;
                undo.hidden = true;
                refreshFeature('watchedMarking');
                this._paint();
                setTextIfChanged(note, t('text_undone'));
                showToast(t('toast_season_marks_restored'));
            };

            // A season tab swap replaces the rows without a route change.
            let frame = null;
            const observer = new MutationObserver(() => {
                if (frame) return;
                frame = requestAnimationFrame(() => { frame = null; this._paint(); });
            });
            observer.observe(target, { childList:true, subtree:true });
            this._observer = observer;
            this._cancelFrame = () => { if (frame) cancelAnimationFrame(frame); frame = null; };
            this._marksHandler = () => this._paint();
            document.addEventListener('imdb-enhanced:marks-updated', this._marksHandler);
        },
        destroy() {
            removeCSS('enh-season-progress-css');
            this._observer?.disconnect();
            this._observer = null;
            this._cancelFrame?.();
            this._cancelFrame = null;
            if (this._marksHandler) document.removeEventListener('imdb-enhanced:marks-updated', this._marksHandler);
            this._marksHandler = null;
            document.getElementById('enh-season-progress')?.remove();
            this._paint = null;
            this._batch = null;
            this._undo = null;
            this._pending = null;
        },
    });

    reg({
        key: 'listRoulette', name: t('feature_listRoulette_name'), group: 'Utility',
        init() {
            if (!isListPage()) return;
            if (document.getElementById('enh-roulette')) return;
            const isCurrent = createFeatureGuard(this);

            addThemedCSS(t => `
                #enh-roulette { display: inline-flex; align-items: center; gap: 8px; margin: 6px 0 10px; flex-wrap: wrap; }
                #enh-roulette[hidden] { display: none; }
                .enh-roulette__btn {
                    height: 28px; padding: 0 12px; border-radius: 7px; cursor: pointer;
                    border: 1px solid ${t.accentBorder}; background: ${t.accentMuted}; color: ${t.accent};
                    font: 650 11px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }
                .enh-roulette__btn:hover { background: ${t.accent}; color: ${readableTextColor(t.accent)}; }
                .enh-roulette__btn:focus-visible { outline: 2px solid ${t.accent}; outline-offset: 2px; }
                .enh-roulette__skip { display: inline-flex; align-items: center; gap: 5px; color: ${t.tx3};
                    font: 500 10px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; cursor: pointer; }
                .enh-roulette__result { color: ${t.tx2}; font: 600 11px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
                .enh-roulette__result:empty { display: none; }
                .enh-roulette-pick {
                    outline: 3px solid ${t.accent} !important; outline-offset: 3px;
                    border-radius: 8px; scroll-margin: 120px;
                }
            `, 'enh-roulette-css');

            const result = makeEl('div', { className:'enh-roulette__result', role:'status', 'aria-live':'polite' });
            const skipMarked = makeEl('input', { type:'checkbox', id:'enh-roulette-skip-marked' });
            skipMarked.checked = true;
            const bar = makeEl('div', { id:'enh-roulette' },
                makeEl('button', {
                    type:'button',
                    className:'enh-roulette__btn',
                    onClick: () => this._pick(),
                }, t('text_pick_something')),
                makeEl('label', { className:'enh-roulette__skip', for:'enh-roulette-skip-marked' },
                    skipMarked, t('text_skip_titles_i_have_marked')),
                result
            );
            this._result = result;
            this._skipMarked = skipMarked;
            this._isCurrent = isCurrent;

            const target = document.querySelector('main') || document.body;
            target.insertBefore(bar, target.firstElementChild?.nextSibling || null);
        },
        _pick() {
            if (!this._isCurrent?.()) return;
            const marks = getUserMarks();
            // Only rows the page is actually showing: a filtered-out row is not a
            // candidate, or the pick would scroll to something invisible.
            const candidates = collectMarkFilterCards()
                .filter(entry => !entry.duplicate)
                .filter(entry => entry.card.offsetParent !== null)
                .filter(entry => !(this._skipMarked.checked && marks[entry.id]?.state));
            document.querySelectorAll('.enh-roulette-pick').forEach(node => node.classList.remove('enh-roulette-pick'));
            if (!candidates.length) {
                setTextIfChanged(this._result, this._skipMarked.checked
                    ? t('text_nothing_left_that_you_have_not_already')
                    : t('text_no_titles_on_this_page_to_pick'));
                return;
            }
            const chosen = candidates[Math.floor(Math.random() * candidates.length)];
            chosen.card.classList.add('enh-roulette-pick');
            chosen.card.scrollIntoView({ behavior:getEnhancementScrollBehavior(), block:'center' });
            const title = chosen.card.querySelector('.ipc-title__text')?.textContent?.replace(/^\d+\.\s*/, '')
                || marks[chosen.id]?.title
                || chosen.id;
            // Highlighted and announced, never opened: choosing is the user's to do.
            setTextIfChanged(this._result, t('text_picked_nothing_opened', [title]));
        },
        destroy() {
            removeCSS('enh-roulette-css');
            document.querySelectorAll('.enh-roulette-pick').forEach(node => node.classList.remove('enh-roulette-pick'));
            document.getElementById('enh-roulette')?.remove();
            this._result = null;
            this._skipMarked = null;
            this._isCurrent = null;
        },
    });

    reg({
        key: 'listMultiSearch', name: t('feature_listMultiSearch_name'), group: 'Utility',
        init() {
            if (!isListPage()) return;
            if (document.getElementById('enh-multi-search')) return;
            // The Visible control promises "show or hide this destination on IMDb
            // pages" — collection pages are IMDb pages too.
            const sites = getSiteList('watchSites', DEFAULT_WATCH_SITES).filter(site => site.enabled !== false);
            if (!sites.length) return;

            addThemedCSS(t => `
                #enh-multi-search {
                    position: sticky; top: 112px; z-index: 29;
                    display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap;
                    margin: 6px 0 12px 0;
                }
                .enh-multi-search-label {
                    font: 700 10px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    letter-spacing: .08em; color: ${t.tx3};
                }
                .enh-multi-search-btn {
                    display: inline-flex; align-items: center; justify-content: center;
                    min-height: 30px; padding: 0 10px; border-radius: 7px;
                    border: 1px solid ${t.bd1}; background: ${t.sf1}; color: ${t.tx1};
                    cursor: pointer; font: 700 11px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    transition: background .15s ease, border-color .15s ease, color .15s ease, transform .15s ease;
                }
                .enh-multi-search-btn:hover { background: ${t.sf2}; border-color: ${t.accentBorder}; color: ${t.accent}; transform: translateY(-1px); }
                #enh-multi-search-queue {
                    margin: 0 0 18px; padding: 14px; max-width: 980px;
                    border: 1px solid ${t.bd1}; border-radius: 10px;
                    background: ${t.sf0}; color: ${t.tx1}; box-shadow: ${t.sh1};
                    outline: none;
                }
                .enh-multi-search-queue__header {
                    display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
                    margin-bottom: 12px;
                }
                .enh-multi-search-queue__title {
                    margin: 0 0 4px; color: ${t.tx0};
                    font: 800 14px/1.25 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }
                .enh-multi-search-queue__description,
                .enh-multi-search-queue__status {
                    margin: 0; color: ${t.tx2};
                    font: 500 11px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }
                .enh-multi-search-queue__status { margin-top: 5px; color: ${t.accent}; font-weight: 700; }
                .enh-multi-search-queue__actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
                .enh-multi-search-queue__action {
                    min-height: 32px; display: inline-flex; align-items: center; justify-content: center;
                    padding: 0 10px; border: 1px solid ${t.bd1}; border-radius: 7px;
                    background: ${t.sf1}; color: ${t.tx1} !important; text-decoration: none !important;
                    cursor: pointer; font: 750 11px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }
                .enh-multi-search-queue__action:hover { background: ${t.sf2}; border-color: ${t.accentBorder}; color: ${t.accent} !important; }
                .enh-multi-search-queue__action[aria-disabled="true"] { opacity: .48; cursor: default; pointer-events: none; }
                .enh-multi-search-queue__list {
                    list-style: none; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 6px; max-height: 340px; overflow: auto; margin: 0; padding: 0 2px 0 0;
                }
                .enh-multi-search-queue__item {
                    min-width: 0; border: 1px solid ${t.bd0}; border-radius: 8px; background: ${t.sf1};
                }
                .enh-multi-search-queue__item--opened { background: ${t.sf0}; border-color: ${t.bd1}; }
                .enh-multi-search-queue__item--opened .enh-multi-search-queue__link { color: ${t.tx3} !important; }
                .enh-multi-search-queue__link {
                    min-height: 40px; display: flex; align-items: center; justify-content: space-between; gap: 10px;
                    padding: 7px 9px; color: ${t.tx1} !important; text-decoration: none !important;
                    font: 650 11px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }
                .enh-multi-search-queue__link:hover { color: ${t.accent} !important; }
                .enh-multi-search-queue__link-meta { color: ${t.tx3}; font-size: 9px; font-weight: 750; white-space: nowrap; }
                .enh-multi-search-queue__action:focus-visible,
                .enh-multi-search-queue__link:focus-visible {
                    outline: 2px solid ${t.accent}; outline-offset: 2px;
                }
            `, 'enh-listMultiSearch');

            const bar = makeEl('div', { id:'enh-multi-search' },
                makeEl('span', { className:'enh-multi-search-label' }, t('label_search_all_on'))
            );
            sites.forEach(site => {
                const btn = makeEl('button', {
                    type:'button',
                    className:'enh-multi-search-btn',
                    style:{ '--btn-color': site.color },
                    'aria-label': t('aria_prepare_visible_titles_for', [site.name]),
                    onClick: () => this._showQueue(site, btn),
                }, site.name);
                bar.appendChild(btn);
            });
            const target = document.querySelector('main') || document.body;
            target.insertBefore(bar, target.firstElementChild?.nextSibling || null);
        },
        _showQueue(site, trigger) {
            const titles = getListTitles();
            if (!titles.length) { showToast(t('toast_no_titles_found_on_this_page')); return; }
            const entries = buildListSearchEntries(site, titles);
            document.getElementById('enh-multi-search-queue')?.remove();

            const opened = new Set();
            let nextIndex = 0;
            const queue = makeEl('section', {
                id:'enh-multi-search-queue', role:'region', tabindex:'-1',
                'aria-label':t('aria_search_queue', [site.name]),
            });
            const status = makeEl('p', {
                className:'enh-multi-search-queue__status', role:'status', 'aria-live':'polite',
            }, t('text_none_of_count_opened', [entries.length]));
            const list = makeEl('ol', { className:'enh-multi-search-queue__list' });
            const openNext = makeEl('a', {
                className:'enh-multi-search-queue__action', target:'_blank', rel:'noopener noreferrer',
            });

            const updateNext = () => {
                while (nextIndex < entries.length && opened.has(nextIndex)) nextIndex++;
                const entry = entries[nextIndex];
                if (!entry) {
                    openNext.removeAttribute('href');
                    openNext.removeAttribute('target');
                    openNext.setAttribute('aria-disabled', 'true');
                    openNext.textContent = t('text_all_opened');
                    return;
                }
                openNext.href = entry.url;
                openNext.target = '_blank';
                openNext.removeAttribute('aria-disabled');
                openNext.textContent = t('text_open_next_of', [nextIndex + 1, entries.length]);
                openNext.setAttribute('aria-label', t('aria_open_on_in_a_new_tab', [entry.name, site.name]));
            };
            const markOpened = index => {
                opened.add(index);
                list.children[index]?.classList.add('enh-multi-search-queue__item--opened');
                status.textContent = t('text_queue_opened_progress', [opened.size, entries.length]);
                updateNext();
            };

            entries.forEach((entry, index) => {
                const link = makeEl('a', {
                    href:entry.url, target:'_blank', rel:'noopener noreferrer',
                    className:'enh-multi-search-queue__link',
                    'aria-label':t('aria_open_on_in_a_new_tab', [entry.name, site.name]),
                },
                    makeEl('span', {}, entry.name),
                    makeEl('span', { className:'enh-multi-search-queue__link-meta' }, t('text_queue_link_meta', [entry.id]))
                );
                link.addEventListener('click', () => {
                    setTimeout(() => markOpened(index), 0);
                });
                list.appendChild(makeEl('li', { className:'enh-multi-search-queue__item' }, link));
            });

            openNext.addEventListener('click', event => {
                const entry = entries[nextIndex];
                if (!entry) { event.preventDefault(); return; }
                const index = nextIndex;
                setTimeout(() => markOpened(index), 0);
            });

            const copy = makeEl('button', {
                type:'button', className:'enh-multi-search-queue__action',
                onClick: () => {
                    const text = entries.map(entry => entry.url).join('\n');
                    if (copyTextToClipboard(text)) {
                        showToast(t('toast_copied_search_links', [entries.length]));
                    } else showToast(t('toast_copy_failed_try_the_individual_links'), 4500);
                },
            }, t('text_copy_all_links'));
            const close = makeEl('button', {
                type:'button', className:'enh-multi-search-queue__action',
                onClick: () => { queue.remove(); trigger.focus(); },
            }, t('label_close'));

            const limited = titles.length > entries.length ? ` First ${entries.length} of ${titles.length} visible titles are shown.` : '';
            queue.append(
                makeEl('div', { className:'enh-multi-search-queue__header' },
                    makeEl('div', {},
                        makeEl('h3', { className:'enh-multi-search-queue__title' }, t('text_site_search_queue', [site.name])),
                        makeEl('p', { className:'enh-multi-search-queue__description' },
                            `Browsers allow one new tab per click.${limited}`
                        ),
                        status
                    ),
                    makeEl('div', { className:'enh-multi-search-queue__actions' }, openNext, copy, close)
                ),
                list
            );
            const bar = trigger.closest('#enh-multi-search');
            if (!insertAfter(bar, queue)) return;
            updateNext();
            queue.scrollIntoView({ block:'nearest' });
            queue.focus({ preventScroll:true });
        },
        destroy() {
            removeCSS('enh-listMultiSearch');
            document.getElementById('enh-multi-search')?.remove();
            document.getElementById('enh-multi-search-queue')?.remove();
        }
    });

    /* Verified against live person pages on 2026-08-14: IMDb already prints the age
       at death next to a death date (`birth-and-death-death-age`), but a living
       person's page shows only the birth date. So the only gap worth filling is the
       current age, and it can be computed from data the page already carries — the
       embedded application state exposes an ISO `birthDate.date`, with the visible
       `birth-and-death-birthdate` text as a fallback. No extra requests. */
    function computeCurrentAge(birthISO, now = new Date()) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthISO || ''));
        if (!match) return null;
        const [, y, m, d] = match.map(Number);
        const year = Number(y);
        if (!year || year < 1800) return null;
        const birth = new Date(Date.UTC(year, m - 1, d));
        if (Number.isNaN(birth.getTime()) || birth.getUTCMonth() !== m - 1 || birth.getUTCDate() !== d) return null;
        let age = now.getUTCFullYear() - year;
        const beforeBirthday = now.getUTCMonth() < m - 1
            || (now.getUTCMonth() === m - 1 && now.getUTCDate() < d);
        if (beforeBirthday) age -= 1;
        return age >= 0 && age <= 130 ? age : null;
    }

    /* IMDb renders a death date and an age at death itself, so those elements are the
       authoritative signal and cost nothing to read. The embedded application state is
       only a secondary check: it is searched over the same bounded text the size guard
       already validated, because a fixed prefix slice could sit entirely before
       deathStatus and report a dead person as living. */
    const PERSON_DEATH_SELECTOR = '[data-testid="birth-and-death-death-age"],'
        + '[data-testid="birth-and-death-deathdate"]';

    function isPersonDeceased(doc = document, text = '') {
        if (doc.querySelector?.(PERSON_DEATH_SELECTOR)) return true;
        return /"deathStatus":"(?!ALIVE)/.test(text) || /"deathDate":\s*\{/.test(text);
    }

    function readPersonBirthDate(doc = document) {
        const script = doc.getElementById('__NEXT_DATA__');
        const text = typeof script?.textContent === 'string' ? script.textContent : '';
        if (text && text.length <= EXTERNAL_RESPONSE_TEXT_LIMIT) {
            const index = text.indexOf('"birthDate"');
            if (index >= 0) {
                const iso = /"date":"(\d{4}-\d{2}-\d{2})"/.exec(text.slice(index, index + 400));
                if (iso) return { iso:iso[1], deceased:isPersonDeceased(doc, text) };
            }
        }
        return null;
    }

    reg({
        key: 'castAges', name: t('feature_castAges_name'), group: 'Features',
        async init() {
            if (!isIMDbHost()) return;
            const isCurrent = createFeatureGuard(this);
            addThemedCSS(t => `
                .enh-person-age { color: ${t.tx2}; font-weight: 700; margin-left: 6px; }
                .enh-cast-age { color: ${t.tx3}; font-weight: 700; margin-left: 6px; white-space: nowrap; }
            `, 'enh-castAges');
            if (getPageSurface() === 'name') { this._renderPersonAge(isCurrent); return; }
            await this._renderCastAges(isCurrent);
        },
        _renderPersonAge(isCurrent) {
            const birth = readPersonBirthDate();
            if (!birth || birth.deceased) return;
            const age = computeCurrentAge(birth.iso);
            if (age === null) return;
            const host = document.querySelector('[data-testid="birth-and-death-birthdate"]');
            if (!host || !isCurrent() || host.querySelector('.enh-person-age')) return;
            host.appendChild(makeEl('span', { className:'enh-person-age' }, t('text_age_parenthetical', [age])));
        },
        /* IE-120: age at release beside each billed name. One query for the whole cast,
           cached against the title, and nothing at all when the year is unknown: an age
           needs both ends and half of one is not worth a request. */
        async _renderCastAges(isCurrent) {
            const imdbId = getIMDbID();
            const releaseYear = normalizeUserMarkYear(getTitleYear());
            if (!imdbId || releaseYear === null) return;
            await waitForTitleSurface();
            if (!isCurrent()) return;
            const names = collectCastNameIds(document);
            if (!names.length) return;

            const cacheKey = `wikidata_cast_${imdbId}`;
            let years = cacheGet(cacheKey);
            if (!years || years.unavailable) {
                if (years?.unavailable) return;
                const query = buildCastBirthQuery(names);
                if (!query) return;
                try {
                    const response = await httpGet(
                        `${WIKIDATA_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`,
                        { headers:{ Accept:'application/sparql-results+json' }, cancelOnRouteChange:true });
                    if (!isCurrent()) return;
                    years = parseCastBirthYears(response.responseText);
                } catch { return; }
                if (Object.keys(years).length) cacheSet(cacheKey, years, WIKIDATA_ID_TTL);
                else { cacheSetUnavailable(cacheKey); return; }
            }
            if (!isCurrent()) return;
            this._paintCastAges(years, releaseYear);
        },
        _paintCastAges(years, releaseYear) {
            document.querySelectorAll('[data-testid="title-cast-item"] a[href*="/name/nm"]').forEach(anchor => {
                const id = String(anchor.getAttribute('href') || '').match(/\/name\/(nm\d{5,12})/)?.[1];
                const age = id ? castAgeAtRelease(years?.[id], releaseYear) : null;
                // Nothing at all for somebody Wikidata does not know, rather than a guess.
                if (age === null) return;
                const host = anchor.closest('[data-testid="title-cast-item"]');
                if (!host || host.querySelector('.enh-cast-age')) return;
                /* Approximate, and said so. Only the year is known, so the answer is out
                   by up to a year either way and presenting it as exact would be a lie
                   about how well this knows. */
                host.appendChild(makeEl('span', { className:'enh-cast-age' },
                    t('text_was_about_age', [age])));
            });
        },
        destroy() {
            removeCSS('enh-castAges');
            document.querySelectorAll('.enh-person-age,.enh-cast-age').forEach(node => node.remove());
        }
    });

    reg({
        key: 'quickCopyID', name: t('feature_quickCopyID_name'), group: 'Utility',
        init() {
            const isCurrent = createFeatureGuard(this);
            waitForTitleSurface().then(() => {
                if (!isCurrent()) return;
                if (document.getElementById('enh-copy-id')) return;
                const imdbId = getIMDbID();
                if (!imdbId) return;
                const btn = makeEl('button', {
                    id:'enh-copy-id', className:'enh-action-btn', type:'button',
                    title:t('text_copy_value', [imdbId]), 'aria-label': t('aria_copy_imdb_id', [imdbId]),
                    innerHTML: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>${imdbId}</span>`,
                    onClick: () => showToast(copyTextToClipboard(imdbId)
                        ? t('toast_copied_value', [imdbId])
                        : COPY_FAILURE_MESSAGE, 4500)
                });
                appendTitleStackItem(btn, TITLE_STACK_ORDER.quickCopyID);
            }).catch(() => {});
        },
        destroy() { document.getElementById('enh-copy-id')?.remove(); pruneTitleStack(); }
    });

    reg({
        key: 'keyboardShortcuts', name: t('feature_keyboardShortcuts_name'), group: 'Utility',
        _h: null,
        init() {
            this._h = (e) => {
                if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
                if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName) || e.target.isContentEditable) return;
                if (document.getElementById('enh-trailer-overlay')) return;
                if (settingsOpen) {
                    if (e.key === 'Escape') { e.preventDefault(); toggleSettings(); }
                    return;
                }
                if (e.key === '?') { e.preventDefault(); toggleSettings(); }
                else if (e.key === 'c') {
                    const id = getIMDbID();
                    if (id) showToast(copyTextToClipboard(id)
                        ? t('toast_copied_value', [id])
                        : COPY_FAILURE_MESSAGE, 4500);
                }
                else if (e.key === 'r') { document.querySelector('[data-testid="hero-rating-bar__aggregate-rating"]')?.scrollIntoView({ behavior:getEnhancementScrollBehavior(), block:'center' }); }
                else if (e.key === 't') { window.scrollTo({ top:0, behavior:getEnhancementScrollBehavior() }); }
            };
            document.addEventListener('keydown', this._h);
        },
        destroy() { if (this._h) document.removeEventListener('keydown', this._h); }
    });

