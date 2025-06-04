import { comparisonMatcher } from './common/comparisonMatcher.mts';

export const isLessThan = comparisonMatcher(
	'isLessThan',
	'less than',
	(actual, expected) => actual < expected,
);
