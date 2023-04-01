import foo from './imported.mjs';

test('runs tests and records success', () => {
	expect(foo, equals(5));
});

test('shows error locations', () => {
	assume(globalThis, hasProperty('process')); // currently only supported in Node runner
	expect(new Error().stack, contains('mytest.spec.mjs:9'));
});
