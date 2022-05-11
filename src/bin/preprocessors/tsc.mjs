import { access, readFile } from 'fs/promises';
import { dirname } from 'path';
import { cwd } from 'process';

// TODO: support nodejs runtime (see https://nodejs.org/api/esm.html#loaders)

export default async () => {
	const { default: ts } = await loadTypescript();
	const baseDir = cwd();

	const rawCompilerOptions = readCompilerOptions(ts, baseDir);
	const compilerOptions = { ...rawCompilerOptions, noEmit: false, sourceMap: false, module: 'es2015' };
	const host = ts.createCompilerHost(compilerOptions);
	const cache = ts.createModuleResolutionCache(baseDir, host.getCanonicalFileName, compilerOptions);

	const resolver = (path) => ts.resolveModuleName(path, baseDir, compilerOptions, host, cache).resolvedModule?.resolvedFileName;

	return {
		async load(path) {
			const fullPath = await resolveFilename(path, resolver);
			if (!path) {
				return null;
			}
			const source = await readFile(fullPath, 'utf8');
			const result = ts.transpileModule(source, { fileName: fullPath, compilerOptions });
			if (result.diagnostics?.length) {
				throw new Error(JSON.stringify(result.diagnostics));
			}
			return { path: fullPath.replace(/(.*)\.ts/i, '\\1.js'), content: Buffer.from(result.outputText, 'utf8') };
		},
	};
}

function loadTypescript() {
	try {
		return import('typescript');
	} catch (e) {
		throw new Error('Must install typescript to use tsc preprocessor (npm install --save-dev typescript)');
	}
}

function readCompilerOptions(ts, path) {
	const configPath = ts.findConfigFile(path, ts.sys.fileExists, 'tsconfig.json');
	if (!configPath) {
		return {};
	}
	const config = ts.readConfigFile(configPath, ts.sys.readFile);
	const options = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath))?.options ?? {};

	// explicit values for defaults which may change when we change the module mode:
	if (!options.moduleResolution) {
		if ((options.module ?? 'commonjs').toLowerCase() === 'commonjs') {
			options.moduleResolution = 'node';
		} else {
			options.moduleResolution = 'classic';
		}
	}

	return options;
}

async function resolveFilename(path, resolver) {
	try {
		await access(path);
		return path;
	} catch (e) {
		return resolver(path);
	}
}
