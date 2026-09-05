    // =========================================================================
    //  CSV MARK IMPORT
    // =========================================================================
    function parseCsvTable(value) {
        const text = String(value || '').replace(/^\uFEFF/, '');
        if (!text.trim()) throw failure('unknown', t('error_csv_empty'));
        /* Bytes, because CSV_IMPORT_TEXT_LIMIT is a byte budget and the settings panel's
           file picker already compares it against File.size. Measuring the parsed text in
           UTF-16 code units meant one limit meant two different sizes depending on whether
           the CSV arrived as a file or as pasted text. */
        if (encodedByteLength(text) > CSV_IMPORT_TEXT_LIMIT) throw failure('unknown', t('error_csv_too_large', [CSV_IMPORT_TEXT_MB]));
        const rows = [];
        let row = [];
        let field = '';
        let quoted = false;
        const pushRow = () => {
            row.push(field);
            if (row.some(cell => String(cell).trim())) rows.push(row);
            row = [];
            field = '';
        };
        for (let index = 0; index < text.length; index += 1) {
            const character = text[index];
            if (quoted) {
                if (character === '"') {
                    if (text[index + 1] === '"') {
                        field += '"';
                        index += 1;
                    } else {
                        quoted = false;
                    }
                } else {
                    field += character;
                }
                continue;
            }
            if (character === '"') {
                if (field) throw failure('unknown', t('error_csv_stray_quote'));
                quoted = true;
            } else if (character === ',') {
                row.push(field);
                field = '';
            } else if (character === '\n' || character === '\r') {
                if (character === '\r' && text[index + 1] === '\n') index += 1;
                pushRow();
            } else {
                field += character;
            }
        }
        if (quoted) throw failure('unknown', t('error_csv_unterminated_quote'));
        if (field || row.length) pushRow();
        if (!rows.length) throw failure('unknown', t('error_csv_no_header'));
        return rows;
    }

    function normalizeCsvHeader(value) {
        return String(value || '').replace(/^\uFEFF/, '').trim().toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
    }
    function findCsvColumn(headers, names) {
        const wanted = new Set(names);
        return headers.findIndex(header => wanted.has(header));
    }
    function readCsvCell(row, index) {
        /* trim is what undoes the export's tab prefix: a field a spreadsheet would
           have evaluated is written with a leading tab, and reading it back drops it
           along with any other surrounding whitespace. A round-trip test holds that,
           which is why there is no separate unprefixing step to get wrong. */
        return index >= 0 ? String(row[index] ?? '').trim() : '';
    }
    function normalizeCsvIMDbId(value) {
        const raw = String(value || '').trim();
        const explicit = raw.match(/(?:^|\/)(tt\d+)(?:\/|$|[?#])/i);
        if (explicit) return explicit[1].toLocaleLowerCase();
        if (/^tt\d+$/i.test(raw)) return raw.toLocaleLowerCase();
        if (/^\d+$/.test(raw)) return `tt${raw.padStart(7, '0')}`;
        return '';
    }
    function normalizeCsvLookupTitle(value) {
        return String(value || '')
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLocaleLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim()
            .replace(/\s+/g, ' ');
    }
    function buildStoredTitleResolver(source) {
        const byTitle = new Map();
        const byTitleYear = new Map();
        const add = (map, key, imdbId) => {
            if (!key) return;
            if (!map.has(key)) map.set(key, imdbId);
            else if (map.get(key) !== imdbId) map.set(key, '');
        };
        normalizeUserMarkEntries(source || {}).forEach(([imdbId, mark]) => {
            const title = normalizeCsvLookupTitle(mark.title);
            if (!title) return;
            add(byTitle, title, imdbId);
            if (mark.year) add(byTitleYear, `${title}\u0000${mark.year}`, imdbId);
        });
        return {
            resolve(titleValue, yearValue) {
                const title = normalizeCsvLookupTitle(titleValue);
                if (!title) return '';
                const year = normalizeUserMarkYear(yearValue);
                return year !== null
                    ? byTitleYear.get(`${title}\u0000${year}`) || ''
                    : byTitle.get(title) || '';
            },
        };
    }
    function describeCsvColumns(headerRow) {
        const headers = headerRow.map(normalizeCsvHeader);
        let rating = null;
        headers.forEach((header, index) => {
            // Letterboxd documents that when both appear, the column appearing second
            // wins. Assignment in header order preserves that contract.
            if (header === 'yourrating' || header === 'rating10') rating = { index, scale:'ten' };
            else if (header === 'rating') rating = { index, scale:'auto' };
        });
        const constIndex = findCsvColumn(headers, ['const']);
        const imdbIdIndex = findCsvColumn(headers, ['imdbid']);
        return {
            source:constIndex >= 0 ? 'IMDb' : imdbIdIndex >= 0 ? 'Letterboxd' : 'CSV',
            imdbId:constIndex >= 0 ? constIndex : imdbIdIndex,
            title:findCsvColumn(headers, ['title', 'name']),
            originalTitle:findCsvColumn(headers, ['originaltitle']),
            year:findCsvColumn(headers, ['year', 'releaseyear']),
            rating,
            date:findCsvColumn(headers, ['daterated', 'watcheddate', 'datewatched', 'watchedon', 'date', 'timestamp']),
            /* When the mark itself was made, which is not the same question as when the
               title was watched. A Skip has the first and never the second, so without a
               column of its own the date a skip was recorded is lost on every trip. */
            marked:findCsvColumn(headers, ['markedon']),
            /* The score held against the title, as opposed to the one given at a
               particular viewing. Files from anywhere else have only one rating column,
               and it means both; this extension's own export separates them. */
            titleRating:findCsvColumn(headers, ['titlerating']),
            // Which show an episode belongs to, so a restore can still count a series.
            series:findCsvColumn(headers, ['series', 'seriesconst', 'parentconst']),
            genres:findCsvColumn(headers, ['genres', 'genre']),
            imdbRating:findCsvColumn(headers, ['imdbrating']),
            runtime:findCsvColumn(headers, ['runtimemins', 'runtimeminutes', 'runtime']),
            state:findCsvColumn(headers, ['state', 'status']),
            note:findCsvColumn(headers, ['note', 'notes', 'review']),
        };
    }
    function normalizeCsvRating(value, scale) {
        const raw = String(value || '').trim();
        if (!raw) return null;
        const numeric = Number(raw);
        if (!Number.isFinite(numeric)) return null;
        return normalizeUserMarkRating(scale === 'auto' && numeric <= 5 ? numeric * 2 : numeric);
    }
    function normalizeCsvRuntime(value) {
        const raw = String(value || '').trim();
        if (!raw) return null;
        const match = raw.match(/\d+/);
        return normalizeUserMarkRuntime(match ? Number(match[0]) : raw);
    }
    function prepareCsvMarkImport(value, currentMarks = getUserMarks(true)) {
        const rows = parseCsvTable(value);
        const columns = describeCsvColumns(rows[0]);
        if (columns.imdbId < 0 && columns.title < 0 && columns.originalTitle < 0) {
            throw failure('unknown', t('error_csv_no_usable_column'));
        }
        const existing = Object.fromEntries(normalizeUserMarkEntries(currentMarks || {}));
        const merged = { ...existing };
        const resolver = buildStoredTitleResolver(existing);
        const dataRows = rows.slice(1, CSV_IMPORT_ROW_LIMIT + 1);
        /* Counted apart from the rows this could not make sense of. A file cut short is
           an incomplete restore, and "skipped" alongside a success message read as a
           handful of bad rows rather than as titles that are simply not there. */
        const truncatedRows = Math.max(0, rows.length - 1 - dataRows.length);
        let skippedRows = 0;
        let importedRows = 0;
        let resolvedRows = 0;
        let droppedViewings = 0;
        const touched = new Set();
        const importedAt = Date.now();

        dataRows.forEach(row => {
            const title = readCsvCell(row, columns.title) || readCsvCell(row, columns.originalTitle);
            const rawYear = readCsvCell(row, columns.year);
            const year = normalizeUserMarkYear(rawYear);
            const rawDate = readCsvCell(row, columns.date);
            const date = normalizeViewingDate(rawDate);
            const rawRating = columns.rating ? readCsvCell(row, columns.rating.index) : '';
            const rating = columns.rating ? normalizeCsvRating(rawRating, columns.rating.scale) : null;
            /* The score held against the title. A file from anywhere else carries one
               rating column and it means both this and the viewing's, which is how it has
               always been read; this extension's own export separates them so a viewing
               that was never scored does not come back scored. */
            const rawTitleRating = readCsvCell(row, columns.titleRating);
            const titleRating = columns.titleRating >= 0
                ? normalizeUserMarkRating(rawTitleRating)
                : rating;
            const rawImdbRating = readCsvCell(row, columns.imdbRating);
            const imdbRating = normalizeUserMarkRating(rawImdbRating);
            const rawRuntime = readCsvCell(row, columns.runtime);
            const runtime = normalizeCsvRuntime(rawRuntime);
            const genres = normalizeUserMarkGenres(readCsvCell(row, columns.genres));
            // Written by this extension's own export, so a file it produced reads back whole.
            const note = normalizeUserNote(readCsvCell(row, columns.note));
            if ((rawYear && year === null) || (rawDate && !date) || (rawRating && rating === null)
                || (rawTitleRating && titleRating === null)
                || (rawImdbRating && imdbRating === null) || (rawRuntime && runtime === null)) {
                skippedRows += 1;
                return;
            }

            let imdbId = normalizeCsvIMDbId(readCsvCell(row, columns.imdbId));
            if (!imdbId && title) {
                imdbId = resolver.resolve(title, year);
                if (imdbId) resolvedRows += 1;
            }
            if (!imdbId) {
                skippedRows += 1;
                return;
            }

            const previous = normalizeUserMark(merged[imdbId]) || {
                v:USER_MARK_RECORD_VERSION, state:'', title:'', ts:0,
            };
            const rawState = readCsvCell(row, columns.state).toLocaleLowerCase();
            /* A file with a State column that leaves it empty is describing a title
               carrying only a note, which is a thing this extension stores. Reading that
               as watched invents a viewing nobody had. Files without the column at all,
               which is IMDb's own export and Letterboxd's, are lists of what somebody
               saw, so every row there is watched. */
            /* Only an empty cell means no state. A file whose State column says something
               this does not recognise is still a file about titles somebody watched, and
               reading "Completed" as no state at all would put the row in the store
               showing as unmarked everywhere.

               But a guess must not overwrite something known. "Want to watch" is as
               plausible a value as "Completed" and would turn a whole watchlist into
               history, over a Skip the person had made deliberately, so where a mark
               already exists an unrecognised word leaves it alone. */
            const known = rawState === 'skip' || rawState === 'skipped' ? 'skip'
                : rawState === 'watched' || rawState === 'seen' ? 'watched' : '';
            /* A file with no State column is usually a ratings or diary export, where every
               row is something the person watched. A watchlist export has the same columns
               and means the opposite, and IMDb's own has no State column either, so reading
               "no state" as watched turned a list of things somebody had not seen into a
               history of things they had. A row counts as watched only where it carries
               evidence of a viewing: a date or a rating. Without either it is recorded as a
               title, unmarked, which is what a watchlist row actually says. */
            const watchedByEvidence = date || rating !== null;
            const state = known
                || (rawState
                    ? (previous.state || 'watched')
                    : (columns.state < 0 && watchedByEvidence ? 'watched' : ''));
            /* A date is a date whatever the state says. A Skip can hold the dates
               somebody watched a thing on before deciding against it again, and dropping
               them here destroyed that history on the way back in from a file this
               extension had just written. */
            const event = date ? [{ date, ...(rating !== null ? { rating } : {}) }] : [];
            if (event.length) {
                const previousViewings = normalizeViewingEvents(previous.viewings);
                const eventKey = `${event[0].date}\u0000${event[0].rating ?? ''}`;
                const alreadyStored = previousViewings.some(viewing =>
                    `${viewing.date}\u0000${viewing.rating ?? ''}` === eventKey);
                if (!alreadyStored && previousViewings.length >= USER_MARK_VIEWINGS_MAX) droppedViewings += 1;
            }
            /* Both writers refuse to record a title as an episode of itself; a file can
               say anything, so the reader has to refuse it too. A row claiming that would
               make a series page count its own page as one of its episodes, and the value
               would survive every trip afterwards. */
            const rawSeries = normalizeUserMarkSeries(normalizeCsvIMDbId(readCsvCell(row, columns.series)));
            const series = rawSeries === imdbId ? '' : rawSeries;
            const markedOn = normalizeViewingDate(readCsvCell(row, columns.marked));
            const viewingTimestamp = markedOn ? Date.parse(`${markedOn}T12:00:00.000Z`)
                : date ? Date.parse(`${date}T12:00:00.000Z`) : importedAt;
            merged[imdbId] = {
                ...previous,
                v:USER_MARK_RECORD_VERSION,
                state,
                title:String(title || previous.title || '').trim().slice(0, USER_MARK_TITLE_LIMIT),
                ts:Math.max(Number(previous.ts) || 0, viewingTimestamp),
                ...(event.length || previous.viewings?.length
                    ? { viewings:mergeViewingEvents(previous.viewings, event) }
                    : {}),
                ...(note ? { note } : {}),
                ...(titleRating !== null ? { rating:titleRating } : {}),
                ...(year !== null ? { year } : {}),
                ...(genres.length || previous.genres?.length
                    ? { genres:normalizeUserMarkGenres([...(previous.genres || []), ...genres]) }
                    : {}),
                ...(imdbRating !== null ? { imdbRating } : {}),
                ...(runtime !== null ? { runtime } : {}),
                ...(series ? { series } : {}),
            };
            touched.add(imdbId);
            importedRows += 1;
        });

        const marks = Object.fromEntries(normalizeUserMarkEntries(merged));
        const importedTitles = [...touched].filter(imdbId => marks[imdbId]).length;
        return {
            source:columns.source,
            totalRows:rows.length - 1,
            importedRows,
            importedTitles,
            resolvedRows,
            skippedRows,
            truncatedRows,
            droppedViewings,
            droppedTitles:touched.size - importedTitles,
            marks,
        };
    }
    function describeCsvMarkImport(result) {
        if (!result?.importedRows) {
            /* A file that was cut short and one whose rows could not be read are different
               problems with different answers, and rolling them together tells somebody to
               go looking for bad rows in a file that had none. */
            if (result?.truncatedRows && !result?.skippedRows) {
                return t('text_csv_rows_past_the_limit', [result.truncatedRows]);
            }
            return tCount('text_no_importable_rows_skipped', result?.skippedRows || 0)
                + (result?.truncatedRows
                    ? t('text_clause_separator') + t('text_csv_rows_past_the_limit', [result.truncatedRows])
                    : '');
        }
        const parts = [
            tCount('text_csv_rows_across_titles', result.importedRows, [result.source, result.importedTitles]),
        ];
        if (result.resolvedRows) parts.push(t('text_csv_matched_existing', [result.resolvedRows]));
        if (result.skippedRows) parts.push(t('text_count_skipped', [result.skippedRows]));
        if (result.truncatedRows) parts.push(t('text_csv_rows_past_the_limit', [result.truncatedRows]));
        if (result.droppedViewings) {
            parts.push(tCount('text_csv_viewings_over_limit', result.droppedViewings, [USER_MARK_VIEWINGS_MAX]));
        }
        if (result.droppedTitles) parts.push(t('text_csv_titles_over_limit', [result.droppedTitles, USER_MARKS_MAX]));
        return t('text_csv_summary_nothing_changed_yet', [parts.join(t('text_clause_separator'))]);
    }

    function incrementLocalStat(map, key) {
        if (!key) return;
        map.set(key, (map.get(key) || 0) + 1);
    }
    function rankLocalStats(map, numeric = false) {
        return [...map.entries()]
            .map(([label, count]) => ({ label:String(label), count }))
            .sort((a, b) => b.count - a.count
                || (numeric ? Number.parseInt(b.label, 10) - Number.parseInt(a.label, 10) : a.label.localeCompare(b.label)))
            .slice(0, LOCAL_STATS_GROUP_LIMIT);
    }
    function summarizeLocalStats(source) {
        const entries = normalizeUserMarkEntries(source || {});
        const years = new Map();
        const genres = new Map();
        const genreLabels = new Map();
        const decades = new Map();
        let seen = 0;
        let skipped = 0;
        let viewings = 0;
        let undatedSeen = 0;
        let rated = 0;
        let ratingDeltaTotal = 0;
        let ratingPairs = 0;
        let runtimeMinutes = 0;
        let historyTitles = 0;
        let metadataTitles = 0;

        entries.forEach(([, mark]) => {
            if (mark.state === 'watched') seen += 1;
            else if (mark.state === 'skip') skipped += 1;
            const viewingEvents = normalizeViewingEvents(mark.viewings);
            viewings += viewingEvents.length;
            if (mark.state === 'watched' && !viewingEvents.length) undatedSeen += 1;
            viewingEvents.forEach(event => incrementLocalStat(years, event.date.slice(0, 4)));

            const belongsToHistory = mark.state === 'watched' || viewingEvents.length > 0;
            if (!belongsToHistory) return;
            historyTitles += 1;
            const markGenres = normalizeUserMarkGenres(mark.genres);
            markGenres.forEach(genre => {
                const key = genre.toLocaleLowerCase();
                if (!genreLabels.has(key)) genreLabels.set(key, genre);
                incrementLocalStat(genres, key);
            });
            const releaseYear = normalizeUserMarkYear(mark.year);
            if (releaseYear !== null) incrementLocalStat(decades, `${Math.floor(releaseYear / 10) * 10}s`);
            const personal = normalizeUserMarkRating(mark.rating);
            const imdb = normalizeUserMarkRating(mark.imdbRating);
            if (personal !== null) rated += 1;
            if (personal !== null && imdb !== null) {
                ratingDeltaTotal += personal - imdb;
                ratingPairs += 1;
            }
            const runtime = normalizeUserMarkRuntime(mark.runtime);
            if (runtime !== null) runtimeMinutes += runtime;
            if (markGenres.length || releaseYear !== null || imdb !== null || runtime !== null) metadataTitles += 1;
        });

        const reviewYear = [...years.entries()]
            .map(([label, count]) => ({ label:String(label), count }))
            .filter(item => item.count >= 10)
            .sort((a, b) => Number(b.label) - Number(a.label))[0] || null;
        const activity = rankLocalStats(years, true);
        return {
            records:entries.length,
            markedTitles:seen + skipped,
            seen,
            skipped,
            viewings,
            undatedSeen,
            rated,
            ratingPairs,
            ratingDelta:ratingPairs ? Math.round((ratingDeltaTotal / ratingPairs) * 100) / 100 : null,
            runtimeMinutes,
            historyTitles,
            metadataTitles,
            years:activity,
            topGenres:rankLocalStats(genres).map(item => ({ ...item, label:genreLabels.get(item.label) || item.label })),
            decades:rankLocalStats(decades, true),
            reviewYear,
        };
    }
    function normalizeSectionCollapseState(value) {
        if (!value || Array.isArray(value) || typeof value !== 'object') return {};
        const state = {};
        COLLAPSIBLE_SECTION_IDS.forEach(id => {
            if (typeof value[id] === 'boolean') state[id] = value[id];
        });
        return state;
    }
    function getSectionCollapseState() {
        const state = normalizeSectionCollapseState(get('sectionCollapseState'));
        let migrated = false;
        const legacyKeys = [];
        COLLAPSIBLE_SECTION_IDS.forEach(id => {
            const legacyKey = 'enh_coll_' + id;
            try {
                const legacy = GM_getValue(legacyKey, null);
                if (typeof legacy === 'boolean' && !(id in state)) {
                    state[id] = legacy;
                    migrated = true;
                }
                if (legacy !== null) legacyKeys.push(legacyKey);
            } catch { /* inspect remaining legacy keys */ }
        });
        if (migrated) set('sectionCollapseState', state);
        if (typeof GM_deleteValue === 'function') {
            legacyKeys.forEach(key => {
                try { GM_deleteValue(key); } catch { /* migration is already durable */ }
            });
        }
        return state;
    }
    function setSectionCollapsed(id, collapsed, notifyFailure = true) {
        if (!COLLAPSIBLE_SECTION_IDS.includes(id)) return false;
        const state = getSectionCollapseState();
        state[id] = Boolean(collapsed);
        return trySaveSetting('sectionCollapseState', state, { notify:notifyFailure });
    }

