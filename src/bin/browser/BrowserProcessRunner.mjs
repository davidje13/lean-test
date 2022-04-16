import HttpServerRunner from './HttpServerRunner.mjs';
import { addDataListener } from '../utils.mjs';

export default class BrowserProcessRunner extends HttpServerRunner {
	constructor(config, paths, browserLauncher) {
		super(config, paths);
		this.browserLauncher = browserLauncher;
		this.stdout = () => '';
		this.stderr = () => '';
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

	async invoke(listener, sharedState) {
		const { browserID, url } = this.makeUniqueTarget(sharedState);
		this.launched = await this.browserLauncher(url, { stdio: ['ignore', 'pipe', 'pipe'] });
		this.stdout = addDataListener(this.launched.proc.stdout);
		this.stderr = addDataListener(this.launched.proc.stderr);
		return Promise.race([
			new Promise((_, reject) => this.launched.proc.once('error', (err) => reject(err))),
			super.invokeWithBrowserID(listener, sharedState, browserID),
		]);
	}

	debug() {
		return `stderr:\n${this.stdout().toString('utf-8')}\nstdout:\n${this.stderr().toString('utf-8')}`;
	}
}
