import { basicMatcher } from './common/basicMatcher.mts';

export const isNullish = basicMatcher<null | undefined>(
	'isNullish()',
	'nullish',
	(v) => v === null || v === undefined,
);
