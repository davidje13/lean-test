import type { MaybePromise } from '../../utils/types.mts';
import { VerifiedPromise } from '../../utils/VerifiedPromise.mts';
import { TestAssumptionError } from '../errors/TestAssumptionError.mts';
import { TestError } from '../errors/TestError.mts';
import { plugin } from '../plugins/plugin.mts';
import type { Matcher, MatcherResult } from './Matcher.mts';

export function assume<T, Async extends boolean>(
	actual: T,
	matcher: Matcher<T, Async>,
): Async extends true ? MaybePromise<void> : void {
	const handle = (match: MatcherResult) => {
		if (match.result === 'error') {
			throw new TestError(
				`assume(value, ${matcher}) errored:\n${match.message}`,
				assume,
			);
		}
		if (match.result === 'fail') {
			throw new TestAssumptionError(
				`assume(value, ${matcher}) failed:\n${match.message}`,
				assume,
			);
		}
	};

	if (!plugin.isInTest()) {
		throw new TestError('assume used outside a test, or test has timed out');
	}

	const result = matcher.check(actual);
	if (result instanceof Promise || result instanceof VerifiedPromise) {
		// Async must be true/boolean; we are allowed to return a promise
		return new VerifiedPromise(result.then(handle), assume) as any;
	} else {
		return handle(result);
	}
}
