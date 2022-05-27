import foo from './imported.mjs';

test('runs tests and records success', () => {
	expect(foo, equals(5));
});
