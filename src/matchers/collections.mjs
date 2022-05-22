import { print } from '../utils.mjs';
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
			return { pass: false, message: `Expected a value with defined size, but got ${print(actual)}.` };
		} else {
			return { pass: false, message: `Expected a value of size ${print(expected)}, but got ${print(actual)}.` };
		}
	}
	return delegateMatcher(expected, length, 'length');
};

export const isEmpty = () => (actual) => {
	const length = getLength(actual);
	if (length === null) {
		return { pass: false, message: `Expected an empty value, but got ${print(actual)}.` };
	} else if (length > 0) {
		return { pass: false, message: `Expected an empty value, but got ${print(actual)}.` };
	} else {
		return { pass: true, message: `Expected a non-empty value, but got ${print(actual)}.` };
	}
};

export const contains = (sub) => (actual) => {
	if (typeof sub === 'function') {
		let results;
		if (Array.isArray(actual)) {
			results = actual.map(sub);
		} else if (actual instanceof Set) {
			results = [...actual].map(sub);
		} else {
			return { pass: false, message: `Expected to contain element matching ${print(sub)}, but got non-collection type ${print(actual)}.` };
		}
		const passes = results.filter((r) => r.pass);
		if (passes.length > 0) {
			return { pass: true, message: `Expected not to contain any element matching ${print(sub)}, but got ${print(actual)}.` };
		} else {
			return { pass: false, message: `Expected to contain element matching ${print(sub)}, but got ${print(actual)}.` };
		}
	}
	let pass;
	if (typeof actual === 'string') {
		if (typeof sub !== 'string') {
			throw new Error(`cannot check for ${typeof sub} in string.`);
		}
		pass = actual.includes(sub);
	} else if (Array.isArray(actual)) {
		pass = actual.includes(sub);
	} else if (actual instanceof Set) {
		pass = actual.has(sub);
	} else {
		return { pass: false, message: `Expected to contain ${print(sub)}, but got non-collection type ${print(actual)}.` };
	}
	if (pass) {
		return { pass: true, message: `Expected not to contain ${print(sub)}, but got ${print(actual)}.` };
	} else {
		return { pass: false, message: `Expected to contain ${print(sub)}, but got ${print(actual)}.` };
	}
};

export const isListOf = (...items) => (actual) => {
	if (!Array.isArray(actual)) {
		return { pass: false, message: `Expected to contain ${print(items)}, but got non-collection type ${print(actual)}.` };
	}

	if (actual.length !== items.length) {
		return { pass: false, message: `Expected to contain ${print(items)}, but got ${print(actual)}.` };
	}

	for (let i = 0; i < items.length; ++i) {
		const result = delegateMatcher(items[i], actual[i], `item ${i + 1}`);
		if (!result.pass) {
			return result;
		}
	}
	return { pass: true, message: `Expected not to contain ${print(items)}, but did.` };
};

export const startsWith = (sub) => (actual) => {
	if (typeof sub !== 'string') {
		throw new Error('startsWith check must be a string.');
	}
	if (typeof actual === 'string' && actual.startsWith(sub)) {
		return { pass: true, message: `Expected not to start with ${print(sub)}, but got ${print(actual)}.` };
	} else {
		return { pass: false, message: `Expected to start with ${print(sub)}, but got ${print(actual)}.` };
	}
};

export const endsWith = (sub) => (actual) => {
	if (typeof sub !== 'string') {
		throw new Error('endsWith check must be a string.');
	}
	if (typeof actual === 'string' && actual.endsWith(sub)) {
		return { pass: true, message: `Expected not to end with ${print(sub)}, but got ${print(actual)}.` };
	} else {
		return { pass: false, message: `Expected to end with ${print(sub)}, but got ${print(actual)}.` };
	}
};
