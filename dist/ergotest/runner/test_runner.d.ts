import { SerializedTestCaseResult, SerializedTestSuiteResult, TestSuiteResult } from "../results/test_result.js";
import { Clock } from "../../infrastructure/clock.js";
import { TestOptions } from "../tests/test_api.js";
/** For internal use only. */
export interface WorkerInput {
    modulePaths: string[];
    timeout?: number;
    config?: Record<string, unknown>;
    renderer?: string;
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
     * @param {string[]} modulePaths The test files to load and run.
     * @param {object} [config] Configuration data to provide to the tests as they run.
     * @param {(result: TestResult) => ()} [notifyFn] A function to call each time a test completes. The `result`
     *   parameter describes the result of the test—whether it passed, failed, etc.
     * @returns {Promise<TestSuiteResult>}
     */
    runInCurrentProcessAsync(modulePaths: string[], options?: TestOptions): Promise<TestSuiteResult>;
    /**
     * Load and run a set of test modules in an isolated child process.
     *
     * @param {string[]} modulePaths The test files to load and run.
     * @param {object} [options.config] Configuration data to provide to the tests as they run.
     * @param {(result: TestCaseResult) => ()} [options.onTestCaseResult] A function to call each time a test completes.
     *   The `result` parameter describes the result of the test—whether it passed, failed, etc.
     * @returns {Promise<TestSuiteResult>}
     */
    runInChildProcessAsync(modulePaths: string[], options?: TestOptions): Promise<TestSuiteResult>;
}
