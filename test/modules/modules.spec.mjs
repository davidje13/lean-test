import topFoo from 'foo/index.mjs';
import { barFoo, me } from 'bar/index.mjs';

test('imports top-level modules', () => {
	expect(topFoo, equals('foo at top level'));
	expect(me, equals('bar at top level'));
});

test('uses nested modules if specified', () => {
	expect(barFoo, equals('foo inside bar'));
});

test('dynamic import uses module map', async () => {
	const f = await import('foo/index.mjs');
	expect(f.default, equals('foo at top level'));
});
