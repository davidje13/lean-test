import { describe, it, type MatcherResultType } from '../core/index.mts';
import {
	assertMatcherToString,
	assertMatchResult,
} from '../test-utils/assertMatcher.mts';
import { isNull } from './isNull.mts';

describe('isNull', () => {
	it('stringifies to code', () => {
		assertMatcherToString(isNull(), 'isNull()');
	});

	it.with([
		{ input: true, expected: 'fail' },
		{ input: false, expected: 'fail' },
		{ input: 1, expected: 'fail' },
		{ input: 0, expected: 'fail' },
		{ input: null, expected: 'pass' },
		{ input: undefined, expected: 'fail' },
		{ input: Symbol(), expected: 'fail' },
	])('checks basic constants', ({ parameter: { input, expected } }) => {
		assertMatchResult(input, isNull(), expected as MatcherResultType);
	});
});
