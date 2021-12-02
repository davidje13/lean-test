import { request } from 'http';

export async function beginWebdriverSession(host, browser, urlOptions, path) {
	const { value: { sessionId } } = await sendJSON('POST', `${host}/session`, {
		capabilities: {
			firstMatch: [{ browserName: browser }]
		},
	});
	const sessionBase = `${host}/session/${encodeURIComponent(sessionId)}`;
	const close = () => sendJSON('DELETE', sessionBase);

	let lastError = null;
	for (const url of urlOptions) {
		try {
			await sendJSON('POST', `${sessionBase}/url`, { url: url + path });
			return close;
		} catch (e) {
			lastError = e;
		}
	}
	await close();
	throw lastError;
}

function sendJSON(method, path, data) {
	const errorInfo = `WebDriver error for ${method} ${path}: `;
	const content = new TextEncoder().encode(JSON.stringify(data));
	return new Promise((resolve, reject) => {
		let timeout = setTimeout(() => reject(new Error(`${errorInfo}timeout waiting for session (does this runner support the requested browser?)`)), 30000);
		const url = new URL(path.includes('://') ? path : `http://${path}`);
		const opts = {
			hostname: url.hostname,
			port: url.port,
			path: url.pathname,
			method,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'Content-Length': content.length,
			},
		};
		const req = request(opts, (res) => {
			const data = [];
			clearTimeout(timeout);
			timeout = setTimeout(() => reject(new Error(`${errorInfo}timeout receiving data (got HTTP ${res.statusCode})`)), 10000);
			res.addListener('data', (d) => data.push(d));
			res.addListener('close', () => {
				clearTimeout(timeout);
				const dataString = Buffer.concat(data).toString('utf-8');
				if (res.statusCode >= 300) {
					reject(new Error(`${errorInfo}${res.statusCode}\n\n${dataString}`));
				} else {
					resolve(JSON.parse(dataString));
				}
			});
		});
		req.addListener('error', (e) => {
			clearTimeout(timeout);
			reject(new Error(`${errorInfo}${e.message}`));
		});
		if (data !== undefined) {
			req.write(content);
		}
		req.end();
	});
}
