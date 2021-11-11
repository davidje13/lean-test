import ResultStage from './ResultStage.mjs';

const filterSummary = ({ tangible, time, fail }, summary) => ({
	count: tangible ? summary.count : 0,
	run: tangible ? summary.run : 0,
	error: (tangible || fail) ? summary.error : 0,
	fail: (tangible || fail) ? summary.fail : 0,
	skip: tangible ? summary.skip : 0,
	pass: tangible ? summary.pass : 0,
	duration: time ? summary.duration : 0,
});

export default class Result {
	constructor(label, parent) {
		this.label = label;
		this.parent = parent;
		this.children = [];
		this.stages = [];
		this.forcedChildSummary = null;
		parent?.children?.push(this);
	}

	createChild(label, fn) {
		return Result.of(label, fn, { parent: this });
	}

	async createStage(config, label, fn) {
		const stage = await ResultStage.of(label, fn, this);
		this.stages.push({ config, stage });
		return stage;
	}

	attachStage(config, stage) {
		this.stages.push({ config, stage });
	}

	overrideChildSummary(s) {
		this.forcedChildSummary = s;
	}

	getErrors() {
		const all = [];
		this.stages.forEach(({ stage }) => all.push(...stage.errors));
		return all;
	}

	getFailures() {
		const all = [];
		this.stages.forEach(({ stage }) => all.push(...stage.failures));
		return all;
	}

	getSummary() {
		const stagesSummary = this.stages
			.map(({ config, stage }) => filterSummary(config, stage.getSummary()))
			.reduce(combineSummary, {});

		if (stagesSummary.error || stagesSummary.fail || stagesSummary.skip) {
			stagesSummary.pass = 0;
		}

		const childSummary = this.forcedChildSummary || this.children
			.map((child) => child.getSummary())
			.reduce(combineSummary, {});

		return combineSummary(
			stagesSummary,
			filterSummary({ tangible: true, time: false }, childSummary),
		);
	}

	hasFailed() {
		const summary = this.getSummary();
		return Boolean(summary.error || summary.fail);
	}
}

Result.of = async (label, fn, { parent = null } = {}) => {
	const result = new Result(label, parent);
	await result.createStage({ fail: true, time: true }, 'core', fn);
	Object.freeze(result);
	return result;
};

function combineSummary(a, b) {
	const r = { ...a };
	Object.keys(b).forEach((k) => {
		r[k] = (r[k] || 0) + (b[k] || 0);
	});
	return r;
}
