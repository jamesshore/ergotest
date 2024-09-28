// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
"use strict";

const globals = require("globals");
const Paths = require("./paths");
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');

const ERROR = "error";
const IGNORE = "off";
const DEPRECATED = "off";     // turned off because this option has been deprecated

module.exports = [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
			"@typescript-eslint/no-unused-vars": IGNORE,
    }
  },
];