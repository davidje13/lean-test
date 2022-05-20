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
