import type { MatcherResult } from '../../core/index.mts';
import { stringifyActual } from '../../core/index.mts';

type MockedFn<Fn extends (...args: any) => any> = Fn & {
	invocations: { arguments: Parameters<Fn> }[];
};

export function getMocked(
	fn: unknown,
):
	| { mockFn: MockedFn<(...args: any) => any>; err?: never }
	| { mockFn?: never; err: MatcherResult } {
	if (typeof fn !== 'function') {
		return {
			err: {
				result: 'error',
				message: `${stringifyActual(fn)} is not a function`,
			},
		};
	}
	const mockFn = fn as MockedFn<(...args: any) => any>;
	if (Array.isArray(mockFn.invocations)) {
		return { mockFn };
	}
	return {
		err: {
			result: 'error',
			message: `${stringifyActual(fn)} is not a mocked function`,
		},
	};
}
