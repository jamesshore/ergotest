// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import Build from "./build.js";

const result = await Build.create().runCliAsync();

if (result === null) process.exit(0);
else process.exit(1);