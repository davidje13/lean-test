import TestAssumptionError from './TestAssumptionError.mjs';
import Result from './Result.mjs';

const HIDDEN = Symbol();

async function finalInterceptor(_, context, result, node) {
	if (node.config.run) {
		if (context.active) {
			await result.exec('test', () => node.config.run(node));
		} else {
			result.recordError('interceptors', new TestAssumptionError('skipped'));
		}
		result.invoked = true;
	} else if (node.options.parallel) {
		await Promise.all(node.children.map((child) => child._run(result, context)));
	} else {
		for (const child of node.children) {
			await child._run(result, context);
		}
	}
}

function updateArgs(oldArgs, newArgs) {
	if (!newArgs?.length) {
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
	const runStep = async (index, args) => await chain[index](
		(...newArgs) => runStep(index + 1, updateArgs(args, newArgs)),
		...args
	);
	return runStep(0, args);
}

export default class Node {
	constructor(parent, config, options, scopes) {
		this.config = Object.freeze(config);
		this.options = Object.freeze(options);
		this.scopes = Object.freeze(new Map(scopes.map(({ scope, value }) => [scope, value()])));
		this.parent = parent;
		this.children = [];
		parent?.children?.push(this);
		this.discoveryResult = null;
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

	async runDiscovery(methods, beginHook) {
		if (this.config.discovery) {
			beginHook(this);
			const discoveryResult = new Result('discovery', null, false, null);
			await discoveryResult.exec('discovery', () => this.config.discovery(this, { ...methods }));
			discoveryResult.finish();
			this.discoveryResult = discoveryResult;
		}
		for (const child of this.children) {
			await child.runDiscovery(methods, beginHook);
		}
		this.scopes.forEach(Object.freeze);
		Object.freeze(this.children);
		Object.freeze(this);
	}

	async _run(parentResult, context) {
		const label = this.config.display ? `${this.config.display}: ${this.options.name}` : null;
		const result = new Result(label, parentResult, Boolean(this.config.run), this.discoveryResult);
		await runChain(context[HIDDEN].interceptors, [context, result, this]);
		result.finish();
		return result;
	}

	run(interceptors, context) {
		return this._run(null, {
			...context,
			[HIDDEN]: { interceptors: [...interceptors, finalInterceptor] },
		});
	}
}
