import { format } from '../output/format.mts';
import { printLine } from './print.mts';
import type { Reporter, TestRunResult } from './Reporter.mts';

export class Summary implements Reporter {
	report(result: TestRunResult) {
		const { summary } = result;

		printLine(`Total:    ${summary.count}`);
		printLine(`Pass:     ${summary.pass}`);
		printLine(`Errors:   ${summary.error + summary.dangling}`);
		printLine(`Timeout:  ${summary.timeout}`);
		printLine(`Failures: ${summary.fail}`);
		printLine(`Skipped:  ${summary.skip}`);
		if (summary.todo > 0) {
			printLine(`To Do:    ${summary.todo}`);
		}
		printLine(`Duration: ${summary.duration}ms`);
		printLine('');

		if (summary.error || summary.dangling) {
			printLine(format.fgRed('ERROR'));
		} else if (summary.timeout) {
			printLine(format.fgRed('TIMEOUT'));
		} else if (summary.fail) {
			printLine(format.fgRed('FAIL'));
		} else if (summary.todo) {
			printLine(format.fgBlue('PASS, some tests marked TODO'));
		} else if (summary.pass) {
			printLine(format.fgGreen('PASS'));
		} else {
			printLine(format.fgYellow('NO TESTS RUN'));
		}
	}
}
