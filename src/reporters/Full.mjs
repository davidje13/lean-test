export default class Full {
	constructor(output) {
		this.output = output;
	}

	_printerr(prefix, err, indent) {
		this.output.write(
			this.output.red(prefix + this.output.bold(err.message)) +
			this.output.red(err.stackList.map((s) => `\n at ${s.location}`).join('')),
			indent,
		);
	}

	_print(result, indent) {
		const { summary } = result;
		let marker = '';
		if (summary.error) {
			marker = this.output.redBack(' ERRO ', '[ERRO]');
		} else if (summary.fail) {
			marker = this.output.redBack(' FAIL ', '[FAIL]');
		} else if (summary.run) {
			marker = this.output.blueBack(' .... ', '[....]');
		} else if (summary.pass) {
			marker = this.output.greenBack(' PASS ', '[PASS]');
		} else if (summary.skip) {
			marker = this.output.yellowBack(' SKIP ', '[SKIP]');
		} else {
			marker = this.output.yellowBack(' NONE ', '[NONE]');
		}
		const resultSpace = '      ';

		const isBlock = (result.children.length > 0 || !summary.count);
		const isSlow = (summary.duration > 500);

		const display = (result.label !== null);
		const formattedLabel = isBlock ? this.output.bold(this.output.cyan(result.label)) : result.label;

		const duration = `[${summary.duration}ms]`;
		const formattedDuration = isSlow ? this.output.yellow(duration) : this.output.faint(duration);

		if (display) {
			this.output.write(
				`${formattedLabel} ${formattedDuration}`,
				`${marker} ${indent}`,
				`${resultSpace} ${indent}`,
			);
		}
		const infoIndent = `${resultSpace} ${indent}  `;
		if (result.output && (summary.error || summary.fail)) {
			this.output.write(this.output.blue(result.output), infoIndent);
		}
		result.errors.forEach((err) => this._printerr('Error: ', err, infoIndent));
		result.failures.forEach((err) => this._printerr('Failure: ', err, infoIndent));
		const nextIndent = indent + (display ? '  ' : '');
		result.children.forEach((child) => this._print(child, nextIndent));
	}

	report(result) {
		this._print(result, '');

		if (!result.summary.count) {
			this.output.write(this.output.yellow('NO TESTS FOUND'));
		}

		this.output.write('');
	}
}
