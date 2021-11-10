export default () => (builder) => {
	builder.addRunInterceptor(async (next, context, node) => {
		await next(context);
		if (!context.active) {
			return;
		}
		const maxAttempts = node.options.retry || 0;
		const attempts = []; // TODO: make available to reporting (also durations, etc.)
		while (node.result.hasFailed() && attempts.length < maxAttempts - 1) {
			attempts.push({ errors: [...node.result.errors], failures: [...node.result.failures] });
			node.result.errors.length = 0;
			node.result.failures.length = 0;
			await next(context);
		}
	}, { first: true }); // ensure any lifecycle steps happen within the retry
};
