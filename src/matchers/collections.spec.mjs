import * as matchers from './collections.mjs';
import * as coreMatchers from './core.mjs';

describe('hasLength', {
	'checks length of arrays'() {
		const resultPass = matchers.hasLength(3)(['a', 'b', 'c']);
		expect(resultPass.success, isTrue());

		const resultFail = matchers.hasLength(3)(['a', 'b']);
		expect(resultFail.success, isFalse());
	},

	'checks empty'() {
		const resultPass = matchers.hasLength(0)([]);
		expect(resultPass.success, isTrue());

		const resultFail = matchers.hasLength(1)([]);
		expect(resultFail.success, isFalse());
	},

	'checks length of strings'() {
		const resultPass = matchers.hasLength(3)('abc');
		expect(resultPass.success, isTrue());

		const resultFail = matchers.hasLength(3)('ab');
		expect(resultFail.success, isFalse());
	},

	'checks size of sets'() {
		const resultPass = matchers.hasLength(3)(new Set(['a', 'b', 'c']));
		expect(resultPass.success, isTrue());

		const resultFail = matchers.hasLength(3)(new Set(['a', 'b']));
		expect(resultFail.success, isFalse());
	},

	'returns failure if input has no length'() {
		expect(matchers.hasLength(3)({ a: 'b' }).success, isFalse());
		expect(matchers.hasLength(3)(null).success, isFalse());
		expect(matchers.hasLength(3)(undefined).success, isFalse());
		expect(matchers.hasLength(3)(3).success, isFalse());
	},

	'delegates to another matcher'() {
		const resultPass = matchers.hasLength(coreMatchers.equals(3))(['a', 'b', 'c']);
		expect(resultPass.success, isTrue());

		const resultFail = matchers.hasLength(coreMatchers.equals(3))(['a', 'b']);
		expect(resultFail.success, isFalse());
	},

	'checks presence if called with no arguments'() {
		expect(matchers.hasLength()([]).success, isTrue());
		expect(matchers.hasLength()(['a', 'b', 'c']).success, isTrue());
		expect(matchers.hasLength()('').success, isTrue());
		expect(matchers.hasLength()('abc').success, isTrue());
		expect(matchers.hasLength()(new Set()).success, isTrue());
		expect(matchers.hasLength()(new Set('a')).success, isTrue());
		expect(matchers.hasLength()({ a: 'b' }).success, isFalse());
		expect(matchers.hasLength()(null).success, isFalse());
		expect(matchers.hasLength()(undefined).success, isFalse());
		expect(matchers.hasLength()(1).success, isFalse());
	},
});

describe('isEmpty', {
	'checks arrays'() {
		const resultPass = matchers.isEmpty()([]);
		expect(resultPass.success, isTrue());

		const resultFail = matchers.isEmpty()(['a']);
		expect(resultFail.success, isFalse());
	},

	'checks strings'() {
		const resultPass = matchers.isEmpty()('');
		expect(resultPass.success, isTrue());

		const resultFail = matchers.isEmpty()('abc');
		expect(resultFail.success, isFalse());
	},

	'checks sets'() {
		const resultPass = matchers.isEmpty()(new Set());
		expect(resultPass.success, isTrue());

		const resultFail = matchers.isEmpty()(new Set(['a']));
		expect(resultFail.success, isFalse());
	},

	'returns failure if input has no length'() {
		expect(matchers.isEmpty()({ a: 'b' }).success, isFalse());
		expect(matchers.isEmpty()(null).success, isFalse());
		expect(matchers.isEmpty()(undefined).success, isFalse());
		expect(matchers.isEmpty()(3).success, isFalse());
	},
});

describe('contains', {
	'checks strings'() {
		const resultPass = matchers.contains('foo')('abcfoodef');
		expect(resultPass.success, isTrue());

		const resultFail = matchers.contains('foo')('abcdef');
		expect(resultFail.success, isFalse());
	},

	'errors if asked to check if a string contains a non-string'() {
		expect(() => matchers.contains(7)('abcfoodef'), throws('cannot check'));
	},

	'checks arrays'() {
		const resultPass = matchers.contains('foo')(['abc', 'foo', 'def']);
		expect(resultPass.success, isTrue());

		const resultFail = matchers.contains('foo')(['abc', 'abcfoodef', 'def']);
		expect(resultFail.success, isFalse());
	},

	'checks sets'() {
		const resultPass = matchers.contains('foo')(new Set(['abc', 'foo', 'def']));
		expect(resultPass.success, isTrue());

		const resultFail = matchers.contains('foo')(new Set(['abc', 'abcfoodef', 'def']));
		expect(resultFail.success, isFalse());
	},

	'rejects other types'() {
		const resultInvalid = matchers.contains('foo')(7);
		expect(resultInvalid.success, isFalse());
	},
});
