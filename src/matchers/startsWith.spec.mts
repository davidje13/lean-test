import { describe } from '../core/index.mts';
import { assertError } from '../test-utils/assertError.mts';
import {
	assertMatcherToString,
	assertMatchResult,
} from '../test-utils/assertMatcher.mts';
import { startsWith } from './startsWith.mts';

describe('startsWith', {
	'stringifies to code'() {
		assertMatcherToString(startsWith('foo'), 'startsWith("foo")');
		assertMatcherToString(startsWith(/fo+/), 'startsWith(/fo+/)');
	},

	'checks if a string starts with a substring'() {
		assertMatchResult('abcdef', startsWith('abc'), 'pass');
		assertMatchResult('def', startsWith('abc'), 'fail');
		assertMatchResult('abcabc', startsWith('abc'), 'pass');
		assertMatchResult('ababa', startsWith('aba'), 'pass');
	},

	'checks if a string starts with a regular expression'() {
		assertMatchResult('abcdef', startsWith(/abc/), 'pass');
		assertMatchResult('abcdef', startsWith(/def/), 'fail');
		assertMatchResult('abcabc', startsWith(/abc/), 'pass');
		assertMatchResult('ababa', startsWith(/aba/), 'pass');
	},

	'errors if given a non-string'() {
		assertError(
			() => startsWith(7 as any),
			Error,
			'startsWith: prefix must be one of: string / RegExp',
		);
	},

	'rejects other types'() {
		assertMatchResult(7, startsWith('abc'), 'error');
		assertMatchResult(Symbol(), startsWith('abc'), 'error');
	},
});
