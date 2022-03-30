import { print } from '../utils.mjs'

export const isGreaterThan = (expected) => (actual) => {
	if (actual > expected) {
		return { pass: true, message: `Expected a value not greater than ${print(expected)}, but got ${print(actual)}.` };
	} else {
		return { pass: false, message: `Expected a value greater than ${print(expected)}, but got ${print(actual)}.` };
	}
};

export const isLessThan = (expected) => (actual) => {
	if (actual < expected) {
		return { pass: true, message: `Expected a value not less than ${print(expected)}, but got ${print(actual)}.` };
	} else {
		return { pass: false, message: `Expected a value less than ${print(expected)}, but got ${print(actual)}.` };
	}
};

export const isGreaterThanOrEqual = (expected) => (actual) => {
	if (actual >= expected) {
		return { pass: true, message: `Expected a value not greater than or equal to ${print(expected)}, but got ${print(actual)}.` };
	} else {
		return { pass: false, message: `Expected a value greater than or equal to ${print(expected)}, but got ${print(actual)}.` };
	}
};

export const isLessThanOrEqual = (expected) => (actual) => {
	if (actual <= expected) {
		return { pass: true, message: `Expected a value not less than or equal to ${print(expected)}, but got ${print(actual)}.` };
	} else {
		return { pass: false, message: `Expected a value less than or equal to ${print(expected)}, but got ${print(actual)}.` };
	}
};

export const isNear = (expected, precision = { decimalPlaces: 2 }) => (actual) => {
	if (typeof actual !== 'number') {
		return { pass: false, message: `Expected a numeric value close to ${print(expected)}, but got ${print(actual)}.` };
	}
	let tolerance;
	if (typeof precision === 'function') {
		tolerance = precision(expected);
	} else if (precision.tolerance !== undefined) {
		tolerance = precision.tolerance;
	} else if (precision.decimalPlaces !== undefined) {
		tolerance = 0.5 * Math.pow(10, -precision.decimalPlaces);
	} else {
		throw new Error(`Unsupported precision type: ${print(precision)}`);
	}
	if (Math.abs(expected - actual) <= tolerance) {
		return { pass: true, message: `Expected a value not within ${tolerance} of ${print(expected)}, but got ${print(actual)}.` };
	} else {
		return { pass: false, message: `Expected a value within ${tolerance} of ${print(expected)}, but got ${print(actual)}.` };
	}
};
