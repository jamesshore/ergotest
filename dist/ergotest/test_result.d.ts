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
    name: string[];
    mark: TestMarkValue;
    filename?: string;
    status: TestStatusValue;
    errorMessage?: string;
    errorRender?: unknown;
    timeout?: number;
}
export type RenderErrorFn = (names: string[], error: unknown, mark: TestMarkValue, filename?: string) => unknown;
/**
 * The result of a test run. Can be a single test case or a suite of nested test results.
 */
export declare abstract class TestResult {
    /**
     * Create a TestResult for a suite of tests.
     * @param {string|string[]} name The name of the test. Can be a list of names.
     * @param {TestResult[]} tests The nested tests in this suite (can be test suites or individual test cases).
     * @param {TestCaseResult[]} [options.beforeAll] The beforeAll() blocks in this suite.
     * @param {TestCaseResult[]} [options.afterAll] The afterAll() blocks in this suite.
     * @param {string} [options.filename] The file that contained this suite (optional).
     * @param {TestMarkValue} [options.mark] Whether this suite was marked with `.skip`, `.only`, or nothing.
     * @returns {TestSuiteResult} The result.
     */
    static suite(name: string | string[], tests: TestResult[], { beforeAll, afterAll, filename, mark }?: {
        beforeAll?: TestCaseResult[];
        afterAll?: TestCaseResult[];
        filename?: string;
        mark?: TestMarkValue;
    }): TestSuiteResult;
    /**
     * Create a TestResult for a test that passed.
     * @param {string|string[]} name The name of the test. Can be a list of names.
     * @param {string} [options.filename] The file that contained this test (optional).
     * @param {TestMarkValue} [options.mark] Whether this test was marked with `.skip`, `.only`, or nothing.
     * @returns {TestCaseResult} The result.
     */
    static pass(name: string | string[], { filename, mark, }?: {
        filename?: string;
        mark?: TestMarkValue;
    }): TestCaseResult;
    /**
     * Create a TestResult for a test that failed.
     * @param {string|string[]} name The name of the test. Can be a list of names.
     * @param {unknown} error The error that occurred.
     * @param {(name: string, error: unknown, mark: TestMarkValue, filename?: string) => unknown} [options.renderError]
     *   The function to use to render the error into a string (defaults to {@link renderError})
     * @param {string} [options.filename] The file that contained this test (optional).
     * @param {TestMarkValue} [options.mark] Whether this test was marked with `.skip`, `.only`, or nothing.
     *   function will be called and the results put into {@link errorRender}.
     * @returns {TestCaseResult} The result.
     */
    static fail(name: string | string[], error: unknown, { renderError, filename, mark, }?: {
        renderError?: RenderErrorFn;
        filename?: string;
        mark?: TestMarkValue;
    }): TestCaseResult;
    /**
     * Create a TestResult for a test that was skipped.
     * @param {string|string[]} name The name of the test. Can be a list of names.
     * @param {string} [options.filename] The file that contained this test (optional).
     * @param {TestMarkValue} [options.mark] Whether this test was marked with `.skip`, `.only`, or nothing.
     * @returns {TestCaseResult} The result.
     */
    static skip(name: string | string[], { filename, mark, }?: {
        filename?: string;
        mark?: TestMarkValue;
    }): TestCaseResult;
    /**
     * Create a TestResult for a test that timed out.
     * @param {string|string[]} name The name of the test. Can be a list of names.
     * @param {number} timeout The length of the timeout.
     * @param {string} [options.filename] The file that contained this test (optional).
     * @param {TestMarkValue} [options.mark] Whether this test was marked with `.skip`, `.only`, or nothing.
     * @returns {TestCaseResult} The result.
     */
    static timeout(name: string | string[], timeout: number, { filename, mark, }?: {
        filename?: string;
        mark?: TestMarkValue;
    }): TestCaseResult;
    /**
     * For use by {@link TestRunner}. Converts a serialized test result back into a TestResult instance.
     * @param {objects} serializedTestResult The serialized test result.
     * @returns {TestSuiteResult | TestCaseResult} The result object.
     * @see TestSuiteResult#serialize
     * @see TestCaseResult#serialize
     */
    static deserialize(serializedTestResult: SerializedTestResult): TestResult;
    /**
     * @returns {string | undefined} The file that contained the test (or suite), if any.
     */
    abstract get filename(): string | undefined;
    /**
     * @returns {string []} The name of the test (or suite), and all enclosing suites, with the outermost suite first.
     *   Does not include the file name.
     */
    abstract get name(): string[];
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
    get name(): string[];
    /**
     * @returns {string | undefined} The file that contained the suite, if any.
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
     * @returns { TestResult[] } The beforeAll() blocks ran for this suite.
     */
    get beforeAll(): TestResult[];
    /**
     * @returns { TestResult[] } The afterAll() blocks ran for this suite.
     */
    get afterAll(): TestResult[];
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
    /**
     * For use by {@link TestRunner}. Converts a serialized test result back into a TestResult instance.
     * @param {object} serializedTestResult The serialized test result.
     * @returns {TestCaseResult} The result object.
     * @see TestResult#deserialize
     */
    static deserialize(serializedResult: SerializedTestCaseResult): TestCaseResult;
    private _name;
    private _filename?;
    private _status;
    private _mark;
    private _errorMessage?;
    private _errorRender?;
    private _timeout?;
    /** Internal use only. (Use {@link TestResult} factory methods instead.) */
    constructor({ name, status, errorMessage, errorRender, timeout, filename, mark, }: {
        name: string[];
        status: TestStatusValue;
        errorMessage?: string;
        errorRender?: unknown;
        timeout?: number;
        filename?: string;
        mark?: TestMarkValue;
    });
    get filename(): string | undefined;
    get name(): string[];
    /**
     * @returns {TestStatusValue} Whether this test passed, failed, etc.
     */
    get status(): TestStatusValue;
    /**
     * @return { TestMark } Whether the test was explicitly marked with `.skip`, `.only`, or not at all.
     */
    get mark(): TestMarkValue;
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
