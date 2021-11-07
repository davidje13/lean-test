import { resolveMessage } from '../utils.mjs';
import TestAssertionError from '../core/TestAssertionError.mjs';
import TestAssumptionError from '../core/TestAssumptionError.mjs';

export default () => (builder) => {
	builder.addMethods({
		fail(message) {
			throw new TestAssertionError(resolveMessage(message));
		},
		skip(message) {
			throw new TestAssumptionError(resolveMessage(message));
		},
	});
};
