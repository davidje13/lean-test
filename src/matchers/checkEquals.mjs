import assert from 'assert/strict';

export const ANY = Symbol();

export const checkEquals = (expected, actual, name) => {
	try {
		assert.deepStrictEqual(actual, expected);
		return { success: true, message: `Expected ${name} not to equal ${expected}, but did.` };
	} catch (e) {
		const message = `Expected ${name} ${e.message.replace(/^[^\r\n]*[\r\n]+|[\r\n]+$/g, '')}`;
		return { success: false, message };
	}
};

export const delegateMatcher = (matcher, actual, name) => {
	if (typeof matcher === 'function') {
		return matcher(actual);
	} else if (matcher === ANY) {
		return { success: true, message: `Expected no ${name}, but got ${actual}.` };
	} else {
		return checkEquals(matcher, actual, name);
	}
};
