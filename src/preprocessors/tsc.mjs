import { access, readFile, stat } from 'fs/promises';
import { constants } from 'fs';
import { dirname, resolve } from 'path';
import { cwd } from 'process';
import { dynamicImport } from './utils.mjs';

export default async () => {
	const { default: ts } = await dynamicImport('typescript', 'tsc preprocessor');
	const baseDir = cwd();

	const compilerOptions = readCompilerOptions(ts, baseDir);
	const host = ts.createCompilerHost(compilerOptions);
	const cache = ts.createModuleResolutionCache(baseDir, host.getCanonicalFileName, compilerOptions);

	const resolver = (path, from) => ts.resolveModuleName(path, from, compilerOptions, host, cache).resolvedModule?.resolvedFileName;

	return {
		async resolve(path, from) {
			const fullPath = resolve(dirname(from), path);
			try {
				await access(fullPath, constants.R_OK);
				const stats = await stat(fullPath);
				if (stats.isFile()) {
					return fullPath;
				}
			} catch (_) {
			}
			return resolver(path, from);
		},
		async load(fullPath) {
			const subCompilerOptions = readCompilerOptions(ts, dirname(fullPath));
			const source = await readFile(fullPath, 'utf-8');
			const result = ts.transpileModule(source, {
				fileName: fullPath,
				compilerOptions: {
					...subCompilerOptions,
					noEmit: false,
					sourceMap: false,
					inlineSourceMap: true,
					module: 'es2015',
				},
			});
			if (result.diagnostics?.length) {
				throw new Error(JSON.stringify(result.diagnostics));
			}
			return {
				path: fullPath.replace(/(.*)\.[cm]?[tj]sx?/i, '\\1.js'),
				content: result.outputText,
			};
		},
	};
}

function readCompilerOptions(ts, path) {
	const configPath = ts.findConfigFile(path, ts.sys.fileExists, 'tsconfig.json');
	if (!configPath) {
		return {};
	}
	// return ts.getParsedCommandLineOfConfigFile(configPath, undefined, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => null })?.options ?? {};
	const config = ts.readConfigFile(configPath, ts.sys.readFile);
	return ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath))?.options ?? {};
}
