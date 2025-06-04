import { Matcher, stringifyActual } from '../core/index.mts';
import { any } from './any.mts';
import { equals } from './equals.mts';

export const hasLength = <SubAsync extends boolean = false>(
	expected: number | Matcher<number, SubAsync | false> = any(),
) => {
	const subMatcher = expected instanceof Matcher ? expected : equals(expected);

	return new Matcher<LengthHaver, SubAsync>({
		code: () => `hasLength(${subMatcher})`,
		check(actual) {
			const length = _getLength(actual);
			if (length === null) {
				return {
					result: 'fail',
					message: `${stringifyActual(actual)} has no length or size`,
				};
			}
			return subMatcher.check(length);
		},
	});
};

export type LengthHaver =
	| { readonly length: number }
	| { readonly size: number };

export const _getLength = (o: unknown): number | null =>
	typeof o === 'string'
		? o.length
		: typeof o !== 'object' || !o
			? null
			: 'length' in o && typeof o.length === 'number'
				? o.length
				: 'size' in o && typeof o.size === 'number'
					? o.size
					: null;
