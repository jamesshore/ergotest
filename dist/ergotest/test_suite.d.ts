import { Clock } from "../infrastructure/clock.js";
import { RenderErrorFn, TestCaseResult, TestMarkValue, TestResult, TestSuiteResult } from "./test_result.js";
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
export interface DescribeOptions {
    timeout?: Milliseconds;
}
export interface ItOptions {
    timeout?: Milliseconds;
}
export type DescribeFn = () => void;
export type ItFn = (testUtilities: TestParameters) => Promise<void> | void;
type BeforeAfter = (optionalOptions: ItOptions | ItFn, fnAsync?: ItFn) => void;
type BeforeAfterDefinition = {
    options: ItOptions;
    fnAsync: ItFn;
};
interface TestParameters {
    getConfig: <T>(key: string) => T;
}
type Milliseconds = number;
interface RecursiveRunOptions {
    name: string[];
    filename?: string;
    clock: Clock;
    onTestCaseResult: (testResult: TestCaseResult) => void;
    timeout: Milliseconds;
    config: TestConfig;
    renderError?: RenderErrorFn;
}
interface Test {
    _recursiveRunAsync: (parentMark: TestMarkValue, parentBeforeEachFns: BeforeAfterDefinition[], parentAfterEachFns: BeforeAfterDefinition[], options: RecursiveRunOptions) => Promise<TestResult> | TestResult;
    _isDotOnly: () => boolean;
    _isSkipped: (mark: TestMarkValue) => boolean;
}
export interface TestContext {
    describe(optionalName: string | DescribeOptions | DescribeFn | undefined, optionalOptions: DescribeOptions | DescribeFn | undefined, describeFn: DescribeFn | undefined, mark: TestMarkValue): TestSuite;
    it(name: string, optionalOptions: ItOptions | ItFn | undefined, itFn: ItFn | undefined, mark: TestMarkValue): void;
    beforeAll: BeforeAfter;
    afterAll: BeforeAfter;
    beforeEach: BeforeAfter;
    afterEach: BeforeAfter;
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
    private _beforeAllFns;
    private _afterAllFns;
    private _beforeEachFns;
    private _afterEachFns;
    private _timeout?;
    private _filename?;
    static get DEFAULT_TIMEOUT_IN_MS(): number;
    /**
     * Convert a list of test modules into a test suite. Each module needs to export a test suite by using
     * {@link TestSuite.create}.
     * @param {string[]} moduleFilenames The filenames of the test modules.
     * @returns {TestSuite} The test suite.
     */
    static fromModulesAsync(moduleFilenames: string[]): Promise<TestSuite>;
    /** Internal use only. */
    static create(nameOrOptionsOrDescribeFn: string | DescribeOptions | DescribeFn | undefined, optionsOrDescribeFn: DescribeOptions | DescribeFn | undefined, possibleDescribeFn: DescribeFn | undefined, mark: TestMarkValue, testContext: TestContext[]): TestSuite;
    /** Internal use only. (Use {@link describe} or {@link TestSuite.fromModulesAsync} instead.) */
    constructor(name: string, mark: TestMarkValue, { tests, beforeAllFns, afterAllFns, beforeEachFns, afterEachFns, timeout, }: {
        tests?: Test[];
        beforeAllFns?: BeforeAfterDefinition[];
        afterAllFns?: BeforeAfterDefinition[];
        beforeEachFns?: BeforeAfterDefinition[];
        afterEachFns?: BeforeAfterDefinition[];
        timeout?: Milliseconds;
    });
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
    _recursiveRunAsync(parentMark: TestMarkValue, parentBeforeEachFns: BeforeAfterDefinition[], parentAfterEachFns: BeforeAfterDefinition[], options: RecursiveRunOptions): Promise<TestSuiteResult>;
}
/** Internal use only. */
export declare function importRendererAsync(renderer?: string): Promise<any>;
export {};
