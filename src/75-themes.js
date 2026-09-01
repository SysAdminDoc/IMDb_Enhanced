    // ===================== DESIGN SYSTEM =====================
    // 4px grid, 3-tier elevation, semantic color roles, consistent radius scale
    const THEMES = {
        dark: {
            scheme: 'dark',
            // Surfaces (elevation layers)
            bg:     '#101014',  // base canvas
            sf0:    '#18181c',  // card level 0
            sf1:    '#1e1e24',  // card level 1 (hover, nested)
            sf2:    '#26262e',  // card level 2 (active, popovers)
            // Borders
            bd0:    'rgba(255,255,255,0.05)',  // subtle dividers
            bd1:    'rgba(255,255,255,0.08)',  // card borders
            bd2:    'rgba(255,255,255,0.12)',  // hover borders
            // Shadows
            sh1:    '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
            sh2:    '0 4px 16px rgba(0,0,0,0.35), 0 1px 4px rgba(0,0,0,0.25)',
            sh3:    '0 12px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
            // Text hierarchy
            tx0:    '#f0f0f2',  // primary headings
            tx1:    '#c8c8d0',  // body text
            tx2:    '#aaaab8',  // secondary / muted
            tx3:    '#9090a2',  // tertiary text
            // Accent palette
            accent: '#f5c518',  // IMDb gold
            accentMuted: 'rgba(245,197,24,0.12)',
            accentBorder: 'rgba(245,197,24,0.20)',
            blue:   '#4da8f0',  // links, info
            blueHi: '#7dc4ff',  // link hover
            blueMuted: 'rgba(77,168,240,0.10)',
            red:    '#e84057',  // ratings, alerts
            redMuted: 'rgba(232,64,87,0.10)',
            green:  '#3dd68c',  // positive
            heroScrim: 'rgba(16,16,20,0.86)',
            // Header / chrome
            hdr:    'rgba(16,16,20,0.82)',
            hdrBorder: 'rgba(255,255,255,0.04)',
            // Scrollbar
            sT:     '#2a2a34', sH: '#3e3e4a',
            // Quote accent
            quoteBar: '#4da8f0',
        },
        oled: {
            scheme: 'dark',
            bg:     '#000000',
            sf0:    '#0c0c0e',
            sf1:    '#141418',
            sf2:    '#1c1c22',
            bd0:    'rgba(255,255,255,0.04)',
            bd1:    'rgba(255,255,255,0.06)',
            bd2:    'rgba(255,255,255,0.10)',
            sh1:    '0 1px 3px rgba(0,0,0,0.6), 0 1px 2px rgba(0,0,0,0.4)',
            sh2:    '0 4px 16px rgba(0,0,0,0.6), 0 1px 4px rgba(0,0,0,0.4)',
            sh3:    '0 12px 40px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.5)',
            tx0:    '#e4e4e8',
            tx1:    '#b0b0bc',
            tx2:    '#a0a0b0',
            tx3:    '#8b8b9c',
            accent: '#f5c518',
            accentMuted: 'rgba(245,197,24,0.10)',
            accentBorder: 'rgba(245,197,24,0.18)',
            blue:   '#3d98e0',
            blueHi: '#6cb8ff',
            blueMuted: 'rgba(61,152,224,0.08)',
            red:    '#d63850',
            redMuted: 'rgba(214,56,80,0.08)',
            green:  '#30c47c',
            heroScrim: 'rgba(0,0,0,0.90)',
            hdr:    'rgba(0,0,0,0.92)',
            hdrBorder: 'rgba(255,255,255,0.03)',
            sT:     '#1a1a22', sH: '#2a2a34',
            quoteBar: '#3d98e0',
        },
        midnight: {
            scheme: 'dark',
            bg:     '#0a0e1c',
            sf0:    '#10152a',
            sf1:    '#161c34',
            sf2:    '#1e2644',
            bd0:    'rgba(120,160,255,0.05)',
            bd1:    'rgba(120,160,255,0.08)',
            bd2:    'rgba(120,160,255,0.14)',
            sh1:    '0 1px 3px rgba(0,0,20,0.4), 0 1px 2px rgba(0,0,20,0.3)',
            sh2:    '0 4px 16px rgba(0,0,20,0.45), 0 1px 4px rgba(0,0,20,0.3)',
            sh3:    '0 12px 40px rgba(0,0,20,0.6), 0 2px 8px rgba(0,0,20,0.35)',
            tx0:    '#e4e8f4',
            tx1:    '#b4bcda',
            tx2:    '#a0acce',
            tx3:    '#939fc5',
            accent: '#f5c518',
            accentMuted: 'rgba(245,197,24,0.10)',
            accentBorder: 'rgba(245,197,24,0.20)',
            blue:   '#5eaaff',
            blueHi: '#8ec8ff',
            blueMuted: 'rgba(94,170,255,0.10)',
            red:    '#f06070',
            redMuted: 'rgba(240,96,112,0.10)',
            green:  '#48e098',
            heroScrim: 'rgba(10,14,28,0.88)',
            hdr:    'rgba(10,14,28,0.88)',
            hdrBorder: 'rgba(120,160,255,0.05)',
            sT:     '#1c2444', sH: '#283460',
            quoteBar: '#5eaaff',
        },
        light: {
            scheme: 'light',
            bg:     '#f6f7f9',
            sf0:    '#ffffff',
            sf1:    '#eef1f5',
            sf2:    '#e2e7ef',
            bd0:    'rgba(15,23,42,0.08)',
            bd1:    'rgba(15,23,42,0.12)',
            bd2:    'rgba(15,23,42,0.18)',
            sh1:    '0 1px 3px rgba(15,23,42,0.10), 0 1px 2px rgba(15,23,42,0.06)',
            sh2:    '0 8px 22px rgba(15,23,42,0.12), 0 2px 8px rgba(15,23,42,0.08)',
            sh3:    '0 16px 46px rgba(15,23,42,0.16), 0 4px 14px rgba(15,23,42,0.10)',
            tx0:    '#101827',
            tx1:    '#334155',
            tx2:    '#475569',
            tx3:    '#536175',
            accent: '#a76500',
            accentMuted: 'rgba(167,101,0,0.12)',
            accentBorder: 'rgba(167,101,0,0.28)',
            blue:   '#0f6fbf',
            blueHi: '#07599c',
            blueMuted: 'rgba(15,111,191,0.10)',
            red:    '#b91c1c',
            redMuted: 'rgba(185,28,28,0.10)',
            green:  '#047857',
            heroScrim: 'rgba(246,247,249,0.84)',
            hdr:    'rgba(255,255,255,0.92)',
            hdrBorder: 'rgba(15,23,42,0.10)',
            sT:     '#c7ced8', sH: '#98a2b3',
            quoteBar: '#0f6fbf',
        },
        highContrast: {
            scheme: 'dark',
            bg:     '#000000',
            sf0:    '#050505',
            sf1:    '#111111',
            sf2:    '#1f1f1f',
            bd0:    '#ffffff',
            bd1:    '#ffffff',
            bd2:    '#ffd400',
            sh1:    'none',
            sh2:    '0 0 0 2px #ffffff',
            sh3:    '0 0 0 3px #ffd400',
            tx0:    '#ffffff',
            tx1:    '#ffffff',
            tx2:    '#eeeeee',
            tx3:    '#cfcfcf',
            accent: '#ffd400',
            accentMuted: 'rgba(255,212,0,0.22)',
            accentBorder: '#ffd400',
            blue:   '#6bd5ff',
            blueHi: '#ffffff',
            blueMuted: 'rgba(107,213,255,0.20)',
            red:    '#ff5a66',
            redMuted: 'rgba(255,90,102,0.20)',
            green:  '#00ff87',
            heroScrim: 'rgba(0,0,0,0.94)',
            hdr:    'rgba(0,0,0,0.98)',
            hdrBorder: '#ffffff',
            sT:     '#ffffff', sH: '#ffd400',
            quoteBar: '#ffd400',
        },
    };

    function getStoredThemeId() {
        const id = get('themeVariant');
        return THEMES[id] ? id : 'dark';
    }
    function prefersLightTheme() {
        return typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-color-scheme: light)').matches;
    }
    function getActiveThemeId() {
        return get('themeAuto') ? (prefersLightTheme() ? 'light' : 'dark') : getStoredThemeId();
    }
    function getTheme(id = getActiveThemeId()) {
        return THEMES[id] || THEMES.dark;
    }
    function updateThemeControls(activeId = getActiveThemeId()) {
        const selector = document.querySelector('.enh-theme-selector');
        if (selector) {
            selector.querySelectorAll('.enh-theme-swatch').forEach(swatch => {
                const isActive = swatch.dataset.theme === activeId;
                swatch.classList.toggle('active', isActive);
                swatch.setAttribute('aria-pressed', String(isActive));
            });
        }
        const autoInput = document.getElementById('enh-theme-auto');
        if (autoInput) autoInput.checked = !!get('themeAuto');
    }
    function applyThemeStyles(options = {}) {
        if (!isIMDbHost()) return;
        const activeId = getActiveThemeId();
        if (get('modernUI')) addCSS(getThemeCSS(activeId), 'enh-modernUI');
        else {
            removeCSS('enh-modernUI');
            removeCSS('enh-early-shell');
            if (document.documentElement) delete document.documentElement.dataset.imdbEnhanced;
        }
        injectGlobalStyles();
        injectEarlyThemeShell();
        if (options.refreshDependent !== false) refreshThemedStyles();
        updateThemeControls(activeId);
    }
    function setupThemeAutoSync() {
        if (!isIMDbHost() || setupThemeAutoSync._done || typeof window.matchMedia !== 'function') return;
        setupThemeAutoSync._done = true;
        const media = window.matchMedia('(prefers-color-scheme: light)');
        const onChange = () => {
            if (get('themeAuto')) applyThemeStyles();
        };
        if (typeof media.addEventListener === 'function') media.addEventListener('change', onChange);
        else if (typeof media.addListener === 'function') media.addListener(onChange);
    }

    function getThemeCSS(id) {
        const t = getTheme(id);
        return `
/* ════════════════════════════════════════════
   BASE CANVAS & TYPOGRAPHY
   ════════════════════════════════════════════ */
body, .ipc-page-background, .ipc-page-background--base,
.ipc-page-background--baseAlt { background: ${t.bg} !important; }

html { color-scheme: ${t.scheme}; scroll-behavior: smooth; }
body {
    color: ${t.tx1} !important;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
}

/* Keep IMDb's own component tokens in the selected palette. IMDb scopes many
   of these variables to native surfaces, so body color alone cannot prevent
   white cards with black text from leaking into a dark theme. */
html[data-imdb-enhanced="active"] {
    --ipt-base-bg: ${t.bg};
    --ipt-base-color: ${t.bg};
    --ipt-base-shade1-bg: ${t.sf1};
    --ipt-base-shade1-color: ${t.sf1};
    --ipt-base-shade2-bg: ${t.sf2};
    --ipt-base-shade2-color: ${t.sf2};
    --ipt-base-shade3-bg: ${t.sf1};
    --ipt-base-shade3-color: ${t.sf1};
    --ipt-baseAlt-bg: ${t.sf0};
    --ipt-baseAlt-color: ${t.sf0};
    --ipt-baseAlt-shade1-bg: ${t.sf1};
    --ipt-baseAlt-shade1-color: ${t.sf1};
    --ipt-baseAlt-shade2-bg: ${t.sf2};
    --ipt-baseAlt-shade2-color: ${t.sf2};
    --ipt-baseAlt-shade3-bg: ${t.sf1};
    --ipt-baseAlt-shade3-color: ${t.sf1};
    --ipt-on-base-color: ${t.tx0};
    --ipt-on-base-textPrimary-color: ${t.tx0};
    --ipt-on-base-textSecondary-color: ${t.tx1};
    --ipt-on-base-textHint-color: ${t.tx2};
    --ipt-on-base-textDisabled-color: ${t.tx3};
    --ipt-on-baseAlt-color: ${t.tx0};
    --ipt-on-baseAlt-textPrimary-color: ${t.tx0};
    --ipt-on-baseAlt-textSecondary-color: ${t.tx1};
    --ipt-on-baseAlt-textHint-color: ${t.tx2};
    --ipt-on-baseAlt-textDisabled-color: ${t.tx3};
    --ipt-on-baseAlt-accent2-color: ${t.blue};
    --ipc-pageSection-base-bg: ${t.sf0};
    --ipc-pageSection-baseAlt-bg: ${t.sf0};
    --ipc-listCard-base-bg: ${t.sf1};
    --ipc-listCard-baseAlt-bg: ${t.sf0};
}

/* Type scale — tighten the whole page */
[data-testid="hero__primary-text"] {
    font-weight: 700 !important; letter-spacing: -0.025em !important;
    line-height: 1.1 !important; color: ${t.tx0} !important;
}
.ipc-title__text {
    font-weight: 600 !important; letter-spacing: -0.015em !important;
    color: ${t.tx0} !important;
}
h3.ipc-title__text { color: ${t.blue} !important; }
a h3 span, a h3 .ipc-title__text { color: ${t.blue} !important; }
.ipc-title__description { color: ${t.tx2} !important; margin-top: 2px !important; }

/* Body text */
.ipc-html-content-inner-div { color: ${t.tx1} !important; }
.ipc-overflowText--children { color: ${t.tx1} !important; }

/* Metadata labels & values */
.ipc-metadata-list-item__label { color: ${t.tx2} !important; }
span.ipc-metadata-list-item__label.ipc-btn--not-interactable { color: ${t.tx2} !important; }
a.ipc-metadata-list-item__label--link { color: ${t.blue} !important; }
a.ipc-metadata-list-item__label--link:hover { color: ${t.blueHi} !important; }
.ipc-metadata-list-item__list-content-item--link,
.ipc-metadata-list-item__list-content-item a { color: ${t.blue} !important; }
.ipc-metadata-list-item__list-content-item--link:hover,
.ipc-metadata-list-item__list-content-item a:hover { color: ${t.blueHi} !important; }

/* Muted / secondary text */
[data-testid="title-cast-item"] .ipc-inline-list__item,
.ipc-metadata-list-item__content-container,
.ipc-rating-star--voteCount { color: ${t.tx3} !important; }
[data-testid="hero-rating-bar__popularity"] { color: ${t.blue} !important; }

/* Links — global */
.ipc-link, .ipc-link--base { color: ${t.blue} !important; transition: color .15s ease !important; }
.ipc-link:hover, .ipc-link--base:hover { color: ${t.blueHi} !important; }
.ipc-md-link--entity { color: ${t.blue} !important; }

/* Rating star */
span.ipc-rating-star--rating { color: ${t.accent} !important; font-weight: 700 !important; }
span.ipc-rating-star--maxRating { color: ${t.tx3} !important; }

/* ════════════════════════════════════════════
   ELEVATION SYSTEM — CARDS & SECTIONS
   ════════════════════════════════════════════ */

/* Title page main sections → elevation 0 cards */
section[data-testid="title-cast"],
section[data-testid="UserReviews"],
section[data-testid="MoreLikeThis"],
section[data-testid="Details"],
section[data-testid="BoxOffice"],
section[data-testid="TechSpecs"],
section[data-testid="DidYouKnow"],
section[data-testid="videos-section"],
section[data-testid="Photos"],
section[data-testid="Filmography"],
section[data-testid="PersonalDetails"] {
    background: ${t.sf0} !important;
    border: 1px solid ${t.bd1} !important;
    border-radius: 12px !important;
    padding: 20px 24px !important;
    margin-bottom: 12px !important;
    box-shadow: ${t.sh1} !important;
    transition: border-color .2s ease !important;
}

/* Hero section */
section[data-testid="hero-parent"] {
    position: relative !important;
    background: ${t.bg} !important;
    border-radius: 0 !important;
    padding-top: 30px !important;
    padding-bottom: 28px !important;
    border-bottom: 1px solid ${t.bd0} !important;
    box-shadow: inset 0 -18px 34px -34px ${t.tx0} !important;
}
section[data-testid="hero-parent"]::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background-image: linear-gradient(90deg, ${t.bg} 0%, color-mix(in srgb, ${t.bg} 88%, transparent) 40%, color-mix(in srgb, ${t.bg} 28%, transparent) 100%), var(--enh-hero-backdrop, none);
    background-position: center, center;
    background-size: 100% 100%, cover;
    opacity: .36;
    filter: saturate(.82) contrast(.96);
}
section[data-testid="hero-parent"] > * { position: relative; z-index: 1; }
section[data-testid="hero-parent"] [data-testid="hero__pageTitle"] {
    max-width: min(100%, 820px) !important;
    margin-bottom: 16px !important;
}
section[data-testid="hero-parent"] [data-testid="hero__primary-text"] {
    font-size: clamp(42px, 5vw, 72px) !important;
    font-weight: 800 !important;
    letter-spacing: -0.045em !important;
    line-height: .98 !important;
}
section[data-testid="hero-parent"] [data-testid="hero-media__poster"] {
    border-radius: 12px !important;
    overflow: hidden !important;
}
section[data-testid="hero-parent"] [data-testid="hero-media__poster"] img {
    border-radius: 12px !important;
    box-shadow: 0 18px 42px rgba(0,0,0,.34) !important;
}

/* Transparent base sections (prevent double-backgrounds) */
section.ipc-page-section.ipc-page-section--base { background: transparent !important; }
section.ipc-page-section.ipc-page-section--none { background: transparent !important; }

/* Native page surfaces and cards. These stable IMDb primitives are shared by
   cast, user-list, poll, recommendation, and sidebar content. */
section.ipc-page-section--baseAlt:not([data-testid="hero-parent"]),
div.ipc-page-section--baseAlt {
    background: ${t.sf0} !important;
    color: ${t.tx1} !important;
    border-color: ${t.bd1} !important;
}
.ipc-list-card,
.ipc-slate-card,
.ipc-poster-card,
.ipc-primary-image-list-card {
    background: ${t.sf0} !important;
    background-color: ${t.sf0} !important;
    color: ${t.tx1} !important;
    border-color: ${t.bd1} !important;
}
.ipc-list-card:hover,
.ipc-slate-card:hover,
.ipc-poster-card:hover,
.ipc-primary-image-list-card:hover {
    background-color: ${t.sf1} !important;
}
.ipc-list-card .text-on-light,
.ipc-slate-card .text-on-light,
.ipc-primary-image-list-card .text-on-light,
.ipc-list-card [class*="metadata"],
.ipc-list-card [class*="description"],
.ipc-list-card [class*="secondary"],
.ipc-slate-card [class*="metadata"],
.ipc-slate-card [class*="description"],
.ipc-slate-card [class*="secondary"],
.ipc-primary-image-list-card__content,
.ipc-primary-image-list-card__title-metadata,
.ipc-primary-image-list-card__secondary-text--attribute {
    color: ${t.tx2} !important;
}
.ipc-list-card a,
.ipc-slate-card a,
.ipc-primary-image-list-card a,
.ipc-primary-image-list-card__secondary-text--clickable {
    color: ${t.blue} !important;
}
.ipc-list-card h3,
.ipc-list-card h3 *,
.ipc-list-card .ipc-title__text,
.ipc-list-card [class*="list-card__title"],
.ipc-list-card [class*="title-text"],
.ipc-slate-card h3,
.ipc-slate-card h3 *,
.ipc-slate-card .ipc-title__text,
.ipc-slate-card [class*="slate-card__title"],
.ipc-slate-card [class*="title-text"],
.ipc-primary-image-list-card__title {
    color: ${t.tx0} !important;
}
.ipc-list-card h3:hover,
.ipc-list-card h3:hover *,
.ipc-list-card [class*="title"]:hover,
.ipc-slate-card h3:hover,
.ipc-slate-card h3:hover *,
.ipc-slate-card [class*="title"]:hover,
.ipc-primary-image-list-card__title:hover {
    color: ${t.blueHi} !important;
}
.ipc-btn--core-base,
.ipc-btn--core-baseAlt {
    background: ${t.sf1} !important;
    border-color: ${t.bd1} !important;
    color: ${t.tx1} !important;
}

/* Cast cards use generated classes for the text, so anchor inheritance is
   intentionally pinned to stable data-testid/class hooks. */
[data-testid="title-cast-item__actor"] {
    color: ${t.tx0} !important;
}
[data-testid="title-cast-item__actor"]:hover {
    color: ${t.blueHi} !important;
}
[data-testid="title-cast-item"] .title-cast-item__characters-list,
[data-testid="title-cast-item"] .title-cast-item__characters-list * {
    color: ${t.blue} !important;
}
[data-testid="title-cast-item"] [data-testid*="eps-toggle"],
[data-testid="title-cast-item"] > div:last-child span {
    color: ${t.tx2} !important;
}

/* Generic list cards → transparent or elevation 0 */
.ipc-list-card--border-line { border-color: ${t.bd0} !important; }
.ipc-list-card--border-line.ipc-list-card--tp-none.ipc-list-card--bp-none { background: transparent !important; }
.ipc-list-card--span.ipc-list-card--border-shadow { background: transparent !important; }
.ipc-inline-list--show-dividers .ipc-inline-list__item::after { border-color: ${t.bd0} !important; }

/* ════════════════════════════════════════════
   CAST CARDS — elevation 1 with hover lift
   ════════════════════════════════════════════ */
[data-testid="title-cast-item"] {
    background: ${t.sf1} !important;
    border: 1px solid ${t.bd1} !important;
    border-radius: 10px !important;
    overflow: hidden !important;
    box-shadow: ${t.sh1} !important;
    transition: transform .2s cubic-bezier(.4,0,.2,1),
                border-color .2s ease,
                box-shadow .2s ease !important;
}
[data-testid="title-cast-item"]:hover {
    transform: translateY(-3px) !important;
    border-color: ${t.accentBorder} !important;
    box-shadow: ${t.sh2} !important;
}

/* ════════════════════════════════════════════
   POSTER CARDS (More Like This, shovelers)
   ════════════════════════════════════════════ */
.ipc-poster-card {
    border-radius: 10px !important;
    overflow: hidden !important;
    transition: transform .2s cubic-bezier(.4,0,.2,1),
                box-shadow .2s ease !important;
}
.ipc-poster-card:hover {
    transform: translateY(-4px) !important;
    box-shadow: ${t.sh2} !important;
}

/* Hero poster */
[data-testid="hero-media__poster"] img {
    border-radius: 10px !important;
    box-shadow: ${t.sh2} !important;
    transition: transform .25s cubic-bezier(.4,0,.2,1),
                box-shadow .25s ease !important;
}
[data-testid="hero-media__poster"]:hover img {
    transform: scale(1.03) !important;
    box-shadow: ${t.sh3} !important;
}

/* ════════════════════════════════════════════
   SQUIRCLE SYSTEM — circles → rounded squares
   ════════════════════════════════════════════ */
.ipc-avatar, .ipc-avatar__avatar-image,
[class*="avatar"] img, [class*="Avatar"] img,
.ipc-media--circle, .ipc-media--avatar,
img[class*="avatar"], img[class*="Avatar"],
[class*="ipc-avatar"] {
    border-radius: 22% !important;
}
[style*="border-radius: 50%"], [style*="border-radius:50%"] {
    border-radius: 22% !important;
}

/* ════════════════════════════════════════════
   BUTTONS & CHIPS
   ════════════════════════════════════════════ */
.ipc-btn--core-accent1 {
    border-radius: 8px !important;
    transition: transform .15s ease, box-shadow .15s ease, background .15s ease !important;
}
.ipc-btn--core-accent1:hover {
    transform: translateY(-1px) !important;
    box-shadow: 0 4px 16px ${t.accentMuted} !important;
}
.ipc-chip, .ipc-chip--on-base, .ipc-chip--on-baseAlt {
    border-radius: 8px !important;
    border-color: ${t.bd1} !important;
    background: ${t.sf0} !important;
    transition: background .15s ease, border-color .15s ease, color .15s ease !important;
}
.ipc-chip:hover, .ipc-chip--on-base:hover {
    background: ${t.sf1} !important;
    border-color: ${t.bd2} !important;
}
.ipc-chip--filled {
    background: ${t.sf1} !important;
}

/* ════════════════════════════════════════════
   REVIEW PAGE
   ════════════════════════════════════════════ */
[data-testid="review-card-parent"] {
    background: ${t.sf0} !important;
    border: 1px solid ${t.bd1} !important;
    border-radius: 10px !important;
    padding: 16px 20px !important;
    margin: 0 0 10px 0 !important;
    box-shadow: ${t.sh1} !important;
    transition: border-color .2s ease !important;
}
[data-testid="review-card-parent"]:hover {
    border-color: ${t.bd2} !important;
}
[data-testid="review-summary"] .ipc-title__text {
    color: ${t.tx0} !important;
    font-weight: 600 !important;
}
[data-testid="author-link"], [data-testid="reviews-author"] {
    color: ${t.blue} !important;
}
[data-testid="review-overflow"] .ipc-html-content-inner-div {
    color: ${t.tx1} !important;
    line-height: 1.65 !important;
}
.ipc-list-card__content { padding: 8px 0 !important; }
/* Review rating stars inline */
.ipc-rating-star--voteCount, [data-testid="review-card-parent"] .ipc-rating-star--voteCount { color: ${t.tx2} !important; }

/* ════════════════════════════════════════════
   QUOTES PAGE — blockquote style with accent bar
   ════════════════════════════════════════════ */
[data-testid="sub-section-Quotes"] .ipc-list-card,
section[id*="quote" i] .ipc-list-card {
    background: ${t.sf0} !important;
    border: 1px solid ${t.bd1} !important;
    border-left: 3px solid ${t.quoteBar} !important;
    border-radius: 0 10px 10px 0 !important;
    padding: 12px 16px !important;
    margin: 0 0 8px 0 !important;
    box-shadow: ${t.sh1} !important;
}
[data-testid="sub-section-Quotes"] .ipc-list-card,
section[id*="quote" i] .ipc-list-card {
    padding: 4px 0 !important;
    margin: 0 !important;
}
[data-testid="sub-section-Quotes"] .ipc-html-content-inner-div,
section[id*="quote" i] .ipc-html-content-inner-div {
    color: ${t.tx1} !important;
    line-height: 1.6 !important;
    font-style: italic !important;
}

/* ════════════════════════════════════════════
   NAME / PERSON PAGE
   ════════════════════════════════════════════ */
/* Hero photo → squircle with shadow */
[data-testid="name-overview-widget"] img,
.name-overview-widget img {
    border-radius: 12px !important;
    box-shadow: ${t.sh2} !important;
}
/* Bio text */
[data-testid="bio-content"] { color: ${t.tx1} !important; }
[data-testid="bio-content"] .ipc-html-content-inner-div {
    color: ${t.tx1} !important;
    line-height: 1.65 !important;
}
/* Filmography accordion */
.ipc-accordion__item {
    border-color: ${t.bd0} !important;
    transition: background .15s ease !important;
}
.ipc-accordion__item:hover { background: ${t.sf1} !important; }
.ipc-accordion__item__header {
    padding: 10px 0 !important;
}
.ipc-accordion__item__title { color: ${t.tx0} !important; font-weight: 600 !important; }
.ipc-accordion__item__content { padding: 0 !important; }
/* Personal details */
[data-testid="PersonalDetails"] .ipc-metadata-list-item__label { color: ${t.tx2} !important; }
[data-testid="PersonalDetails"] a { color: ${t.blue} !important; }

/* ════════════════════════════════════════════
   SIDEBAR (all subpages)
   ════════════════════════════════════════════ */
[data-testid="sidebar-sticky-block"] .ipc-slate-card {
    border-radius: 10px !important;
    overflow: hidden !important;
    box-shadow: ${t.sh1} !important;
}
[data-testid="sidebar-sticky-block"] .ipc-list-card,
[data-testid="sidebar-sticky-block"] .ipc-slate-card {
    background: ${t.sf0} !important;
    border-color: ${t.bd0} !important;
    border-radius: 8px !important;
    transition: background .15s ease !important;
}
[data-testid="sidebar-sticky-block"] .ipc-list-card:hover,
[data-testid="sidebar-sticky-block"] .ipc-slate-card:hover { background: ${t.sf1} !important; }
[data-testid="sidebar-sticky-block"] .ipc-title__text { color: ${t.tx0} !important; }
[data-testid="sidebar-sticky-block"] .ipc-inline-list__item { color: ${t.tx3} !important; }

/* ════════════════════════════════════════════
   SCROLLBAR
   ════════════════════════════════════════════ */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: ${t.sT}; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: ${t.sH}; }

/* ════════════════════════════════════════════
   SUBTITLE & CUSTOM ROWS
   ════════════════════════════════════════════ */
#enh-sub-row { color: ${t.blue} !important; }
#enh-sub-row a { color: ${t.blue} !important; }
#enh-sub-row a:hover { color: ${t.blueHi} !important; }

/* ════════════════════════════════════════════
   GLOBAL SPACING RHYTHM (4px grid)
   ════════════════════════════════════════════ */
.ipc-page-section { margin-top: 0 !important; margin-bottom: 0 !important; }
.ipc-page-section--tp-none { padding-top: 0 !important; }
.ipc-page-section--bp-none { padding-bottom: 0 !important; }
.ipc-title { margin-bottom: 8px !important; }
.ipc-chip-list__scroller { gap: 6px !important; }
.ipc-overflowText--children { margin: 0 !important; }

/* ════════════════════════════════════════════
   FOCUS STATES (accessibility)
   ════════════════════════════════════════════ */
a:focus-visible, button:focus-visible, .ipc-chip:focus-visible {
    outline: 2px solid ${t.accent} !important;
    outline-offset: 2px !important;
}

/* Windows High Contrast substitutes the whole palette and drops box-shadow, so any
   ring drawn as a shadow disappears entirely. Every control below therefore also
   carries an outline in a system colour, and decorative surfaces step out of the way
   rather than competing with the user's chosen scheme. */
@media (forced-colors: active) {
    a:focus-visible, button:focus-visible, .ipc-chip:focus-visible,
    [id^="enh-"] a:focus-visible, [id^="enh-"] button:focus-visible,
    [class^="enh-"]:focus-visible, [class*=" enh-"]:focus-visible {
        outline: 3px solid Highlight !important;
        outline-offset: 2px !important;
    }
    [id^="enh-"], [class^="enh-"], [class*=" enh-"] {
        forced-color-adjust: auto;
        text-shadow: none !important;
        box-shadow: none !important;
    }
    /* Rating and heatmap colours are data, not decoration — keep them legible by
       letting the system pick the pair rather than forcing our own. */
    td.enh-heatmap-cell a, .enh-heatmap-chip, #enh-rating-badge {
        background: ButtonFace !important;
        color: ButtonText !important;
        border: 1px solid ButtonText !important;
    }
}

/* Users asking for more contrast get the tested opaque path rather than glass. */
@media (prefers-contrast: more) {
    [id^="enh-"], [class^="enh-"], [class*=" enh-"] {
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
    }
    a:focus-visible, button:focus-visible, .ipc-chip:focus-visible {
        outline-width: 3px !important;
    }
}

@media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto !important; }
    *, *::before, *::after {
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.001ms !important;
    }
}
        `;
    }

    function injectEarlyThemeShell() {
        if (!isIMDbHost() || !get('modernUI')) return;
        const t = getTheme();
        /* At document-start the root element is not guaranteed to exist yet — the same
           condition addCSS already queues around. The marker is re-applied from
           applyThemeStyles once the document is up, so skipping it here is safe. */
        if (document.documentElement) document.documentElement.dataset.imdbEnhanced = 'active';
        addCSS(`
html[data-imdb-enhanced="active"] { color-scheme: ${t.scheme}; background: ${t.bg}; }
html[data-imdb-enhanced="active"] body,
html[data-imdb-enhanced="active"] .ipc-page-background {
    background: ${t.bg} !important;
}
#imdbHeader {
    background: ${t.hdr} !important;
    border-bottom: 1px solid ${t.hdrBorder} !important;
}
        `, 'enh-early-shell');
    }

    injectEarlyThemeShell();
    setupThemeAutoSync();

