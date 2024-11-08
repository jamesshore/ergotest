// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."

import globalConfig from "./eslint.global.conf.js";

const ERROR = "error";
const IGNORE = "off";

export default [
	...globalConfig,
	{
		name: "JavaScript config",
	},
];