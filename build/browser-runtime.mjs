import { ExternalRunner, standardRunner, orderers } from './lean-test.mjs';

class Aggregator {
	constructor(next) {
		this.queue = [];
		this.timer = null;
		this.next = next;
		this.emptyCallback = null;
		this.invoke = this.invoke.bind(this);
		this.sendNow = this.sendNow.bind(this);
		this.sending = false;
	}

	invoke(value) {
		this.queue.push(value);
		if (this.timer === null && !this.sending) {
			this.timer = setTimeout(this.sendNow, 0);
		}
	}

	wait() {
		if (!this.timer && !this.sending) {
			return Promise.resolve();
		}
		return new Promise((resolve) => {
			this.emptyCallback = resolve;
			if (!this.sending) {
				this.sendNow();
			}
		});
	}

	async sendNow(unbatched) {
		clearTimeout(this.timer);
		this.timer = null;
		if (!this.queue.length) {
			return;
		}
		this.sending = true;
		try {
			while (this.queue.length) {
				const current = this.queue.splice(0, unbatched ? this.queue.length : 200);
				await this.next(current);
			}
		} catch (e) {
			console.error('error during throttled call', e);
			await this.next([{ type: 'runner-error', message: `communication error in throttled call: ${e}` }]);
		} finally {
			this.sending = false;
		}
		if (this.timer !== null) {
			return;
		}
		if (this.queue.length) {
			this.timer = setTimeout(this.sendNow, 0);
		} else {
			const fn = this.emptyCallback;
			this.emptyCallback = null;
			fn?.();
		}
	}
}

async function run(id, config, suites) {
	window.title = `Lean Test Runner (${id}) - running`;
	const compress = ExternalRunner.compressor();
	const eventDispatcher = new Aggregator((events) => fetch('/', {
		method: 'POST',
		body: JSON.stringify({ id, events: events.map(compress) }),
		// cannot use keepalive on all requests as it imposes a low limit on size of POSTed data
	}));
	eventDispatcher.invoke({ type: 'runner-connect' });

	if (config.importMap && HTMLScriptElement.supports && !HTMLScriptElement.supports('importmap')) {
		eventDispatcher.invoke({
			type: 'runner-unsupported',
			message: 'Browser does not support import map',
		});
		await eventDispatcher.wait();
		return;
	}

	const ping = setInterval(() => eventDispatcher.invoke({ type: 'runner-ping' }), 500);

	const unload = () => {
		eventDispatcher.sendNow(true);
		fetch('/', {
			method: 'POST',
			body: JSON.stringify({
				id,
				events: [
					{ type: 'runner-disconnect', message: 'page closed (did a test change window.location?)' },
				],
			}),
			keepalive: true, // allow sending in background even after page unloads
		});
	};

	window.addEventListener('beforeunload', unload, { once: true });

	try {
		const builder = standardRunner()
			.useParallelDiscovery(false)
			.useParallelSuites(config.parallelSuites);

		if (config.orderingRandomSeed) {
			builder.useExecutionOrderer(new orderers.SeededRandom(config.orderingRandomSeed));
		}

		suites.forEach(({ path, relative }) => {
			builder.addSuite(relative, async (globals) => {
				Object.assign(window, globals);
				const result = await import(path);
				return result.default;
			});
		});

		const runner = await builder.build();
		const result = await runner.run(eventDispatcher.invoke);

		window.title = `Lean Test Runner (${id}) - complete`;
		document.body.innerText = 'Test run complete.';
		eventDispatcher.invoke({ type: 'runner-end', result });
	} catch (e) {
		window.title = `Lean Test Runner (${id}) - error`;
		console.error(e);
		eventDispatcher.invoke({ type: 'runner-error', message: String(e) });
	} finally {
		clearInterval(ping);
		window.removeEventListener('beforeunload', unload);
		await eventDispatcher.wait();
	}
}

export { run as default };
