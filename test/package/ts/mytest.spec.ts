import 'lean-test';
import foo from './imported';
import bar from './sub';

test('runs typescript tests and records success', () => {
	const x: number = foo;
	const y: (v: number) => number = (x) => x + 1;
	expect(y(x), equals(6));
	expect(bar, equals(3));
});

test('uses sourcemaps to show original error locations', () => {
	assume(globalThis, hasProperty('process')); // currently only supported in Node runner
	expect(new Error().stack, contains('mytest.spec.ts:14'));
});
