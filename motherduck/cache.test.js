const assert = require('assert');
const { createTtlCache } = require('./cache');

(async () => {
	let time = 0;
	let ttl = 1000;
	const cache = createTtlCache(() => ttl, () => time);
	let loads = 0;
	const load = async () => ++loads;

	assert.strictEqual(await cache.get('a', load), 1);
	assert.strictEqual(await cache.get('a', load), 1, 'hit within ttl');
	assert.strictEqual(await cache.get('b', load), 2, 'other key loads');
	time = 1001;
	assert.strictEqual(await cache.get('a', load), 3, 'expired entry reloads');

	cache.clear();
	assert.strictEqual(await cache.get('a', load), 4, 'clear drops entries');

	const [x, y] = await Promise.all([cache.get('c', load), cache.get('c', load)]);
	assert.strictEqual(x, y, 'concurrent calls share one load');

	await assert.rejects(cache.get('bad', async () => { throw new Error('boom'); }));
	assert.strictEqual(await cache.get('bad', async () => 'ok'), 'ok', 'failure is not cached');

	ttl = 0;
	const before = loads;
	await cache.get('a', load);
	await cache.get('a', load);
	assert.strictEqual(loads, before + 2, 'ttl 0 disables caching');

	console.log('ok');
})();
