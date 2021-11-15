import { spawn } from 'child_process';
import { dirname, resolve, relative } from 'path';
import process from 'process';
import Server from './Server.mjs';

export default async function browserRunner(config, paths, output) {
	const index = await buildIndex(config, paths);
	const leanTestPath = resolve(dirname(process.argv[1]), '../../build/lean-test.mjs');
	const server = new Server(process.cwd(), index, leanTestPath);
	const resultPromise = new Promise((res) => { server.callback = res; });
	await server.listen(0, '127.0.0.1');

	const url = server.baseurl();
	const result = await run(launchBrowser(config.browser, url, output), () => resultPromise);
	server.close();

	output.write(result.output);
	return result.summary;
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

function launchBrowser(name, url, output) {
	// TODO: this is mac-only and relies on standard installation location
	// could use https://github.com/GoogleChrome/chrome-launcher to be cross-platform, but pulls in a few dependencies
	switch (name) {
		case 'chrome':
			return spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
				...CHROME_ARGS,
				'--headless',
				'--remote-debugging-port=0', // required to avoid immediate termination, but not actually used
				url,
			], { stdio: 'ignore' });
		default:
			output.write(`Unknown browser: ${name}\n`);
			output.write(`Open this URL to run tests: ${url}\n`);
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
import { standardRunner, reporters } from '/lean-test.mjs';

const builder = standardRunner()
	.useParallelDiscovery(false)
	.useParallelSuites(/*USE_PARALLEL_SUITES*/);

/*SUITES*/

const runner = await builder.build();
const result = await runner.run();

const parts = [];
const out = new reporters.TextReporter({ write: (v) => parts.push(v) });
out.report(result);
const output = parts.join('');
const summary = result.getSummary();
await fetch('/', { method: 'POST', body: JSON.stringify({ output, summary }) });
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
