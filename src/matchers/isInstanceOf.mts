import { Matcher, stringifyActual, stringifyExpected } from '../core/index.mts';
import type { Class, TypeOf } from '../utils/types.mts';

export const isInstanceOf = <T,>(expected: Class<T> | TypeOf<T>) =>
	new Matcher<T>({
		code: () => `isInstanceOf(${stringifyExpected(expected)})`,
		check: (actual) => {
			const match =
				typeof expected === 'string'
					? typeof actual === expected
					: actual instanceof expected;
			return {
				result: match ? 'pass' : 'fail',
				message: `${stringifyActual(actual)} is of type ${stringifyActual(printType(actual))}, which ${match ? 'is' : 'is not'} ${
					typeof expected === 'string'
						? (LABELS.get(expected) ?? 'a ') + stringifyExpected(expected)
						: 'an instance of ' + stringifyExpected(expected.name)
				}`,
			};
		},
	});

function printType(instance: unknown): string {
	if (typeof instance === 'object' && instance) {
		return instance.constructor?.name ?? 'object';
	}
	return typeof instance;
}

const LABELS = new Map([
	['undefined', ''],
	['object', 'an '],
]);
