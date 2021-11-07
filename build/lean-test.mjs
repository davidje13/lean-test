import assert from 'assert/strict';

class TestAssertionError extends Error {
	constructor(message) {
		super(message);
	}
}

class TestAssumptionError extends Error {
	constructor(message) {
		super(message);
	}
}

const HIDDEN = Symbol();

function combineResult(a, b) {
	const r = { ...a };
	Object.keys(b).forEach((k) => {
		r[k] = (r[k] || 0) + b[k];
	});
	return r;
}

async function finalInterceptor(_, context, node) {
	if (node.config.run) {
		if (context.active) {
			await node.exec('test', () => node.config.run(node));
		} else {
			node.result.skipReasons.push(new TestAssumptionError('skipped'));
		}
		node.result.invoked = true;
	} else if (node.options.parallel) {
		await Promise.all(node.sub.map((subNode) => subNode._run(context)));
	} else {
		for (const subNode of node.sub) {
			await subNode._run(context);
		}
	}
}

function runChain(chain, args) {
	const runStep = (index, args) => chain[index](
		(newArg1) => {
			const newArgs = [...args];
			if (newArg1) {
				newArgs[0] = Object.freeze(newArg1);
			}
			return runStep(index + 1, newArgs);
		},
		...args
	);
	return runStep(0, args);
}

class Node {
	constructor(config, options, scopes) {
		this.config = Object.freeze(config);
		this.options = Object.freeze(options);
		this.scopes = Object.freeze(new Map(scopes.map(({ scope, value }) => [scope, value()])));
		this.parent = null;
		this.sub = [];

		this.result = {
			started: false,
			startTime: null,
			invoked: false,
			durations: new Map(),
			totalRunDuration: 0,
			complete: false,

			failures: [],
			errors: [],
			skipReasons: []
		};
	}

	addChild(node) {
		node.parent = this;
		this.sub.push(node);
	}

	getScope(key) {
		if (!this.scopes.has(key)) {
			throw new Error(`Unknown node config scope ${key}`);
		}
		return this.scopes.get(key);
	}

	captureError(namespace, error) {
		if (error instanceof TestAssertionError) {
			this.result.failures.push(`Failure in ${namespace}:\n${error.message}`);
		} else if (error instanceof TestAssumptionError) {
			this.result.skipReasons.push(`Assumption not met in ${namespace}:\n${error.message}`);
		} else {
			this.result.errors.push(error);
		}
	}

	hasFailed() {
		return this.result.errors.length > 0 || this.result.failures.length > 0;
	}

	async exec(namespace, fn) {
		const beginTime = Date.now();
		try {
			await fn();
			return true;
		} catch (error) {
			this.captureError(namespace, error);
			return false;
		} finally {
			const duration = Date.now() - beginTime;
			this.result.durations.set(namespace, (this.result.durations.get(namespace) || 0) + duration);
		}
	}

	async runDiscovery(methods, beginHook) {
		if (this.config.discovery) {
			beginHook(this);
			await this.exec('discovery', () => this.config.discovery(this, { ...methods }));
		}
		for (const subNode of this.sub) {
			await subNode.runDiscovery(methods, beginHook);
		}
		this.scopes.forEach(Object.freeze);
		Object.freeze(this.sub);
		Object.freeze(this);
	}

	async _run(context) {
		this.result.started = true;
		this.result.startTime = Date.now();

		await runChain(context[HIDDEN].interceptors, [context, this]);

		this.result.totalRunDuration = Date.now() - this.result.startTime;
		this.result.complete = true;
	}

	run(interceptors, context) {
		return this._run({
			...context,
			[HIDDEN]: { interceptors: [...interceptors, finalInterceptor] },
		});
	}

	getOwnResult() {
		if (!this.config.run) {
			if (this.result.errors.length) {
				return { error: 1 };
			}
			if (this.result.failures.length) {
				return { fail: 1 };
			}
			return {};
		}

		if (!this.result.started) {
			return { count: 1, pend: 1 };
		}
		if (!this.result.complete) {
			return { count: 1, run: 1 };
		}
		if (this.result.errors.length) {
			return { count: 1, error: 1 };
		}
		if (this.result.failures.length) {
			return { count: 1, fail: 1 };
		}
		if (this.result.skipReasons.length || !this.result.invoked) {
			return { count: 1, skip: 1 };
		}
		return { count: 1, pass: 1 };
	}

	getResults() {
		return this.sub.map((s) => s.getResults()).reduce(combineResult, this.getOwnResult());
	}

	getDuration() {
		if (!this.result.started) {
			return null;
		}
		return (
			(this.result.complete ? this.result.totalRunDuration : (Date.now() - this.result.startTime)) +
			(this.result.durations.get('discovery') || 0)
		);
	}
}

class ExtensionStore {
	constructor() {
		this.data = new Map();
		this.data.frozen = false;
		Object.freeze(this);
	}

	add = (key, ...values) => {
		if (this.data.frozen) {
			throw new Error('extension configuration is frozen');
		}
		const items = this.data.get(key) || [];
		if (!items.length) {
			this.data.set(key, items);
		}
		items.push(...values);
	};

	get = (key) => (this.data.get(key) || []);

	copy() {
		const b = new ExtensionStore();
		this.data.forEach((v, k) => b.data.set(k, [...v]));
		return b;
	}

	freeze() {
		this.data.forEach(Object.freeze);
		this.data.frozen = true;
		Object.freeze(this.data);
	}
}

const OPTIONS_FACTORY$1 = (name, content, opts) => {
	if (!content || (typeof content !== 'function' && typeof content !== 'object')) {
		throw new Error('Invalid content');
	}
	return { ...opts, name: name.trim(), content };
};

const DISCOVERY = async (node, methods) => {
	const { content } = node.options;

	let result = content;
	while (typeof result === 'function') {
		result = await result(methods);
	}

	if (typeof result === 'object' && result) {
		Object.entries(result).forEach(([name, value]) => {
			if (typeof value === 'function') {
				methods[node.config.testFn](name, value);
			} else if (typeof value === 'object' && value) {
				methods[node.config.subFn](name, value);
			} else {
				throw new Error('Invalid test');
			}
		});
	}
};

var describe = (fnName = 'describe', {
	display,
	testFn = 'test',
	subFn,
} = {}) => (builder) => {
	builder.addNodeType(fnName, OPTIONS_FACTORY$1, {
		display: display || fnName,
		testFn,
		subFn: subFn || fnName,
		discovery: DISCOVERY,
	});
};

class Runner {
	constructor(baseNode, baseContext, runInterceptors) {
		this.baseNode = baseNode;
		this.baseContext = baseContext;
		this.runInterceptors = runInterceptors;
		Object.freeze(this);
	}

	run() {
		return this.baseNode.run(this.runInterceptors, this.baseContext);
	}
}

const GLOBALS = Symbol();
const METHODS = Symbol();
const NODE_TYPES = Symbol();
const NODE_OPTIONS = Symbol();
const NODE_INIT = Symbol();
const CONTEXT_INIT = Symbol();
const SUITE_FN = Symbol();

Runner.Builder = class RunnerBuilder {
	constructor() {
		this.extensions = new ExtensionStore();
		this.runInterceptors = [];
		this.suites = [];
		Object.freeze(this); // do not allow mutating the builder itself
		this.addPlugin(describe(SUITE_FN, { display: 'suite', subFn: 'describe' }));
	}

	addPlugin(...plugins) {
		plugins.forEach((plugin) => plugin(this));
		return this;
	}

	extend(key, ...values) {
		this.extensions.add(key, ...values);
		return this;
	}

	addRunInterceptor(fn, { first = false } = {}) {
		if (first) {
			this.runInterceptors.unshift(fn);
		} else {
			this.runInterceptors.push(fn);
		}
		return this;
	}

	addRunCondition(fn) {
		return this.addRunInterceptor(async (next, context, ...rest) => {
			const run = await fn(context, ...rest);
			return await next(run ? context : { ...context, active: false });
		}, { first: true });
	}

	addSuite(name, content, options = {}) {
		this.suites.push([name, content, options]);
		return this;
	}

	addSuites(suites) {
		Object.entries(suites).forEach(([name, content]) => this.addSuite(name, content));
		return this;
	}

	addScope({ node, context }) {
		const scope = Symbol();
		if (node) {
			this.extend(NODE_INIT, { scope, value: node });
		}
		if (context) {
			this.extend(CONTEXT_INIT, { scope, value: context });
		}
		return scope;
	}

	addNodeType(key, optionsFactory, config) {
		return this.extend(NODE_TYPES, { key, optionsFactory, config });
	}

	addNodeOption(name, options) {
		return this.extend(NODE_OPTIONS, { name, options });
	}

	addGlobals(globals) {
		return this.extend(GLOBALS, ...Object.entries(globals));
	}

	addMethods(methods) {
		return this.extend(METHODS, ...Object.entries(methods));
	}

	async build() {
		const exts = this.extensions.copy();
		const baseNode = new Node({ display: false }, { parallel: true }, exts.get(NODE_INIT));

		let curNode = baseNode;
		const addChildNode = (config, options) => {
			if (!curNode) {
				throw new Error('Cannot create new tests after discovery phase');
			}
			curNode.addChild(new Node(config, options, exts.get(NODE_INIT)));
		};

		const methodTarget = Object.freeze({
			getCurrentNodeScope(scope) {
				if (!curNode) {
					throw new Error('Cannot configure tests after discovery phase');
				}
				return curNode.getScope(scope);
			},
			extend: exts.add,
			get: exts.get,
		});

		const scope = Object.freeze(Object.fromEntries([
			...exts.get(GLOBALS),
			...exts.get(METHODS).map(([key, method]) => ([key, method.bind(methodTarget)])),
			...exts.get(NODE_TYPES).map(({ key, optionsFactory, config }) => [key, Object.assign(
				(...args) => addChildNode(config, optionsFactory(...args)),
				Object.fromEntries(exts.get(NODE_OPTIONS).map(({ name, options }) => [
					name,
					(...args) => addChildNode(config, { ...optionsFactory(...args), ...options }),
				])),
			)]),
		]));

		this.suites.forEach(([name, content, opts]) => scope[SUITE_FN](name, content, opts));

		await baseNode.runDiscovery(scope, (node) => { curNode = node; });
		curNode = null;

		exts.freeze(); // ensure config cannot change post-discovery

		const baseContext = { active: true };
		exts.get(CONTEXT_INIT).forEach(({ scope, value }) => { baseContext[scope] = Object.freeze(value()); });

		return new Runner(
			baseNode,
			Object.freeze(baseContext),
			Object.freeze([...this.runInterceptors]),
		);
	}
};

function seq(result, then) {
	if (result instanceof Promise) {
		return result.then(then);
	} else {
		return then(result);
	}
}

const resolveMessage = (message) => String((typeof message === 'function' ? message() : message) || '');

const ANY = Symbol();

const not = (matcher) => (...args) =>
	seq(matcher(...args), ({ success, message }) => ({ success: !success, message }));

const withMessage = (message, matcher) => (...args) =>
	seq(matcher(...args), ({ success }) => ({ success, message }));

const equals = (expected) => (actual) => {
	try {
		assert.deepStrictEqual(actual, expected);
		return { success: true, message: `Expected value not to equal ${expected}, but did.` };
	} catch (e) {
		const message = e.message.replace(/^[^\r\n]*[\r\n]+|[\r\n]+$/g, '');
		return { success: false, message };
	}
};

const same = (expected) => (actual) => {
	if (expected === actual) {
		return { success: true, message: `Expected value not to be ${expected}, but was.` };
	}
	const equalResult = equals(expected)(actual);
	if (equalResult.success) {
		return { success: false, message: `Expected exactly ${expected}, but got a different (but matching) instance.` };
	} else {
		return { success: false, message: equalResult.message };
	}
};

const resolves = (expected = ANY) => (input) => {
	function resolve(actual) {
		if (typeof expected === 'function') {
			return expected(actual);
		} else if (expected !== ANY) {
			return equals(expected)(actual);
		}
		return { success: true, message: `Expected ${input} not to resolve, but resolved to ${actual}.` };
	}
	function reject(actual) {
		return { success: false, message: `Expected ${input} to resolve, but threw ${actual}.` };
	}

	try {
		const r = (typeof input === 'function') ? input() : input;
		if (r instanceof Promise) {
			return r.then(resolve, reject);
		} else {
			return resolve(r);
		}
	} catch (actual) {
		return reject(actual);
	}
};

const throws = (expected = ANY) => (input) => {
	function resolve(actual) {
		if (typeof expected === 'string') {
			return { success: false, message: `Expected ${input} to throw ${expected}, but did not throw (returned ${actual}).` };
		} else {
			return { success: false, message: `Expected ${input} to throw, but did not throw (returned ${actual}).` };
		}
	}
	function reject(actual) {
		if (typeof expected === 'function') {
			return expected(actual);
		} else if (typeof expected === 'string') {
			if (!actual.message.includes(expected)) {
				return { success: false, message: `Expected ${input} to throw ${expected}, but threw ${actual}.` };
			}
		} else if (expected !== ANY) {
			return equals(expected)(actual);
		}
		return { success: true, message: `Expected ${input} not to throw, but threw ${actual}.` };
	}

	try {
		const r = (typeof input === 'function') ? input() : input;
		if (r instanceof Promise) {
			return r.then(resolve, reject);
		} else {
			return resolve(r);
		}
	} catch (actual) {
		return reject(actual);
	}
};

var core = /*#__PURE__*/Object.freeze({
	__proto__: null,
	not: not,
	withMessage: withMessage,
	equals: equals,
	same: same,
	resolves: resolves,
	throws: throws
});

var index$2 = /*#__PURE__*/Object.freeze({
	__proto__: null,
	core: core
});

const FLUENT_MATCHERS = Symbol();

const expect = () => (builder) => {
	const invokeMatcher = (actual, matcher, ErrorType) =>
		seq(matcher(actual), ({ success, message }) => {
			if (!success) {
				throw new ErrorType(resolveMessage(message));
			}
		});

	const run = (context, ErrorType, actual, matcher = undefined) => {
		if (matcher) {
			return invokeMatcher(actual, matcher, ErrorType);
		}
		return Object.fromEntries(context.get(FLUENT_MATCHERS).map(([name, m]) =>
			[name, (...args) => invokeMatcher(actual, m(...args), ErrorType)]
		));
	};

	builder.addMethods({
		expect(...args) {
			return run(this, TestAssertionError, ...args);
		},
		assume(...args) {
			return run(this, TestAssumptionError, ...args);
		},
		extendExpect(matchers) {
			this.extend(FLUENT_MATCHERS, ...Object.entries(matchers));
		}
	});
};

expect.matchers = (...matcherDictionaries) => (builder) => {
	matcherDictionaries.forEach((md) => {
		builder.extend(FLUENT_MATCHERS, ...Object.entries(md));
		builder.addGlobals(md);
	});
};

var fail = () => (builder) => {
	builder.addMethods({
		fail(message) {
			throw new TestAssertionError(resolveMessage(message));
		},
		skip(message) {
			throw new TestAssumptionError(resolveMessage(message));
		},
	});
};

const containsFocus = (node) => (node.options.focus || node.sub.some(containsFocus));

var focus = () => (builder) => {
	builder.addNodeOption('focus', { focus: true });

	const scope = builder.addScope({
		context: () => ({
			withinFocus: false,
			anyFocus: null,
		}),
	});

	builder.addRunInterceptor((next, context, node) => {
		const withinFocus = node.options.focus || context[scope].withinFocus;
		let anyFocus = context[scope].anyFocus;
		if (anyFocus === null) { // must be root object
			anyFocus = withinFocus || containsFocus(node);
		}
		if (!anyFocus || withinFocus || containsFocus(node)) {
			return next({ ...context, [scope]: { withinFocus, anyFocus } });
		} else {
			return next({ ...context, [scope]: { withinFocus, anyFocus }, active: false });
		}
	}, { first: true });
};

var ignore = () => (builder) => {
	builder.addNodeOption('ignore', { ignore: true });
	builder.addRunCondition((_, node) => (!node.options.ignore));
};

var lifecycle = () => (builder) => {
	const scope = builder.addScope({
		node: () => ({
			beforeAll: [],
			afterAll: [],
			beforeEach: [],
			afterEach: [],
		}),
		context: () => ({
			beforeEach: [],
			afterEach: [],
		}),
	});

	builder.addRunInterceptor((next, context, node) => {
		if (!context.active) {
			return next(context);
		} else if (node.config.run) {
			return withWrappers(node, context[scope].beforeEach, context[scope].afterEach, (err) => next({
				...context,
				active: !err,
			}));
		} else {
			const nodeScope = node.getScope(scope);
			return withWrappers(node, [nodeScope.beforeAll], [nodeScope.afterAll], (err) => next({
				...context,
				[scope]: {
					beforeEach: [...context[scope].beforeEach, nodeScope.beforeEach],
					afterEach: [...context[scope].afterEach, nodeScope.afterEach],
				},
				active: !err,
			}));
		}
	});

	async function withWrappers(node, before, after, next) {
		let err = false;
		const allTeardowns = [];
		let i = 0;
		for (; i < before.length && !err; ++i) {
			const teardowns = [];
			for (const { name, fn } of before[i]) {
				const success = await node.exec(`before ${name}`, async () => {
					const teardown = await fn();
					if (typeof teardown === 'function') {
						teardowns.unshift({ name, fn: teardown });
					}
				});
				if (!success) {
					err = true;
					break;
				}
			}
			allTeardowns.push(teardowns);
		}

		try {
			return await next(err);
		} finally {
			while ((i--) > 0) {
				for (const { name, fn } of allTeardowns[i]) {
					await node.exec(`teardown ${name}`, fn);
				}
				for (const { name, fn } of after[i]) {
					await node.exec(`after ${name}`, fn);
				}
			}
		}
	}

	const convert = (name, fn, defaultName) => {
		if (typeof fn === 'function') {
			return { name: String(name) || defaultName, fn };
		} else if (typeof name === 'function') {
			return { name: defaultName, fn: name };
		} else {
			throw new Error('Invalid arguments');
		}
	};

	builder.addMethods({
		beforeEach(name, fn) {
			this.getCurrentNodeScope(scope).beforeEach.push(convert(name, fn, 'each'));
		},
		afterEach(name, fn) {
			this.getCurrentNodeScope(scope).afterEach.push(convert(name, fn, 'each'));
		},
		beforeAll(name, fn) {
			this.getCurrentNodeScope(scope).beforeAll.push(convert(name, fn, 'all'));
		},
		afterAll(name, fn) {
			this.getCurrentNodeScope(scope).afterAll.push(convert(name, fn, 'all'));
		},
	});
};

var repeat = () => (builder) => {
	// TODO
};

var retry = () => (builder) => {
	builder.addRunInterceptor(async (next, context, node) => {
		await next(context);
		if (!context.active) {
			return;
		}
		const maxAttempts = node.options.retry || 0;
		const attempts = []; // TODO: make available to reporting (also durations, etc.)
		while (node.hasFailed() && attempts.length < maxAttempts - 1) {
			attempts.push({ errors: [...node.result.errors], failures: [...node.result.failures] });
			node.result.errors.length = 0;
			node.result.failures.length = 0;
			await next(context);
		}
	}, { first: true }); // ensure any lifecycle steps happen within the retry
};

const containsFailure = (node) => (node.hasFailed() || node.sub.some(containsFailure));

var stopAtFirstFailure = () => (builder) => {
	builder.addRunCondition((_, node) => !(
		node.parent &&
		node.parent.options.stopAtFirstFailure &&
		containsFailure(node.parent)
	));
};

const OPTIONS_FACTORY = (name, fn, opts) => ({ ...opts, name: name.trim(), fn });
const CONFIG = {
	display: 'test',
	run: (node) => node.options.fn(),
};

var test = () => (builder) => {
	builder.addNodeType('test', OPTIONS_FACTORY, CONFIG);
	builder.addNodeType('it', OPTIONS_FACTORY, CONFIG);
};

var timeout = () => (builder) => {
	// TODO: needs ability to "lock" current scope so that later resolutions won't have any effect
	// needs scopes (rather than global node state) so that retries can still pass
};

var index$1 = /*#__PURE__*/Object.freeze({
	__proto__: null,
	describe: describe,
	expect: expect,
	fail: fail,
	focus: focus,
	ignore: ignore,
	lifecycle: lifecycle,
	repeat: repeat,
	retry: retry,
	stopAtFirstFailure: stopAtFirstFailure,
	test: test,
	timeout: timeout
});

class Output {
	constructor(writer) {
		this.writer = writer;
		if (writer.isTTY) {
			this.colour = (index) => (v) => `\u001B[0;${index}m${v}\u001B[0m`;
		} else {
			this.colour = () => (v) => v;
		}
		this.red = this.colour(31);
		this.green = this.colour(32);
		this.yellow = this.colour(33);
		this.blue = this.colour(34);
	}

	writeRaw(v) {
		this.writer.write(v);
	}

	write(v, linePrefix = '', continuationPrefix = null) {
		String(v).split(/\r\n|\n\r?/g).forEach((ln, i) => {
			this.writer.write(((i ? continuationPrefix : null) ?? linePrefix) + ln + '\n');
		});
	}
}

class TextReporter {
	constructor(writer) {
		this.output = new Output(writer);
	}

	_print(node, indent) {
		const results = node.getResults();
		const duration = node.getDuration();
		const display = (node.config.display !== false);
		let result = '';
		if (results.error) {
			result = this.output.red('[ERRO]');
		} else if (results.fail) {
			result = this.output.red('[FAIL]');
		} else if (results.run || results.pend) {
			result = this.output.blue('[....]');
		} else if (results.pass) {
			result = this.output.green('[PASS]');
		} else if (results.skip) {
			result = this.output.yellow('[SKIP]');
		} else {
			result = this.output.yellow('[NONE]');
		}
		const resultSpace = '      ';

		if (display) {
			this.output.write(
				`${node.config.display}: ${node.options.name} [${duration}ms]`,
				`${result} ${indent}`,
				`${resultSpace} ${indent}`,
			);
		}
		node.result.errors.forEach((err) => {
			this.output.write(
				this.output.red(String(err)),
				`${resultSpace} ${indent}  `,
			);
		});
		node.result.failures.forEach((message) => {
			this.output.write(
				this.output.red(message),
				`${resultSpace} ${indent}  `,
			);
		});
		const nextIndent = indent + (display ? '  ' : '');
		node.sub.forEach((subNode) => this._print(subNode, nextIndent));
	}

	report(ctx) {
		const finalResult = ctx.baseNode.getResults();
		const duration = ctx.baseNode.getDuration();

		this._print(ctx.baseNode, '');

		if (!finalResult.count) {
			this.output.write(this.output.yellow('NO TESTS FOUND'));
			process.exit(1);
		}

		this.output.write('');
		this.output.write(`Total:    ${finalResult.count || 0}`);
		this.output.write(`Pass:     ${finalResult.pass || 0}`);
		this.output.write(`Errors:   ${finalResult.error || 0}`);
		this.output.write(`Failures: ${finalResult.fail || 0}`);
		this.output.write(`Skipped:  ${finalResult.skip || 0}`);
		this.output.write(`Duration: ${duration}ms`);
		this.output.write('');

		// TODO: warn or error if any node contains 0 tests

		if (finalResult.error) {
			this.output.write(this.output.red('ERROR'));
			process.exit(1);
		} else if (finalResult.fail) {
			this.output.write(this.output.red('FAIL'));
			process.exit(1);
		} else if (finalResult.pass) {
			this.output.write(this.output.green('PASS'));
		} else {
			this.output.write(this.output.yellow('NO TESTS RUN'));
			process.exit(1);
		}
	}
}

var index = /*#__PURE__*/Object.freeze({
	__proto__: null,
	TextReporter: TextReporter
});

export { Runner, TestAssertionError, TestAssumptionError, index$2 as matchers, index$1 as plugins, index as reporters };
