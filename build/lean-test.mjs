const HAS_PROCESS = (typeof process !== 'undefined');

let hasRun = null;
const exitHooks = [];
async function runExitHooks() {
	if (hasRun !== null) {
		if (Date.now() > hasRun + 1000) {
			// user got impatient and fired signal again; do as they say
			process.stderr.write(`\nWarning: teardown did not complete\n`);
			process.exit(1);
		}
		return;
	}
	hasRun = Date.now();

	const hooks = exitHooks.slice().reverse();

	// mimick default SIGINT/SIGTERM behaviour
	if (process.stderr.isTTY) {
		process.stderr.write('\u001B[0m');
	}

	var info = setTimeout(() => process.stderr.write(`\nTeardown in progress; please wait (warning: forcing exit could result in left-over processes)\n`), 200);

	// run hooks
	for (const hook of hooks) {
		await hook();
	}
	clearTimeout(info);
	process.exit(1);
}

function checkExit() {
	if (hasRun !== null) {
		return;
	}

	const hooks = exitHooks.slice().reverse();
	if (process.stderr.isTTY) {
		process.stderr.write('\u001B[0m');
	}

	// run all hooks "fire-and-forget" style for best-effort teardown
	for (const hook of hooks) {
		hook();
	}

	process.stderr.write('\nWarning: exit teardown was possibly incomplete\n');
}

class ExitHook {
	constructor(hook) {
		this.registered = false;
		this.hook = async () => {
			try {
				await hook();
			} catch (e) {
				if (HAS_PROCESS) {
					process.stderr.write(`\nWarning: error during teardown ${e}\n`);
				} else {
					console.warn('Error during teardown', e);
				}
			}
		};
	}

	add() {
		if (this.registered) {
			throw new Error('Exit hook already registered');
		}
		this.registered = true;
		exitHooks.push(this.hook);
		if (exitHooks.length === 1 && HAS_PROCESS) {
			process.addListener('SIGTERM', runExitHooks);
			process.addListener('SIGINT', runExitHooks);
			process.addListener('exit', checkExit);
		}
	}

	remove() {
		const p = exitHooks.indexOf(this.hook);
		if (p === -1) {
			throw new Error('Exit hook not registered');
		}
		this.registered = false;
		exitHooks.splice(p, 1);
		if (exitHooks.length === 0) {
			exitHooks.length = 0;
			if (HAS_PROCESS) {
				process.removeListener('SIGTERM', runExitHooks);
				process.removeListener('SIGINT', runExitHooks);
				process.removeListener('exit', checkExit);
			}
		}
	}

	async ifExitDuring(fn) {
		try {
			this.add();
			return await fn();
		} finally {
			this.remove();
		}
	}

	async ifExitDuringOrFinally(fn) {
		try {
			this.add();
			return await fn();
		} finally {
			this.remove();
			await this.hook();
		}
	}
}

class AbstractRunner {
	async prepare(sharedState) {
	}

	async teardown(sharedState) {
	}

	async invoke(listener, sharedState) {
	}

	async run(listener = null, sharedState = {}) {
		const fin = new ExitHook(() => this.teardown(sharedState));
		return fin.ifExitDuringOrFinally(async () => {
			await this.prepare(sharedState);
			return this.invoke(listener, sharedState);
		});
	}
}

class TestAssertionError extends Error {
	constructor(message, skipFrames = 0) {
		super(message);
		this.skipFrames = skipFrames;
	}
}

class TestAssumptionError extends Error {
	constructor(message, skipFrames = 0) {
		super(message);
		this.skipFrames = skipFrames;
	}
}

class InnerError {
	constructor(error, fullStackList, stackList) {
		this.error = error;
		this.fullStackList = fullStackList;
		this.stackList = stackList;
	}

	getStackParts() {
		const parts = this.stackList.map(extractStackLine);

		// remove any trailing "special" frames (e.g. node internal async task handling)
		while (parts.length > 0 && !isFile(parts[parts.length - 1].location)) {
			parts.length--;
		}

		// trim common prefix from paths
		const prefix = getCommonPrefix(this.fullStackList.map((i) => extractStackLine(i).location).filter(isFile));
		return parts.map(({ location, ...rest }) => ({
			...rest,
			location: isFile(location) ? location.substr(prefix.length) : location,
		}));
	}

	get stack() {
		return String(this.error) + '\n' + this.stackList.join('\n');
	}

	get message() {
		return this.error.message;
	}

	toString() {
		return String(this.error);
	}
}

function getCommonPrefix(values) {
	if (!values.length) {
		return '';
	}
	return values.reduce((prefix, v) => {
		for (let p = 0; p < prefix.length; ++p) {
			if (v[p] !== prefix[p]) {
				return prefix.substr(0, p);
			}
		}
		return prefix;
	});
}

function isFile(frame) {
	return frame.includes('://');
}

const STACK_AT = /^at\s+/i;
const STACK_REGEX = /^([^(@]*?)\s*[@\(]\s*([^)]*)\)?$/i;

function extractStackLine(raw) {
	const cleaned = raw.trim().replace(STACK_AT, '');
	const match = cleaned.match(STACK_REGEX);
	if (match) {
		return { name: match[1], location: match[2] };
	} else if (cleaned.startsWith('async ')) {
		return { name: 'async anonymous', location: cleaned.substr(6) };
	} else {
		return { name: 'anonymous', location: cleaned };
	}
}

const SCOPE_MATCH = /(async\s.*?)?__STACK_SCOPE_([^ ]*?)_([0-9]+)/;

class StackScope {
	constructor(namespace) {
		this.namespace = namespace;
		this.scopes = new Map();
		this.index = 0;
	}

	async run(scope, fn, ...args) {
		const id = String(++this.index);
		if (scope) {
			this.scopes.set(id, scope);
		}
		const name = `__STACK_SCOPE_${this.namespace}_${id}`;
		const o = {
			[name]: async () => {
				try {
					await fn(...args);
				} finally {
					this.scopes.delete(id);
				}
			},
		};
		return o[name]();
	}

	get() {
		const list = extractStackList(new Error());
		for (const frame of list) {
			const match = frame.match(SCOPE_MATCH);
			if (match && match[2] === this.namespace) {
				return this.scopes.get(match[3]);
			}
		}
		return null;
	}

	getInnerError(error, skipFrames = 0) {
		const fullStackList = extractStackList(error);
		const stackList = fullStackList.slice();

		// truncate to beginning of scope (and remove requested skipFrames if match is found)
		for (let i = 0; i < stackList.length; ++i) {
			const match = stackList[i].match(SCOPE_MATCH);
			if (match && match[2] === this.namespace) {
				if (match[1]) {
					// async, so next frame is likely user-relevant (do not apply skipFrames)
					stackList.length = i;
				} else {
					stackList.length = Math.max(0, i - skipFrames);
				}
				break;
			}
		}

		// remove frames from head of trace if requested by error
		if (error.skipFrames) {
			stackList.splice(0, error.skipFrames);
		}

		return new InnerError(error, fullStackList, stackList);
	}
}

let supported = null;

StackScope.isSupported = async () => {
	if (supported === null) {
		const scope = new StackScope('FEATURE_TEST');
		const o = Symbol();
		await scope.run(o, async () => {
			if (scope.get() !== o) {
				supported = false;
			}
			await Promise.resolve();
			supported = (scope.get() === o);
		});
	}
	return supported;
};

function extractStackList(error) {
	if (error instanceof InnerError) {
		return error.fullStackList;
	}
	if (!error || typeof error !== 'object' || typeof error.stack !== 'string') {
		return [];
	}
	const messageLines = error.message.split('\n');
	const list = error.stack.split('\n');
	for (let i = 0; i < messageLines.length; ++i) {
		list.shift();
	}
	return list;
}

const RESULT_STAGE_SCOPE = new StackScope('RESULT_STAGE');

class ResultStage {
	constructor(label) {
		this.label = label;
		this.startTime = Date.now();
		this.endTime = null;
		this.failures = [];
		this.errors = [];
		this.skipReasons = [];
	}

	_cancel(error) {
		if (this.endTime === null) {
			this.errors.push(RESULT_STAGE_SCOPE.getInnerError(error));
			this._complete();
		}
	}

	_complete() {
		if (this.endTime === null) {
			this.endTime = Date.now();
			Object.freeze(this);
		}
	}

	getSummary() {
		if (this.endTime === null) {
			return { count: 1, run: 1, duration: Date.now() - this.startTime };
		}

		const duration = this.endTime - this.startTime;
		if (this.errors.length) {
			return { count: 1, error: 1, duration };
		}
		if (this.failures.length) {
			return { count: 1, fail: 1, duration };
		}
		if (this.skipReasons.length) {
			return { count: 1, skip: 1, duration };
		}
		return { count: 1, pass: 1, duration };
	}

	hasFailed() {
		return (this.errors.length > 0 || this.failures.length > 0);
	}

	hasSkipped() {
		return this.skipReasons.length > 0;
	}
}

ResultStage.of = async (label, fn, { errorStackSkipFrames = 0, context = null } = {}) => {
	const stage = new ResultStage(label);
	try {
		await RESULT_STAGE_SCOPE.run(context, fn, stage);
	} catch (error) {
		const captured = RESULT_STAGE_SCOPE.getInnerError(error, errorStackSkipFrames);
		if (stage.endTime === null) {
			if (error instanceof TestAssertionError) {
				stage.failures.push(captured);
			} else if (error instanceof TestAssumptionError) {
				stage.skipReasons.push(captured);
			} else {
				stage.errors.push(captured);
			}
		}
	} finally {
		stage._complete();
	}
	return stage;
};

ResultStage.getContext = () => RESULT_STAGE_SCOPE.get();

let idNamespace = '';
let nextID = 0;

function setIdNamespace(namespace) {
	idNamespace = namespace + '-';
}

const filterSummary = ({ tangible, time, fail }, summary) => ({
	count: tangible ? summary.count : 0,
	run: tangible ? summary.run : 0,
	error: (tangible || fail) ? summary.error : 0,
	fail: (tangible || fail) ? summary.fail : 0,
	skip: tangible ? summary.skip : 0,
	pass: tangible ? summary.pass : 0,
	duration: time ? summary.duration : 0,
});

class Result {
	constructor(label, parent) {
		this.id = `${idNamespace}${++nextID}`;
		this.label = label;
		this.parent = parent;
		this.children = [];
		this.stages = [];
		this.output = '';
		this.forcedChildSummary = null;
		this.cancelled = Boolean(parent?.cancelled);
		parent?.children?.push(this);
		this.buildCache = null;
	}

	createChild(label, fn) {
		return Result.of(label, fn, { parent: this });
	}

	addOutput(detail) {
		this.output += detail;
	}

	cancel(error) {
		this.cancelled = true;
		this.stages[0].stage._cancel(error || new Error('cancelled')); // mark 'core' stage with error
		this.stages.forEach(({ config, stage }) => {
			if (!config.noCancel) {
				stage._complete(); // halt other stages without error
			}
		});
	}

	createStage(config, label, fn, { errorStackSkipFrames = 0 } = {}) {
		return ResultStage.of(label, (stage) => {
			this.stages.push({ config, stage });
			if (this.cancelled && !config.noCancel) {
				stage._complete();
			} else {
				return fn();
			}
		}, { errorStackSkipFrames: errorStackSkipFrames + 1 });
	}

	attachStage(config, stage) {
		this.stages.push({ config, stage });
	}

	overrideChildSummary(s) {
		this.forcedChildSummary = s;
	}

	getCurrentSummary() {
		if (this.buildCache) {
			return this.buildCache.summary;
		}

		const stagesSummary = this.stages
			.map(({ config, stage }) => filterSummary(config, stage.getSummary()))
			.reduce(combineSummary, {});

		if (stagesSummary.error || stagesSummary.fail || stagesSummary.skip) {
			stagesSummary.pass = 0;
		}

		const childSummary = (
			this.forcedChildSummary ||
			this.children.map((child) => child.getCurrentSummary()).reduce(combineSummary, {})
		);

		return combineSummary(
			stagesSummary,
			filterSummary({ tangible: true, time: false }, childSummary),
		);
	}

	hasFailed() {
		const summary = this.getCurrentSummary();
		return Boolean(summary.error || summary.fail);
	}

	get info() {
		return {
			id: this.id,
			parent: this.parent?.id ?? null,
			label: this.label,
		};
	}

	build() {
		if (this.buildCache) {
			return this.buildCache;
		}

		const errors = [];
		const failures = [];
		this.stages.forEach(({ stage }) => errors.push(...stage.errors));
		this.stages.forEach(({ stage }) => failures.push(...stage.failures));
		const children = this.children.map((child) => child.build());
		const summary = this.getCurrentSummary();
		this.buildCache = {
			...this.info,
			summary,
			errors: errors.map(buildError),
			failures: failures.map(buildError),
			output: this.output,
			children,
		};
		Object.freeze(this.stages);
		Object.freeze(this.children);
		Object.freeze(this);
		return this.buildCache;
	}
}

Result.of = async (label, fn, { parent = null, isBlock = false, listener = null } = {}) => {
	const result = new Result(label, parent);
	await result.createStage({ fail: true, time: true }, 'core', () => {
		listener?.({
			type: 'begin',
			time: Date.now(),
			isBlock: Boolean(isBlock),
			...result.info,
		});
		return fn(result);
	});
	const builtResult = result.build();
	listener?.({
		type: 'complete',
		time: Date.now(),
		isBlock: Boolean(isBlock),
		...builtResult,
	});
	return builtResult;
};

function buildError(err) {
	return {
		message: err.message,
		stackList: err.getStackParts(),
	};
}

function combineSummary(a, b) {
	const r = { ...a };
	Object.keys(b).forEach((k) => {
		r[k] = (r[k] || 0) + (b[k] || 0);
	});
	return r;
}

const RUN_INTERCEPTORS = Symbol();
const LISTENER = Symbol();

function updateArgs(oldArgs, newArgs) {
	if (!newArgs.length) {
		return oldArgs;
	}
	const updated = [...newArgs, ...oldArgs.slice(newArgs.length)];
	Object.freeze(updated[0]); // always freeze new context
	if (updated[2] !== oldArgs[2]) {
		throw new Error('Cannot change node');
	}
	return updated;
}

function runChain(chain, args) {
	const runStep = (index, args, ...newArgs) => {
		const updatedArgs = updateArgs(args, newArgs);
		const next = runStep.bind(null, index + 1, updatedArgs);
		return chain[index](next, ...updatedArgs);
	};
	return runStep(0, args);
}

class Node {
	constructor(parent, config, options, scopes) {
		this.config = Object.freeze(config);
		this.options = Object.freeze(options);
		this.scopes = Object.freeze(new Map(scopes.map(({ scope, value }) => [scope, value()])));
		this.parent = parent;
		this.children = [];
		parent?.children?.push(this);
		this.discoveryStage = null;
	}

	selfOrDescendantMatches(predicate) {
		return predicate(this) || this.children.some((child) => child.selfOrDescendantMatches(predicate));
	}

	getScope(key) {
		if (!this.scopes.has(key)) {
			throw new Error(`Unknown node config scope ${key}`);
		}
		return this.scopes.get(key);
	}

	async runDiscovery(methods, options) {
		if (this.config.discovery) {
			options.beginHook(this);
			this.discoveryStage = await ResultStage.of(
				'discovery',
				() => this.config.discovery(this, methods),
				{ errorStackSkipFrames: 1 + (this.config.discoveryFrames || 0), context: this },
			);
		}
		if (options.parallel) {
			await Promise.all(this.children.map((child) => child.runDiscovery(methods, options)));
		} else {
			for (const child of this.children) {
				await child.runDiscovery(methods, options);
			}
		}
		this.scopes.forEach(Object.freeze);
		Object.freeze(this.children);
		Object.freeze(this);
	}

	run(context, parentResult = null) {
		const label = this.config.display ? `${this.config.display}: ${this.options.name}` : null;
		const listener = context[LISTENER];
		return Result.of(label, (result) => {
			if (this.discoveryStage) {
				result.attachStage({ fail: true, time: true }, this.discoveryStage);
			}
			return runChain(context[RUN_INTERCEPTORS], [context, result, this]);
		}, { parent: parentResult, isBlock: this.config.isBlock, listener });
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

const id$1 = Symbol();
const CONTENT_FN_NAME = Symbol();
const TEST_FN_NAME = Symbol();
const SUB_FN_NAME = Symbol();

const OPTIONS_FACTORY$1 = (name, content, opts) => {
	if (!content || (typeof content !== 'function' && typeof content !== 'object')) {
		throw new Error('Invalid content');
	}
	return { ...opts, name: name.trim(), [CONTENT_FN_NAME]: content };
};

const DISCOVERY = async (node, methods) => {
	const content = node.options[CONTENT_FN_NAME];

	let resolvedContent = content;
	while (typeof resolvedContent === 'function') {
		resolvedContent = await resolvedContent(methods);
	}

	if (typeof resolvedContent === 'object' && resolvedContent) {
		Object.entries(resolvedContent).forEach(([name, value]) => {
			if (typeof value === 'function') {
				methods[node.config[TEST_FN_NAME]](name, value);
			} else if (typeof value === 'object' && value) {
				methods[node.config[SUB_FN_NAME]](name, value);
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
		display: display ?? fnName,
		isBlock: true, // this is also checked by lifecycle to decide which hooks to run and events for reporters to check
		[TEST_FN_NAME]: testFn,
		[SUB_FN_NAME]: subFn || fnName,
		discovery: DISCOVERY,
		discoveryFrames: 1,
	});

	builder.addRunInterceptor(async (next, context, result, node) => {
		if (!node.config.isBlock) {
			return next();
		}
		if (node.options.parallel) {
			return Promise.all(node.children.map((child) => child.run(context, result)));
		} else {
			for (const child of node.children) {
				await child.run(context, result);
			}
		}
	}, { order: Number.POSITIVE_INFINITY, id: id$1 });
};

class Runner extends AbstractRunner {
	constructor(baseNode, baseContext) {
		super();
		this.baseNode = baseNode;
		this.baseContext = baseContext;
		Object.freeze(this);
	}

	invoke(listener) {
		// enable long stack trace so that we can resolve scopes, cut down displayed traces, etc.
		Error.stackTraceLimit = 50;
		return this.baseNode.run(Object.freeze({
			...this.baseContext,
			[LISTENER]: listener,
		}));
	}
}

const GLOBALS = Symbol();
const NODE_TYPES = Symbol();
const NODE_OPTIONS = Symbol();
const NODE_INIT = Symbol();
const CONTEXT_INIT = Symbol();
const BASENODE_FN = Symbol();
const SUITE_FN = Symbol();

Runner.Builder = class RunnerBuilder {
	constructor() {
		this.extensions = new ExtensionStore();
		this.config = {
			parallelDiscovery: false,
			parallelSuites: false,
		};
		this.runInterceptors = [];
		this.suites = [];
		Object.freeze(this); // do not allow mutating the builder itself
		this.addPlugin(describe(BASENODE_FN, { display: false, subFn: SUITE_FN }));
		this.addPlugin(describe(SUITE_FN, { display: 'suite', subFn: 'describe' }));
	}

	useParallelDiscovery(enabled = true) {
		this.config.parallelDiscovery = enabled;
		return this;
	}

	useParallelSuites(enabled = true) {
		this.config.parallelSuites = enabled;
		return this;
	}

	addPlugin(...plugins) {
		plugins.forEach((plugin) => plugin(this));
		return this;
	}

	extend(key, ...values) {
		this.extensions.add(key, ...values);
		return this;
	}

	addRunInterceptor(fn, { order = 0, id = null } = {}) {
		if (id && this.runInterceptors.some((i) => (i.id === id))) {
			return this;
		}
		this.runInterceptors.push({ order, fn, id });
		return this;
	}

	addRunCondition(fn, { id = null } = {}) {
		return this.addRunInterceptor(async (next, context, ...rest) => {
			const result = await fn(context, ...rest);
			return next(result ? context : { ...context, active: false });
		}, { order: Number.NEGATIVE_INFINITY, id });
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

	async build() {
		const exts = this.extensions.copy();
		const parallelDiscovery = this.config.parallelDiscovery && await StackScope.isSupported();
		if (parallelDiscovery) {
			// enable long stack trace so that we can resolve which block we are in
			Error.stackTraceLimit = 50;
		}

		let discoveryStage = 0;
		let baseNode;
		let curNode = null;
		const getCurrentNode = parallelDiscovery ? ResultStage.getContext : (() => curNode);
		const addChildNode = (config, options) => {
			if (discoveryStage === 2) {
				throw new Error('Cannot create new tests after discovery phase');
			}
			const parent = getCurrentNode();
			const node = new Node(parent, config, options, exts.get(NODE_INIT));
			if (discoveryStage === 0) {
				baseNode = node;
			} else if (!parent) {
				throw new Error('Unable to determine test hierarchy; try using synchronous discovery mode');
			}
		};

		const methodTarget = Object.freeze({
			getCurrentNodeScope(scope) {
				if (discoveryStage === 2) {
					throw new Error('Cannot configure tests after discovery phase');
				}
				return getCurrentNode().getScope(scope);
			},
			extend: exts.add,
			get: exts.get,
		});

		const methods = Object.freeze(Object.fromEntries([
			...exts.get(GLOBALS).map(([key, g]) => ([key, bindAll(g, methodTarget)])),
			...exts.get(NODE_TYPES).map(({ key, optionsFactory, config }) => [key, Object.assign(
				(...args) => addChildNode(config, optionsFactory(...args)),
				Object.fromEntries(exts.get(NODE_OPTIONS).map(({ name, options }) => [
					name,
					(...args) => addChildNode(config, { ...optionsFactory(...args), ...options }),
				])),
			)]),
		]));

		methods[BASENODE_FN](
			'all tests',
			() => this.suites.forEach(([name, content, opts]) => methods[SUITE_FN](name, content, opts)),
			{ parallel: this.config.parallelSuites },
		);
		discoveryStage = 1;
		await baseNode.runDiscovery(methods, {
			beginHook: (node) => { curNode = node; },
			parallel: parallelDiscovery,
		});
		curNode = null;
		discoveryStage = 2;

		exts.freeze(); // ensure config cannot change post-discovery

		const baseContext = { active: true };
		exts.get(CONTEXT_INIT).forEach(({ scope, value }) => { baseContext[scope] = Object.freeze(value()); });
		baseContext[RUN_INTERCEPTORS] = Object.freeze(this.runInterceptors.sort((a, b) => (a.order - b.order)).map((i) => i.fn));

		return new Runner(baseNode, Object.freeze(baseContext));
	}
};

function bindAll(fn, thisArg) {
	if (typeof fn !== 'function') {
		return fn;
	}
	const r = fn.bind(thisArg);
	Object.entries(fn).forEach(([key, value]) => {
		r[key] = bindAll(value, thisArg);
	});
	return r;
}

/** same as result.then(then), but synchronous if result is synchronous */
function seq(result, then) {
	if (result instanceof Promise) {
		return result.then(then);
	} else {
		return then(result);
	}
}

const resolveMessage = (message) => String((typeof message === 'function' ? message() : message) || '');

const actualTypeOf = (o) => {
	if (o === null) {
		return 'null';
	} else if (Array.isArray(o)) {
		return 'array';
	} else {
		return typeof o;
	}
};

const print = (v) =>
	(typeof v === 'symbol' || v instanceof Error) ? v.toString() :
	typeof v === 'function' ? v :
	JSON.stringify(v);

const printNoQuotes = (v) => (typeof v === 'string' ? v : print(v));

const ANY = Symbol();

const checkEquals = (expected, actual, name) => {
	const diff = getDiff(actual, expected);
	if (diff) {
		return { pass: false, message: `Expected ${name} to equal ${print(expected)}, but ${diff}.` };
	} else {
		return { pass: true, message: `Expected ${name} not to equal ${print(expected)}, but did.` };
	}
};

const delegateMatcher = (matcher, actual, name) => {
	if (matcher === actual) {
		return { pass: true, message: `Expected ${name} not to equal ${print(matcher)}, but did.` };
	} else if (typeof matcher === 'function') {
		return matcher(actual);
	} else if (matcher === ANY) {
		return { pass: true, message: `Expected no ${name}, but got ${print(actual)}.` };
	} else {
		return checkEquals(matcher, actual, name);
	}
};

function getDiff(a, b) {
	if (a === b || (a !== a && b !== b)) {
		return null;
	}
	if (!a || typeof a !== 'object' || actualTypeOf(a) !== actualTypeOf(b)) {
		const labelA = print(a);
		const labelB = print(b);
		if (labelA === labelB) {
			return `${labelA} (${actualTypeOf(a)}) != ${labelB} (${actualTypeOf(b)})`;
		} else {
			return `${labelA} != ${labelB}`;
		}
	}
	// TODO: cope with loops, improve formatting of message
	const diffs = [];
	for (const k of Object.keys(a)) {
		if (!k in b) {
			diffs.push(`missing ${print(k)}`);
		} else {
			const sub = getDiff(a[k], b[k]);
			if (sub) {
				diffs.push(`${sub} at ${print(k)}`);
			}
		}
	}
	for (const k of Object.keys(b)) {
		if (!k in a) {
			diffs.push(`extra ${print(k)}`);
		}
	}
	return diffs.join(' and ');
}

const any = () => (actual) => ({
	pass: true,
	message: `Expected nothing, but got ${print(actual)}.`,
});

const not = (matcher) => (...args) =>
	seq(matcher(...args), ({ pass, message }) => ({ pass: !pass, message }));

const withMessage = (message, matcher) => (...args) =>
	seq(matcher(...args), ({ pass }) => ({ pass, message }));

const equals = (expected) => (actual) => checkEquals(expected, actual, 'value');

const same = (expected) => (actual) => {
	if (expected === actual) {
		return { pass: true, message: `Expected value not to be ${print(expected)}, but was.` };
	}
	const equalResult = checkEquals(expected, actual, 'value');
	if (equalResult.pass) {
		return { pass: false, message: `Expected exactly ${print(expected)}, but got a different (but matching) instance.` };
	} else {
		return equalResult;
	}
};

const isTrue = () => (actual) => {
	if (actual === true) {
		return { pass: true, message: `Expected value not to be true, but was.` };
	} else {
		return { pass: false, message: `Expected true, but got ${print(actual)}.` };
	}
};

const isTruthy = () => (actual) => {
	if (actual) {
		return { pass: true, message: `Expected value not to be truthy, but got ${print(actual)}.` };
	} else {
		return { pass: false, message: `Expected truthy value, but got ${print(actual)}.` };
	}
};

const isFalse = () => (actual) => {
	if (actual === false) {
		return { pass: true, message: `Expected value not to be false, but was.` };
	} else {
		return { pass: false, message: `Expected false, but got ${print(actual)}.` };
	}
};

const isFalsy = () => (actual) => {
	if (!actual) {
		return { pass: true, message: `Expected value not to be falsy, but got ${print(actual)}.` };
	} else {
		return { pass: false, message: `Expected falsy value, but got ${print(actual)}.` };
	}
};

const isNull = () => (actual) => {
	if (actual === null) {
		return { pass: true, message: `Expected value not to be null, but was.` };
	} else {
		return { pass: false, message: `Expected null, but got ${print(actual)}.` };
	}
};

const isUndefined = () => (actual) => {
	if (actual === undefined) {
		return { pass: true, message: `Expected value not to be undefined, but was.` };
	} else {
		return { pass: false, message: `Expected undefined, but got ${print(actual)}.` };
	}
};

const isNullish = () => (actual) => {
	if (actual === null || actual === undefined) {
		return { pass: true, message: `Expected value not to be nullish, but got ${print(actual)}.` };
	} else {
		return { pass: false, message: `Expected nullish value, but got ${print(actual)}.` };
	}
};

const resolves = (expected = ANY) => (input) => {
	function resolve(actual) {
		return delegateMatcher(expected, actual, 'resolved value');
	}
	function reject(actual) {
		return { pass: false, message: `Expected ${print(input)} to resolve, but threw ${print(actual)}.` };
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
			return { pass: false, message: `Expected ${print(input)} to throw ${print(expected)}, but did not throw (returned ${print(actual)}).` };
		} else {
			return { pass: false, message: `Expected ${print(input)} to throw, but did not throw (returned ${print(actual)}).` };
		}
	}
	function reject(actual) {
		if (typeof expected === 'string' && actual instanceof Error) {
			if (actual.message.includes(expected)) {
				return { pass: true, message: `Expected ${print(input)} not to throw error containing ${print(expected)} (threw ${print(actual)}).` };
			} else {
				return { pass: false, message: `Expected ${print(input)} to throw ${print(expected)}, but threw ${print(actual)}.` };
			}
		}
		return delegateMatcher(expected, actual, 'thrown value');
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

const isGreaterThan = (expected) => (actual) => {
	if (actual > expected) {
		return { pass: true, message: `Expected a value not greater than ${print(expected)}, but got ${print(actual)}.` };
	} else {
		return { pass: false, message: `Expected a value greater than ${print(expected)}, but got ${print(actual)}.` };
	}
};

const isLessThan = (expected) => (actual) => {
	if (actual < expected) {
		return { pass: true, message: `Expected a value not less than ${print(expected)}, but got ${print(actual)}.` };
	} else {
		return { pass: false, message: `Expected a value less than ${print(expected)}, but got ${print(actual)}.` };
	}
};

const isGreaterThanOrEqual = (expected) => (actual) => {
	if (actual >= expected) {
		return { pass: true, message: `Expected a value not greater than or equal to ${print(expected)}, but got ${print(actual)}.` };
	} else {
		return { pass: false, message: `Expected a value greater than or equal to ${print(expected)}, but got ${print(actual)}.` };
	}
};

const isLessThanOrEqual = (expected) => (actual) => {
	if (actual <= expected) {
		return { pass: true, message: `Expected a value not less than or equal to ${print(expected)}, but got ${print(actual)}.` };
	} else {
		return { pass: false, message: `Expected a value less than or equal to ${print(expected)}, but got ${print(actual)}.` };
	}
};

const isNear = (expected, precision = { decimalPlaces: 2 }) => (actual) => {
	if (typeof actual !== 'number') {
		return { pass: false, message: `Expected a numeric value close to ${print(expected)}, but got ${print(actual)}.` };
	}
	let tolerance;
	if (typeof precision === 'function') {
		tolerance = precision(expected);
	} else if (precision.tolerance !== undefined) {
		tolerance = precision.tolerance;
	} else if (precision.decimalPlaces !== undefined) {
		tolerance = 0.5 * Math.pow(10, -precision.decimalPlaces);
	} else {
		throw new Error(`Unsupported precision type: ${print(precision)}`);
	}
	if (Math.abs(expected - actual) <= tolerance) {
		return { pass: true, message: `Expected a value not within ${tolerance} of ${print(expected)}, but got ${print(actual)}.` };
	} else {
		return { pass: false, message: `Expected a value within ${tolerance} of ${print(expected)}, but got ${print(actual)}.` };
	}
};

const getLength = (o) => (
	((typeof o !== 'object' && typeof o !== 'string') || o === null) ? null :
	typeof o.length === 'number' ? o.length :
	typeof o.size === 'number' ? o.size :
	null
);

const hasLength = (expected = ANY) => (actual) => {
	const length = getLength(actual);
	if (length === null) {
		if (expected === ANY) {
			return { pass: false, message: `Expected a value with defined size, but got ${print(actual)}.` };
		} else {
			return { pass: false, message: `Expected a value of size ${print(expected)}, but got ${print(actual)}.` };
		}
	}
	return delegateMatcher(expected, length, 'length');
};

const isEmpty = () => (actual) => {
	const length = getLength(actual);
	if (length === null) {
		return { pass: false, message: `Expected an empty value, but got ${print(actual)}.` };
	} else if (length > 0) {
		return { pass: false, message: `Expected an empty value, but got ${print(actual)}.` };
	} else {
		return { pass: true, message: `Expected a non-empty value, but got ${print(actual)}.` };
	}
};

const contains = (sub) => (actual) => {
	if (typeof sub === 'function') {
		let results;
		if (Array.isArray(actual)) {
			results = actual.map(sub);
		} else if (actual instanceof Set) {
			results = [...actual].map(sub);
		} else {
			return { pass: false, message: `Expected to contain element matching ${print(sub)}, but got non-collection type ${print(actual)}.` };
		}
		const passes = results.filter((r) => r.pass);
		if (passes.length > 0) {
			return { pass: true, message: `Expected not to contain any element matching ${print(sub)}, but got ${print(actual)}.` };
		} else {
			return { pass: false, message: `Expected to contain element matching ${print(sub)}, but got ${print(actual)}.` };
		}
	}
	let pass;
	if (typeof actual === 'string') {
		if (typeof sub !== 'string') {
			throw new Error(`cannot check for ${typeof sub} in string.`);
		}
		pass = actual.includes(sub);
	} else if (Array.isArray(actual)) {
		pass = actual.includes(sub);
	} else if (actual instanceof Set) {
		pass = actual.has(sub);
	} else {
		return { pass: false, message: `Expected to contain ${print(sub)}, but got non-collection type ${print(actual)}.` };
	}
	if (pass) {
		return { pass: true, message: `Expected not to contain ${print(sub)}, but got ${print(actual)}.` };
	} else {
		return { pass: false, message: `Expected to contain ${print(sub)}, but got ${print(actual)}.` };
	}
};

const isListOf = (...items) => (actual) => {
	if (!Array.isArray(actual)) {
		return { pass: false, message: `Expected to contain ${print(items)}, but got non-collection type ${print(actual)}.` };
	}

	if (actual.length !== items.length) {
		return { pass: false, message: `Expected to contain ${print(items)}, but got ${print(actual)}.` };
	}

	for (let i = 0; i < items.length; ++i) {
		const result = delegateMatcher(items[i], actual[i], `item ${i + 1}`);
		if (!result.pass) {
			return result;
		}
	}
	return { pass: true, message: `Expected not to contain ${print(items)}, but did.` };
};

const hasProperty = (name, expected = ANY) => (actual) => {
	if (actual !== null && actual !== undefined && Object.prototype.hasOwnProperty.call(actual, name)) {
		return delegateMatcher(expected, actual[name], print(name));
	} else {
		return { pass: false, message: `Expected a value with property ${print(name)}, but got ${print(actual)}.` };
	}
};

const hasBeenCalled = ({ times = null } = {}) => (fn) => {
	const invocations = fn.invocations;
	if (!invocations) {
		throw new Error('matcher can only be used with mocked functions');
	}
	const actualTimes = invocations.length;
	if (times === null) {
		if (actualTimes > 0) {
			return { pass: true, message: `Expected not to have been called, but was called ${actualTimes} time(s).` };
		} else {
			return { pass: false, message: 'Expected to have been called, but was not.' };
		}
	}
	if (actualTimes === times) {
		return { pass: true, message: `Expected not to have been called ${times} time(s), but was.` };
	} else {
		return { pass: false, message: `Expected to have been called ${times} time(s), but was called ${actualTimes} time(s).` };
	}
};

const hasBeenCalledWith = (...expectedArgs) => (fn) => {
	const invocations = fn.invocations;
	if (!invocations) {
		throw new Error('matcher can only be used with mocked functions');
	}
	const matcher = isListOf(...expectedArgs);
	const mismatches = [];
	for (const i of invocations) {
		const match = matcher(i.arguments);
		if (match.pass) {
			return { pass: true, message: `Expected not to have been called with ${expectedArgs.map(print).join(', ')}, but was.` };
		}
		mismatches.push(`  ${i.arguments.map(print).join(', ')} (${match.message})`);
	}
	return { pass: false, message: `Expected to have been called with ${expectedArgs.map(print).join(', ')}, but no matching calls.\nObserved calls:\n${mismatches.join('\n')}` };
};

var matchers = /*#__PURE__*/Object.freeze({
	__proto__: null,
	any: any,
	not: not,
	withMessage: withMessage,
	equals: equals,
	same: same,
	isTrue: isTrue,
	isTruthy: isTruthy,
	isFalse: isFalse,
	isFalsy: isFalsy,
	isNull: isNull,
	isUndefined: isUndefined,
	isNullish: isNullish,
	resolves: resolves,
	throws: throws,
	isGreaterThan: isGreaterThan,
	isLessThan: isLessThan,
	isGreaterThanOrEqual: isGreaterThanOrEqual,
	isLessThanOrEqual: isLessThanOrEqual,
	isNear: isNear,
	hasLength: hasLength,
	isEmpty: isEmpty,
	contains: contains,
	isListOf: isListOf,
	hasProperty: hasProperty,
	hasBeenCalled: hasBeenCalled,
	hasBeenCalledWith: hasBeenCalledWith,
	toEqual: equals,
	toBe: same,
	toBeTruthy: isTruthy,
	toBeFalsy: isFalsy,
	toBeNull: isNull,
	toBeUndefined: isUndefined,
	toThrow: throws,
	toBeGreaterThan: isGreaterThan,
	toBeLessThan: isLessThan,
	toBeGreaterThanOrEqual: isGreaterThanOrEqual,
	toBeLessThanOrEqual: isLessThanOrEqual,
	toHaveLength: hasLength,
	toContain: contains,
	toHaveProperty: hasProperty,
	toHaveBeenCalled: hasBeenCalled,
	toHaveBeenCalledWith: hasBeenCalledWith
});

const FLUENT_MATCHERS = Symbol();

const expect = () => (builder) => {
	const invokeMatcher = (actual, matcher, ErrorType, skipFrames) =>
		seq(matcher(actual), ({ pass, message }) => {
			if (!pass) {
				throw new ErrorType(resolveMessage(message), skipFrames + 3);
			}
		});

	const run = (context, ErrorType, actual, matcher = undefined) => {
		if (matcher) {
			return invokeMatcher(actual, matcher, ErrorType, 2);
		}
		return Object.fromEntries(context.get(FLUENT_MATCHERS).map(([name, m]) =>
			[name, (...args) => invokeMatcher(actual, m(...args), ErrorType, 1)]
		));
	};

	function expect(...args) {
		return run(this, TestAssertionError, ...args);
	}

	function assume(...args) {
		return run(this, TestAssumptionError, ...args);
	}

	function extend(matchers) {
		this.extend(FLUENT_MATCHERS, ...Object.entries(matchers));
	}

	expect.extend = extend;

	builder.addGlobals({ expect, assume });
};

expect.matchers = (...matcherDictionaries) => (builder) => {
	matcherDictionaries.forEach((md) => {
		builder.extend(FLUENT_MATCHERS, ...Object.entries(md));
		builder.addGlobals(md);
	});
};

var fail = () => (builder) => {
	builder.addGlobals({
		fail(message) {
			throw new TestAssertionError(resolveMessage(message), 1);
		},
		skip(message) {
			throw new TestAssumptionError(resolveMessage(message), 1);
		},
	});
};

const focused = (node) => node.options.focus;

var focus = () => (builder) => {
	builder.addNodeOption('focus', { focus: true });

	const scope = builder.addScope({
		context: () => ({
			withinFocus: false,
			anyFocus: null,
		}),
	});

	builder.addRunInterceptor((next, context, _, node) => {
		const withinFocus = focused(node) || context[scope].withinFocus;
		let anyFocus = context[scope].anyFocus;
		if (anyFocus === null) { // must be root object
			anyFocus = withinFocus || node.selfOrDescendantMatches(focused);
		}
		if (!anyFocus || withinFocus || node.selfOrDescendantMatches(focused)) {
			return next({ ...context, [scope]: { withinFocus, anyFocus } });
		} else {
			return next({ ...context, [scope]: { withinFocus, anyFocus }, active: false });
		}
	}, { order: Number.NEGATIVE_INFINITY });
};

var ignore = () => (builder) => {
	builder.addNodeOption('ignore', { ignore: true });
	builder.addRunCondition((_, _result, node) => (!node.options.ignore));
};

var lifecycle = ({ order = 0 } = {}) => (builder) => {
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

	builder.addRunInterceptor((next, context, result, node) => {
		if (!context.active) {
			return next(context);
		} else if (!node.config.isBlock) {
			return withWrappers(result, context[scope].beforeEach, context[scope].afterEach, (skip) => next({
				...context,
				active: !skip,
			}));
		} else {
			const nodeScope = node.getScope(scope);
			return withWrappers(result, [nodeScope.beforeAll], [nodeScope.afterAll], (skip) => next({
				...context,
				[scope]: {
					beforeEach: [...context[scope].beforeEach, nodeScope.beforeEach],
					afterEach: [...context[scope].afterEach, nodeScope.afterEach],
				},
				active: !skip,
			}));
		}
	}, { order });

	async function withWrappers(result, before, after, next) {
		let skip = false;
		const allTeardowns = [];
		let i = 0;
		for (; i < before.length && !skip; ++i) {
			const teardowns = [];
			for (const { name, fn } of before[i]) {
				const stage = await result.createStage(
					{ fail: true },
					`before ${name}`,
					async () => {
						const teardown = await fn();
						if (typeof teardown === 'function') {
							teardowns.unshift({ name, fn: teardown });
						}
					},
					{ errorStackSkipFrames: 1 }
				);
				if (stage.hasFailed() || stage.hasSkipped()) {
					skip = true;
					break;
				}
			}
			allTeardowns.push(teardowns);
		}

		try {
			return await next(skip);
		} finally {
			while ((i--) > 0) {
				for (const { name, fn } of after[i]) {
					await result.createStage({ fail: true, noCancel: true }, `after ${name}`, fn);
				}
				for (const { name, fn } of allTeardowns[i]) {
					await result.createStage({ fail: true, noCancel: true }, `teardown ${name}`, fn);
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

	builder.addGlobals({
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

const IS_BROWSER = (typeof process === 'undefined');
const OUTPUT_CAPTOR_SCOPE = new StackScope('OUTPUT_CAPTOR');

function interceptWrite(original, type, chunk, encoding, callback) {
	const target = OUTPUT_CAPTOR_SCOPE.get();
	if (!target) {
		// We do not seem to be within a scope; could be unrelated code,
		// or could be that the stack got too deep to know.
		// Call original function as fallback
		return original.call(this, chunk, encoding, callback);
	}
	if (typeof encoding === 'function') {
		callback = encoding;
		encoding = null;
	}
	if (typeof chunk === 'string') {
		chunk = Buffer.from(chunk, encoding ?? 'utf8');
	}
	target.push({ type, chunk });
	callback?.();
	return true;
}

function interceptConsole(original, type, ...args) {
	const target = OUTPUT_CAPTOR_SCOPE.get();
	if (!target) {
		return original.call(this, ...args);
	}
	target.push({ type, args });
	return true;
}

let interceptCount = 0;
const teardowns = [];
function overrideMethod(object, method, replacement, ...bindArgs) {
	const original = object[method];
	teardowns.push(() => {
		object[method] = original;
	});
	object[method] = replacement.bind(object, original, ...bindArgs);
}

async function addIntercept() {
	if ((interceptCount++) > 0) {
		return;
	}

	if (IS_BROWSER) {
		['log', 'trace', 'debug', 'info', 'warn', 'error'].forEach((name) => {
			overrideMethod(console, name, interceptConsole, name);
		});
	} else {
		overrideMethod(process.stdout, 'write', interceptWrite, 'stdout');
		overrideMethod(process.stderr, 'write', interceptWrite, 'stderr');
	}
}

async function removeIntercept() {
	if ((--interceptCount) > 0) {
		return;
	}
	teardowns.forEach((fn) => fn());
	teardowns.length = 0;
}

function getCapturedOutput() {
	const target = OUTPUT_CAPTOR_SCOPE.get();
	if (!target) {
		const err = new Error(`Unable to resolve ${type} scope`);
		err.skipFrames = 2;
		throw err;
	}
	return target;
}

function combineOutput(parts, binary) {
	if (IS_BROWSER) {
		if (binary) {
			throw new Error('cannot get output in binary format in browser environment');
		}
		// This is not perfectly representative of what would be logged, but should be generally good enough for testing
		return parts.map((i) => i.args.map(printNoQuotes).join(' ') + '\n').join('')
	} else {
		const all = Buffer.concat(parts.map((i) => i.chunk));
		return binary ? all : all.toString('utf8');
	}
}

var outputCaptor = ({ order = -1 } = {}) => (builder) => {
	builder.addGlobals({
		getStdout(binary = false) {
			return combineOutput(getCapturedOutput().filter((i) => (i.type === 'stdout')), binary);
		},
		getStderr(binary = false) {
			return combineOutput(getCapturedOutput().filter((i) => (i.type === 'stderr')), binary);
		},
		getOutput(binary = false) {
			return combineOutput(getCapturedOutput(), binary);
		}
	});
	builder.addRunInterceptor(async (next, _, result) => {
		const target = [];
		try {
			addIntercept();
			await OUTPUT_CAPTOR_SCOPE.run(target, next);
		} finally {
			removeIntercept();
			if (target.length) {
				result.addOutput(combineOutput(target, false));
			}
		}
	}, { order });
};

var repeat = ({ order = -3 } = {}) => (builder) => {
	builder.addRunInterceptor(async (next, context, result, node) => {
		let { repeat = {} } = node.options;
		if (typeof repeat !== 'object') {
			repeat = { total: repeat };
		}

		const { total = 1, failFast = true, maxFailures = 0 } = repeat;
		if (!context.active || total <= 1 || result.hasFailed()) {
			return next(context);
		}

		let failureCount = 0;
		let bestPassSummary = null;
		let bestFailSummary = null;

		result.overrideChildSummary({ count: 1, run: 1 });
		for (let repetition = 0; repetition < total; ++repetition) {
			const subResult = await result.createChild(
				`repetition ${repetition + 1} of ${total}`,
				(subResult) => next(context, subResult),
			);
			const subSummary = subResult.summary;
			if (subSummary.error || subSummary.fail || !subSummary.pass) {
				failureCount++;
				if (!bestFailSummary || subSummary.pass > bestFailSummary.pass) {
					bestFailSummary = subSummary;
				}
				if (failureCount > maxFailures) {
					result.overrideChildSummary(bestFailSummary);
				}
			} else if (failureCount <= maxFailures) {
				if (!bestPassSummary || subSummary.pass > bestPassSummary.pass) {
					bestPassSummary = subSummary;
				}
				result.overrideChildSummary(bestPassSummary);
			}
			if (failFast && failureCount > maxFailures) {
				break;
			}
		}
	}, { order });
};

var retry = ({ order = -2 } = {}) => (builder) => {
	builder.addRunInterceptor(async (next, context, result, node) => {
		const maxAttempts = node.options.retry || 0;
		if (!context.active || maxAttempts <= 1) {
			return next(context);
		}

		for (let attempt = 0; attempt < maxAttempts; ++attempt) {
			const subResult = await result.createChild(
				`attempt ${attempt + 1} of ${maxAttempts}`,
				(subResult) => next(context, subResult),
			);
			const subSummary = subResult.summary;
			result.overrideChildSummary(subSummary);
			if (!subSummary.error && !subSummary.fail) {
				break;
			}
		}
	}, { order });
};

const ACTIONS = Symbol();

class MockAction {
	constructor(mock) {
		this.mock = mock;
		this.argsMatcher = null;
		this.limit = Number.POSITIVE_INFINITY;
		this.state = { matches: 0 };
		this.fn = null;

		if (mock.original) {
			this.thenCallThrough = this.then.bind(this, mock.original);
		}
	}

	with(...expectedArgs) {
		this.argsMatcher = isListOf(...expectedArgs);
		return this;
	}

	once() {
		return this.times(1);
	}

	times(n) {
		this.limit = n;
		return this;
	}

	then(fn) {
		if (typeof fn !== 'function') {
			throw new Error('Invalid mock action');
		}
		this.fn = fn;
		Object.freeze(this);
		this.mock[ACTIONS].push(this);
		return this.mock;
	}

	thenReturn(value) {
		return this.then(() => value);
	}

	thenResolve(value) {
		return this.thenReturn(Promise.resolve(value));
	}

	thenReject(value) {
		return this.thenReturn(Promise.reject(value));
	}

	thenThrow(error) {
		return this.then(() => {
			throw error;
		});
	}

	_check(args) {
		if (this.state.matches >= this.limit) {
			return null;
		}
		try {
			if (this.argsMatcher?.(args)?.pass !== false) {
				this.state.matches++;
				return this.fn;
			}
		} catch (ignore) {
		}
		return null;
	}
}

function mockFunction(name, original) {
	if (original !== undefined && typeof original !== 'function') {
		throw new Error('Invalid call to mock() - bad original function');
	}
	const actions = [];
	const invocations = [];
	const mock = {
		[name](...args) {
			invocations.push({ arguments: args, stack: new Error().stack });
			for (const action of actions) {
				const fn = action._check(args);
				if (fn) {
					return fn.apply(this, args);
				}
			}
			return original?.apply(this, args);
		},
	};
	const fn = mock[name];
	fn.original = original;
	fn.invocations = invocations;
	fn[ACTIONS] = actions;
	fn.whenCalled = () => new MockAction(fn);
	fn.whenCalledNext = () => fn.whenCalled().once();
	fn.whenCalledWith = (...args) => fn.whenCalled().with(...args);
	fn.returning = (value) => fn.whenCalled().thenReturn(value);
	fn.throwing = (error) => fn.whenCalled().thenThrow(error);
	fn.reset = () => {
		invocations.length = 0;
		actions.length = 0;
		return fn;
	};
	return fn;
}

function mockMethod(object, method) {
	const original = object[method];
	if (typeof original !== 'function') {
		throw new Error(`Cannot mock ${print(method)} as it is not a function`);
	}
	if (original[ACTIONS]) {
		throw new Error(`Cannot mock ${print(method)} as it is already mocked`);
	}
	const fn = mockFunction(method, original);
	fn.revert = () => {
		fn.reset();
		object[method] = original;
		fn.revert = () => undefined;
	};
	object[method] = fn;
	return fn;
}

function mock(a, ...rest) {
	if (typeof a === 'object' && a) {
		return mockMethod(a, ...rest);
	} else if (typeof a === 'function') {
		return mockFunction(a.name, a, ...rest);
	} else if (typeof a === 'string' || a === undefined) {
		return mockFunction(a || 'mock function', ...rest);
	} else {
		throw new Error('Invalid call to mock()');
	}
}

const MOCK_SCOPE = new StackScope('MOCK');

var scopedMock = () => (builder) => {
	builder.addGlobals({
		mock(...args) {
			const fn = mock(...args);
			if (fn.revert) {
				MOCK_SCOPE.get()?.push(fn);
			}
			return fn;
		},
	});

	builder.addRunInterceptor(async (next) => {
		const mockedMethods = [];
		try {
			await MOCK_SCOPE.run(mockedMethods, next);
		} finally {
			for (const mock of mockedMethods) {
				mock.revert();
			}
		}
	});
};

var stopAtFirstFailure = () => (builder) => {
	builder.addRunCondition((_, result, node) => !(
		node.parent &&
		node.parent.options.stopAtFirstFailure &&
		result.parent.hasFailed()
	));
};

const id = Symbol();
const TEST_FN = Symbol();

const OPTIONS_FACTORY = (name, fn, opts) => ({ ...opts, name: name.trim(), [TEST_FN]: fn });
const CONFIG = { display: 'test' };

var test = (fnName = 'test') => (builder) => {
	builder.addNodeType(fnName, OPTIONS_FACTORY, CONFIG);

	builder.addRunInterceptor((next, context, result, node) => {
		if (!node.options[TEST_FN]) {
			return next();
		}
		return result.createStage({ tangible: true }, 'test', () => {
			if (!context.active) {
				throw new TestAssumptionError('ignored');
			}
			return node.options[TEST_FN]();
		}, { errorStackSkipFrames: 1 });
	}, { order: Number.POSITIVE_INFINITY, id });
};

var timeout = ({ order = 1 } = {}) => (builder) => {
	builder.addRunInterceptor(async (next, context, result, node) => {
		const { timeout = 0 } = node.options;
		if (!context.active || timeout <= 0) {
			return next(context);
		}

		let tm;
		await result.createChild(
			`with ${timeout}ms timeout`,
			(subResult) => Promise.race([
				new Promise((resolve) => {
					tm = setTimeout(() => {
						const error = new Error(`timeout after ${timeout}ms`);
						error.skipFrames = 1;
						subResult.cancel(error);
						resolve();
					}, timeout);
				}),
				next(context, subResult).then(() => clearTimeout(tm)),
			]),
		);
	}, { order });
};

var index$3 = /*#__PURE__*/Object.freeze({
	__proto__: null,
	describe: describe,
	expect: expect,
	fail: fail,
	focus: focus,
	ignore: ignore,
	lifecycle: lifecycle,
	outputCaptor: outputCaptor,
	repeat: repeat,
	retry: retry,
	scopedMock: scopedMock,
	stopAtFirstFailure: stopAtFirstFailure,
	test: test,
	timeout: timeout
});

class ParallelRunner extends AbstractRunner {
	constructor() {
		super();
		this.runners = [];
	}

	add(label, runner) {
		this.runners.push({ label, runner });
	}

	prepare(sharedState) {
		return Promise.all(this.runners.map(({ runner }) => runner.prepare(sharedState)));
	}

	teardown(sharedState) {
		return Promise.all(this.runners.map(({ runner }) => runner.teardown(sharedState)));
	}

	invoke(listener, sharedState) {
		if (this.runners.length === 0) {
			throw new Error('No sub-runners registered');
		}
		if (this.runners.length === 1) {
			return this.runners[0].runner.invoke(listener, sharedState);
		}
		return Result.of(null, async (baseResult) => {
			const subResults = await Promise.all(this.runners.map(async ({ label, runner }) => {
				const convert = (o) => ((o.parent === null) ? { ...o, parent: baseResult.id, label } : o);
				const subListener = listener ? ((event) => listener(convert(event))) : null;
				const subResult = await runner.invoke(subListener, sharedState)
					.catch((e) => Result.of(null, () => { throw e; }, { isBlock: true }));
				return new StaticResult(convert(subResult));
			}));
			baseResult.children.push(...subResults);
		}, { isBlock: true, listener });
	}
}

class StaticResult {
	constructor(built) {
		this.build = () => built;
		this.getCurrentSummary = () => built.summary;
	}
}

var index$2 = /*#__PURE__*/Object.freeze({
	__proto__: null,
	mock: mock
});

class Writer {
	constructor(writer, forceTTY = null) {
		this.writer = writer;
		this.dynamic = forceTTY ?? writer.isTTY;
		if (this.dynamic) {
			this.colour = (...vs) => {
				const prefix = '\u001B[' + vs.join(';') + 'm';
				return (v) => `${prefix}${v}\u001B[0m`;
			};
		} else {
			this.colour = () => (v, fallback) => (fallback ?? v);
		}
		this.red = this.colour(31);
		this.green = this.colour(32);
		this.yellow = this.colour(33);
		this.blue = this.colour(34);
		this.purple = this.colour(35);
		this.cyan = this.colour(36);
		this.gray = this.colour(37);
		this.redBack = this.colour(41, 38, 5, 231);
		this.greenBack = this.colour(42, 38, 5, 231);
		this.yellowBack = this.colour(43, 38, 5, 231);
		this.blueBack = this.colour(44, 38, 5, 231);
		this.purpleBack = this.colour(45, 38, 5, 231);
		this.cyanBack = this.colour(46, 38, 5, 231);
		this.grayBack = this.colour(47, 38, 5, 231);
		this.bold = this.colour(1);
		this.faint = this.colour(2);

		// grab the write function so that nothing in the tests can intercept it
		this.writeRaw = this.writer.write.bind(this.writer);
	}

	write(v, linePrefix = '', continuationPrefix = null) {
		String(v).split(/\r\n|\n\r?/g).forEach((ln, i) => {
			this.writeRaw(((i ? continuationPrefix : null) ?? linePrefix) + ln + '\n');
		});
	}
}

var index$1 = /*#__PURE__*/Object.freeze({
	__proto__: null,
	Writer: Writer
});

class Dots {
	constructor(output) {
		this.output = output;
		this.lineLimit = 50;
		this.blockSep = 10;
		this.count = 0;
		this.eventListener = this.eventListener.bind(this);
	}

	eventListener(event) {
		if (event.type === 'complete') {
			if (!event.parent) {
				// whole test run complete
				this.output.writeRaw('\n\n');
				return;
			}
			const { summary } = event;
			if (event.isBlock) {
				if (summary.count || (!summary.error && !summary.fail)) {
					// do not care about block-level events unless they failed without running any children
					return;
				}
			}
			let marker = null;
			if (summary.error) {
				marker = this.output.redBack('!');
			} else if (summary.fail) {
				marker = this.output.redBack('X');
			} else if (summary.pass) {
				marker = this.output.green('*');
			} else if (summary.skip) {
				marker = this.output.yellow('-');
			} else {
				marker = this.output.yellow('-');
			}
			this.output.writeRaw(marker);
			++this.count;
			if ((this.count % this.lineLimit) === 0) {
				this.output.writeRaw('\n');
			} else if ((this.count % this.blockSep) === 0) {
				this.output.writeRaw(' ');
			}
		}
	}
}

class ErrorList {
	constructor(output) {
		this.output = output;
	}

	_printerr(prefix, err, indent) {
		this.output.write(
			this.output.red(prefix + this.output.bold(err.message)) +
			this.output.red(err.stackList.map((s) => `\n at ${s.location}`).join('')),
			indent,
		);
	}

	_formatPath(path) {
		const v = path
			.filter((result) => result.label !== null)
			.map((result) => {
				const isBlock = (result.children.length > 0 || !result.summary.count);
				return isBlock ? this.output.bold(this.output.cyan(result.label)) : result.label;
			})
			.join(' - ');

		return v.length > 0 ? v : this.output.bold(this.output.cyan('root'));
	}

	report(result) {
		const { empty, fail, error } = collect(result, []);

		for (const { path } of empty) {
			this.output.write(this._formatPath(path));
			this.output.write(this.output.bold(this.output.yellow('  No Tests')));
			this.output.write('');
		}

		for (const { path, failures, output } of fail) {
			this.output.write(this._formatPath(path));
			if (output) {
				this.output.write(this.output.blue(output), '  ');
			}
			failures.forEach((err) => this._printerr('Failure: ', err, '  '));
			this.output.write('');
		}

		for (const { path, errors, output } of error) {
			this.output.write(this._formatPath(path));
			if (output) {
				this.output.write(this.output.blue(output), '  ');
			}
			errors.forEach((err) => this._printerr('Error: ', err, '  '));
			this.output.write('');
		}
	}
}

function collect(result, parentPath) {
	const path = [...parentPath, result];

	const found = { empty: [], fail: [], error: [] };
	for (const subResult of result.children) {
		const subFound = collect(subResult, path);
		found.empty.push(...subFound.empty);
		found.fail.push(...subFound.fail);
		found.error.push(...subFound.error);
	}

	const { summary } = result;
	if (!summary.run && !summary.error && !summary.fail && !summary.pass && !summary.skip) {
		found.empty.push({ path });
	}
	if (summary.fail) {
		if (!found.fail.length) {
			found.fail.push({ path, failures: result.failures, output: result.output });
		}
	} else {
		found.fail.length = 0; // ignore errors if the higher-level node succeeded (e.g. retry)
	}
	if (summary.error) {
		if (!found.error.length) {
			found.error.push({ path, errors: result.errors, output: result.output });
		}
	} else {
		found.error.length = 0; // ignore errors if the higher-level node succeeded (e.g. retry)
	}
	return found;
}

class Full$1 {
	constructor(output) {
		this.output = output;
	}

	_printerr(prefix, err, indent) {
		this.output.write(
			this.output.red(prefix + this.output.bold(err.message)) +
			this.output.red(err.stackList.map((s) => `\n at ${s.location}`).join('')),
			indent,
		);
	}

	_print(result, indent) {
		const { summary } = result;
		let marker = '';
		if (summary.error) {
			marker = this.output.redBack(' ERRO ', '[ERRO]');
		} else if (summary.fail) {
			marker = this.output.redBack(' FAIL ', '[FAIL]');
		} else if (summary.run) {
			marker = this.output.blueBack(' .... ', '[....]');
		} else if (summary.pass) {
			marker = this.output.greenBack(' PASS ', '[PASS]');
		} else if (summary.skip) {
			marker = this.output.yellowBack(' SKIP ', '[SKIP]');
		} else {
			marker = this.output.yellowBack(' NONE ', '[NONE]');
		}
		const resultSpace = '      ';

		const isBlock = (result.children.length > 0 || !summary.count);
		const isSlow = (summary.duration > 500);

		const display = (result.label !== null);
		const formattedLabel = isBlock ? this.output.bold(this.output.cyan(result.label)) : result.label;

		const duration = `[${summary.duration}ms]`;
		const formattedDuration = isSlow ? this.output.yellow(duration) : this.output.faint(duration);

		if (display) {
			this.output.write(
				`${formattedLabel} ${formattedDuration}`,
				`${marker} ${indent}`,
				`${resultSpace} ${indent}`,
			);
		}
		const infoIndent = `${resultSpace} ${indent}  `;
		if (result.output && (summary.error || summary.fail)) {
			this.output.write(this.output.blue(result.output), infoIndent);
		}
		result.errors.forEach((err) => this._printerr('Error: ', err, infoIndent));
		result.failures.forEach((err) => this._printerr('Failure: ', err, infoIndent));
		const nextIndent = indent + (display ? '  ' : '');
		result.children.forEach((child) => this._print(child, nextIndent));
	}

	report(result) {
		this._print(result, '');

		if (!result.summary.count) {
			this.output.write(this.output.yellow('NO TESTS FOUND'));
		}

		this.output.write('');
	}
}

class Full {
	constructor(output) {
		this.output = output;
	}

	report(result) {
		const { summary } = result;

		this.output.write(`Total:    ${summary.count || 0}`);
		this.output.write(`Pass:     ${summary.pass || 0}`);
		this.output.write(`Errors:   ${summary.error || 0}`);
		this.output.write(`Failures: ${summary.fail || 0}`);
		this.output.write(`Skipped:  ${summary.skip || 0}`);
		this.output.write(`Duration: ${summary.duration}ms`);
		this.output.write('');

		if (summary.error) {
			this.output.write(this.output.red('ERROR'));
		} else if (summary.fail) {
			this.output.write(this.output.red('FAIL'));
		} else if (summary.pass) {
			this.output.write(this.output.green('PASS'));
		} else {
			this.output.write(this.output.yellow('NO TESTS RUN'));
		}
	}
}

var index = /*#__PURE__*/Object.freeze({
	__proto__: null,
	Dots: Dots,
	ErrorList: ErrorList,
	Full: Full$1,
	Summary: Full
});

function standardRunner() {
	return new Runner.Builder()
		.addPlugin(describe())
		.addPlugin(expect())
		.addPlugin(expect.matchers(matchers))
		.addPlugin(fail())
		.addPlugin(focus())
		.addPlugin(ignore())
		.addPlugin(lifecycle())
		.addPlugin(outputCaptor())
		.addPlugin(repeat())
		.addPlugin(retry())
		.addPlugin(scopedMock())
		.addPlugin(stopAtFirstFailure())
		.addPlugin(test())
		.addPlugin(test('it'))
		.addPlugin(timeout());
}

export { AbstractRunner, ExitHook, ParallelRunner, Runner, TestAssertionError, TestAssumptionError, index$2 as helpers, matchers, index$1 as outputs, index$3 as plugins, index as reporters, setIdNamespace, standardRunner };
