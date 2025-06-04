import { Matcher, stringifyActual, stringifyExpected } from '../core/index.mts';
import { runtimeAssertType } from '../utils/types.mts';

export const matches = (pattern: RegExp) => {
	runtimeAssertType('matches: pattern', pattern, [RegExp]);

	return new Matcher<string>({
		code: () => `matches(${stringifyExpected(pattern)})`,
		check(actual) {
			if (typeof actual !== 'string') {
				return {
					result: 'error',
					message: `${stringifyActual(actual)} is not a string`,
				};
			}
			pattern.lastIndex = 0;
			const result = pattern.exec(actual);
			if (result) {
				const highlight = {
					from: result.index,
					to: result.index + result[0].length,
				};
				return {
					result: 'pass',
					message: `${stringifyActual(actual, { highlight })} matches ${stringifyExpected(pattern)}`,
				};
			} else {
				return {
					result: 'fail',
					message: `${stringifyActual(actual)} does not match ${stringifyExpected(pattern)}`,
				};
			}
		},
	});
};
