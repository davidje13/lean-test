export default () => (builder) => {
	builder.addRunInterceptor(async (next, context, result, node) => {
		const maxAttempts = node.options.retry || 0;
		if (!context.active || maxAttempts <= 1) {
			return next(context);
		}

		for (let attempt = 0; attempt < maxAttempts; ++attempt) {
			const subResult = result.createChild(`attempt ${attempt + 1} of ${maxAttempts}`);
			// TODO: make this not be hacky
			subResult.previous = result.previous;
			result.getSummary = () => subResult.getSummary();

			await next(context, subResult);
			subResult.finish();
			if (!subResult.hasFailed()) {
				break;
			}
		}
	}, { first: true }); // ensure any lifecycle steps happen within the retry
};
