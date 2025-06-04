import { describe, it, type MatcherResultType } from '../core/index.mts';
import {
	assertMatcherToString,
	assertMatchResult,
} from '../test-utils/assertMatcher.mts';
import { isFalse } from './isFalse.mts';

describe('isFalse', () => {
	it('stringifies to code', () => {
		assertMatcherToString(isFalse(), 'isFalse()');
	});

	it.with([
		{ input: true, expected: 'fail' },
		{ input: false, expected: 'pass' },
		{ input: 1, expected: 'fail' },
		{ input: 0, expected: 'fail' },
		{ input: null, expected: 'fail' },
		{ input: undefined, expected: 'fail' },
		{ input: Symbol(), expected: 'fail' },
	])('checks basic constants', ({ parameter: { input, expected } }) => {
		assertMatchResult(input, isFalse(), expected as MatcherResultType);
	});
});
