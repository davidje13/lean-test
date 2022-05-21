import { env } from 'process';
import { createWriteStream } from 'fs';
import { ExternalRunner, standardRunner } from './lean-test.mjs';

const parentComm = createWriteStream(null, { fd: 3 });
const compress = ExternalRunner.compressor();
function send(data) {
	parentComm.write(JSON.stringify(compress(data)) + '\u001E', 'utf-8');
}

async function run(config, suites) {
	send({ type: 'runner-connect' });
	const ping = setInterval(() => send({ type: 'runner-ping' }), 500);

	try {
		const builder = standardRunner()
			.useParallelDiscovery(config.parallelDiscovery)
			.useParallelSuites(config.parallelSuites);

		suites.forEach(({ path, relative }) => {
			builder.addSuite(relative, async (globals) => {
				Object.assign(global, globals);
				const result = await import(path);
				return result.default;
			});
		});

		const runner = await builder.build();
		const result = await runner.run(send);

		send({ type: 'runner-end', result });
	} catch (e) {
		console.error(e);
		send({ type: 'runner-error', message: String(e) });
	} finally {
		clearInterval(ping);
		parentComm.close();
	}
}

run(
	JSON.parse(env.__LEAN_TEST_CONFIG),
	JSON.parse(env.__LEAN_TEST_PATHS),
);
