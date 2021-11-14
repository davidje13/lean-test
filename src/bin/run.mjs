#!/usr/bin/env node

import { cwd, argv, stdout, exit } from 'process';
import { resolve } from 'path';
import findPathsMatching from './findPathsMatching.mjs';
import ArgumentParser from './ArgumentParser.mjs';
import {
	Runner,
	matchers,
	plugins,
	reporters,
} from '../index.mjs';

const argparse = new ArgumentParser({
	parallelDiscovery: { names: ['parallel-discovery', 'P'], type: 'boolean', default: false },
	parallelSuites: { names: ['parallel-suites', 'parallel', 'p'], type: 'boolean', default: false },
	pathsInclude: { names: ['include', 'i'], type: 'array', default: ['**/*.{spec|test}.{js|mjs|jsx}'] },
	pathsExclude: { names: ['exclude', 'x'], type: 'array', default: ['**/node_modules', '**/.*'] },
	rest: { names: ['scan', null], type: 'array', default: ['.'] }
});

const config = argparse.parse(argv);

const workingDir = cwd();
const scanDirs = config.rest.map((path) => resolve(workingDir, path));

const out = new reporters.TextReporter(stdout);

const builder = new Runner.Builder()
	.useParallelDiscovery(config.parallelDiscovery)
	.useParallelSuites(config.parallelSuites)
	.addPlugin(plugins.describe())
	.addPlugin(plugins.expect())
	.addPlugin(plugins.expect.matchers(matchers.core))
	.addPlugin(plugins.expect.matchers(matchers.collections))
	.addPlugin(plugins.expect.matchers(matchers.inequality))
	.addPlugin(plugins.fail())
	.addPlugin(plugins.focus())
	.addPlugin(plugins.ignore())
	.addPlugin(plugins.lifecycle())
	.addPlugin(plugins.outputCaptor())
	.addPlugin(plugins.repeat())
	.addPlugin(plugins.retry())
	.addPlugin(plugins.stopAtFirstFailure())
	.addPlugin(plugins.test())
	.addPlugin(plugins.test('it'))
	.addPlugin(plugins.timeout());

for await (const { path, relative } of findPathsMatching(scanDirs, config.pathsInclude, config.pathsExclude)) {
	builder.addSuite(relative, async (globals) => {
		Object.assign(global, globals);
		const result = await import(path);
		return result.default;
	});
}

const runner = await builder.build();

const result = await runner.run();
out.report(result);

const summary = result.getSummary();
if (summary.error || summary.fail || !summary.pass) {
	exit(1);
} else {
	exit(0); // explicitly exit to avoid hanging on dangling promises
}
