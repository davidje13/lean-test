import type { MaybePromise, OptionalFirstArg } from '../utils/types.mts';
import type { Context, Ptr } from './context.mts';

type AfterBlock = (context: Omit<Context, 'addTeardown'>) => MaybePromise<void>;
type BeforeBlock<T> = (
	context: Omit<Context, 'countExpectations'>,
) => MaybePromise<T>;

export function afterAll(
	...args: OptionalFirstArg<[name: string], [fn: AfterBlock]>
) {}

export function afterEach(
	...args: OptionalFirstArg<[name: string], [fn: AfterBlock]>
) {}

export function beforeAll<T = void>(
	...args: OptionalFirstArg<[name: string], [fn: BeforeBlock<T>]>
): T extends void ? void : Ptr<T> {}

export function beforeEach<T = void>(
	...args: OptionalFirstArg<[name: string], [fn: BeforeBlock<T>]>
): T extends void ? void : Ptr<T> {}
