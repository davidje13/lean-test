import { basicMatcher } from './common/basicMatcher.mts';

export const isFalsy = basicMatcher('isFalsy()', 'falsy', (v) => !v);
