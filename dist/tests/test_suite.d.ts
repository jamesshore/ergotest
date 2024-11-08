import { Clock } from "../infrastructure/clock.js";
import { TestCaseResult, TestMarkValue, TestResult, TestSuiteResult } from "./test_result.js";
export interface TestOptions {
    config?: Record<string, unknown>;
    notifyFn?: NotifyFn;
    clock?: Clock;
}
export type NotifyFn = (testResult: TestCaseResult) => void;
export interface Describe {
    (optionalName?: string | DescribeFunction, describeFn?: DescribeFunction): TestSuite;
    skip: (optionalName?: string | DescribeFunction, descrbeFn?: DescribeFunction) => TestSuite;
    only: (optionalName?: string | DescribeFunction, describeFn?: DescribeFunction) => TestSuite;
}
interface It {
    (name: string, itFn?: ItFn): void;
    skip: (name: string, itFn?: ItFn) => void;
    only: (name: string, itFn?: ItFn) => void;
}
type BeforeAfter = (fn: Test) => void;
export interface SuiteParameters {
    describe: Describe;
    it: It;
    beforeAll: BeforeAfter;
    afterAll: BeforeAfter;
    beforeEach: BeforeAfter;
    afterEach: BeforeAfter;
    setTimeout: (newTimeout: Milliseconds) => void;
}
export interface TestParameters {
    getConfig: <T>(key: string) => T;
}
export type DescribeFunction = (suiteUtilities: SuiteParameters) => void;
export type Test = (testUtilities: TestParameters) => Promise<void> | void;
export type ItFn = Test;
export type BeforeAfterFn = Test;
type Milliseconds = number;
export interface TestConfig {
    [name: string]: unknown;
}
interface RecursiveRunOptions {
    name: string[];
    filename?: string;
    clock: Clock;
    notifyFn: NotifyFn;
    timeout: Milliseconds;
    config: TestConfig;
}
interface Runnable {
    _recursiveRunAsync: (parentMark: TestMarkValue, parentBeforeEachFns: Test[], parentAfterEachFns: Test[], options: RecursiveRunOptions) => Promise<TestResult> | TestResult;
    _isDotOnly: () => boolean;
    _isSkipped: (mark: TestMarkValue) => boolean;
}
/**
 * A simple but full-featured test runner. It's notable for not using globals.
 */
export declare class TestSuite implements Runnable {
    #private;
    static get DEFAULT_TIMEOUT_IN_MS(): number;
    /**
     * @returns {function} A function for creating a test suite. In your test module, call this function and export the
     *   result.
     */
    static get create(): Describe;
    /**
     * Convert a list of test modules into a test suite. Each module needs to export a test suite by using
     * {@link TestSuite.create}.
     * @param {string[]} moduleFilenames The filenames of the test modules.
     * @returns {TestSuite} The test suite.
     */
    static fromModulesAsync(moduleFilenames: string[]): Promise<TestSuite>;
    private _name;
    private _mark;
    private _tests;
    private _hasDotOnlyChildren;
    private _allChildrenSkipped;
    private _beforeAllFns;
    private _afterAllFns;
    private _beforeEachFns;
    private _afterEachFns;
    private _timeout?;
    private _filename?;
    /** Internal use only. (Use {@link TestSuite.create} or {@link TestSuite.fromModulesAsync} instead.) */
    constructor(name: string, mark: TestMarkValue, { tests, beforeAllFns, afterAllFns, beforeEachFns, afterEachFns, timeout, }: {
        tests?: Runnable[];
        beforeAllFns?: BeforeAfterFn[];
        afterAllFns?: BeforeAfterFn[];
        beforeEachFns?: BeforeAfterFn[];
        afterEachFns?: BeforeAfterFn[];
        timeout?: Milliseconds;
    });
    /**
     * Run the tests in this suite.
     * @param {object} [config={}] Configuration data to provide to tests.
     * @param {(result: TestResult) => ()} [notifyFn] A function to call each time a test completes. The `result`
     *   parameter describes the result of the test—whether it passed, failed, etc.
     * @param {Clock} [clock] The clock to use. Meant for internal use.
     * @returns {Promise<TestSuiteResult>} The results of the test suite.
     */
    runAsync({ config, notifyFn, clock, }?: TestOptions): Promise<TestSuiteResult>;
    /** @private */
    _setFilename(filename: string): void;
    /** @private */
    _isDotOnly(): boolean;
    /** @private */
    _isSkipped(): boolean;
    /** @private */
    _recursiveRunAsync(parentMark: TestMarkValue, parentBeforeEachFns: Test[], parentAfterEachFns: Test[], options: RecursiveRunOptions): Promise<TestSuiteResult>;
}
export {};
