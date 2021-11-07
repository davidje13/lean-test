const shebangs = new Map();
const script = () => ({
	// this is a reduced version of https://github.com/developit/rollup-plugin-preserve-shebang
	transform: (code, moduleId) => code.replace(/^#![^\n]+\n/, (m) => {
		shebangs.set(moduleId, m);
		return '';
	}),
	renderChunk: (code, chunk) => (shebangs.get(chunk.facadeModuleId) || '') + code,
});
const renameExternal = (from, to) => ({
	options: (inputOptions) => ({ ...inputOptions, external: [...inputOptions.external, to] }),
	resolveId: (id) => (id === from ? to : null),
});

export default [
	{
		input: 'src/index.mjs',
		external: ['assert/strict'], // TODO: remove (used by matchers.core.equals; not browser-compatible)
		output: [
			{
				file: 'build/lean-test.mjs',
				format: 'es',
				name: 'lean-test',
			},
		],
	},
	{
		input: 'src/bin/run.mjs',
		external: [
			'process',
			'path',
			'fs/promises',
		],
		output: [
			{
				file: 'build/bin/run.mjs',
				format: 'es',
			},
		],
		plugins: [
			script(),
			renameExternal('../index.mjs', '../lean-test.mjs'),
		],
	},
];
