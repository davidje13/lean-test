import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { createServer } from 'http';
import process from 'process';

const CHARSET = '; charset=utf-8';

export default class Server {
	constructor(workingDir, index, leanTestBundle) {
		this.workingDir = workingDir;
		this.index = index;
		this.leanTestBundle = leanTestBundle;
		this.callback = null;
		this.mimes = new Map([
			['js', 'application/javascript'],
			['mjs', 'application/javascript'],
			['css', 'text/css'],
			['htm', 'text/html'],
			['html', 'text/html'],
			['txt', 'text/plain'],
			['json', 'text/json'],
		]);
		this.ignore404 = ['/favicon.ico'];

		this.hostname = null;
		this.port = null;
		this.server = createServer(this._handleRequest.bind(this));
		this.close = this.close.bind(this);
	}

	getContentType(ext) {
		return (this.mimes.get(ext) || 'text/plain') + CHARSET;
	}

	async _handleRequest(req, res) {
		try {
			if (req.url === '/') {
				if (req.method === 'POST') {
					const all = [];
					for await (const part of req) {
						all.push(part);
					}
					this.callback(JSON.parse(Buffer.concat(all).toString('utf-8')));
					res.setHeader('Content-Type', this.getContentType('json'));
					res.end(JSON.stringify({'result': 'ok'}));
				} else {
					res.setHeader('Content-Type', this.getContentType('html'));
					res.end(this.index);
				}
				return;
			}
			if (req.url.includes('..')) {
				throw new HttpError(400, 'Invalid resource path');
			}
			let path;
			if (req.url === '/lean-test.mjs') {
				path = this.leanTestBundle;
			} else {
				path = resolve(this.workingDir, req.url.substr(1));
				if (!path.startsWith(this.workingDir)) {
					throw new HttpError(400, 'Invalid resource path');
				}
			}

			try {
				const data = await readFile(path);
				const ext = path.substr(path.lastIndexOf('.') + 1).toLowerCase();
				res.setHeader('Content-Type', this.getContentType(ext));
				res.end(data);
			} catch (e) {
				throw new HttpError(404, 'Not Found');
			}
		} catch (e) {
			if (!this.ignore404.includes(req.url)) {
				console.warn(`Error while serving ${req.url}`);
			}
			let status = 500;
			let message = 'An internal error occurred';
			if (typeof e === 'object' && e.message) {
				status = e.status || 400;
				message = e.message;
			}
			res.statusCode = status;
			res.setHeader('Content-Type', this.getContentType('txt'));
			res.end(message + '\n');
		}
	}

	baseurl() {
		return 'http://' + this.hostname + ':' + this.port + '/';
	}

	async listen(port, hostname) {
		await new Promise((resolve) => this.server.listen(port, hostname, resolve));
		const addr = this.server.address();
		this.hostname = addr.address;
		this.port = addr.port;
		process.addListener('SIGINT', this.close);
	}

	async close() {
		if (!this.hostname) {
			return;
		}
		this.hostname = null;
		this.port = null;
		await new Promise((resolve) => this.server.close(resolve));
		process.removeListener('SIGINT', this.close);
	}
}

class HttpError extends Error {
	constructor(status, message) {
		super(message);
		this.status = status;
	}
}
