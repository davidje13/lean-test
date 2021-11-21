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
	const proc = await launchBrowser(config.browser, url);
	const result = await run(proc, () => resultPromise);
	server.close();

	return result;
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
