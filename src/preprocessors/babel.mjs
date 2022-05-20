import { dirname, resolve } from 'path';
import { cwd } from 'process';

export default async () => {
	const { default: babel } = await loadBabel();
	const baseDir = cwd();

	return {
		resolve(path, from = baseDir) {
			return resolve(dirname(from), path);
		},
		async load(fullPath) {
			const { code } = await babel.transformFileAsync(fullPath);
			return { path: fullPath.replace(/(.*)\.[cm]?jsx?/i, '\\1.js'), content: code };
		},
	};
}

function loadBabel() {
	try {
		return import('@babel/core');
	} catch (e) {
		throw new Error('Must install @babel/core to use babel preprocessor (npm install --save-dev @babel/core)');
	}
}
