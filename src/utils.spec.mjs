import { print } from './utils.mjs';

class Foo {
	constructor() {
		this.bar = 'baz';
	}
}

const RECURSIVE_OBJECT = { foo: 'bar' };
RECURSIVE_OBJECT.next = RECURSIVE_OBJECT;

const RECURSIVE_ARRAY = ['foo'];
RECURSIVE_ARRAY.push(RECURSIVE_ARRAY);

const VALUES = [
	[+0,                                    '0'],
	[+1,                                    '1'],
	[-0,                                    '-0'],
	[-1,                                    '-1'],
	[0 / 0,                                 'NaN'],
	[1 / 0,                                 'Infinity'],
	[-1 / 0,                                '-Infinity'],
	[0.1,                                   '0.1'],
	[0n,                                    '0n'],
	[10n,                                   '10n'],
	[null,                                  'null'],
	[undefined,                             'undefined'],
	[true,                                  'true'],
	[false,                                 'false'],
	['foo',                                 '"foo"'],
	['',                                    '""'],
	['0',                                   '"0"'],
	['NaN',                                 '"NaN"'],
	['null',                                '"null"'],
	['undefined',                           '"undefined"'],
	[{},                                    '{}'],
	[{ foo: 'bar', zig: 'zag' },            '{foo: "bar", zig: "zag"}'],
	[{ foo: { bar: 'baz' } },               '{foo: {bar: "baz"}}'],
	[{ 0: 0 },                              '{0: 0}'],
	[{ 0: 0, length: 1 },                   '{0: 0, length: 1}'],
	[{ [Symbol('foo')]: 'bar' },            '{Symbol(foo): "bar"}'],
	[[],                                    '[]'],
	[[0],                                   '[0]'],
	[['foo', 'bar'],                        '["foo", "bar"]'],
	[[undefined],                           '[undefined]'],
	[[, undefined],                         '[-, undefined]'],
	[[0, , ],                               '[0, -]'],
	[[, ],                                  '[-]'],
	[new Array(1),                          '[-]'],
	[new Array(2),                          '[-, -]'],
	[Object.assign([0], { foo: 'bar' }),    '[0, foo: "bar"]'],
	[Object.assign([0], { '2': 'bar' }),    '[0, -, "bar"]'],
	[Object.assign([0], { '-1': 'bar' }),   '[0, -1: "bar"]'],
	[Object.assign([0], { [Symbol()]: 'x' }), '[0, Symbol(): "x"]'],
	[[Symbol()],                            '[Symbol()]'],
	[/foo/,                                 '/foo/'],
	[/foo/gi,                               '/foo/gi'],
	[new Date(10),                          '1970-01-01T00:00:00.010Z'],
	[new Map(),                             'Map()'],
	[new Map([['a', 'b'], ['c', 'd']]),     'Map("a" = "b", "c" = "d")'],
	[new Set(),                             'Set()'],
	[new Set(['a', 'b']),                   'Set("a", "b")'],
	[new Error('oops'),                     'Error: oops'],
	[Symbol(),                              'Symbol()'],
	[Symbol('foo'),                         'Symbol(foo)'],
	[new Foo(),                             'Foo {bar: "baz"}'],
	[(v) => v + 1,                          '(v) => v + 1'],
	[RECURSIVE_OBJECT,                      '{foo: "bar", next: <ref: root>}'],
	[RECURSIVE_ARRAY,                       '["foo", <ref: root>]'],
	[
		{
			a: {
				b: RECURSIVE_OBJECT,
			},
			c: RECURSIVE_OBJECT,
			d: RECURSIVE_ARRAY,
		},
		'{a: {b: {foo: "bar", next: <ref: a.b>}}, c: <ref: a.b>, d: ["foo", <ref: d>]}',
	],
];

describe('print', () => {
	for (const [value, label] of VALUES) {
		it(`returns a useful label for ${label}`, () => {
			expect(print(value), equals(label));
		});
	}
});
