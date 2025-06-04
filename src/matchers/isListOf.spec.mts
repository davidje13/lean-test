import { describe } from '../core/index.mts';
import {
	assertMatcherToString,
	assertMatchResult,
} from '../test-utils/assertMatcher.mts';
import { equals } from './equals.mts';
import { isListOf } from './isListOf.mts';

describe('isListOf', {
	'stringifies to code'() {
		assertMatcherToString(
			isListOf([1, equals(2)]),
			'isListOf([equals(1), equals(2)])',
		);
	},

	'checks all items of an array'() {
		assertMatchResult(['foo', 'bar'], isListOf(['foo', 'bar']), 'pass');
		assertMatchResult(['nope', 'nah'], isListOf(['foo', 'bar']), 'fail');
	},

	'checks ordering'() {
		assertMatchResult(['bar', 'foo'], isListOf(['foo', 'bar']), 'fail');
	},

	'checks item count'() {
		assertMatchResult(['foo', 'bar'], isListOf(['foo']), 'fail');
		assertMatchResult(['foo'], isListOf(['foo', 'bar']), 'fail');
	},

	'uses sub-matchers'() {
		assertMatchResult(['foo', 'bar'], isListOf([equals('foo'), 'bar']), 'pass');
		assertMatchResult(
			['nope', 'bar'],
			isListOf([equals('foo'), 'bar']),
			'fail',
		);
	},

	'rejects non-arrays'() {
		assertMatchResult('nope', isListOf(['n', 'o', 'p', 'e']), 'error');
	},
});
