import { Runner } from '../index.mjs';
import test from '../plugins/test.mjs';
import TextReporter from '../reporters/text/TextReporter.mjs';

export default async function testRunner(plugins, expectedResult, block) {
	const builder = new Runner.Builder();
	builder.addPlugin(test());
	plugins.forEach((plugin) => builder.addPlugin(plugin));
	builder.addSuite('test', block);
	const runner = await builder.build();
	const result = await runner.run();
	const summary = result.getSummary();

	// allow omitted fields to have any value
	const looseExpected = { ...summary, ...expectedResult };

	const match = equals(looseExpected)(summary);
	if (!match.success) {
		new TextReporter(process.stdout, false).report(result);
		fail(match.message);
	}
	return result;
}
