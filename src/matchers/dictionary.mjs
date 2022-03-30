import { delegateMatcher, ANY } from './checkEquals.mjs';

export const hasProperty = (name, expected = ANY) => (actual) => {
	if (actual !== null && actual !== undefined && Object.prototype.hasOwnProperty.call(actual, name)) {
		return delegateMatcher(expected, actual[name], name);
	} else {
		return { pass: false, message: `Expected a value with property ${name}, but got ${actual}.` };
	}
};
