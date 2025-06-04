import { TestError } from '../core/index.mts';

export type MaybePromise<T> = T | Promise<T>;
export type MaybeFunction<T> = (() => T) | T;

export type OptionallyAsync<T, Async extends boolean> =
	| (Async extends true ? Promise<T> : never)
	| T;

export type OptionalFirstArg<A extends any[], B extends any[]> =
	| [...A, ...B]
	| B;

export type Class<T> = { new (...args: any): T };

export type TypeOf<T> =
	| (string extends T ? 'string' : never)
	| (number extends T ? 'number' : never)
	| (bigint extends T ? 'bigint' : never)
	| (boolean extends T ? 'boolean' : never)
	| (symbol extends T ? 'symbol' : never)
	| (undefined extends T ? 'undefined' : never)
	| (object extends T ? 'object' : never)
	| (((...args: any) => any) extends T ? 'function' : never);

export type Comparable =
	| string
	| number
	| bigint
	| boolean
	| { valueOf(): Comparable };

const COMPARABLE_TYPES = ['string', 'number', 'bigint', 'boolean'];

export function isComparable(value: unknown): value is Comparable {
	let resolved: unknown = value;
	if (typeof value === 'object' && value) {
		resolved = value.valueOf();
	}
	return COMPARABLE_TYPES.includes(typeof resolved);
}

export function isIterable(value: unknown): value is Iterable<unknown> {
	return Boolean(
		typeof value === 'object' &&
			value &&
			typeof (value as Iterable<unknown>)[Symbol.iterator] === 'function',
	);
}

export function isAsyncIterable(
	value: unknown,
): value is AsyncIterable<unknown> {
	return Boolean(
		typeof value === 'object' &&
			value &&
			typeof (value as AsyncIterable<unknown>)[Symbol.asyncIterator] ===
				'function',
	);
}

export function runtimeAssertType<T>(
	scope: string,
	value: T,
	options: (Class<T> | TypeOf<T>)[],
) {
	if (!options.length) {
		throw new TestError(
			`${scope} runtimeAssertType called with no accepted types`,
			runtimeAssertType,
		);
	}
	for (const option of options) {
		if (
			typeof option === 'string'
				? typeof value === option
				: value instanceof option
		) {
			return;
		}
	}
	const names = options.map((option) =>
		typeof option === 'string' ? option : option.name,
	);
	if (names.length === 1) {
		throw new TestError(`${scope} must be: ${names[0]}`, runtimeAssertType);
	} else {
		throw new TestError(
			`${scope} must be one of: ${names.join(' / ')}`,
			runtimeAssertType,
		);
	}
}
