test('runs in the browser', () => {
	const o = document.createElement('div');
	o.appendChild(document.createTextNode('he'));
	o.appendChild(document.createTextNode('llo'));
	expect(o.innerText, equals('hello'));
});

test('search and hash default to blank', () => {
	expect(window.location.search, equals(''));
	expect(window.location.hash, equals(''));
});

describe('console', () => {
	test('hidden if successful', () => {
		console.log('should not be seen');
	});

	test('displayed if unsuccessful', () => {
		console.log('should be seen');
		fail('oops');
	});

	test('can be queried', () => {
		console.log('output', 'parts');
		expect(getOutput(), equals('output parts\n'));
	});
});
