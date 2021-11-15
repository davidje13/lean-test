#!/usr/bin/env node

import { cwd, argv, stdout, exit } from 'process';
import { resolve } from 'path';
import findPathsMatching from './filesystem/findPathsMatching.mjs';
import ArgumentParser from './ArgumentParser.mjs';
import browserRunner from './browser/browserRunner.mjs';
import nodeRunner from './node/nodeRunner.mjs';

const argparse = new ArgumentParser({
	parallelDiscovery: { names: ['parallel-discovery', 'P'], type: 'boolean', default: false },
	parallelSuites: { names: ['parallel-suites', 'parallel', 'p'], type: 'boolean', default: false },
	pathsInclude: { names: ['include', 'i'], type: 'array', default: ['**/*.{spec|test}.{js|mjs|jsx}'] },
	pathsExclude: { names: ['exclude', 'x'], type: 'array', default: ['**/node_modules', '**/.*'] },
	browser: { names: ['browser', 'b'], type: 'string', default: null },
	rest: { names: ['scan', null], type: 'array', default: ['.'] }
});

const config = argparse.parse(argv);

const scanDirs = config.rest.map((path) => resolve(cwd(), path));
const paths = findPathsMatching(scanDirs, config.pathsInclude, config.pathsExclude);

const runner = config.browser ? browserRunner : nodeRunner;
const summary = await runner(config, paths, stdout);

if (summary.error || summary.fail || !summary.pass) {
	exit(1);
} else {
	exit(0); // explicitly exit to avoid hanging on dangling promises
}
