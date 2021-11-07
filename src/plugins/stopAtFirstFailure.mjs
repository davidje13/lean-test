const containsFailure = (node) => (node.hasFailed() || node.sub.some(containsFailure));

export default () => (builder) => {
	builder.addRunCondition((_, node) => !(
		node.parent &&
		node.parent.options.stopAtFirstFailure &&
		containsFailure(node.parent)
	));
};
