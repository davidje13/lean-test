import {
	Matcher,
	stringifyActual,
	stringifyExpected,
	stringifyPlain,
	TestError,
} from '../core/index.mts';

type Precision<T extends number | bigint> =
	| { decimalPlaces: number }
	| { tolerance: T | number }
	| ((value: T) => T | number);

export const isNear = <T extends number | bigint>(
	expected: T,
	precision: Precision<T> = { decimalPlaces: 2 },
) => {
	const tolerance = readTolerance(expected, precision);
	let lower: number | bigint;
	let upper: number | bigint;
	if (typeof expected === 'number' && typeof tolerance === 'bigint') {
		const expectedInt = Math.round(expected);
		if (expectedInt !== expected) {
			throw new TestError(
				'cannot mix bigint tolerance with fractional expected value',
				isNear,
			);
		}
		lower = BigInt(expectedInt) - tolerance;
		upper = BigInt(expectedInt) + tolerance;
	} else if (typeof expected === 'bigint' && typeof tolerance === 'number') {
		const toleranceInt = BigInt(Math.floor(tolerance));
		lower = expected - toleranceInt;
		upper = expected + toleranceInt;
	} else {
		lower = expected - tolerance;
		// expected & tolerance are either both numbers or both bigints;
		// cast to number just to make typescript happy
		upper = (expected as number) + (tolerance as number);
	}

	return new Matcher<number | bigint>({
		code: () =>
			`isNear(${stringifyExpected(expected)}, ${stringifyPlain(precision)})`,
		check(actual) {
			if (typeof actual !== 'number' && typeof actual !== 'bigint') {
				return {
					result: 'error',
					message: `${stringifyActual(actual)} is not a number`,
				};
			}
			const match = actual >= lower && actual <= upper;
			return {
				result: match ? 'pass' : 'fail',
				message: `${stringifyActual(actual)} ${match ? 'is' : 'is not'} within ±${stringifyPlain(tolerance)} of ${stringifyExpected(expected)}`,
			};
		},
	});
};

function readTolerance<T extends number | bigint>(
	expected: T,
	precision: Precision<T>,
): T | number {
	if (typeof precision === 'function') {
		return precision(expected);
	} else if ('tolerance' in precision) {
		return precision.tolerance;
	} else if ('decimalPlaces' in precision) {
		return 0.5 * Math.pow(10, -precision.decimalPlaces);
	} else {
		throw new TestError(
			`Unsupported precision type: ${stringifyPlain(precision)}`,
			isNear,
		);
	}
}
