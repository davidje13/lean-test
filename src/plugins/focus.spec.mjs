import testRunner from '../test-helpers/testRunner.mjs';
import describePlugin from './describe.mjs';
import ignorePlugin from './ignore.mjs';
import focus from './focus.mjs';

describe('focus', {
	async 'runs all tests if no focus is set'() {
		await testRunner([focus()], { count: 3, pass: 3 }, (g) => {
			g.test('test 1', () => {});
			g.test('test 2', () => {});
			g.test('test 3', () => {});
		});
	},

	async 'runs only focused tests'() {
		await testRunner([focus()], { count: 3, pass: 1, skip: 2 }, (g) => {
			g.test('test 1', () => {});
			g.test.focus('test 2', () => {});
			g.test('test 3', () => {});
		});
	},

	async 'runs all tests within a focused describe'() {
		await testRunner([describePlugin(), focus()], { count: 6, pass: 4, skip: 2 }, (g) => {
			g.test('test 1', () => {});
			g.describe.focus('block', () => {
				g.test('test 2a', () => {});
				g.test('test 2b', () => {});
				g.describe('sub block', () => {
					g.test('test 2ba', () => {});
				});
				g.test('test 2c', () => {});
			});
			g.test('test 3', () => {});
		});
	},

	async 'supports multiple focuses'() {
		await testRunner([describePlugin(), focus()], { count: 5, pass: 2, skip: 3 }, (g) => {
			g.test.focus('test 1', () => {});
			g.describe('block', () => {
				g.test('test 2a', () => {});
				g.test('test 2b', () => {});
				g.test.focus('test 2c', () => {});
			});
			g.test('test 3', () => {});
		});
	},

	async 'runs no tests if the only focused tests are also ignored'() {
		await testRunner([describePlugin(), ignorePlugin(), focus()], { count: 5, skip: 5 }, (g) => {
			g.test('test 1', () => {});
			g.describe.ignore('block', () => {
				g.test('test 2a', () => {});
				g.test('test 2b', () => {});
				g.test.focus('test 2c', () => {});
			});
			g.test('test 3', () => {});
		});
	},
});
