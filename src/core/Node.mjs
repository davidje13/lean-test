import TestAssertionError from './TestAssertionError.mjs';
import TestAssumptionError from './TestAssumptionError.mjs';

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

export default class Node {
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
