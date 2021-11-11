export default () => (builder) => {
	builder.addRunInterceptor(async (next, context, node, result) => {
		await next(context);
		if (!context.active) {
			return;
		}
		const maxAttempts = node.options.retry || 0;
		const attempts = []; // TODO: make available to reporting (also durations, etc.)
		while (result.hasFailed() && attempts.length < maxAttempts - 1) {
			attempts.push({ errors: [...result.errors], failures: [...result.failures] });
			result.errors.length = 0;
			result.failures.length = 0;
			await next(context);
		}
	}, { first: true }); // ensure any lifecycle steps happen within the retry
};
