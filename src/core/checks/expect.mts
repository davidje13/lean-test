import type { MaybePromise } from '../../utils/types.mts';
import { VerifiedPromise } from '../../utils/VerifiedPromise.mts';
import { TestAssertionError } from '../errors/TestAssertionError.mts';
import { TestError } from '../errors/TestError.mts';
import { plugin } from '../plugins/plugin.mts';
import type { Matcher, MatcherResult } from './Matcher.mts';

export const EXPECTATION_COUNT = () => ({ value: 0 });

export function expect<T, Async extends boolean>(
	actual: T,
	matcher: Matcher<T, Async>,
): Async extends true ? MaybePromise<void> : void {
	const handle = (match: MatcherResult) => {
		if (match.result === 'error') {
			throw new TestError(
				`expect(value, ${matcher}) errored:\n${match.message}`,
				expect,
			);
		}
		if (match.result === 'fail') {
			throw new TestAssertionError(
				`expect(value, ${matcher}) failed:\n${match.message}`,
				expect,
			);
		}
	};

	const counter = plugin.getBlockScoped(EXPECTATION_COUNT);
	if (!counter) {
		throw new TestError('expect used outside a test, or test has timed out');
	}
	counter.value++;

	const result = matcher.check(actual);
	if (result instanceof Promise || result instanceof VerifiedPromise) {
		// Async must be true/boolean; we are allowed to return a promise
		return new VerifiedPromise(result.then(handle), expect) as any;
	} else {
		return handle(result);
	}
}
