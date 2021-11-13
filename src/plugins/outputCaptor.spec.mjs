import testRunner from '../test-helpers/testRunner.mjs';
import sleep from '../test-helpers/sleep.mjs';
import describePlugin from './describe.mjs';
import outputCaptor from './outputCaptor.mjs';

describe('outputCaptor', {
	async 'captures process output, preventing it being printed'() {
		const result = await testRunner([outputCaptor()], { pass: 1 }, (g) => {
			g.test('test 1', () => {
				console.log('hidden');
			});
		});

		const suiteResult = result.children[0];
		const testResult = suiteResult.children[0];
		expect(testResult.getOutput(), equals('hidden\n'));
	},

	async 'captures multiple parallel test runs separately'() {
		const result = await testRunner([outputCaptor(), describePlugin()], { pass: 2 }, (g) => {
			g.describe('parallel', () => {
				g.test('test 1', async () => {
					console.log('t1a');
					await sleep(10);
					console.log('t1b');
				});

				g.test('test 2', async () => {
					console.log('t2a');
					await sleep(10);
					console.log('t2b');
				});
			}, { parallel: true });
		});

		const suiteResult = result.children[0];
		const blockResult = suiteResult.children[0];
		const test1Result = blockResult.children[0];
		const test2Result = blockResult.children[1];
		expect(test1Result.getOutput(), equals('t1a\nt1b\n'));
		expect(test2Result.getOutput(), equals('t2a\nt2b\n'));
	},

	async 'makes current stdout available to the test'() {
		await testRunner([outputCaptor()], { pass: 1 }, (g) => {
			g.test('test 1', async () => {
				process.stdout.write('out included\n');
				process.stderr.write('err not included\n');
				process.stdout.write('still included\n');
				const output = g.getStdout();
				if (output !== 'out included\nstill included\n') {
					throw new Error();
				}
			});
		});
	},

	async 'makes current stderr available to the test'() {
		await testRunner([outputCaptor()], { pass: 1 }, (g) => {
			g.test('test 1', async () => {
				process.stdout.write('out not included\n');
				process.stderr.write('err included\n');
				process.stderr.write('still included\n');
				const output = g.getStderr();
				if (output !== 'err included\nstill included\n') {
					throw new Error();
				}
			});
		});
	},
});
