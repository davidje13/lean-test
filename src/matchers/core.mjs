import { seq } from '../utils.mjs';
import { checkEquals, delegateMatcher, ANY } from './checkEquals.mjs';

export const not = (matcher) => (...args) =>
	seq(matcher(...args), ({ success, message }) => ({ success: !success, message }));

export const withMessage = (message, matcher) => (...args) =>
	seq(matcher(...args), ({ success }) => ({ success, message }));

export const equals = (expected) => (actual) => checkEquals(expected, actual, 'value');

export const same = (expected) => (actual) => {
	if (expected === actual) {
		return { success: true, message: `Expected value not to be ${expected}, but was.` };
	}
	const equalResult = checkEquals(expected, actual, 'value');
	if (equalResult.success) {
		return { success: false, message: `Expected exactly ${expected}, but got a different (but matching) instance.` };
	} else {
		return equalResult;
	}
};

export const isTrue = () => (actual) => {
	if (actual === true) {
		return { success: true, message: `Expected value not to be true, but was.` };
	} else {
		return { success: false, message: `Expected true, but got ${actual}.` };
	}
};

export const isTruthy = () => (actual) => {
	if (actual) {
		return { success: true, message: `Expected value not to be truthy, but got ${actual}.` };
	} else {
		return { success: false, message: `Expected truthy value, but got ${actual}.` };
	}
};

export const isFalse = () => (actual) => {
	if (actual === false) {
		return { success: true, message: `Expected value not to be false, but was.` };
	} else {
		return { success: false, message: `Expected false, but got ${actual}.` };
	}
};

export const isFalsy = () => (actual) => {
	if (!actual) {
		return { success: true, message: `Expected value not to be falsy, but got ${actual}.` };
	} else {
		return { success: false, message: `Expected falsy value, but got ${actual}.` };
	}
};

export const isNull = () => (actual) => {
	if (actual === null) {
		return { success: true, message: `Expected value not to be null, but was.` };
	} else {
		return { success: false, message: `Expected null, but got ${actual}.` };
	}
};

export const isUndefined = () => (actual) => {
	if (actual === undefined) {
		return { success: true, message: `Expected value not to be undefined, but was.` };
	} else {
		return { success: false, message: `Expected undefined, but got ${actual}.` };
	}
};

export const isNullish = () => (actual) => {
	if (actual === null || actual === undefined) {
		return { success: true, message: `Expected value not to be nullish, but got ${actual}.` };
	} else {
		return { success: false, message: `Expected nullish value, but got ${actual}.` };
	}
};

export const resolves = (expected = ANY) => (input) => {
	function resolve(actual) {
		return delegateMatcher(expected, actual, 'resolved value');
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
		if (typeof expected === 'string' && actual instanceof Error) {
			if (!actual.message.includes(expected)) {
				return { success: false, message: `Expected ${input} to throw ${expected}, but threw ${actual}.` };
			}
		}
		return delegateMatcher(expected, actual, 'thrown value');
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
