# Changelog

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
