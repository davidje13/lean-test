// Based on https://github.com/simonhaenisch/prettier-plugin-organize-imports
// (cut-down without Vue / Babel support)
import { dirname } from 'node:path';
import { parsers as tsParsers } from 'prettier/plugins/typescript.mjs';
import ts from 'typescript';

const cache = new Map();

function getTypeScriptLanguageServiceHost(path, code) {
	if (!cache.has(path)) {
		const tsconfig = ts.findConfigFile(path, ts.sys.fileExists);
		const compilerOptions = tsconfig
			? ts.parseJsonConfigFileContent(
					ts.readConfigFile(tsconfig, ts.sys.readFile).config,
					ts.sys,
					dirname(tsconfig),
				).options
			: ts.getDefaultCompilerOptions();
		cache.set(path, { tsconfig, compilerOptions });
	}
	const { tsconfig, compilerOptions } = cache.get(path);

	return {
		directoryExists: ts.sys.directoryExists,
		fileExists: ts.sys.fileExists,
		getDefaultLibFileName: ts.getDefaultLibFileName,
		getDirectories: ts.sys.getDirectories,
		readDirectory: ts.sys.readDirectory,
		readFile: ts.sys.readFile,
		getCurrentDirectory: () =>
			tsconfig ? dirname(tsconfig) : ts.sys.getCurrentDirectory(),
		getCompilationSettings: () => compilerOptions,
		getNewLine: () => ts.sys.newLine,
		getScriptFileNames: () => [path],
		getScriptVersion: () => '0',
		getScriptSnapshot: (filePath) =>
			filePath === path ? ts.ScriptSnapshot.fromString(code) : undefined,
	};
}

function doOrganiseImports(
	code,
	{ originalText, rangeStart, rangeEnd, filepath = 'file.ts' },
) {
	if (originalText || rangeStart !== 0 || rangeEnd < code.length) {
		return code; // do not operate on fragments of code
	}

	const langService = ts.createLanguageService(
		getTypeScriptLanguageServiceHost(filepath, code),
	);
	const fileChanges = langService.organizeImports(
		{
			type: 'file',
			fileName: filepath,
			skipDestructiveCodeActions: false,
		},
		{},
		{},
	);

	if (fileChanges.length > 0) {
		for (const change of fileChanges[0].textChanges.reverse()) {
			code =
				code.slice(0, change.span.start) +
				change.newText +
				code.slice(change.span.start + change.span.length);
		}
	}

	return code;
}

function wrap(parser) {
	const originalPreprocess = parser.preprocess ?? ((code) => code);
	return {
		...parser,
		preprocess(code, options) {
			return doOrganiseImports(originalPreprocess(code, options), options);
		},
	};
}

export default { parsers: { typescript: wrap(tsParsers.typescript) } };
