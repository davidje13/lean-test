test('noise', () => {
	for (let i = 0; i < 10000; ++i) {
		process.stdout.write('blah');
	}
	fail(); // ensure output is printed
});
