import { dirname, resolve, relative } from 'path';
import { realpath } from 'fs/promises';
import process from 'process';
import EventListener from './EventListener.mjs';
import Server from './Server.mjs';
import { ExternalRunner } from '../../lean-test.mjs';
import ImportMap from '../filesystem/ImportMap.mjs';

const handleMappedImport = (importMap) => async (server, url, res) => {
	const path = await importMap.resolve(url.substr(1)).catch((e) => {
		throw new Server.HttpError(404, `Import Map Error ${e.message}`);
	});
	if (path === null) {
		return false;
	}
	await server.sendFile(path, res);
	return true;
};

export default class HttpServerRunner extends ExternalRunner {
	constructor({
		port,
		host,
		preprocessor,
		parallelDiscovery,
		parallelSuites,
		orderingRandomSeed,
		importMap,
	}, paths) {
		super({
			initialConnectTimeout: 30_000,
			pingTimeout: 2_000,
		});
		this.port = port;
		this.host = host;
		this.preprocessor = preprocessor;
		this.browserConfig = { parallelDiscovery, parallelSuites, orderingRandomSeed, importMap };
		this.paths = paths;
		this.browserID = null;
	}

	async prepare(sharedState) {
		if (sharedState[HttpServerRunner.POST_LISTENER]) {
			return;
		}
		sharedState[HttpServerRunner.POST_LISTENER] = new EventListener();

		// must use realpath because npm will install the binary as a symlink in a different folder (.bin)
		const selfPath = dirname(await realpath(process.argv[1]));
		const basePath = process.cwd();

		const importMap = this.browserConfig.importMap ? new ImportMap(basePath) : null;
		const index = await buildIndex(this.browserConfig, this.paths, basePath, importMap);
		const server = new Server(index, sharedState[HttpServerRunner.POST_LISTENER].handle, [
			Server.directory('/.lean-test/', resolve(selfPath, '..')),
			importMap && handleMappedImport(importMap),
			Server.directory('/', basePath, this.preprocessor),
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

	setBrowserID(id) {
		this.browserID = id;
	}

	async invoke(listener, sharedState) {
		if (this.browserID === null) {
			const { browserID, url } = this.makeUniqueTarget(sharedState);
			this.setBrowserID(browserID);
			process.stderr.write(`Ready to run test: ${url}\n`);
		}
		return super.invoke(listener, sharedState);
	}

	makeUniqueTarget(sharedState, overrideAddr = null) {
		const server = sharedState[HttpServerRunner.SERVER];
		const postListener = sharedState[HttpServerRunner.POST_LISTENER];

		const browserID = postListener.getUniqueID();
		return { browserID, url: server.baseurl(overrideAddr) + '#' + browserID };
	}

	registerEventListener(listener, sharedState) {
		const postListener = sharedState[HttpServerRunner.POST_LISTENER];
		postListener.addListener(this.browserID, listener);
	}
}

HttpServerRunner.SERVER = Symbol('SERVER');
HttpServerRunner.POST_LISTENER = Symbol('PORT_LISTENER');

const INDEX = `<!DOCTYPE html>
<html lang="en">
<head>
<title>Lean Test Runner - loading</title>
/*IMPORT_MAP*/
<script type="module">
import run from '/.lean-test/browser-runtime.mjs';
const id = window.location.hash.substr(1);
window.location.hash = '';
run(id, /*CONFIG*/, /*SUITES*/).then(() => window.close());
</script>
</head>
<body></body>
</html>`;

async function buildIndex(config, paths, basePath, importMap) {
	const suites = [];
	for await (const path of paths) {
		suites.push({ path: '/' + relative(basePath, path.path), relative: path.relative });
	}
	const importMapScript = importMap ? (
		'<script type="importmap">' +
		JSON.stringify(await importMap.buildImportMap()) +
		'</script>'
	) : '';
	return INDEX
		.replace('/*IMPORT_MAP*/', importMapScript)
		.replace('/*CONFIG*/', JSON.stringify(config))
		.replace('/*SUITES*/', JSON.stringify(suites));
}
