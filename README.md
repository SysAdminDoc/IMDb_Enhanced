[![Version](https://img.shields.io/badge/version-2.12.0-blue)](https://github.com/SysAdminDoc/IMDb_Enhanced)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Tampermonkey%20%7C%20Violentmonkey-yellow)](https://www.tampermonkey.net/)

# IMDb Enhanced

A desktop IMDb overhaul delivered as a single userscript and a Chromium Manifest V3 extension. Cleaner pages, modern themes, aggregated scores from Rotten Tomatoes, Letterboxd, and Metacritic, streaming site quick-search, Radarr/Sonarr integration, Plex/Jellyfin/Emby library indicators, and more.

## Features

**Page Cleanup** - Removes current IMDb ad shells, sticky placements, tracking pixels, IMDbPro upsells, news modules, app prompts, sponsored content, and contribution prompts at `document-start`. The extension build also uses Manifest V3 dynamic request rules for the known ad and measurement hosts; the userscript keeps the manager-dependent `GM_webRequest` path.

**Theme System** - Five themes (Dark, OLED, Midnight, Light, High Contrast) with a full design system: semantic colors, 3-tier elevation, 4px grid spacing, squircle avatars, hover lifts, and smooth transitions. Auto-theme follows OS preference.

**Aggregated Scores** - Inline Rotten Tomatoes (with critics consensus on hover), Letterboxd, and Metacritic scores fetched lazily near IMDb's rating and cached locally. Lookups first resolve the exact service page through Wikidata's public IMDb-to-service identifier mapping; titles it does not cover fall back to search, where matches require an exact title and media type plus a release year within one year. Navigation aborts route-owned lookups when the manager provides an abort handle, and stale responses are discarded regardless. Rating histogram shows 1-10 vote distribution at a glance.

**Streaming Availability** - JustWatch integration shows which streaming services carry the title, using the same lazy, route-aware lookup lifecycle and exact title/type/year identity checks on direct and search-fallback pages.

**Editorial Title Surface** - Title pages use a stable poster-led layout with dedicated actions, score rail, synopsis, cast, and categorized research regions. The native IMDb hero remains the source of truth for live controls and data while the extension presents it in a readable, responsive hierarchy.

Third-party lookups omit destination cookies. Responses are rendered as text, outbound links suppress opener/referrer data, and response-provided URLs are restricted to the expected HTTPS service domains.

**Watch Site Search** - Quick-search buttons for streaming sites (Cineby, StreamXTV, LookMovie2, CinemaOS, LivNet, Flixer, Cine.su, Fmovies+, UFlix, FlixMomo, Movies2Watch, WatchLuna, 1Movies). Fully configurable in settings. Destinations are contacted only when you open them; the userscript does not background-probe every site.

**External Links** - One-click links grouped by purpose: Reviews & ratings (Rotten Tomatoes, Letterboxd, Trakt), Info & research (TMDB, Wikipedia), Trailers & video (YouTube), and Availability (JustWatch). Configurable.

**Trailer Popover** - In-page trailer dialog backed by YouTube search, with focus containment, Escape/overlay close, opener restoration, and stale-result protection. No page navigation needed.

**Radarr/Sonarr/Overseerr Integration** - Quick-add and request buttons that report state: add, pending, requested, processing, or already in your library. Overseerr and Jellyseerr are supported as a request backend and resolve the IMDb ID themselves, so no third-party API key is needed. Localhost-only for security.

**Media Server Indicator** - Optional Plex, Jellyfin, and Emby checks show whether the current title already exists in your local media library. Localhost-only for security; access tokens are sent in request headers, not URLs.

**Private Title Marks** - Local Seen/Skip toggle controls on title posters and on every IMDb title card — charts, lists, watchlists, person filmographies, episode lists, and search results — with exposed pressed state and a newest-first 5,000-title storage bound. They require no login and deliberately do not change or sync IMDb's account-based Watched status.

**TV Tools** - Highest-rated episode highlighting and TV-specific lookup shortcuts. Synopsis blur is opt-in and off by default.

**List Page Tools** - Batch IMDb ID copy plus a popup-safe search queue on watchlist, custom list, and chart pages, including IMDb's locale-prefixed desktop URLs. Prepare up to 20 real new-tab links, open them one gesture at a time, or copy the full link set (a title list for Cineby's local handoff).

**Extras** - Collapsible sections with remembered state, optional keyboard-revealable spoiler blur, a keyboard-complete expanded-links menu, quick navigation sidebar, wider layout, compact header, subtitle links, copy IMDb ID button, and settings import/export.

## Userscript install

1. On a desktop browser, install [Tampermonkey](https://www.tampermonkey.net/), [Violentmonkey](https://violentmonkey.github.io/), or [ScriptCat](https://github.com/scriptscat/scriptcat).
2. **On Chrome, Edge, Brave, and other Chromium browsers, turn on user scripts first** — see the next section. Firefox needs no extra step.
3. [Click here to install the userscript](https://raw.githubusercontent.com/SysAdminDoc/IMDb_Enhanced/main/IMDb_Enhanced.user.js).
4. Visit any IMDb title page. Open settings with the gear icon.

Updates are delivered automatically via the `@updateURL` metadata.

### Chromium: enable user scripts

Manifest V3 removed the old permissions that userscript managers relied on, so
Chromium browsers now require one manual switch before any userscript runs. The
manager itself must also be a Manifest V3 build (Tampermonkey 5.x, Violentmonkey
2026.7 or newer, or ScriptCat).

- **Chrome 138 and newer:** open `chrome://extensions`, click **Details** on your
  userscript manager, and turn on **Allow User Scripts**.
- **Chrome 137 and older:** open `chrome://extensions` and turn on **Developer
  mode** in the top-right corner.
- **Then reload any IMDb tabs you already had open.** Scripts do not start in
  tabs that loaded before the switch was flipped.

Tampermonkey may show a "Developer mode required" banner on Chrome 138+ even when
Developer mode is already on. The message is out of date — the **Allow User
Scripts** toggle described above is the setting it actually needs.

If you would rather not manage that switch, install the Chromium extension below
instead; it needs none of these steps.

## Chromium extension

The extension build is generated locally from the same userscript source and adds proper extension storage, privileged cross-origin lookups, and stronger request blocking.

1. Install Node.js 18 or newer.
2. From the repository root, run `npm run build:extension`.
3. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the repository's `extension` folder.
4. Open or refresh an IMDb page. After source changes, run the build command again and use the extension card's reload button before refreshing IMDb.

The extension does not auto-update from GitHub; reload the unpacked build after local changes. Its permissions are limited to the supported IMDb/Cineby pages, the on-demand score/trailer services, the known ad hosts, and localhost/127.0.0.1 media integrations.

## Firefox extension

Firefox implements Manifest V3 with event pages instead of service workers and
asks you to approve site access after installing, so it gets its own generated
build. Firefox 142 or newer is required.

1. Run `npm run build:firefox` to generate the `extension-firefox` folder.
2. Open `about:debugging#/runtime/this-firefox`, choose **Load Temporary
   Add-on**, and select `extension-firefox/manifest.json`.
3. Click the IMDb Enhanced toolbar button and choose **Grant site access**.
   Firefox withholds host permissions until you approve them, so the extension
   stays inactive until this step is done.
4. Reload any IMDb tabs that were already open.

Temporary add-ons are removed when Firefox restarts. The build passes
`web-ext lint` with no errors and declares no data collection.

The userscript remains the better option on Firefox for permanent installs,
since Mozilla continues to support the Manifest V2 userscript managers.

## Configuration

Click the gear icon on any covered IMDb page to open the six-section settings workspace. Changes save automatically with visible feedback, the vertical navigation supports arrow/Home/End keys, and the dialog traps focus until it is closed.

![IMDb Enhanced Experience settings](design/mockups/14-redesign-experience-1536x1024.png)

The redesigned visual reference set covers every menu page: [Experience](design/mockups/14-redesign-experience-1536x1024.png), [Ratings](design/mockups/15-redesign-ratings-1536x1024.png), [Tools](design/mockups/16-redesign-tools-1536x1024.png), [Sites](design/mockups/17-redesign-sites-1536x1024.png), [Integrations](design/mockups/18-redesign-integrations-1536x1024.png), and [Data](design/mockups/19-redesign-data-1536x1024.png).

**Experience** - Theme, cleanup, appearance, and layout controls. Theme choices include a system-following mode.

**Ratings** - Aggregated-score, histogram, and streaming-availability controls with an inline preview.

**Tools** - Title, TV/episode, list, private Seen/Skip, and optional keyboard-shortcut controls.

**Sites** - Editable watch-search and external-link destinations with show/hide controls, purpose categories, ordering, colors, and Cineby handoff. Page buttons are grouped into Watch, Reviews & ratings, Availability, Trailers & video, Info & research, and Other. Incomplete, non-HTTP(S), credential-bearing, origin-dynamic, or unknown-token templates are visibly rejected without replacing the last valid saved list.

**Integrations** - Tabbed Radarr/Sonarr and Plex/Jellyfin/Emby local-service configuration with arrow/Home/End keyboard navigation.

**Data** - Local mark review, validated JSON backup/restore up to 4 MB, cache status/clearing, and an explicit two-step reset with backup guidance.

**Watch Sites** - Add, remove, reorder, show/hide, categorize, and customize streaming site buttons with name, URL template, and color.

**External Links** - Same customization as watch sites for review, availability, trailer, and research links; hidden destinations remain available to re-enable later.

**Cineby** - The exact Cineby root uses a one-time, ten-minute local title handoff that is consumed as soon as Cineby opens. A second Cineby navigation is held back while the first handoff is pending so it cannot replace the earlier title. Edit or remove its watch-site row to use an ordinary URL template instead.

**Radarr/Sonarr/Overseerr** - URL, API key, root folder, and quality profile for Radarr and Sonarr; URL and API key for an Overseerr or Jellyseerr instance. Localhost/127.0.0.1 only. Current Sonarr v4+ language selection belongs in quality-profile custom formats; retired v3 language profiles are not configured.

**Media Servers** - Plex URL/token and Jellyfin/Emby URL/API key fields for local library checks. Localhost/127.0.0.1 only.

**URL Templates** - Use `{{TITLE}}`, `{{TITLE_DASH}}`, `{{TITLE_SLUG}}`, `{{IMDB_ID}}`, `{{IMDB_NUM}}`, `{{TRAKT_TYPE}}`, `{{YEAR}}` in custom site URLs.

**Import/Export** - Full JSON backup—including remembered section state—and validated, transactional restore up to 4 MB. Invalid or unknown fields are skipped; a storage failure restores the prior values before reporting the error.

## Themes

| Dark (default) | OLED | Midnight | Light | High Contrast |
|---|---|---|---|---|
| Deep charcoal surfaces | True black backgrounds | Navy blue tones | Clean white | Maximum-contrast black and yellow |

## Compatibility

- Desktop `www.imdb.com` title, person, list/watchlist, chart, and episode-list routes, including localized desktop paths.
- Desktop Tampermonkey and Violentmonkey. Mobile IMDb domains are intentionally outside the match scope.
- Chromium Manifest V3 extension builds use the background service worker for cross-origin requests and dynamic ad rules; userscript request cancellation remains manager-dependent. Visual ad cleanup remains active when `GM_webRequest` is unavailable.

## License

[MIT](LICENSE)
