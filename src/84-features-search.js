    // #########################################################################
    //
    //  SEARCH & LINKS
    //
    // #########################################################################

    reg({
        key: 'searchButtons', name: t('feature_searchButtons_name'), group: 'Features',
        init() {
            if (!isIMDbHost()) return;
            const isCurrent = createFeatureGuard(this);
            waitForTitleSurface().then(() => {
                if (!isCurrent()) return;
                if (document.getElementById('enh-search-buttons')) return;
                const title = getTitleText();
                if (!title) return;
                const ctx = getWatchLinkContext(title);
                const searchTitle = ctx.TITLE_RAW || title;
                const sites = getSiteList('watchSites', DEFAULT_WATCH_SITES).filter(site => site.enabled !== false);
                if (!sites.length) return;
                const wrap = makeEl('section', {
                    id:'enh-search-buttons',
                    role:'region',
                    'aria-label':t('aria_watch_movie_and_show_sites'),
                });
                const label = makeEl('div', { id:'enh-watch-label', className:'enh-stream-label' },
                    makeEl('span', { className:'enh-stream-label__dot' }),
                    'WATCH'
                );
                const groups = makeEl('div', { className:'enh-link-groups' });
                const siteGroups = groupSitesByCategory(sites);
                const primaryGroup = siteGroups.find(groupData => groupData.category === 'watch') || siteGroups[0];
                const primarySite = primaryGroup?.sites?.[0];
                const createSiteButton = (site, className = 'enh-search-btn') => {
                    const url = applyLinkTemplate(site.url, ctx);
                    const primary = className.includes('enh-search-btn--primary');
                    const contents = primary
                        ? [
                            makeEl('span', { className:'enh-search-btn__action' }, t('category_watch')),
                            makeEl('span', { className:'enh-search-btn__site' }, site.name),
                            makeEl('span', { className:'enh-search-btn__arrow', 'aria-hidden':'true' }, '→'),
                        ]
                        : [makeEl('span', {}, site.name)];
                    return makeEl('a', {
                        href:url,
                        target:'_blank',
                        rel:'noopener noreferrer',
                        className,
                        dataset:{ url },
                        style:{ '--btn-color':site.color },
                        title:t('text_search_site_for_title', [site.name, searchTitle]),
                        'aria-label': t('aria_open_search_for', [site.name, searchTitle]),
                    }, ...contents);
                };
                /* The dock may already exist and belong to the editorial surface; this
                   feature only ever contributes the primary watch destination to it. */
                const sharedActions = ensureEditorialActions();
                const actions = sharedActions || makeEl('div', { id:'enh-editorial-actions' });
                if (primarySite) {
                    const primaryButton = createSiteButton(primarySite, 'enh-search-btn enh-search-btn--primary');
                    primaryButton.id = 'enh-primary-watch-btn';
                    actions.insertBefore(primaryButton, actions.firstChild);
                }

                const secondarySites = sites.filter(site => site !== primarySite);
                if (secondarySites.length) {
                    const options = makeEl('details', { className:'enh-watch-options' });
                    options.appendChild(makeEl('summary', { className:'enh-watch-options__summary' },
                        makeEl('span', {}, t('text_more_watch_options')),
                        makeEl('span', { className:'enh-watch-options__count' }, `${secondarySites.length} sites`)
                    ));
                    const optionGroups = makeEl('div', { className:'enh-watch-options__groups' });
                    groupSitesByCategory(secondarySites).forEach(groupData => {
                        const group = makeEl('div', { className:'enh-link-group' });
                        if (groupData.category !== 'watch') {
                            group.appendChild(makeEl('div', { className:'enh-link-group__label' }, getSiteCategoryLabel(groupData.category)));
                        }
                        const row = makeEl('div', { className:'enh-search-row enh-search-row--compact' });
                        groupData.sites.forEach(site => row.appendChild(createSiteButton(site, 'enh-search-btn enh-search-btn--compact')));
                        group.appendChild(row);
                        optionGroups.appendChild(group);
                    });
                    options.appendChild(optionGroups);
                    groups.appendChild(options);
                }
                /* Only adopt the dock when this feature created it; otherwise it is
                   already mounted in the editorial action slot and owned elsewhere, and
                   the section heading leads it so the original reading order survives:
                   WATCH, the primary destination, then the page actions. */
                if (sharedActions) actions.insertBefore(label, actions.firstChild);
                else {
                    wrap.appendChild(label);
                    wrap.appendChild(actions);
                }
                wrap.appendChild(groups);
                appendTitleStackItem(wrap, TITLE_STACK_ORDER.searchButtons);
            }).catch(() => {});
        },
        destroy() {
            const wrap = document.getElementById('enh-search-buttons');
            const trailer = wrap?.querySelector('#enh-trailer-btn');
            const menu = wrap?.querySelector('#enh-link-menu-wrap');
            if (trailer) appendTitleStackItem(trailer, TITLE_STACK_ORDER.trailerPopover);
            if (menu) {
                menu.classList.add('enh-link-menu-wrap--standalone');
                appendTitleStackItem(menu, TITLE_STACK_ORDER.expandedLinkMenu);
            }
            // The heading and primary button may live in a dock this feature does not own.
            document.getElementById('enh-primary-watch-btn')?.remove();
            document.getElementById('enh-watch-label')?.remove();
            wrap?.remove();
            pruneTitleStack();
        }
    });

    reg({
        key: 'externalLinks', name: t('feature_externalLinks_name'), group: 'Features',
        init() {
            const isCurrent = createFeatureGuard(this);
            waitForTitleSurface().then(() => {
                if (!isCurrent()) return;
                if (document.getElementById('enh-external-links')) return;
                const title = getTitleText(), year = getTitleYear(), imdbId = getIMDbID();
                if (!title || !imdbId) return;
                const ctx = getLinkContext(title, imdbId, year);
                const links = filterSitesForMediaType(getSiteList('externalSites', DEFAULT_EXTERNAL_SITES))
                    .filter(link => link.enabled !== false);
                const bar = makeEl('section', {
                    id:'enh-external-links',
                    role:'region',
                    'aria-label':t('aria_reviews_and_research'),
                });
                bar.appendChild(makeEl('div', { className:'enh-external-links__header' },
                    makeEl('div', { className:'enh-external-links__title' }, t('label_reviews_research')),
                    makeEl('div', { className:'enh-external-links__hint' }, t('text_scores_availability_and_reference'))
                ));
                const externalGroups = makeEl('div', { className:'enh-external-groups' });
                groupSitesByCategory(links).forEach(groupData => {
                    const group = makeEl('div', {
                        className:'enh-external-group',
                        dataset:{ category:groupData.category },
                    });
                    group.appendChild(makeEl('div', { className:'enh-link-group__label' }, getSiteCategoryLabel(groupData.category)));
                    const row = makeEl('div', { className:'enh-external-group__row' });
                    groupData.sites.forEach(link => {
                        row.appendChild(makeEl('a', {
                            href: applyLinkTemplate(link.url, ctx),
                            target:'_blank',
                            rel:'noopener noreferrer',
                            className:'enh-ext-link',
                            style:{ '--link-color':link.color },
                            'aria-label': t('aria_open_link', [getSiteCategoryLabel(link.category), link.name]),
                        }, link.name));
                    });
                    group.appendChild(row);
                    externalGroups.appendChild(group);
                });
                bar.appendChild(externalGroups);
                appendTitleStackItem(bar, TITLE_STACK_ORDER.externalLinks);
                const trailer = document.getElementById('enh-trailer-btn');
                const menu = document.getElementById('enh-link-menu-wrap');
                if (trailer) bar.appendChild(trailer);
                if (menu) {
                    menu.classList.remove('enh-link-menu-wrap--standalone');
                    bar.appendChild(menu);
                }
            }).catch(() => {});
        },
        destroy() {
            const bar = document.getElementById('enh-external-links');
            const trailer = bar?.querySelector('#enh-trailer-btn');
            const menu = bar?.querySelector('#enh-link-menu-wrap');
            if (trailer) appendTitleStackItem(trailer, TITLE_STACK_ORDER.trailerPopover);
            if (menu) {
                menu.classList.add('enh-link-menu-wrap--standalone');
                appendTitleStackItem(menu, TITLE_STACK_ORDER.expandedLinkMenu);
            }
            bar?.remove();
            pruneTitleStack();
        }
    });

    reg({
        key: 'trailerPopover', name: t('feature_trailerPopover_name'), group: 'Features',
        _keydown: null,
        _focusin: null,
        _lastFocused: null,
        _previousOverflow: '',
        _modalOpen: false,
        _modalGeneration: 0,
        init() {
            if (!isIMDbHost()) return;
            const isCurrent = createFeatureGuard(this);
            addThemedCSS(t => `
                #enh-trailer-btn {
                    border: 1px solid ${t.bd1};
                    background: ${t.sf1};
                    color: ${t.tx1};
                    border-radius: 7px;
                    padding: 6px 12px;
                    cursor: pointer;
                    font: 700 12px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    transition: background .15s ease, border-color .15s ease, color .15s ease, transform .15s ease;
                }
                #enh-trailer-btn:hover { background:${t.sf2}; border-color:${t.accentBorder}; color:${t.accent}; transform:translateY(-1px); }
                #enh-trailer-overlay {
                    position: fixed; inset: 0; z-index: 2147483642;
                    display: flex; align-items: center; justify-content: center;
                    padding: 24px; background: ${t.scrim};
                }
                /* The UA popover box would shrink this to fit its content, centre it,
                   and give it a border; the overlay IS the viewport, so every property
                   the rule above leaves unset is said again here.

                   width/height auto, not 100%: nothing here sets box-sizing, so a
                   percentage would put the 24px padding OUTSIDE the viewport and push
                   the dialog 24px down and right. inset: 0 already gives it the size. */
                #enh-trailer-overlay[popover] {
                    width: auto; height: auto;
                    margin: 0; border: 0; overflow: visible; color: inherit;
                }
                #enh-trailer-dialog {
                    width: min(960px, calc(100vw - 32px));
                    background: ${t.sf0}; color: ${t.tx1};
                    border: 1px solid ${t.bd1}; border-radius: 12px;
                    box-shadow: ${t.sh3}; overflow: hidden;
                }
                .enh-trailer-header {
                    display: flex; justify-content: space-between; align-items: center; gap: 12px;
                    padding: 12px 14px; border-bottom: 1px solid ${t.bd0};
                }
                .enh-trailer-title { color: ${t.tx0}; font: 800 13px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
                .enh-trailer-close {
                    width: 30px; height: 30px; border-radius: 8px; cursor: pointer;
                    border: 1px solid ${t.bd1}; background: ${t.sf1}; color: ${t.tx2};
                    font: 800 16px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }
                .enh-trailer-close:hover { color:${t.tx0}; background:${t.sf2}; }
                .enh-trailer-body {
                    aspect-ratio: 16 / 9; background: ${t.bg};
                    display: flex; align-items: center; justify-content: center;
                    color: ${t.tx2}; font: 600 13px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }
                .enh-trailer-body iframe { width: 100%; height: 100%; border: 0; display: block; }
                .enh-trailer-fallback {
                    display: flex; flex-direction: column; align-items: center; gap: 12px;
                    padding: 24px; text-align: center; color: ${t.tx2};
                }
                .enh-trailer-fallback__link {
                    display: inline-flex; align-items: center; min-height: 36px; padding: 0 14px;
                    border: 1px solid ${t.bd1}; border-radius: 8px; background: ${t.sf1};
                    color: ${t.tx0} !important; text-decoration: none !important;
                    font: 700 12px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }
                .enh-trailer-fallback__link:hover { border-color: ${t.accentBorder}; color: ${t.accent} !important; }
                .enh-trailer-fallback__link:focus-visible { outline: 2px solid ${t.accent}; outline-offset: 2px; }
                /* Focusable but invisible. No negative margin: the layout guard rejects
                   those, so the size-and-clip form is used here as elsewhere. */
                .enh-trailer-sentinel {
                    position: absolute; width: 1px; height: 1px; padding: 0;
                    overflow: hidden; clip-path: inset(50%); white-space: nowrap;
                }
            `, 'enh-trailerPopover');

            waitForTitleSurface().then(() => {
                if (!isCurrent()) return;
                if (document.getElementById('enh-trailer-btn')) return;
                const btn = makeEl('button', {
                    id:'enh-trailer-btn',
                    type:'button',
                    'aria-haspopup':'dialog',
                    'aria-controls':'enh-trailer-dialog',
                    'aria-expanded':'false',
                    onClick: () => this._open(),
                }, t('label_trailer'));
                const editorialActions = document.getElementById('enh-editorial-actions');
                const extBar = document.getElementById('enh-external-links');
                if (editorialActions) editorialActions.appendChild(btn);
                else if (extBar) extBar.appendChild(btn);
                else appendTitleStackItem(btn, TITLE_STACK_ORDER.trailerPopover);
            }).catch(() => {});
        },
        async _open() {
            const overlay = this._renderModal(t('text_loading_trailer'));
            const generation = this._modalGeneration;
            const body = overlay.querySelector('.enh-trailer-body');
            try {
                const videoId = normalizeYouTubeVideoId(await this._getVideoId());
                if (!videoId) throw failure('unknown', t('text_trailer_unavailable'));
                if (generation !== this._modalGeneration || !body.isConnected) return;
                body.replaceChildren(makeEl('iframe', {
                    src:`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`,
                    title:`${getTitleText()} trailer`,
                    allow:'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
                    allowfullscreen:'allowfullscreen',
                }));
            } catch {
                if (generation !== this._modalGeneration || !body.isConnected) return;
                const url = getTrailerSearchUrl();
                body.replaceChildren(makeEl('div', { className:'enh-trailer-fallback', role:'status' },
                    makeEl('span', {}, t('text_trailer_could_not_be_loaded_here')),
                    makeEl('a', {
                        href:url,
                        target:'_blank',
                        rel:'noopener noreferrer',
                        className:'enh-trailer-fallback__link',
                    }, t('text_open_trailer_search_on_youtube'))
                ));
            }
        },
        _renderModal(message) {
            if (this._modalOpen) this._closeModal(false);
            document.getElementById('enh-trailer-overlay')?.remove();
            this._modalOpen = true;
            this._modalGeneration += 1;
            this._lastFocused = document.activeElement;
            this._previousOverflow = document.documentElement.style.overflow;
            document.documentElement.style.overflow = 'hidden';
            document.getElementById('enh-trailer-btn')?.setAttribute('aria-expanded', 'true');
            const close = () => this._closeModal();
            this._keydown = event => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    close();
                    return;
                }
                if (event.key !== 'Tab') return;
                const dialog = document.getElementById('enh-trailer-dialog');
                const focusables = getFocusableElements(dialog);
                if (!focusables.length) {
                    event.preventDefault();
                    dialog?.focus();
                    return;
                }
                const first = focusables[0];
                const last = focusables[focusables.length - 1];
                const focusOutside = !dialog?.contains(document.activeElement);
                if (event.shiftKey && (document.activeElement === first || focusOutside)) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && (document.activeElement === last || focusOutside)) {
                    event.preventDefault();
                    first.focus();
                }
            };
            document.addEventListener('keydown', this._keydown);
            this._focusin = event => {
                const dialog = document.getElementById('enh-trailer-dialog');
                if (!this._modalOpen || !dialog || dialog.contains(event.target)) return;
                const focusables = getFocusableElements(dialog);
                (focusables[0] || dialog).focus();
            };
            document.addEventListener('focusin', this._focusin);

            const makeSentinel = position => makeEl('div', {
                className:'enh-trailer-sentinel',
                tabindex:'0',
                dataset:{ enhTrailerSentinel:position },
                onFocus: () => { document.querySelector('#enh-trailer-dialog .enh-trailer-close')?.focus(); },
            });
            const overlay = makeEl('div', {
                id:'enh-trailer-overlay',
                role:'presentation',
                onClick: e => { if (e.target.id === 'enh-trailer-overlay') close(); },
            }, makeEl('div', {
                id:'enh-trailer-dialog',
                role:'dialog',
                'aria-modal':'true',
                'aria-labelledby':'enh-trailer-title',
                tabindex:'-1',
            },
                /* Once focus is inside the cross-origin YouTube embed, this page receives
                   no key events from it at all — Escape and the Tab trap above are both
                   unreachable by design, and no handler can change that. Tabbing forward
                   past the embed's last control does return focus to the document, so a
                   sentinel after it hands focus to the close button. That makes the
                   visible close control keyboard-reachable from inside the embed without
                   a second control existing.

                   Only one sentinel, and only after the embed: the close button already
                   precedes the iframe in DOM order, so tabbing backward out of the embed
                   reaches it directly. A sentinel before the dialog would never receive
                   focus, and dead code that looks like a safety net is worse than none.

                   Excluded from getFocusableElements by class rather than by aria-hidden,
                   so the Tab trap used while focus is in the page still computes the same
                   first and last without a focusable node claiming to be hidden. */
                makeEl('div', { className:'enh-trailer-header' },
                    makeEl('div', { className:'enh-trailer-title', id:'enh-trailer-title' }, `${getTitleText()} trailer`),
                    makeEl('button', { type:'button', className:'enh-trailer-close', 'aria-label':t('aria_close_trailer'), onClick:close }, '×')
                ),
                makeEl('div', { className:'enh-trailer-body' },
                    makeEl('div', { role:'status', 'aria-live':'polite' }, message)
                ),
                makeSentinel('after')
            ));
            document.body.appendChild(overlay);
            /* No anchor: this one already covers the viewport. The top layer only takes
               it out of reach of whatever IMDb stacks over the hero next. */
            showInTopLayer(overlay);
            setTimeout(() => overlay.querySelector('.enh-trailer-close')?.focus(), 20);
            return overlay;
        },
        _closeModal(restoreFocus = true) {
            const wasOpen = this._modalOpen;
            this._modalOpen = false;
            this._modalGeneration += 1;
            document.removeEventListener('keydown', this._keydown);
            document.removeEventListener('focusin', this._focusin);
            this._keydown = null;
            this._focusin = null;
            document.getElementById('enh-trailer-overlay')?.remove();
            document.getElementById('enh-trailer-btn')?.setAttribute('aria-expanded', 'false');
            if (wasOpen) document.documentElement.style.overflow = this._previousOverflow;
            if (wasOpen && restoreFocus) this._lastFocused?.focus?.();
            this._lastFocused = null;
            this._previousOverflow = '';
        },
        async _getVideoId() {
            const imdbId = getIMDbID();
            const cacheKey = imdbId ? `yt_${imdbId}` : '';
            const cached = cacheKey ? cacheGet(cacheKey) : null;
            const cachedVideoId = normalizeYouTubeVideoId(cached?.videoId);
            if (cachedVideoId) return cachedVideoId;
            if (cached?.unavailable) throw failure('unknown', t('text_trailer_unavailable'));

            const res = await httpGet(getTrailerSearchUrl(), {
                timeout: 12000,
                cancelOnRouteChange: true,
                headers: { Accept:'text/html,application/xhtml+xml' },
            });
            const videoId = parseYouTubeTrailerVideoId(res.responseText, getTitleText(), getTitleYear());
            if (!videoId) {
                if (cacheKey) cacheSetUnavailable(cacheKey);
                throw failure('unknown', t('text_trailer_unavailable'));
            }
            if (cacheKey) cacheSet(cacheKey, { videoId });
            return videoId;
        },
        destroy() {
            this._closeModal(false);
            removeCSS('enh-trailerPopover');
            document.getElementById('enh-trailer-btn')?.remove();
            pruneTitleStack();
        }
    });

    // ===================== EXPANDED LINK MENU =====================
    /* Keyed by the group's identity, which the render loop tests against; the heading is
       what a person reads. Splitting them is what lets the menu be translated without the
       TV-only rule changing meaning. */
    const LINK_MENU_GROUP_LABELS = {
        movies: t('text_movie_sites'),
        reviews: t('text_link_group_reviews'),
        search: t('text_link_group_search'),
        subtitles: t('text_link_group_subtitles'),
        tv: t('text_link_group_tv'),
    };
    reg({
        key: 'expandedLinkMenu', name: t('feature_expandedLinkMenu_name'), group: 'Features',
        _DB: {
            movies: [
                { n:'Letterboxd', u:'https://letterboxd.com/imdb/{{ID}}/' },
                { n:'TMDB', u:'https://www.themoviedb.org/search/movie?query={{T}}' },
                { n:'AllMovie', u:'https://www.allmovie.com/search/movies/{{T}}' },
                { n:'Box Office Mojo', u:'https://www.boxofficemojo.com/search/?q={{T}}' },
                { n:'Criticker', u:'https://www.criticker.com/?search={{ID}}' },
                { n:'Trakt', u:'https://app.trakt.tv/search?query={{T}}' },
            ],
            reviews: [
                { n:'Rotten Tomatoes', u:'https://www.rottentomatoes.com/search?search={{T}}' },
                { n:'Metacritic', u:'https://www.metacritic.com/search/{{T}}/' },
            ],
            search: [
                { n:'Google', u:'https://www.google.com/search?q={{T}}+{{Y}}' },
                { n:'DuckDuckGo', u:'https://duckduckgo.com/?q={{T}}+{{Y}}' },
                { n:'YouTube', u:'https://www.youtube.com/results?search_query={{T}}%20trailer' },
                { n:'Wikipedia', u:'https://en.wikipedia.org/w/index.php?search={{T}}' },
            ],
            subtitles: [
                { n:'OpenSubtitles', u:'https://www.opensubtitles.org/en/search/imdbid-{{ID_NUM}}' },
                { n:'OpenSubs.com', u:'https://www.opensubtitles.com/en/en/search-all/q-{{ID}}' },
                { n:'SubDL', u:'https://subdl.com/search/{{T}}' },
                { n:'YIFY-Subs', u:'https://yifysubtitles.ch/movie-imdb/{{ID}}', movieOnly:true },
            ],
            tv: [
                { n:'TheTVDB', u:'https://www.thetvdb.com/search?query={{ID}}' },
                { n:'TVMaze', u:'https://www.tvmaze.com/search?q={{T}}' },
                { n:'Ep Calendar', u:'https://episodecalendar.com/en/shows?q%5Bname_cont%5D={{T}}' },
            ],
            'Torrents': [
                { n:'1337x', u:'https://1337x.to/search/{{T}}+{{Y}}/1/' },
            ],
        },
        _closeHandler: null,
        init() {
            const isCurrent = createFeatureGuard(this);
            waitForTitleSurface().then(() => {
                if (!isCurrent()) return;
                if (document.getElementById('enh-link-menu-wrap')) return;
                const title = getTitleText(), year = getTitleYear(), imdbId = getIMDbID();
                if (!title || !imdbId) return;
                const buildUrl = (tpl) => tpl.replace(/\{\{ID\}\}/g, imdbId)
                    .replace(/\{\{ID_NUM\}\}/g, imdbId.replace(/^tt/, ''))
                    .replace(/\{\{TRAKT_TYPE\}\}/g, isTVType() ? 'show' : 'movie')
                    .replace(/\{\{T\}\}/g, encodeURIComponent(title)).replace(/\{\{Y\}\}/g, year);

                const container = makeEl('div', { id:'enh-link-menu-wrap' });
                let dropdown = null;
                const getItems = () => Array.from(dropdown?.querySelectorAll('[role="menuitem"]') || []);
                const setCurrentItem = item => {
                    getItems().forEach(candidate => { candidate.tabIndex = candidate === item ? 0 : -1; });
                };
                const closeMenu = (focusTrigger = false) => {
                    dropdown?.classList.remove('enh-visible');
                    hideFromTopLayer(dropdown, trigger);
                    trigger.setAttribute('aria-expanded', 'false');
                    getItems().forEach(item => { item.tabIndex = -1; });
                    if (focusTrigger) trigger.focus();
                };
                const openMenu = (focusItem = 'none') => {
                    dropdown?.classList.add('enh-visible');
                    showInTopLayer(dropdown, trigger);
                    trigger.setAttribute('aria-expanded', 'true');
                    const items = getItems();
                    const item = focusItem === 'last' ? items[items.length - 1] : items[0];
                    if (item) {
                        setCurrentItem(item);
                        if (focusItem !== 'none') item.focus();
                    }
                };
                const trigger = makeEl('button', {
                    id:'enh-link-menu-trigger', type:'button',
                    textContent:t('text_more_links'),
                    'aria-haspopup':'menu',
                    'aria-controls':'enh-link-menu-dropdown',
                    'aria-expanded':'false',
                    onClick: (e) => {
                        e.stopPropagation();
                        if (dropdown.classList.contains('enh-visible')) closeMenu();
                        else openMenu();
                    }
                });
                trigger.addEventListener('keydown', event => {
                    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
                    event.preventDefault();
                    openMenu(event.key === 'ArrowUp' ? 'last' : 'first');
                });

                dropdown = makeEl('div', {
                    id:'enh-link-menu-dropdown', className:'enh-link-dropdown', role:'menu',
                    'aria-labelledby':'enh-link-menu-trigger',
                });
                for (const [cat, links] of Object.entries(this._DB)) {
                    if (cat === 'tv' && !isTVType()) continue;
                    if (cat === 'movies' && isTVType()) continue;
                    const heading = LINK_MENU_GROUP_LABELS[cat];
                    dropdown.appendChild(makeEl('div', { className:'enh-link-dropdown__cat' }, heading));
                    const row = makeEl('div', { className:'enh-link-dropdown__row', role:'group', 'aria-label':heading });
                    links.filter(l => !(l.movieOnly && isTVType())).forEach(l => row.appendChild(makeEl('a', {
                        href: buildUrl(l.u), target:'_blank', rel:'noopener noreferrer', className:'enh-link-dropdown__item',
                        role:'menuitem', tabindex:'-1',
                    }, l.n)));
                    dropdown.appendChild(row);
                }
                dropdown.addEventListener('keydown', event => {
                    const items = getItems();
                    const current = items.indexOf(document.activeElement);
                    let next = null;
                    if (event.key === 'ArrowDown') next = (current + 1) % items.length;
                    if (event.key === 'ArrowUp') next = (current - 1 + items.length) % items.length;
                    if (event.key === 'Home') next = 0;
                    if (event.key === 'End') next = items.length - 1;
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        closeMenu(true);
                        return;
                    }
                    if (event.key === 'Tab') {
                        closeMenu();
                        return;
                    }
                    if (next === null || !items.length) return;
                    event.preventDefault();
                    setCurrentItem(items[next]);
                    items[next].focus();
                });
                dropdown.addEventListener('click', event => {
                    if (event.target.closest?.('[role="menuitem"]')) closeMenu();
                });

                container.appendChild(trigger);
                container.appendChild(dropdown);
                const editorialActions = document.getElementById('enh-editorial-actions');
                const extBar = document.getElementById('enh-external-links');
                if (editorialActions) editorialActions.appendChild(container);
                else if (extBar) extBar.appendChild(container);
                else {
                    container.classList.add('enh-link-menu-wrap--standalone');
                    appendTitleStackItem(container, TITLE_STACK_ORDER.expandedLinkMenu);
                }

                this._closeHandler = (e) => {
                    if (!e.target.closest('#enh-link-menu-trigger') && !e.target.closest('#enh-link-menu-dropdown')) {
                        closeMenu();
                    }
                };
                document.addEventListener('click', this._closeHandler);
            }).catch(() => {});
        },
        destroy() {
            if (this._closeHandler) document.removeEventListener('click', this._closeHandler);
            this._closeHandler = null;
            document.getElementById('enh-link-menu-wrap')?.remove();
            pruneTitleStack();
        }
    });

    /* The row a title link belongs to, from the narrowest container IMDb actually uses
       outwards. Shared because two features decorate the same rows and a second copy of
       this walk would drift the moment IMDb renames one of these wrappers. */
    function findTitleCard(anchor) {
        const posterCard = anchor.closest('.ipc-poster-card');
        if (posterCard) return posterCard;
        const summary = anchor.closest('.ipc-metadata-list-summary-item');
        if (summary?.querySelector('img')) return summary;
        const listItem = anchor.closest('li');
        if (listItem?.querySelector('img')) return listItem;
        const media = anchor.closest('[class*="poster"],[class*="Poster"],[class*="media"],[class*="Media"]');
        if (media?.querySelector('img')) return media;
        return null;
    }

    reg({
        key: 'watchedMarking', name: t('feature_watchedMarking_name'), group: 'Features',
        _observer: null,
        _clickHandler: null,
        _raf: 0,
        _pendingScanRoots: null,
        // The last episode count and the marks object it was counted from.
        _episodeCount: 0,
        _episodeCountFor: null,
        _episodeCountId: '',
        init() {
            if (!isIMDbHost()) return;
            addThemedCSS(t => `
                .enh-markable-card{position:relative!important}
                .enh-markable-card.enh-marked img{opacity:.72;filter:saturate(.58);transition:opacity .15s ease,filter .15s ease}
                .enh-markable-card.enh-marked:hover img,.enh-markable-card.enh-marked:focus-within img{opacity:1;filter:none}
                /* IMDb gives every non-poster child of a poster card position:relative.
                   Match that selector weight so these controls stay pinned over the
                   poster instead of becoming a squeezed row at the bottom of the card. */
                .enh-markable-card > .enh-mark-controls{
                    position:absolute;top:6px;left:6px;right:6px;z-index:20;
                    display:flex;flex-wrap:wrap;gap:4px;align-items:center;align-content:flex-start;justify-content:center;
                    opacity:0;transform:translateY(-2px);pointer-events:none;
                    transition:opacity .12s ease,transform .12s ease;
                }
                .enh-markable-card:hover .enh-mark-controls,
                .enh-markable-card:focus-within .enh-mark-controls,
                .enh-markable-card.enh-marked .enh-mark-controls{
                    opacity:1;transform:translateY(0);pointer-events:auto;
                }
                .enh-mark-btn{
                    min-width:0;height:24px;padding:0 7px;border-radius:6px;
                    border:1px solid ${t.bd1};background:${t.sf1};color:${t.tx1};
                    font:700 10px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                    flex:0 0 auto;cursor:pointer;box-shadow:${t.sh1};white-space:nowrap;
                }
                .enh-mark-btn:hover{border-color:${t.accentBorder};color:${t.accent}}
                .enh-mark-btn[data-active="true"]{background:${t.accent};border-color:${t.accent};color:${readableTextColor(t.accent)}}
                .enh-mark-btn--skip[data-active="true"]{background:${t.red};border-color:${t.red};color:${readableTextColor(t.red)}}
                /* Logging a rewatch only makes sense against something already Seen.
                   Hidden with display rather than the hidden attribute, because the rule
                   above gives these buttons a display of their own and would win. */
                .enh-mark-btn--again{display:none}
                .enh-mark-btn--clear:disabled{display:none}
                .enh-markable-card.enh-marked--watched .enh-mark-btn--again{display:inline-block}
                .enh-markable-card > .enh-mark-badge{
                    position:absolute;left:6px;bottom:6px;z-index:19;
                    padding:4px 7px;border-radius:6px;background:${t.accent};color:${readableTextColor(t.accent)};
                    font:800 10px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                    box-shadow:${t.sh1};text-transform:uppercase;letter-spacing:.04em;
                    pointer-events:none;
                }
                .enh-mark-badge--skip{background:${t.red};color:${readableTextColor(t.red)}}
                /* Above the Seen/Skip badge, in the surface colours rather than the
                   accent: it reports progress through a show rather than saying this
                   title carries a mark of its own. */
                .enh-markable-card > .enh-episode-badge{
                    position:absolute;left:6px;bottom:34px;z-index:19;
                    padding:4px 7px;border-radius:6px;background:${t.sf1};color:${t.tx1};
                    border:1px solid ${t.bd1};box-shadow:${t.sh1};
                    font:800 10px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                    text-transform:uppercase;letter-spacing:.04em;pointer-events:none;
                }
                /* IMDb draws its own Watched control on the same corner of a card.
                   Where one is present, the local controls and badge step aside so
                   the native account action stays clickable and unambiguous. */
                .enh-markable-card[data-enh-native-watched="true"] .enh-mark-controls{top:44px}
                .enh-markable-card[data-enh-native-watched="true"] .enh-mark-badge{left:auto;right:6px}
            `, 'enh-watchedMarking');

            this._clickHandler = (e) => {
                const btn = e.target.closest?.('[data-enh-mark-action]');
                if (!btn) return;
                const card = btn.closest('.enh-markable-card');
                const imdbId = card?.dataset.enhMarkId;
                if (!imdbId) return;
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation?.();
                const action = btn.dataset.enhMarkAction;
                if (action === 'again') {
                    const before = countViewings(getUserMarks()[imdbId]);
                    const total = logAdditionalViewing(imdbId);
                    // The write was refused and has already said so. Anything said here
                    // replaces that message with a reassuring one that is not true.
                    if (total === null) return;
                    if (!total) {
                        showToast(t('toast_already_logged_a_viewing_today'));
                        return;
                    }
                    this._syncAll();
                    /* At the ceiling the oldest date makes room for the new one, which is
                       a thing to say rather than a count that mysteriously stops moving. */
                    showToast(total > before
                        ? tCount('text_viewings_logged', total)
                        : tCount('text_viewings_logged_oldest_dropped', USER_MARK_VIEWINGS_MAX));
                    return;
                }
                const state = action === 'clear' || getUserMark(imdbId) === action ? '' : action;
                if (!setUserMark(
                    imdbId,
                    state,
                    card.dataset.enhMarkTitle || getTitleText(),
                    true,
                    readCardMarkMetadata(card, imdbId)
                )) return;
                this._syncAll();
                /* Two sentences rather than one with a word swapped inside it: which
                   noun goes there is a language decision, not a string edit. */
                showToast(state
                    ? (state === 'watched' ? t('toast_saved_locally_as_seen') : t('toast_saved_locally_as_skip'))
                    : t('text_local_mark_cleared'));
            };
            document.body.addEventListener('click', this._clickHandler, true);

            this._scan(document);
            this._pendingScanRoots = new Set();
            this._observer = new MutationObserver(mutations => {
                mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
                    if (node?.matches || node?.querySelectorAll) this._pendingScanRoots.add(node);
                }));
                if (!this._pendingScanRoots.size) return;
                if (this._pendingScanRoots.size > 50) {
                    this._pendingScanRoots.clear();
                    this._pendingScanRoots.add(document);
                }
                cancelAnimationFrame(this._raf);
                this._raf = requestAnimationFrame(() => {
                    const roots = [...this._pendingScanRoots];
                    this._pendingScanRoots.clear();
                    roots.forEach(root => {
                        if (root === document || root.isConnected !== false) this._scan(root);
                    });
                });
            });
            this._observer.observe(document.body, { childList: true, subtree: true });
        },
        _scan(root) {
            const seen = new Set();
            const currentId = getIMDbID();
            const heroPoster = document.querySelector('[data-testid="hero-media__poster"]');
            if (heroPoster && currentId) {
                this._decorate(heroPoster, currentId, getTitleText());
                this._applySeriesProgress(heroPoster, currentId);
                seen.add(heroPoster);
            }

            const anchors = [];
            if (root?.matches?.('a[href*="/title/tt"]')) anchors.push(root);
            root?.querySelectorAll?.('a[href*="/title/tt"]').forEach(a => anchors.push(a));
            anchors.forEach(anchor => {
                const imdbId = getLinkedTitleId(anchor.href);
                if (!imdbId) return;
                const card = this._findCard(anchor);
                if (!card || seen.has(card)) return;
                seen.add(card);
                this._decorate(card, imdbId, this._extractTitle(card, anchor));
            });
        },
        /* IE-107: a series page knows nothing about the episodes of it somebody has
           watched, even though the marks are right there. This says how many, and how
           many there are only when the page already says so: the total comes from the
           structured data IMDb ships with the page, never from a request. */
        _applySeriesProgress(card, seriesId) {
            const existing = Array.from(card.children)
                .find(child => child.classList?.contains('enh-episode-badge'));
            const type = getMediaType();
            /* Counting walks every mark in the store, and this runs from a document-wide
               observer that can hand over fifty roots in one frame. The store is replaced
               wholesale on every write, so the object itself is the version stamp: the
               same one means the same answer. */
            const marks = getUserMarks();
            let seenCount = 0;
            if (type === 'series' || type === 'miniseries') {
                if (this._episodeCountFor !== marks || this._episodeCountId !== seriesId) {
                    this._episodeCountFor = marks;
                    this._episodeCountId = seriesId;
                    this._episodeCount = countSeenEpisodes(seriesId, marks);
                }
                seenCount = this._episodeCount;
            }
            if (!seenCount) {
                existing?.remove();
                return;
            }
            const badge = existing || makeEl('div', { className:'enh-episode-badge' });
            if (!existing) card.appendChild(badge);
            const total = Number(getLDData()?.numberOfEpisodes);
            const knownTotal = Number.isSafeInteger(total) && total >= seenCount ? total : 0;
            setTextIfChanged(badge, knownTotal
                ? t('text_seen_episodes_of_total', [seenCount, knownTotal])
                : tCount('text_seen_episodes', seenCount));
        },
        _findCard(anchor) {
            return findTitleCard(anchor);
        },
        _extractTitle(card, anchor) {
            const fromImg = card.querySelector('img[alt]')?.alt?.replace(/^poster for\s+/i, '').trim();
            if (fromImg) return fromImg;
            const fromTitle = card.querySelector('.ipc-title__text,[data-testid*="title" i]')?.textContent?.trim();
            if (fromTitle) return fromTitle.replace(/^\d+\.\s*/, '');
            return anchor.textContent?.trim().replace(/^\d+\.\s*/, '') || '';
        },
        _decorate(card, imdbId, title) {
            if (!card || card.closest('#enh-settings-panel')) return;
            card.dataset.enhMarkId = imdbId;
            card.dataset.enhMarkTitle = title || imdbId;
            card.classList.add('enh-markable-card');
            card.dataset.enhNativeWatched = String(Boolean(card.querySelector(NATIVE_WATCHED_SELECTOR)));

            if (!Array.from(card.children).some(child => child.classList?.contains('enh-mark-controls'))) {
                const controls = makeEl('div', { className: 'enh-mark-controls' },
                    makeEl('button', {
                        type: 'button',
                        className: 'enh-mark-btn enh-mark-btn--watched',
                        dataset: { enhMarkAction: 'watched' },
                        'aria-pressed': 'false',
                        title: t('text_save_a_private_local_seen_mark'),
                        'aria-label': t('aria_save_a_private_seen_mark_for', [title || imdbId]),
                    }, t('label_seen')),
                    makeEl('button', {
                        type: 'button',
                        className: 'enh-mark-btn enh-mark-btn--skip',
                        dataset: { enhMarkAction: 'skip' },
                        'aria-pressed': 'false',
                        title: t('text_save_a_private_local_skip_mark'),
                        'aria-label': t('aria_save_a_private_skip_mark_for', [title || imdbId]),
                    }, t('label_skip')),
                    /* Only on something already Seen, so the row is two buttons wide
                       until there is a viewing to add to. */
                    makeEl('button', {
                        type: 'button',
                        className: 'enh-mark-btn enh-mark-btn--again',
                        dataset: { enhMarkAction: 'again' },
                        title: t('text_log_another_viewing'),
                        'aria-label': t('aria_log_another_viewing_of', [title || imdbId]),
                    }, t('label_again')),
                    makeEl('button', {
                        type: 'button',
                        className: 'enh-mark-btn enh-mark-btn--clear',
                        dataset: { enhMarkAction: 'clear' },
                        'aria-label': t('aria_clear_mark_for', [title || imdbId]),
                    }, t('label_clear'))
                );
                card.appendChild(controls);
            }
            this._applyCardState(card);
        },
        _applyCardState(card) {
            const mark = getUserMark(card.dataset.enhMarkId);
            card.classList.toggle('enh-marked', Boolean(mark));
            card.classList.toggle('enh-marked--watched', mark === 'watched');
            card.classList.toggle('enh-marked--skip', mark === 'skip');
            card.querySelectorAll('.enh-mark-btn').forEach(btn => {
                const action = btn.dataset.enhMarkAction;
                const active = action === mark;
                btn.dataset.active = String(active);
                if (action === 'watched' || action === 'skip') {
                    const stateLabel = action === 'watched' ? 'watched' : 'skipped';
                    btn.setAttribute('aria-pressed', String(active));
                    btn.setAttribute('aria-label', active
                        ? t('aria_has_a_private_local_mark', [card.dataset.enhMarkTitle, stateLabel])
                        : `Save a private ${stateLabel} mark for ${card.dataset.enhMarkTitle}; does not change IMDb Watched`);
                } else if (action === 'clear') {
                    btn.disabled = !mark;
                }
            });

            let badge = Array.from(card.children).find(child => child.classList?.contains('enh-mark-badge'));
            if (!mark) {
                badge?.remove();
                return;
            }
            if (!badge) {
                badge = makeEl('div', { className: 'enh-mark-badge' });
                card.appendChild(badge);
            }
            /* Guarded for the same reason as the filter counts: this runs from a
               document-wide MutationObserver and writes into the subtree that observer
               watches, so an unconditional write is a self-sustaining repaint. */
            /* A rewatch count on the badge, because the whole point of logging a second
               viewing is being able to see there was one. One viewing is what a Seen mark
               already says, so only two or more are worth a number. */
            const viewings = countViewings(getUserMarks()[card.dataset.enhMarkId]);
            const label = mark === 'watched' ? t('settings_local_seen') : t('settings_local_skip');
            setTextIfChanged(badge, viewings > 1 ? `${label} ${t('text_times_count', [viewings])}` : label);
            badge.classList.toggle('enh-mark-badge--skip', mark === 'skip');
        },
        _syncAll() {
            document.querySelectorAll('.enh-markable-card').forEach(card => this._applyCardState(card));
            document.dispatchEvent(new CustomEvent('imdb-enhanced:marks-updated'));
        },
        destroy() {
            removeCSS('enh-watchedMarking');
            if (this._clickHandler) document.body.removeEventListener('click', this._clickHandler, true);
            this._clickHandler = null;
            this._observer?.disconnect();
            this._observer = null;
            cancelAnimationFrame(this._raf);
            this._pendingScanRoots?.clear();
            this._pendingScanRoots = null;
            this._episodeCountFor = null;
            this._episodeCountId = '';
            this._episodeCount = 0;
            document.querySelectorAll('.enh-markable-card').forEach(card => {
                card.classList.remove('enh-markable-card', 'enh-marked', 'enh-marked--watched', 'enh-marked--skip');
                delete card.dataset.enhMarkId;
                delete card.dataset.enhMarkTitle;
                delete card.dataset.enhNativeWatched;
                card.querySelectorAll('.enh-mark-controls,.enh-mark-badge,.enh-episode-badge').forEach(el => el.remove());
            });
        }
    });

    /* IE-116: marks only ever showed on cards with a poster, and most links to a title on
       IMDb are not that. Trivia, plot summaries, awards, review bodies and the "more like
       this" fallbacks are all plain anchors, so a title somebody had already watched read
       exactly like one they had not. This marks the anchors themselves.

       Deliberately quiet: a dotted underline in the mark's colour and a tooltip. Tinting
       the text would fight IMDb's own link colours in five themes and turn a paragraph of
       trivia into a patchwork.

       Every anchor is resolved from its own href through getLinkedTitleId, never from
       what another feature has decorated: that walk is progressive, so reading it would
       make this feature's coverage depend on how far another one had got. */
    /* What the tooltip says. A note is the thing somebody is most likely to have
       forgotten writing, so its presence is worth saying; the note itself is not, because
       a tooltip on a link in a paragraph of trivia is not where anybody reads one. */
    function describeLinkMark(record) {
        const state = record?.state === 'skip' ? t('settings_local_skip') : t('settings_local_seen');
        const viewings = countViewings(record);
        const parts = [viewings > 1 ? `${state} ${t('text_times_count', [viewings])}` : state];
        if (normalizeUserNote(record?.note)) parts.push(t('text_has_a_note'));
        return parts.join(t('text_clause_separator'));
    }

    const LINK_MARK_ATTRIBUTE = 'data-enh-link-mark';
    const LINK_MARK_TITLED = 'data-enh-link-mark-titled';
    /* Which title the decoration was written for. IMDb's SPA reuses anchor nodes and
       rewrites their href, so without this a link that used to point at something seen
       keeps the underline and the tooltip while pointing somewhere else entirely. */
    const LINK_MARK_ID = 'data-enh-link-mark-id';
    /* Anchors another feature already speaks for, and this script's own interface. A card
       carries a badge and a set of controls; underlining its title as well says the same
       thing twice in the same place. */
    const LINK_MARK_EXCLUDED = '.enh-markable-card, #enh-settings-panel, #enh-settings-overlay,'
        + ' .enh-marks-panel, .enh-mark-controls, #enh-first-run, #enh-update-notice';

    reg({
        key: 'markLinkTint', name: t('feature_markLinkTint_name'), group: 'Features',
        _observer: null,
        _raf: 0,
        _pending: null,
        _onMarksUpdated: null,
        init() {
            if (!isIMDbHost()) return;
            // The marks are the whole content of this, so it follows their feature.
            if (!get('watchedMarking')) return;
            const isCurrent = createFeatureGuard(this);

            addThemedCSS(theme => `
                a[${LINK_MARK_ATTRIBUTE}] {
                    text-decoration-line: underline;
                    text-decoration-style: dotted;
                    text-decoration-thickness: 2px;
                    text-underline-offset: 2px;
                }
                a[${LINK_MARK_ATTRIBUTE}="watched"] { text-decoration-color: ${theme.accent}; }
                a[${LINK_MARK_ATTRIBUTE}="skip"] { text-decoration-color: ${theme.red}; }
            `, 'enh-markLinkTint');

            this._scan(document);
            this._pending = new Set();
            /* Only added nodes. Watching attributes would watch this feature's own
               writes, which is a repaint loop with extra steps. */
            this._observer = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    if (mutation.type === 'attributes') {
                        if (mutation.target?.matches) this._pending.add(mutation.target);
                        return;
                    }
                    mutation.addedNodes.forEach(node => {
                        if (node?.matches || node?.querySelectorAll) this._pending.add(node);
                    });
                });
                if (!this._pending.size || !isCurrent()) return;
                if (this._pending.size > 50) {
                    this._pending.clear();
                    this._pending.add(document);
                }
                cancelAnimationFrame(this._raf);
                this._raf = requestAnimationFrame(() => {
                    const roots = [...this._pending];
                    this._pending.clear();
                    if (isCurrent()) roots.forEach(root => this._scan(root));
                });
            });
            /* Added nodes, and href. Watching every attribute would watch this feature's
               own writes, which is a repaint loop with extra steps; watching href alone is
               how a reused anchor pointed at a different title gets noticed. */
            this._observer.observe(document.documentElement,
                { childList:true, subtree:true, attributes:true, attributeFilter:['href'] });

            this._onMarksUpdated = () => { if (isCurrent()) this._scan(document); };
            document.addEventListener('imdb-enhanced:marks-updated', this._onMarksUpdated);
        },
        _scan(root) {
            const marks = getUserMarks();
            const anchors = [];
            if (root?.matches?.('a[href*="/title/tt"]')) anchors.push(root);
            root?.querySelectorAll?.('a[href*="/title/tt"]').forEach(anchor => anchors.push(anchor));
            anchors.forEach(anchor => this._apply(anchor, marks));
        },
        _apply(anchor, marks) {
            /* An anchor that has moved into the settings panel, or gained an excluded
               ancestor, still carries whatever was written on it. Read as "no mark" rather
               than returned from, so the removal below cleans it up. */
            const excluded = Boolean(anchor.closest(LINK_MARK_EXCLUDED));
            const imdbId = excluded ? '' : getLinkedTitleId(anchor.href);
            const record = imdbId ? marks[imdbId] : null;
            const state = record?.state === 'watched' || record?.state === 'skip' ? record.state : '';
            const label = state ? describeLinkMark(record) : '';
            /* Written only when something it says would change, for the same reason the
               badge counts are: this runs from a document-wide observer over the subtree it
               writes into. Keyed on the id and the tooltip as well as the state, because a
               rewatch or a new note changes neither the state nor the href, and an anchor
               React points at a different title keeps the same node. */
            const unchanged = (anchor.getAttribute(LINK_MARK_ATTRIBUTE) || '') === state
                && (anchor.getAttribute(LINK_MARK_ID) || '') === imdbId
                && (!anchor.hasAttribute(LINK_MARK_TITLED) || anchor.title === label);
            if (unchanged) return;
            if (!state) {
                anchor.removeAttribute(LINK_MARK_ATTRIBUTE);
                anchor.removeAttribute(LINK_MARK_ID);
                if (anchor.hasAttribute(LINK_MARK_TITLED)) {
                    anchor.removeAttribute('title');
                    anchor.removeAttribute(LINK_MARK_TITLED);
                }
                return;
            }
            anchor.setAttribute(LINK_MARK_ATTRIBUTE, state);
            anchor.setAttribute(LINK_MARK_ID, imdbId);
            /* Never over a tooltip IMDb wrote. Somebody hovering a link to read what the
               site says about it should still get that. */
            if (!anchor.title || anchor.hasAttribute(LINK_MARK_TITLED)) {
                anchor.setAttribute('title', label);
                anchor.setAttribute(LINK_MARK_TITLED, '1');
            }
        },
        destroy() {
            removeCSS('enh-markLinkTint');
            this._observer?.disconnect();
            this._observer = null;
            cancelAnimationFrame(this._raf);
            this._pending?.clear();
            this._pending = null;
            if (this._onMarksUpdated) {
                document.removeEventListener('imdb-enhanced:marks-updated', this._onMarksUpdated);
            }
            this._onMarksUpdated = null;
            document.querySelectorAll(`a[${LINK_MARK_ATTRIBUTE}]`).forEach(anchor => {
                anchor.removeAttribute(LINK_MARK_ATTRIBUTE);
                anchor.removeAttribute(LINK_MARK_ID);
                if (!anchor.hasAttribute(LINK_MARK_TITLED)) return;
                anchor.removeAttribute('title');
                anchor.removeAttribute(LINK_MARK_TITLED);
            });
        },
    });

    /* Marks decorate cards but could not narrow a large collection, which is where they
       are most useful — a 250-row chart or a long watchlist. Filtering is pure DOM over
       cards already on the page: no request, no IMDb GraphQL call, and no reordering, so
       a chart stays in its own ranking. */
    const MARK_FILTERS = [
        { id:'all', label:t('label_all') },
        { id:'unseen', label:t('label_unseen') },
        { id:'watched', label:t('label_seen') },
        { id:'skip', label:t('label_skipped') },
    ];

    /* Reads the score IMDb already renders on a collection card. The rating lives in
       `.ipc-rating-star--imdb` (its `.ipc-rating-star--rating` child holds just the
       number); the element's aria-label reads "IMDb rating: 9.3", which is English and
       therefore not what this parses. Some locales render the decimal with a comma, so
       both separators are accepted. */
    const CARD_RATING_SELECTOR = '.ipc-rating-star--imdb';
    const DIM_THRESHOLD_OPTIONS = ['5.0', '6.0', '6.5', '7.0', '7.5', '8.0'];

    function readCardRating(row) {
        const star = row?.querySelector?.(CARD_RATING_SELECTOR);
        if (!star) return null;
        const text = (star.querySelector('.ipc-rating-star--rating') || star).textContent || '';
        const match = /(\d{1,2})[.,](\d)/.exec(text) || /^\s*(\d{1,2})\s*$/.exec(text);
        if (!match) return null;
        const value = Number(match[2] === undefined ? match[1] : `${match[1]}.${match[2]}`);
        return Number.isFinite(value) && value > 0 && value <= 10 ? value : null;
    }

    function readCardMarkMetadata(card, imdbId = '') {
        if (imdbId && imdbId === getIMDbID()) return readCurrentTitleMarkMetadata(imdbId);
        const cells = card?.querySelectorAll?.(`${COLLECTION_METADATA_SELECTOR} li, ${COLLECTION_METADATA_SELECTOR} span`) || [];
        let year = null;
        let runtime = null;
        for (const cell of cells) {
            const text = cell.textContent || '';
            if (year === null) year = normalizeUserMarkYear(text);
            if (runtime === null) runtime = normalizeUserMarkRuntime(parseRuntimeMinutes(text));
        }
        const imdbRating = normalizeUserMarkRating(readCardRating(card));
        /* An episode row on an episodes list belongs to the series whose page it is, and
           that page's own id is the series id. The surface alone is not enough: IMDb puts
           "More to explore" and a recently-viewed rail on the same tab, and stamping those
           made a film somebody marked from a rail count as an episode of the show. The row
           has to be an episode row. */
        /* No self-check here: a card carrying this page's own id is handed to
           readCurrentTitleMarkMetadata on the first line, and that is where the check
           against a title being an episode of itself lives. */
        const series = getPageSurface() === 'episodes' && card?.closest?.(EPISODE_ROW_SELECTOR)
            ? normalizeUserMarkSeries(getIMDbID())
            : '';
        return {
            ...(year !== null ? { year } : {}),
            ...(imdbRating !== null ? { imdbRating } : {}),
            ...(runtime !== null ? { runtime } : {}),
            ...(series ? { series } : {}),
        };
    }

    function normalizeDimThreshold(value) {
        const text = String(value ?? '').trim();
        return DIM_THRESHOLD_OPTIONS.includes(text) ? text : DEFAULTS.dimRatingThreshold;
    }

    /* Rows are resolved from their own title links, not from the cards the marks feature
       has decorated. Those two are not the same set: decoration walks the page
       progressively, so on a 250-row chart it can be half done when a filter runs, and a
       filter that only knows about decorated cards leaves every other row on screen —
       selecting "Seen" showed 2 marked titles plus 125 rows it had never seen. Reading
       the links makes the filter's view of the page complete and independent of how far
       another feature has got. */
    /* IMDb's episode list renders one season at a time as `article.episode-item-wrapper`
       nodes, each headed "S1.E1 ∙ Pilot" and linking to the episode's own title id.
       Verified against Breaking Bad on 2026-08-31. The season bar below works on the rows
       that season has actually rendered and never fetches another: an episode list that
       quietly issued requests to complete itself would be doing something nobody asked for.
       Declared here because the mark filter needs it too, and two copies of a selector is
       how one of them silently stops matching. */
    const EPISODE_ROW_SELECTOR = 'article.episode-item-wrapper';
    /* An episode row is an article, matching none of the card selectors, so on a season's
       episode list the filter found nothing: the bar stayed hidden with every count at
       zero while its observer still ran over the whole document on each mutation. Episodes
       do carry marks, from the season bar's batch buttons and from each episode's own
       page, so the fix is to let the filter see the rows rather than to stop offering it. */
    const MARK_FILTER_ROW_SELECTOR = `li, .ipc-poster-card, .ipc-metadata-list-summary-item, ${EPISODE_ROW_SELECTOR}`;

    function collectMarkFilterCards(root = document) {
        const cards = [];
        const seenIds = new Set();
        const seenHosts = new Set();
        const links = root.querySelectorAll?.('a[href*="/title/tt"]') || [];
        let inspected = 0;
        for (const link of links) {
            if (inspected >= COLLECTION_LINK_SCAN_LIMIT) break;
            inspected += 1;
            const id = getLinkedTitleId(link.href);
            if (!id) continue;
            // The row, not the inner card: hiding the card leaves IMDb's grid holding an
            // empty cell where a filtered title used to be.
            const host = link.closest?.(MARK_FILTER_ROW_SELECTOR);
            if (!host || seenHosts.has(host)) continue;
            seenHosts.add(host);
            // Counts are over unique titles: a row can carry several links to the same
            // title (poster and headline), and some surfaces render a title twice.
            const duplicate = seenIds.has(id);
            if (!duplicate) seenIds.add(id);
            cards.push({ card:host, id, duplicate });
        }
        return cards;
    }

    function countMarkFilters(cards, marks) {
        const counts = { all:0, unseen:0, watched:0, skip:0 };
        cards.forEach(entry => {
            if (entry.duplicate) return;
            counts.all += 1;
            const state = marks[entry.id]?.state;
            if (state === 'watched') counts.watched += 1;
            else if (state === 'skip') counts.skip += 1;
            else counts.unseen += 1;
        });
        return counts;
    }

    function markMatchesFilter(state, filter) {
        if (filter === 'all') return true;
        if (filter === 'unseen') return state !== 'watched' && state !== 'skip';
        return state === filter;
    }

    /* Notes are paywalled by every tracker that offers them and absent from IMDb, yet they
       are trivially local: a note lives inside its title's existing mark record, so it
       inherits the same 5,000-record bound, the same normalizer, and the same backup and
       restore path without a second store. */
    reg({
        key: 'titleNotes', name: t('feature_titleNotes_name'), group: 'Features',
        init() {
            if (!isIMDbHost()) return;
            const imdbId = getIMDbID();
            if (!imdbId) return;
            if (document.getElementById('enh-title-note')) return;
            const isCurrent = createFeatureGuard(this);

            addThemedCSS(t => `
                #enh-title-note { display: flex; flex-direction: column; gap: 6px; }
                .enh-title-note__head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
                .enh-title-note__label {
                    font: 700 10px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    letter-spacing: .08em; text-transform: uppercase; color: ${t.tx3};
                }
                .enh-title-note__status { font: 500 10px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: ${t.tx3}; }
                .enh-title-note__status[data-state="saved"] { color: ${t.green}; }
                .enh-title-note__status[data-state="error"] { color: ${t.red}; }
                #enh-title-note textarea {
                    width: 100%; min-height: 68px; resize: vertical; box-sizing: border-box;
                    border: 1px solid ${t.bd1}; border-radius: 8px; background: ${t.bg}; color: ${t.tx1};
                    padding: 8px 10px; font: 400 13px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }
                #enh-title-note textarea:focus-visible {
                    outline: 2px solid ${t.accent}; outline-offset: 2px;
                    border-color: ${t.accentBorder}; box-shadow: 0 0 0 2px ${t.accentMuted};
                }
                .enh-title-note__count { font: 500 10px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: ${t.tx3}; align-self: flex-end; }
            `, 'enh-title-note-css');

            waitForTitleSurface().then(() => {
                if (!isCurrent()) return;
                if (document.getElementById('enh-title-note')) return;

                const status = makeEl('span', {
                    className:'enh-title-note__status', role:'status', 'aria-live':'polite',
                });
                const count = makeEl('div', { className:'enh-title-note__count' });
                const area = makeEl('textarea', {
                    id:'enh-title-note-input',
                    maxlength:String(USER_MARK_NOTE_LIMIT),
                    spellcheck:'true',
                    placeholder:t('field_a_private_note_about_this_title'),
                    'aria-label':t('aria_private_note_about', [getTitleText() || 'this title']),
                    'aria-describedby':'enh-title-note-count',
                });
                count.id = 'enh-title-note-count';
                area.value = getUserNote(imdbId);

                const paintCount = () => {
                    count.textContent = `${area.value.length} / ${USER_MARK_NOTE_LIMIT}`;
                };
                paintCount();

                let saveTimer = null;
                let statusTimer = null;
                const commit = () => {
                    if (!isCurrent()) return;
                    const saved = setUserNote(imdbId, area.value, getTitleText());
                    status.dataset.state = saved ? 'saved' : 'error';
                    status.textContent = saved
                        ? (normalizeUserNote(area.value) ? t('text_saved_on_this_device') : t('text_note_cleared'))
                        : `Could not save. Check ${STORAGE_HOST_LABEL}.`;
                    clearTimeout(statusTimer);
                    // Cleared so a stale "Saved" cannot be read as the result of a later edit.
                    if (saved) statusTimer = setTimeout(() => { status.textContent = ''; }, 4000);
                };
                area.addEventListener('input', () => {
                    paintCount();
                    status.dataset.state = '';
                    status.textContent = t('text_saving');
                    clearTimeout(saveTimer);
                    saveTimer = setTimeout(commit, 600);
                });
                // Leaving the field commits immediately rather than waiting out the debounce.
                area.addEventListener('blur', () => {
                    clearTimeout(saveTimer);
                    commit();
                });
                this._cleanup = () => { clearTimeout(saveTimer); clearTimeout(statusTimer); };

                const wrap = makeEl('section', {
                    id:'enh-title-note', role:'region', 'aria-label':t('aria_private_note'),
                },
                    makeEl('div', { className:'enh-title-note__head' },
                        makeEl('span', { className:'enh-title-note__label' }, t('aria_private_note')),
                        status
                    ),
                    area,
                    count
                );
                appendTitleStackItem(wrap, TITLE_STACK_ORDER.titleNotes);
            }).catch(() => {});
        },
        destroy() {
            this._cleanup?.();
            this._cleanup = null;
            removeCSS('enh-title-note-css');
            document.getElementById('enh-title-note')?.remove();
            pruneTitleStack();
        },
    });

    reg({
        key: 'dimLowRated', name: t('feature_dimLowRated_name'), group: 'Appearance',
        init() {
            if (!isIMDbHost()) return;
            const isCurrent = createFeatureGuard(this);
            const threshold = Number(normalizeDimThreshold(get('dimRatingThreshold')));

            /* Only the artwork is dimmed. The title, its score and every control stay at
               full contrast, because this is meant to make a card easier to skip past,
               not harder to read or operate — and dimming text would fail contrast
               requirements the rest of the product meets. Hover and keyboard focus
               restore the image, so nothing is permanently obscured. */
            addThemedCSS(() => `
                .enh-dim-low img { opacity: .38; filter: saturate(.5); transition: opacity .15s ease, filter .15s ease; }
                .enh-dim-low:hover img, .enh-dim-low:focus-within img { opacity: 1; filter: none; }
                @media (prefers-reduced-motion: reduce) { .enh-dim-low img { transition: none; } }
                @media (forced-colors: active) { .enh-dim-low img { opacity: 1; filter: none; } }
            `, 'enh-dim-low-css');

            const paint = () => {
                if (!isCurrent()) return;
                collectMarkFilterCards().forEach(({ card }) => {
                    const rating = readCardRating(card);
                    // A card with no score is not low-rated, it is unrated; dimming it
                    // would hide new and obscure titles rather than poor ones.
                    const poster = card.querySelector?.('.ipc-poster, .ipc-media__img') || null;
                    if (poster) poster.classList.toggle('enh-dim-low', rating !== null && rating < threshold);
                });
            };
            paint();

            let frame = null;
            const observer = new MutationObserver(() => {
                if (frame) return;
                frame = requestAnimationFrame(() => { frame = null; paint(); });
            });
            observer.observe(document.querySelector('main') || document.body, { childList:true, subtree:true });
            this._observer = observer;
            this._cancelFrame = () => { if (frame) cancelAnimationFrame(frame); frame = null; };
        },
        destroy() {
            removeCSS('enh-dim-low-css');
            this._observer?.disconnect();
            this._observer = null;
            this._cancelFrame?.();
            this._cancelFrame = null;
            document.querySelectorAll('.enh-dim-low').forEach(node => node.classList.remove('enh-dim-low'));
        },
    });

    reg({
        key: 'markFilters', name: t('feature_markFilters_name'), group: 'Utility',
        _active: 'all',
        init() {
            if (!isIMDbHost()) return;
            // The cards this filters are drawn by the marks feature; without it there is
            // nothing to filter and the bar would be a control that does nothing.
            if (!get('watchedMarking')) return;
            if (document.getElementById('enh-mark-filters')) return;
            const isCurrent = createFeatureGuard(this);
            this._active = 'all';

            addThemedCSS(t => `
                #enh-mark-filters {
                    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
                    margin: 6px 0 10px;
                }
                /* The display above outranks the UA [hidden] rule, so without this an
                   empty filter bar renders on any surface with no title cards — a title
                   subpage, for instance. Fourth instance of this trap in this file. */
                #enh-mark-filters[hidden] { display: none; }
                .enh-mark-filters__label {
                    font: 700 10px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    letter-spacing: .08em; text-transform: uppercase; color: ${t.tx3};
                }
                .enh-mark-filter-btn {
                    height: 26px; padding: 0 10px; border-radius: 7px; cursor: pointer;
                    border: 1px solid ${t.bd1}; background: ${t.sf0}; color: ${t.tx2};
                    font: 650 11px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }
                .enh-mark-filter-btn:hover { background: ${t.sf2}; color: ${t.tx0}; }
                .enh-mark-filter-btn[aria-checked="true"] {
                    background: ${t.accent}; border-color: ${t.accent}; color: ${readableTextColor(t.accent)};
                }
                .enh-mark-filter-btn:focus-visible { outline: 2px solid ${t.accent}; outline-offset: 2px; }
                .enh-mark-filter-count { opacity: .75; margin-left: 4px; }
                /* A class rather than the hidden property: these are IMDb's own list
                   items, which carry their own display, and [hidden] would lose to it. */
                .enh-mark-filtered-out { display: none !important; }
                .enh-mark-filters__empty { color: ${t.tx3}; font: 500 12px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
                .enh-mark-filters__empty:empty { display: none; }
            `, 'enh-mark-filters-css');

            const bar = makeEl('div', {
                id:'enh-mark-filters', role:'radiogroup', 'aria-label':t('aria_filter_by_private_marks'),
            }, makeEl('span', { className:'enh-mark-filters__label' }, t('label_private_marks')));
            const empty = makeEl('div', { className:'enh-mark-filters__empty', role:'status', 'aria-live':'polite' });

            const buttons = MARK_FILTERS.map(filter => {
                const count = makeEl('span', { className:'enh-mark-filter-count' }, '0');
                const button = makeEl('button', {
                    type:'button',
                    className:'enh-mark-filter-btn',
                    role:'radio',
                    'aria-checked':String(filter.id === 'all'),
                    dataset:{ enhMarkFilter:filter.id },
                    onClick:() => this._select(filter.id),
                }, makeEl('span', {}, filter.label), count);
                button.tabIndex = filter.id === 'all' ? 0 : -1;
                bar.appendChild(button);
                return { filter, button, count };
            });

            /* Radiogroup keyboard contract: arrows move between options and select,
               Home/End jump to the ends. Without it the group is a set of buttons
               wearing radio roles. */
            bar.addEventListener('keydown', event => {
                const order = MARK_FILTERS.map(filter => filter.id);
                const current = order.indexOf(this._active);
                let next = null;
                if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % order.length;
                else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current - 1 + order.length) % order.length;
                else if (event.key === 'Home') next = 0;
                else if (event.key === 'End') next = order.length - 1;
                if (next === null) return;
                event.preventDefault();
                this._select(order[next]);
                bar.querySelector(`[data-enh-mark-filter="${order[next]}"]`)?.focus();
            });

            this._apply = () => {
                if (!isCurrent()) return;
                const marks = getUserMarks();
                const cards = collectMarkFilterCards();
                const counts = countMarkFilters(cards, marks);
                buttons.forEach(({ filter, button, count }) => {
                    // Guarded: this text lives inside the subtree the observer watches.
                    setTextIfChanged(count, counts[filter.id]);
                    const checked = filter.id === this._active;
                    button.setAttribute('aria-checked', String(checked));
                    button.tabIndex = checked ? 0 : -1;
                    button.setAttribute('aria-label',
                        tCount('text_filter_title_count', counts[filter.id], [filter.label]));
                });
                let shown = 0;
                cards.forEach(({ card, id }) => {
                    const match = markMatchesFilter(marks[id]?.state, this._active);
                    card.classList.toggle('enh-mark-filtered-out', !match);
                    if (match) shown += 1;
                });
                setTextIfChanged(empty, cards.length && !shown
                    ? `No titles on this page are ${MARK_FILTERS.find(f => f.id === this._active)?.label.toLowerCase()}.`
                    : '');
                bar.hidden = cards.length === 0;
            };
            this._select = id => {
                this._active = id;
                this._apply();
            };

            const target = document.querySelector('main') || document.body;
            target.insertBefore(bar, target.firstElementChild?.nextSibling || null);
            bar.insertAdjacentElement('afterend', empty);
            this._empty = empty;
            this._apply();

            // Cards arrive as the page lazy-loads, and marks change from the cards
            // themselves; both have to recount without a reload.
            let frame = null;
            const schedule = () => {
                if (frame) return;
                frame = requestAnimationFrame(() => { frame = null; this._apply(); });
            };
            this._marksHandler = schedule;
            document.addEventListener('imdb-enhanced:marks-updated', this._marksHandler);
            const observer = new MutationObserver(schedule);
            observer.observe(target, { childList:true, subtree:true });
            this._observer = observer;
            this._cancelFrame = () => { if (frame) cancelAnimationFrame(frame); frame = null; };
        },
        destroy() {
            removeCSS('enh-mark-filters-css');
            this._observer?.disconnect();
            this._observer = null;
            this._cancelFrame?.();
            this._cancelFrame = null;
            if (this._marksHandler) document.removeEventListener('imdb-enhanced:marks-updated', this._marksHandler);
            this._marksHandler = null;
            // Every card comes back, whatever filter was active when this stopped.
            document.querySelectorAll('.enh-mark-filtered-out').forEach(node => node.classList.remove('enh-mark-filtered-out'));
            document.getElementById('enh-mark-filters')?.remove();
            this._empty?.remove();
            this._empty = null;
            this._apply = null;
        },
    });

    reg({
        key: 'servarrIntegration', name: t('feature_servarrIntegration_name'), group: 'Features',
        init() {
            if (!isIMDbHost()) return;
            const isCurrent = createFeatureGuard(this);
            waitForTitleSurface().then(() => {
                if (!isCurrent()) return;
                if (document.getElementById('enh-servarr-actions')) return;
                const imdbId = getIMDbID(), title = getTitleText(), year = getTitleYear();
                if (!imdbId || !title) return;

                const type = getMediaType();
                const actions = [];
                if (!isTVType(type) && isServarrConfigured('radarr')) actions.push({ kind:'radarr', label:t('text_add_radarr') });
                if (isTVType(type) && isServarrConfigured('sonarr')) actions.push({ kind:'sonarr', label:t('text_add_sonarr') });
                if (isSeerrConfigured()) actions.push({ kind:'seerr', label:t('label_request') });
                if (!actions.length) return;

                addThemedCSS(t => `
                    #enh-servarr-actions {
                        margin-top: 8px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
                    }
                    .enh-servarr-label {
                        font: 700 10px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        letter-spacing: .08em; color: ${t.tx3};
                    }
                    .enh-servarr-btn {
                        display: inline-flex; align-items: center; justify-content: center;
                        min-height: 28px; padding: 0 11px; border-radius: 7px;
                        border: 1px solid ${t.bd1}; background: ${t.sf1}; color: ${t.tx1};
                        cursor: pointer; font: 700 11px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        transition: background .15s ease, border-color .15s ease, color .15s ease, transform .15s ease;
                    }
                    .enh-servarr-btn:hover { background: ${t.sf2}; border-color: ${t.accentBorder}; color: ${t.accent}; transform: translateY(-1px); }
                    .enh-servarr-btn:disabled { cursor: progress; transform: none; }
                    /* The button reports where a title stands rather than only what
                       the click does, so state reads at a glance. Colours stay on
                       the border and a leading dot; label text keeps the tested
                       theme foreground instead of inheriting a status hue. */
                    .enh-servarr-btn[data-state] { gap: 6px; }
                    .enh-servarr-btn[data-state]::before {
                        content: ''; width: 7px; height: 7px; border-radius: 50%; background: currentColor; opacity: .85;
                    }
                    .enh-servarr-btn[data-state="add"]::before { background: ${t.tx3}; }
                    .enh-servarr-btn[data-state="pending"]::before { background: ${t.accent}; }
                    .enh-servarr-btn[data-state="queued"]::before,
                    .enh-servarr-btn[data-state="processing"]::before,
                    .enh-servarr-btn[data-state="partial"]::before { background: ${t.accent}; }
                    .enh-servarr-btn[data-state="library"]::before,
                    .enh-servarr-btn[data-state="done"]::before { background: ${t.green}; }
                    .enh-servarr-btn[data-state="library"],
                    .enh-servarr-btn[data-state="done"] { border-color: ${t.green}; }
                    .enh-servarr-btn[data-state="queued"],
                    .enh-servarr-btn[data-state="processing"],
                    .enh-servarr-btn[data-state="partial"] { border-color: ${t.accent}; }
                    .enh-servarr-btn[data-state="library"]:disabled,
                    .enh-servarr-btn[data-state="queued"]:disabled,
                    .enh-servarr-btn[data-state="processing"]:disabled,
                    .enh-servarr-btn[data-state="partial"]:disabled,
                    .enh-servarr-btn[data-state="done"]:disabled { cursor: default; opacity: 1; }
                    .enh-servarr-btn[data-state="pending"]:disabled { opacity: .72; }
                `, 'enh-servarrIntegration');

                const bar = makeEl('div', { id:'enh-servarr-actions' },
                    makeEl('div', { className:'enh-servarr-label' }, 'SERVARR')
                );
                actions.forEach(action => {
                    const btn = makeEl('button', {
                        type:'button',
                        className:'enh-servarr-btn',
                        dataset:{ kind:action.kind, state:'add' },
                        'aria-label': t('aria_action_for_title', [action.label, title]),
                        'aria-live':'polite',
                        'aria-atomic':'true',
                        onClick: async () => {
                            const original = btn.textContent;
                            const originalLabel = btn.getAttribute('aria-label');
                            const service = action.kind === 'radarr' ? 'Radarr'
                                : action.kind === 'sonarr' ? 'Sonarr' : 'Overseerr';
                            const requesting = action.kind === 'seerr';
                            this._setState(btn, 'pending',
                                requesting ? t('text_requesting') : t('text_adding'),
                                requesting
                                    ? t('text_requesting_title_through', [title, service])
                                    : t('text_adding_title_through', [title, service]),
                                { busy:true });
                            try {
                                const done = action.kind === 'seerr'
                                    ? await this._request(imdbId, title, year, isCurrent)
                                    : await this._add(action.kind, imdbId, title, year, isCurrent);
                                if (!done || !isCurrent()) return;
                                showToast(action.kind === 'seerr'
                                    ? t('toast_title_requested_through', [title, service])
                                    : t('toast_title_sent_to', [title, service]));
                                this._setState(btn, 'done',
                                    action.kind === 'seerr' ? t('text_requested') : t('text_added'),
                                    action.kind === 'seerr'
                                        ? t('text_title_has_been_requested_through', [title, service])
                                        : t('text_title_added_to', [title, service]));
                            } catch (error) {
                                if (!isCurrent()) return;
                                console.warn('[IMDb Enhanced] integration action failed:', error);
                                showToast(t('toast_service_action_failed', [service, action.kind === 'seerr' ? 'request' : 'add', getRequestErrorMessage(error)]), 4500);
                                this._setState(btn, 'add', original, originalLabel, { enabled:true });
                            }
                        },
                    }, action.label);
                    bar.appendChild(btn);
                    if (action.kind === 'seerr') this._checkSeerr({ imdbId, title, year, type }, btn, isCurrent);
                    else this._checkLibrary(action.kind, { imdbId, title, year }, btn, bar, isCurrent);
                });
                appendTitleStackItem(bar, TITLE_STACK_ORDER.servarrIntegration);
            }).catch(() => {});
        },
        _setState(btn, state, text, label, { busy = false, enabled = false } = {}) {
            if (!btn) return;
            btn.dataset.state = state;
            if (text) btn.textContent = text;
            if (label) btn.setAttribute('aria-label', label);
            btn.disabled = !enabled;
            if (busy) btn.setAttribute('aria-busy', 'true');
            else btn.removeAttribute('aria-busy');
        },
        async _checkSeerr(ctx, btn, isCurrent) {
            try {
                const mediaType = isTVType(ctx.type) ? 'tv' : 'movie';
                const response = await seerrRequest('search', {
                    query:{ query: ctx.imdbId },
                    cancelOnRouteChange:true,
                });
                if (!isCurrent()) return;
                const payload = parseJSONResponse(response);
                const match = selectSeerrSearchResult(payload?.results, ctx.imdbId, mediaType);
                if (!match) return;
                btn.dataset.tmdbId = String(match.tmdbId);
                const state = mapSeerrMediaState(match.mediaInfo);
                if (state === 'add') return;
                const copy = {
                    library:[t('text_available'), t('text_title_is_already_available', [ctx.title])],
                    partial:[t('text_partly_available'), t('text_title_is_partly_available', [ctx.title])],
                    processing:[t('text_processing'), t('text_title_is_being_processed', [ctx.title])],
                    queued:[t('text_requested'), t('text_title_has_already_been_requested', [ctx.title])],
                }[state];
                if (copy) this._setState(btn, state, copy[0], copy[1]);
            } catch { /* status is best-effort; the request button still works */ }
        },
        async _request(imdbId, title, year, isCurrent) {
            const mediaType = isTVType(getMediaType()) ? 'tv' : 'movie';
            let tmdbId = Number(document.querySelector(`#enh-servarr-actions [data-kind="seerr"]`)?.dataset.tmdbId) || 0;
            if (!tmdbId) {
                const response = await seerrRequest('search', { query:{ query:imdbId }, cancelOnRouteChange:true });
                if (!isCurrent()) return false;
                const match = selectSeerrSearchResult(parseJSONResponse(response)?.results, imdbId, mediaType);
                if (!match) throw failure('unknown', t('text_the_overseerr_instance_did_not_recognize_this'));
                tmdbId = match.tmdbId;
            }
            const body = buildSeerrRequestBody(mediaType, tmdbId);
            if (!body) throw failure('unknown', t('text_the_overseerr_instance_returned_an_unusable_title'));
            if (!isCurrent()) return false;
            /* httpRequest owns serialization; pre-stringifying here would encode the
               body twice and send Overseerr a JSON string where it expects an object. */
            await seerrRequest('request', { method:'POST', body });
            return true;
        },
        async _checkLibrary(kind, ctx, btn, bar, isCurrent) {
            try {
                const path = kind === 'radarr' ? 'movie/lookup' : 'series/lookup';
                const response = await servarrRequest(kind, path, {
                    query:{ term: `imdb:${ctx.imdbId}` },
                    cancelOnRouteChange:true,
                });
                if (!isCurrent()) return;
                const items = parseJSONResponse(response);
                if (!Array.isArray(items) || !items.length) return;
                const found = selectServarrLookupResult(items, ctx, true);
                if (found) {
                    const label = kind === 'radarr' ? 'Radarr' : 'Sonarr';
                    this._setState(btn, 'library', t('text_in_library'), t('text_title_is_already_in_service', [ctx.title, label]));
                }
            } catch { /* library check is best-effort */ }
        },
        async _lookup(kind, ctx, isCurrent) {
            const path = kind === 'radarr' ? 'movie/lookup' : 'series/lookup';
            const terms = [
                `imdb:${ctx.imdbId}`,
                `https://www.imdb.com/title/${ctx.imdbId}/`,
                ctx.title,
            ].filter(Boolean);
            for (const term of terms) {
                if (!isCurrent()) return null;
                const response = await servarrRequest(kind, path, {
                    query:{ term },
                    cancelOnRouteChange:true,
                });
                if (!isCurrent()) return null;
                const items = parseJSONResponse(response);
                const item = selectServarrLookupResult(items, ctx);
                if (item) return item;
            }
            if (!isCurrent()) return null;
            throw failure('unknown', t('text_no_matching_title_found'));
        },
        async _add(kind, imdbId, title, year, isCurrent) {
            const item = await this._lookup(kind, { imdbId, title, year }, isCurrent);
            if (!item || !isCurrent()) return false;
            const cfg = getServarrConfig(kind);
            if (kind === 'radarr') {
                const body = buildRadarrAddBody(item, cfg);
                await servarrRequest('radarr', 'movie', { method:'POST', body });
                return true;
            }

            const body = buildSonarrAddBody(item, cfg);
            await servarrRequest('sonarr', 'series', { method:'POST', body });
            return true;
        },
        destroy() {
            removeCSS('enh-servarrIntegration');
            document.getElementById('enh-servarr-actions')?.remove();
            pruneTitleStack();
        }
    });

    reg({
        key: 'mediaServerIntegration', name: t('feature_mediaServerIntegration_name'), group: 'Features',
        init() {
            if (!isIMDbHost()) return;
            const isCurrent = createFeatureGuard(this);
            waitForTitleSurface().then(() => {
                if (!isCurrent()) return;
                if (document.getElementById('enh-media-server-status')) return;
                const imdbId = getIMDbID(), title = getTitleText(), year = getTitleYear();
                if (!imdbId || !title) return;

                const servers = getConfiguredMediaServers();
                if (!servers.length) return;

                addThemedCSS(t => `
                    #enh-media-server-status {
                        margin-top: 8px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
                    }
                    .enh-media-server-label {
                        font: 700 10px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        letter-spacing: .08em; color: ${t.tx3};
                    }
                    .enh-media-server-pill {
                        min-height: 28px; display: inline-flex; align-items: center; gap: 6px;
                        border: 1px solid ${t.bd1}; border-radius: 7px; background: ${t.sf1};
                        color: ${t.tx2}; padding: 0 10px;
                        font: 700 11px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    }
                    .enh-media-server-pill__dot {
                        width: 8px; height: 8px; border-radius: 50%; background: ${t.tx3};
                    }
                    .enh-media-server-pill--found {
                        color: ${t.green};
                        border-color: color-mix(in srgb, ${t.green} 35%, transparent);
                        background: color-mix(in srgb, ${t.green} 12%, transparent);
                    }
                    .enh-media-server-pill--found .enh-media-server-pill__dot { background: ${t.green}; box-shadow: 0 0 6px ${t.green}; }
                    .enh-media-server-pill--missing { color: ${t.tx3}; }
                    .enh-media-server-pill--error {
                        color: ${t.red};
                        border-color: color-mix(in srgb, ${t.red} 35%, transparent);
                        background: color-mix(in srgb, ${t.red} 12%, transparent);
                    }
                    .enh-media-server-pill--error .enh-media-server-pill__dot { background: ${t.red}; }
                `, 'enh-mediaServerIntegration');

                const ctx = { imdbId, title, year };
                const bar = makeEl('div', { id:'enh-media-server-status' },
                    makeEl('div', { className:'enh-media-server-label' }, t('label_media_server'))
                );
                servers.forEach(server => {
                    const state = makeEl('span', { className:'enh-media-server-pill__state' }, t('label_checking'));
                    const pill = makeEl('span', {
                        className:'enh-media-server-pill',
                        title:t('text_checking_server_for_title', [server.label, title]),
                        role:'status',
                        'aria-live':'polite',
                        'aria-atomic':'true',
                    },
                        makeEl('span', { className:'enh-media-server-pill__dot', 'aria-hidden':'true' }),
                        makeEl('span', {}, server.label),
                        state
                    );
                    bar.appendChild(pill);
                    this._check(server, ctx).then(found => {
                        if (!isCurrent()) return;
                        pill.classList.add(found ? 'enh-media-server-pill--found' : 'enh-media-server-pill--missing');
                        state.textContent = found ? t('text_in_library') : t('text_not_found');
                        pill.title = found
                            ? t('text_server_has_title', [server.label])
                            : t('text_server_lacks_title', [server.label]);
                    }).catch(error => {
                        if (!isCurrent()) return;
                        pill.classList.add('enh-media-server-pill--error');
                        state.textContent = t('text_unavailable');
                        pill.title = `${server.label}: ${getRequestErrorMessage(error)}`;
                    });
                });
                appendTitleStackItem(bar, TITLE_STACK_ORDER.mediaServerIntegration);
            }).catch(() => {});
        },
        async _check(server, ctx) {
            if (server.kind === 'plex') return this._checkPlex(server, ctx);
            return this._checkJellyfinEmby(server, ctx);
        },
        async _checkPlex(server, ctx) {
            const queries = [
                { query: ctx.imdbId, includeGuids:'1' },
                { query: ctx.title, includeGuids:'1' },
            ];
            for (const query of queries) {
                const response = await mediaServerRequest(server, '/library/search', { query, cancelOnRouteChange:true });
                if (parsePlexItems(response.responseText).some(item => mediaItemMatches(item, ctx))) return true;
            }
            return false;
        },
        async _checkJellyfinEmby(server, ctx) {
            const common = {
                Recursive:'true',
                IncludeItemTypes:'Movie,Series',
                Fields:'ProviderIds,ProductionYear',
                Limit:'20',
            };
            const queries = [
                { ...common, AnyProviderIdEquals:`imdb.${ctx.imdbId}` },
                { ...common, SearchTerm:ctx.title },
            ];
            for (const query of queries) {
                const response = await mediaServerRequest(server, '/Items', { query, cancelOnRouteChange:true });
                if (parseMediaServerItems(response.responseText).some(item => mediaItemMatches(item, ctx))) return true;
            }
            return false;
        },
        destroy() {
            removeCSS('enh-mediaServerIntegration');
            document.getElementById('enh-media-server-status')?.remove();
            pruneTitleStack();
        }
    });

    /* IE-135: both integrations above mount on the title page only, so deciding what to
       open from a 250-row chart means opening every row. This carries the same answer onto
       the rows — and nothing else, because the interesting cost here is requests, not DOM:
       one lookup per distinct id, asked only once a row has actually been scrolled to, and
       never for a row that stays below the fold. A list is also the one place where a
       stray write would be expensive, so this reports state and offers no action. */
    const ROW_INTEGRATION_BATCH = 20;
    const ROW_INTEGRATION_CONCURRENCY = 3;
    /* Enough rows to cover a fully expanded IMDb list without becoming a crawl of the
       whole site if a page ever renders more than that. */
    const ROW_INTEGRATION_ROW_LIMIT = 250;

    /* One probe per page, chosen once: asking all three would be three requests a row.
       Seerr first because it is the only one that distinguishes requested from present,
       then a media server, which answers the question people actually ask of a list. */
    function pickRowIntegrationProbe() {
        if (isSeerrConfigured()) return { kind:'seerr' };
        const servers = getConfiguredMediaServers();
        if (servers.length) return { kind:'mediaServer', server:servers[0] };
        if (isServarrConfigured('radarr')) return { kind:'servarr', servarr:'radarr' };
        if (isServarrConfigured('sonarr')) return { kind:'servarr', servarr:'sonarr' };
        return null;
    }

    const ROW_INTEGRATION_LABELS = {
        library: () => t('text_in_library'),
        monitored: () => t('text_monitored'),
        requested: () => t('text_requested'),
        add: () => t('text_not_found'),
    };

    reg({
        key: 'rowIntegrationState', name: t('feature_rowIntegrationState_name'), group: 'Features',
        _probe: null,
        _summary: null,
        _observer: null,
        _rowObserver: null,
        _raf: 0,
        // id -> one of the four states, so a repeated id costs no second request.
        _cache: null,
        // id -> the in-flight lookup, so two rows of the same title share one.
        _inflight: null,
        _queue: null,
        // id -> the badges waiting on it, since a list can carry the same title twice.
        _waiting: null,
        // A token rather than a flag: see _drain.
        _drainToken: null,
        init() {
            if (!isIMDbHost()) return;
            /* Without an observer there is no way to tell a row that was scrolled to from
               one that was never looked at, and the fallback that would make this work at
               all is a request for every row on the page. Nothing is the right answer. */
            if (typeof IntersectionObserver === 'undefined') return;
            const probe = pickRowIntegrationProbe();
            if (!probe) return;
            this._probe = probe;
            this._cache = new Map();
            this._inflight = new Map();
            this._waiting = new Map();
            this._queue = [];
            const isCurrent = createFeatureGuard(this);

            addThemedCSS(t => `
                .enh-row-integration-host { position: relative; }
                .enh-row-integration {
                    display: inline-flex; align-items: center; gap: 5px;
                    padding: 3px 7px; border-radius: 6px;
                    border: 1px solid ${t.bd1}; background: ${t.sf1}; color: ${t.tx2};
                    font: 700 10px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    box-shadow: ${t.sh1}; white-space: nowrap;
                }
                .enh-row-integration::before {
                    content: ''; width: 7px; height: 7px; border-radius: 50%;
                    background: ${t.tx3}; flex: 0 0 auto;
                }
                .enh-row-integration:focus-visible { outline: 2px solid ${t.accent}; outline-offset: 2px; }
                .enh-row-integration[data-state="library"] { color: ${t.green}; border-color: color-mix(in srgb, ${t.green} 35%, transparent); }
                .enh-row-integration[data-state="library"]::before { background: ${t.green}; }
                .enh-row-integration[data-state="monitored"],
                .enh-row-integration[data-state="requested"] { color: ${t.accent}; border-color: ${t.accentBorder}; }
                .enh-row-integration[data-state="monitored"]::before,
                .enh-row-integration[data-state="requested"]::before { background: ${t.accent}; }
                .enh-row-integration[data-state="unavailable"] { color: ${t.red}; border-color: color-mix(in srgb, ${t.red} 35%, transparent); }
                #enh-filmography-library {
                    margin: 0 0 10px; padding: 7px 11px; border-radius: 8px;
                    border: 1px solid ${t.bd1}; background: ${t.sf1}; color: ${t.tx2};
                    font: 600 12px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }
                #enh-filmography-library[hidden] { display: none; }
                .enh-row-integration[data-state="unavailable"]::before { background: ${t.red}; }
                /* A poster card has no flow to sit in, so the badge is pinned to the free
                   bottom corner — the one the Seen badge is not using. That badge moves to
                   the right where IMDb draws its own Watched control, so this moves left. */
                .enh-row-integration-host.ipc-poster-card > .enh-row-integration,
                .enh-markable-card > .enh-row-integration {
                    position: absolute; bottom: 6px; right: 6px; z-index: 19;
                }
                .enh-markable-card[data-enh-native-watched="true"] > .enh-row-integration {
                    right: auto; left: 6px;
                }
            `, 'enh-rowIntegrationState');

            /* Rows arrive as the list lazy-loads, exactly as they do for the mark
               controls, so discovery is the same document-wide observer coalesced into
               one frame rather than a scan per mutation. */
            const scan = () => {
                if (!isCurrent()) return;
                this._scan(isCurrent);
            };
            this._observer = new MutationObserver(() => {
                if (this._raf) return;
                this._raf = requestAnimationFrame(() => { this._raf = 0; scan(); });
            });
            this._rowObserver = new IntersectionObserver(entries => {
                if (!isCurrent()) return;
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    this._rowObserver?.unobserve(entry.target);
                    this._reveal(entry.target, isCurrent);
                });
            }, { rootMargin:'200px' });
            this._observer.observe(document.body, { childList:true, subtree:true });
            /* IE-146: on a person page the interesting number is not per row, it is how
               much of this filmography you already hold. The rows are answered anyway, so
               the count is a reading of answers already in hand rather than a second pass
               of requests. */
            if (getPageSurface() === 'name') this._mountFilmographySummary();
            scan();
        },
        _mountFilmographySummary() {
            if (document.getElementById('enh-filmography-library')) return;
            const summary = makeEl('div', {
                id:'enh-filmography-library',
                role:'status',
                'aria-live':'polite',
                hidden:true,
            });
            const anchor = document.querySelector('[data-testid="Filmography"]')
                || document.querySelector('main');
            if (!anchor) return;
            anchor.insertBefore(summary, anchor.firstChild);
            this._summary = summary;
        },
        /* Counted from what has actually been answered, and it says so. A filmography
           loads in pages, so a bare "3 titles" over a list that is still arriving would be
           a number that quietly means something different every few seconds. */
        _updateFilmographySummary() {
            const summary = this._summary;
            if (!summary || !summary.isConnected || !this._cache) return;
            const answered = this._cache.size;
            if (!answered) { summary.hidden = true; return; }
            const held = [...this._cache.values()].filter(state => state === 'library').length;
            summary.hidden = false;
            setTextIfChanged(summary, tCount('text_filmography_in_library', held, [answered]));
        },
        /* Marking a row costs a dataset key and an observation. The badge itself is not
           created until the row is actually seen, so a list nobody scrolls carries no
           added nodes at all. */
        _scan(isCurrent) {
            if (!isCurrent()) return;
            let marked = document.querySelectorAll('[data-enh-row-integration]').length;
            const anchors = document.querySelectorAll('a[href*="/title/tt"]');
            for (const anchor of anchors) {
                if (marked >= ROW_INTEGRATION_ROW_LIMIT) break;
                const imdbId = getLinkedTitleId(anchor.href);
                if (!imdbId) continue;
                const card = findTitleCard(anchor);
                if (!card || card.dataset.enhRowIntegration || card.closest('#enh-settings-panel')) continue;
                card.dataset.enhRowIntegration = imdbId;
                card.classList.add('enh-row-integration-host');
                marked += 1;
                this._rowObserver?.observe(card);
            }
        },
        _reveal(card, isCurrent) {
            if (!isCurrent()) return;
            const imdbId = card.dataset.enhRowIntegration;
            if (!imdbId) return;
            let badge = Array.from(card.children).find(child => child.classList?.contains('enh-row-integration'));
            if (!badge) {
                badge = makeEl('span', {
                    className:'enh-row-integration',
                    /* Focusable because a keyboard user has no hover to reveal it and no
                       pointer to rest on the title text; role and label together are what
                       makes the dot and the abbreviation mean something out loud. */
                    tabIndex: 0,
                    role:'img',
                    dataset:{ state:'checking' },
                    'aria-label': t('aria_library_status_checking'),
                }, t('label_checking'));
                card.appendChild(badge);
            }
            const cached = this._cache.get(imdbId);
            if (cached) { this._paint(badge, cached); return; }
            const waiting = this._waiting.get(imdbId);
            if (waiting) { waiting.push(badge); return; }
            this._waiting.set(imdbId, [badge]);
            this._queue.push({ imdbId, title: this._rowTitle(card) });
            this._drain(isCurrent);
        },
        _rowTitle(card) {
            const text = card.querySelector('.ipc-title__text')?.textContent
                || card.querySelector('img[alt]')?.alt
                || card.querySelector('a[href*="/title/tt"]')?.textContent
                || '';
            return text.trim().replace(/\s+/g, ' ').replace(/^\d+\.\s*/, '').slice(0, 200);
        },
        _paint(badge, state) {
            if (!badge) return;
            badge.dataset.state = state;
            const label = (ROW_INTEGRATION_LABELS[state] || ROW_INTEGRATION_LABELS.add)();
            const text = state === 'unavailable' ? t('text_unavailable') : label;
            setTextIfChanged(badge, text);
            badge.setAttribute('aria-label', t('aria_library_status_is', [text]));
        },
        _settle(imdbId, state) {
            if (state !== 'unavailable') this._cache.set(imdbId, state);
            (this._waiting.get(imdbId) || []).forEach(badge => this._paint(badge, state));
            this._waiting.delete(imdbId);
            this._updateFilmographySummary();
        },
        /* A batch rather than a burst: twenty rows can come into view in one scroll, and
           firing twenty simultaneous requests at somebody's Raspberry Pi is how a local
           service starts refusing them. Three at a time, a yield between batches. */
        async _drain(isCurrent) {
            /* A token, not a boolean. Teardown clears the flag while a suspended loop is
               still parked on an await; when that stale loop resumes and returns, its
               finally would clear the flag belonging to the loop the next init started,
               and the next reveal would run a second drain beside it. Two loops splicing
               one queue is twice the concurrency this is here to bound. Only the loop that
               owns the current token may release it. */
            if (this._drainToken) return;
            const token = {};
            this._drainToken = token;
            try {
                // Optional chaining for the same reason as in _resolve: teardown between
                // two batches drops the queue rather than emptying it.
                while (this._queue?.length) {
                    if (!isCurrent()) return;
                    const batch = this._queue.splice(0, ROW_INTEGRATION_BATCH);
                    for (let index = 0; index < batch.length; index += ROW_INTEGRATION_CONCURRENCY) {
                        if (!isCurrent()) return;
                        await Promise.all(batch.slice(index, index + ROW_INTEGRATION_CONCURRENCY)
                            .map(entry => this._resolve(entry, isCurrent)));
                    }
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            } finally {
                if (this._drainToken === token) this._drainToken = null;
            }
        },
        async _resolve(entry, isCurrent) {
            const { imdbId } = entry;
            let pending = this._inflight.get(imdbId);
            if (!pending) {
                pending = this._lookup(entry).catch(() => 'unavailable');
                this._inflight.set(imdbId, pending);
            }
            const state = await pending;
            /* A lookup outlives the route that started it, and teardown drops these maps
               rather than emptying them. Reading isCurrent first is not enough on its own:
               a feature switched off in settings while a request is open destroys without
               a route change, so the maps are checked as well. */
            if (!isCurrent() || !this._inflight) return;
            this._inflight.delete(imdbId);
            this._settle(imdbId, state);
        },
        async _lookup(entry) {
            if (this._probe.kind === 'seerr') return this._lookupSeerr(entry);
            if (this._probe.kind === 'mediaServer') return this._lookupMediaServer(entry);
            return this._lookupServarr(entry);
        },
        async _lookupSeerr(entry) {
            const response = await seerrRequest('search', {
                query:{ query: entry.imdbId },
                cancelOnRouteChange:true,
            });
            const results = parseJSONResponse(response)?.results;
            /* A row rarely says whether it is a film or a series, and the answer for the
               badge is the same either way, so both readings of one response are tried
               before giving up — which costs nothing, unlike a second search. */
            const match = selectSeerrSearchResult(results, entry.imdbId, 'movie')
                || selectSeerrSearchResult(results, entry.imdbId, 'tv');
            if (!match) return 'add';
            const state = mapSeerrMediaState(match.mediaInfo);
            if (state === 'library' || state === 'partial') return 'library';
            if (state === 'processing' || state === 'queued') return 'requested';
            return 'add';
        },
        async _lookupMediaServer(entry) {
            const server = this._probe.server;
            const ctx = { imdbId: entry.imdbId, title: entry.title };
            if (server.kind === 'plex') {
                const response = await mediaServerRequest(server, '/library/search', {
                    query:{ query: entry.imdbId, includeGuids:'1' },
                    cancelOnRouteChange:true,
                });
                return parsePlexItems(response.responseText).some(item => mediaItemMatches(item, ctx))
                    ? 'library' : 'add';
            }
            const response = await mediaServerRequest(server, '/Items', {
                query:{
                    Recursive:'true',
                    IncludeItemTypes:'Movie,Series',
                    Fields:'ProviderIds,ProductionYear',
                    Limit:'20',
                    AnyProviderIdEquals:`imdb.${entry.imdbId}`,
                },
                cancelOnRouteChange:true,
            });
            return parseMediaServerItems(response.responseText).some(item => mediaItemMatches(item, ctx))
                ? 'library' : 'add';
        },
        async _lookupServarr(entry) {
            const kind = this._probe.servarr;
            const response = await servarrRequest(kind, kind === 'radarr' ? 'movie/lookup' : 'series/lookup', {
                query:{ term: `imdb:${entry.imdbId}` },
                cancelOnRouteChange:true,
            });
            const items = parseJSONResponse(response);
            /* requireExisting, so a lookup that merely resolved the title upstream is not
               reported as something the instance is already monitoring. */
            return selectServarrLookupResult(items, { imdbId: entry.imdbId, title: entry.title }, true)
                ? 'monitored' : 'add';
        },
        destroy() {
            removeCSS('enh-rowIntegrationState');
            this._observer?.disconnect();
            this._observer = null;
            this._rowObserver?.disconnect();
            this._rowObserver = null;
            cancelAnimationFrame(this._raf);
            this._raf = 0;
            this._queue = null;
            this._cache = null;
            this._inflight = null;
            this._waiting = null;
            this._drainToken = null;
            this._probe = null;
            document.getElementById('enh-filmography-library')?.remove();
            this._summary = null;
            document.querySelectorAll('.enh-row-integration').forEach(badge => badge.remove());
            document.querySelectorAll('[data-enh-row-integration]').forEach(card => {
                card.classList.remove('enh-row-integration-host');
                delete card.dataset.enhRowIntegration;
            });
        }
    });
