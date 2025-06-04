import { describe, it, type MatcherResultType } from '../core/index.mts';
import {
	assertMatcherToString,
	assertMatchResult,
} from '../test-utils/assertMatcher.mts';
import { isTruthy } from './isTruthy.mts';

describe('isTruthy', () => {
	it('stringifies to code', () => {
		assertMatcherToString(isTruthy(), 'isTruthy()');
	});

	it.with([
		{ input: true, expected: 'pass' },
		{ input: false, expected: 'fail' },
		{ input: 1, expected: 'pass' },
		{ input: 0, expected: 'fail' },
		{ input: null, expected: 'fail' },
		{ input: undefined, expected: 'fail' },
		{ input: Symbol(), expected: 'pass' },
	])('checks basic constants', ({ parameter: { input, expected } }) => {
		assertMatchResult(input, isTruthy(), expected as MatcherResultType);
	});
});
