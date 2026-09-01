    // ===================== RATING COLOR CODING =====================
    function getHexLuminance(value) {
        const match = String(value || '').trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
        if (!match) return null;
        const hex = match[1].length === 3
            ? match[1].split('').map(channel => channel + channel).join('')
            : match[1];
        const channels = [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
            .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    }
    function readableTextColor(background) {
        const backgroundLuminance = getHexLuminance(background);
        if (backgroundLuminance === null) return '#fff';
        const darkLuminance = getHexLuminance('#050505');
        const darkContrast = (backgroundLuminance + 0.05) / (darkLuminance + 0.05);
        const lightContrast = 1.05 / (backgroundLuminance + 0.05);
        return darkContrast >= lightContrast ? '#050505' : '#fff';
    }
    function ratingColor(val) {
        const n = parseFloat(val);
        const [bg, label] = isNaN(n) ? ['#555', t('label_rating_unrated')]
            : n >= 8.0 ? ['#22c55e', t('label_rating_great')]
                : n >= 7.0 ? ['#84cc16', t('label_rating_good')]
                    : n >= 6.0 ? ['#eab308', t('label_rating_average')]
                        : n >= 5.0 ? ['#f97316', t('text_below_avg')]
                            : ['#ef4444', t('label_rating_poor')];
        return { bg, text:readableTextColor(bg), label };
    }
    function mcColor(s) { return s >= 75 ? '#6c3' : s >= 50 ? '#ffbd3f' : s >= 25 ? '#ff6874' : '#f00'; }
    function rtColorFn(s) { return s >= 60 ? '#fa320a' : '#6b7280'; }
    function lbColor(s) { return s >= 4 ? '#00e054' : s >= 3 ? '#40bcf4' : s >= 2 ? '#ff8000' : '#ff6874'; }
    function formatScore(n) {
        return Number(n).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    }
    function boundedScore(value, maximum) {
        if (value === null || value === undefined || value === '') return null;
        const score = Number(value);
        return Number.isFinite(score) && score >= 0 && score <= maximum ? score : null;
    }
    function formatCount(n) {
        const count = Number(n);
        if (!Number.isFinite(count) || count <= 0) return '';
        if (count >= 1000000) return `${(count / 1000000).toFixed(count >= 10000000 ? 0 : 1)}M`;
        if (count >= 1000) return `${Math.round(count / 1000)}K`;
        return String(count);
    }
    function decodeHTML(text) {
        /* A detached textarea parses its content as raw character data, so entities
           decode while markup stays literal text and nothing can execute. The
           element is never inserted into the document. */
        const ta = document.createElement('textarea');
        ta.innerHTML = String(text || '');
        return ta.value;
    }
    function getJustWatchSlug(title = getTitleText()) {
        return String(title || '')
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/&/g, ' and ')
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
    }
    function getJustWatchTypePath() {
        return isTVType() ? 'tv-show' : 'movie';
    }
    /* JustWatch keys its whole site by region, so /us was answering for the United States
       whoever was asking. It uses a lowercase code in the path where TMDB uses an
       uppercase one in its results, and the same stored setting drives both. */
    function getJustWatchRegionPath() {
        return getAvailabilityRegion().toLowerCase();
    }
    function getJustWatchCorrectionRequestUrl(value, region = getAvailabilityRegion()) {
        const normalized = normalizeScoreCorrectionUrl('justWatch', value);
        const normalizedRegion = String(region || '').trim().toUpperCase();
        if (!normalized || !/^[A-Z]{2}$/.test(normalizedRegion)) return '';
        try {
            const parsed = new URL(normalized);
            parsed.pathname = parsed.pathname.replace(/^\/[a-z]{2}\//i, `/${normalizedRegion.toLowerCase()}/`);
            return parsed.href;
        } catch { return ''; }
    }
    function resolveJustWatchCorrectionResponseUrl(response, requestedUrl, region = getAvailabilityRegion()) {
        const resolved = resolveScoreCorrectionResponseUrl('justWatch', response, requestedUrl);
        const normalizedRegion = String(region || '').trim().toUpperCase();
        if (!resolved || !/^[A-Z]{2}$/.test(normalizedRegion)) return '';
        try {
            return new URL(resolved).pathname.split('/').filter(Boolean)[0]?.toUpperCase() === normalizedRegion
                ? resolved
                : '';
        } catch { return ''; }
    }
    function getJustWatchSearchUrl(title = getTitleText()) {
        return `https://www.justwatch.com/${getJustWatchRegionPath()}/search?q=${encodeURIComponent(title || '')}`;
    }
    function getJustWatchDetailUrl(title = getTitleText()) {
        const slug = getJustWatchSlug(title);
        return slug
            ? `https://www.justwatch.com/${getJustWatchRegionPath()}/${getJustWatchTypePath()}/${slug}`
            : getJustWatchSearchUrl(title);
    }
    function getTrailerSearchUrl(title = getTitleText(), year = getTitleYear()) {
        const query = [title, year, 'official trailer'].filter(Boolean).join(' ');
        return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    }
    function normalizeYouTubeVideoId(value) {
        const videoId = String(value || '');
        return /^[a-zA-Z0-9_-]{11}$/.test(videoId) ? videoId : '';
    }
    function isTrailerTitleMatch(candidateTitle, title) {
        const candidate = normalizeLookupTitle(candidateTitle);
        const wanted = normalizeLookupTitle(title);
        if (!candidate || !wanted) return false;
        if (candidate === wanted) return true;

        const descriptor = /^(?:official|trailer|teaser|final|main|original|international|theatrical|red|band|hd|uhd|4k|remaster(?:ed)?|\d{4}|\d+(?:st|nd|rd|th))\b/;
        if (candidate.startsWith(`${wanted} `)) {
            return descriptor.test(candidate.slice(wanted.length + 1));
        }
        if (candidate.endsWith(` ${wanted}`)) {
            return /\b(?:trailer|teaser)\b/.test(candidate.slice(0, -(wanted.length + 1)));
        }
        return false;
    }
    function parseYouTubeTrailerVideoId(html, title, year) {
        const wantedTitle = normalizeLookupTitle(title);
        if (!wantedTitle) return '';
        const source = toBoundedText(html, EXTERNAL_RESPONSE_TEXT_LIMIT);
        if (!source) return '';
        const wantedYear = Number(year) || 0;
        const candidates = [];
        const renderers = source.matchAll(
            /"videoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})"[\s\S]{0,4000}?"title":\{"runs":\[\{"text":"((?:\\.|[^"\\])*)"/g
        );
        let inspected = 0;
        for (const match of renderers) {
            if (inspected >= EXTERNAL_RESULT_SCAN_LIMIT) break;
            inspected += 1;
            let candidateTitle = '';
            try { candidateTitle = JSON.parse(`"${match[2]}"`); }
            catch { continue; }
            const normalized = normalizeLookupTitle(candidateTitle);
            if (!isTrailerTitleMatch(candidateTitle, title) || !/\b(?:trailer|teaser)\b/i.test(candidateTitle)) continue;
            const candidateYear = Number(yearFromText(candidateTitle)) || 0;
            if (wantedYear && candidateYear && Math.abs(candidateYear - wantedYear) > 1) continue;
            const score = (normalized === wantedTitle || normalized.startsWith(`${wantedTitle} `) ? 4 : 2)
                + (wantedYear && candidateYear ? 3 : 0)
                + (/\bofficial\b/i.test(candidateTitle) ? 2 : 0)
                + (/\btrailer\b/i.test(candidateTitle) ? 1 : 0);
            candidates.push({ videoId:match[1], score });
        }
        candidates.sort((a, b) => b.score - a.score);
        return normalizeYouTubeVideoId(candidates[0]?.videoId);
    }
    function compactProviders(providers, limit = 2) {
        const clean = [];
        const seen = new Set();
        const shownLimit = Number.isSafeInteger(limit) && limit > 0 ? limit : 2;
        let inspected = 0;
        for (const provider of Array.isArray(providers) ? providers : []) {
            if (inspected >= STRUCTURED_DATA_CLASSIFICATION_ITEM_LIMIT) break;
            inspected += 1;
            if (typeof provider !== 'string' && typeof provider !== 'number') continue;
            const name = String(provider || '').trim().replace(/\s+/g, ' ').slice(0, 120);
            const identity = name.toLowerCase();
            if (name && !seen.has(identity)) {
                seen.add(identity);
                clean.push(name);
            }
        }
        if (clean.length <= shownLimit + 1) return { providers: clean, extra: 0 };
        return { providers: clean.slice(0, shownLimit), extra: clean.length - shownLimit };
    }
    function formatProviderSummary(providers) {
        const { providers: shown, extra } = compactProviders(providers);
        const summary = shown.join(', ');
        return extra > 0 ? `${summary} +${extra}` : summary;
    }

    function getHTMLAttribute(attributes, name) {
        const escaped = String(name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const match = String(attributes || '').match(new RegExp(`\\b${escaped}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
        return match ? decodeHTML(match[2]) : '';
    }

    function parseRTSearchCandidates(html, type = 'movie') {
        const source = toBoundedText(html, EXTERNAL_RESPONSE_TEXT_LIMIT);
        if (!source) return [];
        const candidates = [];
        const rows = source.matchAll(/<search-page-media-row\b([^>]*)>([\s\S]*?)<\/search-page-media-row>/gi);
        let inspected = 0;
        for (const row of rows) {
            if (inspected >= EXTERNAL_RESULT_SCAN_LIMIT) break;
            inspected += 1;
            const titleAnchor = row[2].match(/<a\b([^>]*\bslot\s*=\s*["']title["'][^>]*)>([\s\S]*?)<\/a>/i);
            if (!titleAnchor) continue;
            const href = normalizeTrustedUrl(getHTMLAttribute(titleAnchor[1], 'href'), 'rottentomatoes.com', '');
            if (!href) continue;
            const path = new URL(href).pathname;
            if (type === 'tv' ? !path.startsWith('/tv/') : !path.startsWith('/m/')) continue;
            const candidateTitle = decodeHTML(titleAnchor[2].replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
            const rawScore = getHTMLAttribute(row[1], 'tomatometer-score');
            const score = rawScore === '' ? null : Number(rawScore);
            if (!candidateTitle || score !== null && (!Number.isFinite(score) || score < 0 || score > 100)) continue;
            const candidateYear = Number(
                getHTMLAttribute(row[1], 'release-year') || getHTMLAttribute(row[1], 'start-year')
            ) || 0;
            candidates.push({
                title:candidateTitle,
                year:candidateYear,
                tomatometer:score,
                audience:null,
                consensus:null,
                url:href,
                ...(score !== null ? { detail:`${score}%` } : {}),
            });
        }
        return candidates;
    }

    function parseRTSearchResult(html, title, year, type = 'movie') {
        const candidates = parseRTSearchCandidates(html, type);
        const wantedTitle = normalizeLookupTitle(title);
        const exact = candidates.filter(candidate => normalizeLookupTitle(candidate.title) === wantedTitle);
        const wantedYear = Number(year) || 0;
        if (wantedYear) {
            const yearMatch = exact.find(candidate => candidate.year && Math.abs(candidate.year - wantedYear) <= 1);
            return yearMatch || null;
        }
        return exact.length === 1 ? exact[0] : null;
    }

    /* Cross-site score lookups used to start from a title search, which is where
       nearly every historical identity defect came from: remakes, sequels sharing
       a prefix, and same-name titles all rank plausibly. Wikidata publishes the
       mapping outright — P345 is the IMDb ID, and each title's item carries the
       Rotten Tomatoes, Metacritic, and TMDB identifiers alongside it — over a
       keyless, CORS-open SPARQL endpoint. Resolving the ID first turns a fuzzy
       search into a direct fetch; when Wikidata has no mapping, the validated
       search path still runs unchanged. */
    const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';
    const WIKIDATA_ID_TTL = PROVIDERS.wikidata.ttl;
    const WIKIDATA_RESPONSE_LIMIT = 256 * 1024;
    const EXTERNAL_ID_PATTERNS = {
        rt: /^(?:m|tv)\/[a-z0-9][a-z0-9_-]{0,120}$/i,
        metacritic: /^(?:movie|tv)\/[a-z0-9][a-z0-9._-]{0,120}$/i,
        tmdb: /^(?:movie|tv)\/\d{1,12}$/i,
    };

    /* IE-120: how old somebody was when a film was made is the question a cast list
       raises and never answers, and it has been asked for since 2005. Birth dates live on
       IMDb's /name/ pages, which answer a script with an anti-bot challenge, so they are
       read from Wikidata instead: one batched query for the whole billed cast, keyed by
       the IMDb ids the page already carries.

       A year is all this needs and all it claims. Without the month, an age is out by up
       to a year either way, so it is labelled approximate rather than presented as a
       fact. */
    const CAST_AGE_LIMIT = 18;
    const CAST_AGE_MIN_YEAR = 1850;

    function collectCastNameIds(root = document) {
        const ids = [];
        const seen = new Set();
        const anchors = root.querySelectorAll?.('[data-testid="title-cast-item"] a[href*="/name/nm"]') || [];
        for (const anchor of anchors) {
            if (ids.length >= CAST_AGE_LIMIT) break;
            const id = String(anchor.getAttribute('href') || '').match(/\/name\/(nm\d{5,12})/)?.[1];
            if (!id || seen.has(id)) continue;
            seen.add(id);
            ids.push(id);
        }
        return ids;
    }

    function buildCastBirthQuery(nameIds) {
        const wanted = (Array.isArray(nameIds) ? nameIds : [])
            .filter(id => /^nm\d{5,12}$/.test(String(id || '')))
            .slice(0, CAST_AGE_LIMIT);
        if (!wanted.length) return '';
        const values = wanted.map(id => JSON.stringify(id)).join(' ');
        /* One query for the whole cast rather than one per person: eighteen requests to
           somebody else's public endpoint for one page view is not a reasonable way to
           ask a question. */
        return 'SELECT ?imdb (MIN(YEAR(?dob)) AS ?born) WHERE {'
            + ` VALUES ?imdb { ${values} }`
            + ' ?item wdt:P345 ?imdb; wdt:P569 ?dob.'
            + ` } GROUP BY ?imdb LIMIT ${CAST_AGE_LIMIT}`;
    }

    function parseCastBirthYears(responseText) {
        const source = toBoundedText(responseText, WIKIDATA_RESPONSE_LIMIT);
        if (!source) return {};
        let payload = null;
        try { payload = JSON.parse(source); }
        catch { return {}; }
        const rows = payload?.results?.bindings;
        if (!Array.isArray(rows)) return {};
        const years = {};
        for (let index = 0; index < rows.length && index < CAST_AGE_LIMIT; index++) {
            const id = String(rows[index]?.imdb?.value || '');
            if (!/^nm\d{5,12}$/.test(id) || years[id]) continue;
            const born = Number(rows[index]?.born?.value);
            /* Their data is open, so a birth year in the future or in antiquity is a thing
               that happens. Neither is an age worth putting on a page. */
            if (!Number.isSafeInteger(born) || born < CAST_AGE_MIN_YEAR) continue;
            if (born > new Date().getUTCFullYear()) continue;
            years[id] = born;
        }
        return years;
    }

    function castAgeAtRelease(bornYear, releaseYear) {
        const born = Number(bornYear);
        const released = Number(releaseYear);
        if (!Number.isSafeInteger(born) || !Number.isSafeInteger(released)) return null;
        const age = released - born;
        // Nobody acts before they are born, and a century on set is a data error.
        return age >= 0 && age <= 110 ? age : null;
    }

    function buildWikidataIdQuery(imdbId) {
        if (!/^tt\d{5,12}$/.test(String(imdbId || ''))) return '';
        return `SELECT ?rt ?mc ?tmdbMovie ?tmdbTv WHERE {`
            + ` ?item wdt:P345 "${imdbId}".`
            + ` OPTIONAL { ?item wdt:P1258 ?rt. }`
            + ` OPTIONAL { ?item wdt:P1712 ?mc. }`
            + ` OPTIONAL { ?item wdt:P4947 ?tmdbMovie. }`
            + ` OPTIONAL { ?item wdt:P4983 ?tmdbTv. }`
            + ` } LIMIT 1`;
    }

    function normalizeExternalId(kind, value) {
        const raw = String(value ?? '').trim().replace(/^\/+|\/+$/g, '');
        const pattern = EXTERNAL_ID_PATTERNS[kind];
        if (!raw || raw.length > 128 || !pattern) return '';
        return pattern.test(raw) ? raw : '';
    }

    function parseWikidataExternalIds(responseText) {
        const raw = typeof responseText === 'string' ? responseText : '';
        if (!raw || raw.length > WIKIDATA_RESPONSE_LIMIT) return {};
        let payload = null;
        try { payload = JSON.parse(raw); } catch { return {}; }
        const row = payload?.results?.bindings?.[0];
        if (!row || typeof row !== 'object') return {};
        const read = key => (row[key] && typeof row[key].value === 'string' ? row[key].value : '');
        const ids = {};
        const rt = normalizeExternalId('rt', read('rt'));
        if (rt) ids.rt = rt;
        const metacritic = normalizeExternalId('metacritic', read('mc'));
        if (metacritic) ids.metacritic = metacritic;
        const tmdbMovie = read('tmdbMovie');
        const tmdbTv = read('tmdbTv');
        const tmdb = normalizeExternalId('tmdb', tmdbMovie ? `movie/${tmdbMovie}` : tmdbTv ? `tv/${tmdbTv}` : '');
        if (tmdb) ids.tmdb = tmdb;
        return ids;
    }

    /* The score features run in parallel and each resolves the same title, so without
       this the page issues one identical SPARQL query per consumer. The shared promise
       deliberately carries no feature guard — identifiers belong to the title, not to
       whichever widget asked first — and each caller re-checks its own lifecycle after
       awaiting. */
    const pendingExternalIdLookups = new Map();

    async function fetchExternalIds(query, cacheKey) {
        try {
            const res = await httpGet(`${WIKIDATA_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`, {
                headers: { Accept:'application/sparql-results+json' },
                cancelOnRouteChange: true,
            });
            const ids = parseWikidataExternalIds(res.responseText);
            if (Object.keys(ids).length) cacheSet(cacheKey, ids, WIKIDATA_ID_TTL);
            else cacheSetUnavailable(cacheKey);
            return ids;
        } catch {
            return {};
        }
    }

    async function resolveExternalIds(imdbId, isCurrent = () => true) {
        const query = buildWikidataIdQuery(imdbId);
        if (!query) return {};
        const cacheKey = 'xid_' + imdbId;
        const cached = cacheGet(cacheKey);
        if (cached) return cached.unavailable ? {} : cached;
        let pending = pendingExternalIdLookups.get(imdbId);
        if (!pending) {
            pending = fetchExternalIds(query, cacheKey)
                .finally(() => pendingExternalIdLookups.delete(imdbId));
            pendingExternalIdLookups.set(imdbId, pending);
        }
        const ids = await pending;
        return isCurrent() ? ids : {};
    }

    /* Slugs share prefixes — `movie/the-matrix` is a substring of
       `movie/the-matrix-remake` — so a mapped identifier only counts when it
       occupies whole path segments. */
    function metacriticUrlUsesSlug(url, slug) {
        const path = String(url || '').slice(0, 512);
        if (!path || !slug) return false;
        const normalized = `/${path.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+/, '')}`;
        return normalized.startsWith(`/${slug}/`) || normalized === `/${slug}`;
    }

    function selectMetacriticResult(items, title, year, type = 'movie', mappedSlug = '') {
        if (!Array.isArray(items)) return null;
        const wantedTitle = normalizeLookupTitle(title);
        const expectedType = type === 'tv' ? 'show' : 'movie';
        const exact = items.slice(0, EXTERNAL_RESULT_SCAN_LIMIT).filter(item =>
            normalizeLookupTitle(item?.title) === wantedTitle
            && String(item?.type || '').toLowerCase() === expectedType
        );
        const slug = normalizeExternalId('metacritic', mappedSlug);
        if (slug) {
            const bySlug = exact.find(item => metacriticUrlUsesSlug(item?.criticScoreSummary?.url, slug));
            if (bySlug) return bySlug;
        }
        const wantedYear = Number(year) || 0;
        if (!wantedYear) return exact.length === 1 ? exact[0] : null;
        const yearMatch = exact.find(item => {
            const itemYear = Number(yearFromText(item?.releaseDate || item?.premiereDate || item?.year)) || 0;
            return itemYear && Math.abs(itemYear - wantedYear) <= 1;
        });
        return yearMatch || null;
    }

    function getMetacriticSearchUrl(title, type = 'movie') {
        const typeId = type === 'tv' ? '1' : '2';
        return `https://backend.metacritic.com/finder/metacritic/search/${encodeURIComponent(title || '')}/web?componentName=search-tabs&componentDisplayName=Search+Page+Tab+Filters&componentType=FilterConfig&mcoTypeId=${typeId}&offset=0&limit=10`;
    }

    function collectMetacriticCandidates(items, type = 'movie') {
        if (!Array.isArray(items)) return [];
        const expectedType = type === 'tv' ? 'show' : 'movie';
        const candidates = [];
        for (const item of items.slice(0, EXTERNAL_RESULT_SCAN_LIMIT)) {
            if (String(item?.type || '').toLowerCase() !== expectedType) continue;
            const title = String(item?.title || '').trim();
            if (!title) continue;
            const fallbackUrl = `https://www.metacritic.com/search/${encodeURIComponent(title)}/`;
            let candidateUrl = fallbackUrl;
            if (item?.criticScoreSummary?.url) {
                try {
                    candidateUrl = new URL(
                        String(item.criticScoreSummary.url).replace('/critic-reviews/', '/'),
                        'https://www.metacritic.com'
                    ).href;
                } catch { /* retain the trusted search URL, which normalization rejects as a correction */ }
            }
            const url = normalizeScoreCorrectionUrl('metacritic', candidateUrl);
            if (!url) continue;
            const score = boundedScore(item?.criticScoreSummary?.score, 100);
            const userScore = boundedScore(item?.userScoreSummary?.score, 10);
            const year = Number(yearFromText(item?.releaseDate || item?.premiereDate || item?.year)) || 0;
            const detail = [
                score !== null ? `${score}/100` : '',
                userScore !== null ? `user ${userScore.toFixed(1)}` : '',
            ].filter(Boolean).join(', ');
            candidates.push({ title, year, url, score, userScore, detail });
        }
        return candidates;
    }

    function isMatchingTitleIdentity(candidate, title, year) {
        if (normalizeLookupTitle(candidate?.title) !== normalizeLookupTitle(title)) return false;
        const wantedYear = Number(year) || 0;
        const candidateYear = Number(candidate?.year) || 0;
        return !wantedYear || Boolean(candidateYear) && Math.abs(candidateYear - wantedYear) <= 1;
    }

    /* AniList answers a search with an array of anime, and the one that comes back first
       is not necessarily the one on screen: searching "Akira" returns the 1988 film, an
       unaired remake, and an unrelated OVA whose title merely contains the word. Each
       candidate is checked against the title and year the page already knows, and a title
       is allowed to match on either of the two names AniList carries, because it lists
       "Spirited Away" only as its English title and "Sen to Chihiro no Kamikakushi" as
       its romaji one.

       averageScore is a percentage and is null for anything unrated, which is normal for
       a title that has not aired; that is an absent answer, not a zero. */
    const ANILIST_RESULT_LIMIT = 5;
    function parseAniListSearch(payload, title, year) {
        const media = payload?.data?.Page?.media;
        if (!Array.isArray(media)) return null;
        for (let index = 0; index < media.length && index < ANILIST_RESULT_LIMIT; index++) {
            const entry = media[index];
            if (!entry || typeof entry !== 'object') continue;
            const names = [entry.title?.romaji, entry.title?.english];
            const candidateYear = Number(entry.seasonYear) || Number(entry.startDate?.year) || 0;
            if (!names.some(name => name && isMatchingTitleIdentity({ title:name, year:candidateYear }, title, year))) continue;
            const score = boundedScore(entry.averageScore, 100);
            if (score === null) continue;
            return {
                score,
                url: normalizeTrustedUrl(entry.siteUrl, 'anilist.co', ''),
            };
        }
        return null;
    }

    /* Pulls one numeric field out of a named object in Rotten Tomatoes' embedded score
       payload. The character class excludes braces and the length is bounded, so the
       match cannot wander into a neighbouring object or backtrack catastrophically on a
       200 KB page. */
    function readRTScoreField(source, objectKey, field) {
        const pattern = new RegExp(`"${objectKey}"\\s*:\\s*\\{[^{}]{0,800}?"${field}"\\s*:\\s*"?(\\d{1,3})"?`, 'i');
        return boundedScore(pattern.exec(String(source || ''))?.[1], 100);
    }

    function parseRTDetailPage(html, title, year, type = 'movie', fallbackUrl = '', allowIdentityOverride = false) {
        const source = toBoundedText(html, EXTERNAL_RESPONSE_TEXT_LIMIT);
        if (!source) return null;
        const expectedType = type === 'tv' ? 'tv' : 'movie';
        let detail = null;
        const scripts = source.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>\s*([\s\S]*?)<\/script>/gi);
        let inspectedScripts = 0;
        for (const script of scripts) {
            if (inspectedScripts >= STRUCTURED_DATA_SCRIPT_LIMIT) break;
            inspectedScripts += 1;
            try {
                const scriptText = toBoundedText(script[1], STRUCTURED_DATA_TEXT_LIMIT);
                if (!scriptText) continue;
                const parsed = JSON.parse(scriptText);
                const queue = [parsed];
                for (let index = 0; index < queue.length && index < EXTERNAL_STRUCTURED_DATA_NODE_LIMIT; index++) {
                    const item = queue[index];
                    if (!item || typeof item !== 'object') continue;
                    if (Array.isArray(item)) {
                        appendBoundedObjectChildren(queue, item, EXTERNAL_STRUCTURED_DATA_NODE_LIMIT);
                        continue;
                    }
                    const types = getBoundedStructuredStrings(item['@type'], STRUCTURED_DATA_TYPE_LIMIT);
                    const itemType = types.includes('Movie') ? 'movie'
                        : types.some(value => ['TVSeries', 'TVShow'].includes(value)) ? 'tv'
                            : '';
                    if (itemType === expectedType && (allowIdentityOverride || isMatchingTitleIdentity({
                        title:item.name,
                        year:Number(yearFromText(item.dateCreated || item.datePublished || item.startDate)) || 0,
                    }, title, year))) {
                        detail = item;
                        break;
                    }
                    appendBoundedObjectChildren(queue, item, EXTERNAL_STRUCTURED_DATA_NODE_LIMIT);
                }
            } catch { /* inspect the next structured-data block */ }
            if (detail) break;
        }
        if (!detail) return null;

        const aggregate = boundedScore(detail.aggregateRating?.ratingValue, 100);
        let tomatometer = aggregate === null ? null : Math.round(aggregate);
        const scoreMatch = source.match(/tomatometer[^}]*?"value"\s*:\s*(\d+)/i);
        if (tomatometer === null && scoreMatch) {
            const value = boundedScore(scoreMatch[1], 100);
            if (value !== null) tomatometer = value;
        }
        /* Read from the score payload Rotten Tomatoes actually ships. Measured against
           the live page on 2026-08-31, the shape is

             "audienceScore":{"averageRating":"3.6",…,"score":"85","sentiment":"POSITIVE"}
             "criticsScore":{"certified":true,"score":"83","sentiment":…}

           so the field is `score`, not `value`. The previous pattern looked for "value"
           and therefore never matched: the audience half of this widget has been quietly
           absent rather than merely unavailable for some titles. */
        const audience = readRTScoreField(source, 'audienceScore', 'score');
        // Critics from the same payload as a fallback where JSON-LD carried no rating.
        if (tomatometer === null) tomatometer = readRTScoreField(source, 'criticsScore', 'score');
        if (tomatometer === null) return null;
        const consensusMatch = source.match(/critics-consensus[^>]*>([^<]+)</i)
            || source.match(/"criticsConsensus"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
        const consensus = consensusMatch
            ? decodeHTML(consensusMatch[1]).replace(/\\"/g, '"').trim().slice(0, 500)
            : null;
        let candidateUrl = fallbackUrl;
        try { candidateUrl = new URL(detail.url || fallbackUrl, 'https://www.rottentomatoes.com').href; }
        catch { /* retain the trusted request URL */ }
        const url = normalizeTrustedUrl(candidateUrl, 'rottentomatoes.com', fallbackUrl);
        return { tomatometer, audience, consensus, url };
    }

    function parseLetterboxdDetailPage(html, title, year, fallbackUrl, allowIdentityOverride = false) {
        const source = toBoundedText(html, EXTERNAL_RESPONSE_TEXT_LIMIT);
        if (!source) return null;
        let detail = null;
        const scripts = source.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>\s*([\s\S]*?)<\/script>/gi);
        let inspectedScripts = 0;
        for (const script of scripts) {
            if (inspectedScripts >= STRUCTURED_DATA_SCRIPT_LIMIT) break;
            inspectedScripts += 1;
            try {
                const scriptText = toBoundedText(script[1], STRUCTURED_DATA_TEXT_LIMIT);
                if (!scriptText) continue;
                const parsed = JSON.parse(scriptText);
                const queue = [parsed];
                for (let index = 0; index < queue.length && index < EXTERNAL_STRUCTURED_DATA_NODE_LIMIT; index++) {
                    const item = queue[index];
                    if (!item || typeof item !== 'object') continue;
                    if (Array.isArray(item)) {
                        appendBoundedObjectChildren(queue, item, EXTERNAL_STRUCTURED_DATA_NODE_LIMIT);
                        continue;
                    }
                    const types = getBoundedStructuredStrings(item['@type'], STRUCTURED_DATA_TYPE_LIMIT);
                    if (types.includes('Movie') && (allowIdentityOverride || isMatchingTitleIdentity({
                        title:item.name,
                        year:Number(yearFromText(item.dateCreated || item.datePublished)) || 0,
                    }, title, year))) {
                        detail = item;
                        break;
                    }
                    appendBoundedObjectChildren(queue, item, EXTERNAL_STRUCTURED_DATA_NODE_LIMIT);
                }
            } catch { /* inspect the next structured-data block */ }
            if (detail) break;
        }
        if (!detail) return null;

        let score = boundedScore(detail.aggregateRating?.ratingValue, 5);
        if (score === null) {
            const meta = source.match(/<meta[^>]+name=["']twitter:data2["'][^>]+content=["']([^"']+)["']/i);
            score = boundedScore(parseFloat(meta?.[1]), 5);
        }
        if (score === null) return null;
        const rawCount = Number(detail.aggregateRating?.ratingCount);
        const ratingCount = Number.isSafeInteger(rawCount) && rawCount >= 0 ? rawCount : null;
        let candidateUrl = fallbackUrl;
        try { candidateUrl = new URL(detail.url || detail['@id'] || fallbackUrl, 'https://letterboxd.com').href; }
        catch { /* retain the trusted IMDb-ID lookup URL */ }
        const trusted = normalizeTrustedUrl(candidateUrl, 'letterboxd.com', fallbackUrl);
        const url = trusted && new URL(trusted).pathname.startsWith('/film/') ? trusted : fallbackUrl;
        return { score, ratingCount, url };
    }

    function parseLetterboxdSearchCandidates(html) {
        const source = toBoundedText(html, EXTERNAL_RESPONSE_TEXT_LIMIT);
        if (!source) return [];
        const candidates = [];
        const anchors = source.matchAll(/<a\b([^>]*\bhref\s*=\s*["'][^"']*\/film\/[^"']+["'][^>]*)>([\s\S]*?)<\/a>/gi);
        let inspected = 0;
        for (const anchor of anchors) {
            if (inspected >= EXTERNAL_RESULT_SCAN_LIMIT) break;
            inspected += 1;
            const rawHref = getHTMLAttribute(anchor[1], 'href');
            let absolute = '';
            try { absolute = new URL(rawHref, 'https://letterboxd.com').href; }
            catch { /* reject malformed search rows */ }
            const url = normalizeScoreCorrectionUrl('letterboxd', absolute);
            if (!url) continue;
            const image = anchor[2].match(/<img\b([^>]*)>/i);
            const rawTitle = getHTMLAttribute(anchor[1], 'data-film-name')
                || getHTMLAttribute(anchor[1], 'title')
                || getHTMLAttribute(image?.[1] || '', 'alt')
                || decodeHTML(anchor[2].replace(/<[^>]*>/g, ' '));
            const year = Number(
                getHTMLAttribute(anchor[1], 'data-film-release-year') || yearFromText(rawTitle) || yearFromText(anchor[2])
            ) || 0;
            const title = String(rawTitle || '')
                .replace(/\s*\((?:19|20)\d{2}\)\s*$/, '')
                .replace(/\s+/g, ' ')
                .trim();
            if (!title) continue;
            candidates.push({ title, year, url });
        }
        return candidates;
    }

    function getLetterboxdSearchUrl(title) {
        const slug = normalizeLookupTitle(title).replace(/\s+/g, '-').slice(0, 200);
        return `https://letterboxd.com/search/films/${encodeURIComponent(slug)}/`;
    }

    function buildLetterboxdCandidateQuery(title) {
        const cleanTitle = String(title || '')
            .replace(/[\u0000-\u001f\u007f]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 200);
        if (!cleanTitle) return '';
        const literal = JSON.stringify(cleanTitle);
        return 'SELECT ?letterboxd (MIN(YEAR(?date)) AS ?year) WHERE {'
            + ` ?item wdt:P6127 ?letterboxd; rdfs:label ${literal}@en.`
            + ' OPTIONAL { ?item wdt:P577 ?date. }'
            + ` } GROUP BY ?letterboxd LIMIT ${EXTERNAL_RESULT_SCAN_LIMIT}`;
    }

    function parseLetterboxdWikidataCandidates(responseText, title) {
        const source = toBoundedText(responseText, WIKIDATA_RESPONSE_LIMIT);
        if (!source) return [];
        let payload = null;
        try { payload = JSON.parse(source); } catch { return []; }
        const rows = Array.isArray(payload?.results?.bindings)
            ? payload.results.bindings.slice(0, EXTERNAL_RESULT_SCAN_LIMIT)
            : [];
        const candidates = [];
        const seen = new Set();
        for (const row of rows) {
            const slug = String(row?.letterboxd?.value || '').trim();
            if (!/^[a-z0-9][a-z0-9-]{0,180}$/i.test(slug)) continue;
            const url = normalizeScoreCorrectionUrl('letterboxd', `https://letterboxd.com/film/${slug}/`);
            if (!url || seen.has(url)) continue;
            seen.add(url);
            const year = normalizeUserMarkYear(row?.year?.value);
            candidates.push({
                title:String(title || '').trim().slice(0, USER_MARK_TITLE_LIMIT),
                ...(year !== null ? { year } : {}),
                url,
                detail:t('text_mapped_by_imdb_enhanced_through_wikidata'),
            });
        }
        return candidates;
    }

    function parseJustWatchSearchCandidates(html, typePath = 'movie', regionPath = '') {
        const source = toBoundedText(html, EXTERNAL_RESPONSE_TEXT_LIMIT);
        if (!source) return [];
        const activeRegionPath = regionPath || getJustWatchRegionPath();
        const candidates = [];
        const anchors = source.matchAll(/<a\b([^>]*\bclass\s*=\s*["'][^"']*title-list-row__column-header[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi);
        let inspected = 0;
        for (const anchor of anchors) {
            if (inspected >= EXTERNAL_RESULT_SCAN_LIMIT) break;
            inspected += 1;
            const rawHref = getHTMLAttribute(anchor[1], 'href');
            let candidateUrl = '';
            try { candidateUrl = new URL(rawHref, 'https://www.justwatch.com').href; } catch { /* reject malformed result URLs */ }
            const href = normalizeTrustedUrl(candidateUrl, 'justwatch.com', '');
            if (!href) continue;
            const path = new URL(href).pathname;
            if (!path.startsWith(`/${String(activeRegionPath || 'us').toLowerCase()}/${typePath}/`)) continue;
            const titleMatch = anchor[2].match(/<span\b[^>]*\bclass\s*=\s*["'][^"']*header-title[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
            if (!titleMatch) continue;
            const yearMatch = anchor[2].match(/<span\b[^>]*\bclass\s*=\s*["'][^"']*header-year[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
            candidates.push({
                title:decodeHTML(titleMatch[1].replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim(),
                year:Number(yearFromText(yearMatch?.[1])) || 0,
                url:href,
            });
        }
        return candidates;
    }

    function parseJustWatchSearchResult(html, title, year, typePath = 'movie', regionPath = getJustWatchRegionPath()) {
        const candidates = parseJustWatchSearchCandidates(html, typePath, regionPath);
        const exact = candidates.filter(candidate => isMatchingTitleIdentity(candidate, title, year));
        return exact.length === 1 ? exact[0].url : '';
    }

    function parseJustWatchIdentity(html) {
        const source = toBoundedText(html, EXTERNAL_RESPONSE_TEXT_LIMIT);
        if (!source) return null;
        const scripts = source.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>\s*([\s\S]*?)<\/script>/gi);
        let inspectedScripts = 0;
        for (const script of scripts) {
            if (inspectedScripts >= STRUCTURED_DATA_SCRIPT_LIMIT) break;
            inspectedScripts += 1;
            try {
                const scriptText = toBoundedText(script[1], STRUCTURED_DATA_TEXT_LIMIT);
                if (!scriptText) continue;
                const parsed = JSON.parse(scriptText);
                const roots = Array.isArray(parsed) ? parsed.slice(0, EXTERNAL_RESULT_SCAN_LIMIT) : [parsed];
                for (const item of roots) {
                    const types = getBoundedStructuredStrings(item?.['@type'], STRUCTURED_DATA_TYPE_LIMIT);
                    const type = types.includes('Movie') ? 'movie'
                        : types.some(value => ['TVSeries', 'TVShow'].includes(value)) ? 'tv-show'
                            : '';
                    if (!type || !item?.name) continue;
                    return {
                        title:String(item.name),
                        year:Number(yearFromText(item.dateCreated || item.datePublished || item.startDate)) || 0,
                        type,
                    };
                }
            } catch { /* inspect the next structured-data block */ }
        }
        return null;
    }

    function collectJustWatchProviderNames(root, maxNodes = 2000, maxProviders = 50) {
        const providers = [];
        const queue = [root];
        const add = value => {
            const name = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 120);
            if (name && !providers.some(existing => existing.toLowerCase() === name.toLowerCase())) providers.push(name);
        };
        for (let index = 0; index < queue.length && index < maxNodes && providers.length < maxProviders; index++) {
            const node = queue[index];
            if (!node || typeof node !== 'object') continue;
            if (Array.isArray(node)) {
                node.slice(0, Math.max(0, maxNodes - queue.length)).forEach(value => queue.push(value));
                continue;
            }
            const offeredBy = node.offeredBy;
            if (Array.isArray(offeredBy)) {
                let inspectedOffers = 0;
                for (const item of offeredBy) {
                    if (providers.length >= maxProviders || inspectedOffers >= maxProviders) break;
                    inspectedOffers += 1;
                    add(item?.name);
                }
            }
            else add(offeredBy?.name);
            appendBoundedObjectChildren(queue, node, maxNodes);
        }
        return providers.slice(0, maxProviders);
    }

    /* TMDB's watch-provider data, read through their documented API rather than by
       parsing anyone's page. Two calls: /find resolves the IMDb id the page already
       carries into a TMDB id, then /watch/providers returns offers grouped by country.
       The IMDb id is the only thing sent, so unlike the page-parsing sources there is no
       title matching to get wrong. Verified against the published API reference on
       2026-08-31: auth is a bearer token, /3/find/{external_id}?external_source=imdb_id
       answers with movie_results / tv_results / tv_episode_results, and
       /3/{type}/{id}/watch/providers answers with results keyed by country, each holding
       link plus flatrate / rent / buy / ads arrays of { provider_name }. */
    const TMDB_API_ORIGIN = 'https://api.themoviedb.org';
    const AVAILABILITY_REGION_PATTERN = /^[A-Z]{2}$/;
    // Matches the page-parsing path's ceiling so both sources are bounded the same way.
    const TMDB_MAX_PROVIDERS = 50;

    function getAvailabilitySource() {
        return get('availabilitySource') === 'tmdb' ? 'tmdb' : 'justwatch';
    }
    function getAvailabilityRegion() {
        const stored = String(get('availabilityRegion') || '').trim().toUpperCase();
        return AVAILABILITY_REGION_PATTERN.test(stored) ? stored : 'US';
    }
    function getAvailabilityCacheKey(imdbId, source = getEffectiveAvailabilitySource(), region = getAvailabilityRegion()) {
        const normalizedSource = source === 'tmdb' ? 'tmdb' : 'justwatch';
        const candidateRegion = String(region || '').trim().toUpperCase();
        const normalizedRegion = AVAILABILITY_REGION_PATTERN.test(candidateRegion) ? candidateRegion : 'US';
        return `availability_${normalizedSource}_${normalizedRegion}_${imdbId}`;
    }
    function readTmdbToken() {
        return readCredential('tmdbReadToken');
    }
    function isTmdbConfigured() {
        return readTmdbToken().configured;
    }

    /* Picks the TMDB record for the IMDb id. An id resolves to exactly one thing, so
       anything other than a single unambiguous hit is treated as no answer rather than
       guessed at: showing the wrong title's streaming services is worse than showing
       none. tv_episode_results is deliberately ignored — an episode has no offers of its
       own and TMDB answers for the series instead, which would be a different title. */
    function parseTmdbFind(payload) {
        if (!payload || typeof payload !== 'object') return null;
        const movies = Array.isArray(payload.movie_results) ? payload.movie_results : [];
        const shows = Array.isArray(payload.tv_results) ? payload.tv_results : [];
        /* The id has to already be a number. Coercing meant `true` became 1 and `"12"`
           became 12, either of which would have addressed a real but different title. */
        const candidates = [
            ...movies.map(entry => ({ type:'movie', id:entry?.id })),
            ...shows.map(entry => ({ type:'tv', id:entry?.id })),
        ];
        /* Ambiguity is judged before anything is discarded. Filtering first let a malformed
           sibling be dropped rather than counted, so two answers became one and the id that
           happened to parse was used. Two results are two results. */
        if (candidates.length !== 1) return null;
        const [only] = candidates;
        if (typeof only.id !== 'number' || !Number.isInteger(only.id) || only.id <= 0) return null;
        return only;
    }

    // Streaming, renting and buying are three different answers to "can I watch this".
    function emptyOffers() {
        return { stream:[], rent:[], buy:[] };
    }

    /* Offers for one region only. TMDB returns every country it knows, and rendering
       another country's services as though they were yours is the failure this avoids. */
    function parseTmdbWatchProviders(payload, region) {
        if (!payload || typeof payload !== 'object') return null;
        const results = payload.results;
        if (!results || typeof results !== 'object') return null;
        const local = results[region];
        if (!local || typeof local !== 'object') return { providers:[], offers:emptyOffers(), url:'', region };
        const names = [];
        // Same bounds the page-parsing path already applies, so a large or hostile
        // response cannot reach the renderer through the newer of the two sources.
        const add = value => {
            const name = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 120);
            if (name && !names.some(existing => existing.toLowerCase() === name.toLowerCase())) names.push(name);
        };
        // Subscription first, then ad-supported: both are "already included", which is
        // what the summary line answers. Rent and buy are a different question.
        /* One ceiling, counted across both buckets. Slicing each bucket as well looked
           like a second bound but enforced nothing the first did not, so removing either
           left the other holding and neither was ever really under test. */
        /* Kept apart, because "included with something you may already pay for" and "costs
           money today" are different answers and the panel used to flatten them into one
           line. The streaming list stays first because it is the one most people want. */
        const offers = emptyOffers();
        [['flatrate', 'stream'], ['ads', 'stream'], ['rent', 'rent'], ['buy', 'buy']].forEach(([bucket, kind]) => {
            const listed = Array.isArray(local[bucket]) ? local[bucket] : [];
            for (const offer of listed) {
                if (names.length >= TMDB_MAX_PROVIDERS) break;
                const before = names.length;
                add(offer?.provider_name);
                // Recorded under its kind only when it is new overall, so one service
                // offering a title three ways is counted once.
                if (names.length > before) offers[kind].push(names[names.length - 1]);
            }
        });
        const url = typeof local.link === 'string' ? local.link : '';
        // No trailing slice: the ceiling is enforced as names are added, and a second one
        // here only looked like a bound while asserting nothing.
        // `providers` remains the streaming list, which is what every existing caller reads.
        return { providers:offers.stream, offers, url, region };
    }

    /* OMDb returns IMDb, Rotten Tomatoes and Metacritic ratings for one IMDb id in a
       single documented call, so both score widgets share one request and one cache
       entry rather than asking twice. The key is the user's own, free from omdbapi.com,
       and rate-limited to 1,000 lookups a day, which is another reason not to ask twice. */
    const OMDB_API_ORIGIN = 'https://www.omdbapi.com';

    function readOmdbKey() { return readCredential('omdbApiKey'); }
    function isOmdbConfigured() { return readOmdbKey().configured; }

    /* Their Ratings array carries the source name and a formatted value: "83%" for
       Rotten Tomatoes, "73/100" for Metacritic. Read by source name rather than by
       position, because the array omits a source it has nothing for. */
    function parseOmdbRatings(payload) {
        if (!payload || typeof payload !== 'object') return null;
        if (String(payload.Response) === 'False') return null;
        const ratings = Array.isArray(payload.Ratings) ? payload.Ratings.slice(0, 20) : [];
        const valueFor = source => {
            const entry = ratings.find(item => String(item?.Source || '') === source);
            return typeof entry?.Value === 'string' ? entry.Value : '';
        };
        const percent = /^(\d{1,3})%$/.exec(valueFor('Rotten Tomatoes').trim());
        const outOfHundred = /^(\d{1,3})\/100$/.exec(valueFor('Metacritic').trim());
        const metascore = /^\d{1,3}$/.test(String(payload.Metascore || '').trim())
            ? Number(payload.Metascore)
            : null;
        return {
            rt: percent ? boundedScore(Number(percent[1]), 100) : null,
            metacritic: outOfHundred ? boundedScore(Number(outOfHundred[1]), 100) : boundedScore(metascore, 100),
        };
    }

    async function fetchOmdbRatings(imdbId, isCurrent) {
        const key = readOmdbKey();
        if (!key.configured) return { unconfigured:true };
        const cacheKey = 'omdb_' + imdbId;
        const cached = cacheGet(cacheKey);
        if (cached) return cached;
        /* Under a script manager the value is readable here and goes on the URL. In an
           extension build it is not: only the stored key's name travels, and the worker
           puts the value into the query string of a request it has already validated as
           OMDb's. Their API accepts a key nowhere else. */
        const requestUrl = `${OMDB_API_ORIGIN}/?i=${encodeURIComponent(imdbId)}`
            + (key.value ? `&apikey=${encodeURIComponent(key.value)}` : '');
        let response;
        try {
            response = await httpGet(requestUrl, {
                credentialQuery: { name:'apikey', ref:key.ref },
                timeout: 12000,
                cancelOnRouteChange: true,
            });
        } catch (error) {
            const status = Number(error?.status);
            if (status === 401 || status === 403) return { rejected:true };
            throw error;
        }
        if (!isCurrent()) return null;
        if (typeof response?.finalUrl === 'string' && response.finalUrl
            && !normalizeTrustedUrl(response.finalUrl, 'omdbapi.com', '')) {
            return { empty:true };
        }
        const parsed = parseOmdbRatings(parseJSONResponse(response));
        if (!parsed) return { empty:true };
        cacheSet(cacheKey, parsed, PROVIDERS.omdb.ttl);
        return parsed;
    }

    /* IE-118: when a film reaches the shops is a question IMDb does not answer above the
       fold, and TMDB does. The type codes are theirs and documented: 4 is digital, 5 is
       physical. The earliest of each is the one worth reporting, because a re-release
       years later is not the answer to "when can I watch this at home".

       Movies only. There is no release_dates endpoint for a series, so nothing is asked
       for one and nothing is claimed about it. */
    const TMDB_RELEASE_DIGITAL = 4;
    const TMDB_RELEASE_PHYSICAL = 5;
    const TMDB_RELEASE_COUNTRY_LIMIT = 300;
    const TMDB_RELEASE_ENTRY_LIMIT = 40;

    /* Drawn on both the widget that lists offers and the one that says there are none.
       "Nothing is streaming it, and it came out digitally in 2006" is the case where the
       date is worth most, and it was the one branch that could not show it.

       Each key is written out rather than looped over a pair, because a catalog key the
       gate cannot see in the source is a key it reports as unused. */
    function appendReleaseDates(widget, data) {
        const releases = data?.releases && typeof data.releases === 'object' ? data.releases : null;
        if (!releases) return;
        if (normalizeViewingDate(releases.digital)) {
            widget.appendChild(makeEl('div', { className: 'enh-score-widget__sub' },
                t('text_digital_release', [releases.digital])));
        }
        if (normalizeViewingDate(releases.physical)) {
            widget.appendChild(makeEl('div', { className: 'enh-score-widget__sub' },
                t('text_physical_release', [releases.physical])));
        }
    }

    function parseTmdbReleaseDates(json, region) {
        if (!json || typeof json !== 'object') return null;
        const wanted = String(region || '').trim().toUpperCase();
        if (!AVAILABILITY_REGION_PATTERN.test(wanted)) return null;
        const countries = Array.isArray(json.results) ? json.results : [];
        const found = countries
            .slice(0, TMDB_RELEASE_COUNTRY_LIMIT)
            .find(entry => String(entry?.iso_3166_1 || '').toUpperCase() === wanted);
        if (!found) return null;
        const releases = {};
        const entries = Array.isArray(found.release_dates) ? found.release_dates : [];
        entries.slice(0, TMDB_RELEASE_ENTRY_LIMIT).forEach(entry => {
            const kind = Number(entry?.type) === TMDB_RELEASE_DIGITAL ? 'digital'
                : Number(entry?.type) === TMDB_RELEASE_PHYSICAL ? 'physical' : '';
            if (!kind) return;
            // Their dates carry a time and a zone; the day is the whole of the answer.
            const date = normalizeViewingDate(String(entry?.release_date || '').slice(0, 10));
            if (!date) return;
            if (!releases[kind] || date < releases[kind]) releases[kind] = date;
        });
        return Object.keys(releases).length ? releases : null;
    }

    async function fetchTmdbAvailability(imdbId, isCurrent) {
        const token = readTmdbToken();
        if (!token.configured) return { unconfigured:true };
        const region = getAvailabilityRegion();
        /* Under a script manager the value is readable here and goes straight on the
           request. In an extension build it is not: only the header name and which stored
           key travel, and the worker attaches the value under the scheme its own binding
           declares. The same two shapes the local-service calls already use. */
        const headers = {
            Accept: 'application/json',
            ...(token.value ? { Authorization: `Bearer ${token.value}` } : {}),
        };
        const request = path => httpGet(`${TMDB_API_ORIGIN}${path}`, {
            headers,
            credentialHeader: { name:'Authorization', ref:token.ref },
            timeout: 12000,
            cancelOnRouteChange: true,
        });

        /* A token TMDB rejects comes back 401 or 403. Left to the generic path it read as
           "availability unavailable", which sends someone looking at the wrong thing: the
           service is fine and the token is the part they can fix. */
        const ask = async path => {
            try { return await request(path); }
            catch (error) {
                const status = Number(error?.status);
                if (status === 401 || status === 403) {
                    throw Object.assign(error, { tmdbRejected:true });
                }
                throw error;
            }
        };

        const found = parseTmdbFind(parseJSONResponse(
            await ask(`/3/find/${encodeURIComponent(imdbId)}?external_source=imdb_id`),
            EXTERNAL_RESPONSE_TEXT_LIMIT));
        if (!isCurrent()) return { cancelled:true };
        if (!found) return { providers:[], url:'', region };

        const offers = parseTmdbWatchProviders(parseJSONResponse(
            await ask(`/3/${found.type}/${found.id}/watch/providers`),
            EXTERNAL_RESPONSE_TEXT_LIMIT), region);
        if (!isCurrent()) return { cancelled:true };
        const answer = offers || { providers:[], url:'', region };

        /* One more request, and only for a film: a series has no release_dates endpoint.
           A failure here is not a failure of the answer above, so it is swallowed rather
           than turning a working availability panel into an error. */
        if (found.type === 'movie') {
            try {
                const releases = parseTmdbReleaseDates(parseJSONResponse(
                    await ask(`/3/movie/${found.id}/release_dates`),
                    EXTERNAL_RESPONSE_TEXT_LIMIT), region);
                if (!isCurrent()) return { cancelled:true };
                if (releases) answer.releases = releases;
            } catch { /* the offers stand on their own */ }
        }
        return answer;
    }

    function parseJustWatchAvailability(html, url, expected, allowIdentityOverride = false) {
        if (!html) return null;
        const source = toBoundedText(html, EXTERNAL_RESPONSE_TEXT_LIMIT);
        if (!source) return null;
        const identity = parseJustWatchIdentity(source);
        if (!identity || identity.type !== expected.typePath
            || (!allowIdentityOverride && !isMatchingTitleIdentity(identity, expected.title, expected.year))) {
            return null;
        }
        const providers = [];
        const addProviders = values => {
            for (const value of values || []) {
                if (providers.length >= 50) break;
                providers.push(value);
            }
        };

        const metaTag = source.match(/<meta[^>]+name=["']description["'][^>]*>/i)?.[0] || '';
        const content = metaTag.match(/\scontent=["']([^"']+)["']/i)?.[1] || '';
        const desc = decodeHTML(content);
        const availability = desc.match(/\bonline on (.+?) today\b/i)?.[1];
        if (availability) {
            addProviders(availability
                .replace(/\s+[–-]\s+including.*$/i, '')
                .replace(/\bincluding.*$/i, '')
                .replace(/\s*,?\s+and\s+/gi, ',')
                .split(',')
                .map(name => name.trim())
                .filter(Boolean));
        }

        const ldScripts = source.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>\s*([\s\S]*?)<\/script>/gi);
        let inspectedScripts = 0;
        for (const script of ldScripts) {
            if (inspectedScripts >= STRUCTURED_DATA_SCRIPT_LIMIT || providers.length >= 50) break;
            inspectedScripts += 1;
            try {
                const scriptText = toBoundedText(script[1], STRUCTURED_DATA_TEXT_LIMIT);
                if (!scriptText) continue;
                addProviders(collectJustWatchProviderNames(JSON.parse(scriptText), 2000, 50 - providers.length));
            } catch { /* ignore malformed structured data */ }
        }

        const unique = compactProviders(providers, 12).providers;
        return unique.length ? { providers:unique, url } : null;
    }

    reg({
        key: 'ratingColorCoding', name: t('feature_ratingColorCoding_name'), group: 'Appearance',
        init() {
            const isCurrent = createFeatureGuard(this);
            addCSS(`
                [data-testid="hero-rating-bar__aggregate-rating"].enh-rating-colorized
                [data-testid="hero-rating-bar__aggregate-rating__score"] span:first-child {
                    color: var(--enh-rating-score-color) !important;
                    text-shadow: var(--enh-rating-score-shadow) !important;
                }
                #enh-rating-badge {
                    display: inline-block;
                    font-size: 10px;
                    font-weight: 700;
                    padding: 2px 8px;
                    border-radius: 4px;
                    margin-left: 6px;
                    vertical-align: middle;
                    background: var(--enh-rating-badge-bg);
                    color: var(--enh-rating-badge-text);
                    letter-spacing: .03em;
                }
            `, 'enh-ratingColor');
            waitFor('[data-testid="hero-rating-bar__aggregate-rating__score"]').then(el => {
                if (!isCurrent()) return;
                const rating = getIMDbRating();
                if (!rating) return;
                const c = ratingColor(rating);
                const container = el.closest('[data-testid="hero-rating-bar__aggregate-rating"]') || el;
                container.classList.add('enh-rating-colorized');
                container.style.setProperty('--enh-rating-score-color', c.bg);
                container.style.setProperty('--enh-rating-score-shadow', `0 0 20px ${c.bg}44`);
                container.style.setProperty('--enh-rating-badge-bg', c.bg);
                container.style.setProperty('--enh-rating-badge-text', c.text);
                if (!document.getElementById('enh-rating-badge')) {
                    const badge = document.createElement('span');
                    badge.id = 'enh-rating-badge';
                    badge.textContent = c.label;
                    el.appendChild(badge);
                }
            }).catch(() => {});
        },
        destroy() {
            removeCSS('enh-ratingColor');
            document.getElementById('enh-rating-badge')?.remove();
            document.querySelectorAll('.enh-rating-colorized').forEach(el => {
                el.classList.remove('enh-rating-colorized');
                ['--enh-rating-score-color', '--enh-rating-score-shadow', '--enh-rating-badge-bg', '--enh-rating-badge-text']
                    .forEach(prop => el.style.removeProperty(prop));
            });
        }
    });

