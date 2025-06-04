export function getErrorMessage(err: unknown): string {
	if (err instanceof Error) {
		return err.message;
	} else if (typeof err === 'object' && err && 'message' in err) {
		return String(err.message);
	} else if (typeof err === 'symbol') {
		return err.description ?? 'unique symbol';
	} else {
		return String(err);
	}
}
