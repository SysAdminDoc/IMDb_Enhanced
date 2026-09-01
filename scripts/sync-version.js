const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const srcDir = path.join(root, 'src');
const readmePath = path.join(root, 'README.md');

/* String.replace is a silent no-op when its pattern stops matching, so a reformatted
   line or an unexpected version shape would leave a stale string behind while this
   script still reported success. Check that the pattern still matches rather than that
   the text changed — an already-correct version is a legitimate no-op. */
const failures = [];
function substitute(label, text, pattern, replacement) {
    if (!pattern.test(text)) {
        failures.push(label);
        return text;
    }
    return text.replace(pattern, replacement);
}

/* Which module a version string lives in is not written down anywhere: naming the file
   here is how the list would rot the next time src/ is reorganised. Every module is
   offered each pattern instead, and a pattern that lands in none of them, or in more
   than one, is reported rather than half-applied. */
const modules = fs.readdirSync(srcDir).filter(name => name.endsWith('.js')).sort();
const sourceEdits = [
    ['userscript @version', /^(\/\/ @version\s+)\S+/m, `$1${version}`],
    ['userscript VERSION constant', /(const VERSION\s*=\s*')([^']+)'/, `$1${version}'`],
];
const written = new Map();
sourceEdits.forEach(([label, pattern, replacement]) => {
    const matched = modules.filter(name => {
        const text = written.get(name) ?? fs.readFileSync(path.join(srcDir, name), 'utf8');
        if (!pattern.test(text)) return false;
        written.set(name, text.replace(pattern, replacement));
        return true;
    });
    if (matched.length !== 1) {
        failures.push(`${label} (matched ${matched.length} modules${matched.length ? `: ${matched.join(', ')}` : ''})`);
    }
});

// The README badge is a version string like any other; leaving it to a manual
// step is how it drifted behind the manifest before. The value stops at the
// closing bracket rather than the first hyphen so prerelease versions match.
let readme = fs.readFileSync(readmePath, 'utf8');
readme = substitute('README version badge', readme,
    /(\[!\[Version\]\(https:\/\/img\.shields\.io\/badge\/version-)[^-\]]+(-blue\)\])/,
    `$1${version}$2`);

if (failures.length) {
    console.error(`Version sync failed; these strings did not update: ${failures.join(', ')}`);
    process.exit(1);
}

written.forEach((text, name) => fs.writeFileSync(path.join(srcDir, name), text, 'utf8'));
fs.writeFileSync(readmePath, readme, 'utf8');
console.log(`Synced version to ${version} across ${written.size} module(s) and the README badge`);
