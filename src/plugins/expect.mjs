import { seq, resolveMessage } from '../utils.mjs';
import TestAssertionError from '../core/TestAssertionError.mjs';
import TestAssumptionError from '../core/TestAssumptionError.mjs';

const FLUENT_MATCHERS = Symbol();

const expect = () => (builder) => {
	const invokeMatcher = (actual, matcher, ErrorType) =>
		seq(matcher(actual), ({ success, message }) => {
			if (!success) {
				throw new ErrorType(resolveMessage(message));
			}
		});

	const run = (context, ErrorType, actual, matcher = undefined) => {
		if (matcher) {
			return invokeMatcher(actual, matcher, ErrorType);
		}
		return Object.fromEntries(context.get(FLUENT_MATCHERS).map(([name, m]) =>
			[name, (...args) => invokeMatcher(actual, m(...args), ErrorType)]
		));
	};

	builder.addMethods({
		expect(...args) {
			return run(this, TestAssertionError, ...args);
		},
		assume(...args) {
			return run(this, TestAssumptionError, ...args);
		},
		extendExpect(matchers) {
			this.extend(FLUENT_MATCHERS, ...Object.entries(matchers));
		}
	});
};

expect.matchers = (...matcherDictionaries) => (builder) => {
	matcherDictionaries.forEach((md) => {
		builder.extend(FLUENT_MATCHERS, ...Object.entries(md));
		builder.addGlobals(md);
	});
};

export default expect;
