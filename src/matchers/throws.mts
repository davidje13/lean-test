import {
	Matcher,
	stringifyActual,
	type MatcherResultType,
} from '../core/index.mts';
import { getErrorMessage } from '../utils/error.mts';
import { asFunction, seqFn } from '../utils/seq.mts';
import type { MaybeFunction } from '../utils/types.mts';
import { any } from './any.mts';
import { containsSubstring } from './containsSubstring.mts';
import { equals } from './equals.mts';
import { matches } from './matches.mts';

export const throws = <T, Err, SubAsync extends boolean = false>(
	expected: string | RegExp | Err | Matcher<Err, SubAsync | false> = any(),
) => {
	const subMatcher = wrapErrorMatcher(expected);

	return new Matcher<
		MaybeFunction<T>,
		(T extends Promise<unknown> ? true : false) | SubAsync
	>({
		code: () => `throws(${subMatcher})`,

		check: (input) =>
			seqFn(
				asFunction(input),
				(actual) => ({
					result: 'fail',
					message: `resolved with ${stringifyActual(actual)}`,
				}),
				(err) => subMatcher.check(err),
			),
	});
};

const wrapErrorMatcher = <Err, Async extends boolean>(
	expected: string | RegExp | Matcher<Err, Async> | Err,
): Matcher<Err | unknown, Async | false> => {
	if (typeof expected === 'string') {
		return containsSubstring(expected).wrap({
			valueMapper: getErrorMessage,
			messageMapper: errorMessageMapper,
		});
	} else if (expected instanceof RegExp) {
		return matches(expected).wrap({
			valueMapper: getErrorMessage,
			messageMapper: errorMessageMapper,
		});
	} else if (expected instanceof Matcher) {
		return expected.wrap({
			messageMapper: errorMessageMapper,
		});
	} else {
		return equals(expected).wrap({
			messageMapper: errorMessageMapper,
		});
	}
};

function errorMessageMapper(
	message: string,
	result: MatcherResultType,
	actual: unknown,
): string {
	switch (result) {
		case 'error':
			return `error while checking thrown value: ${message}`;
		case 'pass':
			return `threw matching value; ${message}`;
		case 'fail':
			return `threw ${stringifyActual(actual)}`;
	}
}
