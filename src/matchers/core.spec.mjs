import { print } from '../utils.mjs';
import * as matchers from './core.mjs';

const primitiveValueFactories = [
	() => +0,
	() => +1,
	() => -0,
	() => -1,
	() => 0 / 0,
	() => 1 / 0,
	() => -1 / 0,
	() => 0.1,
	() => 7,
	() => Math.PI,
	() => 0n,
	() => 10n,
	() => null,
	() => undefined,
	() => true,
	() => false,
	() => 'foo',
	() => '',
	() => '0',
	() => 'NaN',
	() => 'null',
	() => 'undefined',
];

const COMMON_SYMBOL = Symbol('key');

const standardValueFactories = [
	() => ({}),
	() => ({ foo: 'bar' }),
	() => ({ foo: 'zag' }),
	() => ({ foo: 'bar', zig: 'zag' }),
	() => ({ foo: { bar: 'baz' } }),
	() => ({ foo: { bar: 'baz', zig: 'zag' } }),
	() => ({ foo: { zag: 'baz' } }),
	() => ({ foo: { bar: 'zag' } }),
	() => ({ [COMMON_SYMBOL]: 'foo' }),
	() => ({ [COMMON_SYMBOL]: 'bar' }),
	() => ({ 0: 0 }),
	() => ({ 0: 0, length: 1 }),
	() => ({ length: 0, size: 0, foo: 'bar' }),
	() => ({ length: 0 }),
	() => ({ size: 0 }),
	() => [],
	() => [0],
	() => [undefined],
	() => [, undefined],
	() => [0, , ],
	() => new Array(1),
	() => Object.assign([0], { foo: 'bar' }),
	() => Object.assign([0], { 2: 'bar' }),
	() => Object.assign([0], { '-1': 'bar' }),
	() => Object.assign([0], { [COMMON_SYMBOL]: 'a' }),
	() => Object.assign([0], { [COMMON_SYMBOL]: 'b' }),
	() => ['foo'],
	() => ['foo', 'bar'],
	() => ['bar', 'foo'],
	() => /foo/,
	() => /bar/,
	() => /foo/i,
	() => new Date(),
	() => new Date(10),
	() => new Map(),
	() => new Map([['a', 'x']]),
	() => Object.assign(new Map(), { a: 'x' }),
	() => new Map([['b', 'x']]),
	() => new Map([['a', 'y']]),
	() => new Map([['a', 'x'], ['b', 'y']]),
	() => new Map([['a', 'y'], ['b', 'x']]),
	() => new Set(),
	() => new Set(['a']),
	() => new Set(['b']),
	() => new Set(['a', 'b']),
	() => new Error('oops'),
	() => new Error('nope'),
];

const uniqueValueFactories = [
	() => Symbol(),
	() => Symbol('foo'),
	() => ({ [Symbol('unique')]: 'bar' }),
];

const allValueFactories = [
	...primitiveValueFactories,
	...standardValueFactories,
	...uniqueValueFactories,
];

describe('equals', () => {
	it('returns true for values compared with themself', (factory) => {
		const item = factory();
		if (matchers.equals(item)(item).pass !== true) {
			throw new Error('Expected to equal itself, but did not');
		}
	}, { parameters: allValueFactories });

	it('returns false for values compared with different values', (factoryA, factoryB) => {
		const itemA = factoryA();
		const itemB = factoryB();
		if (matchers.equals(itemA)(itemB).pass !== false) {
			throw new Error('Expected not to equal, but did');
		}
	}, { parameters: [new Set(allValueFactories), new Set(allValueFactories)], parameterFilter: (a, b) => (a !== b) });

	it('returns true for standard values compared with an equivalent copy', (factory) => {
		const item = factory();
		if (matchers.equals(item)(factory()).pass !== true) {
			throw new Error('Expected to equal its copy, but did not');
		}
	}, { parameters: [...primitiveValueFactories, ...standardValueFactories] });

	it('returns false for unique values compared with an equivalent copy', (factory) => {
		const item = factory();
		if (matchers.equals(item)(factory()).pass !== false) {
			throw new Error('Expected not to equal its copy, but did');
		}
	}, { parameters: uniqueValueFactories });

	it('returns true for equivalent sets', () => {
		const s1 = new Set(['a', 'b']);
		const s2 = new Set(['b', 'a']);
		const result = matchers.equals(s1)(s2);
		expect(result.pass).isTrue();
	});

	it('produces nice messages for classes', () => {
		class Foo {}
		class Bar {}
		const s1 = new Foo();
		const s2 = new Bar();
		const result = matchers.equals(s1)(s2);
		expect(result.message).equals('Expected value to equal Foo {}, but Bar {} != Foo {}.');
	});

	it('produces nice messages for symbols', () => {
		const s1 = Symbol();
		const s2 = Symbol('hi');
		const result = matchers.equals(s1)(s2);
		expect(result.message).equals('Expected value to equal Symbol(), but Symbol(hi) != Symbol().');
	});

	it('explains dictionary mismatch', () => {
		const a = { foo: 'bar' };
		const b = { bar: 'foo' };
		const result = matchers.equals(a)(b);
		expect(result.pass).isFalse();
		expect(result.message).equals('Expected value to equal {foo: "bar"}, but extra "bar" and missing "foo".');
	});

	it('explains Set mismatch', () => {
		const a = new Set(['a', 'b']);
		const b = new Set(['b', 'c']);
		const result = matchers.equals(a)(b);
		expect(result.pass).isFalse();
		expect(result.message).equals('Expected value to equal Set("a", "b"), but extra "c" and missing "a".');
	});
});

describe('equals with recursion', {
	'considers equivalent recursive structures to be equal'() {
		const a = {};
		a.foo = a;
		const b = {};
		b.foo = b;
		const result = matchers.equals(a)(b);
		expect(result.pass).isTrue();
	},

	'supports branching recursion'() {
		const a = {};
		a.foo = a;
		a.bar = a;
		const b = {};
		b.foo = b;
		b.bar = b;
		const result = matchers.equals(a)(b);
		expect(result.pass).isTrue();
	},

	'supports deep nested recursion'() {
		const a = { foo: {} };
		a.foo.bar = a;
		const b = { foo: {} };
		b.foo.bar = b;
		const result = matchers.equals(a)(b);
		expect(result.pass).isTrue();
	},

	'rejects mismatched recursion'() {
		const a = { foo: {} };
		a.foo.bar = a;
		const b = {};
		b.foo = b;
		expect(matchers.equals(a)(b).pass).isFalse();
		expect(matchers.equals(b)(a).pass).isFalse();
	},

	'allows differing recursion if equivalent'() {
		const a = { foo: {} };
		a.foo.foo = a;
		const b = {};
		b.foo = b;
		expect(matchers.equals(a)(b).pass).isTrue();
		expect(matchers.equals(b)(a).pass).isTrue();
	},

	'rejects nested mismatched recursion'() {
		const a = { foo: {} };
		a.foo.bar = a;
		const b = { foo: {} };
		b.foo.bar = b.foo;
		expect(matchers.equals(a)(b).pass).isFalse();
		expect(matchers.equals(b)(a).pass).isFalse();
	},

	'supports multiple recursions'() {
		const a = { foo: { i: 1 }, bar: { i: 2 } };
		a.foo.next = a.bar;
		a.bar.prev = a.foo;
		const b = { foo: { i: 1 }, bar: { i: 2 } };
		b.foo.next = b.bar;
		b.bar.prev = b.foo;
		const result = matchers.equals(a)(b);
		expect(result.pass).isTrue();
	},

	'rejects multiple recursions if values do not match'() {
		const a = { foo: { i: 1, next: { i: 2 } } };
		a.foo.next.prev = a.foo;
		const b = { foo: { i: 1, next: { i: 3 } } };
		b.foo.next.prev = b.foo;
		const result = matchers.equals(a)(b);
		expect(result.pass).isFalse();
	},
});

describe('same', () => {
	it('returns true for values compared with themself', (factory) => {
		const item = factory();
		if (matchers.same(item)(item).pass !== true) {
			throw new Error('Expected to be same as itself, but was not');
		}
	}, { parameters: allValueFactories });

	it('returns true for equivalent primitives', (factory) => {
		const item = factory();
		if (matchers.same(item)(factory()).pass !== true) {
			throw new Error('Expected to be same as its copy, but was not');
		}
	}, { parameters: primitiveValueFactories });

	it('returns false for non-primitive values compared with identical copies', (factory) => {
		const item = factory();
		if (matchers.same(item)(factory()).pass !== false) {
			throw new Error('Expected not to be same as its copy, but was');
		}
	}, { parameters: [...standardValueFactories, ...uniqueValueFactories] });

	it('returns false for values compared with different values', (factoryA, factoryB) => {
		const itemA = factoryA();
		const itemB = factoryB();
		if (matchers.same(itemA)(itemB).pass !== false) {
			throw new Error('Expected not to be same, but was');
		}
	}, { parameters: [new Set(allValueFactories), new Set(allValueFactories)], parameterFilter: (a, b) => (a !== b) });

	it('produces nice messages for symbols', () => {
		const s1 = Symbol();
		const s2 = Symbol('hi');
		const result = matchers.same(s1)(s2);
		expect(result.message).equals('Expected value to equal Symbol(), but Symbol(hi) != Symbol().');
	});
});

describe('matches', {
	'checks if a string matches a regular expression'() {
		const resultPass = matchers.matches(/fo+/)('abcfoodef');
		expect(resultPass.pass, isTrue());

		const resultFail = matchers.matches(/fo+/)('abcdef');
		expect(resultFail.pass, isFalse());
	},

	'errors if given a non-RegExp'() {
		expect(() => matchers.matches('foo')('abcfoodef'), throws('must be a RegExp'));
	},

	'rejects other types'() {
		expect(matchers.matches(/fo+/)(7).pass, isFalse());
		expect(matchers.matches(/fo+/)(Symbol()).pass, isFalse());
	},
});

const ASYNC_PASS = () => Promise.resolve({ pass: true, message: 'msg' });
const ASYNC_FAIL = () => Promise.resolve({ pass: false, message: 'msg' });

describe('withMessage', {
	'overrides the failure message on a comparison'() {
		const result1 = matchers.withMessage('my message', matchers.same(2))(2);
		expect(result1.message, equals('my message'));

		const result2 = matchers.withMessage('my message', matchers.same(2))(3);
		expect(result2.message, equals('my message'));
	},

	'propagates success/failure'() {
		const result1 = matchers.withMessage('my message', matchers.same(2))(2);
		expect(result1.pass, equals(true));

		const result2 = matchers.withMessage('my message', matchers.same(2))(3);
		expect(result2.pass, equals(false));
	},

	async 'wraps asynchronous matchers'() {
		const result1 = await matchers.withMessage('my message', ASYNC_PASS)();
		expect(result1.pass, equals(true));
		expect(result1.message, equals('my message'));

		const result2 = await matchers.withMessage('my message', ASYNC_FAIL)();
		expect(result2.pass, equals(false));
		expect(result2.message, equals('my message'));
	},
});

describe('not', {
	'inverts success/failure'() {
		const result1 = matchers.not(matchers.same(2))(2);
		expect(result1.pass, equals(false));

		const result2 = matchers.not(matchers.same(2))(3);
		expect(result2.pass, equals(true));
	},

	'propagates the message'() {
		const result1 = matchers.not(matchers.withMessage('my message', matchers.same(2)))(2);
		expect(result1.message, equals('my message'));

		const result2 = matchers.not(matchers.withMessage('my message', matchers.same(2)))(3);
		expect(result2.message, equals('my message'));
	},

	async 'wraps asynchronous matchers'() {
		const result1 = await matchers.not(ASYNC_PASS)();
		expect(result1.pass, equals(false));
		expect(result1.message, equals('msg'));

		const result2 = await matchers.not(ASYNC_FAIL)();
		expect(result2.pass, equals(true));
		expect(result2.message, equals('msg'));
	},
});

describe('isTrue', () => [
	[true, true],
	[false, false],
	[1, false],
	[0, false],
	[null, false],
	[undefined, false],
	[Symbol(), false],
].forEach(([input, expected]) => test(`returns ${expected} for ${print(input)}`, () => {
	expect(matchers.isTrue()(input).pass, equals(expected));
})));

describe('isFalse', () => [
	[true, false],
	[false, true],
	[1, false],
	[0, false],
	[null, false],
	[undefined, false],
	[Symbol(), false],
].forEach(([input, expected]) => test(`returns ${expected} for ${print(input)}`, () => {
	expect(matchers.isFalse()(input).pass, equals(expected));
})));

describe('isTruthy', () => [
	[true, true],
	[false, false],
	[1, true],
	[0, false],
	[null, false],
	[undefined, false],
	[Symbol(), true],
].forEach(([input, expected]) => test(`returns ${expected} for ${print(input)}`, () => {
	expect(matchers.isTruthy()(input).pass, equals(expected));
})));

describe('isFalsy', () => [
	[true, false],
	[false, true],
	[1, false],
	[0, true],
	[null, true],
	[undefined, true],
	[Symbol(), false],
].forEach(([input, expected]) => test(`returns ${expected} for ${print(input)}`, () => {
	expect(matchers.isFalsy()(input).pass, equals(expected));
})));

describe('isNull', () => [
	[true, false],
	[false, false],
	[1, false],
	[0, false],
	[null, true],
	[undefined, false],
	[Symbol(), false],
].forEach(([input, expected]) => test(`returns ${expected} for ${print(input)}`, () => {
	expect(matchers.isNull()(input).pass, equals(expected));
})));

describe('isUndefined', () => [
	[true, false],
	[false, false],
	[1, false],
	[0, false],
	[null, false],
	[undefined, true],
	[Symbol(), false],
].forEach(([input, expected]) => test(`returns ${expected} for ${print(input)}`, () => {
	expect(matchers.isUndefined()(input).pass, equals(expected));
})));

describe('isNullish', () => [
	[true, false],
	[false, false],
	[1, false],
	[0, false],
	[null, true],
	[undefined, true],
	[Symbol(), false],
].forEach(([input, expected]) => test(`returns ${expected} for ${print(input)}`, () => {
	expect(matchers.isNullish()(input).pass, equals(expected));
})));

describe('resolves', {
	async 'resolves a promise'() {
		const rResolve = await matchers.resolves()(Promise.resolve());
		expect(rResolve.pass, equals(true));

		const rError = await matchers.resolves()(Promise.reject());
		expect(rError.pass, equals(false));
	},

	async 'optionally checks the value'() {
		const rPass = await matchers.resolves(1)(Promise.resolve(1));
		expect(rPass.pass, equals(true));

		const rFail = await matchers.resolves(1)(Promise.resolve(2));
		expect(rFail.pass, equals(false));

		const rError = await matchers.resolves(1)(Promise.reject());
		expect(rError.pass, equals(false));
	},

	'resolves a function synchronously'() {
		const rResolve = matchers.resolves()(() => 1);
		expect(rResolve.pass, equals(true));

		const rPass = matchers.resolves(1)(() => 1);
		expect(rPass.pass, equals(true));

		const rFail = matchers.resolves(1)(() => 2);
		expect(rFail.pass, equals(false));

		const rError1 = matchers.resolves()(() => { throw new Error(); });
		expect(rError1.pass, equals(false));

		const rError2 = matchers.resolves(1)(() => { throw new Error(); });
		expect(rError2.pass, equals(false));
	},

	async 'resolves a function asynchronously'() {
		const rResolve = await matchers.resolves()(() => Promise.resolve(1));
		expect(rResolve.pass, equals(true));

		const rPass = await matchers.resolves(1)(() => Promise.resolve(1));
		expect(rPass.pass, equals(true));

		const rFail = await matchers.resolves(1)(() => Promise.resolve(2));
		expect(rFail.pass, equals(false));

		const rError1 = await matchers.resolves()(() => Promise.reject());
		expect(rError1.pass, equals(false));

		const rError2 = await matchers.resolves(1)(() => Promise.reject());
		expect(rError2.pass, equals(false));
	},

	async 'can delegate to another matcher to check the value'() {
		const rPass = await matchers.resolves(equals(1))(Promise.resolve(1));
		expect(rPass.pass, equals(true));

		const rFail = await matchers.resolves(equals(1))(Promise.resolve(2));
		expect(rFail.pass, equals(false));

		const rError = await matchers.resolves(equals(1))(Promise.reject());
		expect(rError.pass, equals(false));
	},
});

describe('throws', {
	async 'resolves a promise'() {
		const rResolve = await matchers.throws()(Promise.resolve());
		expect(rResolve.pass, equals(false));

		const rError = await matchers.throws()(Promise.reject());
		expect(rError.pass, equals(true));
	},

	async 'optionally checks the value'() {
		const rResolve = await matchers.throws(1)(Promise.resolve());
		expect(rResolve.pass, equals(false));

		const rPass = await matchers.throws(1)(Promise.reject(1));
		expect(rPass.pass, equals(true));

		const rFail = await matchers.throws(1)(Promise.reject(2));
		expect(rFail.pass, equals(false));
	},

	'resolves a function synchronously'() {
		const rResolve1 = matchers.throws()(() => 1);
		expect(rResolve1.pass, equals(false));

		const rResolve2 = matchers.throws(1)(() => 1);
		expect(rResolve2.pass, equals(false));

		const rError = matchers.throws()(() => { throw 1; });
		expect(rError.pass, equals(true));

		const rPass = matchers.throws(1)(() => { throw 1; });
		expect(rPass.pass, equals(true));

		const rFail = matchers.throws(1)(() => { throw 2; });
		expect(rFail.pass, equals(false));
	},

	async 'resolves a function asynchronously'() {
		const rResolve1 = await matchers.throws()(() => Promise.resolve(1));
		expect(rResolve1.pass, equals(false));

		const rResolve2 = await matchers.throws(1)(() => Promise.resolve(1));
		expect(rResolve2.pass, equals(false));

		const rError = await matchers.throws()(() => Promise.reject(1));
		expect(rError.pass, equals(true));

		const rPass = await matchers.throws(1)(() => Promise.reject(1));
		expect(rPass.pass, equals(true));

		const rFail = await matchers.throws(1)(() => Promise.reject(2));
		expect(rFail.pass, equals(false));
	},

	'checks partial error message matches if given a string'() {
		const rThrow = matchers.throws('long')(() => { throw new Error('long message'); });
		expect(rThrow.pass, equals(true));

		const rMismatch = matchers.throws('nope')(() => { throw new Error('long message'); });
		expect(rMismatch.pass, equals(false));

		const rResolve = matchers.throws('anything')(() => 1);
		expect(rResolve.pass, equals(false));
	},

	'checks error message against a given RegExp'() {
		const rThrow = matchers.throws(/lo+ng/)(() => { throw new Error('long message'); });
		expect(rThrow.pass, equals(true));

		const rMismatch = matchers.throws(/nope/)(() => { throw new Error('long message'); });
		expect(rMismatch.pass, equals(false));

		const rResolve = matchers.throws(/any/)(() => 1);
		expect(rResolve.pass, equals(false));
	},

	async 'can delegate to another matcher to check the value'() {
		const rPass = await matchers.throws(equals(1))(Promise.reject(1));
		expect(rPass.pass, equals(true));

		const rFail = await matchers.throws(equals(1))(Promise.reject(2));
		expect(rFail.pass, equals(false));

		const rResolve = await matchers.throws(equals(1))(Promise.resolve());
		expect(rResolve.pass, equals(false));
	},
});
