/** same as result.then(then), but synchronous if result is synchronous */
export function seq(result, then) {
	if (result instanceof Promise) {
		return result.then(then);
	} else {
		return then(result);
	}
}

export const resolveMessage = (message) => String((typeof message === 'function' ? message() : message) || '');

export const print = (v) =>
	(v instanceof Symbol || v instanceof Error) ? v.toString() :
	typeof v === 'function' ? v :
	JSON.stringify(v);
