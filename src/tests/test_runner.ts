// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."

import * as ensure from "../util/ensure.js";
import { TestSuite, TestConfig } from "./test_suite.js";
import { SerializedTestResult, TestResult } from "./test_result.js";
import child_process, { ChildProcess } from "node:child_process";
import path from "node:path";
import { Clock } from "../infrastructure/clock.js";
// dependency: ./test_runner_child_process.js

const WORKER_FILENAME = path.resolve(import.meta.dirname, "./test_runner_child_process.js");
const KEEPALIVE_TIMEOUT_IN_MS = TestSuite.DEFAULT_TIMEOUT_IN_MS;

/** For internal use only. */
export interface WorkerInput {
	modulePaths: string[],
	config?: Record<string, unknown>
}

/** For internal use only. */
export type WorkerOutput = {
	type: "keepalive"
} | {
	type: "progress" | "complete",
	result: SerializedTestResult,
}

export type NotifyFn = (testResult: TestResult) => void;

/**
 * Loads and runs tests in an isolated process.
 */
export class TestRunner {

	/**
	 * Factory method. Creates the test runner.
	 * @returns {TestRunner} The test runner.
	 */
	static create() {
		return new TestRunner(Clock.create());
	}

	private readonly _clock: Clock;

	/** Only for use by TestRunner's tests. (Use a factory method instead.) */
	constructor(clock: Clock) {
		this._clock = clock;
	}

	/**
	 * Load and run a set of test modules in an isolated process.
	 * @param {string[]} modulePaths The test files to load and run.
	 * @param {object} [config] Configuration data to provide to the tests as they run.
	 * @param {(result: TestResult) => ()} [notifyFn] A function to call each time a test completes. The `result`
	 *   parameter describes the result of the test—whether it passed, failed, etc.
	 * @returns {Promise<void>}
	 */
	async runIsolatedAsync(modulePaths: string[], {
		config,
		notifyFn = () => {},
	}: {
		config?: Record<string, unknown>,
		notifyFn?: NotifyFn,
	} = {}) {
		ensure.signature(arguments, [ Array, [ undefined, {
			config: [ undefined, Object ],
			notifyFn: [ undefined, Function ],
		}]]);

		const child = child_process.fork(WORKER_FILENAME);
		const result = await runTestsInChildProcess(child, this._clock, modulePaths, config, notifyFn);
		await killChildProcess(child);

		return result;
	}

}

async function runTestsInChildProcess(
	child: ChildProcess,
	clock: Clock,
	modulePaths: string[],
	config: TestConfig | undefined,
	notifyFn: NotifyFn,
) {
	const result = await new Promise<TestResult>((resolve, reject) => {
		const workerData = { modulePaths, config };
		child.send(workerData);

		child.on("error", error => reject(error));
		child.on("close", code => {
			if (code !== 0) reject(new Error(`Test runner exited with non-zero error code: ${code}`));
		});

		const { aliveFn, cancelFn } = detectInfiniteLoops(clock, resolve);
		child.on("message", message => handleMessage(message as WorkerOutput, aliveFn, cancelFn, notifyFn, resolve));
	});
	return result;
}

function detectInfiniteLoops(clock: Clock, resolve: (result: TestResult) => void) {
	const { aliveFn, cancelFn } = clock.keepAlive(KEEPALIVE_TIMEOUT_IN_MS, () => {
		const errorResult = TestResult.suite([], [
			TestResult.fail("Test runner watchdog", "Detected infinite loop in tests"),
		]);
		resolve(errorResult);
	});
	return { aliveFn, cancelFn };
}

function handleMessage(
	message: WorkerOutput,
	aliveFn: () => void,
	cancelFn: () => void,
	notifyFn: NotifyFn,
	resolve: (result: TestResult) => void,
) {
	switch (message.type) {
		case "keepalive":
			aliveFn();
			break;
		case "progress":
			notifyFn(TestResult.deserialize(message.result));
			break;
		case "complete":
			cancelFn();
			resolve(TestResult.deserialize(message.result));
			break;
		default:
			// @ts-expect-error - TypeScript thinks this is unreachable, and so do I, but we still check it at runtime
			ensure.unreachable(`Unknown message type '${message.type}' from test runner: ${JSON.stringify(message)}`);
	}
}

async function killChildProcess(child: ChildProcess): Promise<void> {
	await new Promise((resolve, reject) => {
		child.kill("SIGKILL");    // specific signal not tested
		child.on("close", resolve);
		child.on("error", reject);
	});
}