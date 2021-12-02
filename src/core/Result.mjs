import ResultStage from './ResultStage.mjs';

let idNamespace = '';
let nextID = 0;

export function setIdNamespace(namespace) {
	idNamespace = namespace + '-';
}

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
		this.id = `${idNamespace}${++nextID}`;
		this.label = label;
		this.parent = parent;
		this.children = [];
		this.stages = [];
		this.output = '';
		this.forcedChildSummary = null;
		this.cancelled = Boolean(parent?.cancelled);
		parent?.children?.push(this);
		this.buildCache = null;
	}

	createChild(label, fn) {
		return Result.of(label, fn, { parent: this });
	}

	addOutput(detail) {
		this.output += detail;
	}

	cancel(error) {
		this.cancelled = true;
		this.stages[0].stage._cancel(error || new Error('cancelled')); // mark 'core' stage with error
		this.stages.forEach(({ config, stage }) => {
			if (!config.noCancel) {
				stage._complete(); // halt other stages without error
			}
		});
	}

	createStage(config, label, fn, { errorStackSkipFrames = 0 } = {}) {
		return ResultStage.of(label, (stage) => {
			this.stages.push({ config, stage });
			if (this.cancelled && !config.noCancel) {
				stage._complete();
			} else {
				return fn();
			}
		}, { errorStackSkipFrames: errorStackSkipFrames + 1 });
	}

	attachStage(config, stage) {
		this.stages.push({ config, stage });
	}

	overrideChildSummary(s) {
		this.forcedChildSummary = s;
	}

	getCurrentSummary() {
		if (this.buildCache) {
			return this.buildCache.summary;
		}

		const stagesSummary = this.stages
			.map(({ config, stage }) => filterSummary(config, stage.getSummary()))
			.reduce(combineSummary, {});

		if (stagesSummary.error || stagesSummary.fail || stagesSummary.skip) {
			stagesSummary.pass = 0;
		}

		const childSummary = (
			this.forcedChildSummary ||
			this.children.map((child) => child.getCurrentSummary()).reduce(combineSummary, {})
		);

		return combineSummary(
			stagesSummary,
			filterSummary({ tangible: true, time: false }, childSummary),
		);
	}

	hasFailed() {
		const summary = this.getCurrentSummary();
		return Boolean(summary.error || summary.fail);
	}

	get info() {
		return {
			id: this.id,
			parent: this.parent?.id ?? null,
			label: this.label,
		};
	}

	build() {
		if (this.buildCache) {
			return this.buildCache;
		}

		const errors = [];
		const failures = [];
		this.stages.forEach(({ stage }) => errors.push(...stage.errors));
		this.stages.forEach(({ stage }) => failures.push(...stage.failures));
		const children = this.children.map((child) => child.build());
		const summary = this.getCurrentSummary();
		this.buildCache = {
			...this.info,
			summary,
			errors: errors.map(buildError),
			failures: failures.map(buildError),
			output: this.output,
			children,
		};
		Object.freeze(this.stages);
		Object.freeze(this.children);
		Object.freeze(this);
		return this.buildCache;
	}
}

Result.of = async (label, fn, { parent = null, isBlock = false, listener = null } = {}) => {
	const result = new Result(label, parent);
	await result.createStage({ fail: true, time: true }, 'core', () => {
		listener?.({
			type: 'begin',
			time: Date.now(),
			isBlock: Boolean(isBlock),
			...result.info,
		});
		return fn(result);
	});
	const builtResult = result.build();
	listener?.({
		type: 'complete',
		time: Date.now(),
		isBlock: Boolean(isBlock),
		...builtResult,
	});
	return builtResult;
};

function buildError(err) {
	return {
		message: err.message,
		stackList: err.getStackParts(),
	};
}

function combineSummary(a, b) {
	const r = { ...a };
	Object.keys(b).forEach((k) => {
		r[k] = (r[k] || 0) + (b[k] || 0);
	});
	return r;
}
