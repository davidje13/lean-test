export default class ErrorList {
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

	_formatPath(path) {
		const v = path
			.filter((result) => result.label !== null)
			.map((result) => {
				const isBlock = (result.children.length > 0 || !result.summary.count);
				return isBlock ? this.output.bold(this.output.cyan(result.label)) : result.label;
			})
			.join(' - ');

		return v.length > 0 ? v : this.output.bold(this.output.cyan('root'));
	}

	report(result) {
		const { empty, fail, error } = collect(result, []);

		for (const { path } of empty) {
			this.output.write(this._formatPath(path));
			this.output.write(this.output.bold(this.output.yellow('  No Tests')));
			this.output.write('');
		}

		for (const { path, failures, output } of fail) {
			this.output.write(this._formatPath(path));
			if (output) {
				this.output.write(this.output.blue(output), '  ');
			}
			failures.forEach((err) => this._printerr('Failure: ', err, '  '));
			this.output.write('');
		}

		for (const { path, errors, output } of error) {
			this.output.write(this._formatPath(path));
			if (output) {
				this.output.write(this.output.blue(output), '  ');
			}
			errors.forEach((err) => this._printerr('Error: ', err, '  '));
			this.output.write('');
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
	if (!summary.run && !summary.error && !summary.fail && !summary.pass && !summary.skip) {
		found.empty.push({ path });
	}
	if (summary.fail) {
		if (!found.fail.length) {
			found.fail.push({ path, failures: result.failures, output: result.output });
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
