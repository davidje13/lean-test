export function seq(result, then) {
	if (result instanceof Promise) {
		return result.then(then);
	} else {
		return then(result);
	}
}

export const resolveMessage = (message) => String((typeof message === 'function' ? message() : message) || '');
