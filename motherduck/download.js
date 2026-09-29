const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Remove an existing file and its DuckDB WAL sidecar, if any. `ATTACH` opens an existing file
 * rather than replacing it, so downloading over a stale file would otherwise merge into it
 * (or collide on a duplicate table name) instead of producing a fresh copy.
 * @param {string} filePath
 */
function prepareDownloadTarget(filePath) {
	fs.rmSync(filePath, { force: true });
	fs.rmSync(`${filePath}.wal`, { force: true });
}

/**
 * Default save location for a download: the given workspace folder, or the home directory.
 * @param {string} filename @param {{workspaceFolder?: string, homedir?: string}} [options]
 */
function defaultDownloadPath(filename, options = {}) {
	const dir = options.workspaceFolder || options.homedir || os.homedir();
	return path.join(dir, filename);
}

module.exports = { prepareDownloadTarget, defaultDownloadPath };
