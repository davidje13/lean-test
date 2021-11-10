import TestAssertionError from './TestAssertionError.mjs';
import TestAssumptionError from './TestAssumptionError.mjs';

export default class Result {
	constructor(isTest) {
		this.isTest = isTest;
		this.started = false;
		this.startTime = null;
		this.invoked = false;
		this.durations = new Map();
		this.totalRunDuration = 0;
		this.complete = false;
		this.failures = [];
		this.errors = [];
		this.skipReasons = [];
	}

	start() {
		this.started = true;
		this.startTime = Date.now();
	}

	finish() {
		this.totalRunDuration = Date.now() - this.startTime;
		this.complete = true;
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

	getDuration() {
		if (!this.started) {
			return null;
		}
		return (
			(this.complete ? this.totalRunDuration : (Date.now() - this.startTime)) +
			(this.durations.get('discovery') || 0)
		);
	}

	hasFailed() {
		return this.errors.length > 0 || this.failures.length > 0;
	}

	getSummary() {
		if (!this.isTest) {
			if (this.errors.length) {
				return { error: 1 };
			}
			if (this.failures.length) {
				return { fail: 1 };
			}
			return {};
		}

		if (!this.started) {
			return { count: 1, pend: 1 };
		}
		if (!this.complete) {
			return { count: 1, run: 1 };
		}
		if (this.errors.length) {
			return { count: 1, error: 1 };
		}
		if (this.failures.length) {
			return { count: 1, fail: 1 };
		}
		if (this.skipReasons.length || !this.invoked) {
			return { count: 1, skip: 1 };
		}
		return { count: 1, pass: 1 };
	}
}
