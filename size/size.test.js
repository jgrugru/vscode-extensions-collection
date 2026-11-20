const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { formatBytes, describe, measure } = require('./size');

assert.strictEqual(formatBytes(0), '0 bytes');
assert.strictEqual(formatBytes(1), '1 byte');
assert.strictEqual(formatBytes(999), '999 bytes');
assert.strictEqual(formatBytes(1000), '1.00 KB');
assert.strictEqual(formatBytes(15300), '15.3 KB');
assert.strictEqual(formatBytes(123456789), '123 MB');
assert.strictEqual(formatBytes(2500000000), '2.50 GB');

assert.strictEqual(describe('a.txt', { bytes: 10, files: 1, folders: 0, skipped: 0 }), 'a.txt: 10 bytes');
assert.strictEqual(
  describe('src', { bytes: 2000, files: 1234, folders: 1, skipped: 2 }),
  'src: 2.00 KB - 1,234 files, 1 folder - 2 unreadable items skipped'
);

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'measure-size-'));
  try {
    fs.mkdirSync(path.join(root, 'a', 'b'), { recursive: true });
    fs.writeFileSync(path.join(root, 'one.txt'), 'x'.repeat(100));
    fs.writeFileSync(path.join(root, 'a', 'two.txt'), 'x'.repeat(250));
    fs.writeFileSync(path.join(root, 'a', 'b', 'three.txt'), 'x'.repeat(650));

    assert.deepStrictEqual(await measure(root), { bytes: 1000, files: 3, folders: 2, skipped: 0 });
    assert.deepStrictEqual(await measure(path.join(root, 'one.txt')), { bytes: 100, files: 1, folders: 0, skipped: 0 });
    assert.deepStrictEqual(await measure(path.join(root, 'missing')), { bytes: 0, files: 0, folders: 0, skipped: 1 });
    assert.deepStrictEqual(await measure(root, () => true), { bytes: 0, files: 0, folders: 0, skipped: 0 });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  console.log('size tests passed');
})();
