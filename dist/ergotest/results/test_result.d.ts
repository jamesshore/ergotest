export declare const TestStatus: {
    readonly pass: "pass";
    readonly fail: "fail";
    readonly skip: "skip";
    readonly timeout: "timeout";
};
export type TestStatusValue = typeof TestStatus[keyof typeof TestStatus];
export declare const TestMark: {
    readonly none: "none";
    readonly skip: "skip";
    readonly only: "only";
};
export type TestMarkValue = typeof TestMark[keyof typeof TestMark];
export interface TestCount {
    pass: number;
    fail: number;
    skip: number;
    timeout: number;
    total: number;
}
export type SerializedTestResult = SerializedTestSuiteResult | SerializedTestCaseResult;
export interface SerializedTestSuiteResult {
    type: "TestSuiteResult";
    name: string[];
    mark: TestMarkValue;
    filename?: string;
    tests: SerializedTestResult[];
    beforeAll: SerializedTestCaseResult[];
    afterAll: SerializedTestCaseResult[];
}
export interface SerializedTestCaseResult {
    type: "TestCaseResult";
    mark: TestMarkValue;
    beforeEach: SerializedRunResult[];
    afterEach: SerializedRunResult[];
    it: SerializedRunResult;
}
export interface SerializedRunResult {
    type: "RunResult";
    name: string[];
    filename?: string;
    status: TestStatusValue;
    errorMessage?: string;
    errorRender?: unknown;
    timeout?: number;
}
export type RenderErrorFn = (names: string[], error: unknown, filename?: string) => unknown;
/**
 * The result of a running a test. Can be a single test case or a suite of nested test results.
 */
export declare abstract class TestResult {
    /**
     * For use by {@link TestRunner}. Converts a serialized test result back into a TestResult instance.
     * @param {objects} serializedTestResult The serialized test result.
     * @returns {TestSuiteResult | TestCaseResult} The result object.
     * @see TestSuiteResult#serialize
     * @see TestCaseResult#serialize
     */
    static deserialize(serializedTestResult: SerializedTestResult): TestResult;
    /**
     * @returns {string []} The name of the test (or suite), and all enclosing suites, with the outermost suite first.
     *   Does not include the file name.
     */
    abstract get name(): string[];
    /**
     * @returns {string | undefined} The file that contained the test (or suite), if known.
     */
    abstract get filename(): string | undefined;
    /**
     * @return { TestMark } Whether the test (or suite) was explicitly marked with `.skip`, `.only`, or not at all.
     */
    abstract get mark(): TestMarkValue;
    /**
     * @returns {TestCaseResult[]} All the test results, excluding test suites, flattened into a single list.
     */
    abstract allTests(): TestCaseResult[];
    /**
     * @returns {TestCaseResult[]} All test results, with a mark (.only, etc.) that matches the requested marks,
     *   flattened into a single list, including test suites. However, if you access the properties of the test suites,
     *   such as {@link TestSuiteResult.tests}, those properties won’t be filtered.
     */
    abstract allMatchingMarks(...marks: TestMarkValue[]): TestResult[];
    /**
     * Convert this result into a bare object later deserialization.
     * @returns {SerializedTestSuiteResult} The serialized object.
     * @see TestResult.deserialize
     */
    abstract serialize(): SerializedTestResult;
    /**
     * Determine if this test result is identical to another test result. To be identical, they must have the same
     * results, in the same order, with the same names, filenames, and marks (.only etc.).
     * @param {any} that The thing to compare against
     * @returns {boolean}
     */
    abstract equals(that: TestResult): boolean;
}
/**
 * The result of running a test suite.
 */
export declare class TestSuiteResult extends TestResult {
    /**
     * Create a TestSuiteResult for a suite of tests.
     * @param {string|string[]} [options.name] The name of the test. Can be a list of names.
     * @param {TestResult[]} [options.tests] The nested tests in this suite (can be test suites or individual test cases).
     * @param {TestCaseResult[]} [options.beforeAll] The beforeAll() blocks in this suite.
     * @param {TestCaseResult[]} [options.afterAll] The afterAll() blocks in this suite.
     * @param {string} [options.filename] The file that contained this suite (optional).
     * @param {TestMarkValue} [options.mark] Whether this suite was marked with `.skip`, `.only`, or nothing.
     * @returns {TestSuiteResult} The result.
     */
    static create({ name, tests, beforeAll, afterAll, filename, mark }?: {
        name?: string | string[];
        tests?: TestResult[];
        beforeAll?: TestCaseResult[];
        afterAll?: TestCaseResult[];
        filename?: string;
        mark?: TestMarkValue;
    }): TestSuiteResult;
    /**
     * For use by {@link TestRunner}. Converts a serialized test result back into a TestResult instance.
     * @param {SerializedTestSuiteResult} serializedTestResult The serialized test result.
     * @returns {TestSuiteResult} The result object.
     * @see TestResult#deserialize
     */
    static deserialize(suite: SerializedTestSuiteResult): TestSuiteResult;
    private readonly _name;
    private readonly _tests;
    private readonly _beforeAll;
    private readonly _afterAll;
    private readonly _mark;
    private readonly _filename?;
    /** Internal use only. (Use {@link TestResult.suite} instead.) */
    constructor(name: string[], tests: TestResult[], beforeAll: TestCaseResult[], afterAll: TestCaseResult[], mark: TestMarkValue, filename?: string);
    /**
     * @returns {string []} The name of the suite, and all enclosing suites, with the outermost suite first.
     *   Does not include the file name.
     */
    get name(): string[];
    /**
     * @returns {string | undefined} The file that contained the suite, if known.
     */
    get filename(): string | undefined;
    /**
     * @return { TestMarkValue } Whether the test was explicitly marked with `.skip`, `.only`, or not at all.
     */
    get mark(): TestMarkValue;
    /**
     * @returns { TestResult[] } The tests in this suite, which can either be test case results or test suite results.
     */
    get tests(): TestResult[];
    /**
     * @returns { TestCaseResult[] } The beforeAll() blocks for this suite.
     */
    get beforeAll(): TestCaseResult[];
    /**
     * @returns { TestCaseResult[] } The afterAll() blocks for this suite.
     */
    get afterAll(): TestCaseResult[];
    /**
     * Convert this suite to a nicely-formatted string. The string describes the tests that have marks (such as .only)
     * and provides details about the tests that have failed or timed out. It doesn't provide any details about the tests
     * that have passed or been skipped, except for the ones that have marks. After the details, it displays a summary of
     * the number of tests that have passed, failed, etc., and the average time required per test.
     *
     * This is a convenience method. For more control over rendering, use {@link TestRenderer} instead.
     *
     * @param {string} [preamble=""] A string to write before the test results, but only if there are any marks or errors.
     * @param {number} elapsedMs The total time required to run the test suite, in milliseconds.
     *   If there are no marks or errors, the preamble is ignored. Defaults to an empty string.
     * @returns The formatted string.
     */
    render(preamble?: string, elapsedMs?: number): string;
    /**
     * @returns {TestCaseResult[]} All the test results, excluding test suites, flattened into a single list.
     */
    allTests(): TestCaseResult[];
    /**
     * Finds all the test results that match the provided statuses.
     * @param {TestStatus[]} statuses The statuses to match.
     * @returns {TestCaseResult[]} The test results.
     */
    allMatchingTests(...statuses: TestStatusValue[]): TestCaseResult[];
    /**
     * @returns {TestCaseResult[]} All test results, with a mark (.only, etc.) that matches the requested marks,
     *   flattened into a single list, including test suites. However, if you access the properties of the test suites,
     *   such as {@link TestSuiteResult.tests}, those properties won’t be filtered.
     */
    allMarkedResults(): TestResult[];
    allMatchingMarks(...marks: TestMarkValue[]): TestResult[];
    /**
     * @returns {string[]} All the test files with 100% passing tests--nothing that was skipped, failed, or timed out.
     */
    allPassingFiles(): string[];
    /**
     * @returns {TestCount} A summary count of this suite's results. Includes a count of each type of test result and the
     *   total number of tests.
     */
    count(): TestCount;
    /**
     * Convert this suite into a bare object later deserialization.
     * @returns {SerializedTestSuiteResult} The serialized object.
     * @see TestResult.deserialize
     */
    serialize(): SerializedTestSuiteResult;
    equals(that: TestResult): boolean;
}
/**
 * The result of running an individual test.
 */
export declare class TestCaseResult extends TestResult {
    private readonly _mark;
    private _beforeEach;
    private _afterEach;
    private readonly _it;
    static create({ mark, beforeEach, afterEach, it, }: {
        mark?: TestMarkValue;
        beforeEach?: RunResult[];
        afterEach?: RunResult[];
        it: RunResult;
    }): TestCaseResult;
    /**
     * For use by {@link TestRunner}. Converts a serialized test result back into a TestResult instance.
     * @param {object} serializedResult The serialized test result.
     * @returns {TestCaseResult} The result object.
     * @see TestResult#deserialize
     */
    static deserialize({ mark, beforeEach, afterEach, it }: SerializedTestCaseResult): TestCaseResult;
    /** Internal use only. (Use {@link TestResult} factory methods instead.) */
    constructor({ beforeEach, afterEach, it, mark, }: {
        beforeEach?: RunResult[];
        afterEach?: RunResult[];
        it: RunResult;
        mark?: TestMarkValue;
    });
    /**
     * @returns {string []} The name of the test, and all enclosing suites, with the outermost suite first.
     *   Does not include the file name.
     */
    get name(): string[];
    /**
     * @returns {string | undefined} The file that contained the test, if known.
     */
    get filename(): string | undefined;
    /**
     * @returns {TestStatusValue} Whether this test passed, failed, etc., taking into account the status of beforeEach()
     *   and afterEach() results.
     */
    get status(): TestStatusValue;
    /**
     * @return { TestMark } Whether the test was explicitly marked with `.skip`, `.only`, or not at all.
     */
    get mark(): TestMarkValue;
    /**
     * @returns { RunResult[] } The beforeEach() blocks for this test.
     */
    get beforeEach(): RunResult[];
    /**
     * @returns { RunResult[] } The afterEach() blocks for this test.
     */
    get afterEach(): RunResult[];
    /**
     * @returns { RunResult } The it() result for this test.
     */
    get it(): RunResult;
    /**
     * @returns {string} A short description of the reason this test failed. If the error is an Error instance, it's
     *   equal to the error's `message` property. Otherwise, the error is converted to a string using `util.inspect()`.
     * @throws {Error} Throws an error if this test didn't fail.
     */
    get errorMessage(): string;
    /**
     * @returns {unknown} The complete rendering of the reason this test failed. May be of any type, depending on how
     *   `renderError()` in TestOptions is defined, but it defaults to a string.
     * @throws {Error} Throws an error if this test didn't fail.
     */
    get errorRender(): unknown;
    /**
     * @returns {number} The timeout that this test didn't satisfy. Note that this is not the actual amount of run time
     *   of the test.
     * @throws {Error} Throws an error if this test didn't time out.
     */
    get timeout(): number;
    /**
     * @returns {boolean} True if this test passed.
     */
    isPass(): boolean;
    /**
     * @returns {boolean} True if this test failed.
     */
    isFail(): boolean;
    /**
     * @returns {boolean} True if this test was skipped.
     */
    isSkip(): boolean;
    /**
     * @returns {boolean} True if this test timed out.
     */
    isTimeout(): boolean;
    /**
     * Render the test case as a single color-coded character.
     *
     * This is a convenience method that calls {@link TestRenderer.renderAsCharacters()}. For more control over rendering,
     * use that class instead.
     *
     * @returns The formatted character.
     */
    renderAsCharacter(): string;
    /**
     * Render the test case as a single line containing its status (pass, fail, etc.) and names.
     *
     * This is a convenience method that calls {@link TestRenderer.renderAsSingleLines()}. For more control over
     * rendering, use that class instead.
     *
     * @returns The formatted line.
     */
    renderAsSingleLine(): string;
    /**
     * Render the test case as a multiple lines containing all of its details.
     *
     * This is a convenience method that calls {@link TestRenderer.renderAsMultipleLines()}. For more control over
     * rendering, use that class instead.
     *
     * @returns The formatted lines.
     */
    renderAsMultipleLines(): string;
    /**
     * @returns {TestCaseResult[]} This test converted into a list of one.
     */
    allTests(): TestCaseResult[];
    allMatchingMarks(...marks: TestMarkValue[]): TestResult[];
    /**
     * Convert this result into a bare object later deserialization.
     * @returns {object} The serialized object.
     * @see TestResult.deserialize
     */
    serialize(): SerializedTestCaseResult;
    equals(that: TestResult): boolean;
}
/**
 * The result of running an individual test function, such as beforeAll(), afterAll(), beforeEach(), afterEach(), or
 * it().
 */
export declare class RunResult {
    private readonly _name;
    private readonly _filename?;
    private readonly _status;
    private readonly _errorMessage?;
    private readonly _errorRender?;
    private readonly _timeout?;
    /**
     * Create a RunResult for a test function that completed normally.
     * @param {string|string[]} options.name The name of the test function. Can be a list of names.
     * @param {string} [options.filename] The file that contained this test function (optional).
     * @returns {RunResult} The result.
     */
    static pass({ name, filename, }: {
        name: string | string[];
        filename?: string;
    }): RunResult;
    /**
     * Create a TestResult for a test function that threw an exception.
     * @param {string|string[]} options.name The name of the test function. Can be a list of names.
     * @param {string} [options.filename] The file that contained this test (optional).
     * @param {unknown} options.error The error that occurred.
     * @param {(name: string, error: unknown, mark: TestMarkValue, filename?: string) => unknown} [options.renderError]
     *   The function to use to render the error into a string (defaults to {@link renderError})
     * @returns {RunResult} The result.
     */
    static fail({ name, filename, error, renderError, }: {
        name: string | string[];
        filename?: string;
        error: unknown;
        renderError?: RenderErrorFn;
    }): RunResult;
    /**
     * Create a RunResult for a test function that was skipped.
     * @param {string|string[]} options.name The name of the test function. Can be a list of names.
     * @param {string} [options.filename] The file that contained this test (optional).
     * @returns {RunResult} The result.
     */
    static skip({ name, filename, }: {
        name: string | string[];
        filename?: string;
    }): RunResult;
    /**
     * Create a RunResult for a test function that timed out.
     * @param {string|string[]} options.name The name of the test function. Can be a list of names.
     * @param {string} [options.filename] The file that contained this test (optional).
     * @param {number} options.timeout The length of the timeout (not the actual time taken by the function).
     * @returns {TestCaseResult} The result.
     */
    static timeout({ name, filename, timeout, }: {
        name: string | string[];
        filename?: string;
        timeout: number;
    }): RunResult;
    /**
     * For use by {@link TestRunner}. Converts a serialized run result back into a RunResult instance.
     * @param {object} serializedResult The serialized run result.
     * @returns {TestRunResult} The result object.
     * @see TestResult#deserialize
     */
    static deserialize(serializedResult: SerializedRunResult): RunResult;
    /**
     * @private
     */
    constructor({ name, filename, status, errorMessage, errorRender, timeout, }: {
        name: string | string[];
        filename?: string;
        status: TestStatusValue;
        errorMessage?: string;
        errorRender?: unknown;
        timeout?: number;
    });
    /**
     * @returns {string []} The name of the test function, and all enclosing suites, with the outermost suite first.
     *   Does not include the file name.
     */
    get name(): string[];
    /**
     * @returns {string | undefined} The file that contained the test function, if known.
     */
    get filename(): string | undefined;
    /**
     * @returns {TestStatusValue} Whether this test function passed (completed normally), failed (threw an exception),
     *   timed out, or was skipped.
     */
    get status(): TestStatusValue;
    /**
     * @returns {string} A short description of the reason this test failed. If the error is an Error instance, it's
     *   equal to the error's `message` property. Otherwise, the error is converted to a string using `util.inspect()`.
     * @throws {Error} Throws an error if this test didn't fail.
     */
    get errorMessage(): string;
    /**
     * @returns {unknown} The complete rendering of the reason this test failed. May be of any type, depending on how
     *   `renderError()` in TestOptions is defined, but it defaults to a string.
     * @throws {Error} Throws an error if this test didn't fail.
     */
    get errorRender(): unknown;
    /**
     * @returns {number} The timeout that this test didn't satisfy. Note that this is not the actual amount of run time
     *   of the test.
     * @throws {Error} Throws an error if this test didn't time out.
     */
    get timeout(): number;
    equals(that: RunResult): boolean;
    /**
     * Convert this result into a bare object later deserialization.
     * @returns {object} The serialized object.
     * @see RunResult.deserialize
     */
    serialize(): SerializedRunResult;
}
