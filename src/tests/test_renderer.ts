// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."

import * as ensure from "../util/ensure.js";
import { TestCaseResult, TestResult, TestStatus, TestSuiteResult } from "./test_result.js";
import { TestMark, TestMarkValue } from "./test_suite.js";
import { Colors } from "../infrastructure/colors.js";
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

const PROGRESS_RENDERING = {
	[TestStatus.pass]: Colors.white("."),
	[TestStatus.fail]: Colors.brightRed.inverse("X"),
	[TestStatus.skip]: Colors.cyan.dim("_"),
	[TestStatus.timeout]: Colors.purple.inverse("!"),
};

const DESCRIPTION_RENDERING = {
	[TestStatus.pass]: Colors.green("passed"),
	[TestStatus.fail]: Colors.brightRed("failed"),
	[TestStatus.skip]: Colors.brightCyan("skipped"),
	[TestStatus.timeout]: Colors.brightPurple("timeout"),
};

interface NodeError extends Error {
	stack: string;
}

export class TestRenderer {

	static create() {
		return new TestRenderer();
	}

	/**
	 * @returns {string} A single character representing this test result: a dot for passed, a red X for failed, etc.
	 */
	renderTestsAsSingleCharacters(testResult: TestResult): string {
		return this.#renderAnyResult(testResult, "", "", (testCaseResult) => {
			return PROGRESS_RENDERING[testCaseResult.status];
		});
	}

	renderTestsAsSummaryLines(testResult: TestResult): string {
		return this.#renderAnyResult(testResult, "", "\n", (testCaseResult) => {
			const status = this.renderStatusAsSingleWord(testCaseResult);
			const name = this.renderNameOnOneLine(testCaseResult);

			return `${status} ${name}`;
		});
	}

	renderTestsWithFullDetails(testResult: TestResult): string {
		return this.#renderAnyResult(testResult, "\n", "\n\n", (testCaseResult) => {
			const name = this.renderNameOnMultipleLines(testCaseResult);
			const status = this.renderStatusWithMultiLineDetails(testCaseResult);

			return `${name}\n${status}`;
		});
	}

	#normalizedName(testResult: TestResult) {
		return testResult.name.length === 0 ? [ "(no name)" ] : [ ...testResult.name ];
	}

	renderNameOnOneLine(testCaseResult: TestCaseResult) {
		ensure.signature(arguments, [ TestCaseResult ]);

		const filename = testCaseResult.filename === undefined
			? ""
			: highlightColor(path.basename(testCaseResult.filename)) + " » ";
		const name = this.#normalizedName(testCaseResult).join(" » ");

		return `${filename}${name}`;
	}

	renderNameOnMultipleLines(testResult: TestResult): string {
		ensure.signature(arguments, [ TestResult ]);

		const name = this.#normalizedName(testResult);

		const suites = name.slice(0, name.length - 1);
		const test = name[name.length - 1];
		if (testResult.filename !== undefined) suites.unshift(path.basename(testResult.filename));

		const suitesName = suites.length > 0 ? suites.join(" » ") + "\n» " : "";
		return headerColor(suitesName + test);
	}

	renderStatusAsSingleWord(testCaseResult: TestCaseResult) {
		return DESCRIPTION_RENDERING[testCaseResult.status];
	}

	renderStatusWithMultiLineDetails(testCaseResult: TestCaseResult): string {
		switch (testCaseResult.status) {
			case TestStatus.pass:
			case TestStatus.skip:
				return DESCRIPTION_RENDERING[testCaseResult.status];
			case TestStatus.fail:
				return this.#renderFailure(testCaseResult);
			case TestStatus.timeout:
				return timeoutMessageColor(`Timed out after ${testCaseResult.timeout}ms`);
			default:
				throw new Error(`Unrecognized test result status: ${testCaseResult.status}`);
		}
	}

	renderMarkAsSingleWord(testCaseResult: TestCaseResult) {
		switch (testCaseResult.mark) {
			case TestMark.none: return "";
			case TestMark.skip: return ".skip";
			case TestMark.only: return ".only";
			default: ensure.unreachable(`Unrecognized test mark: ${testCaseResult.mark}`);
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

	#renderAnyResult(
		testResult: TestResult,
		preamble: string,
		postamble: string,
		renderFn: (testCaseResult: TestCaseResult) => string,
	): string {
		ensure.signature(arguments, [[ TestSuiteResult, TestCaseResult ], String, String, Function ]);

		if (testResult instanceof TestCaseResult) {
			return renderFn(testResult);
		}
		else if (testResult instanceof TestSuiteResult) {
			const allRenders = testResult.allTests().map(testCase => renderFn(testCase));
			return preamble + allRenders.join(postamble + preamble) + postamble;
		}
		else {
			ensure.unreachable(`Unrecognized test result class: ${testResult}`);
		}
	}

}