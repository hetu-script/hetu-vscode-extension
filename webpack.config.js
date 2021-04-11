// @ts-check

"use strict";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path");

module.exports = (env) => {
	/**
	 * @type {import("webpack").Configuration}
	 */
	const config = {
		devtool: "source-map",
		entry: {
			extension: "./src/extension/extension.ts",
			// debug: "./src/debug/debug_entry.ts",
		},
		// https://webpack.js.org/configuration/externals/
		externals: {
			vscode: "commonjs vscode",
		},
		module: {
			rules: [{
				exclude: /node_modules/,
				test: /\.ts$/,
				loader: "ts-loader",
			}],
		},
		output: {
			devtoolModuleFilenameTemplate: "../../[resource-path]",
			libraryTarget: "commonjs2",
			path: path.resolve(__dirname, "dist"),
		},
		optimization: {
			minimize: false,
		},
		resolve: {
			extensions: [".ts", ".js"],
		},
		target: "node",
	};

	return config;
};
