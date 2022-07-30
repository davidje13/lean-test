export default ({ order = -3 } = {}) => (builder) => {
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
		let bestPassSummary = null;
		let bestFailSummary = null;

		result.overrideChildSummary({ count: 1, run: 1 });
		for (let repetition = 0; repetition < total; ++repetition) {
			const subResult = await result.createChild(
				`repetition ${repetition + 1} of ${total}`,
				(subResult) => next(context, subResult),
			);
			const subSummary = subResult.summary;
			if (subSummary.error || subSummary.fail || !subSummary.pass) {
				failureCount++;
				if (!bestFailSummary || subSummary.pass > bestFailSummary.pass) {
					bestFailSummary = subSummary;
				}
				if (failureCount > maxFailures) {
					result.overrideChildSummary(bestFailSummary);
				}
			} else if (failureCount <= maxFailures) {
				if (!bestPassSummary || subSummary.pass > bestPassSummary.pass) {
					bestPassSummary = subSummary;
				}
				result.overrideChildSummary(bestPassSummary);
			}
			if (failFast && failureCount > maxFailures) {
				break;
			}
		}
	}, { order, name: 'repeat' });
};
