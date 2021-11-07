const sleep = (delay, result) => new Promise((resolve) => setTimeout(() => resolve(result), delay));

describe('async', () => {
	test('waits for async tests to complete', async () => {
		await sleep(5);
	});

	describe('allows async describe blocks', async () => {
		test('test1', () => {});

		await sleep(5);

		test('test2', () => {});
	});

	describe('does not leak async definitions to next block', async () => {
		test('test3', () => {});
	});
});
