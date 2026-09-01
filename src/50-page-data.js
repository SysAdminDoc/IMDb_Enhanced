    // =========================================================================
    //  PAGE DATA EXTRACTION
    // =========================================================================
    function getIMDbID()   { return window.location.pathname.match(/\/(tt\d+)/)?.[1] || null; }
    function getLinkedTitleId(href) {
        try {
            const path = new URL(href, location.origin || 'https://www.imdb.com').pathname;
            return path.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?title\/(tt\d+)\/?$/i)?.[1] || '';
        } catch { return ''; }
    }
    function getTitleText() {
        return (document.querySelector('[data-testid="hero__primary-text"]') ||
                document.querySelector('h1'))?.textContent?.trim() || '';
    }

    function appendBoundedObjectChildren(queue, node, limit) {
        if (!node || typeof node !== 'object') return;
        let inspected = 0;
        for (const key in node) {
            if (queue.length >= limit || inspected >= limit) break;
            inspected += 1;
            if (!Object.prototype.hasOwnProperty.call(node, key)) continue;
            const value = node[key];
            if (value && typeof value === 'object') queue.push(value);
        }
    }

    function toBoundedText(value, limit) {
        const text = typeof value === 'string' ? value : (value == null ? '' : String(value));
        return text.length <= limit ? text : '';
    }

    function getBoundedStructuredStrings(value, itemLimit, textLimit = STRUCTURED_DATA_CLASSIFICATION_TEXT_LIMIT) {
        const values = Array.isArray(value) ? value : [value];
        const strings = [];
        let totalLength = 0;
        for (let index = 0; index < values.length && index < itemLimit && totalLength < textLimit; index++) {
            const item = values[index];
            if (typeof item !== 'string' && typeof item !== 'number') continue;
            const text = String(item).trim();
            if (!text) continue;
            const bounded = text.slice(0, textLimit - totalLength);
            strings.push(bounded);
            totalLength += bounded.length;
        }
        return strings;
    }

    function parseIMDbTitleStructuredData(scriptTexts) {
        let fallback = null;
        let inspectedScripts = 0;
        for (const text of scriptTexts || []) {
            if (inspectedScripts >= STRUCTURED_DATA_SCRIPT_LIMIT) break;
            inspectedScripts += 1;
            let parsed;
            try {
                const source = toBoundedText(text, STRUCTURED_DATA_TEXT_LIMIT);
                if (!source) continue;
                parsed = JSON.parse(source);
            }
            catch { continue; }

            const queue = [parsed];
            for (let index = 0; index < queue.length && index < STRUCTURED_DATA_NODE_LIMIT; index++) {
                const node = queue[index];
                if (!node || typeof node !== 'object') continue;
                if (!Array.isArray(node)) {
                    const types = getBoundedStructuredStrings(node['@type'], STRUCTURED_DATA_TYPE_LIMIT);
                    if (types.some(type => ['Movie', 'TVSeries', 'TVEpisode', 'TVMiniSeries'].includes(type))) return node;
                    if (!fallback && node.name && (node.aggregateRating || node.datePublished || node.startDate)) fallback = node;
                }
                appendBoundedObjectChildren(queue, node, STRUCTURED_DATA_NODE_LIMIT);
            }
        }
        return fallback || {};
    }

    let _ldData = null;
    let _ldRoute = '';
    /* Memoized against the route it was parsed from, not merely until the next init.
       init() runs about 600 ms after a pushState — 250 to notice the route changed, then
       350 more — and it used to be the only thing that cleared this. Anything reading
       structured data inside that window on a title-to-title navigation got the previous
       title's year, media type and genres, and every score source validates its match
       against that year, so a wrong answer could be cached for a week under the new
       title's id. The route key is what changed first, so it is what this keys on. */
    /* Keying on the route was necessary and not sufficient. IMDb changes the address
       first and swaps the page in afterwards, so between the two the document still holds
       the previous title's structured data — and re-parsing it under the new route key
       pinned the old year and the old media type to the new title until init ran, which
       is the same defect the memo key was meant to remove.

       So the parse has to prove it belongs here. The data carries the title's own
       address; when the id in it is not the id in the location bar, the page has not
       arrived yet and there is no answer to give. Nothing is memoized in that state, so
       the next reader parses again and gets the real thing the moment it lands. */
    function structuredDataTitleId(ld) {
        for (const candidate of [ld?.url, ld?.['@id']]) {
            const found = String(candidate || '').match(/\/(tt\d+)/)?.[1];
            if (found) return found;
        }
        return '';
    }

    function getLDData() {
        const route = getRouteKey();
        if (_ldRoute !== route) {
            _ldData = null;
            _ldRoute = route;
        }
        if (_ldData) return _ldData;
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
            .slice(0, STRUCTURED_DATA_SCRIPT_LIMIT);
        const selected = parseIMDbTitleStructuredData(scripts.map(script => script.textContent));
        if (!Object.keys(selected).length) return {};
        const wanted = getIMDbID();
        const found = structuredDataTitleId(selected);
        // Data that names another title is not this page's data.
        if (wanted && found && wanted !== found) return {};
        /* And where the check cannot be made — a route with no title id, or data that
           names none — the answer is still given but never remembered, so the next reader
           parses the page as it is then rather than as it was when somebody last looked.
           Memoizing an unverifiable parse is how the previous title followed a reader onto
           a chart page. */
        if (!wanted || !found) return selected;
        _ldData = selected;
        return _ldData;
    }

    function yearFromText(text) {
        return String(text || '').match(/\b(18|19|20)\d{2}\b/)?.[0] || '';
    }

    function getStructuredTitleYear(ld) {
        for (const candidate of [ld?.datePublished, ld?.releaseDate, ld?.startDate, ld?.dateCreated]) {
            const year = yearFromText(candidate);
            if (year) return year;
        }
        const releaseEvents = Array.isArray(ld?.releasedEvent) ? ld.releasedEvent : [ld?.releasedEvent].filter(Boolean);
        for (let index = 0; index < releaseEvents.length && index < TITLE_YEAR_RELEASE_EVENT_LIMIT; index++) {
            const event = releaseEvents[index];
            for (const candidate of [event?.startDate, event?.endDate]) {
                const year = yearFromText(candidate);
                if (year) return year;
            }
        }
        return '';
    }

    function getTitleYear() {
        const ld = getLDData();
        const structuredYear = getStructuredTitleYear(ld);
        if (structuredYear) return structuredYear;

        const inlines = document.querySelectorAll('[data-testid="hero-subnav-bar-left-block"] a, section[data-testid="hero-parent"] a[href*="releaseinfo"], main h1 ~ ul a');
        let inspectedInlines = 0;
        for (const a of inlines) {
            if (inspectedInlines >= TITLE_YEAR_INLINE_LIMIT) break;
            inspectedInlines += 1;
            const match = a.textContent.match(/\b(19|20)\d{2}\b/);
            if (match) return match[0];
        }
        const metaTitle = document.querySelector('meta[property="og:title"], meta[name="title"]')?.content;
        const fallbackSources = [
            metaTitle,
            document.querySelector('[data-testid="hero__pageTitle"]')?.textContent,
            document.querySelector('h1')?.parentElement?.textContent,
            document.title,
        ];
        for (const source of fallbackSources) {
            const year = yearFromText(source);
            if (year) return year;
        }
        return '';
    }

    function getStructuredMediaType(ld) {
        const types = getBoundedStructuredStrings(ld?.['@type'], STRUCTURED_DATA_TYPE_LIMIT);
        if (types.includes('TVEpisode') || ld?.partOfSeries || ld?.partOfSeason) return 'episode';
        if (types.includes('TVSeries') || types.includes('TVMiniSeries')) {
            if (types.includes('TVMiniSeries')) return 'miniseries';
            const classification = [
                ...getBoundedStructuredStrings(ld?.name, 1),
                ...getBoundedStructuredStrings(ld?.description, 1),
                ...getBoundedStructuredStrings(ld?.keywords, STRUCTURED_DATA_CLASSIFICATION_ITEM_LIMIT),
            ];
            return classification.some(text => /mini[-\s]?series/i.test(text)) ? 'miniseries' : 'series';
        }
        const genres = getBoundedStructuredStrings(ld?.genre, STRUCTURED_DATA_CLASSIFICATION_ITEM_LIMIT);
        if (genres.some(genre => /short/i.test(genre))) return 'short';
        return 'movie';
    }

    /* Anime is not a genre IMDb has, so nothing already on the page says a title is one.
       What it does say is that a title is animated and where it was made, and those two
       together are the definition people actually use. Both are read from the page: the
       genre list out of the structured data, and the country out of the link IMDb builds
       to its own search — an href, never the words next to it, so a Japanese or German
       IMDb says the same thing as an English one.

       Deliberately strict. A wrong yes here is a request to a service about a film that
       has no entry there, on every animated title someone opens. Pixar is animated and
       American; a live-action Japanese film is Japanese and not animated; neither is
       anime, and neither passes.

       A keyword is accepted as the second half instead of the country, because IMDb
       carries "anime" and "based on manga" as keywords on titles whose country line is a
       co-production list. Keywords are structured data, not display text. */
    const ANIME_KEYWORDS = new Set([
        'anime', 'manga', 'light novel',
        'based on anime', 'based on manga', 'based on light novel',
        'anime adaptation', 'manga adaptation',
    ]);
    const JAPAN_ORIGIN_SELECTOR = 'a[href*="country_of_origin=JP"]';

    function isAnimatedTitle(ld) {
        return getBoundedStructuredStrings(ld?.genre, STRUCTURED_DATA_CLASSIFICATION_ITEM_LIMIT)
            .some(genre => /^animation$/i.test(genre.trim()));
    }

    function hasJapaneseOrigin(root = document) {
        try { return Boolean(root?.querySelector?.(JAPAN_ORIGIN_SELECTOR)); }
        catch { return false; }
    }

    function isAnimeTitle(ld = getLDData(), root = document) {
        if (!isAnimatedTitle(ld)) return false;
        /* IMDb joins keywords with commas into one string, so the list has to be split
           back out before any of them can be compared. A keyword that merely contains
           one of these words — "parody of anime", "manga artist" — is about anime, not
           an instance of it. */
        const keywords = getBoundedStructuredStrings(ld?.keywords, STRUCTURED_DATA_CLASSIFICATION_ITEM_LIMIT)
            .flatMap(entry => String(entry).split(','))
            .map(entry => entry.trim().toLowerCase());
        if (keywords.some(keyword => ANIME_KEYWORDS.has(keyword))) return true;
        return hasJapaneseOrigin(root);
    }

    function getMediaType() {
        return getStructuredMediaType(getLDData());
    }

    function isTVType(type = getMediaType()) {
        return type === 'series' || type === 'episode' || type === 'miniseries';
    }

    function getIMDbRating() {
        const ld = getLDData();
        return ld.aggregateRating?.ratingValue || null;
    }

    function parseStructuredDurationMinutes(value) {
        const match = String(value || '').trim().match(/^PT(?:(\d{1,2})H)?(?:(\d{1,3})M)?$/i);
        if (!match || (!match[1] && !match[2])) return null;
        return normalizeUserMarkRuntime((Number(match[1] || 0) * 60) + Number(match[2] || 0));
    }
    function readCurrentTitleMarkMetadata(imdbId = getIMDbID()) {
        if (!imdbId || imdbId !== getIMDbID()) return {};
        const ld = getLDData();
        const year = normalizeUserMarkYear(getTitleYear());
        const genres = normalizeUserMarkGenres(ld?.genre);
        const imdbRating = normalizeUserMarkRating(getIMDbRating());
        const runtime = parseStructuredDurationMinutes(ld?.duration);
        /* An episode page names its series in the same structured data everything else
           here is read from, so marking an episode Seen records what it belongs to at no
           cost and with no request. */
        const series = normalizeUserMarkSeries(structuredDataTitleId(ld?.partOfSeries));
        return {
            ...(year !== null ? { year } : {}),
            ...(genres.length ? { genres } : {}),
            ...(imdbRating !== null ? { imdbRating } : {}),
            ...(runtime !== null ? { runtime } : {}),
            ...(series && series !== imdbId ? { series } : {}),
        };
    }

