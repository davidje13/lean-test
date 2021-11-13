import { extractStackList } from '../utils.mjs';

export default class CapturedError {
	constructor(err, base) {
		if (typeof base !== 'object') {
			base = CapturedError.makeBase(0);
		}
		const stackList = extractStackList(err);
		this.stack = cutTrace(stackList, base);
		if (err.trimFrames) {
			this.stack.splice(0, err.trimFrames);
		}
		this.message = err.message;
	}
}

CapturedError.makeBase = (skipFrames = 0) => ({
	stackBase: extractStackList(new Error())[1],
	skipFrames,
});

function cutTrace(trace, base) {
	let list = trace;

	// cut to given base frame
	if (base.stackBase) {
		for (let i = 0; i < trace.length; ++i) {
			if (trace[i].name === base.stackBase.name) {
				list = trace.slice(0, Math.max(0, i - base.skipFrames));
				break;
			}
			if (trace[i].name === 'async ' + base.stackBase.name) {
				// if function is in async mode, the very next frame is probably user-relevant, so don't skip skipFrames
				list = trace.slice(0, i);
				break;
			}
		}
	}

	// remove any trailing "special" frames (e.g. node internal async task handling)
	while (list.length > 0 && !isFile(list[list.length - 1].location)) {
		list.length--;
	}

	// remove common file path prefix
	const locations = trace.map((s) => s.location);
	locations.push(base.stackBase.location);
	const prefix = locations.filter(isFile).reduce((prefix, l) => {
		for (let p = 0; p < prefix.length; ++p) {
			if (l[p] !== prefix[p]) {
				return prefix.substr(0, p);
			}
		}
		return prefix;
	});

	return list.map(({ location, ...rest }) => ({ ...rest, location: isFile(location) ? location.substr(prefix.length) : location }));
}

function isFile(path) {
	return path.includes('://');
}
