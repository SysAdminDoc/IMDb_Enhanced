(function () {
    'use strict';

    // =========================================================================
    //  CONSTANTS & CONFIG
    // =========================================================================
    /* One source shipped as both a userscript and an extension. Storage and
       clipboard failures have to name the right authority, or a user reading
       the message is sent to a manager they never installed. */
    const IS_EXTENSION_BUILD = typeof chrome !== 'undefined' && Boolean(chrome.runtime && chrome.runtime.id);
    /* Which distribution this copy is. The build rewrites the string for a store build;
       the userscript and the ordinary extension are 'default'. A store listing may not
       ship a catalog of streaming destinations, nor a provider whose answers come from
       parsing someone's page, so both are decided from this rather than at runtime. */
    const DISTRIBUTION_PROFILE = globalThis.__IMDB_ENHANCED_PROFILE === 'store' ? 'store' : 'default';
    const IS_STORE_BUILD = DISTRIBUTION_PROFILE === 'store';
    /* ---------------------------------------------------------------------------
       Message catalog.

       Every string a person reads lives here, keyed, rather than written where it is
       rendered. One catalog serves both builds: the userscript reads it directly, and
       scripts/build-extension.js emits the same entries as _locales/en/messages.json so
       chrome.i18n answers from a translated locale where one is installed. The two can
       therefore not drift, because there is only one of them.

       Keys are flat and use the character set chrome.i18n allows: letters, digits and
       underscore. They are grouped by prefix — toast_, score_, settings_ — because that
       is the only grouping a flat namespace supports and it is how a translator reads
       the file. Substitutions are positional, $1 to $9, which is what getMessage takes;
       $$ is a literal dollar sign. A count-dependent string gets two keys, _one and
       _other, because chrome.i18n has no plural forms of its own.

       Nothing here may be matched against the page. Route detection and selectors read
       IMDb's own test ids, never displayed text, so a translated string can never change
       which code path runs. */
    const MESSAGES = Object.freeze({
        aria_action_for_title: '$1 for $2',
        aria_candidate_matches: 'Candidate matches',
        aria_choose_an_imdb_or_letterboxd_csv: 'Choose an IMDb or Letterboxd CSV file',
        aria_clear_all_saved_title_marks: 'Clear all saved title marks',
        aria_clear_mark_for: 'Clear mark for $1',
        aria_library_status_checking: 'Checking library status',
        aria_library_status_is: 'Library status: $1',
        aria_log_another_viewing_of: 'Log another viewing of $1',
        aria_close_correction_panel: 'Close correction panel',
        aria_close_settings: 'Close settings',
        aria_close_trailer: 'Close trailer',
        aria_collapse_named_section: 'Collapse $1',
        aria_undo_the_last_mark_deletion: 'Undo the last title mark deletion',
        aria_copy_imdb_id: 'Copy IMDb ID $1',
        aria_correct_match: 'Correct $1 match',
        aria_correct_the_match_for_this_title: 'Correct the $1 match for this title',
        aria_destination_category: 'Destination category',
        aria_destination_color: 'Destination color',
        aria_destination_name: 'Destination name',
        aria_destination_row_in_list: '$1 in $2',
        aria_dim_titles_rated_below: 'Dim titles rated below',
        aria_dismiss_the_update_notice: 'Dismiss the $1 update notice',
        aria_dismiss_the_welcome_notice: 'Dismiss the welcome notice',
        aria_expand_named_section: 'Expand $1',
        aria_filter_by_private_marks: 'Filter by private marks',
        aria_filter_catalog_destinations: 'Filter catalog destinations',
        aria_find_subtitles_for: 'Find subtitles for $1',
        aria_follow_system_theme: 'Follow system theme',
        aria_grant_access_to: 'Grant $1 access to $2',
        aria_import_imdb_watched_titles_shown_on: 'Import IMDb Watched titles shown on this page into private Seen marks',
        aria_integration_service_tabs: '$1 services',
        aria_jump_to: 'Jump to $1',
        aria_loading_broadcast_details: 'Loading broadcast details',
        aria_loading_anilist_score: 'Loading AniList score',
        aria_loading_letterboxd_score: 'Loading Letterboxd score',
        aria_loading_metacritic_score: 'Loading Metacritic score',
        aria_loading_rotten_tomatoes_score: 'Loading Rotten Tomatoes score',
        aria_loading_streaming_availability: 'Loading streaming availability',
        aria_look_up_again: 'Look up $1 again',
        aria_move_destination_down: 'Move destination down',
        aria_move_destination_up: 'Move destination up',
        aria_move_down: 'Move $1 down',
        aria_move_up: 'Move $1 up',
        aria_on_this_page: 'On this page',
        aria_open_imdb_enhanced_settings: 'Open IMDb Enhanced settings',
        aria_open_link: 'Open $1 link: $2',
        aria_open_on_in_a_new_tab: 'Open $1 on $2 in a new tab',
        aria_open_search_for: 'Open $1 search for $2',
        aria_prepare_visible_titles_for: 'Prepare visible titles for $1',
        aria_private_note: 'Private note',
        aria_private_note_about: 'Private note about $1',
        aria_recorded_failures: 'Recorded failures',
        aria_remove_destination: 'Remove destination',
        aria_remove_destination_from_list: 'Remove $1 from $2',
        aria_reveal_episode_synopsis: 'Reveal episode synopsis',
        aria_reveal_plot_synopsis: 'Reveal plot synopsis',
        aria_reviews_and_research: 'Reviews and research',
        aria_save_a_private_seen_mark_for: 'Save a private Seen mark for $1; does not change IMDb Watched',
        aria_save_a_private_skip_mark_for: 'Save a private Skip mark for $1; does not change IMDb Watched',
        aria_search_queue: '$1 search queue',
        aria_season_averages: 'Season averages',
        aria_season_progress: 'Season progress',
        aria_settings_sections: 'Settings sections',
        aria_show_destination_on_imdb_pages: 'Show destination on IMDb pages',
        aria_show_on_imdb_pages: 'Show $1 on IMDb pages',
        aria_tell_me_about_new_versions: 'Tell me about new versions',
        aria_title_navigation: 'Title navigation',
        aria_title_ratings_and_availability: 'Title ratings and availability',
        aria_title_surface: '$1 title surface',
        aria_title_topics: 'Title topics',
        aria_title_url: '$1 title URL',
        aria_top_rated_episodes: 'Top rated episodes',
        aria_url_template: 'URL template',
        aria_use_theme: 'Use $1 theme',
        aria_watch_movie_and_show_sites: 'Watch movie and show sites',
        aria_where_streaming_availability_comes_from: 'Where streaming availability comes from',
        category_availability: 'Availability',
        category_availability_detail: 'See where the title is streaming.',
        category_info: 'Info & research',
        category_info_detail: 'Cast, credits, facts, and reference.',
        category_other: 'Other',
        category_other_detail: 'A custom destination.',
        category_reviews: 'Reviews & ratings',
        category_reviews_detail: 'Critics, audience scores, and discussion.',
        category_trailers: 'Trailers & video',
        category_trailers_detail: 'Trailers, clips, and video results.',
        category_watch: 'Watch',
        category_watch_detail: 'Find the movie or show to watch.',
        error_backup_bad_kdf_cost: 'This encrypted backup declares an unusable key-derivation cost.',
        error_backup_malformed: 'This encrypted backup is malformed and was not imported.',
        error_backup_no_web_crypto: 'This browser does not expose Web Crypto, so an encrypted backup cannot be made.',
        error_backup_not_settings_json: 'The backup decrypted but its contents are not valid settings JSON.',
        error_backup_passphrase_required: 'Enter the passphrase this backup was encrypted with.',
        error_backup_unrecognized: 'This is not a recognized encrypted backup.',
        error_backup_unsupported_parameters: 'This encrypted backup uses parameters this version cannot read.',
        error_backup_wrong_passphrase: 'Wrong passphrase, or the backup has been altered. Nothing was changed.',
        error_copy_failed: 'Copy failed. Check this page’s clipboard permission.',
        error_csv_empty: 'Paste CSV data or choose a CSV file first.',
        error_csv_no_header: 'CSV does not contain a header row.',
        error_csv_no_usable_column: 'CSV needs a Const or imdbID column, or a Title column that can match an existing local title.',
        error_csv_stray_quote: 'CSV has a quote in the middle of an unquoted field.',
        error_csv_too_large: 'CSV import is too large. Use a file under $1 MB.',
        error_csv_unterminated_quote: 'CSV ends inside a quoted field.',
        error_import_recovery_incomplete: 'Import failed and automatic recovery was incomplete. Reload before changing settings.',
        error_import_rolled_back: 'Import could not be saved; previous settings were restored.',
        error_media_server_local_only: 'Only localhost and 127.0.0.1 media server URLs are allowed by this build.',
        error_redirect_changed_origin: 'Blocked: the service redirected to a different site.',
        error_redirect_not_allowed: 'Blocked: the service redirected somewhere this extension does not allow.',
        error_redirect_trust_boundary: 'Blocked: the service redirected between a local and a public address.',
        error_redirect_with_credential: 'Blocked: the service tried to redirect a request carrying your API key.',
        error_request_aborted: 'Request aborted',
        error_request_failed: 'Request failed',
        error_request_http: 'The service returned an HTTP error',
        error_request_rate_limited: 'The service asked for fewer requests. It will be left alone for a moment.',
        error_request_network: 'The service could not be reached',
        error_request_timeout: 'The service did not answer in time',
        error_response_not_json: 'Response was not valid JSON',
        error_response_too_large: 'Response was too large',
        error_seerr_local_only: 'Only localhost and 127.0.0.1 Seerr URLs are allowed by this build.',
        error_servarr_local_only: 'Only localhost and 127.0.0.1 Servarr URLs are allowed by this build.',
        error_settings_none_recognized: 'No valid recognized settings were found.',
        error_settings_not_an_object: 'Settings JSON must be an object.',
        error_settings_unreadable: 'Current settings could not be read; no changes were made.',
        feature_castAges_detail: 'Shows a living person’s current age next to their birth date, and roughly how old each billed actor was when a title came out. IMDb already prints the age at death for people who have died; the cast ages come from Wikidata and are approximate.',
        feature_castAges_name: 'Person age',
        feature_collapsibleSections_detail: 'Adds per-section collapse controls and remembers each state.',
        feature_collapsibleSections_name: 'Collapsible sections',
        feature_collectionPanel_detail: 'On a film that belongs to a series, lists the other films in it in order, with the one you are on marked. Off by default, and asks nothing on a title that is in no series.',
        feature_collectionPanel_name: 'Franchise watch order',
        feature_compactHeader_detail: 'Slims the IMDb header and keeps it visible while you scroll.',
        feature_compactHeader_name: 'Compact header',
        feature_dimLowRated_detail: 'Fades the artwork of titles rated below your threshold on lists, charts, and search results. Text and controls stay fully readable, and hovering restores the image.',
        feature_dimLowRated_name: 'Dim low-rated titles',
        feature_editorialTitleSurface_detail: 'Rebuilds title pages into a stable editorial hero with dedicated action, rating, and research regions.',
        feature_editorialTitleSurface_name: 'Editorial title layout',
        feature_enhancedRatingDisplay_detail: 'Elevates IMDb rating and popularity blocks with clearer emphasis.',
        feature_enhancedRatingDisplay_name: 'Refined rating display',
        feature_episodeHeatmap_detail: 'Colours IMDb’s own season×episode grid by rating and adds season averages, on the Ratings tab of a series.',
        feature_episodeHeatmap_name: 'Episode heatmap colours',
        feature_episodeSubtitles_detail: 'Adds a subtitle link to every episode on an episode list, plus a button that copies them all for the loaded season.',
        feature_episodeSubtitles_name: 'Per-episode subtitle links',
        feature_expandSummaries_detail: 'Releases IMDb’s line clamp so long summaries and biographies read in full without a per-block click.',
        feature_expandSummaries_name: 'Expand truncated summaries',
        feature_expandedLinkMenu_detail: 'Groups additional movie, review, subtitle, and TV lookup links.',
        feature_expandedLinkMenu_name: 'Expanded link menu',
        feature_externalLinks_detail: 'Adds trusted research and trailer links near the title.',
        feature_externalLinks_name: 'External links bar',
        feature_imageZoom_detail: 'Hovering or tabbing to a poster or a cast photo shows a larger version beside it, requested at a bounded size rather than the full original. Escape closes it.',
        feature_imageZoom_name: 'Poster and cast photo zoom',
        feature_inlineAnimeScore_detail: 'On anime titles, shows the AniList community average beside the other scores. Off by default, and nothing is requested for a title that is not anime.',
        feature_inlineAnimeScore_name: 'AniList anime scores',
        feature_inlineLetterboxdScore_detail: 'Shows Letterboxd average ratings inline for films when available.',
        feature_inlineLetterboxdScore_name: 'Letterboxd scores',
        feature_inlineMetacriticScore_detail: 'Shows Metacritic score feedback inline when available.',
        feature_inlineMetacriticScore_name: 'Metacritic scores',
        feature_inlineRTScore_detail: 'Shows Rotten Tomatoes score feedback inline when available.',
        feature_inlineRTScore_name: 'Rotten Tomatoes scores',
        feature_keyboardShortcuts_detail: 'Optional. Enables ? for settings, c to copy, r for rating, and t for top.',
        feature_keyboardShortcuts_name: 'Optional keyboard shortcuts',
        feature_listMultiSearch_detail: 'Builds a popup-safe queue of up to 20 title links on watchlist, list, and chart pages.',
        feature_listMultiSearch_name: 'List multi-search',
        feature_listRoulette_detail: 'Adds a button to watchlists, lists, and charts that picks one title at random and scrolls to it. It never opens anything.',
        feature_listRoulette_name: 'Pick something to watch',
        feature_collectionExport_detail: 'Copies the rows loaded on a watchlist, list or chart as a CSV using IMDb column names, so it reads back into IMDb and into this extension. Only the rows on screen are included, and it says how many had no rating.',
        feature_listRuntimeSummary_detail: 'Totals how long the titles on a watchlist, list, or chart would take to watch, and says how many had no runtime listed.',
        feature_collectionExport_name: 'Copy a list as CSV',
        feature_listRuntimeSummary_name: 'List runtime summary',
        feature_markLinkTint_detail: 'Underlines links to titles you have marked, in the mark colour, anywhere they appear on a page. Needs private marks.',
        feature_markLinkTint_name: 'Show marks on plain title links',
        feature_airsOn_detail: 'Shows which network or streaming service a series airs on, from TVmaze. Series only, and nothing is requested for a film.',
        feature_airsOn_name: 'Where a series airs',
        feature_markFilters_detail: 'Adds an All / Unseen / Seen / Skipped filter with counts to lists, charts, watchlists, search results, and filmographies. Needs private marks.',
        feature_markFilters_name: 'Filter by private marks',
        feature_mediaServerIntegration_detail: 'Checks configured local Plex, Jellyfin, and Emby servers and shows whether the title is already in your library.',
        feature_mediaServerIntegration_name: 'Plex/Jellyfin/Emby indicator',
        feature_modernUI_detail: 'Applies the selected theme, typography, focus, and component treatment.',
        feature_modernUI_name: 'Modern IMDb skin',
        feature_movieChatBoard_detail: 'Adds a message board for the title at the bottom of the page, hosted by MovieChat. Nothing is loaded until you scroll to it, and if the board cannot be shown the section becomes a plain link.',
        feature_movieChatBoard_name: 'MovieChat message board',
        feature_quickCopyID_detail: 'Adds a visible IMDb ID copy button beside the title.',
        feature_quickCopyID_name: 'Quick copy IMDb ID',
        feature_quickNav_detail: 'Adds a right-side section navigator on wide screens.',
        feature_quickNav_name: 'Section navigator',
        feature_ratingColorCoding_detail: 'Adds a small quality label beside the IMDb score.',
        feature_ratingColorCoding_name: 'Rating quality labels',
        feature_ratingGap_detail: 'On the Ratings tab, compares IMDb’s weighted rating with the unweighted mean of the raw votes.',
        feature_ratingGap_name: 'Weighted vs unweighted rating',
        feature_rowIntegrationState_detail: 'Shows whether each title in a list, chart, or filmography is already in your library, monitored, or requested. One lookup per title, made only once you scroll to the row, using whichever local service you have configured.',
        feature_rowIntegrationState_name: 'Library status on list rows',
        feature_removeAds_detail: 'Hides current IMDb ad placements, sponsored shells, and tracking pixels as early as the page allows.',
        feature_removeAds_name: 'Hide ads and sponsored shells',
        feature_removeAppBanner_detail: 'Hides app-install prompts shown on desktop pages.',
        feature_removeAppBanner_name: 'Hide app banners',
        feature_removeFeaturedReview_detail: 'Hides the user reviews shown on a title page. The heading, the count and the link through to all of them stay.',
        feature_removeFeaturedReview_name: 'Hide reviews on title pages',
        feature_removeContribution_detail: 'Removes contribution calls to action from detail pages.',
        feature_removeContribution_name: 'Hide contribution prompts',
        feature_removeNewsSection_detail: 'Keeps the page focused by removing IMDb news modules.',
        feature_removeNewsSection_name: 'Hide news modules',
        feature_removeProUpsell_detail: 'Hides explicit IMDbPro prompts and links from title and name pages while preserving list controls.',
        feature_removeProUpsell_name: 'Hide IMDbPro upsells',
        feature_removeRelatedInterests_detail: 'Hides broad interest recommendations that dilute title and cast pages.',
        feature_removeRelatedInterests_name: 'Hide related interests',
        feature_removeSponsoredRecs_detail: 'Suppresses sponsored recommendation blocks where IMDb inserts them.',
        feature_removeSponsoredRecs_name: 'Hide sponsored recommendations',
        feature_restoreImageContextMenu_detail: 'IMDb blocks the right-click menu over gallery images, so Save image as does nothing there. This lets the browser show its own menu again.',
        feature_restoreImageContextMenu_name: 'Right-click on images',
        feature_searchButtons_detail: 'Adds prominent, keyboard-friendly watch-site links near the title.',
        feature_searchButtons_name: 'Watch search buttons',
        feature_seasonProgress_detail: 'Shows how much of the loaded season you have marked seen, links to the next unmarked episode, and marks or clears the whole loaded season in one step with an undo. Needs private marks.',
        feature_seasonProgress_name: 'Season progress and batch marking',
        feature_servarrIntegration_detail: 'Adds optional local Radarr/Sonarr quick-add buttons with library status indicator when API settings are configured.',
        feature_servarrIntegration_name: 'Servarr quick-add',
        feature_spoilerBlur_detail: 'Softens long plot text until you intentionally reveal it.',
        feature_spoilerBlur_name: 'Spoiler blur on plot',
        feature_streamAvailability_detail: 'Shows one-glance JustWatch streaming providers when available.',
        feature_streamAvailability_name: 'Streaming availability',
        feature_subtitleLinks_detail: 'Adds subtitle lookup links in the details section.',
        feature_subtitleLinks_name: 'Subtitle links',
        feature_titleNotes_detail: 'Adds a private note field to title pages, saved on this device and included in backups. Never sent anywhere.',
        feature_titleNotes_name: 'Private title notes',
        feature_trailerPopover_detail: 'Adds an in-page trailer modal backed by a click-to-fetch YouTube lookup.',
        feature_trailerPopover_name: 'Trailer popover',
        feature_tvEpisodeTools_detail: 'Surfaces the highest-rated episodes; synopsis blur remains opt-in through Spoiler blur on plot.',
        feature_tvEpisodeTools_name: 'TV episode tools',
        feature_tvShowEnhancements_detail: 'Adds TV-specific lookup shortcuts on series pages.',
        feature_tvShowEnhancements_name: 'TV show quick links',
        feature_watchedMarking_detail: 'Adds private Seen and Skip marks on title cards across titles, charts, lists, watchlists, filmographies, and search results. Marks stay on this device and do not change IMDb Watched.',
        feature_watchedMarking_name: 'Private seen / skip marks',
        feature_watchlistAlerts_detail: 'Notices when something on your watchlist becomes available on a service you picked, and tells you once a day. Needs a TMDB token, works only in the extension, and keeps a bounded list of the most recent watchlist page you opened.',
        feature_watchlistAlerts_name: 'Watchlist streaming alerts',
        feature_watchlistBatch_detail: 'Adds a watchlist-page button that copies all visible IMDb title IDs.',
        feature_watchlistBatch_name: 'Watchlist batch ID copy',
        feature_widerLayout_detail: 'Uses more horizontal room across normal desktop window sizes.',
        feature_widerLayout_name: 'Wider desktop layout',
        field_a_private_note_about_this_title: 'A private note about this title. Stored on this device only.',
        field_const_your_rating_date_rated_title: 'Const,Your Rating,Date Rated,Title\ntt0133093,9,2026-08-31,The Matrix',
        field_filter_by_site_name_or_address: 'Filter by site name or address',
        field_http_localhost_32400: 'http://localhost:32400',
        field_http_localhost_5055: 'http://localhost:5055',
        field_http_localhost_7878: 'http://localhost:7878',
        field_http_localhost_8096: 'http://localhost:8096',
        field_http_localhost_8989: 'http://localhost:8989',
        field_https_example_com_search_q_title: 'https://example.com/search?q={{TITLE}}',
        field_modernui_true_themevariant_dark: '{ "modernUI": true, "themeVariant": "dark" }',
        field_paste_a_title_url: 'Paste a $1 title URL',
        field_paste_your_mdblist_key: 'Paste your MDBList key',
        field_paste_your_omdb_key: 'Paste your OMDb key',
        field_paste_your_v4_read_access_token: 'Paste your v4 read access token',
        field_radarr_root_folder_hint: '/movies',
        field_site_name: 'Site name',
        field_sonarr_root_folder_hint: '/tv',
        field_two_letter_country_code_such_as: 'Two-letter country code, such as US or GB',
        journal_aborted: 'Cancelled by navigation',
        journal_empty: 'No failures recorded.',
        journal_http: 'A lookup service returned an HTTP error',
        journal_rate_limited: 'A lookup service asked for fewer requests',
        journal_schema: 'A lookup service changed the page this reads',
        journal_network: 'A lookup could not reach its service',
        journal_parse: 'A response could not be understood',
        journal_permission: 'Access was refused',
        journal_selector: 'IMDb page structure changed',
        journal_storage: 'Local storage refused a write',
        journal_timeout: 'A lookup ran out of time',
        journal_unknown: 'Unclassified',
        label_about_this_title: 'About this title',
        label_add: 'Add',
        label_all: 'All',
        label_apply_import: 'Apply import',
        label_box_office: 'Box Office',
        label_cast: 'Cast',
        label_checking: 'Checking',
        label_choose_csv_file: 'Choose CSV file',
        label_again: 'Again',
        label_airs_on: 'AIRS ON',
        label_clear: 'Clear',
        label_clear_cache: 'Clear cache',
        label_clear_journal: 'Clear journal',
        label_close: 'Close',
        label_copy_journal: 'Copy journal',
        label_dark: 'Dark',
        label_data: 'Data',
        label_details: 'Details',
        label_dismiss: 'Dismiss',
        label_experience: 'Experience',
        label_export_settings: 'Export settings',
        label_high_contrast: 'High contrast',
        label_integrations: 'Integrations',
        label_light: 'Light',
        label_local_stats: 'Local stats',
        label_media_server: 'MEDIA SERVER',
        label_midnight: 'Midnight',
        label_oled: 'OLED',
        label_open: 'Open',
        label_or_paste_csv_data: 'Or paste CSV data',
        label_overview: 'Overview',
        label_preferences: 'Preferences',
        label_privacy: 'Privacy',
        label_private_marks: 'Private marks',
        label_private_title_marks: 'Private title marks',
        label_rate: 'Rate',
        label_rating_average: 'Average',
        label_rating_good: 'Good',
        label_rating_great: 'Great',
        label_rating_poor: 'Poor',
        label_rating_unrated: 'N/A',
        label_ratings: 'Ratings',
        label_region: 'Region',
        label_request: 'Request',
        label_reset_every_setting: 'Reset every setting?',
        label_retry: 'Retry',
        label_reviews_research: 'Reviews & research',
        label_score_cache: 'Score cache',
        label_search_all_on: 'SEARCH ALL ON',
        label_season_average: 'Season average',
        label_seen: 'Seen',
        label_similar: 'Similar',
        label_site_access_not_granted: 'Site access not granted',
        label_sites: 'Sites',
        label_skip: 'Skip',
        label_skipped: 'Skipped',
        label_stars: 'Stars',
        label_stored_locally: 'Stored locally',
        label_streams_on: 'STREAMS ON',
        label_streaming: 'STREAMING',
        label_subtitles: 'Subtitles:',
        label_templates: 'Templates',
        label_token: 'Token',
        label_tools: 'Tools',
        label_trailer: 'Trailer',
        label_trivia: 'Trivia',
        label_undo: 'Undo',
        label_unseen: 'Unseen',
        label_url: 'URL',
        label_via_mdblist: 'via MDBList',
        label_via_omdb: 'via OMDb',
        label_wrong: 'Wrong?',
        menu_copy_settings_backup: 'Copy settings backup (no credentials)',
        menu_reset_all_settings: 'Reset all settings (with undo)',
        notification_watchlist_title: 'New on your watchlist',
        permissions_access_declined_note: 'Access was not granted. IMDb Enhanced stays inactive until you allow it to run on IMDb.',
        permissions_access_granted_note: 'Access granted. Reload any IMDb tabs that were already open.',
        permissions_access_scope_note: 'Access covers IMDb, the score and trailer services the settings enable, and your own localhost media servers. Nothing else is requested.',
        permissions_active_reload_note: 'IMDb Enhanced is active. Open or reload an IMDb page and use the gear icon for settings.',
        permissions_grant_site_access: 'Grant site access',
        permissions_needs_access_note: 'IMDb Enhanced needs access to IMDb before it can style pages, block ad shells, or look up scores.',
        permissions_no_additional_access_required: 'No additional site access is required.',
        permissions_open_recovery: 'Backup, restore, and reset',
        permissions_page_title: 'IMDb Enhanced',
        permissions_recovery_still_available: 'stay available even without site access.',
        permissions_site_access_granted: 'Site access granted',
        permissions_site_access_needed: 'Site access needed',
        provider_amazonAds_consent: 'Blocks requests to these hosts. Nothing is sent to them.',
        provider_amazonAds_label: 'the ad and tracking hosts it blocks',
        provider_anilist_consent: 'Sends the title and year read from the page to AniList to find an anime rating.',
        provider_justWatch_consent: 'Sends the title and year read from the page to JustWatch to find where it streams.',
        provider_letterboxd_consent: 'Sends the title and year read from the page to Letterboxd to find its rating.',
        provider_githubUpdate_consent: 'Reads the published version number once a day so this build can say when a newer one exists. Nothing about what you are looking at is sent. Turn off the update notice to stop it.',
        provider_localServices_consent: 'Talks to services on your own machine. Nothing leaves it.',
        provider_localServices_label: 'your own computer',
        provider_metacritic_consent: 'Sends the title and year read from the page to Metacritic to find its score.',
        provider_omdb_attribution: 'Ratings from the OMDb API, used under CC BY-NC 4.0.',
        provider_mdblist_attribution: 'Ratings aggregated by MDBList',
        provider_mdblist_consent: 'Sends the IMDb id to MDBList to read its Rotten Tomatoes, Metacritic and Letterboxd ratings in one call. Needs your own MDBList key.',
        provider_omdb_consent: 'Sends the IMDb id to OMDb to read its Rotten Tomatoes and Metacritic ratings. Needs your own OMDb key.',
        provider_rottenTomatoes_consent: 'Sends the title and year read from the page to Rotten Tomatoes to find its scores.',
        provider_tmdb_attribution: 'This extension uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB. Streaming data provided by JustWatch.',
        provider_tmdb_consent: 'Sends the IMDb id to TMDB to look up where the title streams. Needs your own TMDB read token.',
        provider_tvmaze_attribution: 'Broadcast data from TVmaze, used under CC BY-SA.',
        provider_tvmaze_consent: 'Sends the IMDb id to TVmaze to find which network a show airs on.',
        provider_wikidata_consent: 'Sends the IMDb id to Wikidata to find the matching page on another site.',
        provider_youTube_consent: 'Loads the trailer from YouTube, which sees the video you opened.',
        recovery_a_score_or_availability_lookup_sends_the: 'A score or availability lookup sends the title and year from the page you are on to the service it is looking them up in.',
        recovery_access_granted: 'Access to $1 granted. Reload any open IMDb tabs.',
        recovery_access_revoked: 'Access to $1 revoked.',
        recovery_access_was_not_granted_so_that_feature: 'Access was not granted, so that feature still cannot run.',
        recovery_allow: 'Allow',
        recovery_allow_sending_page_details_to_score_services: 'Allow sending page details to score services',
        recovery_allow_watchlist_notifications: 'Allow watchlist notifications',
        recovery_backup_copied: 'Backup copied.',
        recovery_backup_copied_omitting_one: 'Backup copied. $1 integration credential was left out.',
        recovery_backup_copied_omitting_other: 'Backup copied. $1 integration credentials were left out.',
        recovery_backup_intro: 'A normal backup leaves out integration API keys and tokens and tells you which it left out.',
        recovery_backup_is_encrypted: 'This backup is encrypted. Enter its passphrase.',
        recovery_build_version: 'Build version',
        recovery_cache_summary: '$1 entries · $2',
        recovery_cancel: 'Cancel',
        recovery_checking_site_access: 'Checking site access…',
        recovery_clipboard_unavailable: 'Clipboard unavailable',
        recovery_consent_allowed: 'Allowed.',
        recovery_consent_recorded: 'Consent recorded.',
        recovery_consent_was_not_given_so_those_lookups: 'Consent was not given, so those lookups should stay off.',
        recovery_consent_withdrawn_turn_off_the_score_and: 'Consent withdrawn. Turn off the score and availability lookups too.',
        recovery_copy_backup: 'Copy backup',
        recovery_copy_backup_with_credentials: 'Copy backup with credentials',
        recovery_copy_diagnostics: 'Copy diagnostics',
        recovery_diagnostics_report_copied: 'Diagnostics report copied.',
        recovery_encrypt_and_copy: 'Encrypt and copy',
        recovery_encrypted_backup_note: 'The backup is encrypted in this browser with the passphrase you choose. There is no way to recover the contents if you forget it.',
        recovery_grant: 'Grant',
        recovery_grant_access_to: 'Grant access to $1',
        recovery_grant_imdb_access: 'Grant IMDb access',
        recovery_granted_and_the_feature_is_on: 'Granted, and the feature is on.',
        recovery_granted_but_the_feature_is_switched_off: 'Granted, but the feature is switched off.',
        recovery_granted_host_access: 'Granted host access:',
        recovery_heading_backup: 'Backup',
        recovery_heading_reset: 'Reset',
        recovery_heading_restore: 'Restore',
        recovery_heading_site_access: 'Site access',
        recovery_heading_status: 'Status',
        recovery_imdb_access_granted_open_or_reload_an: 'IMDb access granted. Open or reload an IMDb page.',
        recovery_imdb_access_is_granted: 'IMDb access is granted.',
        recovery_imdb_access_is_not_granted_so_the: 'IMDb access is not granted, so the extension cannot run on IMDb pages.',
        recovery_imdb_access_was_not_granted_so_the: 'IMDb access was not granted, so the extension still cannot run there.',
        recovery_lookup_cache: 'Lookup cache',
        recovery_no_host_access_is_currently_granted: 'No host access is currently granted.',
        recovery_not_allowed_so_those_lookups_should_stay: 'Not allowed, so those lookups should stay off.',
        recovery_not_granted: 'Not granted.',
        recovery_not_granted_so_this_feature_cannot_work: 'Not granted, so this feature cannot work yet.',
        recovery_notifications_allowed: 'Allowed.',
        recovery_notifications_declined: 'Notifications were not allowed, so the daily check will stay quiet.',
        recovery_notifications_not_allowed: 'Not allowed, so the daily check will say nothing.',
        recovery_notifications_recorded: 'Notifications allowed.',
        recovery_notifications_withdrawn: 'Notifications withdrawn. The daily check keeps running quietly.',
        recovery_open_imdb_settings: 'Open IMDb settings',
        recovery_page_intro: 'Everything here works without access to IMDb, so it stays usable when the extension cannot run on the site.',
        recovery_page_title: 'IMDb Enhanced settings recovery',
        recovery_passphrase: 'Passphrase',
        recovery_paste_a_backup: 'Paste a backup',
        recovery_paste_a_backup_before_restoring: 'Paste a backup before restoring.',
        recovery_repeat_passphrase: 'Repeat passphrase',
        recovery_reset_confirm: 'Yes, reset everything',
        recovery_reset_done: 'Reset $1 settings. Undo is available until you leave this page.',
        recovery_reset_everything: 'Reset everything',
        recovery_reset_intro: 'Returns every preference, site list, title mark, and integration credential to its default. You can undo it once, without leaving this page.',
        recovery_reset_not_attempted: 'Current settings could not be read, so reset was not attempted: $1',
        recovery_reset_warning: 'This clears title marks and local integration credentials. Copy a backup first if you may need them.',
        recovery_restore_button: 'Restore',
        recovery_restored: 'Restored $1 settings.',
        recovery_restored_some_skipped: 'Restored $1 settings; skipped $2 unrecognized.',
        recovery_revoke: 'Revoke',
        recovery_revoke_access_to: 'Revoke access to $1',
        recovery_script_version: 'Script version',
        recovery_section_could_not_be_read: 'The $1 section could not be read, but the actions below still work.',
        recovery_section_site_access: 'site access',
        recovery_section_status: 'status',
        recovery_section_storage: 'storage',
        recovery_sending_page_details_to_score_services: 'Sending page details to score services',
        recovery_site_access_could_not_be_read_in: 'Site access could not be read in this browser.',
        recovery_site_access_intro: 'Features that reach a site other than IMDb ask for access to that site only, and only when you switch them on. This page is the only place a browser will let an extension request it, so grant and revoke happen here.',
        recovery_that_is_not_valid_json_nothing_was: 'That is not valid JSON. Nothing was changed.',
        recovery_the_backup_could_not_be_created: 'The backup could not be created.',
        recovery_the_consent_could_not_be_changed: 'The consent could not be changed.',
        recovery_the_diagnostics_report_could_not_be_copied: 'The diagnostics report could not be copied. Check this page’s clipboard permission.',
        recovery_the_permission_could_not_be_changed: 'The permission could not be changed.',
        recovery_the_reset_failed_and_previous_settings_were: 'The reset failed and previous settings were restored.',
        recovery_the_restore_failed_nothing_was_changed: 'The restore failed. Nothing was changed.',
        recovery_the_undo_failed_nothing_was_changed: 'The undo failed. Nothing was changed.',
        recovery_title_marks: 'Title marks',
        recovery_unavailable: 'unavailable',
        recovery_undo_available_note: 'Available until you leave this page.',
        recovery_undo_done: 'Undone. $1 settings were put back.',
        recovery_undo_the_reset: 'Undo the reset',
        recovery_unknown_error: 'unknown error',
        recovery_watchlist_notifications: 'Watchlist alerts',
        recovery_watchlist_notifications_detail: 'A notification when something on your watchlist turns up on a service you chose. Sent at most once a day.',
        recovery_withdraw: 'Withdraw',
        recovery_withdraw_consent_for_sending_page_details_to: 'Withdraw consent for sending page details to score services',
        recovery_withdraw_watchlist_notifications: 'Stop showing watchlist notifications',
        settings_a_backup_covers_preferences_sites_and_title: 'A backup covers preferences, sites, and title marks. Integration API keys and tokens are left out unless you choose the encrypted export.',
        settings_a_key_is_saved_on_this_device: 'A key is saved on this device. It is not shown here; type a new one to replace it.',
        settings_a_readable_summary_for_bug_reports_credentials: 'A readable summary for bug reports. Credentials, marked titles, and the page query string are never included.',
        settings_a_year_review_appears_after_10_dated: 'A year review appears after 10 dated viewings in one year.',
        settings_actions_placed_near_a_movie_or_show: 'Actions placed near a movie or show title.',
        settings_activity_by_year: 'Activity by year',
        settings_add_destination: 'Add destination',
        settings_add_movies_to_radarr_and_shows_to: 'Add movies to Radarr and shows to Sonarr.',
        settings_additions_to_cast_and_crew_pages: 'Additions to cast and crew pages.',
        settings_all_pages: 'All pages',
        settings_allow_notifications: 'Allow notifications',
        settings_api_key: 'API key',
        settings_applies_when_dim_low_rated_titles_is: 'Applies when “Dim low-rated titles” is on. Unrated titles are never dimmed.',
        settings_backup_restore: 'Backup & restore',
        settings_batch_actions_and_quick_navigation: 'Batch actions and quick navigation.',
        settings_both_sources_use_the_two_letter_region: 'Both sources use the two-letter region below. TMDB publishes its data through a documented API and asks for a token of your own, free from themoviedb.org. JustWatch is read by parsing their page. Choosing TMDB without a token says so rather than quietly reading the page instead.',
        settings_cached_lookups: 'Cached lookups',
        settings_calculated_on_this_device_from_your_private: 'Calculated on this device from your private marks and imported viewing history.',
        settings_changes_save_automatically: 'Changes save automatically.',
        settings_badge_list_rows_with_library_status: 'Badge list, chart, and filmography rows with library status.',
        settings_check_plex_jellyfin_and_emby_libraries: 'Check Plex, Jellyfin, and Emby libraries.',
        settings_checks_match_imdb_ids_first_then_title: 'Checks match IMDb IDs first, then title and year. Credentials stay local.',
        settings_choose_a_passphrase_the_backup_is_encrypted: 'Choose a passphrase. The backup is encrypted in this browser with it, and there is no way to recover the contents if you forget it.',
        settings_choose_the_tonal_base_for_imdb_enhanced: 'Choose the tonal base for IMDb Enhanced surfaces.',
        settings_choose_which_ratings_and_availability: 'Choose which ratings and availability information to show. The vote-distribution controls apply to a title’s Ratings tab.',
        settings_clean_up: 'Clean up',
        settings_column_color: 'Color',
        settings_column_move: 'Move',
        settings_column_name: 'Name',
        settings_column_purpose: 'Purpose',
        settings_undo_delete: 'Undo delete',
        settings_column_remove: 'Remove',
        settings_column_url_template: 'URL template',
        settings_column_visible: 'Visible',
        settings_configure_local_library_checks: 'Configure local library checks.',
        settings_configure_local_quick_add_destinations: 'Configure local quick-add destinations.',
        settings_copy_a_passphrase_encrypted_backup_that: 'Copy a passphrase-encrypted backup that includes integration credentials',
        settings_copy_a_scrubbed_diagnostics_report_to_the: 'Copy a scrubbed diagnostics report to the clipboard',
        settings_copy_diagnostics: 'Copy diagnostics',
        settings_coverage_label: 'Coverage.',
        settings_credentials_stay_local_and_requests_are_limited: 'Credentials stay local and requests are limited to localhost or 127.0.0.1. Seerr, and the Overseerr and Jellyseerr installs it was merged from, all use these fields; a request there goes through your instance\'s approval workflow instead of writing straight into Radarr or Sonarr, and your instance resolves the IMDb ID itself.',
        settings_csv_could_not_be_read: 'CSV could not be read.',
        settings_csv_import_failed_previous_marks_were_restored: 'CSV import failed. Previous marks were restored.',
        settings_dated_viewings: 'Dated viewings',
        settings_diagnostics_copied_paste_it_into_your_report: 'Diagnostics copied. Paste it into your report.',
        settings_download_marks: 'Download CSV',
        settings_download_marks_hint: 'Save every mark as a file',
        settings_download_marks_letterboxd: 'Download for Letterboxd',
        settings_download_marks_letterboxd_hint: 'Save the Letterboxd import file',
        settings_edit_every_destination_directly_hide_categorize: 'Edit every destination directly. Hide, categorize, reorder, or remove links without changing the rest of IMDb Enhanced.',
        settings_export_marks_full: 'Copy as CSV',
        settings_export_marks_full_hint: 'Every mark, with its state, title, year, genres, ratings, runtime, dates and note',
        settings_export_marks_letterboxd: 'Copy for Letterboxd',
        settings_export_marks_letterboxd_hint: 'Seen titles only, in the two columns Letterboxd imports',
        settings_export_marks_note: 'A backup is for coming back here. This is for taking your list somewhere else.',
        settings_export_with_credentials: 'Export with credentials',
        settings_failure_journal: 'Failure journal',
        settings_fetched_only_on_imdb_title_pages_responses: 'Fetched only on IMDb title pages. Responses are cached locally.',
        settings_fmhy_catalog: 'FMHY catalog',
        settings_fmhy_streaming_catalog: 'FMHY streaming catalog',
        settings_focused_tools_for_series_and_episode_lists: 'Focused tools for series and episode lists.',
        settings_genres_appear_as_titles_are_marked_or: 'Genres appear as titles are marked or imported.',
        settings_grant_access: 'Grant access',
        settings_heading_appearance: 'Appearance',
        settings_heading_diagnostics: 'Diagnostics',
        settings_heading_export_marks: 'Export your marks',
        settings_heading_people: 'People',
        settings_heading_preview: 'Preview',
        settings_heading_score_sources: 'Score sources',
        settings_heading_mobile_links: 'Mobile links',
        settings_desktop_from_mobile_help: 'A link copied from a phone points at IMDb’s mobile site, which this does not run on. Opening one on a computer takes you to the same page on the normal site instead. Phones are left alone.',
        aria_open_mobile_links_on_the_desktop_site: 'Open mobile links on the desktop site',
        settings_heading_updates: 'Updates',
        settings_heading_watchlist_alerts: 'Watchlist alerts',
        settings_history_metadata_coverage_one: '$2 of $1 history title has year, genre, score, or runtime metadata. $3',
        settings_history_metadata_coverage_other: '$2 of $1 history titles have year, genre, score, or runtime metadata. $3',
        settings_imdb_and_letterboxd_exports_become_local_seen: 'IMDb and Letterboxd exports become local Seen marks. This does not change IMDb Watched status or any IMDb list. IMDb Labs account import is a separate feature.',
        settings_import_from_page: 'Import from page',
        settings_import_preview: 'Import preview',
        settings_import_settings: 'Import settings',
        settings_import_viewing_history: 'Import viewing history',
        settings_lists_shortcuts: 'Lists & shortcuts',
        settings_local_only: 'Local only',
        settings_local_seen: 'Local seen',
        settings_local_skip: 'Local skip',
        settings_mark_and_note_removed: 'Mark and note removed. Undo is in the marks panel.',
        settings_mark_cleared: 'Mark cleared. Undo is in the marks panel.',
        settings_media_server_indicator: 'Media server indicator',
        settings_media_servers: 'Media servers',
        settings_name_pages: 'Name pages',
        settings_no_dated_viewings_yet: 'No dated viewings yet.',
        settings_no_importable_rows_were_found_nothing_was: 'No importable rows were found. Nothing was changed.',
        settings_no_local_viewing_history_yet_mark_a: 'No local viewing history yet. Mark a title Seen or import an IMDb or Letterboxd CSV. Nothing leaves this device.',
        settings_note_only: 'Note only',
        settings_nothing_is_sent_to_an_imdb_enhanced: 'Nothing is sent to an IMDb Enhanced account or cloud service.',
        settings_nothing_is_transmitted_the_report_only_reaches: 'Nothing is transmitted. The report only reaches your clipboard.',
        settings_mdblist_answers_all_three: 'MDBList answers all three in one call, Letterboxd included, and is asked after OMDb. Keys are free from mdblist.com.',
        settings_mdblist_api_key: 'MDBList API key',
        settings_omdb_api_key: 'OMDb API key',
        settings_optional_scores_normally_come_from_reading_each: 'Optional. Scores normally come from reading each site\'s own page; with an OMDb key stored here, a lookup that fails falls back to their API and the score says it came from OMDb. Free for 1,000 lookups a day from omdbapi.com.',
        settings_panel_subtitle: 'Focused controls for your IMDb workspace.',
        settings_paste_csv_data_or_choose_a_file: 'Paste CSV data or choose a file, then preview it.',
        settings_personal_ratings: 'Personal ratings',
        settings_preview_csv: 'Preview CSV',
        settings_private_by_design: 'Private by design',
        settings_quality_profile_id: 'Quality profile ID',
        settings_radarr_sonarr: 'Radarr & Sonarr',
        settings_rating_comparison_appears_after_a_title_has: 'Rating comparison appears after a title has both your rating and IMDb’s rating.',
        settings_refine_how_content_looks_and_is_presented: 'Refine how content looks and is presented.',
        settings_release_decades: 'Release decades',
        settings_release_years_appear_as_titles_are_marked: 'Release years appear as titles are marked or imported.',
        settings_remove_noise_so_you_can_focus_on: 'Remove noise so you can focus on what matters.',
        settings_remove_site: 'Remove site',
        settings_requests_go_directly_from_your_browser_to: 'Requests go directly from your browser to the local URLs you provide.',
        settings_research_reviews: 'Research & reviews',
        settings_reset_all_settings: 'Reset all settings',
        settings_reset_everything: 'Reset everything',
        settings_reset_failed_previous_settings_were_restored: 'Reset failed. Previous settings were restored.',
        settings_root_folder: 'Root folder',
        settings_rotten_tomatoes: 'Rotten Tomatoes',
        settings_rotten_tomatoes_and_metacritic_through_omdb: 'Rotten Tomatoes and Metacritic through OMDb',
        settings_rows_should_carry_const_or_imdbid_a: 'Rows should carry Const or imdbID. A Title and Year row can also match one unambiguous title already stored on this device. Headers are read by name, so IMDb’s Original Title column does not shift the import.',
        settings_runtime_known_across_seen: '$1 of runtime is known across Seen titles.',
        settings_sample_source_values_not_live_title_data: 'Sample values, not live title data.',
        settings_saved_type_to_replace: 'Saved. Type to replace it.',
        settings_scores_and_availability_lookups_are_cached: 'Scores and availability lookups are cached locally for up to seven days.',
        settings_seen_titles: 'Seen titles',
        settings_seen_without_viewing_date_one: '$1 Seen title has no viewing date.',
        settings_seen_without_viewing_date_other: '$1 Seen titles have no viewing date.',
        settings_settings_copied_to_clipboard: 'Settings copied to clipboard',
        settings_show_or_hide_this_destination_on_imdb: 'Show or hide this destination on IMDb pages',
        settings_skipped_titles: 'Skipped titles',
        settings_stored_in: 'Stored in $1.',
        settings_the_encrypted_backup_could_not_be_created: 'The encrypted backup could not be created.',
        settings_the_last_20_feature_failures_kept_across: 'The last 20 feature failures, kept across reloads so an intermittent problem can be seen. Each entry records when, which feature, which kind of page, and what category of failure — never a title, address, or message.',
        settings_these_marks_stay_on_this_device_and: 'These marks stay on this device and never change your IMDb account. Import from page copies the IMDb Watched titles visible on the page behind the settings dialog into local Seen marks; existing marks are kept, and nothing is ever sent back to IMDb.',
        settings_this_backup_is_encrypted_enter_its_passphrase: 'This backup is encrypted. Enter its passphrase.',
        settings_this_build_cannot_update_itself_so_it: 'This build cannot update itself, so it checks once a day whether a newer release has been published.',
        settings_this_build_does_not_read_rotten_tomatoes: 'This build does not read Rotten Tomatoes or Metacritic pages, so their scores come from the OMDb API instead. It is free for 1,000 lookups a day from omdbapi.com and takes an email address to get. Without a key those two widgets say so rather than showing nothing.',
        settings_this_clears_title_marks_and_local_integration: 'This clears title marks and local integration credentials. Export a backup first if you may need them.',
        settings_title_pages: 'Title pages',
        settings_title_tools: 'Title tools',
        settings_tmdb_read_access_token: 'TMDB read access token',
        settings_top_genres: 'Top genres',
        settings_tune_the_interface: 'Tune the interface',
        settings_tv_episodes: 'TV & episodes',
        settings_version: 'Version $1',
        settings_watch_stream: 'Watch & stream',
        settings_watch_stream_includes_a_built_in_catalog: 'Watch & stream includes the FMHY video catalog. Sites with a verified title-search route can be added below. Other entries open their home page so a broken search link never reaches IMDb pages.',
        settings_watchlist_alerts_note: 'Which services are worth telling you about. Checked once a day, in one notification, for the titles on the watchlist page you last opened.',
        settings_watchlist_alerts_pace: 'A large watchlist is worked through a slice at a time, so it can take a few days for every title to come round. Series are skipped: the source only answers for films.',
        settings_watchlist_services_pending: 'The services here are the ones the daily check has seen so far. Turn the alerts on and this fills in after the first check.',
        settings_when_optional_keyboard_shortcuts_is_enabled: 'When “Optional keyboard shortcuts” is enabled',
        settings_where_availability_comes_from: 'Where availability comes from',
        settings_year_has_dated_viewings: '$1 has $2 dated viewings, enough for a year review.',
        text_a_cache_write_was_rejected_by_storage: 'a cache write was rejected by storage; quota appears full',
        text_add_key: 'Add key',
        text_add_radarr: 'Add Radarr',
        text_add_sonarr: 'Add Sonarr',
        text_add_to_watchlist: 'Add to watchlist',
        text_add_token: 'Add token',
        text_added: 'Added',
        text_adding: 'Adding...',
        text_adding_title_through: 'Adding $1 through $2',
        text_age_parenthetical: '(age $1)',
        text_all_of_them: 'all',
        text_all_opened: 'All opened',
        text_anilist_community_average: 'Community average',
        text_audience_score: 'Audience: $1%',
        text_automatic_matching_is_active: 'Automatic matching is active.',
        text_availability_unavailable: 'Availability unavailable',
        text_available: 'Available',
        text_below_avg: 'Below Avg',
        text_broadcast_details_unavailable: 'Broadcast details unavailable',
        text_board_could_not_be_shown: 'The board could not be shown here. Open it on MovieChat instead.',
        text_cache_remaining: '$1 cached entries · $2',
        text_cached_on: 'Cached $1',
        text_candidate_matches_could_not_be_loaded: 'Candidate matches could not be loaded. Paste a title URL or mark no entry.',
        text_candidate_response_was_too_large_or_empty: 'Candidate response was too large or empty',
        text_cast_crew: 'Cast & crew',
        text_checking_server_for_title: 'Checking $1 for $2',
        text_clause_separator: '; ',
        text_clear_all: 'Clear all',
        text_clear_cached_third_party_lookups: 'Clear cached third-party lookups',
        text_clear_loaded_season: 'Clear loaded season',
        text_clear_title: 'Clear $1',
        text_click_or_press_enter_to_reveal: 'Click or press Enter to reveal',
        text_click_or_press_enter_to_reveal_episode: 'Click or press Enter to reveal episode synopsis',
        text_click_or_press_enter_to_reveal_plot: 'Click or press Enter to reveal plot synopsis',
        text_collapse_section: 'Collapse section',
        text_collection_entry: '$1 ($2)',
        text_collection_source_note: 'From Wikidata. Order is the series own numbering where it has one, and release year otherwise.',
        text_copy_all_links: 'Copy all links',
        text_copy_as_csv: 'Copy as CSV',
        text_copy_imdb_ids: 'Copy $1 IMDb IDs',
        text_copy_settings_to_the_clipboard_without_integration: 'Copy settings to the clipboard without integration credentials',
        text_copy_subtitle_links_for_this_season: 'Copy subtitle links for this season',
        text_copy_value: 'Copy $1',
        text_correct_source_match: 'Correct $1',
        text_correction_candidate_count_one: '$1 candidate match.',
        text_correction_candidate_count_other: '$1 candidate matches.',
        text_count_skipped: '$1 skipped',
        text_csv_import_is_too_large_choose: 'CSV import is too large. Choose a file under $1 MB.',
        text_csv_matched_existing: '$1 matched to titles already stored here',
        text_csv_rows_across_titles_one: '$2: $1 row across $3 titles',
        text_csv_rows_across_titles_other: '$2: $1 rows across $3 titles',
        text_csv_rows_past_the_limit: '$1 rows past the limit were not read, so some titles are missing',
        text_csv_summary_nothing_changed_yet: '$1. Nothing has been changed yet.',
        text_csv_titles_over_limit: '$1 over the $2-title limit',
        text_csv_viewings_over_limit_one: '$1 viewing event over the $2-per-title limit not retained',
        text_csv_viewings_over_limit_other: '$1 viewing events over the $2-per-title limit not retained',
        text_digital_release: 'Digital release: $1',
        text_direction_above: 'above',
        text_direction_below: 'below',
        text_encrypted_backup_with_credentials: 'Encrypted backup with credentials',
        text_ep_calendar: 'Ep Calendar',
        text_episode_guide: 'Episode guide',
        text_episodes_list: 'Episodes List',
        text_expand_section: 'Expand section',
        text_failure_journal_copied: 'Failure journal copied',
        text_filter_title_count_one: '$2: $1 title',
        text_filter_title_count_other: '$2: $1 titles',
        text_first_run_active: 'IMDb Enhanced is running on this page. The gear button in the bottom corner opens its settings.',
        text_get_it: 'Get it',
        text_has_a_note: 'has a note',
        text_heatmap_legend: 'Colours: 8+ great · 7+ good · 6+ average · 5+ below · under 5 poor',
        text_imdb_enhanced_settings: 'IMDb Enhanced settings',
        text_imdb_weights_its_displayed_rating: 'IMDb weights its displayed rating to resist vote brigading, so a wide gap means the raw votes disagree with what the page shows.',
        text_import_failed_check_the_json_syntax_and: 'Import failed. Check the JSON syntax and try again.',
        text_import_failed_no_settings_were_changed: 'Import failed. No settings were changed.',
        text_import_settings_from_json: 'Import settings from JSON',
        text_in_library: 'In Library',
        text_justwatch_reads_their_page: 'JustWatch (reads their page)',
        text_link_group_reviews: 'Reviews',
        text_link_group_search: 'Search',
        text_link_group_subtitles: 'Subtitles',
        text_link_group_tv: 'TV',
        text_list_joined: '$1 and $2',
        text_list_separator: ', ',
        text_loading_candidate_matches: 'Loading candidate matches...',
        text_loading_trailer: 'Loading trailer...',
        text_local_mark_cleared: 'Local mark cleared',
        text_manual_title_url: 'Manual title URL',
        text_mapped_by_imdb_enhanced_through_wikidata: 'Mapped by IMDb Enhanced through Wikidata',
        text_mark_loaded_season_seen: 'Mark loaded season seen',
        text_marked_as_no_entry_on_anilist: 'Marked as no entry on AniList',
        text_marked_as_no_entry_on_justwatch: 'Marked as no entry on JustWatch',
        text_marked_as_no_entry_on_letterboxd: 'Marked as no entry on Letterboxd',
        text_marked_as_no_entry_on_metacritic: 'Marked as no entry on Metacritic',
        text_marked_as_no_entry_on_rotten_tomatoes: 'Marked as no entry on Rotten Tomatoes',
        text_message_board: 'Message board',
        text_more_links: 'More links',
        text_more_watch_options: 'More watch options',
        text_movie_sites: 'Movie Sites',
        text_needs_a_tmdb_read_token: 'Needs a TMDB read token',
        text_mdblist_rejected_this_key: 'MDBList rejected this key',
        text_needs_an_mdblist_key: 'Needs an MDBList key',
        text_needs_an_omdb_or_mdblist_key: 'Needs an OMDb or MDBList key',
        text_needs_an_omdb_key: 'Needs an OMDb key',
        text_next_episode: 'Next: $1',
        text_no_cached_entries: 'No cached entries.',
        text_no_candidate_matches_were_found_paste: 'No candidate matches were found. Paste a title URL or mark no entry.',
        text_no_catalog_sites_match_this_filter: 'No catalog sites match this filter.',
        text_no_entry: 'No entry',
        text_no_external_sites: 'no external sites',
        text_no_importable_rows_skipped_one: 'No importable rows found. $1 row was skipped.',
        text_no_importable_rows_skipped_other: 'No importable rows found. $1 rows were skipped.',
        text_no_local_title_marks_yet: 'No local title marks yet. Mark a title Seen or Skip from any card or title page and it shows up here.',
        text_monitored: 'Monitored',
        text_no_matching_title_found: 'No matching title found',
        text_no_titles_on_this_page_to_pick: 'No titles on this page to pick from.',
        text_none_of_count_opened: '0 of $1 opened',
        text_not_available_in_this_build: 'Not available in this build',
        text_not_found: 'Not found',
        text_not_streaming: 'Not streaming',
        text_note_cleared: 'Note cleared',
        text_nothing_left_that_you_have_not_already: 'Nothing left that you have not already marked.',
        text_nothing_was_changed: 'Nothing was changed.',
        text_omdb_rejected_this_key: 'OMDb rejected this key',
        text_open_next_of: 'Open next ($1 of $2)',
        text_open_on_moviechat: 'Open on MovieChat',
        text_trailer_could_not_be_loaded_here: 'The trailer could not be loaded here.',
        text_open_trailer_search_on_youtube: 'Open trailer search on YouTube',
        text_parents_guide: 'Parents guide',
        text_partly_available: 'Partly available',
        text_paste_exported_settings_json: 'Paste exported settings JSON',
        text_physical_release: 'On disc: $1',
        text_pick_something: 'Pick something',
        text_picked_nothing_opened: 'Picked $1. Nothing was opened.',
        text_preview_required_nothing_has_been_changed: 'Preview required. Nothing has been changed.',
        text_processing: 'Processing',
        text_queue_link_meta: '$1 · New tab',
        text_queue_opened_progress: '$1 of $2 opened',
        text_ratings_grid: 'Ratings Grid',
        text_reads_the_published_version_once_a_day: 'Reads the published version once a day. Nothing about you is sent.',
        text_replace_key: 'Replace key',
        text_replace_token: 'Replace token',
        text_requested: 'Requested',
        text_requesting: 'Requesting...',
        text_requesting_title_through: 'Requesting $1 through $2',
        text_reset_preferences_title_marks_and_integration: 'Reset preferences, title marks, and integration credentials',
        text_response_was_too_large_or_empty: 'Response was too large or empty',
        text_restore_a_settings_backup: 'Restore a settings backup',
        text_runtime_complete: '$1 · $2',
        text_runtime_none_listed: '$1 · no runtimes listed',
        text_runtime_partial: '$1 · $2 from $3 · $4 without a listed runtime',
        text_runtime_total: '$1 total',
        text_log_another_viewing: 'Log another viewing, dated today',
        text_save_a_private_local_seen_mark: 'Save a private local Seen mark',
        text_save_a_private_local_skip_mark: 'Save a private local Skip mark',
        text_save_failed: 'Save failed',
        text_save_url: 'Save URL',
        text_saved_anilist_match_unavailable: 'Saved AniList match unavailable',
        text_saved_choice_no_entry_on_this_source: 'Saved choice: no entry on this source.',
        text_saved_justwatch_match_is_invalid: 'Saved JustWatch match is invalid',
        text_saved_justwatch_match_unavailable: 'Saved JustWatch match unavailable',
        text_saved_letterboxd_match_unavailable: 'Saved Letterboxd match unavailable',
        text_saved_locally: 'Saved locally',
        text_saved_mark_count: '$1 saved',
        text_seen_episodes_of_total: 'Seen $1 of $2 episodes',
        text_seen_episodes_one: 'Seen $1 episode',
        text_seen_episodes_other: 'Seen $1 episodes',
        text_saved_metacritic_match_unavailable: 'Saved Metacritic match unavailable',
        text_saved_on_this_device: 'Saved on this device',
        text_saved_rotten_tomatoes_match_unavailable: 'Saved Rotten Tomatoes match unavailable',
        text_saving: 'Saving…',
        text_the_service_asked_for_a_pause: 'That service asked for fewer requests, so it is being left alone for a moment.',
        text_the_source_page_changed: 'That service changed its page, so this cannot be read until it is updated.',
        text_score_unavailable: 'Score unavailable',
        text_scores_availability_and_reference: 'Scores, availability and reference',
        text_search_site_for_title: 'Search $1 for $2',
        text_seen_of_loaded: 'Seen $1/$2 loaded',
        text_server_has_title: '$1: already in library',
        text_server_lacks_title: '$1: not found',
        text_settings_saved: 'Saved',
        text_site_search_queue: '$1 search queue',
        text_skip_titles_i_have_marked: 'Skip titles I have marked',
        text_summary_separator: ' · ',
        text_the_overseerr_instance_did_not_recognize_this: 'The Seerr instance did not recognize this IMDb title',
        text_the_overseerr_instance_returned_an_unusable_title: 'The Seerr instance returned an unusable title id',
        text_the_selected_file_could_not_be: 'The selected file could not be read.',
        text_third_party_board_note: 'Hosted by MovieChat, not by IMDb or by this extension.',
        text_timed_out_waiting_for_page_content: 'Timed out waiting for page content',
        text_title_added_to: '$1 added to $2',
        text_times_count: 'x$1',
        text_title_count_one: '$1 title',
        text_title_count_other: '$1 titles',
        text_title_has_already_been_requested: '$1 has already been requested',
        text_title_has_been_requested_through: '$1 has been requested through $2',
        text_title_is_already_available: '$1 is already available',
        text_average_rating: 'Average rating',
        text_rating_count_one: '$1 rating',
        text_rating_count_other: '$1 ratings',
        aria_has_a_private_local_mark: '$1 has a private local $2 mark; activate to clear',
        text_no_sites: '0 sites',
        text_visible_of_total: '$1/$2 visible',
        label_added: 'Added',
        label_add: 'Add',
        text_cache_entries_remain: '$1 entries remain, using $2 of $3.',
        text_site_access_granted_for: 'Site access granted for $1',
        text_not_working_yet_needs_access_to: 'Not working yet: needs access to $1.',
        text_title_is_already_in_service: '$1 is already in $2',
        text_title_is_being_processed: '$1 is being processed',
        text_title_is_partly_available: '$1 is partly available',
        text_title_poster: '$1 poster',
        text_tmdb_rejected_this_token: 'TMDB rejected this token',
        text_tmdb_their_api_needs_your_token: 'TMDB (their API, needs your token)',
        text_trailer_unavailable: 'Trailer unavailable',
        text_two_items_joined: '$1 and $2',
        text_unavailable: 'Unavailable',
        text_viewings_logged_one: 'Logged. $1 viewing of this title.',
        text_viewings_logged_other: 'Logged. $1 viewings of this title.',
        text_viewings_logged_oldest_dropped_one: 'Logged. This title holds $1 viewing, so the oldest date made room.',
        text_viewings_logged_oldest_dropped_other: 'Logged. This title holds $1 viewings, so the oldest date made room.',
        text_undo_the_last_settings_reset: 'Undo the last settings reset',
        text_undone: 'Undone.',
        text_unweighted_same_as_displayed: 'Unweighted $1, the same as the displayed rating.',
        text_unweighted_weighting_sits: 'Unweighted $1 · IMDb’s weighting sits $2 $3 it.',
        text_update_available: 'IMDb Enhanced $1 is available. This build is $2.',
        text_use_a_valid_title_url: 'Use a valid $1 title URL.',
        text_use_automatic: 'Use automatic',
        text_user_reviews: 'User reviews',
        text_user_score: 'User: $1',
        text_uses_light_for_os_light_mode_and: 'Uses Light for OS light mode and Dark for OS dark mode.',
        text_view_full_cast_crew: 'View full cast & crew',
        text_was_about_age: '(was ~$1)',
        text_watch_order: 'Watch order',
        text_shape_divisive_even: 'Divided: $1% of votes sit at the two ends of the scale, split evenly between them.',
        text_shape_divisive: 'Divided: $1% of votes sit at the two ends of the scale, mostly $2.',
        text_shape_reverse_j: 'Unusual shape: $1% of votes sit at the two ends, mostly $2, which is what a rating campaign looks like.',
        text_shape_leaning_low: 'at the bottom',
        text_shape_leaning_high: 'at the top',
        text_without_the_extremes: 'Without 1s and 10s: $1 (derived)',
        toast_a_site_list_can_contain_up: 'A site list can contain up to $1 destinations',
        toast_already_logged_a_viewing_today: 'A viewing today is already logged for this title',
        toast_all_imdb_watched_on_this_page_one: 'All $1 IMDb Watched title on this page already has a local mark',
        toast_all_imdb_watched_on_this_page_other: 'All $1 IMDb Watched titles on this page already have a local mark',
        toast_allow_notifications_there: 'Allow notifications on the page that just opened.',
        toast_cache_could_not_be_read_or: 'Cache could not be read or cleared.',
        toast_cache_is_already_empty: 'Cache is already empty',
        toast_cleared_cached_entries_could_not_be: 'Cleared $1 cached entries; $2 could not be removed.',
        toast_cleared_cached_entries_reload_to_re: 'Cleared $1 cached entries. Reload to re-fetch.',
        toast_cleared_saved_title_marks_one: 'Cleared $1 saved title mark. Undo is in the marks panel.',
        toast_cleared_saved_title_marks_other: 'Cleared $1 saved title marks. Undo is in the marks panel.',
        toast_copied_imdb_ids: 'Copied $1 IMDb IDs',
        toast_copied_search_links: 'Copied $1 search links',
        toast_copy_failed_try_the_individual_links: 'Copy failed. Try the individual links instead.',
        toast_could_not_refresh_reload_and_try: '$1 could not refresh. Reload and try again.',
        toast_could_not_save_locally_check_permissions: 'Could not save locally. Check $1 permissions or quota.',
        toast_could_not_save_the_theme_previous: 'Could not save the theme. Previous settings were restored.',
        toast_could_not_start_on_this_page: '$1 could not start on this page. Settings → Data has a diagnostics report.',
        toast_could_not_start_reload_and_try: '$1 could not start. Reload and try again.',
        toast_credentials_must_be_at_most_4: 'Credentials must be at most 4,096 characters without control characters',
        toast_current_settings_could_not_be_read: 'Current settings could not be read, so nothing was reset: $1',
        toast_destination_added_to_list: '$1 added to $2',
        toast_destination_removed_from_list: '$1 removed from $2',
        toast_encrypted_backup_copied_keep_the_passphrase: 'Encrypted backup copied. Keep the passphrase; it cannot be recovered.',
        toast_enter_a_name_valid_http_s: 'Enter a name, valid HTTP(S) URL, category, and supported template tokens',
        toast_episode_synopsis_revealed: 'Episode synopsis revealed',
        toast_failure_journal_cleared: 'Failure journal cleared',
        text_season_marked_one: 'Marked $1 loaded episode.',
        text_season_marked_other: 'Marked $1 loaded episodes.',
        text_season_cleared_one: 'Cleared $1 loaded episode.',
        text_season_cleared_other: 'Cleared $1 loaded episodes.',
        text_season_marked_evicted_one: 'Marked $1 loaded episode; $2 of your oldest marks were pushed out by the $3-mark limit.',
        text_season_marked_evicted_other: 'Marked $1 loaded episodes; $2 of your oldest marks were pushed out by the $3-mark limit.',
        text_season_cleared_evicted_one: 'Cleared $1 loaded episode; $2 of your oldest marks were pushed out by the $3-mark limit.',
        text_season_cleared_evicted_other: 'Cleared $1 loaded episodes; $2 of your oldest marks were pushed out by the $3-mark limit.',
        toast_season_marked_one: 'Marked $1 loaded episode seen. Undo is in the season bar.',
        toast_season_marked_other: 'Marked $1 loaded episodes seen. Undo is in the season bar.',
        toast_season_cleared_one: 'Cleared $1 loaded episode. Undo is in the season bar.',
        toast_season_cleared_other: 'Cleared $1 loaded episodes. Undo is in the season bar.',
        toast_copied_subtitle_links_one: 'Copied subtitle links for $1 loaded episode',
        toast_copied_subtitle_links_other: 'Copied subtitle links for $1 loaded episodes',
        toast_copied_value: 'Copied $1',
        toast_could_not_save_destination: 'Could not save $1. Check $2.',
        toast_finish_or_remove_the_incomplete_site_3: 'Finish or remove the incomplete site row before adding $1',
        toast_finish_or_remove_the_incomplete_site: 'Finish or remove the incomplete site row before changing the order',
        toast_finish_or_remove_the_incomplete_site_2: 'Finish or remove the incomplete site row before changing the list',
        toast_grant_then_reload: 'Grant site access on the page that just opened, then reload this one.',
        toast_grant_then_return: 'Grant site access on the page that just opened, then return here.',
        toast_imdb_watchlist_controls_are_unavailable_on: 'IMDb watchlist controls are unavailable on this title surface',
        toast_import_is_too_large_use_a: 'That backup is $1, and the most this can read is $2. Nothing was changed.',
        toast_imported_keeping_existing_one: 'Imported $2 as local Seen; kept $1 existing mark',
        toast_imported_keeping_existing_other: 'Imported $2 as local Seen; kept $1 existing marks',
        toast_imported_local_titles_from_csv_rows: 'Imported $1 local titles from $2 CSV rows.$3 Reloading...',
        toast_imported_settings_reloading: 'Imported $1 settings$2. Reloading...',
        toast_imported_watched_titles_one: 'Imported $1 IMDb Watched title as local Seen',
        toast_imported_watched_titles_other: 'Imported $1 IMDb Watched titles as local Seen',
        toast_is_full_so_lookups_are_not: '$1 is full, so lookups are not being cached. Settings → Data → Clear cache frees it.',
        toast_marks_copied: '$1: $2 titles copied',
        toast_no_episodes_are_loaded_to_export: 'No episodes are loaded to export',
        toast_no_rows_are_loaded_to_export: 'No rows are loaded to export yet.',
        toast_copied_rows_as_csv_one: 'Copied $1 row as CSV.',
        toast_copied_rows_as_csv_other: 'Copied $1 rows as CSV.',
        toast_copied_rows_some_unrated_one: 'Copied $1 row as CSV. $2 had no rating listed.',
        toast_copied_rows_some_unrated_other: 'Copied $1 rows as CSV. $2 had no rating listed.',
        toast_no_imdb_title_ids_found: 'No IMDb title IDs found',
        toast_no_imdb_watched_titles_found_on: 'No IMDb Watched titles found on this page. Sign in and open a list, chart, or title that shows the Watched control.',
        toast_no_marks_to_export: 'There are no marks to export yet.',
        toast_no_titles_found_on_this_page: 'No titles found on this page',
        toast_paste_settings_json_before_importing: 'Paste settings JSON before importing',
        toast_plot_synopsis_revealed: 'Plot synopsis revealed',
        toast_preview_the_csv_before_importing: 'Preview the CSV before importing.',
        toast_reset_settings_reloading: 'Reset $1 settings. Reloading...',
        toast_reset_settings_use_the_manager_menu: 'Reset $1 settings. Use the manager menu\'s Undo command to put them back.',
        toast_reset_to_defaults: '$1 reset to defaults',
        toast_saved_locally_as_seen: 'Saved locally as Seen. IMDb Watched was not changed.',
        toast_saved_locally_as_skip: 'Saved locally as Skip. IMDb Watched was not changed.',
        toast_season_marks_restored: 'Season marks restored',
        toast_sent_to_your_imdb_watchlist: 'Sent to your IMDb watchlist',
        toast_service_action_failed: '$1 $2 failed: $3',
        toast_settings_copied_omitting_one: 'Settings copied. $1 integration credential was left out. Use Export with credentials to include it.',
        toast_settings_copied_omitting_other: 'Settings copied. $1 integration credentials were left out. Use Export with credentials to include them.',
        toast_settings_could_not_be_read_for: 'Settings could not be read for export. No backup was copied.',
        toast_settings_exceed_the_4_mb_backup: 'These settings are $1, past the $2 a backup can hold. Remove stale title marks or oversized destinations first.',
        toast_settings_exceed_the_4_mb_backup_2: 'These settings are $1, past the $2 a backup can hold. Remove stale title marks first.',
        toast_the_journal_could_not_be_cleared: 'The journal could not be cleared. Check $1.',
        toast_the_match_correction_was_not_saved: 'The match correction was not saved. The previous match has been restored.',
        toast_the_two_passphrases_do_not_match: 'The two passphrases do not match.',
        toast_marks_put_back_one: 'Undone. $1 title mark was put back.',
        toast_marks_put_back_other: 'Undone. $1 title marks were put back.',
        toast_that_undo_is_no_longer_available: 'That undo is no longer available.',
        toast_there_is_no_reset_to_undo: 'There is no reset to undo.',
        toast_title_requested_through: '$1 requested through $2',
        toast_title_sent_to: '$1 sent to $2',
        toast_undone_settings_were_put_back_reloading: 'Undone. $1 settings were put back. Reloading...',
        toast_use_a_localhost_or_127_0: 'Use a localhost or 127.0.0.1 HTTP(S) URL without embedded credentials',
        toast_use_a_positive_whole_number_profile: 'Use a positive whole-number profile ID',
        toast_your_integration_keys_are_not_readable: 'Your integration keys are not readable from an IMDb page, so this backup would be empty. Make it from the extension\'s own page instead.',
        toast_your_seen_and_skip_marks_were: 'Your Seen and Skip marks were not saved. $1 may be full. Settings, then Data, then Clear cache frees space.',
    });

    /* getMessage answers '' for a key the active locale does not carry, and Chrome has
       already tried default_locale by then. Falling through to the embedded catalog makes
       the last step deterministic in both builds and in the tests, which have no i18n at
       all. A key that exists nowhere returns its own name rather than an empty string: a
       blank control is a bug that hides, a visible key is a bug that reports itself. */
    function applyMessageSubstitutions(template, values) {
        return String(template).replace(/\$(\$|[1-9])/g, (match, token) => {
            if (token === '$') return '$';
            const value = values[Number(token) - 1];
            return value === undefined ? match : String(value);
        });
    }

    function t(key, substitutions) {
        const values = substitutions === undefined
            ? []
            : (Array.isArray(substitutions) ? substitutions : [substitutions]);
        if (IS_EXTENSION_BUILD && typeof chrome !== 'undefined' && typeof chrome.i18n?.getMessage === 'function') {
            try {
                const translated = chrome.i18n.getMessage(key, values.map(value => String(value)));
                if (translated) return translated;
            } catch { /* fall through to the catalog this build embeds */ }
        }
        const template = Object.prototype.hasOwnProperty.call(MESSAGES, key) ? MESSAGES[key] : null;
        if (template === null) return key;
        return applyMessageSubstitutions(template, values);
    }

    /* chrome.i18n has no plural rules, so a count-dependent message is two keys and the
       choice is made here. English needs only one and other; a locale that needs more
       forms adds them to its own file and this picks the closest it has. */
    function tCount(baseKey, count, substitutions) {
        const suffix = Math.abs(Number(count)) === 1 ? '_one' : '_other';
        const values = substitutions === undefined
            ? [count]
            : [count, ...(Array.isArray(substitutions) ? substitutions : [substitutions])];
        return t(baseKey + suffix, values);
    }

    const STORAGE_HOST_LABEL = IS_EXTENSION_BUILD ? 'extension storage' : 'userscript storage';
    const COPY_FAILURE_MESSAGE = t('error_copy_failed');
    const VERSION = '2.20.0';
    const PREFIX  = 'imdb_enh_';
    const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days — default for volatile score data
    /* Envelope ceiling, not the default. Stable cross-site identifiers are cached far
       longer than scores; validating them against CACHE_TTL silently discarded every
       successful Wikidata mapping on the first read back. */
    const CACHE_MAX_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
    const CACHE_UNAVAILABLE_TTL = 24 * 60 * 60 * 1000; // 24 hours
    const CACHE_SCHEMA_VERSION = 3;
    const CACHE_MAX_ENTRIES = 120;
    const CACHE_GC_WRITE_INTERVAL = 10;
    const CACHE_ENTRY_TEXT_LIMIT = 256 * 1024;
    /* 120 entries at 256 KiB each permits ~30 MiB, while chrome.storage.local defaults
       to 10 MiB for the whole extension — settings, marks and credentials included. The
       entry count alone therefore never binds before the quota does, so the cache also
       carries an aggregate ceiling well under that default and evicts to stay beneath
       it. Measured in encoded UTF-8 bytes: a JS string's .length counts UTF-16 code
       units, which undercounts every non-ASCII title. */
    const CACHE_TOTAL_BYTE_BUDGET = 6 * 1024 * 1024;
    /* Eviction is by last access, so a read has to record one. Writing on every read
       would cost a storage round trip per cache hit, so the stamp is refreshed only
       once an hour — precise enough to order eviction candidates, cheap enough to sit
       on the read path. */
    const CACHE_ACCESS_STAMP_INTERVAL = 60 * 60 * 1000;
    const USER_MARKS_MAX = 5000;
    const USER_MARKS_SCAN_LIMIT = USER_MARKS_MAX * 2;
    const USER_MARK_TITLE_LIMIT = 160;
    const USER_MARK_VIEWINGS_MAX = 100;
    const USER_MARK_GENRES_MAX = 12;
    const USER_MARK_GENRE_TEXT_LIMIT = 40;
    const LOCAL_STATS_GROUP_LIMIT = 8;
    const SCORE_CORRECTION_VERSION = 1;
    const SCORE_CORRECTION_TITLE_LIMIT = 1000;
    const SCORE_CORRECTION_SCAN_LIMIT = SCORE_CORRECTION_TITLE_LIMIT * 2;
    const SCORE_CORRECTION_CANDIDATE_LIMIT = 5;
    const SCORE_CORRECTION_URL_LIMIT = 512;
    /* Bounded like every other stored string, and counted against the same 5,000-record
       ceiling as the marks themselves — a note lives inside its title's mark record. */
    const USER_MARK_NOTE_LIMIT = 500;
    const LOCAL_LOOKUP_RESULT_LIMIT = 100;
    const LOCAL_PROVIDER_ID_LIMIT = 32;
    const LOOKUP_TITLE_TEXT_LIMIT = 500;
    const PROVIDER_ID_TEXT_LIMIT = 256;
    const SERVARR_SEASON_LIMIT = 500;
    const REQUEST_ERROR_TEXT_LIMIT = 240;
    const EXTERNAL_RESULT_SCAN_LIMIT = 100;
    const STRUCTURED_DATA_SCRIPT_LIMIT = 50;
    const STRUCTURED_DATA_NODE_LIMIT = 1000;
    const STRUCTURED_DATA_TYPE_LIMIT = 20;
    const STRUCTURED_DATA_CLASSIFICATION_ITEM_LIMIT = 50;
    const STRUCTURED_DATA_CLASSIFICATION_TEXT_LIMIT = 2000;
    const TITLE_YEAR_RELEASE_EVENT_LIMIT = 50;
    const TITLE_YEAR_INLINE_LIMIT = 100;
    const EXTERNAL_STRUCTURED_DATA_NODE_LIMIT = 100;
    const STRUCTURED_DATA_TEXT_LIMIT = 2 * 1024 * 1024;
    const EXTERNAL_RESPONSE_TEXT_LIMIT = 8 * 1024 * 1024;
    const LOCAL_RESPONSE_TEXT_LIMIT = 4 * 1024 * 1024;
    /* Large enough that every FMHY catalog destination can be added at once;
       still a hard bound on storage, import, and editor render work. */
    const SITE_LIST_LIMIT = 250;
    const SITE_EDITOR_SAVE_DELAY = 250; // trailing debounce for typed destination edits
    const COLLECTION_LINK_SCAN_LIMIT = 5000;
    const LIST_SEARCH_TITLE_LIMIT = 20;
    const URL_TEMPLATE_TEXT_LIMIT = 4096;
    const SETTING_TEXT_LIMIT = 4096;
    /* The importer has to accept anything the exporter can write, or a large library backs
       up cleanly and cannot be restored. A hand-typed 4 MiB stopped covering that the day
       a mark record grew a note and a hundred viewing dates: a full store serialises to
       roughly eighteen megabytes, so every backup of one was refused at restore time, with
       nothing to say the file was fine and the ceiling was not. The CSV path was bitten by
       the same thing on 2026-09-01 and its bounds are derived for the same reason.

       Worst case per mark: the id, the state, two timestamps and the JSON punctuation
       around them, a title and a note at their own limits, and a full viewing history at
       roughly forty bytes a date. Per destination: a name and a URL template at theirs.
       These are ceilings rather than estimates, and the export is pretty-printed, hence
       the indentation allowance. */
    const USER_MARK_JSON_BYTES_MAX = 256
        + USER_MARK_TITLE_LIMIT + USER_MARK_NOTE_LIMIT + (USER_MARK_VIEWINGS_MAX * 64);
    const SITE_JSON_BYTES_MAX = 256 + SETTING_TEXT_LIMIT + URL_TEMPLATE_TEXT_LIMIT;
    /* Two site lists, watch and external, plus room for every other preference, the
       credential fields an export with credentials carries, and the envelope itself. */
    const SETTINGS_IMPORT_TEXT_LIMIT = (USER_MARKS_MAX * USER_MARK_JSON_BYTES_MAX)
        + (2 * SITE_LIST_LIMIT * SITE_JSON_BYTES_MAX)
        + (1024 * 1024);
    /* Big enough that a file this extension wrote always reads back. The export is a row
       per viewing, so the worst case is every one of the 5,000 marks carrying its full
       hundred dates, and a ten-thousand-row ceiling silently dropped a third of a large
       library on restore while reporting the import a success. */
    const CSV_IMPORT_ROW_LIMIT = USER_MARKS_MAX * USER_MARK_VIEWINGS_MAX;
    /* And a size to match. A marks CSV is not a settings backup and does not belong under
       the same 4 MiB ceiling: at that size the row cap above could never be reached,
       every full library was refused outright, and the guard read as a bug. A maximal
       export with ordinary titles measures about 26 MB, so this covers one with room
       for long titles and notes. */
    const CSV_IMPORT_TEXT_MB = 48;
    const CSV_IMPORT_TEXT_LIMIT = CSV_IMPORT_TEXT_MB * 1024 * 1024;
    const SITE_CATEGORY_OPTIONS = [
        { key:'watch', label:t('category_watch'), description:t('category_watch_detail') },
        { key:'reviews', label:t('category_reviews'), description:t('category_reviews_detail') },
        { key:'availability', label:t('category_availability'), description:t('category_availability_detail') },
        { key:'trailers', label:t('category_trailers'), description:t('category_trailers_detail') },
        { key:'info', label:t('category_info'), description:t('category_info_detail') },
        { key:'other', label:t('category_other'), description:t('category_other_detail') },
    ];
    const SITE_CATEGORY_KEYS = new Set(SITE_CATEGORY_OPTIONS.map(option => option.key));
    const SITE_CATEGORY_LABELS = Object.fromEntries(SITE_CATEGORY_OPTIONS.map(option => [option.key, option.label]));
    const URL_TEMPLATE_KEYS = new Set([
        'TITLE', 'TITLE_RAW', 'TITLE_DASH', 'TITLE_SLUG',
        'IMDB_ID', 'IMDB_NUM', 'TRAKT_TYPE', 'YEAR',
    ]);
    /* Which origins each feature actually needs, and nothing more. The extension used to
       demand every score, availability, ad, video and loopback origin at install even
       when the feature was switched off, so the install prompt described a far broader
       reach than the product had. Only IMDb is required now; everything here is optional
       and requested from the click that enables the feature.

       This is also the manifest's source of truth — scripts/build-extension.js derives
       optional_host_permissions from it, so the two cannot drift. A second hand-written
       list is exactly how enumerated scope rots.

       Wikidata appears under each score source because it is the shared identity
       resolver those lookups go through before touching the service itself. */
    const LOOPBACK_ORIGINS = [
        'http://localhost/*', 'https://localhost/*',
        'http://127.0.0.1/*', 'https://127.0.0.1/*',
    ];
    const WIKIDATA_ORIGIN = 'https://query.wikidata.org/*';
    /* One declaration per provider, and everything about that provider is derived from
       it. Its origins, how long its answers may be cached, what leaves the browser to
       reach it, the sentence the settings panel shows, the credit it requires, and the
       builds it may ship in used to live in four separate places: this map, the build's
       origin reader, the Firefox data-collection block, and prose in the settings panel.
       They drifted, and nothing failed when they did. `transmits` is the vocabulary
       Firefox's data_collection_permissions uses, because that declaration is generated
       from these rather than written alongside them. */
    const DISTRIBUTION_PROFILES = ['default', 'store'];
    const PROVIDER_REQUIRED_FIELDS = ['label', 'origins', 'transmits', 'consent', 'ttl', 'attribution', 'profiles'];
    const PROVIDERS = {
        rottenTomatoes: {
            label: 'Rotten Tomatoes',
            origins: ['https://www.rottentomatoes.com/*'],
            transmits: 'websiteContent',
            consent: t('provider_rottenTomatoes_consent'),
            ttl: CACHE_TTL,
            attribution: '',
            // Answers come from parsing their pages, which a store listing should not do.
            profiles: ['default'],
        },
        metacritic: {
            label: 'Metacritic',
            origins: ['https://backend.metacritic.com/*'],
            transmits: 'websiteContent',
            consent: t('provider_metacritic_consent'),
            ttl: CACHE_TTL,
            attribution: '',
            profiles: ['default'],
        },
        letterboxd: {
            label: 'Letterboxd',
            origins: ['https://letterboxd.com/*'],
            transmits: 'websiteContent',
            consent: t('provider_letterboxd_consent'),
            ttl: CACHE_TTL,
            attribution: '',
            profiles: ['default'],
        },
        justWatch: {
            label: 'JustWatch',
            origins: ['https://www.justwatch.com/*'],
            transmits: 'websiteContent',
            consent: t('provider_justWatch_consent'),
            ttl: CACHE_TTL,
            attribution: '',
            profiles: ['default'],
        },
        tmdb: {
            label: 'TMDB',
            origins: ['https://api.themoviedb.org/*'],
            // Only the IMDb id of the page you are on, not the title text.
            transmits: 'websiteContent',
            consent: t('provider_tmdb_consent'),
            ttl: CACHE_TTL,
            /* Both are required and both are theirs, not a courtesy. TMDB's API terms
               mandate the endorsement disclaimer verbatim, and the watch-provider
               endpoint separately requires the data be attributed to JustWatch, on pain
               of access being revoked. Rendered wherever this data is shown. */
            attribution: t('provider_tmdb_attribution'),
            // An API with a key, rather than page parsing, so a store listing can ship it.
            profiles: ['default', 'store'],
        },
        omdb: {
            label: 'OMDb',
            origins: ['https://www.omdbapi.com/*'],
            // The IMDb id of the page you are on, nothing read from the page itself.
            transmits: 'websiteContent',
            consent: t('provider_omdb_consent'),
            ttl: CACHE_TTL,
            // OMDb publishes its data under CC BY-NC 4.0, which requires the credit.
            attribution: t('provider_omdb_attribution'),
            // A documented API with a key of your own, so a store listing can ship it.
            profiles: ['default', 'store'],
        },
        /* One call answers Rotten Tomatoes, Metacritic and Letterboxd together, which is
           the only route to a Letterboxd score in a build that ships no page readers.
           Their ratings array names its own sources and omits the ones it has nothing
           for, so it is read by name like OMDb's. */
        mdblist: {
            label: 'MDBList',
            origins: ['https://api.mdblist.com/*'],
            // The IMDb id of the page you are on, nothing read from the page itself.
            transmits: 'websiteContent',
            consent: t('provider_mdblist_consent'),
            ttl: CACHE_TTL,
            attribution: t('provider_mdblist_attribution'),
            // A documented API with a key of your own, so a store listing can ship it.
            profiles: ['default', 'store'],
        },
        anilist: {
            label: 'AniList',
            origins: ['https://graphql.anilist.co/*'],
            // The title and year read from the page, which is what the search takes.
            transmits: 'websiteContent',
            consent: t('provider_anilist_consent'),
            ttl: CACHE_TTL,
            attribution: '',
            // A documented public API with no key and no page parsing, so a store listing can ship it.
            profiles: ['default', 'store'],
        },
        tvmaze: {
            label: 'TVmaze',
            origins: ['https://api.tvmaze.com/*'],
            // Only the IMDb id of the page you are on: their lookup takes it directly.
            transmits: 'websiteContent',
            consent: t('provider_tvmaze_consent'),
            ttl: CACHE_TTL,
            /* Their data is CC BY-SA and the credit is a condition of using it, satisfied
               by linking back with the URL their own answer carries. */
            attribution: t('provider_tvmaze_attribution'),
            // Keyless, documented, and no page parsing, so a store listing can ship it.
            profiles: ['default', 'store'],
        },
        youTube: {
            label: 'YouTube',
            origins: ['https://www.youtube.com/*'],
            transmits: 'websiteContent',
            consent: t('provider_youTube_consent'),
            ttl: CACHE_TTL,
            attribution: '',
            profiles: ['default', 'store'],
        },
        wikidata: {
            label: 'Wikidata',
            origins: [WIKIDATA_ORIGIN],
            transmits: 'websiteContent',
            consent: t('provider_wikidata_consent'),
            /* An identifier mapping does not go stale the way a score does, and validating
               one against the score TTL threw away every successful mapping on first read. */
            ttl: CACHE_MAX_TTL,
            attribution: '',
            profiles: ['default', 'store'],
            /* A resolver, not a source. It turns an IMDb id into another site's id and
               makes three lookups faster and more certain, but every one of them works
               without it. So losing Wikidata does not make a feature unavailable, while
               losing the site whose score is being shown does. */
            auxiliary: true,
        },
        amazonAds: {
            /* Phrased as what the access is for. "Amazon advertising and tracking" is an
               accurate name for the hosts and a misleading one in the only sentence it
               appears in, which reads "needs access to ...". */
            label: t('provider_amazonAds_label'),
            origins: [
                'https://*.amazon-adsystem.com/*', 'https://advertising.amazon.dev/*',
                'https://images-na.ssl-images-amazon.com/*', 'https://sb.scorecardresearch.com/*',
                'https://fls-na.amazon.com/*', 'https://unagi.amazon.com/*', 'https://unagi-na.amazon.com/*',
            ],
            // Access is held to block these, never to call them: nothing is ever sent.
            transmits: 'none',
            consent: t('provider_amazonAds_consent'),
            ttl: 0,
            attribution: '',
            profiles: ['default', 'store'],
        },
        localServices: {
            label: t('provider_localServices_label'),
            origins: LOOPBACK_ORIGINS,
            transmits: 'none',
            consent: t('provider_localServices_consent'),
            ttl: 0,
            attribution: '',
            profiles: ['default', 'store'],
        },
        /* The one host contacted by something other than a feature. An unpacked extension
           cannot update itself, so once a day the worker reads the published userscript's
           metadata block to find out whether a newer version exists, and the panel says so.
           Nothing is sent: it is a GET of a public file, and only the @version line of the
           answer is read.

           It names no feature, so it contributes no host permission and none is needed —
           GitHub answers a service worker's request without one. It is declared because
           every host this extension reaches has to be readable in one place, and because
           the check below refuses to build a worker that fetches a host nothing here
           names. Turning off the update notice stops the request. */
        githubUpdate: {
            label: 'GitHub',
            origins: ['https://raw.githubusercontent.com/*'],
            transmits: 'none',
            consent: t('provider_githubUpdate_consent'),
            ttl: 0,
            attribution: '',
            profiles: ['default', 'store'],
            auxiliary: true,
        },
    };
    const FEATURE_PROVIDERS = {
        /* OMDb answers the same two questions from an API. It is declared here so a
           build that cannot ship the page parser still has a source, and so an install
           that configures a key can fall back to it; activeProvidersFor keeps it out of
           the way of an install that has neither. */
        inlineRTScore: ['rottenTomatoes', 'omdb', 'mdblist', 'wikidata'],
        inlineMetacriticScore: ['metacritic', 'omdb', 'mdblist', 'wikidata'],
        inlineLetterboxdScore: ['letterboxd', 'mdblist', 'wikidata'],
        inlineAnimeScore: ['anilist'],
        collectionPanel: ['wikidata'],
        castAges: ['wikidata'],
        /* Both are declared so either can be granted, but only the chosen source is ever
           contacted; activeProvidersFor narrows this to what is actually in play. */
        streamAvailability: ['justWatch', 'tmdb'],
        airsOn: ['tvmaze'],
        trailerPopover: ['youTube'],
        removeAds: ['amazonAds'],
        servarrIntegration: ['localServices'],
        mediaServerIntegration: ['localServices'],
        rowIntegrationState: ['localServices'],
    };
    /* Kept under its original name because every caller already reads it, but it is now
       a projection of the map above rather than a second list to maintain. */
    const FEATURE_ORIGIN_GROUPS = Object.fromEntries(
        Object.entries(FEATURE_PROVIDERS).map(([feature, providers]) =>
            [feature, [...new Set(providers.flatMap(id => PROVIDERS[id]?.origins || []))]])
    );
    /* IMDb's own mobile host is required rather than optional: the redirect that sends a
       desktop browser from it to the desktop site has to run there, and asking for
       permission to leave a page nobody chose would be a strange thing to prompt for. */
    const REQUIRED_ORIGINS = ['https://www.imdb.com/*', 'https://m.imdb.com/*'];
    const OPTIONAL_ORIGINS = [...new Set(Object.values(FEATURE_ORIGIN_GROUPS).flat())].sort();
    /* What the Firefox manifest must declare. A provider that only has access so its
       requests can be blocked transmits nothing, so it contributes no category. */
    const TRANSMITTED_DATA_CATEGORIES = [...new Set(
        Object.values(PROVIDERS).map(provider => provider.transmits).filter(category => category !== 'none')
    )].sort();

    const AD_SHELL_SELECTOR = [
        '.nas-slot',
        '.slot_wrapper',
        '[id^="div-gpt-ad-"]',
        '[id^="ape_"][id$="_placement"]',
        '[aria-label="Bottom Sponsored Advertisement"]',
        'iframe[aria-label="Sponsored Content"]',
        '.sponsored_label',
        '.sponsored-content',
        '#promoted-partner-bar',
        '#sis_pixel_sitewide',
        '#cookie_sync_pixel_sitewide',
        'iframe[src*="amazon-adsystem.com/iu3"]',
        'iframe[src*="amazon-adsystem.com/iui3"]',
    ].join(',');
    const AD_REQUEST_RULES = [{
        selector: {
            include: [
                '*://*.amazon-adsystem.com/*',
                '*://*.advertising.amazon.dev/*',
                '*://images-na.ssl-images-amazon.com/images/S/sash/*.html*',
                '*://sb.scorecardresearch.com/*',
                '*://fls-na.amazon.com/*',
                '*://unagi.amazon.com/*',
                '*://unagi-na.amazon.com/*',
            ],
        },
        action: 'cancel',
    }];
    const TITLE_STACK_ORDER = {
        quickCopyID: 10,
        searchButtons: 20,
        externalLinks: 30,
        expandedLinkMenu: 31,
        trailerPopover: 32,
        servarrIntegration: 35,
        mediaServerIntegration: 36,
        titleNotes: 37,
        tvShowEnhancements: 40,
    };
    /* Every default below was exercised in a browser with a film and a TV title during
       the v2.19.0 release pass (2026-09-01). A successful homepage status does not count:
       each URL has to prefill the title or render matching results. */
    const DEFAULT_WATCH_SITES = [
        { name:'BBC iPlayer', color:'#ff4c98', url:'https://www.bbc.co.uk/iplayer/search?q={{TITLE}}', category:'watch' },
        { name:'Hexa', color:'#8b5cf6', url:'https://hexa.su/search?q={{TITLE}}', category:'watch' },
        { name:'ARTE', color:'#fa481c', url:'https://www.arte.tv/en/search/?q={{TITLE}}', category:'watch' },
        { name:'ShuttleTV', color:'#ef4444', url:'https://shuttletv.su/search?q={{TITLE}}', category:'watch' },
        { name:'ArrowTV', color:'#22c55e', url:'https://arrowtv.net/search?q={{TITLE}}', category:'watch' },
        { name:'Cinezo', color:'#06b6d4', url:'https://www.cinezo.org/search?q={{TITLE}}', category:'watch' },
        { name:'Movie Night', color:'#ec4899', url:'https://movienig.ht/search?q={{TITLE}}', category:'watch' },
        { name:'MeowTV', color:'#fb7185', url:'https://meowtv.ru/search?q={{TITLE}}', category:'watch' },
        { name:'Chillflix', color:'#0ea5e9', url:'https://www.chillflix.lol/search?q={{TITLE}}', category:'watch' },
        { name:'MovieBite', color:'#e11d48', url:'https://moviebite.org/search?q={{TITLE}}', category:'watch' },
        { name:'LatestMovies', color:'#14b8a6', url:'https://latestmovies.net/search?q={{TITLE}}', category:'watch' },
        { name:'Plex', color:'#e5a00d', url:'https://watch.plex.tv/search?query={{TITLE}}', category:'watch' },
        { name:'Tubi', color:'#fa382f', url:'https://tubitv.com/search/{{TITLE}}', category:'watch' },
        { name:'Fandango at Home', color:'#4f8cff', url:'https://athome.fandango.com/content/browse/search?searchString={{TITLE}}', category:'watch' },
        { name:'hoopla', color:'#2f7ed8', url:'https://www.hoopladigital.com/search?q={{TITLE}}&scope=everything&type=direct', category:'watch' },
    ];
    const DEFAULT_EXTERNAL_SITES = [
        { name:'Rotten Tomatoes', color:'#fa320a', url:'https://www.rottentomatoes.com/search?search={{TITLE}}', category:'reviews' },
        { name:'Letterboxd', color:'#00d735', url:'https://letterboxd.com/imdb/{{IMDB_ID}}/', category:'reviews', movieOnly:true },
        { name:'TMDB', color:'#01b4e4', url:'https://www.themoviedb.org/search?query={{TITLE}}', category:'info' },
        { name:'YouTube', color:'#ff0000', url:'https://www.youtube.com/results?search_query={{TITLE}}%20trailer', category:'trailers' },
        { name:'Wikipedia', color:'#636466', url:'https://en.wikipedia.org/w/index.php?search={{TITLE}}+{{YEAR}}', category:'info' },
        { name:'JustWatch', color:'#fbc500', url:'https://www.justwatch.com/us/search?q={{TITLE}}', category:'availability' },
        { name:'Trakt', color:'#ed1c24', url:'https://app.trakt.tv/search?query={{TITLE}}', category:'reviews' },
    ];
    /* Every streaming destination from the FMHY video wiki
       (reddit.com/r/FREEMEDIAHECKYEAH/wiki/video, snapshot 2026-08-31), one entry per
       distinct site using its primary URL. Mirrors, desktop apps, CLI tools, and
       Discord-only entries are omitted; Cineby is omitted because it announced its
       shutdown for the end of August 2026. The wiki does not publish search routes.
       Verified templates are stored where a site supports one; homepage-only entries
       stay browse links in Settings and cannot become misleading search buttons. */
    const FMHY_WATCH_CATALOG = [
        { group:'Stream aggregators', sites:[
            { name:'Rive', url:'https://www.rivestream.app/' },
            { name:'CorsFlix', url:'https://watch.corsflix.net/' },
            { name:'Cinejoy', url:'https://cinejoy.to/' },
            { name:'PopcornMovies', url:'https://popcornmovies.ac/' },
            { name:'BingeBox', url:'https://bingebox.ac/' },
            { name:'Movy', url:'https://www.movy.bz/' },
            /* Two entries FMHY lists here are omitted: both redirect onto the retired
               domain the schema-3 migration scrubs, so offering them would hand people a
               destination this build has already removed. */
            { name:'Flixer', url:'https://flixer.gd/' },
            { name:'Hexa', url:'https://hexa.su/search?q={{TITLE}}' },
            { name:'67Movies', url:'https://67movies.nl/' },
            { name:'PhantomFlix', url:'https://phantomflix.net/' },
            { name:'bCine', url:'https://bcine.ru/' },
            { name:'Reelix', url:'https://reelix.ac/' },
            { name:'Coreflix', url:'https://coreflix.tv/' },
            { name:'MeowTV', url:'https://meowtv.ru/search?q={{TITLE}}' },
            { name:'FlickyStream', url:'https://flickystream.dad/' },
            { name:'ShuttleTV', url:'https://shuttletv.su/search?q={{TITLE}}' },
            { name:'TouStream', url:'https://toustream.xyz/' },
            { name:'7Movies', url:'https://7movies.in/' },
            { name:'ArrowTV', url:'https://arrowtv.net/search?q={{TITLE}}' },
            { name:'Cinezo', url:'https://www.cinezo.org/search?q={{TITLE}}' },
            { name:'Movie Night', url:'https://movienig.ht/search?q={{TITLE}}' },
            { name:'Chillflix', url:'https://www.chillflix.lol/search?q={{TITLE}}' },
            { name:'Vivarium', url:'https://vivarium.wtf/' },
            { name:'Moovie', url:'https://moovie.fun/' },
            { name:'SpenFlix', url:'https://watch.spencerdevs.xyz/' },
            { name:'MovieBite', url:'https://moviebite.org/search?q={{TITLE}}' },
            { name:'Cinetaro', url:'https://cinetaro.to/' },
            { name:'Vuflix', url:'https://vuflix.co/' },
            { name:'Streamo', url:'https://streamo.pro/' },
            { name:'OpStream', url:'https://opstream.fun/' },
            { name:'Movish', url:'https://movish.to/' },
            { name:'LatestMovies', url:'https://latestmovies.net/search?q={{TITLE}}' },
            { name:'VidPlay', url:'https://vidplay.to/' },
            { name:'Moonflix', url:'https://moonflix.website/' },
            { name:'Cinegram', url:'https://cinegram.tv/' },
            { name:'HiveX', url:'https://hivex.stream/' },
            { name:'Cinemove', url:'https://cinemove.cc/' },
            { name:'FlyStream', url:'https://flystream.net/' },
            { name:'Overlook', url:'https://overlook.cx/' },
            { name:'Stigstream', url:'https://stigstream.ru/' },
            { name:'Cineapse', url:'https://www.cineapse.net/' },
            { name:'Way2Movies', url:'https://beta.way2movies.live/' },
            { name:'Cinema.BZ', url:'https://cinema.army/' },
            { name:'Stellar', url:'https://stellar.rip/' },
            { name:'All You Can Watch', url:'https://allyoucanwatch.net/' },
            { name:'FRAME', url:'https://www.framemovie.online/' },
            { name:'Willow', url:'https://willowmovies.com/' },
            { name:'TonkaCine', url:'https://tonkacine.watch/' },
            { name:'Flixtrz', url:'https://flixtrz.com/' },
            { name:'CineBolt', url:'https://cinebolt.org/' },
            { name:'ZXCSTREAM', url:'https://zxcprime.icu/' },
            { name:'CinePro', url:'https://cinepro.fstream.app/' },
            { name:'SMovies', url:'https://smovies.co/' },
            { name:'CineFlix', url:'https://cineflix.fstream.app/' },
            { name:'Nextbox', url:'https://nextbox.uno/' },
            { name:'Smashystream', url:'https://smashystream.xyz/' },
            { name:'Sleepy', url:'https://xullys.xyz/' },
            { name:'BingeBang', url:'https://bingebang.tv/' },
            { name:'NomorFlix', url:'https://nomorflix.cc/' },
            { name:'DioStream', url:'https://diostream.cc/' },
            { name:'NOVERA', url:'https://novera.tv/' },
            { name:'NOVA', url:'https://novahd.cc/' },
            { name:'NetPlay', url:'https://netplayz.icu/' },
            { name:'Cinelove', url:'https://cinelove.live/' },
            { name:'Screenscape', url:'https://screenscape.me/' },
            { name:'DULO', url:'https://dulo.cx/' },
            { name:'Kofi', url:'https://kofi.mov/' },
            { name:'Surface Stream', url:'https://watchsurface.stream/' },
            { name:'Mapple.tv', url:'https://mappl.tv/' },
            { name:'Apexmovies', url:'https://apexmovies.net/' },
            { name:'Watchott', url:'https://watchott.org/' },
            { name:'EmnexMovies', url:'https://emnexmovies.tech/' },
            { name:'StreamVaults', url:'https://streamvaults.ru/' },
            { name:'ReelStream', url:'https://rreelstream.live/' },
            { name:'GaiaFlix', url:'https://gaiaflix.live/' },
            { name:'Nxsha', url:'https://web.nxsha.app/' },
            { name:'Vegeta TV', url:'http://vegetatv.duckdns.org/' },
        ] },
        { group:'P-Stream forks', sites:[
            { name:'Z-Stream', url:'https://zstream.mov/' },
            { name:'Aether', url:'https://aether.ist/' },
            { name:'Basement', url:'https://basementx.xyz/' },
            { name:'kstream', url:'https://kdesa.stream/' },
            { name:'Rizz Stream', url:'https://rizzking.org/' },
            { name:'StreamWatch', url:'https://streamwatch.online/' },
            { name:'P-Stream Fork', url:'https://pstream.cfd/' },
            { name:'Cinevaro', url:'https://cinevaro.app/' },
            { name:'IceFY', url:'https://icefy.top/' },
            { name:'peestream', url:'https://peestream.in/' },
        ] },
        { group:'Dedicated server', sites:[
            { name:'EE3', url:'https://ee3.me/' },
            { name:'RIPS', url:'https://rips.cc/' },
            { name:'Bingr', url:'https://bingr.one/' },
            { name:'CineStream', url:'https://cinestream.kje.us/' },
            { name:'NEPU', url:'https://nepu.to/' },
            { name:'Streaming Unity', url:'https://streamingunity.dog/' },
            { name:'VaultPlayer', url:'https://vaultplayer.co.uk/' },
            { name:'SoapGo', url:'https://soapgo.to/' },
            { name:'Boomflix', url:'https://boomflix.qzz.io/' },
            { name:'CinemaCity', url:'https://cinemacity.cc/' },
            { name:'arc018', url:'https://arc018.stream/' },
            { name:'RidoMovies', url:'https://ridomovies.is/' },
            { name:'Filmo', url:'https://filmo.to/' },
            { name:'AZMovies', url:'https://azmovies.to/' },
            { name:'OnionPlay', url:'https://onionplay.st/' },
            { name:'ShowBox', url:'https://www.showbox.media/' },
            { name:'UniqueStream', url:'https://uniquestream.net/' },
            { name:'BFLIX', url:'https://bflix.sh/' },
            { name:'FshareTV', url:'https://fsharetv.co/' },
            { name:'MovieNestBD', url:'https://movienestbd.pics/' },
            { name:'M4uHD', url:'https://m4uhd.vip/' },
            { name:'Levidia', url:'https://www.levidia.ch/' },
            { name:'SubSL', url:'https://subsl.top/' },
            { name:'PrimeWire', url:'https://www.primewire.mov/' },
            { name:'YesMovie', url:'https://ww1.yesmovies.ag/' },
            { name:'HollyMovieHD', url:'https://hollymoviehd.cc/' },
            { name:'Downloads-Anymovies', url:'https://www.downloads-anymovies.co/' },
            { name:'MovieBox', url:'https://movieboxonline.net/' },
            { name:'LookMovie2', url:'https://lookmovie2.to/' },
        ] },
        { group:'Multi-server', sites:[
            { name:'1Shows', url:'https://www.1shows.org/' },
            { name:'1Flex', url:'https://www.1flex.org/' },
            { name:'1Tube', url:'https://www.1tube.org/' },
            { name:'CinemaOS', url:'https://cinemaos.live/' },
            { name:'NoirX', url:'https://noirx.me/' },
            { name:'AniCine', url:'https://anicine.xyz/' },
            { name:'ZetMoon', url:'https://zetmoon.live/' },
            { name:'Primeshows', url:'https://www.primeshows.org/' },
            { name:'NetShows', url:'https://netshows.xyz/' },
            { name:'Youshows', url:'https://youshows.org/' },
            { name:'Anixtv', url:'https://anixx.fun/' },
            { name:'AuroraScreen', url:'https://aurorascreen.org/' },
            { name:'HydraHD', url:'https://hydrahd.ws/' },
            { name:'Fireflix', url:'https://fireflix.pages.dev/' },
            { name:'Vidbox', url:'https://vidbox.vc/' },
            { name:'Zencine', url:'https://zencine.org/' },
            { name:'CineWave', url:'https://watch.cinewave.qzz.io/' },
            { name:'Youflex', url:'https://youflex.top/' },
            { name:'Flixzy', url:'https://flixzy.pages.dev/' },
            { name:'FilmCave', url:'https://filmcave.ru/' },
            { name:'Flixway', url:'https://flixway.ru/' },
            { name:'321Movies', url:'https://321movies.xyz/' },
            { name:'KiraStreams', url:'https://k.thekirastreams.workers.dev/' },
            { name:'Redflix', url:'https://redflix.one/' },
            { name:'CineHub', url:'https://cinehub.one/' },
            { name:'Flyflix', url:'https://flyflix.net/' },
            { name:'FluxTV', url:'https://fluxtv.cc/' },
            { name:'CineVibe', url:'https://cinevibe.to/' },
            { name:'MovieFY', url:'https://player.xtra.wtf/search' },
            { name:'Flixvo', url:'https://flixvo.live/' },
            { name:'BoredFlix', url:'https://www.boredflix.tv/' },
            { name:'CandleStream', url:'https://candlestream.xyz/' },
            { name:'Cine.su', url:'https://cine.su/' },
            { name:'ZFlix', url:'https://zflix.me/' },
        ] },
        { group:'Multi-server backups', sites:[
            { name:'Flicker', url:'https://flicker-mini.pages.dev/' },
            { name:'ONOFLIX', url:'https://onoflix.ru/' },
            { name:'GGFlix', url:'https://ggflix.live/' },
            { name:'Bingeflix', url:'https://bingeflix.tv/' },
            { name:'7REELS', url:'https://7reels.cc/' },
            { name:'Cubeflix', url:'https://cubeflix.org/discover' },
            { name:'Ernax', url:'https://ernax.pro/' },
            { name:'AmberFlix', url:'https://www.amberflix.xyz/' },
            { name:'FLNK', url:'https://flnk.fun/' },
            { name:'Pawflix', url:'https://pawflix.foo.ng/' },
            { name:'KaitoVault', url:'https://www.kaitovault.com/' },
            { name:'CinebyTV', url:'https://cinebytv.com/' },
            { name:'TVids', url:'https://www.tvids.to/' },
            { name:'Movies To Watch', url:'https://www.moviestowatch.top/' },
            { name:'StreameX', url:'https://streamex.sh/' },
            { name:'Zerostream', url:'https://zerostream.alwaysdata.net/' },
            { name:'FreeInterTV', url:'http://www.freeintertv.com/' },
            { name:'FishyStream', url:'https://fishystream-app.pages.dev/' },
            { name:'Snowstream', url:'https://snowstream.vercel.app/' },
            { name:'StreamGoblin', url:'https://streamgoblin.com/' },
            { name:'WatchOrbit', url:'https://watchorbit.me/' },
            { name:'CineNest', url:'https://cine-nest-nine.vercel.app/' },
            { name:'DuaFile', url:'https://download.duafile.com/' },
            { name:'FLIKER', url:'https://fliker.freebuff.app/' },
            { name:'Meowly', url:'https://meowly.qzz.io/' },
            { name:'Warflix', url:'https://warflix.im/' },
            { name:'Heartive', url:'https://heartivelovestv.pages.dev/' },
            { name:'CineGo', url:'https://cinego.co/' },
            { name:'Moviepire', url:'https://moviepire.org/' },
        ] },
        { group:'Free with ads (legal)', sites:[
            { name:'Tubi', url:'https://tubitv.com/search/{{TITLE}}' },
            { name:'Plex', url:'https://watch.plex.tv/search?query={{TITLE}}' },
            { name:'Pluto', url:'https://pluto.tv/' },
            { name:'Video Dictionary', url:'https://videodictionary.kwebpia.net/?m=Full_Movies' },
            { name:'FreeGreatMovies', url:'https://www.freegreatmovies.com/' },
            { name:'Voleflix', url:'https://vole.wtf/voleflix/' },
            { name:'OpenCulture', url:'https://www.openculture.com/freemoviesonline' },
            { name:'MoviesFoundOnline', url:'https://moviesfoundonline.com/' },
            { name:'Official YT Movies', url:'https://www.youtube.com/feed/storefront?bp=ogUCKAY%3D' },
            { name:'PopcornFlix', url:'https://popcornflix.com/' },
            { name:'Prime Video Free', url:'https://www.amazon.com/gp/video/storefront/?ie=UTF8&contentId=freetv' },
            { name:'Roku Channel', url:'https://therokuchannel.roku.com/' },
            { name:'DarkRoom', url:'https://www.darkroom.film/' },
            { name:'Fawesome', url:'https://fawesome.tv/' },
            { name:'Sling Freestream', url:'https://watch.sling.com/' },
            { name:'Fandango at Home', url:'https://athome.fandango.com/content/browse/search?searchString={{TITLE}}' },
            { name:'Shout! TV', url:'https://shout-tv.com/' },
            { name:'Kanopy', url:'https://kanopy.com/' },
            { name:'hoopla', url:'https://www.hoopladigital.com/search?q={{TITLE}}&scope=everything&type=direct' },
            { name:'Found TV', url:'https://watch.foundtv.com/' },
            { name:'BYUtv', url:'https://www.byutv.org/' },
            { name:'7plus', url:'https://7plus.com.au/' },
            { name:'Playary', url:'https://www.playary.com/' },
            { name:'Filmzie', url:'https://filmzie.com/' },
            { name:'ARTE', url:'https://www.arte.tv/en/search/?q={{TITLE}}' },
            { name:'BBC iPlayer', url:'https://www.bbc.co.uk/iplayer/search?q={{TITLE}}' },
            { name:'FlixHouse', url:'https://flixhouse.com/' },
        ] },
    ];
    /* Cycled for catalog additions so a burst of added rows stays visually distinct. */
    const CATALOG_ROW_COLORS = [
        '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4',
        '#14b8a6', '#f97316', '#8b5cf6', '#22c55e', '#fb7185', '#0ea5e9',
    ];

    const DEFAULTS = {
        // Cleanup
        removeAds: true, removeProUpsell: true, removeNewsSection: true,
        removeRelatedInterests: true, removeContribution: true,
        removeSponsoredRecs: true, removeAppBanner: true,
        // Off by default: a review nobody chose is an irritant to some people and the
        // section as IMDb ships it to everyone else.
        removeFeaturedReview: false,
        // Appearance
        modernUI: true, editorialTitleSurface: true, compactHeader: true, enhancedRatingDisplay: true,
        widerLayout: true, ratingColorCoding: true,
        // Off by default: it hides nothing, but it is an opinion about other people's
        // taste and should be asked for.
        dimLowRated: false, dimRatingThreshold: '6.0',
        // Theme
        themeVariant: 'dark', // dark | oled | midnight | light | highContrast
        themeAuto: false,
        // Sections
        collapsibleSections: true, expandSummaries: false, sectionCollapseState: {}, spoilerBlur: false, quickNav: true,
        // Scores
        inlineRTScore: true, inlineLetterboxdScore: true, inlineMetacriticScore: true,
        inlineAnimeScore: false,
        // Off by default: it changes what hovering a picture does.
        imageZoom: false,
        /* On by default: it restores what the browser does anyway, and a right-click that
           does nothing reads as the page being broken rather than as a choice. */
        restoreImageContextMenu: true,
        // On by default: a shared link landing on the mobile site is nobody's intent.
        desktopFromMobileLinks: true,
        // Off by default: it puts someone else's page inside this one.
        movieChatBoard: false,
        // Off by default: it is a whole section of other films.
        collectionPanel: false,
        /* Extension only, and off until asked for: it is a background job that keeps
           checking after you have closed the tab. */
        watchlistAlerts: false,
        watchlistAlertServices: [],
        /* Data rather than preference, but declared here for the same reason the title
           marks are: reset and export both work from this map, so anything left out of
           it is a record somebody cannot see, cannot back up and cannot clear. */
        watchlistSnapshot: {},
        watchlistAlertState: {},
        streamAvailability: true,
        /* Which service answers "where can I watch this". JustWatch is read by parsing
           their page; TMDB is a documented API but needs a read token of your own. The
           default stays where it was so nothing changes for an existing install. */
        availabilitySource: 'justwatch', tmdbReadToken: '', omdbApiKey: '', mdblistApiKey: '',
        /* Which country's offers to read. TMDB answers for every country it knows, and
           showing another one's services as though they were yours is the failure this
           avoids. Declared here so it round-trips through backup and restore like any
           other setting; without it the region was read but could never be set. */
        availabilityRegion: 'US',
        // Links
        searchButtons: true, externalLinks: true, expandedLinkMenu: true,
        trailerPopover: true,
        watchSites: DEFAULT_WATCH_SITES, externalSites: DEFAULT_EXTERNAL_SITES,
        watchedMarking: true, userMarks: {}, titleNotes: true, scoreCorrections: {},
        servarrIntegration: false,
        seerrUrl: 'http://localhost:5055', seerrApiKey: '',
        radarrUrl: 'http://localhost:7878', radarrApiKey: '',
        radarrRootFolderPath: '', radarrQualityProfileId: '1',
        sonarrUrl: 'http://localhost:8989', sonarrApiKey: '',
        sonarrRootFolderPath: '', sonarrQualityProfileId: '1',
        mediaServerIntegration: false,
        rowIntegrationState: false,
        plexUrl: 'http://localhost:32400', plexToken: '',
        jellyfinUrl: 'http://localhost:8096', jellyfinApiKey: '',
        embyUrl: 'http://localhost:8096', embyApiKey: '',
        // TV
        tvEpisodeTools: true, tvShowEnhancements: true, subtitleLinks: true,
        episodeHeatmap: true, ratingGap: true, seasonProgress: true, episodeSubtitles: true,
        airsOn: true,
        castAges: true,
        // Utility
        quickCopyID: true, watchlistBatch: true, listMultiSearch: true, listRuntimeSummary: true,
        collectionExport: true,
        markFilters: true, listRoulette: true,
        // Off by default: it touches every title link on a page, which is a change to
        // how IMDb reads rather than an addition beside it.
        markLinkTint: false,
        keyboardShortcuts: false,
        // Extension builds only: the userscript updates itself through its manager.
        updateNotice: true, updateDismissedVersion: '',
        // Bounded, category-only record of feature failures; see appendFailureJournal.
        failureJournal: [],
    };
    const LOCAL_SERVICE_URL_KEYS = new Set([
        'radarrUrl', 'sonarrUrl', 'seerrUrl', 'plexUrl', 'jellyfinUrl', 'embyUrl',
    ]);
    const POSITIVE_INTEGER_SETTING_KEYS = new Set([
        'radarrQualityProfileId', 'sonarrQualityProfileId',
    ]);
    const CREDENTIAL_SETTING_KEYS = new Set([
        'radarrApiKey', 'sonarrApiKey', 'seerrApiKey', 'plexToken', 'jellyfinApiKey', 'embyApiKey',
        'tmdbReadToken',
        'omdbApiKey',
        'mdblistApiKey',
    ]);
    const COLLAPSIBLE_SECTION_IDS = [
        'title-cast', 'UserReviews', 'MoreLikeThis', 'Details', 'BoxOffice',
        'TechSpecs', 'DidYouKnow', 'videos-section', 'Photos',
    ];

    const FEATURE_DETAILS = {
        removeAds: t('feature_removeAds_detail'),
        removeProUpsell: t('feature_removeProUpsell_detail'),
        removeNewsSection: t('feature_removeNewsSection_detail'),
        removeRelatedInterests: t('feature_removeRelatedInterests_detail'),
        removeContribution: t('feature_removeContribution_detail'),
        removeSponsoredRecs: t('feature_removeSponsoredRecs_detail'),
        removeAppBanner: t('feature_removeAppBanner_detail'),
        removeFeaturedReview: t('feature_removeFeaturedReview_detail'),
        modernUI: t('feature_modernUI_detail'),
        editorialTitleSurface: t('feature_editorialTitleSurface_detail'),
        compactHeader: t('feature_compactHeader_detail'),
        enhancedRatingDisplay: t('feature_enhancedRatingDisplay_detail'),
        widerLayout: t('feature_widerLayout_detail'),
        ratingColorCoding: t('feature_ratingColorCoding_detail'),
        dimLowRated: t('feature_dimLowRated_detail'),
        collapsibleSections: t('feature_collapsibleSections_detail'),
        expandSummaries: t('feature_expandSummaries_detail'),
        spoilerBlur: t('feature_spoilerBlur_detail'),
        quickNav: t('feature_quickNav_detail'),
        inlineRTScore: t('feature_inlineRTScore_detail'),
        inlineLetterboxdScore: t('feature_inlineLetterboxdScore_detail'),
        inlineMetacriticScore: t('feature_inlineMetacriticScore_detail'),
        imageZoom: t('feature_imageZoom_detail'),
        restoreImageContextMenu: t('feature_restoreImageContextMenu_detail'),
        movieChatBoard: t('feature_movieChatBoard_detail'),
        collectionPanel: t('feature_collectionPanel_detail'),
        watchlistAlerts: t('feature_watchlistAlerts_detail'),
        inlineAnimeScore: t('feature_inlineAnimeScore_detail'),
        streamAvailability: t('feature_streamAvailability_detail'),
        searchButtons: t('feature_searchButtons_detail'),
        externalLinks: t('feature_externalLinks_detail'),
        expandedLinkMenu: t('feature_expandedLinkMenu_detail'),
        trailerPopover: t('feature_trailerPopover_detail'),
        castAges: t('feature_castAges_detail'),
        watchedMarking: t('feature_watchedMarking_detail'),
        servarrIntegration: t('feature_servarrIntegration_detail'),
        mediaServerIntegration: t('feature_mediaServerIntegration_detail'),
        rowIntegrationState: t('feature_rowIntegrationState_detail'),
        tvEpisodeTools: t('feature_tvEpisodeTools_detail'),
        tvShowEnhancements: t('feature_tvShowEnhancements_detail'),
        episodeHeatmap: t('feature_episodeHeatmap_detail'),
        ratingGap: t('feature_ratingGap_detail'),
        subtitleLinks: t('feature_subtitleLinks_detail'),
        episodeSubtitles: t('feature_episodeSubtitles_detail'),
        quickCopyID: t('feature_quickCopyID_detail'),
        watchlistBatch: t('feature_watchlistBatch_detail'),
        listMultiSearch: t('feature_listMultiSearch_detail'),
        collectionExport: t('feature_collectionExport_detail'),
        listRuntimeSummary: t('feature_listRuntimeSummary_detail'),
        markFilters: t('feature_markFilters_detail'),
        markLinkTint: t('feature_markLinkTint_detail'),
        titleNotes: t('feature_titleNotes_detail'),
        listRoulette: t('feature_listRoulette_detail'),
        airsOn: t('feature_airsOn_detail'),
        seasonProgress: t('feature_seasonProgress_detail'),
        keyboardShortcuts: t('feature_keyboardShortcuts_detail'),
    };
