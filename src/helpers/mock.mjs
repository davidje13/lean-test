import { isListOf } from '../matchers/collections.mjs';
import { print } from '../utils.mjs';

const ACTIONS = Symbol('ACTIONS');

class MockAction {
	constructor(mock) {
		this.mock = mock;
		this.argsMatcher = null;
		this.limit = Number.POSITIVE_INFINITY;
		this.state = { matches: 0 };
		this.fn = null;

		if (mock.original) {
			this.thenCallThrough = this.then.bind(this, mock.original);
		}
	}

	with(...expectedArgs) {
		this.argsMatcher = isListOf(...expectedArgs);
		return this;
	}

	once() {
		return this.times(1);
	}

	times(n) {
		this.limit = n;
		return this;
	}

	then(fn) {
		if (typeof fn !== 'function') {
			throw new Error('Invalid mock action');
		}
		this.fn = fn;
		Object.freeze(this);
		this.mock[ACTIONS].push(this);
		return this.mock;
	}

	thenReturn(value) {
		return this.then(() => value);
	}

	thenResolve(value) {
		return this.thenReturn(Promise.resolve(value));
	}

	thenReject(value) {
		return this.thenReturn(Promise.reject(value));
	}

	thenThrow(error) {
		return this.then(() => {
			throw error;
		});
	}

	_check(args) {
		if (this.state.matches >= this.limit) {
			return null;
		}
		try {
			if (this.argsMatcher?.(args)?.pass !== false) {
				this.state.matches++;
				return this.fn;
			}
		} catch (ignore) {
		}
		return null;
	}
}

function mockFunction(name, original) {
	if (original !== undefined && typeof original !== 'function') {
		throw new Error('Invalid call to mock() - bad original function');
	}
	const actions = [];
	const invocations = [];
	const mock = {
		[name](...args) {
			invocations.push({ arguments: args, stack: new Error().stack });
			for (const action of actions) {
				const fn = action._check(args);
				if (fn) {
					return fn.apply(this, args);
				}
			}
			return original?.apply(this, args);
		},
	};
	const fn = mock[name];
	fn.original = original;
	fn.invocations = invocations;
	fn[ACTIONS] = actions;
	fn.whenCalled = () => new MockAction(fn);
	fn.whenCalledNext = () => fn.whenCalled().once();
	fn.whenCalledWith = (...args) => fn.whenCalled().with(...args);
	fn.returning = (value) => fn.whenCalled().thenReturn(value);
	fn.throwing = (error) => fn.whenCalled().thenThrow(error);
	fn.reset = () => {
		invocations.length = 0;
		actions.length = 0;
		return fn;
	};
	return fn;
}

function mockMethod(object, method) {
	const original = object[method];
	if (typeof original !== 'function') {
		throw new Error(`Cannot mock ${print(method)} as it is not a function`);
	}
	if (original[ACTIONS]) {
		throw new Error(`Cannot mock ${print(method)} as it is already mocked`);
	}
	const fn = mockFunction(method, original);
	fn.revert = () => {
		fn.reset();
		object[method] = original;
		fn.revert = () => undefined;
	};
	object[method] = fn;
	return fn;
}

export default function mock(a, ...rest) {
	if (typeof a === 'object' && a) {
		return mockMethod(a, ...rest);
	} else if (typeof a === 'function') {
		return mockFunction(a.name, a, ...rest);
	} else if (typeof a === 'string' || a === undefined) {
		return mockFunction(a || 'mock function', ...rest);
	} else {
		throw new Error('Invalid call to mock()');
	}
}
