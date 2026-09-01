    // #########################################################################
    //
    //  INLINE SCORES (RT + Metacritic)
    //
    // #########################################################################

    function waitUntilVisible(el, isCurrent) {
        if (!el || !isCurrent()) return Promise.resolve(false);
        if (typeof IntersectionObserver === 'undefined') return Promise.resolve(true);
        return new Promise(resolve => {
            let settled = false;
            let timer = null;
            const observer = new IntersectionObserver(entries => {
                if (!isCurrent()) { finish(false); return; }
                if (entries.some(entry => entry.isIntersecting)) finish(true);
            }, { rootMargin: '200px' });
            const cancel = () => finish(false);
            const finish = value => {
                if (settled) return;
                settled = true;
                observer.disconnect();
                clearTimeout(timer);
                pendingRouteWorkCancels.delete(cancel);
                resolve(value);
            };
            pendingRouteWorkCancels.add(cancel);
            observer.observe(el);
            timer = setTimeout(() => finish(false), 60000);
        });
    }

    function findRatingBar() {
        const editorialRail = document.getElementById('enh-editorial-score-rail');
        if (editorialRail) return editorialRail;
        const agg = document.querySelector('[data-testid="hero-rating-bar__aggregate-rating"]');
        if (!agg) return null;
        const markNativeBar = bar => {
            bar?.classList.add('enh-native-score-rail');
            return bar;
        };
        // Walk up to find the flex container holding all rating widgets
        let parent = agg.parentElement;
        for (let i = 0; i < 3 && parent; i++) {
            if (parent.children.length >= 2) return markNativeBar(parent);
            parent = parent.parentElement;
        }
        return markNativeBar(agg.parentElement);
    }

    async function waitForRatingBar(isCurrent) {
        const current = findRatingBar();
        if (current) return current;
        try {
            await waitFor('[data-testid="hero-rating-bar__aggregate-rating"]', 12000);
        } catch { return null; }
        return isCurrent() ? findRatingBar() : null;
    }

    function normalizeHistogramData(value) {
        if (!Array.isArray(value)) return null;
        const buckets = new Map();
        value.slice(0, 100).forEach(bucket => {
            const rating = Number(bucket?.rating);
            const votes = Number(bucket?.voteCount ?? bucket?.count);
            if (!Number.isInteger(rating) || rating < 1 || rating > 10) return;
            if (!Number.isFinite(votes) || votes < 0) return;
            buckets.set(rating, Math.round(votes));
        });
        if (buckets.size < 2) return null;
        return Array.from({ length:10 }, (_, index) => ({
            rating:index + 1,
            voteCount:buckets.get(index + 1) || 0,
        }));
    }

    /* IMDb's displayed rating is deliberately weighted to resist vote brigading, and it
       publishes the unweighted mean only on /ratings/. The gap between the two is the
       clearest public signal that a title's votes were pushed one way, which is what
       2026 discussion of IMDb ratings is largely about. It needs no request and no new
       selector: the same buckets the histogram already draws carry it. Verified against
       IMDb's own figure on tt0133093 (8.6) and tt0903747 (9.2) on 2026-08-15. */
    function computeUnweightedMean(buckets) {
        if (!Array.isArray(buckets) || !buckets.length) return null;
        let votes = 0;
        let weighted = 0;
        for (const bucket of buckets) {
            const rating = Number(bucket?.rating);
            const count = Number(bucket?.voteCount);
            if (!Number.isFinite(rating) || !Number.isFinite(count) || count < 0) continue;
            if (rating < 1 || rating > 10) continue;
            votes += count;
            weighted += rating * count;
        }
        if (!votes) return null;
        return Math.round((weighted / votes) * 10) / 10;
    }

    /* The ratings route carries no JSON-LD at all (verified 2026-08-15), so the
       weighted figure has to come from the rendered score there. Digits are
       language-independent; the surrounding copy is not. */
    function readDisplayedRating() {
        const structured = Number(getIMDbRating());
        if (Number.isFinite(structured) && structured > 0) return structured;
        const el = document.querySelector('[data-testid="rating-button__aggregate-rating__score"]')
            || document.querySelector('[data-testid="hero-rating-bar__aggregate-rating__score"]');
        const parsed = parseFloat(String(el?.textContent || '').trim());
        return Number.isFinite(parsed) && parsed > 0 && parsed <= 10 ? parsed : null;
    }

    /* The same arithmetic with the two ends of the scale left out. A review-bombed title
       is bombed at 1 and defended at 10, and both ends are where a handful of people can
       move a mean furthest — so a mean without them says what the middle of the audience
       thought. It is derived here from buckets IMDb publishes, not a rating anyone gave,
       and it never replaces the score on the page. */
    /* Below these the surviving votes are not an audience. A review-bombed title can have
       99.99% of its votes at the two ends, and the mean of what is left says nothing about
       anybody — while looking exactly like an answer. */
    const TRIMMED_MEAN_MIN_VOTES = 50;
    const TRIMMED_MEAN_MIN_SHARE = 0.05;

    function computeTrimmedMean(buckets) {
        if (!Array.isArray(buckets) || !buckets.length) return null;
        let votes = 0;
        let weighted = 0;
        let total = 0;
        for (const bucket of buckets) {
            const rating = Number(bucket?.rating);
            const count = Number(bucket?.voteCount);
            if (!Number.isFinite(rating) || !Number.isFinite(count) || count < 0) continue;
            // Strictly inside the scale: 1 and 10 are the buckets being excluded.
            total += count;
            if (rating <= 1 || rating >= 10) continue;
            votes += count;
            weighted += rating * count;
        }
        /* Every vote at one end leaves nothing to average, and almost every vote at the
           ends leaves too little. Both are real answers about a title; a number computed
           from the remainder would be a worse one. */
        if (!votes || votes < TRIMMED_MEAN_MIN_VOTES) return null;
        if (total && votes / total < TRIMMED_MEAN_MIN_SHARE) return null;
        return Math.round((weighted / votes) * 10) / 10;
    }

    function describeRatingGap(unweighted, displayed, trimmed = null) {
        if (unweighted === null || !Number.isFinite(displayed)) return null;
        const delta = Math.round((displayed - unweighted) * 10) / 10;
        const parts = [delta
            ? t('text_unweighted_weighting_sits', [unweighted.toFixed(1), Math.abs(delta).toFixed(1),
                delta > 0 ? t('text_direction_above') : t('text_direction_below')])
            : t('text_unweighted_same_as_displayed', [unweighted.toFixed(1)])];
        /* Only when it says something the line does not already: a title with no votes at
           either end has the same two numbers, and printing both would be noise. */
        if (trimmed !== null && trimmed !== unweighted) {
            parts.push(t('text_without_the_extremes', [trimmed.toFixed(1)]));
        }
        return parts.join(t('text_summary_separator'));
    }

    function findHistogramData(root, maxNodes = 10000) {
        const queue = [root];
        for (let index = 0; index < queue.length && index < maxNodes; index++) {
            const node = queue[index];
            if (!node || typeof node !== 'object') continue;
            const direct = normalizeHistogramData(node.histogramData)
                || normalizeHistogramData(node.ratingsSummary?.histogramData);
            if (direct) return direct;
            appendBoundedObjectChildren(queue, node, maxNodes);
        }
        return null;
    }

    /* IMDb's ratings payload is a ~736 KB application-data blob and histogramData sits
       far deeper than the graph walk's node budget, so the generic traversal never
       reaches it and the distribution silently reads as absent. Slicing the one array
       out by key is both cheaper and bounded: a 10-bucket array is under a kilobyte, so
       a generous ceiling still rejects anything malformed instead of scanning the blob.
       Verified 2026-08-15 on /title/tt0133093/ratings/. */
    const HISTOGRAM_VALUES_KEY = '"histogramValues":';
    const HISTOGRAM_SLICE_LIMIT = 20000;

    function extractHistogramValues(source) {
        const start = source.indexOf(HISTOGRAM_VALUES_KEY);
        if (start < 0) return null;
        const open = source.indexOf('[', start + HISTOGRAM_VALUES_KEY.length);
        if (open < 0) return null;
        let depth = 0;
        const ceiling = Math.min(source.length, open + HISTOGRAM_SLICE_LIMIT);
        for (let i = open; i < ceiling; i += 1) {
            const ch = source[i];
            if (ch === '[') depth += 1;
            else if (ch === ']') {
                depth -= 1;
                if (!depth) {
                    try { return normalizeHistogramData(JSON.parse(source.slice(open, i + 1))); }
                    catch { return null; }
                }
            }
        }
        return null;
    }

    function parseHistogramScriptTexts(scriptTexts) {
        let inspectedScripts = 0;
        for (const text of scriptTexts || []) {
            if (inspectedScripts >= STRUCTURED_DATA_SCRIPT_LIMIT) break;
            inspectedScripts += 1;
            const source = toBoundedText(text, STRUCTURED_DATA_TEXT_LIMIT);
            if (!source || (!source.includes('histogramData') && !source.includes('ratingsSummary'))) continue;
            const sliced = extractHistogramValues(source);
            if (sliced) return sliced;
            try {
                const data = findHistogramData(JSON.parse(source));
                if (data) return data;
            } catch { /* inspect the next application-data block */ }
        }
        return null;
    }

    function getHistogramData() {
        const scripts = Array.from(document.querySelectorAll('script[type="application/json"]'))
            .slice(0, STRUCTURED_DATA_SCRIPT_LIMIT);
        return parseHistogramScriptTexts(scripts.map(script => script.textContent));
    }

    async function fetchScoreCorrectionCandidates(provider, title, year, mediaType = 'movie') {
        let candidates = [];
        if (provider === 'rottenTomatoes') {
            const url = `https://www.rottentomatoes.com/search?search=${encodeURIComponent(title || '')}`;
            const response = await httpGet(url, { cancelOnRouteChange:true });
            candidates = parseRTSearchCandidates(response.responseText, mediaType);
        } else if (provider === 'letterboxd') {
            try {
                const response = await httpGet(getLetterboxdSearchUrl(title), {
                    headers:{ Accept:'text/html,application/xhtml+xml' },
                    cancelOnRouteChange:true,
                });
                candidates = parseLetterboxdSearchCandidates(response.responseText);
            } catch { /* Letterboxd may challenge anonymous search requests; use its Wikidata IDs below */ }
            if (!candidates.length) {
                const query = buildLetterboxdCandidateQuery(title);
                const response = await httpGet(`${WIKIDATA_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`, {
                    headers:{ Accept:'application/sparql-results+json' },
                    cancelOnRouteChange:true,
                });
                candidates = parseLetterboxdWikidataCandidates(response.responseText, title);
            }
        } else if (provider === 'metacritic') {
            const response = await httpGet(getMetacriticSearchUrl(title, mediaType), { cancelOnRouteChange:true });
            const source = toBoundedText(response.responseText, EXTERNAL_RESPONSE_TEXT_LIMIT);
            if (!source) throw failure('unknown', t('text_candidate_response_was_too_large_or_empty'));
            const payload = JSON.parse(source);
            candidates = collectMetacriticCandidates(payload?.data?.items || [], mediaType);
        } else if (provider === 'justWatch') {
            const typePath = mediaType === 'tv' ? 'tv-show' : 'movie';
            const response = await httpGet(getJustWatchSearchUrl(title), {
                headers:{ Accept:'text/html,application/xhtml+xml' },
                timeout:12000,
                cancelOnRouteChange:true,
            });
            candidates = parseJustWatchSearchCandidates(response.responseText, typePath, getJustWatchRegionPath());
        }
        else if (provider === 'anilist') {
            const response = await httpRequest(ANILIST_ENDPOINT, {
                method:'POST',
                body: JSON.stringify({ query:ANILIST_QUERY, variables:{ s:title } }),
                cancelOnRouteChange:true,
            });
            candidates = collectAniListCandidates(parseJSONResponse(response));
        }
        return rankScoreCorrectionCandidates(provider, candidates, title, year);
    }

    /* Every entry the search returned, as something to pick from. parseAniListSearch
       answers the one question "is this the title on the page"; this answers "which of
       these did you mean", so it keeps the ones that failed that test. */
    function collectAniListCandidates(payload) {
        const media = payload?.data?.Page?.media;
        if (!Array.isArray(media)) return [];
        return media.slice(0, EXTERNAL_RESULT_SCAN_LIMIT).map(entry => ({
            title: entry?.title?.english || entry?.title?.romaji || '',
            year: Number(entry?.seasonYear) || Number(entry?.startDate?.year) || 0,
            url: normalizeTrustedUrl(entry?.siteUrl, 'anilist.co', ''),
        })).filter(candidate => candidate.title && candidate.url);
    }

    /* A corrected match is an AniList page, so the score comes from that entry by id
       rather than from a search whose first answer is what went wrong in the first place. */
    const ANILIST_BY_ID_QUERY = 'query($id:Int){Media(id:$id,type:ANIME){title{romaji english} averageScore seasonYear startDate{year} siteUrl}}';

    function getAniListIdFromUrl(url) {
        const normalized = normalizeScoreCorrectionUrl('anilist', url);
        if (!normalized) return 0;
        try { return Number(new URL(normalized).pathname.split('/')[2]) || 0; }
        catch { return 0; }
    }

    function parseAniListEntry(payload) {
        const entry = payload?.data?.Media;
        if (!entry || typeof entry !== 'object') return null;
        const score = boundedScore(entry.averageScore, 100);
        if (score === null) return null;
        return { score, url: normalizeTrustedUrl(entry.siteUrl, 'anilist.co', '') };
    }

    function readScoreCacheForCorrection(cacheKey, correction) {
        const cached = cacheGet(cacheKey);
        if (!cached) return null;
        if (correction?.mode === 'url') {
            return cached.correctionUrl === correction.url ? cached : null;
        }
        return cached.correctionUrl ? null : cached;
    }

    function withScoreCorrection(data, correction) {
        return correction?.mode === 'url' && data && typeof data === 'object'
            ? { ...data, correctionUrl:correction.url }
            : data;
    }

    function getScoreCorrectionLookupTitle(correction, fallbackTitle) {
        const savedTitle = String(correction?.title || '').trim();
        if (savedTitle) return savedTitle;
        try {
            const slug = new URL(correction?.url || '').pathname.split('/').filter(Boolean).pop() || '';
            const decoded = decodeURIComponent(slug).replace(/[-_]+/g, ' ').trim();
            return decoded || fallbackTitle;
        } catch { return fallbackTitle; }
    }

    function getSavedScoreCorrectionUrl(provider, fallbackUrl) {
        const correction = getScoreCorrection(getIMDbID(), provider);
        return correction?.mode === 'url' ? correction.url : fallbackUrl;
    }

    function appendScoreCorrectionAction(widget, provider, featureKey, options = {}) {
        const config = SCORE_CORRECTION_PROVIDERS[provider];
        const imdbId = getIMDbID();
        if (!widget || !config || !/^tt\d{5,12}$/.test(imdbId || '')) return null;
        const panelId = `enh-score-correction-${provider}-${imdbId}`;
        const trigger = makeEl('button', {
            type:'button',
            className:'enh-score-correction-trigger',
            'aria-expanded':'false',
            'aria-controls':panelId,
            'aria-label':t('aria_correct_the_match_for_this_title', [config.label]),
        }, t('label_wrong'));
        const closePanel = (restoreFocus = false) => {
            const open = widget.querySelector?.('.enh-score-correction');
            if (open) {
                open._enhReleaseReserve?.();
                hideFromTopLayer(open, trigger);
                open.remove();
            }
            trigger.setAttribute('aria-expanded', 'false');
            if (restoreFocus && trigger.isConnected) trigger.focus();
        };
        const applyCorrection = record => {
            if (!setScoreCorrection(imdbId, provider, record)) return false;
            closePanel();
            if (typeof options.onApplied === 'function') options.onApplied();
            else refreshFeature(featureKey);
            return true;
        };
        trigger.addEventListener('click', async () => {
            if (widget.querySelector?.('.enh-score-correction')) {
                closePanel();
                return;
            }
            const otherPanel = document.querySelector?.('.enh-score-correction');
            if (otherPanel) {
                otherPanel._enhReleaseReserve?.();
                hideFromTopLayer(otherPanel);
                otherPanel.remove();
            }
            document.querySelectorAll?.('.enh-score-correction-trigger[aria-expanded="true"]')
                .forEach(button => {
                    button.setAttribute('aria-expanded', 'false');
                    button.style?.removeProperty?.('anchor-name');
                });
            trigger.setAttribute('aria-expanded', 'true');
            const current = getScoreCorrection(imdbId, provider);
            const status = makeEl('div', {
                className:'enh-score-correction__status', role:'status', 'aria-live':'polite',
            }, t('text_loading_candidate_matches'));
            const choices = makeEl('div', { className:'enh-score-correction__choices', role:'group', 'aria-label':t('aria_candidate_matches') });
            const manualInput = makeEl('input', {
                type:'url',
                className:'enh-score-correction__input',
                placeholder:t('field_paste_a_title_url', [config.label]),
                'aria-label':t('aria_title_url', [config.label]),
                maxlength:String(SCORE_CORRECTION_URL_LIMIT),
                value:current?.mode === 'url' ? current.url : '',
            });
            const closeButton = makeEl('button', {
                type:'button', className:'enh-score-correction__close', 'aria-label':t('aria_close_correction_panel'),
                onClick:() => closePanel(true),
            }, '×');
            const panel = makeEl('div', {
                id:panelId,
                className:'enh-score-correction',
                role:'dialog',
                'aria-label':t('aria_correct_match', [config.label]),
            },
                makeEl('div', { className:'enh-score-correction__header' },
                    makeEl('strong', {}, t('text_correct_source_match', [config.label])),
                    closeButton
                ),
                makeEl('div', { className:'enh-score-correction__current' },
                    current?.mode === 'none'
                        ? t('text_saved_choice_no_entry_on_this_source')
                        : current?.mode === 'url'
                            ? `Saved match: ${current.title || current.url}`
                            : t('text_automatic_matching_is_active')
                ),
                status,
                choices,
                makeEl('label', { className:'enh-score-correction__label' }, t('text_manual_title_url'), manualInput),
                makeEl('div', { className:'enh-score-correction__actions' },
                    makeEl('button', {
                        type:'button', className:'enh-score-correction__button',
                        onClick:() => {
                            const url = normalizeScoreCorrectionUrl(provider, manualInput.value);
                            manualInput.setAttribute('aria-invalid', String(!url));
                            if (!url) {
                                status.textContent = t('text_use_a_valid_title_url', [config.label]);
                                return;
                            }
                            applyCorrection({ mode:'url', url });
                        },
                    }, t('text_save_url')),
                    makeEl('button', {
                        type:'button', className:'enh-score-correction__button',
                        onClick:() => applyCorrection({ mode:'none' }),
                    }, t('text_no_entry')),
                    ...(current ? [makeEl('button', {
                        type:'button', className:'enh-score-correction__button',
                        onClick:() => applyCorrection(null),
                    }, t('text_use_automatic'))] : [])
                )
            );
            widget.appendChild(panel);
            showInTopLayer(panel, trigger);
            const previousMarginBottom = widget.style.marginBottom;
            const syncPanelReserve = () => {
                if (!panel.isConnected) return;
                const panelRect = panel.getBoundingClientRect();
                const widgetRect = widget.getBoundingClientRect();
                const reserve = Math.max(0, Math.ceil(panelRect.bottom - widgetRect.bottom + 8));
                widget.style.marginBottom = reserve
                    ? `calc(${previousMarginBottom || '0px'} + ${reserve}px)`
                    : previousMarginBottom;
            };
            panel._enhReleaseReserve = () => {
                if (previousMarginBottom) widget.style.marginBottom = previousMarginBottom;
                else widget.style.removeProperty('margin-bottom');
            };
            requestAnimationFrame(() => {
                syncPanelReserve();
                if (panel.isConnected) closeButton.focus();
            });
            panel.addEventListener('keydown', event => {
                if (event.key !== 'Escape') return;
                event.preventDefault();
                event.stopPropagation();
                closePanel(true);
            });
            /* A click anywhere else puts it away, as the link menu already does. */
            const onOutsideClick = event => {
                if (!panel.isConnected) { document.removeEventListener('click', onOutsideClick, true); return; }
                if (panel.contains(event.target) || trigger.contains(event.target)) return;
                document.removeEventListener('click', onOutsideClick, true);
                closePanel();
            };
            setTimeout(() => document.addEventListener('click', onOutsideClick, true), 0);
            manualInput.addEventListener('input', () => manualInput.setAttribute('aria-invalid', 'false'));
            const title = getTitleText();
            const year = getTitleYear();
            const mediaType = isTVType() ? 'tv' : 'movie';
            try {
                const loader = typeof options.loadCandidates === 'function'
                    ? options.loadCandidates
                    : fetchScoreCorrectionCandidates;
                const candidates = await loader(provider, title, year, mediaType);
                if (!panel.isConnected) return;
                choices.replaceChildren();
                if (!candidates.length) {
                    status.textContent = t('text_no_candidate_matches_were_found_paste');
                    syncPanelReserve();
                    return;
                }
                candidates.forEach(candidate => {
                    const normalized = normalizeScoreCorrectionCandidate(provider, candidate);
                    if (!normalized) return;
                    const label = [normalized.title, normalized.year || '', normalized.detail || ''].filter(Boolean).join(' · ');
                    choices.appendChild(makeEl('button', {
                        type:'button',
                        className:'enh-score-correction__choice',
                        title:normalized.url,
                        onClick:() => applyCorrection({
                            mode:'url', url:normalized.url, title:normalized.title, year:normalized.year,
                        }),
                    }, label));
                });
                status.textContent = tCount('text_correction_candidate_count', choices.children.length);
                syncPanelReserve();
            } catch {
                if (panel.isConnected) {
                    status.textContent = t('text_candidate_matches_could_not_be_loaded');
                    syncPanelReserve();
                }
            }
        });
        widget.appendChild(trigger);
        return trigger;
    }

    /* Which widget each score source owns, so the shared fallback below can label the one
       it just rendered without every feature repeating the wiring. */
    const SCORE_WIDGET_IDS = {
        inlineRTScore: 'enh-rt-widget',
        inlineLetterboxdScore: 'enh-lb-widget',
        inlineMetacriticScore: 'enh-mc-widget',
        inlineAnimeScore: 'enh-anilist-widget',
        streamAvailability: 'enh-jw-widget',
        airsOn: 'enh-tvmaze-widget',
    };

    /* Only a failure to reach the service qualifies. An identity mismatch or an
       unparseable response means the lookup worked and the answer was wrong or absent,
       and showing an old value for those would be asserting something the current data
       contradicts. Those paths do not throw at all — they fall through — so the absence
       of an error is itself the signal. */
    function isReachabilityFailure(error) {
        if (!error) return false;
        const category = classifyFailure(error);
        if (category === 'network' || category === 'timeout') return true;
        return category === 'http' && Number(error.status) >= 500 && Number(error.status) <= 599;
    }

    function recordLookupFailure(feature, error) {
        if (!feature?.key || !error) return;
        appendFailureJournal(feature.key, classifyFailure(error));
    }

    /* stale-if-error, RFC 5861's shape: a bounded expired value is better than nothing
       when the provider is unreachable, but only if it says how old it is and offers a
       way to try again. */
    /* "Score unavailable" is the right thing to say when the provider answered and had
       nothing, and the wrong thing to say when the extension was never allowed to ask.
       The second is the user's to fix, so it says so and offers the page that can fix it.
       A browser only lets an extension request access from one of its own pages, which is
       why this opens that page rather than prompting here. */
    /* A provider that requires credit gets it wherever its data is rendered, taken from
       the provider's own declaration rather than written out beside each widget. */
    function appendProviderAttribution(widget, providerId) {
        const text = PROVIDERS[providerId]?.attribution;
        if (!text) return;
        widget.appendChild(makeEl('div', { className:'enh-score-widget__attribution' }, text));
    }

    function appendUnavailableNote(widget, reason, unavailableText = t('text_score_unavailable')) {
        if (reason === 'excluded' || reason === 'region') {
            widget.appendChild(makeEl('div', { className:'enh-score-widget__sub' }, unavailableText));
            return;
        }
        if (reason === 'omdb-unconfigured' || reason === 'omdb-rejected') {
            const rejected = reason === 'omdb-rejected';
            widget.appendChild(makeEl('div', { className:'enh-score-widget__sub' },
                rejected ? t('text_omdb_rejected_this_key') : t('text_needs_an_omdb_key')));
            widget.appendChild(makeEl('button', {
                type:'button',
                className:'enh-score-stale__retry',
                onClick: () => {
                    if (!document.getElementById('enh-settings-overlay')) createSettingsPanel();
                    if (!settingsOpen) toggleSettings();
                },
            }, rejected ? t('text_replace_key') : t('text_add_key')));
            return;
        }
        if (reason === 'unconfigured' || reason === 'rejected') {
            widget.appendChild(makeEl('div', { className:'enh-score-widget__sub' },
                reason === 'rejected' ? t('text_tmdb_rejected_this_token') : t('text_needs_a_tmdb_read_token')));
            widget.appendChild(makeEl('button', {
                type:'button',
                className:'enh-score-stale__retry',
                onClick: () => {
                    if (!document.getElementById('enh-settings-overlay')) createSettingsPanel();
                    if (!settingsOpen) toggleSettings();
                },
            }, reason === 'rejected' ? t('text_replace_token') : t('text_add_token')));
            return;
        }
        if (reason !== 'access') {
            widget.appendChild(makeEl('div', { className:'enh-score-widget__sub' }, unavailableText));
            return;
        }
        const note = makeEl('div', { className:'enh-score-widget__sub' }, t('label_site_access_not_granted'));
        widget.appendChild(note);
        if (!supportsOptionalPermissions()) return;
        widget.appendChild(makeEl('button', {
            type:'button',
            className:'enh-score-stale__retry',
            onClick: async () => {
                if (await openOptionsPage()) showToast(t('toast_grant_then_reload'), 5000);
            },
        }, t('settings_grant_access')));
    }

    /* Named where the widget renders it, so a build that cannot ship a source says which
       one and why instead of showing an empty or perpetually loading panel. */
    function describeProfileExclusion(key) {
        const names = (FEATURE_PROVIDERS[key] || [])
            .filter(id => !PROVIDERS[id]?.auxiliary && !providerAllowedHere(id))
            .map(id => PROVIDERS[id]?.label)
            .filter(Boolean);
        return names.length ? `Not available in this build (${joinNames([...new Set(names)])})` : t('text_not_available_in_this_build');
    }

    async function renderStaleScore(feature, cacheKey, error, isCurrent = () => true) {
        if (!isReachabilityFailure(error)) return false;
        /* A missing host grant fails exactly like a dead host: the browser refuses the
           request with the same opaque TypeError and no reason attached. Treating that as
           an outage showed last week's score with a Retry button that could never succeed,
           and hid the only thing the user can actually fix. When the origin is not granted
           this declines, and the caller's unavailable state says so instead. */
        if (!await hasFeatureOrigins(feature.key)) return false;
        // That check is asynchronous, so the page may have moved on during it. Report it
        // as handled: there is nothing left to render, and the caller must not fall
        // through and paint an unavailable state for a title nobody is looking at.
        if (!isCurrent()) return true;
        const stale = cacheGetStale(cacheKey);
        if (!stale) return false;
        feature._render(stale.data);
        const widget = document.getElementById(SCORE_WIDGET_IDS[feature.key]);
        if (!widget) return false;
        widget.classList.add('enh-score-widget--stale');
        const date = new Date(stale.ts).toISOString().slice(0, 10);
        widget.appendChild(makeEl('div', { className:'enh-score-stale' },
            makeEl('span', { className:'enh-score-stale__age' }, t('text_cached_on', [date])),
            makeEl('button', {
                type:'button',
                className:'enh-score-stale__retry',
                'aria-label':t('aria_look_up_again', [feature.name]),
                onClick: () => refreshFeature(feature.key),
            }, t('label_retry'))
        ));
        return true;
    }

    /* Both score widgets answer from the same OMDb call. Returns true when it put
       something on screen — a score, or the reason there is none — so the caller knows
       whether its own fallback path still has work to do. */
    async function renderOmdbScore(feature, field, imdbId, isCurrent) {
        let answer;
        try {
            answer = await fetchOmdbRatings(imdbId, isCurrent);
        } catch (error) {
            recordLookupFailure(feature, error);
            return false;
        }
        if (!isCurrent()) return true;
        if (answer?.unconfigured) { feature._renderUnavailable('omdb-unconfigured'); return true; }
        if (answer?.rejected) { feature._renderUnavailable('omdb-rejected'); return true; }
        const value = boundedScore(answer?.[field], 100);
        if (value === null) return false;
        feature._render(field === 'rt'
            ? { tomatometer:value, via:'omdb' }
            : { score:value, via:'omdb' });
        return true;
    }

    reg({
        key: 'inlineRTScore', name: t('feature_inlineRTScore_name'), group: 'Scores',
        async init() {
            const isCurrent = createFeatureGuard(this);
            const imdbId = getIMDbID(), title = getTitleText(), year = getTitleYear();
            if (!imdbId || !title) return;

            const cacheKey = 'rt_' + imdbId;
            const correction = getScoreCorrection(imdbId, 'rottenTomatoes');
            /* A build that excludes every provider behind this feature cannot answer, so
               it says which one is missing rather than sitting on a loading state. */
            if (featureExcludedByProfile(this.key)) { this._renderUnavailable('excluded'); return; }
            const cached = readScoreCacheForCorrection(cacheKey, correction);
            const bar = await waitForRatingBar(isCurrent);
            if (!bar || !isCurrent()) return;
            if (correction?.mode === 'none') {
                this._renderUnavailable('corrected-none');
                return;
            }
            if (cached) {
                if (cached.unavailable) this._renderUnavailable();
                else this._render(cached);
                return;
            }
            if (!await waitUntilVisible(bar, isCurrent) || !isCurrent()) return;
            this._renderLoading();

            /* A build that does not ship the page parser has no search or detail page to
               read, and no origin to read it from, so OMDb is the whole path here. */
            if (!providerAllowedHere('rottenTomatoes')) {
                if (!await renderOmdbScore(this, 'rt', imdbId, isCurrent) && isCurrent()) {
                    this._renderUnavailable('unavailable');
                }
                return;
            }

            const type = isTVType() ? 'tv' : 'movie';
            if (!isCurrent()) return;

            if (correction?.mode === 'url') {
                try {
                    const response = await httpGet(correction.url, { cancelOnRouteChange:true });
                    if (!isCurrent()) return;
                    const resolvedUrl = resolveScoreCorrectionResponseUrl('rottenTomatoes', response, correction.url);
                    const corrected = resolvedUrl ? parseRTDetailPage(
                        response.responseText,
                        correction.title || title,
                        correction.year || year,
                        type,
                        resolvedUrl,
                        true
                    ) : null;
                    if (corrected) {
                        const data = withScoreCorrection(corrected, correction);
                        cacheSet(cacheKey, data);
                        this._render(data);
                        return;
                    }
                } catch { /* the saved choice remains visible and editable below */ }
                if (!isCurrent()) return;
                this._renderUnavailable('correction-failed');
                return;
            }

            /* A Wikidata-mapped identifier names the exact Rotten Tomatoes page,
               so the search step and its ranking guesswork can be skipped. The
               detail parser still has to agree on title, type, and year before
               anything is cached, so a stale mapping cannot mislabel a title. */
            const mapped = await resolveExternalIds(imdbId, isCurrent);
            if (!isCurrent()) return;
            if (mapped.rt) {
                try {
                    const mappedUrl = `https://www.rottentomatoes.com/${mapped.rt}`;
                    const mappedRes = await httpGet(mappedUrl, { cancelOnRouteChange:true });
                    if (!isCurrent()) return;
                    const resolvedUrl = normalizeTrustedUrl(mappedRes.finalUrl, 'rottentomatoes.com', mappedUrl);
                    const mappedData = parseRTDetailPage(mappedRes.responseText, title, year, type, resolvedUrl);
                    if (mappedData) {
                        cacheSet(cacheKey, mappedData);
                        this._render(mappedData);
                        return;
                    }
                } catch { /* fall through to the validated search path */ }
                if (!isCurrent()) return;
            }

            let lookupError = null;
            try {
                const searchUrl = `https://www.rottentomatoes.com/search?search=${encodeURIComponent(title)}`;
                const res2 = await httpGet(searchUrl, { cancelOnRouteChange:true });
                if (!isCurrent()) return;
                const result = parseRTSearchResult(res2.responseText, title, year, type);
                if (result) {
                    let data = result;
                    try {
                        const detailRes = await httpGet(result.url, { cancelOnRouteChange:true });
                        if (!isCurrent()) return;
                        const resolvedUrl = normalizeTrustedUrl(detailRes.finalUrl, 'rottentomatoes.com', result.url);
                        data = parseRTDetailPage(detailRes.responseText, title, year, type, resolvedUrl) || result;
                    } catch { /* the identity-bound search score remains usable */ }
                    cacheSet(cacheKey, data); this._render(data);
                    return;
                }
            } catch (error) { lookupError = error; }
            if (!isCurrent()) return;
            recordLookupFailure(this, lookupError);
            /* Reading their page did not answer. With a key of your own there is a second
               source that can, so it is asked before anything stale or absent is shown. */
            if (isOmdbConfigured() && await renderOmdbScore(this, 'rt', imdbId, isCurrent)) return;
            if (!isCurrent()) return;
            /* A provider that could not be reached is the one case where a bounded
               expired value beats nothing, provided it is labelled with its date and
               offers a retry. A mismatch or an unparseable response is not: the lookup
               worked and the answer was absent, so an old score would contradict it. */
            if (await renderStaleScore(this, cacheKey, lookupError, isCurrent)) return;
            /* Nothing is recorded when the failure was only a missing host grant, so the
               next visit retries instead of reading back a stale "unavailable". */
            const blocked = await cacheUnavailableUnlessBlocked(this.key, cacheKey, lookupError);
            if (!isCurrent()) return;
            this._renderUnavailable(blocked ? 'access' : 'unavailable');
        },
        _render(data) {
            document.getElementById('enh-rt-widget')?.remove();
            const bar = findRatingBar();
            if (!bar) return;
            const score = boundedScore(data.tomatometer, 100);
            const audience = boundedScore(data.audience, 100);
            const hasScore = score !== null;
            const hasAudience = audience !== null;
            const color = hasScore ? rtColorFn(score) : '';
            const consensus = String(data.consensus || '').trim().slice(0, 500);
            const fallbackUrl = `https://www.rottentomatoes.com/search?search=${encodeURIComponent(getTitleText())}`;
            const href = normalizeTrustedUrl(data.url, 'rottentomatoes.com', fallbackUrl);
            const w = makeEl('div', { id: 'enh-rt-widget', className: 'enh-score-widget' });
            const scoreLink = makeEl('a', {
                href,
                target:'_blank', rel:'noopener noreferrer', className:'enh-score-widget__score',
                style:hasScore ? { '--score-color':color } : {},
                ...(consensus ? { title:consensus } : {}),
            },
                makeEl('span', { className:'enh-score-widget__badge enh-score-widget__badge--outline' }, 'RT'),
                makeEl('span', { className:'enh-score-widget__value' }, hasScore ? `${score}%` : '--')
            );
            w.append(makeEl('div', { className:'enh-score-widget__label' }, 'TOMATOMETER'), scoreLink);
            announceScore('Rotten Tomatoes', `${score}%`);
            if (hasAudience) w.appendChild(makeEl('div', { className:'enh-score-widget__sub' }, t('text_audience_score', [audience])));
            if (data.via === 'omdb') {
                w.appendChild(makeEl('div', { className:'enh-score-widget__sub' }, t('label_via_omdb')));
                appendProviderAttribution(w, 'omdb');
            }
            if (providerAllowedHere('rottenTomatoes')) appendScoreCorrectionAction(w, 'rottenTomatoes', this.key);
            bar.appendChild(w);
        },
        _renderLoading() {
            if (document.getElementById('enh-rt-widget')) return;
            const bar = findRatingBar();
            if (!bar) return;
            const w = makeEl('div', { id: 'enh-rt-widget', className: 'enh-score-widget enh-score-widget--loading', 'aria-busy':'true' });
            w.innerHTML = `
                <div class="enh-score-widget__label">TOMATOMETER</div>
                <div class="enh-score-widget__skeleton" aria-label="${t('aria_loading_rotten_tomatoes_score')}"></div>
            `;
            bar.appendChild(w);
        },
        _renderUnavailable(reason = 'unavailable') {
            document.getElementById('enh-rt-widget')?.remove();
            const bar = findRatingBar();
            if (!bar) return;
            const w = makeEl('div', { id: 'enh-rt-widget', className: 'enh-score-widget enh-score-widget--muted' });
            w.innerHTML = `
                <div class="enh-score-widget__label">TOMATOMETER</div>
                <a href="https://www.rottentomatoes.com/search?search=${encodeURIComponent(getTitleText())}"
                   target="_blank" rel="noopener noreferrer" class="enh-score-widget__score">
                    <span class="enh-score-widget__badge enh-score-widget__badge--outline">RT</span>
                    <span class="enh-score-widget__value">${t('label_open')}</span>
                </a>
            `;
            w.querySelector('a')?.setAttribute('href', getSavedScoreCorrectionUrl(
                'rottenTomatoes', `https://www.rottentomatoes.com/search?search=${encodeURIComponent(getTitleText())}`));
            const note = reason === 'excluded' ? describeProfileExclusion(this.key)
                : reason === 'corrected-none' ? t('text_marked_as_no_entry_on_rotten_tomatoes')
                : reason === 'correction-failed' ? t('text_saved_rotten_tomatoes_match_unavailable')
                : t('text_score_unavailable');
            appendUnavailableNote(w, reason, note);
            if (reason !== 'excluded' && providerAllowedHere('rottenTomatoes')) {
                appendScoreCorrectionAction(w, 'rottenTomatoes', this.key);
            }
            bar.appendChild(w);
        },
        destroy() { document.getElementById('enh-rt-widget')?.remove(); }
    });

    reg({
        key: 'inlineLetterboxdScore', name: t('feature_inlineLetterboxdScore_name'), group: 'Scores',
        async init() {
            const isCurrent = createFeatureGuard(this);
            if (isTVType()) return;
            const imdbId = getIMDbID(), title = getTitleText(), year = getTitleYear();
            if (!imdbId || !title) return;

            const cacheKey = 'lb_' + imdbId;
            const correction = getScoreCorrection(imdbId, 'letterboxd');
            /* A build that excludes every provider behind this feature cannot answer, so
               it says which one is missing rather than sitting on a loading state. */
            if (featureExcludedByProfile(this.key)) { this._renderUnavailable('excluded'); return; }
            const cached = readScoreCacheForCorrection(cacheKey, correction);
            const bar = await waitForRatingBar(isCurrent);
            if (!bar || !isCurrent()) return;
            if (correction?.mode === 'none') {
                this._renderUnavailable('corrected-none');
                return;
            }
            if (cached) {
                if (cached.unavailable) this._renderUnavailable();
                else this._render(cached);
                return;
            }
            if (!await waitUntilVisible(bar, isCurrent) || !isCurrent()) return;
            this._renderLoading();

            if (correction?.mode === 'url') {
                try {
                    const response = await httpGet(correction.url, { cancelOnRouteChange:true });
                    if (!isCurrent()) return;
                    const resolvedUrl = resolveScoreCorrectionResponseUrl('letterboxd', response, correction.url);
                    const corrected = resolvedUrl ? parseLetterboxdDetailPage(
                        response.responseText,
                        correction.title || title,
                        correction.year || year,
                        resolvedUrl,
                        true
                    ) : null;
                    if (corrected) {
                        const data = withScoreCorrection(corrected, correction);
                        cacheSet(cacheKey, data);
                        this._render(data);
                        return;
                    }
                } catch { /* the saved choice remains visible and editable below */ }
                if (!isCurrent()) return;
                this._renderUnavailable('correction-failed');
                return;
            }

            const lookupUrl = `https://letterboxd.com/imdb/${imdbId}/`;
            let lookupError = null;
            try {
                const res = await httpGet(lookupUrl, { cancelOnRouteChange:true });
                if (!isCurrent()) return;
                const resolvedUrl = normalizeTrustedUrl(res.finalUrl, 'letterboxd.com', lookupUrl);
                const data = parseLetterboxdDetailPage(res.responseText, title, year, resolvedUrl);
                if (data) {
                    cacheSet(cacheKey, data);
                    this._render(data);
                    return;
                }
            } catch (error) { lookupError = error; }

            if (!isCurrent()) return;
            recordLookupFailure(this, lookupError);
            /* A provider that could not be reached is the one case where a bounded
               expired value beats nothing, provided it is labelled with its date and
               offers a retry. A mismatch or an unparseable response is not: the lookup
               worked and the answer was absent, so an old score would contradict it. */
            if (await renderStaleScore(this, cacheKey, lookupError, isCurrent)) return;
            /* Nothing is recorded when the failure was only a missing host grant, so the
               next visit retries instead of reading back a stale "unavailable". */
            const blocked = await cacheUnavailableUnlessBlocked(this.key, cacheKey, lookupError);
            if (!isCurrent()) return;
            this._renderUnavailable(blocked ? 'access' : 'unavailable');
        },
        _render(data) {
            document.getElementById('enh-lb-widget')?.remove();
            const bar = findRatingBar();
            if (!bar) return;
            const score = boundedScore(data.score, 5);
            if (score === null) { this._renderUnavailable(); return; }
            const color = lbColor(score);
            const count = formatCount(data.ratingCount);
            const fallbackUrl = `https://letterboxd.com/imdb/${getIMDbID()}/`;
            const href = normalizeTrustedUrl(data.url, 'letterboxd.com', fallbackUrl);
            const w = makeEl('div', { id: 'enh-lb-widget', className: 'enh-score-widget' });
            w.append(
                makeEl('div', { className:'enh-score-widget__label' }, 'LETTERBOXD'),
                makeEl('a', {
                    href, target:'_blank', rel:'noopener noreferrer', className:'enh-score-widget__score',
                    style:{ '--score-color':color },
                },
                    makeEl('span', { className:'enh-score-widget__badge enh-score-widget__badge--outline' }, 'LB'),
                    makeEl('span', { className:'enh-score-widget__value' }, formatScore(score))
                ),
                makeEl('div', { className:'enh-score-widget__sub' }, count ? `${count} ratings` : 'Average rating')
            );
            appendScoreCorrectionAction(w, 'letterboxd', this.key);
            announceScore('Letterboxd', formatScore(score));
            bar.appendChild(w);
        },
        _renderLoading() {
            if (document.getElementById('enh-lb-widget')) return;
            const bar = findRatingBar();
            if (!bar) return;
            const w = makeEl('div', { id: 'enh-lb-widget', className: 'enh-score-widget enh-score-widget--loading', 'aria-busy':'true' });
            w.innerHTML = `
                <div class="enh-score-widget__label">LETTERBOXD</div>
                <div class="enh-score-widget__skeleton" aria-label="${t('aria_loading_letterboxd_score')}"></div>
            `;
            bar.appendChild(w);
        },
        _renderUnavailable(reason = 'unavailable') {
            document.getElementById('enh-lb-widget')?.remove();
            const bar = findRatingBar();
            if (!bar) return;
            const w = makeEl('div', { id: 'enh-lb-widget', className: 'enh-score-widget enh-score-widget--muted' });
            w.innerHTML = `
                <div class="enh-score-widget__label">LETTERBOXD</div>
                <a href="https://letterboxd.com/imdb/${getIMDbID()}/"
                   target="_blank" rel="noopener noreferrer" class="enh-score-widget__score">
                    <span class="enh-score-widget__badge enh-score-widget__badge--outline">LB</span>
                    <span class="enh-score-widget__value">${t('label_open')}</span>
                </a>
            `;
            w.querySelector('a')?.setAttribute('href', getSavedScoreCorrectionUrl(
                'letterboxd', `https://letterboxd.com/imdb/${getIMDbID()}/`));
            const note = reason === 'excluded' ? describeProfileExclusion(this.key)
                : reason === 'corrected-none' ? t('text_marked_as_no_entry_on_letterboxd')
                : reason === 'correction-failed' ? t('text_saved_letterboxd_match_unavailable')
                : t('text_score_unavailable');
            appendUnavailableNote(w, reason, note);
            if (reason !== 'excluded') appendScoreCorrectionAction(w, 'letterboxd', this.key);
            bar.appendChild(w);
        },
        destroy() { document.getElementById('enh-lb-widget')?.remove(); }
    });

    /* AniList is the one source in this space with a documented public API, no key, and
       no page to parse — so it is the one a store build can also ship. It has no IMDb-id
       lookup, which is why the title and year are validated against every candidate it
       returns rather than trusting the first.

       Nothing here runs unless the page is an anime title, which is decided from what the
       page already carries. A non-anime title makes no request at all. */
    const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
    const ANILIST_QUERY = 'query($s:String){Page(perPage:5){media(search:$s,type:ANIME){title{romaji english} averageScore seasonYear startDate{year} siteUrl}}}';

    /* IMDb serves every image through one host and encodes the size it wants in the file
       name: everything between "._V1_" and the extension is a transform. Stripping it
       yields the original, which readers have measured at 7644px and 32 MB — one hover
       would cost more than the rest of the page. A bounded variant is requested instead,
       and the grammar is the only thing this relies on: no request is made to ask what
       sizes exist, and a URL that does not carry the marker is left alone rather than
       guessed at. */
    const IMAGE_HOST = 'm.media-amazon.com';
    const IMAGE_VARIANT_PATTERN = /\._V1_[^./]*\.(jpg|jpeg|png)$/i;
    const ZOOM_IMAGE_HEIGHT = 800;
    // Matches the max-width the stylesheet gives .enh-zoom__image.
    const ZOOM_MAX_WIDTH = 520;

    function boundedImageVariant(url, height = ZOOM_IMAGE_HEIGHT) {
        let parsed;
        try { parsed = new URL(String(url || ''), location.href); }
        catch { return ''; }
        if (parsed.protocol !== 'https:') return '';
        // The same rule normalizeTrustedUrl applies: an address carrying credentials is refused.
        if (parsed.username || parsed.password) return '';
        const host = parsed.hostname.toLowerCase();
        if (host !== IMAGE_HOST && !host.endsWith('.media-amazon.com')) return '';
        if (!IMAGE_VARIANT_PATTERN.test(parsed.pathname)) return '';
        /* Never smaller than what is already on screen. On a HiDPI display currentSrc is
           IMDb's 2x variant, and asking for a flat 800 there hands back a worse picture
           than the thumbnail it is meant to enlarge. */
        const alreadyAsked = Number(/_U[XY](\d{2,4})_/i.exec(parsed.pathname)?.[1]) || 0;
        const asked = Math.max(Number(height) || ZOOM_IMAGE_HEIGHT, alreadyAsked);
        const wanted = Math.max(200, Math.min(1600, Math.round(asked)));
        parsed.pathname = parsed.pathname.replace(IMAGE_VARIANT_PATTERN, `._V1_QL90_UY${wanted}_.$1`);
        parsed.search = '';
        parsed.hash = '';
        return parsed.href;
    }

    /* Poster and cast thumbnails, by IMDb's own test ids. Nothing here reads a caption or
       a label, so the surfaces are the same on a translated page. */
    const ZOOM_THUMBNAIL_SELECTOR = [
        '[data-testid="hero-media__poster"] img',
        '[data-testid="title-cast-item__avatar"] img',
        '[data-testid="shoveler-item-poster"] img',
    ].join(', ');

    /* IMDb closed its message boards in 2017 and the complaint has not stopped since.
       MovieChat keeps a board per IMDb id and, checked live on 2026-08-31, serves
       /tt{id} as a 301 to /tt{id}/{slug} with no X-Frame-Options and no CSP — so framing
       works by omission rather than by their policy, and could stop working the day they
       add either. A refusal fires no error event — but it does fire load, because every
       browser fires load whenever a navigation commits a document, and a refusal, a 404
       and a challenge page all commit one. Treating load as success is therefore how a
       permanently empty 640px frame ships. What separates the two is the origin: a board
       that actually loaded is cross-origin and reading its location throws, while a frame
       that was refused never left the about:blank it started on, which is ours to read.
       The timeout stays as the backstop for the case where nothing commits at all.

       No request of any kind is made until the section is scrolled to, and there is no
       fetch at any point — the frame is the only thing that ever contacts them. */
    const MOVIECHAT_ORIGIN = 'https://moviechat.org';
    const MOVIECHAT_LOAD_TIMEOUT = 8000;

    function getMovieChatUrl(imdbId) {
        return /^tt\d{7,10}$/.test(String(imdbId || '')) ? `${MOVIECHAT_ORIGIN}/${imdbId}` : '';
    }

    /* Which films belong to the same series, in order. TMDB answers this through
       find -> belongs_to_collection -> /collection/{id}, which needs a token of your own
       and returns TMDB ids that then have to be turned back into IMDb ids. Wikidata
       answers it in one query, keyless, and gives IMDb ids directly: P179 is "part of
       the series" and P1545 is the ordinal within it. Verified live 2026-08-31 against
       query.wikidata.org — tt0796366 returns fourteen Star Trek films with their ids,
       English labels, years and ordinals.

       So the keyless source is the one that ships, which also means the panel works
       without asking anyone for a key, and the store build can have it. Entries without
       an ordinal fall back to release year, which is the order people mean anyway when
       a series has no declared numbering. */
    const COLLECTION_ENTRY_LIMIT = 30;

    function buildCollectionQuery(imdbId) {
        if (!/^tt\d{7,10}$/.test(String(imdbId || ''))) return '';
        const literal = JSON.stringify(String(imdbId));
        return 'SELECT ?imdb ?label (MIN(YEAR(?date)) AS ?year) ?ordinal WHERE {'
            + ` ?self wdt:P345 ${literal}.`
            + ' ?self wdt:P179 ?series.'
            + ' ?item wdt:P179 ?series; wdt:P345 ?imdb.'
            + ' OPTIONAL { ?item wdt:P577 ?date. }'
            + ' OPTIONAL { ?item p:P179 ?statement. ?statement ps:P179 ?series; pq:P1545 ?ordinal. }'
            + ' ?item rdfs:label ?label. FILTER(LANG(?label) = "en")'
            + ` } GROUP BY ?imdb ?label ?ordinal LIMIT ${COLLECTION_ENTRY_LIMIT}`;
    }

    function parseCollectionEntries(responseText) {
        const source = toBoundedText(responseText, WIKIDATA_RESPONSE_LIMIT);
        if (!source) return [];
        let payload = null;
        try { payload = JSON.parse(source); }
        catch { return []; }
        const rows = payload?.results?.bindings;
        if (!Array.isArray(rows)) return [];
        const seen = new Set();
        const entries = [];
        for (let index = 0; index < rows.length && index < COLLECTION_ENTRY_LIMIT; index++) {
            const row = rows[index];
            const imdbId = String(row?.imdb?.value || '');
            // Their data is open, so an id that is not an id is a thing that happens.
            if (!/^tt\d{7,10}$/.test(imdbId) || seen.has(imdbId)) continue;
            const title = toBoundedText(row?.label?.value, USER_MARK_TITLE_LIMIT);
            if (!title) continue;
            seen.add(imdbId);
            entries.push({
                id: imdbId,
                title,
                year: Number(row?.year?.value) || 0,
                ordinal: Number(row?.ordinal?.value) || 0,
            });
        }
        /* By declared position where the series has one, and by year otherwise, which is
           the order people mean when it does not. */
        return entries.sort((a, b) => (a.ordinal || Infinity) - (b.ordinal || Infinity)
            || (a.year || Infinity) - (b.year || Infinity)
            || a.title.localeCompare(b.title));
    }

    /* Letterboxd charges for this, and it is the one thing here that has to keep working
       with every IMDb tab closed — so it belongs to the extension, which has a worker,
       and not to the userscript, which does not. The page's job is only to write down
       what is on the watchlist; the checking happens elsewhere.

       Bounded on purpose. A watchlist can be thousands of titles and every one of them
       would be a request on somebody else's API on a schedule, so this keeps the most
       recently seen page of them and no more. */
    const WATCHLIST_ALERT_STATE_KEY = 'watchlistAlertState';
    const WATCHLIST_SERVICE_LIMIT = 60;
    const WATCHLIST_SNAPSHOT_KEY = 'watchlistSnapshot';
    const WATCHLIST_SNAPSHOT_MAX = 200;
    const WATCHLIST_SNAPSHOT_VERSION = 1;

    function normalizeWatchlistSnapshot(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
        if (Number(value.v) !== WATCHLIST_SNAPSHOT_VERSION) return null;
        const titles = value.titles;
        if (!titles || typeof titles !== 'object' || Array.isArray(titles)) return null;
        const normalized = {};
        let kept = 0;
        for (const [id, entry] of Object.entries(titles)) {
            if (kept >= WATCHLIST_SNAPSHOT_MAX) break;
            if (!/^tt\d{7,10}$/.test(id)) continue;
            const title = toBoundedText(entry?.title, USER_MARK_TITLE_LIMIT);
            if (!title) continue;
            normalized[id] = { title };
            kept += 1;
        }
        const ts = Number(value.ts);
        return { v:WATCHLIST_SNAPSHOT_VERSION, ts: Number.isFinite(ts) && ts > 0 ? ts : 0, titles:normalized };
    }

    /* The services to choose from are the ones the scheduled checks have actually walked
       past in this region, which is the only list that is right everywhere. A list of
       service names written into this file would be a list that is wrong in most of the
       world, and asking TMDB for one would be a second endpoint for a picker. */
    function getWatchlistServiceChoices() {
        const state = get(WATCHLIST_ALERT_STATE_KEY);
        const seen = Array.isArray(state?.services) ? state.services : [];
        return [...new Set(seen
            .map(name => toBoundedText(name, 60))
            .filter(Boolean))].slice(0, WATCHLIST_SERVICE_LIMIT).sort();
    }

    function getWatchlistServices() {
        const chosen = get('watchlistAlertServices');
        return [...new Set((Array.isArray(chosen) ? chosen : [])
            .map(name => toBoundedText(name, 60))
            .filter(Boolean))].slice(0, WATCHLIST_SERVICE_LIMIT);
    }

    function getWatchlistSnapshot() {
        return normalizeWatchlistSnapshot(get(WATCHLIST_SNAPSHOT_KEY))
            || { v:WATCHLIST_SNAPSHOT_VERSION, ts:0, titles:{} };
    }

    /* Read from the cards the page has already rendered. No request, no IMDb API, and
       nothing is written when the page turns out to hold no titles — an empty answer is
       far more likely to be a page that has not finished than a watchlist someone
       emptied, and overwriting the snapshot with it would silence the alerts. */
    function collectWatchlistTitles(root = document) {
        const found = {};
        let seen = 0;
        const cards = root.querySelectorAll('[data-testid="list-summary-item"], li.ipc-metadata-list-summary-item');
        for (const card of cards) {
            if (seen >= WATCHLIST_SNAPSHOT_MAX) break;
            const link = card.querySelector('a[href*="/title/tt"]');
            const id = getLinkedTitleId(link?.getAttribute('href') || '');
            if (!id || found[id]) continue;
            const title = toBoundedText(link.textContent, USER_MARK_TITLE_LIMIT);
            if (!title) continue;
            found[id] = { title };
            seen += 1;
        }
        return found;
    }

    /* The userscript has no worker, so it does not get a feature that depends on one.
       Registered only where it can actually run, rather than registered everywhere and
       returning early, so the settings panel in a userscript build never lists it. */
    if (IS_EXTENSION_BUILD) {
        reg({
            key: 'watchlistAlerts', name: t('feature_watchlistAlerts_name'), group: 'Utility',
            init() {
                if (!/\/user\/[^/]+\/watchlist/i.test(location.pathname)) return;
                const record = () => {
                    const titles = collectWatchlistTitles();
                    if (!Object.keys(titles).length) return;
                    set(WATCHLIST_SNAPSHOT_KEY, { v:WATCHLIST_SNAPSHOT_VERSION, ts:Date.now(), titles });
                };
                record();
                /* The list pages in as you scroll, so what was on screen at init is not
                   what is on the watchlist. Re-read on a settle rather than per mutation. */
                this._observer = new MutationObserver(() => {
                    clearTimeout(this._settle);
                    this._settle = setTimeout(record, 800);
                });
                this._observer.observe(document.querySelector('main') || document.body,
                    { childList:true, subtree:true });
            },
            destroy() {
                clearTimeout(this._settle);
                this._observer?.disconnect();
                this._observer = null;
            },
        });
    }

    reg({
        key: 'collectionPanel', name: t('feature_collectionPanel_name'), group: 'Features',
        async init() {
            const isCurrent = createFeatureGuard(this);
            if (getPageSurface() !== 'title') return;
            const imdbId = getIMDbID();
            const query = buildCollectionQuery(imdbId);
            if (!query) return;
            if (featureExcludedByProfile(this.key)) return;

            const cacheKey = 'series_' + imdbId;
            const cached = cacheGet(cacheKey);
            if (cached) {
                if (Array.isArray(cached.entries) && cached.entries.length > 1) this._render(cached.entries, imdbId);
                return;
            }

            const host = document.querySelector('main') || document.body;
            if (!host) return;
            /* Its own placeholder, not main: main is on screen the moment the page loads,
               so waiting for that to be visible is not waiting at all. */
            const placeholder = makeEl('div', { id:'enh-collection', style:{ height:'1px' } });
            host.appendChild(placeholder);
            const visible = await waitUntilVisible(placeholder, isCurrent);
            placeholder.remove();
            if (!visible || !isCurrent()) return;

            let entries = [];
            try {
                const response = await httpGet(`${WIKIDATA_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`, {
                    headers: { Accept:'application/sparql-results+json' },
                    cancelOnRouteChange: true,
                });
                if (!isCurrent()) return;
                entries = parseCollectionEntries(response.responseText);
            } catch (error) {
                if (!isCurrent()) return;
                recordLookupFailure(this, error);
                return;
            }
            /* A title that is in no series answers with itself, or with nothing. Either
               way there is no watch order to show, and that is cached too so the next
               visit does not ask again. */
            cacheSet(cacheKey, { entries }, CACHE_MAX_TTL);
            if (entries.length > 1) this._render(entries, imdbId);
        },
        _render(entries, imdbId) {
            document.getElementById('enh-collection')?.remove();
            const host = document.querySelector('main') || document.body;
            if (!host) return;
            const list = makeEl('ol', { className:'enh-collection__list' });
            entries.forEach(entry => {
                const current = entry.id === imdbId;
                const label = entry.year
                    ? t('text_collection_entry', [entry.title, entry.year])
                    : entry.title;
                list.appendChild(makeEl('li', {
                    className: current ? 'enh-collection__item enh-collection__item--current' : 'enh-collection__item',
                    ...(current ? { 'aria-current':'true' } : {}),
                }, current
                    ? makeEl('span', {}, label)
                    : makeEl('a', { href:`/title/${entry.id}/`, className:'enh-collection__link' }, label)));
            });
            host.appendChild(makeEl('section', { id:'enh-collection', className:'enh-collection' },
                makeEl('div', { className:'enh-collection__header' },
                    makeEl('h3', { className:'enh-collection__title' }, t('text_watch_order')),
                    makeEl('span', { className:'enh-collection__note' }, t('text_collection_source_note'))
                ),
                list
            ));
        },
        destroy() { document.getElementById('enh-collection')?.remove(); },
    });

    reg({
        key: 'movieChatBoard', name: t('feature_movieChatBoard_name'), group: 'Features',
        async init() {
            const isCurrent = createFeatureGuard(this);
            if (getPageSurface() !== 'title') return;
            const imdbId = getIMDbID();
            const url = getMovieChatUrl(imdbId);
            if (!url) return;
            const host = document.querySelector('main') || document.body;
            if (!host || document.getElementById('enh-moviechat')) return;

            const openLink = makeEl('a', {
                href:url, target:'_blank', rel:'noopener noreferrer', className:'enh-moviechat__link',
            }, t('text_open_on_moviechat'));
            const section = makeEl('section', { id:'enh-moviechat', className:'enh-moviechat' },
                makeEl('div', { className:'enh-moviechat__header' },
                    makeEl('h3', { className:'enh-moviechat__title' }, t('text_message_board')),
                    // Said before anything loads: this is someone else's page, inside this one.
                    makeEl('span', { className:'enh-moviechat__note' }, t('text_third_party_board_note')),
                    openLink
                )
            );
            host.appendChild(section);
            this._section = section;

            // Nothing is requested until someone actually scrolls to it.
            if (!await waitUntilVisible(section, isCurrent) || !isCurrent()) return;
            if (!section.isConnected) return;

            const frame = makeEl('iframe', {
                className:'enh-moviechat__frame',
                src:url,
                title:t('text_message_board'),
                loading:'lazy',
                referrerpolicy:'no-referrer',
                sandbox:'allow-scripts allow-same-origin allow-popups allow-forms',
            });
            let settled = false;
            const giveUp = () => {
                if (settled) return;
                settled = true;
                frame.remove();
                section.classList.add('enh-moviechat--unavailable');
                section.appendChild(makeEl('div', { className:'enh-moviechat__note' },
                    t('text_board_could_not_be_shown')));
            };
            const boardIsShowing = () => {
                if (!frame.contentWindow) return false;
                try {
                    // Readable means it is still our about:blank: nothing was framed.
                    void frame.contentWindow.location.href;
                    return false;
                } catch {
                    // Cross-origin, which is what their document looks like from here.
                    return true;
                }
            };
            frame.addEventListener('load', () => {
                if (settled) return;
                if (!boardIsShowing()) { giveUp(); return; }
                settled = true;
                clearTimeout(this._timer);
                section.classList.add('enh-moviechat--loaded');
            }, { once:true });
            // The backstop, for a frame that never commits anything at all.
            this._timer = setTimeout(giveUp, MOVIECHAT_LOAD_TIMEOUT);
            section.appendChild(frame);
        },
        destroy() {
            clearTimeout(this._timer);
            this._timer = null;
            document.getElementById('enh-moviechat')?.remove();
            this._section = null;
        },
    });

    /* IMDb suppresses the context menu over gallery images, which is why "save image as"
       does nothing there. The most-installed script in this corner of the ecosystem does
       nothing else at all.

       Stopping the event before their handler sees it is the whole fix, and it is done
       without preventDefault: the aim is to restore what the browser would do, not to
       replace it with something of ours. Capture phase, because their listener is on an
       ancestor and the point is to arrive first. */
    reg({
        key: 'restoreImageContextMenu', name: t('feature_restoreImageContextMenu_name'), group: 'Appearance',
        init() {
            this._onContextMenu = event => {
                if (!event.target?.closest?.('img, [data-testid="media-viewer"], picture')) return;
                /* Their suppression is a listener that calls preventDefault. Stopping the
                   event immediately means no further listener runs — including any other
                   on this same node, which plain stopPropagation would have left to fire.
                   Nothing is prevented by us, so the browser shows its own menu exactly as
                   it would anywhere else. */
                event.stopImmediatePropagation();
            };
            /* window, in the capture phase: the first node the event reaches, so a
               suppression anywhere below it — window itself included, for anything
               registered after this — never sees the event. Running at document-start is
               what makes "after this" the common case. */
            window.addEventListener('contextmenu', this._onContextMenu, true);
        },
        destroy() {
            window.removeEventListener('contextmenu', this._onContextMenu, true);
            this._onContextMenu = null;
        },
    });

    reg({
        key: 'imageZoom', name: t('feature_imageZoom_name'), group: 'Appearance',
        _overlay: null,
        _anchor: null,
        init() {
            const show = target => {
                const href = boundedImageVariant(target?.currentSrc || target?.src);
                if (!href || this._anchor === target) return;
                this.hide();
                this._anchor = target;
                const image = makeEl('img', {
                    className:'enh-zoom__image',
                    src:href,
                    alt:target.alt || '',
                    decoding:'async',
                });
                /* A variant IMDb does not have comes back as an error rather than a
                   picture, and an empty frame beside the thumbnail is worse than no
                   feature. The overlay takes itself down instead. */
                image.addEventListener('error', () => this.hide(), { once:true });
                image.addEventListener('load', () => {
                    if (this._anchor === target) this.position(target);
                }, { once:true });
                this._overlay = makeEl('div', {
                    className:'enh-zoom',
                    role:'presentation',
                }, image);
                document.body.appendChild(this._overlay);
                /* Anchored, so the top layer only happens where the engine can also
                   place it against the thumbnail; otherwise position() below keeps
                   doing the arithmetic it always has. */
                if (!showInTopLayer(this._overlay, target)) this.position(target);
            };
            this._onOver = event => {
                const target = event.target?.closest?.(ZOOM_THUMBNAIL_SELECTOR);
                if (target) show(target);
            };
            /* Focus, not only hover: these thumbnails sit inside links, so tabbing
               through the cast list is how this works without a mouse. */
            this._onFocus = event => {
                const link = event.target?.closest?.('a');
                const target = link?.querySelector?.(ZOOM_THUMBNAIL_SELECTOR) || event.target?.closest?.(ZOOM_THUMBNAIL_SELECTOR);
                if (target) show(target);
            };
            this._onOut = event => {
                if (!this._anchor) return;
                const next = event.relatedTarget;
                if (next && this._anchor.contains?.(next)) return;
                this.hide();
            };
            this._onKey = event => { if (event.key === 'Escape') this.hide(); };
            this._onScroll = () => this.hide();
            document.addEventListener('mouseover', this._onOver, true);
            document.addEventListener('mouseout', this._onOut, true);
            document.addEventListener('focusin', this._onFocus, true);
            document.addEventListener('focusout', this._onOut, true);
            document.addEventListener('keydown', this._onKey, true);
            window.addEventListener('scroll', this._onScroll, { passive:true });
        },
        position(target) {
            const overlay = this._overlay;
            if (!overlay || !target?.getBoundingClientRect) return;
            /* In the top layer the anchor rules own the placement, and an inline left
               would win over them. */
            if (overlay.hasAttribute('popover')) return;
            const box = target.getBoundingClientRect();
            const room = window.innerWidth - box.right;
            /* Whichever side has room. The width is only known once the image has loaded,
               so before that this assumes the widest the stylesheet allows rather than
               the few pixels of padding an empty box measures. */
            const width = overlay.offsetWidth > 40 ? overlay.offsetWidth : ZOOM_MAX_WIDTH;
            const left = room > box.left ? box.right + 12 : Math.max(12, box.left - 12 - width);
            const height = overlay.offsetHeight > 40
                ? overlay.offsetHeight
                : Math.min(window.innerHeight * 0.78, ZOOM_IMAGE_HEIGHT);
            const top = Math.max(12, Math.min(box.top, window.innerHeight - height - 12));
            overlay.style.left = `${Math.round(left + window.scrollX)}px`;
            overlay.style.top = `${Math.round(top + window.scrollY)}px`;
        },
        hide() {
            if (this._overlay) {
                hideFromTopLayer(this._overlay, this._anchor);
                this._overlay.remove();
            }
            this._overlay = null;
            this._anchor = null;
        },
        destroy() {
            document.removeEventListener('mouseover', this._onOver, true);
            document.removeEventListener('mouseout', this._onOut, true);
            document.removeEventListener('focusin', this._onFocus, true);
            document.removeEventListener('focusout', this._onOut, true);
            document.removeEventListener('keydown', this._onKey, true);
            window.removeEventListener('scroll', this._onScroll);
            this.hide();
        },
    });

    /* IE-119: where a show airs is a question neither a score nor a streaming list
       answers, and TVmaze is the only source in this space that takes an IMDb id directly
       and needs no key. Verified live 2026-09-01: /lookup/shows?imdb=tt0903747 returns the
       network, its country and a link back in one request.

       Their licence is CC BY-SA and the credit is a condition of use, satisfied by the
       link their own answer carries. */
    const TVMAZE_ORIGIN = 'https://api.tvmaze.com';
    const TVMAZE_TEXT_LIMIT = 200;

    function parseTvmazeShow(json) {
        if (!json || typeof json !== 'object') return null;
        /* The network for broadcast television, the web channel for a streaming original.
           A show has one or the other, and TVmaze puts them in separate fields rather than
           marking which one applies. */
        const carrier = json.network || json.webChannel;
        const name = toBoundedText(carrier?.name, TVMAZE_TEXT_LIMIT).trim();
        if (!name) return null;
        const code = String(carrier?.country?.code || '').trim().toUpperCase();
        const url = normalizeTrustedUrl(json.url, 'tvmaze.com', '');
        return {
            network: name,
            // Only a real country code, so a malformed one is left off rather than shown.
            country: AVAILABILITY_REGION_PATTERN.test(code) ? code : '',
            streaming: !json.network && Boolean(json.webChannel),
            url,
        };
    }

    reg({
        key: 'airsOn', name: t('feature_airsOn_name'), group: 'TV',
        async init() {
            const isCurrent = createFeatureGuard(this);
            const imdbId = getIMDbID();
            if (!imdbId) return;
            /* Series only. A film has no network, and asking about one is a request that
               can only come back empty. */
            const type = getMediaType();
            if (type !== 'series' && type !== 'miniseries') return;
            if (featureExcludedByProfile(this.key)) { this._renderUnavailable('excluded'); return; }

            const cacheKey = `tvmaze_${imdbId}`;
            const cached = cacheGet(cacheKey);
            const bar = await waitForRatingBar(isCurrent);
            if (!bar || !isCurrent()) return;
            if (cached) {
                if (cached.unavailable) this._renderUnavailable();
                else this._render(cached);
                return;
            }
            if (!await waitUntilVisible(bar, isCurrent) || !isCurrent()) return;
            this._renderLoading();

            let lookupError = null;
            try {
                const response = await httpGet(
                    `${TVMAZE_ORIGIN}/lookup/shows?imdb=${encodeURIComponent(imdbId)}`,
                    { headers:{ Accept:'application/json' }, timeout:12000, cancelOnRouteChange:true });
                if (!isCurrent()) return;
                const data = parseTvmazeShow(parseJSONResponse(response, EXTERNAL_RESPONSE_TEXT_LIMIT));
                if (data) {
                    cacheSet(cacheKey, data);
                    this._render(data);
                    return;
                }
            } catch (error) { lookupError = error; }

            if (!isCurrent()) return;
            recordLookupFailure(this, lookupError);
            /* A network a show aired on does not change when TVmaze is unreachable, so a
               dated cached answer beats an empty panel, on the same terms as every other
               source here. */
            if (await renderStaleScore(this, cacheKey, lookupError, isCurrent)) return;
            const blocked = await cacheUnavailableUnlessBlocked(this.key, cacheKey, lookupError);
            if (!isCurrent()) return;
            this._renderUnavailable(blocked ? 'access' : 'unavailable');
        },
        _render(data) {
            document.getElementById('enh-tvmaze-widget')?.remove();
            const bar = findRatingBar();
            if (!bar || !data?.network) return;
            const where = data.country ? `${data.network} (${data.country})` : data.network;
            const w = makeEl('div', { id:'enh-tvmaze-widget', className:'enh-score-widget' });
            const badge = makeEl('span', { className:'enh-score-widget__badge enh-score-widget__badge--outline' }, 'TV');
            const value = makeEl('span', { className:'enh-score-widget__value enh-score-widget__value--availability' }, where);
            w.append(
                makeEl('div', { className:'enh-score-widget__label' },
                    data.streaming ? t('label_streams_on') : t('label_airs_on')),
                data.url
                    ? makeEl('a', {
                        href:data.url, target:'_blank', rel:'noopener noreferrer',
                        className:'enh-score-widget__score enh-score-widget__score--availability',
                        style:{ '--score-color':getTheme().green },
                    }, badge, value)
                    : makeEl('div', {
                        className:'enh-score-widget__score enh-score-widget__score--availability',
                        style:{ '--score-color':getTheme().green },
                    }, badge, value)
            );
            appendProviderAttribution(w, 'tvmaze');
            bar.appendChild(w);
        },
        _renderLoading() {
            if (document.getElementById('enh-tvmaze-widget')) return;
            const bar = findRatingBar();
            if (!bar) return;
            const w = makeEl('div', { id:'enh-tvmaze-widget', className:'enh-score-widget enh-score-widget--loading', 'aria-busy':'true' });
            w.innerHTML = `
                <div class="enh-score-widget__label">${t('label_airs_on')}</div>
                <div class="enh-score-widget__skeleton" aria-label="${t('aria_loading_broadcast_details')}"></div>
            `;
            bar.appendChild(w);
        },
        _renderUnavailable(reason = 'unavailable') {
            document.getElementById('enh-tvmaze-widget')?.remove();
            const bar = findRatingBar();
            if (!bar) return;
            const w = makeEl('div', { id:'enh-tvmaze-widget', className:'enh-score-widget enh-score-widget--unavailable' },
                makeEl('div', { className:'enh-score-widget__label' }, t('label_airs_on')));
            appendUnavailableNote(w, reason, reason === 'excluded'
                ? describeProfileExclusion(this.key)
                : t('text_broadcast_details_unavailable'));
            bar.appendChild(w);
        },
        destroy() { document.getElementById('enh-tvmaze-widget')?.remove(); },
    });

    reg({
        key: 'inlineAnimeScore', name: t('feature_inlineAnimeScore_name'), group: 'Scores',
        async init() {
            const isCurrent = createFeatureGuard(this);
            const imdbId = getIMDbID(), title = getTitleText(), year = getTitleYear();
            if (!imdbId || !title) return;

            const cacheKey = 'anilist_' + imdbId;
            const correction = getScoreCorrection(imdbId, 'anilist');
            if (featureExcludedByProfile(this.key)) { this._renderUnavailable('excluded'); return; }
            const cached = readScoreCacheForCorrection(cacheKey, correction);
            const bar = await waitForRatingBar(isCurrent);
            if (!bar || !isCurrent()) return;
            if (correction?.mode === 'none') {
                this._renderUnavailable('corrected-none');
                return;
            }
            /* The gate, after the page has settled and before anything is drawn or
               requested: the country link sits in the details block, which arrives late,
               and asking before it exists answers no for a title that is one. Nothing
               above this line contacts anyone. */
            if (!isAnimeTitle()) return;
            if (cached) {
                if (cached.unavailable) this._renderUnavailable();
                else this._render(cached);
                return;
            }
            if (!await waitUntilVisible(bar, isCurrent) || !isCurrent()) return;
            this._renderLoading();

            /* A saved choice is an AniList page, so it is read by id. Searching again
               would return the same first answer that was wrong enough to be corrected. */
            if (correction?.mode === 'url') {
                const id = getAniListIdFromUrl(correction.url);
                try {
                    const response = await httpRequest(ANILIST_ENDPOINT, {
                        method:'POST',
                        body: JSON.stringify({ query:ANILIST_BY_ID_QUERY, variables:{ id } }),
                        cancelOnRouteChange:true,
                    });
                    if (!isCurrent()) return;
                    const corrected = id ? parseAniListEntry(parseJSONResponse(response)) : null;
                    if (corrected) {
                        const data = withScoreCorrection(corrected, correction);
                        cacheSet(cacheKey, data);
                        this._render(data);
                        return;
                    }
                } catch { /* the saved choice stays visible and editable below */ }
                if (!isCurrent()) return;
                this._renderUnavailable('correction-failed');
                return;
            }

            let lookupError = null;
            try {
                const response = await httpRequest(ANILIST_ENDPOINT, {
                    method:'POST',
                    body: JSON.stringify({ query:ANILIST_QUERY, variables:{ s:title } }),
                    cancelOnRouteChange:true,
                });
                if (!isCurrent()) return;
                const data = parseAniListSearch(parseJSONResponse(response), title, year);
                if (data) {
                    cacheSet(cacheKey, data);
                    this._render(data);
                    return;
                }
            } catch (error) { lookupError = error; }

            if (!isCurrent()) return;
            recordLookupFailure(this, lookupError);
            if (await renderStaleScore(this, cacheKey, lookupError, isCurrent)) return;
            const blocked = await cacheUnavailableUnlessBlocked(this.key, cacheKey, lookupError);
            if (!isCurrent()) return;
            this._renderUnavailable(blocked ? 'access' : 'unavailable');
        },
        _render(data) {
            document.getElementById('enh-anilist-widget')?.remove();
            const bar = findRatingBar();
            if (!bar) return;
            const score = boundedScore(data.score, 100);
            if (score === null) { this._renderUnavailable(); return; }
            const w = makeEl('div', { id:'enh-anilist-widget', className:'enh-score-widget' });
            const value = makeEl('span', { className:'enh-score-widget__value' }, `${score}%`);
            const badge = makeEl('span', { className:'enh-score-widget__badge enh-score-widget__badge--outline' }, 'AL');
            /* A link only when the answer carried one that survived validation. An entry
               with no usable address is still a score worth showing. */
            const href = normalizeTrustedUrl(data.url, 'anilist.co', '');
            w.append(
                makeEl('div', { className:'enh-score-widget__label' }, 'ANILIST'),
                href
                    ? makeEl('a', {
                        href, target:'_blank', rel:'noopener noreferrer', className:'enh-score-widget__score',
                        style:{ '--score-color':mcColor(score) },
                    }, badge, value)
                    : makeEl('div', { className:'enh-score-widget__score', style:{ '--score-color':mcColor(score) } }, badge, value),
                makeEl('div', { className:'enh-score-widget__sub' }, t('text_anilist_community_average'))
            );
            appendScoreCorrectionAction(w, 'anilist', this.key);
            announceScore('AniList', `${score}%`);
            bar.appendChild(w);
        },
        _renderLoading() {
            if (document.getElementById('enh-anilist-widget')) return;
            const bar = findRatingBar();
            if (!bar) return;
            const w = makeEl('div', { id:'enh-anilist-widget', className:'enh-score-widget enh-score-widget--loading', 'aria-busy':'true' });
            w.innerHTML = `
                <div class="enh-score-widget__label">ANILIST</div>
                <div class="enh-score-widget__skeleton" aria-label="${t('aria_loading_anilist_score')}"></div>
            `;
            bar.appendChild(w);
        },
        _renderUnavailable(reason = 'unavailable') {
            document.getElementById('enh-anilist-widget')?.remove();
            const bar = findRatingBar();
            if (!bar) return;
            const w = makeEl('div', { id:'enh-anilist-widget', className:'enh-score-widget enh-score-widget--muted' });
            w.append(
                makeEl('div', { className:'enh-score-widget__label' }, 'ANILIST'),
                makeEl('div', { className:'enh-score-widget__score' },
                    makeEl('span', { className:'enh-score-widget__badge enh-score-widget__badge--outline' }, 'AL'),
                    makeEl('span', { className:'enh-score-widget__value' }, t('text_score_unavailable'))
                )
            );
            const note = reason === 'excluded' ? describeProfileExclusion(this.key)
                : reason === 'corrected-none' ? t('text_marked_as_no_entry_on_anilist')
                : reason === 'correction-failed' ? t('text_saved_anilist_match_unavailable')
                : t('text_score_unavailable');
            appendUnavailableNote(w, reason, note);
            if (reason !== 'excluded') appendScoreCorrectionAction(w, 'anilist', this.key);
            bar.appendChild(w);
        },
        destroy() { document.getElementById('enh-anilist-widget')?.remove(); },
    });

    reg({
        key: 'inlineMetacriticScore', name: t('feature_inlineMetacriticScore_name'), group: 'Scores',
        async init() {
            const isCurrent = createFeatureGuard(this);
            const imdbId = getIMDbID(), title = getTitleText(), year = getTitleYear();
            if (!imdbId || !title) return;

            const cacheKey = 'mc_' + imdbId;
            const correction = getScoreCorrection(imdbId, 'metacritic');
            /* A build that excludes every provider behind this feature cannot answer, so
               it says which one is missing rather than sitting on a loading state. */
            if (featureExcludedByProfile(this.key)) { this._renderUnavailable('excluded'); return; }
            const cached = readScoreCacheForCorrection(cacheKey, correction);
            const bar = await waitForRatingBar(isCurrent);
            if (!bar || !isCurrent()) return;
            if (correction?.mode === 'none') {
                this._renderUnavailable('corrected-none');
                return;
            }
            if (cached) {
                if (cached.unavailable) this._renderUnavailable();
                else this._render(cached);
                return;
            }
            if (!await waitUntilVisible(bar, isCurrent) || !isCurrent()) return;
            this._renderLoading();

            /* As with Rotten Tomatoes: no parser in this build means no search endpoint
               and no origin, so OMDb answers or nothing does. */
            if (!providerAllowedHere('metacritic')) {
                if (!await renderOmdbScore(this, 'metacritic', imdbId, isCurrent) && isCurrent()) {
                    this._renderUnavailable('unavailable');
                }
                return;
            }

            const mediaType = isTVType() ? 'tv' : 'movie';

            if (correction?.mode === 'url') {
                try {
                    const query = getScoreCorrectionLookupTitle(correction, title);
                    const response = await httpGet(getMetacriticSearchUrl(query, mediaType), { cancelOnRouteChange:true });
                    if (!isCurrent()) return;
                    const source = toBoundedText(response.responseText, EXTERNAL_RESPONSE_TEXT_LIMIT);
                    if (!source) throw failure('unknown', t('text_response_was_too_large_or_empty'));
                    const items = JSON.parse(source)?.data?.items || [];
                    const candidate = collectMetacriticCandidates(items, mediaType)
                        .find(item => scoreCorrectionUrlsMatch('metacritic', item.url, correction.url));
                    if (!candidate) {
                        this._renderUnavailable('correction-failed');
                        return;
                    }
                    const data = withScoreCorrection({
                        score:candidate.score,
                        userScore:candidate.userScore,
                        url:candidate.url,
                        title:candidate.title,
                    }, correction);
                    cacheSet(cacheKey, data);
                    this._render(data);
                    return;
                } catch {
                    if (isCurrent()) this._renderUnavailable('correction-failed');
                    return;
                }
            }

            const mapped = await resolveExternalIds(imdbId, isCurrent);
            if (!isCurrent()) return;
            const url = getMetacriticSearchUrl(title, mediaType);

            let lookupError = null;
            try {
                const res = await httpGet(url, { cancelOnRouteChange:true });
                if (!isCurrent()) return;
                const source = toBoundedText(res.responseText, EXTERNAL_RESPONSE_TEXT_LIMIT);
                if (!source) throw failure('unknown', t('text_response_was_too_large_or_empty'));
                const obj = JSON.parse(source);
                const items = obj?.data?.items || [];
                /* Where Wikidata names the Metacritic slug, prefer the result that
                   actually points at it; search rank alone has never been an
                   identity guarantee. */
                const best = selectMetacriticResult(items, title, year, mediaType, mapped.metacritic);
                if (best) {
                    const score = boundedScore(best.criticScoreSummary?.score, 100);
                    const userScore = boundedScore(best.userScoreSummary?.score, 10);
                    const fallbackUrl = `https://www.metacritic.com/search/${encodeURIComponent(title)}/`;
                    let candidateUrl = fallbackUrl;
                    if (best.criticScoreSummary?.url) {
                        try {
                            candidateUrl = new URL(
                                String(best.criticScoreSummary.url).replace('/critic-reviews/', '/'),
                                'https://www.metacritic.com'
                            ).href;
                        } catch { /* retain trusted fallback */ }
                    }
                    const metaUrl = normalizeTrustedUrl(candidateUrl, 'metacritic.com', fallbackUrl);
                    const d = { score, userScore, url: metaUrl, title: best.title };
                    cacheSet(cacheKey, d); this._render(d);
                    return;
                }
            } catch (error) { lookupError = error; }
            if (!isCurrent()) return;
            recordLookupFailure(this, lookupError);
            /* Reading their search endpoint did not answer. With a key of your own there
               is a second source that can, so it is asked before anything stale or absent
               is shown. */
            if (isOmdbConfigured() && await renderOmdbScore(this, 'metacritic', imdbId, isCurrent)) return;
            if (!isCurrent()) return;
            /* A provider that could not be reached is the one case where a bounded
               expired value beats nothing, provided it is labelled with its date and
               offers a retry. A mismatch or an unparseable response is not: the lookup
               worked and the answer was absent, so an old score would contradict it. */
            if (await renderStaleScore(this, cacheKey, lookupError, isCurrent)) return;
            /* Nothing is recorded when the failure was only a missing host grant, so the
               next visit retries instead of reading back a stale "unavailable". */
            const blocked = await cacheUnavailableUnlessBlocked(this.key, cacheKey, lookupError);
            if (!isCurrent()) return;
            this._renderUnavailable(blocked ? 'access' : 'unavailable');
        },
        _render(data) {
            document.getElementById('enh-mc-widget')?.remove();
            const bar = findRatingBar();
            if (!bar) return;
            const score = boundedScore(data.score, 100);
            const userScore = boundedScore(data.userScore, 10);
            const hasScore = score !== null;
            const hasUserScore = userScore !== null;
            const color = hasScore ? mcColor(score) : '';
            const fallbackUrl = `https://www.metacritic.com/search/${encodeURIComponent(getTitleText())}/`;
            const href = normalizeTrustedUrl(data.url, 'metacritic.com', fallbackUrl);
            const w = makeEl('div', { id: 'enh-mc-widget', className: 'enh-score-widget' });
            w.append(
                makeEl('div', { className:'enh-score-widget__label' }, 'METASCORE'),
                makeEl('a', {
                    href, target:'_blank', rel:'noopener noreferrer', className:'enh-score-widget__score',
                    style:hasScore ? { '--score-color':color } : {},
                }, makeEl('span', {
                    className:'enh-score-widget__badge' + (hasScore ? '' : ' enh-score-widget__badge--outline'),
                    style:hasScore ? { background:color, color:readableTextColor(color) } : {},
                }, hasScore ? String(score) : '--'))
            );
            if (hasUserScore) {
                w.appendChild(makeEl('div', { className:'enh-score-widget__sub' }, t('text_user_score', [userScore.toFixed(1)])));
            }
            if (data.via === 'omdb') {
                w.appendChild(makeEl('div', { className:'enh-score-widget__sub' }, t('label_via_omdb')));
                appendProviderAttribution(w, 'omdb');
            }
            if (providerAllowedHere('metacritic')) appendScoreCorrectionAction(w, 'metacritic', this.key);
            announceScore('Metascore', hasScore ? String(score) : '');
            bar.appendChild(w);
        },
        _renderLoading() {
            if (document.getElementById('enh-mc-widget')) return;
            const bar = findRatingBar();
            if (!bar) return;
            const w = makeEl('div', { id: 'enh-mc-widget', className: 'enh-score-widget enh-score-widget--loading', 'aria-busy':'true' });
            w.innerHTML = `
                <div class="enh-score-widget__label">METASCORE</div>
                <div class="enh-score-widget__skeleton" aria-label="${t('aria_loading_metacritic_score')}"></div>
            `;
            bar.appendChild(w);
        },
        _renderUnavailable(reason = 'unavailable') {
            document.getElementById('enh-mc-widget')?.remove();
            const bar = findRatingBar();
            if (!bar) return;
            const w = makeEl('div', { id: 'enh-mc-widget', className: 'enh-score-widget enh-score-widget--muted' });
            w.innerHTML = `
                <div class="enh-score-widget__label">METASCORE</div>
                <a href="https://www.metacritic.com/search/${encodeURIComponent(getTitleText())}/"
                   target="_blank" rel="noopener noreferrer" class="enh-score-widget__score">
                    <span class="enh-score-widget__badge enh-score-widget__badge--outline">MC</span>
                    <span class="enh-score-widget__value">${t('label_open')}</span>
                </a>
            `;
            w.querySelector('a')?.setAttribute('href', getSavedScoreCorrectionUrl(
                'metacritic', `https://www.metacritic.com/search/${encodeURIComponent(getTitleText())}/`));
            const note = reason === 'excluded' ? describeProfileExclusion(this.key)
                : reason === 'corrected-none' ? t('text_marked_as_no_entry_on_metacritic')
                : reason === 'correction-failed' ? t('text_saved_metacritic_match_unavailable')
                : t('text_score_unavailable');
            appendUnavailableNote(w, reason, note);
            if (reason !== 'excluded' && providerAllowedHere('metacritic')) {
                appendScoreCorrectionAction(w, 'metacritic', this.key);
            }
            bar.appendChild(w);
        },
        destroy() { document.getElementById('enh-mc-widget')?.remove(); }
    });

    reg({
        key: 'streamAvailability', name: t('feature_streamAvailability_name'), group: 'Scores',
        async init() {
            const isCurrent = createFeatureGuard(this);
            const imdbId = getIMDbID(), title = getTitleText();
            if (!imdbId || !title) return;

            const availabilitySource = getEffectiveAvailabilitySource();
            const availabilityRegion = getAvailabilityRegion();
            /* Source and region are part of the answer. The old jw_<id> key and the
               short-lived tmdb_<id> key are deliberately not read, so neither can cross
               an adapter or region boundary after an upgrade. */
            const cacheKey = getAvailabilityCacheKey(imdbId, availabilitySource, availabilityRegion);
            const correction = availabilitySource === 'justwatch'
                ? getScoreCorrection(imdbId, 'justWatch')
                : null;
            /* A build that excludes every provider behind this feature cannot answer, so
               it says which one is missing rather than sitting on a loading state. */
            if (featureExcludedByProfile(this.key)) { this._renderUnavailable('excluded'); return; }
            const cached = availabilitySource === 'justwatch'
                ? readScoreCacheForCorrection(cacheKey, correction)
                : cacheGet(cacheKey);
            const bar = await waitForRatingBar(isCurrent);
            if (!bar || !isCurrent()) return;
            if (correction?.mode === 'none') {
                this._renderUnavailable('corrected-none');
                return;
            }
            if (cached) {
                if (cached.unavailable) this._renderUnavailable(cached.reason || 'unavailable', cached);
                else this._render(cached);
                return;
            }
            if (!await waitUntilVisible(bar, isCurrent) || !isCurrent()) return;
            this._renderLoading();

            /* TMDB is a separate source, not a fallback. Silently reading JustWatch's
               page when the chosen source cannot answer would defeat the reason for
               choosing it, so an unconfigured adapter says so and stops. */
            if (availabilitySource === 'tmdb') {
                let tmdbError = null;
                try {
                    const result = await fetchTmdbAvailability(imdbId, isCurrent);
                    if (!isCurrent() || result.cancelled) return;
                    if (result.unconfigured) { this._renderUnavailable('unconfigured'); return; }
                    const offers = result.offers || emptyOffers();
                    if (offers.stream.length || offers.rent.length || offers.buy.length) {
                        const data = {
                            providers:result.providers, offers, url:result.url,
                            source:'tmdb', region:result.region,
                            ...(result.releases ? { releases:result.releases } : {}),
                        };
                        cacheSet(cacheKey, data);
                        this._render(data);
                        return;
                    }
                    /* A region with no offers is an answer, not a failure, and saying so
                       beats rendering nothing: "not here" is information, and without it
                       the panel looked broken. */
                    const unavailable = {
                        unavailable:true,
                        reason:'region',
                        source:'tmdb',
                        region:result.region || availabilityRegion,
                        url:result.url || '',
                        /* Carried onto the no-offer answer too. Nothing is streaming it and
                           it came out digitally in 2006 is the case the date is worth most
                           in, and it is cached with the rest of the answer. */
                        ...(result.releases ? { releases:result.releases } : {}),
                    };
                    cacheSet(cacheKey, unavailable, CACHE_UNAVAILABLE_TTL);
                    if (!isCurrent()) return;
                    this._renderUnavailable('region', unavailable);
                    return;
                } catch (error) { tmdbError = error; }
                if (!isCurrent()) return;
                recordLookupFailure(this, tmdbError);
                // A rejected token is the user's to fix, not an outage to fall back from.
                if (tmdbError?.tmdbRejected) { this._renderUnavailable('rejected'); return; }
                if (await renderStaleScore(this, cacheKey, tmdbError, isCurrent)) return;
                const tmdbBlocked = await cacheUnavailableUnlessBlocked(this.key, cacheKey, tmdbError);
                if (!isCurrent()) return;
                this._renderUnavailable(tmdbBlocked ? 'access' : 'unavailable');
                return;
            }

            const headers = { Accept: 'text/html,application/xhtml+xml' };
            const expected = { title, year:getTitleYear(), typePath:getJustWatchTypePath() };
            if (correction?.mode === 'url') {
                try {
                    const requestUrl = getJustWatchCorrectionRequestUrl(correction.url, availabilityRegion);
                    if (!requestUrl) throw failure('parse', t('text_saved_justwatch_match_is_invalid'));
                    const response = await httpGet(requestUrl, {
                        headers, timeout:12000, cancelOnRouteChange:true,
                    });
                    if (!isCurrent()) return;
                    const resolvedUrl = resolveJustWatchCorrectionResponseUrl(
                        response, requestUrl, availabilityRegion);
                    const parsed = resolvedUrl
                        ? this._parse(response.responseText, resolvedUrl, expected, true)
                        : null;
                    if (!parsed) {
                        this._renderUnavailable('correction-failed');
                        return;
                    }
                    const data = withScoreCorrection(parsed, correction);
                    cacheSet(cacheKey, data);
                    this._render(data);
                    return;
                } catch {
                    if (isCurrent()) this._renderUnavailable('correction-failed');
                    return;
                }
            }

            const directUrl = getJustWatchDetailUrl(title);
            try {
                const res = await httpGet(directUrl, { headers, timeout: 12000, cancelOnRouteChange:true });
                if (!isCurrent()) return;
                const resolvedUrl = normalizeTrustedUrl(res.finalUrl, 'justwatch.com', directUrl);
                const data = this._parse(res.responseText, resolvedUrl, expected);
                if (data) {
                    cacheSet(cacheKey, data);
                    this._render(data);
                    return;
                }
            } catch { /* fall back to search below */ }

            let lookupError = null;
            try {
                const searchUrl = getJustWatchSearchUrl(title);
                const searchRes = await httpGet(searchUrl, { headers, timeout: 12000, cancelOnRouteChange:true });
                if (!isCurrent()) return;
                const year = getTitleYear();
                const typePath = getJustWatchTypePath();
                const detailUrl = parseJustWatchSearchResult(searchRes.responseText, title, year, typePath);
                if (detailUrl) {
                    const detailRes = await httpGet(detailUrl, { headers, timeout: 12000, cancelOnRouteChange:true });
                    if (!isCurrent()) return;
                    const resolvedUrl = normalizeTrustedUrl(detailRes.finalUrl, 'justwatch.com', detailUrl);
                    const data = this._parse(detailRes.responseText, resolvedUrl, { title, year, typePath });
                    if (data) {
                        cacheSet(cacheKey, data);
                        this._render(data);
                        return;
                    }
                }
            } catch (error) { lookupError = error; }

            if (!isCurrent()) return;
            recordLookupFailure(this, lookupError);
            /* A provider that could not be reached is the one case where a bounded
               expired value beats nothing, provided it is labelled with its date and
               offers a retry. A mismatch or an unparseable response is not: the lookup
               worked and the answer was absent, so an old score would contradict it. */
            if (await renderStaleScore(this, cacheKey, lookupError, isCurrent)) return;
            /* Nothing is recorded when the failure was only a missing host grant, so the
               next visit retries instead of reading back a stale "unavailable". */
            const blocked = await cacheUnavailableUnlessBlocked(this.key, cacheKey, lookupError);
            if (!isCurrent()) return;
            this._renderUnavailable(blocked ? 'access' : 'unavailable');
        },
        _parse(html, url, expected, allowIdentityOverride = false) {
            return parseJustWatchAvailability(html, url, expected, allowIdentityOverride);
        },
        _render(data) {
            document.getElementById('enh-jw-widget')?.remove();
            const bar = findRatingBar();
            if (!bar) return;
            const offers = data.offers && typeof data.offers === 'object' ? data.offers : null;
            const stream = Array.isArray(offers?.stream) ? offers.stream
                : (Array.isArray(data.providers) ? data.providers : []);
            const rent = Array.isArray(offers?.rent) ? offers.rent : [];
            const buy = Array.isArray(offers?.buy) ? offers.buy : [];
            const summary = formatProviderSummary(stream);
            /* Rentable but not streamable is still an answer, and the panel used to give
               up on it entirely. A cached entry from before this shipped has no offers,
               so the streaming list stands in for all of it. */
            if (!summary && !rent.length && !buy.length) { this._renderUnavailable('region', data); return; }
            /* Each adapter returns a title page on its own service. Pick the trust
               boundary from the adapter that produced the payload; checking every URL
               against JustWatch discarded TMDB's region-aware watch link. */
            const fromTmdb = data.source === 'tmdb';
            const fallbackUrl = fromTmdb
                ? `https://www.themoviedb.org/search?query=${encodeURIComponent(getTitleText())}`
                : getJustWatchSearchUrl();
            const href = normalizeTrustedUrl(
                data.url,
                fromTmdb ? 'themoviedb.org' : 'justwatch.com',
                fallbackUrl
            );

            const w = makeEl('div', { id: 'enh-jw-widget', className: 'enh-score-widget enh-score-widget--availability' },
                makeEl('div', { className: 'enh-score-widget__label' }, t('label_streaming')),
                makeEl('a', {
                    href,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    className: 'enh-score-widget__score enh-score-widget__score--availability',
                    // The theme's accent, not the brand yellow: that one is 1.6:1 on white.
                    style: { '--score-color': getTheme().accent },
                },
                    makeEl('span', { className: 'enh-score-widget__badge enh-score-widget__badge--outline' }, fromTmdb ? 'TMDB' : 'JW'),
                    makeEl('span', { className: 'enh-score-widget__value enh-score-widget__value--availability' },
                        summary ? `On ${summary}` : t('text_not_streaming'))
                ),
                makeEl('div', { className: 'enh-score-widget__sub' },
                    fromTmdb ? `Via TMDB${data.region ? ` (${data.region})` : ''}` : 'Via JustWatch')
            );
            /* Renting and buying are listed separately from streaming, because "included
               with something you already pay for" and "costs money today" are different
               answers. TMDB's watch-provider data carries no prices, so none are shown
               rather than invented. */
            [['Rent', rent], ['Buy', buy]].forEach(([label, list]) => {
                if (!list.length) return;
                w.appendChild(makeEl('div', { className: 'enh-score-widget__sub' },
                    `${label}: ${formatProviderSummary(list)}`));
            });
            /* IE-118: when it reached home, which is the question IMDb does not answer
               above the fold. Only what TMDB actually holds for this region; a film with
               no digital date says nothing rather than guessing from the theatrical one. */
            appendReleaseDates(w, data);
            /* TMDB's terms require the endorsement disclaimer, and their watch-provider
               endpoint separately requires the data be credited to JustWatch. Rendered
               with the data, because that is where the terms put it. */
            if (fromTmdb) appendProviderAttribution(w, 'tmdb');
            else appendScoreCorrectionAction(w, 'justWatch', this.key);
            bar.appendChild(w);
        },
        _renderLoading() {
            if (document.getElementById('enh-jw-widget')) return;
            const bar = findRatingBar();
            if (!bar) return;
            const w = makeEl('div', { id: 'enh-jw-widget', className: 'enh-score-widget enh-score-widget--loading enh-score-widget--availability', 'aria-busy':'true' });
            w.innerHTML = `
                <div class="enh-score-widget__label">${t('label_streaming')}</div>
                <div class="enh-score-widget__skeleton" aria-label="${t('aria_loading_streaming_availability')}"></div>
            `;
            bar.appendChild(w);
        },
        _renderUnavailable(reason = 'unavailable', detail = null) {
            document.getElementById('enh-jw-widget')?.remove();
            const bar = findRatingBar();
            if (!bar) return;
            const source = detail?.source === 'tmdb' || detail?.source === 'justwatch'
                ? detail.source
                : getEffectiveAvailabilitySource();
            const usingJustWatch = source !== 'tmdb';
            const storedRegion = String(detail?.region || '').trim().toUpperCase();
            const region = AVAILABILITY_REGION_PATTERN.test(storedRegion)
                ? storedRegion
                : getAvailabilityRegion();
            const fallbackUrl = usingJustWatch
                ? getJustWatchSearchUrl()
                : `https://www.themoviedb.org/search?query=${encodeURIComponent(getTitleText())}`;
            const href = usingJustWatch
                ? getSavedScoreCorrectionUrl('justWatch', fallbackUrl)
                : normalizeTrustedUrl(detail?.url, 'themoviedb.org', fallbackUrl);
            const w = makeEl('div', { id: 'enh-jw-widget', className: 'enh-score-widget enh-score-widget--muted enh-score-widget--availability' },
                makeEl('div', { className: 'enh-score-widget__label' }, t('label_streaming')),
                makeEl('a', {
                    href,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    className: 'enh-score-widget__score enh-score-widget__score--availability',
                },
                    makeEl('span', { className: 'enh-score-widget__badge enh-score-widget__badge--outline' }, usingJustWatch ? 'JW' : 'TMDB'),
                    makeEl('span', { className: 'enh-score-widget__value' }, t('label_open'))
                )
            );
            /* "Not streamable in GB" answers the question; "availability unavailable"
               only says the extension gave up. */
            const availabilityNote = reason === 'excluded' ? describeProfileExclusion(this.key)
                : reason === 'region' ? `Not streamable in ${region}`
                : reason === 'corrected-none' ? t('text_marked_as_no_entry_on_justwatch')
                : reason === 'correction-failed' ? t('text_saved_justwatch_match_unavailable')
                : t('text_availability_unavailable');
            appendUnavailableNote(w, reason, availabilityNote);
            /* Nothing is streaming it and it came out digitally in 2006 is the case where
               that date is worth most, so it is drawn here too. */
            appendReleaseDates(w, detail);
            if (usingJustWatch && reason !== 'excluded') appendScoreCorrectionAction(w, 'justWatch', this.key);
            else if (!usingJustWatch && reason === 'region') appendProviderAttribution(w, 'tmdb');
            bar.appendChild(w);
        },
        destroy() { document.getElementById('enh-jw-widget')?.remove(); }
    });
