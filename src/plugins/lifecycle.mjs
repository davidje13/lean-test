export default ({ order = 0 } = {}) => (builder) => {
	const scope = builder.addScope({
		name: 'lifecycle',
		node: () => ({
			beforeAll: [],
			afterAll: [],
			beforeEach: [],
			afterEach: [],
		}),
		context: () => ({
			beforeEach: [],
			afterEach: [],
		}),
	});

	builder.addRunInterceptor((next, context, result, node) => {
		const baseParameters = context.testParameters || [];
		if (!context.active) {
			return next(context);
		} else if (!node.config.isBlock) {
			return withWrappers(result, context[scope].beforeEach, context[scope].afterEach, (skip, extraParams) => next({
				...context,
				testParameters: [...baseParameters, ...extraParams],
				active: !skip,
			}));
		} else {
			const nodeScope = node.getScope(scope);
			return withWrappers(result, [nodeScope.beforeAll], [nodeScope.afterAll], (skip, extraParams) => next({
				...context,
				testParameters: [...baseParameters, ...extraParams],
				[scope]: {
					beforeEach: [...context[scope].beforeEach, nodeScope.beforeEach],
					afterEach: [...context[scope].afterEach, nodeScope.afterEach],
				},
				active: !skip,
			}));
		}
	}, { order, name: 'lifecycle' });

	async function withWrappers(result, before, after, next) {
		const extraParams = [];
		const ops = {
			addTestParameter: (...values) => extraParams.push(...values),
		};
		let skip = false;
		const allTeardowns = [];
		let i = 0;
		for (; i < before.length && !skip; ++i) {
			const teardowns = [];
			for (const { name, fn } of before[i]) {
				const stage = await result.createStage(
					{ fail: true },
					`before ${name}`,
					async () => {
						const teardown = await fn(ops);
						if (typeof teardown === 'function') {
							teardowns.unshift({ name, fn: teardown });
						}
					},
					{ errorStackSkipFrames: 1 }
				);
				if (stage.hasFailed() || stage.hasSkipped()) {
					skip = true;
					break;
				}
			}
			allTeardowns.push(teardowns);
		}

		try {
			return await next(skip, extraParams);
		} finally {
			while ((i--) > 0) {
				for (const { name, fn } of after[i]) {
					await result.createStage({ fail: true, noCancel: true }, `after ${name}`, fn);
				}
				for (const { name, fn } of allTeardowns[i]) {
					await result.createStage({ fail: true, noCancel: true }, `teardown ${name}`, fn);
				}
			}
		}
	}

	const convert = (name, fn, defaultName) => {
		if (typeof fn === 'function') {
			return { name: String(name) || defaultName, fn };
		} else if (typeof name === 'function') {
			return { name: defaultName, fn: name };
		} else {
			throw new Error('Invalid arguments');
		}
	};

	builder.addGlobals({
		beforeEach(name, fn) {
			this.getCurrentNodeScope(scope).beforeEach.push(convert(name, fn, 'each'));
		},
		afterEach(name, fn) {
			this.getCurrentNodeScope(scope).afterEach.push(convert(name, fn, 'each'));
		},
		beforeAll(name, fn) {
			this.getCurrentNodeScope(scope).beforeAll.push(convert(name, fn, 'all'));
		},
		afterAll(name, fn) {
			this.getCurrentNodeScope(scope).afterAll.push(convert(name, fn, 'all'));
		},
	});
};
