import { seq, resolveMessage } from '../utils.mjs';
import TestAssertionError from '../core/TestAssertionError.mjs';
import TestAssumptionError from '../core/TestAssumptionError.mjs';

const FLUENT_MATCHERS = Symbol();

const expect = () => (builder) => {
	const invokeMatcher = (actual, matcher, ErrorType, skipFrames) =>
		seq(matcher(actual), ({ pass, message }) => {
			if (!pass) {
				throw new ErrorType(resolveMessage(message), skipFrames + 3);
			}
		});

	const run = (context, ErrorType, actual, matcher = undefined) => {
		if (matcher) {
			return invokeMatcher(actual, matcher, ErrorType, 2);
		}
		return Object.fromEntries(context.get(FLUENT_MATCHERS).map(([name, m]) =>
			[name, (...args) => invokeMatcher(actual, m(...args), ErrorType, 1)]
		));
	};

	function expect(...args) {
		return run(this, TestAssertionError, ...args);
	}

	function assume(...args) {
		return run(this, TestAssumptionError, ...args);
	}

	function extend(matchers) {
		this.extend(FLUENT_MATCHERS, ...Object.entries(matchers));
	}

	expect.extend = extend;

	builder.addGlobals({ expect, assume });
};

expect.matchers = (...matcherDictionaries) => (builder) => {
	matcherDictionaries.forEach((md) => {
		builder.extend(FLUENT_MATCHERS, ...Object.entries(md));
		builder.addGlobals(md);
	});
};

export default expect;
