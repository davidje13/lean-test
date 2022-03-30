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
