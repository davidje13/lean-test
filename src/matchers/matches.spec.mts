import { describe } from '../core/index.mts';
import { assertError } from '../test-utils/assertError.mts';
import {
	assertMatcherToString,
	assertMatchResult,
} from '../test-utils/assertMatcher.mts';
import { matches } from './matches.mts';

describe('matches', {
	'stringifies to code'() {
		assertMatcherToString(matches(/fo+/), 'matches(/fo+/)');
	},

	'checks if a string matches a regular expression'() {
		assertMatchResult('abcfoodef', matches(/fo+/), 'pass');
		assertMatchResult('abcdef', matches(/fo+/), 'fail');
	},

	'errors if given a non-RegExp'() {
		assertError(
			() => matches('foo' as any),
			Error,
			'matches: pattern must be: RegExp',
		);
	},

	'rejects other types'() {
		assertMatchResult(7, matches(/fo+/), 'error');
		assertMatchResult(Symbol(), matches(/fo+/), 'error');
	},
});
