# Project Research and Feature Plan

> Generated 2026-05-24 against `IMDb_Enhanced.user.js` v2.3.1 at HEAD `aa3e4e5`.
> Evidence labels used below: **Verified** = confirmed in this repo/source, **Likely** = strongly supported but inferred, **Assumption** = needs validation, **Needs live validation** = requires running the script against current IMDb.

---

## Progress Log

- 2026-05-24 — Completed the Phase 0 stability batch in `IMDb_Enhanced.user.js`: removed the dead GitHub update/download metadata while no remote exists, dropped wildcard `@connect`, added `@noframes`, replaced Subscene with active SubDL/YIFY subtitle destinations, cached unavailable RT/MC score results, and added IMDb SPA route re-initialization with a console init counter.
- 2026-05-24 — Completed the Phase 1 title-stack consolidation: title-area actions now render into a single ordered `enh-title-stack`, with deterministic order for copy ID, watch search, external links, and TV shortcuts.
- 2026-05-24 — Added film-only inline Letterboxd scores using `letterboxd.com/imdb/{ttid}/`, parsing `twitter:data2` / JSON-LD ratings, caching unavailable lookups, and adding `letterboxd.com` to the explicit userscript connect whitelist.
- 2026-05-24 — Added configurable watch-search and external-link site lists. Defaults preserve the previous built-in sites, settings now provide add/remove/reset editors, exported settings include the lists, and user-provided labels/URLs render through DOM APIs instead of HTML strings.
- 2026-05-24 — Added `tvEpisodeTools`: episode-card plot blur/reveal and a Top rated episodes panel when at least 10 rated episodes are present. Static selectors were checked against the saved Black Mirror fixture; live IMDb episodes HTML returned bot verification and still needs manual browser validation.
- 2026-05-24 — Removed remaining `.sc-*` styled-components hash selectors from the userscript. Replacements use `data-testid`, IPC component classes, and broader stable section selectors; `getTitleYear` no longer depends on a hashed class fallback.
- 2026-05-24 — Hardened `getTitleYear()` with JSON-LD release candidates (`datePublished`, release/start dates, release events) plus stable DOM, Open Graph, heading, and document-title regex fallbacks.
- 2026-05-24 — Added inline JustWatch streaming availability. The old unauthenticated JustWatch API endpoints now return 401/404, so the feature fetches public `www.justwatch.com` SSR title/search pages, parses provider names from metadata/JSON-LD, caches misses, and renders a compact provider widget in the rating bar.
- 2026-05-24 — Added Light and High contrast theme variants plus opt-in `themeAuto` system-theme following. Theme CSS now emits the correct `color-scheme`, refreshes dependent header/rating styles on theme changes, and keeps the existing Dark default for current users.
- 2026-05-24 — Added local Watched / Skip marking. Poster cards and the hero poster get hover controls, saved marks render with badges/dimmed cards wherever the same IMDb ID appears, and the settings panel now includes a local marks review/clear section backed by exported `userMarks` data.
- 2026-05-24 — Added opt-in local Servarr quick-add. Settings now capture localhost Radarr/Sonarr URLs, API keys, root folders, and profile IDs; title pages render the matching Add Radarr/Add Sonarr action when configured, using lookup then POST add requests through `GM_xmlhttpRequest`.
- 2026-05-24 — Added cache TTL metadata and startup garbage collection. Existing cache entries keep the 7-day default, unavailable sentinels now expire after 24 hours, expired/corrupt keys are removed, and live cache entries are capped at 120 newest records.

---

## Executive Summary

IMDb Enhanced is a single-file Tampermonkey/Violentmonkey userscript (`IMDb_Enhanced.user.js`, 2,158 lines, [IMDb_Enhanced.user.js:1-30](IMDb_Enhanced.user.js#L1-L30)) that re-skins `imdb.com/title/*` and `imdb.com/name/*` with a dark design system, removes IMDb upsells/ads/news/contribution prompts, and stitches in third-party data (Rotten Tomatoes, Metacritic) and side-loaded launchers (Cineby, JustWatch, Letterboxd, TMDB, Trakt, OpenSubtitles, YTS, 1337x, etc.). It is private (no public GitHub repo at `SysAdminDoc/IMDb-Enhanced` despite the `@updateURL`), has no README, no test suite, no build pipeline, no changelog, and stores everything in `GM_*` values. The last three commits (`ea4cd81` polish, `eb9980e` restore, `aa3e4e5` stabilize) all on 2026-05-18 indicate the title-area insertion logic was the recent pain point and is now load-bearing.

The strongest current shape is the **design-system + feature-registry pattern**: a clean `reg({…})` API, a 3-theme token system, and consistent toggle/destroy lifecycle. The highest-value direction for improvement is to (a) **harden against IMDb's SPA navigation and class-hash churn**, (b) **fix the broken update channel and publish the script so users actually get fixes**, and (c) **deepen the data layer** (Letterboxd, Trakt, streaming availability) which is what every neighbouring competitor script already does.

Top opportunities, priority order:
1. **P0 — Update channel metadata**. Completed locally by removing the dead `@updateURL`/`@downloadURL`; publishing a working remote remains a distribution task.
2. **P0 — Add SPA navigation re-init**. Completed locally with history API route watching and per-route feature teardown/re-init.
3. **P0 — Replace dead Subscene link**. Completed locally with SubDL title search and movie-only YIFY subtitle links.
4. **P0 — Lock `@connect *` to a whitelist**. Completed locally; only explicit documented domains remain in metadata.
5. **P1 — Add Letterboxd & Trakt inline scores** alongside RT/MC. Letterboxd has a stable `letterboxd.com/imdb/{ttid}/` redirect; competitor scripts (`cvzi/Letterboxd-userscript`, MoreMovieRatings 72k installs) prove the demand.
6. **P1 — Reify "watch search" as user-configurable sites**. Completed locally with `watchSites` / `externalSites` settings and settings-panel editors.
7. **P1 — Stop guessing IMDb's hashed `.sc-XXXXXXXX` classes**; build a Sass-style selector helper that prefers `data-testid` and falls back to attribute-contains. The current theme CSS hard-codes ~30 hashed classes that will break on the next IMDb deploy.
8. **P1 — Episode list spoiler-blur and "best episodes" sort** for TV. Currently `spoilerBlur` ([IMDb_Enhanced.user.js:1183-1208](IMDb_Enhanced.user.js#L1183-L1208)) only blurs the hero plot; episode synopses and Black-Mirror-style anthology pages still spoil.
9. **P2 — Light/system theme**. CSS hard-codes `color-scheme: dark` ([IMDb_Enhanced.user.js:433](IMDb_Enhanced.user.js#L433)); macOS auto-switch and `prefers-color-scheme` users are ignored.
10. **P2 — Streaming availability inline via JustWatch link-out is already there; add inline availability text** ("On Netflix, Prime"), which is the single most-requested IMDb hack across competitor scripts.

---

## Evidence Reviewed

### Local files (in repo root `X:\repos\IMDb_Enhanced\`)
- [IMDb_Enhanced.user.js](IMDb_Enhanced.user.js) — 2,158 lines, current v2.3.1 (read in full).
- [IMDb_Enhanced.user.js.bak](IMDb_Enhanced.user.js.bak) — 1,741 lines (gitignored working backup).
- [IMDb_Enhanced.user.js.pre-polish-20260518-223611.bak](IMDb_Enhanced.user.js.pre-polish-20260518-223611.bak) — 1,785 lines (pre-polish snapshot, gitignored).
- [.gitignore](.gitignore) — ignores `*.bak`, `*.pre-polish-*.bak`, `CLAUDE.md`, `CODEX_CHANGELOG.md`, `.claude/`.
- [Black Mirror (TV Series 2011– ) - IMDb.mhtml](Black%20Mirror%20%28TV%20Series%202011%E2%80%93%20%29%20-%20IMDb.mhtml) — saved IMDb page used to validate `data-testid` selectors.

### Git history (3 commits, all 2026-05-18)
- `ea4cd81` "Polish IMDb Enhanced userscript UX" — initial 2,113-line commit (the userscript itself). Verified.
- `eb9980e` "Restore IMDb watch shortcuts" — added `getTitleSurface()`/`waitForTitleSurface()` after the polish commit broke the watch buttons (selector regression). Verified.
- `aa3e4e5` "Stabilize IMDb title action placement" — refactored anchor lookup with three fallbacks. Verified.
- No `CLAUDE.md`, `CODEX_CHANGELOG.md`, or `.claude/` present locally (gitignored and absent).
- No `README.md`, `CONTRIBUTING.md`, `ROADMAP.md`, `docs/`, `.github/`, `package.json`, `tsconfig.json`, or test fixtures. Verified.
- Local `.git/config` has no `[remote]`; this checkout was never `git remote add origin`'d. Verified.

### Headers & metadata
- `@updateURL` / `@downloadURL` were removed on 2026-05-24 because `SysAdminDoc/IMDb-Enhanced` does not exist and this checkout has no remote. **Verified**: no dead update URL remains in the userscript.
- `@match` covers `imdb.com/title/*`, `imdb.com/name/*`, `imdb.com/*/title/*` (locale prefix), `imdb.com/*/name/*`, `m.imdb.com/*`, and three `cineby.*` search hosts.
- `@grant` set: `GM_getValue`, `GM_setValue`, `GM_addStyle`, `GM_setClipboard`, `GM_xmlhttpRequest`, `GM_listValues`, `GM_deleteValue`.
- `@connect` set: `www.rottentomatoes.com`, `backend.metacritic.com`, `letterboxd.com`, `www.justwatch.com`, `www.opensubtitles.org`, `localhost`, and `127.0.0.1`. Wildcard access was removed on 2026-05-24.

### DOM verification (against saved MHTML)
Grepped the saved Black Mirror page for `data-testid=` values; found 166 occurrences. **Verified present in 2026 IMDb DOM**:
- `hero-parent`, `hero__pageTitle`, `hero__primary-text`, `hero-rating-bar__aggregate-rating`, `hero-rating-bar__aggregate-rating__score`, `hero-rating-bar__user-rating`, `hero-rating-bar__popularity`, `hero-media__poster`, `hero-media__slate`, `hero-proupsell`, `hero__video-link`, `hero-subnav-bar-*`
- `title-cast`, `title-cast-header`, `Photos`, `MoreLikeThis`, `DidYouKnow`, `TechSpecs`, `contribution`, `UserReviews`, `News`, `videos-section`, `main-column-editorial-single`

**Not present in this snapshot (likely lazy-loaded; mark as Needs live validation)**: `Details`, `BoxOffice`, `Filmography`, `PersonalDetails`, `RelatedInterests`, `review-card-parent`, `plot-l`/`plot-xl`. These are targeted by the script ([IMDb_Enhanced.user.js:1138](IMDb_Enhanced.user.js#L1138), [IMDb_Enhanced.user.js:1196](IMDb_Enhanced.user.js#L1196)) and should be confirmed against live pages.

### External sources reviewed
- [Greasy Fork code rules](https://greasyfork.org/en/help/code-rules) — no obfuscation/minification; descriptive metadata required.
- [Greasy Fork by-site for imdb.com](https://greasyfork.org/en/scripts/by-site/imdb.com) — install-count leaderboard: MoreMovieRatings (72.6k), IMDb Scout Mod (15.5k, updated 2026-05-20), IMDb Scout (9.6k), Show Metacritic ratings (4.9k), IMDb: Link 'em all! (3.7k, updated 2026-01-17).
- [Letterboxd ratings on IMDb](https://greasyfork.org/en/scripts/452708-letterboxd-ratings-on-imdb) — v1.0.5, MIT, 128 installs, last updated 2026-02-08.
- [cvzi/Letterboxd-userscript](https://github.com/cvzi/Letterboxd-userscript) — multi-site Letterboxd-rating script.
- [Subscene shutdown coverage](https://alternativeto.net/news/2024/5/popular-subtitles-platform-subscene-announces-sudden-shutdown-leaving-users-in-shock/) — site died May 2024.
- [IMDb official GraphQL API](https://developer.imdb.com/documentation/api-documentation/) — requires AWS Data Exchange subscription + API key; **not viable** for a userscript.
- [Tampermonkey changelog](https://www.tampermonkey.net/changelog.php) — May 2026 update decoupled update-check from update process.

### Areas that could not be verified without live access
- Whether `data-testid="Details"` / `"BoxOffice"` / `"RelatedInterests"` / `"plot-l"` / `"plot-xl"` / `"review-card-parent"` still exist (lazy-loaded; not in saved MHTML).
- Whether the `.sc-XXXXXXXX-N` hashed classes used in theme CSS still match (these are emitted by styled-components and rotate on every IMDb build).
- Whether RT slug fallback (`/m/{slug_with_underscores}`) still matches RT's URL scheme.
- Whether Metacritic's `backend.metacritic.com/finder/metacritic/search/…` endpoint still returns the documented JSON shape.

---

## Current Product Map

### Core workflows
1. **Browse a title or name page** → script removes IMDb's noise (ads, upsells, news, contribution CTAs), reskins everything dark, injects a watch-search bar + external-links bar + score widgets near the title.
2. **Configure** → bottom-left FAB opens a modal with toggles for every feature, theme picker, and Export / Import / Clear-cache buttons.
3. **Launch a watch search** → click a streaming-site button; opens the site's search URL in a new tab. The Cineby variant uses `GM_setValue('movieTitle', …)` and opens `cineby.sc/search`, where a second instance of the script (via `cineby.*` `@match`) auto-fills the search box.
4. **Navigate** (TV-only) → right-side fixed `quickNav` rail jumps between hero/cast/reviews/similar/details/box-office/trivia sections on wide screens (≥ 1200 px).
5. **Copy IMDb ID** → small button next to title text (`enh-copy-id`).

### Existing feature toggles (25 total, plus theme variant)
Grouped exactly as in the source: Cleanup (7), Appearance (5), Layout (3), Scores (3), Features (3 = search/external/expandedLinkMenu), TV (2), Utility (2). See [Feature Inventory](#feature-inventory) below.

### User personas (inferred)
- **The pirate-curious cinephile**: wants quick-launchers to free streaming sites (Cineby, XPrime, Fmovies+, Aether, …).
- **The dark-mode purist**: wants IMDb without ads or upsells, in a dark/OLED/midnight tone.
- **The data triangulator**: wants RT + Metacritic next to the IMDb score on the same page.
- **The torrent user**: uses the YTS / 1337x links + OpenSubtitles for self-hosting.
- **The keyboard user**: opt-in single-key shortcuts (`,`, `s`, `c`, `r`, `t`, `Escape`).

### Platforms & distribution
- **Userscript managers**: Tampermonkey / Violentmonkey / (probably) Greasemonkey. Tested in Chromium-based Tampermonkey is the implicit baseline.
- **Distribution today**: direct file sharing only. The broken update metadata was removed; a working update channel still requires publishing the script to a real remote.

### Important integrations / network destinations
- `www.rottentomatoes.com` (GET HTML or search page, scraped).
- `backend.metacritic.com/finder/metacritic/search/…` (GET JSON).
- `letterboxd.com/imdb/{ttid}/` (GET HTML, scraped for film ratings).
- `www.justwatch.com/us/{movie|tv-show}/{slug}` + search fallback (GET HTML, scraped for provider names).
- `www.opensubtitles.org` (link target only).
- `localhost` / `127.0.0.1` Servarr instances (Radarr/Sonarr API lookup + add requests).
- Explicit `@connect` whitelist for Rotten Tomatoes, Metacritic, Letterboxd, JustWatch, OpenSubtitles, and local Servarr.
- 7 streaming-search URLs + 6 reference URLs hard-coded in JS, opened via `window.open` (no fetch).

### Storage
- `GM_*` namespaced with prefix `imdb_enh_` for booleans / theme.
- `cache_<service>_<ttid>` for RT and Metacritic responses (JSON, 7-day TTL — [IMDb_Enhanced.user.js:40](IMDb_Enhanced.user.js#L40)).
- `enh_coll_<sectionId>` for collapsed-section memory.
- `movieTitle` (unprefixed, global) — used to ship the search term to the cineby.* tab.

---

## Feature Inventory

| # | Name | User Value | Entry Point | Main Code | Maturity | Tests / Docs | Top Improvement |
|---|---|---|---|---|---|---|---|
| 1 | Hide ads & tracking | Removes IMDb ad slots, trackers, sponsored containers | Auto on `imdb.com/*` | [IMDb_Enhanced.user.js:277-287](IMDb_Enhanced.user.js#L277-L287) | Complete | None | Tighten `[class*="AdSlot"]` to avoid false positives; add `aria-label` matchers |
| 2 | Hide IMDbPro upsells | Removes upsell pills, "Add to list" promo | Auto | [IMDb_Enhanced.user.js:289-296](IMDb_Enhanced.user.js#L289-L296) | Complete | None | Add `[data-testid="hero-rating-bar__user-rating"]` exception so the "Rate" affordance stays |
| 3 | Hide news modules | `section[data-testid="News"]` hidden | Auto | [IMDb_Enhanced.user.js:298-300](IMDb_Enhanced.user.js#L298-L300) | Complete | None | — |
| 4 | Hide related interests | Removes broad interest recs | Auto | [IMDb_Enhanced.user.js:302-304](IMDb_Enhanced.user.js#L302-L304) | **Likely** complete (testid not in saved MHTML) | None | Live-verify selector still exists |
| 5 | Hide contribution prompts | Removes "Help fix this" CTAs | Auto | [IMDb_Enhanced.user.js:306-308](IMDb_Enhanced.user.js#L306-L308) | Complete | None | — |
| 6 | Hide sponsored recs | Hides `[cel_widget_id*="Sponsored"]` | Auto | [IMDb_Enhanced.user.js:310-312](IMDb_Enhanced.user.js#L310-L312) | Complete | None | Broad `[class*="Sponsored"]` may hit "Sponsored Searches" affiliate disclosures elsewhere — narrow to specific testids |
| 7 | Hide app banners | Footer + announcement bar | Auto | [IMDb_Enhanced.user.js:314-316](IMDb_Enhanced.user.js#L314-L316) | Complete | None | `#announcement-text` is reused for non-app announcements too |
| 8 | Modern IMDb skin | Full dark/OLED/midnight theme | Auto | [IMDb_Enhanced.user.js:782-786](IMDb_Enhanced.user.js#L782-L786) + theme CSS [424-761](IMDb_Enhanced.user.js#L424-L761) | Complete but **fragile** (≈30 hashed `.sc-*` selectors) | None | Replace hashed classes with role/testid selectors; add `prefers-color-scheme: light` path |
| 9 | Compact header | Slims `#imdbHeader` | Auto | [IMDb_Enhanced.user.js:788-804](IMDb_Enhanced.user.js#L788-L804) | Complete | None | Logo SVG `height: 24px` may clip on retina-Hi-DPI Edge |
| 10 | Refined rating display | Halo + bigger score around hero rating | Auto | [IMDb_Enhanced.user.js:806-836](IMDb_Enhanced.user.js#L806-L836) | Complete | None | Conflicts with rating-color-coding `text-shadow` ([IMDb_Enhanced.user.js:924](IMDb_Enhanced.user.js#L924)) — both write `text-shadow` to the same span |
| 11 | Wider responsive layout | Forces page-container to 100 % | Auto | [IMDb_Enhanced.user.js:838-901](IMDb_Enhanced.user.js#L838-L901) | Complete | None | Causes horizontal scroll on some IMDb sub-pages (lists, ratings); add per-page guard |
| 12 | Rating quality labels | "Great / Good / Average / Below Avg / Poor" chip | Auto, waits for testid | [IMDb_Enhanced.user.js:916-937](IMDb_Enhanced.user.js#L916-L937) | Complete | None | The colour overrides the `enhancedRatingDisplay` halo colour with sometimes-clashing tones; consolidate |
| 13 | Rotten Tomatoes scores | Inline Tomatometer + Audience widget | Auto, fetches RT | [IMDb_Enhanced.user.js:957-1051](IMDb_Enhanced.user.js#L957-L1051) | **Partial** — scraping HTML; slug guess is hit-or-miss for re-titled / non-US releases | None | Use Letterboxd-style ID-based URL OR drop scraping and use an OMDb-style proxy; cache "unavailable" so re-fetches don't spam every load |
| 14 | Metacritic scores | Inline Metascore + user score | Auto, fetches MC | [IMDb_Enhanced.user.js:1053-1128](IMDb_Enhanced.user.js#L1053-L1128) | Partial — relies on undocumented `backend.metacritic.com` endpoint | None | Same caching gap; also `mcoTypeId` 1=TV, 2=movie magic numbers need a comment |
| 15 | Collapsible sections | Per-section collapse button, persists | Auto on imdb.com | [IMDb_Enhanced.user.js:1136-1180](IMDb_Enhanced.user.js#L1136-L1180) | Complete | None | CSS exception `[class*="title"]` is too broad — `tm-box-addtolist-button` and other classes match. Use explicit allow-list. |
| 16 | Spoiler blur on plot | Blurs `plot-l`/`plot-xl` until click | Auto | [IMDb_Enhanced.user.js:1182-1208](IMDb_Enhanced.user.js#L1182-L1208) | Partial — only one plot field; episode titles / synopses still spoil | None | Extend to per-episode rows, MoreLikeThis poster titles, sub-section editorial |
| 17 | Section navigator | Right-rail dot nav | Auto ≥ 1200 px | [IMDb_Enhanced.user.js:1210-1253](IMDb_Enhanced.user.js#L1210-L1253) | Complete | None | No active-section highlighting; no keyboard navigation; single-letter icons are not screen-reader friendly even with `aria-label` |
| 18 | Watch search buttons | Configurable row of watch-search sites | Auto | [IMDb_Enhanced.user.js:1261-1297](IMDb_Enhanced.user.js#L1261-L1297) | Complete | None | Defaults preserve the old list; settings allow add/remove/reset |
| 19 | External links bar | Configurable RT, Letterboxd, TMDB, YouTube, Wikipedia, JustWatch, Trakt-style links | Auto | [IMDb_Enhanced.user.js:1299-1325](IMDb_Enhanced.user.js#L1299-L1325) | Complete | None | Settings allow add/remove/reset; Letterboxd link uses `/imdb/{id}/` |
| 20 | Expanded link menu | "More links" dropdown grouping 7 categories | Auto, depends on #19 | [IMDb_Enhanced.user.js:1328-1408](IMDb_Enhanced.user.js#L1328-L1408) | Complete | None | Subtitles now use SubDL + movie-only YIFY; `Torrents` group surfaces only on `expandedLinkMenu = true` — should also gate behind explicit user opt-in |
| 21 | TV show quick links | Chip row of TV-DB / TVMaze / Trakt / Ep Calendar | Auto on TV | [IMDb_Enhanced.user.js:1416-1448](IMDb_Enhanced.user.js#L1416-L1448) | Complete | None | Could add Sonarr/Radarr quick-add (compare with "Universal Servarr Add Tool" on Greasy Fork) |
| 22 | Subtitle links | OpenSubtitles + OpenSubs.com + SubDL + YIFY-Subs + Addic7ed | Auto | [IMDb_Enhanced.user.js:1450-1471](IMDb_Enhanced.user.js#L1450-L1471) | Complete | None | YIFY is movie-only and hidden on TV pages |
| 23 | Quick copy IMDb ID | Button next to title | Auto | [IMDb_Enhanced.user.js:1479-1496](IMDb_Enhanced.user.js#L1479-L1496) | Complete | None | Insertion target `titleEl.parentElement` differs from other buttons — visual rhythm drifts |
| 24 | Optional keyboard shortcuts | Single-key bindings (opt-in, default OFF) | Manual toggle | [IMDb_Enhanced.user.js:1498-1513](IMDb_Enhanced.user.js#L1498-L1513) | Complete | None | Both `,` and `s` open settings — drop one; `s` collides with IMDb's own "/" search shortcut habits |
| 25 | Theme variant | dark / oled / midnight | Settings panel | [IMDb_Enhanced.user.js:325-422](IMDb_Enhanced.user.js#L325-L422) + selector [1958-1989](IMDb_Enhanced.user.js#L1958-L1989) | Complete | None | No light theme; no `prefers-color-scheme` auto |

### Hidden / undocumented / non-toggleable behaviour
- **Footer & user-menu blanket hide** ([IMDb_Enhanced.user.js:721-725](IMDb_Enhanced.user.js#L721-L725)) is baked into `modernUI`, not a toggle. A user who enjoys the theme but wants their user-menu visible has no escape hatch.
- **Cineby auto-fill** ([IMDb_Enhanced.user.js:2130-2138](IMDb_Enhanced.user.js#L2130-L2138)) runs only when the user actually clicks the "Cineby" search button; otherwise the `GM_setValue('movieTitle')` value lingers until overwritten. There's no settings UI for this and no way to disable it independently of `searchButtons`.
- **`#imdbHeader` early shell** ([IMDb_Enhanced.user.js:763-780](IMDb_Enhanced.user.js#L763-L780)) is injected at `document-start` to avoid a white flash — even if `modernUI` is OFF, the user gets the dark shell. Document this or gate it.
- **Cache namespace `cache_*`** is global across all titles; the "Clear cache" button wipes RT and MC for every cached title. No per-title invalidation.

---

## Competitive and Ecosystem Research

### MoreMovieRatings — Greasy Fork (72.6k installs, updated 2024-05-16)
- **What**: Shows IMDb ratings on Douban, and Douban ratings on IMDb (Chinese-audience focus).
- **Learn**: Demonstrates the scale demand for cross-site rating overlays; bidirectional surfacing is a hook this script doesn't have.
- **Avoid**: Niche localisation that distracts the core feature set.

### IMDb Scout Mod — Greasy Fork (15.5k installs, updated 2026-05-20)
- **What**: Multi-source auto-search; adds rating overlays and "in your media server?" indicators (Jellyfin / Plex / Sonarr).
- **Learn**: The "Is this title already in my Plex/Jellyfin?" badge is a unique trust signal — directly applicable here.
- **Avoid**: Bundling ~50 torrent-site links by default invites Greasy Fork moderation pressure.

### IMDb: Link 'em all! — Greasy Fork (3.7k installs, updated 2026-01-17)
- **What**: Customisable list of external links.
- **Learn**: Confirms that **user-editable link lists** are a successful pattern; mirrors the "External links bar" + "Expanded link menu" features here and shows users want to add their own.

### Show Metacritic.com ratings — Greasy Fork (4.9k, 2026-05-10)
- **What**: Pure cross-site Metacritic injector.
- **Learn**: The existence of a single-purpose, recently-updated competitor for the **Metacritic** half of this script means we can decommission the Metacritic feature if it's unmaintainable, and instead recommend that script as a partner.

### cvzi/Letterboxd-userscript (GitHub)
- **What**: Shows Letterboxd rating on imdb.com + metacritic.com + RT + BoxOfficeMojo + Amazon + Wikipedia + TMDB + movies.com.
- **Learn**: Letterboxd has no public API but the script reads the rating off the rendered Letterboxd film page (auto-redirected from `letterboxd.com/imdb/{ttid}/`). The HTML they scrape uses `meta[name="twitter:data2"]` (`"4.2 out of 5"`), which is far more stable than RT's hashed CSS.
- **Apply**: Same approach lets this project add a Letterboxd score widget with no API key and minimal scraping.

### Universal Servarr Add Tool — Greasy Fork
- **What**: Adds "Add to Radarr", "Add to Sonarr", "Add to Lidarr" buttons on IMDb / RT / Letterboxd / Trakt / JustWatch / MAL / ANN.
- **Learn**: Confirms appetite for Sonarr/Radarr add buttons. Implementation requires the user to enter their server URL + API key in settings — fits this project's existing settings panel.

### IMDb's own GraphQL ([developer.imdb.com](https://developer.imdb.com/documentation/api-documentation/))
- **What**: Official GraphQL on AWS Data Exchange, requires AWS subscription + `x-api-key` header.
- **Apply**: **Not viable** for a userscript distributed to anonymous users. Stick with DOM + JSON-LD scraping.

### Tampermonkey 2026 changes ([changelog](https://www.tampermonkey.net/changelog.php))
- Update-check decoupled from update process; fewer desktop notifications.
- `@inject-into content` is now common practice — script should declare it explicitly to avoid `unsafeWindow` weirdness on stricter CSP pages.

### Greasy Fork code rules ([rules](https://greasyfork.org/en/help/code-rules))
- No obfuscation/minification.
- Script must declare what it does; deceptive descriptions get removed.
- Scripts linking to grey-market streaming may be challenged. The 7 streaming sites in `searchButtons` (Cineby, Popcorn, XPrime, Aether, Fmovies+, Rive, 67Movies) are a meaningful submission risk.

---

## Highest-Value New Features

### NF-1 — Letterboxd inline score widget
- **User problem**: Cinephiles cross-check Letterboxd before/after watching; today they have to open a new tab.
- **Evidence**: `cvzi/Letterboxd-userscript`, `Letterboxd ratings on IMDb` (Greasy Fork). Letterboxd's `/imdb/{ttid}/` redirect is stable; ratings are exposed via `meta[name="twitter:data2"]`.
- **Proposed behaviour**: Add a third `enh-score-widget` slot next to RT / Metacritic; on-page-load fetch `https://letterboxd.com/imdb/{ttid}/`, parse `twitter:data2`, render "4.2★ from 88k". Link to the Letterboxd page.
- **Implementation areas**: `inlineLetterboxdScore` feature in `Scores` group, shares loading-skeleton CSS, reuses `cacheGet/cacheSet`.
- **Risk / edge cases**: Letterboxd applies bot detection; back off to a "click to fetch" affordance on `403`. Some IMDb titles don't exist on Letterboxd (TV — Letterboxd is films-only); gate behind `getMediaType() === 'movie'`.
- **Verification**: Manual: open 3 films + 1 TV title; widget appears only on films, score matches Letterboxd page.
- **Complexity**: S
- **Priority**: P1

### NF-2 — User-configurable watch-search & external-links lists
- **User problem**: Bundled site list rots (Cineby moved hosts twice; XPrime, Aether are user-specific preferences). Users can't add their preferred ones (Stremio, MyAnimeList, Hianime, MoviesMod, Goojara, the user's own Jellyfin/Plex).
- **Evidence**: `IMDb: Link 'em all!` (3.7k installs) ships exactly this. The hard-coded list at [IMDb_Enhanced.user.js:1271-1279](IMDb_Enhanced.user.js#L1271-L1279) and [IMDb_Enhanced.user.js:1307-1315](IMDb_Enhanced.user.js#L1307-L1315) is the obvious extraction point.
- **Proposed behaviour**: Settings → Watch search + External links sections become editable tables (name, URL template with `{{T}}`, `{{ID}}`, `{{Y}}`, accent colour). "Restore defaults" button. Export/import already supports arbitrary keys.
- **Implementation areas**: New `userSites.watch` / `userSites.external` arrays in DEFAULTS; refactor `searchButtons` / `externalLinks` features to read from storage; settings panel rows; per-item edit/remove UI.
- **Risk / edge cases**: URL validation; XSS via `--btn-color`; pasted user URL should be sanitised.
- **Verification**: Add a custom site, see it render and launch; delete it; clear all, see defaults restored.
- **Complexity**: M
- **Priority**: P1

### NF-3 — SPA navigation re-init
- **User problem**: Click a cast member → name page loads, but `enh-search-buttons`, `enh-external-links`, score widgets, copy-ID button all disappear because `init()` ran only at the initial DOMContentLoaded.
- **Evidence**: [IMDb_Enhanced.user.js:2155-2156](IMDb_Enhanced.user.js#L2155-L2156) — single init. IMDb uses Next.js client-side routing for most internal navigation (visible in saved MHTML `drawer__panel` etc.).
- **Proposed behaviour**: Wrap `init()` in a router. Listen for `pushState`/`replaceState`/`popstate`; when the path changes to a different title/name, `feature.destroy()` everything, clear injected DOM nodes, run `feature.init()` again. Reuse cache.
- **Implementation areas**: Monkey-patch `history.pushState`; `MutationObserver` on `<title>` as a fallback. New `restartFeatures()` function near `init`.
- **Risk / edge cases**: Avoid double-injection (already partially handled by `if (document.getElementById('enh-search-buttons')) return`); guard against same-path re-fires from the SPA.
- **Verification**: Open a title → navigate to cast → back to a different title; all widgets present every time. Add a console counter `[IMDb-Enh] init #N` to verify.
- **Complexity**: M
- **Priority**: P0

### NF-4 — Episode list spoiler-blur and "best episodes" sort
- **User problem**: TV episode pages spoil entire arcs in synopsis + episode title. Anthology shows (Black Mirror is the saved page!) need the opposite: surfacing the highest-rated standalone episodes.
- **Evidence**: `spoilerBlur` only touches `[data-testid="plot-l"]`/`plot-xl`. Episode lists live at `imdb.com/title/{tt}/episodes/`. The `tvShowEnhancements` chip row already links there.
- **Proposed behaviour**:
  - **Spoiler mode**: blur episode titles + synopses; click to reveal per row.
  - **Best-episodes sort**: parse the episode-list page's rating column, append a "Top 10" panel above the table sorted by rating (desc).
  - Persist user choice per show.
- **Implementation areas**: New `tvEpisodeTools` feature, new `@match https://www.imdb.com/title/*/episodes*`; new utility to parse the episode-list table.
- **Risk / edge cases**: Per-season vs all-seasons; rating column missing for unaired episodes.
- **Verification**: Black Mirror /episodes page → top-10 panel matches "Best Black Mirror episodes" articles.
- **Complexity**: M
- **Priority**: P1

### NF-5 — Personal "watched" / "skip" marking
- **User problem**: Returning users want to dim or mark titles they've already seen / decided to skip, especially on `MoreLikeThis` shovelers.
- **Evidence**: IMDb's native watchlist requires a login and is slow. Local marking is one click. The script already persists per-section collapse state ([IMDb_Enhanced.user.js:1155-1169](IMDb_Enhanced.user.js#L1155-L1169)), proving the persistence pattern is in place.
- **Proposed behaviour**: Hover any poster card → "✓ Watched" / "✗ Skip" badge. Mark stored as `imdb_enh_user_ttN…`. Marked titles get an opacity overlay + corner badge wherever they appear (title page hero, MoreLikeThis, search results if matched). "My marks" panel in settings to review/clear.
- **Implementation areas**: New `watchedMarking` feature; injection on poster cards (delegated event listener on `body`); badge overlay CSS; export/import already covers it.
- **Risk / edge cases**: Multi-device users get no sync (acceptable; document limit). Large mark lists need pagination in the settings review panel.
- **Verification**: Mark 3 titles → reload → marks persist; navigate to another page where same titles appear → marks visible.
- **Complexity**: M
- **Priority**: P2

### NF-6 — Streaming availability inline (JustWatch text)
- **User problem**: The external "JustWatch" link requires a click and a new tab. Most users only want "Where can I stream this?" in one glance.
- **Evidence**: `externalLinks` already includes JustWatch. Live checks on 2026-05-24 showed old unauthenticated JustWatch API endpoints returning 401/404, while public SSR title pages expose provider names in `meta[name="description"]` and JSON-LD.
- **Implemented behaviour**: One compact `STREAMING` score-bar widget: "On Netflix, Prime Video +1". Fetches best-effort from JustWatch title pages with search-page fallback; caches successes and misses.
- **Implementation areas**: New `streamAvailability` feature in Scores group; pipe through `httpGet`; added `www.justwatch.com` to `@connect`.
- **Risk / edge cases**: JustWatch can change SSR metadata or challenge traffic; the widget falls back to an `Open` JustWatch search link. Country remains fixed to `/us/`.
- **Verification**: Live metadata for Inception, Black Mirror, and The Matrix returned Netflix / Prime Video / Disney+ provider strings.
- **Complexity**: M
- **Priority**: P2

### NF-7 — Sonarr / Radarr quick-add buttons
- **User problem**: Self-hosters open Sonarr/Radarr in a new tab and re-search the title manually.
- **Evidence**: "Universal Servarr Add Tool" (Greasy Fork) does this; Sonarr/Radarr both expose REST APIs (`POST /api/v3/movie?apikey=…`).
- **Implemented behaviour**: New optional settings (off by default): localhost Sonarr/Radarr URL, API key, root folder, and profile IDs. When configured, movies render Add Radarr and series render Add Sonarr; click performs an IMDb-ID lookup and POST add.
- **Implementation areas**: New `servarrIntegration` feature group; settings rows with masked API keys; `httpGet` extended to `httpRequest` supporting POST; explicit local-only `@connect localhost` and `@connect 127.0.0.1`.
- **Risk / edge cases**: Stored API keys are in `GM_setValue` plain text. Remote/LAN Servarr hosts are intentionally blocked in this build to avoid restoring wildcard `@connect`; users can fork and add their own host if needed.
- **Verification**: Configure a local test Radarr/Sonarr; click button; title appears in Servarr; failure surfaces in toast.
- **Complexity**: L
- **Priority**: P2

### NF-8 — Trailer popover (no new tab)
- **User problem**: External "YouTube … trailer" link opens a new tab; users want to peek at the trailer without losing the IMDb context.
- **Evidence**: IMDb's own trailer player ([data-testid="hero__video-link"](IMDb_Enhanced.user.js#L3145) in saved MHTML) opens in a modal but auto-plays a Featurette / ad. A YouTube IFRAME embed is faster.
- **Proposed behaviour**: Add a "▶ Trailer" affordance in the external-links bar that opens an in-page modal with `iframe src="https://www.youtube-nocookie.com/embed?search=<title>+<year>+trailer"`. Embed-via-search trick: use the YouTube `videoseries` list with the search term.
- **Implementation areas**: New `inlineTrailer` feature; new `enh-modal-video` element; reuse settings-overlay focus-trap pattern.
- **Risk / edge cases**: YouTube embed-via-search is fragile — better is a one-time `fetch` to YouTube's search results page to extract the top video ID. That requires `@connect youtube.com`.
- **Verification**: For "Inception" / "Dune Part Two", the trailer plays inline.
- **Complexity**: M
- **Priority**: P3

### NF-9 — High-contrast and light themes
- **User problem**: Macros that auto-switch to light during the day get blasted with the dark theme regardless. WCAG users need a high-contrast variant.
- **Evidence**: `getThemeCSS` is parameterised on a theme token object ([IMDb_Enhanced.user.js:326-422](IMDb_Enhanced.user.js#L326-L422)); adding two more entries is mechanical. `html { color-scheme: dark }` is hard-coded at [IMDb_Enhanced.user.js:433](IMDb_Enhanced.user.js#L433).
- **Proposed behaviour**: Add `light` and `highContrast` to `THEMES`. Add `themeAuto` boolean → if true, honour `prefers-color-scheme`. Selector UI gains two more swatches.
- **Implementation areas**: `THEMES` object; `injectEarlyThemeShell` reads computed scheme; `prefers-color-scheme` `matchMedia` listener flips at runtime.
- **Risk / edge cases**: Existing hashed-class overrides may invert contrast badly under light. Audit `color:` / `background:` pairs.
- **Verification**: Toggle OS light/dark → page swatch flips; with `themeAuto = false`, page stays fixed.
- **Complexity**: M
- **Priority**: P2

### NF-10 — Watchlist page batch IMDb-ID copy
- **User problem**: Users with large IMDb watchlists need to export to other systems (Radarr / Stremio / Plex). IMDb's CSV export is buried in account settings.
- **Evidence**: The `quickCopyID` feature ([IMDb_Enhanced.user.js:1479-1496](IMDb_Enhanced.user.js#L1479-L1496)) already copies a single ID. The `@match` set does not currently include `/user/*/watchlist/`.
- **Proposed behaviour**: Add `@match https://www.imdb.com/user/*/watchlist*`; render a single "Copy all IMDb IDs" button at the top of the list. Outputs newline-separated `tt…` IDs.
- **Implementation areas**: New `watchlistBatch` feature gated by URL; `document.querySelectorAll('a[href*="/title/tt"]')` dedupe.
- **Risk / edge cases**: Watchlist supports paging — the button should warn that only currently-loaded items are copied.
- **Verification**: 50-item watchlist → click → clipboard contains 50 unique IDs.
- **Complexity**: S
- **Priority**: P3

---

## Existing Feature Improvements

### IM-1 — Replace dead Subscene with SubDL (and group active subtitle sites)
- **Status**: Complete as of 2026-05-24.
- **Current**: Subtitle links use **SubDL** title search (`https://subdl.com/search/{title}`) and movie-only **YIFY Subtitles** (`https://yifysubtitles.ch/movie-imdb/{ttid}`).
- **Problem**: Resolved; Subscene links were removed.
- **Fix**: Replaced Subscene in both the expanded link menu and subtitle chip row.
- **Touches**: `expandedLinkMenu._DB.Subtitles`, `subtitleLinks` chip row.
- **Backward compat**: No persistent data depends on Subscene; safe replace.
- **Verify**: `Invoke-WebRequest -Method Head` returned 200 for SubDL title searches and a YIFY movie IMDb link.
- **Complexity**: S — **P0**

### IM-2 — Fix `@updateURL` / `@downloadURL` 404
- **Status**: Locally complete as of 2026-05-24.
- **Current**: Dead `@updateURL` / `@downloadURL` metadata was removed because this checkout has no configured remote.
- **Problem**: A real update channel still requires publishing the script to GitHub, Greasy Fork, or another stable host.
- **Fix**: Removed the false update URL; future publication should add a tested 200 OK update endpoint.
- **Touches**: Userscript header.
- **Verify**: `rg "@updateURL|@downloadURL" IMDb_Enhanced.user.js` returns no matches.
- **Complexity**: S — **P0**

### IM-3 — Lock `@connect *` to a whitelist
- **Status**: Complete as of 2026-05-24.
- **Current**: Header declares only required third-party fetch/link domains plus local Servarr hosts: Rotten Tomatoes, Metacritic, Letterboxd, JustWatch, OpenSubtitles, localhost, and 127.0.0.1.
- **Problem**: Resolved for current code; new fetch features must add explicit domains.
- **Fix**: Removed wildcard `@connect *`.
- **Touches**: Userscript header.
- **Verify**: Tampermonkey install screen lists only the declared domains; runtime fetches still succeed.
- **Complexity**: S — **P0**

### IM-4 — SPA navigation re-init (see [NF-3](#nf-3--spa-navigation-re-init))
Same item, listed here for completeness — it is both an existing-feature reliability fix and a new feature unlocker.
- **Complexity**: M — **P0**

### IM-5 — Replace hashed `.sc-XXXXXXXX` selectors with `data-testid` / role selectors
- **Current**: Theme CSS hard-codes ~30 hashed classes ([IMDb_Enhanced.user.js:468-471](IMDb_Enhanced.user.js#L468-L471), [IMDb_Enhanced.user.js:642-660](IMDb_Enhanced.user.js#L642-L660), [IMDb_Enhanced.user.js:700-708](IMDb_Enhanced.user.js#L700-L708), [IMDb_Enhanced.user.js:722-725](IMDb_Enhanced.user.js#L722-L725), and many more).
- **Problem**: styled-components rotates these on every build. After IMDb's next deploy, large parts of the theme silently no-op.
- **Fix**: Where a `data-testid` parent exists, use the descendant selector (`section[data-testid="UserReviews"] .ipc-html-content-inner-div`). Where no testid is available, use the **stable IPC class** (`.ipc-*` are part of IMDb's design-system bundle and rotate far less). Document any remaining hashed-class usage with a TODO and a "last verified date" comment.
- **Touches**: `getThemeCSS` (whole function), several `addCSS(...)` blocks.
- **Backward compat**: Visual regression risk during refactor; do it section-by-section with manual screenshots.
- **Verify**: Diff screenshots before/after on 3 sample pages.
- **Complexity**: L — **P1**

### IM-6 — Cache "unavailable" results too, with a shorter TTL
- **Current**: `_renderUnavailable()` in RT ([IMDb_Enhanced.user.js:1034-1049](IMDb_Enhanced.user.js#L1034-L1049)) and MC ([IMDb_Enhanced.user.js:1111-1126](IMDb_Enhanced.user.js#L1111-L1126)) does **not** call `cacheSet`. Every page load re-hits RT / Metacritic for the same "no match" title.
- **Problem**: Wasted requests, slower page load, more rate-limit pressure. RT in particular will start returning 429s.
- **Fix**: `cacheSet('rt_' + imdbId, { unavailable: true }, 24*60*60*1000)` — 1-day TTL for misses; widen `cacheGet` to take a per-key TTL.
- **Touches**: `cacheGet` / `cacheSet`, both score features.
- **Verify**: Hit a niche title twice; second load shows the placeholder without a network request (DevTools network tab).
- **Complexity**: S — **P1**

### IM-7 — Consolidate `enhancedRatingDisplay` ↔ `ratingColorCoding`
- **Current**: Both write `text-shadow` to the same `[data-testid="hero-rating-bar__aggregate-rating__score"] span:first-child` — last one wins ([IMDb_Enhanced.user.js:824](IMDb_Enhanced.user.js#L824) vs [IMDb_Enhanced.user.js:924](IMDb_Enhanced.user.js#L924)).
- **Problem**: Inconsistent halo colour depending on init order.
- **Fix**: Move `text-shadow` and colour computation into `ratingColorCoding` only; `enhancedRatingDisplay` keeps the surrounding pill but stops styling the inner score.
- **Verify**: Toggle each independently; colours behave consistently.
- **Complexity**: S — **P2**

### IM-8 — Tighten `collapsibleSections` CSS exception
- **Current**: `.enh-section--collapsed>*:not(.ipc-title):not(.enh-collapse-btn):not([class*="title"]):not(h3):not(header)` — `[class*="title"]` matches things like `pro-title-badge`, `tm-box-addtolist-button` etc.
- **Problem**: When a section is collapsed, residual elements leak through.
- **Fix**: Replace with an explicit allow-list (`.ipc-title`, `.enh-collapse-btn`, `h2`, `h3`, `header`); test against each registered section.
- **Touches**: [IMDb_Enhanced.user.js:1147](IMDb_Enhanced.user.js#L1147).
- **Verify**: Collapse "More Like This" → only the header chip remains.
- **Complexity**: S — **P2**

### IM-9 — `getTitleYear` resilient extraction
- **Current**: Selector `.sc-af040695-0 ul a` ([IMDb_Enhanced.user.js:223](IMDb_Enhanced.user.js#L223)) — hashed class.
- **Problem**: When the class rotates, year extraction falls back to `[data-testid="hero-subnav-bar-left-block"] a` and then "" — many "search by year" URL templates lose `{{Y}}`.
- **Fix**: Read year from JSON-LD (`getLDData().datePublished`) first (already attempted, good), then DOM regex `\(\d{4}(?:[-–]\d{4})?\)` anywhere in the hero block. Drop the hashed selector entirely.
- **Verify**: For a title with no JSON-LD year, year still resolves.
- **Complexity**: S — **P1**

### IM-10 — Settings panel focus management
- **Current**: When opened, `panel?.focus()` is called ([IMDb_Enhanced.user.js:2121](IMDb_Enhanced.user.js#L2121)) — the panel container gets focus, not the first interactive element.
- **Problem**: Screen-reader users hear the dialog title but Tab takes two presses to reach the close button. Mild WCAG 2.4.3 issue.
- **Fix**: Focus the first focusable inside the panel (the close button, since it's the first DOM child). Keep `tabindex="-1"` on the panel as a fallback target.
- **Touches**: `toggleSettings`.
- **Verify**: Open settings → Tab → first toggle reached.
- **Complexity**: S — **P2**

### IM-11 — Cineby integration: pick host + namespace storage key
- **Current**: Always opens `cineby.sc` ([IMDb_Enhanced.user.js:1290](IMDb_Enhanced.user.js#L1290)). Uses unprefixed `GM_setValue('movieTitle', …)` — collides with any other userscript using the same key.
- **Problem**: User can't pick `cineby.app` / `cineby.gd`; global namespace pollution.
- **Fix**: Add a settings dropdown for preferred Cineby host (default `sc`). Rename storage key to `imdb_enh_cineby_query` and clear it after consumption on the cineby side.
- **Touches**: `searchButtons`, `handleCineby`, settings panel.
- **Verify**: Switch host → search opens chosen host; key cleared after auto-fill.
- **Complexity**: S — **P2**

### IM-12 — `m.imdb.com/*` match scope
- **Current**: `@match https://m.imdb.com/*` — matches the mobile site's homepage, search, lists, everything ([IMDb_Enhanced.user.js:11](IMDb_Enhanced.user.js#L11)).
- **Problem**: Cleanup CSS injects on every mobile page, but feature widgets that depend on desktop `data-testid` quietly time out everywhere. Bloats memory; many features just do nothing.
- **Fix**: Either drop `m.imdb.com` (mobile redirects to `www.imdb.com` if `?ref_=*` is present anyway) OR scope to `m.imdb.com/title/*` and `m.imdb.com/name/*` and add mobile-specific selectors where useful.
- **Verify**: Loading the mobile homepage no longer runs any script.
- **Complexity**: S — **P2**

### IM-13 — Add `@noframes`
- **Current**: Absent.
- **Problem**: Script runs inside any IMDb iframe (e.g. trailer overlays, embedded widgets), where DOM is partial and the script does redundant work / could error.
- **Fix**: Add `// @noframes` to the metadata block.
- **Verify**: Open a trailer modal → console shows no `[IMDb Enhanced]` init.
- **Complexity**: S — **P1**

### IM-14 — Cache size cap & per-key TTL audit
- **Current**: Cache entries (RT / MC) accumulate forever; collapse states (`enh_coll_*`) also accumulate per visited section per show.
- **Problem**: `GM_listValues()` returns more and more entries; on shows with many sections, storage bloats. Tampermonkey hard cap on storage is ~5 MB.
- **Fix**: At init, walk `GM_listValues()`, drop entries older than TTL (RT/MC) and drop `enh_coll_*` keys older than 90 days (track timestamp).
- **Verify**: Manually inject 200 cache entries with stale timestamps → after reload, only fresh entries remain.
- **Complexity**: S — **P2**

### IM-15 — `keyboardShortcuts` collision audit
- **Current**: `,` and `s` both toggle settings; `c` copies ID; `r` scrolls to rating; `t` scrolls to top ([IMDb_Enhanced.user.js:1504-1508](IMDb_Enhanced.user.js#L1504-L1508)).
- **Problem**: `s` collides with sites that use `s` for site-wide search. `,` is rarely typed but a long-form title with a comma in user-typed search collides if focus leaves the input.
- **Fix**: Drop `,`; keep `s` but require Shift (`?`); document binding in settings.
- **Verify**: Type "Bend it like Beckham, the sequel" into IMDb search box without triggering settings.
- **Complexity**: S — **P3**

### IM-16 — Title-area widget insertion: single anchor, predictable order
- **Current**: `searchButtons`, `externalLinks`, `tvShowEnhancements`, `quickCopyID` each compute their own insertion anchor (`getTitleActionAnchor`, `titleEl.parentElement`, `getTitleSurface`, falling back to each other). Order depends on which feature wins the race.
- **Problem**: Inconsistent visual rhythm; the recent "Stabilize" commit only fixed `searchButtons`.
- **Fix**: Introduce a single `enh-title-stack` `<div>` inserted once after the title; each feature appends in registration order. Destroys are cleaner too.
- **Touches**: Anchor functions, 4 feature inits, 4 destroys.
- **Verify**: Refresh five different titles in random order; stack order is always Watch search → External links → TV chips → Subtitle row → Copy-ID.
- **Complexity**: M — **P1**

### IM-17 — Trakt URL — go direct
- **Current**: `https://trakt.tv/search/imdb?query=tt…` — lands on a search-results page.
- **Problem**: User has to click once more.
- **Fix**: Use `https://trakt.tv/redirect/imdb/tt…` (or `https://trakt.tv/find?q=tt…` which 302s direct to the title). Verify with one sample.
- **Touches**: [IMDb_Enhanced.user.js:1314](IMDb_Enhanced.user.js#L1314), [IMDb_Enhanced.user.js:1337](IMDb_Enhanced.user.js#L1337), [IMDb_Enhanced.user.js:1439](IMDb_Enhanced.user.js#L1439).
- **Verify**: Each link lands on the title page in one hop.
- **Complexity**: S — **P3**

### IM-18 — RT slug strategy: try multiple delimiters, then search
- **Current**: Single slug pattern `replace(/\s+/g, '_')` then fallback to search.
- **Problem**: RT alternates between `_` and `-` historically; titles with apostrophes or numerals miss.
- **Fix**: Try `_` → `-` → `+` (rare) → search; first 200 wins, cache the winning URL.
- **Touches**: `inlineRTScore.init` ([IMDb_Enhanced.user.js:968-975](IMDb_Enhanced.user.js#L968-L975)).
- **Verify**: For a sample of 20 titles, hit-rate ≥ 80 % on direct URL (vs current ≈ 50 %).
- **Complexity**: S — **P2**

### IM-19 — `getMediaType` returns more granular kinds
- **Current**: `'tv'` if `TVSeries`/`TVEpisode`, else `'movie'`. Episode pages (`/title/tt…/episodes`) get treated as full series.
- **Problem**: A future feature that targets episodes specifically can't tell.
- **Fix**: Return `'series' | 'episode' | 'miniseries' | 'movie' | 'short'` based on `ld['@type']` and `ld.episode` presence.
- **Touches**: `getMediaType` and 4 call sites.
- **Verify**: `console.log(getMediaType())` on each type returns the right string.
- **Complexity**: S — **P3**

### IM-20 — Bundle a `tests/fixtures/` directory of saved IMDb pages
- **Current**: Only one `Black Mirror …mhtml` in the repo root, untracked.
- **Problem**: When the next refactor breaks selectors, there is no way to validate.
- **Fix**: Create `tests/fixtures/` with: a top-grossing movie title, a TV series, an episode page, a name page, an episodes-list page; commit as `.mhtml`. Add a smoke `tests/run.js` that loads each fixture into a jsdom environment, runs the script's pure helpers (`getIMDbID`, `getTitleText`, `getTitleYear`, `getMediaType`, `findRatingBar`), and asserts.
- **Verify**: `node tests/run.js` exits 0.
- **Complexity**: M — **P2**

---

## Reliability, Security, Privacy, and Data Safety

### Findings (severity, then evidence → recommendation)

1. **RESOLVED — `@connect *` wildcard**.
   - **Resolution**: Removed on 2026-05-24; future network features must add exact hosts only.

2. **PARTIALLY RESOLVED — Broken auto-update channel**.
   - **Resolution**: Dead metadata removed on 2026-05-24.
   - **Remaining risk**: Security fixes still require manual redistribution until the script is published to a stable host.

3. **MEDIUM — Sticks `GM_setValue('movieTitle', …)` (unprefixed global key)** ([IMDb_Enhanced.user.js:1290](IMDb_Enhanced.user.js#L1290)).
   - **Risk**: Collides with any other userscript using the same key (likely several). Not a security issue per se, but a correctness one.
   - **Recommendation**: Prefix with `imdb_enh_`.

4. **MEDIUM — Scraping CSP/anti-bot violations from RT** ([IMDb_Enhanced.user.js:972](IMDb_Enhanced.user.js#L972), [IMDb_Enhanced.user.js:979](IMDb_Enhanced.user.js#L979)).
   - **Risk**: RT's WAF may classify the script as an aggregator and block by IP; user gets surprise 4xx/5xx with no UI feedback.
   - **Recommendation**: Cache misses ([IM-6](#im-6--cache-unavailable-results-too-with-a-shorter-ttl)); on 4xx, surface a discreet status in the widget rather than auto-retrying.

5. **MEDIUM — Plain-text persistence of `themeVariant` etc. is fine, but a future Sonarr/Radarr API-key feature (NF-7) needs warning UI.**
   - **Recommendation**: When NF-7 lands, settings field shows "Stored locally in plain text in your userscript manager — anyone with file access can read this."

6. **LOW — `innerHTML` assignment with template strings** ([IMDb_Enhanced.user.js:1012-1020](IMDb_Enhanced.user.js#L1012-L1020), [IMDb_Enhanced.user.js:1091-1097](IMDb_Enhanced.user.js#L1091-L1097), [IMDb_Enhanced.user.js:1281-1286](IMDb_Enhanced.user.js#L1281-L1286), more).
   - **Risk**: All interpolations are either constants, IMDb-ID regex output (`tt\d+`), encoded URI components, or values from already-DOM-trusted title text. **No user-controlled HTML reaches innerHTML** today — verified by tracing every `innerHTML` write.
   - **Recommendation**: If NF-2 lands (user-provided site colours / labels), switch those rendering paths to `textContent` + `style.setProperty` to avoid the regression.

7. **LOW — Missing `@noframes`** ([IM-13](#im-13--add-noframes)).

8. **LOW — Permissive `[class*="…"]` selectors in ad removal** ([IMDb_Enhanced.user.js:282-284](IMDb_Enhanced.user.js#L282-L284)).
   - **Risk**: False positives hide non-ad UI on IMDb's evolving design.
   - **Recommendation**: Narrow to documented IMDb cel widgets.

9. **LOW — No telemetry / no failure surface**.
   - **Risk**: Silent breakage. `try { … } catch (e) { console.warn(...) }` everywhere. User has no idea a feature didn't init.
   - **Recommendation**: A "Diagnostics" panel in settings listing each feature's last-init outcome.

### Missing guardrails
- Settings export → clipboard contains everything including (future) API keys. Add a "Hide secrets" toggle in export.
- Import → JSON validation is minimal; only `k in DEFAULTS || k === 'themeVariant'` gate. Add strict type checking per key.
- `setTimeout(() => location.reload(), 1000)` after import ([IMDb_Enhanced.user.js:2079](IMDb_Enhanced.user.js#L2079)) — should warn if unsaved changes elsewhere.

### Recovery / rollback
- **No "Reset all to defaults" button.** Users have to clear cache + manually toggle each. Add one.

### Logging / diagnostics
- **No version stamp in console.** Add `console.info('[IMDb Enhanced] vX.Y.Z loaded — N features enabled')` at init.

---

## UX, Accessibility, and Trust

### Onboarding gaps
- **No first-run nudge.** Users install the script and don't know about the FAB; first-run could show a one-time toast: "IMDb Enhanced v2.3.1 is active. Click the cog at bottom-left to configure."
- **No feature discovery in-context.** A user who doesn't know `keyboardShortcuts` exists never finds it. The FAB modal lists it under Utility but doesn't explain "off by default".

### Empty / loading / error states
- Score widgets have skeleton + unavailable states ✓ ([IMDb_Enhanced.user.js:1023-1049](IMDb_Enhanced.user.js#L1023-L1049)). Quality-wise this is the best part of the script.
- **No `aria-busy` on the loading skeleton** — screen readers read "Loading Rotten Tomatoes score" once via `aria-label` but don't get updates.
- **Settings panel has no empty state** for the import textarea — pasted-empty `Apply import` shows a toast but cursor never returns to the textarea.

### Destructive or irreversible actions
- **Clear cache** ([IMDb_Enhanced.user.js:2082-2095](IMDb_Enhanced.user.js#L2082-L2095)) is one-click no-confirm. Cache is just RT/MC results so acceptable, but if NF-5 (Watched marking) lands, that data must not be cleared by the same button — split or confirm.
- **Import settings** auto-reloads the page after 1 s ([IMDb_Enhanced.user.js:2078-2079](IMDb_Enhanced.user.js#L2078-L2079)) — no preview of what changed.

### Settings clarity
- **`Theme variant` row** mixes one-of-three radio swatches into the same row layout as boolean toggles. Visually inconsistent.
- **Feature descriptions** (the polish commit's strength) are uniformly good — keep.
- **Footer note** "Stored locally in your userscript manager" is honest. Keep.

### Accessibility
- **Settings dialog**: ARIA roles + focus trap + `Esc` close all present ([IMDb_Enhanced.user.js:1942-2053](IMDb_Enhanced.user.js#L1942-L2053)). Initial focus could improve ([IM-10](#im-10--settings-panel-focus-management)).
- **QuickNav rail**: Uses `<a href="#">` with `e.preventDefault()` and `aria-label="Jump to …"`. Better: `<button>` with the same handler — anchors without real hrefs are a known screen-reader nuisance.
- **Toggle switch** ([IMDb_Enhanced.user.js:1772-1792](IMDb_Enhanced.user.js#L1772-L1792)): correctly uses `<input type="checkbox">` under a visual wrapper. ✓
- **Theme swatch buttons**: have `aria-pressed`, `aria-label`. ✓
- **Reduced-motion query** present ✓ ([IMDb_Enhanced.user.js:752-759](IMDb_Enhanced.user.js#L752-L759)).
- **High-contrast theme**: missing ([NF-9](#nf-9--high-contrast-and-light-themes)).
- **Single-letter icons in QuickNav** ("O", "C", "R", "S", "D", "$", "?") — `aria-label` mitigates, but sighted users have to memorise; consider a configurable show-labels mode.

### Microcopy and trust signals
- **"WATCH SEARCH" / "TOMATOMETER" / "METASCORE" all uppercase** — visually inconsistent with IMDb's sentence-case treatment. The polish commit moved feature names to sentence case ("Hide news modules"); apply the same rule to widget labels.
- **No version chip in the page** outside the settings panel — power users can't tell at a glance which version is running.
- **No update-available indicator** in the FAB even if `@updateURL` worked. (Tampermonkey handles updates separately, but a soft prompt is friendly.)

---

## Architecture and Maintainability

### Module / boundary improvements
- **Single-file is fine for distribution**, but the source is a candidate for a build step (`esbuild --bundle`) that concatenates `src/features/*.js`, `src/themes.js`, `src/settings/*.js` into the final `.user.js`. Userscript managers won't care — they see one file — but maintenance benefits.
- **Feature pattern is solid**: `reg({ key, name, group, init, destroy, css? })` is the right abstraction. Make `css` first-class (handled centrally with auto `addCSS`/`removeCSS`) so individual `init`/`destroy` shrink.
- **Title-stack insertion** ([IM-16](#im-16--title-area-widget-insertion-single-anchor-predictable-order)) is the biggest boundary win.

### Refactor candidates
- **`getThemeCSS` is 337 lines of strings.** Extract `THEMES` and the CSS template separately; many rules don't depend on theme variables and can live in a shared block.
- **`_render` / `_renderLoading` / `_renderUnavailable` in RT and MC are 90 % identical** ([IMDb_Enhanced.user.js:1004-1049](IMDb_Enhanced.user.js#L1004-L1049) vs [IMDb_Enhanced.user.js:1084-1126](IMDb_Enhanced.user.js#L1084-L1126)). Extract a `makeScoreWidget({ id, label, link, score, sub, colourFn, state })` helper.
- **CSS `addCSS(...)` blocks scattered through features**: Move all per-feature CSS into a single map keyed by feature `key`; lifecycle automatically tied to enabled state.

### Test gaps
- Zero tests. Pure helpers (`getIMDbID`, `getTitleText`, `getTitleYear`, `getMediaType`, `ratingColor`, `mcColor`, `rtColorFn`) are trivially unit-testable. See [IM-20](#im-20--bundle-a-testsfixtures-directory-of-saved-imdb-pages).

### Documentation gaps
- **No README**: install instructions, feature list, screenshots, troubleshooting.
- **No CHANGELOG**: `CODEX_CHANGELOG.md` is gitignored. Decide if it should be tracked (recommended) or replaced with `CHANGELOG.md`.
- **No CONTRIBUTING / AGENTS.md**: guidance for future agents that the design-system + feature-registry contract must be preserved.
- **No screenshots** anywhere.

### Release / build / deployment gaps
- **No `package.json`**, no semver-managed release.
- **Two places define VERSION**: header `@version 2.3.1` and `const VERSION = '2.3.1'`. Should be templated from one source via a build step.
- **No CI**: no lint, no syntax check, no version bump check.
- **Backups in working tree** (`*.bak`, `*.pre-polish-*.bak`) — gitignored but cluttering the repo. Consider moving to a `.backups/` directory or deleting after merge.
- **No tag, no release**: `git tag v2.3.1` doesn't exist.

---

## Prioritized Roadmap

### Phase 0 — Stop the bleeding (this week)

- [x] **P0** — Fix `@updateURL` / `@downloadURL` 404
  - Why: Users get zero updates today; security fixes never propagate.
  - Evidence: `gh repo view SysAdminDoc/IMDb-Enhanced` returns 404 (verified above).
  - Touches: [IMDb_Enhanced.user.js:28-29](IMDb_Enhanced.user.js#L28-L29).
  - Acceptance: No dead GitHub update URL remains while the repo has no remote; a working hosted update channel is deferred to publishing.
  - Verify: `rg "@updateURL|@downloadURL" IMDb_Enhanced.user.js` returns no matches.

- [x] **P0** — Replace dead Subscene with SubDL + YIFY-Subs
  - Why: Two broken links on every TV/movie page since May 2024.
  - Evidence: [Subscene shutdown announcement](https://alternativeto.net/news/2024/5/popular-subtitles-platform-subscene-announces-sudden-shutdown-leaving-users-in-shock/); references in [IMDb_Enhanced.user.js:1352](IMDb_Enhanced.user.js#L1352), [IMDb_Enhanced.user.js:1462](IMDb_Enhanced.user.js#L1462).
  - Touches: `_DB.Subtitles` + `subtitleLinks` chip row.
  - Acceptance: SubDL title search is used for movies/TV; YIFY direct IMDb links are shown only for movies.
  - Verify: `Invoke-WebRequest -Method Head https://subdl.com/search/Inception`, `https://subdl.com/search/Black%20Mirror`, and `https://yifysubtitles.ch/movie-imdb/tt1375666` return 200.

- [x] **P0** — Replace `@connect *` with explicit whitelist
  - Why: Security smell; blocks Greasy Fork; user trust.
  - Evidence: [IMDb_Enhanced.user.js:25](IMDb_Enhanced.user.js#L25).
  - Touches: Userscript header.
  - Acceptance: Only documented domains appear in Tampermonkey's permissions dialog.
  - Verify: `rg "@connect\\s+\\*" IMDb_Enhanced.user.js` returns no matches.

- [x] **P0** — Add SPA navigation re-init
  - Why: Single biggest user-visible breakage when navigating cast → title → MoreLikeThis.
  - Evidence: `init()` runs once ([IMDb_Enhanced.user.js:2155-2156](IMDb_Enhanced.user.js#L2155-L2156)); IMDb is Next.js SPA (drawer markup in saved MHTML).
  - Touches: `init` + new `router()` block; every feature's `init`/`destroy` needs to be idempotent (already mostly).
  - Acceptance: Navigate title → cast → another title; watch-buttons / external-links / score widgets visible every time.
  - Verify: Console counter `[IMDb Enhanced] v2.3.1 — init #N` increments per route change.

- [x] **P0** — Stop spamming RT/MC on "unavailable" results
  - Why: Faster page loads + lower 4xx rate.
  - Evidence: [IMDb_Enhanced.user.js:1034-1049](IMDb_Enhanced.user.js#L1034-L1049) — no `cacheSet`.
  - Touches: `_renderUnavailable`, `cacheGet/cacheSet`.
  - Acceptance: Reloading a niche title shows the placeholder with zero outbound requests.
  - Verify: DevTools network tab.

### Phase 1 — Reliability + quality (next sprint)

- [x] **P1** — Move title-area widgets to a single `enh-title-stack`
  - Why: Recent commits `eb9980e` + `aa3e4e5` already tried to stabilise insertion; a single stack ends the whack-a-mole.
  - Evidence: Insertion-anchor drift across `searchButtons`/`externalLinks`/`tvShowEnhancements`/`quickCopyID`.
  - Touches: `getTitleActionAnchor` users; new `getOrCreateTitleStack()`.
  - Acceptance: Order is deterministic; destroys empty the stack.
  - Verify: `node --check IMDb_Enhanced.user.js`; manual visual refresh still recommended across 5 different live titles.

- [x] **P1** — Letterboxd inline score (NF-1)
  - Why: Cinephiles ask for this constantly; competitor scripts have 70k+ installs.
  - Evidence: [cvzi/Letterboxd-userscript](https://github.com/cvzi/Letterboxd-userscript) uses `meta[name="twitter:data2"]` from `letterboxd.com/imdb/{ttid}/`.
  - Touches: New `inlineLetterboxdScore` feature; share score-widget helper.
  - Acceptance: Letterboxd rating appears on films, suppressed on TV (Letterboxd is films-only).
  - Verify: `node --check IMDb_Enhanced.user.js`; `Invoke-WebRequest https://letterboxd.com/imdb/tt1375666/` exposes `twitter:data2`; `tt2085059` returns Letterboxd's not-found marker and the feature is gated by IMDb media type.

- [x] **P1** — User-configurable watch-search + external-links lists (NF-2)
  - Why: Hard-coded grey-market streaming sites are the single biggest rot vector.
  - Evidence: 7 sites at [IMDb_Enhanced.user.js:1271-1279](IMDb_Enhanced.user.js#L1271-L1279); `IMDb: Link 'em all!` (3.7k installs) shows demand.
  - Touches: DEFAULTS, both features, settings panel adds editable table rows.
  - Acceptance: Add a custom site → button renders → click launches; remove → button gone.
  - Verify: `node --check IMDb_Enhanced.user.js`; settings editor supports add/remove/reset for both stored lists; renderers consume sanitized `watchSites` / `externalSites`.

- [x] **P1** — TV episode tools: spoiler-blur + best-episodes panel (NF-4)
  - Why: Anthologies (Black Mirror is literally the saved fixture) demand it.
  - Evidence: `spoilerBlur` is title-only ([IMDb_Enhanced.user.js:1195-1202](IMDb_Enhanced.user.js#L1195-L1202)).
  - Touches: New `@match` for `/title/*/episodes*`; new `tvEpisodeTools` feature.
  - Acceptance: Episode synopses blurred; "Top 10" panel renders for >= 10 rated episodes.
  - Verify: `node --check IMDb_Enhanced.user.js`; saved Black Mirror fixture contains `EpisodeRatingCard_*` title/rating/plot markup targeted by the selectors. Manual live `/episodes/` validation is still recommended because IMDb returned bot verification to non-browser fetches.

- [x] **P1** — Replace hashed `.sc-XXXXXXXX` selectors (IM-5)
  - Why: Next IMDb deploy will silently invalidate big chunks of the theme.
  - Evidence: 30+ hashed classes in `getThemeCSS`.
  - Touches: `getThemeCSS`, `enh-collapsible` exception list, `getTitleYear`.
  - Acceptance: After diffing, no `.sc-` class remains except those with a `// LAST-VERIFIED-YYYY-MM-DD` comment.
  - Verify: `rg "\\.sc-|sc-[0-9a-fA-F]+|sc-[a-z0-9]+" IMDb_Enhanced.user.js` returns no matches; `node --check IMDb_Enhanced.user.js`.

- [x] **P1** — Add `@noframes` (IM-13)
  - Why: Stops redundant init inside trailer modals & embedded iframes.
  - Touches: header.
  - Verify: `console.info` only fires once per page.

- [x] **P1** — Resilient `getTitleYear` via JSON-LD + regex fallback (IM-9)
  - Why: Hashed selector at [IMDb_Enhanced.user.js:223](IMDb_Enhanced.user.js#L223) is fragile.
  - Touches: `getTitleYear`.
  - Verify: `node --check IMDb_Enhanced.user.js`; helper now tries structured data before stable DOM/title regex fallbacks.

### Phase 2 — Depth + reach (next month)

- [x] **P2** — Streaming availability inline (NF-6)
  - Why: One-glance "Where can I stream this?" is the killer feature.
  - Touches: New `streamAvailability` feature; `@connect www.justwatch.com`.
  - Acceptance: Provider text is parsed from public JustWatch title/search pages and rendered inline; unavailable lookups are cached.
  - Verify: `node --check IMDb_Enhanced.user.js`; live sample metadata for Inception, Black Mirror, and The Matrix returned Netflix / Prime Video / Disney+ provider strings.

- [x] **P2** — Light + high-contrast themes (NF-9)
  - Why: `prefers-color-scheme` users; WCAG.
  - Touches: `THEMES`, `injectEarlyThemeShell`, settings selector.
  - Acceptance: Light and High contrast swatches are available; OS light/dark changes resolve to Light/Dark and update active swatches when `themeAuto = true`.
  - Verify: `node --check IMDb_Enhanced.user.js`; `rg "color-scheme: dark" IMDb_Enhanced.user.js` returns no hard-coded theme shell.

- [x] **P2** — Personal Watched / Skip marks (NF-5)
  - Why: Power-user retention; doesn't require IMDb login.
  - Touches: Poster-card delegated listener; settings review panel.
  - Acceptance: Watched / Skip marks persist in `userMarks`, render on hero and poster cards, and can be reviewed or cleared from settings.
  - Verify: `node --check IMDb_Enhanced.user.js`; delegated controls write local mark state and resync visible marked cards.

- [x] **P2** — Sonarr / Radarr quick-add (NF-7)
  - Why: Self-hosters demand it; precedent in Greasy Fork.
  - Touches: New `servarrIntegration`; settings fields with API keys/root/profile IDs; `httpRequest` POST support; local Servarr `@connect` entries.
  - Acceptance: Configured movie pages show Add Radarr; configured series pages show Add Sonarr; each performs Servarr lookup then POST add and surfaces failures in a toast.
  - Verify: `node --check IMDb_Enhanced.user.js`; local-only request permissions are explicit (`localhost`, `127.0.0.1`) without restoring wildcard `@connect`.

- [x] **P2** — Cache GC + per-key TTL (IM-14, IM-6)
  - Why: Storage cap; faster loads.
  - Touches: `cacheGet/cacheSet`, init-time GC.
  - Acceptance: Storage stays bounded at 120 live cache records; "unavailable" results are cached for 24 h while successful lookups keep the 7-day default.
  - Verify: `node --check IMDb_Enhanced.user.js`; cache GC runs once per page session and deletes expired/corrupt/oldest overflow keys.

- [ ] **P2** — Consolidate rating-display + rating-color-coding (IM-7)
  - Why: Avoid duplicate `text-shadow` writes.
  - Touches: Both feature CSS blocks.
  - Acceptance: Toggling each independently behaves consistently.

- [ ] **P2** — Settings panel: focus first focusable on open (IM-10)
  - Why: WCAG 2.4.3.
  - Acceptance: Open settings → Tab → first toggle reached.

- [ ] **P2** — Cineby host preference + namespaced storage key (IM-11)
  - Why: User choice + no key collision.
  - Acceptance: Switch host → search lands on chosen host.

- [ ] **P2** — Tighten `m.imdb.com` match scope (IM-12)
  - Why: Avoid running on irrelevant mobile pages.
  - Acceptance: Mobile homepage no longer runs the script.

- [ ] **P2** — RT slug multi-delimiter strategy (IM-18)
  - Why: Higher direct-hit rate.
  - Acceptance: ≥ 80 % hit rate on a 20-title sample.

- [ ] **P2** — Test fixture harness (IM-20)
  - Why: Lock in the design contract; catch selector regressions.
  - Acceptance: `node tests/run.js` exits 0.

### Phase 3 — Polish + reach (when convenient)

- [ ] **P3** — Trailer popover (NF-8)
- [ ] **P3** — Watchlist batch IMDb-ID copy (NF-10)
- [ ] **P3** — `getMediaType` returns granular kinds (IM-19)
- [ ] **P3** — Direct Trakt redirect URL (IM-17)
- [ ] **P3** — Keyboard-shortcut collision audit (IM-15)
- [ ] **P3** — Publish to Greasy Fork (precondition: P0 connect-whitelist + P0 update-URL fixed; consider removing grey-market default sites first)
- [ ] **P3** — README + screenshots + CHANGELOG (move from gitignored `CODEX_CHANGELOG.md` to a tracked file)
- [ ] **P3** — `package.json` + esbuild build step + version single-source-of-truth

---

## Quick Wins

These are <= 1-hour changes with clear value:

1. **Done 2026-05-24** — Replace dead Subscene URL in `_DB.Subtitles` and `subtitleLinks` (IM-1).
2. **Done 2026-05-24** — Add `@noframes` to the userscript header (IM-13).
3. **Done 2026-05-24** — Fix `@updateURL` to a working location or remove it (IM-2).
4. **Done 2026-05-24** — Lock `@connect *` to an explicit service whitelist (IM-3).
5. **Done 2026-05-24** — `cacheSet` unavailable results so we stop hammering RT/MC (IM-6).
6. **Namespace `GM_setValue('movieTitle', …)` to `imdb_enh_cineby_query`** (IM-11 part).
7. **Reset-to-defaults button** in settings (recovery gap).
8. **Console info stamp** at init: `[IMDb Enhanced] v2.3.1 — N features enabled`.
9. **Settings panel: focus the close button on open** (IM-10).
10. **Drop the `,` keyboard shortcut**, keep `s` only (IM-15 part).
11. **Direct Trakt redirect URL** swap (IM-17) — one-line per call site.

---

## Larger Bets

These need design + staged rollout:

- **NF-2 user-configurable lists** — touches default schema, settings UI, export/import format. Migration concern: existing users had a fixed list; on upgrade, seed with current defaults so nothing visually changes until they edit.
- **NF-3 SPA re-init** — needs careful destroy/init sequencing for every feature; a one-time test sweep across all 24 features.
- **IM-5 selector hardening** — visual regression risk across the whole theme; do per-section with screenshot diffs.
- **NF-4 episode tools** — new `@match` + new fixture for the episode list page + tested sort logic.
- **NF-7 Servarr** — first feature that stores secrets; sets a precedent for "settings with API keys" UI patterns and threat-model docs.
- **Distribution overhaul** — Greasy Fork publication, README, screenshots, CI release tag. Combined with NF-2 (split grey-market sites), this is a strategic move from "private script" to "discoverable userscript".

---

## Explicit Non-Goals

- **Do not build an OAuth/Trakt-scrobbler.** That's a separate userscript (TraktFlow); scope creep.
- **Do not implement IMDb's official GraphQL.** Requires AWS Data Exchange subscription per-user — non-viable for a public userscript.
- **Do not add Douban-style localisation.** Out of audience; competitors (MoreMovieRatings) already serve that niche.
- **Do not bundle a torrent-search engine** beyond the existing link-out (legal + Greasy Fork risk).
- **Do not auto-add titles to Plex / Jellyfin libraries.** Sonarr/Radarr quick-add (NF-7) is the right boundary — they have explicit user opt-in and per-user URLs/keys.
- **Do not implement a full light theme that perfectly matches IMDb's own light look.** Aim for "usable" not "pixel-perfect".

---

## Open Questions

These block correct prioritisation; everything else can be answered from the code or the public web.

1. **Does the maintainer want the GitHub repo public** (to enable `@updateURL` + Greasy Fork publication), or is this intentionally a private redistribution script? Determines whether NF-2 (configurable lists) should ship grey-market defaults or only ship a curated/legal default set.
2. **Should `CODEX_CHANGELOG.md` and `CLAUDE.md` (currently gitignored) become tracked files?** If yes, this report can integrate with them; if no, this file is the single planning record.
3. **Which streaming sites in `searchButtons` does the maintainer use personally?** Determines which to keep as built-in defaults vs delete entirely.
4. **What is the maintainer's tolerance for fetching third-party APIs (Letterboxd, JustWatch) on every page view?** A per-feature "Auto-fetch / Click-to-fetch" toggle would address it; the answer determines the default.
