export class TestError extends Error {
	constructor(message: string, constructorOpt?: Function) {
		super(message);
		if (constructorOpt && 'captureStackTrace' in Error) {
			Error.captureStackTrace(this, constructorOpt);
		}
	}
}
