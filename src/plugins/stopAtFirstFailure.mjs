const failed = (result) => result.hasFailed();

export default () => (builder) => {
	builder.addRunCondition((_, node, result) => !(
		node.parent &&
		node.parent.options.stopAtFirstFailure &&
		result.parent.selfOrDescendantMatches(failed)
	));
};
