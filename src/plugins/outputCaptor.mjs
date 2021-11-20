import StackScope from '../core/StackScope.mjs';

const IS_BROWSER = (typeof process === 'undefined');
const OUTPUT_CAPTOR_SCOPE = new StackScope('OUTPUT_CAPTOR');

function interceptWrite(original, type, chunk, encoding, callback) {
	const target = OUTPUT_CAPTOR_SCOPE.get();
	if (!target) {
		// We do not seem to be within a scope; could be unrelated code,
		// or could be that the stack got too deep to know.
		// Call original function as fallback
		return original.call(this, chunk, encoding, callback);
	}
	if (typeof encoding === 'function') {
		callback = encoding;
		encoding = null;
	}
	if (typeof chunk === 'string') {
		chunk = Buffer.from(chunk, encoding ?? 'utf8');
	}
	target.push({ type, chunk });
	callback?.();
	return true;
}

function interceptConsole(original, type, ...args) {
	const target = OUTPUT_CAPTOR_SCOPE.get();
	if (!target) {
		return original.call(this, ...args);
	}
	target.push({ type, args });
	return true;
}

let interceptCount = 0;
const teardowns = [];
function overrideMethod(object, method, replacement, ...bindArgs) {
	const original = object[method];
	teardowns.push(() => {
		object[method] = original;
	});
	object[method] = replacement.bind(object, original, ...bindArgs);
}

async function addIntercept() {
	if ((interceptCount++) > 0) {
		return;
	}

	if (IS_BROWSER) {
		['log', 'trace', 'debug', 'info', 'warn', 'error'].forEach((name) => {
			overrideMethod(console, name, interceptConsole, name);
		});
	} else {
		overrideMethod(process.stdout, 'write', interceptWrite, 'stdout');
		overrideMethod(process.stderr, 'write', interceptWrite, 'stderr');
	}
}

async function removeIntercept() {
	if ((--interceptCount) > 0) {
		return;
	}
	teardowns.forEach((fn) => fn());
	teardowns.length = 0;
}

function getOutput(type, binary) {
	const target = OUTPUT_CAPTOR_SCOPE.get();
	if (!target) {
		const err = new Error(`Unable to resolve ${type} scope`);
		err.skipFrames = 2;
		throw err;
	}
	const all = Buffer.concat(
		target
			.filter((i) => (i.type === type))
			.map((i) => i.chunk)
	);
	return binary ? all : all.toString('utf8');
}

export default ({ order = -1 } = {}) => (builder) => {
	builder.addMethods({
		getStdout(binary = false) {
			return getOutput('stdout', binary);
		},
		getStderr(binary = false) {
			return getOutput('stderr', binary);
		},
	});
	builder.addRunInterceptor(async (next, _, result) => {
		const target = [];
		try {
			addIntercept();
			await OUTPUT_CAPTOR_SCOPE.run(target, next);
		} finally {
			removeIntercept();
			if (target.length) {
				if (IS_BROWSER) {
					// This is not perfectly representative of what would be logged, but should be generally good enough for testing
					result.addOutput(target.map((i) => i.args.map((a) => String(a)).join(' ') + '\n').join(''));
				} else {
					result.addOutput(Buffer.concat(target.map((i) => i.chunk)).toString('utf8'));
				}
			}
		}
	}, { order });
};
