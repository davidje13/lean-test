import InnerError from './InnerError.mjs';

const SCOPE_MATCH = /(async\s.*?)?__STACK_SCOPE_([^ ]*?)_([0-9]+)/;

export default class StackScope {
	constructor(namespace) {
		this.namespace = namespace;
		this.scopes = new Map();
		this.index = 0;
	}

	async run(scope, fn, ...args) {
		const id = String(++this.index);
		if (scope) {
			this.scopes.set(id, scope);
		}
		const name = `__STACK_SCOPE_${this.namespace}_${id}`;
		const o = {
			[name]: async () => {
				try {
					await fn(...args);
				} finally {
					this.scopes.delete(id);
				}
			},
		};
		return o[name]();
	}

	get() {
		const list = extractStackList(new Error());
		for (const frame of list) {
			const match = frame.match(SCOPE_MATCH);
			if (match && match[2] === this.namespace) {
				return this.scopes.get(match[3]);
			}
		}
		return null;
	}

	getInnerError(error, skipFrames = 0) {
		const fullStackList = extractStackList(error);
		const stackList = fullStackList.slice();

		// truncate to beginning of scope (and remove requested skipFrames if match is found)
		for (let i = 0; i < stackList.length; ++i) {
			const match = stackList[i].match(SCOPE_MATCH);
			if (match && match[2] === this.namespace) {
				if (match[1]) {
					// async, so next frame is likely user-relevant (do not apply skipFrames)
					stackList.length = i;
				} else {
					stackList.length = Math.max(0, i - skipFrames);
				}
				break;
			}
		}

		// remove frames from head of trace if requested by error
		if (error.skipFrames) {
			stackList.splice(0, error.skipFrames);
		}

		return new InnerError(error, fullStackList, stackList);
	}
}

let supported = null;

StackScope.isSupported = async () => {
	if (supported === null) {
		const scope = new StackScope('FEATURE_TEST');
		const o = Symbol();
		await scope.run(o, async () => {
			if (scope.get() !== o) {
				supported = false;
				return;
			}
			await Promise.resolve();
			if (scope.get() !== o) {
				supported = false;
				return;
			}
			try {
				// Node 18.? broke stack traces across dynamic imports, so we must explicitly check for that:
				const me = import.meta.url;
				if (!me.startsWith('file:///')) {
					supported = false; // unable to check
					return;
				}
				const mod = await import(`data:text/javascript,
					import { _internal_StackScope as StackScope } from ${JSON.stringify(me)};
					export const inner = new StackScope('FEATURE_TEST').get();
				`);
				supported = (mod.inner === o);
			} catch (ignore) {
				supported = false;
			}
		});
	}
	return supported;
};

function extractStackList(error) {
	if (error instanceof InnerError) {
		return error.fullStackList;
	}
	if (!error || typeof error !== 'object' || typeof error.stack !== 'string') {
		return [];
	}
	const messageLines = error.message.split('\n');
	const list = error.stack.split('\n');
	for (let i = 0; i < messageLines.length; ++i) {
		list.shift();
	}
	return list;
}
