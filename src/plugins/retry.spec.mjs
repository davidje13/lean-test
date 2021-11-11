import testRunner from '../test-helpers/testRunner.mjs';
import retry from './retry.mjs';

describe('retry', {
	async 'retries failed tests'() {
		let attempts = 0;
		await testRunner([retry()], { count: 1, pass: 1, error: 0 }, (g) => {
			g.test('test 1', () => {
				++attempts;
				if (attempts < 2) {
					throw new Error('fail');
				}
			}, { retry: 3 });
		});

		expect(attempts, equals(2));
	},

	async 'does not retry passing tests'() {
		let attempts = 0;
		await testRunner([retry()], { count: 1, pass: 1, error: 0 }, (g) => {
			g.test('test 1', () => {
				++attempts;
			}, { retry: 3 });
		});

		expect(attempts, equals(1));
	},

	async 'fails if maximum retries are reached'() {
		let attempts = 0;
		await testRunner([retry()], { count: 1, pass: 0, error: 1 }, (g) => {
			g.test('test 1', () => {
				++attempts;
				throw new Error('fail');
			}, { retry: 3 });
		});

		expect(attempts, equals(3));
	},
});
