import { env, versions } from 'process';
import * as preprocessors from './preprocessors/index.mjs';
import path from 'path';

export { preprocessors };

const NODE_MAJOR = Number(versions.node.split('.')[0]);
const preprocessor = await preprocessors[env.__LEAN_TEST_PREPROC]?.();
const HASH_MARKER = `#!preprocessed`;

// https://nodejs.org/api/esm.html#loaders

export async function resolve(specifier, context, defaultResolve, ...rest) {
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
	const fullPath = await preprocessor?.resolve(specifier, from);
	if (!fullPath) {
		return defaultResolve(specifier, context, defaultResolve, ...rest);
	}
	if (fullPath.split(path.sep).includes('node_modules')) {
		return { url: 'file://' + fullPath };
	}
	return { url: 'file://' + fullPath + HASH_MARKER };
}

export async function load(url, context, defaultLoad, ...rest) {
	const parsedURL = new URL(url);
	if (parsedURL.hash === HASH_MARKER) {
		const parsed = await preprocessor.load(parsedURL.pathname);
		return { format: 'module', source: parsed.content };
	}
	return defaultLoad(url, context, defaultLoad, ...rest);
}

// legacy API (Node < 16)

export const getFormat = NODE_MAJOR < 16 && function(url, context, defaultGetFormat, ...rest) {
	const parsedURL = new URL(url);
	if (parsedURL.hash === HASH_MARKER) {
		return { format: 'module' };
	}
	return defaultGetFormat(url, context, defaultGetFormat, ...rest);
};

export const getSource = NODE_MAJOR < 16 && async function(url, context, defaultGetSource, ...rest) {
	const parsedURL = new URL(url);
	if (parsedURL.hash === HASH_MARKER) {
		const parsed = await preprocessor.load(parsedURL.pathname);
		return { source: parsed.content };
	}
	return defaultGetSource(url, context, defaultGetSource, ...rest);
};
