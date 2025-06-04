import { describe } from '../core/index.mts';
import {
	assertMatcherToString,
	assertMatchResult,
} from '../test-utils/assertMatcher.mts';
import { equals } from './equals.mts';
import { hasLength } from './hasLength.mts';

describe('hasLength', {
	'stringifies to code'() {
		assertMatcherToString(hasLength(1), 'hasLength(equals(1))');
	},

	'checks length of arrays'() {
		assertMatchResult(['a', 'b', 'c'], hasLength(3), 'pass');
		assertMatchResult(['a', 'b'], hasLength(3), 'fail');
	},

	'checks empty'() {
		assertMatchResult([], hasLength(0), 'pass');
		assertMatchResult([], hasLength(1), 'fail');
	},

	'checks length of strings'() {
		assertMatchResult('abc', hasLength(3), 'pass');
		assertMatchResult('ab', hasLength(3), 'fail');
	},

	'checks size of sets'() {
		assertMatchResult(new Set(['a', 'b', 'c']), hasLength(3), 'pass');
		assertMatchResult(new Set(['a', 'b']), hasLength(3), 'fail');
	},

	'fails if input has no length'() {
		assertMatchResult({ a: 'b' }, hasLength(3), 'fail');
		assertMatchResult(null, hasLength(3), 'fail');
		assertMatchResult(undefined, hasLength(3), 'fail');
		assertMatchResult(Symbol(), hasLength(3), 'fail');
		assertMatchResult(3, hasLength(3), 'fail');
	},

	'delegates to another matcher'() {
		assertMatchResult(['a', 'b', 'c'], hasLength(equals(3)), 'pass');
		assertMatchResult(['a', 'b'], hasLength(equals(3)), 'fail');
	},

	'checks presence if called with no arguments'() {
		assertMatchResult([], hasLength(), 'pass');
		assertMatchResult(['a', 'b', 'c'], hasLength(), 'pass');
		assertMatchResult('', hasLength(), 'pass');
		assertMatchResult('abc', hasLength(), 'pass');
		assertMatchResult(new Set(), hasLength(), 'pass');
		assertMatchResult(new Set('a'), hasLength(), 'pass');
		assertMatchResult({ a: 'b' }, hasLength(), 'fail');
		assertMatchResult(null, hasLength(), 'fail');
		assertMatchResult(undefined, hasLength(), 'fail');
		assertMatchResult(Symbol(), hasLength(), 'fail');
		assertMatchResult(1, hasLength(), 'fail');
	},
});
