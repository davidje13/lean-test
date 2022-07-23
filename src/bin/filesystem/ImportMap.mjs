import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const MARKER = '.import-map-resolve';

export default class ImportMap {
	constructor(basePath) {
		this.basePath = basePath;
		this.importMap = null;
	}

	async buildImportMap() {
		if (this.importMap === null) {
			this.importMap = await buildNodeModulesImportMap(scanNodeModules(this.basePath, '/'));
		}
		return this.importMap;
	}

	async resolve(path) {
		const parts = path.split('/');
		const mark = parts.indexOf(MARKER);
		if (mark === -1) {
			return null;
		}
		const prefix = parts.slice(0, mark);
		const suffix = parts.slice(mark + 1);
		return resolveInPackage(join(this.basePath, ...prefix), suffix);
	}
}

async function loadPackage(base) {
	try {
		return JSON.parse(await readFile(join(base, 'package.json'), { encoding: 'utf-8' }));
	} catch (ignore) {
		return {};
	}
}

async function resolveInPackage(base, path) {
	let suffix = path;
	const pkg = await loadPackage(base);
	if (!path.length) { // TODO: non-default paths
		suffix = [pkg['module'] ?? pkg['main'] ?? 'index.js'];
	}
	return join(base, ...suffix);
}

async function* scanNodeModules(dir, scope) {
	const nodeModules = join(dir, 'node_modules');
	const entries = await readdir(nodeModules, { withFileTypes: true }).catch(() => null);
	if (!entries) {
		return;
	}
	for (const entry of entries) {
		if (entry.isDirectory() && !entry.name.startsWith('.')) {
			const name = entry.name;
			const sub = join(nodeModules, name);
			const subScope = `${scope}node_modules/${name}/`; // always use '/' for import map
			yield { name, scope, subScope };
			yield* scanNodeModules(sub, subScope);
		}
	}
}

//async function* scanAllParentNodeModules(dir, scope) {
//	const seen = new Set();
//	for (let abs = await realpath(dir); abs && !seen.has(abs); abs = dirname(abs)) {
//		seen.add(abs);
//		yield* scanNodeModules(abs, scope);
//	}
//}

async function buildNodeModulesImportMap(items) {
	const allScopes = {};
	for await (const { name, scope, subScope } of items) {
		const scoped = emplace(allScopes, scope, {});
		scoped[name] = subScope + MARKER;
		scoped[name + '/'] = subScope + MARKER + '/';
	}
	const { '/': imports, ...scopes } = allScopes;
	return { imports: imports ?? {}, scopes };
}

function emplace(o, key, v) {
	if (Object.prototype.hasOwnProperty.call(o, key)) {
		return o[key];
	}
	o[key] = v;
	return v;
}
