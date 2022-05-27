import { cwd, versions, env } from 'process';
import path, { resolve as resolve$1, dirname } from 'path';
import { access, stat, readFile } from 'fs/promises';
import { constants } from 'fs';
import { promisify } from 'util';

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

var rollup = async () => {
	const { rollup } = await dynamicImport('rollup', 'rollup preprocessor');
	const { default: loadConfigFile } = await dynamicImport('rollup/loadConfigFile', 'rollup preprocessor');

	const { options } = await loadConfigFile(resolve$1(cwd(), 'rollup.config.js'), { format: 'es', silent: true }).catch((e) => {
		throw new Error(`Failed to read rollup.config.js: ${e}`);
	});
	const config = options[0] ?? {};
	const outputConfig = (Array.isArray(config.output) ? config.output[0] : config.output) ?? {};

	return {
		resolve(path, from) {
			return resolve$1(dirname(from), path);
		},

		async load(fullPath) {
			const bundle = await rollup({
				...config,
				input: fullPath,
				cache: undefined,
			});
			try {
				const { output } = await bundle.generate({
					...outputConfig,
					format: 'es',
					file: undefined,
					dir: undefined,
					sourcemap: false,
				});
				if (!output.length) {
					throw new Error('No output from rollup');
				}
				if (output.length > 1) {
					throw new Error('Too much output from rollup: ' + output.map((o) => o.fileName).join(', '));
				}
				const result = output[0];
				return {
					path: result.fileName,
					content: result.code ?? result.source,
				};
			} finally {
				await bundle.close();
			}
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
				await access(fullPath, constants.R_OK);
				const stats = await stat(fullPath);
				if (stats.isFile()) {
					return fullPath;
				}
			} catch (_) {
			}
			return resolver(path, from);
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

var webpack = async () => {
	const { default: webpack } = await dynamicImport('webpack', 'webpack preprocessor');
	const config = await loadWebpackConfig(cwd());

	return {
		resolve(path, from) {
			return resolve$1(dirname(from), path);
		},

		async load(fullPath) {
			const output = new MemoryFileSystem();
			const compiler = webpack({
				...config,
				mode: 'development',
				entry: fullPath,
				devtool: false,
				output: {
					...(config.output ?? {}),
					path: undefined,
					filename: undefined,
					library: {
						...(config.output?.library ?? {}),
						type: 'module',
					},
				},
				experiments: {
					...(config.experiments ?? {}),
					outputModule: true,
				},
			});
			compiler.outputFileSystem = output;
			await promisify(compiler.run.bind(compiler))();
			if (!output.allFiles.size) {
				throw new Error('No output from webpack');
			}
			if (output.allFiles.size > 1) {
				throw new Error('Too much output from webpack: ' + [...output.allFiles.entries()].map(([name]) => name).join(', '));
			}
			const [path, content] = output.allFiles.entries().next().value;
			return { path, content };
		},
	};
};

const WEBPACK_CONFIG_FILES = [
	'.webpack/webpackfile',
	'.webpack/webpack.config.js',
	'.webpack/webpack.config.mjs',
	'.webpack/webpack.config.cjs',
	'.webpack/webpack.config',
	'webpack.config.js',
	'webpack.config.mjs',
	'webpack.config.cjs',
	'webpack.config',
];

async function loadWebpackConfig(dir) {
	// mimic behaviour of webpack CLI config loader, which is not exported for us to use
	// e.g. https://github.com/webpack/webpack-cli/blob/7adaa63526b84b9f82cf12728aed173707f7b116/packages/webpack-cli/src/webpack-cli.ts#L310
	for (const option of WEBPACK_CONFIG_FILES) {
		const file = resolve$1(dir, option);
		try {
			await access(file, constants.R_OK);
		} catch (_) {
			continue;
		}
		let c = await import(file);
		if (c && typeof c === 'object' && 'default' in c) {
			c = c.default;
		}
		if (typeof c === 'function') {
			return c({ WEBPACK_BUILD: true });
		}
		if (Array.isArray(c)) {
			return c[0] ?? {};
		}
		return c ?? {};
	}
	return {};
}

function asString(o) {
	if (typeof o === 'string') {
		return o;
	}
	if (!o) {
		return '';
	}
	return o.toString('utf8');
}

class MemoryFileSystem {
	constructor() {
		this.allFiles = new Map();
	}

	// https://github.com/webpack/webpack/blob/e550b2c9498364e520a66f823d9f5b366fd15774/test/Compiler.test.js#L32
	mkdir(_, options, callback) {
		if (typeof options === 'function') {
			callback = options;
			options = {};
		}
		callback(Object.assign(new Error(), { code: 'EEXIST' }));
	}

	writeFile(file, data, options, callback) {
		if (typeof options === 'function') {
			callback = options;
			options = {};
		}
		const key = asString(file);
		const exists = this.allFiles.has(key);
		if (options.flag?.includes('x') && exists) {
			callback(Object.assign(new Error(), { code: 'EEXIST' }));
			return;
		}
		if (options.flag?.includes('a') && exists) {
			this.allFiles.set(key, this.allFiles.get(key) + asString(data));
		} else {
			this.allFiles.set(key, asString(data));
		}
		callback(null);
	}

	stat(_, callback) {
		callback(Object.assign(new Error(), { code: 'ENOENT' }));
	}
}

var preprocessors = /*#__PURE__*/Object.freeze({
	__proto__: null,
	babel: babel,
	rollup: rollup,
	tsc: tsc,
	webpack: webpack
});

const NODE_MAJOR = Number(versions.node.split('.')[0]);
const lazyPreprocessor = lazy(preprocessors[env.__LEAN_TEST_PREPROC]);

// https://nodejs.org/api/esm.html#loaders

async function resolve(specifier, context, defaultResolve, ...rest) {
	if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
		return defaultResolve(specifier, context, defaultResolve, ...rest);
	}
	const from = new URL(context.parentURL).pathname;
	const fromParts = from.split(path.sep);
	if (
		(fromParts.includes('node_modules') && fromParts.includes('preprocessor.mjs')) ||
		path.resolve(from, specifier).split(path.sep).includes('node_modules')
	) {
		// naïve node_modules check to avoid deadlocks when loading preprocessor files
		return defaultResolve(specifier, context, defaultResolve, ...rest);
	}
	const preprocessor = await lazyPreprocessor();
	const fullPath = await preprocessor?.resolve(specifier, from);
	if (!fullPath) {
		return defaultResolve(specifier, context, defaultResolve, ...rest);
	}
	if (fullPath.split(path.sep).includes('node_modules')) {
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
