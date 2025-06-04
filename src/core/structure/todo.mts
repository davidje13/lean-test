import {
	addNode,
	type NodeOptions,
	type RunCallbacks,
	type StructureNode,
} from '../structure.mts';

class ToDoNode implements StructureNode {
	readonly path: string[];
	readonly options: NodeOptions = {};

	constructor(path: string[]) {
		this.path = path;
	}

	run({ begin }: RunCallbacks) {
		const callback = begin(this.path);
		callback.complete({ result: 'todo', duration: 0 });
	}
}

/**
 * Placeholder for a test which has not yet been written.
 * These will be reported at the end of the test run.
 */
export function todo(name: string) {
	addNode((parent) => new ToDoNode([...parent.path, name]));
}
