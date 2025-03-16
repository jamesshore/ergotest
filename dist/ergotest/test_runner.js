// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import * as ensure from "../util/ensure.js";
import { importRendererAsync, TestSuite } from "./test_suite.js";
import { TestCaseResult, TestMark, TestResult, TestSuiteResult } from "./test_result.js";
import child_process from "node:child_process";
import path from "node:path";
import { Clock } from "../infrastructure/clock.js";
// dependency: ./test_runner_worker_process.js
const WORKER_FILENAME = path.resolve(import.meta.dirname, "./test_runner_worker_process.js");
const KEEPALIVE_TIMEOUT_IN_MS = TestSuite.DEFAULT_TIMEOUT_IN_MS;
const TEST_OPTIONS_TYPE = {
    timeout: [
        undefined,
        Number
    ],
    config: [
        undefined,
        Object
    ],
    onTestCaseResult: [
        undefined,
        Function
    ],
    renderer: [
        undefined,
        String
    ]
};
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
    /** For internal use only. (Use a factory method instead.) */ constructor(clock){
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
                TEST_OPTIONS_TYPE
            ]
        ]);
        const suite = await TestSuite.fromModulesAsync(modulePaths);
        return await suite.runAsync(options);
    }
    /**
	 * Load and run a set of test modules in an isolated child process.
	 *
	 * @param {string[]} modulePaths The test files to load and run.
	 * @param {object} [options.config] Configuration data to provide to the tests as they run.
	 * @param {(result: TestCaseResult) => ()} [options.onTestCaseResult] A function to call each time a test completes.
	 *   The `result` parameter describes the result of the test—whether it passed, failed, etc.
	 * @returns {Promise<TestSuiteResult>}
	 */ async runInChildProcessAsync(modulePaths, options = {}) {
        ensure.signature(arguments, [
            Array,
            [
                undefined,
                TEST_OPTIONS_TYPE
            ]
        ]);
        const worker = child_process.fork(WORKER_FILENAME, {
            serialization: "advanced",
            detached: false
        });
        try {
            return await runTestsInWorkerProcessAsync(worker, this._clock, modulePaths, options);
        } finally{
            await killWorkerProcess(worker);
        }
    }
}
async function runTestsInWorkerProcessAsync(worker, clock, modulePaths, { timeout, config, onTestCaseResult = ()=>{}, renderer }) {
    const result = await new Promise((resolve, reject)=>{
        const workerData = {
            modulePaths,
            timeout,
            config,
            renderer
        };
        worker.send(workerData);
        worker.on("error", (error)=>reject(error));
        worker.on("close", (code)=>{
            if (code !== 0) reject(new Error(`Test worker exited with non-zero error code: ${code}`));
        });
        importRendererAsync(renderer).then((renderError)=>{
            const { aliveFn, cancelFn } = detectInfiniteLoops(clock, resolve, renderError);
            worker.on("message", (message)=>{
                handleMessage(message, aliveFn, cancelFn, onTestCaseResult, resolve, reject);
            });
        }).catch(reject);
    });
    return result;
}
function detectInfiniteLoops(clock, resolve, renderError) {
    const { aliveFn, cancelFn } = clock.keepAlive(KEEPALIVE_TIMEOUT_IN_MS, ()=>{
        const errorResult = TestResult.suite([], [
            TestResult.fail("Test runner watchdog", "Detected infinite loop in tests", undefined, TestMark.none, renderError)
        ]);
        resolve(errorResult);
    });
    return {
        aliveFn,
        cancelFn
    };
}
function handleMessage(message, aliveFn, cancelFn, onTestCaseResult, resolve, reject) {
    switch(message.type){
        case "keepalive":
            aliveFn();
            break;
        case "progress":
            onTestCaseResult(TestCaseResult.deserialize(message.result));
            break;
        case "fatal":
            cancelFn();
            reject(new Error(message.message, {
                cause: message.err
            }));
            break;
        case "complete":
            cancelFn();
            resolve(TestSuiteResult.deserialize(message.result));
            break;
        default:
            // @ts-expect-error TypeScript thinks this is unreachable, but we check it just in case
            ensure.unreachable(`Unknown message type '${message.type}' from test runner: ${JSON.stringify(message)}`);
    }
}
async function killWorkerProcess(worker) {
    await new Promise((resolve, reject)=>{
        worker.kill("SIGKILL"); // specific signal not tested
        worker.on("close", resolve);
        worker.on("error", reject);
    });
}

//# sourceMappingURL=/Users/jshore/Documents/Projects/ergotest/generated/src/ergotest/test_runner.js.map
