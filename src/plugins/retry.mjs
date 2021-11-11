export default ({ order = -1 } = {}) => (builder) => {
	builder.addRunInterceptor(async (next, context, result, node) => {
		const maxAttempts = node.options.retry || 0;
		if (!context.active || maxAttempts <= 1) {
			return next(context);
		}

		for (let attempt = 0; attempt < maxAttempts; ++attempt) {
			const subResult = await result.createChild(
				`attempt ${attempt + 1} of ${maxAttempts}`,
				(subResult) => next(context, subResult),
			);
			const subSummary = subResult.getSummary();
			result.overrideChildSummary(subSummary);
			if (!subSummary.error && !subSummary.fail) {
				break;
			}
		}
	}, { order });
};
