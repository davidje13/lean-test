import testRunner from '../test-helpers/testRunner.mjs';
import describePlugin from './describe.mjs';
import ignore from './ignore.mjs';

describe('ignore', {
	async 'skips ignored tests'() {
		await testRunner([ignore()], { count: 3, pass: 2, skip: 1 }, (g) => {
			g.test('test 1', () => {});
			g.test.ignore('test 2', () => {});
			g.test('test 3', () => {});
		});
	},

	async 'skips all tests within an ignored describe'() {
		await testRunner([describePlugin(), ignore()], { count: 6, pass: 2, skip: 4 }, (g) => {
			g.test('test 1', () => {});
			g.describe.ignore('block', () => {
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

	async 'supports multiple ignores'() {
		await testRunner([describePlugin(), ignore()], { count: 5, pass: 3, skip: 2 }, (g) => {
			g.test.ignore('test 1', () => {});
			g.describe('block', () => {
				g.test('test 2a', () => {});
				g.test('test 2b', () => {});
				g.test.ignore('test 2c', () => {});
			});
			g.test('test 3', () => {});
		});
	},
});
