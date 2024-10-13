// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import * as ensure from "../util/ensure.js";
import { TestSuite } from "./test_suite.js";
import { TestCaseResult, TestResult, TestSuiteResult } from "./test_result.js";
import child_process from "node:child_process";
import path from "node:path";
import { Clock } from "../infrastructure/clock.js";
// dependency: ./test_runner_child_process.js
const WORKER_FILENAME = path.resolve(import.meta.dirname, "./test_runner_child_process.js");
const KEEPALIVE_TIMEOUT_IN_MS = TestSuite.DEFAULT_TIMEOUT_IN_MS;
/**
 * Loads and runs tests in an isolated process.
 */ export class TestRunner {
    /**
	 * Factory method. Creates the test runner.
	 * @returns {TestRunner} The test runner.
	 */ static create() {
        return new TestRunner(Clock.create());
    }
    _clock;
    /** Only for use by TestRunner's tests. (Use a factory method instead.) */ constructor(clock){
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
	 */ async runInCurrentProcessAsync(modulePaths, options) {
        ensure.signature(arguments, [
            Array,
            [
                undefined,
                {
                    config: [
                        undefined,
                        Object
                    ],
                    notifyFn: [
                        undefined,
                        Function
                    ]
                }
            ]
        ]);
        const suite = await TestSuite.fromModulesAsync(modulePaths);
        return await suite.runAsync(options);
    }
    /**
	 * Load and run a set of test modules in an isolated child process.
	 *
	 * @param {string[]} modulePaths The test files to load and run.
	 * @param {object} [config] Configuration data to provide to the tests as they run.
	 * @param {(result: TestResult) => ()} [notifyFn] A function to call each time a test completes. The `result`
	 *   parameter describes the result of the test—whether it passed, failed, etc.
	 * @returns {Promise<TestSuiteResult>}
	 */ async runInChildProcessAsync(modulePaths, { config, notifyFn = ()=>{} } = {}) {
        ensure.signature(arguments, [
            Array,
            [
                undefined,
                {
                    config: [
                        undefined,
                        Object
                    ],
                    notifyFn: [
                        undefined,
                        Function
                    ]
                }
            ]
        ]);
        const child = child_process.fork(WORKER_FILENAME);
        const result = await runTestsInChildProcessAsync(child, this._clock, modulePaths, config, notifyFn);
        await killChildProcess(child);
        return result;
    }
}
async function runTestsInChildProcessAsync(child, clock, modulePaths, config, notifyFn) {
    const result = await new Promise((resolve, reject)=>{
        const workerData = {
            modulePaths,
            config
        };
        child.send(workerData);
        child.on("error", (error)=>reject(error));
        child.on("close", (code)=>{
            if (code !== 0) reject(new Error(`Test runner exited with non-zero error code: ${code}`));
        });
        const { aliveFn, cancelFn } = detectInfiniteLoops(clock, resolve);
        child.on("message", (message)=>handleMessage(message, aliveFn, cancelFn, notifyFn, resolve));
    });
    return result;
}
function detectInfiniteLoops(clock, resolve) {
    const { aliveFn, cancelFn } = clock.keepAlive(KEEPALIVE_TIMEOUT_IN_MS, ()=>{
        const errorResult = TestResult.suite([], [
            TestResult.fail("Test runner watchdog", "Detected infinite loop in tests")
        ]);
        resolve(errorResult);
    });
    return {
        aliveFn,
        cancelFn
    };
}
function handleMessage(message, aliveFn, cancelFn, notifyFn, resolve) {
    switch(message.type){
        case "keepalive":
            aliveFn();
            break;
        case "progress":
            notifyFn(TestCaseResult.deserialize(message.result));
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
async function killChildProcess(child) {
    await new Promise((resolve, reject)=>{
        child.kill("SIGKILL"); // specific signal not tested
        child.on("close", resolve);
        child.on("error", reject);
    });
}

//# sourceMappingURL=/Users/jshore/Documents/Projects/ergotest/generated/src/tests/test_runner.js.map
