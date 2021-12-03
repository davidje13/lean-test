#!/usr/bin/env node
import process, { platform, getuid, stderr, env } from 'process';
import { join, resolve, dirname, relative } from 'path';
import { MultiRunner, standardRunner, outputs, reporters } from '../lean-test.mjs';
import { readdir, access, mkdtemp, rm, writeFile, readFile, realpath } from 'fs/promises';
import { tmpdir, networkInterfaces } from 'os';
import { constants } from 'fs';
import { spawn } from 'child_process';
import { request, createServer } from 'http';

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
		Object.entries(opts).forEach(([id, v]) => {
			this.defaults[id] = v.default;
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
				const list = target[id] || [];
				list.push(...(value ?? getValue()).split(','));
				target[id] = list;
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
		return { ...this.defaults, ...envResult, ...result };
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
	'user_pref("dom.disable_open_during_load", false);', // disable popup blocker
	'user_pref("dom.min_background_timeout_value", 10);', // behave like foreground
	'user_pref("browser.tabs.remote.autostart", false);', // disable multi-process
].join('\n');

const LAUNCHERS = new Map([
	['manual', launchManual],
	['chrome', launchChrome],
	['firefox', launchFirefox],
]);

function launchBrowser(name, url, opts = {}) {
	const launcher = LAUNCHERS.get(name);
	if (!launcher) {
		stderr.write(`Unknown browser: ${name}\n`);
		stderr.write(`Open this URL to run tests: ${url}\n`);
		return null;
	}
	return launcher(url, opts);
}

async function launchManual(url) {
	stderr.write(`Ready to run test: ${url}\n`);
	return null;
}

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

// https://w3c.github.io/webdriver/

async function beginWebdriverSession(host, browser, urlOptions, path, expectedTitle) {
	const { value: { sessionId } } = await withRetry(() => sendJSON('POST', `${host}/session`, {
		capabilities: {
			firstMatch: [{ browserName: browser }]
		},
	}), 20000);
	const sessionBase = `${host}/session/${encodeURIComponent(sessionId)}`;
	const close = () => withRetry(() => sendJSON('DELETE', sessionBase), 5000);

	let lastError = null;
	for (const url of urlOptions) {
		try {
			await navigateAndWaitForTitle(sessionBase, url + path, expectedTitle);
			return { close, debug: () => debug(sessionBase) };
		} catch (e) {
			lastError = e;
		}
	}
	await close();
	throw lastError;
}

const get = async (url) => (await sendJSON('GET', url)).value;

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

async function navigateAndWaitForTitle(sessionBase, url, expectedTitle) {
	await sendJSON('POST', `${sessionBase}/url`, { url });

	const begin = Date.now();
	do {
		const title = await get(`${sessionBase}/title`);
		if (title.startsWith(expectedTitle)) {
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, 100));
	} while (Date.now() < begin + 1000);

	throw new Error(`Unexpected page title at URL ${url}: '${title}'`);
}

async function debug(sessionBase) {
	return `URL='${await get(`${sessionBase}/url`)}' Title='${await get(`${sessionBase}/title`)}'`;
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

class EventListener {
	constructor() {
		this.listeners = new Map();
		this.eventQueue = [];

		this.handle = this.handle.bind(this);
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
			['css', 'text/css'],
			['htm', 'text/html'],
			['html', 'text/html'],
			['txt', 'text/plain'],
			['json', 'application/json'],
		]);
		this.ignore404 = ['/favicon.ico'];

		this.address = null;
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
					this.postListener(JSON.parse(Buffer.concat(all).toString('utf-8')));
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
		process.addListener('SIGINT', this.close);
	}

	async close() {
		if (!this.address) {
			return;
		}
		this.address = null;
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
	const postListener = new EventListener();
	const server = new Server(index, postListener.handle, [
		['/.lean-test/', resolve(selfPath, '..')],
		['/', basePath],
	]);
	await server.listen(Number(config.port), config.host);

	try {
		const multi = new MultiRunner();
		config.browser.forEach((browser, browserID) => multi.add(browser, (subListener) => {
			const webdriverEnv = browser.toUpperCase().replace(/[^A-Z]+/g, '_');
			const webdriver = process.env[`WEBDRIVER_HOST_${webdriverEnv}`] || process.env.WEBDRIVER_HOST;

			return run(server, browser, webdriver, '#' + browserID, () => new Promise((res, rej) => {
				let timeout = setTimeout(() => rej(new Error(`browser launch timed out (unhandled events: ${postListener.unhandled()})`)), 30000);
				postListener.addListener(browserID, (event) => {
					if (timeout) {
						clearTimeout(timeout);
						timeout = null;
					}
					if (event.type === 'browser-end') {
						res(event.result);
					} else if (event.type === 'browser-error') {
						rej(new Error(`Browser error: ${event.error}`));
					} else {
						subListener(event);
					}
				});
			}));
		}));
		return await multi.run(listener);
	} finally {
		server.close();
	}
}

async function run(server, browser, webdriver, arg, runner) {
	if (webdriver) {
		// try various URLs until something works, because we don't know what environment we're in
		const urls = new Set([
			server.baseurl(process.env.WEBDRIVER_TESTRUNNER_HOST),
			server.baseurl(),
			server.baseurl('host.docker.internal'), // See https://stackoverflow.com/a/43541732/1180785
			...Object.values(networkInterfaces())
				.flatMap((i) => i)
				.filter((i) => !i.internal)
				.map((i) => server.baseurl(i)),
		]);
		const session = await beginWebdriverSession(webdriver, browser, urls, arg, 'Lean Test Runner');
		return runWithSession(session, runner);
	} else {
		const launched = await launchBrowser(browser, server.baseurl() + arg, { stdio: ['ignore', 'pipe', 'pipe'] });
		return runWithProcess(launched, runner);
	}
}

async function runWithSession(session, runner) {
	const end = async () => {
		await session.close();
		// mimick default SIGINT/SIGTERM behaviour
		if (process.stderr.isTTY) {
			process.stderr.write('\u001B[0m');
		}
		process.exit(1);
	};
	try {
		// cannot use 'exit' because end is async
		process.addListener('SIGTERM', end);
		process.addListener('SIGINT', end);
		return await runner();
	} catch (e) {
		throw new Error(`Error running webdriver browser: ${e}\nWebdriver info: ${await session.debug()}`);
	} finally {
		process.removeListener('SIGTERM', end);
		process.removeListener('SIGINT', end);
		await session.close();
	}
}

async function runWithProcess(launched, runner) {
	if (!launched) {
		return runner();
	}

	const { proc, teardown } = launched;

	const stdout = [];
	const stderr = [];
	const end = () => proc.kill();
	try {
		process.addListener('exit', end);
		proc.stdout.addListener('data', (d) => stdout.push(d));
		proc.stderr.addListener('data', (d) => stderr.push(d));
		return await Promise.race([
			new Promise((_, reject) => proc.once('error', (err) => reject(err))),
			runner(),
		]);
	} catch (e) {
		throw new Error(
			`failed to launch browser: ${e.message}\n` +
			`stderr:\n${Buffer.concat(stderr).toString('utf-8')}\n` +
			`stdout:\n${Buffer.concat(stdout).toString('utf-8')}\n`);
	} finally {
		proc.kill();
		process.removeListener('exit', end);
		await teardown?.();
	}
}

const INDEX = `<!DOCTYPE html>
<html lang="en">
<head>
<title>Lean Test Runner - loading</title>
<script type="module">
import run from '/.lean-test/browser-runtime.mjs';
const id = window.location.hash.substr(1);
run(id, /*CONFIG*/, /*SUITES*/);
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
	parallelDiscovery: { names: ['parallel-discovery', 'P'], env: 'PARALLEL_DISCOVERY', type: 'boolean', default: false },
	parallelSuites: { names: ['parallel-suites', 'parallel', 'p'], env: 'PARALLEL_SUITES', type: 'boolean', default: false },
	pathsInclude: { names: ['include', 'i'], type: 'array', default: ['**/*.{spec|test}.{js|mjs|jsx}'] },
	pathsExclude: { names: ['exclude', 'x'], type: 'array', default: ['**/node_modules', '**/.*'] },
	browser: { names: ['browser', 'b'], env: 'BROWSER', type: 'array', default: [] },
	colour: { names: ['colour', 'color'], env: 'OUTPUT_COLOUR', type: 'boolean', default: null },
	port: { names: ['port'], env: 'TESTRUNNER_PORT', type: 'int', default: 0 },
	host: { names: ['host'], env: 'TESTRUNNER_HOST', type: 'string', default: '127.0.0.1' },
	rest: { names: ['scan', null], type: 'array', default: ['.'] }
});

try {
	const config = argparse.parse(process.env, process.argv);

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

	const runner = config.browser.length ? browserRunner : nodeRunner;
	const result = await runner(config, paths, liveReporter.eventListener);
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
	process.stderr.write(`${e.message}\n`);
	process.exit(1);
}
