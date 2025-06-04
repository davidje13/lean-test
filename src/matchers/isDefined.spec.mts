import { describe, it, type MatcherResultType } from '../core/index.mts';
import {
	assertMatcherToString,
	assertMatchResult,
} from '../test-utils/assertMatcher.mts';
import { isDefined } from './isDefined.mts';

describe('isDefined', () => {
	it('stringifies to code', () => {
		assertMatcherToString(isDefined(), 'isDefined()');
	});

	it.with([
		{ input: true, expected: 'pass' },
		{ input: false, expected: 'pass' },
		{ input: 1, expected: 'pass' },
		{ input: 0, expected: 'pass' },
		{ input: null, expected: 'pass' },
		{ input: undefined, expected: 'fail' },
		{ input: Symbol(), expected: 'pass' },
	])('checks basic constants', ({ parameter: { input, expected } }) => {
		assertMatchResult(input, isDefined(), expected as MatcherResultType);
	});
});
