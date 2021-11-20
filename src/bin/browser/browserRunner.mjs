import { dirname, resolve, relative } from 'path';
import process from 'process';
import launchBrowser from './launchBrowser.mjs';
import Server from './Server.mjs';

export default async function browserRunner(config, paths, listener) {
	const basePath = process.cwd();
	const index = await buildIndex(config, paths, basePath);
	const leanTestBaseDir = resolve(dirname(process.argv[1]), '..');
	const server = new Server(index, [['/.lean-test/', leanTestBaseDir], ['/', basePath]]);
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
