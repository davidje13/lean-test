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
				transform: (code) => ({
					code: code.replace(/replace-me/g, '!replaced!'),
					map: null, // replacement is same length as input => no sourcemap changes
				}),
			}
		],
	},
];
