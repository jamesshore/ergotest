import { Clock } from "../../infrastructure/clock.js";
import { TestCaseResult, TestMarkValue, TestSuiteResult } from "../results/test_result.js";
import { Milliseconds, RunOptions, Test } from "./test.js";
import { BeforeAfter } from "./before_after.js";
export interface TestConfig {
    [name: string]: unknown;
}
export interface TestOptions {
    timeout?: Milliseconds;
    config?: TestConfig;
    onTestCaseResult?: (testCaseResult: TestCaseResult) => void;
    renderer?: string;
    clock?: Clock;
}
export interface RunData {
    filename?: string;
    mark: TestMarkValue;
    timeout: Milliseconds;
    skipAll: boolean;
    beforeEach: BeforeAfter[];
    afterEach: BeforeAfter[];
}
/**
 * A simple but full-featured test runner.
 */
export declare class TestSuite implements Test {
    #private;
    private _name;
    private _mark;
    private _tests;
    private _hasDotOnlyChildren;
    private _allChildrenSkipped;
    private _beforeAll;
    private _afterAll;
    private _beforeEach;
    private _afterEach;
    private _timeout?;
    private _filename?;
    static get DEFAULT_TIMEOUT_IN_MS(): number;
    static create({ name, mark, timeout, beforeAll, afterAll, beforeEach, afterEach, tests, }: {
        name?: string[];
        mark?: TestMarkValue;
        timeout?: Milliseconds;
        beforeAll?: BeforeAfter[];
        afterAll?: BeforeAfter[];
        beforeEach?: BeforeAfter[];
        afterEach?: BeforeAfter[];
        tests?: Test[];
    }): TestSuite;
    /** Internal use only. (Use {@link describe} or {@link TestSuite.fromModulesAsync} instead.) */
    constructor(name: string[], mark: TestMarkValue, timeout: Milliseconds | undefined, beforeAll: BeforeAfter[], afterAll: BeforeAfter[], beforeEach: BeforeAfter[], afterEach: BeforeAfter[], tests: Test[]);
    /**
     * Run the tests in this suite.
     * @param {number} [timeout] Default timeout in milliseconds.
     * @param {object} [config={}] Configuration data to provide to tests.
     * @param {(result: TestResult) => ()} [onTestCaseResult] A function to call each time a test completes. The `result`
     *   parameter describes the result of the test—whether it passed, failed, etc.
     * @param {string} [renderer] Path to a module that exports a `renderError()` function with the signature `(name:
     *   string, error: unknown, mark: TestMarkValue, filename?: string) => unknown`. The path must be an absolute path
     *   or a module that exists in `node_modules`. The `renderError()` function will be called when a test fails and the
     *   return value will be placed into the test result as {@link TestResult.errorRender}.
     * @param {Clock} [clock] Internal use only.
     * @returns {Promise<TestSuiteResult>} The results of the test suite.
     */
    runAsync({ timeout, config, onTestCaseResult, renderer, clock, }?: TestOptions): Promise<TestSuiteResult>;
    /** @private */
    _setFilename(filename: string): void;
    /** @private */
    _isDotOnly(): boolean;
    /** @private */
    _isSkipped(): boolean;
    /** @private */
    _runAsyncInternal(runOptions: RunOptions, parentData: RunData): Promise<TestSuiteResult>;
}
/** Internal use only. */
export declare function importRendererAsync(renderer?: string): Promise<any>;
