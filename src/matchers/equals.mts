import {
	Matcher,
	stringifyActual,
	stringifyExpected,
	stringifyPlain,
} from '../core/index.mts';
import { allKeys } from '../utils/keys.mts';
import type { Class } from '../utils/types.mts';

// TODO: add second arg for optional config; {allowExtraKeys = false}
// maybe allow matchers inside expected (at any level)

export const equals = <T,>(expected: T) =>
	new Matcher<T>({
		code: () => `equals(${stringifyExpected(expected)})`,
		check: (actual) => {
			const diffs = getDiffs({ a: actual, b: expected }, false, new Map());
			if (diffs.length) {
				return {
					result: 'fail',
					message: diffs.join(' and '),
				};
			} else {
				return {
					result: 'pass',
					message: `${stringifyActual(actual)} matched`,
				};
			}
		},
	});

const readItemMap = (v: Map<unknown, unknown> | Set<unknown>) => {
	if (v instanceof Map) {
		return new Map(v.entries());
	}
	if (v instanceof Set) {
		return new Map([...v.keys()].map((k) => [k, null]));
	}
	throw new Error();
};

const readPropMap = (v: object) =>
	new Map(
		allKeys(v).map((k) => [k, (v as Record<string | symbol, unknown>)[k]]),
	);

const getAndRemove = <K, V>(
	map: Map<K, V>,
	key: K,
	exact: boolean,
	seen: Map<unknown, {}[]>,
): [true, V] | [false, null] => {
	if (map.has(key)) {
		const v = map.get(key)!;
		map.delete(key);
		return [true, v];
	}
	if (!exact) {
		for (const [key2, v] of map.entries()) {
			if (!getDiffs({ a: key, b: key2 }, true, seen).length) {
				map.delete(key2);
				return [true, v];
			}
		}
	}
	return [false, null];
};

function getDiffs(
	check: { a: unknown; b: unknown },
	failFast: boolean,
	seen: Map<unknown, {}[]>,
): string[] {
	if (Object.is(check.a, check.b)) {
		return [];
	}
	if (
		!check.a ||
		typeof check.a !== 'object' ||
		!check.b ||
		typeof check.b !== 'object' ||
		Object.getPrototypeOf(check.a) !== Object.getPrototypeOf(check.b)
	) {
		return failFast
			? ['']
			: [`${stringifyActual(check.a)} != ${stringifyExpected(check.b)}`];
	}

	if (
		(isType(Date, check) && check.a.getTime() !== check.b.getTime()) ||
		(isType(RegExp, check) &&
			(check.a.source !== check.b.source || check.a.flags !== check.b.flags)) ||
		(isType(Error, check) &&
			(check.a.message !== check.b.message || check.a.name !== check.b.name)) ||
		(isArray(check) && check.a.length !== check.b.length)
	) {
		return failFast
			? ['']
			: [`${stringifyActual(check.a)} != ${stringifyExpected(check.b)}`];
	}

	const diffs: string[] = [];
	const addSubDiffs = (path: unknown, subs: string[]) => {
		if (subs.length) {
			if (failFast) {
				diffs.push('');
			} else {
				const suffix = ` at ${stringifyPlain(path)}`;
				diffs.push(...subs.map((s) => s + suffix));
			}
		}
	};

	const checkAll = (
		map1: Map<unknown, unknown>,
		map2: Map<unknown, unknown>,
		exact: boolean,
	) => {
		if (map1.size !== map2.size) {
			diffs.push(
				failFast
					? ''
					: `${stringifyActual(check.a)} != ${stringifyExpected(check.b)}`,
			);
			return;
		}
		for (const [key, v1] of map1.entries()) {
			const [present, v2] = getAndRemove(map2, key, exact, seen);
			if (present) {
				addSubDiffs(key, getDiffs({ a: v1, b: v2 }, failFast, seen));
			} else {
				diffs.push(`extra ${stringifyActual(key)}`);
			}
			if (failFast && diffs.length) {
				return;
			}
		}
		if (map2.size > 0) {
			diffs.push(
				`missing ${[...map2.keys()].map((key) => stringifyExpected(key)).join(', ')}`,
			);
		}
	};

	const n1 = seen.get(check.a) || [];
	const n2 = seen.get(check.b) || [];
	if (n1.length && n2.length) {
		// recursion detected, but both objects are already being compared against something
		// higher up the chain, so if they're being compared against each other, we can assume
		// they match here.
		return n1.some((n) => n2.includes(n)) ? [] : ['recursion mismatch'];
	}

	const nonce = {};
	// if any recursion happens, it's safe for it to assume the current two objects match
	// (if they don't, we'll catch it and fail later here anyway)
	n1.push(nonce);
	n2.push(nonce);
	seen.set(check.a, n1);
	seen.set(check.b, n2);

	if (isType(Map, check) || isType(Set, check)) {
		checkAll(readItemMap(check.a), readItemMap(check.b), false);
	}
	if (!diffs.length) {
		checkAll(readPropMap(check.a), readPropMap(check.b), true);
	}

	n1.pop();
	n2.pop();

	return diffs;
}

const isType = <S,>(
	check: Class<S>,
	values: { a: unknown; b: unknown },
): values is { a: S; b: S } => values.a instanceof check;

const isArray = (values: {
	a: unknown;
	b: unknown;
}): values is { a: unknown[]; b: unknown[] } => Array.isArray(values.a);
