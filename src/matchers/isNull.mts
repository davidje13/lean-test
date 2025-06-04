import { exactMatcher } from './common/exactMatcher.mts';

export const isNull = exactMatcher('isNull()', null);
