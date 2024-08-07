#!/usr/bin/env node

import process from 'process';
import { dirname, resolve } from 'path';
import { spawn } from 'child_process';
import { readFile } from 'fs/promises';

const baseDir = resolve(dirname(process.argv[1]), '..');
const [red, green] = makeColours(process.stdout, [31], [32]);

process.stdout.write('Running integration tests...\n\n');

const results = [];
results.push(...await Promise.all([
	runIntegrationTest('discovery', 'expected.txt', '--parallel'),
	runIntegrationTest('discovery', 'expected.txt', '--parallel', '--parallel-discovery'),
	runIntegrationTest('discovery', 'expected-seed.txt', '--random-seed=41fa8d97c5f70e550ab5391db9d3b0ed'),
	runIntegrationTest('basics', 'expected.txt', '--parallel'),
	runIntegrationTest('reporting', 'expected.txt', '--parallel'),
	runIntegrationTest('browser-broken', 'expected.txt', '--parallel', '--target=chrome'), // slow
	runIntegrationTest('modules', 'expected.txt', '--parallel', '--target=node,chrome,firefox', '--import-map'),
	runSlowOutputIntegrationTest(),
]));
// run separately to avoid needing multiple browser sessions for the same browser at a time on CI
results.push(...await Promise.all([
	runIntegrationTest('browser', 'expected.txt', '--parallel', '--target=chrome'),
	runIntegrationTest('browser', 'expected-ff.txt', '--parallel', '--target=firefox'), // firefox stack traces do not handle async chains but are still OK
]));
results.push(...await Promise.all([
	runIntegrationTest('multibrowser', 'expected.txt', '--parallel', '--target=chrome,firefox'),
]));

process.stdout.write('\nIntegration tests: ');
if (results.some((result) => !result)) {
	process.stdout.write(red('FAIL\n'), () => process.exit(1));
} else {
	process.stdout.write(green('PASS\n'), () => process.exit(0));
}

async function runIntegrationTest(dir, expectedFile = 'expected.txt', ...opts) {
	const expected = await readFile(resolve(baseDir, 'test', dir, expectedFile));
	const expectedStr = expected.toString('utf-8');

	const { exitCode, stdout, stderr } = await invoke(
		resolve(baseDir, 'build', 'bin', 'run.mjs'),
		['--colour=false', ...opts],
		{ cwd: resolve(baseDir, 'test', dir) },
	);

	const output = (
		stdout
			.replace(/\d+ms/g, 'xx')
			.replace(/ +\n/g, '\n') +
		`EXIT: ${exitCode}\n`
	);

	const match = (output === expectedStr);
	const marker = match ? green('[PASS]') : red('[FAIL]');
	process.stdout.write(`${marker} ${dir} ${opts.join(' ')}\n`);

	if (!match) {
		process.stdout.write(`stderr:\n${red(stderr)}\n`);
		process.stdout.write(`stdout:\n${red(output)}\n`);
		process.stdout.write(`Output did not match expectation in ${dir}/${expectedFile}.\n`);
	}
	return match;
}

async function runSlowOutputIntegrationTest() {
	const proc = spawn(
		resolve(baseDir, 'build', 'bin', 'run.mjs'),
		['--colour=false'],
		{ cwd: resolve(baseDir, 'test', 'slowoutput'), stdio: ['ignore', 'pipe', 'ignore'] },
	);
	const stdoutQtyP = slowConsume(proc.stdout);
	await new Promise((resolve, reject) => {
		proc.addListener('error', reject);
		proc.addListener('exit', resolve);
	});
	const stdoutQty = await stdoutQtyP;

	// The "noisy" test produces 40kB of output (doubled to 80kB because the failing tests are repeated)
	// If the process exits before flushing the output streams, we won't see the full output here
	const pass = stdoutQty > 80000;
	const marker = pass ? green('[PASS]') : red('[FAIL]');
	process.stdout.write(`${marker} slow output (got ${stdoutQty} bytes)\n`);
	return pass;
}

function slowConsume(pipe) {
	return new Promise((resolve) => {
		let total = 0;
		pipe.addListener('data', (d) => {
			total += d.length;
			pipe.pause();
			setTimeout(() => pipe.resume(), 10);
		});
		pipe.addListener('close', () => resolve(total));
	});
}

function invoke(exec, args, opts = {}) {
	return new Promise((res, reject) => {
		const stdout = [];
		const stderr = [];
		const proc = spawn(exec, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] });
		proc.stdout.addListener('data', (d) => stdout.push(d));
		proc.stderr.addListener('data', (d) => stderr.push(d));
		proc.addListener('error', reject);
		proc.addListener('close', (exitCode) => res({
			exitCode,
			stdout: Buffer.concat(stdout).toString('utf-8'),
			stderr: Buffer.concat(stderr).toString('utf-8'),
		}));
	});
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
