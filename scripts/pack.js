/* Turns the generated build directories into the archives a store listing needs, and an
   AMO source-submission archive beside them.

   The zip writer is here rather than from a package because the only thing missing from
   Node is the container format: zlib already does the compression, and a dependency for
   a header layout would be a supply-chain risk taken to avoid eighty lines. It also lets
   the output be deterministic, which a dependency would not: every entry is written with
   the same timestamp and in sorted order, so two builds of the same source produce
   byte-identical archives and the checksums beside them mean something.

   Nothing here regenerates a build. It packs what is on disk, and `npm test` is what
   proves what is on disk matches the source. */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const outputDir = path.join(root, 'dist');

/* MS-DOS date-time, fixed. A zip records a modification time per entry, and taking it
   from the filesystem would make two builds of identical source differ. */
const FIXED_DOS_TIME = 0;
const FIXED_DOS_DATE = 0x21;

function dosStamp() {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt16LE(FIXED_DOS_TIME, 0);
    buffer.writeUInt16LE(FIXED_DOS_DATE, 2);
    return buffer;
}

function listFiles(dir, prefix = '') {
    return fs.readdirSync(dir, { withFileTypes:true })
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        .flatMap(entry => (entry.isDirectory()
            ? listFiles(path.join(dir, entry.name), `${prefix}${entry.name}/`)
            : [`${prefix}${entry.name}`]));
}

/* Store-compressed only where deflate would make a file bigger, which is what every
   producer does and what keeps already-compressed PNGs from growing. */
function writeZip(entries, destination) {
    const chunks = [];
    const central = [];
    let offset = 0;

    entries.forEach(({ name, body }) => {
        const nameBytes = Buffer.from(name, 'utf8');
        const deflated = zlib.deflateRawSync(body, { level:9 });
        const stored = deflated.length >= body.length;
        const payload = stored ? body : deflated;
        const method = stored ? 0 : 8;
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);              // version needed
        local.writeUInt16LE(0x0800, 6);          // UTF-8 names
        local.writeUInt16LE(method, 8);
        dosStamp().copy(local, 10);
        local.writeUInt32LE(crc32(body), 14);
        local.writeUInt32LE(payload.length, 18);
        local.writeUInt32LE(body.length, 22);
        local.writeUInt16LE(nameBytes.length, 26);
        local.writeUInt16LE(0, 28);

        chunks.push(local, nameBytes, payload);

        const header = Buffer.alloc(46);
        header.writeUInt32LE(0x02014b50, 0);
        header.writeUInt16LE(20, 4);             // version made by
        header.writeUInt16LE(20, 6);             // version needed
        header.writeUInt16LE(0x0800, 8);
        header.writeUInt16LE(method, 10);
        dosStamp().copy(header, 12);
        header.writeUInt32LE(crc32(body), 16);
        header.writeUInt32LE(payload.length, 20);
        header.writeUInt32LE(body.length, 24);
        header.writeUInt16LE(nameBytes.length, 28);
        header.writeUInt16LE(0, 30);             // extra
        header.writeUInt16LE(0, 32);             // comment
        header.writeUInt16LE(0, 34);             // disk
        header.writeUInt16LE(0, 36);             // internal attrs
        header.writeUInt32LE(0, 38);             // external attrs
        header.writeUInt32LE(offset, 42);
        central.push(Buffer.concat([header, nameBytes]));

        offset += local.length + nameBytes.length + payload.length;
    });

    const directory = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(directory.length, 12);
    end.writeUInt32LE(offset, 16);
    end.writeUInt16LE(0, 20);

    const archive = Buffer.concat([...chunks, directory, end]);
    fs.mkdirSync(path.dirname(destination), { recursive:true });
    fs.writeFileSync(destination, archive);
    return archive;
}

const CRC_TABLE = (() => {
    const table = new Int32Array(256);
    for (let index = 0; index < 256; index += 1) {
        let value = index;
        for (let bit = 0; bit < 8; bit += 1) {
            value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
        }
        table[index] = value;
    }
    return table;
})();

function crc32(buffer) {
    let crc = -1;
    for (let index = 0; index < buffer.length; index += 1) {
        crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[index]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
}

/* Everything the manifest says the extension is made of, and nothing else. */
function declaredFiles(dir) {
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
    const named = new Set(['manifest.json']);
    const add = value => { if (typeof value === 'string' && value) named.add(value); };
    Object.values(manifest.icons || {}).forEach(add);
    Object.values(manifest.action?.default_icon || {}).forEach(add);
    add(manifest.action?.default_popup);
    // The extension's own pages, named where a browser looks for them.
    add(manifest.options_ui?.page);
    add(manifest.options_page);
    add(manifest.chrome_url_overrides?.newtab);
    add(manifest.background?.service_worker);
    (manifest.background?.scripts || []).forEach(add);
    (manifest.content_scripts || []).forEach(script => {
        (script.js || []).forEach(add);
        (script.css || []).forEach(add);
    });
    (manifest.web_accessible_resources || []).forEach(rule => (rule.resources || []).forEach(add));
    /* The locales, which the manifest names only through default_locale, and whatever a
       page it names loads from beside it — a page is not much use without its script. */
    listFiles(dir).forEach(name => {
        if (name.startsWith('_locales/')) named.add(name);
    });
    [...named].filter(name => name.endsWith('.html')).forEach(page => {
        const markup = fs.readFileSync(path.join(dir, page), 'utf8');
        [...markup.matchAll(/(?:src|href)="([^"?#:]+)"/g)].forEach(match => {
            const asset = path.posix.join(path.posix.dirname(page), match[1]);
            if (fs.existsSync(path.join(dir, asset))) named.add(asset);
        });
    });
    /* Reported rather than quietly dropped. A manifest that names a file which is not
       there is a broken package, and filtering it out here is how that ships. */
    const wanted = [...named].sort();
    const missing = wanted.filter(name => !fs.existsSync(path.join(dir, name)));
    if (missing.length) {
        throw new Error(`${path.basename(dir)} is missing ${missing.join(', ')}; run npm test first.`);
    }
    return wanted;
}

function packDirectory(dir, destination) {
    if (!fs.existsSync(dir)) throw new Error(`${path.basename(dir)} has not been built; run npm test first.`);
    const names = declaredFiles(dir);
    if (!names.length) throw new Error(`${path.basename(dir)} is empty.`);
    const entries = names.map(name => ({ name, body:fs.readFileSync(path.join(dir, name)) }));
    return writeZip(entries, destination);
}

/* What somebody needs to rebuild the artifact and check it against what was submitted.
   Generated directories are deliberately absent: they are outputs, and shipping them
   would let a source archive disagree with what its own build produces. */
const SOURCE_FILES = [
    'IMDb_Enhanced.user.js',
    'package.json',
    'package-lock.json',
    'README.md',
    'LICENSE',
];
const SOURCE_DIRS = ['extension', 'scripts', 'tests'];
/* Written by scripts/build-extension.js into extension/. They are outputs of the build a
   reviewer is being asked to reproduce, so shipping them would let the archive disagree
   with what building it produces. */
const GENERATED_IN_SOURCE_DIRS = new Set([
    'extension/content.js',
    'extension/recovery.js',
    'extension/boot.css',
]);

function packSource(destination) {
    const entries = [];
    SOURCE_FILES.forEach(name => {
        const full = path.join(root, name);
        if (fs.existsSync(full)) entries.push({ name, body:fs.readFileSync(full) });
    });
    SOURCE_DIRS.forEach(dir => {
        const full = path.join(root, dir);
        if (!fs.existsSync(full)) return;
        listFiles(full).forEach(name => {
            const entryName = `${dir}/${name}`;
            if (GENERATED_IN_SOURCE_DIRS.has(entryName) || entryName.includes('/_locales/')) return;
            entries.push({ name:entryName, body:fs.readFileSync(path.join(full, name)) });
        });
    });
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return writeZip(entries, destination);
}

function main() {
    const version = packageJson.version;
    fs.mkdirSync(outputDir, { recursive:true });
    const built = [
        ['extension', `imdb-enhanced-chromium-${version}.zip`],
        ['extension-firefox', `imdb-enhanced-firefox-${version}.zip`],
        ['extension-store', `imdb-enhanced-store-${version}.zip`],
    ].map(([dir, name]) => {
        const destination = path.join(outputDir, name);
        const archive = packDirectory(path.join(root, dir), destination);
        return [name, archive];
    });

    const sourceName = `imdb-enhanced-source-${version}.zip`;
    built.push([sourceName, packSource(path.join(outputDir, sourceName))]);

    const checksums = built
        .map(([name, archive]) => `${crypto.createHash('sha256').update(archive).digest('hex')}  ${name}`)
        .join('\n');
    fs.writeFileSync(path.join(outputDir, `SHA256SUMS-${version}.txt`), `${checksums}\n`, 'utf8');

    built.forEach(([name, archive]) => {
        console.log(`${name}: ${(archive.length / 1024).toFixed(1)} KiB`);
    });
    console.log(`SHA256SUMS-${version}.txt written to dist/.`);
}

if (require.main === module) main();

module.exports = { crc32, writeZip, listFiles, packDirectory, packSource, outputDir };
