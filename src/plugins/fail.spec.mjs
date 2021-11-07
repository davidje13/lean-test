import testRunner from '../test-helpers/testRunner.mjs';
import sleep from '../test-helpers/sleep.mjs';
import fail from './fail.mjs';

describe('error', {
	async 'marks test as errored'() {
		await testRunner([], { count: 1, error: 1 }, (g) => {
			g.test('test', () => {
				throw new Error('nope');
			});
		});
	},
});

describe('fail', {
	async 'marks test as a failure'() {
		await testRunner([fail()], { count: 1, fail: 1 }, (g) => {
			g.test('test', () => {
				g.fail('nope');
			});
		});
	},

	async 'works asynchronously'() {
		await testRunner([fail()], { count: 1, fail: 1 }, (g) => {
			g.test('test', async () => {
				await sleep(5);
				g.fail('nope');
			});
		});
	},
});

describe('skip', {
	async 'marks test as skipped'() {
		await testRunner([fail()], { count: 1, skip: 1 }, (g) => {
			g.test('test', () => {
				g.skip('nope');
			});
		});
	},

	async 'works asynchronously'() {
		await testRunner([fail()], { count: 1, skip: 1 }, (g) => {
			g.test('test', async () => {
				await sleep(5);
				g.skip('nope');
			});
		});
	},
});
