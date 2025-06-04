/**
 * A tag function for generating parameters from a table represented as a template literal.
 *
 * Usage:
 *
 * ```js
 * it('reads the table', ({ parameters: { foo, bar } }) => {
 *   console.log(foo, bar);
 * }).withParameters(table`
 *   foo  | bar
 *   ${1} | ${'hi'}
 *   ${2} | ${'bye'}
 * `);
 * ```
 *
 * This example will run 2 tests:
 *
 * ```
 * { foo: 1, bar: 'hi' }
 * { foo: 2, bar: 'bye' }
 * ```
 */
export function table<T extends any[]>(
	strings: string[],
	...params: T
): TableRowType<T>[] {
	// TODO
}

type TableRowType<T> = unknown; // TODO (maybe check how Jest's types achieve this for it.table``)
