#!/usr/bin/env node
/* Release-time destination health report.
 *
 * Destination names, URL shapes, redirects and hosts change constantly, and this project
 * has already shipped a dead default more than once. An earlier attempt at solving that
 * lived in the extension and probed every configured origin from the user's browser; it
 * was removed because a favicon side channel cannot tell an absent icon from a dead host,
 * and because probing leaked what the user was about to open. This is the opposite: an
 * explicit developer command, run by hand before a release, against a fixed placeholder
 * title that has nothing to do with anyone's browsing.
 *
 *   node scripts/check-destinations.js                 # defaults only
 *   node scripts/check-destinations.js --catalog       # include the FMHY catalog
 *   node scripts/check-destinations.js --json out.json --markdown out.md
 *
 * It reports. It never edits a destination list, and it never fails a release on an HTTP
 * status alone: these hosts routinely answer a scripted client with 403 while working
 * perfectly in a browser, so a status is evidence for a human, not a verdict.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'IMDb_Enhanced.user.js'), 'utf8');

/* A placeholder with no connection to any user: The Matrix, chosen because every service
   that indexes films at all has it, so a "no such title" answer is a real signal. */
const SAMPLE = {
    TITLE: encodeURIComponent('The Matrix'),
    TITLE_RAW: 'The Matrix',
    TITLE_DASH: encodeURIComponent('The-Matrix'),
    TITLE_SLUG: 'the-matrix',
    IMDB_ID: 'tt0133093',
    IMDB_NUM: '0133093',
    TRAKT_TYPE: 'movie',
    YEAR: '1999',
};

const MAX_REDIRECTS = 6;
const TIMEOUT_MS = 15000;
const CONCURRENCY = 6;

function readArrayLiteral(name) {
    const match = source.match(new RegExp(`const ${name} = \\[[\\s\\S]*?\\n    \\];`));
    if (!match) throw new Error(`${name} could not be read from the userscript.`);
    // eslint-disable-next-line no-new-func
    return new Function(`${match[0]}\nreturn ${name};`)();
}

function collectDestinations({ includeCatalog }) {
    const out = [];
    readArrayLiteral('DEFAULT_WATCH_SITES').forEach(site => out.push({ ...site, group: 'default watch' }));
    readArrayLiteral('DEFAULT_EXTERNAL_SITES').forEach(site => out.push({ ...site, group: 'default external' }));
    if (includeCatalog) {
        readArrayLiteral('FMHY_WATCH_CATALOG').forEach(entry => {
            entry.sites.forEach(site => out.push({ ...site, group: `catalog: ${entry.group}` }));
        });
    }
    return out;
}

function expand(template) {
    return String(template).replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => (key in SAMPLE ? SAMPLE[key] : ''));
}

const SEARCH_TEMPLATE_KEYS = new Set([
    'TITLE', 'TITLE_RAW', 'TITLE_DASH', 'TITLE_SLUG', 'IMDB_ID', 'IMDB_NUM',
]);
function hasSearchTemplate(template) {
    return Array.from(String(template || '').matchAll(/\{\{([^{}]+)\}\}/g))
        .some(match => SEARCH_TEMPLATE_KEYS.has(match[1]));
}

/* Categories are deliberately distinct, because the action each implies is different:
   a bot block needs a human to open the page, an auth wall may be expected, a geo block
   is not the destination's fault, and a semantic mismatch is the only one that usually
   means the template itself is wrong. */
const CATEGORY = {
    OK: 'ok',
    BOT_BLOCKED: 'bot-blocked',
    AUTH_REQUIRED: 'auth-required',
    GEO_BLOCKED: 'geo-blocked',
    NOT_FOUND: 'not-found',
    SEMANTIC_MISMATCH: 'semantic-mismatch',
    SEARCH_UNCONFIRMED: 'search-unconfirmed',
    BROWSE_ONLY: 'browse-only',
    SERVER_ERROR: 'server-error',
    TLS_ERROR: 'tls-error',
    DNS_ERROR: 'dns-error',
    TIMEOUT: 'timeout',
    NETWORK_ERROR: 'network-error',
};

const BOT_WALL = /(just a moment|checking your browser|cf-browser-verification|attention required|enable javascript and cookies|ddos-guard|anubis|captcha|are you a robot)/i;
const AUTH_WALL = /(sign in|log ?in to continue|create an account to continue|members only|invite code)/i;
const GEO_WALL = /(not available in your (country|region)|unavailable in your (country|region)|geo-?restricted|vpn (is )?required)/i;
const EMPTY_RESULT = /(no results found|nothing found|0 results|no matches|couldn't find any)/i;

/* A challenge page is small and says so near the top; a real search result page is large
   and may mention "captcha" or "enable JavaScript" in ordinary copy. Matching the phrase
   anywhere flagged Wikipedia and Letterboxd as bot-walled, and a report with false alarms
   in it is a report people stop reading. */
const CHALLENGE_MAX_BYTES = 60000;
const CHALLENGE_HEAD_BYTES = 4000;

function looksLikeChallenge(body) {
    const title = /<title[^>]*>([\s\S]{0,200}?)<\/title>/i.exec(body)?.[1] || '';
    if (BOT_WALL.test(title)) return true;
    return body.length <= CHALLENGE_MAX_BYTES && BOT_WALL.test(body.slice(0, CHALLENGE_HEAD_BYTES));
}

function classifyBody(status, body) {
    if (looksLikeChallenge(body)) return CATEGORY.BOT_BLOCKED;
    if (GEO_WALL.test(body)) return CATEGORY.GEO_BLOCKED;
    if (AUTH_WALL.test(body) && status !== 200) return CATEGORY.AUTH_REQUIRED;
    if (status === 401 || status === 403) return CATEGORY.AUTH_REQUIRED;
    if (status === 404 || status === 410) return CATEGORY.NOT_FOUND;
    if (status >= 500) return CATEGORY.SERVER_ERROR;
    if (status === 200 && EMPTY_RESULT.test(body)) return CATEGORY.SEMANTIC_MISMATCH;
    if (status === 200) return CATEGORY.OK;
    return CATEGORY.NETWORK_ERROR;
}

function classifyDestination(site, result) {
    if (!hasSearchTemplate(site.url)) return CATEGORY.BROWSE_ONLY;
    /* A licensed watch catalog can correctly apply a query and have no matching title,
       while some client-rendered sites ship hidden "no results" copy in every response.
       Static HTML cannot distinguish either case from a broken search contract. Keep the
       result reviewable instead of calling the route wrong after the browser proved it. */
    if (result.category === CATEGORY.SEMANTIC_MISMATCH && /watch/i.test(String(site.group || ''))) {
        return CATEGORY.SEARCH_UNCONFIRMED;
    }
    if (result.category === CATEGORY.OK && !result.sampleMentioned) return CATEGORY.SEARCH_UNCONFIRMED;
    return result.category;
}

function classifyNetworkError(error) {
    const code = String(error?.cause?.code || error?.code || '');
    const message = String(error?.message || '');
    if (error?.name === 'TimeoutError' || /timeout|aborted/i.test(message)) return CATEGORY.TIMEOUT;
    if (/ENOTFOUND|EAI_AGAIN/.test(code)) return CATEGORY.DNS_ERROR;
    if (/CERT|SSL|TLS|ERR_TLS|DEPTH_ZERO|UNABLE_TO_VERIFY/i.test(code + message)) return CATEGORY.TLS_ERROR;
    return CATEGORY.NETWORK_ERROR;
}

/* Redirects are followed by hand so the chain can be reported. Where a destination moves
   the reader to a different host, that is the single most useful thing this report can
   say — it is how a quietly-sold domain shows up. */
async function probe(startUrl) {
    const chain = [];
    let url = startUrl;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
        let response;
        try {
            response = await fetch(url, {
                redirect: 'manual',
                signal: AbortSignal.timeout(TIMEOUT_MS),
                headers: {
                    // An ordinary browser string. Not to evade anything — several of these
                    // hosts simply refuse a bare client, and a refusal we caused ourselves
                    // is not information about the destination.
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
            });
        } catch (error) {
            return { chain, finalUrl: url, status: 0, category: classifyNetworkError(error), detail: String(error?.message || error).slice(0, 200) };
        }

        const location = response.headers.get('location');
        if (response.status >= 300 && response.status < 400 && location) {
            const next = new URL(location, url).href;
            chain.push({ from: url, status: response.status, to: next });
            url = next;
            continue;
        }

        let body = '';
        try { body = (await response.text()).slice(0, 200000); }
        catch { /* a body we cannot read is still a status we can report */ }
        return {
            chain,
            finalUrl: response.url || url,
            status: response.status,
            category: classifyBody(response.status, body),
            sampleMentioned: /the\s+matrix/i.test(body),
            detail: '',
        };
    }
    return { chain, finalUrl: url, status: 0, category: CATEGORY.NETWORK_ERROR, detail: `more than ${MAX_REDIRECTS} redirects` };
}

const NEEDS_REVIEW = {
    [CATEGORY.NOT_FOUND]: 'The exact URL this ships answered 404. Open it: the site may have changed its search path.',
    [CATEGORY.DNS_ERROR]: 'The host does not resolve. Usually a dead or renamed domain.',
    [CATEGORY.TLS_ERROR]: 'The certificate did not validate. Check before shipping it to anyone.',
    [CATEGORY.SEMANTIC_MISMATCH]: 'Loaded, but the rendered HTML reports no matching result. Verify the route in a browser.',
    [CATEGORY.SEARCH_UNCONFIRMED]: 'The route answered, but its HTML did not contain the sample title. Verify the rendered page in a browser.',
    [CATEGORY.BROWSE_ONLY]: 'No title or IMDb token is present. This is a browse link in Settings, not an addable search destination.',
    [CATEGORY.SERVER_ERROR]: 'The server errored. Re-run before concluding anything.',
    [CATEGORY.BOT_BLOCKED]: 'A bot wall answered this client. Says nothing about a real browser; open it by hand.',
    [CATEGORY.AUTH_REQUIRED]: 'Sign-in or an invite is required. Expected for some entries.',
    [CATEGORY.GEO_BLOCKED]: 'Refused for this location. Not the destination being broken.',
    [CATEGORY.TIMEOUT]: 'No answer within the timeout. Re-run before concluding anything.',
    [CATEGORY.NETWORK_ERROR]: 'The request failed. Re-run before concluding anything.',
};

/* Hosts a destination must not end up on, whatever its own domain says. A redirect onto
   one of these is the single most useful thing this report catches: it is how an entry
   that still answers 200 turns out to be pointing at something retired. */
const RETIRED_HOSTS = [/(?:^|\.)cineby\.(?:at|sc|gd|app)$/i];

function retiredHostWarning(finalUrl) {
    let host = '';
    try { host = new URL(finalUrl).host; } catch { return ''; }
    return RETIRED_HOSTS.some(pattern => pattern.test(host))
        ? `Redirects to ${host}, which this project has retired. The entry answers 200 but leads somewhere dead.`
        : '';
}

async function mapWithConcurrency(items, limit, worker) {
    const results = new Array(items.length);
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (cursor < items.length) {
            const index = cursor;
            cursor += 1;
            results[index] = await worker(items[index], index);
        }
    }));
    return results;
}

function toMarkdown(rows, meta) {
    const lines = [
        '# Destination health report',
        '',
        `Generated ${meta.generatedAt} against the placeholder title ${SAMPLE.TITLE_RAW} (${SAMPLE.IMDB_ID}).`,
        '',
        'A status is evidence, not a verdict. Several of these hosts answer a scripted client',
        'with a bot wall or a 403 while working normally in a browser, so nothing here fails a',
        'release on its own and nothing here edits a destination list.',
        '',
        `- Checked: ${rows.length}`,
        ...Object.entries(meta.counts).map(([category, count]) => `- ${category}: ${count}`),
        '',
        '| Destination | Group | Search | Category | Status | Hops | Final host | Review |',
        '| --- | --- | --- | --- | ---: | ---: | --- | --- |',
    ];
    rows.forEach(row => {
        const finalHost = (() => {
            try { return new URL(row.finalUrl).host; } catch { return '—'; }
        })();
        const movedHost = finalHost && row.startHost && finalHost !== row.startHost ? ` (from ${row.startHost})` : '';
        lines.push(`| ${row.name} | ${row.group} | ${row.searchable ? 'search' : 'browse'} | ${row.category} | ${row.status || '—'} | ${row.chain.length} | ${finalHost}${movedHost} | ${row.review || ''} |`);
    });
    return `${lines.join('\n')}\n`;
}

async function main() {
    const argv = process.argv.slice(2);
    const includeCatalog = argv.includes('--catalog');
    const jsonAt = argv.includes('--json') ? argv[argv.indexOf('--json') + 1] : null;
    const markdownAt = argv.includes('--markdown') ? argv[argv.indexOf('--markdown') + 1] : null;

    const destinations = collectDestinations({ includeCatalog });
    process.stderr.write(`Checking ${destinations.length} destinations…\n`);

    const rows = await mapWithConcurrency(destinations, CONCURRENCY, async site => {
        const startUrl = expand(site.url);
        let startHost = '';
        try { startHost = new URL(startUrl).host; } catch { /* reported as a bad template */ }
        const result = await probe(startUrl);
        const category = classifyDestination(site, result);
        process.stderr.write(`  ${category.padEnd(18)} ${site.name}\n`);
        return {
            name: site.name,
            group: site.group,
            template: site.url,
            startUrl,
            startHost,
            ...result,
            category,
            searchable:hasSearchTemplate(site.url),
            // A retired-host redirect outranks the category note: the entry can be
            // perfectly healthy and still be pointing somewhere that is not.
            review: retiredHostWarning(result.finalUrl) || NEEDS_REVIEW[category] || '',
        };
    });

    const counts = rows.reduce((acc, row) => {
        acc[row.category] = (acc[row.category] || 0) + 1;
        return acc;
    }, {});
    const meta = { generatedAt: new Date().toISOString(), sample: SAMPLE, counts };

    if (jsonAt) fs.writeFileSync(path.resolve(jsonAt), `${JSON.stringify({ meta, rows }, null, 2)}\n`, 'utf8');
    if (markdownAt) fs.writeFileSync(path.resolve(markdownAt), toMarkdown(rows, meta), 'utf8');
    if (!jsonAt && !markdownAt) process.stdout.write(toMarkdown(rows, meta));

    const review = rows.filter(row => row.category !== CATEGORY.OK);
    process.stderr.write(`\n${rows.length - review.length} of ${rows.length} answered normally; ${review.length} need a human to look.\n`);
    /* Always exit 0. This is advisory: exiting non-zero would make a bot wall - which says
       nothing about whether a real browser can reach the site - able to block a release. */
    process.exit(0);
}

if (require.main === module) {
    main().catch(error => {
        process.stderr.write(`destination check failed: ${error?.stack || error}\n`);
        process.exit(1);
    });
}

module.exports = {
    CATEGORY, classifyBody, classifyDestination, classifyNetworkError, expand,
    hasSearchTemplate, collectDestinations, toMarkdown, SAMPLE, NEEDS_REVIEW,
};
