import { standardRunner, reporters } from '../../index.mjs';

export default async function nodeRunner(config, paths, output) {
	const out = new reporters.TextReporter(output);

	const builder = standardRunner()
		.useParallelDiscovery(config.parallelDiscovery)
		.useParallelSuites(config.parallelSuites);

	for await (const { path, relative } of paths) {
		builder.addSuite(relative, async (globals) => {
			Object.assign(global, globals);
			const result = await import(path);
			return result.default;
		});
	}

	const runner = await builder.build();
	const result = await runner.run();
	out.report(result);

	return result.getSummary();
}
