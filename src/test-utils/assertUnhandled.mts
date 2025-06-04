import { getErrorMessage } from '../utils/error.mts';
import type { MaybePromise } from '../utils/types.mts';

export async function assertUnhandled(
	fn: () => MaybePromise<void>,
	timeout: number,
) {
	return new Promise<string>(async (resolve, reject) => {
		const ac = new AbortController();
		const tm = setTimeout(() => {
			ac.abort();
			reject('timeout');
		}, timeout);

		const listener = (err: unknown) => {
			ac.abort();
			clearTimeout(tm);
			resolve(getErrorMessage(err));
		};

		if (typeof window !== 'undefined') {
			window.addEventListener('error', (e) => listener(e.error), {
				once: true,
				signal: ac.signal,
			});
			window.addEventListener('unhandledrejection', (e) => listener(e.reason), {
				once: true,
				signal: ac.signal,
			});
		} else if (globalThis.process) {
			globalThis.process.once('unhandledRejection', listener);
			globalThis.process.once('uncaughtException', listener);
			ac.signal.addEventListener('abort', () => {
				globalThis.process.off('unhandledRejection', listener);
				globalThis.process.off('uncaughtException', listener);
			});
		} else {
			reject('environment does not support unhandledrejection listener');
			return;
		}
		try {
			await fn();
		} catch (err: unknown) {
			reject(err);
		}
	});
}
