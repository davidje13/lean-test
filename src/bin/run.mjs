#!/usr/bin/env node

import { cwd, argv } from 'process';
import { resolve } from 'path';
import findPathsMatching from './findPathsMatching.mjs';
import {
	Runner,
	matchers,
	plugins,
	reporters,
} from '../index.mjs';

const workingDir = cwd();
const scanDirs = [];
for (let i = 2; i < argv.length; ++i) {
	if (argv[i].startsWith('-')) {
		// TODO: parse arguments
	} else {
		scanDirs.push(resolve(workingDir, argv[i]));
	}
}
if (!scanDirs.length) {
	scanDirs.push(workingDir);
}

const out = new reporters.TextReporter(process.stdout);

const builder = new Runner.Builder()
	.addPlugin(plugins.describe())
	.addPlugin(plugins.expect())
	.addPlugin(plugins.expect.matchers(matchers.core))
	.addPlugin(plugins.fail())
	.addPlugin(plugins.focus())
	.addPlugin(plugins.ignore())
	.addPlugin(plugins.lifecycle())
	.addPlugin(plugins.repeat())
	.addPlugin(plugins.retry())
	.addPlugin(plugins.stopAtFirstFailure())
	.addPlugin(plugins.test())
	.addPlugin(plugins.timeout());

for await (const { path, relative } of findPathsMatching(scanDirs, '**/*.{spec|test}.{js|mjs|jsx}', ['**/node_modules', '**/.*'])) {
	builder.addSuite(relative, async (globals) => {
		Object.assign(global, globals);
		const result = await import(path);
		return result.default;
	});
}

const runner = await builder.build();

await runner.run();
out.report(runner);
