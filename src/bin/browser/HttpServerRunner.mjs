import { dirname, resolve, relative } from 'path';
import { realpath } from 'fs/promises';
import process from 'process';
import EventListener from './EventListener.mjs';
import Server from './Server.mjs';
import ActiveTestTracker from './ActiveTestTracker.mjs';
import { AbstractRunner } from '../../lean-test.mjs';

const INITIAL_CONNECT_TIMEOUT = 30000;
const PING_TIMEOUT = 2000;

export default class HttpServerRunner extends AbstractRunner {
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
