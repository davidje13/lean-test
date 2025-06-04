import { seq } from '../../utils/seq.mts';
import type { OptionallyAsync } from '../../utils/types.mts';

export type MatcherResultType = 'pass' | 'fail' | 'error';

export interface MatcherResult {
	result: MatcherResultType;
	message: string;
}

declare const brand: unique symbol;

type Code = (variant?: string) => string;
type Check<Async extends boolean> = (
	actual: unknown,
) => OptionallyAsync<MatcherResult, Async>;

/**
 * Matchers make an assertion about an unknown value being tested.
 * If the assertion fails, a message of this form is printed to the output:
 *
 * "expect(value, `code()`) failed because `check(actual).message`."
 */
export class Matcher<T, Async extends boolean = false> {
	declare private readonly [brand]?: { readonly type: T };

	public readonly toString: Code;

	public readonly check: Check<Async>;

	constructor(init: { code: Code; check: Check<Async> }) {
		this.toString = init.code;
		this.check = init.check;
	}

	overrideDescription(description: string): Matcher<T, Async> {
		return this.wrap({ description, messageMapper: mapToTrivial });
	}

	wrap({
		description,
		valueMapper = identity,
		messageMapper,
	}: {
		description?: string;
		valueMapper?: (actual: unknown) => unknown;
		messageMapper?: (
			message: string,
			result: MatcherResultType,
			actual: unknown,
		) => string;
	}): Matcher<T, Async> {
		return new Matcher<T, Async>({
			code: () => description ?? this.toString(),
			check: (actual) => {
				actual = valueMapper(actual);
				const sub = this.check(actual);
				return messageMapper
					? seq(sub, (sub) => ({
							result: sub.result,
							message: messageMapper(sub.message, sub.result, actual),
						}))
					: sub;
			},
		});
	}
}

function identity<T>(value: T): T {
	return value;
}

function mapToTrivial(message: string, result: MatcherResultType): string {
	if (result === 'error') {
		return message;
	}
	return result === 'pass' ? 'matched' : 'failed';
}
