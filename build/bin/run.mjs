#!/usr/bin/env node
import process, { platform, getuid, env } from 'process';
import { join, resolve, dirname, relative } from 'path';
import { AbstractRunner, ExitHook, standardRunner, outputs, reporters, ParallelRunner } from '../lean-test.mjs';
import { readdir, access, mkdtemp, rm, writeFile, readFile, realpath } from 'fs/promises';
import { constants } from 'fs';
import { spawn } from 'child_process';
import { tmpdir, networkInterfaces } from 'os';
import { createServer, request } from 'http';

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
		this.envs = [];
		this.defaults = {};
		this.mappings = [];
		Object.entries(opts).forEach(([id, v]) => {
			this.defaults[id] = v.default;
			if (v.mapping) {
				this.mappings.push({ id, name: v.names[0], mapping: v.mapping });
			}
			const config = { id, type: v.type || 'boolean' };
			v.names.forEach((name) => this.names.set(name, config));
			if (v.env) {
				this.envs.push({ env: v.env, config });
			}
		});
	}

	parseOpt(name, target, config, value, getValue) {
		const { id, type } = config;
		switch (type) {
			case 'boolean':
				if (id in target) {
					throw new Error(`Multiple values for ${name} not supported`);
				}
				if (value === null || YES.includes(value)) {
					target[id] = true;
				} else if (NO.includes(value)) {
					target[id] = false;
				} else {
					throw new Error(`Unknown boolean value for ${name}: ${value}`);
				}
				break;
			case 'string':
			case 'int':
				if (id in target) {
					throw new Error(`Multiple values for ${name} not supported`);
				}
				let v = value ?? getValue();
				if (type === 'int') {
					v = Number.parseInt(v, 10);
				}
				target[id] = v;
				break;
			case 'array':
			case 'set':
				const list = target[id] || [];
				list.push(...(value ?? getValue()).split(','));
				target[id] = (type === 'set') ? [...new Set(list)] : list;
				break;
			default:
				throw new Error(`Unknown argument type for ${name}: ${type}`);
		}
	}

	loadOpt(target, name, value, extra) {
		const config = this.names.get(name);
		if (!config) {
			throw new Error(`Unknown flag: ${name}`);
		}
		let inc = 0;
		const getNext = () => {
			if (inc >= extra.length) {
				throw new Error(`No value given for ${name}`);
			}
			return extra[inc++];
		};
		this.parseOpt(name, target, config, value, getNext);
		return inc;
	}

	applyMappings(options) {
		for (const { id, name, mapping } of this.mappings) {
			const value = options[id];
			if (value === undefined) {
				continue;
			}
			if (Array.isArray(value)) {
				options[id] = value.map((v) => applyMap(v, name, mapping));
			} else {
				options[id] = applyMap(value, name, mapping);
			}
		}
		return options;
	}

	parse(environment, argv, begin = 2) {
		let rest = false;
		const envResult = {};
		this.envs.forEach(({ env, config }) => {
			if (environment[env] !== undefined) {
				this.parseOpt(env, envResult, config, environment[env]);
			}
		});
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
		return this.applyMappings({ ...this.defaults, ...envResult, ...result });
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

function applyMap(value, name, mapping) {
	if (mapping instanceof Map) {
		if (!mapping.has(value)) {
			throw new Error(`Unknown ${name}: ${value}`);
		}
		return mapping.get(value);
	}
	if (mapping instanceof Set) {
		if (!mapping.has(value)) {
			throw new Error(`Unknown ${name}: ${value}`);
		}
		return value;
	}
	throw new Error(`Invalid mapping config for ${name}`);
}

function addDataListener(target) {
	const store = [];
	target.addListener('data', (d) => store.push(d));
	return () => Buffer.concat(store);
}

async function asyncListToSync(items) {
	const result = [];
	for await (const item of items) {
		result.push(item);
	}
	return result;
}

const invoke = (exec, args, opts = {}) => new Promise((resolve, reject) => {
	const proc = spawn(exec, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] });
	const stdout = addDataListener(proc.stdout);
	const stderr = addDataListener(proc.stderr);
	proc.addListener('error', reject);
	proc.addListener('close', (exitCode) => resolve({
		exitCode,
		stdout: stdout().toString('utf-8'),
		stderr: stderr().toString('utf-8'),
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
	throw new Error('browser executable not found');
}

const TEMP_BASE = join(tmpdir(), 'lean-test-');

function makeTempDir() {
	return mkdtemp(TEMP_BASE);
}

function removeTempDir(path) {
	if (!path || !path.startsWith(TEMP_BASE)) {
		// safety check
		throw new Error('Attempted to delete non-temp directory');
	}
	return rm(path, { maxRetries: 2, recursive: true });
}

const IS_ROOT = (platform === 'linux' && getuid() === 0);

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

const FIREFOX_PREFS = [
	// options list from karma-firefox-launcher: https://github.com/karma-runner/karma-firefox-launcher/blob/master/index.js
	// (some options have been removed which are obsolete or do not make sense here)
	'user_pref("browser.shell.checkDefaultBrowser", false);',
	'user_pref("browser.bookmarks.restore_default_bookmarks", false);',
	'user_pref("datareporting.policy.dataSubmissionEnabled", false);', // do not show privacy page
	'user_pref("dom.disable_open_during_load", false);', // disable popup blocker
	'user_pref("dom.min_background_timeout_value", 10);', // behave like foreground
	'user_pref("browser.tabs.remote.autostart", false);', // disable multi-process
].join('\n');

async function launchChrome(url, opts) {
	const executable = await findExecutable([
		{ path: env.CHROME_PATH },
		{ ifPlatform: 'darwin', path: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' },
		{ path: 'google-chrome-stable' },
		{ path: 'google-chrome' },
		{ path: 'chromium-browser' },
		{ path: 'chromium' },
	]);
	const extraArgs = [];
	if (IS_ROOT) { // required to prevent "Running as root without --no-sandbox is not supported"
		extraArgs.push('--no-sandbox', '--disable-setuid-sandbox');
	}
	const proc = spawn(executable, [
		...CHROME_ARGS,
		...extraArgs,
		'--headless',
		'--remote-debugging-port=0', // required to avoid immediate termination, but not actually used
		url,
	], opts);
	return { proc };
}

async function launchFirefox(url, opts) {
	const executable = await findExecutable([
		{ path: env.FIREFOX_PATH },
		{ ifPlatform: 'darwin', path: '/Applications/Firefox.app/Contents/MacOS/firefox' },
		{ path: 'firefox' },
		{ path: 'iceweasel' },
	]);

	const profileDir = await makeTempDir();
	await writeFile(join(profileDir, 'prefs.js'), FIREFOX_PREFS);

	const proc = spawn(executable, [
		'--profile',
		profileDir,
		'--headless',
		'--no-remote',
		'--new-instance',
		url,
	], { ...opts, env: { MOZ_DISABLE_AUTO_SAFE_MODE: 'true' } });
	return {
		proc,
		teardown: () => removeTempDir(profileDir),
	};
}

class EventListener {
	constructor() {
		this.listeners = new Map();
		this.eventQueue = [];
		this.nextID = 0;

		this.handle = this.handle.bind(this);
	}

	getUniqueID() {
		return (this.nextID++);
	}

	hasQueuedEvents(id) {
		const normID = String(id);
		return this.eventQueue.some((e) => (e.id === normID));
	}

	addListener(id, fn) {
		const normID = String(id);
		this.listeners.set(normID, fn);
		const events = [];
		for (let i = 0; i < this.eventQueue.length; ++i) {
			if (this.eventQueue[i].id === normID) {
				events.push(...this.eventQueue[i].events);
				this.eventQueue.splice(i, 1);
				--i;
			}
		}
		events.forEach(fn);
	}

	handle({ id, events }) {
		const normID = String(id);
		const listener = this.listeners.get(normID);
		if (listener) {
			events.forEach(listener);
		} else {
			this.eventQueue.push({ id: normID, events });
		}
	}

	unhandled() {
		if (!this.eventQueue.length) {
			return 'none';
		}
		return this.eventQueue.map(({ id, events }) => `'${id}' (${events.length})`).join(', ');
	}
}

const CHARSET = '; charset=utf-8';

class Server {
	constructor(index, postListener, directories) {
		this.index = index;
		this.postListener = postListener;
		this.directories = directories;
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

	getContentType(ext) {
		return (this.mimes.get(ext.toLowerCase()) || 'text/plain') + CHARSET;
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
			for (const [base, dir] of this.directories) {
				if (url.startsWith(base)) {
					const path = resolve(dir, url.substr(base.length));
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

	baseurl(overrideAddr) {
		const address = overrideAddr ?? this.address;
		let hostname;
		if (typeof address === 'object') {
			if (address.family.toLowerCase() === 'ipv6') {
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

class HttpError extends Error {
	constructor(status, message) {
		super(message);
		this.status = status;
	}
}

class ActiveTestTracker {
	constructor() {
		this.active = new Map();
		this.eventListener = (event) => {
			if (event.type === 'begin') {
				this.active.set(event.id, event);
			} else if (event.type === 'complete') {
				this.active.delete(event.id);
			}
		};
	}

	get() {
		const result = [];
		this.active.forEach((beginEvent) => {
			if (!beginEvent.isBlock) {
				const parts = [];
				for (let e = beginEvent; e; e = this.active.get(e.parent)) {
					if (e.label !== null) {
						parts.push(e.label);
					}
				}
				result.push(parts.reverse());
			}
		});
		return result;
	}
}

const INITIAL_CONNECT_TIMEOUT = 30000;
const PING_TIMEOUT = 2000;

class HttpServerRunner extends AbstractRunner {
	constructor({ port, host, ...browserConfig }, paths) {
		super();
		this.port = port;
		this.host = host;
		this.browserConfig = browserConfig;
		this.paths = paths;
	}

	async prepare(sharedState) {
		if (sharedState[HttpServerRunner.POST_LISTENER]) {
			return;
		}
		sharedState[HttpServerRunner.POST_LISTENER] = new EventListener();

		// must use realpath because npm will install the binary as a symlink in a different folder (.bin)
		const selfPath = dirname(await realpath(process.argv[1]));
		const basePath = process.cwd();

		const index = await buildIndex(this.browserConfig, this.paths, basePath);
		const server = new Server(index, sharedState[HttpServerRunner.POST_LISTENER].handle, [
			['/.lean-test/', resolve(selfPath, '..')],
			['/', basePath],
		]);
		await server.listen(Number(this.port), this.host);
		sharedState[HttpServerRunner.SERVER] = server;
	}

	async teardown(sharedState) {
		if (!sharedState[HttpServerRunner.POST_LISTENER]) {
			return;
		}
		const server = sharedState[HttpServerRunner.SERVER];
		delete sharedState[HttpServerRunner.SERVER];
		delete sharedState[HttpServerRunner.POST_LISTENER];
		server?.close();
	}

	async invoke(listener, sharedState) {
		const { browserID, url } = this.makeUniqueTarget(sharedState);
		process.stderr.write(`Ready to run test: ${url}\n`);
		return this.invokeWithBrowserID(listener, sharedState, browserID);
	}

	makeUniqueTarget(sharedState, overrideAddr = null) {
		const server = sharedState[HttpServerRunner.SERVER];
		const postListener = sharedState[HttpServerRunner.POST_LISTENER];

		const browserID = postListener.getUniqueID();
		return { browserID, url: server.baseurl(overrideAddr) + '#' + browserID };
	}

	invokeWithBrowserID(listener, sharedState, browserID) {
		const postListener = sharedState[HttpServerRunner.POST_LISTENER];
		const tracker = new ActiveTestTracker();

		return new Promise((res, reject) => {
			let connectedUntil = Date.now() + INITIAL_CONNECT_TIMEOUT;
			let connected = false;
			const checkPing = setInterval(() => {
				if (Date.now() > connectedUntil) {
					clearInterval(checkPing);
					if (!connected) {
						reject(new Error('browser launch timed out'));
					} else {
						reject(new DisconnectError('unknown disconnect'));
					}
				}
			}, 250);
			postListener.addListener(browserID, (event) => {
				connectedUntil = Date.now() + PING_TIMEOUT;
				switch (event.type) {
					case 'ping':
						break;
					case 'browser-connect':
						if (connected) {
							clearInterval(checkPing);
							reject(new DisconnectError('multiple browser connections (maybe page reloaded?)'));
						}
						connected = true;
						break;
					case 'browser-end':
						clearInterval(checkPing);
						res(event.result);
						break;
					case 'browser-error':
						clearInterval(checkPing);
						reject(new DisconnectError(`browser error: ${event.error}`));
						break;
					case 'browser-unload':
						clearInterval(checkPing);
						reject(new DisconnectError(`test page closed (did a test change window.location?)`));
						break;
					default:
						tracker.eventListener(event);
						listener(event);
				}
			});
		}).catch((e) => {
			if (e instanceof DisconnectError) {
				throw new Error(`Browser disconnected: ${e.message}\nActive tests:\n${tracker.get().map((p) => '- ' + p.join(' -> ')).join('\n') || 'none'}\n`);
			}
			throw new Error(`Error running browser: ${e}\n${this.debug()}\nUnhandled events: ${postListener.unhandled()}\n`);
		});
	}

	debug() {
		return 'unknown';
	}
}

HttpServerRunner.SERVER = Symbol();
HttpServerRunner.POST_LISTENER = Symbol();

const INDEX = `<!DOCTYPE html>
<html lang="en">
<head>
<title>Lean Test Runner - loading</title>
<script type="module">
import run from '/.lean-test/browser-runtime.mjs';
const id = window.location.hash.substr(1);
window.location.hash = '';
run(id, /*CONFIG*/, /*SUITES*/).then(() => window.close());
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

class DisconnectError extends Error {
	constructor(message) {
		super(message);
	}
}

class BrowserProcessRunner extends HttpServerRunner {
	constructor(config, paths, browserLauncher) {
		super(config, paths);
		this.browserLauncher = browserLauncher;
		this.stdout = () => '';
		this.stderr = () => '';
		this.launched = null;
	}

	async teardown(sharedState) {
		try {
			if (this.launched) {
				this.launched.proc.kill();
				await this.launched.teardown?.();
				this.launched = null;
			}
		} finally {
			await super.teardown(sharedState);
		}
	}

	async invoke(listener, sharedState) {
		const { browserID, url } = this.makeUniqueTarget(sharedState);
		this.launched = await this.browserLauncher(url, { stdio: ['ignore', 'pipe', 'pipe'] });
		this.stdout = addDataListener(this.launched.proc.stdout);
		this.stderr = addDataListener(this.launched.proc.stderr);
		return Promise.race([
			new Promise((_, reject) => this.launched.proc.once('error', (err) => reject(err))),
			super.invokeWithBrowserID(listener, sharedState, browserID),
		]);
	}

	debug() {
		return `stderr:\n${this.stdout().toString('utf-8')}\nstdout:\n${this.stderr().toString('utf-8')}`;
	}
}

// https://w3c.github.io/webdriver/

class WebdriverSession {
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

WebdriverSession.create = function(host, browser) {
	const promise = withRetry(() => sendJSON('POST', `${host}/session`, {
		capabilities: {
			firstMatch: [{ browserName: browser }]
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
};

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

class WebdriverRunner extends HttpServerRunner {
	constructor(config, paths, browser, webdriverHost) {
		super(config, paths);
		this.browser = browser;
		this.webdriverHost = webdriverHost;
		this.session = null;
		this.finalURL = null;
		this.finalTitle = null;
	}

	async prepare(sharedState) {
		await super.prepare(sharedState);

		this.session = await WebdriverSession.create(this.webdriverHost, this.browser);
	}

	async teardown(sharedState) {
		const session = this.session;
		this.session = null;
		try {
			if (session !== null) {
				this.finalURL = await session.getUrl();
				this.finalTitle = await session.getTitle();
				await session.close();
			}
		} finally {
			await super.teardown(sharedState);
		}
	}

	async invoke(listener, sharedState) {
		const server = sharedState[HttpServerRunner.SERVER];
		const postListener = sharedState[HttpServerRunner.POST_LISTENER];

		const browserID = await makeConnection(this.session, server, postListener);
		return super.invokeWithBrowserID(listener, sharedState, browserID);
	}

	debug() {
		if (this.finalURL === null) {
			return 'failed to create session';
		}
		return `URL='${this.finalURL}' Title='${this.finalTitle}'`;
	}
}

async function makeConnection(session, server, postListener) {
	// try various URLs until something works, because we don't know what environment we're in
	const urls = [...new Set([
		server.baseurl(process.env.WEBDRIVER_TESTRUNNER_HOST),
		server.baseurl(),
		server.baseurl('host.docker.internal'), // See https://stackoverflow.com/a/43541732/1180785
		...Object.values(networkInterfaces())
			.flatMap((i) => i)
			.filter((i) => !i.internal)
			.map((i) => server.baseurl(i)),
	])];

	let lastError = null;
	for (const url of urls) {
		const browserID = postListener.getUniqueID();
		try {
			await session.setUrl(url + '#' + browserID);
			// Firefox via webdriver lies about the connection, returning success
			// even if it fails, so we have to check that it actually did connect.
			// Unfortunately there's no synchronous way of doing this (Firefox
			// returns from POST url before it has reached DOMContentLoaded), so
			// we need to poll.
			const tm0 = Date.now();
			do {
				if (postListener.hasQueuedEvents(browserID)) {
					return browserID;
				}
				await new Promise((resolve) => setTimeout(resolve, 50));
			} while (Date.now() < tm0 + 1000);
		} catch (e) {
			lastError = e;
		}
	}
	if (!lastError) {
		throw new Error(`unable to access test server\n(tried ${urls.join(', ')})`)
	}
	throw new Error(`error accessing test server ${lastError}\n(tried ${urls.join(', ')})`);
}

const manualBrowserRunner = (config, paths) => new HttpServerRunner(config, paths);

const autoBrowserRunner = (browser, launcher) => (config, paths) => {
	const webdriverEnv = browser.toUpperCase().replace(/[^A-Z]+/g, '_');
	const webdriverHost = env[`WEBDRIVER_HOST_${webdriverEnv}`] || env.WEBDRIVER_HOST || null;
	if (webdriverHost) {
		return new WebdriverRunner(config, paths, browser, webdriverHost);
	} else {
		return new BrowserProcessRunner(config, paths, launcher);
	}
};

async function inProcessNodeRunner(config, paths) {
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

	return builder.build();
}

const targets = new Map([
	['node', { name: 'Node.js', make: inProcessNodeRunner }],
	['url', { name: 'Custom Browser', make: manualBrowserRunner }],
	['chrome', { name: 'Google Chrome', make: autoBrowserRunner('chrome', launchChrome) }],
	['firefox', { name: 'Mozilla Firefox', make: autoBrowserRunner('firefox', launchFirefox) }],
]);

const argparse = new ArgumentParser({
	parallelDiscovery: { names: ['parallel-discovery', 'P'], env: 'PARALLEL_DISCOVERY', type: 'boolean', default: false },
	parallelSuites: { names: ['parallel-suites', 'parallel', 'p'], env: 'PARALLEL_SUITES', type: 'boolean', default: false },
	pathsInclude: { names: ['include', 'i'], type: 'set', default: ['**/*.{spec|test}.{js|mjs|cjs|jsx}'] },
	pathsExclude: { names: ['exclude', 'x'], type: 'set', default: ['**/node_modules', '**/.*'] },
	target: { names: ['target', 't'], env: 'TARGET', type: 'set', default: ['node'], mapping: targets },
	colour: { names: ['colour', 'color'], env: 'OUTPUT_COLOUR', type: 'boolean', default: null },
	port: { names: ['port'], env: 'TESTRUNNER_PORT', type: 'int', default: 0 },
	host: { names: ['host'], env: 'TESTRUNNER_HOST', type: 'string', default: '127.0.0.1' },
	scan: { names: ['scan', null], type: 'set', default: ['.'] }
});

try {
	const config = argparse.parse(process.env, process.argv);

	const scanDirs = config.scan.map((path) => resolve(process.cwd(), path));
	const paths = await asyncListToSync(findPathsMatching(scanDirs, config.pathsInclude, config.pathsExclude));

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

	const multi = new ParallelRunner();
	for (const target of config.target) {
		multi.add(target.name, await target.make(config, paths));
	}
	const result = await multi.run(liveReporter.eventListener);
	finalReporters.forEach((reporter) => reporter.report(result));

	// TODO: warn or error if any node contains 0 tests

	if (result.summary.error || result.summary.fail || !result.summary.pass) {
		process.exit(1);
	} else {
		process.exit(0); // explicitly exit to avoid hanging on dangling promises
	}
} catch (e) {
	if (!(e instanceof Error)) {
		throw e;
	}
	process.stdout.write(`\n${e.message}\n`);
	process.exit(1);
}
