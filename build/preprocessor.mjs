import { cwd, versions, env } from 'process';
import { resolve as resolve$1, dirname } from 'path';
import { access, readFile } from 'fs/promises';

const dynamicImport = (dependency, name) => import(dependency).catch(() => {
	throw new Error(`Must install ${dependency} to use ${name} (npm install --save-dev ${dependency})`);
});

var babel = async () => {
	const { default: babel } = await dynamicImport('@babel/core', 'babel preprocessor');

	return {
		resolve(path, from) {
			return resolve$1(dirname(from), path);
		},

		async load(fullPath) {
			const { code } = await babel.transformFileAsync(fullPath);
			return {
				path: fullPath.replace(/(.*)\.[cm]?jsx?/i, '\\1.js'),
				content: code,
			};
		},
	};
};

var tsc = async () => {
	const { default: ts } = await dynamicImport('typescript', 'tsc preprocessor');
	const baseDir = cwd();

	const compilerOptions = readCompilerOptions(ts, baseDir);
	const host = ts.createCompilerHost(compilerOptions);
	const cache = ts.createModuleResolutionCache(baseDir, host.getCanonicalFileName, compilerOptions);

	const resolver = (path, from) => ts.resolveModuleName(path, from, compilerOptions, host, cache).resolvedModule?.resolvedFileName;

	return {
		async resolve(path, from) {
			const fullPath = resolve$1(dirname(from), path);
			try {
				await access(fullPath);
				return fullPath;
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
			return {
				path: fullPath.replace(/(.*)\.[cm]?[tj]sx?/i, '\\1.js'),
				content: result.outputText,
			};
		},
	};
};

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
	babel: babel,
	tsc: tsc
});

const NODE_MAJOR = Number(versions.node.split('.')[0]);
const lazyPreprocessor = lazy(preprocessors[env.__LEAN_TEST_PREPROC]);

// https://nodejs.org/api/esm.html#loaders

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
	if (NODE_MAJOR < 16) {
		// legacy API
		return { url: 'file-unprocessed://' + fullPath };
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

// legacy API (Node < 16)

const getFormat = NODE_MAJOR < 16 && function(url, context, defaultGetFormat, ...rest) {
	const parsedURL = new URL(url);
	if (parsedURL.protocol === 'file-unprocessed:') {
		return { format: 'module' };
	}
	return defaultGetFormat(url, context, defaultGetFormat, ...rest);
};

const getSource = NODE_MAJOR < 16 && async function(url, context, defaultGetSource, ...rest) {
	const parsedURL = new URL(url);
	if (parsedURL.protocol === 'file-unprocessed:') {
		const preprocessor = await lazyPreprocessor();
		const parsed = await preprocessor.load(parsedURL.pathname);
		return { source: parsed.content };
	}
	return defaultGetSource(url, context, defaultGetSource, ...rest);
};

export { getFormat, getSource, load, preprocessors, resolve };
