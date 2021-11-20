#!/usr/bin/env node

import process from 'process';
import { resolve } from 'path';
import { outputs, reporters } from '../index.mjs';
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

const config = argparse.parse(process.argv);

const scanDirs = config.rest.map((path) => resolve(process.cwd(), path));
const paths = findPathsMatching(scanDirs, config.pathsInclude, config.pathsExclude);

const stdout = new outputs.Writer(process.stdout);
const stderr = new outputs.Writer(process.stderr);
const liveReporter = new reporters.Dots(stderr);
const finalReporters = [
	new reporters.Full(stdout),
	new reporters.Summary(stdout),
];

const runner = config.browser ? browserRunner : nodeRunner;
const result = await runner(config, paths, liveReporter.eventListener);
finalReporters.forEach((reporter) => reporter.report(result));

// TODO: warn or error if any node contains 0 tests

if (result.summary.error || result.summary.fail || !result.summary.pass) {
	process.exit(1);
} else {
	process.exit(0); // explicitly exit to avoid hanging on dangling promises
}
