let attempt = 0;
test('reports individual runs', () => {
	++attempt;
	if (attempt < 2) {
		fail('expected failure');
	}
}, { repeat: { total: 3, failFast: false } });
