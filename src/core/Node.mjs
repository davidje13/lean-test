import TestAssumptionError from './TestAssumptionError.mjs';
import Result from './Result.mjs';

const HIDDEN = Symbol();

async function finalInterceptor(_, context, node) {
	if (node.config.run) {
		if (context.active) {
			await node.result.exec('test', () => node.config.run(node));
		} else {
			node.result.recordError('interceptors', new TestAssumptionError('skipped'));
		}
		node.result.invoked = true;
	} else if (node.options.parallel) {
		await Promise.all(node.children.map((child) => child._run(context)));
	} else {
		for (const child of node.children) {
			await child._run(context);
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

export default class Node {
	constructor(config, options, scopes) {
		this.config = Object.freeze(config);
		this.options = Object.freeze(options);
		this.scopes = Object.freeze(new Map(scopes.map(({ scope, value }) => [scope, value()])));
		this.parent = null;
		this.children = [];

		this.result = new Result(this, Boolean(this.config.run));
	}

	addChild(node) {
		node.parent = this;
		this.children.push(node);
		node.result.parent = this.result;
		this.result.children.push(node.result);
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
			await this.result.exec('discovery', () => this.config.discovery(this, { ...methods }));
		}
		for (const child of this.children) {
			await child.runDiscovery(methods, beginHook);
		}
		this.scopes.forEach(Object.freeze);
		Object.freeze(this.children);
		Object.freeze(this);
	}

	async _run(context) {
		this.result.start();
		await runChain(context[HIDDEN].interceptors, [context, this]);
		this.result.finish();
	}

	async run(interceptors, context) {
		await this._run({
			...context,
			[HIDDEN]: { interceptors: [...interceptors, finalInterceptor] },
		});
		return this.result;
	}
}
