test('uses rollup plugins', () => {
	expect('replace-me').equals('!replaced!');
});

test('uses sourcemaps to show original error locations', () => {
	assume(globalThis, hasProperty('process')); // currently only supported in Node runner
	expect(new Error().stack, contains('mytest.spec.js:7'));
});
