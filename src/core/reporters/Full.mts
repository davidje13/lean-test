import { format } from '../output/format.mts';
import type { RunResultType } from '../structure.mts';
import { printLine } from './print.mts';
import type { Reporter, TestRunResult } from './Reporter.mts';

export class Full implements Reporter {
	constructor({ hideBoring = true } = {}) {
		this.hideBoring = hideBoring;
	}

	_printerr(prefix: string, err: Error, indent: string) {
		printLine(
			format.fgRed(prefix + format.bold(err.message)) +
				format.fgRed(err.stackList.map((s) => `\n at ${s.location}`).join('')),
			indent,
		);
	}

	_print(result: TestRunResult, indent: string) {
		const { summary } = result;
		if (this.hideBoring && result.isBoring && !summary.error && !summary.fail) {
			return false;
		}
		let col = null;
		let markerStr = '';
		if (summary.error) {
			col = this.output.redBack;
			markerStr = 'ERRO';
		} else if (summary.fail) {
			col = this.output.redBack;
			markerStr = 'FAIL';
		} else if (summary.run) {
			col = this.output.blueBack;
			markerStr = '....';
		} else if (summary.pass) {
			col = this.output.greenBack;
			markerStr = 'PASS';
		} else if (summary.skip) {
			col = this.output.yellowBack;
			markerStr = 'SKIP';
		} else {
			col = this.output.yellowBack;
			markerStr = 'NONE';
		}
		const marker = MARKERS.get(type);
		const subMarker = ' '.repeat(8);

		const isBlock = result.children.length > 0 || !summary.count;
		const isSlow = summary.duration > 500;

		const display = result.label !== null;
		const formattedLabel = isBlock
			? format.bold(format.fgCyan(result.label))
			: result.label;

		const duration = `[${summary.duration}ms]`;
		const formattedDuration = isSlow
			? format.fgYellow(duration)
			: format.faint(duration);

		if (display) {
			printLine(
				`${formattedLabel} ${formattedDuration}`,
				`${marker} ${indent}`,
				`${subMarker} ${indent}`,
			);
		}
		const infoIndent = `${subMarker} ${indent}  `;
		if (result.output && (summary.error || summary.fail)) {
			printLine(this.output.blue(result.output), infoIndent);
		}
		result.errors.forEach((err) => this._printerr('Error: ', err, infoIndent));
		result.failures.forEach((err) =>
			this._printerr('Failure: ', err, infoIndent),
		);
		const nextIndent = indent + (display ? '  ' : '');
		let printedChildCount = 0;
		for (const child of result.children) {
			if (this._print(child, nextIndent)) {
				++printedChildCount;
			}
		}
		if (display && printedChildCount < result.children.length) {
			printLine(
				`(${result.children.length - printedChildCount} omitted results)`,
				`${subMarker} ${nextIndent}`,
			);
		}
		return true;
	}

	report(result: TestRunResult) {
		this._print(result, '');

		if (!result.summary.count) {
			printLine(format.fgYellow('NO TESTS FOUND'));
		}

		printLine('');
	}
}

const MARKERS = new Map<RunResultType, string>([
	['pass', format.bgGreen(format.fgBlack(format.bold(' PASS ')))],
	['fail', format.bgRed(format.fgWhite(format.bold(' FAIL ')))],
	['error', format.bgRed(format.fgYellow(format.bold(' ERR! ')))],
	['skip', format.bgYellow(format.fgBlack(format.bold(' SKIP ')))],
	['todo', format.bgBlue(format.fgWhite(format.bold(' TODO ')))],
	['timeout', format.bgRed(format.fgYellow(format.bold('CANCEL')))],
	['dangling', format.bgRed(format.fgYellow(format.bold(' ???? ')))],
]);
