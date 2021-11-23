#!/usr/bin/env node
import process, { platform, getuid, stderr, env } from 'process';
import { join, resolve, dirname, relative } from 'path';
import { standardRunner, outputs, reporters } from '../lean-test.mjs';
import { readdir, access, mkdtemp, rm, writeFile, readFile, realpath } from 'fs/promises';
import { constants } from 'fs';
import { spawn } from 'child_process';
import { tmpdir } from 'os';
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

async function beginWebdriverSession(host, browser, url) {
	const { value: { sessionId } } = await sendJSON('POST', `${host}/session`, {
		capabilities: {
			firstMatch: [{ browserName: browser }]
		},
	});
	const sessionBase = `${host}/session/${encodeURIComponent(sessionId)}`;
	const close = () => sendJSON('DELETE', sessionBase);
	try {
		await loadSessionURL(sessionBase, url);
		return close;
	} catch (e) {
		await close();
		throw e;
	}
}

async function loadSessionURL(sessionBase, url) {
	try {
		await sendJSON('POST', `${sessionBase}/url`, { url });
	} catch (e) {
		if (!url.includes('127.0.0.1')) {
			throw e;
		}
		// fall-back: try using special docker host URL, since target might be in docker container
		// See https://stackoverflow.com/a/43541732/1180785
		try {
			await sendJSON('POST', `${sessionBase}/url`, {
				url: url.replace('127.0.0.1', 'host.docker.internal'),
			});
		} catch (ignore) {
			throw e;
		}
	}
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
			['json', 'application/json'],
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
	const runner = () => {
		beginTimeout(30000);
		return resultPromise;
	};

	await server.listen(Number(config.port), config.host);
	try {
		const url = server.baseurl();
		const webdriverEnv = config.browser.toUpperCase().replace(/[^A-Z]+/g, '_');
		const webdriver = process.env[`WEBDRIVER_HOST_${webdriverEnv}`] || process.env.WEBDRIVER_HOST;
		if (webdriver) {
			const close = await beginWebdriverSession(webdriver, config.browser, url);
			return await runWithSession(close, runner);
		} else {
			const launched = await launchBrowser(config.browser, url, { stdio: ['ignore', 'pipe', 'pipe'] });
			return await runWithProcess(launched, runner);
		}
	} finally {
		server.close();
	}
}

async function runWithSession(close, runner) {
	const end = async () => {
		await close();
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
	} finally {
		process.removeListener('SIGTERM', end);
		process.removeListener('SIGINT', end);
		await close();
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

try {
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
} catch (e) {
	if (!(e instanceof Error)) {
		throw e;
	}
	process.stderr.write(`${e.message}\n`);
	process.exit(1);
}
