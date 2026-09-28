const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { prepareDownloadTarget, defaultDownloadPath } = require('./download');

// prepareDownloadTarget removes an existing file and its DuckDB WAL sidecar, so a repeat
// download doesn't ATTACH into stale content and silently merge or collide with it.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-explorer-'));
const target = path.join(dir, 'out.duckdb');
fs.writeFileSync(target, 'stale');
fs.writeFileSync(`${target}.wal`, 'stale-wal');
prepareDownloadTarget(target);
assert.strictEqual(fs.existsSync(target), false);
assert.strictEqual(fs.existsSync(`${target}.wal`), false);

// A no-op when nothing exists yet, e.g. downloading to a fresh filename.
prepareDownloadTarget(path.join(dir, 'missing.duckdb'));

assert.strictEqual(defaultDownloadPath('a.duckdb', { workspaceFolder: '/work' }), path.join('/work', 'a.duckdb'));
assert.strictEqual(defaultDownloadPath('a.duckdb', { homedir: '/home/me' }), path.join('/home/me', 'a.duckdb'));
assert.strictEqual(defaultDownloadPath('a.duckdb', {}), path.join(os.homedir(), 'a.duckdb'));

console.log('ok');
