const webpack = require('webpack');

module.exports = {
	entry: 'mything.js',
	plugins: [
		new webpack.DefinePlugin({
			COMPILER_DEFINED: JSON.stringify('defined'),
		}),
	],
};
