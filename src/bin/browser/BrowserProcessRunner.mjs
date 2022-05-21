import HttpServerRunner from './HttpServerRunner.mjs';
import { addDataListener } from '../utils.mjs';

export default class BrowserProcessRunner extends HttpServerRunner {
	constructor(config, paths, browserLauncher) {
		super(config, paths);
		this.browserLauncher = browserLauncher;
		this.launched = null;
	}

	async teardown(sharedState) {
		try {
			if (this.launched) {
				this.launched.proc.kill();
				await this.launched.teardown?.();
				this.launched = null;
			}
		} finally {
			await super.teardown(sharedState);
		}
	}

	registerEventListener(listener, sharedState) {
		this.launched.proc.once('error', (error) => listener({ type: 'runner-internal-error', error }));
		super.registerEventListener(listener, sharedState);
	}

	async invoke(listener, sharedState) {
		const { browserID, url } = this.makeUniqueTarget(sharedState);
		this.launched = await this.browserLauncher(url, { stdio: ['ignore', 'pipe', 'pipe'] });
		this.stdout = addDataListener(this.launched.proc.stdout);
		this.stderr = addDataListener(this.launched.proc.stderr);
		this.setBrowserID(browserID);
		return super.invoke(listener, sharedState);
	}

	debug() {
		return `stdout:\n${this.stdout().toString('utf-8')}\nstderr:\n${this.stderr().toString('utf-8')}`;
	}
}
