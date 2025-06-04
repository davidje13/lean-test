import { Matcher, stringifyActual } from '../core/index.mts';
import { asFunction, seqFn } from '../utils/seq.mts';
import type { MaybeFunction } from '../utils/types.mts';
import { any } from './any.mts';
import { equals } from './equals.mts';

export const resolves = <T, SubAsync extends boolean = false>(
	expected: T | Matcher<T, SubAsync | false> = any(),
) => {
	const subMatcher = (
		expected instanceof Matcher ? expected : equals(expected)
	).wrap({
		messageMapper: (message) => `resolved; ${message}`,
	});

	return new Matcher<
		MaybeFunction<T>,
		(T extends Promise<unknown> ? true : false) | SubAsync
	>({
		code: () => `resolves(${subMatcher})`,

		check: (input) =>
			seqFn(
				asFunction(input),
				(actual) => subMatcher.check(actual),
				(err) => ({
					result: 'fail',
					message: `threw ${stringifyActual(err)}`,
				}),
			),
	});
};
