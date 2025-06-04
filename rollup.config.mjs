import typescript from '@rollup/plugin-typescript';

const shebangs = new Map();
const script = () => ({
	// this is a reduced version of https://github.com/developit/rollup-plugin-preserve-shebang
	transform: (code, moduleId) =>
		code.replace(/^#![^\n]+\n/, (m) => {
			shebangs.set(moduleId, m);
			return '';
		}),
	renderChunk: (code, chunk) =>
		(shebangs.get(chunk.facadeModuleId) || '') + code,
});

const plugins = [typescript()];

export default [
	{
		input: 'src/lean-test.mjs',
		output: {
			file: 'build/lean-test.mjs',
			format: 'esm',
		},
		plugins,
	},
	{
		input: 'src/browser-runtime.mjs',
		external: ['./lean-test.mjs'],
		output: {
			file: 'build/browser-runtime.mjs',
			format: 'esm',
		},
		plugins,
	},
	{
		input: 'src/node-runtime.mjs',
		external: ['process', 'fs', './lean-test.mjs'],
		output: {
			file: 'build/node-runtime.mjs',
			format: 'esm',
		},
		plugins,
	},
	{
		input: 'src/preprocessor.mjs',
		external: [
			'process',
			'path',
			'fs',
			'fs/promises',
			'util',
			'./lean-test.mjs',
		],
		output: {
			file: 'build/preprocessor.mjs',
			format: 'esm',
		},
		plugins,
	},
	{
		input: 'src/bin/index.mjs',
		external: [
			'process',
			'path',
			'fs/promises',
			'fs',
			'os',
			'child_process',
			'http',
			/\/src\/(?!bin\/)/,
		],
		output: {
			file: 'build/bin/run.mjs',
			format: 'esm',
			paths: (p) => p.replace(/.+\/src\//, './'),
		},
		plugins: [...plugins, script()],
	},
];
