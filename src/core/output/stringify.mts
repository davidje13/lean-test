import { allKeys } from '../../utils/keys.mts';
import { format } from './format.mts';

export function stringifyError(err: unknown): string {
	if (!(err instanceof Error)) {
		return stringifyPlain(err);
	}

	let message = err.stack || err.message;
	if (err.cause) {
		message += '\nCaused by: ' + stringifyError(err.cause);
	}
	return message;
}

export function stringifyPlain(value: unknown, { escape = true } = {}): string {
	const printed = _print(value);
	return escape ? escapeSpecial(printed) : printed;
}

export function unquotedString(
	value: string,
	{ allowNewlines = false } = {},
): string {
	return escapeSpecial(value, allowNewlines);
}

export function stringifyExpected(value: unknown): string {
	return format.fgGreen(stringifyPlain(value));
}

export function stringifyActual(
	value: unknown,
	options: { highlight?: { from: number; to: number } } = {},
): string {
	if (typeof value === 'string' && options.highlight) {
		const begin = stringifyPlain(value.slice(0, options.highlight.from));
		const middle = stringifyPlain(
			value.slice(options.highlight.from, options.highlight.to),
		);
		const end = stringifyPlain(value.slice(options.highlight.to));
		return format.fgRed(
			begin.slice(0, begin.length - 1) +
				format.invert(middle.slice(1, middle.length - 1)) +
				end.slice(1),
		);
	}
	return format.fgRed(stringifyPlain(value));
}

const PLAIN_OBJECTS = [null, Object.prototype];

function escapeSpecial(v: string, allowNewlines: boolean = false): string {
	if (!allowNewlines) {
		v = v.replaceAll(/\r/g, '\u240D').replaceAll(/\n/g, '\u240A');
	}
	return v
		.replaceAll(/\t/g, '\u21E5')
		.replaceAll(/\x7F/g, '\u2421')
		.replaceAll(/[\x00-\x09\x0B-\x1F]/g, (v) =>
			String.fromCharCode(v.charCodeAt(0) + 0x2400),
		);
}

function _print(
	v: unknown,
	noQuote = false,
	seen: Map<unknown, string[]> = new Map(),
	path: string[] = [],
): string {
	switch (typeof v) {
		case 'undefined':
			return 'undefined';
		case 'boolean':
			return v ? 'true' : 'false';
		case 'function':
			return v.name || String(v).replaceAll(/\s+/g, ' ').trim();
		case 'number':
			return v === 0 && Math.sign(1 / v) < 0 ? '-0' : String(v);
		case 'bigint':
			return String(v) + 'n';
		case 'symbol':
			return v.toString();
		case 'string':
			return noQuote ? v : JSON.stringify(v);
		case 'object':
			if (v === null) {
				return 'null';
			}
			if (seen.has(v)) {
				return `<ref: ${seen.get(v)!.join('.') || 'root'}>`;
			}
			seen.set(v, path);
			if (Array.isArray(v)) {
				const r = [];
				for (let i = 0; i < v.length; ++i) {
					r.push(
						i in v ? _print(v[i], false, seen, [...path, String(i)]) : '-',
					);
				}
				for (const key of allKeys(v)) {
					const index = typeof key === 'string' ? Number(key) : -1;
					if (index < 0 || String(index | 0) !== key) {
						const sK = _print(key, true, new Map(), []);
						const sV = _print(v[key as any], false, seen, [...path, sK]);
						r.push(`${sK}: ${sV}`);
					}
				}
				return `[${r.join(', ')}]`;
			}
			if (v instanceof String) {
				return noQuote ? v.toString() : JSON.stringify(v);
			}
			if (v instanceof Date) {
				return v.toISOString();
			}
			if (v instanceof Set) {
				return `Set(${[...v].map((i) => _print(i, false, seen, [...path, '*'])).join(', ')})`;
			}
			if (v instanceof Map) {
				return `Map(${[...v.entries()]
					.map(([key, value]) => {
						const sK = _print(key, false, seen, [...path, '<key>']);
						const sV = _print(value, false, seen, [...path, sK]);
						return `${sK} = ${sV}`;
					})
					.join(', ')})`;
			}
			if (
				typeof v.toString === 'function' &&
				v.toString !== Object.prototype.toString
			) {
				return v.toString();
			}
			const prototype = Object.getPrototypeOf(v);
			const prefix = PLAIN_OBJECTS.includes(prototype)
				? ''
				: prototype.constructor.name + ' ';
			const content = allKeys(v)
				.map((key) => {
					const sK = _print(key, true, new Map(), []);
					const sV = _print(
						(v as Record<string | symbol, unknown>)[key],
						false,
						seen,
						[...path, sK],
					);
					return `${sK}: ${sV}`;
				})
				.join(', ');
			return `${prefix}{${content}}`;
		default:
			return `${typeof v}? ${JSON.stringify(v)}`;
	}
}
