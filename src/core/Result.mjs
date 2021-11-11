import TestAssertionError from './TestAssertionError.mjs';
import TestAssumptionError from './TestAssumptionError.mjs';

export default class Result {
	constructor(label, parent, isTest, previous) {
		this.label = label;
		this.isTest = isTest;
		this.parent = parent;
		this.previous = previous;
		this.children = [];
		parent?.children?.push(this);

		this.startTime = Date.now();
		this.invoked = false;
		this.durations = new Map();
		this.totalRunDuration = 0;
		this.complete = false;
		this.failures = [];
		this.errors = [];
		this.skipReasons = [];
	}

	async exec(namespace, fn) {
		const beginTime = Date.now();
		try {
			await fn();
			return true;
		} catch (error) {
			this.recordError(namespace, error);
			return false;
		} finally {
			this.accumulateDuration(namespace, Date.now() - beginTime);
		}
	}

	finish() {
		this.totalRunDuration = Date.now() - this.startTime;
		this.complete = true;
		Object.freeze(this);
	}

	createChild(label, { asDelegate = false } = {}) {
		if (asDelegate) {
			// TODO: make asDelegate not be hacky
			const child = new Result(label, this, this.isTest, this.previous);
			this.getSummary = () => child.getSummary();
			return child;
		}
		return new Result(label, this, this.isTest, null);
	}

	recordError(namespace, error) {
		if (error instanceof TestAssertionError) {
			this.failures.push(`Failure in ${namespace}:\n${error.message}`);
		} else if (error instanceof TestAssumptionError) {
			this.skipReasons.push(`Assumption not met in ${namespace}:\n${error.message}`);
		} else {
			this.errors.push(error);
		}
	}

	accumulateDuration(namespace, millis) {
		this.durations.set(namespace, (this.durations.get(namespace) || 0) + millis);
	}

	getOwnDuration() {
		return (this.complete ? this.totalRunDuration : (Date.now() - this.startTime));
	}

	hasFailed() {
		const summary = this.getSummary();
		return Boolean(summary.error || summary.fail);
	}

	getDuration() {
		const duration = this.getOwnDuration();
		if (this.previous) {
			return duration + this.previous.getOwnDuration();
		} else {
			return duration;
		}
	}

	getSummary() {
		let summary = makeSelfSummary(this);
		if (this.previous) {
			summary = combineSummary(summary, makeSelfSummary(this.previous));
		}
		return this.children
			.map((child) => child.getSummary())
			.reduce(combineSummary, summary);
	}
}

function combineSummary(a, b) {
	const r = { ...a };
	Object.keys(b).forEach((k) => {
		r[k] = (r[k] || 0) + b[k];
	});
	return r;
}

function makeSelfSummary(result) {
	if (!result.isTest) {
		if (result.errors.length) {
			return { error: 1 };
		}
		if (result.failures.length) {
			return { fail: 1 };
		}
		return {};
	}

	if (!result.complete) {
		return { count: 1, run: 1 };
	}
	if (result.errors.length) {
		return { count: 1, error: 1 };
	}
	if (result.failures.length) {
		return { count: 1, fail: 1 };
	}
	if (result.skipReasons.length || !result.invoked) {
		return { count: 1, skip: 1 };
	}
	return { count: 1, pass: 1 };
}
