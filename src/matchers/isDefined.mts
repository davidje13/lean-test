import { basicMatcher } from './common/basicMatcher.mts';

export const isDefined = basicMatcher(
	'isDefined()',
	'defined',
	(v) => v !== undefined,
);
