import { dirname, resolve, relative } from 'path';
import { realpath } from 'fs/promises';
import process from 'process';
import launchBrowser from './launchBrowser.mjs';
import Server from './Server.mjs';

export default async function browserRunner(config, paths, listener) {
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
	try {
		const url = server.baseurl();
		const launched = await launchBrowser(config.browser, url, { stdio: ['ignore', 'pipe', 'pipe'] });
		return await run(launched, () => {
			beginTimeout(30000);
			return resultPromise;
		});
	} finally {
		server.close();
	}
}

async function run(launched, fn) {
	if (!launched) {
		return fn();
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
			fn(),
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
