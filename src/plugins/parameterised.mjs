import { print } from '../utils.mjs';

export default ({ order = -4 } = {}) => (builder) => {
	builder.addRunInterceptor(async (next, context, result, node) => {
		const { parameters, parameterFilter } = node.options;

		if (!context.active || !parameters || result.hasFailed()) {
			return next(context);
		}

		const baseParameters = context.testParameters || [];
		const normParameters = normaliseParameters(parameters);
		const count = countParameterCombinations(normParameters);
		for (const paramList of getParameterCombinations(baseParameters, normParameters)) {
			if (parameterFilter?.(...paramList) === false) {
				continue;
			}
			await result.createChild(
				'(' + paramList.map(print).join(', ') + ')',
				(subResult) => next({ ...context, testParameters: paramList }, subResult),
				{ isBoring: count > 10 },
			);
		}
	}, { order });
};

const norm2 = (pSet) => {
	let allArrays = true;
	for (const v of pSet) {
		if (!Array.isArray(v)) {
			allArrays = false;
			break;
		}
	}
	if (allArrays) {
		return pSet;
	}
	return new Set([...pSet.values()].map((v) => [v]));
};

const normaliseParameters = (ps) => {
	if (ps instanceof Set) {
		// Set([foo, bar]) => call with (foo), (bar)
		return [norm2(ps)];
	}

	if (Array.isArray(ps)) {
		if (ps.every((p) => (p instanceof Set))) {
			// [Set([foo, bar]), Set([zig, zag])] => call with (foo, zig), (foo, zag), (bar, zig), (bar, zag)
			return ps.map(norm2);
		} else {
			// [foo, bar] => call with (foo), (bar)
			// [[foo, zig], [bar, zag]] => call with (foo, zig), (bar, zag)
			return [norm2(new Set(ps))];
		}
	}

	throw new Error('Invalid parameters');
};

function countParameterCombinations(ps) {
	let n = 1;
	for (const p of ps) {
		n *= p.size;
	}
	return n;
}

function *getParameterCombinations(base, [cur, ...rest]) {
	for (const v of cur) {
		const params = [...base, ...v];
		if (rest.length > 0) {
			yield *getParameterCombinations(params, rest);
		} else {
			yield params;
		}
	}
}
