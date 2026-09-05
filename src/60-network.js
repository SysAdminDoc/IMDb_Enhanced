    // =========================================================================
    //  ASYNC HTTP
    // =========================================================================
    /* Carries the cause on the rejection instead of leaving it to be inferred from prose.
       Everything that reads a failure — the stale-score fallback, the journal, the
       per-feature status — needs the category, and guessing it from a message is how a
       manager's untranslated response object became "unclassified". */
    /* The extension bridge routes every failure through onerror, including a timeout, so
       the callback that fired is not enough to tell them apart. When the background has
       classified the failure its answer wins. Its refusal categories (redirect_blocked,
       invalid_url and the rest) are not reachability categories and stay network, which
       is what they were treated as before. */
    const BRIDGE_FAILURE_CATEGORIES = {
        timeout:'timeout', aborted:'aborted', network:'network',
        /* A refusal, not an outage. These are the worker deciding not to make or finish a
           request, and calling them network failures made isReachabilityFailure true for
           every one: a request stopped because it would have carried a credential across
           a redirect then rendered last week's score with a Retry that could only be
           refused again. The commit that introduced this claimed they "stay network, as
           before" — they had been unknown and permission, and neither was reachable. */
        redirect_blocked:'permission',
        redirect_changed_origin:'permission',
        redirect_destination_not_allowed:'permission',
        redirect_crossed_trust_boundary:'permission',
        invalid_url:'permission',
        permission_not_granted:'permission',
    };
    function describeRequestFailure(fallback, response, url) {
        const category = BRIDGE_FAILURE_CATEGORIES[String(response?.errorType || '')] || fallback;
        const status = Number(response?.status) || 0;
        // Tampermonkey and Violentmonkey use .error, the bridge uses .message, and a
        // thrown Error arriving here has neither of those but does have a message.
        const detail = normalizeRequestErrorText(response?.error)
            || normalizeRequestErrorText(response?.message)
            || normalizeRequestErrorText(response?.statusText)
            || '';
        /* A 429 is not an outage and must not be filed as one: it says the service is
           working and wants fewer requests. The stale-score fallback treats a server error
           as grounds for showing an old value, which is right for a 500 and wrong here. */
        const limited = status === 429;
        const error = new Error(detail
            || REQUEST_FAILURE_TEXT[limited ? 'rate_limited' : category]
            || t('error_request_failed'));
        error.imdbEnhancedCategory = limited ? 'rate_limited' : category;
        error.status = status;
        if (limited) error.retryAfterMs = readRetryAfter(response) || RATE_LIMIT_DEFAULT_MS;
        /* Carried forward, not dropped. getRequestErrorMessage turns these into the four
           sentences a user is actually shown for a blocked redirect; without it every one
           of those was unreachable and the toast fell through to the worker's own internal
           wording instead. */
        if (response?.errorType) error.errorType = String(response.errorType).slice(0, 64);
        if (typeof response?.responseText === 'string') error.responseText = response.responseText;
        // The URL is kept off the message: failures reach the journal and the diagnostics
        // report, and neither may carry the title someone looked at.
        error.requestHost = (() => {
            try { return new URL(url).hostname; }
            catch { return ''; }
        })();
        return error;
    }
    const REQUEST_FAILURE_TEXT = {
        network: t('error_request_network'),
        timeout: t('error_request_timeout'),
        aborted: t('error_request_aborted'),
        http: t('error_request_http'),
        rate_limited: t('error_request_rate_limited'),
    };

    /* A service that answers 429 is asking to be left alone, and the answer to that is to
       stop asking rather than to try the next title. AniList publishes ninety requests a
       minute and currently serves thirty; Wikimedia introduced per-minute buckets in 2026
       that a browser-origin client shares with everything else on the address. Neither was
       handled: a 429 was an HTTP failure like any other, so a person opening a filmography
       sent one request per row into a service that had already said no.

       Held by host, because that is what the limit belongs to, and for as long as the
       service asked for. Retry-After is seconds or an HTTP date; anything else, or nothing
       at all, gets a minute, which is the window every one of these limits is stated in. */
    const RATE_LIMIT_DEFAULT_MS = 60000;
    const RATE_LIMIT_MAX_MS = 60 * 60 * 1000;
    const rateLimitHolds = new Map();

    function parseRetryAfter(value, now = Date.now()) {
        const text = String(value ?? '').trim();
        if (!text) return 0;
        if (/^\d+$/.test(text)) {
            const seconds = Number(text);
            return Number.isFinite(seconds) ? Math.min(seconds * 1000, RATE_LIMIT_MAX_MS) : 0;
        }
        const at = Date.parse(text);
        if (!Number.isFinite(at)) return 0;
        return Math.min(Math.max(at - now, 0), RATE_LIMIT_MAX_MS);
    }

    /* Managers hand back the raw header block as one string; the bridge cannot, so it
       parses the one header this needs and passes the number. */
    function readRetryAfter(response) {
        if (Number.isFinite(Number(response?.retryAfterMs))) return Number(response.retryAfterMs);
        const raw = String(response?.responseHeaders || '');
        const match = /^retry-after:\s*(.+)$/im.exec(raw);
        return match ? parseRetryAfter(match[1]) : 0;
    }

    function hostOf(url) {
        try { return new URL(url).hostname; }
        catch { return ''; }
    }

    function rateLimitHoldFor(url, now = Date.now()) {
        const host = hostOf(url);
        if (!host) return 0;
        const until = rateLimitHolds.get(host) || 0;
        if (until <= now) {
            if (until) rateLimitHolds.delete(host);
            return 0;
        }
        return until - now;
    }

    function holdRateLimitedHost(url, ms, now = Date.now()) {
        const host = hostOf(url);
        if (!host) return;
        const wait = Math.min(Math.max(Number(ms) || RATE_LIMIT_DEFAULT_MS, 1000), RATE_LIMIT_MAX_MS);
        rateLimitHolds.set(host, Math.max(rateLimitHolds.get(host) || 0, now + wait));
    }
    function httpRequest(url, opts = {}) {
        return new Promise((resolve, reject) => {
            const {
                body,
                cancelOnRouteChange = false,
                headers: providedHeaders = {},
                ...requestOptions
            } = opts;
            const hasBody = body !== undefined;
            const headers = {
                ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
                ...providedHeaders,
            };
            /* Refused here rather than sent: a service that just answered 429 does not
               need the rest of the filmography to find out it meant it. */
            const held = rateLimitHoldFor(url);
            if (held) {
                const refusal = failure('rate_limited', t('error_request_rate_limited'));
                refusal.status = 429;
                refusal.retryAfterMs = held;
                refusal.requestHost = hostOf(url);
                reject(refusal);
                return;
            }
            let settled = false;
            let requestHandle = null;
            const finish = (handler, value) => {
                if (settled) return;
                settled = true;
                pendingRouteWorkCancels.delete(cancel);
                handler(value);
            };
            const cancel = () => {
                try { requestHandle?.abort?.(); } catch { /* request still rejects below */ }
                /* Says what it is. A bare Error here classified as unclassified, so a
                   navigation away looked the same in the failure journal as a defect. */
                finish(reject, describeRequestFailure('aborted', { error:'Route changed' }, url));
            };
            if (cancelOnRouteChange) pendingRouteWorkCancels.add(cancel);
            try {
                requestHandle = GM_xmlhttpRequest({
                    ...requestOptions,
                    method: requestOptions.method || 'GET',
                    url,
                    anonymous: true,
                    timeout: requestOptions.timeout || 10000,
                    headers,
                    data: hasBody ? JSON.stringify(body) : requestOptions.data,
                    onload: response => {
                        const failed = Number(response?.status) >= 400;
                        if (!failed) { finish(resolve, response); return; }
                        const error = describeRequestFailure('http', response, url);
                        if (error.imdbEnhancedCategory === 'rate_limited') {
                            holdRateLimitedHost(url, error.retryAfterMs);
                        }
                        finish(reject, error);
                    },
                    /* A script manager hands these callbacks its own response object, not
                       an Error. It has no name and no message, so anything downstream that
                       reads those saw "[object Object]" and classified every provider
                       outage as unclassified — which left the whole stale-score fallback
                       dead in this build. Managers also disagree about the field: Tampermonkey
                       populates .error, Violentmonkey does too but not .message. So the cause
                       is stated here, where it is known, rather than guessed at later. */
                    onerror: response => finish(reject, describeRequestFailure('network', response, url)),
                    ontimeout: response => finish(reject, describeRequestFailure('timeout', response, url)),
                    onabort: response => finish(reject, describeRequestFailure('aborted', response, url)),
                });
            } catch (error) {
                finish(reject, error);
            }
        });
    }
    function httpGet(url, opts = {}) {
        return httpRequest(url, { ...opts, method: 'GET' });
    }
    function parseJSONResponse(response, maxLength = LOCAL_RESPONSE_TEXT_LIMIT) {
        const raw = typeof response?.responseText === 'string' ? response.responseText : '';
        if (raw.length > maxLength) throw failure('unknown', t('error_response_too_large'));
        try { return JSON.parse(raw || 'null'); }
        catch { throw failure('parse', t('error_response_not_json')); }
    }
    function normalizeRequestErrorText(value) {
        if (typeof value !== 'string' && typeof value !== 'number') return '';
        return String(value).trim().replace(/\s+/g, ' ').slice(0, REQUEST_ERROR_TEXT_LIMIT);
    }
    const REDIRECT_ERROR_MESSAGES = {
        redirect_blocked: t('error_redirect_with_credential'),
        redirect_changed_origin: t('error_redirect_changed_origin'),
        redirect_destination_not_allowed: t('error_redirect_not_allowed'),
        redirect_crossed_trust_boundary: t('error_redirect_trust_boundary'),
    };
    function getRequestErrorMessage(error) {
        const responseText = typeof error?.responseText === 'string' ? error.responseText : '';
        if (responseText && responseText.length <= 100000) {
            try {
                const body = JSON.parse(responseText);
                const candidates = Array.isArray(body)
                    ? [body[0]?.errorMessage, body[0]?.message]
                    : [body?.message, body?.errorMessage, body?.error?.message, body?.error];
                for (const candidate of candidates) {
                    const message = normalizeRequestErrorText(candidate);
                    if (message) return message;
                }
            } catch { /* use status fallback */ }
        }
        /* A refused redirect is a security decision, not an outage, and saying "request
           failed" would send someone debugging their network instead of the service that
           redirected them. Only the extension bridge classifies errors this way. */
        const redirectMessage = REDIRECT_ERROR_MESSAGES[String(error?.errorType || '')];
        if (redirectMessage) return redirectMessage;
        const status = Number(error?.status);
        if (Number.isInteger(status) && status >= 100 && status <= 599) return `HTTP ${status}`;
        return normalizeRequestErrorText(error?.message) || t('error_request_failed');
    }
    function normalizeServarrBaseUrl(value) {
        const raw = String(value || '').trim().replace(/\/+$/, '');
        if (!raw) return '';
        try {
            const url = new URL(raw);
            if (!/^https?:$/i.test(url.protocol) || url.username || url.password || url.search || url.hash) return '';
            return url.href.replace(/\/+$/, '');
        } catch { return ''; }
    }
    /* The same three the background worker allows, and no more. Every one of them is
       carried by a declared origin and an @connect, which a test pins: a host accepted
       here with nothing behind it is a field that validates the address a service prints
       and then fails every request against it forever, which is what shipping [::1] on the
       predicates alone did. URL normalises every longer spelling of the loopback address
       to this one, so the single entry covers them all. */
    const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
    function isLocalServiceUrl(baseUrl) {
        try {
            const url = new URL(baseUrl);
            const host = url.hostname.toLowerCase();
            return /^https?:$/i.test(url.protocol)
                && LOOPBACK_HOSTS.has(host)
                && !url.username && !url.password && !url.search && !url.hash;
        } catch { return false; }
    }
    function isLocalServarrUrl(baseUrl) {
        return isLocalServiceUrl(baseUrl);
    }
    function toPositiveInteger(value, fallback = 1) {
        const parsed = Number(value);
        return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
    }
    /* In the extension the credential is not readable here at all: the bridge keeps it
       out of the content script's world, and the background substitutes it into the
       request. What comes back is a reference — the setting key — plus whether it is set.
       Under a script manager there is no second context to hold it, so the value is read
       directly and the reference is unused. */
    /* Value first, because whether it is readable depends on which context this is running
       in, not on the build. The options page is an extension context that legitimately
       holds credentials — it is the one surface that produces an encrypted backup — and
       checking IS_EXTENSION_BUILD first made every credential there report as not set.
       `readable` says whether this context can see a value at all, which is what anything
       about to write a backup needs to know before promising to carry one. */
    function readCredential(key) {
        const value = normalizeCredentialValue(get(key));
        if (value) return { value, ref:key, configured:true, readable:true };
        if (IS_EXTENSION_BUILD && typeof globalThis.__imdbEnhancedCredentialConfigured === 'function') {
            return {
                value:'',
                ref:key,
                configured: globalThis.__imdbEnhancedCredentialConfigured(PREFIX + key),
                readable:false,
            };
        }
        return { value:'', ref:key, configured:false, readable:true };
    }
    // True only where every stored credential can actually be read back.
    function canReadCredentials() {
        return !IS_EXTENSION_BUILD || typeof globalThis.__imdbEnhancedCredentialConfigured !== 'function';
    }

    function getServarrConfig(kind) {
        const prefix = kind === 'sonarr' ? 'sonarr' : 'radarr';
        const baseUrl = normalizeLocalServiceUrl(get(`${prefix}Url`));
        const credential = readCredential(`${prefix}ApiKey`);
        return {
            kind: prefix,
            baseUrl,
            apiKey: credential.value,
            apiKeyRef: credential.ref,
            hasApiKey: credential.configured,
            rootFolderPath: String(get(`${prefix}RootFolderPath`) || '').trim().slice(0, SETTING_TEXT_LIMIT),
            qualityProfileId: toPositiveInteger(get(`${prefix}QualityProfileId`), 0),
        };
    }
    function isServarrConfigured(kind) {
        const cfg = getServarrConfig(kind);
        // hasApiKey, not apiKey: in the extension the value is deliberately unreadable
        // here, and testing the value would report every configured install as unset.
        return Boolean(cfg.baseUrl && cfg.hasApiKey && cfg.rootFolderPath && cfg.qualityProfileId);
    }
    function getServarrAddOptions(item) {
        return item?.addOptions && typeof item.addOptions === 'object' && !Array.isArray(item.addOptions)
            ? item.addOptions
            : {};
    }
    function buildRadarrAddBody(item, cfg) {
        const source = item && typeof item === 'object' && !Array.isArray(item) ? item : {};
        return {
            ...source,
            monitored: true,
            qualityProfileId: cfg.qualityProfileId,
            rootFolderPath: cfg.rootFolderPath,
            minimumAvailability: source.minimumAvailability || 'released',
            addOptions: { ...getServarrAddOptions(source), searchForMovie:true },
        };
    }
    function buildSonarrAddBody(item, cfg) {
        const source = item && typeof item === 'object' && !Array.isArray(item) ? item : {};
        const seasons = Array.isArray(source.seasons)
            ? source.seasons.slice(0, SERVARR_SEASON_LIMIT)
                .filter(season => season && typeof season === 'object' && !Array.isArray(season))
                .map(season => ({ ...season, monitored:true }))
            : [];
        return {
            ...source,
            monitored: true,
            seasonFolder: true,
            qualityProfileId: cfg.qualityProfileId,
            rootFolderPath: cfg.rootFolderPath,
            seasons,
            addOptions: {
                ...getServarrAddOptions(source),
                monitor: 'all',
                searchForMissingEpisodes: true,
            },
        };
    }
    /* Overseerr and Jellyseerr expose the same v1 API, and a request there is often
       what a user actually wants: it goes through their approval workflow instead
       of writing straight into Radarr/Sonarr. The instance also resolves an IMDb ID
       to TMDB itself, so this integration needs no third-party API key of its own.
       Media status uses Overseerr's documented enum. */
    const SEERR_STATUS = { UNKNOWN:1, PENDING:2, PROCESSING:3, PARTIALLY_AVAILABLE:4, AVAILABLE:5 };
    const SEERR_SEASON_LIMIT = 100;

    function getSeerrConfig() {
        const credential = readCredential('seerrApiKey');
        return {
            baseUrl: normalizeLocalServiceUrl(get('seerrUrl')),
            apiKey: credential.value,
            apiKeyRef: credential.ref,
            hasApiKey: credential.configured,
        };
    }
    function isSeerrConfigured() {
        const cfg = getSeerrConfig();
        return Boolean(cfg.baseUrl && cfg.hasApiKey);
    }
    function mapSeerrMediaState(mediaInfo) {
        const status = Number(mediaInfo?.status) || 0;
        if (status === SEERR_STATUS.AVAILABLE) return 'library';
        if (status === SEERR_STATUS.PARTIALLY_AVAILABLE) return 'partial';
        if (status === SEERR_STATUS.PROCESSING) return 'processing';
        if (status === SEERR_STATUS.PENDING) return 'queued';
        return 'add';
    }
    function selectSeerrSearchResult(results, imdbId, mediaType) {
        if (!Array.isArray(results)) return null;
        const wanted = mediaType === 'tv' ? 'tv' : 'movie';
        for (const item of results.slice(0, EXTERNAL_RESULT_SCAN_LIMIT)) {
            if (!item || typeof item !== 'object') continue;
            if (String(item.mediaType || '').toLowerCase() !== wanted) continue;
            const id = Number(item.id);
            if (!Number.isInteger(id) || id <= 0) continue;
            return { tmdbId:id, mediaInfo:item.mediaInfo || null };
        }
        return null;
    }
    function buildSeerrRequestBody(mediaType, tmdbId, seasons = []) {
        const id = Number(tmdbId);
        if (!Number.isInteger(id) || id <= 0) return null;
        const body = { mediaType: mediaType === 'tv' ? 'tv' : 'movie', mediaId:id };
        if (body.mediaType === 'tv') {
            const list = Array.isArray(seasons)
                ? [...new Set(seasons.map(Number).filter(value => Number.isInteger(value) && value > 0))].slice(0, SEERR_SEASON_LIMIT)
                : [];
            body.seasons = list.length ? list : 'all';
        }
        return body;
    }
    async function seerrRequest(path, opts = {}) {
        const cfg = getSeerrConfig();
        if (!isLocalServarrUrl(cfg.baseUrl)) {
            throw failure('unknown', t('error_seerr_local_only'));
        }
        return httpRequest(buildLocalServiceUrl(cfg.baseUrl, `api/v1/${String(path).replace(/^\/+/, '')}`, opts.query), {
            method: opts.method || 'GET',
            body: opts.body,
            timeout: opts.timeout || 15000,
            cancelOnRouteChange: Boolean(opts.cancelOnRouteChange),
            /* Extension build: the value is not readable here, so the background is
               told which stored key to inject and does it only for a loopback target. */
            credentialHeader: cfg.apiKeyRef ? { name:'X-Api-Key', ref:cfg.apiKeyRef } : null,
            headers: {
                Accept: 'application/json',
                ...(cfg.apiKey ? { 'X-Api-Key': cfg.apiKey } : {}),
                ...(opts.body ? { 'Content-Type':'application/json' } : {}),
                ...(opts.headers || {}),
            },
        });
    }

    function buildServarrUrl(cfg, path, query = {}) {
        const url = new URL(`${cfg.baseUrl}/api/v3/${path.replace(/^\/+/, '')}`);
        Object.entries(query).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
        });
        return url.href;
    }
    async function servarrRequest(kind, path, opts = {}) {
        const cfg = getServarrConfig(kind);
        if (!isLocalServarrUrl(cfg.baseUrl)) {
            throw failure('unknown', t('error_servarr_local_only'));
        }
        return httpRequest(buildServarrUrl(cfg, path, opts.query), {
            method: opts.method || 'GET',
            body: opts.body,
            timeout: opts.timeout || 15000,
            cancelOnRouteChange: Boolean(opts.cancelOnRouteChange),
            /* Extension build: the value is not readable here, so the background is
               told which stored key to inject and does it only for a loopback target. */
            credentialHeader: cfg.apiKeyRef ? { name:'X-Api-Key', ref:cfg.apiKeyRef } : null,
            headers: {
                Accept: 'application/json',
                ...(cfg.apiKey ? { 'X-Api-Key': cfg.apiKey } : {}),
                ...(opts.headers || {}),
            },
        });
    }
    function buildLocalServiceUrl(baseUrl, path, query = {}) {
        const url = new URL(String(path || '').replace(/^\/+/, ''), `${baseUrl.replace(/\/+$/, '')}/`);
        Object.entries(query).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
        });
        return url.href;
    }
    function getMediaServerConfig(kind) {
        const defs = {
            plex: { label:'Plex', urlKey:'plexUrl', tokenKey:'plexToken' },
            jellyfin: { label:'Jellyfin', urlKey:'jellyfinUrl', tokenKey:'jellyfinApiKey' },
            emby: { label:'Emby', urlKey:'embyUrl', tokenKey:'embyApiKey' },
        };
        const def = defs[kind];
        if (!def) return null;
        const credential = readCredential(def.tokenKey);
        return {
            kind,
            label: def.label,
            baseUrl: normalizeLocalServiceUrl(get(def.urlKey)),
            token: credential.value,
            tokenRef: credential.ref,
            hasToken: credential.configured,
        };
    }
    function getConfiguredMediaServers() {
        return ['plex', 'jellyfin', 'emby']
            .map(getMediaServerConfig)
            // hasToken, not token: the extension deliberately cannot read the value here.
            .filter(cfg => cfg?.baseUrl && cfg.hasToken);
    }
    function normalizeIMDbProviderId(value) {
        const source = toBoundedText(value, PROVIDER_ID_TEXT_LIMIT);
        return source.match(/tt\d+/i)?.[0]?.toLowerCase() || '';
    }
    function normalizeLookupTitle(value) {
        const source = toBoundedText(value, LOOKUP_TITLE_TEXT_LIMIT);
        if (!source) return '';
        return source
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/&/g, ' and ')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }
    function collectProviderIds(item = {}) {
        const ids = [
            item.imdbId, item.imdbID, item.ImdbId,
            item.guid, item.Guid, item.key, item.ratingKey,
        ].filter(Boolean);
        const providerIds = item.providerIds || item.ProviderIds;
        if (Array.isArray(providerIds)) {
            ids.push(...providerIds.slice(0, Math.max(0, LOCAL_PROVIDER_ID_LIMIT - ids.length)));
        } else if (providerIds && typeof providerIds === 'object') {
            for (const key in providerIds) {
                if (!Object.prototype.hasOwnProperty.call(providerIds, key)) continue;
                ids.push(providerIds[key]);
                if (ids.length >= LOCAL_PROVIDER_ID_LIMIT) break;
            }
        }
        return ids.slice(0, LOCAL_PROVIDER_ID_LIMIT).map(normalizeIMDbProviderId).filter(Boolean);
    }
    function mediaItemMatches(item, ctx) {
        const imdbId = normalizeIMDbProviderId(ctx?.imdbId);
        const itemProviderIds = collectProviderIds(item);
        if (imdbId && itemProviderIds.length) return itemProviderIds.includes(imdbId);

        const itemTitle = normalizeLookupTitle(item?.title || item?.Name || item?.name || item?.OriginalTitle);
        const wantedTitle = normalizeLookupTitle(ctx?.title);
        if (!itemTitle || itemTitle !== wantedTitle) return false;

        const itemYear = Number(item?.year || item?.ProductionYear || item?.productionYear) || 0;
        const wantedYear = Number(ctx?.year) || 0;
        return !wantedYear || Boolean(itemYear) && Math.abs(itemYear - wantedYear) <= 1;
    }
    function selectServarrLookupResult(items, ctx, requireExisting = false) {
        if (!Array.isArray(items)) return null;
        return items.slice(0, LOCAL_LOOKUP_RESULT_LIMIT).find(item =>
            (!requireExisting || toPositiveInteger(item?.id, 0) > 0)
            && mediaItemMatches(item, ctx)
        ) || null;
    }
    function parsePlexItems(xmlText) {
        try {
            const source = toBoundedText(xmlText, LOCAL_RESPONSE_TEXT_LIMIT);
            if (!source) return [];
            const doc = new DOMParser().parseFromString(source, 'application/xml');
            const nodes = doc.querySelectorAll('Video,Directory');
            const items = [];
            for (let index = 0; index < nodes.length && index < LOCAL_LOOKUP_RESULT_LIMIT; index++) {
                const node = nodes[index];
                const providerIds = [toBoundedText(node.getAttribute('guid'), PROVIDER_ID_TEXT_LIMIT)];
                const guids = node.querySelectorAll('Guid');
                for (let guidIndex = 0; guidIndex < guids.length && guidIndex < LOCAL_PROVIDER_ID_LIMIT - 1; guidIndex++) {
                    providerIds.push(toBoundedText(guids[guidIndex].getAttribute('id'), PROVIDER_ID_TEXT_LIMIT));
                }
                items.push({
                    title:toBoundedText(
                        node.getAttribute('title') || node.getAttribute('originalTitle'),
                        LOOKUP_TITLE_TEXT_LIMIT
                    ),
                    year: Number(node.getAttribute('year')) || 0,
                    providerIds,
                });
            }
            return items;
        } catch { return []; }
    }
    /* Jellyfin 12.0 stopped reading X-Emby-Token and X-MediaBrowser-Token unless the
       server operator turns EnableLegacyAuthorization back on, so a token sent that way
       authenticates nothing on a current server. Its parser requires the scheme name to
       read MediaBrowser, then splits the rest on commas, trims quotes off each value and
       takes Token; the other parts only name the client in the server's device list. Emby
       kept the old header and Plex has always had its own, so the shape belongs to the
       service rather than being shared between them.
       (jellyfin/jellyfin, Jellyfin.Server.Implementations/Security/AuthorizationContext.cs)

       The token itself is a server-generated hex id, which is why it is placed between the
       quotes as it stands: Jellyfin URL-decodes each value it reads back out, so a value
       carrying % or + would need encoding, and one carrying a quote could not be expressed
       here at all. Neither shape is a Jellyfin API key. */
    const MEDIA_SERVER_AUTH = Object.freeze({
        plex: Object.freeze({ header:'X-Plex-Token', prefix:'', suffix:'' }),
        jellyfin: Object.freeze({
            header:'Authorization',
            prefix:`MediaBrowser Client="IMDb Enhanced", Device="Browser", DeviceId="imdb-enhanced", Version="${VERSION}", Token="`,
            suffix:'"',
        }),
        emby: Object.freeze({ header:'X-Emby-Token', prefix:'', suffix:'' }),
    });
    function parseMediaServerItems(payload) {
        try {
            const source = typeof payload === 'string' ? toBoundedText(payload, LOCAL_RESPONSE_TEXT_LIMIT) : null;
            if (typeof payload === 'string' && !source) return [];
            const data = source !== null ? JSON.parse(source || '{}') : (payload || {});
            const items = Array.isArray(data) ? data : (Array.isArray(data.Items) ? data.Items : []);
            return items.slice(0, LOCAL_LOOKUP_RESULT_LIMIT).map(item => ({
                title:toBoundedText(item.Name || item.OriginalTitle || item.SeriesName, LOOKUP_TITLE_TEXT_LIMIT),
                year: Number(item.ProductionYear) || 0,
                providerIds: collectProviderIds(item),
            }));
        } catch { return []; }
    }
    async function mediaServerRequest(cfg, path, opts = {}) {
        if (!isLocalServiceUrl(cfg.baseUrl)) {
            throw failure('unknown', t('error_media_server_local_only'));
        }
        const query = { ...(opts.query || {}) };
        const auth = MEDIA_SERVER_AUTH[cfg.kind] || MEDIA_SERVER_AUTH.emby;
        const headers = cfg.kind === 'plex'
            ? { Accept:'application/xml', ...(opts.headers || {}) }
            : { Accept:'application/json', ...(opts.headers || {}) };
        if (cfg.token) headers[auth.header] = `${auth.prefix}${cfg.token}${auth.suffix}`;
        return httpRequest(buildLocalServiceUrl(cfg.baseUrl, path, query), {
            method: opts.method || 'GET',
            timeout: opts.timeout || 12000,
            cancelOnRouteChange: Boolean(opts.cancelOnRouteChange),
            headers,
            // Extension build: the value is not readable here, so the background is told
            // which stored key to inject and does it only for a loopback destination.
            credentialHeader: cfg.tokenRef ? { name:auth.header, ref:cfg.tokenRef } : null,
        });
    }

