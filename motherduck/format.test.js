const assert = require('assert');
const { formatBytes, formatDuration } = require('./format');

assert.strictEqual(formatBytes(0), '0 B');
assert.strictEqual(formatBytes(500), '500 B');
assert.strictEqual(formatBytes(1024), '1.0 KB');
assert.strictEqual(formatBytes(1536), '1.5 KB');
assert.strictEqual(formatBytes(1024 * 1024), '1.0 MB');
assert.strictEqual(formatBytes(1024 * 1024 * 1024), '1.0 GB');

assert.strictEqual(formatDuration(500), '0.5s');
assert.strictEqual(formatDuration(12300), '12.3s');
assert.strictEqual(formatDuration(65000), '1m 5s');
assert.strictEqual(formatDuration(125000), '2m 5s');

console.log('ok');
