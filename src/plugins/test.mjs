const OPTIONS_FACTORY = (name, fn, opts) => ({ ...opts, name: name.trim(), fn });
const CONFIG = {
	display: 'test',
	run: (node) => node.options.fn(),
};

export default () => (builder) => {
	builder.addNodeType('test', OPTIONS_FACTORY, CONFIG);
	builder.addNodeType('it', OPTIONS_FACTORY, CONFIG);
};
