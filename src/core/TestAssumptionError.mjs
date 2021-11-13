export default class TestAssumptionError extends Error {
	constructor(message, skipFrames = 0) {
		super(message);
		this.skipFrames = skipFrames;
	}
}
