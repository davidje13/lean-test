import StackScope from '../core/StackScope.mjs';

const OUTPUT_CAPTOR_SCOPE = new StackScope('OUTPUT_CAPTOR');

function interceptWrite(base, type, chunk, encoding, callback) {
	const target = OUTPUT_CAPTOR_SCOPE.get();
	if (!target) {
		// We do not seem to be within a scope; could be unrelated code,
		// or could be that the stack got too deep to know.
		// Call original function as fallback
		return base.call(this, chunk, encoding, callback);
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

let INTERCEPT_COUNT = 0;
let ORIGINAL = null;
async function addIntercept() {
	if ((INTERCEPT_COUNT++) > 0) {
		return;
	}

	ORIGINAL = {
		stdout: process.stdout.write,
		stderr: process.stderr.write,
	};

	process.stdout.write = interceptWrite.bind(process.stdout, process.stdout.write, 'stdout');
	process.stderr.write = interceptWrite.bind(process.stderr, process.stderr.write, 'stderr');
}

async function removeIntercept() {
	if ((--INTERCEPT_COUNT) > 0) {
		return;
	}
	process.stdout.write = ORIGINAL.stdout;
	process.stderr.write = ORIGINAL.stderr;
	ORIGINAL = null;
}

function getOutput(type) {
	const target = OUTPUT_CAPTOR_SCOPE.get();
	if (!target) {
		const err = new Error(`Unable to resolve ${type} scope`);
		err.skipFrames = 2;
		throw err;
	}
	return Buffer.concat(
		target
			.filter((i) => (i.type === type))
			.map((i) => i.chunk)
	).toString('utf8');
}

export default ({ order = -1 } = {}) => (builder) => {
	builder.addMethods({
		getStdout() {
			return getOutput('stdout');
		},
		getStderr() {
			return getOutput('stderr');
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
				result.addOutput(Buffer.concat(target.map((i) => i.chunk)).toString('utf8'));
			}
		}
	}, { order });
};
