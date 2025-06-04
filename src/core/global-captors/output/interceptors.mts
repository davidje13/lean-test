import { stringifyPlain } from '../../output/stringify.mts';
import { plugin } from '../../plugins/plugin.mts';

export interface CapturedOutput {
	time: number;
	type: string;
	data: Uint8Array | string;
}

export const OUTPUT = (): CapturedOutput[] => [];

let installed = false;

export function installOutputInterceptors(liveOutput: boolean) {
	if (installed) {
		return;
	}
	installed = true;

	if (globalThis.process) {
		overrideMethod(
			globalThis.process.stdout,
			'write',
			interceptWrite,
			'stdout',
			liveOutput,
		);
		overrideMethod(
			globalThis.process.stderr,
			'write',
			interceptWrite,
			'stderr',
			liveOutput,
		);
	} else {
		(['log', 'trace', 'debug', 'info', 'warn', 'error'] as const).forEach(
			(name) => {
				overrideMethod(console, name, interceptConsole, name);
			},
		);
	}
}

function overrideMethod<T, K extends keyof T, BoundArgs extends any[]>(
	object: T,
	method: K,
	replacement: T[K] extends (...params: infer Args) => infer Ret
		? (this: T, original: T[K], ...args: [...BoundArgs, ...Args]) => Ret
		: never,
	...bindArgs: BoundArgs
) {
	const original = (object[method] as any).bind(object) as T[K];
	(object as any)[method] = Object.assign(
		replacement.bind(object, original, ...bindArgs),
		{ original },
	);
}

function interceptWrite(
	this: NodeJS.WriteStream,
	original: NodeJS.WriteStream['write'],
	type: string,
	liveOutput: boolean,
	...args: Parameters<NodeJS.WriteStream['write']>
) {
	const time = Date.now();
	const output = plugin.getBlockScopedOrGlobal(OUTPUT);
	const [data, v1, v2] = args;
	let callback: ((error?: Error | null) => void) | undefined = undefined;
	let encoding: BufferEncoding | undefined = undefined;
	if (typeof v1 === 'function') {
		callback = v1;
	} else {
		callback = v2;
		encoding = v1;
	}
	if (typeof data === 'string') {
		if (!encoding || encoding === 'utf-8' || encoding === 'utf8') {
			output.push({ time, type, data });
		} else {
			output.push({ time, type, data: globalThis.Buffer.from(data, encoding) });
		}
	} else {
		output.push({ time, type, data });
	}
	if (liveOutput) {
		return original.call(this, ...args);
	} else {
		callback?.();
		return true;
	}
}

function interceptConsole(
	this: Console,
	original: Console['log'],
	type: string,
	liveOutput: boolean,
	...args: Parameters<Console['log']>
): void {
	const time = Date.now();
	plugin
		.getBlockScopedOrGlobal(OUTPUT)
		.push({ time, type, data: args.map(printConsoleArg).join(' ') + '\n' });
	if (liveOutput) {
		original.call(this, ...args);
	}
}

function printConsoleArg(arg: unknown): string {
	if (typeof arg === 'string') {
		return arg;
	}
	return stringifyPlain(arg, { escape: false });
}
