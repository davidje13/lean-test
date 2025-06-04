import { Matcher, stringifyActual, stringifyPlain } from '../core/index.mts';
import { isAsyncIterable, isIterable } from '../utils/types.mts';
import {
	checkAsyncIterable,
	checkIterable,
	type CheckIterableConfig,
} from './common/checkIterable.mts';
import { equals } from './equals.mts';

export function asyncContainsItem<T>(expected: T | Matcher<T, boolean>) {
	const subMatcher = expected instanceof Matcher ? expected : equals(expected);

	return new Matcher<AsyncIterable<T>, true>({
		code: () => `asyncContainsItem(${subMatcher})`,
		check(actual) {
			const opts: CheckIterableConfig<boolean> = {
				getMatcher: () => subMatcher,
				mapResult: (result, index) =>
					result.result === 'pass'
						? {
								result: 'pass',
								message: `matched at index ${stringifyPlain(index)}: ${result.message}`,
							}
						: null,
				completed: (checked) => ({
					result: 'fail',
					message: `${stringifyActual(checked)} contained no matching items`,
				}),
			};
			if (isIterable(actual)) {
				return checkIterable(actual, opts);
			}
			if (isAsyncIterable(actual)) {
				return checkAsyncIterable(actual, opts);
			}
			return {
				result: 'error',
				message: `${stringifyActual(actual)} is not async iterable`,
			};
		},
	});
}
