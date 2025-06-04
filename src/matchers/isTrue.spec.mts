import { describe, it, type MatcherResultType } from '../core/index.mts';
import {
	assertMatcherToString,
	assertMatchResult,
} from '../test-utils/assertMatcher.mts';
import { isTrue } from './isTrue.mts';

describe('isTrue', () => {
	it('stringifies to code', () => {
		assertMatcherToString(isTrue(), 'isTrue()');
	});

	it.with([
		{ input: true, expected: 'pass' },
		{ input: false, expected: 'fail' },
		{ input: 1, expected: 'fail' },
		{ input: 0, expected: 'fail' },
		{ input: null, expected: 'fail' },
		{ input: undefined, expected: 'fail' },
		{ input: Symbol(), expected: 'fail' },
	])('checks basic constants', ({ parameter: { input, expected } }) => {
		assertMatchResult(input, isTrue(), expected as MatcherResultType);
	});
});
