export default class TestAssertionError extends Error {
	constructor(message, skipFrames = 0) {
		super(message);
		this.skipFrames = skipFrames;
	}
}
