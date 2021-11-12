import testRunner from '../test-helpers/testRunner.mjs';
import failPlugin from './fail.mjs';
import timeout from './timeout.mjs';

describe('timeout', {
	async 'aborts tests after the specified time has elapsed'() {
		const result = await testRunner([timeout()], { count: 1, pass: 0, error: 1 }, (g) => {
			g.test('test 1', async () => {
				await forever();
			}, { timeout: 10 });
		});
		expect(result.getSummary().duration, isGreaterThanOrEqual(10));
	},

	async 'ignores success after the specified time has elapsed'() {
		await testRunner([timeout()], { count: 1, pass: 0, error: 1 }, (g) => {
			g.test('test 1', async () => {
				await sleep(20);
			}, { timeout: 10 });
		});
	},

	async 'ignores failure after the specified time has elapsed'() {
		await testRunner([timeout(), failPlugin()], { count: 1, pass: 0, error: 1 }, (g) => {
			g.test('test 1', async () => {
				await sleep(20);
				g.fail('meh');
			}, { timeout: 10 });
		});
	},

	async 'ignores the timeout if the test passes first'() {
		await testRunner([timeout()], { count: 1, pass: 1, error: 0 }, (g) => {
			g.test('test 1', async () => {
				await sleep(10);
			}, { timeout: 20 });
		});
	},

	async 'ignores the timeout if the test fails first'() {
		await testRunner([timeout(), failPlugin()], { count: 1, fail: 1, error: 0 }, (g) => {
			g.test('test 1', async () => {
				await sleep(10);
				g.fail('meh');
			}, { timeout: 20 });
		});
	},
}, { parallel: true });

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function forever() {
	return new Promise(() => {});
}
