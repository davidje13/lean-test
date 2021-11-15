test('runs in the browser', () => {
	const o = document.createElement('div');
	o.appendChild(document.createTextNode('he'));
	o.appendChild(document.createTextNode('llo'));
	expect(o.innerText, equals('hello'));
});

describe('console', () => {
	test('hidden if successful', () => {
		console.log('should not be seen');
	});

	test('displayed if unsuccessful', () => {
		console.log('should be seen');
		fail('oops');
	});
});
