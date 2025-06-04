import {
	stringifyPlain,
	stripFormatting,
	TestAssertionError,
	type Matcher,
	type MatcherResultType,
} from '../core/index.mts';

export function assertMatcherToString(
	matcher: Matcher<any, boolean>,
	expected: string,
) {
	const actual = matcher.toString();
	if (stripFormatting(actual) !== expected) {
		throw new TestAssertionError(
			`expected ${expected} got ${actual}`,
			assertMatcherToString,
		);
	}
}

export function assertMatchResult(
	actual: unknown,
	matcher: Matcher<any, false>,
	expectedResult: MatcherResultType,
	message?: string,
) {
	const match = matcher.check(actual);
	if (match.result !== expectedResult) {
		throw new TestAssertionError(
			`${matcher} with ${stringifyPlain(actual)}: expected returned result: ${expectedResult} got: ${stringifyPlain(match)}`,
			assertMatchResult,
		);
	}
	if (message && stripFormatting(match.message) !== message) {
		throw new TestAssertionError(
			`${matcher} with ${stringifyPlain(actual)}: expected returned message: ${message} got: ${match.message}`,
			assertMatchResult,
		);
	}
}

export async function assertAsyncMatchResult(
	actual: unknown,
	matcher: Matcher<any, boolean>,
	expectedResult: MatcherResultType,
	message?: string,
) {
	const match = await matcher.check(actual);
	if (match.result !== expectedResult) {
		throw new TestAssertionError(
			`${matcher} with ${stringifyPlain(actual)}: expected returned result: ${expectedResult} got: ${stringifyPlain(match)}`,
			assertAsyncMatchResult,
		);
	}
	if (message && stripFormatting(match.message) !== message) {
		throw new TestAssertionError(
			`${matcher} with ${stringifyPlain(actual)}: expected returned message: ${message} got: ${match.message}`,
			assertAsyncMatchResult,
		);
	}
}
