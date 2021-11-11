test('reports individual runs', () => {
	fail('expected failure');
}, { retry: 3 });

let test2Attempt = 0;
test('aggregates on the final run', () => {
	++test2Attempt;
	if (test2Attempt < 2) {
		fail('expected failure');
	}
}, { retry: 3 });
