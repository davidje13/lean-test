import { unquotedString } from '../../core/index.mts';
import { TestAssumptionError } from '../errors/TestAssumptionError.mts';

export function skip(message = 'skipped') {
	throw new TestAssumptionError(
		unquotedString(message, { allowNewlines: true }),
		skip,
	);
}
