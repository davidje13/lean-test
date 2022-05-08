import testRunner from '../test-helpers/testRunner.mjs';
import parameterised from './parameterised.mjs';

describe('parameterised', {
	async 'invokes the test with multiple parameters'() {
		const captured = [];
		await testRunner([parameterised()], { count: 3, pass: 3 }, (g) => {
			g.test('test 1', (...args) => {
				captured.push(args);
			}, { parameters: ['a', 'b', 'c'] });
		});

		expect(captured, equals([['a'], ['b'], ['c']]));
	},

	async 'accepts parameter vectors'() {
		const captured = [];
		await testRunner([parameterised()], { count: 3, pass: 3 }, (g) => {
			g.test('test 1', (...args) => {
				captured.push(args);
			}, { parameters: [['a', 1], ['b', 2], ['c', 3]] });
		});

		expect(captured, equals([['a', 1], ['b', 2], ['c', 3]]));
	},

	async 'accepts parameter matrices'() {
		const captured = [];
		await testRunner([parameterised()], { count: 9, pass: 9 }, (g) => {
			g.test('test 1', (...args) => {
				captured.push(args);
			}, { parameters: [new Set(['a', 'b', 'c']), new Set([1, 2, 3])] });
		});

		expect(captured, equals([
			['a', 1], ['a', 2], ['a', 3],
			['b', 1], ['b', 2], ['b', 3],
			['c', 1], ['c', 2], ['c', 3],
		]));
	},

	async 'accepts parameter matrices with vectors'() {
		const captured = [];
		await testRunner([parameterised()], { count: 9, pass: 9 }, (g) => {
			g.test('test 1', (...args) => {
				captured.push(args);
			}, { parameters: [new Set([['a', 'A'], ['b', 'B'], ['c', 'C']]), new Set([1, 2, 3])] });
		});

		expect(captured, equals([
			['a', 'A', 1], ['a', 'A', 2], ['a', 'A', 3],
			['b', 'B', 1], ['b', 'B', 2], ['b', 'B', 3],
			['c', 'C', 1], ['c', 'C', 2], ['c', 'C', 3],
		]));
	},

	async 'parameterFilter filters generated parameters'() {
		const captured = [];
		await testRunner([parameterised()], { count: 6, pass: 6 }, (g) => {
			g.test('test 1', (...args) => {
				captured.push(args);
			}, {
				parameters: [new Set([1, 2, 3]), new Set([1, 2, 3])],
				parameterFilter: (a, b) => (a !== b),
			});
		});

		expect(captured, equals([
			[1, 2], [1, 3],
			[2, 1], [2, 3],
			[3, 1], [3, 2],
		]));
	},

	async 'rejects invalid values'() {
		await testRunner([parameterised()], { count: 0, error: 1 }, (g) => {
			g.test('test 1', () => {}, { parameters: 1 });
		});
	},
});
