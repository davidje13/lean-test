import foo from './imported';

test('runs typescript tests and records success', () => {
	const x: number = foo;
	const y: (v: number) => number = (x) => x + 1;
	expect(y(x), equals(6));
});
