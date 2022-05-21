import { dirname, resolve } from 'path';
import { cwd } from 'process';
import { dynamicImport } from './utils.mjs';

export default async () => {
	const { rollup } = await dynamicImport('rollup', 'rollup preprocessor');
	const { default: loadConfigFile } = await dynamicImport('rollup/loadConfigFile', 'rollup preprocessor');

	const { options } = await loadConfigFile(resolve(cwd(), 'rollup.config.js'), { format: 'es', silent: true }).catch((e) => {
		throw new Error(`Failed to read rollup.config.js: ${e}`);
	});
	const config = options[0] ?? {};
	const outputConfig = (Array.isArray(config.output) ? config.output[0] : config.output) ?? {};

	return {
		resolve(path, from) {
			return resolve(dirname(from), path);
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
}
