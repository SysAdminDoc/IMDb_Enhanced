#!/usr/bin/env node
/* Runs a command with a hard memory ceiling and a wall-clock ceiling, and kills it dead
 * the moment it crosses either. Exists because tests/dom-fixtures.mjs once grew to 35 GB
 * of ArrayBuffer memory before the allocator refused it, and node's --max-old-space-size
 * cannot prevent that: it bounds the JS heap, and ArrayBuffers live outside it. The only
 * thing that actually protects the machine is watching the process from outside.
 *
 *   node scripts/run-bounded.js [--mb=1536] [--seconds=300] -- node tests/dom-fixtures.mjs
 *
 * Exit codes: the child's own on a clean finish; 87 when killed for memory; 88 for time.
 */
'use strict';

const { spawn, execFileSync } = require('child_process');

const args = process.argv.slice(2);
const split = args.indexOf('--');
const options = split >= 0 ? args.slice(0, split) : [];
const command = split >= 0 ? args.slice(split + 1) : args;
const memoryMb = Number((options.find(a => a.startsWith('--mb=')) || '').slice(5)) || 1536;
const wallSeconds = Number((options.find(a => a.startsWith('--seconds=')) || '').slice(10)) || 300;

if (!command.length) {
    process.stderr.write('usage: node scripts/run-bounded.js [--mb=1536] [--seconds=300] -- <command...>\n');
    process.exit(2);
}

/* tasklist rather than PowerShell: it starts in tens of milliseconds, ships with every
 * Windows, and its CSV carries the working set. The poll costs almost nothing next to
 * what it guards against. */
function workingSetMb(pid) {
    try {
        const out = execFileSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'],
            { encoding: 'utf8', windowsHide: true });
        const kb = out.match(/"([\d,. ]+) K"/)?.[1];
        if (!kb) return null;
        return Number(kb.replace(/[^\d]/g, '')) / 1024;
    } catch { return null; }
}

function killTree(pid) {
    try { execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }); }
    catch { /* already gone */ }
}

const startedAt = Date.now();
const child = spawn(command[0], command.slice(1), { stdio: 'inherit', shell: false });
let verdict = null;

const watchdog = setInterval(() => {
    const seconds = (Date.now() - startedAt) / 1000;
    const mb = workingSetMb(child.pid);
    if (mb !== null && mb > memoryMb) {
        verdict = { code: 87, note: `killed: ${Math.round(mb)} MB working set is over the ${memoryMb} MB ceiling` };
    } else if (seconds > wallSeconds) {
        verdict = { code: 88, note: `killed: still running after ${wallSeconds}s` };
    }
    if (verdict) {
        clearInterval(watchdog);
        process.stderr.write(`\n[run-bounded] ${verdict.note}\n`);
        killTree(child.pid);
    }
}, 750);

child.on('exit', (code, signal) => {
    clearInterval(watchdog);
    if (verdict) process.exit(verdict.code);
    process.exit(signal ? 1 : (code ?? 1));
});
