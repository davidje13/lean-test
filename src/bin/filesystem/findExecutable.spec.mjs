import { argv } from 'process';
import { dirname, join } from 'path';
import { canExec, which } from './findExecutable.mjs';

describe('canExec', {
	async 'returns true if the target file exists and is executable'() {
		await expect(canExec(argv[1]), resolves(true));
	},

	async 'returns false if the target does not exist'() {
		await expect(canExec('/nope/huh'), resolves(false));
	},

	async 'returns false if the target is not executable'() {
		const baseDir = dirname(argv[1]);
		const otherFile = join(baseDir, 'ArgumentParser.mjs');
		await expect(canExec(otherFile), resolves(false));
	},
});

describe('which', {
	async 'returns the full path of the requested executable'() {
		await expect(which('ls'), resolves(contains('/ls')));
	},

	async 'returns null if the executable cannot be found'() {
		await expect(which('this-executable-does-not-exist'), resolves(null));
	},
});
