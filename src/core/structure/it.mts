import { getErrorMessage } from '../../utils/error.mts';
import type { MaybePromise } from '../../utils/types.mts';
import { TestAssertionError } from '../errors/TestAssertionError.mts';
import { TestAssumptionError } from '../errors/TestAssumptionError.mts';
import { TimeoutError } from '../errors/TimeoutError.mts';
import { stringifyPlain } from '../output/stringify.mts';
import type { BlockContext } from '../plugins/BlockContext.mts';
import { InternalContext, TEST_CONTEXT } from '../plugins/InternalContext.mts';
import { GLOBAL_PLUGIN_MANAGER } from '../plugins/plugin.mts';
import {
	addNode,
	type NodeOptions,
	type RunCallbacks,
	type RunResult,
	type StructureNode,
} from '../structure.mts';
import { UniqueNames } from '../UniqueNames.mts';
import { todo } from './todo.mts';

type TestContext<ParamT> = BlockContext & {
	/** the current parameterised test parameter (from `withParameters`) */
	parameter: ParamT;

	/** the current repetition count for repeated tests (begins at 1) */
	repetition: number;
};

export type TestBlock<ParamT> = (
	context: TestContext<ParamT>,
) => MaybePromise<void>;

export class TestConfig<ParamT> {
	private readonly _target: NodeOptions;
	private readonly _shared: boolean;

	constructor(target: NodeOptions, isShared = false) {
		this._target = target;
		this._shared = isShared;
	}

	/** skip this test */
	skip(): this {
		if (this._shared) {
			throw new Error(
				'cannot skip groups of tests - use describe.skip instead',
			);
		}
		this._target['skip'] = true;
		return this;
	}

	/** only run this test */
	focus(): this {
		if (this._shared) {
			throw new Error(
				'cannot skip groups of tests - use describe.focus instead',
			);
		}
		this._target['focus'] = true;
		return this;
	}

	/** expect this test to fail (if the test passes, it is reported as an error) */
	failing(expected?: string): this {
		this._target['failing'] = true;
		this._target['failingError'] = expected;
		return this;
	}

	/** run this test multiplt times to confirm it is not flakey */
	repeat(times: number, { maxFailures = 0 } = {}): this {
		this._target['repeat'] = times;
		this._target['minSuccess'] = times - maxFailures;
		return this;
	}

	/** run this test multiple times to work around flakiness */
	retry(times: number): this {
		this._target['repeat'] = times;
		this._target['minSuccess'] = 1;
		return this;
	}

	/** set a maximum time the test is allowed to take before automatically failing */
	withTimeout(milliseconds: number): this {
		this._target['timeout'] = milliseconds;
		return this;
	}

	/**
	 * Parameterise the test - the current value is available via `it('', ({ parameter }) => {...})`.
	 * See extras/params for some helpers which can be used here.
	 *
	 * If the parameters are objects with a `name` property, this is used for naming the test.
	 * Otherwise, the parameter is stringified to create the name for the test.
	 */
	withParameters(params: ParamT[]): this {
		if (this._shared) {
			throw new Error(
				'cannot set parameters for groups of tests - store the parameters in a constant and use it.with for each test instead',
			);
		}
		if (!params) {
			throw new Error('no parameters given');
		}
		this._target['params'] = params;
		return this;
	}
}

export class TestNode implements StructureNode {
	readonly path: string[];
	readonly block: TestBlock<unknown>;
	readonly options: NodeOptions;
	runnable = true;

	constructor(path: string[], block: TestBlock<any>, options: NodeOptions) {
		this.path = path;
		this.block = block;
		this.options = options;
	}

	split(): StructureNode[] {
		const params: unknown[] | null = this.options['params'] ?? null;
		if (!params) {
			return [];
		}
		this.runnable = false;
		const namer = new UniqueNames();
		return params.map(
			(param) =>
				new TestNode(
					[...this.path, namer.getName(toNiceName(param))],
					this.block,
					{ ...this.options, boring: params.length > 10, params: null, param },
				),
		);
	}

	async run({ begin, reportOverall, printLn }: RunCallbacks) {
		const repeat: number = Math.max(this.options['repeat'] ?? 1, 1);
		const minSuccess: number = Math.max(this.options['minSuccess'] ?? 1, 1);
		const failing: boolean = this.options['failing'] ?? false;
		const failingError: string | undefined = this.options['failingError'];
		const timeout: number = this.options['timeout'] ?? Number.POSITIVE_INFINITY;
		const param: unknown = this.options['param'] ?? null;

		const outcomeMappers: ((outcome: RunResult) => RunResult)[] = [];
		if (failing) {
			outcomeMappers.push(mapOutcomeFailing(failingError));
		}

		let passes = 0;
		const outcomes: RunResult[] = [];
		for (let repetition = 1; repetition <= repeat; ++repetition) {
			const internalContext = new InternalContext(
				repeat > 1
					? [...this.path, `[${repetition} / ${repeat}]`]
					: [...this.path],
				//parentContext, // TODO: this cannot come via TEST_CONTEXT; we must pass it around explicitly
			);
			const callback = begin(internalContext._testPath);
			const remaining = repeat - repetition;
			if (passes >= minSuccess || passes + 1 + remaining < minSuccess) {
				callback.complete({
					result: 'skip',
					err: new Error('threshold already reached'),
					duration: 0,
				});
				break;
			}
			const publicContext = {
				...internalContext._getPublicContext(),
				parameter: param,
				repetition,
			} as TestContext<unknown>;
			await GLOBAL_PLUGIN_MANAGER._beforeBlock(
				printLn, // TODO
				'test',
				internalContext,
				publicContext,
			);
			const {
				success,
				duration,
				error: err,
			} = await TEST_CONTEXT.run(
				{
					context: internalContext,
					timeout,
					ac: internalContext._ac,
					args: [publicContext],
				},
				this.block,
			);
			let outcome: RunResult;
			if (success) {
				outcome = { result: 'pass', duration };
			} else if (err instanceof TestAssumptionError) {
				outcome = { result: 'skip', err, duration };
			} else if (err instanceof TestAssertionError) {
				outcome = { result: 'fail', err, duration };
			} else if (err instanceof TimeoutError) {
				outcome = { result: 'timeout', err, duration };
			} else {
				outcome = { result: 'error', err, duration };
			}
			for (const mapper of outcomeMappers) {
				outcome = mapper(outcome);
			}
			if (outcome.result === 'pass') {
				++passes;
			}
			outcomes.push(outcome);
			callback.complete(outcome);
			await GLOBAL_PLUGIN_MANAGER._afterBlock(
				printLn, // TODO
				'test',
				internalContext,
				publicContext,
				outcome,
			);
		}
		const overallOutcome =
			passes >= minSuccess
				? outcomes.filter((o) => o.result === 'pass')[0]!
				: outcomes.filter((o) => o.result !== 'pass')[0]!;
		await GLOBAL_PLUGIN_MANAGER._afterRun(printLn, overallOutcome);
		reportOverall(overallOutcome);
	}
}

const mapOutcomeFailing =
	(expected?: string) =>
	(outcome: RunResult): RunResult => {
		if (outcome.result === 'fail') {
			if (!expected || getErrorMessage(outcome.err).includes(expected)) {
				return { result: 'pass', duration: outcome.duration };
			}
			return outcome;
		} else if (outcome.result === 'pass') {
			return {
				result: 'fail',
				err: new TestAssertionError('Expected test to fail, but passed'),
				duration: outcome.duration,
			};
		} else {
			return outcome;
		}
	};

type TestArgs<ParamT> = [name: string, block: TestBlock<ParamT>];

function withParameters<ParamT>(
	this: <ParamT>(...args: TestArgs<ParamT>) => TestConfig<ParamT>,
	params: ParamT[],
) {
	return (...args: TestArgs<ParamT>) => this(...args).withParameters(params);
}

const focus = Object.assign(
	/** Shorthand for `it(...).focus()` */
	<ParamT,>(...args: TestArgs<ParamT>) => it(...args).focus(),
	{
		/**
		 * Shorthand for `it(...).withParameters(...).focus()`.
		 * This version works better with TypeScript inference of types.
		 */
		with: withParameters,
	},
);

const skip = Object.assign(
	/** Shorthand for `it(...).skip()` */
	<ParamT,>(...args: TestArgs<ParamT>) => it(...args).skip(),
	{
		/**
		 * Shorthand for `it(...).withParameters(...).skip()`.
		 * This version works better with TypeScript inference of types.
		 */
		with: withParameters,
	},
);

export const it = Object.assign(
	/** Create a test. The given function will be executed with a test context. */
	function it<ParamT>(
		name: string,
		block: TestBlock<ParamT>,
	): TestConfig<ParamT> {
		const node = addNode(
			(parent) =>
				new TestNode([...parent.path, name], block, { ...parent.options }),
		);
		return new TestConfig(node.options);
	},
	{
		/**
		 * Shorthand for `it(...).withParameters(...)`.
		 * This version works better with TypeScript inference of types.
		 */
		with: withParameters,
		/** Shorthand for `it(...).focus()` */
		focus,
		/** Shorthand for `it(...).focus()` */
		only: focus,
		/** Shorthand for `it(...).skip()` */
		skip,
		/** Shorthand for `it(...).skip()` */
		ignore: skip,
		/**
		 * Placeholder for a test which has not yet been written.
		 * These will be reported at the end of the test run.
		 */
		todo,
	},
);

/** Shorthand for `it(...).focus()` */
export const fit = it.focus;
/** Shorthand for `it(...).skip()` */
export const xit = it.skip;

export const test = it;
/** Shorthand for `it(...).focus()` */
export const ftest = it.focus;
/** Shorthand for `it(...).skip()` */
export const xtest = it.skip;

function toNiceName(entity: unknown): string {
	if (
		typeof entity === 'object' &&
		entity &&
		'name' in entity &&
		typeof entity.name === 'string'
	) {
		return entity.name;
	}
	return stringifyPlain(entity);
}
