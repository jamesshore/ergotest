// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."

import { TestSuite } from "./test_suite.js";
import { RenderErrorFn, TestCaseResult, TestResult, TestSuiteResult } from "./test_result.js";
import { Clock } from "../infrastructure/clock.js";
import process from "node:process";
import { WorkerInput } from "./test_runner.js";
import util from "node:util";

const KEEPALIVE_INTERVAL_IN_MS = 100;

main();

function main() {
	const cancelKeepAliveFn = Clock.create().repeat(KEEPALIVE_INTERVAL_IN_MS, () => {
		console.log("KEEPALIVE");
		process.send!({ type: "keepalive" });
	});

	process.on("message", (workerData) => {
		runWorkerAsync(cancelKeepAliveFn, workerData as WorkerInput);
	});
	process.on("error", (err) => {
		if ((err as { code: string })?.code === "ERR_IPC_CHANNEL_CLOSED") {
			cancelKeepAliveFn();
			process.stdout.write(
				"Ergotest worker process attempted to send message after IPC channel closed\n" +
				`Error: ${(err as Error)?.stack}`
			);
		}
		else {
			sendFatalError("Ergotest worker process generated 'error' event", err, cancelKeepAliveFn);
		}
	});
}

async function runWorkerAsync(
	cancelKeepAliveFn: () => void,
	{ modulePaths, timeout, config, renderer }: WorkerInput
) {
	process.on("uncaughtException", (err) => {
		const errorResult = TestResult.suite([], [
			TestResult.fail("Unhandled error in tests", err),
		]);
		sendFinalResult(errorResult, cancelKeepAliveFn);
	});

	try {
		const suite = await TestSuite.fromModulesAsync(modulePaths);
		const result = await suite.runAsync({ timeout, config, renderer, onTestCaseResult: sendProgress });

		// wait a tick so unhandled promises can be detected
		setImmediate(() => {
			sendFinalResult(result, cancelKeepAliveFn);
		});
	}
	catch (err) {
		sendFatalError("Ergotest worker process encountered exception while running tests", err, cancelKeepAliveFn);
	}
}

function sendProgress(result: TestCaseResult) {
	send({
		type: "progress",
		result: result.serialize(),
	});
}

function sendFatalError(message: string, err: unknown, cancelKeepAliveFn: () => void) {
	cancelKeepAliveFn();
	send({
		type: "fatal",
		message,
		err,
	});
}

function sendFinalResult(result: TestSuiteResult, cancelKeepAliveFn: () => void) {
	cancelKeepAliveFn();
	send({
		type: "complete",
		result: result.serialize(),
	});
}

function send(message: unknown) {
	process.send!(message);
}