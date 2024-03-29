import AbstractRunner from './AbstractRunner.mjs';
import Node, { RUN_INTERCEPTORS, LISTENER } from '../core/Node.mjs';
import ExtensionStore from '../core/ExtensionStore.mjs';
import ResultStage from '../core/ResultStage.mjs';
import StackScope from '../core/StackScope.mjs';
import describe from '../plugins/describe.mjs';

export default class Runner extends AbstractRunner {
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

const GLOBALS = Symbol('GLOBALS');
const NODE_TYPES = Symbol('NODE_TYPES');
const NODE_OPTIONS = Symbol('NODE_OPTIONS');
const NODE_INIT = Symbol('NODE_INIT');
const CONTEXT_INIT = Symbol('CONTEXT_INIT');
const BASENODE_FN = Symbol('BASENODE_FN');
const SUITE_FN = Symbol('SUITE_FN');

Runner.Builder = class RunnerBuilder {
	constructor() {
		this.extensions = new ExtensionStore();
		this.config = {
			parallelDiscovery: false,
			parallelSuites: false,
			executionOrderer: null,
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

	useExecutionOrderer(orderer) {
		this.config.executionOrderer = orderer;
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

	addRunInterceptor(fn, { order = 0, name = 'interceptor', id = null } = {}) {
		if (id && this.runInterceptors.some((i) => (i.id === id))) {
			return this;
		}
		Object.defineProperty(fn, 'name', { value: name });
		this.runInterceptors.push({ order, fn, id });
		return this;
	}

	addRunCondition(fn, { name = 'condition', id = null } = {}) {
		return this.addRunInterceptor(async (next, context, ...rest) => {
			const result = await fn(context, ...rest);
			return next(result ? context : { ...context, active: false });
		}, { order: Number.NEGATIVE_INFINITY, name, id });
	}

	addSuite(name, content, options = {}) {
		this.suites.push([name, content, options]);
		return this;
	}

	addSuites(suites) {
		Object.entries(suites).forEach(([name, content]) => this.addSuite(name, content));
		return this;
	}

	addScope({ name = 'unnamed', node, context }) {
		const scope = Symbol(`${name}_scope`);
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

		const baseContext = { active: true, executionOrderer: this.config.executionOrderer };
		exts.get(CONTEXT_INIT).forEach(({ scope, value }) => { baseContext[scope] = Object.freeze(value()); });
		baseContext[RUN_INTERCEPTORS] = Object.freeze(this.runInterceptors.sort((a, b) => (a.order - b.order)).map((i) => i.fn));

		return new Runner(baseNode, Object.freeze(baseContext));
	}
}

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
