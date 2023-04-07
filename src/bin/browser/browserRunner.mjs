import { env } from 'process';
import BrowserProcessRunner from './BrowserProcessRunner.mjs';
import HttpServerRunner from './HttpServerRunner.mjs';
import WebdriverRunner from './WebdriverRunner.mjs';

export const manualBrowserRunner = (config, paths) => new HttpServerRunner(config, paths);

export const autoBrowserRunner = (browser, launcher) => (config, paths) => {
	const webdriverEnv = browser.toUpperCase().replace(/[^A-Z]+/g, '_');
	const webdriverHost = env[`WEBDRIVER_HOST_${webdriverEnv}`] || env.WEBDRIVER_HOST || null;
	if (webdriverHost) {
		const desiredCapabilities = {};
		if (env.WEBDRIVER_DISABLE_SHM === 'true') {
			desiredCapabilities['goog:chromeOptions'] = {
				args: ['--disable-dev-shm-usage'],
			};
		}
		return new WebdriverRunner(config, paths, browser, webdriverHost, desiredCapabilities);
	} else {
		return new BrowserProcessRunner(config, paths, launcher);
	}
};
