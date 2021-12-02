type MaybeAsync<T> = Promise<T> | T;
type AsyncChain<A, T> = (A extends Promise<any> ? Promise<T> : T);
type LengthHaver = { length: number } | { size: number };

interface WriteStream {
	write: (value: string) => void;
	isTTY: boolean;
}

export interface MatcherResult {
	pass: boolean;
	message: (() => string) | string;
}

export type SyncMatcher<T> = (actual: T) => MatcherResult;
export type AsyncMatcher<T> = (actual: T) => Promise<MatcherResult>;
export type Matcher<T> = (actual: T) => MaybeAsync<MatcherResult>;

type FluentExpect<T> = {
	[K in keyof matchers]: (
		ReturnType<matchers[K]> extends Matcher<T>
		? ((...args: Parameters<matchers[K]>) => AsyncChain<ReturnType<ReturnType<matchers[K]>>, void>)
		: never
	);
};

type Expect = (
	(<T, M extends Matcher<T>>(actual: T, matcher: M) => AsyncChain<ReturnType<M>, void>) &
	(<T>(actual: T) => FluentExpect<T>) & {
		extend: (matchers: Record<string, (...args: unknown[]) => Matcher<unknown>>) => void;
	}
);

export type Plugin = (builder: Runner.Builder) => void;

type ColourFn = (value: string, fallback: string) => string;

export interface Output {
	write(value: string, linePrefix?: string, continuationPrefix?: string): void;
	writeRaw(value: string): void;

	bold: ColourFn;
	faint: ColourFn;
}

export interface Reporter {
	report(result: Result): void;
}

export interface LiveReporter {
	eventListener: TestEventHandler;
}

export interface ResultInfo {
	id: string;
	parent: string | null;
	label: string | null;
}

export interface ResultSummary {
	count: number;
	run: number;
	error: number;
	fail: number;
	skip: number;
	pass: number;
	duration: number;
}

export interface StackItem {
	name: string;
	location: string;
}

export interface ResultError {
	message: string;
	stackList: StackItem[];
}

export interface Result extends ResultInfo {
	summary: ResultSummary;
	errors: ResultError[],
	failures: ResultError[],
	output: string,
	children: Result[],
}

export interface TestBeginEvent extends ResultInfo {
	type: 'begin';
	time: number;
	isBlock: boolean;
}

export interface TestCompleteEvent extends Result {
	type: 'complete';
	time: number;
	isBlock: boolean;
}

interface NodeOptions {
	ignore?: boolean;
	focus?: boolean;
	repeat?: number | {
		total: number;
		failFast?: boolean;
		maxFailures?: number;
	};
	retry?: number;
	stopAtFirstFailure?: boolean;
	timeout?: number;
	[K: string]: unknown;
}

type TestImplementation = () => MaybeAsync<void>;
interface DescribeObject {
	[K: string]: DescribeObject | TestImplementation;
}
type DescribeImplementation = ((globals: DiscoveryGlobals) => MaybeAsync<DescribeImplementation | void>) | DescribeObject;
type WithOptions<T> = T & {
	ignore: T;
	focus: T;
};
type Describe = WithOptions<(name: string, fn: DescribeImplementation, options?: NodeOptions) => void>;
type Test = WithOptions<(name: string, fn: TestImplementation, options?: NodeOptions) => void>;

type LifecycleHookAfter = () => MaybeAsync<void>;
type LifecycleHookBefore = () => MaybeAsync<void | LifecycleHookAfter>;
type GetOutput = ((binary?: false) => string) & ((binary: true) => unknown); // unknown = Buffer
type LifecycleFunc<Fn> = ((name: string, fn: Fn) => void) & ((fn: Fn) => void);

export interface DiscoveryGlobals extends matchers {
	describe: Describe;
	test: Test;
	it: Test;
	expect: Expect;
	fail: (message?: string) => void;
	skip: (message?: string) => void;
	beforeAll: LifecycleFunc<LifecycleHookBefore>;
	beforeEach: LifecycleFunc<LifecycleHookBefore>;
	afterEach: LifecycleFunc<LifecycleHookAfter>;
	afterAll: LifecycleFunc<LifecycleHookAfter>;
	getStdout: GetOutput;
	getStderr: GetOutput;
}

export type TestEvent = TestBeginEvent | TestCompleteEvent;
export type TestEventHandler = (e: TestEvent) => void;

interface NodeConfig {
	display: string | null;
	isBlock?: boolean;
	discovery?: (node: Node, methods: DiscoveryGlobals) => MaybeAsync<void>;
	discoveryFrames?: number;
	[K: string]: unknown;
}

type ExtensionKey = string | Symbol;

interface MethodThis {
	getCurrentNodeScope: (scope: string | Symbol) => unknown;
	extend: (key: ExtensionKey, ...values: unknown[]) => void;
	get: (key: ExtensionKey) => unknown[];
}

type RunInterceptor = () => MaybeAsync<void>;
type RunCondition = () => MaybeAsync<boolean>;

export class TestAssertionError extends Error {
	constructor(message: string, skipFrames?: number);
}

export class TestAssumptionError extends Error {
	constructor(message: string, skipFrames?: number);
}

interface Runner {
	run(listener?: TestEventHandler | null | undefined): Promise<Result>;
}
declare namespace Runner {
	class Builder {
		constructor();
		useParallelDiscovery(enabled?: boolean): Builder;
		useParallelSuites(enabled?: boolean): Builder;
		addPlugin(...plugins: Plugin[]): Builder;
		extend(key: ExtensionKey, ...values: unknown[]): Builder;
		addRunInterceptor(fn: RunInterceptor, options?: { order?: number, id?: unknown }): Builder;
		addRunCondition(fn: RunCondition, options?: { id?: unknown }): Builder;
		addSuite(name: string, fn: DescribeImplementation, options?: NodeOptions): Builder;
		addSuites(suites: Record<string, DescribeImplementation>): Builder;
		addScope(defaults: { node?: () => unknown, context?: () => unknown }): Symbol;
		addNodeType(key: string | Symbol, optionsFactory: (...args: unknown[]) => NodeOptions, config: NodeConfig): Builder;
		addNodeOption(name: string, options: NodeOptions): Builder;
		addGlobals(globals: Record<string, unknown | ((this: MethodThis, ...args: unknown[]) => unknown)>): Builder;
		build(): Promise<Runner>;
	}
}
export { Runner };

export class MultiRunner implements Runner {
	constructor();
	add(label: string, runner: (subListener: TestEventHandler) => Promise<Result>): void;
	run(listener?: TestEventHandler | null | undefined): Promise<Result>;
}

export namespace outputs {
	class Writer implements Output {
		constructor(writer: WriteStream, forceTTY?: boolean);
		write(value: string, linePrefix?: string, continuationPrefix?: string): void;
		writeRaw(value: string): void;
		bold: ColourFn;
		faint: ColourFn;
	}
}

export namespace reporters {
	class Full implements Reporter {
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

interface matchers {
	equals: <T>(expected: T) => SyncMatcher<T>;
	same: <T>(expected: T) => SyncMatcher<T>;
	not: <M extends Matcher<any>>(matcher: M) => M;
	withMessage: <M extends Matcher<any>>(message: string, matcher: M) => M;
	isTrue: () => SyncMatcher<boolean>;
	isFalse: () => SyncMatcher<boolean>;
	isTruthy: () => SyncMatcher<unknown>;
	isFalsy: () => SyncMatcher<unknown>;
	isNull: () => SyncMatcher<unknown>;
	isUndefined: () => SyncMatcher<unknown>;
	isNullish: () => SyncMatcher<unknown>;
	isGreaterThan: (value: number) => SyncMatcher<number>;
	isLessThan: (value: number) => SyncMatcher<number>;
	isGreaterThanOrEqual: (value: number) => SyncMatcher<number>;
	isLessThanOrEqual: (value: number) => SyncMatcher<number>;
	resolves: <T>(expectation?: SyncMatcher<T> | T) => (
		SyncMatcher<() => T> &
		AsyncMatcher<Promise<T> | (() => Promise<T>)>
	);
	throws: (expectation?: SyncMatcher<unknown> | string) => (
		SyncMatcher<() => unknown> &
		AsyncMatcher<Promise<unknown> | (() => Promise<unknown>)>
	);
	hasLength: (expectation?: SyncMatcher<number> | number) => SyncMatcher<LengthHaver>;
	isEmpty: () => SyncMatcher<LengthHaver>;
	contains: (expectation?: SyncMatcher<unknown> | string | unknown) => SyncMatcher<string | Array<any> | Set<any>>;

	// compatibility aliases
	toEqual: <T>(expected: T) => SyncMatcher<T>;
	toBe: <T>(expected: T) => SyncMatcher<T>;
	toBeTruthy: () => SyncMatcher<unknown>;
	toBeFalsy: () => SyncMatcher<unknown>;
	toBeNull: () => SyncMatcher<unknown>;
	toBeUndefined: () => SyncMatcher<unknown>;
	toThrow: (expectation?: SyncMatcher<unknown> | string) => (
		SyncMatcher<() => unknown> &
		AsyncMatcher<Promise<unknown> | (() => Promise<unknown>)>
	);
	toBeGreaterThan: (value: number) => SyncMatcher<number>;
	toBeLessThan: (value: number) => SyncMatcher<number>;
	toBeGreaterThanOrEqual: (value: number) => SyncMatcher<number>;
	toBeLessThanOrEqual: (value: number) => SyncMatcher<number>;
	toHaveLength: (expectation?: SyncMatcher<number> | number) => SyncMatcher<LengthHaver>;
	toContain: (expectation?: SyncMatcher<unknown> | string | unknown) => SyncMatcher<string | Array<any> | Set<any>>;
}
export const matchers: matchers;

interface plugins {
	describe: (fnName?: string | Symbol, options?: {
		display?: string;
		testFn?: string | Symbol;
		subFn?: string | Symbol;
	}) => Plugin;

	expect: (() => Plugin) & {
		matchers: (matchers: Record<string, (...args: unknown[]) => Matcher<unknown>>) => Plugin;
	};
	fail: () => Plugin;
	focus: () => Plugin;
	ignore: () => Plugin;
	lifecycle: (options?: { order?: number }) => Plugin;
	outputCaptor: (options?: { order?: number }) => Plugin;
	repeat: (options?: { order?: number }) => Plugin;
	retry: (options?: { order?: number }) => Plugin;
	stopAtFirstFailure: () => Plugin;
	test: (fnName?: string | Symbol) => Plugin;
	timeout: (options?: { order?: number }) => Plugin;
}
export const plugins: plugins;

export function standardRunner(): Runner.Builder;

declare global { // same as DiscoveryGlobals + matchers
	const describe: Describe;
	const test: Test;
	const it: Test;
	const expect: Expect;
	const fail: (message?: string) => void;
	const skip: (message?: string) => void;
	const beforeAll: LifecycleFunc<LifecycleHookBefore>;
	const beforeEach: LifecycleFunc<LifecycleHookBefore>;
	const afterEach: LifecycleFunc<LifecycleHookAfter>;
	const afterAll: LifecycleFunc<LifecycleHookAfter>;
	const getStdout: GetOutput;
	const getStderr: GetOutput;

	const equals: <T>(expected: T) => SyncMatcher<T>;
	const same: <T>(expected: T) => SyncMatcher<T>;
	const not: <M extends Matcher<any>>(matcher: M) => M;
	const withMessage: <M extends Matcher<any>>(message: string, matcher: M) => M;
	const isTrue: () => SyncMatcher<boolean>;
	const isFalse: () => SyncMatcher<boolean>;
	const isTruthy: () => SyncMatcher<unknown>;
	const isFalsy: () => SyncMatcher<unknown>;
	const isNull: () => SyncMatcher<unknown>;
	const isUndefined: () => SyncMatcher<unknown>;
	const isNullish: () => SyncMatcher<unknown>;
	const isGreaterThan: (value: number) => SyncMatcher<number>;
	const isLessThan: (value: number) => SyncMatcher<number>;
	const isGreaterThanOrEqual: (value: number) => SyncMatcher<number>;
	const isLessThanOrEqual: (value: number) => SyncMatcher<number>;
	const resolves: <T>(expectation?: SyncMatcher<T> | T) => (
		SyncMatcher<() => T> &
		AsyncMatcher<Promise<T> | (() => Promise<T>)>
	);
	const throws: (expectation?: SyncMatcher<unknown> | string) => (
		SyncMatcher<() => unknown> &
		AsyncMatcher<Promise<unknown> | (() => Promise<unknown>)>
	);
	const hasLength: (expectation?: SyncMatcher<number> | number) => SyncMatcher<LengthHaver>;
	const isEmpty: () => SyncMatcher<LengthHaver>;
	const contains: (expectation?: SyncMatcher<unknown> | string | unknown) => SyncMatcher<string | Array<any> | Set<any>>;

	// compatibility aliases
	const toEqual: <T>(expected: T) => SyncMatcher<T>;
	const toBe: <T>(expected: T) => SyncMatcher<T>;
	const toBeTruthy: () => SyncMatcher<unknown>;
	const toBeFalsy: () => SyncMatcher<unknown>;
	const toBeNull: () => SyncMatcher<unknown>;
	const toBeUndefined: () => SyncMatcher<unknown>;
	const toThrow: (expectation?: SyncMatcher<unknown> | string) => (
		SyncMatcher<() => unknown> &
		AsyncMatcher<Promise<unknown> | (() => Promise<unknown>)>
	);
	const toBeGreaterThan: (value: number) => SyncMatcher<number>;
	const toBeLessThan: (value: number) => SyncMatcher<number>;
	const toBeGreaterThanOrEqual: (value: number) => SyncMatcher<number>;
	const toBeLessThanOrEqual: (value: number) => SyncMatcher<number>;
	const toHaveLength: (expectation?: SyncMatcher<number> | number) => SyncMatcher<LengthHaver>;
	const toContain: (expectation?: SyncMatcher<unknown> | string | unknown) => SyncMatcher<string | Array<any> | Set<any>>;
}
