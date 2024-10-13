// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."

import * as ensure from "../util/ensure.js";
import { TestCaseResult, TestMark, TestResult, TestStatus, TestSuiteResult } from "./test_result.js";
import { ColorFn, Colors } from "../infrastructure/colors.js";
import path from "node:path";
import { AssertionError } from "node:assert";
import util from "node:util";

const headerColor = Colors.brightWhite.bold;
const highlightColor = Colors.brightWhite;
const errorMessageColor = Colors.brightRed;
const timeoutMessageColor = Colors.purple;
const expectedColor = Colors.green;
const actualColor = Colors.brightRed;
const diffColor = Colors.brightYellow.bold;
const summaryColor = Colors.brightWhite.dim;

export class TestRenderer {

	static create() {
		return new TestRenderer();
	}

	// can't use a normal constant due to a circular dependency between TestResult and TestRenderer
	static get #PROGRESS_RENDERING() {
		return {
			[TestStatus.pass]: ".",
			[TestStatus.fail]: Colors.brightRed.inverse("X"),
			[TestStatus.skip]: Colors.cyan.dim("_"),
			[TestStatus.timeout]: Colors.purple.inverse("!"),
		};
	}

	// can't use a normal constant due to a circular dependency between TestResult and TestRenderer
	static get #DESCRIPTION_RENDERING() {
		return {
			[TestStatus.pass]: Colors.green("passed"),
			[TestStatus.fail]: Colors.brightRed("failed"),
			[TestStatus.skip]: Colors.brightCyan("skipped"),
			[TestStatus.timeout]: Colors.brightPurple("timeout"),
		};
	}

	/**
	 * @param {TestSuiteResult} testSuiteResult The test suite to render.
	 * @param {number} elapsedMs The total time required to run the test suite, in milliseconds.
	 * @returns {string} A summary of the results of a test suite, including the average time required per test.
	 */
	renderSummary(testSuiteResult: TestSuiteResult, elapsedMs?: number): string {
		ensure.signature(arguments, [ TestSuiteResult, [ undefined, Number ]]);

		const { total, pass, fail, timeout, skip } = testSuiteResult.count();

		const renders = [
			renderCount(fail, "failed", Colors.brightRed),
			renderCount(timeout, "timed out", Colors.purple),
			renderCount(skip, "skipped", Colors.cyan),
			renderCount(pass, "passed", Colors.green),
			renderMsEach(elapsedMs, total, skip),
		].filter(render => render !== "");

		return summaryColor("(") + renders.join(summaryColor("; ")) + summaryColor(")");

		function renderCount(number: number, description: string, color: ColorFn): string {
			if (number === 0) {
				return "";
			}
			else {
				return color(`${number} ${description}`);
			}
		}

		function renderMsEach(elapsedMs: number | undefined, total: number, skip: number): string {
			if (total - skip === 0) return summaryColor("none ran");
			if (elapsedMs === undefined) return "";

			const msEach = (elapsedMs / (total - skip)).toFixed(1);
			return summaryColor(`${msEach}ms avg.`);
		}
	}

	/**
	 * @returns {string} A single character for each test: a dot for passed, a red X for failed, etc.
	 */
	renderAsCharacters(testCaseResults: TestCaseResult | TestCaseResult[]): string {
		ensure.signature(arguments, [[ TestCaseResult, Array ]]);

		return this.#renderMultipleResults(testCaseResults, "", TestCaseResult, (testResult: TestCaseResult) => {
			return (TestRenderer.#PROGRESS_RENDERING)[testResult.status];
		});
	}

	/**
	 * @returns {string} A line for each test with the status (passed, failed, etc.) and the test name.
	 */
	renderAsSingleLines(testCaseResults: TestCaseResult | TestCaseResult[]): string {
		ensure.signature(arguments, [[ TestCaseResult, Array ]]);

		return this.#renderMultipleResults(testCaseResults, "\n", TestCaseResult, (testResult: TestCaseResult) => {
			const status = this.renderStatusAsSingleWord(testResult);
			const name = this.renderNameOnOneLine(testResult);

			return `${status} ${name}`;
		});
	}

	/**
	 * @returns {string} A full explanation of this test result.
	 */
	renderAsMultipleLines(testCaseResults: TestCaseResult | TestCaseResult[]): string {
		ensure.signature(arguments, [[ TestSuiteResult, TestCaseResult, Array ]]);

		return this.#renderMultipleResults(testCaseResults, "\n\n\n", TestCaseResult, (testResult: TestCaseResult) => {
			const name = this.renderNameOnMultipleLines(testResult);
			const status = this.renderStatusWithMultiLineDetails(testResult);

			return `${name}\n\n${status}`;
		});
	}

	/**
	 * @returns {string} A line for each test that's marked (.only, .skip, etc.) with the mark and the test name.
	 */
	renderMarksAsLines(testResults: TestResult | TestResult[]): string {
		ensure.signature(arguments, [[ TestSuiteResult, TestCaseResult, Array ]]);

		return this.#renderMultipleResults(testResults, "\n", TestResult, (testResult: TestResult) => {
			const mark = this.renderMarkAsSingleWord(testResult);
			const name = this.renderNameOnOneLine(testResult);

			if (mark === "") return "";
			else return `${mark} ${name}`;
		});

	}

	/**
	 * @returns {string} The name of the test, including parent suites and filename, rendered as a single line.
	 */
	renderNameOnOneLine(testCaseResult: TestResult) {
		ensure.signature(arguments, [ TestResult ]);

		const filename = testCaseResult.filename === undefined
			? ""
			: headerColor(path.basename(testCaseResult.filename)) + " » ";
		const name = this.#normalizedName(testCaseResult).join(" » ");

		return `${filename}${name}`;
	}

	/**
	 * @returns {string} The name of the test, including parent suites and filename, with the suites and filename
	 *   rendered on a separate line.
	 */
	renderNameOnMultipleLines(testResult: TestResult): string {
		ensure.signature(arguments, [ TestResult ]);

		const name = this.#normalizedName(testResult);

		const suites = name.slice(0, name.length - 1);
		const test = name[name.length - 1];
		if (testResult.filename !== undefined) suites.unshift(path.basename(testResult.filename));

		const suitesName = suites.length > 0 ? suites.join(" » ") + "\n» " : "";
		return headerColor(suitesName + test);
	}

	#normalizedName(testResult: TestResult) {
		return testResult.name.length === 0 ? [ "(no name)" ] : [ ...testResult.name ];
	}

	/**
	 * @returns {string} The color-coded status of the test.
	 */
	renderStatusAsSingleWord(testCaseResult: TestCaseResult) {
		return TestRenderer.#DESCRIPTION_RENDERING[testCaseResult.status];
	}

	renderStatusWithMultiLineDetails(testCaseResult: TestCaseResult): string {
		switch (testCaseResult.status) {
			case TestStatus.pass:
			case TestStatus.skip:
				return TestRenderer.#DESCRIPTION_RENDERING[testCaseResult.status];
			case TestStatus.fail:
				return this.#renderFailure(testCaseResult);
			case TestStatus.timeout:
				return timeoutMessageColor(`Timed out after ${testCaseResult.timeout}ms`);
			default:
				throw new Error(`Unrecognized test result status: ${testCaseResult.status}`);
		}
	}

	/**
	 * @returns {string} The color-coded mark of the test result (.only, etc.), or "" if the test result wasn't marked.
	 */
	renderMarkAsSingleWord(testResult: TestResult) {
		switch (testResult.mark) {
			case TestMark.none: return "(no mark)";
			case TestMark.skip: return Colors.brightCyan(".skip");
			case TestMark.only: return Colors.brightCyan(".only");
			default: ensure.unreachable(`Unrecognized test mark: ${testResult.mark}`);
		}
	}

	#renderFailure(testCaseResult: TestCaseResult): string {
		const name = this.#normalizedName(testCaseResult).pop();
		const resultError = testCaseResult.error as { stack: unknown, message: unknown };

		let error;
		if (resultError?.stack !== undefined) {
			error = `${this.renderStack(testCaseResult)}`;
			if (resultError?.message !== undefined) {
				error +=
					"\n\n" +
					highlightColor(`${name} »\n`) +
					errorMessageColor(`${resultError.message}`);
			}
		}
		else {
			error = errorMessageColor(`${testCaseResult.error}`);
		}

		const diff = (testCaseResult.error instanceof AssertionError) ?
			"\n\n" + this.renderDiff(testCaseResult.error) :
			"";

		return `${error}${diff}`;
	}

	/**
	 * @returns {string} The stack trace for the test, or "" if there wasn't one.
	 */
	renderStack(testCaseResult: TestCaseResult): string {
		const testCaseError = testCaseResult.error as undefined | { stack: unknown };
		if (testCaseError?.stack === undefined) return "";

		const stack = testCaseError.stack;
		if (typeof stack !== "string") return `${stack}`;

		const filename = testCaseResult.filename;
		if (filename === undefined) return stack;

		const lines = stack.split("\n");
		const highlightedLines = lines.map(line => {
			if (!line.includes(filename)) return line;

			line = line.replace(/    at/, "--> at");	// this code is vulnerable to changes in Node.js rendering
			return headerColor(line);
		});
		return highlightedLines.join("\n");
	}

	/**
	 * @returns {string} A comparison of expected and actual values, or "" if there weren't any.
	 */
	renderDiff(error: AssertionError): string {
		if (error.expected === undefined && error.actual === undefined) return "";
		if (error.expected === null && error.actual === null) return "";

		const expected = util.inspect(error.expected, { depth: Infinity }).split("\n");
		const actual = util.inspect(error.actual, { depth: Infinity }).split("\n");
		if (expected.length > 1 || actual.length > 1) {
			for (let i = 0; i < Math.max(expected.length, actual.length); i++) {
				const expectedLine = expected[i];
				const actualLine = actual[i];

				if (expectedLine !== actualLine) {
					if (expected[i] !== undefined) expected[i] = diffColor(expected[i]!);
					if (actual[i] !== undefined) actual[i] = diffColor(actual[i]!);
				}
			}
		}

		return "" +
			expectedColor("expected: ") + expected.join("\n") + "\n" +
			actualColor("actual:   ") + actual.join("\n");
	}

	#renderMultipleResults<T>(
		testResults: T | T[],
		separator: string,
		expectedType: Function,   // eslint-disable-line @typescript-eslint/no-unsafe-function-type
		renderFn: (testResult: T) => string,
	): string {
		if (!Array.isArray(testResults)) testResults = [ testResults ];
		testResults.forEach((result, i) => ensure.type(result, expectedType, `testResult[${i}]`));

		return testResults.map(result => renderFn(result)).join(separator);
	}

}