import { allKeys, print } from '../utils.mjs';

export const ANY = Symbol('ANY');

export const checkEquals = (expected, actual, name) => {
	const diffs = getDiffs(actual, expected, false, new Map());
	if (diffs.length) {
		return { pass: false, message: `Expected ${name} to equal ${print(expected)}, but ${diffs.join(' and ')}.` };
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

const readItemMap = (v) => {
	if (v instanceof Map) {
		return new Map(v.entries());
	}
	if (v instanceof Set) {
		return new Map([...v.keys()].map((k) => [k, null]));
	}
	throw new Error();
};

const readPropMap = (v) => new Map(allKeys(v).map((k) => [k, v[k]]));

const getAndRemove = (map, key, exact, seen) => {
	if (map.has(key)) {
		const v = map.get(key);
		map.delete(key);
		return [true, v];
	}
	if (!exact) {
		for (const [key2, v] of map.entries()) {
			if (!getDiffs(key, key2, true, seen).length) {
				map.delete(key2);
				return [true, v];
			}
		}
	}
	return [false, null];
};

function getDiffs(a, b, failFast, seen) {
	if (Object.is(a, b)) {
		return [];
	}
	if (
		!a || typeof a !== 'object' ||
		!b || typeof b !== 'object' ||
		Object.getPrototypeOf(a) !== Object.getPrototypeOf(b) ||
		(a instanceof Date && a.getTime() !== b.getTime()) ||
		(a instanceof RegExp && (a.source !== b.source || a.flags !== b.flags)) ||
		(a instanceof Error && (a.message !== b.message || a.name !== b.name)) ||
		(Array.isArray(a) && a.length !== b.length)
	) {
		return failFast ? [true] : [`${print(a)} != ${print(b)}`];
	}

	const diffs = [];
	const addSubDiffs = (path, subs) => {
		if (subs.length) {
			if (failFast) {
				diffs.push(true);
			} else {
				const suffix = ` at ${print(path)}`;
				diffs.push(...subs.map((s) => s + suffix));
			}
		}
	};

	const checkAll = (map1, map2, exact) => {
		if (map1.size !== map2.size) {
			diffs.push(failFast ? true : `${print(a)} != ${print(b)}`);
			return;
		}
		for (const [key, v1] of map1.entries()) {
			const [present, v2] = getAndRemove(map2, key, exact, seen);
			if (present) {
				addSubDiffs(key, getDiffs(v1, v2, failFast, seen));
			} else {
				diffs.push(`extra ${print(key)}`);
			}
			if (failFast && diffs.length) {
				return;
			}
		}
		if (map2.size > 0) {
			diffs.push(`missing ${[...map2.keys()].map(print).join(', ')}`);
		}
	};

	const n1 = seen.get(a) || [];
	const n2 = seen.get(b) || [];
	if (n1.length && n2.length) {
		// recursion detected, but both objects are already being compared against something
		// higher up the chain, so if they're being compared against each other, we can assume
		// they match here.
		return n1.some((n) => n2.includes(n)) ? [] : ['recursion mismatch'];
	}

	const nonce = Symbol(Math.random());
	// if any recursion happens, it's safe for it to assume the current two objects match
	// (if they don't, we'll catch it and fail later here anyway)
	n1.push(nonce);
	n2.push(nonce);
	seen.set(a, n1);
	seen.set(b, n2);

	if (a instanceof Map || a instanceof Set) {
		checkAll(readItemMap(a), readItemMap(b), false);
	}
	if (!diffs.length) {
		checkAll(readPropMap(a), readPropMap(b), true);
	}

	n1.pop();
	n2.pop();

	return diffs;
}
