import testRunner from '../test-helpers/testRunner.mjs';
import sleep from '../test-helpers/sleep.mjs';
import failPlugin from './fail.mjs';
import timeout from './timeout.mjs';

describe('timeout', {
	async 'aborts tests after the specified time has elapsed'() {
		const beginTime = Date.now();
		await testRunner([timeout()], { count: 1, pass: 0, error: 1 }, (g) => {
			g.test('test 1', async () => {
				await forever();
			}, { timeout: 10 });
		});
		const duration = Date.now() - beginTime;
		expect(duration, isGreaterThanOrEqual(10));
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

function forever() {
	return new Promise(() => {});
}
