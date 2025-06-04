import { exactMatcher } from './common/exactMatcher.mts';

export const isUndefined = exactMatcher('isUndefined()', undefined);
