export default [
	{
		input: 'mything.js',
		output: {
			file: 'build/mything.mjs',
			format: 'es',
		},
		plugins: [
			{
				name: 'example',
				renderChunk: (code) => ({ code: code.replace(/replace-me/g, 'replaced') }),
				transform: (code) => ({ code: code.replace(/replace-me/g, 'replaced') }),
			}
		],
	},
];
