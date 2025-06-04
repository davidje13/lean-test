import type { MaybePromise } from '../../utils/types.mts';
import { TimeoutError } from '../errors/TimeoutError.mts';

const SCOPE_MATCH = /__STACK_SCOPE_([a-zA-Z0-9]+)_(\d*)/;

interface StackScopeRunReturn {
	success: boolean;
	duration: number;
	error?: unknown;
}

export class StackScope<T> {
	private readonly namespace: string;
	private readonly forced: boolean;
	private readonly scopes = new Map<string, T>();
	private readonly queue: (() => void)[] = [];
	private index = 0;

	constructor(namespace: string, forced: boolean = false) {
		if (/[^a-zA-Z0-9]/.test(namespace)) {
			throw new TypeError('Invalid namespace: must be alphanumeric');
		}
		this.namespace = namespace;
		this.forced = forced;

		// enable long stack trace so that we can resolve which block we are in
		(Error as any).stackTraceLimit = 50;
	}

	async run<Args extends any[]>(
		{
			context,
			timeout,
			ac,
			args,
		}: { context: T; timeout: number; ac?: AbortController; args: Args },
		fn: (...args: Args) => MaybePromise<void>,
	): Promise<StackScopeRunReturn> {
		if (isSupported === null && !this.forced) {
			isSupported = await isSupportedPromise;
		}
		if (!ac) {
			ac = new AbortController();
		}

		const id = isSupported || this.forced ? String(++this.index) : '';
		const name = `__STACK_SCOPE_${this.namespace}_${id}`;
		const o = {
			[name]: async (): Promise<StackScopeRunReturn> => {
				let timer: ReturnType<typeof setTimeout> | null = null;
				const timerPromise = new Promise((_, reject) => {
					if (Number.isFinite(timeout)) {
						timer = setTimeout(() => {
							ac.abort();
							reject(new TimeoutError(timeout));
						}, timeout);
					}
				});
				this.scopes.set(id, context);
				const tm0 = Date.now();
				try {
					await Promise.race([fn(...args), timerPromise]);
					return { success: true, duration: Date.now() - tm0 };
				} catch (err: unknown) {
					return {
						success: false,
						duration: Date.now() - tm0,
						error: this.clipStack(err),
					};
				} finally {
					if (timer) {
						clearTimeout(timer);
					}
					this.scopes.delete(id);
				}
			},
		};

		if (isSupported || this.forced) {
			return o[name]!();
		}
		return new Promise<StackScopeRunReturn>((resolve, reject) => {
			const runner = () =>
				o[name]!()
					.then(resolve, reject)
					.finally(() => this.queue.shift()?.());
			if (this.scopes.size > 0) {
				this.queue.push(runner);
			} else {
				runner();
			}
		});
	}

	get(): T | undefined {
		if (this.scopes.size === 0) {
			return undefined;
		}
		if (!isSupported && !this.forced) {
			return this.scopes.values().next().value;
		}
		const list = new Error().stack?.split('\n') ?? [];
		for (const frame of list) {
			const match = frame.match(SCOPE_MATCH);
			if (match && match[1] === this.namespace) {
				return this.scopes.get(match[3]!);
			}
		}
		return undefined;
	}

	clipStack(err: unknown): unknown {
		if (!(err instanceof Error)) {
			return err;
		}
		if (err.cause) {
			err.cause = this.clipStack(err.cause);
		}
		if (err.stack) {
			const messageLines = err.message.split('\n');
			const stackList = err.stack.split('\n');
			for (let i = messageLines.length; i < stackList.length; ++i) {
				const match = stackList[i]!.match(SCOPE_MATCH);
				if (match && match[1] === this.namespace) {
					stackList.length = i;
					break;
				}
			}
			err.stack = stackList.join('\n');
		}

		return err;
	}
}

// avoid top-level await because we don't know if it will be available in the target environment
let isSupported: boolean | null = null;
const isSupportedPromise = checkSupported();

async function checkSupported(): Promise<boolean> {
	const scope = new StackScope('FEATURETEST', true);
	const o = Symbol();
	let supported = false;
	await scope.run({ context: o, timeout: 5000, args: [] }, async () => {
		if (scope.get() !== o) {
			return;
		}
		await Promise.resolve();
		if (scope.get() !== o) {
			return;
		}
		// Node 18.? broke stack traces across dynamic imports, so we must explicitly check for that:
		const me = import.meta.url;
		if (!me.startsWith('file:///')) {
			return; // unable to check
		}
		const mod = await import(`data:text/javascript,
				import { _internal_StackScope as StackScope } from ${JSON.stringify(me)};
				export const inner = new StackScope('FEATURETEST').get();
			`);
		supported = mod.inner === o;
	});
	return supported;
}
