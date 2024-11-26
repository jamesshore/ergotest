import { Clock } from "../infrastructure/clock.js";
import { TestCaseResult, TestMarkValue, TestResult, TestSuiteResult } from "./test_result.js";
export interface TestConfig {
    [name: string]: unknown;
}
export interface TestOptions {
    timeout?: Milliseconds;
    config?: TestConfig;
    notifyFn?: NotifyFn;
    clock?: Clock;
}
export interface DescribeOptions {
    timeout?: number;
}
export interface ItOptions {
    timeout?: number;
}
export type NotifyFn = (testResult: TestCaseResult) => void;
type DescribeFn = () => void;
type ItFn = (testUtilities: TestParameters) => Promise<void> | void;
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
    notifyFn: NotifyFn;
    timeout: Milliseconds;
    config: TestConfig;
}
interface Runnable {
    _recursiveRunAsync: (parentMark: TestMarkValue, parentBeforeEachFns: BeforeAfterDefinition[], parentAfterEachFns: BeforeAfterDefinition[], options: RecursiveRunOptions) => Promise<TestResult> | TestResult;
    _isDotOnly: () => boolean;
    _isSkipped: (mark: TestMarkValue) => boolean;
}
/**
 * A simple but full-featured test runner.
 */
export declare class TestSuite implements Runnable {
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
    /** @private */
    static _create(nameOrOptionsOrDescribeFn: string | DescribeOptions | DescribeFn | undefined, optionsOrDescribeFn: DescribeOptions | DescribeFn | undefined, possibleDescribeFn: DescribeFn | undefined, mark: TestMarkValue): TestSuite;
    /** Internal use only. (Use {@link TestSuite.create} or {@link TestSuite.fromModulesAsync} instead.) */
    constructor(name: string, mark: TestMarkValue, { tests, beforeAllFns, afterAllFns, beforeEachFns, afterEachFns, timeout, }: {
        tests?: Runnable[];
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
     * @param {(result: TestResult) => ()} [notifyFn] A function to call each time a test completes. The `result`
     *   parameter describes the result of the test—whether it passed, failed, etc.
     * @param {Clock} [clock] The clock to use. Meant for internal use.
     * @returns {Promise<TestSuiteResult>} The results of the test suite.
     */
    runAsync({ timeout, config, notifyFn, clock, }?: TestOptions): Promise<TestSuiteResult>;
    /** @private */
    _setFilename(filename: string): void;
    /** @private */
    _isDotOnly(): boolean;
    /** @private */
    _isSkipped(): boolean;
    /** @private */
    _recursiveRunAsync(parentMark: TestMarkValue, parentBeforeEachFns: BeforeAfterDefinition[], parentAfterEachFns: BeforeAfterDefinition[], options: RecursiveRunOptions): Promise<TestSuiteResult>;
}
/**
 * Defines a test suite. Add `.skip` to skip this test suite and `.only` to only run this test suite.
 * @param {string} [optionalName] The name of the test suite. You can skip this parameter and pass
 *   {@link optionalOptions} or {@link fn} instead.
 * @param {DescribeOptions} [optionalOptions] The test suite options. You can skip this parameter and pass {@link fn}
 *   instead.
 * @param {function} [fn] The body of the test suite. In the body, call {@link describe}, {@link it}, {@link
 *   beforeAll}, {@link afterAll}, {@link beforeEach}, and {@link afterEach} to define the tests in the suite. If
 *   undefined, this test suite will be skipped.
 * @returns {TestSuite} The test suite. You’ll typically ignore the return value.
 */
export declare function describe(optionalName?: string | DescribeOptions | DescribeFn, optionalOptions?: DescribeOptions | DescribeFn, fn?: DescribeFn): TestSuite;
export declare namespace describe {
    var skip: (optionalName?: string | DescribeOptions | DescribeFn, optionalOptions?: DescribeOptions | DescribeFn, fn?: DescribeFn) => TestSuite;
    var only: (optionalName?: string | DescribeOptions | DescribeFn, optionalOptions?: DescribeOptions | DescribeFn, fn?: DescribeFn) => TestSuite;
}
/**
 * Adds a test to the current test suite. Must be run inside of a {@link test} or {@link describe} function. Add
 * `.skip` to skip this test and `.only` to only run this test.
 * @param {string} name The name of the test.
 * @param {ItOptions} [optionalOptions] The test options. You can skip this parameter and pass {@link fnAsync} instead.
 * @param {function} [fnAsync] The body of the test. May be synchronous or asynchronous. If undefined, this test will be
 *   skipped.
 */
export declare function it(name: string, optionalOptions?: ItOptions | ItFn, fnAsync?: ItFn): void;
export declare namespace it {
    var skip: (name: string, optionalOptions?: ItOptions | ItFn, fnAsync?: ItFn) => void;
    var only: (name: string, optionalOptions?: ItOptions | ItFn, fnAsync?: ItFn) => void;
}
/**
 * Adds a function to run before all the tests in the current test suite. Must be run inside of a {@link test} or
 * {@link describe} function.
 * @param {ItOptions} [optionalOptions] The before/after options. You can skip this parameter and pass @{link fnAsync}
 *   instead.
 * @param {function} fnAsync The function to run. May be synchronous or asynchronous.
 */
export declare function beforeAll(optionalOptions: ItOptions | ItFn, fnAsync?: ItFn): void;
/**
 * Adds a function to run after all the tests in the current test suite. Must be run inside of a {@link test} or
 * {@link describe} function.
 * @param {ItOptions} [optionalOptions] The before/after options. You can skip this parameter and pass @{link fnAsync}
 *   instead.
 * @param {function} [fnAsync] The function to run. May be synchronous or asynchronous.
 */
export declare function afterAll(optionalOptions: ItOptions | ItFn, fnAsync?: ItFn): void;
/**
 * Adds a function to run bfeore each of the tests in the current test suite. Must be run inside of a {@link test} or
 * {@link describe} function.
 * @param {ItOptions} [optionalOptions] The before/after options. You can skip this parameter and pass @{link fnAsync}
 *   instead.
 * @param {function} [fnAsync] The function to run. May be synchronous or asynchronous.
 */
export declare function beforeEach(optionalOptions: ItOptions | ItFn, fnAsync?: ItFn): void;
/**
 * Adds a function to run after each of the tests in the current test suite. Must be run inside of a {@link test} or
 * {@link describe} function.
 * @param {ItOptions} [optionalOptions] The before/after options. You can skip this parameter and pass @{link fnAsync}
 *   instead.
 * @param {function} [fnAsync] The function to run. May be synchronous or asynchronous.
 */
export declare function afterEach(optionalOptions: ItOptions | ItFn, fnAsync?: ItFn): void;
export {};
