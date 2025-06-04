import { Matcher, stringifyActual } from '../../core/index.mts';

export const basicMatcher = <T = unknown,>(
	code: string,
	printedValue: string,
	check: (value: unknown) => boolean,
) => {
	const matcher = new Matcher<T>({
		code: () => code,
		check: (actual) => {
			const match = check(actual);
			return {
				result: match ? 'pass' : 'fail',
				message: `${stringifyActual(actual)} ${match ? 'is' : 'is not'} ${printedValue}`,
			};
		},
	});
	return () => matcher;
};
