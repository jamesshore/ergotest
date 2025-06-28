// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import * as ensure from "../../util/ensure.js";
import { RunResult, TestCaseResult, TestSuiteResult } from "../results/test_result.js";
import child_process from "node:child_process";
import path from "node:path";
import { Clock } from "../../infrastructure/clock.js";
import { fromModulesAsync } from "./loader.js";
import { importRendererAsync, TestSuite } from "../tests/test_suite.js";
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
        const suite = await fromModulesAsync(modulePaths);
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
        const worker = new WorkerProcess(this._clock);
        return await worker.runAsync(modulePaths, options);
    }
}
class WorkerProcess {
    _clock;
    _worker;
    constructor(clock){
        this._clock = clock;
    }
    async runAsync(modulePaths, { timeout, config, onTestCaseResult = ()=>{}, renderer }) {
        this._worker = child_process.fork(WORKER_FILENAME, {
            serialization: "advanced",
            detached: false
        });
        try {
            const renderErrorFn = await importRendererAsync(renderer);
            this._worker.send({
                modulePaths,
                timeout,
                config,
                renderer
            });
            return await this.#handleWorkerEvents(renderErrorFn, onTestCaseResult);
        } finally{
            await this.#killWorkerProcess();
        }
    }
    async #handleWorkerEvents(renderError, onTestCaseResult) {
        return await new Promise((resolve, reject)=>{
            let workerIsDone = false;
            const { aliveFn, cancelFn } = this._clock.keepAlive(KEEPALIVE_TIMEOUT_IN_MS, ()=>{
                return resolve(createWatchdogFailureAndNotifyCaller("Detected infinite loop in tests", renderError, onTestCaseResult));
            });
            this._worker.on("close", ()=>{
                if (!workerIsDone) {
                    prepareForWorkerExit();
                    return resolve(createWatchdogFailureAndNotifyCaller("Tests exited early (probably by calling `process.exit()`)", renderError, onTestCaseResult));
                }
            });
            this._worker.on("error", (error)=>{
                return reject(error);
            });
            this._worker.on("message", (message)=>{
                switch(message.type){
                    case "keepalive":
                        aliveFn();
                        break;
                    case "progress":
                        onTestCaseResult(TestCaseResult.deserialize(message.result));
                        break;
                    case "fatal":
                        prepareForWorkerExit();
                        return reject(new Error(message.message, {
                            cause: message.err
                        }));
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
    async #killWorkerProcess() {
        await new Promise((resolve, reject)=>{
            if (!this.#workerIsRunning()) return resolve();
            this._worker.kill("SIGKILL"); // specific signal not tested
            this._worker.on("close", resolve);
            this._worker.on("error", reject);
        });
    }
    #workerIsRunning() {
        return this._worker.exitCode === null;
    }
}
function createWatchdogFailureAndNotifyCaller(errorMessage, renderError, onTestCaseResult) {
    const testCaseResult = TestCaseResult.create({
        it: RunResult.fail({
            name: [
                "Test runner watchdog"
            ],
            error: errorMessage,
            renderError
        })
    });
    const testSuiteResult = TestSuiteResult.create({
        tests: [
            testCaseResult
        ]
    });
    onTestCaseResult(testCaseResult);
    return testSuiteResult;
}

//# sourceMappingURL=test_runner.js.map
