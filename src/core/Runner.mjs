import Node from './Node.mjs';
import ExtensionStore from './ExtensionStore.mjs';
import describe from '../plugins/describe.mjs';

export default class Runner {
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

	addRunInterceptor(fn, { order = 0 } = {}) {
		this.runInterceptors.push({ order, fn });
		return this;
	}

	addRunCondition(fn) {
		return this.addRunInterceptor(async (next, context, ...rest) => {
			const run = await fn(context, ...rest);
			return await next(run ? context : { ...context, active: false });
		}, { order: Number.NEGATIVE_INFINITY });
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
		const baseNode = new Node(null, { display: false }, { parallel: true }, exts.get(NODE_INIT));

		let curNode = baseNode;
		const addChildNode = (config, options) => {
			if (!curNode) {
				throw new Error('Cannot create new tests after discovery phase');
			}
			new Node(curNode, config, options, exts.get(NODE_INIT));
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
		this.runInterceptors.sort((a, b) => (a.order - b.order));

		return new Runner(
			baseNode,
			Object.freeze(baseContext),
			Object.freeze(this.runInterceptors.map((i) => i.fn)),
		);
	}
}
