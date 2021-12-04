test('changing URL is detected and reported', async () => {
	window.location.href = '/foobar';
	await new Promise(() => {}); // avoid test completing immediately
});
