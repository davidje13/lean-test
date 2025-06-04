import { Matcher, stringifyActual, TestError } from '../core/index.mts';
import { VerifiedPromise } from '../utils/VerifiedPromise.mts';
import { getMocked } from './common/getMocked.mts';
import { isListOf } from './isListOf.mts';

export const hasBeenCalledWith = <Fn extends (...args: any) => any>(
	...expectedArgs: TupleMatcher<Parameters<Fn>>
) => {
	const argsMatcher = isListOf(expectedArgs);

	return new Matcher<Fn>({
		code: () => `hasBeenCalledWith(${argsMatcher.toString('args')})`,
		check(fn) {
			const { mockFn, err } = getMocked(fn);
			if (err) {
				return err;
			}
			const mismatches = [];
			for (const i of mockFn.invocations) {
				const match = argsMatcher.check(i.arguments);
				if (match instanceof Promise || match instanceof VerifiedPromise) {
					throw new TestError(
						'unsupported: cannot use async matchers in hasBeenCalledWith',
					);
				}
				if (match.result === 'pass') {
					return {
						result: 'pass',
						message: 'mock function was called',
					};
				}
				mismatches.push(
					`  (${i.arguments.map((arg) => stringifyActual(arg)).join(', ')}): ${match.message}`,
				);
			}
			return {
				result: 'fail',
				message: `mock function had no matching calls.\nObserved calls:\n${mismatches.join('\n')}`,
			};
		},
	});
};

type TupleMatcher<T extends any[]> = T extends [infer A]
	? [A | Matcher<A>]
	: T extends [infer A, ...infer Rest]
		? [A | Matcher<A>, ...TupleMatcher<Rest>]
		: T extends (infer A)[]
			? (A | Matcher<A>)[]
			: [];
