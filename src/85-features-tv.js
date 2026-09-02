    // #########################################################################
    //
    //  TV SHOW FEATURES
    //
    // #########################################################################

    /* One definition for the S<n>.E<n> code, shared by the card walk, its
       fallback, and the label. Non-global on purpose: a /g regex would carry
       lastIndex between calls and match intermittently. */
    const EPISODE_CODE_PATTERN = /\bS(\d+)\s*\.\s*E(\d+)\b/i;

    reg({
        key: 'tvEpisodeTools', name: t('feature_tvEpisodeTools_name'), group: 'TV',
        _clickHandler: null,
        _keydownHandler: null,
        _plotAttributes: null,
        init() {
            if (!isTVType() && !/\/title\/tt\d+\/episodes/i.test(location.pathname)) return;
            const isCurrent = createFeatureGuard(this);
            this._plotAttributes = new Map();
            addThemedCSS(t => `
                .enh-episode-spoiler {
                    filter: blur(5px);
                    cursor: pointer;
                    transition: filter .18s ease, opacity .18s ease;
                }
                .enh-episode-spoiler:hover { opacity: .9; }
                .enh-episode-spoiler:focus-visible { outline: 2px solid ${t.accent}; outline-offset: 3px; }
                #enh-best-episodes {
                    margin: 14px 0 18px;
                    padding: 14px;
                    border-radius: 10px;
                    border: 1px solid ${t.accentBorder};
                    background: ${t.accentMuted};
                    color: inherit;
                }
                #enh-best-episodes h3 {
                    margin: 0 0 10px;
                    font: 700 14px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                    color: ${t.accent};
                }
                .enh-best-episodes-list {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 6px;
                    margin: 0;
                    padding: 0;
                    list-style: none;
                }
                .enh-best-episode {
                    display: grid;
                    grid-template-columns: auto 1fr auto;
                    gap: 8px;
                    align-items: center;
                    padding: 7px 9px;
                    border-radius: 8px;
                    background: ${t.sf1};
                    border: 1px solid ${t.bd0};
                }
                .enh-best-episode__rank,
                .enh-best-episode__rating {
                    color: ${t.accent};
                    font: 800 12px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                }
                .enh-best-episode__title {
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    color: inherit;
                    text-decoration: none;
                    font: 600 12px/1.25 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                }
                .enh-best-episode__title:hover { color: ${t.accent}; }
            `, 'enh-tvEpisodeTools');

            const run = () => {
                if (!isCurrent()) return;
                const episodes = this._collectEpisodes();
                if (get('spoilerBlur')) this._blurPlots(episodes);
                this._renderBestEpisodes(episodes);
            };
            waitFor('main, body').then(run).catch(() => { if (isCurrent()) run(); });

            this._clickHandler = (e) => {
                const spoiler = e.target.closest?.('.enh-episode-spoiler');
                if (!spoiler) return;
                if (e.target.closest?.('a,button,input,select,textarea')) return;
                this._revealPlot(spoiler);
            };
            this._keydownHandler = event => {
                const spoiler = event.target.closest?.('.enh-episode-spoiler');
                if (!spoiler || event.target !== spoiler || !['Enter', ' '].includes(event.key)) return;
                event.preventDefault();
                this._revealPlot(spoiler);
            };
            document.addEventListener('click', this._clickHandler);
            document.addEventListener('keydown', this._keydownHandler);
        },
        _collectEpisodes() {
            const seriesId = getIMDbID();
            const seen = new Set();
            const episodes = [];
            const anchors = Array.from(document.querySelectorAll('a[href*="/title/tt"]'));

            anchors.forEach(anchor => {
                const match = anchor.href.match(/\/title\/(tt\d+)\//);
                const id = match?.[1];
                if (!id || id === seriesId || seen.has(id)) return;
                const card = this._findEpisodeCard(anchor);
                if (!card) return;

                const rating = this._parseRating(card);
                const episodeCode = card.textContent.match(EPISODE_CODE_PATTERN)?.[0] || '';
                const title = (anchor.querySelector('.ipc-title__text') || anchor).textContent.trim();
                const plot = this._findPlot(card);

                seen.add(id);
                episodes.push({ id, title, href:anchor.href, rating, episodeCode, plot });
            });

            return episodes;
        },
        _findEpisodeCard(anchor) {
            let node = anchor;
            for (let i = 0; i < 9 && node && node !== document.body; i++) {
                const text = node.textContent || '';
                const hasEpisodeCode = EPISODE_CODE_PATTERN.test(text);
                const hasRating = Boolean(node.querySelector?.('.ipc-rating-star--rating, [class*="rating"]'));
                const hasPlot = Boolean(this._findPlot(node));
                if (hasEpisodeCode && (hasRating || hasPlot)) return node;
                node = node.parentElement;
            }
            /* The fallback has to honour the same contract as the walk above. Accepting
               any list-item ancestor let recommendation and shoveler cards — which are
               also <li> and also carry a rating — enter the episode set, so "Top rated
               episodes" could list titles that are not episodes at all. */
            const card = anchor.closest('[data-testid*="episode" i], article, li');
            return card && EPISODE_CODE_PATTERN.test(card.textContent || '') ? card : null;
        },
        _findPlot(card) {
            return card.querySelector?.('[class*="plot" i] p, [data-testid*="plot" i], .ipc-html-content-inner-div, .ipc-metadata-list-summary-item__plot') || null;
        },
        _parseRating(card) {
            const ratingText = card.querySelector?.('.ipc-rating-star--rating')?.textContent;
            const fromNode = parseFloat(ratingText);
            if (Number.isFinite(fromNode)) return fromNode;
            const text = card.textContent || '';
            const match = text.match(/\b(10(?:\.0)?|[1-9](?:\.\d)?)\s*\/\s*10\b/);
            return match ? parseFloat(match[1]) : null;
        },
        _blurPlots(episodes) {
            const plots = new Set(episodes.map(ep => ep.plot).filter(Boolean));
            if (/\/title\/tt\d+\/episodes/i.test(location.pathname)) {
                document.querySelectorAll('[class*="plot" i] p, [data-testid*="plot" i], .ipc-html-content-inner-div, .ipc-metadata-list-summary-item__plot')
                    .forEach(plot => plots.add(plot));
            }
            plots.forEach(plot => {
                if (!plot.classList.contains('enh-revealed')) {
                    if (!this._plotAttributes.has(plot)) {
                        this._plotAttributes.set(plot, new Map(
                            ['role', 'tabindex', 'aria-pressed', 'aria-label', 'title']
                                .map(attribute => [attribute, plot.getAttribute(attribute)])
                        ));
                    }
                    plot.classList.add('enh-episode-spoiler');
                    plot.setAttribute('role', 'button');
                    plot.setAttribute('tabindex', '0');
                    plot.setAttribute('aria-pressed', 'false');
                    plot.setAttribute('aria-label', t('aria_reveal_episode_synopsis'));
                    plot.title = t('text_click_or_press_enter_to_reveal_episode');
                }
            });
        },
        _revealPlot(plot) {
            if (!plot || plot.classList.contains('enh-revealed')) return;
            plot.classList.add('enh-revealed');
            plot.classList.remove('enh-episode-spoiler');
            restoreElementAttributes(plot, this._plotAttributes?.get(plot));
            showToast(t('toast_episode_synopsis_revealed'));
        },
        _renderBestEpisodes(episodes) {
            document.getElementById('enh-best-episodes')?.remove();
            const ranked = episodes
                .filter(ep => Number.isFinite(ep.rating))
                .sort((a, b) => b.rating - a.rating)
                .slice(0, 10);
            if (ranked.length < 10) return;

            const panel = makeEl('section', { id:'enh-best-episodes', 'aria-label':t('aria_top_rated_episodes') });
            panel.appendChild(makeEl('h3', {}, t('aria_top_rated_episodes')));
            const list = makeEl('ol', { className:'enh-best-episodes-list' });
            ranked.forEach((ep, idx) => {
                list.appendChild(makeEl('li', { className:'enh-best-episode' },
                    makeEl('span', { className:'enh-best-episode__rank' }, String(idx + 1)),
                    makeEl('a', { className:'enh-best-episode__title', href:ep.href }, `${ep.episodeCode ? ep.episodeCode + ' ' : ''}${ep.title}`),
                    makeEl('span', { className:'enh-best-episode__rating' }, ep.rating.toFixed(1))
                ));
            });
            panel.appendChild(list);

            const anchor = getTitleActionAnchor() || document.querySelector('main h1')?.parentElement || document.querySelector('main');
            if (anchor) insertAfter(anchor, panel);
        },
        destroy() {
            removeCSS('enh-tvEpisodeTools');
            if (this._clickHandler) document.removeEventListener('click', this._clickHandler);
            if (this._keydownHandler) document.removeEventListener('keydown', this._keydownHandler);
            this._clickHandler = null;
            this._keydownHandler = null;
            this._plotAttributes?.forEach((attributes, el) => {
                el.classList.remove('enh-episode-spoiler', 'enh-revealed');
                restoreElementAttributes(el, attributes);
            });
            this._plotAttributes?.clear();
            this._plotAttributes = null;
            document.getElementById('enh-best-episodes')?.remove();
        }
    });

    /* IMDb renders the season x episode grid itself on /title/tt…/ratings/ but leaves
       every cell the same colour, which is the one thing a heatmap is for. The whole
       series arrives in a single table, so this needs no request of any kind.
       The rating is read from the link text — digits, identical in every language —
       and never from aria-label, which IMDb translates. */
    const HEATMAP_TABLE_SELECTOR = '[data-testid="heatmap__episode-data"]';
    const HEATMAP_CELL_LIMIT = 2000;

    function readHeatmapSeasons(table) {
        const seasons = [];
        const rows = table?.querySelectorAll?.('tr') || [];
        let inspected = 0;
        for (const row of rows) {
            const cells = row.querySelectorAll('td.ratings-heatmap__table-data, td');
            if (!cells.length) continue;
            const episodes = [];
            for (const cell of cells) {
                if (++inspected > HEATMAP_CELL_LIMIT) break;
                const link = cell.querySelector('a');
                const rating = parseFloat((link?.textContent || '').trim());
                if (Number.isFinite(rating) && rating >= 0 && rating <= 10) episodes.push({ cell, rating });
            }
            if (episodes.length) seasons.push(episodes);
            if (inspected > HEATMAP_CELL_LIMIT) break;
        }
        return seasons;
    }

    function summarizeHeatmapSeason(episodes) {
        if (!episodes.length) return null;
        const total = episodes.reduce((sum, entry) => sum + entry.rating, 0);
        return Math.round((total / episodes.length) * 10) / 10;
    }

    /* IMDb publishes the unweighted mean only here, in small type, with no comparison
       drawn. The gap against the weighted figure it displays everywhere else is the
       clearest public signal that a title's votes were pushed. Verified 2026-08-15:
       title pages no longer carry histogram data at all, so this belongs on /ratings/. */
    reg({
        key: 'ratingGap', name: t('feature_ratingGap_name'), group: 'Scores',
        init() {
            const isCurrent = createFeatureGuard(this);
            addThemedCSS(t => `
                #enh-rating-gap {
                    margin: 10px 0 0; padding: 8px 12px; border-radius: 8px;
                    background: ${t.sf1}; border: 1px solid ${t.bd1}; color: ${t.tx2};
                    font: 600 12px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }
                #enh-rating-gap strong { color: ${t.tx0}; }
            `, 'enh-ratingGap');
            waitFor('[data-testid="histogram-root"]').then(root => {
                if (!isCurrent() || !root || document.getElementById('enh-rating-gap')) return;
                // Read once: both means come from the same buckets, and re-reading the
                // page between them could describe two different distributions.
                const buckets = getHistogramData();
                const unweighted = computeUnweightedMean(buckets);
                const gap = describeRatingGap(unweighted, readDisplayedRating(), computeTrimmedMean(buckets));
                if (!gap) return;
                root.parentElement?.insertBefore(makeEl('div', { id:'enh-rating-gap', role:'note' },
                    makeEl('strong', {}, gap),
                    makeEl('span', {}, ` ${t('text_imdb_weights_its_displayed_rating')}`)
                ), root.nextSibling);
            }).catch(() => { /* titles without a rating distribution */ });
        },
        destroy() {
            document.getElementById('enh-rating-gap')?.remove();
            removeCSS('enh-ratingGap');
        },
    });

    reg({
        key: 'episodeHeatmap', name: t('feature_episodeHeatmap_name'), group: 'TV',
        init() {
            const isCurrent = createFeatureGuard(this);
            addThemedCSS(t => `
                td.enh-heatmap-cell a {
                    background: var(--enh-heatmap-bg) !important;
                    color: var(--enh-heatmap-text) !important;
                    border-radius: 4px;
                    display: block;
                    font-weight: 700;
                }
                #enh-heatmap-summary {
                    margin-top: 12px;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    align-items: center;
                }
                .enh-heatmap-chip {
                    display: inline-flex;
                    gap: 6px;
                    align-items: baseline;
                    padding: 3px 9px;
                    border-radius: 6px;
                    font: 700 11px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    letter-spacing: .02em;
                }
                .enh-heatmap-chip--label {
                    background: ${t.sf2};
                    color: ${t.tx2};
                    font-weight: 600;
                }
                .enh-heatmap-legend { color: ${t.tx3}; font: 600 11px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
            `, 'enh-episodeHeatmap');
            waitFor(HEATMAP_TABLE_SELECTOR).then(table => {
                if (!isCurrent() || !table) return;
                const seasons = readHeatmapSeasons(table);
                if (!seasons.length) return;
                seasons.forEach(episodes => episodes.forEach(({ cell, rating }) => {
                    const colour = ratingColor(rating);
                    cell.classList.add('enh-heatmap-cell');
                    cell.style.setProperty('--enh-heatmap-bg', colour.bg);
                    cell.style.setProperty('--enh-heatmap-text', colour.text);
                }));
                const summary = makeEl('div', { id:'enh-heatmap-summary', 'aria-label':t('aria_season_averages') });
                summary.appendChild(makeEl('span', { className:'enh-heatmap-chip enh-heatmap-chip--label' }, t('label_season_average')));
                seasons.forEach((episodes, index) => {
                    const average = summarizeHeatmapSeason(episodes);
                    if (average === null) return;
                    const colour = ratingColor(average);
                    summary.appendChild(makeEl('span', {
                        className:'enh-heatmap-chip',
                        style:{ background:colour.bg, color:colour.text },
                    }, `S${index + 1} ${average.toFixed(1)}`));
                });
                summary.appendChild(makeEl('span', { className:'enh-heatmap-legend' },
                    t('text_heatmap_legend')));
                table.parentElement?.insertBefore(summary, table.nextSibling);
            }).catch(() => { /* the grid is absent on titles without episodes */ });
        },
        destroy() {
            document.getElementById('enh-heatmap-summary')?.remove();
            document.querySelectorAll('td.enh-heatmap-cell').forEach(cell => {
                cell.classList.remove('enh-heatmap-cell');
                cell.style.removeProperty('--enh-heatmap-bg');
                cell.style.removeProperty('--enh-heatmap-text');
            });
            removeCSS('enh-episodeHeatmap');
        },
    });

    reg({
        key: 'tvShowEnhancements', name: t('feature_tvShowEnhancements_name'), group: 'TV',
        init() {
            if (!isTVType()) return;
            const isCurrent = createFeatureGuard(this);
            addThemedCSS(t => `
                #enh-tv-bar{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
                .enh-tv-chip{padding:4px 12px;border-radius:8px;
                    font:600 11px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                    color:${t.blue};background:${t.blueMuted};
                    border:1px solid ${t.bd1};text-decoration:none!important;
                    transition:background .12s ease,border-color .12s ease,color .12s ease,transform .12s ease}
                .enh-tv-chip:hover{background:${t.sf2};color:${t.blueHi};border-color:${t.accentBorder}}
            `, 'enh-tvShow');

            waitForTitleSurface().then(() => {
                if (!isCurrent()) return;
                if (document.getElementById('enh-tv-bar')) return;
                const imdbId = getIMDbID(), title = getTitleText();
                if (!imdbId) return;
                const bar = makeEl('div', { id: 'enh-tv-bar' });
                [
                    { l:t('text_episodes_list'), u:`https://www.imdb.com/title/${imdbId}/episodes/` },
                    // IMDb buries its whole-series episode grid one route away.
                    { l:t('text_ratings_grid'), u:`https://www.imdb.com/title/${imdbId}/ratings/` },
                    { l:'TheTVDB', u:`https://www.thetvdb.com/search?query=${imdbId}` },
                    { l:'TVMaze', u:`https://www.tvmaze.com/search?q=${encodeURIComponent(title)}` },
                    { l:'Trakt', u:`https://app.trakt.tv/search?query=${encodeURIComponent(title)}` },
                    { l:t('text_ep_calendar'), u:`https://episodecalendar.com/en/shows?q%5Bname_cont%5D=${encodeURIComponent(title)}` },
                ].forEach(c => bar.appendChild(makeEl('a', { href:c.u, target:'_blank', rel:'noopener noreferrer', className:'enh-tv-chip' }, c.l)));

                appendTitleStackItem(bar, TITLE_STACK_ORDER.tvShowEnhancements);
            }).catch(() => {});
        },
        destroy() { removeCSS('enh-tvShow'); document.getElementById('enh-tv-bar')?.remove(); pruneTitleStack(); }
    });

    reg({
        key: 'subtitleLinks', name: t('feature_subtitleLinks_name'), group: 'TV',
        init() {
            const isCurrent = createFeatureGuard(this);
            const imdbId = getIMDbID(), title = getTitleText();
            if (!imdbId) return;
            addThemedCSS(t => `
                #enh-sub-row{margin-top:12px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
                .enh-sub-row__label{color:${t.tx2};font-size:12px;font-weight:600;margin-right:4px}
                .enh-sub-link{--link-color:${t.blue}}
            `, 'enh-subtitleLinks');
            waitFor('section[data-testid="Details"]').then(sec => {
                if (!isCurrent()) return;
                if (document.getElementById('enh-sub-row')) return;
                const row = makeEl('div', { id:'enh-sub-row' });
                row.appendChild(makeEl('span', { className:'enh-sub-row__label' }, t('label_subtitles')));
                [
                    { n:'OpenSubtitles', u:`https://www.opensubtitles.org/en/search/imdbid-${imdbId.replace(/^tt/, '')}` },
                    { n:'OpenSubs.com', u:`https://www.opensubtitles.com/en/en/search-all/q-${imdbId}` },
                    { n:'SubDL', u:`https://subdl.com/search/${encodeURIComponent(title)}` },
                    { n:'YIFY-Subs', u:`https://yifysubtitles.ch/movie-imdb/${imdbId}`, movieOnly:true },
                    { n:'Addic7ed', u:`https://www.addic7ed.com/search.php?search=${encodeURIComponent(title)}&Submit=Search` },
                ].filter(s => !(s.movieOnly && isTVType())).forEach(s => row.appendChild(makeEl('a', {
                    href:s.u, target:'_blank', rel:'noopener noreferrer', className:'enh-ext-link enh-sub-link'
                }, s.n)));
                sec.appendChild(row);
            }).catch(() => {});
        },
        destroy() { removeCSS('enh-subtitleLinks'); document.getElementById('enh-sub-row')?.remove(); }
    });

    /* Per-episode subtitle links. Every episode has its own IMDb id, and both services
       index by it, so a link per row needs no lookup at all.

       opensubtitles.com is the primary because opensubtitles.org sits behind an anti-bot
       wall: an ordinary anchor a person clicks still works there, which is exactly why
       these are plain anchors and nothing here is ever fetched. Fetching would need a
       @connect grant the project does not want and would hit the wall regardless. */
    function buildEpisodeSubtitleUrl(imdbId) {
        return /^tt\d+$/.test(imdbId || '') ? `https://www.opensubtitles.com/en/en/search-all/q-${imdbId}` : '';
    }
    function buildEpisodeSubtitleExport(rows) {
        return rows
            .map(row => ({ label: row.label || row.id, url: buildEpisodeSubtitleUrl(row.id) }))
            .filter(entry => entry.url)
            .map(entry => `${entry.label}\t${entry.url}`)
            .join('\n');
    }

    reg({
        key: 'episodeSubtitles', name: t('feature_episodeSubtitles_name'), group: 'TV',
        init() {
            if (!isIMDbHost()) return;
            if (getPageSurface() !== 'episodes') return;
            const isCurrent = createFeatureGuard(this);

            addThemedCSS(t => `
                .enh-ep-sub {
                    display: inline-flex; align-items: center; margin: 6px 0 0;
                    padding: 2px 8px; border-radius: 6px;
                    border: 1px solid ${t.bd1}; background: ${t.sf0};
                    color: ${t.blue} !important; text-decoration: none !important;
                    font: 650 10px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }
                .enh-ep-sub:hover { color: ${t.blueHi} !important; border-color: ${t.accentBorder}; }
                #enh-ep-sub-export { margin: 8px 0 0; }
            `, 'enh-episode-subtitles-css');

            const paint = () => {
                if (!isCurrent()) return;
                readLoadedEpisodes().forEach(row => {
                    if (row.node.querySelector?.('.enh-ep-sub')) return;
                    const url = buildEpisodeSubtitleUrl(row.id);
                    if (!url) return;
                    row.node.appendChild(makeEl('a', {
                        href:url,
                        target:'_blank',
                        rel:'noopener noreferrer',
                        className:'enh-ep-sub',
                        'aria-label':t('aria_find_subtitles_for', [row.label || row.id]),
                    }, t('text_link_group_subtitles')));
                });
            };
            paint();

            const exportBtn = makeEl('button', {
                type:'button',
                className:'enh-settings-footer-btn',
                id:'enh-ep-sub-export',
                onClick: () => {
                    const rows = readLoadedEpisodes();
                    const text = buildEpisodeSubtitleExport(rows);
                    if (!text) { showToast(t('toast_no_episodes_are_loaded_to_export')); return; }
                    showToast(copyTextToClipboard(text)
                        ? tCount('toast_copied_subtitle_links', rows.length)
                        : COPY_FAILURE_MESSAGE, 3000);
                },
            }, t('text_copy_subtitle_links_for_this_season'));
            const target = document.querySelector('main') || document.body;
            target.insertBefore(exportBtn, target.firstElementChild?.nextSibling || null);

            // A season tab swap replaces every row without a route change.
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
            removeCSS('enh-episode-subtitles-css');
            this._observer?.disconnect();
            this._observer = null;
            this._cancelFrame?.();
            this._cancelFrame = null;
            document.querySelectorAll('.enh-ep-sub').forEach(node => node.remove());
            document.getElementById('enh-ep-sub-export')?.remove();
        },
    });

