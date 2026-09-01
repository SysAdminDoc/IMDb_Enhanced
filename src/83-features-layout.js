    // #########################################################################
    //
    //  LAYOUT FEATURES
    //
    // #########################################################################

    reg({
        key: 'collapsibleSections', name: t('feature_collapsibleSections_name'), group: 'Layout',
        _ids: COLLAPSIBLE_SECTION_IDS,
        init() {
            addThemedCSS(t => `
                .enh-collapse-btn{position:absolute;top:12px;right:12px;width:28px;height:28px;
                    background:${t.sf1};border:1px solid ${t.bd1};
                    border-radius:6px;cursor:pointer;color:${t.tx3};font-size:16px;z-index:10;
                    display:flex;align-items:center;justify-content:center;transition:background .12s ease,border-color .12s ease,color .12s ease,transform .12s ease;
                    line-height:1;padding:0}
                .enh-collapse-btn:hover{background:${t.sf2};border-color:${t.accentBorder};color:${t.tx0}}
                .enh-section--collapsed>*:not(.ipc-title):not(.enh-collapse-btn):not([class*="title"]):not(h3):not(header){display:none!important}
                .enh-section--collapsed{min-height:auto!important;padding-bottom:12px!important}
                ${COLLAPSIBLE_SECTION_IDS.map(id => `section[data-testid="${id}"]`).join(',')}{position:relative}
            `, 'enh-collapsible');

            const collapseState = getSectionCollapseState();
            this._ids.forEach(id => {
                const sec = document.querySelector(`section[data-testid="${id}"]`);
                if (!sec || sec.querySelector('.enh-collapse-btn')) return;
                const collapsed = Boolean(collapseState[id]);
                if (collapsed) sec.classList.add('enh-section--collapsed');
                const sectionLabel = sec.querySelector('.ipc-title__text, h2, h3')?.textContent?.trim() || id;
                /* aria-expanded says a region is open; aria-controls says which one. */
                if (!sec.id) sec.id = `enh-section-${id}`;
                const btn = makeEl('button', {
                    className: 'enh-collapse-btn', type: 'button',
                    title: collapsed ? t('text_expand_section') : t('text_collapse_section'),
                    'aria-controls': sec.id,
                    'aria-expanded': String(!collapsed),
                    'aria-label': collapsed
                        ? t('aria_expand_named_section', [sectionLabel])
                        : t('aria_collapse_named_section', [sectionLabel]),
                    textContent: collapsed ? '+' : '-',
                    onClick: () => {
                        const now = !sec.classList.contains('enh-section--collapsed');
                        if (!setSectionCollapsed(id, now)) return;
                        sec.classList.toggle('enh-section--collapsed', now);
                        btn.textContent = now ? '+' : '-';
                        btn.title = now ? t('text_expand_section') : t('text_collapse_section');
                        btn.setAttribute('aria-expanded', String(!now));
                        btn.setAttribute('aria-label', now
                            ? t('aria_expand_named_section', [sectionLabel])
                            : t('aria_collapse_named_section', [sectionLabel]));
                    }
                });
                sec.insertBefore(btn, sec.firstChild);
            });
        },
        destroy() {
            removeCSS('enh-collapsible');
            document.querySelectorAll('.enh-collapse-btn').forEach(b => {
                const owned = b.getAttribute('aria-controls');
                const section = owned && document.getElementById(owned);
                if (section && owned.startsWith('enh-section-')) section.removeAttribute('id');
                b.remove();
            });
            document.querySelectorAll('.enh-section--collapsed').forEach(s => s.classList.remove('enh-section--collapsed'));
        }
    });

    /* IMDb clamps long copy with its ipc-overflowText component — list-card summaries,
       episode synopses, biographies — and the reveal is a per-block click. Verified
       2026-08-15 that the title-page plot itself is no longer clamped, so this targets
       the component that still is, rather than a selector for prose that now fits.
       Purely a clamp release: it changes no text and leaves spoiler blur intact, since
       that is a separate filter on the same nodes. */
    reg({
        key: 'expandSummaries', name: t('feature_expandSummaries_name'), group: 'Layout',
        init() {
            addCSS(`
                /* The clamp sits on a descendant of the component, not the component
                   itself — verified on a person page where the bio hid 384px inside
                   ipc-overflowText--pageSection. Scoped to IMDb's own overflow
                   component, whose entire purpose is clamping, and never to generated
                   class names or to ipc-title, whose two-line clamp holds card layout. */
                .ipc-overflowText,
                .ipc-overflowText * {
                    -webkit-line-clamp: unset !important;
                    line-clamp: unset !important;
                    max-height: none !important;
                    overflow: visible !important;
                }
            `, 'enh-expandSummaries');
        },
        destroy() { removeCSS('enh-expandSummaries'); },
    });

    reg({
        key: 'spoilerBlur', name: t('feature_spoilerBlur_name'), group: 'Layout',
        _plot: null,
        _plotAttributes: null,
        _revealHandler: null,
        _revealKeyHandler: null,
        init() {
            addThemedCSS(t => `
                .enh-blur{cursor:pointer;user-select:none;position:relative}
                .enh-blur,.enh-blur *{color:transparent!important;text-shadow:0 0 7px ${t.tx1}}
                .enh-blur::after{content:t('text_click_or_press_enter_to_reveal');position:absolute;top:50%;left:50%;
                    transform:translate(-50%,-50%);color:${t.accent};font-weight:700;font-size:12px;text-shadow:none;
                    background:${t.sf2};border:1px solid ${t.accentBorder};box-shadow:${t.sh1};padding:4px 12px;border-radius:6px;pointer-events:none;
                    opacity:1;transition:opacity .3s ease}
                .enh-blur:focus-visible{outline:2px solid ${t.accent};outline-offset:3px}
            `, 'enh-spoilerBlur');

            const plotFull = document.querySelector('[data-testid="plot-l"],[data-testid="plot-xl"]');
            if (plotFull && plotFull.textContent.length > 200) {
                this._plot = plotFull;
                this._plotAttributes = new Map(
                    ['role', 'tabindex', 'aria-pressed', 'aria-label', 'title']
                        .map(attribute => [attribute, plotFull.getAttribute(attribute)])
                );
                plotFull.classList.add('enh-blur');
                plotFull.setAttribute('role', 'button');
                plotFull.setAttribute('tabindex', '0');
                plotFull.setAttribute('aria-pressed', 'false');
                plotFull.setAttribute('aria-label', t('aria_reveal_plot_synopsis'));
                plotFull.title = t('text_click_or_press_enter_to_reveal_plot');
                const reveal = () => {
                    if (plotFull.classList.contains('enh-revealed')) return;
                    plotFull.classList.add('enh-revealed');
                    plotFull.classList.remove('enh-blur');
                    restoreElementAttributes(plotFull, this._plotAttributes);
                    showToast(t('toast_plot_synopsis_revealed'));
                };
                this._revealHandler = event => {
                    if (event.target.closest?.('a,button,input,select,textarea')) return;
                    reveal();
                };
                this._revealKeyHandler = event => {
                    if (event.target !== plotFull || !['Enter', ' '].includes(event.key)) return;
                    event.preventDefault();
                    reveal();
                };
                plotFull.addEventListener('click', this._revealHandler);
                plotFull.addEventListener('keydown', this._revealKeyHandler);
            }
        },
        destroy() {
            removeCSS('enh-spoilerBlur');
            this._plot?.removeEventListener('click', this._revealHandler);
            this._plot?.removeEventListener('keydown', this._revealKeyHandler);
            [this._plot].filter(Boolean).forEach(element => {
                element.classList.remove('enh-blur', 'enh-revealed');
                restoreElementAttributes(element, this._plotAttributes);
            });
            this._plot = null;
            this._plotAttributes = null;
            this._revealHandler = null;
            this._revealKeyHandler = null;
        }
    });

    reg({
        key: 'quickNav', name: t('feature_quickNav_name'), group: 'Layout',
        _navItems: [
            { id:'hero-parent', label:t('label_overview'), icon:'O' },
            { id:'title-cast', label:t('label_cast'), icon:'C' },
            { id:'UserReviews', label:t('text_link_group_reviews'), icon:'R' },
            { id:'MoreLikeThis', label:t('label_similar'), icon:'S' },
            { id:'Details', label:t('label_details'), icon:'D' },
            { id:'BoxOffice', label:t('label_box_office'), icon:'$' },
            { id:'DidYouKnow', label:t('label_trivia'), icon:'?' },
        ],
        init() {
            addThemedCSS(t => `
                #enh-quicknav{position:fixed;right:18px;top:50%;transform:translateY(-50%);
                    z-index:99999;display:flex;flex-direction:column;gap:5px;padding:6px;
                    background:${t.sf0};border:1px solid ${t.bd0};border-radius:14px;box-shadow:${t.sh2}}
                .enh-qn-dot{width:70px;min-height:34px;border-radius:8px;
                    background:transparent;border:1px solid transparent;
                    color:${t.tx3};font-size:10px;font-weight:700;letter-spacing:.01em;cursor:pointer;
                    display:flex;align-items:center;justify-content:center;transition:background .15s ease,border-color .15s ease,color .15s ease,transform .15s ease;
                    text-decoration:none;position:relative;padding:0 5px;font-family:inherit}
                .enh-qn-dot:hover,.enh-qn-dot:focus-visible{background:${t.accentMuted};border-color:${t.accentBorder};
                    color:${t.accent};transform:translateX(-2px)}
                .enh-qn-dot::before{content:attr(data-label);position:absolute;right:calc(100% + 8px);
                    padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;
                    background:${t.sf1};color:${t.tx1};white-space:nowrap;border:1px solid ${t.bd1};
                    opacity:0;transform:translateX(4px);pointer-events:none;transition:opacity .15s ease,transform .15s ease}
                .enh-qn-dot:hover::before,.enh-qn-dot:focus-visible::before{opacity:1;transform:translateX(0)}
                @media(max-width:1200px){#enh-quicknav{display:none}}
            `, 'enh-quickNav');

            /* The editorial layout replaces the native hero and hides it with
               display:none, which scrollIntoView cannot act on — Overview has to aim at
               whichever surface is actually rendered. Resolved per click rather than at
               build time, because this feature can initialize before that surface has
               mounted. */
            const resolveSection = item => (item.id === 'hero-parent'
                ? document.getElementById('enh-editorial-surface')
                    || document.querySelector('section[data-testid="hero-parent"]')
                : document.querySelector(`section[data-testid="${item.id}"]`));

            const nav = makeEl('nav', { id:'enh-quicknav', 'aria-label':t('aria_on_this_page') });
            this._navItems.forEach(s => {
                if (!resolveSection(s)) return;
                nav.appendChild(makeEl('button', {
                    className:'enh-qn-dot', type:'button', dataset:{ label:s.label }, textContent:s.label,
                    title: s.label, 'aria-label': t('aria_jump_to', [s.label]),
                    /* A roving tabindex: the rail is one stop in the page's tab order and
                       arrow keys move within it, rather than every section becoming its
                       own stop between the page content and whatever follows. */
                    tabIndex: -1,
                    onKeyDown: event => {
                        const dots = Array.from(nav.querySelectorAll('.enh-qn-dot'));
                        const index = dots.indexOf(event.currentTarget);
                        const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1
                            : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1
                                : event.key === 'Home' ? -index
                                    : event.key === 'End' ? dots.length - 1 - index : 0;
                        if (!step && event.key !== 'Home' && event.key !== 'End') return;
                        event.preventDefault();
                        const next = dots[Math.min(dots.length - 1, Math.max(0, index + step))];
                        if (!next) return;
                        dots.forEach(dot => { dot.tabIndex = -1; });
                        next.tabIndex = 0;
                        next.focus();
                    },
                    onClick: event => {
                        const dots = Array.from(nav.querySelectorAll('.enh-qn-dot'));
                        dots.forEach(dot => {
                            dot.tabIndex = dot === event.currentTarget ? 0 : -1;
                            dot.removeAttribute('aria-current');
                        });
                        event.currentTarget.setAttribute('aria-current', 'true');
                        const target = resolveSection(s);
                        if (target?.getClientRects().length) {
                            target.scrollIntoView({ behavior:getEnhancementScrollBehavior(), block:'start' });
                        }
                    }
                }));
            });
            const firstDot = nav.querySelector('.enh-qn-dot');
            if (firstDot) firstDot.tabIndex = 0;
            if (nav.children.length) document.body.appendChild(nav);
        },
        destroy() { removeCSS('enh-quickNav'); document.getElementById('enh-quicknav')?.remove(); }
    });

