#!/usr/bin/env -S node --disable-proto delete --disallow-code-generation-from-strings

import process from 'process';
import { dirname, resolve } from 'path';
import { spawn } from 'child_process';
import { readFile } from 'fs/promises';

const [red, green] = makeColours(process.stdout, [31], [32]);

process.stdout.write('Running integration tests...\n\n');

const results = await Promise.all([
	runIntegrationTest('discovery'),
	runIntegrationTest('basics'),
	runIntegrationTest('reporting'),
	runIntegrationTest('browser', 'expected.txt', '--browser=chrome'),
	runIntegrationTest('browser', 'expected-ff.txt', '--browser=firefox'), // firefox stack traces do not handle async chains but are still OK
]);

process.stdout.write('\nIntegration tests: ');
if (results.some((result) => !result)) {
	process.stdout.write(red('FAIL\n'));
	process.exit(1);
} else {
	process.stdout.write(green('PASS\n'));
	process.exit(0);
}

async function runIntegrationTest(dir, expectedFile = 'expected.txt', ...opts) {
	const baseDir = resolve(dirname(process.argv[1]), '..');
	const expected = await readFile(resolve(baseDir, 'test', dir, expectedFile));
	const expectedStr = expected.toString('utf-8');

	const { stdout, exitCode } = await asyncSpawn(
		resolve(baseDir, 'build', 'bin', 'run.mjs'),
		['--parallel', ...opts],
		{ cwd: resolve(baseDir, 'test', dir) },
	);

	const output = stdout + `EXIT: ${exitCode}\n`;

	const match = (output === expectedStr);
	const marker = match ? green('[PASS]') : red('[FAIL]');
	process.stdout.write(`${marker} ${dir} ${opts.join(' ')}\n`);

	if (!match) {
		process.stdout.write(`${red(output)}\n`);
		process.stdout.write(`Output did not match expectation in ${dir}/${expectedFile}.\n`);
	}
	return match;
}

async function asyncSpawn(path, args, opts) {
	const stdout = [];
	const stderr = [];
	const exitCode = await new Promise((res, rej) => {
		const proc = spawn(path, args, {
			...opts,
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		proc.addListener('error', rej);
		proc.stdout.addListener('data', (data) => stdout.push(data));
		proc.stderr.addListener('data', (data) => stderr.push(data));
		proc.addListener('close', res);
	});
	return { stdout: parseOutput(stdout), stderr: parseOutput(stderr), exitCode };
}

function parseOutput(out) {
	return Buffer.concat(out)
		.toString('utf-8')
		.replace(/\d+ms/g, 'xx')
		.replace(/ +\n/g, '\n');
}

function makeColours(target, ...colours) {
	let colour;
	if (target.isTTY) {
		colour = (...vs) => {
			const prefix = '\u001B[' + vs.join(';') + 'm';
			return (v) => `${prefix}${v}\u001B[0m`;
		};
	} else {
		colour = () => (v, fallback) => (fallback ?? v);
	}
	return colours.map((c) => colour(...c));
}
