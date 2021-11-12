const id = Symbol();
const TEST_FN_NAME = Symbol();
const SUB_FN_NAME = Symbol();

const OPTIONS_FACTORY = (name, content, opts) => {
	if (!content || (typeof content !== 'function' && typeof content !== 'object')) {
		throw new Error('Invalid content');
	}
	return { ...opts, name: name.trim(), content };
};

const DISCOVERY = async (node, methods) => {
	const { content } = node.options;

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
		isBlock: true, // this is also checked by lifecycle to decide which hooks to run
		[TEST_FN_NAME]: testFn,
		[SUB_FN_NAME]: subFn || fnName,
		discovery: DISCOVERY,
	});

	builder.addRunInterceptor(async (next, context, result, node) => {
		if (!node.config.isBlock) {
			return next();
		}
		if (node.options.parallel) {
			await Promise.all(node.children.map((child) => child.run(context, result)));
		} else {
			for (const child of node.children) {
				await child.run(context, result);
			}
		}
	}, { order: Number.POSITIVE_INFINITY, id });
};
