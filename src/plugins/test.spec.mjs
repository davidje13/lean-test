import testRunner from '../test-helpers/testRunner.mjs';
import test from './test.mjs';

describe('test', {
	async 'runs tests and reports passes'() {
		await testRunner([test()], { count: 1, pass: 1 }, (g) => {
			g.test('test', () => {});
		});
	},

	async 'allows extra config before or after the function'() {
		await testRunner([test()], { count: 2, pass: 2 }, (g) => {
			g.test('test after', () => {}, {});
			g.test('test before', {}, () => {});
		});
	},

	async 'reports errors'() {
		await testRunner([test()], { count: 1, error: 1 }, (g) => {
			g.test('test', () => {
				throw new Error('nope');
			});
		});
	},

	async 'can be configured with a custom name'() {
		await testRunner([test('woo')], { count: 1, pass: 1 }, (g) => {
			g.woo('test', () => {});
		});
	},

	async 'can be configured with multiple names'() {
		await testRunner([test(), test('woo'), test('hi')], { count: 3, pass: 3 }, (g) => {
			g.test('test', () => {});
			g.woo('test', () => {});
			g.hi('test', () => {});
		});
	},
});
