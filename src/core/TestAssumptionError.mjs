export default class TestAssumptionError extends Error {
	constructor(message, trimFrames = 0) {
		super(message);
		this.trimFrames = trimFrames;
	}
}
