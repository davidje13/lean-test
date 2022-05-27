import { access } from 'fs/promises';
import { constants } from 'fs';
import { dirname, resolve } from 'path';
import { cwd } from 'process';
import { promisify } from 'util';
import { dynamicImport } from './utils.mjs';

export default async () => {
	const { default: webpack } = await dynamicImport('webpack', 'webpack preprocessor');
	const config = await loadWebpackConfig(cwd());

	return {
		resolve(path, from) {
			return resolve(dirname(from), path);
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
}

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
		const file = resolve(dir, option);
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
