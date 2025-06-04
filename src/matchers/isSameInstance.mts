import { Matcher, stringifyActual, stringifyExpected } from '../core/index.mts';
import { equals } from './equals.mts';

export const isSameInstance = <T,>(expected: T) =>
	new Matcher<T>({
		code: () => `isSameInstance(${stringifyExpected(expected)})`,
		check(actual) {
			if (Object.is(expected, actual)) {
				return {
					result: 'pass',
					message: `${stringifyActual(actual)} is the same instance`,
				};
			}
			const equalResult = equals(expected).check(actual);
			return equalResult.result === 'pass'
				? {
						result: 'fail',
						message: `${stringifyActual(actual)} is a different instance`,
					}
				: equalResult;
		},
	});
