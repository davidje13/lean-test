import { env } from 'process';
import * as preprocessors from './preprocessors/index.mjs';

export { preprocessors };

const lazyPreprocessor = lazy(preprocessors[env.__LEAN_TEST_PREPROC]);

export async function resolve(specifier, context, defaultResolve, ...rest) {
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

export async function load(url, context, defaultLoad, ...rest) {
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
