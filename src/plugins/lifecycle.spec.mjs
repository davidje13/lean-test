import TestAssumptionError from '../core/TestAssumptionError.mjs';
import testRunner from '../test-helpers/testRunner.mjs';
import describePlugin from './describe.mjs';
import ignorePlugin from './ignore.mjs';
import focusPlugin from './focus.mjs';
import retryPlugin from './retry.mjs';
import lifecycle from './lifecycle.mjs';

const PLUGINS = [
	lifecycle(),
	describePlugin(),
	ignorePlugin(),
	focusPlugin(),
	retryPlugin(),
];

describe('lifecycle', {
	async 'passing tests run all lifecycle methods'() {
		const invoked = await invoke({ pass: 2 }, (g, tag) => {
			g.test('test 1', () => tag('test 1'));
			g.test('test 2', () => tag('test 2'));
		});

		expect(invoked, equals([
			'ba1', 'ba2',
			'be1', 'be2', 'test 1', 'end-be2', 'end-be1', 'ae1', 'ae2',
			'be1', 'be2', 'test 2', 'end-be2', 'end-be1', 'ae1', 'ae2',
			'end-ba2', 'end-ba1', 'aa1', 'aa2',
		]));
	},

	async 'nested methods are called outer-most to inner-most'() {
		const invoked = await invoke({ pass: 3 }, (g, tag) => {
			g.describe('inner', () => {
				g.beforeAll(() => { tag('ba3'); return () => tag('end-ba3'); });
				g.beforeEach(() => { tag('be3'); return () => tag('end-be3'); });
				g.afterEach(() => tag('ae3'));
				g.afterAll(() => tag('aa3'));

				g.test('test 1', () => tag('test 1'));
				g.test('test 2', () => tag('test 2'));
			});

			g.test('test 3', () => tag('test 3'));
		});

		expect(invoked, equals([
			'ba1', 'ba2',
			'ba3',
			'be1', 'be2', 'be3', 'test 1', 'end-be3', 'ae3', 'end-be2', 'end-be1', 'ae1', 'ae2',
			'be1', 'be2', 'be3', 'test 2', 'end-be3', 'ae3', 'end-be2', 'end-be1', 'ae1', 'ae2',
			'end-ba3',
			'aa3',
			'be1', 'be2', 'test 3', 'end-be2', 'end-be1', 'ae1', 'ae2',
			'end-ba2', 'end-ba1', 'aa1', 'aa2',
		]));
	},

	async 'failing tests run all lifecycle methods'() {
		const invoked = await invoke({ count: 2, pass: 1, error: 1 }, (g, tag) => {
			g.test('test 1', () => { tag('test 1'); throw new Error() });
			g.test('test 2', () => tag('test 2'));
		});

		expect(invoked, equals([
			'ba1', 'ba2',
			'be1', 'be2', 'test 1', 'end-be2', 'end-be1', 'ae1', 'ae2',
			'be1', 'be2', 'test 2', 'end-be2', 'end-be1', 'ae1', 'ae2',
			'end-ba2', 'end-ba1', 'aa1', 'aa2',
		]));
	},

	async 'skipped tests avoid lifecycle methods'() {
		const invoked = await invoke({ count: 3, pass: 1, skip: 2 }, (g, tag) => {
			g.test.ignore('test 1', () => tag('test 1'));
			g.test('test 2', () => { tag('test 2'); throw new TestAssumptionError() });
			g.test('test 3', () => tag('test 3'));
		});

		expect(invoked, equals([
			'ba1', 'ba2',
			'be1', 'be2', 'test 2', 'end-be2', 'end-be1', 'ae1', 'ae2',
			'be1', 'be2', 'test 3', 'end-be2', 'end-be1', 'ae1', 'ae2',
			'end-ba2', 'end-ba1', 'aa1', 'aa2',
		]));
	},

	async 'unfocused tests avoid lifecycle methods'() {
		const invoked = await invoke({ count: 4, pass: 1, skip: 3 }, (g, tag) => {
			g.describe('inner', () => {
				g.beforeAll(() => { tag('ba3'); return () => tag('end-ba3'); });
				g.beforeEach(() => { tag('be3'); return () => tag('end-be3'); });
				g.afterEach(() => tag('ae3'));
				g.afterAll(() => tag('aa3'));

				g.test('test 1', () => tag('test 1'));
				g.test.focus('test 2', () => tag('test 2'));
			});

			g.describe('inner 2', () => {
				g.beforeAll(() => { tag('ba4'); return () => tag('end-ba4'); });
				g.beforeEach(() => { tag('be4'); return () => tag('end-be4'); });
				g.afterEach(() => tag('ae4'));
				g.afterAll(() => tag('aa4'));

				g.test('test 3', () => tag('test 3'));
			});

			g.test('test 4', () => tag('test 4'));
		});

		expect(invoked, equals([
			'ba1', 'ba2',
			'ba3',
			'be1', 'be2', 'be3', 'test 2', 'end-be3', 'ae3', 'end-be2', 'end-be1', 'ae1', 'ae2',
			'end-ba3',
			'aa3',
			'end-ba2', 'end-ba1', 'aa1', 'aa2',
		]));
	},

	async 'beforeAll error stops execution but still runs teardown'() {
		const invoked = await invoke({ count: 2, error: 1, skip: 2, pass: 0 }, (g, tag) => {
			g.beforeAll(() => { throw new Error(); });
			g.beforeAll(() => { tag('ba3'); return () => tag('end-ba3'); });

			g.test('test 1', () => tag('test 1'));
			g.test('test 2', () => tag('test 2'));
		});

		expect(invoked, equals([
			'ba1', 'ba2',
			'end-ba2', 'end-ba1', 'aa1', 'aa2',
		]));
	},

	async 'beforeAll assumption failure stops execution but still runs teardown'() {
		const invoked = await invoke({ count: 2, skip: 2, pass: 0 }, (g, tag) => {
			g.beforeAll(() => { throw new TestAssumptionError(); });
			g.beforeAll(() => { tag('ba3'); return () => tag('end-ba3'); });

			g.test('test 1', () => tag('test 1'));
			g.test('test 2', () => tag('test 2'));
		});

		expect(invoked, equals([
			'ba1', 'ba2',
			'end-ba2', 'end-ba1', 'aa1', 'aa2',
		]));
	},

	async 'beforeEach error stops execution but still runs teardown'() {
		const invoked = await invoke({ count: 2, error: 2, pass: 0 }, (g, tag) => {
			g.beforeEach(() => { throw new Error(); });
			g.beforeEach(() => { tag('be3'); return () => tag('end-be3'); });

			g.test('test 1', () => tag('test 1'));
			g.test('test 2', () => tag('test 2'));
		});

		expect(invoked, equals([
			'ba1', 'ba2',
			'be1', 'be2', 'end-be2', 'end-be1', 'ae1', 'ae2',
			'be1', 'be2', 'end-be2', 'end-be1', 'ae1', 'ae2',
			'end-ba2', 'end-ba1', 'aa1', 'aa2',
		]));
	},

	async 'beforeEach assumption failure stops execution but still runs teardown'() {
		const invoked = await invoke({ count: 2, skip: 2, pass: 0 }, (g, tag) => {
			g.beforeEach(() => { throw new TestAssumptionError(); });
			g.beforeEach(() => { tag('be3'); return () => tag('end-be3'); });

			g.test('test 1', () => tag('test 1'));
			g.test('test 2', () => tag('test 2'));
		});

		expect(invoked, equals([
			'ba1', 'ba2',
			'be1', 'be2', 'end-be2', 'end-be1', 'ae1', 'ae2',
			'be1', 'be2', 'end-be2', 'end-be1', 'ae1', 'ae2',
			'end-ba2', 'end-ba1', 'aa1', 'aa2',
		]));
	},

	async 'afterEach error runs full teardown'() {
		const invoked = await invoke({ count: 2, error: 2, pass: 0 }, (g, tag) => {
			g.afterEach(() => { throw new Error(); });
			g.afterEach(() => tag('ae3'));

			g.test('test 1', () => tag('test 1'));
			g.test('test 2', () => tag('test 2'));
		});

		expect(invoked, equals([
			'ba1', 'ba2',
			'be1', 'be2', 'test 1', 'end-be2', 'end-be1', 'ae1', 'ae2', 'ae3',
			'be1', 'be2', 'test 2', 'end-be2', 'end-be1', 'ae1', 'ae2', 'ae3',
			'end-ba2', 'end-ba1', 'aa1', 'aa2',
		]));
	},

	async 'afterEach assumption failure is ignored'() {
		const invoked = await invoke({ count: 2, pass: 2, skip: 0 }, (g, tag) => {
			g.afterEach(() => { throw new TestAssumptionError(); });
			g.afterEach(() => tag('ae3'));

			g.test('test 1', () => tag('test 1'));
			g.test('test 2', () => tag('test 2'));
		});

		expect(invoked, equals([
			'ba1', 'ba2',
			'be1', 'be2', 'test 1', 'end-be2', 'end-be1', 'ae1', 'ae2', 'ae3',
			'be1', 'be2', 'test 2', 'end-be2', 'end-be1', 'ae1', 'ae2', 'ae3',
			'end-ba2', 'end-ba1', 'aa1', 'aa2',
		]));
	},

	async 'afterAll error runs full teardown'() {
		const invoked = await invoke({ count: 2, error: 1, pass: 2 }, (g, tag) => {
			g.afterAll(() => { throw new Error(); });
			g.afterAll(() => tag('aa3'));

			g.test('test 1', () => tag('test 1'));
			g.test('test 2', () => tag('test 2'));
		});

		expect(invoked, equals([
			'ba1', 'ba2',
			'be1', 'be2', 'test 1', 'end-be2', 'end-be1', 'ae1', 'ae2',
			'be1', 'be2', 'test 2', 'end-be2', 'end-be1', 'ae1', 'ae2',
			'end-ba2', 'end-ba1', 'aa1', 'aa2', 'aa3',
		]));
	},

	async 'afterAll assumption failure is ignored'() {
		const invoked = await invoke({ count: 2, pass: 2, skip: 0 }, (g, tag) => {
			g.afterAll(() => { throw new TestAssumptionError(); });
			g.afterAll(() => tag('aa3'));

			g.test('test 1', () => tag('test 1'));
			g.test('test 2', () => tag('test 2'));
		});

		expect(invoked, equals([
			'ba1', 'ba2',
			'be1', 'be2', 'test 1', 'end-be2', 'end-be1', 'ae1', 'ae2',
			'be1', 'be2', 'test 2', 'end-be2', 'end-be1', 'ae1', 'ae2',
			'end-ba2', 'end-ba1', 'aa1', 'aa2', 'aa3',
		]));
	},

	async 'retried tests re-run "each" lifecycle hooks but not "all"'() {
		let attempts = 0;
		const invoked = await invoke({ count: 1, error: 1 }, (g, tag) => {
			g.test('test 1', () => {
				++attempts;
				tag(`test 1 attempt ${attempts}`);
				throw new Error();
			}, { retry: 3 });
		});

		expect(invoked, equals([
			'ba1', 'ba2',
			'be1', 'be2', 'test 1 attempt 1', 'end-be2', 'end-be1', 'ae1', 'ae2',
			'be1', 'be2', 'test 1 attempt 2', 'end-be2', 'end-be1', 'ae1', 'ae2',
			'be1', 'be2', 'test 1 attempt 3', 'end-be2', 'end-be1', 'ae1', 'ae2',
			'end-ba2', 'end-ba1', 'aa1', 'aa2',
		]));
	},
});

async function invoke(expectedResults, block) {
	const invoked = [];
	const tag = (label) => invoked.push(label);

	await testRunner(PLUGINS, expectedResults, (g) => {
		g.beforeAll(() => { tag('ba1'); return () => tag('end-ba1'); });
		g.beforeAll(() => { tag('ba2'); return () => tag('end-ba2'); });
		g.beforeEach(() => { tag('be1'); return () => tag('end-be1'); });
		g.beforeEach(() => { tag('be2'); return () => tag('end-be2'); });
		g.afterEach(() => tag('ae1'));
		g.afterEach(() => tag('ae2'));
		g.afterAll(() => tag('aa1'));
		g.afterAll(() => tag('aa2'));

		block(g, tag);
	});

	return invoked;
}
