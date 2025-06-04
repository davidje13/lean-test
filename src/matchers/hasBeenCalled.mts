import { Matcher, stringifyActual, stringifyExpected } from '../core/index.mts';
import { getMocked } from './common/getMocked.mts';

export const hasBeenCalled = ({ times = null }: HasBeenCalledArgs = {}) =>
	new Matcher<(...args: any) => any>({
		code: () =>
			`hasBeenCalled(${times !== null ? stringifyExpected({ times }) : ''})`,
		check(fn) {
			const { mockFn, err } = getMocked(fn);
			if (err) {
				return err;
			}
			const callCount = mockFn.invocations.length;
			const pass = times === null ? callCount > 0 : callCount === times;
			return {
				result: pass ? 'pass' : 'fail',
				message:
					callCount > 0
						? `was called ${stringifyActual(callCount)} time${callCount === 1 ? '' : 's'}`
						: 'was not called',
			};
		},
	});

interface HasBeenCalledArgs {
	times?: number | null;
}
