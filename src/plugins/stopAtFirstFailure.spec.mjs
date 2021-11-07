import testRunner from '../test-helpers/testRunner.mjs';
import describePlugin from './describe.mjs';
import ignorePlugin from './ignore.mjs';
import stopAtFirstFailure from './stopAtFirstFailure.mjs';

describe('stopAtFirstFailure', {
	async 'stops tests after a failure'() {
		await testRunner([describePlugin(), stopAtFirstFailure()], { count: 4, pass: 1, skip: 2, error: 1 }, (g) => {
			g.describe('flow test', () => {
				g.test('test 1', () => {});
				g.test('test 2', () => { throw new Error(); });
				g.test('test 3', () => { throw new Error(); });
				g.test('test 4', () => { throw new Error(); });
			}, { stopAtFirstFailure: true });
		});
	},

	async 'continues past ignored tests'() {
		await testRunner([describePlugin(), ignorePlugin(), stopAtFirstFailure()], { count: 5, pass: 2, skip: 2, error: 1 }, (g) => {
			g.describe('flow test', () => {
				g.test('test 1', () => {});
				g.test.ignore('test 2', () => { throw new Error(); });
				g.test('test 3', () => {});
				g.test('test 4', () => { throw new Error(); });
				g.test('test 5', () => { throw new Error(); });
			}, { stopAtFirstFailure: true });
		});
	},

	async 'applies only to the marked block'() {
		await testRunner([describePlugin(), stopAtFirstFailure()], { count: 8, pass: 4, skip: 3, error: 1 }, (g) => {
			g.test('test before', () => {});
			g.describe('flow test', () => {
				g.test('test 1', () => {});
				g.describe('inner', () => {
					g.test('test 2', () => { throw new Error(); });
					g.test('test 3', () => {});
				});
				g.test('test 4', () => { throw new Error(); });
				g.describe('inner 2', () => {
					g.test('test 5', () => { throw new Error(); });
					g.test('test 6', () => { throw new Error(); });
				});
			}, { stopAtFirstFailure: true });
			g.test('test after', () => {});
		});
	},
});
