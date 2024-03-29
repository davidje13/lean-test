import Runner from './runners/Runner.mjs';
import * as matchers from './matchers/index.mjs';
import * as plugins from './plugins/index.mjs';

export { default as TestAssertionError } from './core/TestAssertionError.mjs';
export { default as TestAssumptionError } from './core/TestAssumptionError.mjs';
export { default as ExitHook } from './core/ExitHook.mjs';
export { default as AbstractRunner } from './runners/AbstractRunner.mjs';
export { default as ExternalRunner } from './runners/ExternalRunner.mjs';
export { default as ParallelRunner } from './runners/ParallelRunner.mjs';
export * as helpers from './helpers/index.mjs';
export * as outputs from './outputs/index.mjs';
export * as reporters from './reporters/index.mjs';
export * as orderers from './orderers/index.mjs';

// internal use only
export { default as _internal_StackScope } from './core/StackScope.mjs';

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
		.addPlugin(plugins.parameterised())
		.addPlugin(plugins.repeat())
		.addPlugin(plugins.retry())
		.addPlugin(plugins.scopedMock())
		.addPlugin(plugins.stopAtFirstFailure())
		.addPlugin(plugins.test())
		.addPlugin(plugins.test('it'))
		.addPlugin(plugins.timeout());
}
