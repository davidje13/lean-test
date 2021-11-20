import ResultStage from './ResultStage.mjs';
import Result from './Result.mjs';

export const RUN_INTERCEPTORS = Symbol();
export const LISTENER = Symbol();

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
	}
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

	async run(context, parentResult = null) {
		const label = this.config.display ? `${this.config.display}: ${this.options.name}` : null;
		const listener = context[LISTENER];
		const result = await Result.of(
			label,
			(result) => {
				listener?.({
					type: 'begin',
					time: Date.now(),
					isBlock: Boolean(this.config.isBlock),
					...result.info,
				});
				if (this.discoveryStage) {
					result.attachStage({ fail: true, time: true }, this.discoveryStage);
				}
				return runChain(context[RUN_INTERCEPTORS], [context, result, this]);
			},
			{ parent: parentResult },
		);
		listener?.({
			type: 'complete',
			time: Date.now(),
			isBlock: Boolean(this.config.isBlock),
			...result,
		});
		return result;
	}
}
