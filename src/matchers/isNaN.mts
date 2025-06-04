import { basicMatcher } from './common/basicMatcher.mts';

export const isNaN = basicMatcher(
	'isNaN()',
	'NaN',
	(v) => typeof v === 'number' && Number.isNaN(v),
);
