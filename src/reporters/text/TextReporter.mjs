import Output from './Output.mjs';

export default class TextReporter {
	constructor(writer, forceTTY = null) {
		this.output = new Output(writer, forceTTY);
	}

	_printerr(prefix, err, indent) {
		this.output.write(
			this.output.red(prefix + this.output.bold(err.message)) +
			this.output.red(err.getStackParts().map((s) => `\n at ${s.location}`).join('')),
			indent,
		);
	}

	_print(result, indent) {
		const summary = result.getSummary();
		const display = (result.label !== null);
		let marker = '';
		if (summary.error) {
			marker = this.output.red('[ERRO]');
		} else if (summary.fail) {
			marker = this.output.red('[FAIL]');
		} else if (summary.run) {
			marker = this.output.blue('[....]');
		} else if (summary.pass) {
			marker = this.output.green('[PASS]');
		} else if (summary.skip) {
			marker = this.output.yellow('[SKIP]');
		} else {
			marker = this.output.yellow('[NONE]');
		}
		const resultSpace = '      ';

		if (display) {
			this.output.write(
				`${result.label} [${summary.duration}ms]`,
				`${marker} ${indent}`,
				`${resultSpace} ${indent}`,
			);
		}
		const infoIndent = `${resultSpace} ${indent}  `;
		let output = result.getOutput();
		if (output && (summary.error || summary.fail)) {
			this.output.write(this.output.blue(output), infoIndent);
		}
		result.getErrors().forEach((err) => {
			this._printerr('Error: ', err, infoIndent);
		});
		result.getFailures().forEach((err) => {
			this._printerr('Failure: ', err, infoIndent);
		});
		const nextIndent = indent + (display ? '  ' : '');
		result.children.forEach((child) => this._print(child, nextIndent));
	}

	report(result) {
		const summary = result.getSummary();

		this._print(result, '');

		if (!summary.count) {
			this.output.write(this.output.yellow('NO TESTS FOUND'));
			return;
		}

		this.output.write('');
		this.output.write(`Total:    ${summary.count || 0}`);
		this.output.write(`Pass:     ${summary.pass || 0}`);
		this.output.write(`Errors:   ${summary.error || 0}`);
		this.output.write(`Failures: ${summary.fail || 0}`);
		this.output.write(`Skipped:  ${summary.skip || 0}`);
		this.output.write(`Duration: ${summary.duration}ms`);
		this.output.write('');

		// TODO: warn or error if any node contains 0 tests

		if (summary.error) {
			this.output.write(this.output.red('ERROR'));
		} else if (summary.fail) {
			this.output.write(this.output.red('FAIL'));
		} else if (summary.pass) {
			this.output.write(this.output.green('PASS'));
		} else {
			this.output.write(this.output.yellow('NO TESTS RUN'));
		}
	}
}
