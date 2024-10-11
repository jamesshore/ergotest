import { SerializedTestResult, TestResult } from "./test_result.js";
import { Clock } from "../infrastructure/clock.js";
/** For internal use only. */
export interface WorkerInput {
    modulePaths: string[];
    config?: Record<string, unknown>;
}
/** For internal use only. */
export type WorkerOutput = {
    type: "keepalive";
} | {
    type: "progress" | "complete";
    result: SerializedTestResult;
};
export type NotifyFn = (testResult: TestResult) => void;
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
    /** Only for use by TestRunner's tests. (Use a factory method instead.) */
    constructor(clock: Clock);
    /**
     * Load and run a set of test modules in an isolated process.
     * @param {string[]} modulePaths The test files to load and run.
     * @param {object} [config] Configuration data to provide to the tests as they run.
     * @param {(result: TestResult) => ()} [notifyFn] A function to call each time a test completes. The `result`
     *   parameter describes the result of the test—whether it passed, failed, etc.
     * @returns {Promise<void>}
     */
    runIsolatedAsync(modulePaths: string[], { config, notifyFn, }?: {
        config?: Record<string, unknown>;
        notifyFn?: NotifyFn;
    }): Promise<TestResult>;
}
