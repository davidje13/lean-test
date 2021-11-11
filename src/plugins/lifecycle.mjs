export default () => (builder) => {
	const scope = builder.addScope({
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
		if (!context.active) {
			return next(context);
		} else if (node.config.run) {
			return withWrappers(result, context[scope].beforeEach, context[scope].afterEach, (err) => next({
				...context,
				active: !err,
			}));
		} else {
			const nodeScope = node.getScope(scope);
			return withWrappers(result, [nodeScope.beforeAll], [nodeScope.afterAll], (err) => next({
				...context,
				[scope]: {
					beforeEach: [...context[scope].beforeEach, nodeScope.beforeEach],
					afterEach: [...context[scope].afterEach, nodeScope.afterEach],
				},
				active: !err,
			}));
		}
	});

	async function withWrappers(result, before, after, next) {
		let err = false;
		const allTeardowns = [];
		let i = 0;
		for (; i < before.length && !err; ++i) {
			const teardowns = [];
			for (const { name, fn } of before[i]) {
				const success = await result.exec(`before ${name}`, async () => {
					const teardown = await fn();
					if (typeof teardown === 'function') {
						teardowns.unshift({ name, fn: teardown });
					}
				});
				if (!success) {
					err = true;
					break;
				}
			}
			allTeardowns.push(teardowns);
		}

		try {
			return await next(err);
		} finally {
			while ((i--) > 0) {
				for (const { name, fn } of allTeardowns[i]) {
					await result.exec(`teardown ${name}`, fn);
				}
				for (const { name, fn } of after[i]) {
					await result.exec(`after ${name}`, fn);
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

	builder.addMethods({
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
