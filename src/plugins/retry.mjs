export default () => (builder) => {
	builder.addRunInterceptor(async (next, context, result, node) => {
		const maxAttempts = node.options.retry || 0;
		if (!context.active || maxAttempts <= 1) {
			return next(context);
		}

		for (let attempt = 0; attempt < maxAttempts; ++attempt) {
			const attemptResult = result.createChild(`attempt ${attempt + 1} of ${maxAttempts}`, { asDelegate: true });
			await next(context, attemptResult);
			attemptResult.finish();
			if (!attemptResult.hasFailed()) {
				break;
			}
		}
	}, { first: true }); // ensure any lifecycle steps happen within the retry
};
