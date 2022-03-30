import * as matchers from './collections.mjs';
import * as coreMatchers from './core.mjs';

describe('hasLength', {
	'checks length of arrays'() {
		const resultPass = matchers.hasLength(3)(['a', 'b', 'c']);
		expect(resultPass.pass, isTrue());

		const resultFail = matchers.hasLength(3)(['a', 'b']);
		expect(resultFail.pass, isFalse());
	},

	'checks empty'() {
		const resultPass = matchers.hasLength(0)([]);
		expect(resultPass.pass, isTrue());

		const resultFail = matchers.hasLength(1)([]);
		expect(resultFail.pass, isFalse());
	},

	'checks length of strings'() {
		const resultPass = matchers.hasLength(3)('abc');
		expect(resultPass.pass, isTrue());

		const resultFail = matchers.hasLength(3)('ab');
		expect(resultFail.pass, isFalse());
	},

	'checks size of sets'() {
		const resultPass = matchers.hasLength(3)(new Set(['a', 'b', 'c']));
		expect(resultPass.pass, isTrue());

		const resultFail = matchers.hasLength(3)(new Set(['a', 'b']));
		expect(resultFail.pass, isFalse());
	},

	'returns failure if input has no length'() {
		expect(matchers.hasLength(3)({ a: 'b' }).pass, isFalse());
		expect(matchers.hasLength(3)(null).pass, isFalse());
		expect(matchers.hasLength(3)(undefined).pass, isFalse());
		expect(matchers.hasLength(3)(3).pass, isFalse());
	},

	'delegates to another matcher'() {
		const resultPass = matchers.hasLength(coreMatchers.equals(3))(['a', 'b', 'c']);
		expect(resultPass.pass, isTrue());

		const resultFail = matchers.hasLength(coreMatchers.equals(3))(['a', 'b']);
		expect(resultFail.pass, isFalse());
	},

	'checks presence if called with no arguments'() {
		expect(matchers.hasLength()([]).pass, isTrue());
		expect(matchers.hasLength()(['a', 'b', 'c']).pass, isTrue());
		expect(matchers.hasLength()('').pass, isTrue());
		expect(matchers.hasLength()('abc').pass, isTrue());
		expect(matchers.hasLength()(new Set()).pass, isTrue());
		expect(matchers.hasLength()(new Set('a')).pass, isTrue());
		expect(matchers.hasLength()({ a: 'b' }).pass, isFalse());
		expect(matchers.hasLength()(null).pass, isFalse());
		expect(matchers.hasLength()(undefined).pass, isFalse());
		expect(matchers.hasLength()(1).pass, isFalse());
	},
});

describe('isEmpty', {
	'checks arrays'() {
		const resultPass = matchers.isEmpty()([]);
		expect(resultPass.pass, isTrue());

		const resultFail = matchers.isEmpty()(['a']);
		expect(resultFail.pass, isFalse());
	},

	'checks strings'() {
		const resultPass = matchers.isEmpty()('');
		expect(resultPass.pass, isTrue());

		const resultFail = matchers.isEmpty()('abc');
		expect(resultFail.pass, isFalse());
	},

	'checks sets'() {
		const resultPass = matchers.isEmpty()(new Set());
		expect(resultPass.pass, isTrue());

		const resultFail = matchers.isEmpty()(new Set(['a']));
		expect(resultFail.pass, isFalse());
	},

	'returns failure if input has no length'() {
		expect(matchers.isEmpty()({ a: 'b' }).pass, isFalse());
		expect(matchers.isEmpty()(null).pass, isFalse());
		expect(matchers.isEmpty()(undefined).pass, isFalse());
		expect(matchers.isEmpty()(3).pass, isFalse());
	},
});

describe('contains', {
	'checks strings'() {
		const resultPass = matchers.contains('foo')('abcfoodef');
		expect(resultPass.pass, isTrue());

		const resultFail = matchers.contains('foo')('abcdef');
		expect(resultFail.pass, isFalse());
	},

	'errors if asked to check if a string contains a non-string'() {
		expect(() => matchers.contains(7)('abcfoodef'), throws('cannot check'));
	},

	'checks arrays'() {
		const resultPass = matchers.contains('foo')(['abc', 'foo', 'def']);
		expect(resultPass.pass, isTrue());

		const resultFail = matchers.contains('foo')(['abc', 'abcfoodef', 'def']);
		expect(resultFail.pass, isFalse());
	},

	'checks arrays with a sub-matcher'() {
		const resultPass = matchers.contains(coreMatchers.equals('foo'))(['abc', 'foo', 'def']);
		expect(resultPass.pass, isTrue());

		const resultFail = matchers.contains(coreMatchers.equals('foo'))(['abc', 'def']);
		expect(resultFail.pass, isFalse());
	},

	'checks sets'() {
		const resultPass = matchers.contains('foo')(new Set(['abc', 'foo', 'def']));
		expect(resultPass.pass, isTrue());

		const resultFail = matchers.contains('foo')(new Set(['abc', 'abcfoodef', 'def']));
		expect(resultFail.pass, isFalse());
	},

	'checks sets with a sub-matcher'() {
		const resultPass = matchers.contains(coreMatchers.equals('foo'))(new Set(['abc', 'foo', 'def']));
		expect(resultPass.pass, isTrue());

		const resultFail = matchers.contains(coreMatchers.equals('foo'))(new Set(['abc', 'def']));
		expect(resultFail.pass, isFalse());
	},

	'rejects other types'() {
		expect(matchers.contains('foo')(7).pass, isFalse());
		expect(matchers.contains(coreMatchers.equals('foo'))(7).pass, isFalse());
	},
});
