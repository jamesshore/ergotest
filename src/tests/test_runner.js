// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
"use strict";

const ensure = require("../util/ensure");
const TestSuite = require("./test_suite");
const TestResult = require("./test_result");
const child_process = require("node:child_process");
const path = require("node:path");
const Clock = require("../infrastructure/clock");
// dependency: ./test_runner_child_process.js

const WORKER_FILENAME = path.resolve(__dirname, "./test_runner_child_process.js");
const KEEPALIVE_TIMEOUT_IN_MS = TestSuite.DEFAULT_TIMEOUT_IN_MS;

/**
 * Loads and runs tests in an isolated process.
 */
module.exports = class TestRunner {

	/**
	 * Factory method. Creates the test runner.
	 * @returns {TestRunner} The test runner.
	 */
	static create() {
		return new TestRunner(Clock.create());
	}

	/** Only for use by TestRunner's tests. (Use a factory method instead.) */
	constructor(clock) {
		this._clock = clock;
	}

	/**
	 * Load and run a set of test modules in an isolated process.
	 * @param {string[]} modulePaths The test files to load and run.
	 * @param {object} [config] Configuration data to provide to the tests as they run.
	 * @param {(result: TestResult) => ()} [notifyFn] A function to call each time a test completes. The `result` parameter describes the result of the test—whether it passed, failed, etc.
	 * @returns {Promise<void>}
	 */
	async runIsolatedAsync(modulePaths, {
		config,
		notifyFn = () => {},
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

};

async function runTestsInChildProcess(child, clock, modulePaths, config, notifyFn) {
	const result = await new Promise((resolve, reject) => {
		const workerData = { modulePaths, config };
		child.send(workerData);

		child.on("error", error => reject(error));
		child.on("close", code => {
			if (code !== 0) reject(new Error(`Test runner exited with non-zero error code: ${code}`));
		});

		const { aliveFn, cancelFn } = detectInfiniteLoops(clock, resolve);
		child.on("message", message => handleMessage(message, aliveFn, cancelFn, notifyFn, resolve));
	});
	return result;
}

function detectInfiniteLoops(clock, resolve) {
	const { aliveFn, cancelFn } = clock.keepAlive(KEEPALIVE_TIMEOUT_IN_MS, () => {
		const errorResult = TestResult.suite([], [
			TestResult.fail("Test runner watchdog", "Detected infinite loop in tests"),
		]);
		resolve(errorResult);
	});
	return { aliveFn, cancelFn };
}

function handleMessage(message, aliveFn, cancelFn, notifyFn, resolve) {
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
			ensure.unreachable(`Unknown message type '${message.type}' from test runner: ${JSON.stringify(message)}`);
	}
}

async function killChildProcess(child) {
	await new Promise((resolve, reject) => {
		child.kill("SIGKILL");    // specific signal not tested
		child.on("close", resolve);
		child.on("error", reject);
	});
}
