import Output from './Output.mjs';

export default class TextReporter {
	constructor(writer) {
		this.output = new Output(writer);
	}

	_print(result, indent) {
		const results = result.getDescendantSummary();
		const duration = result.getDuration();
		const display = (result.node.config.display !== false);
		let marker = '';
		if (results.error) {
			marker = this.output.red('[ERRO]');
		} else if (results.fail) {
			marker = this.output.red('[FAIL]');
		} else if (results.run || results.pend) {
			marker = this.output.blue('[....]');
		} else if (results.pass) {
			marker = this.output.green('[PASS]');
		} else if (results.skip) {
			marker = this.output.yellow('[SKIP]');
		} else {
			marker = this.output.yellow('[NONE]');
		}
		const resultSpace = '      ';

		if (display) {
			this.output.write(
				`${result.node.config.display}: ${result.node.options.name} [${duration}ms]`,
				`${marker} ${indent}`,
				`${resultSpace} ${indent}`,
			);
		}
		result.errors.forEach((err) => {
			this.output.write(
				this.output.red(String(err)),
				`${resultSpace} ${indent}  `,
			);
		});
		result.failures.forEach((message) => {
			this.output.write(
				this.output.red(message),
				`${resultSpace} ${indent}  `,
			);
		});
		const nextIndent = indent + (display ? '  ' : '');
		result.children.forEach((child) => this._print(child, nextIndent));
	}

	report(result) {
		const summary = result.getDescendantSummary();
		const duration = result.getDuration();

		this._print(result, '');

		if (!summary.count) {
			this.output.write(this.output.yellow('NO TESTS FOUND'));
			process.exit(1);
		}

		this.output.write('');
		this.output.write(`Total:    ${summary.count || 0}`);
		this.output.write(`Pass:     ${summary.pass || 0}`);
		this.output.write(`Errors:   ${summary.error || 0}`);
		this.output.write(`Failures: ${summary.fail || 0}`);
		this.output.write(`Skipped:  ${summary.skip || 0}`);
		this.output.write(`Duration: ${duration}ms`);
		this.output.write('');

		// TODO: warn or error if any node contains 0 tests

		if (summary.error) {
			this.output.write(this.output.red('ERROR'));
			process.exit(1);
		} else if (summary.fail) {
			this.output.write(this.output.red('FAIL'));
			process.exit(1);
		} else if (summary.pass) {
			this.output.write(this.output.green('PASS'));
		} else {
			this.output.write(this.output.yellow('NO TESTS RUN'));
			process.exit(1);
		}
	}
}
