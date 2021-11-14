#!/usr/bin/env node
import { argv, cwd, stdout, exit } from 'process';
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

const YES = ['true', 'yes', '1', 'on'];
const NO = ['false', 'no', '0', 'off'];

class ArgumentParser {
	constructor(opts) {
		this.names = new Map();
		this.defaults = {};
		Object.entries(opts).forEach(([id, v]) => {
			this.defaults[id] = v.default;
			const config = { id, type: v.type || 'boolean' };
			v.names.forEach((name) => this.names.set(name, config));
		});
	}

	loadOpt(target, name, value, extra) {
		const opt = this.names.get(name);
		if (!opt) {
			throw new Error(`Unknown flag: ${name}`);
		}
		let inc = 0;
		const getNext = () => {
			if (inc >= extra.length) {
				throw new Error(`No value given for ${name}`);
			}
			return extra[inc++];
		};
		switch (opt.type) {
			case 'boolean':
				if (opt.id in target) {
					throw new Error(`Multiple values for ${name} not supported`);
				}
				if (value === null || YES.includes(value)) {
					target[opt.id] = true;
				} else if (NO.includes(value)) {
					target[opt.id] = false;
				} else {
					throw new Error(`Unknown boolean value for ${name}: ${value}`);
				}
				break;
			case 'string':
				if (opt.id in target) {
					throw new Error(`Multiple values for ${name} not supported`);
				}
				target[opt.id] = value ?? getNext();
				break;
			case 'array':
				const list = target[opt.id] || [];
				list.push(value ?? getNext());
				target[opt.id] = list;
				break;
			default:
				throw new Error(`Unknown argument type for ${name}: ${opt.type}`);
		}
		return inc;
	}

	parse(argv, begin = 2) {
		let rest = false;
		const result = {};
		for (let i = begin; i < argv.length; ++i) {
			const arg = argv[i];
			if (rest) {
				this.loadOpt(result, null, arg, []);
			} else if (arg === '--') {
				rest = true;
			} else if (arg.startsWith('--')) {
				const [name, value] = split2(arg.substr(2), '=');
				i += this.loadOpt(result, name, value, argv.slice(i + 1));
			} else if (arg.startsWith('-')) {
				const [names, value] = split2(arg.substr(1), '=');
				for (let j = 0; j < names.length - 1; ++ j) {
					this.loadOpt(result, names[j], null, []);
				}
				i += this.loadOpt(result, names[names.length - 1], value, argv.slice(i + 1));
			} else {
				this.loadOpt(result, null, arg, []);
			}
		}
		return { ...this.defaults, ...result };
	}
}

function split2(v, s) {
	const p = v.indexOf(s);
	if (p === -1) {
		return [v, null];
	} else {
		return [v.substr(0, p), v.substr(p + 1)];
	}
}

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
