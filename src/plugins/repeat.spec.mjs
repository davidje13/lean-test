import testRunner from '../test-helpers/testRunner.mjs';
import describePlugin from './describe.mjs';
import ignorePlugin from './ignore.mjs';
import repeat from './repeat.mjs';

describe('repeat test', {
	async 'repeats tests'() {
		let runs = 0;
		await testRunner([repeat()], { count: 1, pass: 1 }, (g) => {
			g.test('test 1', () => {
				++runs;
			}, { repeat: 3 });
		});

		expect(runs, equals(3));
	},

	async 'does not repeat after a failing test'() {
		let runs = 0;
		await testRunner([repeat()], { count: 1, error: 1 }, (g) => {
			g.test('test 1', () => {
				++runs;
				throw new Error();
			}, { repeat: 3 });
		});

		expect(runs, equals(1));
	},

	async 'can be configured to allow some failures'() {
		let runs = 0;
		await testRunner([repeat()], { count: 1, error: 1 }, (g) => {
			g.test('test 1', () => {
				++runs;
				throw new Error();
			}, { repeat: { total: 3, maxFailures: 1 } });
		});

		expect(runs, equals(2));
	},

	async 'can be configured to run all repetitions even if it cannot pass'() {
		let runs = 0;
		await testRunner([repeat()], { count: 1, error: 1 }, (g) => {
			g.test('test 1', () => {
				++runs;
				throw new Error();
			}, { repeat: { total: 3, failFast: false } });
		});

		expect(runs, equals(3));
	},
});

describe('repeat block', {
	async 'repeats whole block'() {
		let runs = [];
		await testRunner([repeat(), describePlugin(), ignorePlugin()], { count: 3, pass: 2, skip: 1 }, (g) => {
			g.describe('block', () => {
				g.test('test 1', () => runs.push('test 1'));
				g.test('test 2', () => runs.push('test 2'));
				g.test.ignore('test 3', () => runs.push('test 3'));
			}, { repeat: 3 });
		});

		expect(runs, equals(['test 1', 'test 2', 'test 1', 'test 2', 'test 1', 'test 2']));
	},

	async 'does not repeat after a failing test'() {
		let runs = [];
		await testRunner([repeat(), describePlugin(), ignorePlugin()], { count: 2, pass: 1, error: 1 }, (g) => {
			g.describe('block', () => {
				g.test('test 1', () => { runs.push('test 1'); throw new Error(); });
				g.test('test 2', () => runs.push('test 2'));
			}, { repeat: 3 });
		});

		expect(runs, equals(['test 1', 'test 2']));
	},

	async 'can be configured to allow some failures'() {
		let runs = [];
		await testRunner([repeat(), describePlugin(), ignorePlugin()], { count: 2, pass: 1, error: 1 }, (g) => {
			g.describe('block', () => {
				g.test('test 1', () => { runs.push('test 1'); throw new Error(); });
				g.test('test 2', () => runs.push('test 2'));
			}, { repeat: { total: 3, maxFailures: 1 } });
		});

		expect(runs, equals(['test 1', 'test 2', 'test 1', 'test 2']));
	},

	async 'can be configured to run all repetitions even if it cannot pass'() {
		let runs = [];
		await testRunner([repeat(), describePlugin(), ignorePlugin()], { count: 2, pass: 1, error: 1 }, (g) => {
			g.describe('block', () => {
				g.test('test 1', () => { runs.push('test 1'); throw new Error(); });
				g.test('test 2', () => runs.push('test 2'));
			}, { repeat: { total: 3, failFast: false } });
		});

		expect(runs, equals(['test 1', 'test 2', 'test 1', 'test 2', 'test 1', 'test 2']));
	},

	async 'reports the best failing run'() {
		let runs = [];
		await testRunner([repeat(), describePlugin(), ignorePlugin()], { count: 2, pass: 1, error: 1 }, (g) => {
			g.describe('block', () => {
				g.test('test 1', () => {
					runs.push('test 1');
					if (runs.length < 4) {
						throw new Error();
					}
				});
				g.test('test 2', () => {
					runs.push('test 2');
					if (runs.length < 4) {
						throw new Error();
					}
				});
			}, { repeat: { total: 3, failFast: false } });
		});

		expect(runs, equals(['test 1', 'test 2', 'test 1', 'test 2', 'test 1', 'test 2']));
	},
});
