export default () => (builder) => {
	builder.addRunInterceptor(async (next, context, result, node) => {
		let { repeat = {} } = node.options;
		if (typeof repeat !== 'object') {
			repeat = { total: repeat };
		}

		const { total = 1, failFast = true, maxFailures = 0 } = repeat;
		if (!context.active || total <= 1 || result.hasFailed()) {
			return next(context);
		}

		let failureCount = 0;
		let bestFailSummary = null;
		let bestSummary = null;
		result.getSummary = () => (failureCount > maxFailures) ? bestFailSummary : bestSummary ?? { count: 1, run: 1 };

		for (let repetition = 0; repetition < total; ++repetition) {
			const subResult = result.createChild(`repetition ${repetition + 1} of ${total}`);
			await next(context, subResult);
			subResult.finish();
			const subSummary = subResult.getSummary();
			if (subSummary.error || subSummary.fail || !subSummary.pass) {
				if (
					!bestFailSummary ||
					subSummary.error < bestFailSummary.error ||
					(subSummary.error === bestFailSummary.error && subSummary.fail < bestFailSummary.fail)
				) {
					bestFailSummary = subSummary;
				}
				failureCount++;
			} else if (!bestSummary || subSummary.pass > bestSummary.pass) {
				bestSummary = subSummary;
			}
			if (failFast && result.hasFailed()) {
				break;
			}
		}
	}, { first: true }); // ensure any lifecycle steps happen within the repeat
};
