const assert = require('assert');
const { buildArgs, toShell, parseUsage } = require('./flags');

assert.deepStrictEqual(buildArgs({}), []);
assert.deepStrictEqual(buildArgs({ model: 'opus', toolsMode: 'none' }), ['--model', 'opus', '--tools', '']);
assert.deepStrictEqual(buildArgs({ toolsMode: 'custom', tools: ['Read', 'Edit'] }), ['--tools', 'Read,Edit']);
assert.deepStrictEqual(buildArgs({ disabledSkills: ['pdf'], disallowedTools: ['Bash'] }), ['--disallowedTools', 'Bash,Skill(pdf)']);
assert.deepStrictEqual(buildArgs({ mcpMode: 'none' }), ['--strict-mcp-config']);
assert.deepStrictEqual(
	buildArgs({ mcpMode: 'selected', mcpSelected: ['a'], mcpServers: { a: { command: 'x' }, b: {} } }),
	['--strict-mcp-config', '--mcp-config', '{"mcpServers":{"a":{"command":"x"}}}']
);
assert.deepStrictEqual(buildArgs({ disabledPlugins: ['p@m'] }), ['--settings', '{"enabledPlugins":{"p@m":false}}']);
assert.deepStrictEqual(buildArgs({ settingSources: ['user'] }), ['--setting-sources', 'user']);
assert.strictEqual(toShell('claude', ['--tools', '', '--name', "it's"]), "claude --tools '' --name 'it'\\''s'");
assert.deepStrictEqual(parseUsage('{"usage":{"input_tokens":3,"cache_creation_input_tokens":10,"cache_read_input_tokens":2},"total_cost_usd":0.5}'), { total: 15, input: 3, created: 10, read: 2, costUsd: 0.5 });
assert.deepStrictEqual(buildArgs({ pluginDirs: ['/x/y'] }), ['--plugin-dir', '/x/y']);
assert.deepStrictEqual(
	buildArgs({ folderAccess: [{ path: '/a/src', level: 'r' }, { path: '/a/out', level: 'rw' }, { path: '/a/x', level: 'none' }, { path: '/a/d', level: '' }] }),
	['--allowedTools', 'Read(//a/src/**),Read(//a/out/**),Edit(//a/out/**),Write(//a/out/**)', '--disallowedTools', 'Edit(//a/src/**),Write(//a/src/**),Read(//a/x/**),Edit(//a/x/**),Write(//a/x/**)', '--add-dir', '/a/out', '/a/x', '/a/d']
);
assert.deepStrictEqual(
	buildArgs({ folderAccess: [{ path: '/a/f.txt', file: true, level: 'r' }, { path: '/a/d', level: 'rw' }] }),
	['--allowedTools', 'Read(//a/f.txt),Read(//a/d/**),Edit(//a/d/**),Write(//a/d/**)', '--disallowedTools', 'Edit(//a/f.txt),Write(//a/f.txt)', '--add-dir', '/a/d']
);
assert.deepStrictEqual(buildArgs({ advisor: 'claude-opus-5-5', systemPrompt: 'hi', maxBudgetUsd: '5' }), ['--advisor', 'claude-opus-5-5', '--system-prompt', 'hi', '--max-budget-usd', '5']);
console.log('flags ok');
