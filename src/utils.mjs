/** same as result.then(then), but synchronous if result is synchronous */
export function seq(result, then) {
	if (result instanceof Promise) {
		return result.then(then);
	} else {
		return then(result);
	}
}

export const resolveMessage = (message) => String((typeof message === 'function' ? message() : message) || '');

export function extractStackList(error, raw = false) {
	const stack = error.stack;
	if (typeof stack !== 'string') {
		return [];
	}
	const list = stack.split('\n');
	list.shift();
	return raw ? list : list.map(extractStackLine);
}

const STACK_AT = /^at\s+/i;
const STACK_REGEX = /^([^(]+?)\s*\(([^)]*)\)$/i;

function extractStackLine(raw) {
	const cleaned = raw.trim().replace(STACK_AT, '');
	const match = cleaned.match(STACK_REGEX);
	if (match) {
		return { name: match[1], location: match[2] };
	} else {
		return { name: 'anonymous', location: cleaned };
	}
}
