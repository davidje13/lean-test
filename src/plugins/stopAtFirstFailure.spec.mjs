import testRunner from '../test-helpers/testRunner.mjs';
import describePlugin from './describe.mjs';
import ignorePlugin from './ignore.mjs';
import stopAtFirstFailure from './stopAtFirstFailure.mjs';

describe('stopAtFirstFailure', {
	async 'stops tests after a failure'() {
		const invoked = [];
		await testRunner([describePlugin(), stopAtFirstFailure()], { count: 4, pass: 1, skip: 2, error: 1 }, (g) => {
			g.describe('flow test', () => {
				addTest(g, invoked, 'test 1');
				addTest(g, invoked, 'test 2', true);
				addTest(g, invoked, 'test 3');
				addTest(g, invoked, 'test 4');
			}, { stopAtFirstFailure: true });
		});

		expect(invoked, equals(['test 1', 'test 2']));
	},

	async 'continues past ignored tests'() {
		const invoked = [];
		await testRunner([describePlugin(), ignorePlugin(), stopAtFirstFailure()], { count: 5, pass: 2, skip: 2, error: 1 }, (g) => {
			g.describe('flow test', () => {
				addTest(g, invoked, 'test 1');
				addTest(g, invoked, 'test 2', false, { ignore: true });
				addTest(g, invoked, 'test 3');
				addTest(g, invoked, 'test 4', true);
				addTest(g, invoked, 'test 5');
			}, { stopAtFirstFailure: true });
		});

		expect(invoked, equals(['test 1', 'test 3', 'test 4']));
	},

	async 'applies only to the marked block'() {
		const invoked = [];
		await testRunner([describePlugin(), stopAtFirstFailure()], { count: 8, pass: 4, skip: 3, error: 1 }, (g) => {
			addTest(g, invoked, 'test 1');
			g.describe('flow test', () => {
				addTest(g, invoked, 'test 2');
				g.describe('inner', () => {
					addTest(g, invoked, 'test 3', true);
					addTest(g, invoked, 'test 4');
				});
				addTest(g, invoked, 'test 5');
				g.describe('inner 2', () => {
					addTest(g, invoked, 'test 6');
					addTest(g, invoked, 'test 7');
				});
			}, { stopAtFirstFailure: true });
			addTest(g, invoked, 'test 8');
		});

		expect(invoked, equals(['test 1', 'test 2', 'test 3', 'test 4', 'test 8']));
	},
});

function addTest(g, invoked, name, fail = false, options) {
	g.test(name, () => {
		invoked.push(name);
		if (fail) {
			throw new Error();
		}
	}, options);
}
