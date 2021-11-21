import Runner from './core/Runner.mjs';
import * as matchers from './matchers/index.mjs';
import * as plugins from './plugins/index.mjs';

export { default as TestAssertionError } from './core/TestAssertionError.mjs';
export { default as TestAssumptionError } from './core/TestAssumptionError.mjs';
export * as outputs from './outputs/index.mjs';
export * as reporters from './reporters/index.mjs';

export {
	Runner,
	matchers,
	plugins,
};

export function standardRunner() {
	return new Runner.Builder()
		.addPlugin(plugins.describe())
		.addPlugin(plugins.expect())
		.addPlugin(plugins.expect.matchers(matchers))
		.addPlugin(plugins.fail())
		.addPlugin(plugins.focus())
		.addPlugin(plugins.ignore())
		.addPlugin(plugins.lifecycle())
		.addPlugin(plugins.outputCaptor())
		.addPlugin(plugins.repeat())
		.addPlugin(plugins.retry())
		.addPlugin(plugins.stopAtFirstFailure())
		.addPlugin(plugins.test())
		.addPlugin(plugins.test('it'))
		.addPlugin(plugins.timeout());
}
