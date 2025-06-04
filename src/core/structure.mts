import type { MaybePromise } from '../utils/types.mts';
import { TestError } from './errors/TestError.mts';
import { format } from './output/format.mts';
import { stringifyError, unquotedString } from './output/stringify.mts';
import { GLOBAL_PLUGIN_MANAGER } from './plugins/plugin.mts';
import { defaultLocalReporters } from './reporters/defaultReporters.mts';
import { exit1, printLine } from './reporters/print.mts';

export type NodeOptions = Record<string, any>;

export type RunResultType =
	| 'pass'
	| 'skip'
	| 'fail'
	| 'error'
	| 'todo'
	| 'timeout'
	| 'dangling';

export interface RunResult {
	result: RunResultType;
	err?: unknown;
	duration: number;
}

export interface RunCallbacks {
	begin(path: string[]): {
		complete(outcome: RunResult): void;
	};
	reportOverall(outcome: RunResult): void;
	printLn(line: string): void;
}

export interface StructureNode {
	readonly path: string[];
	readonly discover?: () => MaybePromise<void>;
	readonly split?: () => StructureNode[];
	readonly run?: (callbacks: RunCallbacks) => MaybePromise<void>;
	readonly runnable?: boolean;
	readonly options: NodeOptions;
}

interface WrappedStructureNode {
	parent: WrappedStructureNode | null;
	node: StructureNode;
	children: WrappedStructureNode[];
	hasError: boolean;
	error?: unknown;
}

class Structure {
	readonly root: WrappedStructureNode = {
		parent: null,
		node: { path: [], options: {} },
		children: [],
		hasError: false,
	};
	private readonly _toResolveQueue: WrappedStructureNode[] = [];
	private _callback: (structure: Structure) => MaybePromise<void> = basicRunner;
	private _discovering = true;
	private _current = this.root;
	private _readyNonce = {};

	constructor() {
		// TODO: this does not support top-level await when executed directly
		// (the importComplete callback means we can support this from inside a runner)
		// It _might_ be possible to support top-level await when executed directly with something like:
		// async () => { try { await import(<the current test script>) } catch {} waitCheckReady(); }
		this._waitCheckReady();
	}

	setStructureReadyCallback(
		fn: (structure: Structure) => MaybePromise<void>,
	): () => void {
		if (!this._discovering || this._callback !== basicRunner) {
			throw new TypeError('setStructureReadyCallback: already set');
		}
		this._callback = fn;
		this._readyNonce = {};
		let importCompleteCalled = false;
		return () => {
			if (importCompleteCalled) {
				throw new Error('importComplete has already been called');
			}
			importCompleteCalled = true;
			this._waitCheckReady();
		};
	}

	addNode<T extends StructureNode>(factory: (parent: StructureNode) => T): T {
		if (!this._discovering) {
			throw new TestError(
				'cannot register tests after tests have started running (note: top-level await is not supported when running test files directly)',
				this.addNode,
			);
		}
		const node = factory(this._current.node);
		const o: WrappedStructureNode = {
			parent: this._current,
			node,
			children: [],
			hasError: false,
		};
		this._current.children.push(o);
		this._toResolveQueue.push(o);
		return node;
	}

	private _waitCheckReady() {
		const nonce = {};
		this._readyNonce = nonce;
		Promise.resolve().then(() => {
			if (this._readyNonce === nonce) {
				this._doNext();
			}
		});
	}

	private async _doNext() {
		const next = this._toResolveQueue.shift();
		if (!next) {
			this._doFinal();
			return;
		}
		if (next.node?.discover) {
			const selfNode = this._current;
			this._current = next;
			try {
				await next.node.discover();
			} catch (err: unknown) {
				next.hasError = true;
				next.error = err;
			}
			this._current = selfNode;
		}
		this._waitCheckReady();
	}

	public visit(fn: (node: StructureNode) => void) {
		const recur = (wrapper: WrappedStructureNode) => {
			if (wrapper.hasError) {
				return;
			}
			fn(wrapper.node);
			wrapper.children.forEach(recur);
		};
		recur(this.root);
	}

	public allErrors(): Map<StructureNode, unknown> {
		const result = new Map<StructureNode, unknown>();
		const recur = (wrapper: WrappedStructureNode) => {
			if (wrapper.hasError) {
				result.set(wrapper.node, wrapper.error);
			} else {
				wrapper.children.forEach(recur);
			}
		};
		recur(this.root);
		return result;
	}

	private _doFinal() {
		this._discovering = false;
		const recur = (wrapper: WrappedStructureNode) => {
			if (wrapper.hasError) {
				return;
			}
			const sub = wrapper.node.split?.();
			if (sub) {
				wrapper.children.push(
					...sub.map(
						(node): WrappedStructureNode => ({
							parent: wrapper,
							node,
							children: [],
							hasError: false,
							error: undefined,
						}),
					),
				);
			}
			wrapper.children.forEach(recur);
		};
		recur(this.root);
		this._callback(this);
	}
}

const globalStructure = new Structure();

export const addNode = globalStructure.addNode.bind(globalStructure);
export const setStructureReadyCallback =
	globalStructure.setStructureReadyCallback.bind(globalStructure);

function makePathString(path: string[]): string {
	return path.map((v) => unquotedString(v)).join(format.faint(' \u203A '));
}

const reporters = defaultLocalReporters;

/**
 * basicRunner is used if a test file is executed directly (outside a test runner)
 */
async function basicRunner(structure: Structure) {
	const setupErrors = structure.allErrors();
	if (setupErrors.size > 0) {
		for (const [node, err] of setupErrors) {
			printLine(
				`Setup error in ${makePathString(node.path)}: ${stringifyError(err)}`,
			);
		}
		exit1('Test setup failed');
	}

	await GLOBAL_PLUGIN_MANAGER._beforeAll(printLine);

	const everything: StructureNode[] = [];
	// TODO: seed / random ordering (except `sequential` blocks)
	structure.visit((node) => {
		if (!node.options['skip'] && node.run && node.runnable !== false) {
			everything.push(node);
		}
	});
	// TODO: implicitly focus tests which come earlier than focused tests in `sequential` blocks
	let focus = everything.filter((node) => node.options['focus']);
	if (focus.length === 0) {
		focus = everything;
	}

	// TODO: parallel running (except in `sequential` blocks) - ideally with a max concurrency setting

	let fullCount = 0;
	const results = new Map<RunResultType, number>();
	const dangling = new Set<{ path: string[] }>();
	const tm0 = Date.now();
	for (const node of focus) {
		for (const reporter of reporters) {
			reporter.eventListener?.({
				type: 'begin',
				block: { type: 'test', path: node.path },
			});
		}
		++fullCount;
		let didPrint = false;
		await node.run?.({
			begin: (path) => {
				const me = { path };
				for (const reporter of reporters) {
					reporter.eventListener?.({
						type: 'begin',
						block: { type: 'test-attempt', path },
					});
				}
				dangling.add(me);
				return {
					complete: (outcome) => {
						dangling.delete(me);

						for (const reporter of reporters) {
							reporter.eventListener?.({
								type: 'complete',
								block: { type: 'test-attempt', path },
								outcome,
							});
						}
					},
				};
			},
			reportOverall(outcome) {
				for (const reporter of reporters) {
					reporter.eventListener?.({
						type: 'complete',
						block: { type: 'test', path: node.path },
						outcome,
					});
				}
				results.set(outcome.result, (results.get(outcome.result) ?? 0) + 1);
			},
			printLn(ln) {
				printLine(ln);
				didPrint = true;
			},
		});
		if (didPrint) {
			printLine('');
		}
	}
	const tm1 = Date.now();
	results.set('dangling', dangling.size);
	await GLOBAL_PLUGIN_MANAGER._afterAll(printLine);
	for (const reporter of reporters) {
		reporter.report?.({
			summary: {
				count: fullCount,
				dangling: results.get('dangling') ?? 0,
				duration: tm1 - tm0,
				error: results.get('error') ?? 0,
				fail: results.get('fail') ?? 0,
				pass: results.get('pass') ?? 0,
				skip: results.get('skip') ?? 0,
				timeout: results.get('timeout') ?? 0,
				todo: results.get('todo') ?? 0,
			},
			dangling,
		});
	}
	if ((results.get('fail') ?? 0) > 0 || (results.get('error') ?? 0) > 0) {
		exit1(format.fgRed('Test run failed'));
	}
}
