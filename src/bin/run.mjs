#!/usr/bin/env node

import { cwd, argv, stdout, exit } from 'process';
import { resolve } from 'path';
import { reporters } from '../index.mjs';
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
	port: { names: ['port'], type: 'int', default: 0 },
	host: { names: ['host'], type: 'string', default: '127.0.0.1' },
	rest: { names: ['scan', null], type: 'array', default: ['.'] }
});

const config = argparse.parse(argv);

const scanDirs = config.rest.map((path) => resolve(cwd(), path));
const paths = findPathsMatching(scanDirs, config.pathsInclude, config.pathsExclude);
const out = new reporters.TextReporter(stdout);

const runner = config.browser ? browserRunner : nodeRunner;
const result = await runner(config, paths);
out.report(result);

if (result.summary.error || result.summary.fail || !result.summary.pass) {
	exit(1);
} else {
	exit(0); // explicitly exit to avoid hanging on dangling promises
}
