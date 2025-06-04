export const sleep = (delay: number, signal?: AbortSignal) => {
	return new Promise<void>((resolve, reject) => {
		if (signal?.aborted) {
			reject(new Error('aborted'));
			return;
		}
		const cancel = () => {
			clearTimeout(tm);
			reject(new Error('aborted'));
		};
		signal?.addEventListener('abort', cancel);

		const tm = setTimeout(() => {
			signal?.removeEventListener('abort', cancel);
			resolve();
		}, delay);
	});
};
