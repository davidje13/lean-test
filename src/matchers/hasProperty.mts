import {
	Matcher,
	stringifyActual,
	stringifyExpected,
	stringifyPlain,
} from '../core/index.mts';
import { any } from './any.mts';

export const hasProperty = <T, K extends keyof T, SubAsync extends boolean>(
	key: K,
	subMatcher: Matcher<T[K], SubAsync | false> = any(),
) => {
	const labelledSubMatcher = subMatcher.wrap({
		messageMapper: (message) =>
			getKeyLabel(key) + (/^[.\[]/.test(message) ? '' : ' ') + message,
	});

	return new Matcher<T, SubAsync>({
		code: () => `hasProperty(${stringifyExpected(key)}, ${subMatcher})`,

		check(actual) {
			if (
				actual !== null &&
				actual !== undefined &&
				Object.prototype.hasOwnProperty.call(actual, key)
			) {
				return labelledSubMatcher.check((actual as Record<K, unknown>)[key]);
			}
			return {
				result: 'fail',
				message: `${stringifyActual(actual)} does not have property ${stringifyExpected(key)}`,
			};
		},
	});
};

function getKeyLabel(key: unknown): string {
	if (typeof key === 'string' && /^[a-zA-Z0-9_\-]+$/.test(key)) {
		return `.${key}`;
	} else if (typeof key === 'symbol') {
		return key.description ? `[symbol ${key.description}]` : '[unique symbol]';
	} else {
		return `[${stringifyPlain(key)}]`;
	}
}
