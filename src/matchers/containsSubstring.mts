import { Matcher, stringifyActual, stringifyExpected } from '../core/index.mts';
import { runtimeAssertType } from '../utils/types.mts';

export const containsSubstring = (expected: string | RegExp) => {
	runtimeAssertType('containsSubstring: expected', expected, [
		'string',
		RegExp,
	]);

	return new Matcher<string, false>({
		code: () => `containsSubstring(${stringifyExpected(expected)})`,
		check(actual) {
			if (typeof actual !== 'string') {
				return {
					result: 'error',
					message: `${stringifyActual(actual)} is not a string`,
				};
			}
			const match = _findFirst(actual, expected);
			if (match) {
				return {
					result: 'pass',
					message: `${stringifyActual(actual, { highlight: match })} contains ${stringifyExpected(expected)}`,
				};
			} else {
				return {
					result: 'fail',
					message: `${stringifyActual(actual)} does not contain ${stringifyExpected(expected)}`,
				};
			}
		},
	});
};

export function _findFirst(
	actual: string,
	expected: string | RegExp,
): { from: number; to: number } | null {
	if (typeof expected === 'string') {
		const from = actual.indexOf(expected);
		return from !== -1 ? { from, to: from + expected.length } : null;
	}

	expected.lastIndex = 0;
	const result = expected.exec(actual);
	return result
		? { from: result.index, to: result.index + result[0].length }
		: null;
}
