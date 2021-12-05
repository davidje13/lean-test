import process from 'process';

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

	const hooks = exitHooks.slice();

	// mimick default SIGINT/SIGTERM behaviour
	if (process.stderr.isTTY) {
		process.stderr.write('\u001B[0m');
	}

	var info = setTimeout(() => process.stderr.write(`\nTeardown in progress; please wait (warning: forcing exit could result in left-over processes)\n`), 200);

	// run hooks
	for (const hook of hooks) {
		try {
			await hook();
		} catch (e) {
			process.stderr.write(`\nWarning: error during teardown ${e}\n`);
		}
	}
	clearTimeout(info);
	process.exit(1);
}

function checkExit() {
	if (hasRun !== null) {
		return;
	}

	const hooks = exitHooks.slice();
	if (process.stderr.isTTY) {
		process.stderr.write('\u001B[0m');
	}

	// run all hooks "fire-and-forget" style for best-effort teardown
	for (const hook of hooks) {
		try {
			hook();
		} catch (e) {
			process.stderr.write(`\nWarning: error during teardown ${e}\n`);
		}
	}

	process.stderr.write('\nWarning: exit teardown was possibly incomplete\n');
}

export function addExitHook(fn) {
	exitHooks.unshift(fn);
	if (exitHooks.length === 1) {
		process.addListener('SIGTERM', runExitHooks);
		process.addListener('SIGINT', runExitHooks);
		process.addListener('exit', checkExit);
	}
}

function clearListeners() {
	exitHooks.length = 0;
	process.removeListener('SIGTERM', runExitHooks);
	process.removeListener('SIGINT', runExitHooks);
	process.removeListener('exit', checkExit);
}

export function removeExitHook(fn) {
	const p = exitHooks.indexOf(fn);
	if (p !== -1) {
		exitHooks.splice(p, 1);
		if (exitHooks.length === 0) {
			clearListeners();
		}
	}
}

export async function ifKilled(fn, fin) {
	try {
		addExitHook(fin);
		return await fn();
	} finally {
		removeExitHook(fin);
	}
}

export async function alwaysFinally(fn, fin) {
	try {
		addExitHook(fin);
		return await fn();
	} finally {
		removeExitHook(fin);
		try {
			await fin();
		} catch (e) {
			process.stderr.write(`\nWarning: error during teardown ${e}\n`);
		}
	}
}
