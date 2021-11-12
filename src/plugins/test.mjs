import TestAssumptionError from '../core/TestAssumptionError.mjs';

const OPTIONS_FACTORY = (name, fn, opts) => ({ ...opts, name: name.trim(), fn });
const CONFIG = {
	display: 'test',
	run: (node) => node.options.fn(),
};

const id = Symbol();

export default (fnName = 'test') => (builder) => {
	builder.addNodeType(fnName, OPTIONS_FACTORY, CONFIG);

	builder.addRunInterceptor((next, context, result, node) => {
		if (!node.config.run) {
			return next();
		}
		return result.createStage({ tangible: true }, 'test', () => {
			if (!context.active) {
				throw new TestAssumptionError('ignored');
			}
			return node.config.run(node);
		});
	}, { order: Number.POSITIVE_INFINITY, id });
};
