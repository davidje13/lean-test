import { describe } from '../core/index.mts';
import {
	assertMatcherToString,
	assertMatchResult,
} from '../test-utils/assertMatcher.mts';
import { isEmpty } from './isEmpty.mts';

describe('isEmpty', {
	'stringifies to code'() {
		assertMatcherToString(isEmpty(), 'isEmpty()');
	},

	'checks arrays'() {
		assertMatchResult([], isEmpty(), 'pass');
		assertMatchResult(['a'], isEmpty(), 'fail');
	},

	'checks strings'() {
		assertMatchResult('', isEmpty(), 'pass');
		assertMatchResult('abc', isEmpty(), 'fail');
	},

	'checks sets'() {
		assertMatchResult(new Set(), isEmpty(), 'pass');
		assertMatchResult(new Set(['a']), isEmpty(), 'fail');
	},

	'returns an error if input has no length'() {
		assertMatchResult({ a: 'b' }, isEmpty(), 'error');
		assertMatchResult(null, isEmpty(), 'error');
		assertMatchResult(undefined, isEmpty(), 'error');
		assertMatchResult(Symbol(), isEmpty(), 'error');
		assertMatchResult(3, isEmpty(), 'error');
	},
});
