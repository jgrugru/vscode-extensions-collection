const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

/** @param {string} p */
async function readJson(p) {
	try {
		return JSON.parse(await fs.promises.readFile(p, 'utf8'));
	} catch {
		return null;
	}
}

/** Rough token cost of one item listed in the system prompt: name + description, ~4 chars/token. @param {string} file */
async function listingTokens(file) {
	try {
		const head = (await fs.promises.readFile(file, 'utf8')).slice(0, 4000);
		const name = (head.match(/^name:\s*(.+)$/m) || [])[1] || '';
		const desc = (head.match(/^description:\s*(.+)$/m) || [])[1] || '';
		return Math.ceil((name.length + desc.length) / 4) + 8;
	} catch {
		return 0;
	}
}

/** Every dir holding a SKILL.md, up to `depth` levels down. @param {string} dir @param {number} depth */
async function skillsIn(dir, depth = 5) {
	let entries;
	try {
		entries = await fs.promises.readdir(dir, { withFileTypes: true });
	} catch {
		return [];
	}
	if (entries.some((e) => e.name === 'SKILL.md')) return [{ name: path.basename(dir), file: path.join(dir, 'SKILL.md') }];
	if (depth === 0) return [];
	const out = [];
	for (const e of entries) {
		if ((e.isDirectory() || e.isSymbolicLink()) && e.name !== 'node_modules' && !e.name.startsWith('.')) {
			out.push(...(await skillsIn(path.join(dir, e.name), depth - 1)));
		}
	}
	return out;
}

/** Every markdown file under skills/, agents/, commands/ of a plugin. @param {string} root */
async function pluginFiles(root) {
	const out = [];
	for (const s of await skillsIn(root, 6)) out.push(s.file);
	for (const sub of ['agents', 'commands']) {
		try {
			for (const f of await fs.promises.readdir(path.join(root, sub))) if (f.endsWith('.md')) out.push(path.join(root, sub, f));
		} catch {}
	}
	return out;
}

/** @param {string | undefined} workspace */
async function discover(workspace) {
	const home = os.homedir();
	const skillMap = new Map();
	const dirs = [path.join(home, '.claude', 'skills'), ...(workspace ? [path.join(workspace, '.claude', 'skills')] : [])];
	for (const d of dirs) for (const s of await skillsIn(d)) if (!skillMap.has(s.name)) skillMap.set(s.name, await listingTokens(s.file));
	const skills = [...skillMap].map(([name, tokens]) => ({ name, tokens })).sort((a, b) => a.name.localeCompare(b.name));

	const installed = await readJson(path.join(home, '.claude', 'plugins', 'installed_plugins.json'));
	const plugins = [];
	for (const [name, installs] of Object.entries((installed && installed.plugins) || {})) {
		const root = installs[0] && installs[0].installPath;
		let tokens = 0;
		if (root) for (const f of await pluginFiles(root)) tokens += await listingTokens(f);
		plugins.push({ name, tokens });
	}
	plugins.sort((a, b) => a.name.localeCompare(b.name));

	const mcp = workspace ? await readJson(path.join(workspace, '.mcp.json')) : null;
	return { skills, plugins, mcpServers: (mcp && mcp.mcpServers) || {} };
}

/** Servers Claude would load, from `claude mcp list`. @param {string} exe @param {string | undefined} cwd */
function listMcp(exe, cwd) {
	return new Promise((resolve) => {
		execFile(exe, ['mcp', 'list'], { cwd, timeout: 60000 }, (err, stdout) => {
			const out = [];
			for (const line of (stdout || '').split('\n')) {
				const m = line.match(/^(.+?):\s+(.+?)\s+-\s+(\S+)\s*(.*)$/);
				if (m) out.push({ name: m[1], target: m[2], status: `${m[3]} ${m[4]}`.trim() });
			}
			resolve(out);
		});
	});
}

/** Project types: one folder per type in project-plugins/, labelled by launcher.json. @param {string} root */
async function listProjectTypes(root) {
	let entries;
	try {
		entries = await fs.promises.readdir(root, { withFileTypes: true });
	} catch {
		return [];
	}
	const out = [];
	for (const e of entries) {
		if (!e.isDirectory()) continue;
		const meta = (await readJson(path.join(root, e.name, 'launcher.json'))) || {};
		const skills = await skillsIn(path.join(root, e.name, 'skills'));
		out.push({ id: e.name, label: meta.label || e.name, hint: meta.hint || '', skills: skills.map((s) => s.name) });
	}
	return out.sort((a, b) => a.label.localeCompare(b.label));
}

module.exports = { discover, listMcp, listProjectTypes };
