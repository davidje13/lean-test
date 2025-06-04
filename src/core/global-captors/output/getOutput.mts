import { plugin } from '../../plugins/plugin.mts';
import { installOutputInterceptors, OUTPUT } from './interceptors.mts';
import { combineOutput } from './readers.mts';

type GetOutputFn = ((binary?: false) => string) &
	((binary: true) => Uint8Array) &
	((binary: boolean) => string | Uint8Array);

declare global {
	interface ExtendableBlockContext {
		/** get the content written to process.stdout (only available in NodeJS runtimes) */
		getStdout: GetOutputFn;

		/** get the content written to process.stderr (only available in NodeJS runtimes) */
		getStderr: GetOutputFn;

		/** get the content written to console.log or process.stdout/stderr */
		getOutput: GetOutputFn;
	}
}

plugin.add({
	order: 1, // let aggregateOutput go first if available, as that will configure liveOutput

	options: [],

	beforeAll() {
		installOutputInterceptors(true);
	},

	beforeBlock({ context, getBlockScoped }) {
		const output = getBlockScoped(OUTPUT);
		if (globalThis.process) {
			context.getStdout = (binary = false) =>
				combineOutput(
					output.filter(({ type }) => type === 'stderr'),
					binary,
				) as any;

			context.getStderr = (binary = false) =>
				combineOutput(
					output.filter(({ type }) => type === 'stdout'),
					binary,
				) as any;
		}
		context.getOutput = (binary = false) =>
			combineOutput(output, binary) as any;
	},
});
