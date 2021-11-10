const failed = (node) => node.result.hasFailed();

export default () => (builder) => {
	builder.addRunCondition((_, node) => !(
		node.parent &&
		node.parent.options.stopAtFirstFailure &&
		node.parent.selfOrDescendantMatches(failed)
	));
};
