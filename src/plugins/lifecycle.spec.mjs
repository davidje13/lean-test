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
		const invoked = await invokeWithCommonTags({ pass: 2 }, (g, tag) => {
			g.test('test 1', () => tag('test 1'));
			g.test('test 2', () => tag('test 2'));
		});

		expect(invoked, equals([
			'ba1', 'ba2',
			'be1', 'be2', 'test 1', 'ae1', 'ae2', 'end-be2', 'end-be1',
			'be1', 'be2', 'test 2', 'ae1', 'ae2', 'end-be2', 'end-be1',
			'aa1', 'aa2', 'end-ba2', 'end-ba1',
		]));
	},

	async 'nested methods are called outer-most to inner-most'() {
		const invoked = await invokeWithCommonTags({ pass: 3 }, (g, tag) => {
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
			'be1', 'be2', 'be3', 'test 1', 'ae3', 'end-be3', 'ae1', 'ae2', 'end-be2', 'end-be1',
			'be1', 'be2', 'be3', 'test 2', 'ae3', 'end-be3', 'ae1', 'ae2', 'end-be2', 'end-be1',
			'aa3',
			'end-ba3',
			'be1', 'be2', 'test 3', 'ae1', 'ae2', 'end-be2', 'end-be1',
			'aa1', 'aa2', 'end-ba2', 'end-ba1',
		]));
	},

	async 'failing tests run all lifecycle methods'() {
		const invoked = await invokeWithCommonTags({ count: 2, pass: 1, error: 1 }, (g, tag) => {
			g.test('test 1', () => { tag('test 1'); throw new Error() });
			g.test('test 2', () => tag('test 2'));
		});

		expect(invoked, equals([
			'ba1', 'ba2',
			'be1', 'be2', 'test 1', 'ae1', 'ae2', 'end-be2', 'end-be1',
			'be1', 'be2', 'test 2', 'ae1', 'ae2', 'end-be2', 'end-be1',
			'aa1', 'aa2', 'end-ba2', 'end-ba1',
		]));
	},

	async 'skipped tests avoid lifecycle methods'() {
		const invoked = await invokeWithCommonTags({ count: 3, pass: 1, skip: 2 }, (g, tag) => {
			g.test.ignore('test 1', () => tag('test 1'));
			g.test('test 2', () => { tag('test 2'); throw new TestAssumptionError() });
			g.test('test 3', () => tag('test 3'));
		});

		expect(invoked, equals([
			'ba1', 'ba2',
			'be1', 'be2', 'test 2', 'ae1', 'ae2', 'end-be2', 'end-be1',
			'be1', 'be2', 'test 3', 'ae1', 'ae2', 'end-be2', 'end-be1',
			'aa1', 'aa2', 'end-ba2', 'end-ba1',
		]));
	},

	async 'unfocused tests avoid lifecycle methods'() {
		const invoked = await invokeWithCommonTags({ count: 4, pass: 1, skip: 3 }, (g, tag) => {
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
			'be1', 'be2', 'be3', 'test 2', 'ae3', 'end-be3', 'ae1', 'ae2', 'end-be2', 'end-be1',
			'aa3',
			'end-ba3',
			'aa1', 'aa2', 'end-ba2', 'end-ba1',
		]));
	},

	async 'beforeAll error stops execution but still runs teardown'() {
		const invoked = await invokeWithCommonTags({ count: 2, error: 1, skip: 2, pass: 0 }, (g, tag) => {
			g.beforeAll(() => { throw new Error(); });
			g.beforeAll(() => { tag('ba3'); return () => tag('end-ba3'); });

			g.test('test 1', () => tag('test 1'));
			g.test('test 2', () => tag('test 2'));
		});

		expect(invoked, equals([
			'ba1', 'ba2',
			'aa1', 'aa2', 'end-ba2', 'end-ba1',
		]));
	},

	async 'beforeAll assumption failure stops execution but still runs teardown'() {
		const invoked = await invokeWithCommonTags({ count: 2, skip: 2, pass: 0 }, (g, tag) => {
			g.beforeAll(() => { throw new TestAssumptionError(); });
			g.beforeAll(() => { tag('ba3'); return () => tag('end-ba3'); });

			g.test('test 1', () => tag('test 1'));
			g.test('test 2', () => tag('test 2'));
		});

		expect(invoked, equals([
			'ba1', 'ba2',
			'aa1', 'aa2', 'end-ba2', 'end-ba1',
		]));
	},

	async 'beforeEach error stops execution but still runs teardown'() {
		const invoked = await invokeWithCommonTags({ count: 2, error: 2, pass: 0 }, (g, tag) => {
			g.beforeEach(() => { throw new Error(); });
			g.beforeEach(() => { tag('be3'); return () => tag('end-be3'); });

			g.test('test 1', () => tag('test 1'));
			g.test('test 2', () => tag('test 2'));
		});

		expect(invoked, equals([
			'ba1', 'ba2',
			'be1', 'be2', 'ae1', 'ae2', 'end-be2', 'end-be1',
			'be1', 'be2', 'ae1', 'ae2', 'end-be2', 'end-be1',
			'aa1', 'aa2', 'end-ba2', 'end-ba1',
		]));
	},

	async 'beforeEach assumption failure stops execution but still runs teardown'() {
		const invoked = await invokeWithCommonTags({ count: 2, skip: 2, pass: 0 }, (g, tag) => {
			g.beforeEach(() => { throw new TestAssumptionError(); });
			g.beforeEach(() => { tag('be3'); return () => tag('end-be3'); });

			g.test('test 1', () => tag('test 1'));
			g.test('test 2', () => tag('test 2'));
		});

		expect(invoked, equals([
			'ba1', 'ba2',
			'be1', 'be2', 'ae1', 'ae2', 'end-be2', 'end-be1',
			'be1', 'be2', 'ae1', 'ae2', 'end-be2', 'end-be1',
			'aa1', 'aa2', 'end-ba2', 'end-ba1',
		]));
	},

	async 'afterEach error runs full teardown'() {
		const invoked = await invokeWithCommonTags({ count: 2, error: 2, pass: 0 }, (g, tag) => {
			g.afterEach(() => { throw new Error(); });
			g.afterEach(() => tag('ae3'));

			g.test('test 1', () => tag('test 1'));
			g.test('test 2', () => tag('test 2'));
		});

		expect(invoked, equals([
			'ba1', 'ba2',
			'be1', 'be2', 'test 1', 'ae1', 'ae2', 'ae3', 'end-be2', 'end-be1',
			'be1', 'be2', 'test 2', 'ae1', 'ae2', 'ae3', 'end-be2', 'end-be1',
			'aa1', 'aa2', 'end-ba2', 'end-ba1',
		]));
	},

	async 'afterEach assumption failure is ignored'() {
		const invoked = await invokeWithCommonTags({ count: 2, pass: 2, skip: 0 }, (g, tag) => {
			g.afterEach(() => { throw new TestAssumptionError(); });
			g.afterEach(() => tag('ae3'));

			g.test('test 1', () => tag('test 1'));
			g.test('test 2', () => tag('test 2'));
		});

		expect(invoked, equals([
			'ba1', 'ba2',
			'be1', 'be2', 'test 1', 'ae1', 'ae2', 'ae3', 'end-be2', 'end-be1',
			'be1', 'be2', 'test 2', 'ae1', 'ae2', 'ae3', 'end-be2', 'end-be1',
			'aa1', 'aa2', 'end-ba2', 'end-ba1',
		]));
	},

	async 'afterAll error runs full teardown'() {
		const invoked = await invokeWithCommonTags({ count: 2, error: 1, pass: 2 }, (g, tag) => {
			g.afterAll(() => { throw new Error(); });
			g.afterAll(() => tag('aa3'));

			g.test('test 1', () => tag('test 1'));
			g.test('test 2', () => tag('test 2'));
		});

		expect(invoked, equals([
			'ba1', 'ba2',
			'be1', 'be2', 'test 1', 'ae1', 'ae2', 'end-be2', 'end-be1',
			'be1', 'be2', 'test 2', 'ae1', 'ae2', 'end-be2', 'end-be1',
			'aa1', 'aa2', 'aa3', 'end-ba2', 'end-ba1',
		]));
	},

	async 'afterAll assumption failure is ignored'() {
		const invoked = await invokeWithCommonTags({ count: 2, pass: 2, skip: 0 }, (g, tag) => {
			g.afterAll(() => { throw new TestAssumptionError(); });
			g.afterAll(() => tag('aa3'));

			g.test('test 1', () => tag('test 1'));
			g.test('test 2', () => tag('test 2'));
		});

		expect(invoked, equals([
			'ba1', 'ba2',
			'be1', 'be2', 'test 1', 'ae1', 'ae2', 'end-be2', 'end-be1',
			'be1', 'be2', 'test 2', 'ae1', 'ae2', 'end-be2', 'end-be1',
			'aa1', 'aa2', 'aa3', 'end-ba2', 'end-ba1',
		]));
	},

	async 'retried tests re-run "each" lifecycle hooks but not "all"'() {
		let attempts = 0;
		const invoked = await invokeWithCommonTags({ count: 1, error: 1 }, (g, tag) => {
			g.test('test 1', () => {
				++attempts;
				tag(`test 1 attempt ${attempts}`);
				throw new Error();
			}, { retry: 3 });
		});

		expect(invoked, equals([
			'ba1', 'ba2',
			'be1', 'be2', 'test 1 attempt 1', 'ae1', 'ae2', 'end-be2', 'end-be1',
			'be1', 'be2', 'test 1 attempt 2', 'ae1', 'ae2', 'end-be2', 'end-be1',
			'be1', 'be2', 'test 1 attempt 3', 'ae1', 'ae2', 'end-be2', 'end-be1',
			'aa1', 'aa2', 'end-ba2', 'end-ba1',
		]));
	},

	'testPath': {
		async 'returns the path as an array of text labels'() {
			const invoked = await invoke({ pass: 3 }, (g, tag) => {
				g.beforeAll('ba1', ({ testPath }) => tag(`ba1 ${testPath.join(':')}`));
				g.beforeEach('be1', ({ testPath }) => tag(`be1 ${testPath.join(':')}`));
				g.afterEach('ae1', ({ testPath }) => tag(`ae1 ${testPath.join(':')}`));
				g.afterAll('aa1', ({ testPath }) => tag(`aa1 ${testPath.join(':')}`));

				g.describe('inner', () => {
					g.beforeAll('ba2', ({ testPath }) => tag(`ba2 ${testPath.join(':')}`));
					g.beforeEach('be2', ({ testPath }) => tag(`be2 ${testPath.join(':')}`));
					g.afterEach('ae2', ({ testPath }) => tag(`ae2 ${testPath.join(':')}`));
					g.afterAll('aa2', ({ testPath }) => tag(`aa2 ${testPath.join(':')}`));

					g.test('test-1', () => tag('test 1'));
					g.test('test-2', () => tag('test 2'));
				});

				g.test('test-3', () => tag('test 3'));
			});

			expect(invoked, equals([
				'ba1 test',
				'ba2 test:inner',
				'be1 test:inner:test-1', 'be2 test:inner:test-1', 'test 1', 'ae2 test:inner:test-1', 'ae1 test:inner:test-1',
				'be1 test:inner:test-2', 'be2 test:inner:test-2', 'test 2', 'ae2 test:inner:test-2', 'ae1 test:inner:test-2',
				'aa2 test:inner',
				'be1 test:test-3', 'test 3', 'ae1 test:test-3',
				'aa1 test',
			]));
		},
	},

	'addTestParameter': {
		async 'adds a parameter available to all wrapped tests'() {
			let count = 0;
			const invoked = await invoke({ pass: 3 }, (g, tag) => {
				g.describe('inner', () => {
					g.beforeEach(({ addTestParameter }) => {
						addTestParameter(count);
						++count;
					});

					tagWithArgs(g, tag, 'test 1');
					tagWithArgs(g, tag, 'test 2');
				});

				tagWithArgs(g, tag, 'test 3');
			});

			expect(invoked, equals([
				'test 1: [0]',
				'test 2: [1]',
				'test 3: []',
			]));
		},

		async 'added parameters stack'() {
			let count = 0;
			const invoked = await invoke({ pass: 3 }, (g, tag) => {
				g.beforeAll(({ addTestParameter }) => {
					addTestParameter(count);
					++count;
				});

				g.beforeEach(({ addTestParameter }) => {
					addTestParameter('a');
				});

				g.describe('inner', () => {
					g.beforeEach(({ addTestParameter }) => {
						addTestParameter(count);
						++count;
					});

					g.beforeEach(({ addTestParameter }) => {
						addTestParameter('b');
						addTestParameter('c');
					});

					tagWithArgs(g, tag, 'test 1');
					tagWithArgs(g, tag, 'test 2');
				});

				tagWithArgs(g, tag, 'test 3');
			});

			expect(invoked, equals([
				'test 1: [0, a, 1, b, c]',
				'test 2: [0, a, 2, b, c]',
				'test 3: [0, a]',
			]));
		},
	},

	'setParameter': {
		async 'assigns a named parameter to all wrapped tests'() {
			let count = 0;
			const invoked = await invoke({ pass: 3 }, (g, tag) => {
				g.describe('inner', () => {
					const PARAM = g.beforeEach(({ setParameter }) => {
						setParameter(count);
						++count;
					});

					g.test('test 1', ({ [PARAM]: p }) => tag(`test 1: [${p}]`));
					g.test('test 2', (params) => tag(`test 2: [${params.getTyped(PARAM)}]`));
				});

				g.test('test 3', (c) => tag(`test 3: [${c}]`));
			});

			expect(invoked, equals([
				'test 1: [0]',
				'test 2: [1]',
				'test 3: [undefined]',
			]));
		},

		async 'becomes available to subsequent lifecycle hooks'() {
			const invoked = await invoke({ pass: 1 }, (g, tag) => {
				g.describe('inner', () => {
					const PARAM1 = g.beforeAll(({ setParameter }) => {
						setParameter(5);
					});
					const PARAM2 = g.beforeEach(({ getTyped, setParameter }) => {
						setParameter(getTyped(PARAM1) * 2);
					});
					const PARAM3 = g.beforeEach(({ [PARAM1]: p1, [PARAM2]: p2, setParameter }) => {
						setParameter(p1 + p2);
					});

					g.test('test 1', ({ [PARAM3]: p3 }) => tag(`test 1: [${p3}]`));
				});
			});

			expect(invoked, equals([
				'test 1: [15]',
			]));
		},

		async 'named parameters always appear first'() {
			const invoked = await invoke({ pass: 1 }, (g, tag) => {
				const PARAM = g.beforeEach(({ setParameter, addTestParameter }) => {
					addTestParameter('second');
					setParameter('first');
				});

				g.test('test 1', ({ [PARAM]: p1 }, p2) => tag(`test 1: [${p1},${p2}]`));
			});

			expect(invoked, equals([
				'test 1: [first,second]',
			]));
		},
	},
});

function tagWithArgs(g, tag, name) {
	g.test(name, (...args) => tag(`${name}: [${args.join(', ')}]`));
}

async function invoke(expectedResults, block) {
	const invoked = [];
	const tag = (label) => invoked.push(label);
	await testRunner(PLUGINS, expectedResults, (g) => block(g, tag));
	return invoked;
}

async function invokeWithCommonTags(expectedResults, block) {
	return invoke(expectedResults, (g, tag) => {
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
}
