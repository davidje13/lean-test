import { getTestAbortSignal, Matcher, stringifyPlain } from '../core/index.mts';
import { sleep } from '../utils/sleep.mts';
import { runtimeAssertType } from '../utils/types.mts';

// TODO: consider interaction with fake timers

export const eventually = <T,>(
	subMatcher: Matcher<T, boolean>,
	{ pollInterval = 50, timeout = 5000 } = {},
) => {
	runtimeAssertType('eventually: subMatcher', subMatcher, [Matcher]);

	return new Matcher<T, true>({
		code: () =>
			`eventually(${subMatcher}, ${stringifyPlain({ pollInterval, timeout })})`,

		async check(actual) {
			// check if condition is already met, to avoid wasting time polling
			const sub = await subMatcher.check(actual);
			if (sub.result === 'error' || sub.result === 'pass') {
				return {
					result: sub.result,
					message: `${sub.message} after 0s`,
				};
			}

			const signal = getTestAbortSignal();

			// wait a frame before starting the timeout timer
			// (lets us escape the overhead of other synchronous tests happening in parallel)
			await sleep(0, signal);

			const tm0 = Date.now();
			while (true) {
				const sub = await subMatcher.check(actual);
				const tm = Date.now();
				if (sub.result === 'error' || sub.result === 'pass') {
					return {
						result: sub.result,
						message: `${sub.message} after ${((tm - tm0) * 0.001).toFixed(3)}s`,
					};
				}
				if (tm + Math.min(pollInterval, 5) >= tm0 + timeout) {
					return {
						result: 'fail',
						message: `${sub.message} (timed out)`,
					};
				}
				await sleep(Math.min(pollInterval, tm0 + timeout - tm), signal);
			}
		},
	});
};
