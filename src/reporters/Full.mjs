export default class Full {
	constructor(output, { hideBoring = true } = {}) {
		this.output = output;
		this.hideBoring = hideBoring;
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
		const marker = col(` ${markerStr} `, `[${markerStr}]`);
		const subMarker = ' '.repeat(markerStr.length + 2);

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
				`${subMarker} ${indent}`,
			);
		}
		const infoIndent = `${subMarker} ${indent}  `;
		if (result.output && (summary.error || summary.fail)) {
			this.output.write(this.output.blue(result.output), infoIndent);
		}
		result.errors.forEach((err) => this._printerr('Error: ', err, infoIndent));
		result.failures.forEach((err) => this._printerr('Failure: ', err, infoIndent));
		const nextIndent = indent + (display ? '  ' : '');
		let printedChildCount = 0;
		for (const child of result.children) {
			if (this._print(child, nextIndent)) {
				++printedChildCount;
			}
		}
		if (display && printedChildCount < result.children.length) {
			this.output.write(
				`(${result.children.length - printedChildCount} omitted results)`,
				`${subMarker} ${nextIndent}`,
			);
		}
		return true;
	}

	report(result) {
		this._print(result, '');

		if (!result.summary.count) {
			this.output.write(this.output.yellow('NO TESTS FOUND'));
		}

		this.output.write('');
	}
}
