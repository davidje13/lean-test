import type { CapturedOutput } from './interceptors.mts';

const ENCODER_UTF8 = new TextEncoder();
const DECODER_UTF8 = new TextDecoder('utf-8');

export function combineOutput(
	parts: CapturedOutput[],
	binary: boolean,
): string | Uint8Array {
	if (binary) {
		let fullSize = 0;
		const chunks = parts.map(({ data }) => {
			if (typeof data === 'string') {
				data = ENCODER_UTF8.encode(data);
			}
			fullSize += data.length;
			return data;
		});
		const result = new Uint8Array(fullSize);
		let pos = 0;
		for (const chunk of chunks) {
			result.set(chunk, pos);
			pos += chunk.length;
		}
		return result;
	} else {
		return parts
			.map(({ data }) =>
				typeof data === 'string' ? data : DECODER_UTF8.decode(data),
			)
			.join('');
	}
}

export function* getLines(
	parts: CapturedOutput[],
): Generator<{ time: number; type: string; line: string }> {
	let currentType: string | null = null;
	let currentTime = 0;
	const currentLine: string[] = [];
	for (const { time, type, data } of parts) {
		if (type !== currentType) {
			if (currentType) {
				yield {
					time: currentTime,
					type: currentType,
					line: currentLine.join(''),
				};
			}
			currentLine.length = 0;
			currentType = type;
		}
		currentTime = time;
		const all = typeof data === 'string' ? data : DECODER_UTF8.decode(data);
		const subLines = all.split('\n');
		currentLine.push(subLines[0]!);
		if (subLines.length > 1) {
			yield { time, type, line: currentLine.join('') };
			currentLine.length = 0;
			for (let i = 1; i < subLines.length - 1; ++i) {
				yield { time, type, line: subLines[i]! };
			}
			if (subLines[subLines.length - 1] === '') {
				currentType = '';
			} else {
				currentLine.push(subLines[subLines.length - 1]!);
			}
		}
	}
}
