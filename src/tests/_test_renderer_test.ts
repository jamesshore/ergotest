// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."

import { assert, test } from "tests";
import { TestRenderer } from "./test_renderer.js";
import { AssertionError } from "node:assert";
import { TestCaseResult, TestResult, TestSuiteResult } from "./test_result.js";
import { Colors } from "../infrastructure/colors.js";
import { TestMark, TestMarkValue } from "./test_suite.js";

const headerColor = Colors.brightWhite.bold;
const highlightColor = Colors.brightWhite;

export default test(({ describe }) => {

	describe("test suites", ({ it }) => {

		it("renders single characters all in a row", () => {
			const result = createSuite({ children: [
				createPass(),
				createFail(),
				createSuite({ children: [ createSkip() ]}),
			]});

			assert.equal(renderCharacterTest(result),
				renderCharacterTest(createPass()) +
				renderCharacterTest(createFail()) +
				renderCharacterTest(createSkip())
			);
		});

		it("renders single lines on consecutive lines", () => {
			const result = createSuite({ children: [
				createPass(),
				createFail(),
				createSuite({ children: [ createSkip() ]}),
			]});

			assert.equal(renderSingleLineTest(result),
				renderSingleLineTest(createPass()) + "\n" +
				renderSingleLineTest(createFail()) + "\n" +
				renderSingleLineTest(createSkip()) + "\n"
			);
		});

		it("renders multiple lines with a gap before and after", () => {
			const fail = createFail();    // have to use the same fail each time, or the stack trace will be different

			const result = createSuite({ children: [
				createPass(),
				fail,
				createSuite({ children: [ createSkip() ]}),
			]});

			assert.equal(renderMultiLineTest(result),
				"\n" + renderMultiLineTest(createPass()) + "\n\n" +
				"\n" + renderMultiLineTest(fail) + "\n\n" +
				"\n" + renderMultiLineTest(createSkip()) + "\n\n"
			);
		});

		it("renders single-line marks on consecutive lines, skipping tests without no marks", () => {
			const skip = createPass({ mark: TestMark.skip });
			const none = createPass({ mark: TestMark.none });
			const only = createPass({ mark: TestMark.only });

			const result = createSuite({ children: [ skip, none, only ]});
			assert.equal(renderSingleLineMark(result),
				renderSingleLineMark(skip) + "\n" +
				renderSingleLineMark(only) + "\n"
			);
		});

		it("renders multi-line marks with a gap before and after");

	});


	describe("single-character cases", ({ it }) => {

		it("renders progress marker", () => {
			assert.equal(renderCharacterTest(createPass()), Colors.white("."), "pass");
			assert.equal(renderCharacterTest(createFail()), Colors.brightRed.inverse("X"), "fail");
			assert.equal(renderCharacterTest(createSkip()), Colors.cyan.dim("_"), "skip");
			assert.equal(renderCharacterTest(createTimeout()), Colors.purple.inverse("!"), "timeout");
		});

	});


	describe("single-line test cases", ({ it }) => {

		it("pass", () => {
			const result = createPass({ name: "my name" });
			assert.equal(renderSingleLineTest(result), Colors.green("passed") + " my name");
		});

		it("skip", () => {
			const result = createSkip({ name: "my name" });
			assert.equal(renderSingleLineTest(result), Colors.brightCyan("skipped") + " my name");
		});

		it("timeout", () => {
			const result = createTimeout({ name: "my name" });
			assert.equal(renderSingleLineTest(result), Colors.brightPurple("timeout") + " my name");
		});

		it("fail", () => {
			const result = createFail({ name: "my name" });
			assert.equal(renderSingleLineTest(result), Colors.brightRed("failed") + " my name");
		});

	});


	describe("multi-line test cases", ({ it }) => {

		it("renders multi-line name and status separated by a blank line", () => {
			const result = createPass({ name: [ "my suite", "my name" ]});
			const renderer = TestRenderer.create();

			assert.equal(
				renderMultiLineTest(result),
				renderer.renderNameOnMultipleLines(result) + "\n" + renderer.renderStatusWithMultiLineDetails(result)
			);
		});

	});


	describe("single-line test marks", ({ it }) => {

		it("renders all marks", () => {
			assert.equal(
				renderSingleLineMark(createPass({ mark: TestMark.none })),
				"",
				"no mark"
			);
			assert.equal(
				renderSingleLineMark(createPass({ mark: TestMark.skip, name: "my name" })),
				Colors.brightCyan(".skip") + " my name"
			);
			assert.equal(
				renderSingleLineMark(createPass({ mark: TestMark.only, name: "my name" })),
				Colors.brightCyan(".only") + " my name"
			);
		});

	});


	describe("single-line names", ({ it }) => {

		it("renders default name when no name provided", () => {
			const result = createPass({ name: [] });
			assert.equal(render(result), "(no name)");
		});

		it("renders one name", () => {
			const result = createPass({ name: "my name" });
			assert.equal(render(result), "my name");
		});

		it("renders multiple names", () => {
			const result = createPass({ name: [ "suite 1", "suite 2", "my name" ]});
			assert.equal(render(result), "suite 1 » suite 2 » my name");
		});

		it("renders filename and name together", () => {
			const result = createPass({ filename: "my_file", name: "my name" });
			assert.equal(render(result), highlightColor("my_file") +" » my name");
		});

		it("strips directories from filename", () => {
			const result = createPass({ filename: "/root/parent/child/my_file", name: "my name" });
			assert.equal(render(result), highlightColor("my_file") + " » my name");
		});

		function render(result: TestCaseResult): string {
			return TestRenderer.create().renderNameOnOneLine(result);
		}

	});


	describe("multi-line names", ({ it }) => {

		it("renders default name when no name provided", () => {
			const result = createPass({ name: [] });
			assert.equal(render(result), headerColor("(no name)"));
		});

		it("renders one name", () => {
			const result = createPass({ name: "my name" });
			assert.equal(render(result), headerColor("my name"));
		});

		it("renders multiple names", () => {
			const result = createPass({ name: [ "suite 1", "suite 2", "my name" ]});
			assert.equal(render(result), headerColor("suite 1 » suite 2\n» my name"));
		});

		it("renders filename and name together", () => {
			const result = createPass({ filename: "my_file", name: "my name" });
			assert.equal(render(result), headerColor("my_file\n» my name"));
		});

		it("strips directories from filename", () => {
			const result = createPass({ filename: "/root/parent/child/my_file", name: "my name" });
			assert.equal(render(result), headerColor("my_file\n» my name"));
		});

		function render(result: TestCaseResult): string {
			return TestRenderer.create().renderNameOnMultipleLines(result);
		}

	});


	describe("single-word statuses", ({ it }) => {

		it("renders all statuses", () => {
			assert.equal(render(createPass()), Colors.green("passed"), "pass");
			assert.equal(render(createFail()), Colors.brightRed("failed"), "fail");
			assert.equal(render(createSkip()), Colors.brightCyan("skipped"), "skip");
			assert.equal(render(createTimeout()), Colors.brightPurple("timeout"), "timeout");
		});

		function render(result: TestCaseResult): string {
			return TestRenderer.create().renderStatusAsSingleWord(result);
		}

	});


	describe("multi-line statuses", ({ it, describe }) => {

		it("renders pass", () => {
			assert.equal(render(createPass()), Colors.green("passed"));
		});

		it("renders skip", () => {
			assert.equal(render(createSkip()), Colors.brightCyan("skipped"));
		});

		it("renders timeout", () => {
			assert.equal(render(createTimeout({ timeout: 500 })), Colors.purple("Timed out after 500ms"));
		});

		describe("fail", () => {

			it("renders error message", () => {
				const result = createFail({ name: "my name", error: "my error" });
				assert.equal(render(result), Colors.brightRed("my error")
				);
			});

			it("handles unusual errors", () => {
				const result = createFail({ name: "my name", error: 123 });
				assert.equal(render(result), Colors.brightRed("123"));
			});

			it("renders diff for assertion errors", () => {
				const error = new AssertionError({
					message: "my error",
					expected: "my expected",
					actual: "my actual",
				});
				delete error.stack;

				const result = createFail({ name: "my name", error });
				assert.equal(
					render(result),
					Colors.brightRed(error.toString()) + "\n\n" + renderDiff(error)
				);
			});

			it("renders stack trace and repeats name and error message", () => {
				const error = new Error("my error");
				error.stack = "my stack";

				const result = createFail({ name: "my name", error });
				assert.equal(render(result),
					"my stack\n" +
					"\n" +
					Colors.brightWhite("my name »\n") +
					Colors.brightRed("my error")
				);
			});

			it("doesn't repeat name and error message if error doesn't have a message", () => {
				const error = { stack: "my stack" };

				const result = createFail({ name: "my name", error });
				assert.equal(render(result), "my stack");
			});

			it("repeats name properly when test has no name", () => {
				const error = new Error("my error");
				error.stack = "my stack";

				const result = createFail({ name: [], error });
				assert.equal(render(result),
					"my stack\n" +
					"\n" +
					Colors.brightWhite("(no name) »\n") +
					Colors.brightRed("my error")
				);
			});

			it("renders stack, message, and diff when they all exist", () => {
				const error = new AssertionError({
					message: "my error",
					expected: "my expected",
					actual: "my actual",
				});
				error.stack = "my stack";

				const result = createFail({ name: "my name", error });
				assert.equal(render(result),
					"my stack\n" +
					"\n" +
					Colors.brightWhite("my name »\n") +
					Colors.brightRed("my error") + "\n" +
					"\n" +
					renderDiff(error)
				);
			});

		});

		function render(result: TestCaseResult): string {
			return TestRenderer.create().renderStatusWithMultiLineDetails(result);
		}

		function renderDiff(error: AssertionError): string {
			return TestRenderer.create().renderDiff(error);
		}

	});


	describe("single-word marks", ({ it }) => {

		it("renders all marks", () => {
			assert.equal(render(createPass({ mark: TestMark.none })), "", "no mark");
			assert.equal(render(createPass({ mark: TestMark.skip })), Colors.brightCyan(".skip"));
			assert.equal(render(createPass({ mark: TestMark.only })), Colors.brightCyan(".only"));
		});

		function render(result: TestCaseResult): string {
			return TestRenderer.create().renderMarkAsSingleWord(result);
		}

	});


	describe("stack traces", ({ it }) => {

		const EXAMPLE_STACK = "Error: my error\n" +
			"    at file:///Users/jshore/Documents/Projects/ergotest/_build/util/tests/test_result.test.js:306:11\n" +
			"    at file:///Users/jshore/Documents/Projects/ergotest/_build/util/tests/test_suite.js:222:10\n" +
			"    at file:///Users/jshore/Documents/Projects/ergotest/_build/util/infrastructure/clock.js:68:26\n";

		const HIGHLIGHTED_STACK = "Error: my error\n" +
			Colors.brightWhite.bold(
				"--> at file:///Users/jshore/Documents/Projects/ergotest/_build/util/tests/test_result.test.js:306:11"
			) + "\n" +
			"    at file:///Users/jshore/Documents/Projects/ergotest/_build/util/tests/test_suite.js:222:10\n" +
			"    at file:///Users/jshore/Documents/Projects/ergotest/_build/util/infrastructure/clock.js:68:26\n";

		it("returns an empty string if there's no stack trace", () => {
			const result = createResult({ stack: undefined });
			assert.equal(render(result), "");
		});

		it("converts non strings to strings", () => {
			const result = createResult({ stack: EXAMPLE_STACK, filename: undefined });
			assert.equal(render(result), EXAMPLE_STACK);
		});

		it("highlights stack trace lines that include test file", () => {
			const result = createResult({
				stack: EXAMPLE_STACK,
				filename: "/Users/jshore/Documents/Projects/ergotest/_build/util/tests/test_result.test.js",
			});
			assert.equal(render(result), HIGHLIGHTED_STACK);
		});

		function createResult({
			stack,
			filename,
		}: {
			stack: unknown,
			filename?: string,
		}) {
			return createFail({ error: { stack }, filename });
		}

		function render(result: TestCaseResult) {
			return TestRenderer.create().renderStack(result);
		}
	});


	describe("actual / expected diffs", ({ it }) => {
		// These tests depends on util.inspect() behavior, which is not guaranteed to remain consistent across
		// Node versions, so it could break after a Node version upgrade.

		it("renders expected and actual values", () => {
			assert.equal(render(123, "abc"),
				Colors.green("expected: ") + "123\n" +
				Colors.brightRed("actual:   ") + "'abc'"
			);
		});

		it("highlights differences between expected and actual values when they have more than one line", () => {
			const expected = "1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n";
			const actual = "1234567890\n1234567890\nXXXXXXXXXX\n1234567890\n1234567890\n1234567890\n1234567890\n";

			assert.deepEqual(render(expected, actual),
				Colors.green("expected: ") + "'1234567890\\n' +\n" +
				"  '1234567890\\n' +\n" +
				Colors.brightYellow.bold("  '1234567890\\n' +") + "\n" +
				"  '1234567890\\n' +\n" +
				"  '1234567890\\n' +\n" +
				"  '1234567890\\n' +\n" +
				"  '1234567890\\n'\n" +
				Colors.brightRed("actual:   ") + "'1234567890\\n' +\n" +
				"  '1234567890\\n' +\n" +
				Colors.brightYellow.bold("  'XXXXXXXXXX\\n' +") + "\n" +
				"  '1234567890\\n' +\n" +
				"  '1234567890\\n' +\n" +
				"  '1234567890\\n' +\n" +
				"  '1234567890\\n'"
			);
		});

		it("highlights differences between expected and actual values when expected has one line", () => {
			// This test depends on util.inspect() behavior, which is not guaranteed to remain consistent across
			// Node versions, so it could break after a Node version upgrade.
			const oneLine = "1234567890123456789012345678901234567890\n";
			const twoLines = "1234567890123456789012345678901234567890\n1234567890123456789012345678901234567890\n";

			assert.deepEqual(render(oneLine, twoLines),
				Colors.green("expected: ") + Colors.brightYellow.bold("'1234567890123456789012345678901234567890\\n'") + "\n" +
				Colors.brightRed("actual:   ") + Colors.brightYellow.bold("'1234567890123456789012345678901234567890\\n' +") + "\n" +
				Colors.brightYellow.bold("  '1234567890123456789012345678901234567890\\n'")
			);
		});

		it("doesn't break when actual and expected have different numbers of lines", () => {
			// This test depends on util.inspect() behavior, which is not guaranteed to remain consistent across
			// Node versions, so it could break after a Node version upgrade.
			const sevenLines = "1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n";
			const twoLines = "1234567890123456789012345678901234567890\n1234567890123456789012345678901234567890\n";

			assert.deepEqual(render(sevenLines, twoLines),
				Colors.green("expected: ") + Colors.brightYellow.bold("'1234567890\\n' +") + "\n" +
				Colors.brightYellow.bold("  '1234567890\\n' +") + "\n" +
				Colors.brightYellow.bold("  '1234567890\\n' +") + "\n" +
				Colors.brightYellow.bold("  '1234567890\\n' +") + "\n" +
				Colors.brightYellow.bold("  '1234567890\\n' +") + "\n" +
				Colors.brightYellow.bold("  '1234567890\\n' +") + "\n" +
				Colors.brightYellow.bold("  '1234567890\\n'") + "\n" +
				Colors.brightRed("actual:   ") + Colors.brightYellow.bold("'1234567890123456789012345678901234567890\\n' +") + "\n" +
				Colors.brightYellow.bold("  '1234567890123456789012345678901234567890\\n'")
			);
		});

		function render(expected: unknown, actual: unknown): string {
			const error = new AssertionError({ expected, actual });
			return TestRenderer.create().renderDiff(error);
		}

	});

});

function renderCharacterTest(testResult: TestResult): string {
	return TestRenderer.create().renderTestsAsSingleCharacters(testResult);
}

function renderSingleLineTest(testResult: TestResult): string {
	return TestRenderer.create().renderTestsAsSummaryLines(testResult);
}

function renderMultiLineTest(testResult: TestResult): string {
	return TestRenderer.create().renderTestsWithFullDetails(testResult);
}

function renderSingleLineMark(result: TestResult): string {
	return TestRenderer.create().renderMarksAsSummaryLines(result);
}

function createSuite({
	name = [],
	children = [],
	filename = undefined,
}: {
	name?: string | string[],
	children?: TestResult[],
	filename?: string,
} = {}): TestSuiteResult {
	return TestResult.suite(name, children, filename);
}

function createPass({
	name = [],
	filename = undefined,
	mark = TestMark.none,
}: {
	name?: string | string[],
	filename?: string,
	mark?: TestMarkValue
} = {}): TestCaseResult {
	return TestResult.pass(name, filename, mark);
}

function createFail({
	name = [],
	error = new Error("irrelevant error"),
	filename = undefined,
}: {
	name?: string | string[],
	error?: unknown,
	filename?: string,
} = {}): TestCaseResult {
	return TestResult.fail(name, error, filename);
}

function createSkip({
	name = [],
	filename = undefined,
}: {
	name?: string | string[],
	filename?: string,
} = {}): TestCaseResult {
	return TestResult.skip(name, filename);
}

function createTimeout({
	name = [],
	timeout = 42,
	filename = undefined,
}: {
	name?: string | string[],
	timeout?: number,
	filename?: string,
} = {}): TestCaseResult {
	return TestResult.timeout(name, timeout, filename);
}