const makeFormat = (begin: string, end: string) => (message: string) =>
	begin + message + end;

function readPalette(rgb: number | [number, number, number]) {
	if (Array.isArray(rgb)) {
		return 16 + rgb[0] * 36 + rgb[1] * 6 + rgb[2];
	}
	return rgb;
}

const col = (
	base: number,
	b4: number,
	b8?: number | [number, number, number],
) =>
	makeFormat(
		`\x1B[${base + b4}m` + (b8 ? `\x1B[${base + 8};5;${readPalette(b8)}m` : ''),
		`\x1B[${base + 9}m`,
	);

const fgCol = col.bind(null, 30);
const bgCol = col.bind(null, 40);

export const format = {
	bold: makeFormat('\x1B[1m', '\x1B[22m'),
	faint: makeFormat('\x1B[2m', '\x1B[22m'),
	underline: makeFormat('\x1B[4m', '\x1B[24m'),
	dblUnderline: makeFormat('\x1B[4;21m', '\x1B[24m'),
	invert: makeFormat('\x1B[7m', '\x1B[27m'),
	conceal: makeFormat('\x1B[8m', '\x1B[28m'),

	fgBlack: fgCol(0, [0, 0, 0]),
	fgDarkGrey: fgCol(60, 243),
	fgLightGrey: fgCol(7, 251),
	fgWhite: fgCol(67, [5, 5, 5]),

	fgRed: fgCol(1, [5, 1, 1]),
	fgOrange: fgCol(3, [5, 2, 0]),
	fgYellow: fgCol(3, [5, 4, 1]),
	fgGreen: fgCol(2, [2, 5, 1]),
	fgCyan: fgCol(6, [0, 4, 4]),
	fgBlue: fgCol(4, [0, 1, 5]),
	fgPurple: fgCol(5, [4, 1, 5]),

	fgPureRed: fgCol(61, [5, 0, 0]),
	fgPureYellow: fgCol(63, [5, 5, 0]),
	fgPureGreen: fgCol(62, [0, 5, 0]),
	fgPureCyan: fgCol(66, [0, 5, 5]),
	fgPureBlue: fgCol(64, [0, 0, 5]),
	fgPurePurple: fgCol(65, [5, 0, 5]),

	bgBlack: bgCol(0, [0, 0, 0]),
	bgDarkGrey: bgCol(60, 243),
	bgLightGrey: bgCol(7, 251),
	bgWhite: bgCol(67, [5, 5, 5]),

	bgRed: bgCol(1, [4, 0, 0]),
	bgOrange: bgCol(3, [5, 2, 0]),
	bgYellow: bgCol(3, [5, 4, 0]),
	bgGreen: bgCol(2, [0, 4, 1]),
	bgCyan: bgCol(6, [0, 4, 5]),
	bgBlue: bgCol(4, [0, 1, 5]),
	bgPurple: bgCol(5, [4, 1, 5]),

	bgPureRed: bgCol(61, [5, 0, 0]),
	bgPureYellow: bgCol(63, [5, 5, 0]),
	bgPureGreen: bgCol(62, [0, 5, 0]),
	bgPureCyan: bgCol(66, [0, 5, 5]),
	bgPureBlue: bgCol(64, [0, 0, 5]),
	bgPurePurple: bgCol(65, [5, 0, 5]),
} satisfies Record<string, (message: string) => string>;

export function stripFormatting(message: string, applyTextReplacement = false) {
	if (applyTextReplacement) {
		message = message
			.replaceAll(/\x1B\[1m(.*?)\x1B\[22m/g, '**$1**')
			.replaceAll(/\x1B\[4(?:;21)?m(.*?)\x1B\[24m/g, '_$1_')
			.replaceAll(/\x1B\[7m(.*?)\x1B\[27m/g, '<<$1>>')
			.replaceAll(/\x1B\[8m(.*?)\x1B\[28m/g, (_, v) => ' '.repeat(v.length));
	}
	return message.replaceAll(/\x1B\[[\d;:]+m/g, '');
}
