test('runs multiple times', (x) => {
}, { parameters: ['a', 'b'] });

test('multiple parameters', (x, y) => {
}, { parameters: [['a', 1], ['b', 2]] });

test('named parameters', (x, y) => {
}, { parameters: [{ name: 'first', v: 1 }, { name: 'second', v: 2 }] });

test('matrix parameters', (x, y) => {
}, { parameters: [new Set(['a', 'b']), new Set([1, 2])] });

test('multiple matrix parameters', (x, y, z) => {
}, { parameters: [new Set([['a', 1], ['b', 2]]), new Set([true, false])] });
