import { Matcher, type MatcherResult } from '../core/index.mts';
import { seq } from '../utils/seq.mts';
import { equals } from './equals.mts';

export const not = <T, Async extends boolean>(
	unexpected: T | Matcher<T, Async>,
) => {
	const subMatcher =
		unexpected instanceof Matcher ? unexpected : equals(unexpected);

	return new Matcher<unknown, Async>({
		code: () => `not(${subMatcher})`,

		check: (actual) =>
			seq(subMatcher.check(actual), (sub) => ({
				result: NOT_MAP[sub.result],
				message: sub.message,
			})),
	});
};

const NOT_MAP: Record<MatcherResult['result'], MatcherResult['result']> = {
	error: 'error',
	pass: 'fail',
	fail: 'pass',
};
