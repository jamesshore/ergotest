// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."

import { TestSuite } from "./test_suite.js";
import { TestCaseResult, TestResult, TestSuiteResult } from "./test_result.js";
import { Clock } from "../infrastructure/clock.js";
import process from "node:process";
import { WorkerInput } from "./test_runner.js";

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
		process.send!({ type: "keepalive" });
	});

	process.on("message", (workerData) => {
		runWorkerAsync(workerData as WorkerInput);
	});
}

async function runWorkerAsync({ modulePaths, config }: WorkerInput) {
	const suite = await TestSuite.fromModulesAsync(modulePaths);
	const result = await suite.runAsync({ config, notifyFn: sendProgress });

	// wait a tick so unhandled promises can be detected
	setImmediate(() => {
		sendFinalResult(result);
	});
}

function sendProgress(result: TestCaseResult) {
	process.send!({
		type: "progress",
		result: result.serialize(),
	});
}

function sendFinalResult(result: TestSuiteResult) {
	process.send!({
		type: "complete",
		result: result.serialize(),
	});
}
