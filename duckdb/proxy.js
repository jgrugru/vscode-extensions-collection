const http = require('http');

const STRIPPED_RESPONSE_HEADERS = new Set([
	'x-frame-options',
	'content-security-policy',
	'cross-origin-opener-policy',
	'cross-origin-embedder-policy',
]);

/**
 * Reverse proxy to the DuckDB UI server that drops the headers which forbid
 * embedding the page in an iframe (Simple Browser renders pages in one).
 * @param {number} targetPort
 * @param {number} [listenPort] defaults to a free port
 * @returns {Promise<http.Server>} listening on localhost
 */
function startFramingProxy(targetPort, listenPort = 0) {
	const server = http.createServer((req, res) => {
		const headers = { ...req.headers, host: `localhost:${targetPort}` };
		if (headers.origin) {
			headers.origin = `http://localhost:${targetPort}`;
		}
		if (headers.referer) {
			headers.referer = `http://localhost:${targetPort}/`;
		}
		const upstream = http.request(
			{ host: 'localhost', port: targetPort, method: req.method, path: req.url, headers },
			(upRes) => {
				const out = {};
				for (const [name, value] of Object.entries(upRes.headers)) {
					if (!STRIPPED_RESPONSE_HEADERS.has(name)) {
						out[name] = value;
					}
				}
				res.writeHead(upRes.statusCode || 502, out);
				upRes.pipe(res);
			},
		);
		upstream.on('error', () => {
			res.writeHead(502);
			res.end('DuckDB UI server unreachable');
		});
		res.on('close', () => upstream.destroy());
		req.pipe(upstream);
	});
	return new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(listenPort, 'localhost', () => resolve(server));
	});
}

module.exports = { startFramingProxy };
