import { describe } from '../core/index.mts';
import {
	assertMatcherToString,
	assertMatchResult,
} from '../test-utils/assertMatcher.mts';
import { containsItem } from './containsItem.mts';
import { equals } from './equals.mts';

describe('containsItem', {
	'stringifies to code'() {
		assertMatcherToString(containsItem(2), 'containsItem(equals(2))');
	},

	'checks arrays'() {
		assertMatchResult(['abc', 'foo', 'def'], containsItem('foo'), 'pass');

		assertMatchResult(['abc', 'abcfoodef', 'def'], containsItem('foo'), 'fail');
	},

	'checks arrays with a sub-matcher'() {
		assertMatchResult(
			['abc', 'foo', 'def'],
			containsItem(equals('foo')),
			'pass',
		);

		assertMatchResult(['abc', 'def'], containsItem(equals('foo')), 'fail');
	},

	'checks sets'() {
		assertMatchResult(
			new Set(['abc', 'foo', 'def']),
			containsItem('foo'),
			'pass',
		);

		assertMatchResult(
			new Set(['abc', 'abcfoodef', 'def']),
			containsItem('foo'),
			'fail',
		);
	},

	'checks sets with a sub-matcher'() {
		assertMatchResult(
			new Set(['abc', 'foo', 'def']),
			containsItem(equals('foo')),
			'pass',
		);

		assertMatchResult(
			new Set(['abc', 'def']),
			containsItem(equals('foo')),
			'fail',
		);
	},

	'rejects other types'() {
		assertMatchResult(7, containsItem('foo'), 'error');
		assertMatchResult(7, containsItem(equals('foo')), 'error');
		assertMatchResult(Symbol(), containsItem('foo'), 'error');
	},
});
