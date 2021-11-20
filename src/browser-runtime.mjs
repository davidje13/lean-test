import { standardRunner } from './lean-test.mjs';

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

const eventDispatcher = new Aggregator((events) => fetch('/', {
	method: 'POST',
	body: JSON.stringify({ events }),
}));

export default async function run(config, suites) {
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

	document.body.innerText = 'Test run complete.';
	eventDispatcher.invoke({ type: 'browser-end', result });
	await eventDispatcher.wait();
	window.close();
}
