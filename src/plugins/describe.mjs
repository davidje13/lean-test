const id = Symbol();
const CONTENT_FN_NAME = Symbol('CONTENT_FN');
const TEST_FN_NAME = Symbol('TEST_FN');
const SUB_FN_NAME = Symbol('SUB_FN');

const OPTIONS_FACTORY = (name, content, opts) => {
	if (typeof content === 'object' && typeof opts === 'function') {
		[content, opts] = [opts, content];
	}
	if (!content || (typeof content !== 'function' && typeof content !== 'object')) {
		throw new Error('Invalid content');
	}
	return { ...opts, name: name.trim(), [CONTENT_FN_NAME]: content };
};

const DISCOVERY = async (node, methods) => {
	const content = node.options[CONTENT_FN_NAME];

	let resolvedContent = content;
	while (typeof resolvedContent === 'function') {
		resolvedContent = await resolvedContent(methods);
	}

	if (typeof resolvedContent === 'object' && resolvedContent) {
		Object.entries(resolvedContent).forEach(([name, value]) => {
			if (typeof value === 'function') {
				methods[node.config[TEST_FN_NAME]](name, value);
			} else if (typeof value === 'object' && value) {
				methods[node.config[SUB_FN_NAME]](name, value);
			} else {
				throw new Error('Invalid test');
			}
		});
	}
};

export default (fnName = 'describe', {
	display,
	testFn = 'test',
	subFn,
} = {}) => (builder) => {
	builder.addNodeType(fnName, OPTIONS_FACTORY, {
		display: display ?? fnName,
		isBlock: true, // this is also checked by lifecycle to decide which hooks to run and events for reporters to check
		[TEST_FN_NAME]: testFn,
		[SUB_FN_NAME]: subFn || fnName,
		discovery: DISCOVERY,
		discoveryFrames: 1,
	});

	builder.addRunInterceptor(async (next, context, result, node) => {
		if (!node.config.isBlock) {
			return next();
		}
		if (node.options.parallel) {
			return Promise.all(node.children.map((child) => child.run(context, result)));
		} else if (context.executionOrderer) {
			const subOrderers = new Map();
			if (context.executionOrderer.sub) {
				// compute all sub-orderers first and in-order so that they are as stable as possible
				node.children.forEach((c) => subOrderers.set(c, context.executionOrderer.sub(c)));
			}
			for (const child of context.executionOrderer.order([...node.children])) {
				await child.run({
					...context,
					executionOrderer: subOrderers.get(child) ?? context.executionOrderer,
				}, result);
			}
		} else {
			for (const child of node.children) {
				await child.run(context, result);
			}
		}
	}, { order: Number.POSITIVE_INFINITY, name: 'describe', id });
};
