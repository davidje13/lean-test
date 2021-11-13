import { extractStackList } from '../utils.mjs';

const SCOPE_MATCH = /__STACK_SCOPE_([^ ]*?)_([0-9]+)/;

export class StackScope {
	constructor(namespace) {
		this.namespace = namespace;
		this.scopes = new Map();
		this.index = 0;
	}

	async run(scope, fn) {
		const id = String(++this.index);
		this.scopes.set(id, scope);
		const name = `__STACK_SCOPE_${this.namespace}_${id}`;
		const o = { [name]: async () => await fn() };
		try {
			return await o[name]();
		} finally {
			this.scopes.delete(id);
		}
	}

	get() {
		const list = extractStackList(new Error(), true);
		for (const frame of list) {
			const match = frame.match(SCOPE_MATCH);
			if (match && match[1] === this.namespace) {
				return this.scopes.get(match[2]);
			}
		}
		return null;
	}
}
