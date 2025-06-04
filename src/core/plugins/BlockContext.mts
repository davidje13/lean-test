import type { MaybePromise } from '../../utils/types.mts';
import type { Ptr } from './Ptr.mts';

declare global {
	interface ExtendableBlockContext {}
}

export type CoreBlockContext = {
	/** the path to the current test (e.g. `['./myFile.js', 'my describe', 'my test']`) */
	testPath: string[];

	/**
	 * Fires if the current stage times out or is cancelled by the user.
	 * Using this is optional, but can help avoid confusing output caused
	 * by a test continuing after it has timed out.
	 */
	signal: AbortSignal;

	/**
	 * Register a teardown to run after the test has completed.
	 * These are executed in reverse registration order.
	 */
	addTeardown(fn: (context: TeardownBlockContext) => MaybePromise<void>): void;

	/** type-safe getter for scoped pointer values */
	get: <T>(ptr: Ptr<T>) => T;
} & {
	// https://github.com/microsoft/TypeScript/issues/22509
	// https://github.com/microsoft/TypeScript/issues/35986
	/**
	 * Getters for scoped pointer values.
	 * Note that for non-trivial types you can use `get` instead for better TypeScript compatibility.
	 */
	[K in
		| Ptr<string>
		| Ptr<number>
		| Ptr<boolean>
		| Ptr<bigint>
		| Ptr<symbol>
		| Ptr<unknown>]: K extends Ptr<infer T> ? T : never;
};

export type TeardownBlockContext = Omit<BlockContext, 'addTeardown'>;

export type BlockContext = CoreBlockContext & ExtendableBlockContext;
