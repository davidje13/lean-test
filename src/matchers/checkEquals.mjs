import { print } from '../utils.mjs';

export const ANY = Symbol();

export const checkEquals = (expected, actual, name) => {
	const diff = getDiff(actual, expected);
	if (diff) {
		return { pass: false, message: `Expected ${name} to equal ${print(expected)}, but ${diff}.` };
	} else {
		return { pass: true, message: `Expected ${name} not to equal ${print(expected)}, but did.` };
	}
};

export const delegateMatcher = (matcher, actual, name) => {
	if (matcher === actual) {
		return { pass: true, message: `Expected ${name} not to equal ${print(matcher)}, but did.` };
	} else if (typeof matcher === 'function') {
		return matcher(actual);
	} else if (matcher === ANY) {
		return { pass: true, message: `Expected no ${name}, but got ${print(actual)}.` };
	} else {
		return checkEquals(matcher, actual, name);
	}
};

function getDiff(a, b) {
	if (a === b || (a !== a && b !== b)) {
		return null;
	}
	if (typeof a !== 'object' || typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b)) {
		const simpleA = !a || typeof a !== 'object';
		const simpleB = !b || typeof b !== 'object';
		if (simpleA && simpleB) {
			return `${print(a)} != ${print(b)}`;
		} else {
			return 'different types';
		}
	}
	// TODO: cope with loops, improve formatting of message
	const diffs = [];
	for (const k of Object.keys(a)) {
		if (!k in b) {
			diffs.push(`missing ${print(k)}`);
		} else {
			const sub = getDiff(a[k], b[k]);
			if (sub) {
				diffs.push(`${sub} at ${print(k)}`);
			}
		}
	}
	for (const k of Object.keys(b)) {
		if (!k in a) {
			diffs.push(`extra ${print(k)}`);
		}
	}
	return diffs.join(' and ');
}
