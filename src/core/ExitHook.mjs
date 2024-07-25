const HAS_PROCESS = (typeof process !== 'undefined');

let hasRun = null;
const exitHooks = [];
async function runExitHooks() {
	if (hasRun !== null) {
		if (Date.now() > hasRun + 1000) {
			// user got impatient and fired signal again; do as they say
			process.stderr.write(`\nWarning: teardown did not complete\n`);
			process.exit(1);
		}
		return;
	}
	hasRun = Date.now();

	const hooks = exitHooks.slice().reverse();

	// mimick default SIGINT/SIGTERM behaviour
	if (process.stderr.isTTY) {
		process.stderr.write('\u001B[0m');
	}

	const info = setTimeout(() => process.stderr.write(`\nTeardown in progress; please wait (warning: forcing exit could result in left-over processes)\n`), 200);

	// run hooks
	for (const hook of hooks) {
		await hook();
	}
	clearTimeout(info);

	// wait for streams to flush to avoid losing output unnecessarily
	Promise.all([
		new Promise((resolve) => process.stdout.write('', resolve)),
		new Promise((resolve) => process.stderr.write('', resolve)),
	]).then(() => process.exit(1));
}

function checkExit() {
	if (hasRun !== null) {
		return;
	}

	const hooks = exitHooks.slice().reverse();
	if (process.stderr.isTTY) {
		process.stderr.write('\u001B[0m');
	}

	// run all hooks "fire-and-forget" style for best-effort teardown
	for (const hook of hooks) {
		hook();
	}

	process.stderr.write('\nWarning: exit teardown was possibly incomplete\n');
}

export default class ExitHook {
	constructor(hook) {
		this.registered = false;
		this.hook = async () => {
			try {
				await hook();
			} catch (e) {
				if (HAS_PROCESS) {
					process.stderr.write(`\nWarning: error during teardown ${e}\n`);
				} else {
					console.warn('Error during teardown', e);
				}
			}
		};
	}

	add() {
		if (this.registered) {
			throw new Error('Exit hook already registered');
		}
		this.registered = true;
		exitHooks.push(this.hook);
		if (exitHooks.length === 1 && HAS_PROCESS) {
			process.addListener('SIGTERM', runExitHooks);
			process.addListener('SIGINT', runExitHooks);
			process.addListener('exit', checkExit);
		}
	}

	remove() {
		const p = exitHooks.indexOf(this.hook);
		if (p === -1) {
			throw new Error('Exit hook not registered');
		}
		this.registered = false;
		exitHooks.splice(p, 1);
		if (exitHooks.length === 0) {
			exitHooks.length = 0;
			if (HAS_PROCESS) {
				process.removeListener('SIGTERM', runExitHooks);
				process.removeListener('SIGINT', runExitHooks);
				process.removeListener('exit', checkExit);
			}
		}
	}

	async ifExitDuring(fn) {
		try {
			this.add();
			return await fn();
		} finally {
			this.remove();
		}
	}

	async ifExitDuringOrFinally(fn) {
		try {
			this.add();
			return await fn();
		} finally {
			this.remove();
			await this.hook();
		}
	}
}
