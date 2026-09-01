#!/usr/bin/env node
/* Assembles IMDb_Enhanced.user.js from the modules in src/.
 *
 *   node scripts/build-userscript.js            # write the userscript
 *   node scripts/build-userscript.js --check    # fail if the committed file has drifted
 *
 * The modules are pieces of one script, not ES modules: they are concatenated in
 * filename order and nothing is transformed, rewritten, or minified on the way
 * through. That is the whole design. A build step that could change behaviour would
 * mean the readable file people install is not the file the tests ran against, and
 * Greasy Fork's rules make an opaque artifact a non-starter anyway.
 *
 * Because the join is a byte concatenation of files read in a fixed order, two clean
 * builds are identical by construction rather than by convention — and `--check`
 * turns that into a gate, so a module edit that was never assembled, or an edit made
 * straight to the generated userscript, both fail the suite instead of surviving.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'src');
const outFile = path.join(root, 'IMDb_Enhanced.user.js');

/* The numeric prefix is the order, so it is part of the contract rather than a
   convention: a file that does not carry one has no defined position in the output. */
const MODULE_NAME = /^\d{2}-[a-z0-9-]+\.js$/;

function readModules() {
    if (!fs.existsSync(srcDir)) {
        throw new Error(`src/ is missing at ${srcDir}`);
    }
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    const stray = entries
        .filter(entry => !entry.isFile() || !MODULE_NAME.test(entry.name))
        .map(entry => entry.name);
    if (stray.length) {
        throw new Error(`src/ holds entries that are not modules: ${stray.join(', ')}. `
            + 'Every module is NN-name.js and the number is its position in the userscript.');
    }
    const names = entries.map(entry => entry.name).sort();
    const prefixes = names.map(name => name.slice(0, 2));
    const duplicate = prefixes.find((prefix, index) => prefixes.indexOf(prefix) !== index);
    if (duplicate) {
        throw new Error(`two modules share the position ${duplicate}; the order would depend on the rest of the name`);
    }
    return names.map(name => ({ name, text: fs.readFileSync(path.join(srcDir, name), 'utf8') }));
}

function assemble() {
    return readModules().map(module => module.text).join('');
}

/* Names the module the difference is in rather than an offset into a 17,000-line
   file, because "byte 412,918 differs" is not something anyone can act on. */
function locate(modules, offset) {
    let consumed = 0;
    for (const module of modules) {
        if (offset < consumed + module.text.length) {
            const within = offset - consumed;
            const line = module.text.slice(0, within).split('\n').length;
            return `src/${module.name}:${line}`;
        }
        consumed += module.text.length;
    }
    return `past the end of the last module (${consumed} bytes assembled)`;
}

function firstDifference(a, b) {
    const limit = Math.min(a.length, b.length);
    for (let index = 0; index < limit; index += 1) {
        if (a[index] !== b[index]) return index;
    }
    return a.length === b.length ? -1 : limit;
}

function main() {
    const check = process.argv.includes('--check');
    const modules = readModules();
    const assembled = modules.map(module => module.text).join('');

    if (!check) {
        fs.writeFileSync(outFile, assembled, 'utf8');
        const kib = (Buffer.byteLength(assembled) / 1024).toFixed(0);
        process.stdout.write(`Assembled IMDb_Enhanced.user.js from ${modules.length} modules (${kib} KiB).\n`);
        return;
    }

    if (!fs.existsSync(outFile)) {
        throw new Error('IMDb_Enhanced.user.js is missing; run node scripts/build-userscript.js');
    }
    const committed = fs.readFileSync(outFile, 'utf8');
    const offset = firstDifference(assembled, committed);
    if (offset === -1) {
        process.stdout.write(`IMDb_Enhanced.user.js matches the ${modules.length} modules in src/.\n`);
        return;
    }
    const committedLine = committed.slice(0, offset).split('\n').length;
    throw new Error('IMDb_Enhanced.user.js is not what src/ assembles to.\n'
        + `  first difference at ${locate(modules, offset)} (IMDb_Enhanced.user.js:${committedLine})\n`
        + '  edit the module, not the generated file, then run node scripts/build-userscript.js');
}

if (require.main === module) {
    try {
        main();
    } catch (error) {
        process.stderr.write(`${error.message}\n`);
        process.exit(1);
    }
}

module.exports = { assemble, readModules, firstDifference, locate, MODULE_NAME };
