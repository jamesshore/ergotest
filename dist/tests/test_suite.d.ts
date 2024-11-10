import { Clock } from "../infrastructure/clock.js";
import { TestCaseResult, TestMarkValue, TestResult, TestSuiteResult } from "./test_result.js";
export interface TestOptions {
    config?: Record<string, unknown>;
    notifyFn?: NotifyFn;
    clock?: Clock;
}
export type NotifyFn = (testResult: TestCaseResult) => void;
export interface Describe {
    (optionalName?: string | DescribeFn, describeFn?: DescribeFn): TestSuite;
    skip: (optionalName?: string | DescribeFn, descrbeFn?: DescribeFn) => TestSuite;
    only: (optionalName?: string | DescribeFn, describeFn?: DescribeFn) => TestSuite;
}
export interface SuiteParameters {
    setTimeout: (newTimeout: Milliseconds) => void;
}
export interface TestParameters {
    getConfig: <T>(key: string) => T;
}
export type DescribeFn = (suiteUtilities: SuiteParameters) => void;
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
    static _create(nameOrSuiteFn: string | DescribeFn | undefined, possibleSuiteFn: DescribeFn | undefined, mark: TestMarkValue): TestSuite;
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
export declare function test(optionalName?: string | DescribeFn, fn?: DescribeFn): TestSuite;
export declare namespace test {
    var skip: (optionalName?: string | DescribeFn, fn?: DescribeFn) => TestSuite;
    var only: (optionalName?: string | DescribeFn, fn?: DescribeFn) => TestSuite;
}
export declare function describe(optionalName?: string | DescribeFn, fn?: DescribeFn): void;
export declare namespace describe {
    var skip: (optionalName?: string | DescribeFn, fn?: DescribeFn) => void;
    var only: (optionalName?: string | DescribeFn, fn?: DescribeFn) => void;
}
export declare function it(name: string, fnAsync?: ItFn): void;
export declare namespace it {
    var skip: (name: string, fnAsync?: ItFn) => void;
    var only: (name: string, fnAsync?: ItFn) => void;
}
export declare function beforeAll(fnAsync: Test): void;
export declare function afterAll(fnAsync: Test): void;
export declare function beforeEach(fnAsync: Test): void;
export declare function afterEach(fnAsync: Test): void;
export {};
