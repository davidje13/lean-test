import type { MaybePromise } from '../../utils/types.mts';
import {
	addNode,
	type NodeOptions,
	type StructureNode,
} from '../structure.mts';
import { it, TestConfig, type TestBlock } from './it.mts';

export type DescribeBlock = () => MaybePromise<void>;

type DescribeObject = {
	[P in string]: TestBlock<void> | DescribeObject;
};

export class DescribeConfig {
	private readonly _target: NodeOptions;

	constructor(target: NodeOptions) {
		this._target = target;
	}

	skip(): this {
		this._target['skip'] = true;
		return this;
	}

	focus(): this {
		this._target['focus'] = true;
		return this;
	}

	sequential({ continueAfterFailure = false } = {}): this {
		this._target['sequential'] = true;
		this._target['stopOnFirstFail'] = !continueAfterFailure;
		return this;
	}

	eachTest(): Omit<TestConfig<void>, 'withParameters' | 'focus' | 'skip'> {
		return new TestConfig(this._target);
	}
}

class DescribeNode implements StructureNode {
	readonly path: string[];
	readonly discover: () => MaybePromise<void>;
	readonly options: NodeOptions;

	constructor(path: string[], block: DescribeBlock, options: NodeOptions) {
		this.path = path;
		this.discover = block;
		this.options = options;
	}
}

type DescribeArgs = [name: string, block: DescribeBlock | DescribeObject];

const focus = (...args: DescribeArgs) => describe(...args).focus();
const skip = (...args: DescribeArgs) => describe(...args).skip();

export const describe = Object.assign(
	/**
	 * Create a grouping of tests.
	 * Lifecycle hooks defined within the block will apply to all tests within the block.
	 * Results will be reported hierarchally.
	 */
	function (
		name: string,
		block: DescribeBlock | DescribeObject,
	): DescribeConfig {
		const node = addNode(
			(parent) =>
				new DescribeNode([...parent.path, name], toFuncBlock(block), {
					...parent.options,
				}),
		);
		return new DescribeConfig(node.options);
	},
	{ focus, only: focus, skip, ignore: skip },
);

/** Shorthand for `describe(...).focus()` */
export const fdescribe = describe.focus;

/** Shorthand for `describe(...).skip()` */
export const xdescribe = describe.skip;

const seqFocus = (...args: DescribeArgs) => sequence(...args).focus();
const seqSkip = (...args: DescribeArgs) => sequence(...args).skip();

export const sequence = Object.assign(
	/** Shorthand for `describe(...).sequential({ continueAfterFailure: false })` */
	(...args: DescribeArgs) =>
		describe(...args).sequential({ continueAfterFailure: false }),
	{ focus: seqFocus, only: seqFocus, skip: seqSkip, ignore: seqSkip },
);

/** Shorthand for `describe(...).sequential().focus()` */
export const fsequence = sequence.focus;

/** Shorthand for `describe(...).sequential().skip()` */
export const xsequence = sequence.skip;

function toFuncBlock(block: DescribeBlock | DescribeObject): DescribeBlock {
	if (typeof block === 'function') {
		return block;
	}
	return () => {
		for (const [name, sub] of Object.entries(block)) {
			if (typeof sub === 'function') {
				it(name, sub);
			} else {
				describe(name, sub);
			}
		}
	};
}
