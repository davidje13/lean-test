#!/usr/bin/env node
import process, { platform, stderr as stderr$1, env } from 'process';
import { join, resolve, dirname, relative } from 'path';
import { standardRunner, outputs, reporters } from '../lean-test.mjs';
import { readdir, access, readFile, realpath } from 'fs/promises';
import { constants } from 'fs';
import { spawn } from 'child_process';
import { createServer } from 'http';

const SPECIAL = /[^-a-zA-Z0-9 _]/g;
const SPECIAL_REPLACE = (v) => {
	switch (v) {
		case '*': return '[^/]*';
		case '{': return '(?:';
		case '}': return ')';
		case '|': return '|';
		default: return '\\u' + v.charCodeAt(0).toString(16).padStart(4, '0');
	}
};

class PathMatcher {
	constructor(pattern) {
		const options = (Array.isArray(pattern) ? pattern : [pattern]).map((p) => p.split('/').map((seg) => {
			if (seg === '**') {
				return '(?:.+/)?';
			} else {
				const regexp = seg.replace(SPECIAL, SPECIAL_REPLACE) + '/';
				return regexp;
			}
		}));

		const full = options.map((choice) => choice.join('')).join('|');
		const part = options.map((choice) => ('(?:' + choice.join('(?:') + ')?'.repeat(choice.length))).join('|');

		this.full = new RegExp(`^(?:${full})$`, 'i');
		this.part = new RegExp(`^(?:${part})$`, 'i');
	}

	match(path) {
		return this.full.test(path + (path.endsWith('/') ? '' : '/'));
	}

	partialMatch(path) {
		return this.part.test(path + (path.endsWith('/') ? '' : '/'));
	}
}

async function* scan(dir, relative, test) {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const sub = join(dir, entry.name);
		const subRelative = relative + entry.name + '/'; // always use '/' for matching
		if (entry.isDirectory() && test(subRelative, false)) {
			yield* scan(sub, subRelative, test);
		} else if (entry.isFile() && test(subRelative, true)) {
			yield { path: sub, relative: subRelative.substr(0, subRelative.length - 1) };
		}
	}
}

async function* findPathsMatching(baseDirs, pattern, exclude = []) {
	const mPattern = new PathMatcher(pattern);
	const mExclude = new PathMatcher(exclude);
	for (const baseDir of Array.isArray(baseDirs) ? baseDirs : [baseDirs]) {
		yield* scan(baseDir, '', (path, isFile) => {
			if (mExclude.match(path)) {
				return false;
			}
			if (isFile) {
				return mPattern.match(path);
			}
			return mPattern.partialMatch(path);
		});
	}
}

const YES = ['true', 'yes', '1', 'on'];
const NO = ['false', 'no', '0', 'off'];

class ArgumentParser {
	constructor(opts) {
		this.names = new Map();
		this.defaults = {};
		Object.entries(opts).forEach(([id, v]) => {
			this.defaults[id] = v.default;
			const config = { id, type: v.type || 'boolean' };
			v.names.forEach((name) => this.names.set(name, config));
		});
	}

	loadOpt(target, name, value, extra) {
		const opt = this.names.get(name);
		if (!opt) {
			throw new Error(`Unknown flag: ${name}`);
		}
		let inc = 0;
		const getNext = () => {
			if (inc >= extra.length) {
				throw new Error(`No value given for ${name}`);
			}
			return extra[inc++];
		};
		switch (opt.type) {
			case 'boolean':
				if (opt.id in target) {
					throw new Error(`Multiple values for ${name} not supported`);
				}
				if (value === null || YES.includes(value)) {
					target[opt.id] = true;
				} else if (NO.includes(value)) {
					target[opt.id] = false;
				} else {
					throw new Error(`Unknown boolean value for ${name}: ${value}`);
				}
				break;
			case 'string':
			case 'int':
				if (opt.id in target) {
					throw new Error(`Multiple values for ${name} not supported`);
				}
				let v = value ?? getNext();
				if (opt.type === 'int') {
					v = Number.parseInt(v, 10);
				}
				target[opt.id] = v;
				break;
			case 'array':
				const list = target[opt.id] || [];
				list.push(value ?? getNext());
				target[opt.id] = list;
				break;
			default:
				throw new Error(`Unknown argument type for ${name}: ${opt.type}`);
		}
		return inc;
	}

	parse(argv, begin = 2) {
		let rest = false;
		const result = {};
		for (let i = begin; i < argv.length; ++i) {
			const arg = argv[i];
			if (rest) {
				this.loadOpt(result, null, arg, []);
			} else if (arg === '--') {
				rest = true;
			} else if (arg.startsWith('--')) {
				const [name, value] = split2(arg.substr(2), '=');
				i += this.loadOpt(result, name, value, argv.slice(i + 1));
			} else if (arg.startsWith('-')) {
				const [names, value] = split2(arg.substr(1), '=');
				for (let j = 0; j < names.length - 1; ++ j) {
					this.loadOpt(result, names[j], null, []);
				}
				i += this.loadOpt(result, names[names.length - 1], value, argv.slice(i + 1));
			} else {
				this.loadOpt(result, null, arg, []);
			}
		}
		return { ...this.defaults, ...result };
	}
}

function split2(v, s) {
	const p = v.indexOf(s);
	if (p === -1) {
		return [v, null];
	} else {
		return [v.substr(0, p), v.substr(p + 1)];
	}
}

const invoke = (exec, args, opts = {}) => new Promise((resolve, reject) => {
	const stdout = [];
	const stderr = [];
	const proc = spawn(exec, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] });
	proc.stdout.addListener('data', (d) => stdout.push(d));
	proc.stderr.addListener('data', (d) => stderr.push(d));
	proc.addListener('error', reject);
	proc.addListener('close', (exitCode) => resolve({
		exitCode,
		stdout: Buffer.concat(stdout).toString('utf-8'),
		stderr: Buffer.concat(stderr).toString('utf-8'),
	}));
});

const canExec = (path) => access(path, constants.X_OK).then(() => true, () => false);

async function which(exec) {
	const { exitCode, stdout } = await invoke('which', [exec]);
	if (exitCode === 0) {
		return stdout.trim();
	} else {
		return null;
	}
}

async function findExecutable(options) {
	for (let { path, ifPlatform } of options) {
		if (!path || (ifPlatform && ifPlatform !== platform)) {
			continue;
		}
		if (!path.includes('/') && !path.includes('\\')) {
			path = await which(path);
		}
		if (path && await canExec(path)) {
			return path;
		}
	}
	throw new Error('Unable to launch browser; executable not found');
}

const CHROME_ARGS = [
	// flag list from chrome-launcher: https://github.com/GoogleChrome/chrome-launcher/blob/master/src/flags.ts
	'--disable-features=Translate',
	'--disable-extensions',
	'--disable-component-extensions-with-background-pages',
	'--disable-background-networking',
	'--disable-component-update',
	'--disable-client-side-phishing-detection',
	'--disable-sync',
	'--metrics-recording-only',
	'--disable-default-apps',
	'--mute-audio',
	'--no-default-browser-check',
	'--no-first-run',
	'--disable-backgrounding-occluded-windows',
	'--disable-renderer-backgrounding',
	'--disable-background-timer-throttling',
	'--disable-ipc-flooding-protection',
	'--password-store=basic',
	'--use-mock-keychain',
	'--force-fieldtrials=*BackgroundTracing/default/',
];

async function launchBrowser(name, url) {
	switch (name) {
		case 'manual':
			stderr$1.write(`Ready to run test: ${url}\n`);
			return null;
		case 'chrome':
			return spawn(await getChromePath(), [
				...CHROME_ARGS,
				'--headless',
				'--remote-debugging-port=0', // required to avoid immediate termination, but not actually used
				url,
			], { stdio: 'ignore' });
		case 'firefox':
			return spawn(await getFirefoxPath(), [
				'--no-remote',
				'--new-instance',
				'--headless',
				url,
			], { stdio: 'ignore', env: { MOZ_DISABLE_AUTO_SAFE_MODE: 'true' } });
		default:
			stderr$1.write(`Unknown browser: ${name}\n`);
			stderr$1.write(`Open this URL to run tests: ${url}\n`);
			return null;
	}
}

function getChromePath() {
	return findExecutable([
		{ path: env.CHROME_PATH },
		{ ifPlatform: 'darwin', path: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' },
		{ path: 'google-chrome-stable' },
		{ path: 'google-chrome' },
		{ path: 'chromium-browser' },
		{ path: 'chromium' },
	]);
}

function getFirefoxPath() {
	return findExecutable([
		{ path: env.FIREFOX_PATH },
		{ ifPlatform: 'darwin', path: '/Applications/Firefox.app/Contents/MacOS/firefox' },
		{ path: 'firefox' },
		{ path: 'iceweasel' },
	]);
}

const CHARSET = '; charset=utf-8';

class Server {
	constructor(index, directories) {
		this.index = index;
		this.directories = directories;
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
		return (this.mimes.get(ext.toLowerCase()) || 'text/plain') + CHARSET;
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
			for (const [base, dir] of this.directories) {
				if (req.url.startsWith(base)) {
					const path = resolve(dir, req.url.substr(base.length));
					if (!path.startsWith(dir)) {
						throw new HttpError(400, 'Invalid resource path');
					}
					try {
						const data = await readFile(path);
						const ext = path.substr(path.lastIndexOf('.') + 1);
						res.setHeader('Content-Type', this.getContentType(ext));
						res.end(data);
						return;
					} catch (e) {
						throw new HttpError(404, 'Not Found');
					}
				}
			}
			throw new HttpError(404, 'Not Found');
		} catch (e) {
			let status = 500;
			let message = 'An internal error occurred';
			if (typeof e === 'object' && e.message) {
				status = e.status || 400;
				message = e.message;
			}
			if (!this.ignore404.includes(req.url)) {
				console.warn(`Error while serving ${req.url} - returning ${status} ${message}`);
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
		if (typeof addr !== 'object') {
			await this.close();
			throw new Exception(`Server.address unexpectedly returned ${addr}; aborting`);
		}
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

async function browserRunner(config, paths, listener) {
	// must use realpath because npm will install the binary as a symlink in a different folder (.bin)
	const selfPath = dirname(await realpath(process.argv[1]));
	const basePath = process.cwd();

	const index = await buildIndex(config, paths, basePath);
	const server = new Server(index, [
		['/.lean-test/', resolve(selfPath, '..')],
		['/', basePath],
	]);
	let beginTimeout;
	const resultPromise = new Promise((res, rej) => {
		let timeout = null;
		let hasSeenEvent = false;
		beginTimeout = (millis) => {
			if (!hasSeenEvent) {
				timeout = setTimeout(() => rej(new Error('browser launch timed out')), millis);
			}
		};
		server.callback = ({ events }) => {
			hasSeenEvent = true;
			if (timeout) {
				clearTimeout(timeout);
				timeout = null;
			}
			for (const event of events) {
				if (event.type === 'browser-end') {
					res(event.result);
				} else {
					listener?.(event);
				}
			}
		};
	});
	await server.listen(Number(config.port), config.host);

	const url = server.baseurl();
	const proc = await launchBrowser(config.browser, url);
	const result = await run(proc, () => {
		beginTimeout(30000);
		return resultPromise;
	});
	server.close();

	return result;
}

async function run(proc, fn) {
	if (!proc) {
		return fn();
	}

	const end = () => proc.kill();
	try {
		process.addListener('exit', end);
		return await Promise.race([
			new Promise((_, reject) => proc.once('error', (err) => reject(err))),
			fn(),
		]);
	} finally {
		proc.kill();
		process.removeListener('exit', end);
	}
}

const INDEX = `<!DOCTYPE html>
<html lang="en">
<head>
<title>Lean Test Runner</title>
<script type="module">
import run from '/.lean-test/browser-runtime.mjs';
await run(/*CONFIG*/, /*SUITES*/);
</script>
</head>
<body></body>
</html>`;

async function buildIndex(config, paths, basePath) {
	const suites = [];
	for await (const path of paths) {
		suites.push([path.relative, '/' + relative(basePath, path.path)]);
	}
	return INDEX
		.replace('/*CONFIG*/', JSON.stringify(config))
		.replace('/*SUITES*/', JSON.stringify(suites));
}

async function nodeRunner(config, paths, listener) {
	const builder = standardRunner()
		.useParallelDiscovery(config.parallelDiscovery)
		.useParallelSuites(config.parallelSuites);

	for await (const { path, relative } of paths) {
		builder.addSuite(relative, async (globals) => {
			Object.assign(global, globals);
			const result = await import(path);
			return result.default;
		});
	}

	const runner = await builder.build();
	return runner.run(listener);
}

const argparse = new ArgumentParser({
	parallelDiscovery: { names: ['parallel-discovery', 'P'], type: 'boolean', default: false },
	parallelSuites: { names: ['parallel-suites', 'parallel', 'p'], type: 'boolean', default: false },
	pathsInclude: { names: ['include', 'i'], type: 'array', default: ['**/*.{spec|test}.{js|mjs|jsx}'] },
	pathsExclude: { names: ['exclude', 'x'], type: 'array', default: ['**/node_modules', '**/.*'] },
	browser: { names: ['browser', 'b'], type: 'string', default: null },
	colour: { names: ['colour', 'color'], type: 'boolean', default: null },
	port: { names: ['port'], type: 'int', default: 0 },
	host: { names: ['host'], type: 'string', default: '127.0.0.1' },
	rest: { names: ['scan', null], type: 'array', default: ['.'] }
});

const config = argparse.parse(process.argv);

const scanDirs = config.rest.map((path) => resolve(process.cwd(), path));
const paths = findPathsMatching(scanDirs, config.pathsInclude, config.pathsExclude);

const forceTTY = (
	config.colour ??
	(Boolean(process.env.CI || process.env.CONTINUOUS_INTEGRATION) || null)
);
const stdout = new outputs.Writer(process.stdout, forceTTY);
const stderr = new outputs.Writer(process.stderr, forceTTY);
const liveReporter = new reporters.Dots(stderr);
const finalReporters = [
	new reporters.Full(stdout),
	new reporters.Summary(stdout),
];

const runner = config.browser ? browserRunner : nodeRunner;
const result = await runner(config, paths, liveReporter.eventListener);
finalReporters.forEach((reporter) => reporter.report(result));

// TODO: warn or error if any node contains 0 tests

if (result.summary.error || result.summary.fail || !result.summary.pass) {
	process.exit(1);
} else {
	process.exit(0); // explicitly exit to avoid hanging on dangling promises
}
