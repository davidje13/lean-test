import TestAssertionError from './TestAssertionError.mjs';
import TestAssumptionError from './TestAssumptionError.mjs';
import CapturedError from './CapturedError.mjs';

export default class ResultStage {
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
			this.errors.push(new CapturedError(error));
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

ResultStage.of = async (label, fn, { errorStackSkipFrames = 0 } = {}) => {
	const stage = new ResultStage(label);
	try {
		await fn(stage);
	} catch (error) {
		const base = CapturedError.makeBase(errorStackSkipFrames);
		if (stage.endTime === null) {
			if (error instanceof TestAssertionError) {
				stage.failures.push(new CapturedError(error, base));
			} else if (error instanceof TestAssumptionError) {
				stage.skipReasons.push(new CapturedError(error, base));
			} else {
				stage.errors.push(new CapturedError(error, base));
			}
		}
	} finally {
		stage._complete();
	}
	return stage;
};
