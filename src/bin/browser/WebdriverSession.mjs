import { request } from 'http';
import { addDataListener } from '../utils.mjs';
import { ExitHook } from '../../lean-test.mjs';

// https://w3c.github.io/webdriver/

export default class WebdriverSession {
	constructor(sessionBase) {
		this.sessionBase = sessionBase;
	}

	setUrl(url) {
		return sendJSON('POST', `${this.sessionBase}/url`, { url });
	}

	getUrl() {
		return get(`${this.sessionBase}/url`);
	}

	getTitle() {
		return get(`${this.sessionBase}/title`);
	}

	close() {
		return withRetry(() => sendJSON('DELETE', this.sessionBase), 5000);
	}
}

WebdriverSession.create = function(host, browser, desiredCapabilities = {}) {
	const promise = withRetry(() => sendJSON('POST', `${host}/session`, {
		capabilities: {
			alwaysMatch: { browserName: browser },
			firstMatch: [desiredCapabilities, {}],
		},
	}), 20000);
	const fin = new ExitHook(async () => {
		const { value: { sessionId } } = await promise;
		const session = new WebdriverSession(`${host}/session/${encodeURIComponent(sessionId)}`);
		return session.close();
	});
	return fin.ifExitDuring(async () => {
		const { value: { sessionId } } = await promise;
		return new WebdriverSession(`${host}/session/${encodeURIComponent(sessionId)}`);
	});
}

async function withRetry(fn, timeout) {
	const delay = 100;
	const begin = Date.now();
	while (true) {
		try {
			return await fn();
		} catch (e) {
			if (Date.now() + delay >= begin + timeout) {
				throw e;
			}
		}
		await new Promise((resolve) => setTimeout(resolve, delay));
	}
}

const get = async (url) => (await sendJSON('GET', url)).value;

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
			clearTimeout(timeout);
			timeout = setTimeout(() => reject(new Error(`${errorInfo}timeout receiving data (got HTTP ${res.statusCode})`)), 10000);
			const resultData = addDataListener(res);
			res.addListener('close', () => {
				clearTimeout(timeout);
				const dataString = resultData().toString('utf-8');
				if (res.statusCode >= 300) {
					const error = new Error(`${errorInfo}${res.statusCode}\n\n${dataString}`);
					try {
						error.json = JSON.parse(dataString);
					} catch (ignore) {}
					reject(error);
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
