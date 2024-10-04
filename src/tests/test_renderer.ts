// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."

import * as ensure from "../util/ensure.js";
import { TestStatus, TestResultFactory, TestSuiteResult, TestCaseResult } from "./test_result.js";
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
	renderCharacter(testResult: TestResultFactory): string {
		return this.#render(testResult, (testCaseResult) => {
			return PROGRESS_RENDERING[testCaseResult.status];
		});
	}

	renderSingleLine(testResult: TestResultFactory): string {
		return this.#render(
			testResult,
			(testCaseResult) => {
				const description = DESCRIPTION_RENDERING[testCaseResult.status];
				const filename = testCaseResult.filename === undefined
					? ""
					: highlightColor(path.basename(testCaseResult.filename)) + " » ";
				const name = testCaseResult.name.length === 0 ? "(no name)" : testCaseResult.name.join(" » ");

				return `${description} ${filename}${name}\n`;
			},
		);
	}

	renderMultiLine(testResult: TestResultFactory): string {
		return this.#render(testResult, (testCaseResult) => {
			return this.#renderMultiLineName(testCaseResult) + this.#renderMultiLineBody(testCaseResult);
		});
	}

	#render(testResult: TestResultFactory, renderFn: (testCaseResult: TestCaseResult) => string): string {
		ensure.signature(arguments, [[ TestSuiteResult, TestCaseResult ], Function ]);

		if (testResult instanceof TestCaseResult) {
			return renderFn(testResult);
		}
		else if (testResult instanceof TestSuiteResult) {
			const allRenders = testResult.allTests().map(testCase => renderFn(testCase));
			return allRenders.join("");
		}
		else {
			ensure.unreachable(`Unrecognized test result class: ${testResult}`);
		}
	}

	#renderMultiLineName(testCaseResult: TestCaseResult): string {
		const name = testCaseResult.name;

		const suites = name.slice(0, name.length - 1);
		const test = name[name.length - 1];
		if (testCaseResult.filename !== undefined) suites.unshift(path.basename(testCaseResult.filename));

		const suitesName = suites.length > 0 ? suites.join(" » ") + "\n» " : "";
		return headerColor(suitesName + test + "\n");
	}

	#renderMultiLineBody(testCaseResult: TestCaseResult): string {
		switch (testCaseResult.status) {
			case TestStatus.pass:
			case TestStatus.skip:
				return `\n${DESCRIPTION_RENDERING[testCaseResult.status]}\n`;
			case TestStatus.fail:
				return this.#renderFailure(testCaseResult);
			case TestStatus.timeout:
				return timeoutMessageColor(`\nTimed out after ${testCaseResult.timeout}ms\n`);
			default:
				throw new Error(`Unrecognized test result status: ${testCaseResult.status}`);
		}
	}

	#renderFailure(testCaseResult: TestCaseResult): string {
		const name = testCaseResult.name;

		let renderedError;
		if (testCaseResult.error instanceof Error && (testCaseResult.error as NodeError).stack !== undefined) {
			const nodeError = testCaseResult.error as NodeError;
			renderedError = `\n${this.#renderStack(testCaseResult.filename, nodeError.stack)}\n` +
				highlightColor(`\n${name[name.length - 1]} »\n`) +
				errorMessageColor(`${nodeError.message}\n`);
		}
		else {
			renderedError = errorMessageColor(`\n${testCaseResult.error}\n`);
		}
		const diff = this.#renderDiff(testCaseResult.error as AssertionError);

		return `${renderedError}${diff}`;
	}

	#renderStack(filename: string | undefined, stack: string): string {
		if (filename === undefined) return stack;

		const renderedStack = stack.split("\n");
		const highlighted = renderedStack.map(line => {
			if (!line.includes(filename)) return line;

			line = line.replace(/    at/, "--> at");	// this code is vulnerable to changes in Node.js rendering
			return headerColor(line);
		});
		return highlighted.join("\n");
	}

	#renderDiff(error: AssertionError): string {
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

		return "\n" +
			expectedColor("expected: ") + expected.join("\n") + "\n" +
			actualColor("actual:   ") + actual.join("\n") + "\n";
	}

}