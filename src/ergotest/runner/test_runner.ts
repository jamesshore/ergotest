// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import * as ensure from "../../util/ensure.js";
import {
	RenderErrorFn,
	RunResult,
	SerializedTestCaseResult,
	SerializedTestSuiteResult,
	TestCaseResult,
	TestSuiteResult,
} from "../results/test_result.js";
import child_process, { ChildProcess } from "node:child_process";
import path from "node:path";
import { Clock } from "../../infrastructure/clock.js";
import { importRendererAsync, TestSuite } from "../tests/test_suite.js";
import { _loadTestsAsync, TestOptions } from "./test_api.js";
// dependency: ./test_runner_worker_process.js

const WORKER_FILENAME = path.resolve(import.meta.dirname, "./test_runner_worker_process.js");
const KEEPALIVE_TIMEOUT_IN_MS = TestSuite.DEFAULT_TIMEOUT_IN_MS;

const TEST_OPTIONS_TYPE = {
	setupModulePaths: [ undefined, Array ],
	timeout: [ undefined, Number ],
	config: [ undefined, Object ],
	onTestCaseResult: [ undefined, Function ],
	renderer: [ undefined, String ],
};

/** For internal use only. */
export interface WorkerInput {
	testModulePaths: string[],
	options: TestOptions,
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
} | {
	type: "fatal",
	message: string,
	err: unknown,
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

	/** For internal use only. (Use a factory method instead.) */
	constructor(clock: Clock) {
		this._clock = clock;
	}

	/**
	 * Load and run a set of test modules in the current process. Note that, because Node.js caches modules, this means
	 * that you can't make changes to your tests. Future test runs won't see your changes because the previous modules
	 * will have been cached.
	 *
	 * @param {string[]} testModulePaths The test files to load and run.
	 * @param {string[]} [options.setupModulePaths] The setup files to load and run prior to the tests.
	 * @param {number} [options.timeout] Default timeout in milliseconds.
	 * @param {object} [options.config={}] Configuration data to provide to tests.
	 * @param {(result: TestResult) => ()} [options.onTestCaseResult] A function to call each time a test completes. The
	 *   `result` parameter describes the result of the test—whether it passed, failed, etc.
	 * @param {string} [options.renderer] Path to a module that exports a `renderError()` function with the signature
	 *   `(name: string, error: unknown, mark: TestMarkValue, filename?: string) => unknown`. The path must be an
	 *   absolute path or a module that exists in `node_modules`. The `renderError()` function will be called when a test
	 *   fails and the return value will be placed into the test result as {@link TestResult.errorRender}.
	 * @returns {Promise<TestSuiteResult>}
	 */
	async runInCurrentProcessAsync(testModulePaths: string[], options: TestOptions = {}): Promise<TestSuiteResult> {
		ensure.signature(arguments, [ Array, [ undefined, TEST_OPTIONS_TYPE]]);

		const suite = await _loadTestsAsync(options.setupModulePaths ?? [], testModulePaths);
		return await suite.runAsync(options);
	}

	/**
	 * Load and run a set of test modules in an isolated child process.
	 *
	 * @param {string[]} testModulePaths The test files to load and run.
	 * @param {string[]} [options.setupModulePaths] The setup files to load and run prior to the tests.
	 * @param {number} [options.timeout] Default timeout in milliseconds.
	 * @param {object} [options.config={}] Configuration data to provide to tests.
	 * @param {(result: TestResult) => ()} [options.onTestCaseResult] A function to call each time a test completes. The
	 *   `result` parameter describes the result of the test—whether it passed, failed, etc.
	 * @param {string} [options.renderer] Path to a module that exports a `renderError()` function with the signature
	 *   `(name: string, error: unknown, mark: TestMarkValue, filename?: string) => unknown`. The path must be an
	 *   absolute path or a module that exists in `node_modules`. The `renderError()` function will be called when a test
	 *   fails and the return value will be placed into the test result as {@link TestResult.errorRender}.
	 * @returns {Promise<TestSuiteResult>}
	 */
	async runInChildProcessAsync(testModulePaths: string[], options: TestOptions = {}): Promise<TestSuiteResult> {
		ensure.signature(arguments, [ Array, [ undefined, TEST_OPTIONS_TYPE ]]);

		const worker = new WorkerProcess(this._clock);
		return await worker.runAsync(testModulePaths, options);
	}

}


class WorkerProcess {

	private _clock: Clock;
	private _worker!: ChildProcess;

	constructor(clock: Clock) {
		this._clock = clock;
	}

	async runAsync(
		testModulePaths: string[],
		options: TestOptions,
		): Promise<TestSuiteResult> {
		this._worker = child_process.fork(WORKER_FILENAME, { serialization: "advanced", detached: false });

		try {
			const onTestCaseResult = options.onTestCaseResult ?? function() {};
			const optionsCopy = { ...options };
			delete optionsCopy.onTestCaseResult;

			const renderErrorFn = await importRendererAsync(options.renderer);
			this._worker.send({ testModulePaths, options: optionsCopy });
			return await this.#handleWorkerEvents(renderErrorFn, options.onTestCaseResult ?? function() {});
		}
		finally {
			await this.#killWorkerProcess();
		}
	}

	async #handleWorkerEvents(
		renderError: RenderErrorFn,
		onTestCaseResult: (testCaseResult: TestCaseResult) => void,
	): Promise<TestSuiteResult> {
		return await new Promise<TestSuiteResult>((resolve, reject) => {
			let workerIsDone = false;

			const { aliveFn, cancelFn } = this._clock.keepAlive(KEEPALIVE_TIMEOUT_IN_MS, () => {
				return resolve(createWatchdogFailureAndNotifyCaller(
					"Detected infinite loop in tests",
					renderError,
					onTestCaseResult,
				));
			});

			this._worker.on("close", () => {
				if (!workerIsDone) {
					prepareForWorkerExit();
					return resolve(createWatchdogFailureAndNotifyCaller(
						"Tests exited early (probably by calling `process.exit()`)",
						renderError,
						onTestCaseResult,
					));
				}
			});

			this._worker.on("error", error => {
				return reject(error);
			});

			this._worker.on("message", (message: WorkerOutput) => {
				switch (message.type) {
					case "keepalive":
						aliveFn();
						break;
					case "progress":
						onTestCaseResult(TestCaseResult.deserialize(message.result));
						break;
					case "fatal":
						prepareForWorkerExit();
						return reject(new Error(message.message, { cause: message.err }));
					case "complete":
						prepareForWorkerExit();
						return resolve(TestSuiteResult.deserialize(message.result));
					default:
						// @ts-expect-error TypeScript thinks this is unreachable, but we check it just in case
						ensure.unreachable(`Unknown message type '${message.type}' from test runner: ${JSON.stringify(message)}`);
				}
			});

			function prepareForWorkerExit() {
				workerIsDone = true;
				cancelFn();
			}
		});
	}

	async #killWorkerProcess(): Promise<void> {
		await new Promise<void>((resolve, reject) => {
			if (!this.#workerIsRunning()) return resolve();

			this._worker.kill("SIGKILL");    // specific signal not tested
			this._worker.on("close", resolve);
			this._worker.on("error", reject);
		});
	}

	#workerIsRunning() {
		return this._worker.exitCode === null;
	}

}

function createWatchdogFailureAndNotifyCaller(
	errorMessage: string,
	renderError: RenderErrorFn | undefined,
	onTestCaseResult: (result: TestCaseResult) => void,
) {
	const testCaseResult = TestCaseResult.create({
		it: RunResult.fail({ name: [ "Test runner watchdog" ], error: errorMessage, renderError }),
	});
	const testSuiteResult = TestSuiteResult.create({
		tests: [ testCaseResult ],
	});
	onTestCaseResult(testCaseResult);
	return testSuiteResult;
}