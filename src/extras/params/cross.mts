import { isIterable } from '../../utils/types.mts';

/**
 * A helper function for combining multiple sources of parameters in a "cross join".
 *
 * Usage:
 *
 * ```js
 * it('combines arbitrary things', ({ parameters: { a, b, c } }) => {
 *   console.log(a, b, c);
 * }).withParameters(cross({
 *   a: [1, 2, 3],
 *   b: new Set(['foo', 'bar']),
 *   c: 'stays constant',
 * }));
 * ```
 *
 * This example will run 6 tests:
 *
 * ```
 * { a: 1, b: 'foo', c: 'stays constant' }
 * { a: 1, b: 'bar', c: 'stays constant' }
 * { a: 2, b: 'foo', c: 'stays constant' }
 * { a: 2, b: 'bar', c: 'stays constant' }
 * { a: 3, b: 'foo', c: 'stays constant' }
 * { a: 3, b: 'bar', c: 'stays constant' }
 * ```
 *
 * @param dimensions an object containing properties to cross-join
 * @returns an array of flattened parameters
 */
export function cross<T extends object>(dimensions: Readonly<T>): Crossed<T>[] {
	const isArray = Array.isArray(dimensions);

	const dims = Object.entries(dimensions).map<{
		key: keyof T;
		values: unknown[];
		pos: number;
	}>(([k, v]) => ({
		key: k as keyof T,
		values: Array.isArray(v) ? v : isIterable(v) ? [...v] : [v],
		pos: 0,
	}));

	const result: Crossed<T>[] = [];
	while (true) {
		const entity = (isArray ? [] : {}) as Crossed<T>;
		for (const { key, values, pos } of dims) {
			entity[key] = values[pos] as any;
		}
		result.push(entity);
		for (let p = dims.length - 1; ; p--) {
			const cur = dims[p]!;
			if (++cur.pos >= cur.values.length) {
				if (p === 0) {
					return result;
				}
				cur.pos = 0;
			} else {
				break;
			}
		}
	}
}

type Crossed<T> = {
	[K in keyof T]: T[K] extends Iterable<infer V> ? V : T[K];
};
