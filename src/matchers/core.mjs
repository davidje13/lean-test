import assert from 'assert/strict';
import { seq } from '../utils.mjs';

const ANY = Symbol();

export const not = (matcher) => (...args) =>
	seq(matcher(...args), ({ success, message }) => ({ success: !success, message }));

export const withMessage = (message, matcher) => (...args) =>
	seq(matcher(...args), ({ success }) => ({ success, message }));

export const equals = (expected) => (actual) => {
	try {
		assert.deepStrictEqual(actual, expected);
		return { success: true, message: `Expected value not to equal ${expected}, but did.` };
	} catch (e) {
		const message = e.message.replace(/^[^\r\n]*[\r\n]+|[\r\n]+$/g, '');
		return { success: false, message };
	}
};

export const same = (expected) => (actual) => {
	if (expected === actual) {
		return { success: true, message: `Expected value not to be ${expected}, but was.` };
	}
	const equalResult = equals(expected)(actual);
	if (equalResult.success) {
		return { success: false, message: `Expected exactly ${expected}, but got a different (but matching) instance.` };
	} else {
		return { success: false, message: equalResult.message };
	}
};

export const resolves = (expected = ANY) => (input) => {
	function resolve(actual) {
		if (typeof expected === 'function') {
			return expected(actual);
		} else if (expected !== ANY) {
			return equals(expected)(actual);
		}
		return { success: true, message: `Expected ${input} not to resolve, but resolved to ${actual}.` };
	}
	function reject(actual) {
		return { success: false, message: `Expected ${input} to resolve, but threw ${actual}.` };
	}

	try {
		const r = (typeof input === 'function') ? input() : input;
		if (r instanceof Promise) {
			return r.then(resolve, reject);
		} else {
			return resolve(r);
		}
	} catch (actual) {
		return reject(actual);
	}
};

export const throws = (expected = ANY) => (input) => {
	function resolve(actual) {
		if (typeof expected === 'string') {
			return { success: false, message: `Expected ${input} to throw ${expected}, but did not throw (returned ${actual}).` };
		} else {
			return { success: false, message: `Expected ${input} to throw, but did not throw (returned ${actual}).` };
		}
	}
	function reject(actual) {
		if (typeof expected === 'function') {
			return expected(actual);
		} else if (typeof expected === 'string') {
			if (!actual.message.includes(expected)) {
				return { success: false, message: `Expected ${input} to throw ${expected}, but threw ${actual}.` };
			}
		} else if (expected !== ANY) {
			return equals(expected)(actual);
		}
		return { success: true, message: `Expected ${input} not to throw, but threw ${actual}.` };
	}

	try {
		const r = (typeof input === 'function') ? input() : input;
		if (r instanceof Promise) {
			return r.then(resolve, reject);
		} else {
			return resolve(r);
		}
	} catch (actual) {
		return reject(actual);
	}
};
