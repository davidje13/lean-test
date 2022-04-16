import ExitHook from '../core/ExitHook.mjs';

export default class AbstractRunner {
	async prepare(sharedState) {
	}

	async teardown(sharedState) {
	}

	async invoke(listener, sharedState) {
	}

	async run(listener = null, sharedState = {}) {
		const fin = new ExitHook(() => this.teardown(sharedState));
		return fin.ifExitDuringOrFinally(async () => {
			await this.prepare(sharedState);
			return this.invoke(listener, sharedState);
		});
	}
}
