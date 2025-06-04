import { format } from '../output/format.mts';
import { printLine } from './print.mts';
import type { Reporter } from './Reporter.mts';

export class ErrorList implements Reporter {
	_printerr(prefix, err, indent) {
		printLine(
			format.fgRed(prefix + format.bold(err.message)) +
				format.fgRed(err.stackList.map((s) => `\n at ${s.location}`).join('')),
			indent,
		);
	}

	_formatPath(path) {
		const v = path
			.filter((result) => result.label !== null)
			.map((result) => {
				const isBlock = result.children.length > 0 || !result.summary.count;
				return isBlock
					? format.bold(format.fgCyan(result.label))
					: result.label;
			})
			.join(' - ');

		return v.length > 0 ? v : format.bold(format.fgCyan('root'));
	}

	report(result) {
		const { empty, fail, error } = collect(result, []);

		for (const { path } of empty) {
			printLine(this._formatPath(path));
			printLine(format.bold(format.fgYellow('  No Tests')));
			printLine('');
		}

		for (const { path, failures, output } of fail) {
			printLine(this._formatPath(path));
			if (output) {
				printLine(format.fgBlue(output), '  ');
			}
			failures.forEach((err) => this._printerr('Failure: ', err, '  '));
			printLine('');
		}

		for (const { path, errors, output } of error) {
			printLine(this._formatPath(path));
			if (output) {
				printLine(format.fgBlue(output), '  ');
			}
			errors.forEach((err) => this._printerr('Error: ', err, '  '));
			printLine('');
		}
	}
}

function collect(result, parentPath) {
	const path = [...parentPath, result];

	const found = { empty: [], fail: [], error: [] };
	for (const subResult of result.children) {
		const subFound = collect(subResult, path);
		found.empty.push(...subFound.empty);
		found.fail.push(...subFound.fail);
		found.error.push(...subFound.error);
	}

	const { summary } = result;
	if (
		!summary.run &&
		!summary.error &&
		!summary.fail &&
		!summary.pass &&
		!summary.skip
	) {
		found.empty.push({ path });
	}
	if (summary.fail) {
		if (!found.fail.length) {
			found.fail.push({
				path,
				failures: result.failures,
				output: result.output,
			});
		}
	} else {
		found.fail.length = 0; // ignore errors if the higher-level node succeeded (e.g. retry)
	}
	if (summary.error) {
		if (!found.error.length) {
			found.error.push({ path, errors: result.errors, output: result.output });
		}
	} else {
		found.error.length = 0; // ignore errors if the higher-level node succeeded (e.g. retry)
	}
	return found;
}
