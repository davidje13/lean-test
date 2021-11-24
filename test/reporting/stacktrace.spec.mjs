const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

describe('stack traces', () => {
	test('error', () => {
		throw new Error('nope');
	});

	test('multiline error', () => {
		throw new Error('nope\nnewline');
	});

	test('fail', () => {
		fail('nope');
	});

	test('expect matcher', () => {
		expect(1, equals(2));
	});

	test('expect fluent', () => {
		expect(1).equals(2);
	});

	test('expect lambda matcher', () => {
		expect(() => 7, resolves(8));
	});

	test('expect lambda fluent', () => {
		expect(() => 7).resolves(8);
	});

	test('user-space function call', () => {
		function foobar() {
			fail('inside');
		}
		foobar();
	});

	test('async 1', async () => {
		expect(1, equals(2));
	});

	test('async 2', async () => {
		await Promise.resolve();
		expect(1, equals(2));
	});

	test('async 3', async () => {
		await Promise.resolve();
		await Promise.resolve();
		expect(1, equals(2));
	});

	test('async fn', async () => {
		async function foobar() {
			await Promise.resolve();
			fail('inside');
		}
		await Promise.resolve();
		await foobar();
	});

	test('timeout', async () => {
		await sleep(1000);
	}, { timeout: 10 });
});
