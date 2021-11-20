import { Runner } from '../index.mjs';
import test from '../plugins/test.mjs';
import Writer from '../outputs/Writer.mjs';
import FullReporter from '../reporters/Full.mjs';

export default async function testRunner(plugins, expectedResult, block) {
	const builder = new Runner.Builder();
	builder.addPlugin(test());
	plugins.forEach((plugin) => builder.addPlugin(plugin));
	builder.addSuite('test', block);
	const runner = await builder.build();
	const result = await runner.run();

	// allow omitted fields to have any value
	const looseExpected = { ...result.summary, ...expectedResult };

	const match = equals(looseExpected)(result.summary);
	if (!match.success) {
		new FullReporter(new Writer(process.stdout, false)).report(result);
		fail(match.message);
	}
	return result;
}
