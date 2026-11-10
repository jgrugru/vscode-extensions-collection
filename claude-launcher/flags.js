/**
 * Pure logic: wizard state -> claude CLI args. No `vscode` import.
 * @typedef {Object} State
 * @property {string} [model]
 * @property {string} [effort]
 * @property {string} [permissionMode]
 * @property {'default'|'none'|'custom'} [toolsMode]
 * @property {string[]} [tools]
 * @property {string[]} [allowedTools]
 * @property {string[]} [disallowedTools]
 * @property {'all'|'none'|'selected'} [mcpMode]
 * @property {Record<string, object>} [mcpServers] workspace servers available to pick from
 * @property {string[]} [mcpSelected]
 * @property {string[]} [disabledPlugins]
 * @property {string[]} [disabledSkills]
 * @property {boolean} [disableSlashCommands]
 * @property {string[]} [settingSources]
 * @property {boolean} [bare]
 * @property {boolean} [safeMode]
 * @property {boolean} [restricted]
 * @property {string} [appendSystemPrompt]
 * @property {string} [systemPrompt]
 * @property {string} [maxBudgetUsd]
 * @property {string} [advisor]
 * @property {string[]} [addDirs]
 * @property {string} [name]
 * @property {string} [worktree]
 * @property {boolean} [continueSession]
 * @property {string[]} [pluginDirs]
 */

/** @param {string} s */
function shellQuote(s) {
	return /^[A-Za-z0-9_@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;
}

/** @param {State} state @returns {string[]} */
function buildArgs(state) {
	const a = [];
	const list = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);
	if (state.model) a.push('--model', state.model);
	if (state.effort) a.push('--effort', state.effort);
	if (state.advisor) a.push('--advisor', state.advisor);
	if (state.permissionMode) a.push('--permission-mode', state.permissionMode);

	if (state.toolsMode === 'none') a.push('--tools', '');
	else if (state.toolsMode === 'custom') a.push('--tools', list(state.tools).join(','));
	const allowed = list(state.allowedTools);
	const denied = [...list(state.disallowedTools), ...list(state.disabledSkills).map((s) => `Skill(${s})`)];
	for (const f of Array.isArray(state.folderAccess) ? state.folderAccess : []) {
		const p = f.file ? `/${f.path}` : `/${f.path}/**`;
		const rule = (tool) => `${tool}(${p})`;
		if (f.level === 'r') { allowed.push(rule('Read')); denied.push(rule('Edit'), rule('Write')); }
		else if (f.level === 'rw') allowed.push(rule('Read'), rule('Edit'), rule('Write'));
		else if (f.level === 'none') denied.push(rule('Read'), rule('Edit'), rule('Write'));
	}
	if (allowed.length) a.push('--allowedTools', allowed.join(','));
	if (denied.length) a.push('--disallowedTools', denied.join(','));

	if (state.mcpMode === 'none') {
		a.push('--strict-mcp-config');
	} else if (state.mcpMode === 'selected') {
		const servers = {};
		for (const n of list(state.mcpSelected)) if (state.mcpServers && state.mcpServers[n]) servers[n] = state.mcpServers[n];
		a.push('--strict-mcp-config', '--mcp-config', JSON.stringify({ mcpServers: servers }));
	}

	if (list(state.disabledPlugins).length) {
		const enabledPlugins = {};
		for (const p of list(state.disabledPlugins)) enabledPlugins[p] = false;
		a.push('--settings', JSON.stringify({ enabledPlugins }));
	}
	if (state.disableSlashCommands) a.push('--disable-slash-commands');
	if (Array.isArray(state.settingSources)) a.push('--setting-sources', state.settingSources.join(','));
	if (state.bare) a.push('--bare');
	if (state.safeMode) a.push('--safe-mode');
	if (state.restricted) a.push('--restricted');
	if (state.systemPrompt) a.push('--system-prompt', state.systemPrompt);
	if (state.maxBudgetUsd) a.push('--max-budget-usd', state.maxBudgetUsd);
	if (state.appendSystemPrompt) a.push('--append-system-prompt', state.appendSystemPrompt);
	const extra = [...(Array.isArray(state.folderAccess) ? state.folderAccess.slice(1).map((f) => (f.file ? f.path.replace(/\/[^/]*$/, '') : f.path)) : []), ...list(state.addDirs)];
	if (extra.length) a.push('--add-dir', ...extra);
	if (state.name) a.push('--name', state.name);
	if (state.worktree === true) a.push('--worktree');
	else if (state.worktree) a.push('--worktree', state.worktree);
	for (const d of list(state.pluginDirs)) a.push('--plugin-dir', d);
	if (state.continueSession) a.push('--continue');
	return a;
}

/** @param {string} exe @param {string[]} args */
function toShell(exe, args) {
	return [shellQuote(exe), ...args.map(shellQuote)].join(' ');
}

/** Sum startup input tokens from `claude -p --output-format json` output. @param {string} stdout */
function parseUsage(stdout) {
	const r = JSON.parse(stdout);
	const u = r.usage || {};
	const input = u.input_tokens || 0;
	const created = u.cache_creation_input_tokens || 0;
	const read = u.cache_read_input_tokens || 0;
	return { total: input + created + read, input, created, read, costUsd: r.total_cost_usd };
}

module.exports = { buildArgs, toShell, shellQuote, parseUsage };
