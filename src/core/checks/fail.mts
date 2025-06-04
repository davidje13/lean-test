import { unquotedString } from '../../core/index.mts';
import { TestAssertionError } from '../errors/TestAssertionError.mts';

export function fail(message = 'failed') {
	throw new TestAssertionError(
		unquotedString(message, { allowNewlines: true }),
		fail,
	);
}
