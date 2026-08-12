[![Version](https://img.shields.io/badge/version-2.5.1-blue)](https://github.com/SysAdminDoc/IMDb_Enhanced)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Tampermonkey%20%7C%20Violentmonkey-yellow)](https://www.tampermonkey.net/)

# IMDb Enhanced

A premium IMDb overhaul delivered as a single userscript. Cleaner pages, modern themes, aggregated scores from Rotten Tomatoes, Letterboxd, and Metacritic, streaming site quick-search, Radarr/Sonarr integration, Plex/Jellyfin/Emby library indicators, and more.

## Features

**Page Cleanup** - Removes ads, tracking pixels, IMDbPro upsells, news modules, app banners, sponsored content, and contribution prompts.

**Theme System** - Five themes (Dark, OLED, Midnight, Light, High Contrast) with a full design system: semantic colors, 3-tier elevation, 4px grid spacing, squircle avatars, hover lifts, and smooth transitions. Auto-theme follows OS preference.

**Aggregated Scores** - Inline Rotten Tomatoes (with critics consensus on hover), Letterboxd, and Metacritic scores fetched and cached alongside IMDb's rating. Rating histogram shows 1-10 vote distribution at a glance.

**Streaming Availability** - JustWatch integration shows which streaming services carry the title.

**Watch Site Search** - Quick-search buttons for streaming sites (StreamXTV, LookMovie, CineVids, CinemaOS, LivNet, Flixer, Cine.su, Fmovies+, Cineby). Fully configurable in settings. Dead sites auto-detected and visually muted.

**External Links** - One-click links to Rotten Tomatoes, Letterboxd, TMDB, YouTube trailers, Wikipedia, JustWatch, and Trakt. Configurable.

**Trailer Popover** - In-page trailer modal backed by YouTube search. No page navigation needed.

**Radarr/Sonarr Integration** - Quick-add buttons with library status indicator (green dot when a title is already in your library). Localhost-only for security.

**Media Server Indicator** - Optional Plex, Jellyfin, and Emby checks show whether the current title already exists in your local media library. Localhost-only for security.

**Watched Marking** - Local watched/skip marks on title posters and recommendation cards. No IMDb login required.

**TV Tools** - Episode synopsis blur, highest-rated episode highlighting, TV-specific lookup shortcuts.

**List Page Tools** - Batch IMDb ID copy and multi-search (open all titles on a selected streaming site) on watchlist, custom list, and chart pages.

**Extras** - Collapsible sections with remembered state, spoiler blur, quick navigation sidebar, wider layout, compact header, subtitle links, copy IMDb ID button, settings import/export.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/).
2. [Click here to install the userscript](https://raw.githubusercontent.com/SysAdminDoc/IMDb_Enhanced/main/IMDb_Enhanced.user.js).
3. Visit any IMDb title page. Open settings with the gear icon.

Updates are delivered automatically via the `@updateURL` metadata.

## Configuration

Click the gear icon on any IMDb page to open settings. Every feature can be toggled individually.

**Watch Sites** - Add, remove, reorder, and customize streaming site buttons with name, URL template, and color.

**External Links** - Same customization as watch sites for research/trailer links.

**Cineby** - Preferred Cineby host selector (search handoff via local storage key).

**Radarr/Sonarr** - URL, API key, root folder, and quality profile for each. Localhost/127.0.0.1 only.

**Media Servers** - Plex URL/token and Jellyfin/Emby URL/API key fields for local library checks. Localhost/127.0.0.1 only.

**URL Templates** - Use `{{TITLE}}`, `{{TITLE_DASH}}`, `{{TITLE_SLUG}}`, `{{IMDB_ID}}`, `{{IMDB_NUM}}`, `{{TRAKT_TYPE}}`, `{{YEAR}}` in custom site URLs.

**Import/Export** - Full settings backup and restore as JSON.

## Themes

| Dark (default) | OLED | Midnight | Light | High Contrast |
|---|---|---|---|---|
| Deep charcoal surfaces | True black backgrounds | Navy blue tones | Clean white | WCAG AAA compliant |

## License

[MIT](LICENSE)
