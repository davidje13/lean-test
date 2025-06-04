import { stringifyExpected } from '../../core/index.mts';
import { basicMatcher } from './basicMatcher.mts';

export const exactMatcher = <T,>(code: string, expected: T) =>
	basicMatcher<T>(code, stringifyExpected(expected), (v) => v === expected);
