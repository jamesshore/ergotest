import { RunResult, TestCaseResult, TestMarkValue, TestResult, TestStatusValue, TestSuiteResult } from "./test_result.js";
import { AssertionError } from "node:assert";
import { SourceMap } from "../../infrastructure/source_map.js";
/**
 * Converts an error into a detailed description of a test failure. Intended to be used with {@link TestOptions}
 * rather than called directly.
 * @param {string[]} name The names of the test
 * @param {unknown} error The error that occurred
 * @param {string} [filename] The file that contained the test, if known
 * @return The description
 */
export declare function renderError(name: string[], error: unknown, filename?: string): string;
/**
 * Provides an error's stack trace, or "" if there wasn't one. If `filename` is provided, the stack frames that
 * correspond to the filename will be highlighted.
 * @param {unknown} error The error
 * @param {string} [filename] The filename to highlight
 * @param [sourceMap] Internal use only
 * @returns {string} The stack trace for the test, or "" if there wasn't one.
 */
export declare function renderStack(error: Error, filename?: string, sourceMap?: SourceMap): string;
/**
 *
 * @returns {string} A comparison of expected and actual values, or "" if there weren't any.
 */
export declare function renderDiff(error: AssertionError): string;
export declare class TestRenderer {
    #private;
    static create(): TestRenderer;
    /**
     * @param {TestSuiteResult} testSuiteResult The test suite to render.
     * @param {number} [elapsedMs] The total time required to run the test suite, in milliseconds.
     * @returns {string} A summary of the results of a test suite, including the average time required per test if
     *   `elapsedMs` is defined.
     */
    renderSummary(testSuiteResult: TestSuiteResult, elapsedMs?: number): string;
    /**
     * @param {TestCaseResult | TestCaseResult[]} The tests to render.
     * @returns {string} A single character for each test: a dot for passed, a red X for failed, etc.
     */
    renderAsCharacters(testCaseResults: TestCaseResult | TestCaseResult[]): string;
    /**
     * @param {TestCaseResult | TestCaseResult[]} The tests to render.
     * @returns {string} A line for each test with the status (passed, failed, etc.) and the test name.
     */
    renderAsSingleLines(testCaseResults: TestCaseResult | TestCaseResult[]): string;
    /**
     * @param {TestCaseResult | TestCaseResult[]} The tests to render.
     * @returns {string} A full explanation of this test result.
     */
    renderAsMultipleLines(testCaseResults: TestCaseResult | TestCaseResult[]): string;
    /**
     * @param {TestResult | TestResult[]} The tests or suites to render.
     * @returns {string} A line for each test or suite that's marked (.only, .skip, etc.) with the mark and the test name.
     */
    renderMarksAsLines(testResults: TestResult | TestResult[]): string;
    /**
     * @param { string[] } name The name to render.
     * @param { string? } [filename] The filename to render.
     * @returns {string} The name of the test, including parent suites and filename, rendered as a single line. Only the
     *   filename is rendered; the rest of the path is ignored.
     */
    renderNameOnOneLine(name: string[], filename?: string): string;
    /**
     * @param { string[] } name The name to render.
     * @param { string? } [filename] The filename to render.	 *
     * @returns {string} The name of the test, including parent suites and filename, with the suites and filename
     *   rendered on a separate line. Only the filename is rendered; the rest of the path is ignored.
     */
    renderNameOnMultipleLines(name: string[], filename?: string): string;
    /**
     * @param { TestStatusValue } status The status to render.
     * @returns {string} The color-coded status.
     */
    renderStatusAsSingleWord(status: TestStatusValue): string;
    /**
     * @param { RunResult } status The result to render.
     * @returns { string } The color-coded status, including error and timeout details where appropriate.
     */
    renderStatusWithMultiLineDetails(runResult: RunResult): string;
    /**
     * @param { TestMarkValue } mark The mark.
     * @returns {string} The color-coded mark of the test result (.only, etc.), or "" if the test result wasn't marked.
     */
    renderMarkAsSingleWord(mark: TestMarkValue): string;
}
