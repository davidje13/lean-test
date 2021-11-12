import TestAssumptionError from '../core/TestAssumptionError.mjs';

const id = Symbol();
const TEST_FN = Symbol();

const OPTIONS_FACTORY = (name, fn, opts) => ({ ...opts, name: name.trim(), fn });
const CONFIG = {
	display: 'test',
	[TEST_FN]: (node) => node.options.fn(),
};

export default (fnName = 'test') => (builder) => {
	builder.addNodeType(fnName, OPTIONS_FACTORY, CONFIG);

	builder.addRunInterceptor((next, context, result, node) => {
		if (!node.config[TEST_FN]) {
			return next();
		}
		return result.createStage({ tangible: true }, 'test', () => {
			if (!context.active) {
				throw new TestAssumptionError('ignored');
			}
			return node.config[TEST_FN](node);
		});
	}, { order: Number.POSITIVE_INFINITY, id });
};
