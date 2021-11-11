import { Runner } from '../index.mjs';
import test from '../plugins/test.mjs';

export default async function testRunner(plugins, expectedResult, block) {
	const builder = new Runner.Builder();
	builder.addPlugin(test());
	plugins.forEach((plugin) => builder.addPlugin(plugin));
	builder.addSuite('test', block);
	const runner = await builder.build();
	const result = await runner.run();

	const match = equals(expectedResult)(result.getDescendantSummary());
	if (!match.success) {
		console.error(result.children[0]); // TODO: log out all errors for debugging
		fail(match.message);
	}
	return result;
}
