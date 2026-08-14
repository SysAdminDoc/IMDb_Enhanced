const fs = require('fs');
const path = require('path');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const version = pkg.version;
const scriptPath = path.join(__dirname, '..', 'IMDb_Enhanced.user.js');

let script = fs.readFileSync(scriptPath, 'utf8');
script = script.replace(/^(\/\/ @version\s+)\S+/m, `$1${version}`);
script = script.replace(/(const VERSION\s*=\s*')([^']+)'/, `$1${version}'`);
fs.writeFileSync(scriptPath, script, 'utf8');

// The README badge is a version string like any other; leaving it to a manual
// step is how it drifted behind the manifest before.
const readmePath = path.join(__dirname, '..', 'README.md');
const readme = fs.readFileSync(readmePath, 'utf8');
const syncedReadme = readme.replace(
    /(\[!\[Version\]\(https:\/\/img\.shields\.io\/badge\/version-)[^-]+(-blue\)\])/,
    `$1${version}$2`,
);
if (syncedReadme !== readme) fs.writeFileSync(readmePath, syncedReadme, 'utf8');

console.log(`Synced version to ${version}`);
