export default (c) => c.describe('function-type definition', () => {
	c.test('is discovered and has globals passed in', () => {
		c.expect('abc', c.equals('abc'));
	});
});
