#!/usr/bin/env node
import { cwd, argv } from 'process';
import { join, resolve } from 'path';
import fs from 'fs/promises';
import { reporters, Runner, plugins, matchers } from '../lean-test.mjs';

const SPECIAL = /[^-a-zA-Z0-9 _]/g;
const SPECIAL_REPLACE = (v) => {
	switch (v) {
		case '*': return '[^/]*';
		case '{': return '(?:';
		case '}': return ')';
		case '|': return '|';
		default: return '\\u' + v.charCodeAt(0).toString(16).padStart(4, '0');
	}
};

class PathMatcher {
	constructor(pattern) {
		const options = (Array.isArray(pattern) ? pattern : [pattern]).map((p) => p.split('/').map((seg) => {
			if (seg === '**') {
				return '(?:.+/)?';
			} else {
				const regexp = seg.replace(SPECIAL, SPECIAL_REPLACE) + '/';
				return regexp;
			}
		}));

		const full = options.map((choice) => choice.join('')).join('|');
		const part = options.map((choice) => ('(?:' + choice.join('(?:') + ')?'.repeat(choice.length))).join('|');

		this.full = new RegExp(`^(?:${full})$`, 'i');
		this.part = new RegExp(`^(?:${part})$`, 'i');
	}

	match(path) {
		return this.full.test(path + (path.endsWith('/') ? '' : '/'));
	}

	partialMatch(path) {
		return this.part.test(path + (path.endsWith('/') ? '' : '/'));
	}
}

async function* scan(dir, relative, test) {
	for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
		const sub = join(dir, entry.name);
		const subRelative = relative + entry.name + '/'; // always use '/' for matching
		if (entry.isDirectory() && test(subRelative, false)) {
			yield* scan(sub, subRelative, test);
		} else if (entry.isFile() && test(subRelative, true)) {
			yield { path: sub, relative: subRelative.substr(0, subRelative.length - 1) };
		}
	}
}

async function* findPathsMatching(baseDirs, pattern, exclude = []) {
	const mPattern = new PathMatcher(pattern);
	const mExclude = new PathMatcher(exclude);
	for (const baseDir of Array.isArray(baseDirs) ? baseDirs : [baseDirs]) {
		yield* scan(baseDir, '', (path, isFile) => {
			if (mExclude.match(path)) {
				return false;
			}
			if (isFile) {
				return mPattern.match(path);
			}
			return mPattern.partialMatch(path);
		});
	}
}

const workingDir = cwd();
const scanDirs = [];
for (let i = 2; i < argv.length; ++i) {
	if (argv[i].startsWith('-')) ; else {
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

for await (const { path, relative } of findPathsMatching(scanDirs, '**/*.{spec|test}.{js|mjs|jsx}', ['**/node_modules', '**/.*'])) {
	builder.addSuite(relative, async (globals) => {
		Object.assign(global, globals);
		const result = await import(path);
		return result.default;
	});
}

const runner = await builder.build();

const result = await runner.run();
out.report(result);
