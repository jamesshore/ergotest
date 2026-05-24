import { SerializedTestCaseResult, SerializedTestSuiteResult, TestSuiteResult } from "../results/test_result.js";
import { Clock } from "../../infrastructure/clock.js";
import { TestOptions } from "./test_api.js";
/** For internal use only. */
export interface WorkerInput {
    testModulePaths: string[];
    options: TestOptions;
}
/** For internal use only. */
export type WorkerOutput = {
    type: "keepalive";
} | {
    type: "progress";
    result: SerializedTestCaseResult;
} | {
    type: "complete";
    result: SerializedTestSuiteResult;
} | {
    type: "fatal";
    message: string;
    err: unknown;
};
/**
 * Loads and runs tests in an isolated process.
 */
export declare class TestRunner {
    /**
     * Factory method. Creates the test runner.
     * @returns {TestRunner} The test runner.
     */
    static create(): TestRunner;
    private readonly _clock;
    /** For internal use only. (Use a factory method instead.) */
    constructor(clock: Clock);
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
    runInCurrentProcessAsync(testModulePaths: string[], options?: TestOptions): Promise<TestSuiteResult>;
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
    runInChildProcessAsync(testModulePaths: string[], options?: TestOptions): Promise<TestSuiteResult>;
}
