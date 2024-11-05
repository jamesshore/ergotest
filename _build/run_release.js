// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import Release from "./release.js";

const result = await Release.create().runCliAsync();

if (result === null) process.exit(0);
else process.exit(1);