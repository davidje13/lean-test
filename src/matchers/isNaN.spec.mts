import { describe, it, type MatcherResultType } from '../core/index.mts';
import {
	assertMatcherToString,
	assertMatchResult,
} from '../test-utils/assertMatcher.mts';
import { isNaN } from './isNaN.mts';

describe('isNaN', () => {
	it('stringifies to code', () => {
		assertMatcherToString(isNaN(), 'isNaN()');
	});

	it.with([
		{ input: true, expected: 'fail' },
		{ input: false, expected: 'fail' },
		{ input: 1, expected: 'fail' },
		{ input: 0, expected: 'fail' },
		{ input: null, expected: 'fail' },
		{ input: undefined, expected: 'fail' },
		{ input: Symbol(), expected: 'fail' },
		{ input: Number.POSITIVE_INFINITY, expected: 'fail' },
		{ input: Number.NEGATIVE_INFINITY, expected: 'fail' },
		{ input: Number.NaN, expected: 'pass' },
		{ input: 0 / 0, expected: 'pass' },
	])('checks basic constants', ({ parameter: { input, expected } }) => {
		assertMatchResult(input, isNaN(), expected as MatcherResultType);
	});
});
