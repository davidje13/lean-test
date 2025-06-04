import { comparisonMatcher } from './common/comparisonMatcher.mts';

export const isLessThanOrEqual = comparisonMatcher(
	'isLessThanOrEqual',
	'less than or equal to',
	(actual, expected) => actual <= expected,
);
