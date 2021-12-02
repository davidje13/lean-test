import { dirname, resolve, relative } from 'path';
import { realpath } from 'fs/promises';
import process from 'process';
import { networkInterfaces } from 'os';
import { MultiRunner } from '../../lean-test.mjs';
import launchBrowser from './launchBrowser.mjs';
import { beginWebdriverSession } from './webdriver.mjs';
import EventListener from './EventListener.mjs';
import Server from './Server.mjs';

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

			return run(server, browser, webdriver, '#' + browserID, () => new Promise((res, rej) => {
				let timeout = setTimeout(() => rej(new Error('browser launch timed out')), 30000);
				postListener.addListener(browserID, (event) => {
					if (timeout) {
						clearTimeout(timeout);
						timeout = null;
					}
					if (event.type === 'browser-end') {
						res(event.result);
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
		const close = await beginWebdriverSession(webdriver, browser, urls, arg);
		return runWithSession(close, runner);
	} else {
		const launched = await launchBrowser(browser, server.baseurl() + arg, { stdio: ['ignore', 'pipe', 'pipe'] });
		return runWithProcess(launched, runner);
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
const id = window.location.hash.substr(1);
await run(id, /*CONFIG*/, /*SUITES*/);
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
