import { Matcher, stringifyActual } from '../core/index.mts';
import { _getLength, type LengthHaver } from './hasLength.mts';

export const isEmpty = () =>
	new Matcher<LengthHaver>({
		code: () => 'isEmpty()',
		check(actual) {
			const length = _getLength(actual);
			if (length === null) {
				return {
					result: 'error',
					message: `${stringifyActual(actual)} has no length or size`,
				};
			} else if (length === 0) {
				return {
					result: 'pass',
					message: `${stringifyActual(actual)} is empty`,
				};
			} else {
				return {
					result: 'fail',
					message: `${stringifyActual(actual)} is not empty`,
				};
			}
		},
	});
