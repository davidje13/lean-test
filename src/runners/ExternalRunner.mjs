import AbstractRunner from './AbstractRunner.mjs';
import ActiveTestTracker from './ActiveTestTracker.mjs';

const INITIAL_CONNECT_TIMEOUT = 30000;
const PING_TIMEOUT = 2000;

export default class ExternalRunner extends AbstractRunner {
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
				let connectedUntil = Date.now() + INITIAL_CONNECT_TIMEOUT;
				let connected = false;
				const checkPing = setInterval(() => {
					if (Date.now() > connectedUntil) {
						clearInterval(checkPing);
						if (!connected) {
							reject(new Error('runner launch timed out'));
						} else {
							reject(new DisconnectError('unknown runner disconnect'));
						}
					}
				}, 250);
				this.registerEventListener((event) => {
					connectedUntil = Date.now() + PING_TIMEOUT;
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
							reject(new DisconnectError(`runner error: ${event.error}`));
							break;
						case 'runner-unsupported':
							clearInterval(checkPing);
							reject(new UnsupportedError(event.error));
							break;
						case 'runner-disconnect':
							clearInterval(checkPing);
							reject(new DisconnectError(`runner closed (did a test change window.location?)`));
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
			throw new Error(`Error in runner: ${e}\n${debugInfo}`);
		}
	}
}

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
