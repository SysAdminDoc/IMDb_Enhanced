[![Version](https://img.shields.io/badge/version-2.15.0-blue)](https://github.com/SysAdminDoc/IMDb_Enhanced)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Tampermonkey%20%7C%20Violentmonkey-yellow)](https://www.tampermonkey.net/)

# IMDb Enhanced

A desktop IMDb overhaul delivered as a single userscript and a Chromium Manifest V3 extension. Cleaner pages, modern themes, aggregated scores from Rotten Tomatoes, Letterboxd, and Metacritic, streaming site quick-search, Radarr/Sonarr integration, Plex/Jellyfin/Emby library indicators, and more.

## Features

**Page Cleanup** - Removes current IMDb ad shells, sticky placements, tracking pixels, IMDbPro upsells, news modules, app prompts, sponsored content, and contribution prompts at `document-start`. The extension build also uses Manifest V3 dynamic request rules for the known ad and measurement hosts; the userscript keeps the manager-dependent `GM_webRequest` path.

**Theme System** - Five themes (Dark, OLED, Midnight, Light, High Contrast) with a full design system: semantic colors, 3-tier elevation, 4px grid spacing, squircle avatars, hover lifts, and smooth transitions. Auto-theme follows OS preference.

**Aggregated Scores** - Inline Rotten Tomatoes (with critics consensus on hover), Letterboxd, and Metacritic scores fetched lazily near IMDb's rating and cached locally. Lookups first resolve the exact service page through Wikidata's public IMDb-to-service identifier mapping; titles it does not cover fall back to search, where matches require an exact title and media type plus a release year within one year. Navigation aborts route-owned lookups when the manager provides an abort handle, and stale responses are discarded regardless. On a title's Ratings tab, the vote distribution IMDb publishes there is also used to compare its displayed weighted rating against the unweighted mean, which says which way the weighting leans.

**Streaming Availability** - JustWatch integration shows which streaming services carry the title, using the same lazy, route-aware lookup lifecycle and exact title/type/year identity checks on direct and search-fallback pages.

**Editorial Title Surface** - Title pages use a stable poster-led layout with dedicated actions, score rail, synopsis, cast, and categorized research regions. The native IMDb hero remains the source of truth for live controls and data while the extension presents it in a readable, responsive hierarchy.

Third-party lookups omit destination cookies. Responses are rendered as text, outbound links suppress opener/referrer data, and response-provided URLs are restricted to the expected HTTPS service domains.

**Watch Site Search** - Quick-search buttons for streaming sites. The defaults (Rive, Cinejoy, Movy, Flixer, Fmovies+, Cineplay, Z-Stream, Aether, 1Shows, CinemaOS, HydraHD, CineStream, Bingr, LookMovie2, Cine.su) come from the FMHY video wiki's starred picks, and a built-in catalog in settings offers every other streaming destination that wiki lists, grouped the way the wiki groups them, each one a single click to add. Destinations are contacted only when you open them; the userscript does not background-probe every site.

**External Links** - One-click links grouped by purpose: Reviews & ratings (Rotten Tomatoes, Letterboxd, Trakt), Info & research (TMDB, Wikipedia), Trailers & video (YouTube), and Availability (JustWatch). Configurable.

**Trailer Popover** - In-page trailer dialog backed by YouTube search, with focus containment, Escape/overlay close, opener restoration, and stale-result protection. No page navigation needed.

**Radarr/Sonarr/Overseerr Integration** - Quick-add and request buttons that report state: add, pending, requested, processing, or already in your library. Overseerr and Jellyseerr are supported as a request backend and resolve the IMDb ID themselves, so no third-party API key is needed. Localhost-only for security.

**Media Server Indicator** - Optional Plex, Jellyfin, and Emby checks show whether the current title already exists in your local media library. Localhost-only for security; access tokens are sent in request headers, not URLs.

**Private Title Marks** - Local Seen/Skip toggle controls on title posters and on every IMDb title card (charts, lists, watchlists, person filmographies, episode lists, and search results) with exposed pressed state and a newest-first 5,000-title storage bound. Those same surfaces get an All/Unseen/Seen/Skipped filter with counts, which works entirely on the rows already loaded, makes no request, and leaves the page's own ordering alone.

**Private Notes** - A note field on title pages, up to 500 characters, saved on that device as you type and listed with your marks. A note can exist without marking the title, marking or unmarking never disturbs it, and notes travel in backups. They are excluded from the diagnostics report on purpose. They require no login and deliberately do not change or sync IMDb's account-based Watched status.

**TV Tools** - Highest-rated episode highlighting and TV-specific lookup shortcuts. Synopsis blur is opt-in and off by default.

**List Page Tools** - Batch IMDb ID copy plus a popup-safe search queue on watchlist, custom list, and chart pages, including IMDb's locale-prefixed desktop URLs. Prepare up to 20 real new-tab links, open them one gesture at a time, or copy the full link set. A runtime summary totals how long the listed titles would take to watch, recounts as more rows load, and names how many rows had no runtime listed rather than reporting a smaller total as if it were complete.

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

1. Install Node.js 20 or newer.
2. From the repository root, run `npm run build:extension`.
3. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the repository's `extension` folder.
4. Open or refresh an IMDb page. After source changes, run the build command again and use the extension card's reload button before refreshing IMDb.

Installing asks for access to IMDb and nothing else. Every other site the extension can reach (the score services, JustWatch, YouTube, Wikidata, the known ad hosts, and localhost for media servers) is optional, requested in the smallest group a feature needs, and released when you switch that feature off. Turning off one score source keeps the shared lookup service the other two still use.

Granting happens on the extension's own page, because that is the only place a browser lets an extension ask. Open it from the toolbar button, or from the Grant access button that appears beside any setting whose sites are not yet allowed. Each of those settings shows which sites it uses and whether access is currently granted, so a feature that is on but cannot reach its service says so rather than silently failing.

Click the toolbar button to open the settings recovery page. It runs on the extension's own origin rather than inside an IMDb page, so backup, restore, reset with undo, diagnostics, and the list of granted hosts stay reachable even when site access is revoked or IMDb changes its markup. Userscript installs get the same actions from the manager's extension menu.

The extension does not auto-update from GitHub; reload the unpacked build after local changes.

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

**Ratings** - Aggregated-score, rating-comparison, episode-heatmap, and streaming-availability controls with an inline preview.

**Tools** - Title, TV/episode, list, private Seen/Skip, and optional keyboard-shortcut controls.

**Sites** - Editable watch-search and external-link destinations with show/hide controls, purpose categories, ordering, and colors. Page buttons are grouped into Watch, Reviews & ratings, Availability, Trailers & video, Info & research, and Other. Incomplete, non-HTTP(S), credential-bearing, origin-dynamic, or unknown-token templates are visibly rejected without replacing the last valid saved list.

**Integrations** - Tabbed Radarr/Sonarr and Plex/Jellyfin/Emby local-service configuration with arrow/Home/End keyboard navigation.

**Data** - Local mark review, validated JSON backup/restore up to 4 MB with optional passphrase-encrypted credential export, cache status/clearing, a persistent failure journal, and an explicit two-step reset with backup guidance.

**Failure journal** - The last 20 feature failures, kept across reloads so intermittent breakage is visible. Entries record the time, the feature, the kind of page, and a failure category. They never record the error text, so a title, a lookup address, or a token echoed back by a local service cannot end up in one. Copy it into a bug report or clear it from the same card.

**Watch Sites** - Add, remove, reorder, show/hide, categorize, and customize streaming site buttons with name, URL template, and color. The FMHY streaming catalog sits under the editor: a filterable list of every streaming destination from that wiki, grouped by its sections (stream aggregators, P-Stream forks, dedicated server, multi-server, backups, and legal free-with-ads services). Adding one creates a normal editable row, and entries already in your list read as Added. A list holds up to 250 destinations, enough for the whole catalog at once.

**External Links** - Same customization as watch sites for review, availability, trailer, and research links; hidden destinations remain available to re-enable later.

**Radarr/Sonarr/Overseerr** - URL, API key, root folder, and quality profile for Radarr and Sonarr; URL and API key for an Overseerr or Jellyseerr instance. Localhost/127.0.0.1 only. Current Sonarr v4+ language selection belongs in quality-profile custom formats; retired v3 language profiles are not configured.

**Media Servers** - Plex URL/token and Jellyfin/Emby URL/API key fields for local library checks. Localhost/127.0.0.1 only.

**URL Templates** - Use `{{TITLE}}`, `{{TITLE_DASH}}`, `{{TITLE_SLUG}}`, `{{IMDB_ID}}`, `{{IMDB_NUM}}`, `{{TRAKT_TYPE}}`, `{{YEAR}}` in custom site URLs.

**Import/Export** - JSON backup (including remembered section state) and validated, transactional restore up to 4 MB. Invalid or unknown fields are skipped; a storage failure restores the prior values before reporting the error.

Integration API keys and tokens are left out of an ordinary backup, which names what it omitted, and restoring one keeps whatever credentials that device already has. **Export with credentials** is the separate action that includes them: it asks for a passphrase, derives a key with PBKDF2-SHA256 at 310,000 iterations, and encrypts the backup with AES-GCM under a fresh salt and nonce. Importing one asks for the passphrase as soon as it recognizes the file. A wrong passphrase or a modified file is refused before anything is written, and nothing can recover the contents if you lose the passphrase.

## Themes

| Dark (default) | OLED | Midnight | Light | High Contrast |
|---|---|---|---|---|
| Deep charcoal surfaces | True black backgrounds | Navy blue tones | Clean white | Maximum-contrast black and yellow |

## Privacy and trust

- **No telemetry, ever.** Nothing is transmitted to any IMDb Enhanced service, because there isn't one. There are no analytics, no error reporting, no accounts, and no remote configuration. Settings → Data can copy a diagnostics report for a bug report, and that report only reaches your clipboard.
- **No runtime dependencies.** The userscript is one file with zero third-party libraries, and the extension builds are generated from it using only the Node standard library. Nothing is fetched at install or at runtime to make the project work.
- **No remote code.** Everything that executes ships in the file you installed. Nothing is `eval`'d and no script is loaded from a CDN, which is also what keeps the extension builds compliant with Chrome Web Store and AMO policy.
- **Unminified and readable.** The shipped userscript is the source. You can read every line of what you are running.
- **Local-only storage.** Preferences, private Seen/Skip marks, and cached lookups live in your userscript manager or `chrome.storage.local`. Integration credentials for Radarr, Sonarr, Overseerr, Plex, Jellyfin, and Emby are restricted to `localhost`/`127.0.0.1` and are sent only to those services, as request headers rather than in URLs.
- **What does leave your browser:** anonymous, cookie-free lookups to Rotten Tomatoes, Metacritic, Letterboxd, JustWatch, YouTube, and Wikidata, made only for the title you are looking at and only for the score sources you have enabled. Each one is cached locally so a repeat visit makes no request at all. Turn a source off and it is never contacted.

### Verifying a build

Both extension builds are generated deterministically from the userscript, so you can confirm that a build matches the source:

```bash
git checkout <commit>
npm run build:extension        # regenerates extension/
git status --short             # no output means the shipped build matches that commit
```

`extension/content.js`, `extension/boot.css`, and `extension/manifest.json` are committed, so any difference between what ships and a rebuild from the same commit shows up as a diff.

There are no git tags or GitHub releases yet, so check out a commit rather than a version tag. Packaged, checksummed release assets are planned but not published; until then the userscript at the install link above is the version of record.

## Compatibility

- Desktop `www.imdb.com` title, person, list/watchlist, chart, and episode-list routes, including localized desktop paths.
- Desktop Tampermonkey and Violentmonkey. Mobile IMDb domains are intentionally outside the match scope.
- Chromium Manifest V3 extension builds use the background service worker for cross-origin requests and dynamic ad rules; userscript request cancellation remains manager-dependent. Visual ad cleanup remains active when `GM_webRequest` is unavailable.

## License

[MIT](LICENSE)
