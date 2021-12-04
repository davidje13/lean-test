import { dirname, resolve, relative } from 'path';
import { realpath } from 'fs/promises';
import process from 'process';
import { networkInterfaces } from 'os';
import { MultiRunner } from '../../lean-test.mjs';
import launchBrowser from './launchBrowser.mjs';
import { beginWebdriverSession } from './webdriver.mjs';
import EventListener from './EventListener.mjs';
import Server from './Server.mjs';

const INITIAL_CONNECT_TIMEOUT = 30000;
const PING_TIMEOUT = 2000;

export default async function browserRunner(config, paths, listener) {
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
			const tracker = new ActiveTestTracker();
			const activeTests = () => {
				const tests = tracker.get();
				if (tests.length) {
					return 'Active tests:\n' + tests.map((p) => '- ' + p.join(' -> ')).join('\n');
				} else {
					return 'No active tests.';
				}
			};

			return run(server, browser, webdriver, '#' + browserID, () => new Promise((res, rej) => {
				let connectedUntil = Date.now() + INITIAL_CONNECT_TIMEOUT;
				let connected = false;
				const checkPing = setInterval(() => {
					if (Date.now() > connectedUntil) {
						clearInterval(checkPing);
						if (!connected) {
							rej(new LaunchError(`browser launch timed out (unhandled events: ${postListener.unhandled()})`));
						} else {
							rej(new Error(`browser disconnected (did a test change window.location?)\n${activeTests()}`));
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
								rej(new Error(`Multiple browser connections (maybe page reloaded?)\n${activeTests()}`));
							}
							connected = true;
							break;
						case 'browser-end':
							clearInterval(checkPing);
							res(event.result);
							break;
						case 'browser-error':
							clearInterval(checkPing);
							rej(new Error(`Browser error: ${event.error}\n${activeTests()}`));
							break;
						default:
							tracker.eventListener(event);
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

class LaunchError extends Error {
	constructor(message) {
		super(message);
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
		if (e instanceof LaunchError) {
			throw new Error(
				`failed to launch browser: ${e.message}\n` +
				`stderr:\n${Buffer.concat(stderr).toString('utf-8')}\n` +
				`stdout:\n${Buffer.concat(stdout).toString('utf-8')}\n`);
		} else {
			throw e;
		}
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
