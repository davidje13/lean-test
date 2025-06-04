import { describe, it, type MatcherResultType } from '../core/index.mts';
import {
	assertMatcherToString,
	assertMatchResult,
} from '../test-utils/assertMatcher.mts';
import { isUndefined } from './isUndefined.mts';

describe('isUndefined', () => {
	it('stringifies to code', () => {
		assertMatcherToString(isUndefined(), 'isUndefined()');
	});

	it.with([
		{ input: true, expected: 'fail' },
		{ input: false, expected: 'fail' },
		{ input: 1, expected: 'fail' },
		{ input: 0, expected: 'fail' },
		{ input: null, expected: 'fail' },
		{ input: undefined, expected: 'pass' },
		{ input: Symbol(), expected: 'fail' },
	])('checks basic constants', ({ parameter: { input, expected } }) => {
		assertMatchResult(input, isUndefined(), expected as MatcherResultType);
	});
});
