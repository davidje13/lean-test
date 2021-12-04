import { setIdNamespace, standardRunner } from './lean-test.mjs';

class Aggregator {
	constructor(next) {
		this.queue = [];
		this.timer = null;
		this.next = next;
		this.emptyCallback = null;
		this.invoke = this.invoke.bind(this);
		this._invoke = this._invoke.bind(this);
	}

	invoke(value) {
		this.queue.push(value);
		if (this.timer === null) {
			this.timer = setTimeout(this._invoke, 0);
		}
	}

	wait() {
		if (!this.timer) {
			return Promise.resolve();
		}
		return new Promise((resolve) => {
			this.emptyCallback = resolve;
		});
	}

	async _invoke() {
		const current = this.queue.slice();
		this.queue.length = 0;
		try {
			await this.next(current);
		} catch (e) {
			console.error('error during throttled call', e);
		}
		if (this.queue.length) {
			this.timer = setTimeout(this._invoke, 0);
		} else {
			this.timer = null;
			this.emptyCallback?.();
		}
	}
}

async function run(id, config, suites) {
	window.title = `Lean Test Runner (${id}) - running`;
	const eventDispatcher = new Aggregator((events) => fetch('/', {
		method: 'POST',
		body: JSON.stringify({ id, events }),
	}));
	eventDispatcher.invoke({ type: 'browser-connect' });
	const ping = setInterval(() => eventDispatcher.invoke({ type: 'browser-ping' }), 500);

	try {
		setIdNamespace(id);

		const builder = standardRunner()
			.useParallelDiscovery(false)
			.useParallelSuites(config.parallelSuites);

		suites.forEach(([name, path]) => {
			builder.addSuite(name, async (globals) => {
				Object.assign(window, globals);
				const result = await import(path);
				return result.default;
			});
		});

		const runner = await builder.build();
		const result = await runner.run(eventDispatcher.invoke);

		window.title = `Lean Test Runner (${id}) - complete`;
		document.body.innerText = 'Test run complete.';
		eventDispatcher.invoke({ type: 'browser-end', result });
	} catch (e) {
		window.title = `Lean Test Runner (${id}) - error`;
		console.error(e);
		eventDispatcher.invoke({ type: 'browser-error', error: String(error) });
	} finally {
		clearInterval(ping);
	}
	await eventDispatcher.wait();
}

export { run as default };
