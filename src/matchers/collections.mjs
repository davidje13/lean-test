import { delegateMatcher, ANY } from './checkEquals.mjs';

const getLength = (o) => (
	((typeof o !== 'object' && typeof o !== 'string') || o === null) ? null :
	typeof o.length === 'number' ? o.length :
	typeof o.size === 'number' ? o.size :
	null
);

export const hasLength = (expected = ANY) => (actual) => {
	const length = getLength(actual);
	if (length === null) {
		if (expected === ANY) {
			return { success: false, message: `Expected a value with defined size, but got ${actual}.` };
		} else {
			return { success: false, message: `Expected a value of size ${expected}, but got ${actual}.` };
		}
	}
	return delegateMatcher(expected, length, 'length');
};

export const isEmpty = () => (actual) => {
	const length = getLength(actual);
	if (length === null) {
		return { success: false, message: `Expected an empty value, but got ${actual}.` };
	} else if (length > 0) {
		return { success: false, message: `Expected an empty value, but got ${actual}.` };
	} else {
		return { success: true, message: `Expected a non-empty value, but got ${actual}.` };
	}
};
