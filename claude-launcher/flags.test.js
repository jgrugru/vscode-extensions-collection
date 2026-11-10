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
console.log('flags ok');
