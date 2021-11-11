import TestAssertionError from './TestAssertionError.mjs';
import TestAssumptionError from './TestAssumptionError.mjs';

export default class ResultStage {
	constructor(label) {
		this.label = label;
		this.startTime = 0;
		this.duration = 0;
		this.failures = [];
		this.errors = [];
		this.skipReasons = [];
		this.complete = false;
	}

	getSummary() {
		const duration = (this.complete ? this.duration : (Date.now() - this.startTime));

		if (!this.complete) {
			return { count: 1, run: 1, duration };
		}
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

ResultStage.of = async (label, fn, fnArg) => {
	const stage = new ResultStage(label);
	stage.startTime = Date.now();
	try {
		await fn(fnArg);
	} catch (error) {
		if (error instanceof TestAssertionError) {
			stage.failures.push(error);
		} else if (error instanceof TestAssumptionError) {
			stage.skipReasons.push(error);
		} else {
			stage.errors.push(error);
		}
	} finally {
		stage.duration = Date.now() - stage.startTime;
		stage.complete = true;
		Object.freeze(stage);
	}
	return stage;
};
