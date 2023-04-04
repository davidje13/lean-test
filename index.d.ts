type MaybeAsync<T> = Promise<T> | T;
type AsyncChain<A, T> = (A extends Promise<any> ? Promise<T> : T);
type LengthHaver = { length: number } | { size: number };

interface WriteStream {
	write(value: string): void;
	readonly isTTY: boolean;
}

export interface MatcherResult {
	readonly pass: boolean;
	readonly message: (() => string) | string;
}

export type SyncMatcher<T> = (actual: T) => MatcherResult;
export type AsyncMatcher<T> = (actual: T) => Promise<MatcherResult>;
export type Matcher<T> = (actual: T) => MaybeAsync<MatcherResult>;

type FluentExpect<T> = {
	readonly [K in keyof matchers]: (
		ReturnType<matchers[K]> extends Matcher<T>
		? ((...args: Parameters<matchers[K]>) => AsyncChain<ReturnType<ReturnType<matchers[K]>>, void>)
		: never
	);
};

interface PollOptions {
	timeout?: number;
	interval?: number;
}

type Assume = (
	(<T, M extends Matcher<T>>(actual: T, matcher: M) => AsyncChain<ReturnType<M>, void>) &
	(<T>(actual: T) => FluentExpect<T>)
);

type Expect = Assume & {
	extend: (matchers: Record<string, (...args: unknown[]) => Matcher<unknown>>) => void;
	poll: <T>(expr: () => T, matcher: Matcher<T>, options?: PollOptions) => Promise<void>;
};

export type TypedParameter<T> = symbol & { _type?: { t: T } };

export type TypedParameters = {
	// TODO: value should be typed according to key, i.e.:
	// [k: K extends TypedParameter<infer T>]: T;
	// (not supported TypeScript syntax)
	// Once this is possible, we can remobve the getTyped helper function.
	readonly [k: TypedParameter<any>]: unknown;

	getTyped<T>(key: TypedParameter<T>): T;
};

export type Plugin = (builder: Runner.Builder) => void;

type ColourFn = (value: string, fallback: string) => string;

export interface Output {
	write(value: string, linePrefix?: string, continuationPrefix?: string): void;
	writeRaw(value: string): void;

	readonly bold: ColourFn;
	readonly faint: ColourFn;
}

export interface Reporter {
	report(result: Result): void;
}

export interface LiveReporter {
	readonly eventListener: TestEventHandler;
}

export interface ResultInfo {
	readonly id: string;
	readonly parent: string | null;
	readonly label: string | null;
}

export interface ResultSummary {
	readonly count: number;
	readonly run: number;
	readonly error: number;
	readonly fail: number;
	readonly skip: number;
	readonly pass: number;
	readonly duration: number;
}

export interface StackItem {
	readonly name: string;
	readonly location: string;
}

export interface ResultError {
	readonly message: string;
	readonly stackList: StackItem[];
}

export interface Result extends ResultInfo {
	readonly summary: ResultSummary;
	readonly errors: ResultError[],
	readonly failures: ResultError[],
	readonly output: string,
	readonly children: Result[],
}

export interface TestBeginEvent extends ResultInfo {
	readonly type: 'begin';
	readonly time: number;
	readonly isBlock: boolean;
}

export interface TestCompleteEvent extends Result {
	readonly type: 'complete';
	readonly time: number;
	readonly isBlock: boolean;
}

type ParameterOptions<T extends unknown[]> = Set<T> | Set<T[0]> | T;

interface NodeOptions {
	readonly focus?: boolean;
	readonly ignore?: boolean;
	readonly parameters?: ParameterOptions<unknown[]>[] | ParameterOptions<unknown[]>;
	readonly parameterFilter?: (...params: any[]) => boolean;
	readonly repeat?: number | {
		readonly total: number;
		readonly failFast?: boolean;
		readonly maxFailures?: number;
	};
	readonly retry?: number;
	readonly stopAtFirstFailure?: boolean;
	readonly timeout?: number;
	readonly [K: string]: unknown;
}

type TestImplementation = (typedParameters: TypedParameters, ...args: any[]) => MaybeAsync<void>;
interface DescribeObject {
	readonly [K: string]: DescribeObject | TestImplementation;
}
type DescribeImplementation = ((globals: DiscoveryGlobals) => MaybeAsync<DescribeImplementation | void>) | DescribeObject;
type WithOptions<T> = T & {
	readonly ignore: T;
	readonly focus: T;
};
type Describe = WithOptions<
	((name: string, fn: DescribeImplementation, options?: NodeOptions) => void) &
	((name: string, options: NodeOptions, fn: DescribeImplementation) => void)
>;
type Test = WithOptions<
	((name: string, fn: TestImplementation, options?: NodeOptions) => void) &
	((name: string, options: NodeOptions, fn: TestImplementation) => void)
>;

type LifecycleHookBeforeOps<T> = TypedParameters & {
	/**
	 * @deprecated use setParameter instead:
	 *
	 * ```
	 * const MY_PROPERTY = beforeEach(({ setParameter }) => {
	 *   setParameter(1);
	 * });
	 *
	 * it('my test', ({ [MY_PROPERTY]: myProperty }) => {
	 *   console.log('got', myProperty);
	 * });
	 * ```
	 */
	readonly addTestParameter: (...parameters: unknown[]) => void;

	readonly setParameter: (parameter: T) => void;
};
type LifecycleHookBefore<T> = (operations: LifecycleHookBeforeOps<T>) => MaybeAsync<void | (() => MaybeAsync<void>)>;
type GetOutput = ((binary?: false) => string) & ((binary: true) => unknown); // unknown = Buffer

type LifecycleHookAfter = (values: TypedParameters) => MaybeAsync<void>;
type BeforeFunc = (
	(<T>(name: string, fn: LifecycleHookBefore<T>) => TypedParameter<T>) &
	(<T>(fn: LifecycleHookBefore<T>) => TypedParameter<T>)
);
type AfterFunc = (
	((name: string, fn: LifecycleHookAfter) => void) &
	((fn: LifecycleHookAfter) => void)
);

export interface DiscoveryGlobals extends matchers {
	readonly describe: Describe;
	readonly test: Test;
	readonly it: Test;
	readonly expect: Expect;
	readonly assume: Assume;
	fail(message?: string): void;
	skip(message?: string): void;
	readonly beforeAll: BeforeFunc;
	readonly beforeEach: BeforeFunc;
	readonly afterEach: AfterFunc;
	readonly afterAll: AfterFunc;
	readonly getStdout: GetOutput;
	readonly getStderr: GetOutput;
	readonly getOutput: GetOutput;
	readonly mock: typeof helpers.mock;
}

export type TestEvent = TestBeginEvent | TestCompleteEvent;
export type TestEventHandler = (e: TestEvent) => void;

export type RunContext = Record<string | symbol, unknown>;

export interface ReadonlyNode {
	readonly options: NodeOptions;
	readonly children: Node[];
}

export interface Node extends ReadonlyNode {
	run(context: RunContext, parentResult?: Result): MaybeAsync<void>;
}

interface NodeConfig {
	readonly display: string | null;
	readonly isBlock?: boolean;
	readonly discovery?: (node: Node, methods: DiscoveryGlobals) => MaybeAsync<void>;
	readonly discoveryFrames?: number;
	readonly [K: string]: unknown;
}

type ExtensionKey = string | symbol;

interface MethodThis {
	getCurrentNodeScope(scope: string | symbol): unknown;
	extend(key: ExtensionKey, ...values: unknown[]): void;
	get(key: ExtensionKey): unknown[];
}

type RunInterceptor = (
	next: (context?: RunContext, result?: Result) => MaybeAsync<void>,
	context: RunContext,
	result: Result,
	node: Node,
) => MaybeAsync<void>;
type RunCondition = () => MaybeAsync<boolean>;

export class TestAssertionError extends Error {
	constructor(message: string, skipFrames?: number);
}

export class TestAssumptionError extends Error {
	constructor(message: string, skipFrames?: number);
}

export type SharedState = Record<string | symbol, unknown>;

export interface Orderer {
	order<T extends ReadonlyNode>(list: T[]): T[];
	sub(node: ReadonlyNode): Orderer;
}

export interface AbstractRunner {
	prepare(sharedState: SharedState): Promise<void>;
	teardown(sharedState: SharedState): Promise<void>;
	invoke(
		listener: TestEventHandler | null | undefined,
		sharedState: SharedState,
	): Promise<Result>;
	run(
		listener?: TestEventHandler | null | undefined,
		sharedState?: SharedState | undefined,
	): Promise<Result>;
}

interface Runner extends AbstractRunner {}
declare namespace Runner {
	class Builder {
		constructor();
		useParallelDiscovery(enabled?: boolean): Builder;
		useParallelSuites(enabled?: boolean): Builder;
		useExecutionOrderer(orderer: Orderer | null | undefined): Builder;
		addPlugin(...plugins: Plugin[]): Builder;
		extend(key: ExtensionKey, ...values: unknown[]): Builder;
		addRunInterceptor(fn: RunInterceptor, options?: { order?: number, id?: unknown }): Builder;
		addRunCondition(fn: RunCondition, options?: { id?: unknown }): Builder;
		addSuite(name: string, fn: DescribeImplementation, options?: NodeOptions): Builder;
		addSuites(suites: Record<string, DescribeImplementation>): Builder;
		addScope(defaults: { node?: () => unknown, context?: () => unknown }): symbol;
		addNodeType(key: string | symbol, optionsFactory: (...args: unknown[]) => NodeOptions, config: NodeConfig): Builder;
		addNodeOption(name: string, options: NodeOptions): Builder;
		addGlobals(globals: Record<string, unknown | ((this: MethodThis, ...args: unknown[]) => unknown)>): Builder;
		build(): Promise<Runner>;
	}
}
export { Runner };

export class ParallelRunner implements AbstractRunner {
	constructor();
	prepare(sharedState: SharedState): Promise<void>;
	teardown(sharedState: SharedState): Promise<void>;
	invoke(listener: TestEventHandler, sharedState: SharedState): Promise<Result>;
	run(listener?: TestEventHandler, sharedState?: SharedState): Promise<Result>;

	add(label: string, runner: AbstractRunner): void;
}

type Methods<T> = {
	readonly [k in keyof T]: T[k] extends (...args: any[]) => any ? T[k] : never;
};

interface MockAction<T extends (...args: any[]) => any> {
	with(...expectedArgs: Parameters<T>): MockAction<T>;
	once(): MockAction<T>;
	times(n: number): MockAction<T>;
	then(fn: T): Mocking<T>;
	thenReturn(value: ReturnType<T>): Mocking<T>;
	thenResolve(value: unknown): Mocking<T>;
	thenReject(value: unknown): Mocking<T>;
	thenThrow(error: unknown): Mocking<T>;
}

type Mocking<T extends (...args: any) => any> = T & {
	whenCalled(): MockAction<T>;
	whenCalledNext(): MockAction<T>;
	whenCalledWith(...args: Parameters<T>): MockAction<T>;
	returning(value: ReturnType<T>): Mocking<T>;
	throwing(error: unknown): Mocking<T>;
	reset(): Mocking<T>;
};

export namespace helpers {
	function mock<T extends (...args: any[]) => any>(name?: string, delegate?: T): Mocking<T>;
	function mock<T extends (...args: any[]) => any>(delegate: T): Mocking<T>;
	function mock<T, K extends keyof Methods<T>>(object: T, key: K):
		T[K] extends ((...args: any) => any) ? Mocking<T[K]> & { revert(): void } : never;
}

export namespace outputs {
	class Writer implements Output {
		constructor(writer: WriteStream, forceTTY?: boolean);
		write(value: string, linePrefix?: string, continuationPrefix?: string): void;
		writeRaw(value: string): void;
		readonly bold: ColourFn;
		readonly faint: ColourFn;
	}
}

export namespace reporters {
	class Full implements Reporter {
		constructor(output: Output);
		report(result: Result): void;
	}
	class ErrorList implements Reporter {
		constructor(output: Output);
		report(result: Result): void;
	}
	class Summary implements Reporter {
		constructor(output: Output);
		report(result: Result): void;
	}
	class Dots implements LiveReporter {
		constructor(output: Output);
		eventListener: TestEventHandler;
	}
}

export namespace orderers {
	class SeededRandom implements Orderer {
		constructor(seed?: SeededRandom | string | null | undefined);
		getSeed(): string;
		next(range: number): number;
		order<T>(list: T[]): T[];
		sub(): Orderer;
	}
}

export class ExitHook {
	constructor(hook: () => Promise<void> | void);

	add(): void;
	remove(): void;
	ifExitDuring<T>(fn: () => Promise<T> | T): Promise<T>;
	ifExitDuringOrFinally<T>(fn: () => Promise<T> | T): Promise<T>;
}

type Precision =
	(expected: number) => number |
	{ readonly tolerance: number } |
	{ readonly decimalPlaces: number };

type SyncMatchersOrValues<T> = {
	readonly [k in keyof T]: SyncMatcher<T[k]> | T[k];
};

interface matchers {
	readonly any: () => SyncMatcher<unknown>;
	readonly equals: <T>(expected: T) => SyncMatcher<T | undefined | null>;
	readonly same: <T>(expected: T) => SyncMatcher<T | undefined | null>;
	readonly isInstanceOf: (expected: unknown) => SyncMatcher<unknown>;
	readonly matches: (expected: RegExp) => SyncMatcher<string | undefined | null>;
	readonly not: <M extends Matcher<any>>(matcher: M) => M;
	readonly withMessage: <M extends Matcher<any>>(message: string, matcher: M) => M;
	readonly isTrue: () => SyncMatcher<unknown>;
	readonly isFalse: () => SyncMatcher<unknown>;
	readonly isTruthy: () => SyncMatcher<unknown>;
	readonly isFalsy: () => SyncMatcher<unknown>;
	readonly isNull: () => SyncMatcher<unknown>;
	readonly isUndefined: () => SyncMatcher<unknown>;
	readonly isNullish: () => SyncMatcher<unknown>;
	readonly isGreaterThan: (value: number) => SyncMatcher<number>;
	readonly isLessThan: (value: number) => SyncMatcher<number>;
	readonly isGreaterThanOrEqual: (value: number) => SyncMatcher<number>;
	readonly isLessThanOrEqual: (value: number) => SyncMatcher<number>;
	readonly isNear: (value: number, precision?: Precision) => SyncMatcher<number>;
	readonly resolves: <T>(expectation?: SyncMatcher<T> | T) => (
		SyncMatcher<() => T> &
		AsyncMatcher<Promise<T> | (() => Promise<T>)>
	);
	readonly throws: (expectation?: SyncMatcher<unknown> | RegExp | string) => (
		SyncMatcher<() => unknown> &
		AsyncMatcher<Promise<unknown> | (() => Promise<unknown>)>
	);
	readonly hasLength: (expectation?: SyncMatcher<number> | number) => SyncMatcher<LengthHaver | undefined | null>;
	readonly isEmpty: () => SyncMatcher<LengthHaver | undefined | null>;
	readonly contains: (expectation?: SyncMatcher<any> | string | unknown) => SyncMatcher<string | Array<unknown> | Set<unknown> | undefined | null>;
	readonly startsWith: (expected: string) => SyncMatcher<string>;
	readonly endsWith: (expected: string) => SyncMatcher<string>;
	readonly isListOf: (...expectation: (SyncMatcher<any> | unknown)[]) => SyncMatcher<Array<unknown> | undefined | null>;
	readonly hasProperty: (name: symbol | string | number, expectation?: SyncMatcher<any> | unknown) => SyncMatcher<unknown>;

	readonly hasBeenCalled: (options?: { times?: number }) => SyncMatcher<(...args: unknown[]) => unknown>;
	readonly hasBeenCalledWith: <T extends (...args: any[]) => any>(...args: SyncMatchersOrValues<Parameters<T>>[]) => SyncMatcher<T>;

	// compatibility aliases
	readonly toEqual: <T>(expected: T) => SyncMatcher<T | undefined | null>;
	readonly toBe: <T>(expected: T) => SyncMatcher<T | undefined | null>;
	readonly toBeInstanceOf: (expected: unknown) => SyncMatcher<unknown>;
	readonly toMatch: (expected: RegExp) => SyncMatcher<string | undefined | null>;
	readonly toBeTruthy: () => SyncMatcher<unknown>;
	readonly toBeFalsy: () => SyncMatcher<unknown>;
	readonly toBeNull: () => SyncMatcher<unknown>;
	readonly toBeUndefined: () => SyncMatcher<unknown>;
	readonly toThrow: (expectation?: SyncMatcher<any> | RegExp | string) => (
		SyncMatcher<() => unknown> &
		AsyncMatcher<Promise<unknown> | (() => Promise<unknown>)>
	);
	readonly toBeGreaterThan: (value: number) => SyncMatcher<number>;
	readonly toBeLessThan: (value: number) => SyncMatcher<number>;
	readonly toBeGreaterThanOrEqual: (value: number) => SyncMatcher<number>;
	readonly toBeLessThanOrEqual: (value: number) => SyncMatcher<number>;
	readonly toBeCloseTo: (value: number, precision?: Precision) => SyncMatcher<number>;
	readonly toHaveLength: (expectation?: SyncMatcher<number> | number) => SyncMatcher<LengthHaver | undefined | null>;
	readonly toContain: (expectation?: SyncMatcher<any> | string | unknown) => SyncMatcher<string | Array<unknown> | Set<unknown> | undefined | null>;
	readonly toHaveProperty: (name: symbol | string | number, expectation?: SyncMatcher<any> | unknown) => SyncMatcher<unknown>;

	readonly toHaveBeenCalled: (options?: { times?: number }) => SyncMatcher<(...args: unknown[]) => unknown>;
	readonly toHaveBeenCalledWith: <T extends (...args: any[]) => any>(...args: SyncMatchersOrValues<Parameters<T>>[]) => SyncMatcher<T>;
}
export const matchers: matchers;

interface plugins {
	readonly describe: (fnName?: string | symbol, options?: {
		display?: string;
		testFn?: string | symbol;
		subFn?: string | symbol;
	}) => Plugin;

	readonly expect: (() => Plugin) & {
		readonly matchers: (matchers: Record<string, (...args: unknown[]) => Matcher<unknown>>) => Plugin;
	};
	readonly fail: () => Plugin;
	readonly focus: () => Plugin;
	readonly ignore: () => Plugin;
	readonly lifecycle: (options?: { order?: number }) => Plugin;
	readonly parameterised: (options?: { order?: number }) => Plugin;
	readonly scopedMock: () => Plugin;
	readonly outputCaptor: (options?: { order?: number }) => Plugin;
	readonly repeat: (options?: { order?: number }) => Plugin;
	readonly retry: (options?: { order?: number }) => Plugin;
	readonly stopAtFirstFailure: () => Plugin;
	readonly test: (fnName?: string | symbol) => Plugin;
	readonly timeout: (options?: { order?: number }) => Plugin;
}
export const plugins: plugins;

export function standardRunner(): Runner.Builder;

declare global { // same as DiscoveryGlobals + matchers
	const describe: Describe;
	const test: Test;
	const it: Test;
	const expect: Expect;
	const assume: Assume;
	const fail: (message?: string) => void;
	const skip: (message?: string) => void;
	const beforeAll: BeforeFunc;
	const beforeEach: BeforeFunc;
	const afterEach: AfterFunc;
	const afterAll: AfterFunc;
	const getStdout: GetOutput;
	const getStderr: GetOutput;
	const getOutput: GetOutput;
	const mock: typeof helpers.mock;

	const any: () => SyncMatcher<unknown>;
	const equals: <T>(expected: T) => SyncMatcher<T | undefined | null>;
	const same: <T>(expected: T) => SyncMatcher<T | undefined | null>;
	const isInstanceOf: (expected: unknown) => SyncMatcher<unknown>;
	const matches: (expected: RegExp) => SyncMatcher<string | undefined | null>;
	const not: <M extends Matcher<any>>(matcher: M) => M;
	const withMessage: <M extends Matcher<any>>(message: string, matcher: M) => M;
	const isTrue: () => SyncMatcher<unknown>;
	const isFalse: () => SyncMatcher<unknown>;
	const isTruthy: () => SyncMatcher<unknown>;
	const isFalsy: () => SyncMatcher<unknown>;
	const isNull: () => SyncMatcher<unknown>;
	const isUndefined: () => SyncMatcher<unknown>;
	const isNullish: () => SyncMatcher<unknown>;
	const isGreaterThan: (value: number) => SyncMatcher<number>;
	const isLessThan: (value: number) => SyncMatcher<number>;
	const isGreaterThanOrEqual: (value: number) => SyncMatcher<number>;
	const isLessThanOrEqual: (value: number) => SyncMatcher<number>;
	const isNear: (value: number, precision?: Precision) => SyncMatcher<number>;
	const resolves: <T>(expectation?: SyncMatcher<T> | T) => (
		SyncMatcher<() => T> &
		AsyncMatcher<Promise<T> | (() => Promise<T>)>
	);
	const throws: (expectation?: SyncMatcher<any> | RegExp | string) => (
		SyncMatcher<() => unknown> &
		AsyncMatcher<Promise<unknown> | (() => Promise<unknown>)>
	);
	const hasLength: (expectation?: SyncMatcher<number> | number) => SyncMatcher<LengthHaver | undefined | null>;
	const isEmpty: () => SyncMatcher<LengthHaver | undefined | null>;
	const contains: (expectation?: SyncMatcher<any> | string | unknown) => SyncMatcher<string | Array<unknown> | Set<unknown> | undefined | null>;
	const startsWith: (expected: string) => SyncMatcher<string>;
	const endsWith: (expected: string) => SyncMatcher<string>;
	const isListOf: (...expectation: (SyncMatcher<any> | unknown)[]) => SyncMatcher<Array<unknown> | undefined | null>;
	const hasProperty: (name: symbol | string | number, expectation?: SyncMatcher<any> | unknown) => SyncMatcher<unknown>;

	const hasBeenCalled: (options?: { times?: number }) => SyncMatcher<(...args: unknown[]) => unknown>;
	const hasBeenCalledWith: <T extends (...args: any[]) => any>(...args: SyncMatchersOrValues<Parameters<T>>[]) => SyncMatcher<T>;

	// compatibility aliases
	const toEqual: <T>(expected: T) => SyncMatcher<T | undefined | null>;
	const toBe: <T>(expected: T) => SyncMatcher<T | undefined | null>;
	const toBeInstanceOf: (expected: unknown) => SyncMatcher<unknown>;
	const toMatch: (expected: RegExp) => SyncMatcher<string | undefined | null>;
	const toBeTruthy: () => SyncMatcher<unknown>;
	const toBeFalsy: () => SyncMatcher<unknown>;
	const toBeNull: () => SyncMatcher<unknown>;
	const toBeUndefined: () => SyncMatcher<unknown>;
	const toThrow: (expectation?: SyncMatcher<any> | RegExp | string) => (
		SyncMatcher<() => unknown> &
		AsyncMatcher<Promise<unknown> | (() => Promise<unknown>)>
	);
	const toBeGreaterThan: (value: number) => SyncMatcher<number>;
	const toBeLessThan: (value: number) => SyncMatcher<number>;
	const toBeGreaterThanOrEqual: (value: number) => SyncMatcher<number>;
	const toBeLessThanOrEqual: (value: number) => SyncMatcher<number>;
	const toBeCloseTo: (value: number, precision?: Precision) => SyncMatcher<number>;
	const toHaveLength: (expectation?: SyncMatcher<number> | number) => SyncMatcher<LengthHaver | undefined | null>;
	const toContain: (expectation?: SyncMatcher<any> | string | unknown) => SyncMatcher<string | Array<unknown> | Set<unknown> | undefined | null>;
	const toHaveProperty: (name: symbol | string | number, expectation?: SyncMatcher<any> | unknown) => SyncMatcher<unknown>;

	const toHaveBeenCalled: (options?: { times?: number }) => SyncMatcher<(...args: unknown[]) => unknown>;
	const toHaveBeenCalledWith: <T extends (...args: any[]) => any>(...args: SyncMatchersOrValues<Parameters<T>>[]) => SyncMatcher<T>;
}
