import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { createServer } from 'http';

const CHARSET = '; charset=utf-8';

export default class Server {
	constructor(index, postListener, handlers) {
		this.index = index;
		this.postListener = postListener;
		this.handlers = handlers.filter((h) => h);
		this.mimes = new Map([
			['js', 'text/javascript'],
			['mjs', 'text/javascript'],
			['cjs', 'text/javascript'],
			['css', 'text/css'],
			['htm', 'text/html'],
			['html', 'text/html'],
			['txt', 'text/plain'],
			['json', 'application/json'],
		]);
		this.ignore404 = ['/favicon.ico'];

		this.address = null;
		this.server = createServer(this._handleRequest.bind(this));
	}

	getContentType(path) {
		const ext = path.substr(path.lastIndexOf('.') + 1).toLowerCase();
		return (this.mimes.get(ext) || 'text/plain') + CHARSET;
	}

	async _handleRequest(req, res) {
		const url = req.url.split('?')[0];
		try {
			if (url === '/') {
				if (req.method === 'POST') {
					const all = [];
					for await (const part of req) {
						all.push(part);
					}
					this.postListener(JSON.parse(Buffer.concat(all).toString('utf-8')));
					res.setHeader('Content-Type', this.getContentType('json'));
					res.end(JSON.stringify({'result': 'ok'}));
				} else {
					res.setHeader('Content-Type', this.getContentType('html'));
					res.end(this.index);
				}
				return;
			}
			if (url.includes('..')) {
				throw new HttpError(400, 'Invalid resource path');
			}
			for (const handler of this.handlers) {
				if (await handler(this, url, res)) {
					return;
				}
			}
			throw new HttpError(404, 'Not Found');
		} catch (e) {
			let status = 500;
			let message = 'An internal error occurred';
			if (e && typeof e === 'object' && e.message) {
				status = e.status || 400;
				message = e.message;
			}
			if (!this.ignore404.includes(url)) {
				console.warn(`Error while serving ${url} - returning ${status} ${message}`);
			}
			res.statusCode = status;
			res.setHeader('Content-Type', this.getContentType('txt'));
			res.end(message + '\n');
		}
	}

	async sendFile(path, res) {
		try {
			const data = await readFile(path);
			res.setHeader('Content-Type', this.getContentType(path));
			res.end(data);
		} catch (e) {
			throw new HttpError(404, `File Not Found: ${path}`);
		}
	}

	baseurl(overrideAddr) {
		const address = overrideAddr ?? this.address;
		let hostname;
		if (typeof address === 'object') {
			// check for Node 18 (numeric) and Node <18 (string) APIs for address.family
			if (address.family === 6 || address.family === 'IPv6') {
				hostname = `[${address.address}]`;
			} else {
				hostname = address.address;
			}
		} else {
			hostname = address;
		}
		return `http://${hostname}:${this.address.port}/`;
	}

	async listen(port, hostname) {
		await new Promise((resolve) => this.server.listen(port, hostname, resolve));
		const addr = this.server.address();
		if (typeof addr !== 'object') {
			await this.close();
			throw new Exception(`Server.address unexpectedly returned ${addr}; aborting`);
		}
		this.address = addr;
	}

	async close() {
		if (!this.address) {
			return;
		}
		this.address = null;
		this.port = null;
		await new Promise((resolve) => this.server.close(resolve));
	}
}

Server.directory = (base, dir, preprocessor) => async (server, url, res) => {
	if (!url.startsWith(base)) {
		return false;
	}
	const path = resolve(dir, url.substr(base.length));
	if (!path.startsWith(dir)) {
		throw new HttpError(400, 'Invalid resource path');
	}
	const fullPath = await (preprocessor ?? fileLoader).resolve(path, dir + '/index.htm');
	if (!fullPath) {
		throw new HttpError(404, `Not Found: ${dir + '/index.htm'} from ${path}`);
	}
	const loaded = await (preprocessor ?? fileLoader).load(fullPath);
	if (!loaded) {
		throw new HttpError(404, `Unable to load ${fullPath}`);
	}
	res.setHeader('Content-Type', server.getContentType(loaded.path));
	res.end(loaded.content);
	return true;
};

const fileLoader = {
	resolve: (path) => path,
	load: async (path) => ({ path, content: await readFile(path).catch(() => null) }),
};

class HttpError extends Error {
	constructor(status, message) {
		super(message);
		this.status = status;
	}
}

Server.HttpError = HttpError;
