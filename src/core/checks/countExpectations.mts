import { plugin } from '../index.mts';
import { EXPECTATION_COUNT } from './expect.mts';

declare global {
	interface ExtendableBlockContext {
		/**
		 * returns the count of expectations made so far in the current test
		 * (does not include expectations made during beforeAll / beforeEach)
		 *
		 * Can be used to ensure expectations have been made, e.g.:
		 *
		 * ```js
		 * afterEach(({ countExpectations }) => {
		 *   expect(countExpectations(), isGreaterThan(0));
		 * });
		 * ```
		 */
		countExpectations: () => number;
	}
}

plugin.add({
	options: [],
	beforeBlock({ context, getBlockScoped, previousBlock }) {
		const counter = getBlockScoped(EXPECTATION_COUNT);
		if (
			previousBlock?.type === 'test' ||
			previousBlock?.type === 'afterEach' ||
			previousBlock?.type === 'afterAll'
		) {
			counter.value = previousBlock.getBlockScoped(EXPECTATION_COUNT).value;
		}
		context.countExpectations = () => counter.value;
	},
});
