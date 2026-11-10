const { execFile } = require('child_process');
const { buildArgs, parseUsage } = require('./flags');

/** Runs a one-turn `claude -p` with the chosen flags and returns startup token usage. */
function measure(exe, state, cwd) {
	const args = ['-p', 'Reply with the single word ok.', '--output-format', 'json', ...buildArgs(state)];
	return new Promise((resolve, reject) => {
		execFile(exe, args, { cwd, timeout: 180000, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
			if (err && !stdout) return reject(new Error(stderr || err.message));
			try {
				resolve(parseUsage(stdout));
			} catch (e) {
				reject(new Error(`Could not parse claude output: ${(stderr || stdout).slice(0, 300)}`));
			}
		});
	});
}

module.exports = { measure };
