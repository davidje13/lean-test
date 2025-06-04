import { Matcher, type MatcherResult } from '../../core/index.mts';
import type { OptionallyAsync } from '../../utils/types.mts';
import { VerifiedPromise } from '../../utils/VerifiedPromise.mts';

type GetMatcher<Async extends boolean> = (
	index: number,
	allItems: unknown[],
) => Matcher<unknown, Async> | MatcherResult;

type MapResult = (result: MatcherResult, index: number) => MatcherResult | null;

type Completed = (allItems: unknown[]) => MatcherResult;

export interface CheckIterableConfig<Async extends boolean> {
	getMatcher: GetMatcher<Async>;
	mapResult: MapResult;
	completed: Completed;
}

export function checkIterable<Async extends boolean>(
	actual: Iterable<unknown>,
	opts: CheckIterableConfig<Async>,
): OptionallyAsync<MatcherResult, Async> {
	const checked: unknown[] = [];
	const iterator = actual[Symbol.iterator]();
	const continueLoop = (
		result: MatcherResult | null,
	): OptionallyAsync<MatcherResult, Async> => {
		if (result) {
			const mapped = opts.mapResult(result, checked.length - 1);
			if (mapped) {
				return mapped;
			}
		}
		while (true) {
			const step = iterator.next();
			if (step.done) {
				return opts.completed(checked);
			}
			checked.push(step.value);
			const subMatcher = opts.getMatcher(checked.length - 1, checked);
			if (!(subMatcher instanceof Matcher)) {
				return subMatcher;
			}
			const nextResult = subMatcher.check(step.value);
			if (
				nextResult instanceof Promise ||
				nextResult instanceof VerifiedPromise
			) {
				return nextResult.then(continueLoop) as unknown as MatcherResult;
			} else {
				const mapped = opts.mapResult(nextResult, checked.length - 1);
				if (mapped) {
					return mapped;
				}
			}
		}
	};
	return continueLoop(null);
}

export async function checkAsyncIterable(
	actual: AsyncIterable<unknown>,
	opts: CheckIterableConfig<boolean>,
): Promise<MatcherResult> {
	const checked: unknown[] = [];
	for await (const item of actual) {
		checked.push(item);
		const subMatcher = opts.getMatcher(checked.length - 1, checked);
		if (!(subMatcher instanceof Matcher)) {
			return subMatcher;
		}
		const result = await subMatcher.check(item);
		const mapped = opts.mapResult(result, checked.length - 1);
		if (mapped) {
			return mapped;
		}
	}
	return opts.completed(checked);
}
