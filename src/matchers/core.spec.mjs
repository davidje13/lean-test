import * as matchers from './core.mjs';

describe('equals', {
	'returns true for equal primitives'() {
		const result = matchers.equals(7)(7);
		if (result.success !== true) {
			throw new Error('Expected success, but failed');
		}
	},

	'returns false for mismatched primitives'() {
		const result = matchers.equals(7)(8);
		if (result.success !== false) {
			throw new Error('Expected failure, but succeeded');
		}
	},

	'performs strict comparison'() {
		const result = matchers.equals(7)('7');
		if (result.success !== false) {
			throw new Error('Expected failure, but succeeded');
		}
	},

	'returns true for identical objects'() {
		const object = { foo: 'bar', zig: 'zag' };
		const result = matchers.equals(object)(object);
		if (result.success !== true) {
			throw new Error('Expected success, but failed');
		}
	},

	'returns true for equal objects'() {
		const object1 = { foo: 'bar', zig: 'zag' };
		const object2 = { foo: 'bar', zig: 'zag' };
		const result = matchers.equals(object1)(object2);
		if (result.success !== true) {
			throw new Error('Expected success, but failed');
		}
	},

	'returns false for mismatched objects'() {
		const object1 = { foo: 'bar', zig: 'zag' };
		const object2 = { foo: 'zag' };
		const result = matchers.equals(object1)(object2);
		if (result.success !== false) {
			throw new Error('Expected failure, but succeeded');
		}
	},
});

describe('same', {
	'returns true for equal primitives'() {
		const result = matchers.same(7)(7);
		if (result.success !== true) {
			throw new Error('Expected success, but failed');
		}
	},

	'returns false for mismatched primitives'() {
		const result = matchers.same(7)(8);
		if (result.success !== false) {
			throw new Error('Expected failure, but succeeded');
		}
	},

	'performs strict comparison'() {
		const result = matchers.same(7)('7');
		if (result.success !== false) {
			throw new Error('Expected failure, but succeeded');
		}
	},

	'returns true for identical objects'() {
		const object = { foo: 'bar', zig: 'zag' };
		const result = matchers.same(object)(object);
		if (result.success !== true) {
			throw new Error('Expected success, but failed');
		}
	},

	'returns false for equal objects'() {
		const object1 = { foo: 'bar', zig: 'zag' };
		const object2 = { foo: 'bar', zig: 'zag' };
		const result = matchers.same(object1)(object2);
		if (result.success !== false) {
			throw new Error('Expected failure, but succeeded');
		}
	},

	'returns false for mismatched objects'() {
		const object1 = { foo: 'bar', zig: 'zag' };
		const object2 = { foo: 'zag' };
		const result = matchers.same(object1)(object2);
		if (result.success !== false) {
			throw new Error('Expected failure, but succeeded');
		}
	},
});

const ASYNC_PASS = () => Promise.resolve({ success: true, message: 'msg' });
const ASYNC_FAIL = () => Promise.resolve({ success: false, message: 'msg' });
const ASYNC_ERROR = () => Promise.reject(new Error('nope'));

describe('withMessage', {
	'overrides the failure message on a comparison'() {
		const result1 = matchers.withMessage('my message', matchers.same(2))(2);
		expect(result1.message, equals('my message'));

		const result2 = matchers.withMessage('my message', matchers.same(2))(3);
		expect(result2.message, equals('my message'));
	},

	'propagates success/failure'() {
		const result1 = matchers.withMessage('my message', matchers.same(2))(2);
		expect(result1.success, equals(true));

		const result2 = matchers.withMessage('my message', matchers.same(2))(3);
		expect(result2.success, equals(false));
	},

	async 'wraps asynchronous matchers'() {
		const result1 = await matchers.withMessage('my message', ASYNC_PASS)();
		expect(result1.success, equals(true));
		expect(result1.message, equals('my message'));

		const result2 = await matchers.withMessage('my message', ASYNC_FAIL)();
		expect(result2.success, equals(false));
		expect(result2.message, equals('my message'));
	},
});

describe('not', {
	'inverts success/failure'() {
		const result1 = matchers.not(matchers.same(2))(2);
		expect(result1.success, equals(false));

		const result2 = matchers.not(matchers.same(2))(3);
		expect(result2.success, equals(true));
	},

	'propagates the message'() {
		const result1 = matchers.not(matchers.withMessage('my message', matchers.same(2)))(2);
		expect(result1.message, equals('my message'));

		const result2 = matchers.not(matchers.withMessage('my message', matchers.same(2)))(3);
		expect(result2.message, equals('my message'));
	},

	async 'wraps asynchronous matchers'() {
		const result1 = await matchers.not(ASYNC_PASS)();
		expect(result1.success, equals(false));
		expect(result1.message, equals('msg'));

		const result2 = await matchers.not(ASYNC_FAIL)();
		expect(result2.success, equals(true));
		expect(result2.message, equals('msg'));
	},
});

describe('resolves', {
	async 'resolves a promise'() {
		const rResolve = await matchers.resolves()(Promise.resolve());
		expect(rResolve.success, equals(true));

		const rError = await matchers.resolves()(Promise.reject());
		expect(rError.success, equals(false));
	},

	async 'optionally checks the value'() {
		const rPass = await matchers.resolves(1)(Promise.resolve(1));
		expect(rPass.success, equals(true));

		const rFail = await matchers.resolves(1)(Promise.resolve(2));
		expect(rFail.success, equals(false));

		const rError = await matchers.resolves(1)(Promise.reject());
		expect(rError.success, equals(false));
	},

	'resolves a function synchronously'() {
		const rResolve = matchers.resolves()(() => 1);
		expect(rResolve.success, equals(true));

		const rPass = matchers.resolves(1)(() => 1);
		expect(rPass.success, equals(true));

		const rFail = matchers.resolves(1)(() => 2);
		expect(rFail.success, equals(false));

		const rError1 = matchers.resolves()(() => { throw new Error(); });
		expect(rError1.success, equals(false));

		const rError2 = matchers.resolves(1)(() => { throw new Error(); });
		expect(rError2.success, equals(false));
	},

	async 'resolves a function asynchronously'() {
		const rResolve = await matchers.resolves()(() => Promise.resolve(1));
		expect(rResolve.success, equals(true));

		const rPass = await matchers.resolves(1)(() => Promise.resolve(1));
		expect(rPass.success, equals(true));

		const rFail = await matchers.resolves(1)(() => Promise.resolve(2));
		expect(rFail.success, equals(false));

		const rError1 = await matchers.resolves()(() => Promise.reject());
		expect(rError1.success, equals(false));

		const rError2 = await matchers.resolves(1)(() => Promise.reject());
		expect(rError2.success, equals(false));
	},

	async 'can delegate to another matcher to check the value'() {
		const rPass = await matchers.resolves(equals(1))(Promise.resolve(1));
		expect(rPass.success, equals(true));

		const rFail = await matchers.resolves(equals(1))(Promise.resolve(2));
		expect(rFail.success, equals(false));

		const rError = await matchers.resolves(equals(1))(Promise.reject());
		expect(rError.success, equals(false));
	},
});

describe('throws', {
	async 'resolves a promise'() {
		const rResolve = await matchers.throws()(Promise.resolve());
		expect(rResolve.success, equals(false));

		const rError = await matchers.throws()(Promise.reject());
		expect(rError.success, equals(true));
	},

	async 'optionally checks the value'() {
		const rResolve = await matchers.throws(1)(Promise.resolve());
		expect(rResolve.success, equals(false));

		const rPass = await matchers.throws(1)(Promise.reject(1));
		expect(rPass.success, equals(true));

		const rFail = await matchers.throws(1)(Promise.reject(2));
		expect(rFail.success, equals(false));

	},

	'resolves a function synchronously'() {
		const rResolve1 = matchers.throws()(() => 1);
		expect(rResolve1.success, equals(false));

		const rResolve2 = matchers.throws(1)(() => 1);
		expect(rResolve2.success, equals(false));

		const rError = matchers.throws()(() => { throw 1; });
		expect(rError.success, equals(true));

		const rPass = matchers.throws(1)(() => { throw 1; });
		expect(rPass.success, equals(true));

		const rFail = matchers.throws(1)(() => { throw 2; });
		expect(rFail.success, equals(false));
	},

	async 'resolves a function asynchronously'() {
		const rResolve1 = await matchers.throws()(() => Promise.resolve(1));
		expect(rResolve1.success, equals(false));

		const rResolve2 = await matchers.throws(1)(() => Promise.resolve(1));
		expect(rResolve2.success, equals(false));

		const rError = await matchers.throws()(() => Promise.reject(1));
		expect(rError.success, equals(true));

		const rPass = await matchers.throws(1)(() => Promise.reject(1));
		expect(rPass.success, equals(true));

		const rFail = await matchers.throws(1)(() => Promise.reject(2));
		expect(rFail.success, equals(false));
	},

	async 'can delegate to another matcher to check the value'() {
		const rPass = await matchers.throws(equals(1))(Promise.reject(1));
		expect(rPass.success, equals(true));

		const rFail = await matchers.throws(equals(1))(Promise.reject(2));
		expect(rFail.success, equals(false));

		const rResolve = await matchers.throws(equals(1))(Promise.resolve());
		expect(rResolve.success, equals(false));
	},
});
