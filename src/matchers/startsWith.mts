import { Matcher, stringifyActual, stringifyExpected } from '../core/index.mts';
import { runtimeAssertType } from '../utils/types.mts';
import { _findFirst } from './containsSubstring.mts';

export const startsWith = (prefix: string | RegExp) => {
	runtimeAssertType('startsWith: prefix', prefix, ['string', RegExp]);

	return new Matcher<string>({
		code: () => `startsWith(${stringifyExpected(prefix)})`,
		check(actual) {
			if (typeof actual !== 'string') {
				return {
					result: 'error',
					message: `${stringifyActual(actual)} is not a string`,
				};
			}
			const match = _findFirst(actual, prefix);
			if (!match) {
				return {
					result: 'fail',
					message: `${stringifyActual(actual)} does not start with ${stringifyExpected(prefix)}`,
				};
			}
			if (match.from === 0) {
				return {
					result: 'pass',
					message: `${stringifyActual(actual, { highlight: match })} starts with ${stringifyExpected(prefix)}`,
				};
			} else {
				return {
					result: 'fail',
					message: `${stringifyActual(actual, { highlight: match })} contains ${stringifyExpected(prefix)} but not at the start`,
				};
			}
		},
	});
};
