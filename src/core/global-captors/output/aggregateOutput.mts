import { format } from '../../output/format.mts';
import { unquotedString } from '../../output/stringify.mts';
import { plugin } from '../../plugins/plugin.mts';
import { installOutputInterceptors, OUTPUT } from './interceptors.mts';
import { getLines } from './readers.mts';

plugin.add({
	order: 0,

	options: {
		liveOutput: {
			name: 'live-output',
			type: 'boolean',
			default: false,
			description:
				'Display all output as it is written, instead of buffering to display in a structured way later. This can be useful if the test run is crashing before output is displayed.',
		},
		allOutput: {
			name: 'all-output',
			type: 'boolean',
			default: false,
			description: 'Display output for all tests, not just those which fail.',
		},
	},

	beforeAll({ options: { liveOutput } }) {
		installOutputInterceptors(liveOutput);
	},

	afterBlock({
		options: { liveOutput, allOutput },
		printLn,
		outcome,
		getBlockScoped,
	}) {
		if (liveOutput) {
			return; // output has already been written live; avoid duplicating it
		}
		// TODO: include beforeAll/beforeEach output if test fails
		if (
			allOutput ||
			outcome.result === 'fail' ||
			outcome.result === 'error' ||
			outcome.result === 'timeout'
		) {
			const scopedOutput = getBlockScoped(OUTPUT);
			const globalOutput = plugin.getGlobal(OUTPUT);
			const combinedOutput = [...scopedOutput, ...globalOutput].sort(
				(a, b) => a.time - b.time,
			);
			globalOutput.length = 0;
			for (const { time, type, line } of getLines(combinedOutput)) {
				printLn(
					[
						format.faint(new Date(time).toISOString()),
						format.fgBlue(type).padEnd(6, ' '),
						format.fgCyan(unquotedString(line)),
					].join(' '),
				);
			}
		}
	},
});
