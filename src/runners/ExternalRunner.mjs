import AbstractRunner from './AbstractRunner.mjs';
import ActiveTestTracker from './ActiveTestTracker.mjs';

export default class ExternalRunner extends AbstractRunner {
	constructor({
		initialConnectTimeout,
		pingTimeout,
	}) {
		super();
		this.initialConnectTimeout = initialConnectTimeout;
		this.pingTimeout = pingTimeout;
	}

	async launch(sharedState) {
	}

	registerEventListener(listener, sharedState) {
		throw new Error('registerEventListener not overridden');
	}

	debug() {
		return 'unknown';
	}

	async invoke(listener, sharedState) {
		const tracker = new ActiveTestTracker();

		await this.launch(sharedState);
		try {
			return await new Promise((resolve, reject) => {
				let connectedUntil = Date.now() + this.initialConnectTimeout;
				let connected = false;
				const checkPing = setInterval(() => {
					if (Date.now() > connectedUntil) {
						clearInterval(checkPing);
						if (!connected) {
							reject(new RunnerError('launch timed out'));
						} else {
							reject(new DisconnectError('unknown runner disconnect'));
						}
					}
				}, 250);
				const decompress = ExternalRunner.decompressor();
				this.registerEventListener((event) => {
					connectedUntil = Date.now() + this.pingTimeout;
					event = decompress(event);
					switch (event.type) {
						case 'runner-ping':
							break;
						case 'runner-connect':
							if (connected) {
								clearInterval(checkPing);
								reject(new DisconnectError('multiple external connections (maybe page reloaded?)'));
							}
							connected = true;
							break;
						case 'runner-end':
							clearInterval(checkPing);
							resolve(event.result);
							break;
						case 'runner-error':
							clearInterval(checkPing);
							reject(new DisconnectError(event.message ?? 'runner error'));
							break;
						case 'runner-internal-error':
							clearInterval(checkPing);
							reject(event.error instanceof Error ? event.error : new RunnerError(event.error));
							break;
						case 'runner-unsupported':
							clearInterval(checkPing);
							reject(new UnsupportedError(event.message));
							break;
						case 'runner-disconnect':
							clearInterval(checkPing);
							reject(new DisconnectError(event.message ?? 'runner disconnected'));
							break;
						default:
							tracker.eventListener(event);
							listener(event);
					}
				}, sharedState);
			});
		} catch(e) {
			if (e instanceof UnsupportedError) {
				throw e;
			}
			if (e instanceof DisconnectError) {
				throw new Error(`Runner disconnected: ${e.message}\nActive tests:\n${tracker.get().map((p) => '- ' + p.join(' -> ')).join('\n') || 'none'}`);
			}
			let debugInfo = '';
			try {
				debugInfo = this.debug();
			} catch (ignore) {
			}
			throw new RunnerError(`Test runner ${(e instanceof RunnerError) ? e.message : e}\n${debugInfo}`);
		}
	}
}

ExternalRunner.decompressor = () => {
	const results = new Map();
	const decompress = (result) => {
		if (result.type === 'runner-end') {
			return {
				...result,
				result: decompress(result.result),
			};
		}
		if (result?.children?.length) {
			result = {
				...result,
				children: result.children.map((c) => {
					if (typeof c === 'object') {
						return c;
					}
					return results.get(c);
				}),
			};
		}
		if (result.type === 'complete') {
			results.set(result.id, result);
		}
		return result;
	};
	return decompress;
};

ExternalRunner.compressor = () => {
	const sent = new Set();
	const compress = (result) => {
		if (result.type === 'runner-end') {
			return {
				...result,
				result: compress(result.result),
			};
		}
		if (result.type === 'complete') {
			sent.add(result.id);
		}
		if (!result?.children?.length) {
			return result;
		}
		return {
			...result,
			children: result.children.map((c) => {
				if (sent.has(c.id)) {
					return c.id;
				}
				return c;
			}),
		};
	};
	return compress;
};

class UnsupportedError extends Error {
	constructor(message) {
		super(message);
		this.skipFrames = Number.POSITIVE_INFINITY;
	}
}

class DisconnectError extends Error {
	constructor(message) {
		super(message);
	}
}

class RunnerError extends Error {
	constructor(message) {
		super(message);
	}
}
