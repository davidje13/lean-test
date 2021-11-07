import Output from './Output.mjs';

export default class TextReporter {
	constructor(writer) {
		this.output = new Output(writer);
	}

	_print(node, indent) {
		const results = node.getResults();
		const duration = node.getDuration();
		const display = (node.config.display !== false);
		let result = '';
		if (results.error) {
			result = this.output.red('[ERRO]');
		} else if (results.fail) {
			result = this.output.red('[FAIL]');
		} else if (results.run || results.pend) {
			result = this.output.blue('[....]');
		} else if (results.pass) {
			result = this.output.green('[PASS]');
		} else if (results.skip) {
			result = this.output.yellow('[SKIP]');
		} else {
			result = this.output.yellow('[NONE]');
		}
		const resultSpace = '      ';

		if (display) {
			this.output.write(
				`${node.config.display}: ${node.options.name} [${duration}ms]`,
				`${result} ${indent}`,
				`${resultSpace} ${indent}`,
			);
		}
		node.result.errors.forEach((err) => {
			this.output.write(
				this.output.red(String(err)),
				`${resultSpace} ${indent}  `,
			);
		});
		node.result.failures.forEach((message) => {
			this.output.write(
				this.output.red(message),
				`${resultSpace} ${indent}  `,
			);
		});
		const nextIndent = indent + (display ? '  ' : '');
		node.sub.forEach((subNode) => this._print(subNode, nextIndent));
	}

	report(ctx) {
		const finalResult = ctx.baseNode.getResults();
		const duration = ctx.baseNode.getDuration();

		this._print(ctx.baseNode, '');

		if (!finalResult.count) {
			this.output.write(this.output.yellow('NO TESTS FOUND'));
			process.exit(1);
		}

		this.output.write('');
		this.output.write(`Total:    ${finalResult.count || 0}`);
		this.output.write(`Pass:     ${finalResult.pass || 0}`);
		this.output.write(`Errors:   ${finalResult.error || 0}`);
		this.output.write(`Failures: ${finalResult.fail || 0}`);
		this.output.write(`Skipped:  ${finalResult.skip || 0}`);
		this.output.write(`Duration: ${duration}ms`);
		this.output.write('');

		// TODO: warn or error if any node contains 0 tests

		if (finalResult.error) {
			this.output.write(this.output.red('ERROR'));
			process.exit(1);
		} else if (finalResult.fail) {
			this.output.write(this.output.red('FAIL'));
			process.exit(1);
		} else if (finalResult.pass) {
			this.output.write(this.output.green('PASS'));
		} else {
			this.output.write(this.output.yellow('NO TESTS RUN'));
			process.exit(1);
		}
	}
}
