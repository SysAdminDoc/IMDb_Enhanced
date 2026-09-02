#!/usr/bin/env node
/* Mutation testing, by hand and on purpose.
 *
 *   node scripts/mutate.js              # list the mutants
 *   node scripts/mutate.js --all        # apply each in turn, run the suite, restore
 *   node scripts/mutate.js polarity-reverse-j
 *
 * Developer-run, never part of `npm test`: it edits the source, runs the whole suite once
 * per mutant, and restores. Each run is a few minutes.
 *
 * Why this rather than Stryker: this repository ships with exactly one development
 * dependency and says so in its README as a trust claim. Stryker brings several hundred
 * packages to do, for these particular files, what the twelve edits below do. The
 * guarantee wanted here is "no mutant in the rating and CSV functions survives the
 * suite", and that is what this checks; the cost of the list being hand-written is that
 * it covers what it names, which is why every entry says what it is testing.
 *
 * A mutant that SURVIVES is the finding. It means the suite would not have noticed that
 * change, so either the behaviour is untested or it does not matter. The reverse-J
 * threshold was found exactly this way on 2026-09-02.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');

/* Each mutant names the claim it is probing. Keep them small and semantic: flipping a
   comparison or a constant tells you something, deleting a whole function does not. */
const MUTANTS = [
    // ---- rating shape -----------------------------------------------------------
    ['polarity-min-votes', 'src/82-features-scores.js',
        'const POLARITY_MIN_VOTES = 1000;', 'const POLARITY_MIN_VOTES = 0;',
        'a distribution too small to mean anything is described anyway'],
    ['polarity-divisive', 'src/82-features-scores.js',
        'const POLARITY_DIVISIVE = 0.4;', 'const POLARITY_DIVISIVE = 0.9;',
        'a divided title is called a consensus'],
    ['polarity-reverse-j', 'src/82-features-scores.js',
        'const POLARITY_REVERSE_J = 0.5;', 'const POLARITY_REVERSE_J = 0.1;',
        'an ordinary split is called a title that was voted down'],
    ['polarity-low-share', 'src/82-features-scores.js',
        'const REVERSE_J_LOW_SHARE = 0.75;', 'const REVERSE_J_LOW_SHARE = 0.0;',
        'ends piled at the top read as ends piled at the bottom'],
    // ---- means ------------------------------------------------------------------
    ['mean-precision', 'src/82-features-scores.js',
        'Math.round((weighted / votes) * 10) / 10', 'Math.round(weighted / votes)',
        'the unweighted mean loses the decimal that makes it comparable'],
    ['trim-ends', 'src/82-features-scores.js',
        'if (rating <= 1 || rating >= 10) continue;', 'if (rating < 1 || rating > 10) continue;',
        'the trimmed mean stops trimming and becomes the plain mean'],
    // ---- rating colour ----------------------------------------------------------
    ['ramp-great', 'src/81-providers.js',
        'n >= 8.0 ? [ramp[4]', 'n >= 9.9 ? [ramp[4]',
        'the top of the scale is almost never reached'],
    ['ramp-poor', 'src/81-providers.js',
        'n >= 5.0 ? [ramp[1]', 'n >= 0.0 ? [ramp[1]',
        'nothing is ever poor'],
    ['ramp-order', 'src/81-providers.js',
        "accessible: ['#00204d', '#48506b', '#7c7b78', '#bcaf6f', '#ffea46'],",
        "accessible: ['#ffea46', '#bcaf6f', '#7c7b78', '#48506b', '#00204d'],",
        'the colour-blind-safe ramp runs backwards'],
    ['readable-text', 'src/81-providers.js',
        'return darkContrast >= lightContrast', 'return darkContrast <= lightContrast',
        'badge text picks the less readable of the two foregrounds'],
    // ---- CSV --------------------------------------------------------------------
    ['csv-quote-set', 'src/20-storage.js',
        'const CSV_MUST_QUOTE = /["\\,\\n\\r\\u2028\\u2029\\u0000]/;',
        'const CSV_MUST_QUOTE = /["\\,\\n\\r]/;',
        'the separators that are not \\n stop being quoted'],
    ['csv-formula', 'src/20-storage.js',
        'const CSV_FORMULA_LEAD = /^\\s*[=+\\-@]|^[\\t\\r]/;',
        'const CSV_FORMULA_LEAD = /^[=+\\-@]/;',
        'a space in front of an equals sign defeats the formula guard'],
    ['csv-doubling', 'src/20-storage.js',
        `text.replace(/"/g, '""')`, 'text',
        'a quote inside a field is written without being doubled'],
];

function run(command, args) {
    execFileSync(command, args, { cwd: root, stdio: 'pipe' });
}

function check(mutant) {
    const [name, file, from, to, claim] = mutant;
    const target = path.join(root, file);
    const original = fs.readFileSync(target, 'utf8');
    if (!original.includes(from)) {
        process.stdout.write(`  ${name.padEnd(20)} STALE   the source no longer contains what this mutates\n`);
        return 'stale';
    }
    fs.writeFileSync(target, original.replace(from, to), 'utf8');
    try {
        run(process.execPath, ['scripts/build-userscript.js']);
        try {
            run(process.execPath, ['tests/run.js']);
            process.stdout.write(`  ${name.padEnd(20)} SURVIVED  nothing noticed that ${claim}\n`);
            return 'survived';
        } catch {
            process.stdout.write(`  ${name.padEnd(20)} killed\n`);
            return 'killed';
        }
    } finally {
        fs.writeFileSync(target, original, 'utf8');
        run(process.execPath, ['scripts/build-userscript.js']);
    }
}

const argument = process.argv[2];
if (!argument) {
    process.stdout.write('Mutants:\n');
    MUTANTS.forEach(([name, file, , , claim]) => {
        process.stdout.write(`  ${name.padEnd(20)} ${file}\n      would mean: ${claim}\n`);
    });
    process.stdout.write('\nRun one by name, or --all. Each run rebuilds and runs tests/run.js.\n');
    process.exit(0);
}

const chosen = argument === '--all'
    ? MUTANTS
    : MUTANTS.filter(([name]) => name === argument);
if (!chosen.length) {
    process.stderr.write(`Unknown mutant: ${argument}\n`);
    process.exit(1);
}

process.stdout.write(`Checking ${chosen.length} mutant(s). A SURVIVED line is the finding.\n`);
const results = chosen.map(check);
const survived = results.filter(result => result === 'survived').length;
const stale = results.filter(result => result === 'stale').length;
process.stdout.write(`\n${results.length - survived - stale} killed, ${survived} survived, ${stale} stale.\n`);
process.exit(survived || stale ? 1 : 0);
