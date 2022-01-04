describe('explicitly commonjs .test import', () => {
	test('is discovered and has globals available', () => {
		expect('abc', equals('abc'));
	});
});
