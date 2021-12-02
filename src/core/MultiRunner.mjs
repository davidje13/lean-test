import Result from './Result.mjs';

export default class MultiRunner {
	constructor() {
		this.runners = [];
	}

	add(label, runner) {
		this.runners.push({ label, runner });
	}

	run(listener) {
		if (this.runners.length === 0) {
			throw new Error('No sub-runners registered');
		}
		if (this.runners.length === 1) {
			return this.runners[0].runner(listener);
		}
		return Result.of(null, async (baseResult) => Promise.all(this.runners.map(async ({ label, runner }) => {
			const convert = (o) => ((o.parent === null) ? { ...o, parent: baseResult.id, label } : o);
			try {
				const subResult = await runner((event) => listener?.(convert(event)));
				baseResult.children?.push(new StaticResult(convert(subResult)));
			} catch (e) {
				baseResult.createChild(label, () => { throw e; });
			}
		})), { isBlock: true, listener });
	}
}

class StaticResult {
	constructor(built) {
		this.build = () => built;
		this.getCurrentSummary = () => built.summary;
	}
}
