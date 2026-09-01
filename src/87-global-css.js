    // #########################################################################
    //
    //  GLOBAL STYLES
    //
    // #########################################################################
    function injectGlobalStyles() {
        const t = getTheme();
        addCSS(`
/* ════ Toast ════ */
#enh-toast {
    position: fixed; bottom: 24px; right: 24px;
    background: ${t.sf1}; color: ${t.tx0};
    padding: 10px 20px; border-radius: 10px; z-index: 2147483647;
    font: 600 13px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    box-shadow: ${t.sh3};
    border: 1px solid ${t.bd1};
    transform: translateY(20px); opacity: 0;
    transition: transform .3s cubic-bezier(.4,0,.2,1), opacity .3s ease;
    pointer-events: none;
}
#enh-toast.visible { transform: translateY(0); opacity: 1; }
/* The UA popover box would centre it and give it a border and colours of its own. */
#enh-toast[popover] {
    inset: auto; bottom: 24px; right: 24px;
    width: auto; height: auto; margin: 0; overflow: visible;
    padding: 10px 20px; border: 1px solid ${t.bd1}; color: ${t.tx0};
}
/* Announced, never drawn. Kept in the layout tree (not display:none) so the live
   region stays in the accessibility tree between messages. */
/* The welcome notice wears the update notice's clothes: same corner, same shape, and
   the two never appear together. */
#enh-update-notice,
#enh-first-run {
    position: fixed; right: 16px; bottom: 16px; z-index: 2147483000;
    display: flex; align-items: center; gap: 12px;
    max-width: min(420px, calc(100vw - 32px));
    padding: 10px 14px; border-radius: 10px;
    background: ${t.sf1}; border: 1px solid ${t.accentBorder}; color: ${t.tx1};
    font: 600 12px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    box-shadow: ${t.sh3};
}
.enh-update-notice__link { color: ${t.accent}; text-decoration: underline; white-space: nowrap; }
.enh-update-notice__dismiss {
    background: ${t.sf2}; border: 1px solid ${t.bd1}; color: ${t.tx2};
    border-radius: 6px; padding: 4px 10px; cursor: pointer; white-space: nowrap;
}
.enh-update-notice__dismiss:hover { background: ${t.sf2}; color: ${t.tx0}; border-color: ${t.bd2}; }
.enh-update-notice__dismiss:focus-visible { outline: 2px solid ${t.accent}; outline-offset: 2px; }

#enh-toast-announcer, #enh-score-announcer {
    position: fixed; bottom: 0; left: 0; width: 1px; height: 1px; padding: 0;
    overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0;
    pointer-events: none;
}

/* ════ Editorial Title Surface ════ */
section[data-testid="hero-parent"].enh-editorial-native-hidden { display: none !important; }
#enh-editorial-surface {
    position: relative; z-index: 7; isolation: isolate; overflow: hidden;
    /* border-box, or the 40px of side padding sits outside the 100% and the whole page
       gains a horizontal scrollbar. Measured: 1512px of document on a 1440px viewport. */
    box-sizing: border-box;
    width: 100%; max-width: 1600px; margin: 0 auto; padding: 0 40px 28px;
    color: ${t.tx1}; background-color: ${t.bg};
    background-image: var(--enh-editorial-backdrop, none);
    background-position: center; background-size: cover; background-blend-mode: normal;
    border-bottom: 1px solid ${t.bd0};
}
#enh-editorial-surface::before {
    content: ''; position: absolute; inset: 0; z-index: 0;
    background: ${t.heroScrim}; pointer-events: none;
}
#enh-editorial-surface > * { position: relative; z-index: 1; }
/* The quick-nav column is fixed to the right edge and 70px wide; between 1200px and
   the surface's own 1600px ceiling it sat on top of the score rail's text. */
@media (min-width: 1201px) and (max-width: 1799px) {
    body:has(#enh-quicknav) #enh-editorial-surface { padding-right: 124px; }
}
.enh-editorial-subnav {
    display: flex; align-items: center; justify-content: space-between; gap: 20px;
    min-height: 58px; border-bottom: 1px solid ${t.bd0};
}
.enh-editorial-subnav__left,
.enh-editorial-subnav__right { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; min-width: 0; }
.enh-editorial-subnav__right { justify-content: flex-end; }
.enh-editorial-subnav__link {
    color: ${t.blue} !important; font: 700 13px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    text-decoration: none !important; white-space: nowrap;
}
.enh-editorial-subnav__link:hover { color: ${t.blueHi} !important; }
.enh-editorial-hero {
    display: grid; grid-template-columns: 240px minmax(300px, 1fr) minmax(330px, .82fr);
    align-items: center; gap: 30px; min-height: 470px; padding: 34px 0 38px;
}
.enh-editorial-poster {
    width: 240px; aspect-ratio: 2 / 3; overflow: hidden;
    border: 1px solid ${t.bd1}; border-radius: 12px; background: ${t.sf1}; box-shadow: ${t.sh3};
}
.enh-editorial-poster img { display: block; width: 100%; height: 100%; object-fit: cover; }
.enh-editorial-identity { min-width: 0; display: flex; flex-direction: column; align-items: flex-start; }
.enh-editorial-title {
    max-width: 100%; margin: 0; color: ${t.tx0};
    font: 800 clamp(42px, 5vw, 72px)/.98 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    letter-spacing: -.045em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.enh-editorial-meta {
    margin-top: 15px; color: ${t.tx2}; font: 600 14px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
#enh-editorial-action-slot { width: min(100%, 340px); margin-top: 24px; }
#enh-editorial-standalone-slot { width: min(100%, 340px); }
#enh-editorial-standalone-slot > #enh-title-stack {
    display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 100%; margin: 0;
}
#enh-editorial-standalone-slot > #enh-title-stack > * { width: 100%; }
#enh-editorial-score-rail {
    display: flex; flex-direction: column; align-self: stretch; justify-content: center;
    min-width: 0; padding-left: 24px; border-left: 1px solid ${t.bd0};
}
#enh-editorial-score-rail > [data-testid="hero-rating-bar__aggregate-rating"],
#enh-editorial-score-rail > [data-testid="hero-rating-bar__popularity"],
#enh-editorial-score-rail > .enh-score-widget {
    display: flex !important; align-items: flex-start !important; justify-content: center !important;
    min-width: 0 !important; max-width: none !important; padding: 15px 0 !important;
    background: transparent !important; border: 0 !important; border-bottom: 1px solid ${t.bd0} !important;
    border-radius: 0 !important; box-shadow: none !important;
}
#enh-editorial-score-rail > :last-child { border-bottom: 0 !important; }
#enh-editorial-score-rail .enh-score-widget__label { margin-bottom: 4px; }
#enh-editorial-score-rail .enh-score-widget__score { justify-content: flex-start; }
#enh-editorial-score-rail .enh-score-widget__value--availability { max-width: 260px; }
.enh-editorial-details {
    display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
    border-top: 1px solid ${t.bd0};
}
.enh-editorial-about { min-width: 0; padding: 25px 38px 10px 0; }
.enh-editorial-watch { min-width: 0; padding: 25px 0 10px 38px; border-left: 1px solid ${t.bd0}; }
.enh-editorial-about h2,
.enh-editorial-watch h2 {
    margin: 0; color: ${t.tx0}; font: 750 23px/1.15 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    letter-spacing: -.02em;
}
.enh-editorial-watch__header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px; margin-bottom: 16px; }
.enh-editorial-watch__header p { margin: 0; color: ${t.tx3}; font: 500 12px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
/* Holds IMDb's own hero player once the native hero is hidden. Collapses to nothing
   on titles that have no video, so it never leaves a gap. */
#enh-editorial-media-slot:empty { display: none; }
#enh-editorial-media-slot {
    max-width: 560px; margin: 16px 0 4px;
    border: 1px solid ${t.bd1}; border-radius: 10px; overflow: hidden; background: ${t.sf1};
}
#enh-editorial-media-slot > * { width: 100% !important; max-width: 100% !important; display: block; }
#enh-editorial-media-slot video,
#enh-editorial-media-slot iframe { width: 100%; height: auto; display: block; }
.enh-editorial-synopsis { max-width: 720px; margin: 14px 0 18px; color: ${t.tx1}; font: 400 15px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
.enh-editorial-detail-row {
    display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px;
    padding: 11px 0; border-top: 1px solid ${t.bd0}; color: ${t.tx2};
    font: 600 13px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.enh-editorial-detail-row strong { min-width: 48px; color: ${t.tx0}; }
.enh-editorial-detail-row a,
.enh-editorial-about-link { color: ${t.blue} !important; text-decoration: none !important; }
.enh-editorial-detail-row a:hover,
.enh-editorial-about-link:hover { color: ${t.blueHi} !important; }
.enh-editorial-detail-separator { color: ${t.tx3}; }
.enh-editorial-about-link { display: inline-flex; margin-top: 10px; font: 700 12px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
#enh-editorial-research-slot #enh-external-links { padding: 0; border: 0; }
#enh-editorial-research-slot #enh-external-links .enh-external-links__header { display: none; }
#enh-editorial-research-slot .enh-external-groups { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 20px; }
#enh-editorial-research-slot .enh-external-group { padding: 10px 0; }

@media (max-width: 1250px) {
    #enh-editorial-surface { padding-left: 24px; padding-right: 24px; }
    .enh-editorial-hero { grid-template-columns: 190px minmax(260px, 1fr); gap: 24px; }
    .enh-editorial-poster { width: 190px; }
    #enh-editorial-score-rail { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 18px; padding: 14px 0 0; border-top: 1px solid ${t.bd0}; border-left: 0; }
    #enh-editorial-score-rail > [data-testid="hero-rating-bar__aggregate-rating"],
    #enh-editorial-score-rail > [data-testid="hero-rating-bar__popularity"],
    #enh-editorial-score-rail > .enh-score-widget { border-bottom: 0 !important; border-left: 1px solid ${t.bd0} !important; padding: 8px 14px !important; }
    #enh-editorial-score-rail > :nth-child(3n + 1) { border-left: 0 !important; }
}
@media (max-width: 1100px) {
    .enh-editorial-details { grid-template-columns: 1fr; }
    .enh-editorial-about { padding: 22px 0 10px; }
    .enh-editorial-watch { padding: 22px 0 10px; border-top: 1px solid ${t.bd0}; border-left: 0; }
}
@media (max-width: 760px) {
    #enh-editorial-surface { padding-left: 18px; padding-right: 18px; }
    .enh-editorial-subnav { align-items: flex-start; flex-direction: column; justify-content: center; gap: 8px; padding: 12px 0; }
    .enh-editorial-subnav__right { justify-content: flex-start; gap: 10px; }
    .enh-editorial-hero { grid-template-columns: 1fr; gap: 20px; padding-top: 24px; }
    .enh-editorial-poster { width: 150px; }
    .enh-editorial-title { font-size: clamp(36px, 12vw, 56px); white-space: normal; }
    #enh-editorial-action-slot, #enh-editorial-standalone-slot { width: 100%; }
    #enh-editorial-score-rail { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    #enh-editorial-score-rail > [data-testid="hero-rating-bar__aggregate-rating"],
    #enh-editorial-score-rail > [data-testid="hero-rating-bar__popularity"],
    #enh-editorial-score-rail > .enh-score-widget { border-left: 1px solid ${t.bd0} !important; }
    #enh-editorial-score-rail > :nth-child(2n + 1) { border-left: 0 !important; }
    #enh-editorial-research-slot .enh-external-groups { grid-template-columns: 1fr; }
}
@media (max-width: 480px) {
    #enh-editorial-score-rail { grid-template-columns: 1fr; }
    #enh-editorial-score-rail > [data-testid="hero-rating-bar__aggregate-rating"],
    #enh-editorial-score-rail > [data-testid="hero-rating-bar__popularity"],
    #enh-editorial-score-rail > .enh-score-widget { border-left: 0 !important; border-bottom: 1px solid ${t.bd0} !important; padding: 12px 0 !important; }
}

/* ════ Stream Panel ════ */
#enh-title-stack {
    display: grid;
    grid-template-columns: minmax(230px, 300px) minmax(0, 1fr);
    align-items: start;
    column-gap: 28px;
    row-gap: 16px;
    margin: 18px 0 24px;
    max-width: min(100%, 1120px);
}
#enh-title-stack > * { box-sizing: border-box; width: 100%; min-width: 0; }
#enh-title-stack #enh-copy-id {
    grid-column: 1 / -1;
    width: fit-content;
    margin: 0;
}
#enh-title-stack #enh-search-buttons { grid-column: 1; }
#enh-title-stack #enh-external-links { grid-column: 2; }
#enh-title-stack #enh-tv-bar,
#enh-title-stack #enh-servarr-actions,
#enh-title-stack #enh-media-server-status {
    grid-column: 1 / -1;
}
#enh-title-stack #enh-search-buttons,
#enh-title-stack #enh-external-links,
#enh-title-stack #enh-tv-bar,
#enh-title-stack #enh-servarr-actions,
#enh-title-stack #enh-media-server-status {
    margin: 0;
}

#enh-search-buttons {
    padding: 0;
    background: transparent;
    border: 0;
    border-radius: 0;
    box-shadow: none;
}
.enh-stream-label {
    display: flex; align-items: center; gap: 6px;
    font: 700 10px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    text-transform: uppercase; letter-spacing: 0.14em;
    color: ${t.tx3};
    margin: 0 0 10px 2px;
}
.enh-stream-label__dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: ${t.accent}; box-shadow: 0 0 0 4px ${t.accentMuted};
}
#enh-editorial-actions { display: flex; flex-direction: column; gap: 6px; }
/* The page actions are a grouping for ownership, not for layout — their buttons
   take part in the dock's own column so the rhythm is unchanged. */
.enh-title-page-actions { display: contents; }
.enh-editorial-action {
    display: flex; align-items: center; justify-content: flex-start;
    width: 100%; min-height: 40px; padding: 8px 14px;
    background: ${t.sf1}; border: 1px solid ${t.bd1}; border-radius: 8px;
    color: ${t.tx1}; cursor: pointer; text-align: left;
    font: 700 12px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    transition: background .15s ease, border-color .15s ease, color .15s ease, transform .15s ease;
}
.enh-editorial-action:hover,
.enh-editorial-action:focus-visible {
    background: ${t.sf2}; border-color: ${t.accentBorder}; color: ${t.accent};
    transform: translateY(-1px);
}
#enh-editorial-actions #enh-trailer-btn,
#enh-editorial-actions #enh-link-menu-wrap {
    width: 100%; margin: 0;
}
#enh-editorial-actions #enh-trailer-btn,
#enh-editorial-actions #enh-link-menu-trigger {
    width: 100%; min-height: 40px; padding: 8px 14px;
    text-align: left; border-radius: 8px;
}
#enh-editorial-actions #enh-link-menu-wrap { display: flex; }
/* :not([popover]) rather than a heavier selector on the top-layer rules. Two IDs beat
   any class-and-attribute selector, so an override would have had to out-specify this
   and lose the argument anyway; what is actually true is that this places the menu
   against its wrapper, and a menu in the top layer has no wrapper to be placed against.
   Without this the anchor rules lost, position: fixed won on its own, and
   bottom: calc(100% + 8px) resolved against the viewport — putting the whole menu above
   the top of the screen on every Chromium install. */
#enh-editorial-actions #enh-link-menu-wrap .enh-link-dropdown:not([popover]) {
    top: auto; bottom: calc(100% + 8px); left: 0; right: auto;
    max-height: min(60vh, 520px); overflow: auto;
}
#enh-editorial-actions #enh-link-menu-wrap .enh-link-dropdown[popover] {
    max-height: min(60vh, 520px); overflow: auto;
}
.enh-link-groups { display: flex; flex-direction: column; gap: 8px; }
.enh-link-group { min-width: 0; }
.enh-link-group__label {
    margin: 0 0 5px 2px;
    color: ${t.tx3};
    font: 700 9px/1.1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    letter-spacing: .1em;
    text-transform: uppercase;
}
.enh-search-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(112px, 1fr));
    gap: 6px;
}
.enh-search-btn {
    display: flex; align-items: center; justify-content: center;
    min-height: 38px;
    padding: 8px 8px;
    background: ${t.sf1};
    border: 1px solid ${t.bd1};
    border-radius: 8px;
    color: ${t.tx1};
    font: 600 12px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    cursor: pointer; transition: background .18s cubic-bezier(.4,0,.2,1), border-color .18s ease, color .18s ease, transform .18s cubic-bezier(.4,0,.2,1), box-shadow .18s ease; outline: none;
    text-decoration: none !important;
    text-align: center; white-space: nowrap; min-width: 0;
}
.enh-search-btn:hover {
    background: ${t.sf2};
    border-color: ${t.accentBorder};
    color: ${t.tx0};
    transform: translateY(-1px);
    box-shadow: ${t.sh1};
}
.enh-search-btn:active { transform: translateY(0); }
.enh-search-btn--primary {
    display: grid; grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center; justify-content: initial; gap: 10px;
    min-height: 58px; padding: 10px 14px;
    background: ${t.accent}; border-color: ${t.accent};
    color: ${readableTextColor(t.accent)};
    box-shadow: 0 10px 26px ${t.accentMuted};
    text-align: left;
}
.enh-search-btn--primary:hover {
    background: ${t.accent}; border-color: ${t.accent};
    color: ${readableTextColor(t.accent)};
    filter: brightness(1.08); box-shadow: 0 12px 30px ${t.accentMuted};
}
.enh-search-btn__action { font-size: 15px; font-weight: 800; }
.enh-search-btn__site {
    overflow: hidden; text-overflow: ellipsis;
    font-size: 11px; font-weight: 600; opacity: .78;
}
.enh-search-btn__arrow { font-size: 18px; line-height: 1; opacity: .86; }
.enh-watch-options {
    overflow: hidden; border: 1px solid ${t.bd1};
    border-radius: 8px; background: ${t.sf0};
}
.enh-watch-options__summary {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    min-height: 38px; padding: 8px 11px; cursor: pointer;
    color: ${t.tx1}; font: 700 11px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    list-style: none;
}
.enh-watch-options__summary::-webkit-details-marker { display: none; }
.enh-watch-options__summary::after { content: '+'; color: ${t.tx3}; font-size: 16px; line-height: 1; }
.enh-watch-options[open] .enh-watch-options__summary::after { content: '−'; color: ${t.accent}; }
.enh-watch-options__summary:hover { color: ${t.accent}; background: ${t.sf1}; }
.enh-watch-options__count { color: ${t.tx3}; font-weight: 600; margin-left: auto; }
.enh-watch-options__groups {
    display: flex; flex-direction: column; gap: 10px;
    padding: 0 10px 10px; border-top: 1px solid ${t.bd0};
}
.enh-search-row--compact { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px; }
.enh-search-btn--compact {
    min-height: 32px; padding: 6px 8px; justify-content: flex-start;
    background: color-mix(in srgb, var(--btn-color) 8%, ${t.sf1});
    border-color: color-mix(in srgb, var(--btn-color) 18%, ${t.bd1});
    font-size: 11px; text-align: left;
}
.enh-search-btn--compact:hover {
    background: color-mix(in srgb, var(--btn-color) 16%, ${t.sf2});
    border-color: color-mix(in srgb, var(--btn-color) 34%, ${t.accentBorder});
}
/* ════ External Links ════ */
#enh-external-links {
    min-width: 0; padding: 0 0 0 26px;
    border-left: 1px solid ${t.bd0};
}
.enh-external-links__header {
    display: flex; flex-wrap: wrap; align-items: baseline; gap: 9px;
    padding-bottom: 10px; border-bottom: 1px solid ${t.bd0};
}
.enh-external-links__title {
    color: ${t.tx0}; font: 700 18px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.enh-external-links__hint { color: ${t.tx3}; font: 500 11px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
.enh-external-groups { display: flex; flex-direction: column; }
.enh-external-group { display: flex; flex-direction: column; gap: 7px; min-width: 0; padding: 12px 0; border-bottom: 1px solid ${t.bd0}; }
.enh-external-group:last-child { border-bottom: 0; }
.enh-external-group__row { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; }
.enh-ext-link {
    padding: 7px 11px; border-radius: 7px;
    font: 600 11px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: ${t.tx1} !important;
    background: ${t.sf1}; border: 1px solid ${t.bd1};
    text-decoration: none !important;
    transition: background .15s ease, border-color .15s ease, color .15s ease, transform .15s cubic-bezier(.4,0,.2,1);
}
.enh-ext-link:hover {
    background: ${t.sf2};
    border-color: ${t.accentBorder};
    color: ${t.tx0} !important;
    transform: translateY(-1px);
}
#enh-external-links > #enh-trailer-btn,
#enh-external-links > #enh-link-menu-wrap {
    margin-top: 10px;
}

@media (max-width: 900px) {
    #enh-title-stack {
        grid-template-columns: minmax(0, 1fr);
        max-width: 100%;
        gap: 14px;
    }
    #enh-title-stack #enh-search-buttons,
    #enh-title-stack #enh-external-links,
    #enh-title-stack #enh-tv-bar,
    #enh-title-stack #enh-servarr-actions,
    #enh-title-stack #enh-media-server-status {
        grid-column: 1;
    }
    #enh-external-links {
        padding: 16px 0 0;
        border-left: 0;
        border-top: 1px solid ${t.bd0};
    }
}
@media (max-width: 560px) {
    .enh-search-row--compact { grid-template-columns: minmax(0, 1fr); }
    .enh-external-links__header { display: block; }
    .enh-external-links__hint { margin-top: 5px; }
}

/* ════ More Links trigger (lives in external-links row) ════ */
#enh-link-menu-wrap { position: relative; display: inline-flex; margin-left: auto; }
#enh-link-menu-wrap.enh-link-menu-wrap--standalone { width: auto; margin-left: 0; }
#enh-link-menu-trigger {
    padding: 4px 11px; border-radius: 6px;
    font: 600 11px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: ${t.tx1};
    background: ${t.sf1};
    border: 1px solid ${t.bd1};
    cursor: pointer;
    transition: background .15s ease, border-color .15s ease, color .15s ease, transform .15s cubic-bezier(.4,0,.2,1);
}
#enh-link-menu-trigger:hover {
    background: ${t.accentMuted};
    border-color: ${t.accentBorder};
    color: ${t.accent};
    transform: translateY(-1px);
}
#enh-link-menu-wrap .enh-link-dropdown:not([popover]) { left: auto; right: 0; }

/* ════ Expanded Link Dropdown ════ */
.enh-link-dropdown {
    box-sizing: border-box; position: absolute; top: calc(100% + 8px); left: 0; min-width: 340px;
    background: ${t.sf1}; border: 1px solid ${t.bd1};
    border-radius: 12px; padding: 14px 16px; z-index: 100000;
    box-shadow: ${t.sh3}; display: none;
}
.enh-link-dropdown.enh-visible { display: block; }
/* Only inside the @supports, because an anchored surface is never promoted on an
   engine that cannot anchor it — see showInTopLayer. The UA popover rules supply
   inset: 0, fit-content sizing, auto margins, a solid border, overflow and colours
   for every property the author sheet leaves unset, so each one is said again here.
   min-width alone gave the absolutely positioned menu its 340px; a top-layer box is
   measured against the viewport, so the ceiling has to be stated too. */
@supports (anchor-name: --enh-anchor-probe) {
    .enh-link-dropdown[popover] {
        position: fixed; inset: auto;
        top: anchor(bottom); right: anchor(right);
        width: auto; height: auto; max-width: 340px;
        margin: 8px 0 0; overflow: visible; color: inherit;
        position-try-fallbacks: flip-block;
    }
}
.enh-link-dropdown__cat {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .08em; color: ${t.tx3}; padding: 10px 0 4px;
    border-top: 1px solid ${t.bd0}; margin-top: 4px;
}
.enh-link-dropdown__cat:first-child { border-top: none; margin-top: 0; }
.enh-link-dropdown__row { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 4px; }
.enh-link-dropdown__item {
    padding: 4px 10px; border-radius: 6px;
    font: 500 11px/1.5 -apple-system, sans-serif;
    color: ${t.tx2} !important;
    background: ${t.sf0}; border: 1px solid ${t.bd0};
    text-decoration: none !important;
    transition: background .15s ease, border-color .15s ease, color .15s ease, transform .15s cubic-bezier(.4,0,.2,1);
}
.enh-link-dropdown__item:hover {
    background: ${t.accentMuted}; border-color: ${t.accentBorder};
    color: ${t.accent} !important; transform: translateY(-1px);
}

/* ════ Copy ID ════ */
#enh-copy-id {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 10px; margin-left: 10px;
    background: ${t.sf1}; border: 1px solid ${t.bd1};
    border-radius: 6px; cursor: pointer; color: ${t.tx2};
    font: 500 12px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    transition: background .15s ease, border-color .15s ease, color .15s ease; vertical-align: middle;
}
#enh-copy-id:hover {
    background: ${t.accentMuted}; border-color: ${t.accentBorder};
    color: ${t.accent};
}
#enh-copy-id svg { flex-shrink: 0; }

/* ════ Score Widgets ════ */
.enh-score-widget {
    display: inline-flex; flex-direction: column; align-items: center;
    padding: 12px 20px; min-width: 104px;
    border-left: 1px solid ${t.bd0}; position: relative;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.enh-score-widget--availability {
    min-width: 150px; max-width: 240px;
}
.enh-score-widget__label {
    font-size: 10px; font-weight: 600; letter-spacing: .05em;
    color: ${t.tx2}; margin-bottom: 4px; text-transform: uppercase;
}
.enh-score-widget__score {
    display: flex; align-items: center; gap: 4px; text-decoration: none !important;
    color: var(--score-color, ${t.tx2}) !important; font-size: 18px; font-weight: 800;
    transition: transform .15s cubic-bezier(.4,0,.2,1), opacity .15s ease;
}
.enh-score-widget__score:hover { transform: translateY(-1px); }
.enh-score-widget__score--availability {
    justify-content: center; max-width: 100%;
}
.enh-score-widget__value { color: var(--score-color, ${t.tx2}); }
.enh-score-widget__value--availability {
    max-width: 150px; white-space: normal; text-align: left;
    font-size: 12px; line-height: 1.25;
}
.enh-score-widget__badge {
    display: inline-block; padding: 2px 9px; border-radius: 6px;
    font-size: 16px; font-weight: 800; min-width: 34px; text-align: center;
}
.enh-score-widget__badge--outline {
    border: 1px solid currentColor;
    background: color-mix(in srgb, currentColor 10%, transparent);
    font-size: 11px;
    line-height: 1.4;
    min-width: 24px;
    padding: 2px 7px;
}
.enh-score-widget__sub { font-size: 10px; color: ${t.tx3}; margin-top: 2px; }
.enh-score-correction-trigger {
    margin-top: 5px; padding: 1px 5px; border: 0; border-radius: 4px;
    background: transparent; color: ${t.tx3}; cursor: pointer;
    font: 600 10px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    text-decoration: underline; text-underline-offset: 2px;
}
.enh-score-correction-trigger:hover { color: ${t.accent}; }
.enh-score-correction-trigger:focus-visible,
.enh-score-correction__close:focus-visible,
.enh-score-correction__button:focus-visible,
.enh-score-correction__choice:focus-visible,
.enh-score-correction__input:focus-visible { outline: 2px solid ${t.accent}; outline-offset: 2px; }
.enh-score-correction {
    box-sizing: border-box; position: absolute; top: calc(100% + 6px); right: 0; z-index: 100020;
    width: min(340px, calc(100vw - 28px)); padding: 12px;
    border: 1px solid ${t.bd1}; border-radius: 10px;
    background: ${t.sf1}; color: ${t.tx1}; box-shadow: ${t.sh3};
    text-align: left; font: 500 11px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
@supports (anchor-name: --enh-anchor-probe) {
    .enh-score-correction[popover] {
        position: fixed; inset: auto;
        top: anchor(bottom); left: anchor(left);
        height: auto; margin: 6px 0 0; overflow: visible;
        /* From the Wrong? link outwards, into the rail; anchoring the right edge of a
           340px panel to a 40px link put it across the action column instead. */
        position-try-fallbacks: flip-inline, flip-block;
    }
}
.enh-score-correction__header { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: ${t.tx0}; }
.enh-score-correction__close {
    width: 24px; height: 24px; padding: 0; border: 1px solid ${t.bd1}; border-radius: 6px;
    background: ${t.sf0}; color: ${t.tx2}; cursor: pointer; font: 600 17px/1 sans-serif;
}
.enh-score-correction__current,
.enh-score-correction__status { margin-top: 7px; color: ${t.tx2}; }
.enh-score-correction__choices { display: grid; gap: 5px; max-height: 170px; overflow: auto; margin-top: 8px; }
.enh-score-correction__choice {
    padding: 7px 8px; border: 1px solid ${t.bd0}; border-radius: 7px;
    background: ${t.sf0}; color: ${t.tx1}; cursor: pointer; text-align: left;
    font: 600 10px/1.35 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.enh-score-correction__choice:hover { border-color: ${t.accentBorder}; color: ${t.accent}; }
.enh-score-correction__label { display: grid; gap: 4px; margin-top: 10px; color: ${t.tx2}; font-weight: 650; }
.enh-score-correction__input {
    box-sizing: border-box; width: 100%; min-width: 0; padding: 7px 8px; border: 1px solid ${t.bd1}; border-radius: 7px;
    background: ${t.sf0}; color: ${t.tx0}; font: 500 10px/1.35 ui-monospace, monospace;
}
.enh-score-correction__input[aria-invalid="true"] { border-color: ${t.red}; }
.enh-score-correction__actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.enh-score-correction__button {
    padding: 5px 8px; border: 1px solid ${t.bd1}; border-radius: 6px;
    background: ${t.sf0}; color: ${t.tx1}; cursor: pointer;
    font: 650 10px/1.25 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.enh-score-correction__button:hover { border-color: ${t.accentBorder}; color: ${t.accent}; }
/* Required credit, not decoration: TMDB's terms mandate the disclaimer and their
   watch-provider endpoint mandates the JustWatch credit. Quiet, but present and
   readable rather than hidden behind a hover or clipped to one line. */
.enh-score-widget__attribution { font-size: 9px; line-height: 1.35; color: ${t.tx3}; margin-top: 4px; max-width: 260px; }
.enh-score-widget--muted { --score-color: ${t.tx2}; }
/* A value shown because its provider was unreachable says so and offers a retry, rather
   than presenting week-old data as current. */
.enh-score-widget--stale { opacity: .92; }
.enh-score-stale {
    display: flex; align-items: center; gap: 6px; margin-top: 4px;
    font: 500 9px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: ${t.tx3};
}
${scopedRules('.enh-collection', {
    '': `margin: 20px 0; padding: 14px 16px; border: 1px solid ${t.bd1};
        border-radius: 12px; background: ${t.sf0};`,
    '.enh-collection__header': 'display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px; margin-bottom: 8px;',
    '.enh-collection__title': `margin: 0; font-size: 15px; color: ${t.tx0};`,
    '.enh-collection__note': `font-size: 12px; color: ${t.tx3};`,
    '.enh-collection__list': `margin: 0; padding-left: 22px; color: ${t.tx2};`,
    '.enh-collection__item': 'padding: 3px 0;',
    '.enh-collection__item--current': `color: ${t.tx0}; font-weight: 700;`,
    '.enh-collection__link': `color: ${t.tx2};`,
    '.enh-collection__link:hover': `color: ${t.accent};`,
})}
.enh-settings-inline-choice {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin: 0 12px 6px 0;
    color: ${t.tx2};
    font-size: 13px;
}
${scopedRules('.enh-moviechat', {
    '': `margin: 20px 0; padding: 14px 16px; border: 1px solid ${t.bd1};
        border-radius: 12px; background: ${t.sf0};`,
    '.enh-moviechat__header': 'display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px; margin-bottom: 10px;',
    '.enh-moviechat__title': `margin: 0; font-size: 15px; color: ${t.tx0};`,
    '.enh-moviechat__note': `font-size: 12px; color: ${t.tx3};`,
    '.enh-moviechat__link': `margin-left: auto; font-size: 13px; color: ${t.accent};`,
    '.enh-moviechat__frame': `display: block; width: 100%; height: 640px; border: 0;
        border-radius: 8px; background: ${t.bg};`,
})}
${scopedRules('.enh-zoom', {
    '': `position: absolute; z-index: 2147483000; pointer-events: none; padding: 6px;
        border-radius: 10px; background: ${t.sf1}; border: 1px solid ${t.bd1};
        box-shadow: ${t.sh3};`,
    '.enh-zoom__image': `display: block; max-width: min(46vw, 520px); max-height: 78vh;
        width: auto; height: auto; border-radius: 6px;`,
})}
@media (prefers-reduced-motion: no-preference) {
    .enh-zoom { animation: enh-zoom-in .12s ease-out; }
    @keyframes enh-zoom-in { from { opacity: 0; } to { opacity: 1; } }
}
@supports (anchor-name: --enh-anchor-probe) {
    .enh-zoom[popover] {
        position: fixed; inset: auto;
        left: anchor(right); top: anchor(top);
        width: auto; height: auto;
        margin: 0 0 0 12px; border-width: 1px; overflow: visible; color: inherit;
        /* The side with room, decided by the engine rather than by measuring. */
        position-try-fallbacks: flip-inline, flip-block;
    }
}
.enh-score-stale__retry {
    padding: 2px 6px; border-radius: 5px; cursor: pointer;
    border: 1px solid ${t.bd1}; background: ${t.sf0}; color: ${t.tx2};
    font: 650 9px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.enh-score-stale__retry:hover { border-color: ${t.accentBorder}; color: ${t.accent}; }
.enh-score-stale__retry:focus-visible { outline: 2px solid ${t.accent}; outline-offset: 2px; }
.enh-score-widget__skeleton {
    width: 58px; height: 24px; border-radius: 6px;
    background: linear-gradient(90deg, ${t.sf1}, ${t.sf2}, ${t.sf1});
    background-size: 180% 100%;
    animation: enh-shimmer 1.1s ease-in-out infinite;
}
@keyframes enh-shimmer {
    0% { background-position: 120% 0; }
    100% { background-position: -120% 0; }
}
.enh-histogram-chart {
    display: flex; align-items: flex-end; gap: 2px; height: 36px; min-width: 80px;
}
.enh-histogram-col {
    flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%;
    justify-content: flex-end; cursor: default;
}
.enh-histogram-bar {
    width: 100%; min-width: 5px; border-radius: 2px 2px 0 0;
    background: ${t.accent}; opacity: .7;
    transition: opacity .15s ease;
}
.enh-histogram-col:hover .enh-histogram-bar { opacity: 1; }
.enh-histogram-label {
    font: 600 8px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: ${t.tx3}; margin-top: 2px;
}

/* ════ Settings Overlay ════ */
#enh-settings-overlay {
    position: fixed; inset: 0;
    z-index: 2147483640; opacity: 0; visibility: hidden;
    background: ${t.scrim};
    transition: opacity .22s ease, visibility 0s linear .22s; pointer-events: none;
}
#enh-settings-overlay.enh-visible {
    opacity: 1; visibility: visible; pointer-events: auto;
    transition-delay: 0s;
}
/* Promoted into the top layer while open, so a popover raised earlier (a Wrong?
   panel, the link menu) cannot paint over the modal. The UA popover box is restated
   for every property the rule above leaves unset. */
#enh-settings-overlay[popover] {
    width: auto; height: auto; margin: 0; border: 0; padding: 0;
    overflow: visible; color: inherit;
}

/* ════ Settings Panel ════ */
#enh-settings-panel {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%) scale(0.985);
    background: ${t.sf0}; color: ${t.tx1};
    border: 1px solid ${t.bd1};
    border-radius: 16px; z-index: 2147483641;
    width: min(1120px, calc(100vw - 48px));
    height: min(850px, calc(100vh - 40px));
    box-shadow: ${t.sh3};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    opacity: 0;
    transition: transform .22s cubic-bezier(.4,0,.2,1), opacity .2s ease;
    overflow: hidden; display: flex; flex-direction: column;
}
#enh-settings-overlay.enh-visible #enh-settings-panel {
    transform: translate(-50%, -50%) scale(1); opacity: 1;
}
.enh-settings-header {
    display: flex; justify-content: space-between; align-items: center;
    min-height: 72px;
    padding: 18px 22px;
    border-bottom: 1px solid ${t.bd0}; flex-shrink: 0;
    background: color-mix(in srgb, ${t.sf1} 34%, ${t.sf0});
}
.enh-settings-header h2 {
    font-size: 17px; font-weight: 780; margin: 0;
    color: ${t.tx0}; letter-spacing: -0.015em;
}
.enh-settings-subtitle {
    margin: 3px 0 0;
    color: ${t.tx2};
    font-size: 11px;
    line-height: 1.35;
}
.enh-settings-header-actions {
    display: flex; align-items: center; gap: 12px;
}
.enh-settings-save-state {
    display: inline-flex; align-items: center; gap: 7px;
    color: ${t.tx2};
    font-size: 11px; font-weight: 600;
}
.enh-settings-save-state::before {
    content: ''; width: 7px; height: 7px; border-radius: 50%;
    background: ${t.green}; box-shadow: 0 0 0 3px color-mix(in srgb, ${t.green} 14%, transparent);
}
.enh-settings-save-state--error { color: ${t.red}; }
.enh-settings-save-state--error::before {
    background: ${t.red}; box-shadow: 0 0 0 3px color-mix(in srgb, ${t.red} 14%, transparent);
}
.enh-settings-close {
    background: ${t.sf1}; border: 1px solid ${t.bd1};
    width: 34px; height: 34px; padding: 0; border-radius: 9px;
    color: ${t.tx2}; cursor: pointer;
    font: 500 22px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    display: flex; align-items: center; justify-content: center;
    transition: background .15s ease, border-color .15s ease, color .15s ease;
}
.enh-settings-close:hover { background: ${t.sf2}; color: ${t.tx0}; border-color: ${t.bd2}; }

.enh-settings-shell { display: flex; min-height: 0; flex: 1; }
.enh-settings-nav {
    width: 216px; flex: 0 0 216px;
    padding: 18px 12px;
    background: color-mix(in srgb, ${t.sf1} 54%, ${t.sf0});
    border-right: 1px solid ${t.bd0};
}
.enh-settings-nav-btn {
    position: relative; width: 100%; min-height: 42px;
    display: flex; align-items: center;
    padding: 0 14px 0 18px; margin: 3px 0;
    border: 0; border-radius: 8px;
    background: transparent; color: ${t.tx2}; cursor: pointer;
    font: 650 13px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    text-align: left;
    transition: background .15s ease, color .15s ease, transform .15s ease;
}
.enh-settings-nav-btn::after {
    content: ''; width: 5px; height: 5px; margin-right: 11px; order: -1;
    border-radius: 50%; background: ${t.tx3}; opacity: .55;
    transition: background .15s ease, box-shadow .15s ease, opacity .15s ease;
}
.enh-settings-nav-btn:hover { background: ${t.sf1}; color: ${t.tx0}; transform: translateX(1px); }
.enh-settings-nav-btn[aria-selected="true"] {
    background: ${t.sf2}; color: ${t.tx0};
}
.enh-settings-nav-btn[aria-selected="true"]::before {
    content: ''; position: absolute; left: 0; top: 8px; bottom: 8px;
    width: 3px; border-radius: 2px; background: ${t.accent};
}
.enh-settings-nav-btn[aria-selected="true"]::after {
    background: ${t.accent}; opacity: 1; box-shadow: 0 0 0 3px ${t.accentMuted};
}
.enh-settings-main { min-width: 0; flex: 1; overflow: hidden; }
.enh-settings-body { height: 100%; padding: 28px 30px 34px; overflow-y: auto; }
.enh-settings-page[hidden] { display: none !important; }
.enh-settings-page-header { margin: 0 0 22px; }
.enh-settings-page-title {
    margin: 0; color: ${t.tx0};
    font: 780 26px/1.15 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    letter-spacing: -.025em;
}
.enh-settings-page-description {
    margin: 6px 0 0; color: ${t.tx2};
    font: 500 13px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.enh-settings-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.enh-settings-grid--three { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.enh-settings-grid--experience { grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr); align-items: start; }
.enh-settings-stack { display: flex; flex-direction: column; gap: 14px; }
.enh-settings-card {
    min-width: 0; padding: 18px;
    border: 1px solid ${t.bd1}; border-radius: 12px;
    background: color-mix(in srgb, ${t.sf1} 78%, ${t.sf0});
}
.enh-settings-card--flush { padding: 0; overflow: hidden; }
.enh-settings-card--span { grid-column: 1 / -1; }
.enh-settings-card-header {
    display: flex; justify-content: space-between; align-items: flex-start;
    gap: 12px; margin-bottom: 12px;
}
.enh-settings-card-title {
    color: ${t.tx0};
    font: 740 16px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.enh-settings-card-description {
    margin-top: 3px; color: ${t.tx3};
    font: 500 11px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.enh-settings-card-actions { display: flex; align-items: center; gap: 8px; }
.enh-settings-route-badge {
    flex-shrink: 0; padding: 4px 7px; border-radius: 6px;
    background: ${t.sf2}; color: ${t.tx2};
    font: 700 9px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    text-transform: uppercase; letter-spacing: .05em;
}

.enh-settings-group-label {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .08em; color: ${t.tx3};
    padding: 16px 0 6px;
}
.enh-settings-row {
    display: flex; align-items: center; justify-content: space-between;
    min-height: 54px; padding: 9px 0; gap: 12px;
    border-bottom: 1px solid ${t.bd0};
}
.enh-settings-row:last-child { border-bottom: none; }
.enh-settings-label { font-size: 13px; font-weight: 650; color: ${t.tx1}; }
.enh-settings-row-copy { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.enh-settings-help { font-size: 11px; line-height: 1.4; color: ${t.tx3}; max-width: 440px; }
.enh-settings-card--compact .enh-settings-row { min-height: 42px; padding: 6px 0; }
.enh-settings-card--compact .enh-settings-help,
.enh-settings-page--experience .enh-settings-help {
    /* Hidden from view to keep these dense cards short, but still reachable: the row
       carries it as a tooltip and each toggle points at it with aria-describedby. */
    position: absolute; width: 1px; height: 1px; padding: 0;
    overflow: hidden; clip-path: inset(50%); white-space: nowrap;
}

/* Toggle switch */
.enh-journal {
    max-height: 168px;
    overflow: auto;
    margin: 0;
    padding: 10px;
    border: 1px solid ${t.bd1};
    border-radius: 8px;
    background: ${t.bg};
    color: ${t.tx2};
    font: 400 11px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    white-space: pre;
}
.enh-journal:focus-visible { outline: 2px solid ${t.accent}; outline-offset: 2px; }
.enh-settings-access {
    display: block;
    margin-top: 4px;
    font: 500 10px/1.35 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: ${t.tx3};
}
.enh-settings-access[data-state="granted"] { color: ${t.green}; }
.enh-settings-access[data-state="missing"] { color: ${t.accent}; }
.enh-settings-access:empty { display: none; }
.enh-settings-access-btn {
    margin-top: 5px;
    height: 24px;
    padding: 0 10px;
    border-radius: 7px;
    border: 1px solid ${t.accentBorder};
    background: ${t.accentMuted};
    color: ${t.accent};
    cursor: pointer;
    font: 650 10px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.enh-settings-access-btn:hover { background: ${t.accent}; color: ${readableTextColor(t.accent)}; }
.enh-settings-access-btn:focus-visible { outline: 2px solid ${t.accent}; outline-offset: 2px; }
/* Toggled with the hidden property, and this rule has to outrank the display above. */
.enh-settings-access-btn[hidden] { display: none; }
.enh-toggle { position: relative; width: 40px; height: 22px; flex-shrink: 0; }
.enh-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
.enh-toggle-track {
    position: absolute; inset: 0;
    background: ${t.sf2}; border-radius: 999px;
    box-sizing: border-box; border: 1px solid ${t.bd1};
    transition: background .2s ease, border-color .2s ease; cursor: pointer;
}
.enh-toggle-track::after {
    content: ''; position: absolute; top: 2px; left: 2px;
    width: 18px; height: 18px;
    background: ${t.tx3}; border-radius: 50%;
    transition: transform .2s cubic-bezier(.4,0,.2,1), background .2s ease;
}
.enh-toggle input:checked + .enh-toggle-track { background: ${t.accentMuted}; border-color: ${t.accentBorder}; }
.enh-toggle input:checked + .enh-toggle-track::after {
    transform: translateX(18px); background: ${t.accent};
}
.enh-toggle input:focus-visible + .enh-toggle-track {
    outline: 2px solid ${t.accent};
    outline-offset: 2px;
}

/* ════ Theme Swatches ════ */
.enh-theme-selector { display: grid; grid-template-columns: repeat(5, minmax(64px, 1fr)); gap: 12px; margin-top: 14px; }
.enh-theme-option { display: flex; flex-direction: column; gap: 6px; color: ${t.tx2}; font-size: 10px; text-align: center; }
.enh-theme-swatch {
    width: 100%; height: 54px; border-radius: 10px; cursor: pointer;
    border: 2px solid transparent;
    padding: 0;
    appearance: none;
    transition: border-color .15s ease, box-shadow .15s ease, transform .15s cubic-bezier(.4,0,.2,1); position: relative;
    box-shadow: inset 0 0 0 1px ${t.bd1};
}
.enh-theme-swatch.active { border-color: ${t.accent}; box-shadow: 0 0 12px ${t.accentMuted}; }
.enh-theme-swatch:hover { transform: translateY(-1px); }
.enh-theme-auto-row { margin-top: 14px; padding-top: 14px; border-top: 1px solid ${t.bd0}; }
.enh-settings-page--experience .enh-settings-card { padding: 18px; }
.enh-settings-page--experience .enh-settings-card--compact .enh-settings-row { min-height: 45px; padding: 6px 0; }
.enh-settings-page--experience .enh-settings-grid--experience { gap: 14px; }

.enh-score-preview { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); }
.enh-score-preview-item { padding: 14px 10px; text-align: center; border-right: 1px solid ${t.bd0}; }
.enh-score-preview-item:last-child { border-right: 0; }
.enh-score-preview-value { color: ${t.tx0}; font-size: 18px; font-weight: 800; }
.enh-score-preview-label { margin-top: 4px; color: ${t.tx3}; font-size: 10px; }
.enh-settings-callout {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 14px; border: 1px solid ${t.bd1}; border-radius: 10px;
    background: color-mix(in srgb, ${t.sf1} 72%, ${t.sf0}); color: ${t.tx2}; font-size: 11px; line-height: 1.45;
}
.enh-settings-callout strong { color: ${t.tx0}; white-space: nowrap; }
/* Spacing lives here rather than on each call site. */
.enh-settings-callout + *, * + .enh-settings-callout { margin-top: 12px; }
.enh-settings-kbd {
    display: inline-flex; min-width: 26px; min-height: 26px; align-items: center; justify-content: center;
    padding: 0 7px; border: 1px solid ${t.bd2}; border-radius: 6px;
    background: ${t.sf0}; color: ${t.tx1}; font: 700 11px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
}
.enh-data-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 12px; }
.enh-data-summary-item { padding: 14px; border: 1px solid ${t.bd1}; border-radius: 10px; background: ${t.sf1}; }
.enh-data-summary-label { color: ${t.tx0}; font-size: 13px; font-weight: 700; }
.enh-data-summary-value { margin-top: 4px; color: ${t.tx2}; font-size: 11px; }
.enh-stats-card { margin-bottom: 12px; }
.enh-stats-overview { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.enh-stats-metric { padding: 10px; border: 1px solid ${t.bd0}; border-radius: 9px; background: ${t.sf0}; }
.enh-stats-metric__value { color: ${t.tx0}; font: 750 20px/1.1 -apple-system, sans-serif; }
.enh-stats-metric__label { margin-top: 4px; color: ${t.tx3}; font: 600 10px/1.3 -apple-system, sans-serif; text-transform: uppercase; letter-spacing: .05em; }
.enh-stats-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
.enh-stats-group { min-width: 0; padding: 10px; border: 1px solid ${t.bd0}; border-radius: 9px; background: ${t.sf0}; }
.enh-stats-group h4 { margin: 0 0 8px; color: ${t.tx1}; font: 700 11px/1.3 -apple-system, sans-serif; }
.enh-stats-row { display: grid; grid-template-columns: minmax(48px, auto) minmax(50px, 1fr) auto; gap: 7px; align-items: center; min-height: 23px; color: ${t.tx2}; font: 550 10px/1.2 -apple-system, sans-serif; }
.enh-stats-row__label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.enh-stats-row__track { height: 5px; overflow: hidden; border-radius: 999px; background: ${t.bd1}; }
.enh-stats-row__fill { height: 100%; border-radius: inherit; background: ${t.accent}; }
.enh-stats-row__count { color: ${t.tx1}; font-variant-numeric: tabular-nums; }
.enh-stats-empty,
.enh-marks-empty { padding: 18px; border: 1px dashed ${t.bd1}; border-radius: 9px; color: ${t.tx2}; font: 500 12px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: ${t.sf0}; }
.enh-stats-insights { margin-top: 10px; color: ${t.tx2}; font: 500 11px/1.45 -apple-system, sans-serif; }
.enh-stats-insights strong { color: ${t.tx1}; }
@media (max-width: 1000px) {
    .enh-stats-grid { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 680px) {
    .enh-stats-overview { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

/* ════ Settings Footer ════ */
.enh-settings-footer {
    min-height: 42px; padding: 9px 22px; border-top: 1px solid ${t.bd0};
    display: flex; justify-content: space-between; align-items: center;
    flex-shrink: 0; gap: 8px;
}
.enh-settings-footer span { font-size: 11px; color: ${t.tx3}; }
.enh-settings-footer-actions { display: flex; gap: 6px; }
.enh-settings-footer-btn {
    min-height: 32px; padding: 6px 12px; border-radius: 8px;
    font: 650 11px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: ${t.sf1}; border: 1px solid ${t.bd1};
    color: ${t.tx2}; cursor: pointer;
    transition: background .15s ease, border-color .15s ease, color .15s ease, transform .15s cubic-bezier(.4,0,.2,1);
}
.enh-settings-footer-btn:hover { background: ${t.sf2}; color: ${t.tx0}; border-color: ${t.bd2}; }
.enh-settings-footer-btn:active:not(:disabled) { transform: translateY(1px); }
.enh-settings-footer-btn:disabled { opacity: .45; cursor: not-allowed; }
.enh-settings-footer-btn--danger { color: ${t.red}; }
.enh-settings-footer-note { text-align: right; line-height: 1.35; }
.enh-data-actions { display: grid; gap: 8px; }
.enh-data-actions .enh-settings-footer-btn { width: 100%; text-align: left; }
.enh-import-panel {
    margin: 12px 0 0;
    padding: 12px;
    border: 1px solid ${t.bd1};
    border-radius: 10px;
    background: ${t.sf1};
}
.enh-backup-passphrase { margin-top: 10px; display: flex; flex-direction: column; gap: 4px; }
/* The UA's [hidden] rule loses to the display above, so the passphrase row would be
   permanently visible. Same defect as the catalog entries. */
.enh-backup-passphrase[hidden] { display: none; }
.enh-backup-passphrase .enh-import-label { margin-bottom: 2px; }
.enh-backup-passphrase .enh-servarr-input { width: 100%; }
.enh-import-label {
    display: block;
    margin-bottom: 8px;
    color: ${t.tx1};
    font: 600 12px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.enh-import-textarea {
    width: 100%;
    min-height: 116px;
    resize: vertical;
    border-radius: 8px;
    border: 1px solid ${t.bd1};
    background: ${t.bg};
    color: ${t.tx1};
    padding: 10px;
    font: 500 12px/1.45 ui-monospace, SFMono-Regular, Consolas, monospace;
    outline: none;
}
.enh-import-textarea:focus { border-color: ${t.accentBorder}; box-shadow: 0 0 0 2px ${t.accentMuted}; }
.enh-import-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
.enh-csv-file { width: 100%; color: ${t.tx2}; font: 500 11px/1.4 -apple-system, sans-serif; }
.enh-csv-file::file-selector-button {
    min-height: 30px; margin-right: 8px; padding: 5px 10px; border-radius: 7px;
    border: 1px solid ${t.bd1}; background: ${t.sf2}; color: ${t.tx1}; cursor: pointer;
}
.enh-csv-file:focus-visible { outline: 2px solid ${t.accent}; outline-offset: 2px; border-radius: 7px; }
.enh-csv-preview { min-height: 34px; margin-top: 8px; color: ${t.tx2}; font-size: 11px; line-height: 1.45; }

/* ════ Site Editors ════ */
.enh-sites-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.enh-sites-grid--single { grid-template-columns: minmax(0, 1fr); }
.enh-site-editor {
    margin: 0;
    padding: 0;
    border: 1px solid ${t.bd1};
    border-radius: 12px;
    background: color-mix(in srgb, ${t.sf1} 78%, ${t.sf0});
    min-width: 0;
    overflow: hidden;
}
.enh-site-editor__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 16px 18px 12px;
    border-bottom: 1px solid ${t.bd0};
}
.enh-site-editor__title {
    color: ${t.tx0};
    font: 740 16px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.enh-site-editor__title-wrap { display: flex; align-items: center; gap: 8px; min-width: 0; }
.enh-site-editor__actions { display: flex; gap: 6px; flex-shrink: 0; }
.enh-site-editor__hint { margin: 0; padding: 10px 18px; color: ${t.tx3}; font: 500 11px/1.35 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; border-bottom: 1px solid ${t.bd0}; }
.enh-site-editor__columns,
.enh-site-row {
    display: grid;
    grid-template-columns: 42px minmax(120px, .7fr) minmax(150px, .85fr) minmax(240px, 1.4fr) 36px 58px 58px;
    gap: 8px;
    align-items: center;
}
.enh-site-editor__columns {
    padding: 10px 18px 8px;
    color: ${t.tx3};
    font: 700 9px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    letter-spacing: .06em;
    text-transform: uppercase;
    border-bottom: 1px solid ${t.bd0};
}
.enh-site-editor__rows { display: flex; flex-direction: column; gap: 0; max-height: 380px; overflow: auto; padding: 0 18px; }
.enh-site-row {
    min-height: 52px;
    border-bottom: 1px solid ${t.bd0};
}
.enh-site-row:last-child { border-bottom: 0; }
.enh-site-input {
    min-width: 0;
    height: 30px;
    border-radius: 7px;
    border: 1px solid ${t.bd1};
    background: ${t.bg};
    color: ${t.tx1};
    padding: 0 8px;
    font: 500 11px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    outline: none;
}
.enh-site-select { appearance: auto; padding: 0 5px; }
.enh-site-visibility { display: inline-flex; align-items: center; justify-content: center; min-width: 30px; height: 30px; cursor: pointer; }
.enh-site-enabled { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
.enh-site-visibility__dot { width: 16px; height: 16px; border-radius: 5px; border: 1px solid ${t.bd2}; background: ${t.sf0}; box-shadow: inset 0 0 0 3px ${t.sf0}; transition: background .15s ease, border-color .15s ease, box-shadow .15s ease; }
.enh-site-enabled:checked + .enh-site-visibility__dot { background: ${t.accent}; border-color: ${t.accent}; box-shadow: inset 0 0 0 3px ${t.sf0}; }
.enh-site-enabled:focus-visible + .enh-site-visibility__dot { outline: 2px solid ${t.accent}; outline-offset: 2px; }
.enh-site-order { display: inline-flex; gap: 3px; }
.enh-site-order-btn { width: 27px; height: 30px; padding: 0; border-radius: 7px; border: 1px solid ${t.bd1}; background: ${t.sf0}; color: ${t.tx2}; cursor: pointer; font: 700 13px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
.enh-site-order-btn:hover:not(:disabled) { background: ${t.sf2}; color: ${t.tx0}; border-color: ${t.bd2}; }
.enh-site-order-btn:disabled { opacity: .45; cursor: not-allowed; }
.enh-site-color {
    width: 34px;
    height: 30px;
    border: 1px solid ${t.bd1};
    border-radius: 7px;
    background: ${t.bg};
    padding: 2px;
    cursor: pointer;
}
.enh-site-remove {
    min-width: 58px;
    height: 30px;
    border-radius: 7px;
    border: 1px solid ${t.bd1};
    background: ${t.sf0};
    color: ${t.tx2};
    cursor: pointer;
    font: 650 10px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.enh-site-remove:hover { background: ${t.sf2}; color: ${t.tx0}; }
.enh-site-catalog {
    margin: 10px 18px 14px;
    border: 1px solid ${t.bd1};
    border-radius: 10px;
    background: ${t.sf0};
}
.enh-site-catalog__summary {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    cursor: pointer;
    color: ${t.tx1};
    font: 650 11px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    list-style: none;
}
.enh-site-catalog__summary::-webkit-details-marker { display: none; }
.enh-site-catalog__summary::before { content: '▸'; color: ${t.tx3}; transition: transform .15s ease; }
.enh-site-catalog[open] > .enh-site-catalog__summary::before { transform: rotate(90deg); }
.enh-site-catalog__summary:focus-visible { outline: 2px solid ${t.accent}; outline-offset: -2px; border-radius: 10px; }
.enh-site-catalog__body { padding: 0 14px 12px; }
.enh-site-catalog__filter { width: 100%; margin-bottom: 8px; }
.enh-site-catalog__groups { max-height: 320px; overflow: auto; display: flex; flex-direction: column; gap: 10px; }
.enh-site-catalog__group-label {
    color: ${t.tx3};
    font: 700 9px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    letter-spacing: .06em;
    text-transform: uppercase;
    padding: 2px 0;
}
.enh-site-catalog__entry {
    display: grid;
    grid-template-columns: minmax(110px, .8fr) minmax(120px, 1fr) 58px;
    gap: 8px;
    align-items: center;
    min-height: 32px;
    border-bottom: 1px solid ${t.bd0};
    padding: 2px 0;
}
/* The UA's [hidden] rule loses to the display above, so filtering would leave every
   entry of a matching group on screen. Restate it at this specificity. */
.enh-site-catalog__entry[hidden] { display: none; }
.enh-site-catalog__entry:last-child { border-bottom: 0; }
.enh-site-catalog__name { color: ${t.tx1}; font: 550 11px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; overflow-wrap: anywhere; }
.enh-site-catalog__host { color: ${t.tx3}; font: 450 10px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; overflow-wrap: anywhere; }
.enh-site-catalog__add {
    min-width: 58px;
    height: 26px;
    border-radius: 7px;
    border: 1px solid ${t.bd1};
    background: ${t.sf1};
    color: ${t.tx1};
    cursor: pointer;
    font: 650 10px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.enh-site-catalog__add:hover:not(:disabled) { background: ${t.sf2}; color: ${t.tx0}; border-color: ${t.bd2}; }
.enh-site-catalog__add:disabled { opacity: .45; cursor: not-allowed; }
.enh-site-catalog__empty { color: ${t.tx3}; font: 500 11px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 6px 0; }
.enh-site-input:focus,
.enh-site-color:focus {
    border-color: ${t.accentBorder};
    box-shadow: 0 0 0 2px ${t.accentMuted};
}
.enh-site-input--invalid,
.enh-site-input--invalid:focus {
    border-color: ${t.red};
    box-shadow: 0 0 0 2px ${t.redMuted};
}
@media (max-width: 900px) {
    .enh-site-editor__columns,
    .enh-site-row { grid-template-columns: 34px minmax(100px, .7fr) minmax(130px, .85fr) minmax(190px, 1.35fr) 34px 54px 54px; }
}
@media (max-width: 1100px) {
    #enh-settings-panel { width: min(1120px, calc(100vw - 28px)); }
    .enh-settings-body { padding-left: 20px; padding-right: 20px; }
    .enh-site-editor__columns,
    .enh-site-row { grid-template-columns: 34px minmax(100px, .7fr) minmax(125px, .8fr) minmax(180px, 1.2fr) 32px 52px 52px; gap: 6px; }
}
@media (max-width: 820px) {
    #enh-settings-panel { height: min(850px, calc(100vh - 24px)); }
    .enh-settings-nav { width: 174px; flex-basis: 174px; }
    .enh-settings-body { padding: 22px 16px 28px; }
    .enh-settings-grid--three,
    .enh-integration-summary,
    .enh-integration-grid { grid-template-columns: minmax(0, 1fr); }
    .enh-site-editor__columns,
    .enh-site-row { grid-template-columns: 32px minmax(90px, .7fr) minmax(116px, .8fr) minmax(150px, 1.15fr) 30px 48px 50px; gap: 5px; }
}

/* ════ Mark Review Panel ════ */
.enh-marks-panel {
    margin: 0;
    padding: 14px;
    border: 1px solid ${t.bd1};
    border-radius: 10px;
    background: ${t.sf1};
}
.enh-marks-panel__header {
    display: flex; justify-content: space-between; align-items: center;
    gap: 10px; margin-bottom: 10px;
}
.enh-marks-panel__title { color: ${t.tx1}; font: 700 12px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
.enh-marks-panel__count { color: ${t.tx3}; font: 600 11px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
.enh-marks-panel__rows { display: flex; flex-direction: column; gap: 6px; max-height: 220px; overflow: auto; }
.enh-mark-row {
    display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto;
    gap: 6px; align-items: center;
    padding: 7px; border: 1px solid ${t.bd0}; border-radius: 8px;
    background: ${t.sf0};
}
.enh-mark-row__title { min-width: 0; color: ${t.tx1}; font: 600 11px/1.25 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.enh-mark-row__id { color: ${t.tx3}; font-weight: 500; margin-left: 4px; }
.enh-mark-row__state {
    padding: 3px 7px; border-radius: 6px;
    background: ${t.accentMuted}; color: ${t.accent};
    font: 800 10px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    text-transform: uppercase; letter-spacing: .04em;
}
.enh-mark-row__state--skip { background: ${t.redMuted}; color: ${t.red}; }
.enh-mark-row__link {
    color: ${t.blue} !important; text-decoration: none !important;
    font: 700 11px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.enh-mark-row__clear {
    min-width: 58px; height: 28px; padding: 0 8px; border-radius: 7px;
    border: 1px solid ${t.bd1}; background: ${t.sf1}; color: ${t.tx2};
    cursor: pointer; font: 650 10px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.enh-mark-row__clear:hover { border-color: ${t.red}; color: ${t.red}; }
.enh-mark-row__state--note { background: ${t.blueMuted}; color: ${t.blue}; }
/* Sits inside the row and spans every column, so it reads as part of that entry without
   a negative margin — the layout guard rejects those, and rightly. */
.enh-mark-row__note {
    grid-column: 1 / -1;
    margin: 2px 0 0; padding: 6px 9px;
    border: 1px solid ${t.bd0}; border-radius: 6px;
    background: ${t.bg}; color: ${t.tx2};
    font: 400 11px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    white-space: pre-wrap; overflow-wrap: anywhere;
}

/* ════ Servarr Settings ════ */
.enh-integration-summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.enh-integration-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; align-items: start; }
.enh-integration-card { min-width: 0; }
.enh-integration-card > .enh-servarr-panel {
    margin-top: 8px; padding: 0; border: 0; border-radius: 0; background: transparent;
}
.enh-integration-card .enh-servarr-grid { gap: 6px; }
.enh-integration-card .enh-servarr-section + .enh-servarr-section { margin-top: 10px; padding-top: 10px; }
.enh-integration-card .enh-servarr-input { height: 28px; }
.enh-integration-tabs {
    display: flex; gap: 4px; margin: 0 0 10px; padding-bottom: 8px;
    border-bottom: 1px solid ${t.bd0};
}
.enh-integration-tab {
    min-height: 30px; padding: 0 10px; border: 0; border-radius: 6px;
    background: transparent; color: ${t.tx2}; cursor: pointer;
    font: 650 11px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.enh-integration-tab:hover { background: ${t.sf2}; color: ${t.tx0}; }
.enh-integration-tab[aria-selected="true"] {
    background: ${t.accentMuted}; color: ${t.accent};
}
.enh-servarr-panel {
    margin: 0;
    padding: 14px 0 0;
    border: 1px solid ${t.bd1};
    border-radius: 10px;
    background: ${t.sf1};
}
.enh-servarr-section + .enh-servarr-section { margin-top: 14px; padding-top: 14px; border-top: 1px solid ${t.bd0}; }
.enh-servarr-title { color: ${t.tx1}; font: 700 12px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin-bottom: 8px; }
.enh-servarr-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.enh-servarr-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
/* The rule above outranks the user agent's [hidden] rule, so hiding one of these needs
   saying explicitly. Without it the TMDB token field shows whichever source is chosen. */
.enh-servarr-field[hidden] { display: none; }
.enh-servarr-field--wide { grid-column: 1 / -1; }
.enh-servarr-field label { color: ${t.tx2}; font: 700 10px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; text-transform: uppercase; letter-spacing: .04em; }
.enh-servarr-input {
    min-width: 0; height: 30px; border-radius: 7px;
    border: 1px solid ${t.bd1}; background: ${t.bg}; color: ${t.tx1};
    padding: 0 8px; font: 500 11px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    outline: none;
}
.enh-servarr-input:focus { border-color: ${t.accentBorder}; box-shadow: 0 0 0 2px ${t.accentMuted}; }
.enh-servarr-note { margin-top: 10px; color: ${t.tx3}; font: 500 11px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

/* ════ FAB ════ */
#enh-settings-fab {
    position: fixed; bottom: 20px; left: 20px;
    width: 44px; height: 44px;
    background: ${t.sf1}; border: 1px solid ${t.bd1};
    border-radius: 12px; cursor: pointer; z-index: 2147483630;
    display: flex; align-items: center; justify-content: center;
    color: ${t.tx2};
    box-shadow: ${t.sh2};
    transition: background .2s ease, border-color .2s ease, color .2s ease, transform .2s cubic-bezier(.4,0,.2,1), box-shadow .2s ease;
}
#enh-settings-fab:hover {
    background: ${t.sf2}; border-color: ${t.accentBorder};
    color: ${t.accent}; transform: translateY(-2px);
    box-shadow: ${t.sh3};
}
.enh-search-btn:focus-visible,
.enh-multi-search-btn:focus-visible,
.enh-servarr-btn:focus-visible,
.enh-watch-options__summary:focus-visible,
.enh-mark-row__link:focus-visible,
.enh-ext-link:focus-visible,
.enh-editorial-action:focus-visible,
.enh-editorial-subnav__link:focus-visible,
.enh-editorial-detail-row a:focus-visible,
.enh-editorial-about-link:focus-visible,
#enh-trailer-btn:focus-visible,
.enh-trailer-close:focus-visible,
#enh-watchlist-copy:focus-visible,
#enh-link-menu-trigger:focus-visible,
.enh-link-dropdown__item:focus-visible,
#enh-copy-id:focus-visible,
.enh-mark-btn:focus-visible,
.enh-mark-row__clear:focus-visible,
.enh-collapse-btn:focus-visible,
.enh-qn-dot:focus-visible,
.enh-tv-chip:focus-visible,
.enh-best-episode__title:focus-visible,
.enh-site-remove:focus-visible,
.enh-site-order-btn:focus-visible,
.enh-site-visibility:focus-within,
.enh-site-select:focus-visible,
.enh-integration-tab:focus-visible,
.enh-servarr-input:focus-visible,
.enh-settings-footer-btn:focus-visible,
.enh-settings-nav-btn:focus-visible,
.enh-settings-close:focus-visible,
.enh-theme-swatch:focus-visible,
#enh-settings-fab:focus-visible {
    outline: 2px solid ${t.accent};
    outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
    [id^="enh-"], [id^="enh-"]::before, [id^="enh-"]::after,
    [class^="enh-"], [class^="enh-"]::before, [class^="enh-"]::after,
    [class*=" enh-"], [class*=" enh-"]::before, [class*=" enh-"]::after {
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.001ms !important;
        transition-delay: 0s !important;
    }
}
        `, 'enh-global');
    }
