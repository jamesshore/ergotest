// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
"use strict";

const TestSuite = require("./test_suite");
const TestResult = require("./test_result");
const Clock = require("../infrastructure/clock");
const process = require("node:process");

const KEEPALIVE_INTERVAL_IN_MS = 100;


main();


function main() {
	process.on("uncaughtException", (err) => {
		const errorResult = TestResult.suite([], [
			TestResult.fail("Unhandled error in tests", err),
		]);
		sendFinalResult(errorResult);
	});

	Clock.create().repeat(KEEPALIVE_INTERVAL_IN_MS, () => {
		process.send({ type: "keepalive" });
	});

	process.on("message", (workerData) => {
		runWorkerAsync(workerData);
	});
}

async function runWorkerAsync({ modulePaths, config }) {
	const suite = TestSuite.fromModulesAsync(modulePaths);
	const result = await suite.runAsync({ config, notifyFn: sendProgress });

	// wait a tick so unhandled promises can be detected
	setImmediate(() => {
		sendFinalResult(result);
	});
}

function sendProgress(result) {
	process.send({
		type: "progress",
		result: result.serialize(),
	});
}

function sendFinalResult(result) {
	process.send({
		type: "complete",
		result: result.serialize(),
	});
}
