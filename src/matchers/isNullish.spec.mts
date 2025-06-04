import { describe, it, type MatcherResultType } from '../core/index.mts';
import {
	assertMatcherToString,
	assertMatchResult,
} from '../test-utils/assertMatcher.mts';
import { isNullish } from './isNullish.mts';

describe('isNullish', () => {
	it('stringifies to code', () => {
		assertMatcherToString(isNullish(), 'isNullish()');
	});

	it.with([
		{ input: true, expected: 'fail' },
		{ input: false, expected: 'fail' },
		{ input: 1, expected: 'fail' },
		{ input: 0, expected: 'fail' },
		{ input: null, expected: 'pass' },
		{ input: undefined, expected: 'pass' },
		{ input: Symbol(), expected: 'fail' },
	])('checks basic constants', ({ parameter: { input, expected } }) => {
		assertMatchResult(input, isNullish(), expected as MatcherResultType);
	});
});
