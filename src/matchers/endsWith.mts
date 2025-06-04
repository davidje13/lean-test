import { Matcher, stringifyActual, stringifyExpected } from '../core/index.mts';
import { runtimeAssertType } from '../utils/types.mts';

export const endsWith = (suffix: string | RegExp) => {
	runtimeAssertType('endsWith: suffix', suffix, ['string', RegExp]);

	return new Matcher<string>({
		code: () => `endsWith(${stringifyExpected(suffix)})`,
		check(actual) {
			if (typeof actual !== 'string') {
				return {
					result: 'error',
					message: `${stringifyActual(actual)} is not a string`,
				};
			}
			const match = findLast(actual, suffix);
			if (!match) {
				return {
					result: 'fail',
					message: `${stringifyActual(actual)} does not end with ${stringifyExpected(suffix)}`,
				};
			}
			if (match.to === actual.length) {
				return {
					result: 'pass',
					message: `${stringifyActual(actual, { highlight: match })} ends with ${stringifyExpected(suffix)}`,
				};
			} else {
				return {
					result: 'fail',
					message: `${stringifyActual(actual, { highlight: match })} contains ${stringifyExpected(suffix)} but not at the end`,
				};
			}
		},
	});
};

function findLast(
	actual: string,
	expected: string | RegExp,
): { from: number; to: number } | null {
	if (typeof expected === 'string') {
		const from = actual.lastIndexOf(expected);
		return from !== -1 ? { from, to: from + expected.length } : null;
	}

	const lastMatch = makeLastRegExp(expected);
	lastMatch.lastIndex = 0;
	const result = lastMatch.exec(actual);
	return result
		? { from: result.index, to: result.index + result[0].length }
		: null;
}

const CONV_REGEXP = new WeakMap<RegExp, RegExp>();
function makeLastRegExp(input: RegExp): RegExp {
	let v = CONV_REGEXP.get(input);
	if (!v) {
		v = new RegExp(`(?:${input.source})$`, input.flags);
		CONV_REGEXP.set(input, v);
	}
	return v;
}
