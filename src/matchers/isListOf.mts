import { Matcher, stringifyActual, stringifyExpected } from '../core/index.mts';
import { isIterable } from '../utils/types.mts';
import {
	checkIterable,
	type CheckIterableConfig,
} from './common/checkIterable.mts';
import { equals } from './equals.mts';

export const isListOf = <T, SubAsync extends boolean = false>(
	items: (T | Matcher<T, SubAsync>)[] | (T | Matcher<T, SubAsync>),
) => {
	let code: (variant?: string) => string;
	let getMatcher: (index: number) => Matcher<T, SubAsync | false> | undefined;
	let expectedLength = -1;
	if (Array.isArray(items)) {
		const subMatchers = items.map((item) =>
			item instanceof Matcher ? item : equals(item),
		);
		code = (variant) =>
			variant === 'args'
				? subMatchers.join(', ')
				: `isListOf([${subMatchers.join(', ')}])`;
		getMatcher = (index) => subMatchers[index];
		expectedLength = subMatchers.length;
	} else {
		const subMatcher = items instanceof Matcher ? items : equals(items);
		code = (variant) =>
			variant === 'args' ? subMatcher.toString() : `isListOf(${subMatcher})`;
		getMatcher = () => subMatcher;
	}

	return new Matcher<Iterable<T>, SubAsync>({
		code,
		check(actual) {
			const opts: CheckIterableConfig<SubAsync | false> = {
				getMatcher: (index) =>
					getMatcher(index) ?? {
						result: 'fail',
						message: `${stringifyActual(actual)} contains too many items`,
					},
				mapResult: (result, index) =>
					result.result !== 'pass'
						? {
								result: result.result,
								message: `index ${index}: ${result.message}`,
							}
						: null,
				completed: (checked) =>
					expectedLength === -1 || checked.length === expectedLength
						? {
								result: 'pass',
								message: `${stringifyActual(checked)} matched all items`,
							}
						: {
								result: 'fail',
								message: `${stringifyActual(checked)} contains ${stringifyActual(checked.length)} items, but need ${stringifyExpected(expectedLength)}`,
							},
			};
			if (isIterable(actual)) {
				return checkIterable(actual, opts);
			}
			return {
				result: 'error',
				message: `${stringifyActual(actual)} is not iterable`,
			};
		},
	});
};
