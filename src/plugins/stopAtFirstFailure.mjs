const failed = (result) => result.hasFailed();

export default () => (builder) => {
	builder.addRunCondition((_, node) => !(
		node.parent &&
		node.parent.options.stopAtFirstFailure &&
		node.result.parent.selfOrDescendantMatches(failed)
	));
};
