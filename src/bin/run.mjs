#!/usr/bin/env node

import process from 'process';
import { resolve } from 'path';
import { outputs, ParallelRunner, reporters } from '../lean-test.mjs';
import findPathsMatching from './filesystem/findPathsMatching.mjs';
import ArgumentParser from './ArgumentParser.mjs';
import { launchChrome, launchFirefox } from './browser/launchBrowser.mjs';
import { autoBrowserRunner, manualBrowserRunner } from './browser/browserRunner.mjs';
import { nodeRunner } from './node/nodeRunner.mjs';
import { preprocessors } from '../preprocessor.mjs';
import { asyncListToSync } from './utils.mjs';

const targets = new Map([
	['node', { name: 'Node.js', make: nodeRunner }],
	['url', { name: 'Custom Browser', make: manualBrowserRunner }],
	['chrome', { name: 'Google Chrome', make: autoBrowserRunner('chrome', launchChrome) }],
	['firefox', { name: 'Mozilla Firefox', make: autoBrowserRunner('firefox', launchFirefox) }],
]);

const preprocs = new Map([['none', null], ...Object.entries(preprocessors)]);

const argparse = new ArgumentParser({
	parallelDiscovery: { names: ['parallel-discovery', 'P'], env: 'PARALLEL_DISCOVERY', type: 'boolean', default: false },
	parallelSuites: { names: ['parallel-suites', 'parallel', 'p'], env: 'PARALLEL_SUITES', type: 'boolean', default: false },
	pathsInclude: { names: ['include', 'i'], type: 'set', default: ['**/*.{spec|test}.{js|mjs|cjs|jsx}'] },
	pathsExclude: { names: ['exclude', 'x'], type: 'set', default: [] },
	preprocessor: { names: ['preprocess', 'c'], type: 'string', default: 'none', mapping: preprocs },
	noDefaultExclude: { names: ['no-default-exclude'], type: 'boolean', default: false },
	target: { names: ['target', 't'], env: 'TARGET', type: 'set', default: ['node'], mapping: targets },
	colour: { names: ['colour', 'color'], env: 'OUTPUT_COLOUR', type: 'boolean', default: null },
	importMap: { names: ['import-map', 'm'], env: 'IMPORT_MAP', type: 'boolean', default: false },
	port: { names: ['port'], env: 'TESTRUNNER_PORT', type: 'int', default: 0 },
	host: { names: ['host'], env: 'TESTRUNNER_HOST', type: 'string', default: '127.0.0.1' },
	scan: { names: ['scan', null], type: 'set', default: ['.'] }
});

try {
	const config = argparse.parse(process.env, process.argv);

	const exclusion = [...config.pathsExclude, ...(config.noDefaultExclude ? [] : ['**/node_modules', '**/.*'])];
	const scanDirs = config.scan.map((path) => resolve(process.cwd(), path));
	const paths = await asyncListToSync(findPathsMatching(scanDirs, config.pathsInclude, exclusion));
	config.preprocessor = await config.preprocessor?.();

	const forceTTY = (
		config.colour ??
		(Boolean(process.env.CI || process.env.CONTINUOUS_INTEGRATION) || null)
	);
	const stdout = new outputs.Writer(process.stdout, forceTTY);
	const stderr = new outputs.Writer(process.stderr, forceTTY);
	const liveReporter = new reporters.Dots(stderr);
	const finalReporters = [
		new reporters.Full(stdout),
		new reporters.ErrorList(stdout),
		new reporters.Summary(stdout),
	];

	const multi = new ParallelRunner();
	for (const target of config.target) {
		multi.add(target.name, await target.make(config, paths));
	}
	const result = await multi.run(liveReporter.eventListener);
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
	process.stdout.write(`\n${e.message}\n`);
	process.exit(1);
}
