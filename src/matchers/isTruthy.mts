import { basicMatcher } from './common/basicMatcher.mts';

export const isTruthy = basicMatcher('isTruthy()', 'truthy', (v) => Boolean(v));
