import ProcessRunner from './ProcessRunner.mjs';
import { standardRunner, orderers } from '../../lean-test.mjs';

export async function nodeRunner(config, paths) {
	if (config.preprocessor) {
		return new ProcessRunner(config, paths);
	}

	const builder = standardRunner()
		.useParallelDiscovery(config.parallelDiscovery)
		.useParallelSuites(config.parallelSuites);

	if (config.orderingRandomSeed) {
		builder.useExecutionOrderer(new orderers.SeededRandom(config.orderingRandomSeed));
	}

	for await (const { path, relative } of paths) {
		builder.addSuite(relative, async (globals) => {
			Object.assign(global, globals);
			const result = await import(path);
			return result.default;
		});
	}

	return builder.build();
}
