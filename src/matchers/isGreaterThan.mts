import { comparisonMatcher } from './common/comparisonMatcher.mts';

export const isGreaterThan = comparisonMatcher(
	'isGreaterThan',
	'greater than',
	(actual, expected) => actual > expected,
);
