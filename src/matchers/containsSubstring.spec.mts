import { describe } from '../core/index.mts';
import { assertError } from '../test-utils/assertError.mts';
import {
	assertMatcherToString,
	assertMatchResult,
} from '../test-utils/assertMatcher.mts';
import { containsSubstring } from './containsSubstring.mts';

describe('containsSubstring', {
	'stringifies to code'() {
		assertMatcherToString(containsSubstring('foo'), 'containsSubstring("foo")');
		assertMatcherToString(containsSubstring(/fo+/), 'containsSubstring(/fo+/)');
	},

	'checks strings'() {
		assertMatchResult('abcfoodef', containsSubstring('foo'), 'pass');
		assertMatchResult('abcdef', containsSubstring('foo'), 'fail');
	},

	'checks regular expressions'() {
		assertMatchResult('abcfoodef', containsSubstring(/fo+/), 'pass');
		assertMatchResult('abcdef', containsSubstring(/fo+/), 'fail');
	},

	'errors if asked to check if a string contains a non-string'() {
		assertError(
			() => containsSubstring(7 as any),
			Error,
			'containsSubstring: expected must be one of: string / RegExp',
		);
	},

	'rejects other types'() {
		assertMatchResult(7, containsSubstring('foo'), 'error');
		assertMatchResult(Symbol(), containsSubstring('foo'), 'error');
	},
});
