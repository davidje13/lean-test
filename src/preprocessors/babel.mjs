import { dirname, resolve } from 'path';
import { dynamicImport } from './utils.mjs';

export default async () => {
	const { default: babel } = await dynamicImport('@babel/core', 'babel preprocessor');

	return {
		resolve(path, from) {
			return resolve(dirname(from), path);
		},

		async load(fullPath) {
			const { code } = await babel.transformFileAsync(fullPath, {
				sourceMaps: 'inline',
			});
			return {
				path: fullPath.replace(/(.*)\.[cm]?jsx?/i, '\\1.js'),
				content: code,
			};
		},
	};
}
