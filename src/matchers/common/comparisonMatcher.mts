import {
	Matcher,
	stringifyActual,
	stringifyExpected,
	TestError,
} from '../../core/index.mts';
import { isComparable, type Comparable } from '../../utils/types.mts';

export const comparisonMatcher =
	(
		name: string,
		description: string,
		check: (actual: Comparable, expected: Comparable) => boolean,
	) =>
	<T extends Comparable>(expected: T) => {
		if (!isComparable(expected)) {
			throw new TestError(
				`${name}: expected must be comparable`,
				comparisonMatcher,
			);
		}
		return new Matcher<T>({
			code: () => `${name}(${stringifyExpected(expected)})`,
			check: (actual) => {
				if (!isComparable(actual)) {
					return {
						result: 'error',
						message: `${stringifyActual(actual)} is not comparable`,
					};
				}
				const match = check(actual, expected);
				return {
					result: match ? 'pass' : 'fail',
					message: `${stringifyActual(actual)} ${match ? 'is' : 'is not'} ${description} ${stringifyExpected(expected)}`,
				};
			},
		});
	};
