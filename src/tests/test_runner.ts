// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."

import * as ensure from "../util/ensure.js";
import { TestConfig, TestOptions, TestSuite } from "./test_suite.js";
import {
	SerializedTestCaseResult,
	SerializedTestSuiteResult,
	TestCaseResult,
	TestResult,
	TestSuiteResult,
} from "./test_result.js";
import child_process, { ChildProcess } from "node:child_process";
import path from "node:path";
import { Clock } from "../infrastructure/clock.js";
// dependency: ./test_runner_child_process.js

const WORKER_FILENAME = path.resolve(import.meta.dirname, "./test_runner_child_process.js");
const KEEPALIVE_TIMEOUT_IN_MS = TestSuite.DEFAULT_TIMEOUT_IN_MS;

/** For internal use only. */
export interface WorkerInput {
	modulePaths: string[],
	timeout?: number,
	config?: Record<string, unknown>
}

/** For internal use only. */
export type WorkerOutput = {
	type: "keepalive"
} | {
	type: "progress",
	result: SerializedTestCaseResult,
} | {
	type: "complete",
	result: SerializedTestSuiteResult,
}

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
	 * Load and run a set of test modules in the current process. Note that, because Node.js caches modules, this means
	 * that you can't make changes to your tests. Future test runs won't see your changes because the previous modules
	 * will have been cached.
	 *
	 * @param {string[]} modulePaths The test files to load and run.
	 * @param {object} [config] Configuration data to provide to the tests as they run.
	 * @param {(result: TestResult) => ()} [notifyFn] A function to call each time a test completes. The `result`
	 *   parameter describes the result of the test—whether it passed, failed, etc.
	 * @returns {Promise<TestSuiteResult>}
	 */
	async runInCurrentProcessAsync(modulePaths: string[], options?: TestOptions): Promise<TestSuiteResult> {
		ensure.signature(arguments, [ Array, [ undefined, {
			timeout: [ undefined, Number ],
			config: [ undefined, Object ],
			onTestCaseResult: [ undefined, Function ],
		}]]);

		const suite = await TestSuite.fromModulesAsync(modulePaths);
		return await suite.runAsync(options);
	}

	/**
	 * Load and run a set of test modules in an isolated child process.
	 *
	 * @param {string[]} modulePaths The test files to load and run.
	 * @param {object} [config] Configuration data to provide to the tests as they run.
	 * @param {(result: TestCaseResult) => ()} [onTestCaseResult] A function to call each time a test completes. The `result`
	 *   parameter describes the result of the test—whether it passed, failed, etc.
	 * @returns {Promise<TestSuiteResult>}
	 */
	async runInChildProcessAsync(modulePaths: string[], {
		timeout,
		config,
		onTestCaseResult = () => {},
	}: TestOptions = {}): Promise<TestSuiteResult> {
		ensure.signature(arguments, [ Array, [ undefined, {
			timeout: [ undefined, Number ],
			config: [ undefined, Object ],
			onTestCaseResult: [ undefined, Function ],
		}]]);

		const child = child_process.fork(WORKER_FILENAME, { serialization: "advanced", detached: false });
		const result = await runTestsInChildProcessAsync(child, this._clock, modulePaths, timeout, config, onTestCaseResult);
		await killChildProcess(child);

		return result;
	}

}

async function runTestsInChildProcessAsync(
	child: ChildProcess,
	clock: Clock,
	modulePaths: string[],
	timeout: number | undefined,
	config: TestConfig | undefined,
	onTestCaseResult: (testResult: TestCaseResult) => void,
): Promise<TestSuiteResult> {
	const result = await new Promise<TestSuiteResult>((resolve, reject) => {
		const workerData = { modulePaths, timeout, config };
		child.send(workerData);

		child.on("error", error => reject(error));
		child.on("close", code => {
			if (code !== 0) reject(new Error(`Test runner exited with non-zero error code: ${code}`));
		});

		const { aliveFn, cancelFn } = detectInfiniteLoops(clock, resolve);
		child.on("message", message => handleMessage(message as WorkerOutput, aliveFn, cancelFn, onTestCaseResult, resolve));
	});
	return result;
}

function detectInfiniteLoops(clock: Clock, resolve: (result: TestSuiteResult) => void) {
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
	onTestCaseResult: (testResult: TestCaseResult) => void,
	resolve: (result: TestSuiteResult) => void,
) {
	switch (message.type) {
		case "keepalive":
			aliveFn();
			break;
		case "progress":
			onTestCaseResult(TestCaseResult.deserialize(message.result));
			break;
		case "complete":
			cancelFn();
			resolve(TestSuiteResult.deserialize(message.result));
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
