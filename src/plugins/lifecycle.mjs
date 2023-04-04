const NAMED_PARAMS_OBJECT = Symbol('NAMED_PARAMS_OBJECT');

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
		const existingParams = context.testParameters || [];
		if (!context.active) {
			return next(context);
		} else if (!node.config.isBlock) {
			return withWrappers(result, context[scope].beforeEach, context[scope].afterEach, existingParams, (skip, testParameters) => next({
				...context,
				testParameters,
				active: !skip,
			}));
		} else {
			const nodeScope = node.getScope(scope);
			return withWrappers(result, [nodeScope.beforeAll], [nodeScope.afterAll], existingParams, (skip, testParameters) => next({
				...context,
				testParameters,
				[scope]: {
					beforeEach: [...context[scope].beforeEach, nodeScope.beforeEach],
					afterEach: [...context[scope].afterEach, nodeScope.afterEach],
				},
				active: !skip,
			}));
		}
	}, { order, name: 'lifecycle' });

	async function withWrappers(result, before, after, params, next) {
		const hadNamedParams = (params[0] && typeof params[0] === 'object' && params[0][NAMED_PARAMS_OBJECT]);
		const newParams = [...params];
		const namedParams = hadNamedParams ? copySymbolObject(params[0]) : { [NAMED_PARAMS_OBJECT]: true };
		let changedNamedParams = false;
		const addTestParameter = (...values) => newParams.push(...values);
		// this function exists to work around a limitation in TypeScript
		// (see TypedParameters definition in index.d.ts)
		const getTyped = (key) => namedParams[key];
		const testPath = [];
		for (let n = result; n; n = n.parent) {
			if (n.label !== null) {
				// remove node type from combined name (TODO: store this better)
				const friendlyName = n.label.substring(n.label.indexOf(': ') + 2);
				testPath.push(friendlyName);
			}
		}
		testPath.reverse();
		Object.freeze(testPath);

		let skip = false;
		const allTeardowns = [];
		let i = 0;
		for (; i < before.length && !skip; ++i) {
			const teardowns = [];
			for (const { name, fn, id } of before[i]) {
				const stage = await result.createStage(
					{ fail: true },
					`before ${name}`,
					async () => {
						const teardown = await fn(Object.freeze(Object.assign(copySymbolObject(namedParams), {
							getTyped,
							testPath,
							addTestParameter,
							setParameter: (value) => {
								namedParams[id] = value;
								changedNamedParams = true;
							},
						})));
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

		if (changedNamedParams) {
			namedParams.getTyped = getTyped;
			// would be nice to do this, but is weird to only make it available if parameters have been set
			// consider enabling if/when there is a consistent first argument to all tests
			//namedParams.testPath = testPath;
			if (hadNamedParams) {
				newParams[0] = namedParams;
			} else {
				newParams.unshift(namedParams);
			}
		}

		try {
			return await next(skip, newParams);
		} finally {
			const ops = Object.freeze(Object.assign(copySymbolObject(namedParams), {
				getTyped,
				testPath,
			}));
			while ((i--) > 0) {
				for (const { name, fn } of after[i]) {
					await result.createStage(
						{ fail: true, noCancel: true },
						`after ${name}`,
						() => fn(ops),
						{ errorStackSkipFrames: 1 },
					);
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
			const converted = convert(name, fn, 'each');
			const id = Symbol(converted.name);
			this.getCurrentNodeScope(scope).beforeEach.push({ ...converted, id });
			return id;
		},
		afterEach(name, fn) {
			this.getCurrentNodeScope(scope).afterEach.push(convert(name, fn, 'each'));
		},
		beforeAll(name, fn) {
			const converted = convert(name, fn, 'all');
			const id = Symbol(converted.name);
			this.getCurrentNodeScope(scope).beforeAll.push({ ...converted, id });
			return id;
		},
		afterAll(name, fn) {
			this.getCurrentNodeScope(scope).afterAll.push(convert(name, fn, 'all'));
		},
	});
};

function copySymbolObject(o) {
	const r = {};
	for (const key of Object.getOwnPropertySymbols(o)) {
		r[key] = o[key];
	}
	return r;
}
