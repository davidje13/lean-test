import process from 'process';
import { networkInterfaces } from 'os';
import HttpServerRunner from './HttpServerRunner.mjs';
import WebdriverSession from './WebdriverSession.mjs';

export default class WebdriverRunner extends HttpServerRunner {
	constructor(config, paths, browser, webdriverHost, desiredCapabilities) {
		super(config, paths);
		this.browser = browser;
		this.webdriverHost = webdriverHost;
		this.desiredCapabilities = desiredCapabilities;
		this.session = null;
		this.finalURL = null;
		this.finalTitle = null;
	}

	async prepare(sharedState) {
		await super.prepare(sharedState);

		this.session = await WebdriverSession.create(
			this.webdriverHost,
			this.browser,
			this.desiredCapabilities,
		);
	}

	async teardown(sharedState) {
		const session = this.session;
		this.session = null;
		try {
			if (session !== null) {
				this.finalURL = await session.getUrl();
				this.finalTitle = await session.getTitle();
				await session.close();
			}
		} finally {
			await super.teardown(sharedState);
		}
	}

	async invoke(listener, sharedState) {
		const server = sharedState[HttpServerRunner.SERVER];
		const postListener = sharedState[HttpServerRunner.POST_LISTENER];

		const browserID = await makeConnection(this.session, server, postListener);
		this.setBrowserID(browserID);
		return super.invoke(listener, sharedState);
	}

	async getDisconnectDebugInfo() {
		if (!this.session) {
			return this.debug();
		}
		try {
			const url = await session.getUrl();
			const title = await session.getTitle();
			return `URL='${url}' Title='${title}'`;
		} catch (e) {
			const cause = typeof e === 'object' ? (e.json?.value?.message ?? e.message ?? e) : e;
			return `Failed to communicate with browser session: ${cause}`;
		}
	}

	debug() {
		if (this.finalURL === null) {
			return 'failed to create session';
		}
		return `URL='${this.finalURL}' Title='${this.finalTitle}'`;
	}
}

async function makeConnection(session, server, postListener) {
	// try various URLs until something works, because we don't know what environment we're in
	const urls = [...new Set([
		server.baseurl(process.env.WEBDRIVER_TESTRUNNER_HOST),
		server.baseurl(),
		server.baseurl('host.docker.internal'), // See https://stackoverflow.com/a/43541732/1180785
		...Object.values(networkInterfaces())
			.flatMap((i) => i)
			.filter((i) => !i.internal)
			.map((i) => server.baseurl(i)),
	])];

	let lastError = null;
	for (const url of urls) {
		const browserID = postListener.getUniqueID();
		try {
			await session.setUrl(url + '#' + browserID);
			// Firefox via webdriver lies about the connection, returning success
			// even if it fails, so we have to check that it actually did connect.
			// Unfortunately there's no synchronous way of doing this (Firefox
			// returns from POST url before it has reached DOMContentLoaded), so
			// we need to poll.
			const tm0 = Date.now();
			do {
				if (postListener.hasQueuedEvents(browserID)) {
					return browserID;
				}
				await new Promise((resolve) => setTimeout(resolve, 50));
			} while (Date.now() < tm0 + 1000);
		} catch (e) {
			lastError = e;
		}
	}
	if (!lastError) {
		throw new Error(`unable to access test server\n(tried ${urls.join(', ')})`)
	}
	throw new Error(`error accessing test server ${lastError}\n(tried ${urls.join(', ')})`);
}
