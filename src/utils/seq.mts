import type { MaybeFunction } from './types.mts';
import { VerifiedPromise } from './VerifiedPromise.mts';

export const asFunction = (value: MaybeFunction<unknown>): (() => unknown) =>
	typeof value === 'function' ? (value as () => unknown) : () => value;

/** same as then(await result), but synchronous if result is not a promise */
export function seq<A, B, Async extends boolean>(
	result: (Async extends true ? Promise<A> : never) | A,
	then: (r: A) => (Async extends true ? Promise<B> : never) | B,
	err?: (err: unknown) => (Async extends true ? Promise<B> : never) | B,
): (Async extends true ? Promise<B> : never) | B {
	// TypeScript does not recognise `result instanceof Promise` as
	// narrowing `A extends Promise<unknown>`, so we must apply some type hacks:
	if (result instanceof Promise || result instanceof VerifiedPromise) {
		return result.then(then, err) as any;
	} else {
		return then(result);
	}
}

export function seqFn<A, B, Async extends boolean>(
	fn: () => (Async extends true ? Promise<A> : never) | A,
	then: (r: A) => (Async extends true ? Promise<B> : never) | B,
	err: (err: unknown) => (Async extends true ? Promise<B> : never) | B,
): (Async extends true ? Promise<B> : never) | B {
	try {
		return seq(fn(), then, err);
	} catch (e: unknown) {
		return err(e);
	}
}
