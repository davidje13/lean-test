import { seq, print } from '../utils.mjs';
import { checkEquals, delegateMatcher, ANY } from './checkEquals.mjs';

export const any = () => (actual) => ({
	pass: true,
	message: `Expected nothing, but got ${print(actual)}.`,
});

export const not = (matcher) => (...args) =>
	seq(matcher(...args), ({ pass, message }) => ({ pass: !pass, message }));

export const withMessage = (message, matcher) => (...args) =>
	seq(matcher(...args), ({ pass }) => ({ pass, message }));

export const equals = (expected) => (actual) => checkEquals(expected, actual, 'value');

export const same = (expected) => (actual) => {
	if (expected === actual) {
		return { pass: true, message: `Expected value not to be ${print(expected)}, but was.` };
	}
	const equalResult = checkEquals(expected, actual, 'value');
	if (equalResult.pass) {
		return { pass: false, message: `Expected exactly ${print(expected)}, but got a different (but matching) instance.` };
	} else {
		return equalResult;
	}
};

export const isTrue = () => (actual) => {
	if (actual === true) {
		return { pass: true, message: `Expected value not to be true, but was.` };
	} else {
		return { pass: false, message: `Expected true, but got ${print(actual)}.` };
	}
};

export const isTruthy = () => (actual) => {
	if (actual) {
		return { pass: true, message: `Expected value not to be truthy, but got ${print(actual)}.` };
	} else {
		return { pass: false, message: `Expected truthy value, but got ${print(actual)}.` };
	}
};

export const isFalse = () => (actual) => {
	if (actual === false) {
		return { pass: true, message: `Expected value not to be false, but was.` };
	} else {
		return { pass: false, message: `Expected false, but got ${print(actual)}.` };
	}
};

export const isFalsy = () => (actual) => {
	if (!actual) {
		return { pass: true, message: `Expected value not to be falsy, but got ${print(actual)}.` };
	} else {
		return { pass: false, message: `Expected falsy value, but got ${print(actual)}.` };
	}
};

export const isNull = () => (actual) => {
	if (actual === null) {
		return { pass: true, message: `Expected value not to be null, but was.` };
	} else {
		return { pass: false, message: `Expected null, but got ${print(actual)}.` };
	}
};

export const isUndefined = () => (actual) => {
	if (actual === undefined) {
		return { pass: true, message: `Expected value not to be undefined, but was.` };
	} else {
		return { pass: false, message: `Expected undefined, but got ${print(actual)}.` };
	}
};

export const isNullish = () => (actual) => {
	if (actual === null || actual === undefined) {
		return { pass: true, message: `Expected value not to be nullish, but got ${print(actual)}.` };
	} else {
		return { pass: false, message: `Expected nullish value, but got ${print(actual)}.` };
	}
};

export const resolves = (expected = ANY) => (input) => {
	function resolve(actual) {
		return delegateMatcher(expected, actual, 'resolved value');
	}
	function reject(actual) {
		return { pass: false, message: `Expected ${print(input)} to resolve, but threw ${print(actual)}.` };
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
			return { pass: false, message: `Expected ${print(input)} to throw ${print(expected)}, but did not throw (returned ${print(actual)}).` };
		} else {
			return { pass: false, message: `Expected ${print(input)} to throw, but did not throw (returned ${print(actual)}).` };
		}
	}
	function reject(actual) {
		if (typeof expected === 'string' && actual instanceof Error) {
			if (actual.message.includes(expected)) {
				return { pass: true, message: `Expected ${print(input)} not to throw error containing ${print(expected)} (threw ${print(actual)}).` };
			} else {
				return { pass: false, message: `Expected ${print(input)} to throw ${print(expected)}, but threw ${print(actual)}.` };
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
