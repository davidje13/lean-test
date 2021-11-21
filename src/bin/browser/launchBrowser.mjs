import findExecutable from '../filesystem/findExecutable.mjs';
import { stderr, env } from 'process';
import { spawn } from 'child_process';

const CHROME_ARGS = [
	// flag list from chrome-launcher: https://github.com/GoogleChrome/chrome-launcher/blob/master/src/flags.ts
	'--disable-features=Translate',
	'--disable-extensions',
	'--disable-component-extensions-with-background-pages',
	'--disable-background-networking',
	'--disable-component-update',
	'--disable-client-side-phishing-detection',
	'--disable-sync',
	'--metrics-recording-only',
	'--disable-default-apps',
	'--mute-audio',
	'--no-default-browser-check',
	'--no-first-run',
	'--disable-backgrounding-occluded-windows',
	'--disable-renderer-backgrounding',
	'--disable-background-timer-throttling',
	'--disable-ipc-flooding-protection',
	'--password-store=basic',
	'--use-mock-keychain',
	'--force-fieldtrials=*BackgroundTracing/default/',
];

export default async function launchBrowser(name, url) {
	switch (name) {
		case 'manual':
			stderr.write(`Ready to run test: ${url}\n`);
			return null;
		case 'chrome':
			return spawn(await getChromePath(), [
				...CHROME_ARGS,
				'--headless',
				'--remote-debugging-port=0', // required to avoid immediate termination, but not actually used
				url,
			], { stdio: 'ignore' });
		case 'firefox':
			return spawn(await getFirefoxPath(), [
				'--no-remote',
				'--new-instance',
				'--headless',
				url,
			], { stdio: 'ignore', env: { MOZ_DISABLE_AUTO_SAFE_MODE: 'true' } });
		default:
			stderr.write(`Unknown browser: ${name}\n`);
			stderr.write(`Open this URL to run tests: ${url}\n`);
			return null;
	}
}

function getChromePath() {
	return findExecutable([
		{ path: env.CHROME_PATH },
		{ ifPlatform: 'darwin', path: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' },
		{ path: 'google-chrome-stable' },
		{ path: 'google-chrome' },
		{ path: 'chromium-browser' },
		{ path: 'chromium' },
	]);
}

function getFirefoxPath() {
	return findExecutable([
		{ path: env.FIREFOX_PATH },
		{ ifPlatform: 'darwin', path: '/Applications/Firefox.app/Contents/MacOS/firefox' },
		{ path: 'firefox' },
		{ path: 'iceweasel' },
	]);
}
