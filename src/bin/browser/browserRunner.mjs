import { dirname, resolve, relative } from 'path';
import { realpath } from 'fs/promises';
import process from 'process';
import { networkInterfaces } from 'os';
import { MultiRunner } from '../../lean-test.mjs';
import { alwaysFinally } from '../shutdown.mjs';
import { addDataListener } from '../utils.mjs';
import launchBrowser from './launchBrowser.mjs';
import WebdriverSession from './WebdriverSession.mjs';
import EventListener from './EventListener.mjs';
import ActiveTestTracker from './ActiveTestTracker.mjs';
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
		config.browser.forEach((browser) => multi.add(
			browser,
			(subListener) => addBrowser(server, browser, postListener, subListener),
		));
		return await multi.run(listener);
	} finally {
		server.close();
	}
}

async function addBrowser(server, browser, postListener, listener) {
	const tracker = new ActiveTestTracker();

	const webdriver = getConfiguredWebdriverHost(browser);
	const runner = webdriver ? new WebDriverRunner(webdriver) : new ProcessRunner();
	try {
		return await runner.run(server, browser, postListener, (browserID) => new Promise((res, reject) => {
			let connectedUntil = Date.now() + INITIAL_CONNECT_TIMEOUT;
			let connected = false;
			const checkPing = setInterval(() => {
				if (Date.now() > connectedUntil) {
					clearInterval(checkPing);
					if (!connected) {
						reject(new Error('browser launch timed out'));
					} else {
						reject(new DisconnectError('unknown disconnect (did a test change window.location?)'));
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
					default:
						tracker.eventListener(event);
						listener(event);
				}
			});
		}));
	} catch (e) {
		if (e instanceof DisconnectError) {
			throw new Error(`Browser disconnected: ${e.message}\nActive tests:\n${tracker.get().map((p) => '- ' + p.join(' -> ')).join('\n') || 'none'}\n`);
		}
		throw new Error(`Error running browser: ${e}\n${await runner.debug()}\nUnhandled events: ${postListener.unhandled()}\n`);
	}
}

class WebDriverRunner {
	constructor(webdriverHost) {
		this.webdriverHost = webdriverHost;
		this.session = null;
		this.finalURL = null;
		this.finalTitle = null;
	}

	async run(server, browser, postListener, runner) {
		this.session = await WebdriverSession.create(this.webdriverHost, browser);
		return alwaysFinally(async () => {
			const browserID = await this.makeConnection(server, postListener);
			return runner(browserID);
		}, async () => {
			this.finalURL = await this.session.getUrl();
			this.finalTitle = await this.session.getTitle();
			await this.session.close();
		});
	}

	async makeConnection(server, postListener) {
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
				await this.session.setUrl(url + '#' + browserID);
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

	async debug() {
		if (this.finalURL === null) {
			return 'failed to create session';
		}
		return `URL='${this.finalURL}' Title='${this.finalTitle}'`;
	}
}

class ProcessRunner {
	constructor() {
		this.stdout = () => '';
		this.stderr = () => '';
	}

	async run(server, browser, postListener, runner) {
		const browserID = postListener.getUniqueID();
		const launched = await launchBrowser(browser, server.baseurl() + '#' + browserID, { stdio: ['ignore', 'pipe', 'pipe'] });
		if (!launched) {
			return runner(browserID);
		}

		this.stdout = addDataListener(launched.proc.stdout);
		this.stderr = addDataListener(launched.proc.stderr);
		return alwaysFinally(() => {
			return Promise.race([
				new Promise((_, reject) => launched.proc.once('error', (err) => reject(err))),
				runner(browserID),
			]);
		}, () => {
			launched.proc.kill();
			return launched.teardown?.();
		});
	}

	debug() {
		return `stderr:\n${this.stdout().toString('utf-8')}\nstdout:\n${this.stderr().toString('utf-8')}`;
	}
}

function getConfiguredWebdriverHost(browser) {
	const webdriverEnv = browser.toUpperCase().replace(/[^A-Z]+/g, '_');
	return process.env[`WEBDRIVER_HOST_${webdriverEnv}`] || process.env.WEBDRIVER_HOST || null;
}

class DisconnectError extends Error {
	constructor(message) {
		super(message);
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
