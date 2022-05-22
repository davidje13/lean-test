import testRunner from '../test-helpers/testRunner.mjs';
import sleep from '../test-helpers/sleep.mjs';
import describePlugin from './describe.mjs';

describe('describe', {
	async 'discovers all contained tests'() {
		await testRunner([describePlugin()], { count: 3, pass: 3 }, (g) => {
			g.describe('block', () => {
				g.test('test 1', () => {});
				g.test('test 2', () => {});
				g.describe('block sub', () => {
					g.test('test 3', () => {});
				});
			});
		});
	},

	async 'accepts asynchronous blocks'() {
		await testRunner([describePlugin()], { count: 4, pass: 4 }, (g) => {
			g.describe('block', async () => {
				g.test('test 1', () => {});
				await sleep(5);
				g.test('test 2', () => {});
				g.describe('block sub', () => {
					g.test('test 3', () => {});
					g.describe('block sub sub', async () => {
						await sleep(5);
						g.test('test 4', () => {});
					});
				});
			});
		});
	},

	async 'accepts objects'() {
		await testRunner([describePlugin()], { count: 4, pass: 4 }, (g) => {
			g.describe('block', {
				'test 1'() {},
				'test 2'() {},
				'block sub': {
					'test 3'() {},
					'block sub sub': {
						'test 4'() {},
					},
				},
			});
		});
	},

	async 'records errors thrown during discovery'() {
		await testRunner([describePlugin()], { count: 3, pass: 3, error: 1 }, (g) => {
			g.describe('block', () => {
				g.test('test 1', () => {});
				g.test('test 2', () => {});
				g.describe('block sub', () => {
					g.test('test 3', () => {});
					throw new Error();
				});
			});
		});
	},

	async 'records errors thrown during async discovery'() {
		await testRunner([describePlugin()], { count: 3, pass: 3, error: 1 }, (g) => {
			g.describe('block', () => {
				g.test('test 1', () => {});
				g.test('test 2', () => {});
				g.describe('block sub', async () => {
					g.test('test 3', () => {});
					await sleep(5);
					throw new Error();
				});
			});
		});
	},

	async 'can run tests in parallel'() {
		const invoked = [];
		const simulateSlow = async (label, delay) => {
			invoked.push(`begin ${label}`);
			await sleep(delay);
			invoked.push(`end ${label}`);
		};
		await testRunner([describePlugin()], { count: 4, pass: 4 }, (g) => {
			g.describe('parallel base', () => {
				g.test('test 1', () => simulateSlow('1', 8));
				g.test('test 2', () => simulateSlow('2', 5));
				g.describe('synchronous sub', () => {
					g.test('test 3', () => simulateSlow('3', 5));
					g.test('test 4', () => simulateSlow('4', 5));
				});
			}, { parallel: true });
		});

		expect(invoked, equals(['begin 1', 'begin 2', 'begin 3', 'end 2', 'end 3', 'begin 4', 'end 1', 'end 4']));
	},

	async 'allows swapping test definition and optional config'() {
		const invoked = [];
		const simulateSlow = async (label, delay) => {
			invoked.push(`begin ${label}`);
			await sleep(delay);
			invoked.push(`end ${label}`);
		};
		await testRunner([describePlugin()], { count: 2, pass: 2 }, (g) => {
			g.describe('parallel base', { parallel: true }, () => {
				g.test('test 1', () => simulateSlow('1', 8));
				g.test('test 2', () => simulateSlow('2', 5));
			});
		});

		expect(invoked, equals(['begin 1', 'begin 2', 'end 2', 'end 1']));
	},

	async 'can be configured with multiple names'() {
		await testRunner([describePlugin('foo'), describePlugin('bar')], { count: 3, pass: 3 }, (g) => {
			g.foo('block', () => {
				g.test('test 1', () => {});
				g.test('test 2', () => {});
				g.bar('block sub', () => {
					g.test('test 3', () => {});
				});
			});
		});
	},
}, { parallel: true });
