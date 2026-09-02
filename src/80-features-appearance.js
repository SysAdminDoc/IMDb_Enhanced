    const EDITORIAL_NATIVE_SCORE_SELECTOR = [
        '[data-testid="hero-rating-bar__aggregate-rating"]',
        '[data-testid="hero-rating-bar__popularity"]',
    ].join(', ');

reg({
        key: 'modernUI', name: t('feature_modernUI_name'), group: 'Appearance',
        init() {
            injectEarlyThemeShell();
            applyThemeStyles({ refreshDependent: false });
            const isCurrent = createFeatureGuard(this);
            waitForTitleSurface().then(() => {
                if (!isCurrent()) return;
                const hero = document.querySelector('section[data-testid="hero-parent"]');
                const poster = hero?.querySelector('[data-testid="hero-media__poster"] img');
                const source = poster?.currentSrc || poster?.src || '';
                if (!hero || !source) return;
                try {
                    const url = new URL(source, location.href);
                    if (!/^https?:$/.test(url.protocol)) return;
                    const escaped = url.href.replace(/["\\)]/g, character => `\\${character}`);
                    hero.style.setProperty('--enh-hero-backdrop', `url("${escaped}")`);
                    this._heroBackdrop = hero;
                } catch { /* an unavailable poster should not block the title surface */ }
            }).catch(() => {});
        },
        destroy() {
            this._heroBackdrop?.style.removeProperty('--enh-hero-backdrop');
            this._heroBackdrop = null;
            removeCSS('enh-modernUI');
            removeCSS('enh-early-shell');
            if (document.documentElement) delete document.documentElement.dataset.imdbEnhanced;
        }
    });

    reg({
        key: 'editorialTitleSurface', name: t('feature_editorialTitleSurface_name'), group: 'Appearance',
        _observer: null,
        _surface: null,
        _nativeHero: null,
        _scoreRestoreHost: null,
        _adoptedNodes: [],
        _syncQueued: false,
        init() {
            if (!isIMDbHost() || getPageSurface() !== 'title') return;
            const isCurrent = createFeatureGuard(this);
            this._adoptedNodes = [];
            const mount = () => {
                if (!isCurrent()) return false;
                const surface = ensureEditorialSurface();
                const rail = surface?.querySelector('#enh-editorial-score-rail');
                if (!surface || !rail) return false;
                this._surface = surface;
                this._nativeHero = document.querySelector('section[data-testid="hero-parent"]');
                this._scoreRestoreHost = document.querySelector(EDITORIAL_NATIVE_SCORE_SELECTOR)?.parentElement || null;
                this._scoreRestoreHost?.classList.add('enh-native-score-rail');
                const sync = () => {
                    if (!isCurrent() || !rail.isConnected) return;
                    const currentNativeHero = document.querySelector('section[data-testid="hero-parent"]');
                    if (currentNativeHero && currentNativeHero !== this._nativeHero) {
                        this._nativeHero?.classList.remove('enh-editorial-native-hidden');
                        this._nativeHero = currentNativeHero;
                    }
                    this._nativeHero?.classList.add('enh-editorial-native-hidden');
                    refreshEditorialSurface(surface, this._nativeHero || document);
                    /* This surface hides IMDb's hero, so it owns the replacements for
                       the controls it hid. They must not depend on any other feature. */
                    const dock = ensureEditorialActions();
                    if (dock && !dock.querySelector('.enh-title-page-actions')) {
                        dock.appendChild(createTitlePageActions());
                    }
                    const standalone = surface.querySelector('#enh-editorial-standalone-slot');
                    const legacyStack = document.getElementById('enh-title-stack');
                    if (standalone && legacyStack && !surface.contains(legacyStack)) {
                        Array.from(legacyStack.children).forEach(node => {
                            if (node.id === 'enh-search-buttons' || node.id === 'enh-external-links') {
                                const order = Number(node.dataset.titleStackOrder);
                                const fallback = node.id === 'enh-search-buttons'
                                    ? TITLE_STACK_ORDER.searchButtons
                                    : TITLE_STACK_ORDER.externalLinks;
                                appendTitleStackItem(node, Number.isFinite(order) ? order : fallback);
                            } else standalone.appendChild(node);
                        });
                        legacyStack.remove();
                    }
                    ['enh-search-buttons', 'enh-external-links'].forEach(id => {
                        const node = document.getElementById(id);
                        if (!node || surface.contains(node)) return;
                        const order = Number(node.dataset.titleStackOrder);
                        const fallback = id === 'enh-search-buttons'
                            ? TITLE_STACK_ORDER.searchButtons
                            : TITLE_STACK_ORDER.externalLinks;
                        appendTitleStackItem(node, Number.isFinite(order) ? order : fallback);
                    });
                    pruneTitleStack();
                    const adopt = (node, host) => {
                        if (!node || !host) return;
                        const parent = node.parentElement;
                        if (host === rail && node.matches(EDITORIAL_NATIVE_SCORE_SELECTOR)
                            && parent?.isConnected && !rail.contains(node)) {
                            this._scoreRestoreHost = parent;
                            parent.classList.add('enh-native-score-rail');
                        }
                        if (host.contains(node)) return;
                        if (!this._adoptedNodes.some(state => state.node === node)) {
                            this._adoptedNodes.push({ node, parent:node.parentElement });
                        }
                        host.appendChild(node);
                    };
                    const replacementNativeScores = Array.from(
                        this._nativeHero?.querySelectorAll(EDITORIAL_NATIVE_SCORE_SELECTOR) || []);
                    replacementNativeScores.forEach(node => {
                        const testId = node.getAttribute('data-testid');
                        rail.querySelectorAll(EDITORIAL_NATIVE_SCORE_SELECTOR).forEach(staleNode => {
                            if (staleNode === node || staleNode.getAttribute('data-testid') !== testId) return;
                            this._adoptedNodes = this._adoptedNodes
                                .filter(state => state.node !== staleNode);
                            staleNode.remove();
                        });
                        adopt(node, rail);
                    });
                    /* IMDb's own hero player is core media, not chrome — hiding the
                       native hero would take it off the page entirely, and the Trailer
                       popover is a separate opt-in that fetches a guessed match from
                       YouTube rather than playing this clip. */
                    adopt(
                        document.querySelector('[data-testid="inline-video-playback-container"]'),
                        surface.querySelector('#enh-editorial-media-slot'));
                    document.querySelectorAll('.enh-score-widget').forEach(widget => adopt(widget, rail));
                };
                this._sync = sync;
                sync();
                this._observer = new MutationObserver(() => {
                    if (this._syncQueued) return;
                    this._syncQueued = true;
                    queueMicrotask(() => {
                        this._syncQueued = false;
                        sync();
                    });
                });
                this._observer.observe(document.body, { childList:true, subtree:true });
                return true;
            };
            if (!mount()) waitForTitleSurface().then(mount).catch(() => {});
        },
        destroy() {
            this._observer?.disconnect();
            this._observer = null;
            this._sync = null;
            this._syncQueued = false;
            this._nativeHero?.classList.remove('enh-editorial-native-hidden');
            document.querySelector('section[data-testid="hero-parent"]')
                ?.classList.remove('enh-editorial-native-hidden');
            this._adoptedNodes.forEach(({ node, parent }) => {
                if (node?.isConnected && parent?.isConnected && !parent.contains(node)) parent.appendChild(node);
            });
            /* Score features can initialize after this surface and append directly to
               its rail. Those nodes have no adoption record, so return them to the
               native rating host before the surface is removed. */
            const currentScoreHost = Array.from(document.querySelectorAll(EDITORIAL_NATIVE_SCORE_SELECTOR))
                .map(node => node.parentElement)
                .find(host => host?.isConnected && !this._surface?.contains(host));
            const scoreRestoreHost = currentScoreHost
                || (this._scoreRestoreHost?.isConnected ? this._scoreRestoreHost : null);
            if (scoreRestoreHost) {
                scoreRestoreHost.classList.add('enh-native-score-rail');
                this._surface?.querySelectorAll('.enh-score-widget').forEach(widget => {
                    scoreRestoreHost.appendChild(widget);
                });
            }

            /* The native hero returns with this surface, so the stand-ins for its own
               controls go with it; everything else in the dock belongs to other
               features and is re-homed below. */
            this._surface?.querySelector('.enh-title-page-actions')?.remove();

            const preserved = [];
            const addChildren = parent => Array.from(parent?.children || []).forEach(node => {
                if (node.id === 'enh-title-stack') Array.from(node.children).forEach(child => preserved.push(child));
                else preserved.push(node);
            });
            addChildren(this._surface?.querySelector('#enh-editorial-action-slot'));
            addChildren(this._surface?.querySelector('#enh-editorial-research-slot'));
            addChildren(this._surface?.querySelector('#enh-editorial-standalone-slot'));
            this._surface?.remove();
            const seen = new Set();
            preserved.forEach(node => {
                if (!node || seen.has(node)) return;
                seen.add(node);
                const order = Number(node.dataset.titleStackOrder);
                appendTitleStackItem(node, Number.isFinite(order) ? order : TITLE_STACK_ORDER.externalLinks);
            });
            this._surface = null;
            this._nativeHero = null;
            this._scoreRestoreHost = null;
            this._adoptedNodes = [];
            pruneTitleStack();
        }
    });

    reg({
        key: 'compactHeader', name: t('feature_compactHeader_name'), group: 'Appearance',
        init() {
            addThemedCSS(t => `
                #imdbHeader {
                    position: sticky !important;
                    top: 0 !important;
                    z-index: 2147482000 !important;
                    box-sizing: border-box !important;
                    width: 100% !important;
                    padding: 4px 0 !important;
                    background: ${t.hdr} !important;
                    border-bottom: 1px solid ${t.hdrBorder} !important;
                    transition: background .2s ease !important;
                }
                .navbar__inner { min-height: 46px !important; }
                #imdbHeader .imdb-header__logo-link svg { height: 24px !important; width: auto !important; }
            `, 'enh-compactHdr');
        },
        destroy() { removeCSS('enh-compactHdr'); }
    });

    reg({
        key: 'enhancedRatingDisplay', name: t('feature_enhancedRatingDisplay_name'), group: 'Appearance',
        init() {
            addThemedCSS(t => `
                [data-testid="hero-rating-bar__aggregate-rating"] {
                    background: transparent !important;
                    border: 0 !important;
                    border-radius: 0 !important;
                    padding: 12px 20px !important;
                    box-shadow: none !important;
                    min-width: 150px !important;
                    border-left: 1px solid ${t.bd0} !important;
                    transition: color .2s ease !important;
                }
                [data-testid="hero-rating-bar__aggregate-rating"]:hover {
                    background: ${t.sf0} !important;
                }
                [data-testid="hero-rating-bar__aggregate-rating__score"] span:first-child {
                    font-size: 1.6em !important; font-weight: 800 !important;
                }
                [data-testid="hero-rating-bar__popularity"] {
                    background: transparent !important;
                    border: 0 !important;
                    border-radius: 0 !important;
                    padding: 12px 20px !important;
                    min-width: 150px !important;
                    border-left: 1px solid ${t.bd0} !important;
                }
            `, 'enh-enhRating');
        },
        destroy() { removeCSS('enh-enhRating'); }
    });

    reg({ key: 'widerLayout', name: t('feature_widerLayout_name'), group: 'Appearance',
        css: `
/* ── Full-width containers ── */
.ipc-page-content-container--center { box-sizing: border-box !important; max-width: 100% !important; padding: 0 32px !important; }
.ipc-page-section--base.celwidget { width: 100% !important; max-width: 100% !important; }
.ipc-page-grid { box-sizing: border-box !important; max-width: 100% !important; width: 100% !important; padding: 0 32px !important; }
.ipc-page-content-container--full { max-width: 100% !important; width: 100% !important; }
.ipc-page-wrapper { max-width: 100% !important; }
[data-testid="atf-wrapper-bg"] { max-width: 100% !important; }

/* ── Poster card compaction ── */
div.ipc-rating-star-group.ipc-poster-card__rating-star-group {
    padding: 0 !important; margin: 0 !important;
}
a.ipc-poster-card__title.ipc-poster-card__title--clamp-2.ipc-poster-card__title--clickable {
    padding: 0 !important; margin: 0 !important;
}

/* ── Grid & shoveler spacing ── */
div.ipc-sub-grid.ipc-sub-grid--page-span-2.ipc-sub-grid--nowrap.ipc-shoveler__grid {
    padding: 0 !important; margin: 0 !important;
}

/* ── Section vertical compression ── */
section.ipc-page-section.ipc-page-section--base.celwidget {
    padding: 0 !important; margin: 0 !important;
}
div.ipc-html-content-inner-div { padding: 0 !important; margin: 0 !important; }
li.ipc-metadata-list__item.ipc-metadata-list__item--align-end.ipc-metadata-list-item--link {
    padding: 0 !important; margin: 0 !important;
}
h3.ipc-title__text.ipc-title__text--reduced { padding: 0 !important; margin: 0 !important; }
.ipc-title__wrapper { padding: 0 !important; margin: 0 !important; }

/* ── Accordion (filmography) ── */
.ipc-accordion__item__content_inner { padding: 4px 0 !important; }
.ipc-accordion__item__header { padding: 8px 0 !important; min-height: auto !important; }

/* ── Review / quote specific ── */
[data-testid="review-overflow"] { margin: 4px 0 !important; }
[data-testid="sub-section-Quotes"] .ipc-list-card,
section[id*="quote" i] .ipc-list-card { padding: 4px 0 !important; margin: 2px 0 !important; }
.ipc-chip-list__scroller { padding: 4px 0 !important; }

/* ── Sidebar compression ── */
[data-testid="sidebar-sticky-block"] { gap: 0 !important; }
.ipc-page-section--none { margin: 0 !important; padding: 4px 0 !important; }

/* ── Name page ── */
[data-testid="bio-content"] { padding: 4px 0 !important; }
[data-testid="PersonalDetails"] { padding: 4px 0 !important; }
[data-testid="Filmography"] { padding: 4px 0 !important; }

@media (max-width: 900px) {
    .ipc-page-content-container--center,
    .ipc-page-grid {
        padding-left: 16px !important;
        padding-right: 16px !important;
    }
}
        `,
        init() { addCSS(this.css, 'enh-wider'); }, destroy() { removeCSS('enh-wider'); } });

    /* IE-145: IMDb draws list, cast and filmography thumbnails at around 40 to 70 pixels
       wide, which is small enough that two extensions exist for nothing but making them
       bigger. The variant helper the zoom feature uses already knows how to ask IMDb's
       image host for a larger rendering of the same picture, so this is a request for a
       bigger file and a box to match, not an upscale of a small one. */
    const LARGE_THUMB_SELECTOR = [
        '.ipc-poster-card img',
        '.ipc-metadata-list-summary-item img',
        '[data-testid="title-cast-item__avatar"] img',
        '[data-testid="shoveler-item-poster"] img',
        '.ipc-sub-grid-item img',
    ].join(', ');
    const LARGE_THUMB_SCALE = 2;
    /* The hero poster is already the big one on the page, and the settings panel draws
       images of its own. Neither is a card thumbnail. */
    const LARGE_THUMB_EXCLUDE = '[data-testid="hero-media__poster"], #enh-settings-overlay, .enh-zoom';
    const LARGE_THUMB_MIN = 24;
    const LARGE_THUMB_MAX = 320;

    /* The measurement, kept separate so it can be tested without a layout engine: what
       IMDb says the image is, preferring its own attributes over a measured box because
       the attributes are there before the picture is. */
    function readThumbnailWidth(img) {
        const declared = Number(img?.getAttribute?.('width')) || 0;
        if (declared >= LARGE_THUMB_MIN) return Math.min(declared, LARGE_THUMB_MAX);
        const measured = Number(img?.getBoundingClientRect?.().width) || 0;
        if (measured >= LARGE_THUMB_MIN) return Math.min(Math.round(measured), LARGE_THUMB_MAX);
        const natural = Number(img?.naturalWidth) || 0;
        if (natural >= LARGE_THUMB_MIN) return Math.min(natural, LARGE_THUMB_MAX);
        return 0;
    }

    reg({
        key: 'largerThumbnails', name: t('feature_largerThumbnails_name'), group: 'Appearance',
        _observer: null,
        _raf: 0,
        init() {
            if (!isIMDbHost()) return;
            const isCurrent = createFeatureGuard(this);
            /* The box is sized inline per image rather than by a stylesheet rule, because
               each card is a different width and a single rule would have to guess. The
               aspect ratio comes from the element so nothing reflows when the larger file
               lands: the space is already the right shape. */
            addCSS(`
                img[data-enh-big-thumb] { width: var(--enh-thumb-width) !important; height: auto !important; max-width: none !important; }
            `, 'enh-largerThumbnails');

            const scan = () => {
                if (!isCurrent()) return;
                document.querySelectorAll(LARGE_THUMB_SELECTOR).forEach(img => this._enlarge(img));
            };
            this._observer = new MutationObserver(() => {
                if (this._raf) return;
                this._raf = requestAnimationFrame(() => { this._raf = 0; scan(); });
            });
            this._observer.observe(document.body, { childList:true, subtree:true });
            scan();
        },
        _enlarge(img) {
            if (!img || img.dataset.enhBigThumb || img.closest(LARGE_THUMB_EXCLUDE)) return;
            const source = img.currentSrc || img.getAttribute('src') || '';
            if (!source) return;
            const width = readThumbnailWidth(img);
            if (!width) return;
            /* Height, because that is what the variant helper asks IMDb for. A poster is
               taller than it is wide and an avatar is square, so the element's own ratio
               decides rather than a constant. */
            const height = Number(img.getAttribute('height')) || Math.round(width * 1.5);
            const bigger = boundedImageVariant(source, height * LARGE_THUMB_SCALE);
            if (!bigger) return;
            img.dataset.enhBigThumb = '1';
            img.dataset.enhThumbSrc = source;
            /* srcset wins over src, so leaving it would mean the browser keeps choosing
               the small file and the whole rewrite does nothing visible. */
            if (img.hasAttribute('srcset')) {
                img.dataset.enhThumbSrcset = img.getAttribute('srcset');
                img.removeAttribute('srcset');
            }
            if (img.hasAttribute('sizes')) {
                img.dataset.enhThumbSizes = img.getAttribute('sizes');
                img.removeAttribute('sizes');
            }
            img.style.setProperty('--enh-thumb-width', `${width * LARGE_THUMB_SCALE}px`);
            img.setAttribute('src', bigger);
        },
        destroy() {
            removeCSS('enh-largerThumbnails');
            this._observer?.disconnect();
            this._observer = null;
            cancelAnimationFrame(this._raf);
            this._raf = 0;
            document.querySelectorAll('img[data-enh-big-thumb]').forEach(img => {
                if (img.dataset.enhThumbSrc) img.setAttribute('src', img.dataset.enhThumbSrc);
                if (img.dataset.enhThumbSrcset) img.setAttribute('srcset', img.dataset.enhThumbSrcset);
                if (img.dataset.enhThumbSizes) img.setAttribute('sizes', img.dataset.enhThumbSizes);
                img.style.removeProperty('--enh-thumb-width');
                delete img.dataset.enhBigThumb;
                delete img.dataset.enhThumbSrc;
                delete img.dataset.enhThumbSrcset;
                delete img.dataset.enhThumbSizes;
            });
        }
    });
