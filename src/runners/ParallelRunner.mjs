import AbstractRunner from './AbstractRunner.mjs';
import Result from '../core/Result.mjs';

export default class ParallelRunner extends AbstractRunner {
	constructor() {
		super();
		this.runners = [];
	}

	add(label, runner) {
		this.runners.push({ label, runner });
	}

	prepare(sharedState) {
		return Promise.all(this.runners.map(({ runner }) => runner.prepare(sharedState)));
	}

	teardown(sharedState) {
		return Promise.all(this.runners.map(({ runner }) => runner.teardown(sharedState)));
	}

	invoke(listener, sharedState) {
		if (this.runners.length === 0) {
			throw new Error('No sub-runners registered');
		}
		if (this.runners.length === 1) {
			return this.runners[0].runner.invoke(listener, sharedState);
		}
		return Result.of(null, async (baseResult) => {
			const subResults = await Promise.all(this.runners.map(async ({ label, runner }) => {
				const convert = (o) => ((o.parent === null) ? { ...o, parent: baseResult.id, label } : o);
				const subListener = listener ? ((event) => listener(convert(event))) : null;
				const subResult = await runner.invoke(subListener, sharedState)
					.catch((e) => Result.of(null, () => { throw e; }, { isBlock: true }));
				return new StaticResult(convert(subResult));
			}));
			baseResult.children.push(...subResults);
		}, { isBlock: true, listener });
	}
}

class StaticResult {
	constructor(built) {
		this.build = () => built;
		this.getCurrentSummary = () => built.summary;
	}
}
