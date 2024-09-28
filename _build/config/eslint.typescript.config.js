// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
"use strict";

const globals = require("globals");
const Paths = require("./paths");
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const globalConfig = require("./eslint.global.config");

const ERROR = "error";
const IGNORE = "off";
const DEPRECATED = "off";     // turned off because this option has been deprecated

module.exports = [
  ...globalConfig,
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    name: "TypeScript config",

    languageOptions: {
      parserOptions: {
        // warnOnUnsupportedTypeScriptVersion: false,
      }
    },

    rules: {
			"@typescript-eslint/no-unused-vars": IGNORE,
    }
  },
];