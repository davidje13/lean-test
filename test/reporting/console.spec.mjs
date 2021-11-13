describe('console', () => {
	test('hidden if successful', () => {
		console.log('should not be seen');
		process.stdout.write('also not seen\n');
		process.stderr.write('nor this\n');
	});

	test('displayed if unsuccessful', () => {
		console.log('should be seen');
		process.stdout.write('also seen\n');
		process.stderr.write('and this\n');
		fail('oops');
	});
});
