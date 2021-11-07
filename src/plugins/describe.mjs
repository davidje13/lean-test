const OPTIONS_FACTORY = (name, content, opts) => {
	if (!content || (typeof content !== 'function' && typeof content !== 'object')) {
		throw new Error('Invalid content');
	}
	return { ...opts, name: name.trim(), content };
};

const DISCOVERY = async (node, methods) => {
	const { content } = node.options;

	let result = content;
	while (typeof result === 'function') {
		result = await result(methods);
	}

	if (typeof result === 'object' && result) {
		Object.entries(result).forEach(([name, value]) => {
			if (typeof value === 'function') {
				methods[node.config.testFn](name, value);
			} else if (typeof value === 'object' && value) {
				methods[node.config.subFn](name, value);
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
		display: display || fnName,
		testFn,
		subFn: subFn || fnName,
		discovery: DISCOVERY,
	});
};
