import 'lean-test';
import foo from './imported';
import bar from './sub';

test('runs typescript tests and records success', () => {
	const x: number = foo;
	const y: (v: number) => number = (x) => x + 1;
	expect(y(x), equals(6));
	expect(bar, equals(3));
});
