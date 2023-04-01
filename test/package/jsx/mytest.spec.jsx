/* @jsx React.createElement */

const React = {
	createElement: () => null,
};

test('uses transpiled JSX', () => {
	mock(React, 'createElement').returning(7);

	const o = (<div>hello</div>);
	expect(o).equals(7);
	expect(React.createElement).hasBeenCalledWith('div', null, 'hello');
});

test('uses sourcemaps to show original error locations', () => {
	assume(globalThis, hasProperty('process')); // currently only supported in Node runner
	expect(new Error().stack, contains('mytest.spec.jsx:17'));
});
