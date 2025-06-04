import { stripFormatting } from '../output/format.mts';

const realConsoleLog = console.log;
const nodeProcess: NodeJS.Process | undefined = globalThis.process;
let forceColour: boolean | null = null; // TODO
let forceTTY: boolean | null = null; // TODO

interface Abstraction {
	write: NodeJS.WritableStream['write'] | undefined;
	isTTY: boolean;
	needsNewline: boolean;
}

const stdoutAbstraction: Abstraction = {
	write: nodeProcess?.stdout.write.bind(nodeProcess.stdout),
	isTTY: nodeProcess?.stdout.isTTY ?? false,
	needsNewline: false,
};

const stderrAbstraction: Abstraction = {
	write: nodeProcess?.stderr.write.bind(nodeProcess.stderr),
	isTTY: nodeProcess?.stderr.isTTY ?? false,
	needsNewline: false,
};

export function canUseEscapes(stderr: boolean = false) {
	const abstraction = stderr ? stderrAbstraction : stdoutAbstraction;
	return forceTTY ?? abstraction.isTTY;
}

const lineBuffer: string[] = [];
export function printFragment(fragment: string, stderr: boolean = false) {
	const abstraction = stderr ? stderrAbstraction : stdoutAbstraction;
	if (!abstraction.write) {
		const lines = stripFormatting(fragment, true).split('\n');
		lineBuffer.push(lines[0]!);
		if (lines.length > 1) {
			realConsoleLog(lineBuffer.join(''));
			lineBuffer.length = 0;
			for (let i = 1; i < lines.length - 1; ++i) {
				realConsoleLog(lines[i]!);
			}
			const lastLine = lines[lines.length - 1];
			if (lastLine) {
				lineBuffer.push(lastLine);
			}
		}
	} else {
		if (forceColour ?? forceTTY ?? abstraction.isTTY) {
			abstraction.write(fragment);
		} else {
			abstraction.write(stripFormatting(fragment, true));
		}
		abstraction.needsNewline = !fragment.endsWith('\n');
	}
}

export function printCommand(command: string, stderr: boolean = false) {
	const abstraction = stderr ? stderrAbstraction : stdoutAbstraction;
	if (abstraction.write && (forceTTY ?? abstraction.isTTY)) {
		abstraction.write(command);
	}
}

export function printLine(line: string, stderr: boolean = false) {
	const abstraction = stderr ? stderrAbstraction : stdoutAbstraction;
	if (!abstraction.write) {
		if (lineBuffer.length > 0) {
			realConsoleLog(lineBuffer.join(''));
			lineBuffer.length = 0;
		}
		realConsoleLog(stripFormatting(line, true));
	} else {
		if (abstraction.needsNewline) {
			abstraction.write('\n');
			abstraction.needsNewline = false;
		}
		if (forceColour ?? forceTTY ?? abstraction.isTTY) {
			abstraction.write(line);
		} else {
			abstraction.write(stripFormatting(line, true));
		}
		abstraction.write('\n');
	}
}

export function exit1(message: string): never {
	if (nodeProcess) {
		printLine(message);
		nodeProcess.exit(1);
	}
	throw new Error(message);
}
