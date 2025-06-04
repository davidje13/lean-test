import { comparisonMatcher } from './common/comparisonMatcher.mts';

export const isGreaterThanOrEqual = comparisonMatcher(
	'isGreaterThanOrEqual',
	'greater than or equal to',
	(actual, expected) => actual >= expected,
);
