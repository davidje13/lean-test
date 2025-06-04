import { format } from '../output/format.mts';
import type { RunResultType } from '../structure.mts';
import { printFragment } from './print.mts';
import type { Reporter, ReporterEvent } from './Reporter.mts';

export class Dots implements Reporter {
	private _count = 0;
	private readonly _blockSep = 10;
	private readonly _lineLimit = 50;

	eventListener(event: ReporterEvent) {
		if (event.type === 'complete' && event.block.type === 'test') {
			//if (!event.parent) {
			//	// whole test run complete
			//	printLine('', true);
			//	return;
			//}
			//const { summary } = event;
			//if (event.isBlock || event.isBoring) {
			//	if (summary.count || (!summary.error && !summary.fail)) {
			//		// do not care about block-level events unless they failed without running any children
			//		return;
			//	}
			//}
			printFragment(MARKERS.get(event.outcome.result)!, true);
			++this._count;
			if (this._count % this._lineLimit === 0) {
				printFragment('\n', true);
			} else if (this._count % this._blockSep === 0) {
				printFragment(' ', true);
			}
		}
	}
}

const MARKERS = new Map<RunResultType, string>([
	['pass', format.fgGreen('*')],
	['fail', format.bgRed(format.fgWhite('X'))],
	['error', format.bgRed(format.fgWhite('!'))],
	['skip', format.fgYellow('-')],
	['todo', format.fgBlue('-')],
	['timeout', format.bgRed(format.fgWhite('!'))],
	['dangling', format.bgRed(format.fgWhite('!'))],
]);
