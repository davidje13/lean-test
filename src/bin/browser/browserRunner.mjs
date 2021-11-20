import { spawn } from 'child_process';
import { dirname, resolve, relative } from 'path';
import process from 'process';
import Server from './Server.mjs';

export default async function browserRunner(config, paths, listener) {
	const index = await buildIndex(config, paths);
	const leanTestPath = resolve(dirname(process.argv[1]), '../../build/lean-test.mjs');
	const server = new Server(process.cwd(), index, leanTestPath);
	const resultPromise = new Promise((res) => {
		server.callback = ({ events }) => {
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
	const result = await run(launchBrowser(config.browser, url), () => resultPromise);
	server.close();

	return result;
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

function launchBrowser(name, url) {
	// TODO: this is mac-only and relies on standard installation location
	// could use https://github.com/GoogleChrome/chrome-launcher to be cross-platform, but pulls in a few dependencies
	switch (name) {
		case 'manual':
			process.stderr.write(`Ready to run test: ${url}\n`);
			return null;
		case 'chrome':
			return spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
				...CHROME_ARGS,
				'--headless',
				'--remote-debugging-port=0', // required to avoid immediate termination, but not actually used
				url,
			], { stdio: 'ignore' });
		case 'firefox':
			return spawn('/Applications/Firefox.app/Contents/MacOS/firefox', [
				'--no-remote',
				'--new-instance',
				'--headless',
				url,
			], { stdio: 'ignore', env: { MOZ_DISABLE_AUTO_SAFE_MODE: 'true' } });
		default:
			process.stderr.write(`Unknown browser: ${name}\n`);
			process.stderr.write(`Open this URL to run tests: ${url}\n`);
			return null;
	}
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
<script type="module">
import { standardRunner } from '/lean-test.mjs';

class Aggregator {
	constructor(next) {
		this.queue = [];
		this.timer = null;
		this.next = next;
		this.emptyCallback = null;
		this.invoke = this.invoke.bind(this);
		this._invoke = this._invoke.bind(this);
	}

	invoke(value) {
		this.queue.push(value);
		if (this.timer === null) {
			this.timer = setTimeout(this._invoke, 0);
		}
	}

	wait() {
		if (!this.timer) {
			return Promise.resolve();
		}
		return new Promise((resolve) => {
			this.emptyCallback = resolve;
		});
	}

	async _invoke() {
		const current = this.queue.slice();
		this.queue.length = 0;
		try {
			await this.next(current);
		} catch (e) {
			console.error('error during throttled call', e);
		}
		if (this.queue.length) {
			this.timer = setTimeout(this._invoke, 0);
		} else {
			this.timer = null;
			this.emptyCallback?.();
		}
	}
}

const eventDispatcher = new Aggregator((events) => fetch('/', {
	method: 'POST',
	body: JSON.stringify({ events }),
}));

const builder = standardRunner()
	.useParallelDiscovery(false)
	.useParallelSuites(/*USE_PARALLEL_SUITES*/);

/*SUITES*/

const runner = await builder.build();
const result = await runner.run(eventDispatcher.invoke);

document.body.innerText = 'Test run complete.';
eventDispatcher.invoke({ type: 'browser-end', result });
await eventDispatcher.wait();
window.close();
</script>
</head>
<body></body>
</html>`;

const INDEX_SUITE = `builder.addSuite(/*NAME*/, async (globals) => {
	Object.assign(window, globals);
	const result = await import(/*PATH*/);
	return result.default;
});`;

async function buildIndex(config, paths) {
	let suites = [];
	for await (const i of paths) {
		suites.push(
			INDEX_SUITE
				.replace('/*NAME*/', JSON.stringify(i.relative))
				.replace('/*PATH*/', JSON.stringify('/' + relative(process.cwd(), i.path)))
		);
	}
	return INDEX
		.replace('/*USE_PARALLEL_SUITES*/', JSON.stringify(config.parallelSuites))
		.replace('/*SUITES*/', suites.join('\n'));
}
