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
		input: 'src/node-runtime.mjs',
		external: [
			'process',
			'fs',
			'./lean-test.mjs',
		],
		output: {
			file: 'build/node-runtime.mjs',
			format: 'es',
		},
	},
	{
		input: 'src/preprocessor.mjs',
		external: [
			'process',
			'path',
			'fs/promises',
			'typescript',
			'./lean-test.mjs',
		],
		output: {
			file: 'build/preprocessor.mjs',
			format: 'es',
		},
	},
	{
		input: 'src/bin/run.mjs',
		external: [
			'process',
			'path',
			'fs/promises',
			'fs',
			'os',
			'child_process',
			'http',
			'../preprocessor.mjs',
			'../lean-test.mjs',
			'../../lean-test.mjs', // duplicated because this must exactly match import lines in all files
		],
		output: {
			file: 'build/bin/run.mjs',
			format: 'es',
		},
		plugins: [script()],
	},
];
