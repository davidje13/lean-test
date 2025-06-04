import { describe, it } from '../core/index.mts';
import { cross } from '../extras/params/cross.mts';
import {
	assertMatcherToString,
	assertMatchResult,
} from '../test-utils/assertMatcher.mts';
import {
	allValueFactories,
	primitiveValueFactories,
	standardValueFactories,
	uniqueValueFactories,
} from '../test-utils/valueFactories.mts';
import { equals } from './equals.mts';

describe('equals', () => {
	it('stringifies to code', () => {
		assertMatcherToString(equals('foo'), 'equals("foo")');
		assertMatcherToString(equals(1), 'equals(1)');
		assertMatcherToString(equals({ foo: 'bar' }), 'equals({foo: "bar"})');
	});

	it.with(allValueFactories)(
		'passes for values compared with themself',
		({ parameter: factory }) => {
			const item = factory();
			assertMatchResult(item, equals(item), 'pass');
		},
	);

	it.with(
		cross([allValueFactories, allValueFactories]).filter(
			([factoryA, factoryB]) => factoryA !== factoryB,
		),
	)(
		'fails for values compared with different values',
		({ parameter: [factoryA, factoryB] }) => {
			assertMatchResult(factoryB(), equals(factoryA()), 'fail');
		},
	);

	it.with([...primitiveValueFactories, ...standardValueFactories])(
		'passes for standard values compared with an equivalent copy',
		({ parameter: factory }) => {
			assertMatchResult(factory(), equals(factory()), 'pass');
		},
	);

	it.with(uniqueValueFactories)(
		'fails for unique values compared with an equivalent copy',
		({ parameter: factory }) => {
			assertMatchResult(factory(), equals(factory()), 'fail');
		},
	);

	it('passes for equivalent sets', () => {
		assertMatchResult(new Set(['b', 'a']), equals(new Set(['a', 'b'])), 'pass');
	});

	it('produces nice messages for classes', () => {
		class Foo {}
		class Bar {}
		assertMatchResult(new Bar(), equals(new Foo()), 'fail', 'Bar {} != Foo {}');
	});

	it('produces nice messages for symbols', () => {
		assertMatchResult(
			Symbol('hi'),
			equals(Symbol()),
			'fail',
			'Symbol(hi) != Symbol()',
		);
	});

	it('explains dictionary mismatch', () => {
		assertMatchResult(
			{ bar: 'foo' },
			equals({ foo: 'bar' }),
			'fail',
			'extra "bar" and missing "foo"',
		);
	});

	it('explains Set mismatch', () => {
		assertMatchResult(
			new Set(['b', 'c']),
			equals(new Set(['a', 'b'])),
			'fail',
			'extra "c" and missing "a"',
		);
	});
});

describe('equals with recursion', {
	'considers equivalent recursive structures to be equal'() {
		const a = {} as any;
		a.foo = a;
		const b = {} as any;
		b.foo = b;
		assertMatchResult(b, equals(a), 'pass');
		assertMatchResult(a, equals(b), 'pass');
	},

	'supports branching recursion'() {
		const a = {} as any;
		a.foo = a;
		a.bar = a;
		const b = {} as any;
		b.foo = b;
		b.bar = b;
		assertMatchResult(b, equals(a), 'pass');
	},

	'supports deep nested recursion'() {
		const a = { foo: {} } as any;
		a.foo.bar = a;
		const b = { foo: {} } as any;
		b.foo.bar = b;
		assertMatchResult(b, equals(a), 'pass');
	},

	'rejects mismatched recursion'() {
		const a = { foo: {} } as any;
		a.foo.bar = a;
		const b = {} as any;
		b.foo = b;
		assertMatchResult(b, equals(a), 'fail');
		assertMatchResult(a, equals(b), 'fail');
	},

	'allows differing recursion if equivalent'() {
		const a = { foo: {} } as any;
		a.foo.foo = a;
		const b = {} as any;
		b.foo = b;
		assertMatchResult(b, equals(a), 'pass');
		assertMatchResult(a, equals(b), 'pass');
	},

	'rejects nested mismatched recursion'() {
		const a = { foo: {} } as any;
		a.foo.bar = a;
		const b = { foo: {} } as any;
		b.foo.bar = b.foo;
		assertMatchResult(b, equals(a), 'fail');
		assertMatchResult(a, equals(b), 'fail');
	},

	'supports multiple recursions'() {
		const a = { foo: { i: 1 }, bar: { i: 2 } } as any;
		a.foo.next = a.bar;
		a.bar.prev = a.foo;
		const b = { foo: { i: 1 }, bar: { i: 2 } } as any;
		b.foo.next = b.bar;
		b.bar.prev = b.foo;
		assertMatchResult(b, equals(a), 'pass');
	},

	'rejects multiple recursions if values do not match'() {
		const a = { foo: { i: 1, next: { i: 2 } } } as any;
		a.foo.next.prev = a.foo;
		const b = { foo: { i: 1, next: { i: 3 } } } as any;
		b.foo.next.prev = b.foo;
		assertMatchResult(b, equals(a), 'fail');
	},
});
