import { describe } from '../core/index.mts';
import { assertError } from '../test-utils/assertError.mts';
import {
	assertMatcherToString,
	assertMatchResult,
} from '../test-utils/assertMatcher.mts';
import { endsWith } from './endsWith.mts';

describe('endsWith', {
	'stringifies to code'() {
		assertMatcherToString(endsWith('foo'), 'endsWith("foo")');
		assertMatcherToString(endsWith(/fo+/), 'endsWith(/fo+/)');
	},

	'checks if a string ends with a substring'() {
		assertMatchResult('abcdef', endsWith('def'), 'pass');
		assertMatchResult('abcdef', endsWith('abc'), 'fail');
		assertMatchResult('defdef', endsWith('def'), 'pass');
		assertMatchResult('ababa', endsWith('aba'), 'pass');
	},

	'checks if a string ends with a regular expression'() {
		assertMatchResult('abcdef', endsWith(/def/), 'pass');
		assertMatchResult('abcdef', endsWith(/abc/), 'fail');
		assertMatchResult('defdef', endsWith(/def/), 'pass');
		assertMatchResult('ababa', endsWith(/aba/), 'pass');
	},

	'errors if given a non-string'() {
		assertError(
			() => endsWith(7 as any),
			Error,
			'endsWith: suffix must be one of: string / RegExp',
		);
	},

	'rejects other types'() {
		assertMatchResult(7, endsWith('def'), 'error');
		assertMatchResult(Symbol(), endsWith('def'), 'error');
	},
});
