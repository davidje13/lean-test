import { print } from '../utils.mjs';
import * as matchers from './core.mjs';

describe('equals', {
	'returns true for equal primitives'() {
		const result = matchers.equals(7)(7);
		if (result.pass !== true) {
			throw new Error('Expected success, but failed');
		}
	},

	'returns false for mismatched primitives'() {
		const result = matchers.equals(7)(8);
		if (result.pass !== false) {
			throw new Error('Expected failure, but succeeded');
		}
	},

	'performs strict comparison'() {
		const result = matchers.equals(7)('7');
		if (result.pass !== false) {
			throw new Error('Expected failure, but succeeded');
		}
	},

	'returns true for identical objects'() {
		const object = { foo: 'bar', zig: 'zag' };
		const result = matchers.equals(object)(object);
		if (result.pass !== true) {
			throw new Error('Expected success, but failed');
		}
	},

	'returns true for equal objects'() {
		const object1 = { foo: 'bar', zig: 'zag' };
		const object2 = { foo: 'bar', zig: 'zag' };
		const result = matchers.equals(object1)(object2);
		if (result.pass !== true) {
			throw new Error('Expected success, but failed');
		}
	},

	'returns false for mismatched objects'() {
		const object1 = { foo: 'bar', zig: 'zag' };
		const object2 = { foo: 'zag' };
		const result = matchers.equals(object1)(object2);
		if (result.pass !== false) {
			throw new Error('Expected failure, but succeeded');
		}
	},

	'compares symbols'() {
		const s1 = Symbol();
		const s2 = Symbol();
		if (matchers.equals(s1)(s1).pass !== true) {
			throw new Error('Expected syccess, but failed');
		}
		if (matchers.equals(s1)(s2).pass !== false) {
			throw new Error('Expected failure, but succeeded');
		}
	},
});

describe('same', {
	'returns true for equal primitives'() {
		const result = matchers.same(7)(7);
		if (result.pass !== true) {
			throw new Error('Expected success, but failed');
		}
	},

	'returns false for mismatched primitives'() {
		const result = matchers.same(7)(8);
		if (result.pass !== false) {
			throw new Error('Expected failure, but succeeded');
		}
	},

	'performs strict comparison'() {
		const result = matchers.same(7)('7');
		if (result.pass !== false) {
			throw new Error('Expected failure, but succeeded');
		}
	},

	'returns true for identical objects'() {
		const object = { foo: 'bar', zig: 'zag' };
		const result = matchers.same(object)(object);
		if (result.pass !== true) {
			throw new Error('Expected success, but failed');
		}
	},

	'returns false for equal objects'() {
		const object1 = { foo: 'bar', zig: 'zag' };
		const object2 = { foo: 'bar', zig: 'zag' };
		const result = matchers.same(object1)(object2);
		if (result.pass !== false) {
			throw new Error('Expected failure, but succeeded');
		}
	},

	'returns false for mismatched objects'() {
		const object1 = { foo: 'bar', zig: 'zag' };
		const object2 = { foo: 'zag' };
		const result = matchers.same(object1)(object2);
		if (result.pass !== false) {
			throw new Error('Expected failure, but succeeded');
		}
	},

	'compares symbols'() {
		const s1 = Symbol();
		const s2 = Symbol();
		if (matchers.same(s1)(s1).pass !== true) {
			throw new Error('Expected syccess, but failed');
		}
		if (matchers.same(s1)(s2).pass !== false) {
			throw new Error('Expected failure, but succeeded');
		}
	},

	'produces nice messages for symbols'() {
		const s1 = Symbol();
		const s2 = Symbol('hi');
		const result = matchers.same(s1)(s2);
		expect(result.message).equals('Expected value to equal Symbol(), but Symbol(hi) != Symbol().');
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

	async 'can delegate to another matcher to check the value'() {
		const rPass = await matchers.throws(equals(1))(Promise.reject(1));
		expect(rPass.pass, equals(true));

		const rFail = await matchers.throws(equals(1))(Promise.reject(2));
		expect(rFail.pass, equals(false));

		const rResolve = await matchers.throws(equals(1))(Promise.resolve());
		expect(rResolve.pass, equals(false));
	},
});
