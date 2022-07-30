import StackScope from '../core/StackScope.mjs';
import { print } from '../utils.mjs';

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
		chunk = Buffer.from(chunk, encoding ?? 'utf-8');
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

function getCapturedOutput() {
	const target = OUTPUT_CAPTOR_SCOPE.get();
	if (!target) {
		const err = new Error(`Unable to resolve ${type} scope`);
		err.skipFrames = 2;
		throw err;
	}
	return target;
}

function combineOutput(parts, binary) {
	if (IS_BROWSER) {
		if (binary) {
			throw new Error('Browser environment cannot get output in binary format');
		}
		// This is not perfectly representative of what would be logged, but should be generally good enough for testing
		return parts
			.map((i) => i.args.map((v) => (typeof v === 'string' ? v : print(v))).join(' ') + '\n')
			.join('')
	} else {
		const all = Buffer.concat(parts.map((i) => i.chunk));
		return binary ? all : all.toString('utf-8');
	}
}

export default ({ order = -1 } = {}) => (builder) => {
	builder.addGlobals({
		getStdout(binary = false) {
			if (IS_BROWSER) {
				throw new Error('Browser environment has no stdout - use getOutput() instead');
			}
			return combineOutput(getCapturedOutput().filter((i) => (i.type === 'stdout')), binary);
		},
		getStderr(binary = false) {
			if (IS_BROWSER) {
				throw new Error('Browser environment has no stderr - use getOutput() instead');
			}
			return combineOutput(getCapturedOutput().filter((i) => (i.type === 'stderr')), binary);
		},
		getOutput(binary = false) {
			return combineOutput(getCapturedOutput(), binary);
		}
	});

	builder.addRunInterceptor(async (next, _, result) => {
		const target = [];
		try {
			addIntercept();
			await OUTPUT_CAPTOR_SCOPE.run(target, next);
		} finally {
			removeIntercept();
			if (target.length) {
				result.addOutput(combineOutput(target, false));
			}
		}
	}, { order, name: 'outputCaptor' });
};
