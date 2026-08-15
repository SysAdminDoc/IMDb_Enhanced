const fs = require('fs');
const path = require('path');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const version = pkg.version;
const scriptPath = path.join(__dirname, '..', 'IMDb_Enhanced.user.js');
const readmePath = path.join(__dirname, '..', 'README.md');

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

let script = fs.readFileSync(scriptPath, 'utf8');
script = substitute('userscript @version', script, /^(\/\/ @version\s+)\S+/m, `$1${version}`);
script = substitute('userscript VERSION constant', script, /(const VERSION\s*=\s*')([^']+)'/, `$1${version}'`);

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

fs.writeFileSync(scriptPath, script, 'utf8');
fs.writeFileSync(readmePath, readme, 'utf8');
console.log(`Synced version to ${version}`);
