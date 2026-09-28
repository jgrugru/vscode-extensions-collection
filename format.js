/** Format a byte count for display, e.g. "12.3 KB", "1.2 MB". @param {number} bytes */
function formatBytes(bytes) {
	if (bytes < 1024) {
		return `${bytes} B`;
	}
	const units = ['KB', 'MB', 'GB', 'TB'];
	let value = bytes / 1024;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit++;
	}
	return `${value.toFixed(1)} ${units[unit]}`;
}

/** Format a duration for display, e.g. "1.2s", "3m 5s". @param {number} ms */
function formatDuration(ms) {
	const s = ms / 1000;
	return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

module.exports = { formatBytes, formatDuration };
