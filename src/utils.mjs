/** same as result.then(then), but synchronous if result is synchronous */
export function seq(result, then) {
	if (result instanceof Promise) {
		return result.then(then);
	} else {
		return then(result);
	}
}

export const resolveMessage = (message) => String((typeof message === 'function' ? message() : message) || '');

export const allKeys = (o) => [...Object.keys(o), ...Object.getOwnPropertySymbols(o)];

const PLAIN_OBJECTS = [null, Object.prototype];

export const _print = (v, seen, path, noQuote) => {
	switch (typeof v) {
		case 'undefined':
		case 'boolean':
		case 'function':
			return String(v);
		case 'number':
			return (v === 0 && Math.sign(1 / v) < 0) ? '-0' : String(v);
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
				return `<ref: ${seen.get(v).join('.') || 'root'}>`;
			}
			seen.set(v, path);
			if (Array.isArray(v)) {
				const r = [];
				for (let i = 0; i < v.length; ++i) {
					r.push((i in v) ? _print(v[i], seen, [...path, i], false) : '-');
				}
				const keys = allKeys(v);
				if (keys.length > r.length) {
					for (const key of allKeys(v)) {
						const index = typeof key === 'string' ? Number(key) : -1;
						if (index < 0 || String(index|0) !== key) {
							const sK = _print(key, new Map(), [], true);
							const sV = _print(v[key], seen, [...path, sK], false);
							r.push(`${sK}: ${sV}`);
						}
					}
				}
				return `[${r.join(', ')}]`;
			}
			if (v instanceof String) {
				return noQuote ? v : JSON.stringify(v);
			}
			if (v instanceof Date) {
				return v.toISOString();
			}
			if (v instanceof Set) {
				return `Set(${[...v].map((i) => _print(i, seen, [...path, '*'], false)).join(', ')})`;
			}
			if (v instanceof Map) {
				return `Map(${[...v.entries()]
					.map(([key, value]) => {
						const sK = _print(key, seen, [...path, '<key>'], false);
						const sV = _print(value, seen, [...path, sK], false);
						return `${sK} = ${sV}`;
					})
					.join(', ')})`;
			}
			if (typeof v.toString === 'function' && v.toString !== Object.prototype.toString) {
				return v.toString();
			}
			const prototype = Object.getPrototypeOf(v);
			const prefix = PLAIN_OBJECTS.includes(prototype) ? '' : (prototype.constructor.name + ' ');
			const content = allKeys(v)
				.map((key) => {
					const sK = _print(key, new Map(), [], true);
					const sV = _print(v[key], seen, [...path, sK], false);
					return `${sK}: ${sV}`;
				})
				.join(', ');
			return `${prefix}{${content}}`;
		default:
			return `${typeof v}? ${JSON.stringify(v)}`;
	}
};

export const print = (v) => _print(v, new Map(), [], false);
