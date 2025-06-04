import { format } from '../output/format.mts';
import { stringifyError, unquotedString } from '../output/stringify.mts';
import type { RunResultType } from '../structure.mts';
import { canUseEscapes, printCommand, printLine } from './print.mts';
import type { Reporter, ReporterEvent, TestRunResult } from './Reporter.mts';

export class Live implements Reporter {
	eventListener(event: ReporterEvent) {
		if (event.block.type !== 'test-attempt') {
			return;
		}
		if (event.type === 'begin') {
			if (canUseEscapes()) {
				printLine(MARKER_RUNNING + ' ' + makePathString(event.block.path));
			}
		}
		if (event.type === 'complete') {
			if (canUseEscapes()) {
				printCommand('\x1B[A');
			}
			printLine(
				format.bold(MARKERS.get(event.outcome.result)!) +
					' ' +
					makePathString(event.block.path) +
					' ' +
					format.fgPurple(`[${event.outcome.duration.toFixed(0)}ms]`),
			);
			if (
				event.outcome.result === 'error' ||
				event.outcome.result === 'fail' ||
				event.outcome.result === 'timeout'
			) {
				const message = stringifyError(event.outcome.err);
				printLine('');
				let anyOutput = false;
				//for (const line of event.otherOutput) { // TODO
				//	printLine(line);
				//	anyOutput = true;
				//}
				if (anyOutput) {
					printLine('');
				}
				printLine(
					message
						.trim()
						.split('\n')
						.map((ln) => '  ' + ln)
						.join('\n'),
				);
				printLine('');
			}
		}
	}

	report(result: TestRunResult): void {
		for (const { path } of result.dangling) {
			printLine(
				format.bold(MARKERS.get('dangling')!) + ' ' + makePathString(path),
			);
		}
	}
}

function makePathString(path: string[]): string {
	return path.map((v) => unquotedString(v)).join(format.faint(' \u203A '));
}

const MARKERS = new Map<RunResultType, string>([
	['pass', format.bgGreen(format.fgBlack(' PASS '))],
	['fail', format.bgRed(format.fgWhite(' FAIL '))],
	['error', format.bgRed(format.fgYellow(' ERR! '))],
	['skip', format.bgYellow(format.fgBlack(' SKIP '))],
	['todo', format.bgBlue(format.fgWhite(' TODO '))],
	['timeout', format.bgRed(format.fgYellow('CANCEL'))],
	['dangling', format.bgRed(format.fgYellow(' ???? '))],
]);
const MARKER_RUNNING = format.bgLightGrey(format.fgBlack(' .... '));
