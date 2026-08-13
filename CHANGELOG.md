# Changelog

## 2.6.0 — 2026-08-13

### Added

- Redesigned the complete desktop settings workspace into six accessible destinations: Experience, Ratings, Tools, Sites, Integrations, and Data.
- Added automatic-save feedback, keyboard-driven vertical tabs, focus containment, validated JSON import, editable local title marks, rating previews, and tabbed local-service configuration; the closed dialog is removed from the keyboard tab order.
- Added early, scoped ad-request cancellation for userscript managers that expose `GM_webRequest`, plus current IMDb ad-shell, sticky-placement, and tracking-pixel suppression at `document-start`.
- Added regression coverage for request rules, document-start style attachment, route-scoped features, canonical title links, current external routes, preserved IMDb controls/media, and the settings information architecture.

### Changed

- Scoped the userscript to desktop IMDb routes and made feature activation route-aware across title, localized title/name, person, episode-list, list/watchlist, and chart pages.
- Updated Cineby search handoff for its current root-page search UI and replaced retired Trakt IMDb links with the current app search route.
- Increased the desktop settings canvas and reorganized all controls around task-oriented navigation while preserving existing setting keys and defaults.

### Fixed

- Prevented `document-start` style injection from failing before a style host exists.
- Preserved IMDb's hero trailer player, sign-in/account menu, favorite-person controls, consent boundaries, and legal footer during cleanup and theming.
- Prevented title tools from appearing on person and collection surfaces, restored cleanup on those routes, and kept SPA reinitialization idempotent.
- Prevented watched marks from decorating showtime and nested non-title links.
- Prevented built-in URL templates from duplicating the `tt` prefix in IMDb identifiers.
- Made text and site-editor changes persist immediately and refresh dependent features only after committed changes.
- Removed the unreliable background favicon probe that contacted every watch-site origin and could treat DNS or TLS failures as healthy; stale probe data is cleaned up automatically.
- Kept the last valid custom-site list while incomplete URLs are edited, added a visible invalid state, completed nested-tab Home/End behavior, and restored IMDb's prior scroll-lock style when settings close.
- Cancelled pending DOM and visibility observers during route teardown, aborted route-owned request handles where supported, guarded delayed feature and service callbacks by route generation, and prevented stale score responses from rendering after navigation.
- Waited for the current rating surface before rendering cached scores and kept third-party rating/availability requests lazy until that surface is near the viewport.
- Caught both synchronous and asynchronous feature-start failures; settings-triggered failures now surface a recovery toast instead of remaining console-only.
- Replaced third-party score-response HTML interpolation with safe DOM construction, numeric checks, bounded text attributes, and HTTPS domain allowlists for Letterboxd, Metacritic, and JustWatch links; custom site templates now reject embedded URL credentials.

## 2.5.1 — 2026-08-12

- Drained the active roadmap while preserving the single-file userscript and version-only npm lifecycle.

## 2.5.0 — 2026-06-27

### Added
- **Plex/Jellyfin/Emby library indicator**: Optional local media server checks show whether the current IMDb title already exists in configured Plex, Jellyfin, or Emby libraries.
- **Media server settings**: Added localhost-only URL/token fields for Plex and URL/API key fields for Jellyfin and Emby.
- **Greasy Fork guardrail tests**: Smoke tests now prevent wildcard `@connect`, external executable metadata, dynamic script creation, `eval`, `new Function`, and confirmation dialogs from returning.

### Changed
- Settings reset and title-mark clearing now execute immediately with toast feedback instead of confirmation dialogs.

## 2.4.0 — 2026-06-20

### Added
- **Streaming site refresh**: Replaced 4 dead default sites (Popcorn, XPrime, Aether, Rive) with 7 verified working sites (StreamXTV, LookMovie, CineVids, CinemaOS, LivNet, Flixer, Cine.su). Retained Fmovies+.
- **Cineby domain update**: Migrated from dead cineby.sc/gd/app domains to cineby.at.
- **Radarr/Sonarr library status indicator**: Green dot and "In Library" label when a title already exists in your Radarr or Sonarr library.
- **RT consensus on hover**: Hovering the Rotten Tomatoes score shows the critics consensus text as a tooltip.
- **Site health-check**: Watch site buttons automatically probe each domain and visually mute dead sites with strikethrough and "(offline)" label. Results cached for 6 hours.
- **Inline rating histogram**: Compact 1-10 vote distribution bar chart beside the IMDb rating, extracted from page data.
- **List multi-search**: "Search All On" bar on watchlist, custom list, and chart pages opens each title on a selected streaming site with rate limiting.
- **List/chart page support**: Extended @match to include /list/* and /chart/* URLs.

### Changed
- Test harness updated to match current metadata expectations (update channel, dead domain checks, version sync).

## 2.3.1

- Trailer popover with YouTube search.
- Watchlist batch IMDb ID copy.
- Granular media type detection (movie/series/episode/miniseries/short).
- Direct Trakt IMDb URLs.
- Keyboard shortcut collision cleanup.

## 2.3.0

- JustWatch streaming availability.
- Light and high contrast themes.
- Local watched/skip marks.
- Servarr (Radarr/Sonarr) quick-add.
- Cache garbage collection.
- Cineby host preference.
- RT slug broadening.
- Mobile match scoping.

## 2.2.0

- Title stack consolidation.
- Letterboxd inline scores.
- Configurable link lists.
- TV episode tools.
- Resilient title-year parsing.

## 2.1.0

- Dead update metadata removed.
- `@connect *` removed (explicit whitelist).
- Subscene replaced with OpenSubtitles.
- Unavailable score caching.
- SPA route re-initialization.

## 2.0.0

- Initial public release with theme system, rating aggregation, page cleanup, and configurable link sites.

## Roadmap archive — 2026-08-10 — ROADMAP.md

<details>
<summary>Original roadmap snapshot</summary>

```markdown
# IMDb Enhanced Roadmap

Research context lives in [RESEARCH.md](RESEARCH.md).
Blocked items live in [Roadmap_Blocked.md](Roadmap_Blocked.md).

## Active Constraints

- Live IMDb selector behavior needs manual browser validation because
  non-browser fetches can hit bot verification.
- Keep the single-file userscript simple. The build step (`npm version`)
  only syncs versions — no bundling or transpilation.

## Open Work

No actionable items remain. Blocked items are tracked in
[Roadmap_Blocked.md](Roadmap_Blocked.md).
```

</details>
