import { Matcher, stringifyActual, stringifyPlain } from '../core/index.mts';
import { isIterable } from '../utils/types.mts';
import { checkIterable } from './common/checkIterable.mts';
import { equals } from './equals.mts';

export function containsItem<T, SubAsync extends boolean = false>(
	expected: T | Matcher<T, SubAsync>,
) {
	const subMatcher: Matcher<T, SubAsync | false> =
		expected instanceof Matcher ? expected : equals(expected);

	return new Matcher<Iterable<T>, SubAsync>({
		code: () => `containsItem(${subMatcher})`,
		check(actual) {
			if (isIterable(actual)) {
				return checkIterable(actual, {
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
				});
			}
			return {
				result: 'error',
				message: `${stringifyActual(actual)} is not iterable`,
			};
		},
	});
}
