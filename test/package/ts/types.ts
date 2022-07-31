import 'lean-test';

const FOO = beforeEach<string>(({ setParameter }) => {
	setParameter('hi');
});

beforeEach((params) => {
	const foo = params.getTyped(FOO);
	console.log(foo.substring(0, 1));

	// @ts-expect-error
	console.log(Math.max(foo));
});

test('my test', (params) => {
	const foo = params.getTyped(FOO);
	console.log(foo.substring(0, 1));

	// @ts-expect-error
	console.log(Math.max(foo));
});
