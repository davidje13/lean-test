const shebangs = new Map();
const script = () => ({
	// this is a reduced version of https://github.com/developit/rollup-plugin-preserve-shebang
	transform: (code, moduleId) => code.replace(/^#![^\n]+\n/, (m) => {
		shebangs.set(moduleId, m);
		return '';
	}),
	renderChunk: (code, chunk) => (shebangs.get(chunk.facadeModuleId) || '') + code,
});

export default [
	{
		input: 'src/lean-test.mjs',
		output: {
			file: 'build/lean-test.mjs',
			format: 'es',
			name: 'lean-test',
		},
	},
	{
		input: 'src/browser-runtime.mjs',
		external: ['./lean-test.mjs'],
		output: {
			file: 'build/browser-runtime.mjs',
			format: 'es',
		},
	},
	{
		input: 'src/bin/run.mjs',
		external: [
			'process',
			'path',
			'fs/promises',
			'child_process',
			'http',
			'../lean-test.mjs',
		],
		output: {
			file: 'build/bin/run.mjs',
			format: 'es',
		},
		plugins: [script()],
	},
];
