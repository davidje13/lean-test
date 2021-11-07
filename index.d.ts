export class TestAssertionError extends Error {
	constructor(message: string);
}

export class TestAssumptionError extends Error {
	constructor(message: string);
}

export class Runner {
	run(): Promise<void>;
}

export type Plugin = (builder: RunnerBuilder) => void;

declare interface DiscoveryGlobals {
}

type RunInterceptor = () => (Promise<void> | void);
type RunCondition = () => (Promise<boolean> | boolean);

Runner.Builder = class RunnerBuilder {
	constructor();
	addPlugin(...plugins: Plugin): RunnerBuilder;
	extend(key: string | Symbol, ...values: unknown): RunnerBuilder;
	addRunInterceptor(fn: RunInterceptor, options?: { first?: boolean }): RunnerBuilder;
	addRunCondition(fn: RunCondition): RunnerBuilder;
	addSuite(name: string, content: (globals: DiscoveryGlobals) => (Promise<void> | void), options?: Record<string, unknown>): RunnerBuilder;
	addSuite(suites: Record<string, (globals: DiscoveryGlobals) => (Promise<void> | void)>): RunnerBuilder;
	addScope(defaults: { node?: unknown, context?: unknown }): Symbol;
	addNodeType(key: string | Symbol, optionsFactory: (...args: unknown) => unknown, config: Record<string, unknown>): RunnerBuilder;
	addNodeOption(name: string, options: Record<string, unknown>): RunnerBuilder;
	addGlobals(globals: Record<string, unknown>): RunnerBuilder;
	addMethods(methods: Record<string, (...args: unknown) => unknown>): RunnerBuilder;
	build(): Promise<Runner>;
};

export interface MatcherResult {
	success: boolean;
	message: (() => string) | string;
}

export type Matcher<T> = (actual: T) => MatcherResult;

export const matchers: {
	core: {
		not: <T>(sub: Matcher<T>) => Matcher<T>,
		withMessage: <T>(message: string, sub: Matcher<T>) => Matcher<T>,
		equals: <T>(value: T) => Matcher<T>,
		same: <T>(value: T) => Matcher<T>,
		resolves: <T>(value?: T | Matcher<T>) => Matcher<(() => (T | Promise<T>)) | T | Promise<T>>,
		throws: (value?: unknown | Matcher<unknown>) => Matcher<() => unknown>,
	},
};

type expect = () => Plugin;
declare namespace expect {
	function matchers(m: Record<string, (...args: unknown) => Matcher>): Plugin;
}

export const plugins: {
	describe: (fnName?: string | Symbol, options?: { display?: string, testFn?: string | Symbol, subFn?: string | Symbol }) => Plugin,
	expect: expect,
	fail: () => Plugin,
	fail: () => Plugin,
	focus: () => Plugin,
	ignore: () => Plugin,
	lifecycle: () => Plugin,
	repeat: () => Plugin,
	retry: () => Plugin,
	stopAtFirstFailure: () => Plugin,
	test: () => Plugin,
	timeout: () => Plugin,
};

export interface Reporter {
	report(context: Runner): void;
}

export const reporters: {
	TextReporter: Reporter,
};
