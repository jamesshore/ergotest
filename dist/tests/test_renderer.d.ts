import { TestCaseResult, TestMarkValue, TestResult, TestSuiteResult } from "./test_result.js";
import { AssertionError } from "node:assert";
import { SourceMap } from "../infrastructure/source_map.js";
/**
 * Converts an error into a detailed description of a test failure. Intended to be used with {@link TestOptions}
 * rather than called directly.
 * @param {string[]} name The names of the test
 * @param {unknown} error The error that occurred
 * @param {TestMarkValue} mark Whether the test was marked '.skip', '.only', etc.
 * @param {string} [filename] The file that contained the test, if known
 * @return The description
 */
export declare function renderError(name: string[], error: unknown, mark: TestMarkValue, filename?: string): string;
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
     * @returns {string} A single character for each test: a dot for passed, a red X for failed, etc.
     */
    renderAsCharacters(testCaseResults: TestCaseResult | TestCaseResult[]): string;
    /**
     * @returns {string} A line for each test with the status (passed, failed, etc.) and the test name.
     */
    renderAsSingleLines(testCaseResults: TestCaseResult | TestCaseResult[]): string;
    /**
     * @returns {string} A full explanation of this test result.
     */
    renderAsMultipleLines(testCaseResults: TestCaseResult | TestCaseResult[]): string;
    /**
     * @returns {string} A line for each test that's marked (.only, .skip, etc.) with the mark and the test name.
     */
    renderMarksAsLines(testResults: TestResult | TestResult[]): string;
    /**
     * @returns {string} The name of the test, including parent suites and filename, rendered as a single line.
     */
    renderNameOnOneLine(testCaseResult: TestResult): string;
    /**
     * @returns {string} The name of the test, including parent suites and filename, with the suites and filename
     *   rendered on a separate line.
     */
    renderNameOnMultipleLines(testResult: TestResult): string;
    /**
     * @returns {string} The color-coded status of the test.
     */
    renderStatusAsSingleWord(testCaseResult: TestCaseResult): string;
    renderStatusWithMultiLineDetails(testCaseResult: TestCaseResult): string;
    /**
     * @returns {string} The color-coded mark of the test result (.only, etc.), or "" if the test result wasn't marked.
     */
    renderMarkAsSingleWord(testResult: TestResult): string;
}
