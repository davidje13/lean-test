import { describe, it, type MatcherResultType } from '../core/index.mts';
import {
	assertMatcherToString,
	assertMatchResult,
} from '../test-utils/assertMatcher.mts';
import { isFalsy } from './isFalsy.mts';

describe('isFalsy', () => {
	it('stringifies to code', () => {
		assertMatcherToString(isFalsy(), 'isFalsy()');
	});

	it.with([
		{ input: true, expected: 'fail' },
		{ input: false, expected: 'pass' },
		{ input: 1, expected: 'fail' },
		{ input: 0, expected: 'pass' },
		{ input: null, expected: 'pass' },
		{ input: undefined, expected: 'pass' },
		{ input: Symbol(), expected: 'fail' },
	])('checks basic constants', ({ parameter: { input, expected } }) => {
		assertMatchResult(input, isFalsy(), expected as MatcherResultType);
	});
});
