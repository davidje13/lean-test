import type { MaybePromise, TypeOf } from '../../utils/types.mts';
import type { RunResult } from '../structure.mts';
import type { BlockContext } from './BlockContext.mts';
import {
	GLOBAL_CONTEXT,
	TEST_CONTEXT,
	type InternalContext,
} from './InternalContext.mts';
import type { TestPluginPtr } from './TestPluginPtr.mts';

interface OptionDefinition<T> {
	name: string;
	type: TypeOf<T>;
	default: T;
	description: string;
}

type OptionsDefinition<T> = { [K in keyof T]: OptionDefinition<T[K]> };

type BlockType = 'test' | 'beforeEach' | 'beforeAll' | 'afterEach' | 'afterAll';

interface TestPluginContext<Options> {
	options: Options;
	printLn: (ln: string) => void;
}

interface TestPluginBeforeAllContext<Options>
	extends TestPluginContext<Options> {}

interface TestPluginBlockContext<Options> extends TestPluginContext<Options> {
	type: BlockType;
	getBlockScoped: <T>(ptr: TestPluginPtr<T>) => T;
	context: BlockContext;
}

interface TestPluginBeforeBlockContext<Options>
	extends TestPluginBlockContext<Options> {
	previousBlock: TestPluginBlockContext<Options> | null;
}

interface TestPluginAfterBlockContext<Options>
	extends TestPluginBlockContext<Options> {
	outcome: RunResult;
}

interface TestPluginAfterRunContext<Options>
	extends TestPluginContext<Options> {
	outcome: RunResult;
}

interface TestPluginAfterAllContext<Options>
	extends TestPluginContext<Options> {}

export interface TestPlugin<Options> {
	order?: number;

	options: OptionsDefinition<Options>;

	/** called when the plugin is first registered */
	beforeAll?(
		pluginContext: TestPluginBeforeAllContext<Options>,
	): MaybePromise<void>;

	/** called before a test or lifecycle hook is executed (called repeatedly for the same test if it is repeated) */
	beforeBlock?(
		pluginContext: TestPluginBeforeBlockContext<Options>,
	): MaybePromise<void>;

	/** called after a test or lifecycle hook is executed (called repeatedly for the same test if it is repeated) */
	afterBlock?(
		pluginContext: TestPluginAfterBlockContext<Options>,
	): MaybePromise<void>;

	/** called after a test has finished running (after all teardowns have completed, and only called once even if the test is repeated) */
	afterRun?(
		pluginContext: TestPluginAfterRunContext<Options>,
	): MaybePromise<void>;

	/** called at the end of the whole test suite */
	afterAll?(
		pluginContext: TestPluginAfterAllContext<Options>,
	): MaybePromise<void>;
}

class TestPluginManager {
	private _locked = false;
	private readonly _registeredPlugins = new Set<TestPlugin<unknown>>();
	private _orderedPlugins: TestPlugin<unknown>[] = [];

	_add<Options>(plugin: TestPlugin<Options>): void {
		if (this._locked) {
			throw new Error('Cannot register plugin after tests have started');
		}
		this._registeredPlugins.add(plugin);
	}

	async _beforeAll(printLn: (ln: string) => void) {
		if (this._locked) {
			throw new Error('Test suite started multiple times');
		}
		this._orderedPlugins = [...this._registeredPlugins].sort(
			(a, b) => (a.order ?? 0) - (b.order ?? 0),
		);
		this._locked = true;
		for (const testPlugin of this._orderedPlugins) {
			if (testPlugin.beforeAll) {
				await testPlugin.beforeAll({
					options: {}, // TODO
					printLn,
				});
			}
		}
	}

	async _beforeBlock(
		printLn: (ln: string) => void,
		type: BlockType,
		internalContext: InternalContext,
		publicContext: BlockContext,
	) {
		for (const testPlugin of this._orderedPlugins) {
			if (testPlugin.beforeBlock) {
				await testPlugin.beforeBlock({
					options: {}, // TODO
					printLn,
					getBlockScoped: (ptr) => internalContext._getPluginValue(ptr),
					context: publicContext,
					type,
					previousBlock: null, // TODO
				});
			}
		}
	}

	async _afterBlock(
		printLn: (ln: string) => void,
		type: BlockType,
		internalContext: InternalContext,
		publicContext: BlockContext,
		outcome: RunResult,
	) {
		for (const testPlugin of this._orderedPlugins) {
			if (testPlugin.afterBlock) {
				await testPlugin.afterBlock({
					options: {}, // TODO
					printLn,
					getBlockScoped: (ptr) => internalContext._getPluginValue(ptr),
					context: publicContext,
					type,
					outcome,
				});
			}
		}
	}

	async _afterRun(printLn: (ln: string) => void, outcome: RunResult) {
		for (const testPlugin of this._orderedPlugins) {
			if (testPlugin.afterRun) {
				await testPlugin.afterRun({
					options: {}, // TODO
					printLn,
					outcome,
				});
			}
		}
	}

	async _afterAll(printLn: (ln: string) => void) {
		for (const testPlugin of this._orderedPlugins) {
			if (testPlugin.afterAll) {
				await testPlugin.afterAll({
					options: {}, // TODO
					printLn,
				});
			}
		}
	}
}

export const GLOBAL_PLUGIN_MANAGER = new TestPluginManager();

export const plugin = {
	add<Options>(plugin: TestPlugin<Options>): void {
		GLOBAL_PLUGIN_MANAGER._add(plugin);
	},

	isInTest(): boolean {
		return Boolean(TEST_CONTEXT.get());
	},

	getGlobal<T>(ptr: TestPluginPtr<T>): T {
		return GLOBAL_CONTEXT._getPluginValue(ptr);
	},

	getBlockScoped<T>(ptr: TestPluginPtr<T>): T | undefined {
		return TEST_CONTEXT.get()?._getPluginValue(ptr);
	},

	getBlockScopedOrGlobal<T>(ptr: TestPluginPtr<T>): T {
		return (TEST_CONTEXT.get() ?? GLOBAL_CONTEXT)._getPluginValue(ptr);
	},
};
