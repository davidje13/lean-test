import { Runner } from '../index.mjs';
import test from '../plugins/test.mjs';

export default async function testRunner(plugins, expectedResult, block) {
	const builder = new Runner.Builder();
	builder.addPlugin(test());
	plugins.forEach((plugin) => builder.addPlugin(plugin));
	builder.addSuite('test', block);
	const runner = await builder.build();
	await runner.run();

	const match = equals(expectedResult)(runner.baseNode.getResults());
	if (!match.success) {
		console.error(runner.baseNode.sub[0].result); // TODO: log out all errors for debugging
		fail(match.message);
	}
	return runner.baseNode;
}
