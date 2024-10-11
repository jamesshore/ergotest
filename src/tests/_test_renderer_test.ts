// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."

import { assert, test } from "../tests.js";
import { TestRenderer } from "./test_renderer.js";
import { AssertionError } from "node:assert";
import { TestCaseResult, TestResult, TestSuiteResult } from "./test_result.js";
import { Colors } from "../infrastructure/colors.js";
import { TestMark, TestMarkValue } from "./test_suite.js";

const headerColor = Colors.brightWhite.bold;
const highlightColor = Colors.brightWhite;

export default test(({ describe }) => {

	describe("single-character test cases", ({ it }) => {

		it("renders test cases as progress marker", () => {
			assert.equal(renderCharacterTest(createPass()), Colors.white("."), "pass");
			assert.equal(renderCharacterTest(createFail()), Colors.brightRed.inverse("X"), "fail");
			assert.equal(renderCharacterTest(createSkip()), Colors.cyan.dim("_"), "skip");
			assert.equal(renderCharacterTest(createTimeout()), Colors.purple.inverse("!"), "timeout");
		});

		it("renders multiple results", () => {
			const results = [
				createPass(),
				createFail(),
				createSkip(),
			];

			assert.equal(renderCharacterTest(results),
				renderCharacterTest(createPass()) +
				renderCharacterTest(createFail()) +
				renderCharacterTest(createSkip())
			);
		});

		it("renders no results as an empty string", () => {
			assert.equal(renderCharacterTest([]), "");
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

		it("renders multiple results with a line feed between each one", () => {
			const results = [
				createPass(),
				createFail(),
				createSkip(),
			];

			assert.equal(renderSingleLineTest(results),
				renderSingleLineTest(createPass()) + "\n" +
				renderSingleLineTest(createFail()) + "\n" +
				renderSingleLineTest(createSkip())
			);
		});

		it("renders no results as an empty string", () => {
			assert.equal(renderSingleLineTest([]), "");
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

		it("renders multiple results with a two-line gap between each result", () => {
			const fail = createFail();    // have to use the same fail each time, or the stack trace will be different

			const results = [
				createPass(),
				fail,
				createSkip(),
			];

			assert.equal(renderMultiLineTest(results),
				renderMultiLineTest(createPass()) + "\n\n\n" +
				renderMultiLineTest(fail) + "\n\n\n" +
				renderMultiLineTest(createSkip())
			);
		});

		it("renders no results as an empty string", () => {
			assert.equal(renderMultiLineTest([]), "");
		});

	});


	describe("single-line test marks", ({ it }) => {

		it("renders test case marks", () => {
			assert.equal(
				renderSingleLineMark(createPass({ mark: TestMark.none, name: "my name" })),
				"(no mark) my name",
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

		it("renders multiple results on consecutive lines", () => {
			const results = [
				createPass({ name: "skip 1", mark: TestMark.skip }),
				createPass({ name: "none 2", mark: TestMark.none }),
				createPass({ name: "only 3", mark: TestMark.only }),
				createSuite({ name: "suite only 1", mark: TestMark.only, children: [
					createSkip({ name: "does not look inside suites", mark: TestMark.skip }),
				]}),
				createSuite({ name: "suite skip 2", mark: TestMark.skip }),
			];

			assert.equal(renderSingleLineMark(results),
				renderSingleLineMark(createPass({ name: "skip 1", mark: TestMark.skip })) + "\n" +
				renderSingleLineMark(createPass({ name: "none 2", mark: TestMark.none })) + "\n" +
				renderSingleLineMark(createPass({ name: "only 3", mark: TestMark.only })) + "\n" +
				renderSingleLineMark(createSkip({ name: "suite only 1", mark: TestMark.only })) + "\n" +
				renderSingleLineMark(createSuite({ name: "suite skip 2", mark: TestMark.skip }))
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
			assert.equal(render(result), headerColor("my_file") +" » my name");
		});

		it("strips directories from filename", () => {
			const result = createPass({ filename: "/root/parent/child/my_file", name: "my name" });
			assert.equal(render(result), headerColor("my_file") + " » my name");
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
			assert.equal(render(createPass({ mark: TestMark.none })), "(no mark)");
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

function renderCharacterTest(result: TestCaseResult | TestCaseResult[]): string {
	return TestRenderer.create().renderAsCharacters(result);
}

function renderSingleLineTest(result: TestCaseResult | TestCaseResult[]): string {
	return TestRenderer.create().renderAsSingleLines(result);
}

function renderMultiLineTest(result: TestCaseResult | TestCaseResult[]): string {
	return TestRenderer.create().renderAsMultipleLines(result);
}

function renderSingleLineMark(result: TestResult | TestResult[]): string {
	return TestRenderer.create().renderMarksAsLines(result);
}

function createSuite({
	name = [],
	children = [],
	filename = undefined,
	mark = TestMark.none,
}: {
	name?: string | string[],
	children?: TestResult[],
	filename?: string,
	mark?: TestMarkValue,
} = {}): TestSuiteResult {
	return TestResult.suite(name, children, filename, mark);
}

function createPass({
	name = [],
	filename = undefined,
	mark = TestMark.none,
}: {
	name?: string | string[],
	filename?: string,
	mark?: TestMarkValue,
} = {}): TestCaseResult {
	return TestResult.pass(name, filename, mark);
}

function createFail({
	name = [],
	error = new Error("irrelevant error"),
	filename = undefined,
	mark = TestMark.none,
}: {
	name?: string | string[],
	error?: unknown,
	filename?: string,
	mark?: TestMarkValue,
} = {}): TestCaseResult {
	return TestResult.fail(name, error, filename, mark);
}

function createSkip({
	name = [],
	filename = undefined,
	mark = TestMark.none,
}: {
	name?: string | string[],
	filename?: string,
	mark?: TestMarkValue,
} = {}): TestCaseResult {
	return TestResult.skip(name, filename, mark);
}

function createTimeout({
	name = [],
	timeout = 42,
	filename = undefined,
	mark = TestMark.none,
}: {
	name?: string | string[],
	timeout?: number,
	filename?: string,
	mark?: TestMarkValue,
} = {}): TestCaseResult {
	return TestResult.timeout(name, timeout, filename, mark);
}