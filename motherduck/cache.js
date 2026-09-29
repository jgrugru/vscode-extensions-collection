/**
 * Time-based cache of async results, keyed by string. Concurrent calls for one key share one load.
 * A failed load is not cached.
 * @param {() => number} ttlMs read on every call, so a settings change applies at once; 0 or less disables caching
 * @param {() => number} [now]
 */
function createTtlCache(ttlMs, now = Date.now) {
	/** @type {Map<string, {expires: number, promise: Promise<any>}>} */
	const entries = new Map();

	/** @template T @param {string} key @param {() => Promise<T>} load @returns {Promise<T>} */
	function get(key, load) {
		const ttl = ttlMs();
		if (ttl <= 0) {
			return load();
		}
		const hit = entries.get(key);
		if (hit && hit.expires > now()) {
			return hit.promise;
		}
		const promise = load();
		const entry = { expires: now() + ttl, promise };
		entries.set(key, entry);
		promise.catch(() => {
			if (entries.get(key) === entry) {
				entries.delete(key);
			}
		});
		return promise;
	}

	function clear() {
		entries.clear();
	}

	return { get, clear };
}

module.exports = { createTtlCache };
