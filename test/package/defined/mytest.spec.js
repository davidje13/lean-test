test('uses webpack plugins', () => {
	expect(COMPILER_DEFINED).equals('defined');
});

test('uses sourcemaps to show original error locations', () => {
	assume(globalThis, hasProperty('process')); // currently only supported in Node runner
	expect(new Error().stack, contains('mytest.spec.js:7'));
});
