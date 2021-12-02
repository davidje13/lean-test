#!/usr/bin/env node

import process from 'process';
import { resolve } from 'path';
import { outputs, reporters } from '../lean-test.mjs';
import findPathsMatching from './filesystem/findPathsMatching.mjs';
import ArgumentParser from './ArgumentParser.mjs';
import browserRunner from './browser/browserRunner.mjs';
import nodeRunner from './node/nodeRunner.mjs';

const argparse = new ArgumentParser({
	parallelDiscovery: { names: ['parallel-discovery', 'P'], env: 'PARALLEL_DISCOVERY', type: 'boolean', default: false },
	parallelSuites: { names: ['parallel-suites', 'parallel', 'p'], env: 'PARALLEL_SUITES', type: 'boolean', default: false },
	pathsInclude: { names: ['include', 'i'], type: 'array', default: ['**/*.{spec|test}.{js|mjs|jsx}'] },
	pathsExclude: { names: ['exclude', 'x'], type: 'array', default: ['**/node_modules', '**/.*'] },
	browser: { names: ['browser', 'b'], env: 'BROWSER', type: 'array', default: [] },
	colour: { names: ['colour', 'color'], env: 'OUTPUT_COLOUR', type: 'boolean', default: null },
	port: { names: ['port'], env: 'TESTRUNNER_PORT', type: 'int', default: 0 },
	host: { names: ['host'], env: 'TESTRUNNER_HOST', type: 'string', default: '127.0.0.1' },
	rest: { names: ['scan', null], type: 'array', default: ['.'] }
});

try {
	const config = argparse.parse(process.env, process.argv);

	const scanDirs = config.rest.map((path) => resolve(process.cwd(), path));
	const paths = findPathsMatching(scanDirs, config.pathsInclude, config.pathsExclude);

	const forceTTY = (
		config.colour ??
		(Boolean(process.env.CI || process.env.CONTINUOUS_INTEGRATION) || null)
	);
	const stdout = new outputs.Writer(process.stdout, forceTTY);
	const stderr = new outputs.Writer(process.stderr, forceTTY);
	const liveReporter = new reporters.Dots(stderr);
	const finalReporters = [
		new reporters.Full(stdout),
		new reporters.Summary(stdout),
	];

	const runner = config.browser.length ? browserRunner : nodeRunner;
	const result = await runner(config, paths, liveReporter.eventListener);
	finalReporters.forEach((reporter) => reporter.report(result));

	// TODO: warn or error if any node contains 0 tests

	if (result.summary.error || result.summary.fail || !result.summary.pass) {
		process.exit(1);
	} else {
		process.exit(0); // explicitly exit to avoid hanging on dangling promises
	}
} catch (e) {
	if (!(e instanceof Error)) {
		throw e;
	}
	process.stderr.write(`${e.message}\n`);
	process.exit(1);
}
