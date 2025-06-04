import { Matcher, stringifyActual } from '../core/index.mts';

export const any = <T,>() =>
	new Matcher<T>({
		code: () => 'any()',
		check: (actual) => ({
			result: 'pass',
			message: `${stringifyActual(actual)} is not nothing`,
		}),
	});
