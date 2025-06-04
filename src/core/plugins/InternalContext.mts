import type { MaybePromise } from '../../utils/types.mts';
import type {
	CoreBlockContext,
	TeardownBlockContext,
} from './BlockContext.mts';
import type { Ptr } from './Ptr.mts';
import { StackScope } from './StackScope.mts';
import type { TestPluginPtr } from './TestPluginPtr.mts';

export class InternalContext {
	_testPath: string[];
	_stage: 'before' | 'test' | 'after' = 'before';
	_teardowns: ((context: TeardownBlockContext) => MaybePromise<void>)[] = [];
	_values = new Map<Ptr<unknown>, unknown>();
	_internalValues = new Map<TestPluginPtr<unknown>, unknown>();
	_ac = new AbortController();

	constructor(testPath: string[], inherited?: InternalContext | null) {
		this._testPath = testPath;
		if (inherited) {
			for (const [ptr, value] of inherited._values) {
				this._values.set(ptr, value);
			}
		}
	}

	_getPluginValue<T>(key: TestPluginPtr<T>): T {
		if (this._internalValues.has(key)) {
			return this._internalValues.get(key) as T;
		}
		const v = key();
		this._internalValues.set(key, v);
		return v;
	}

	_getPublicContext(): CoreBlockContext {
		const context: CoreBlockContext = {
			testPath: this._testPath,
			addTeardown: (fn) => {
				if (this._stage === 'after') {
					throw new Error(
						'cannot register new teardown after test has finished',
					);
				}
				this._teardowns.push(fn);
			},
			get: <T,>(ptr: Ptr<T>): T => this._values.get(ptr) as T,
			signal: this._ac.signal,
		};
		for (const [ptr, value] of this._values) {
			context[ptr] = value;
		}
		return context;
	}
}

export const TEST_CONTEXT = new StackScope<InternalContext>('TEST');
export const GLOBAL_CONTEXT = new InternalContext([]);

export const getTestAbortSignal = () => TEST_CONTEXT.get()?._ac.signal;
