import testRunner from '../test-helpers/testRunner.mjs';
import sleep from '../test-helpers/sleep.mjs';
import * as core from '../matchers/core.mjs';
import expect from './expect.mjs';

const MY_CUSTOM_SAME_MATCHER = (expected) => (actual) => {
	if (actual === expected) {
		return { success: true, message: 'inverted failure' };
	} else {
		return { success: false, message: 'failure' };
	}
};

describe('expect', {
	async 'allows tests to pass if expectation is met'() {
		await testRunner([expect(), expect.matchers(core)], { pass: 1 }, (g) => {
			g.test('test', () => {
				g.expect(1, g.equals(1));
			});
		});
	},

	async 'marks test as failed if expectation is not met'() {
		await testRunner([expect(), expect.matchers(core)], { fail: 1 }, (g) => {
			g.test('test', () => {
				g.expect(1, g.equals(2));
			});
		});
	},

	async 'supports fluent syntax'() {
		await testRunner([expect(), expect.matchers(core)], { fail: 1 }, (g) => {
			g.test('test', () => {
				g.expect(1).equals(2);
			});
		});
	},

	async 'runs asynchronously if matcher is asynchronous'() {
		await testRunner([expect(), expect.matchers(core)], { pass: 1 }, (g) => {
			g.test('test', async () => {
				await g.expect(() => sleep(5, 'result'), g.resolves(g.equals('result')));
			});
		});

		await testRunner([expect(), expect.matchers(core)], { count: 2, fail: 2 }, (g) => {
			g.test('mismatch', async () => {
				await g.expect(() => sleep(5, 'result'), g.resolves(g.equals('nope')));
			});

			g.test('failure', async () => {
				await g.expect(() => sleep(5, 'result'), g.throws());
			});
		});
	},

	async 'custom matchers can be used'() {
		await testRunner([expect(), expect.matchers(core)], { pass: 1 }, (g) => {
			g.test('test', () => {
				g.expect(1, MY_CUSTOM_SAME_MATCHER(1));
			});
		});

		await testRunner([expect(), expect.matchers(core)], { fail: 1 }, (g) => {
			g.test('test', () => {
				g.expect(2, MY_CUSTOM_SAME_MATCHER(1));
			});
		});
	},

	async 'custom fluent matchers can be registered and used'() {
		await testRunner([expect(), expect.matchers(core)], { pass: 1 }, (g) => {
			g.extendExpect({
				myMatcherName: MY_CUSTOM_SAME_MATCHER,
			});

			g.test('test', () => {
				g.expect(1).myMatcherName(1);
			});
		});

		await testRunner([expect(), expect.matchers(core)], { fail: 1 }, (g) => {
			g.extendExpect({
				myMatcherName: MY_CUSTOM_SAME_MATCHER,
			});

			g.test('test', () => {
				g.expect(2).myMatcherName(1);
			});
		});
	},
}, { parallel: true });

describe('assume', {
	async 'allows tests to pass if assumption is met'() {
		await testRunner([expect(), expect.matchers(core)], { pass: 1 }, (g) => {
			g.test('test', () => {
				g.assume(1, g.equals(1));
			});
		});
	},

	async 'marks test as skipped if assumption is not met'() {
		await testRunner([expect(), expect.matchers(core)], { skip: 1 }, (g) => {
			g.test('test', () => {
				g.assume(1, g.equals(2));
			});
		});
	},

	async 'supports fluent syntax'() {
		await testRunner([expect(), expect.matchers(core)], { skip: 1 }, (g) => {
			g.test('test', () => {
				g.assume(1).equals(2);
			});
		});
	},
}, { parallel: true });
