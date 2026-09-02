    // =========================================================================
    //  DOM UTILITIES
    // =========================================================================
    const pendingRouteWorkCancels = new Set();

    function cancelPendingRouteWork() {
        [...pendingRouteWorkCancels].forEach(cancel => cancel());
    }

    function waitForMatch(find, timeout) {
        return new Promise((resolve, reject) => {
            const el = find();
            if (el) return resolve(el);
            const root = document.body || document.documentElement;
            if (!root) return reject();
            let settled = false;
            let timer = null;
            const obs = new MutationObserver(() => {
                const next = find();
                if (next) finish(resolve, next);
            });
            const cancel = () => finish(reject, new Error('Route changed'));
            const finish = (handler, value) => {
                if (settled) return;
                settled = true;
                obs.disconnect();
                clearTimeout(timer);
                pendingRouteWorkCancels.delete(cancel);
                handler(value);
            };
            pendingRouteWorkCancels.add(cancel);
            obs.observe(root, { childList: true, subtree: true });
            timer = setTimeout(() => finish(reject, failure('timeout', t('text_timed_out_waiting_for_page_content'))), timeout);
        });
    }

    function waitFor(sel, timeout = 8000) {
        return waitForMatch(() => document.querySelector(sel), timeout);
    }

    function getFocusableElements(root) {
        if (!root) return [];
        return [...root.querySelectorAll(
            'button, [href], input, select, textarea, iframe, [tabindex]:not([tabindex="-1"])'
        )].filter(element => !element.disabled
            && element.getAttribute('aria-hidden') !== 'true'
            // Focus sentinels exist to catch focus leaving a cross-origin embed and hand
            // it back; they are not destinations, so the trap must not count them as the
            // first or last focusable in a dialog.
            && !element.classList?.contains('enh-trailer-sentinel')
            && element.offsetParent !== null);
    }

    function restoreElementAttributes(element, attributes) {
        if (!element || !attributes) return;
        attributes.forEach((value, attribute) => {
            if (value === null) element.removeAttribute(attribute);
            else element.setAttribute(attribute, value);
        });
    }

    function getEnhancementScrollBehavior() {
        return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    }

    function getTitleSurface() {
        const explicit = document.querySelector('[data-testid="hero__pageTitle"]');
        if (explicit) return explicit;
        const primary = document.querySelector('[data-testid="hero__primary-text"]');
        if (primary) return primary.closest('[data-testid="hero__pageTitle"]') || primary.closest('h1') || primary.parentElement || primary;
        const mainHeading = document.querySelector('main h1, h1');
        return mainHeading || null;
    }

    function getTitleActionAnchor() {
        const title = getTitleSurface();
        if (!title) return null;
        const heading = title.matches?.('[data-testid="hero__pageTitle"], h1')
            ? title
            : title.closest?.('[data-testid="hero__pageTitle"], h1');
        return heading?.parentElement || title.parentElement || title;
    }

    function getEditorialPosterSource(root = document) {
        const poster = root?.querySelector?.('[data-testid="hero-media__poster"] img');
        const source = poster?.currentSrc || poster?.src || poster?.getAttribute?.('src') || '';
        if (!source) return '';
        try {
            const url = new URL(source, location.href);
            return /^https?:$/.test(url.protocol) ? url.href : '';
        } catch { return ''; }
    }

    function getEditorialBackdropValue(source) {
        if (!source) return '';
        return `url("${source.replace(/["\\)]/g, character => `\\${character}`)}")`;
    }

    function getEditorialMetadata() {
        const ld = getLDData();
        const values = [];
        const rawType = Array.isArray(ld?.['@type']) ? ld['@type'].join(' ') : String(ld?.['@type'] || '');
        const type = isTVType()
            ? (rawType.includes('TVMiniSeries') ? 'TV Mini Series' : 'TV Series')
            : 'Movie';
        if (type) values.push(type);
        const year = getTitleYear();
        if (year) values.push(year);
        /* The fallback used to match a rating pattern against the page heading, which
           is the title text — so "PG: Psycho Goreman" reported a PG certificate. Read
           the element IMDb actually publishes it in, and show nothing when there is
           none rather than inferring one. */
        const publishedRating = document.querySelector(
            'section[data-testid="hero-parent"] a[href*="parentalguide"]'
        )?.textContent?.trim() || '';
        const contentRating = typeof ld?.contentRating === 'string' && ld.contentRating.trim()
            ? ld.contentRating.trim()
            : (/^(?:TV-Y7|TV-Y|TV-G|TV-PG|TV-14|TV-MA|NC-17|PG-13|G|PG|R)$/i.test(publishedRating) ? publishedRating : '');
        if (contentRating) values.push(contentRating);
        const duration = String(ld?.duration || '').match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/i);
        if (duration) {
            const hours = Number(duration[1] || 0);
            const minutes = Number(duration[2] || 0);
            const formatted = hours ? `${hours}h${minutes ? ` ${minutes}m` : ''}` : minutes ? `${minutes}m` : '';
            if (formatted) values.push(formatted);
        }
        return values;
    }

    /* A hard slice ends mid-word with no sign that anything was removed. */
    function truncateAtWord(text, limit) {
        const value = String(text || '');
        if (value.length <= limit) return value;
        const cut = value.slice(0, limit);
        const boundary = cut.lastIndexOf(' ');
        return `${(boundary > limit * 0.6 ? cut.slice(0, boundary) : cut).replace(/[\s,;:.]+$/, '')}…`;
    }

    function getEditorialSynopsis() {
        const plot = document.querySelector('[data-testid="plot-l"], [data-testid="plot-xl"], [data-testid="plot"]');
        const visible = plot?.textContent?.replace(/\s+/g, ' ').trim();
        if (visible) return truncateAtWord(visible, 900);
        try {
            const description = String(getLDData()?.description || '').replace(/\s+/g, ' ').trim();
            return truncateAtWord(description, 900);
        } catch { return ''; }
    }

    function getEditorialLinkData(selector, limit = 4) {
        const links = [];
        for (const anchor of document.querySelectorAll(selector)) {
            if (links.length >= limit) break;
            const label = anchor.textContent?.replace(/\s+/g, ' ').trim();
            if (!label) continue;
            try {
                const url = new URL(anchor.href, location.href);
                if (url.origin !== location.origin) continue;
                links.push({ label, href:url.href });
            } catch { /* ignore incomplete hydration links */ }
        }
        return links;
    }

    function ensureEditorialSurface() {
        const existing = document.getElementById('enh-editorial-surface');
        if (existing) return existing;
        const nativeHero = document.querySelector('section[data-testid="hero-parent"]');
        const imdbId = getIMDbID();
        const title = getTitleText();
        if (!nativeHero?.parentElement || !imdbId || !title) return null;

        const posterSource = getEditorialPosterSource(nativeHero);
        const surface = makeEl('section', {
            id:'enh-editorial-surface',
            className:'enh-editorial-surface',
            role:'region',
            'aria-label':t('aria_title_surface', [title]),
        });
        if (posterSource) surface.style.setProperty('--enh-editorial-backdrop', getEditorialBackdropValue(posterSource));

        const subnav = makeEl('div', { className:'enh-editorial-subnav' });
        const subnavLeft = makeEl('nav', { className:'enh-editorial-subnav__left', 'aria-label':t('aria_title_navigation') });
        if (isTVType()) {
            subnavLeft.appendChild(makeEl('a', {
                href:`/title/${imdbId}/episodes/`,
                className:'enh-editorial-subnav__link',
            }, t('text_episode_guide')));
        }
        const subnavRight = makeEl('nav', { className:'enh-editorial-subnav__right', 'aria-label':t('aria_title_topics') });
        [
            [t('text_cast_crew'), `/title/${imdbId}/fullcredits/`],
            [t('text_user_reviews'), `/title/${imdbId}/reviews/`],
            ['Trivia', `/title/${imdbId}/trivia/`],
            /* First-party route, stable, and the content-rating chip beside the title
               already comes from its link — this exposes the detail behind that chip. */
            [t('text_parents_guide'), `/title/${imdbId}/parentalguide/`],
        ].forEach(([label, href]) => subnavRight.appendChild(makeEl('a', {
            href, className:'enh-editorial-subnav__link',
        }, label)));
        subnav.append(subnavLeft, subnavRight);

        const poster = posterSource ? makeEl('div', { className:'enh-editorial-poster' }) : null;
        if (posterSource) {
            poster.appendChild(makeEl('img', {
                src:posterSource,
                alt:t('text_title_poster', [title]),
                loading:'eager',
            }));
        }

        const identity = makeEl('div', { className:'enh-editorial-identity' },
            makeEl('h1', { className:'enh-editorial-title', title }, title),
            makeEl('div', { className:'enh-editorial-meta' }, getEditorialMetadata().join('  ·  ')),
            makeEl('div', { id:'enh-editorial-action-slot' }),
            makeEl('div', { id:'enh-editorial-standalone-slot' })
        );
        const scoreRail = makeEl('div', {
            id:'enh-editorial-score-rail',
            role:'group',
            'aria-label':t('aria_title_ratings_and_availability'),
        });
        const hero = makeEl('div', {
            className:`enh-editorial-hero${poster ? '' : ' enh-editorial-hero--no-poster'}`,
        });
        if (poster) hero.appendChild(poster);
        hero.append(identity, scoreRail);

        const about = makeEl('section', {
            className:'enh-editorial-about',
            'aria-labelledby':'enh-editorial-about-title',
        }, makeEl('h2', { id:'enh-editorial-about-title' }, t('label_about_this_title')),
            makeEl('div', { id:'enh-editorial-media-slot' }));
        const synopsis = getEditorialSynopsis();
        if (synopsis) about.appendChild(makeEl('p', { className:'enh-editorial-synopsis' }, synopsis));
        const cast = getEditorialLinkData('[data-testid="title-cast-item"] a', 3);
        if (cast.length) {
            const row = makeEl('div', { className:'enh-editorial-detail-row' }, makeEl('strong', {}, t('label_stars')));
            cast.forEach((person, index) => {
                if (index) row.appendChild(makeEl('span', { className:'enh-editorial-detail-separator', 'aria-hidden':'true' }, '·'));
                row.appendChild(makeEl('a', { href:person.href }, person.label));
            });
            about.appendChild(row);
        }
        about.appendChild(makeEl('a', {
            href:`/title/${imdbId}/fullcredits/`,
            className:'enh-editorial-about-link',
        }, t('text_view_full_cast_crew')));

        const watch = makeEl('section', {
            className:'enh-editorial-watch',
            'aria-labelledby':'enh-editorial-watch-title',
        },
            makeEl('div', { className:'enh-editorial-watch__header' },
                makeEl('h2', { id:'enh-editorial-watch-title' }, t('label_reviews_research')),
                makeEl('p', {}, t('text_scores_availability_and_reference'))
            ),
            makeEl('div', { id:'enh-editorial-research-slot' })
        );
        const details = makeEl('div', { className:'enh-editorial-details' }, about, watch);
        surface.append(subnav, hero, details);
        nativeHero.parentElement.insertBefore(surface, nativeHero);
        return surface;
    }

    function refreshEditorialSurface(surface, nativeHero = document) {
        if (!surface) return;
        const title = getTitleText();
        const titleNode = surface.querySelector('.enh-editorial-title');
        if (title && titleNode && titleNode.textContent !== title) {
            titleNode.textContent = title;
            // The heading is ellipsized on desktop, so the full text has to stay readable.
            titleNode.title = title;
            surface.setAttribute('aria-label', t('aria_title_surface', [title]));
            const poster = surface.querySelector('.enh-editorial-poster img');
            if (poster) poster.alt = t('text_title_poster', [title]);
        }

        const posterSource = getEditorialPosterSource(nativeHero);
        const hero = surface.querySelector('.enh-editorial-hero');
        let poster = surface.querySelector('.enh-editorial-poster');
        if (posterSource && hero) {
            if (!poster) {
                poster = makeEl('div', { className:'enh-editorial-poster' });
                hero.insertBefore(poster, hero.firstChild);
            }
            let image = poster.querySelector('img');
            if (!image) {
                image = makeEl('img', {
                    src:posterSource,
                    alt:t('text_title_poster', [title]),
                    loading:'eager',
                });
                poster.appendChild(image);
            } else if (image.src !== posterSource) {
                image.src = posterSource;
            }
            surface.style.setProperty('--enh-editorial-backdrop', getEditorialBackdropValue(posterSource));
            hero.classList.remove('enh-editorial-hero--no-poster');
        } else if (!posterSource && hero) {
            poster?.remove();
            hero.classList.add('enh-editorial-hero--no-poster');
            surface.style.removeProperty('--enh-editorial-backdrop');
        }

        const metadataNode = surface.querySelector('.enh-editorial-meta');
        const metadata = getEditorialMetadata().join('  ·  ');
        if (metadataNode && metadata && metadataNode.textContent !== metadata) metadataNode.textContent = metadata;

        const about = surface.querySelector('.enh-editorial-about');
        const synopsis = getEditorialSynopsis();
        if (about && synopsis) {
            const synopsisNode = about.querySelector('.enh-editorial-synopsis');
            if (synopsisNode) {
                if (synopsisNode.textContent !== synopsis) synopsisNode.textContent = synopsis;
            } else {
                about.insertBefore(makeEl('p', { className:'enh-editorial-synopsis' }, synopsis), about.querySelector('.enh-editorial-about-link'));
            }
        }

        const cast = getEditorialLinkData('[data-testid="title-cast-item"] a', 3);
        if (about && cast.length) {
            const signature = cast.map(person => `${person.label}|${person.href}`).join('||');
            if (about.dataset.editorialCastSignature !== signature) {
                const row = makeEl('div', { className:'enh-editorial-detail-row' }, makeEl('strong', {}, t('label_stars')));
                cast.forEach((person, index) => {
                    if (index) row.appendChild(makeEl('span', { className:'enh-editorial-detail-separator', 'aria-hidden':'true' }, '·'));
                    row.appendChild(makeEl('a', { href:person.href }, person.label));
                });
                const current = about.querySelector('.enh-editorial-detail-row');
                if (current) current.replaceWith(row);
                else about.insertBefore(row, about.querySelector('.enh-editorial-about-link'));
                about.dataset.editorialCastSignature = signature;
            }
        }

        const subnavLeft = surface.querySelector('.enh-editorial-subnav__left');
        const episodeLink = subnavLeft?.querySelector('a[href*="/episodes/"]');
        if (isTVType() && subnavLeft && !episodeLink) {
            subnavLeft.appendChild(makeEl('a', {
                href:`/title/${getIMDbID()}/episodes/`,
                className:'enh-editorial-subnav__link',
            }, t('text_episode_guide')));
        } else if (!isTVType()) {
            episodeLink?.remove();
        }
    }

    function insertAfter(anchor, node) {
        if (!anchor?.parentElement || !node) return false;
        anchor.parentElement.insertBefore(node, anchor.nextSibling);
        return true;
    }

    function getOrCreateTitleStack() {
        const existing = document.getElementById('enh-title-stack');
        if (existing) return existing;
        const standalone = document.getElementById('enh-editorial-standalone-slot');
        if (standalone) {
            const stack = makeEl('div', { id:'enh-title-stack' });
            standalone.appendChild(stack);
            return stack;
        }
        const anchor = getTitleActionAnchor();
        if (!anchor) return null;
        const stack = makeEl('div', { id:'enh-title-stack' });
        return insertAfter(anchor, stack) ? stack : null;
    }

    function appendTitleStackItem(node, order) {
        if (!node) return false;
        const slot = node.id === 'enh-search-buttons'
            ? document.getElementById('enh-editorial-action-slot')
            : node.id === 'enh-external-links'
                ? document.getElementById('enh-editorial-research-slot')
                : null;
        const stack = slot || getOrCreateTitleStack();
        if (!stack) return false;
        node.dataset.titleStackOrder = String(order);
        const next = Array.from(stack.children).find(child =>
            Number(child.dataset.titleStackOrder || Number.MAX_SAFE_INTEGER) > order
        );
        stack.insertBefore(node, next || null);
        return true;
    }

    function pruneTitleStack() {
        const stack = document.getElementById('enh-title-stack');
        if (stack && !stack.children.length) stack.remove();
    }

    /* The action dock is shared: the editorial surface owns it and the page actions
       inside it, while the watch destinations, trailer, and link menu are contributed
       by their own features. Whoever needs it first creates it. */
    function ensureEditorialActions() {
        const existing = document.getElementById('enh-editorial-actions');
        if (existing) return existing;
        const slot = document.getElementById('enh-editorial-action-slot');
        if (!slot) return null;
        const actions = makeEl('div', { id:'enh-editorial-actions' });
        /* Position zero, so anything else placed in this slot lands after it. Without
           it the watch options section (order 30) was inserted before a dock with no
           order at all, and "More watch options" sat above the WATCH heading. */
        actions.dataset.titleStackOrder = '0';
        slot.appendChild(actions);
        return actions;
    }

    /* IMDb machine-translates page copy — fr, de, hi, it, pt-BR and es since 2026-03-24 —
       so locating one of its controls by an English label silently finds nothing for those
       users, and a loanword hides the failure: "Zur Watchlist hinzufügen" still contains
       "watchlist" while "वॉचलिस्ट में जोड़ें" does not. Resolve by test id, which IMDb does
       not translate, and keep the text scan only for surfaces it has not tagged. The
       ribbon is matched in its explicit add state so a second click cannot remove the
       title from the watchlist. */
    const NATIVE_WATCHLIST_SELECTORS = [
        '[data-testid="tm-box-wl-button"]',
        '[data-testid="poster-watchlist-ribbon-add"]',
    ];

    function isEnhancementNode(node) {
        return Boolean(node?.id?.startsWith?.('enh-') || node?.closest?.('[id^="enh-"]'));
    }

    function findNativeTitleAction(patterns, selectors = []) {
        const hero = document.querySelector('section[data-testid="hero-parent"]') || document;
        for (const selector of selectors) {
            const tagged = hero.querySelector?.(selector);
            if (tagged && !isEnhancementNode(tagged)) return tagged;
        }
        const candidates = hero.querySelectorAll('button, a, [role="button"]');
        let inspected = 0;
        for (const candidate of candidates) {
            if (++inspected > 200 || isEnhancementNode(candidate)) continue;
            const haystack = [candidate.getAttribute('aria-label'), candidate.getAttribute('title'), candidate.textContent]
                .filter(Boolean).join(' ').slice(0, 400).toLowerCase();
            if (patterns.some(pattern => haystack.includes(pattern))) return candidate;
        }
        return null;
    }

    /* These delegate to IMDb's own hero controls, which the editorial layout hides.
       They therefore belong to the feature that does the hiding — tying them to an
       optional watch-destination list once left title pages with no way to rate a
       title or add it to a watchlist. */
    function createTitlePageActions() {
        return makeEl('div', { className:'enh-title-page-actions' },
            makeEl('button', {
                type:'button',
                className:'enh-editorial-action',
                onClick: () => {
                    const rating = findNativeTitleAction(
                        ['rate'],
                        ['[data-testid="hero-rating-bar__user-rating"]']
                    );
                    const control = rating?.matches?.('button, a, [role="button"]')
                        ? rating
                        : rating?.querySelector?.('button, a, [role="button"]');
                    if (control) control.click();
                    else {
                        const aggregate = document.querySelector('[data-testid="hero-rating-bar__aggregate-rating"]');
                        aggregate?.scrollIntoView({ behavior:getEnhancementScrollBehavior(), block:'center' });
                        aggregate?.querySelector('button, a, [tabindex]:not([tabindex="-1"])')?.focus?.();
                    }
                },
            }, t('label_rate')),
            makeEl('button', {
                type:'button',
                className:'enh-editorial-action',
                onClick: () => {
                    const watchlist = findNativeTitleAction(
                        ['watchlist', 'watch list', 'add to watch'],
                        NATIVE_WATCHLIST_SELECTORS
                    );
                    if (watchlist) {
                        watchlist.click();
                        showToast(t('toast_sent_to_your_imdb_watchlist'));
                    } else showToast(t('toast_imdb_watchlist_controls_are_unavailable_on'), 3500);
                },
            }, t('text_add_to_watchlist'))
        );
    }

    function waitForTitleSurface(timeout = 20000) {
        return waitForMatch(getTitleSurface, timeout);
    }

    const pendingStyles = new Map();
    const themedStyleFactories = new Map();

    function addCSS(css, id) {
        let s = document.getElementById(id) || pendingStyles.get(id);
        if (s) { s.textContent = css; return s; }
        s = document.createElement('style');
        s.id = id; s.textContent = css;
        const attach = () => {
            const target = document.head || document.documentElement;
            if (!target) return false;
            target.appendChild(s);
            pendingStyles.delete(id);
            return true;
        };
        if (!attach()) {
            pendingStyles.set(id, s);
            const observer = new MutationObserver(() => {
                if (!pendingStyles.has(id)) { observer.disconnect(); return; }
                if (attach()) observer.disconnect();
            });
            observer.observe(document, { childList:true, subtree:true });
        }
        return s;
    }
    /* An injected widget lives inside IMDb's own cascade, and every rule here has to win
       against theirs by specificity alone — which is how the same z-index and card-primitive
       fights keep coming back. @scope gives rules written inside a widget proximity over
       rules written further away, which is the cascade's own answer to that rather than
       another !important.

       It reached Baseline in December 2025 and the Firefox build's floor is older, so the
       rules are emitted twice from one source: the plain form every engine reads, and the
       scoped form after it, which engines that do not know @scope discard by the ordinary
       CSS error-handling rules. Written once, so the two cannot come to say different
       things.

       Deliberately not wrapped in @supports at-rule(@scope): Gecko implements @scope but
       not that support query, so the wrapper hid the feature from the very engine whose
       floor made a fallback necessary. Checked in a browser, not assumed.

       `blocks` maps a selector relative to the widget root to its declarations; a key of
       '' is the root itself. */
    function scopedRules(root, blocks) {
        const entries = Object.entries(blocks);
        const plain = entries
            .map(([selector, body]) => `${selector ? `${root} ${selector}` : root} { ${body} }`)
            .join('\n');
        const scoped = entries
            .map(([selector, body]) => `${selector ? `:scope ${selector}` : ':scope'} { ${body} }`)
            .join('\n');
        return `${plain}\n@scope (${root}) {\n${scoped}\n}`;
    }

    function addThemedCSS(factory, id) {
        themedStyleFactories.set(id, factory);
        return addCSS(factory(getTheme()), id);
    }
    function refreshThemedStyles() {
        themedStyleFactories.forEach((factory, id) => {
            if (document.getElementById(id) || pendingStyles.has(id)) addCSS(factory(getTheme()), id);
        });
    }
    function removeCSS(id) {
        document.getElementById(id)?.remove();
        pendingStyles.get(id)?.remove();
        pendingStyles.delete(id);
        themedStyleFactories.delete(id);
    }

    function injectEarlyAdShell() {
        if (!isIMDbHost() || !get('removeAds')) return;
        setAdRequestBlocking(true);
        addCSS(`${AD_SHELL_SELECTOR} {
            display: none !important;
            visibility: hidden !important;
            width: 0 !important;
            min-width: 0 !important;
            max-width: 0 !important;
            height: 0 !important;
            min-height: 0 !important;
            max-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            overflow: hidden !important;
            pointer-events: none !important;
        }`, 'enh-early-ad-shell');
    }

    let adRequestRulesRegistered = false;
    function setAdRequestBlocking(enabled) {
        if (typeof GM_webRequest !== 'function' || adRequestRulesRegistered === enabled) return false;
        try {
            GM_webRequest(enabled ? AD_REQUEST_RULES : [], () => {});
            adRequestRulesRegistered = enabled;
            return true;
        } catch { return false; }
    }

    injectEarlyAdShell();

    function makeEl(tag, attrs = {}, ...children) {
        const e = document.createElement(tag);
        for (const [k, v] of Object.entries(attrs)) {
            if (v === false || v === null || v === undefined) continue;
            if (k === 'style' && typeof v === 'object') {
                Object.entries(v).forEach(([prop, val]) => {
                    if (prop.startsWith('--')) e.style.setProperty(prop, val);
                    else e.style[prop] = val;
                });
            }
            else if (k === 'className') e.className = v;
            else if (k === 'innerHTML') e.innerHTML = v;
            else if (k === 'textContent') e.textContent = v;
            else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
            else if (k === 'dataset') Object.assign(e.dataset, v);
            else e.setAttribute(k, v);
        }
        for (const c of children) {
            if (typeof c === 'string') e.appendChild(document.createTextNode(c));
            else if (c) e.appendChild(c);
        }
        return e;
    }

    /* Assigning textContent is a replace-all: the old text node is removed and a new one
       added even when the string is identical, and that queues a childList record. A
       paint driven by a MutationObserver that writes text into the subtree it observes
       therefore re-triggers itself forever — measured at ~60 repaints per second on an
       idle page. Every such write goes through this. */
    function setTextIfChanged(node, text) {
        const value = String(text ?? '');
        if (!node || node.textContent === value) return false;
        node.textContent = value;
        return true;
    }

    /* ── Top layer ──────────────────────────────────────────────────────────────
       IMDb's stacking contexts have swallowed injected surfaces more than once, and
       z-index is a losing defence against a site that keeps changing them. A popover
       renders in the top layer, which sits above every stacking context there is.

       Two capabilities, not one. Promotion needs showPopover. An anchored surface
       needs anchor positioning as well, because the top layer's containing block is
       the viewport: a dropdown that positions itself against its offset parent would
       land in the page corner. An engine missing either keeps the absolute placement
       and the z-index it has always had.

       CSS.supports is asked with the two-argument form so a parser that accepts any
       declaration string cannot answer yes to a property it has never heard of. */
    function supportsTopLayerPopovers(doc = document) {
        return typeof doc?.defaultView?.HTMLElement?.prototype?.showPopover === 'function';
    }

    function supportsAnchorPositioning(doc = document) {
        const css = doc?.defaultView?.CSS;
        if (typeof css?.supports !== 'function') return false;
        try { return css.supports('anchor-name', '--enh-anchor-probe') === true; }
        catch { return false; }
    }

    let popoverAnchorSeq = 0;

    /* One call rather than an attribute setter and a show, because a popover attribute
       without a successful showPopover() is an element the UA stylesheet hides. Either
       the element reaches the top layer or it never carries the attribute at all, and
       every `[popover]` rule in the theme is written on that guarantee.

       `manual` is deliberate: it neither light-dismisses nor answers Escape, so the
       close handlers and focus containment each surface already owns keep working
       exactly as they do without the top layer. */
    function showInTopLayer(element, anchor = null) {
        if (!element?.setAttribute) return false;
        const doc = element.ownerDocument;
        if (!supportsTopLayerPopovers(doc)) return false;
        if (anchor && !supportsAnchorPositioning(doc)) return false;
        if (element.hasAttribute('popover')) return true;
        element.setAttribute('popover', 'manual');
        if (anchor) {
            const name = `--enh-anchor-${++popoverAnchorSeq}`;
            anchor.style?.setProperty?.('anchor-name', name);
            element.style.setProperty('position-anchor', name);
        }
        try {
            element.showPopover();
            return true;
        } catch {
            element.removeAttribute('popover');
            releaseTopLayerAnchor(element, anchor);
            return false;
        }
    }

    /* The anchor is usually IMDb's own element, so the name this put on it comes back
       off. Leaving it behind would make a later popover attach to a thumbnail the
       reader has long since scrolled past. */
    function releaseTopLayerAnchor(element, anchor = null) {
        anchor?.style?.removeProperty?.('anchor-name');
        element?.style?.removeProperty?.('position-anchor');
    }

    function hideFromTopLayer(element, anchor = null) {
        if (!element?.hasAttribute?.('popover')) return false;
        try { element.hidePopover(); } catch { /* already out of the top layer */ }
        element.removeAttribute('popover');
        releaseTopLayerAnchor(element, anchor);
        return true;
    }

    function normalizeColor(color, fallback = '#6366f1') {
        const value = String(color || '').trim();
        return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
    }

    function normalizeSiteCategory(value, fallback = 'other') {
        const category = String(value || '').trim().toLowerCase();
        return SITE_CATEGORY_KEYS.has(category) ? category : fallback;
    }

    function getSiteCategoryLabel(category) {
        return SITE_CATEGORY_LABELS[normalizeSiteCategory(category)] || SITE_CATEGORY_LABELS.other;
    }

    function groupSitesByCategory(sites) {
        const groups = [];
        const byCategory = new Map();
        (Array.isArray(sites) ? sites : []).forEach(site => {
            const category = normalizeSiteCategory(site?.category);
            let group = byCategory.get(category);
            if (!group) {
                group = { category, sites:[] };
                byCategory.set(category, group);
                groups.push(group);
            }
            group.sites.push(site);
        });
        return groups;
    }

    function normalizeUrlTemplate(url) {
        const value = String(url || '').trim();
        /* The built-in application links, matched whole. Everything else, including
           anything a person types or a backup carries, still has to be HTTP(S). */
        if (BUILT_IN_APP_LINK_TEMPLATES.has(value)) return value;
        if (!value || value.length > URL_TEMPLATE_TEXT_LIMIT || !/^https?:\/\//i.test(value)) return '';
        try {
            const parsed = new URL(value);
            const safeProtocol = /^https?:$/i.test(parsed.protocol);
            if (!safeProtocol || !parsed.hostname || parsed.username || parsed.password) return '';

            const tokens = Array.from(value.matchAll(/\{\{([^{}]+)\}\}/g));
            if (tokens.some(match => !URL_TEMPLATE_KEYS.has(match[1]))) return '';
            const remainder = value.replace(/\{\{[^{}]+\}\}/g, '');
            if (/[{}]/.test(remainder)) return '';

            const authorityStart = value.indexOf('//') + 2;
            const relativeEnd = value.slice(authorityStart).search(/[\\/?#]/);
            const authorityEnd = relativeEnd < 0 ? value.length : authorityStart + relativeEnd;
            const authority = value.slice(authorityStart, authorityEnd);
            return /\{\{[^{}]+\}\}/.test(authority) ? '' : value;
        } catch { return ''; }
    }

    const WATCH_SEARCH_TEMPLATE_KEYS = new Set([
        'TITLE', 'TITLE_RAW', 'TITLE_DASH', 'TITLE_SLUG', 'IMDB_ID', 'IMDB_NUM',
    ]);
    function hasWatchSearchTemplate(url) {
        return Array.from(String(url || '').matchAll(/\{\{([^{}]+)\}\}/g))
            .some(match => WATCH_SEARCH_TEMPLATE_KEYS.has(match[1]));
    }

    function siteIdentityKey(name, url) {
        return `${String(name || '').trim().toLowerCase()}\n${String(url || '').trim()}`;
    }

    function staticSiteIdentityKey(name, url) {
        let normalized = String(url || '').trim();
        try { normalized = new URL(normalized).href; }
        catch { /* invalid rows are rejected by normalizeSite after migration */ }
        return siteIdentityKey(name, normalized);
    }

    /* v2.15 shipped fifteen URLs after checking only that they answered. The v2.19 live
       pass proved that most ignored the query, opened a 404, or searched the wrong media
       type. A saved site list is a snapshot, so changing the defaults alone would leave
       every customized installation broken. Match the exact shipped name and template,
       then preserve that row's order, color, category and visibility while replacing its
       destination. */
    const LEGACY_DEFAULT_WATCH_SITE_REPLACEMENTS = new Map([
        [['Rive', 'https://www.rivestream.app/search?q={{TITLE}}'], DEFAULT_WATCH_SITES[0]],
        [['Cinejoy', 'https://cinejoy.to/search?q={{TITLE}}'], DEFAULT_WATCH_SITES[1]],
        [['Movy', 'https://www.movy.bz/browse?q={{TITLE}}'], DEFAULT_WATCH_SITES[2]],
        [['Flixer', 'https://flixer.su/search?q={{TITLE}}'], DEFAULT_WATCH_SITES[4]],
        [['CorsFlix', 'https://watch.corsflix.net/search?q={{TITLE}}'], DEFAULT_WATCH_SITES[5]],
        [['ShuttleTV', 'https://shuttletv.su/search?q={{TITLE}}'], DEFAULT_WATCH_SITES[3]],
        [['Z-Stream', 'https://zstream.mov/search?q={{TITLE}}'], DEFAULT_WATCH_SITES[6]],
        [['Aether', 'https://aether.ist/search?q={{TITLE}}'], DEFAULT_WATCH_SITES[7]],
        [['1Shows', 'https://www.1shows.org/search?q={{TITLE}}'], DEFAULT_WATCH_SITES[8]],
        [['CinemaOS', 'https://cinemaos.live/search?q={{TITLE}}'], DEFAULT_WATCH_SITES[9]],
        [['HydraHD', 'https://hydrahd.ws/search?q={{TITLE}}'], DEFAULT_WATCH_SITES[10]],
        [['CineStream', 'https://cinestream.kje.us/search?q={{TITLE}}'], DEFAULT_WATCH_SITES[11]],
        [['Bingr', 'https://bingr.one/search?q={{TITLE}}'], DEFAULT_WATCH_SITES[12]],
        [['LookMovie2', 'https://www.lookmovie2.to/movies/search/?q={{TITLE}}'], DEFAULT_WATCH_SITES[13]],
        [['Cine.su', 'https://cine.su/en/search'], DEFAULT_WATCH_SITES[14]],
    ].map(([legacy, replacement]) => [siteIdentityKey(...legacy), replacement]));

    const LEGACY_CATALOG_HOMEPAGES = [
        ['PopcornMovies', 'https://popcornmovies.ac/'],
        ['Hexa', 'https://hexa.su/'],
        ['ARTE', 'https://www.arte.tv/en'],
        ['ShuttleTV', 'https://shuttletv.su/'],
        ['ArrowTV', 'https://arrowtv.net/'],
        ['Cinezo', 'https://www.cinezo.org/'],
        ['Movie Night', 'https://movienig.ht/'],
        ['MeowTV', 'https://meowtv.ru/'],
        ['Chillflix', 'https://chillflix.lol/'],
        ['MovieBite', 'https://moviebite.org/'],
        ['LatestMovies', 'https://latestmovies.net/'],
        ['Plex', 'https://watch.plex.tv/'],
        ['Tubi', 'https://tubitv.com/'],
        ['Fandango at Home', 'https://athome.fandango.com/content/browse/free'],
        ['hoopla', 'https://www.hoopladigital.com/'],
        ['BBC iPlayer', 'https://www.bbc.co.uk/iplayer'],
    ];
    const CATALOG_HOMEPAGE_SITE_KEYS = new Set([
        ...FMHY_WATCH_CATALOG.flatMap(group => group.sites)
            .filter(site => !hasWatchSearchTemplate(site.url))
            .map(site => [site.name, site.url]),
        ...LEGACY_CATALOG_HOMEPAGES,
    ].map(site => staticSiteIdentityKey(...site)));

    function migrateWatchSiteList(value) {
        const seen = new Set();
        return (Array.isArray(value) ? value : []).flatMap(site => {
            if (!site || typeof site !== 'object') return [site];
            const replacement = LEGACY_DEFAULT_WATCH_SITE_REPLACEMENTS.get(siteIdentityKey(site.name, site.url));
            if (!replacement && !hasWatchSearchTemplate(site.url)
                && CATALOG_HOMEPAGE_SITE_KEYS.has(staticSiteIdentityKey(site.name, site.url))) return [];
            const next = replacement
                ? { ...replacement, ...site, name:replacement.name, url:replacement.url }
                : site;
            const identity = siteIdentityKey(next.name, next.url);
            if (seen.has(identity)) return [];
            seen.add(identity);
            return [next];
        });
    }

    function normalizeTrustedUrl(value, rootDomain, fallback) {
        try {
            const parsed = new URL(String(value || ''));
            const hostname = parsed.hostname.toLowerCase();
            const trustedHost = hostname === rootDomain || hostname.endsWith(`.${rootDomain}`);
            return parsed.protocol === 'https:' && trustedHost && !parsed.username && !parsed.password
                ? parsed.href
                : fallback;
        } catch { return fallback; }
    }

    const SCORE_CORRECTION_PROVIDERS = Object.freeze({
        rottenTomatoes: { label:'Rotten Tomatoes', domain:'rottentomatoes.com', path:/^\/(?:m|tv)\/[^/]+\/?$/ },
        letterboxd: { label:'Letterboxd', domain:'letterboxd.com', path:/^\/film\/[^/]+\/?$/ },
        metacritic: { label:'Metacritic', domain:'metacritic.com', path:/^\/(?:movie|tv)\/[^/]+\/?$/ },
        justWatch: { label:'JustWatch', domain:'justwatch.com', path:/^\/[a-z]{2}\/(?:movie|tv-show)\/[^/]+\/?$/i },
        anilist: { label:'AniList', domain:'anilist.co', path:/^\/anime\/\d+(?:\/[^/]*)?\/?$/ },
    });
    const SCORE_CORRECTION_CACHE_PREFIXES = Object.freeze({
        rottenTomatoes:'rt_', letterboxd:'lb_', metacritic:'mc_', justWatch:'jw_', anilist:'anilist_',
    });
    const SCORE_CORRECTION_FEATURE_KEYS = Object.freeze({
        rottenTomatoes:'inlineRTScore',
        letterboxd:'inlineLetterboxdScore',
        metacritic:'inlineMetacriticScore',
        justWatch:'streamAvailability',
        anilist:'inlineAnimeScore',
    });

    function normalizeScoreCorrectionUrl(provider, value) {
        const config = SCORE_CORRECTION_PROVIDERS[provider];
        const raw = String(value || '').trim().slice(0, SCORE_CORRECTION_URL_LIMIT);
        if (!config || !raw) return '';
        const trusted = normalizeTrustedUrl(raw, config.domain, '');
        if (!trusted) return '';
        try {
            const parsed = new URL(trusted);
            if (!config.path.test(parsed.pathname)) return '';
            parsed.search = '';
            parsed.hash = '';
            return parsed.href;
        } catch { return ''; }
    }

    /* Redirect provenance is part of a corrected match. A response that landed on a
       search page or another host must not be parsed under the trusted URL that was
       requested, because identity override would then bless markup from the wrong page. */
    function resolveScoreCorrectionResponseUrl(provider, response, requestedUrl) {
        const finalUrl = typeof response?.finalUrl === 'string' ? response.finalUrl.trim() : '';
        return normalizeScoreCorrectionUrl(provider, finalUrl || requestedUrl);
    }

    function scoreCorrectionUrlsMatch(provider, left, right) {
        const first = normalizeScoreCorrectionUrl(provider, left);
        const second = normalizeScoreCorrectionUrl(provider, right);
        if (!first || !second) return false;
        const normalizePath = value => new URL(value).pathname.replace(/\/+$/, '').toLowerCase();
        return normalizePath(first) === normalizePath(second);
    }

    function normalizeScoreCorrectionRecord(provider, record) {
        if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
        const mode = record.mode === 'none' ? 'none' : record.mode === 'url' ? 'url' : '';
        if (!mode) return null;
        const timestamp = Number(record.ts);
        const ts = Number.isFinite(timestamp) && timestamp > 0 && timestamp <= Date.now() + 60000
            ? Math.floor(timestamp)
            : 0;
        if (mode === 'none') return { v:SCORE_CORRECTION_VERSION, mode, ts };
        const url = normalizeScoreCorrectionUrl(provider, record.url);
        if (!url) return null;
        const title = String(record.title || '').trim().replace(/\s+/g, ' ').slice(0, USER_MARK_TITLE_LIMIT);
        const year = normalizeUserMarkYear(record.year);
        return {
            v:SCORE_CORRECTION_VERSION,
            mode,
            url,
            ...(title ? { title } : {}),
            ...(year !== null ? { year } : {}),
            ts,
        };
    }

    function normalizeScoreCorrections(source) {
        if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
        const entries = [];
        let inspected = 0;
        for (const imdbId in source) {
            if (!Object.prototype.hasOwnProperty.call(source, imdbId)) continue;
            if (inspected >= SCORE_CORRECTION_SCAN_LIMIT) break;
            inspected += 1;
            const providers = source[imdbId];
            if (!/^tt\d{5,12}$/.test(imdbId) || !providers || typeof providers !== 'object' || Array.isArray(providers)) continue;
            const normalizedProviders = {};
            Object.keys(SCORE_CORRECTION_PROVIDERS).forEach(provider => {
                const normalized = normalizeScoreCorrectionRecord(provider, providers[provider]);
                if (normalized) normalizedProviders[provider] = normalized;
            });
            const values = Object.values(normalizedProviders);
            if (!values.length) continue;
            entries.push([imdbId, normalizedProviders, Math.max(...values.map(record => record.ts || 0))]);
        }
        return Object.fromEntries(entries
            .sort((a, b) => b[2] - a[2] || a[0].localeCompare(b[0]))
            .slice(0, SCORE_CORRECTION_TITLE_LIMIT)
            .map(([imdbId, providers]) => [imdbId, providers]));
    }

    function getScoreCorrections() {
        return normalizeScoreCorrections(get('scoreCorrections'));
    }

    function getScoreCorrection(imdbId, provider) {
        if (!/^tt\d{5,12}$/.test(String(imdbId || '')) || !SCORE_CORRECTION_PROVIDERS[provider]) return null;
        return getScoreCorrections()[imdbId]?.[provider] || null;
    }

    /* The MV3 bridge reports an asynchronous write failure before its deferred error has
       been consumed. The first storage mutation made by the failure handler therefore
       throws without running. Retry once so that clearing the first provider is not a
       no-op while every later provider happens to work. A manager-side failure can throw
       synchronously for its own reason too; two failed attempts still stop quietly. */
    function deleteScoreCorrectionCacheKey(storageKey) {
        if (typeof GM_deleteValue !== 'function') return false;
        for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
                GM_deleteValue(storageKey);
                return true;
            } catch { /* consume a deferred bridge failure, then retry once */ }
        }
        return false;
    }

    function clearScoreCorrectionCache(imdbId, provider) {
        const prefix = SCORE_CORRECTION_CACHE_PREFIXES[provider];
        if (!prefix || !/^tt\d{5,12}$/.test(String(imdbId || ''))) return;
        try {
            if (typeof GM_deleteValue !== 'function') return;
            if (provider === 'justWatch') {
                const regionalPrefix = 'cache_availability_justwatch_';
                const titleSuffix = `_${imdbId}`;
                const matchingKeys = new Set([`cache_${prefix}${imdbId}`]);
                GM_listValues().forEach(storageKey => {
                    if (storageKey === `cache_${prefix}${imdbId}`
                        || (storageKey.startsWith(regionalPrefix) && storageKey.endsWith(titleSuffix))) {
                        matchingKeys.add(storageKey);
                    }
                });
                matchingKeys.forEach(deleteScoreCorrectionCacheKey);
                return;
            }
            deleteScoreCorrectionCacheKey(`cache_${prefix}${imdbId}`);
        } catch { /* the durable correction still wins over any cache entry */ }
    }

    function setScoreCorrection(imdbId, provider, record) {
        if (!/^tt\d{5,12}$/.test(String(imdbId || '')) || !SCORE_CORRECTION_PROVIDERS[provider]) return false;
        const current = getScoreCorrections();
        const providers = { ...(current[imdbId] || {}) };
        if (record === null) {
            delete providers[provider];
        } else {
            const normalized = normalizeScoreCorrectionRecord(provider, { ...record, ts:Date.now() });
            if (!normalized) return false;
            providers[provider] = normalized;
        }
        if (Object.keys(providers).length) current[imdbId] = providers;
        else delete current[imdbId];
        const bounded = normalizeScoreCorrections(current);
        if (!trySaveSetting('scoreCorrections', bounded)) return false;
        clearScoreCorrectionCache(imdbId, provider);
        return true;
    }

    /* A content-script write is optimistic until chrome.storage.local settles. If a match
       correction is rejected, the bridge has already restored the previous setting by
       the time this event fires, but the feature may still be rendering or awaiting a
       request made with the rejected value. Clear every correction-backed cache for this
       title and refresh every consumer. stopFeature advances its generation, so any old
       response becomes inert before it can cache or render the phantom match. Script
       managers are deliberately excluded: their failed write already returned false
       synchronously, before setScoreCorrection cleared a cache or refreshed a feature. */
    function recoverRejectedScoreCorrections(event) {
        if (!IS_EXTENSION_BUILD
            || settingKeyFromFailure(event?.detail?.key) !== 'scoreCorrections') return;
        const imdbId = getIMDbID();
        if (!/^tt\d{5,12}$/.test(String(imdbId || ''))) return;
        Object.keys(SCORE_CORRECTION_FEATURE_KEYS)
            .forEach(provider => clearScoreCorrectionCache(imdbId, provider));
        [...new Set(Object.values(SCORE_CORRECTION_FEATURE_KEYS))].forEach(refreshFeature);
        showToast(t('toast_the_match_correction_was_not_saved'), 6000);
    }
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('imdb-enhanced:settings-save-failed', recoverRejectedScoreCorrections);
    }

    function normalizeScoreCorrectionCandidate(provider, candidate) {
        if (!candidate || typeof candidate !== 'object') return null;
        const url = normalizeScoreCorrectionUrl(provider, candidate.url);
        const title = String(candidate.title || '').trim().replace(/\s+/g, ' ').slice(0, USER_MARK_TITLE_LIMIT);
        if (!url || !title) return null;
        const year = normalizeUserMarkYear(candidate.year);
        const detail = String(candidate.detail || '').trim().replace(/\s+/g, ' ').slice(0, 80);
        return {
            title,
            url,
            ...(year !== null ? { year } : {}),
            ...(detail ? { detail } : {}),
        };
    }

    function rankScoreCorrectionCandidates(provider, candidates, title, year) {
        const wantedTitle = normalizeLookupTitle(title);
        const wantedYear = normalizeUserMarkYear(year);
        const seen = new Set();
        return (Array.isArray(candidates) ? candidates.slice(0, EXTERNAL_RESULT_SCAN_LIMIT) : [])
            .map((candidate, index) => {
                const normalized = normalizeScoreCorrectionCandidate(provider, candidate);
                if (!normalized || seen.has(normalized.url)) return null;
                seen.add(normalized.url);
                const candidateTitle = normalizeLookupTitle(normalized.title);
                const exactTitle = Boolean(wantedTitle && candidateTitle === wantedTitle);
                const relatedTitle = Boolean(wantedTitle && candidateTitle
                    && (candidateTitle.includes(wantedTitle) || wantedTitle.includes(candidateTitle)));
                const candidateYear = normalizeUserMarkYear(normalized.year);
                const yearDistance = wantedYear !== null && candidateYear !== null
                    ? Math.abs(candidateYear - wantedYear)
                    : null;
                const score = (exactTitle ? 100 : relatedTitle ? 30 : 0)
                    + (yearDistance === 0 ? 20 : yearDistance === 1 ? 10 : 0);
                return { ...normalized, _score:score, _index:index };
            })
            .filter(Boolean)
            .sort((a, b) => b._score - a._score || a._index - b._index)
            .slice(0, SCORE_CORRECTION_CANDIDATE_LIMIT)
            .map(({ _score, _index, ...candidate }) => candidate);
    }

    function normalizeSite(site, fallbackColor = '#6366f1', fallbackCategory = 'other') {
        const name = String(site?.name || '').trim().slice(0, 40);
        const url = normalizeUrlTemplate(site?.url);
        if (!name || !url) return null;
        let movieOnly = false;
        try {
            const hostname = new URL(url).hostname.toLowerCase();
            if (hostname === 'letterboxd.com' || hostname.endsWith('.letterboxd.com')) movieOnly = true;
        } catch { /* URL validity was already checked above */ }
        return {
            name,
            url,
            color: normalizeColor(site?.color, fallbackColor),
            category: normalizeSiteCategory(site?.category, fallbackCategory),
            enabled: site?.enabled !== false,
            ...(movieOnly ? { movieOnly:true } : {}),
        };
    }

    function filterSitesForMediaType(sites, tv = isTVType()) {
        return sites.filter(site => !(tv && site.movieOnly));
    }

    function normalizeLocalServiceUrl(value) {
        const raw = String(value || '').trim();
        if (!raw || raw.length > SETTING_TEXT_LIMIT) return '';
        const normalized = normalizeServarrBaseUrl(raw);
        return isLocalServiceUrl(normalized) ? normalized : '';
    }

    function normalizeCredentialValue(value) {
        const credential = String(value || '').trim();
        if (!credential || credential.length > SETTING_TEXT_LIMIT || /[\u0000-\u001f\u007f]/.test(credential)) return '';
        return credential;
    }

    function normalizeImportedSetting(key, value) {
        if (!Object.prototype.hasOwnProperty.call(DEFAULTS, key)) return null;
        const fallback = DEFAULTS[key];

        if (key === 'themeVariant') {
            return ['dark', 'oled', 'midnight', 'light', 'highContrast'].includes(value)
                ? { key, value }
                : null;
        }
        if (key === 'ratingRamp') {
            return value === normalizeRatingRamp(value) ? { key, value } : null;
        }
        if (LOCAL_SERVICE_URL_KEYS.has(key)) {
            if (typeof value !== 'string') return null;
            const raw = value.trim();
            const normalized = normalizeLocalServiceUrl(raw);
            return !raw || normalized ? { key, value:normalized } : null;
        }
        if (POSITIVE_INTEGER_SETTING_KEYS.has(key)) {
            if (value === '') return { key, value:'' };
            const number = Number(value);
            return Number.isSafeInteger(number) && number > 0
                ? { key, value:String(number) }
                : null;
        }
        if (CREDENTIAL_SETTING_KEYS.has(key)) {
            if (typeof value !== 'string') return null;
            const raw = value.trim();
            const normalized = normalizeCredentialValue(raw);
            return !raw || normalized ? { key, value:normalized } : null;
        }
        if (key === 'sectionCollapseState') {
            if (!value || Array.isArray(value) || typeof value !== 'object') return null;
            const normalized = normalizeSectionCollapseState(value);
            return Object.keys(value).length && !Object.keys(normalized).length
                ? null
                : { key, value:normalized };
        }
        if (key === 'userMarks') {
            if (!value || Array.isArray(value) || typeof value !== 'object') return null;
            return { key, value:Object.fromEntries(normalizeUserMarkEntries(value)) };
        }
        /* Written by the watchlist page and by the extension's worker rather than by
           anyone's hand, and read back through their own validators — so a restore keeps
           the shape those two agreed on rather than whatever a file contained. Declared
           so that reset clears them and an export can show they exist at all. */
        if (key === 'watchlistSnapshot') {
            if (!value || Array.isArray(value) || typeof value !== 'object') return null;
            return { key, value: Object.keys(value).length ? (normalizeWatchlistSnapshot(value) || {}) : {} };
        }
        if (key === 'watchlistAlertState') {
            if (!value || Array.isArray(value) || typeof value !== 'object') return null;
            return { key, value:{} };
        }
        if (key === 'scoreCorrections') {
            if (!value || Array.isArray(value) || typeof value !== 'object') return null;
            return { key, value:normalizeScoreCorrections(value) };
        }
        if (typeof fallback === 'boolean') {
            return typeof value === 'boolean' ? { key, value } : null;
        }
        /* Before the generic array branch, which normalizes arrays as site lists: the
           journal is not a site list, and running it through normalizeSite would drop
           every entry and then reject the whole value for the resulting length mismatch. */
        if (key === 'failureJournal') {
            if (!Array.isArray(value)) return null;
            return { key, value: value.slice(-FEATURE_FAILURE_LIMIT).map(normalizeJournalEntry).filter(Boolean) };
        }
        if (Array.isArray(fallback)) {
            if (!Array.isArray(value)) return null;
            /* Dropped before the completeness check below, not after, or a backup taken
               before v2.15 would fail whole-list validation instead of importing. The
               schema-3 migration removes these rows from storage; without this, restoring
               an older backup would put the dead destination back permanently. */
            const current = key === 'watchSites' ? migrateWatchSiteList(value) : value;
            const limited = current.slice(0, SITE_LIST_LIMIT).filter(site => !isRetiredCinebyUrl(site?.url));
            const fallbackCategory = key === 'watchSites' ? 'watch' : 'other';
            const normalized = limited.map(site => normalizeSite(site, '#6366f1', fallbackCategory)).filter(Boolean);
            if (normalized.length !== limited.length) return null;
            return {
                key,
                value:normalized,
            };
        }
        if (typeof fallback === 'string') {
            return typeof value === 'string' ? { key, value:value.slice(0, SETTING_TEXT_LIMIT) } : null;
        }
        return null;
    }

    function prepareSettingsImport(data) {
        if (!data || Array.isArray(data) || typeof data !== 'object') {
            throw failure('parse', t('error_settings_not_an_object'));
        }
        /* A backup written by a newer version can contain shapes this build would
           quietly coerce to defaults. Refusing is recoverable; silently rewriting the
           user's settings is not. */
        const payloadVersion = Number(data[SETTINGS_SCHEMA_KEY]);
        if (Number.isFinite(payloadVersion) && payloadVersion > SETTINGS_SCHEMA_VERSION) {
            throw new Error(`This backup was written by a newer version of IMDb Enhanced (settings schema ${payloadVersion}). Update first, then import.`);
        }
        const entries = [];
        let ignored = 0;
        Object.entries(data).forEach(([key, value]) => {
            if (EXPORT_METADATA_KEYS.has(key)) return;
            /* An empty credential in a backup means "this backup does not carry one", not
               "clear the one you have". Writing it through destroyed working keys on
               restore, and the backup most likely to contain empty ones is an encrypted
               export taken where the values could not be read. Clearing a key is done in
               the field that owns it, never as a side effect of restoring. */
            if (CREDENTIAL_SETTING_KEYS.has(key) && !normalizeCredentialValue(value)) return;
            const normalized = normalizeImportedSetting(key, value);
            if (normalized) entries.push(normalized);
            else ignored++;
        });
        if (!entries.length) throw failure('unknown', t('error_settings_none_recognized'));
        return { entries, ignored };
    }

    function cloneSettingValue(value) {
        if (Array.isArray(value)) return value.map(cloneSettingValue);
        if (value && typeof value === 'object') {
            return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, cloneSettingValue(nested)]));
        }
        return value;
    }

    function getDefaultSettingsEntries() {
        return Object.entries(DEFAULTS).map(([key, value]) => ({ key, value:cloneSettingValue(value) }));
    }

    /* A backup used to carry every Radarr, Sonarr, Overseerr, Plex, Jellyfin and Emby
       secret in plain text, and the ordinary way to take one is a clipboard copy — a
       surface any page can read and every clipboard manager keeps. The normal export
       now omits them and says which it omitted; the encrypted export below is the only
       way they leave the browser. */
    function getExportSettings({ includeCredentials = false } = {}) {
        /* A backup that claims to carry credentials and carries empty strings is worse
           than no backup: restoring it used to wipe the real keys. On an IMDb page the
           bridge keeps credential values out of this world entirely, so this cannot be
           honoured here and says so rather than producing one. The extension's own page
           can read them, which is why that is where the encrypted export belongs. */
        if (includeCredentials && !canReadCredentials()) {
            throw new Error('CREDENTIALS_UNREADABLE');
        }
        const data = {};
        const redacted = [];
        Object.keys(DEFAULTS).forEach(key => {
            if (!includeCredentials && CREDENTIAL_SETTING_KEYS.has(key)) {
                // Only name a key that actually holds something; listing every empty
                // credential field would imply the user had configured them. Asked of
                // readCredential, because get() cannot see one from a content script.
                if (readCredential(key).configured) redacted.push(key);
                return;
            }
            let current = get(key);
            if (key === 'userMarks') current = getUserMarks();
            else if (key === 'sectionCollapseState') current = getSectionCollapseState();
            else if (key === 'watchSites') current = getSiteList(key, DEFAULT_WATCH_SITES);
            else if (key === 'externalSites') current = getSiteList(key, DEFAULT_EXTERNAL_SITES);
            const normalized = normalizeImportedSetting(key, current);
            data[key] = cloneSettingValue(normalized ? normalized.value : DEFAULTS[key]);
        });
        data[SETTINGS_SCHEMA_KEY] = SETTINGS_SCHEMA_VERSION;
        if (!includeCredentials) data[EXPORT_REDACTED_KEY] = redacted;
        return data;
    }
