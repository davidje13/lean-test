import { cwd, env } from 'process';
import { access, readFile } from 'fs/promises';
import { dirname } from 'path';

var tsc = async () => {
	const { default: ts } = await loadTypescript();
	const baseDir = cwd();

	const compilerOptions = readCompilerOptions(ts, baseDir);
	const host = ts.createCompilerHost(compilerOptions);
	const cache = ts.createModuleResolutionCache(baseDir, host.getCanonicalFileName, compilerOptions);

	const resolver = (path, from) => ts.resolveModuleName(path, from, compilerOptions, host, cache).resolvedModule?.resolvedFileName;

	return {
		name: 'tsc',
		async resolve(path, from = baseDir) {
			try {
				await access(path);
				return path;
			} catch (e) {
				return resolver(path, from);
			}
		},
		async load(fullPath) {
			const subCompilerOptions = readCompilerOptions(ts, dirname(fullPath));
			const source = await readFile(fullPath, 'utf-8');
			const result = ts.transpileModule(source, {
				fileName: fullPath,
				compilerOptions: {
					...subCompilerOptions,
					noEmit: false,
					sourceMap: false,
					module: 'es2015',
				},
			});
			if (result.diagnostics?.length) {
				throw new Error(JSON.stringify(result.diagnostics));
			}
			return { path: fullPath.replace(/(.*)\.ts/i, '\\1.js'), content: result.outputText };
		},
	};
};

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
	// return ts.getParsedCommandLineOfConfigFile(configPath, undefined, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => null })?.options ?? {};
	const config = ts.readConfigFile(configPath, ts.sys.readFile);
	return ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath))?.options ?? {};
}

var preprocessors = /*#__PURE__*/Object.freeze({
	__proto__: null,
	tsc: tsc
});

const lazyPreprocessor = lazy(preprocessors[env.__LEAN_TEST_PREPROC]);

async function resolve(specifier, context, defaultResolve, ...rest) {
	if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
		return defaultResolve(specifier, context, defaultResolve, ...rest);
	}
	const preprocessor = await lazyPreprocessor();
	const fullPath = await preprocessor?.resolve(specifier, new URL(context.parentURL).pathname);
	if (!fullPath) {
		return defaultResolve(specifier, context, defaultResolve, ...rest);
	}
	if (fullPath.includes('/node_modules/')) {
		return { url: 'file://' + fullPath };
	}
	return { format: 'unprocessed', url: 'file://' + fullPath };
}

async function load(url, context, defaultLoad, ...rest) {
	if (context.format === 'unprocessed') {
		const preprocessor = await lazyPreprocessor();
		const parsed = await preprocessor.load(new URL(url).pathname);
		return { format: 'module', source: parsed.content };
	}
	return defaultLoad(url, context, defaultLoad, ...rest);
}

function lazy(factory) {
	let value = null;
	const callbacks = [];

	return async () => {
		if (!factory || value) {
			return value;
		}
		const p = new Promise((resolve) => callbacks.push(resolve));
		if (callbacks.length > 1) {
			return p;
		}
		value = await factory();
		callbacks.forEach((c) => c(value));
		callbacks.length = 0;
		return value;
	};
}

export { load, preprocessors, resolve };
