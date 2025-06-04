export class VerifiedPromise<T> implements Promise<T> {
	private _tm: ReturnType<typeof setTimeout>;
	private readonly _promise: Promise<T>;

	constructor(promise: Promise<T>, skip?: Function) {
		this._promise = promise;

		// create error early to ensure correct / useful stack trace
		const error = new Error('async operation was not awaited');

		// make the stack trace a little nicer if the API is available
		if (skip && 'captureStackTrace' in Error) {
			(Error.captureStackTrace as any)(error, skip);
		}

		// wait a frame then throw our error if we haven't been awaited
		this._tm = setTimeout(() => {
			throw error;
		}, 0);
	}

	then<TResult1 = T, TResult2 = never>(
		onfulfilled?:
			| ((value: T) => TResult1 | PromiseLike<TResult1>)
			| null
			| undefined,
		onrejected?:
			| ((reason: any) => TResult2 | PromiseLike<TResult2>)
			| null
			| undefined,
	): Promise<TResult1 | TResult2> {
		clearTimeout(this._tm);
		return this._promise.then(onfulfilled, onrejected);
	}

	catch<TResult = never>(
		onrejected?:
			| ((reason: any) => TResult | PromiseLike<TResult>)
			| null
			| undefined,
	): Promise<T | TResult> {
		clearTimeout(this._tm);
		return this._promise.catch(onrejected);
	}

	finally(onfinally?: (() => void) | null | undefined): Promise<T> {
		return this._promise.finally(onfinally);
	}

	get [Symbol.toStringTag]() {
		return this._promise[Symbol.toStringTag];
	}
}
