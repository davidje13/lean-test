import { TestAssertionError } from '../core/index.mts';
import type { Class } from '../utils/types.mts';

export function assertError(
	fn: () => void,
	expected: Class<Error>,
	expectedMessage: string,
) {
	let thrown: unknown = undefined;
	try {
		fn();
	} catch (err: unknown) {
		thrown = err;
	}
	if (!thrown) {
		throw new TestAssertionError('did not throw');
	}
	if (!(thrown instanceof expected) || thrown.message !== expectedMessage) {
		throw new TestAssertionError(`threw unexpected error: ${thrown}`);
	}
}
