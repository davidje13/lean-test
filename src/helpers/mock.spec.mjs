import mock from './mock.mjs';

describe('mock function', {
	'creates named functions'() {
		const fn = mock('my function');
		expect(fn.name).equals('my function');
	},

	'mock functions return undefined by default'() {
		const fn = mock();
		expect(fn()).isUndefined();
	},

	'allows providing a default implementation'() {
		const fn = mock(() => 3);
		expect(fn()).equals(3);
	},

	'allows providing a name and default implementation'() {
		const fn = mock('foo', () => 3);
		expect(fn.name).equals('foo');
		expect(fn()).equals(3);
	},

	'thenReturn overrides returned values'() {
		const fn = mock();
		fn.whenCalled().thenReturn(7);
		expect(fn()).equals(7);
	},

	async 'thenResolve returns a resolved promise'() {
		const fn = mock();
		fn.whenCalled().thenResolve(7);
		await expect(fn()).resolves(7);
	},

	async 'thenReject returns a rejected promise'() {
		const fn = mock();
		fn.whenCalled().thenReject(new Error('nope'));
		await expect(fn()).throws('nope');
	},

	'thenThrow throws the given error'() {
		const fn = mock();
		fn.whenCalled().thenThrow(new Error('nope'));
		expect(fn).throws('nope');
	},

	'then invokes the given function'() {
		const fn = mock();
		fn.whenCalled().then(() => 2);
		expect(fn()).equals(2);
	},

	'then includes all arguments'() {
		const fn = mock();
		let captured = null;
		fn.whenCalled().then((...args) => {
			captured = args;
		});
		fn(1, 2);
		expect(captured).isListOf(1, 2);
	},

	'then includes "this" argument'() {
		const fn = mock();
		let captured = null;
		fn.whenCalled().then(function () {
			captured = this;
		});
		const o = {};
		fn.apply(o);
		expect(captured).same(o);
	},

	'returned value count can be set'() {
		const fn = mock();
		fn.whenCalled().times(2).thenReturn(7);

		expect(fn()).equals(7);
		expect(fn()).equals(7);
		expect(fn()).equals(undefined);
	},

	'multiple values to return can be chained'() {
		const fn = mock()
			.whenCalled().times(1).thenReturn(7)
			.whenCalled().times(1).thenReturn(10);

		expect(fn()).equals(7);
		expect(fn()).equals(10);
		expect(fn()).equals(undefined);
	},

	'whenCalledNext is shorthand for whenCalled().times(1)'() {
		const fn = mock()
			.whenCalledNext().thenReturn(7);

		expect(fn()).equals(7);
		expect(fn()).equals(undefined);
	},

	'returned values can be conditional on arguments'() {
		const fn = mock()
			.whenCalled().with('foo').thenReturn('a')
			.whenCalled().with('bar').thenReturn('b')
			.whenCalled().thenReturn('c');

		expect(fn('bar')).equals('b');
		expect(fn('foo')).equals('a');
		expect(fn('nope')).equals('c');
	},

	'multiple arguments can be checked'() {
		const fn = mock()
			.whenCalled().with('foo', 'bar').thenReturn('a');

		expect(fn('foo', 'bar')).equals('a');
		expect(fn('foo')).isUndefined();
	},

	'argument checks and limits can be combined'() {
		const fn = mock()
			.whenCalled().with('foo').once().thenReturn('a');

		expect(fn('bar')).isUndefined();
		expect(fn('foo')).equals('a');
		expect(fn('foo')).isUndefined();
	},

	'arguments can be checked with matchers'() {
		const fn = mock()
			.whenCalled().with(isGreaterThan(2)).thenReturn('a');

		expect(fn(3)).equals('a');
		expect(fn(1)).isUndefined();
	},

	'thenCallThrough delegates to original method if provided'() {
		const fn = mock(() => 'yes')
			.whenCalledWith('original').thenCallThrough()
			.whenCalled().thenReturn('nope');

		expect(fn('original')).equals('yes');
		expect(fn('non-original')).equals('nope');
	},

	'thenCallThrough is not available if original method is not provided'() {
		const fn = mock();
		expect(fn.whenCalled().thenCallThrough).isUndefined();
	},

	'returning is shorthand for whenCalled().thenReturn'() {
		const fn = mock().returning(2);
		expect(fn()).equals(2);
	},

	'throwing is shorthand for whenCalled().thenThrow'() {
		const fn = mock().throwing(new Error('nope'));
		expect(fn).throws('nope');
	},

	'reset clears configuration'() {
		const fn = mock()
			.whenCalled().thenReturn('a');

		expect(fn()).equals('a');
		fn.reset();
		expect(fn()).isUndefined();
	},
});

describe('mock method', {
	'replaces a method on an object'() {
		const o = {
			foo: () => 1,
		};
		mock(o, 'foo').whenCalled().thenReturn(2);
		expect(o.foo.name).equals('foo');
		expect(o.foo()).equals(2);

		o.foo.revert();
		expect(o.foo()).equals(1);
	},

	'works with symbols'() {
		const key = Symbol();
		const o = {
			[key]: () => 1,
		};
		mock(o, key).whenCalled().thenReturn(2);
		expect(o[key]()).equals(2);

		o[key].revert();
		expect(o[key]()).equals(1);
	},

	'uses original method as delegate when calling through'() {
		const o = {
			foo: () => 1,
		};
		mock(o, 'foo').whenCalled().thenCallThrough();
		expect(o.foo()).equals(1);
	},
});
