# Changelog

## 2.15.0 — 2026-08-31

### Security

- Site access is granted and revoked per feature from the extension's own page, reachable from the toolbar button or from the "Grant access" button beside any feature that needs it. A browser only lets an extension ask for access from one of its own pages, so the settings panel on IMDb shows the real state and sends you there rather than pretending it can ask. Each feature that is switched on but cannot reach its service now says exactly that instead of looking broken.

- The extension now asks for IMDb access and nothing else when you install it. It used to demand access to Rotten Tomatoes, Metacritic, Letterboxd, JustWatch, YouTube, Wikidata, seven ad and tracking hosts, and your own localhost, whether or not you had turned any of those features on. Each one is now requested at the moment you switch the feature on, in the smallest group that feature needs, and handed back when you switch it off. Turning off one score source keeps the shared lookup service the other two still use. If you decline, the feature stays off and says so rather than turning on and failing every request. Each setting that reaches a third party now shows which sites it uses and whether access is granted. Existing installs will need to toggle affected features once to grant them.

- On Firefox, the extension's own page now asks for consent to send page details to the score services, rather than only declaring in the manifest that it might. It is a separate control from the per-site grants because Firefox does not allow a data-collection request to be combined with any other permission, and because the consent covers the add-on rather than one feature. Chromium has no such concept, so the control simply is not there.

- The Firefox build no longer declares that it collects no data. That was true only with every optional feature off: an enabled score or availability lookup sends the title and year read from the page to a third-party service. That is now declared as optional website content, which is what it actually is.

- A backup no longer puts your API keys on the clipboard. Export settings used to include every Radarr, Sonarr, Overseerr, Plex, Jellyfin, and Emby credential in plain text, and the clipboard is readable by other pages and remembered by clipboard managers. The normal export now leaves those out and tells you which ones it left out. Restoring such a backup keeps the credentials already on that device rather than blanking them. If you do need to move them, Export with credentials asks for a passphrase and encrypts the whole backup with it (PBKDF2-SHA256 at 310,000 iterations, then AES-GCM, with a fresh salt and nonce every time). Importing one asks for the passphrase as soon as it recognizes the file, and a wrong passphrase or an altered file is refused before a single setting is written.

- In the extension, your Radarr, Sonarr, Overseerr, Plex, Jellyfin, and Emby keys no longer enter the IMDb tab. The extension used to read each key out of storage inside the page and attach it to the outgoing request, which put the secret in a place any script sharing that tab could reach. The background worker now holds them. A request says which key it needs, and the worker attaches it only after confirming the destination is a local address and the name matches one of the six it knows. Because the value never comes back, the settings field cannot show it: a saved key renders as an empty box that says one is stored, and typing replaces it. Encrypted backups still carry your keys, since the extension's own page is the one place that keeps full access. The userscript build works exactly as before.

- The extension's privileged fetch no longer follows a redirect anywhere it likes. It checked the address it was asked for, then let the network take it wherever a redirect pointed, which mattered most for calls to Radarr, Sonarr, Plex, Jellyfin, and Emby: those carry your API key in a header, and a redirect would have carried the header along to whatever answered. A request holding a credential now refuses to redirect at all, every response is re-checked against the address it actually came from, and a hop between a local and a public address is rejected outright. Letterboxd's IMDb lookup, which is a genuine redirect within its own site, still works. A blocked redirect now says so rather than reading as a network error.

### Fixed

- A score source you have not granted access to no longer pretends to be a service outage. The browser refuses an ungranted request with exactly the same opaque error a dead host produces, so the widget fell back to showing last week's score with a Retry button that could never work, and the message naming the real problem was never reached. It now says the site access is not granted and offers a button that takes you to the page where you can grant it.

- Your Seen and Skip marks no longer disappear without warning in the extension. Storage there is asynchronous, so a write that failed still reported success: the page went on showing the marks as saved and a reload lost them. A failed write is now noticed, the page is corrected, and you are told.

- Undo on "Mark loaded season seen" no longer deletes marks you made after using it. It restored a copy of your whole mark list, so anything marked anywhere else while the Undo button was still showing was silently removed with no way back. It now reverts only the episodes that batch changed.

- Removing an entry from the marks list is one operation again. It used to clear the note and then the mark, so a failure in between destroyed the note and kept the mark.

- The stale-score fallback works in the userscript build at all now. A script manager reports a failed request with its own response object, which carries no error text, so every provider outage came back unclassified and the fallback never fired. It had been extension-only without anyone noticing.

- A lookup that runs out of time is reported as a timeout rather than as a cancelled request, so a slow provider gets the same cached-score fallback an unreachable one does.

- The extension's cache no longer keeps filling after it runs out of room. The recovery that frees space matched on a key name the extension never sends, so it could not run in the one build with a fixed 10 MB limit.

- The Rotten Tomatoes widget shows the audience score again, next to the critics score. It was being looked for under a field name Rotten Tomatoes does not use, so it had never actually appeared — the widget was already built to display it. Where a title's structured data carries no critics score, that now comes from the same place rather than the widget giving up.

- When a score service cannot be reached, the last score it gave is shown with the date it was cached and a Retry button, instead of the widget going blank. This only happens when the lookup could not reach the service at all: if it answered and had nothing, or answered with something that did not match the title, no old value is shown, because that would contradict what the service just said. A cached fallback is never older than the cache's own 30-day ceiling, and refreshing successfully replaces it.

- The trailer window can be closed from the keyboard once you are inside the video player. The player is a YouTube page embedded in the dialog, and a page cannot see key presses that happen inside another site's embed, so Escape stopped working there and Tab could strand you. Tabbing out of the player in either direction now lands on the close button, which closes the dialog and returns you to the Trailer button you came from. No second close control was added; the existing one is simply reachable now.

- The lookup cache can no longer outgrow the storage it lives in. Its 120-entry by 256 KiB limits allowed roughly 30 MB of cached scores while a Chromium extension gets 10 MB for everything it stores, so a heavy browsing session could fill the quota and quietly stop saving lookups. The cache now measures itself in real encoded bytes, holds a 6 MB ceiling, and drops least-recently-read entries as it fills. Settings, private marks, and integration credentials are never eviction candidates. If storage is full anyway, you get a message pointing at Data → Clear cache instead of silence, and the Data page shows what the cache is using.

### Added

- The extension's toolbar button now opens a settings recovery page instead of doing nothing. Backup, restore, reset, and diagnostics used to live only inside the panel injected into IMDb pages, which is exactly what stops working when site access is revoked or IMDb changes its markup. The recovery page runs on the extension's own origin, so it works regardless: it shows the version, which hosts are actually granted, how many marks and cached lookups you have, and it can copy a backup, restore one, or reset everything. A reset there can be undone. Firefox opens its permissions popup from the toolbar rather than the page, so that popup links to it.

- Userscript managers get the same escape hatch through their extension menu: open settings, copy a backup, restore one, and reset with an undo command. All of it uses the same code the settings panel does.

- Title pages get a private note field. Type and it saves itself on that device, up to 500 characters, and the note shows in Data → Private title marks alongside whatever Seen or Skip mark the title has. A note can stand on its own without marking anything, marking or unmarking a title leaves its note alone, and clearing both removes the entry entirely. Notes go into a backup and come back from one. They are never sent anywhere, and they are deliberately kept out of the diagnostics report, which is the one thing you are invited to paste in public.

- An optional setting fades the artwork of titles rated below a threshold you pick, on lists, charts, and search results. Only the picture fades: titles, scores, and controls stay at full contrast, hovering or tabbing to a card restores it, and forced-colours mode is left alone. Titles with no rating yet are never faded, since they are unrated rather than poorly rated. Off by default.

- Lists, charts, watchlists, search results, and filmographies get a Private marks filter: All, Unseen, Seen, Skipped, each with a count. It works on what is already on the page, so it makes no request and does not reorder anything: filtering the Top 250 to unseen leaves them in chart order. Counts and filtering update as more rows load and as you mark things, and the arrow keys move through the options. It appears only when private marks are switched on.

- Every episode on an episode list gets a subtitle link, and one button copies them all for the loaded season as a tab-separated list you can paste anywhere. Each link goes straight to that episode by its own IMDb id, so nothing has to be searched for, and they are ordinary links: the extension never contacts the subtitle service itself.

- Episode lists show how far through the loaded season you are, link to the next episode you have not marked, and can mark or clear that whole season in one step with an undo beside it. IMDb renders one season at a time, so the counts and the buttons both say "loaded" and nothing is fetched to fill in the rest. Clearing a season leaves any notes on those episodes alone, and if the 5,000-mark limit prevents part of a batch from being stored it says how many rather than reporting success.

- A "Pick something" button on watchlists, lists, and charts chooses one title at random, highlights it, and scrolls to it. It never opens anything, because the point is to help you decide rather than decide for you. By default it skips titles you have already marked Seen or Skipped, and it says so when there is nothing left to pick.

- Watchlists, lists, and charts show how long everything on them would take to watch. The IMDb Top 250 comes to 548:08. The total recounts as more rows load, and when some rows have no runtime listed it says how many rather than quietly reporting a smaller number: a chart of TV series, where IMDb lists no runtime at all, says so instead of showing zero.

- Data → Failure journal keeps the last 20 feature failures across reloads, so an intermittent problem is visible instead of vanishing when you refresh. Each entry says when it happened, which feature, what kind of page, and what category of failure, in plain words. It records the category rather than the error text on purpose, so a title you were looking at, a lookup address, or an API key a local service echoed back has no way to end up in it. You can copy it into a bug report or clear it.

- The Sites page carries a built-in catalog of every streaming destination listed on the FMHY video wiki: 208 sites in the six groups that wiki uses, filterable by name or address, each one click to add. An added entry becomes an ordinary editable row, and anything already in your list reads as Added rather than offering a duplicate. Site lists now hold 250 destinations instead of 50, so the whole catalog fits at once if you want it.

### Changed

- The default watch destinations are rebuilt from the FMHY wiki's starred picks, and every one of them ships with a working search route rather than a bare homepage: Rive, Cinejoy, Movy, Flixer, CorsFlix, ShuttleTV, Z-Stream, Aether, 1Shows, CinemaOS, HydraHD, CineStream, Bingr, LookMovie2, and Cine.su. Each route was checked against the live site while preparing this release. Two entries the wiki lists were dropped after that check found them redirecting onto Cineby's domain, which is closing: both answered normally, so only following the redirect showed it. Your own edits are untouched; only the defaults changed.

### Removed

- Cineby is gone. It announced its shutdown for the end of August 2026, and its entry needed a special case no other destination did: because the site had no searchable URL, opening it stored the title locally and a second content script filled Cineby's own search box on arrival. That whole path is retired, along with the host permission, the page match, and the settings copy explaining it. A settings migration deletes the stored preference, any pending handoff, and Cineby rows in a saved site list, and strips the retired transport flag from rows that survive.

## 2.14.0 — 2026-08-15

### Added

- Title pages link to the Parents Guide alongside Cast & crew, User reviews and Trivia. The content-rating chip beside the title was already read from that page's link; this exposes the detail behind it.

- An optional "Expand truncated summaries" toggle (Tools → Layout) releases IMDb's line clamp so long biographies and summaries read in full without a per-block click. Measured on a person page: 384px of hidden biography becomes visible. Scoped to IMDb's own overflow component, so card titles keep the two-line clamp that holds their layout. Off by default.

- The Ratings tab now compares IMDb's displayed rating with the unweighted mean of the raw votes and says which way the weighting leans. IMDb publishes the unweighted figure there in small type and draws no comparison; a wide gap is the clearest public signal that a title's votes were pushed. Computed from the distribution already on the page — no request. Toggle: Ratings → Score sources.

### Removed

- The standalone vote-distribution chart is retired. It rendered on title pages, and IMDb no longer publishes the distribution there — verified on 2026-08-15 that no script on a title page carries it — so the widget had been shipping enabled while drawing nothing. IMDb draws its own chart on the Ratings tab, where the data moved, so a replacement would only have duplicated it. Its stored preference is removed automatically by a settings migration rather than left behind.

### Fixed

- The rating distribution is found again on pages that publish it. IMDb's ratings payload is a ~736 KB application-data blob and the distribution sits deeper in it than the parser's traversal budget reached, so it read as absent; the one array is now sliced out by key under its own bound.

- Extension builds now notice when a newer version has been published and say so, once, with a link and a Dismiss button. An unpacked extension has no way to update itself and Chrome only permits off-store hosting on Linux, so this is the only available mitigation. It reads the published version at most once a day, sends nothing about you, fails silently offline, and can be turned off under Settings → Data → Updates. The userscript build omits it entirely — it updates through its manager.

## 2.13.0 — 2026-08-15

### Added

- README documents the project's trust posture — no telemetry, no runtime dependencies, no remote code, unminified source, local-only storage — states exactly which cross-origin lookups happen and why, and explains how to verify that a shipped build matches its tag. A test fails if a dependency is ever added, so the claims cannot quietly go stale.

- Windows High Contrast and "increase contrast" are honoured. Forced colours previously removed the focus rings entirely and left rating colours to be substituted arbitrarily; controls now keep a system-coloured outline, heatmap and rating chips stay legible with a visible border, and a request for more contrast replaces the translucent surfaces with opaque ones.

- Settings now carry a schema version, with one ordered place for future migrations to live. Backups record the schema they were written against, and a backup from a newer version is refused with an explanation instead of being partially applied — previously an unrecognized shape would have been quietly replaced by its default.

- The Ratings tab of a TV series now colour-grades IMDb's own season-by-episode grid and adds a season-average strip and a colour key. IMDb renders the whole series in one table but leaves every cell the same colour; this needs no network request at all. Series pages gain a "Ratings Grid" quick link to it. Toggle: Tools -> TV.

- The GM API contract the userscript depends on is now asserted against both implementations — the userscript manager and the generated MV3 bridge — by one shared suite (`npm test`). Four shipped defects came from the bridge quietly dropping a guarantee while every test stayed green; each of those four now fails the suite if reintroduced.

### Added

- Settings → Data can copy a diagnostics report for bug reports. It carries the version, build target, page path, active features and recent feature failures — and never carries credentials, marked titles, or the page query string. Nothing is transmitted; the report only reaches the clipboard.

### Fixed

- Rotten Tomatoes, Letterboxd and Metacritic results are announced to screen readers when they arrive, and each widget reports itself busy while loading. The widgets are rebuilt in place as results land, so a region inside them could never have spoken; announcements now come from one region created before any lookup starts.
- Collapsible section toggles say which region they control, and the section navigator is a single stop in the tab order with arrow-key movement and a current-section marker, instead of one tab stop per section.

- The Firefox build is now verified from the files it actually ships rather than from a manifest computed during the test run, and `npm test` builds it. Nothing previously read that directory, so a stale build and a broken generator looked identical without rebuilding by hand.

- A feature that fails while a page loads now says so once, instead of reporting only to the browser console and leaving a silently missing feature. IMDb changes its markup without notice, so this is the expected failure rather than an exceptional one.
- The cached-lookup count is available outside the settings panel, so the diagnostics report states it instead of reporting it as unavailable.

- Title pages keep a working "Add to watchlist" action when IMDb renders in a translated language. IMDb began machine-translating page copy in 2026, and the control was located by its English label, so on languages that do not keep the English loanword — Hindi renders "वॉचलिस्ट में जोड़ें" — the button found nothing and the editorial layout, which hides IMDb's own hero and is on by default, left those users with no way to add a title. Native controls are now resolved by test id.

## 2.12.0 — 2026-08-15

### Fixed

- Toggling Spoiler blur now blurs or reveals episode synopses immediately instead of waiting for a reload.
- A title containing a rating word — "PG: Psycho Goreman" — no longer reports a fabricated certificate. Certifications come from the element IMDb publishes them in, and are omitted when there is none.
- Long synopses end on a word boundary with an ellipsis rather than being cut mid-word, and an ellipsized title exposes its full text on hover.
- The list-page search buttons, Servarr actions, "More watch options" disclosure, and saved-mark Open links use the same focus ring as every other control.
- Feature descriptions on the Experience page are available to screen readers and as tooltips again; they were hidden outright to keep the cards dense.
- The Firefox build no longer assumes browser APIs return promises. Gecko's `chrome.*` alias is callback-style, so the storage preload and the ad-rule sync could fail there; both now use the callback form both engines accept.
- Dropped the `www.metacritic.com` host permission and proxy entry, which nothing ever requested. Lookups go to `backend.metacritic.com`.
- Extension build: IMDb no longer flashes its ad placeholders and default light chrome before the extension's styles load. The bridge has to await browser storage, which pushed everything past first paint; the anti-flash rules now ship as a stylesheet the browser applies synchronously, gated by an attribute cleared as soon as settings are known (or by a timeout, so a storage failure can never leave the page hidden).
- The editorial title layout keeps IMDb's own hero video. Hiding the native hero removed the player from the page entirely; it is now re-homed into the rebuilt surface and handed back when the layout is turned off.
- Editing a destination in Settings → Sites no longer writes to storage on every keystroke. Typing a 14-character name committed 14 full-list writes; it now commits one, and blurring the field still saves immediately.
- Toast messages are announced reliably by screen readers. Each toast used to insert a brand-new live region, which assistive technology may not read; there is now one region, created up front, whose text changes.
- Storage, clipboard, and local-service messages name the right host for the build you are running instead of always pointing at a userscript manager.
- People who have died no longer get a current age next to their birth date. The check for a death looked at only the first 200,000 characters of the page's embedded data and ignored the death date IMDb already renders.
- "Top rated episodes" no longer picks up recommendation and shoveler cards. The fallback used to find an episode's card accepted any list item, including ones that merely carry a rating.
- Hiding a watch destination now also removes it from the "Search all on" bar on watchlist, list, and chart pages.
- The section navigator's Overview entry scrolls to the editorial title surface when that layout is on. It previously targeted the hidden native hero and did nothing.
- Title pages keep their Rate and Add to watchlist controls when Watch buttons are turned off or every watch destination is hidden. The editorial layout hides IMDb's own hero, but the stand-ins for those controls belonged to the watch-destination feature, so switching it off left the page with no way to rate a title or add it to a watchlist.
- Hardened the theme shell against running before the document root exists, which threw at document-start and aborted the rest of the script.
- The person-age addition on name pages now has a toggle, under Tools → People. It shipped enabled with no way to turn it off short of editing storage by hand.
- Settings → Sites: destination rows put the Purpose and URL template fields under the wrong column headers, which also squeezed the long URL template into the narrow track meant for the category selector.
- Extension build: a rejected storage write is no longer silently discarded. Quota or permission failures now reach the "Save failed" state and the settings-import rollback instead of leaving the UI reporting "Saved".
- Extension build: a refused clipboard write is reported instead of announcing a successful copy.
- Extension build: cross-origin lookups can validate the URL they were actually redirected to again. The bridge exposed the resolved address under a name none of the five consumers read, so each fell back to the pre-redirect guess.
- The Overseerr/Jellyseerr Request button works. Its request body was serialized twice, so the instance received a JSON string where it expected an object and rejected every request.
- Extension build: private Seen/Skip marks are no longer lost when two IMDb tabs are open. The extension mirrored browser storage once at page load and never updated it, so the second tab to save a mark overwrote whatever the first had added. The mirror now follows storage for the life of the page, which also stops a consumed Cineby handoff from blocking later Cineby links in the tab that opened it.

### Changed

- Renamed the research region from "Where to watch" to "Reviews & research", which is what it contains — the watch destinations sit beside it.
- Collapsible sections only give a containing block to the sections they decorate, instead of every section on the page.
- Media-server status pills derive their colours from the active theme instead of fixed values, and stylesheets for two replaced components were removed.
- Dynamic ad rules are now removed across a reserved id band, so a rule dropped in a future release cannot linger on existing installs.
- `npm version` stages the README badge it rewrites, and version sync fails loudly instead of reporting success when a string no longer matches.

## 2.11.0 — 2026-08-14

### Added

- Extended themes, cleanup, and layout options to IMDb's search, advanced-search, and homepage routes, which previously lost every enhancement mid-navigation.
- Person pages now show a living person's current age beside their birth date, computed from data already on the page. IMDb prints the age at death itself, so those pages are left alone.
- Added Overseerr and Jellyseerr as a request backend. Configure the instance under Integrations and title pages gain a Request button that reports whether a title is already available, processing, or requested; your instance resolves the IMDb ID, so no third-party API key is involved.
- Radarr, Sonarr, and Overseerr buttons now read as a state machine — add, pending, requested, processing, or in library — with colour on the border and a status dot rather than the label, and accessible names that change with the state.
- Rotten Tomatoes and Metacritic lookups now resolve the exact page through Wikidata's published IMDb-to-service identifier mapping, skipping title search and its ranking guesswork. Titles without a mapping keep using the existing validated search path, and every result is still checked for matching title, media type, and year before it is shown.
- Private Seen/Skip marks now decorate title cards on charts, lists, watchlists, person filmographies, episode lists, and search results instead of title pages alone.
- Added a Firefox build (`npm run build:firefox`) with an event-page background, a stable add-on id, and a toolbar popup that requests the site access Firefox withholds until you approve it. The build passes `web-ext lint` with no errors.
- Added a one-way import that turns the IMDb Watched titles visible on the current page into private local Seen marks, keeping any mark you already made.

### Changed

- Private mark controls and badges now step aside on cards where IMDb draws its own Watched control, so the native account action stays clickable.
- Documented the Chromium "Allow User Scripts" toggle that Manifest V3 requires before any userscript manager can run, including the outdated "Developer mode" banner Tampermonkey still shows on Chrome 138+.

## 2.10.6 — 2026-08-14

### Fixed

- Repaired dark-theme inheritance across IMDb's native cast, user-list, poll, recommendation, and sidebar cards so dark surfaces no longer carry black text or white tiles.

## 2.10.5 — 2026-08-14

### Fixed

- Tuned dark-theme hero scrims and stopped multiplying poster artwork into the canvas, keeping OLED genuinely black without erasing the title artwork.

## 2.10.4 — 2026-08-14

### Fixed

- Raised the editorial title surface above IMDb's native backdrop layer so title content is not covered by a full-page blur.

## 2.10.3 — 2026-08-14

### Changed

- Disabled plot and episode-synopsis blur in the default experience; both remain available as explicit settings.

## 2.10.2 — 2026-08-14

### Added

- Added a gold-and-black IMDb Enhanced film-frame icon in Chromium’s standard toolbar and extension sizes.

## 2.10.1 — 2026-08-14

### Fixed

- Prevented title-surface hydration from continuously rewriting identical synopsis content and stalling IMDb pages.

## 2.10.0 — 2026-08-14

### Fixed

- Repaired title-page layout failures that could collapse the watch panel, wrap titles one character at a time, and overlap score or external-link content.
- Added a dedicated poster-led editorial title surface with reserved action, rating, and research regions that remains stable while IMDb hydrates the page.
- Rehomed existing native rating data and configurable title tools into the new surface without removing the underlying IMDb actions.

## 2.9.0 — 2026-08-14

### Changed

- Reimagined the IMDb title surface around an editorial hero hierarchy with a calmer score rail, readable section navigator, and a compact two-column action area.
- Replaced the equal-weight watch-site button wall with one primary Watch destination and an accessible More watch options disclosure; all configured destinations remain editable and functional.
- Added a categorized Where to watch and research surface for reviews, availability, trailers, and research links, plus a committed visual reference for the selected editorial direction.

## 2.8.0 — 2026-08-14

### Added

- Added six ImageGen design references for the settings menu and carried the same premium, decluttered visual system through Experience, Ratings, Tools, Sites, Integrations, and Data.

### Changed

- Widened and rebalanced the settings workspace with a quieter header, compact navigation markers, pill toggles, stronger grouping, and more readable spacing.
- Reworked destination editing into a labeled table surface so visibility, purpose, URL templates, color, ordering, and removal are visible at once.

## 2.7.0 — 2026-08-14

### Added

- Added a reproducible Chromium Manifest V3 extension build with extension storage, background cross-origin requests, and dynamic ad-request rules alongside the existing userscript.
- Added category-aware destination metadata for Watch, Reviews & ratings, Availability, Trailers & video, Info & research, and Other.
- Added show/hide controls, compact ordering controls, and category selectors to both editable site lists; enabled destinations now render in purpose-grouped title-page sections.
- Added UFlix, FlixMomo, Movies2Watch, WatchLuna, and 1Movies to the default watch destinations and refreshed the LookMovie label to LookMovie2.

### Changed

- Reworked the Sites settings page into a single, more readable editor surface with visible-count badges and a focus-preserving curation workflow for adding, editing, hiding, moving, resetting, and removing destinations.
- Grouped external title links by purpose so review, availability, trailer, and research actions are easier to scan without changing their privacy-preserving outbound behavior.

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
- Replaced the timer-driven list multi-search popup loop—which browsers block after the first tab—with an accessible 20-title link queue, explicit new-tab labels, one-click Open next progress, copy-all, and Cineby-aware title copying.
- Applied the operating system's reduced-motion preference to every enhancement, including quick navigation and keyboard scrolling, and removed an unsupported WCAG conformance claim from theme documentation.
- Made settings imports transactional: all fields are normalized before persistence, invalid/unknown fields are counted, partial storage failures roll back prior values, and local-service URLs reject remote or credential-bearing origins in both imports and direct editing.
- Made Cineby title handoffs timestamped, single-use, and bounded to ten minutes; the target page now waits for a visible search control and discards failed handoffs instead of unexpectedly filling a future visit.
- Completed the trailer dialog lifecycle with focus containment/restoration, explicit expanded state, page-scroll restoration, an accessible visible label and loading status, and guards against late lookup results after close or navigation.
- Completed keyboard semantics for secondary interactions: the expanded-links menu now supports disclosure and roving-focus keys, watched/skip controls expose and toggle pressed state, and plot/episode spoilers reveal with Enter or Space while cleaning up only their own state.
- Bounded local marks to the newest 5,000 entries, cached the normalized mark index for constant-time card updates, limited continuous DOM observation to added subtrees with a burst fallback, and made cache writes non-fatal while enforcing the 120-entry cap during long SPA sessions.
- Moved Plex access tokens from query strings into request headers so credentials do not enter URLs or URL-bearing logs, and normalized legacy Servarr profile values to positive integers before use.
- Moved remembered section-collapse state into the normal settings schema so full exports actually include it, with automatic migration and cleanup of the nine legacy per-section storage keys.
- Restored the documented full-settings reset as an accessible two-step inline recovery flow; it covers every schema key, clearly warns that marks and credentials will be cleared, and reuses transactional rollback on storage failure.
- Replaced Rotten Tomatoes' obsolete unscoped first-score search regex with parsing of current semantic result rows and exact normalized title/media-type plus one-year-tolerant release matching; matched score links now open the validated result page.
- Replaced Metacritic's first-result assumption with exact normalized title, movie/show type, and one-year-tolerant release matching against the current result payload; malformed critic/user score ranges are discarded before caching.
- Guarded JustWatch availability against guessed-slug and first-link mismatches by validating detail-page JSON-LD identity and selecting current semantic search rows only when title, movie/show type, and release year agree.
- Removed a generated IMDb class dependency and a negative-margin poster-title hack from the wider-layout option so upstream class churn cannot widen unrelated elements or overlap adjacent card content.
- Added per-feature lifecycle generations so an async callback started before a quick off/on toggle or settings refresh cannot become current again and render duplicate or stale controls on the same route.
- Kept focus inside the trailer dialog even when keyboard navigation exits the cross-origin player frame, and restored plot/episode text to its original non-button semantics immediately after a one-way spoiler reveal.
- Tightened third-party title identity matching so year-qualified IMDb titles reject score or streaming candidates with no release year, while canonical title comparison now tolerates accent variants such as `Amélie`/`Amelie`.
- Made IMDb title-data extraction skip malformed and unrelated JSON-LD blocks, recognize explicit miniseries schema, and bounded the scan; runtime host checks now require the exact matched IMDb or Cineby hostname instead of substring trust.
- Bounded and validated rating-histogram discovery, normalized it to a stable 1–10 distribution, waited for the live rating surface before rendering, and exposed each vote bucket to assistive technology.
- Removed speculative Rotten Tomatoes slug probes in favor of one identity-bound semantic search; its canonical detail page is fetched only for richer data and must independently pass JSON-LD title/type/year, score-range, and trusted-link validation.
- Validated Letterboxd's IMDb-ID response against movie title/year JSON-LD and canonical `/film/` links, and now rechecks Rotten Tomatoes, Letterboxd, and Metacritic score ranges when rendering cached data.
- Versioned the lookup-cache schema so entries created before the new cross-site identity contracts are discarded and lazily refetched instead of remaining trusted for their old TTL.
- Removed CineVids from fresh default watch-site lists after repeated direct HTTPS checks timed out while every other generated default destination returned successfully; existing customized lists remain untouched.
- Hid Letterboxd and the expanded Movie Sites group on TV titles after its current IMDb series route returned “ID Not found”; switched TMDB to its cross-media search and removed the movie-only suffix from Wikipedia queries.
- Refreshed expanded destinations by moving AllMovie to HTTPS, replacing Metacritic's 404 search path, removing the DNS-dead YTS entry, and dropping the unused OpenSubtitles cross-origin request permission.
- Prevented optional single-key shortcuts from reacting to Ctrl/Command/Alt combinations, key repeats, handled events, or keys intended for the trailer/settings dialogs.
- Replaced recursive JustWatch provider discovery with a bounded iterative scan that deduplicates and caps provider names before rendering.
- Added a one-minute self-release to offscreen lazy score observers so title pages no longer retain dormant visibility work for an entire long-lived SPA session.
- Restored IMDb's native “Add title to another list” control, which had been incorrectly hidden by the IMDbPro-upsell cleanup option despite being a signed-in watchlist/list action.
- Rejected query strings and fragments in local integration base URLs so tokens cannot be accidentally persisted or propagated through configured Radarr, Sonarr, Plex, Jellyfin, or Emby URLs.
- Recaptured focus if it leaves the open settings dialog through browser or assistive-technology navigation, completing containment beyond first/last Tab wrapping.
- Scoped YouTube trailer selection to real video-result titles matching the IMDb title, release-year context, and trailer/teaser intent instead of autoplaying the first video ID anywhere in the search payload; prior trailer caches are invalidated.
- Made legacy collapsed-section migration unconditional and write-first, so backups/resets see the preference even when the feature is disabled and a failed schema write cannot delete the only durable copy.
- Canonicalized every JSON export through the current import schema, including legacy watched marks, migrated collapse state, normalized site lists, local URLs, and safe profile IDs, so generated backups are guaranteed to be fully re-importable.
- Required Servarr lookup/add and local media-library fallback matches to respect IMDb provider IDs plus exact title/year identity, preventing first-result and same-title-remake false positives; missing years no longer match year-qualified titles.
- Cancelled route-owned Servarr lookups and prevented a completed lookup from starting an add request or updating controls after the user navigates to another IMDb title.
- Preserved IMDb's search-suggestion live region, which had been incorrectly hidden as an app banner and could silence result-count feedback for screen-reader users.
- Bound Cineby's controlled-input search handoff to its exact visible URL, so editing that settings row to another site no longer keeps an invisible Cineby-only action.
- Derived Letterboxd's movie-only scope from its visible domain, so replacing that editable row no longer leaves the new destination silently hidden on TV pages.
- Decoupled the trailer and expanded-links controls from the external-links bar, so toggling that separate setting no longer removes still-enabled tools; the expanded menu can now stand alone.
- Made Add in the custom-site editors create a focused unsaved draft with real placeholders instead of immediately publishing a fake “New site” link to Example.com.
- Prevented poster-only links from consuming a title ID before list multi-search reaches the corresponding text link, restoring titles that were silently omitted from generated queues.
- Removed IMDb chart/list ordinal prefixes such as “17.” from multi-search title queries so destinations receive the actual title.
- Removed the obsolete Sonarr language-profile field and payload property; current Sonarr manages language through quality-profile custom formats, and the userscript now cleans the orphaned legacy setting.
- Stopped blank or invalid Radarr/Sonarr quality-profile fields from silently falling back to profile 1; incomplete integrations now remain inactive until their visible configuration is valid.
- Added a five-second, two-action confirmation state before clearing every saved title mark, preventing an irreversible one-click loss without using a blocking browser dialog.
- Cancelled reset/import subflows whenever settings close and cleared pasted backup JSON from the page, so a later reopen cannot resume a stale destructive state or retain copied credentials.
- Routed every copy/export action through one guarded clipboard boundary, replacing false success feedback with actionable permission errors when a userscript manager rejects the write.
- Repainted all feature-local theme styles in place instead of restarting feature lifecycles, preventing theme changes from repeating Servarr/media work, dropping list queues, or leaving stale-color controls.
- Moved quick navigation, collapsible controls, top-episode panels, and TV links from hard-coded dark colors onto the active theme tokens, including visible keyboard focus and tooltips in Light and High Contrast.
- Exposed the section navigator as a named landmark with real jump buttons, and moved collapse controls to the start of each section's tab order to match their visual position.
- Bounded local Servarr and media-server result/provider scans, and reduced untrusted local-service errors to concise plain text before placing them in toasts or tooltips.
- Kept plot-reveal instructions sharp instead of blurring their own prompt, and moved spoiler/subtitle surfaces onto the active theme tokens for readable Light and High Contrast states.
- Kept enabled ad-request rules and the zero-gap shell stylesheet active across IMDb SPA route teardown instead of briefly unregistering both before the next route initialized.
- Rejected credential-bearing URLs at the third-party response-link boundary even when their HTTPS hostname is otherwise trusted.
- Tightened trailer identity matching so short or shared titles such as “It” and “Alien” cannot autoplay a longer, different movie merely because its video title contains the IMDb title as a phrase.
- Extended list, chart, and watchlist tools to IMDb's live locale-prefixed desktop routes instead of matching only their unprefixed English URLs.
- Distinguished private Seen/Skip marks from IMDb's newer account-based Watched feature in settings, badges, accessible names, and save feedback without changing existing local mark data.
- Raised secondary and tertiary text contrast across Dark, OLED, Midnight, and Light themes so settings help, status labels, metadata, and integration notes remain readable on elevated surfaces.
- Replaced fixed gray and whole-widget opacity on unavailable score links with the active theme's readable secondary text token.
- Bounded IMDb JSON-LD traversal plus YouTube, Rotten Tomatoes, Letterboxd, Metacritic, and JustWatch response scans so unexpectedly large pages cannot grow parser queues or candidate work without limit.
- Kept rating, private-mark, watch-site, and external-link labels readable by choosing contrast-safe badge foregrounds and using tested theme text tokens instead of deriving text from arbitrary brand colors.
- Clarified that the IMDbPro cleanup preserves native list controls and that the modern skin follows the selected theme rather than always applying a dark surface.
- Applied the same finite script and provider budgets to JustWatch availability extraction after identity validation, including its meta-description fallback.
- Rebuilt settings chrome cleanly across IMDb SPA routes, removing panel-owned document listeners and timers while restoring page scroll if navigation occurs with settings open.
- Rejected oversized remote HTML/JSON-LD and local service JSON/XML before regex, JSON, or DOM parsing, complementing candidate limits with an actual input-size boundary.
- Limited private-mark fading to poster imagery and replaced whole-row opacity on opened list-search links with semantic surfaces/text, keeping interactive labels at the theme contrast target.
- Rejected custom URL templates with unknown/malformed tokens or placeholders in the destination authority, preventing typos from silently disappearing and IMDb page text from choosing the outbound origin.
- Capped editable destination lists at 50 and URL templates at 4,096 characters across runtime, import, and settings UI; non-canonical backslash-style HTTP URLs are also rejected.
- Qualified the Tools shortcut legend as optional instead of presenting disabled-by-default keys as immediately active, and aligned the README with the private Seen/Skip terminology.
- Announced automatic-save feedback through a polite status region and removed the settings dialog's duplicate page-level main landmark.
- Exposed import/reset disclosure state to assistive technology and made cache clearing report read failures, partial deletion, and the actual remaining count instead of always claiming an empty cache.
- Made ordinary preference, integration, destination, title-mark, collapse-state, and theme writes visibly fail-safe: controls no longer claim or render saved state after userscript storage rejects a write, and two-key theme changes roll back atomically.
- Replaced the single-option Cineby host selector with accurate handoff guidance; the editable watch-site row remains the real destination control.
- Restored destination rows after failed Remove or Reset writes and stopped reporting storage failures as URL-validation errors.
- Raised the bounded settings-import path from 100 KB to 4 MB so a supported 5,000-mark/100-destination export remains re-importable, and made export read/size failures explicit.
- Bounded IMDb histogram discovery by script count, script size, queue growth, and node count before parsing embedded application data.
- Prevented Cineby links from opening an unprepared destination when the one-time title handoff cannot be stored; title-page and both list-queue paths now explain the storage failure.
- Kept a visible, announced “Save failed” state after storage errors and surfaced feature refresh failures instead of leaving the settings header or rebuilt controls looking successful.
- Made transactional import/theme rollback restore previously absent storage keys as absent instead of materializing default-valued keys during recovery.
- Removed the unused `GM_addStyle` grant now that all styles use the userscript's guarded document-start style host.
- Kept IMDb theme repainting and operating-system theme listeners off Cineby's handoff-only page, preventing a later system-theme change from injecting IMDb presentation styles into the destination site.
- Made all shared cross-origin requests anonymous so public score, availability, trailer, and token-authenticated local-service lookups do not send destination cookies.
- Revalidated cached YouTube video IDs at both cache-read and embed boundaries so malformed local cache data cannot alter the trailer embed path.
- Announced asynchronous Servarr and media-server state, exposed pending adds as busy, and kept each button's accessible name aligned with its visible Adding, Added, or In Library state.
- Grouped every repeated destination-editor row under a name that follows its edits, and enforced the same name/URL length limits in the visible inputs as in storage.
- Unified cache-read and garbage-collection validation so malformed, overlong, expired, or future-dated cache envelopes are removed instead of bypassing expiry through invalid metadata.
- Suppressed both opener access and IMDb referrer data on every enhancement-created new-tab handoff, including configurable destinations and fallback searches.
- Prevented rapid or cross-tab Cineby actions from overwriting a title handoff that has not yet been consumed, with distinct guidance for a pending tab versus storage failure.
- Canonicalized imported title marks through the runtime schema, retaining legacy string marks while enforcing the 160-character title bound and neutralizing invalid or future timestamps.
- Refreshed private marks from userscript storage immediately before each individual write so a tab no longer overwrites marks saved by another open IMDb tab from a stale in-memory snapshot.
- Capped each persisted lookup-cache envelope at 256 KiB, discarding oversized stored values before parsing and refusing oversized writes before they consume userscript storage.
- Bounded title-year extraction to the first 50 structured release events and 100 inline release links, avoiding full traversal of oversized page-provided collections while retaining primary publication dates first.
- Matched integration text, credential, folder, and localhost URL controls to the 4,096-character settings schema; runtime configuration now also rejects legacy remote URLs and bounds directly edited stored credentials.
- Centralized private-mark normalization behind a 10,000-record scan budget and 5,000-record retained limit, so reads, writes, and imports no longer materialize every directly edited storage entry before pruning.
- Cleaned up the current feature generation when synchronous or asynchronous startup fails, while preventing a late rejection from tearing down a newer refresh of the same feature.
- Bounded JSON-LD type, keyword, and genre classification before title/media detection, closing nested-array scan gaps left after the broader structured-data traversal limit.
- Reworked collection-page title discovery to stop after 5,000 inspected links, with the multi-search path ending as soon as its 20-title queue is full instead of materializing every title anchor first.
- Revalidated cached JustWatch provider lists at render time, inspecting at most 50 primitive labels, bounding each to 120 characters, and replacing repeated linear duplicate scans with a normalized set.
- Hardened local-integration request guards to require credential-free HTTP(S) localhost base URLs without query/fragment state, and rejected API header credentials containing control characters across UI, import, and runtime reads.
- Improved destination-list editing with live count announcements, remove labels that follow the edited site name, focus recovery after successful or rolled-back removal, and explicit removal feedback.
- Applied the same finite JSON-LD type-list classification used for IMDb data to Rotten Tomatoes, Letterboxd, and JustWatch detail parsing.
- Normalized Servarr add payload construction, limiting Sonarr lookup results to 500 object-valued seasons and refusing array-valued `addOptions` before request bodies are assembled.
- Bounded lookup identity titles and provider-ID text before Unicode/regex normalization, and changed Plex XML extraction to iterate only the first 100 items and 32 GUIDs without full intermediate arrays.

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
