export class TimeoutError extends Error {
	constructor(duration: number) {
		super(`timeout after ${(duration * 0.001).toFixed(3)}s`);
		this.stack = '';
	}
}
