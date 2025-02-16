// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { assert, describe, it } from "../tests.js";
import { renderDiff, renderError, renderStack, TestRenderer } from "./test_renderer.js";
import { AssertionError } from "node:assert";
import { RenderErrorFn, TestCaseResult, TestMark, TestMarkValue, TestResult, TestSuiteResult } from "./test_result.js";
import { Colors } from "../infrastructure/colors.js";
import util from "node:util";
import { describe as describe_sut, it as it_sut } from "./test_api.js";
import path from "node:path";
import { SourceMap } from "../infrastructure/source_map.js";

const headerColor = Colors.brightWhite.bold;
const summaryColor = Colors.brightWhite.dim;
const failColor = Colors.brightRed;
const timeoutColor = Colors.purple;
const skipColor = Colors.cyan;
const passColor = Colors.green;

const TEST_RENDERER_PATH = path.resolve(import.meta.dirname, "./test_renderer.js");

export default describe(() => {

	describe("summary", () => {

		it("renders summary", () => {
			const result = createSuite({ children: [
				createPass(),
				createSkip(),
				createSkip(),
				createFail(),
				createFail(),
				createFail(),
				createTimeout(),
				createTimeout(),
				createTimeout(),
				createTimeout(),
			]});

			assert.equal(TestRenderer.create().renderSummary(result, 1000),
				summaryColor("(") +
				failColor("3 failed") +
				summaryColor("; ") +
				timeoutColor("4 timed out") +
				summaryColor("; ") +
				skipColor("2 skipped") +
				summaryColor("; ") +
				passColor("1 passed") +
				summaryColor("; ") +
				summaryColor("125.0ms avg.") +
				summaryColor(")")
			);
		});

		it("only renders information for non-zero counts", () => {
			const result = createSuite({ children: [ createPass() ]});

			assert.equal(TestRenderer.create().renderSummary(result, 1000),
				summaryColor("(") +
				passColor("1 passed") +
				summaryColor("; ") +
				summaryColor("1000.0ms avg.") +
				summaryColor(")")
			);
		});

		it("leaves out test time if elapsed time not provided", () => {
			const result = createSuite({ children: [ createPass() ]});

			assert.equal(TestRenderer.create().renderSummary(result),
				summaryColor("(") +
				passColor("1 passed") +
				summaryColor(")")
			);
		});

		it("handles empty results gracefully", () => {
			assert.equal(TestRenderer.create().renderSummary(createSuite(), 1000),
				summaryColor("(") +
				summaryColor("none ran") +
				summaryColor(")")
			);
		});
	});


	describe("single-character test cases", () => {

		it("renders test cases as progress marker", () => {
			assert.equal(renderCharacterTest(createPass()), ".", "pass");
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


	describe("single-line test cases", () => {

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


	describe("multi-line test cases", () => {

		it("renders multi-line name and status separated by a blank line", () => {
			const result = createPass({ name: [ "my suite", "my name" ]});
			const renderer = TestRenderer.create();

			assert.equal(
				renderMultiLineTest(result),
				renderer.renderNameOnMultipleLines(result) + "\n\n" + renderer.renderStatusWithMultiLineDetails(result)
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


	describe("single-line test marks", () => {

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


	describe("single-line names", () => {

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


	describe("multi-line names", () => {

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


	describe("single-word statuses", () => {

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


	describe("multi-line statuses", () => {

		it("renders pass", () => {
			assert.equal(render(createPass()), Colors.green("passed"));
		});

		it("renders skip", () => {
			assert.equal(render(createSkip()), Colors.brightCyan("skipped"));
		});

		it("renders timeout", () => {
			assert.equal(render(createTimeout({ timeout: 500 })), Colors.purple("Timed out after 500ms"));
		});

		it("renders fail", () => {
			assert.equal(
				render(createFail({ error: "my error" })),
				renderError([ "irrelevant name" ], "my error", TestMark.none, "irrelevant filename"),
			);
		});

		it("renders fail when errorRender isn't a string", () => {
			const fail = createFail({
				renderError: () => [ 1, 2, 3 ],
			});
			assert.equal(render(fail), "[ 1, 2, 3 ]");
		});

		function render(result: TestCaseResult): string {
			return TestRenderer.create().renderStatusWithMultiLineDetails(result);
		}

	});


	describe("single-word marks", () => {

		it("renders all marks", () => {
			assert.equal(render(createPass({ mark: TestMark.none })), "(no mark)");
			assert.equal(render(createPass({ mark: TestMark.skip })), Colors.brightCyan(".skip"));
			assert.equal(render(createPass({ mark: TestMark.only })), Colors.brightCyan(".only"));
		});

		function render(result: TestCaseResult): string {
			return TestRenderer.create().renderMarkAsSingleWord(result);
		}

	});


	describe("error rendering", () => {

		it("works as a custom renderer", async () => {
			const options = {
				renderer: TEST_RENDERER_PATH,
			};

			const suite = describe_sut(() => {
				it_sut("my test", () => {
					// eslint-disable-next-line no-throw-literal
					throw "my error";
				});
			});
			const result = (await suite.runAsync(options)).allTests()[0];

			await assert.equal(result.errorRender, renderError([ "my test" ], "my error", TestMark.none));
		});

		it("renders error message", () => {
			assert.equal(render({ error: "my error" }), Colors.brightRed("my error"));
		});

		it("handles unusual errors", () => {
			assert.equal(render({ error: 123 }), Colors.brightRed("123"));
			assert.equal(render({ error: { myObject: "my_field" } }), Colors.brightRed("{ myObject: 'my_field' }"));
		});

		it("renders diff for assertion errors without a stack trace", () => {
			const error = new AssertionError({
				message: "my error",
				expected: "my expected",
				actual: "my actual",
			});
			delete error.stack;

			assert.equal(
				render({ error }),
				Colors.brightRed(util.inspect(error)) + "\n\n" + renderDiff(error)
			);
		});

		it("renders stack trace and repeats name and error message", () => {
			const error = new Error("my error");
			error.stack = "my stack";

			assert.equal(render({ name: "my name", error }),
				"[my stack]\n" +
				"\n" +
				Colors.brightWhite("my name »\n") +
				Colors.brightRed("my error")
			);
		});

		it("doesn't repeat name and error message if error doesn't have a message", () => {
			const error = new Error("");
			error.stack = "my stack";

			assert.equal(render({ error }), "[my stack]");
		});

		it("repeats name properly when test has no name", () => {
			const error = new Error("my error");
			error.stack = "my stack";

			assert.equal(render({ name: [], error }),
				"[my stack]\n" +
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

			assert.equal(render({ name: "my name", error }),
				"my stack\n" +
				"\n" +
				Colors.brightWhite("my name »\n") +
				Colors.brightRed("my error") + "\n" +
				"\n" +
				renderDiff(error)
			);
		});

		function render({
			name = "irrelevant name",
			error,
		}: {
			name?: string | string[],
			error: unknown
		}): string {
			if (!Array.isArray(name)) name = [ name ];

			return renderError(name, error, TestMark.none, "irrelevant filename");
		}

	});


	describe("stack traces", () => {

		const EXAMPLE_STACK = "Error: my error\n" +
			"    at file:///Users/jshore/Documents/Projects/ergotest/_build/util/tests/test_result.test.js:306:11\n" +
			"    at file:///Users/jshore/Documents/Projects/ergotest/_build/util/tests/test_suite.js:222:10\n" +
			"    at file:///Users/jshore/Documents/Projects/ergotest/_build/util/infrastructure/clock.js:68:26\n";

		const EXAMPLE_SOURCE_MAP_STACK = "Error: my error\n" +
			"    at file:///Users/jshore/Documents/Projects/ergotest/_build/util/tests/test_result.test.ts:306:11\n" +
			"    at file:///Users/jshore/Documents/Projects/ergotest/_build/util/tests/test_suite.ts:222:10\n" +
			"    at file:///Users/jshore/Documents/Projects/ergotest/_build/util/infrastructure/clock.ts:68:26\n";

		const HIGHLIGHTED_STACK = "Error: my error\n" +
			Colors.brightWhite.bold(
				"--> at file:///Users/jshore/Documents/Projects/ergotest/_build/util/tests/test_result.test.js:306:11"
			) + "\n" +
			"    at file:///Users/jshore/Documents/Projects/ergotest/_build/util/tests/test_suite.js:222:10\n" +
			"    at file:///Users/jshore/Documents/Projects/ergotest/_build/util/infrastructure/clock.js:68:26\n";

		const HIGHLIGHTED_SOURCE_MAP_STACK = "Error: my error\n" +
			Colors.brightWhite.bold(
				"--> at file:///Users/jshore/Documents/Projects/ergotest/_build/util/tests/test_result.test.ts:306:11"
			) + "\n" +
			"    at file:///Users/jshore/Documents/Projects/ergotest/_build/util/tests/test_suite.ts:222:10\n" +
			"    at file:///Users/jshore/Documents/Projects/ergotest/_build/util/infrastructure/clock.ts:68:26\n";

		const HIGHLIGHTED_MULTIPLE_SOURCE_MAP_STACK = "Error: my error\n" +
			Colors.brightWhite.bold(
				"--> at file:///Users/jshore/Documents/Projects/ergotest/_build/util/tests/test_result.test.ts:306:11"
			) + "\n" +
			"    at file:///Users/jshore/Documents/Projects/ergotest/_build/util/tests/test_suite.ts:222:10\n" +
			Colors.brightWhite.bold(
				"--> at file:///Users/jshore/Documents/Projects/ergotest/_build/util/infrastructure/clock.ts:68:26"
			) + "\n";

		it("inspects the error object", () => {
			class MyError extends Error {
				constructor(message: string, public readonly custom: string) {
					super(message);
					this.custom = custom;
				}
			}
			const error = new MyError("my error", "custom field");
			error.stack = "my stack";

			assert.equal(renderStack(error), "[my stack] { custom: 'custom field' }");
		});

		it("doesn't inspect assertion errors; just returns the stack trace", () => {
			const error = new AssertionError({});
			error.stack = "my stack";

			assert.equal(renderStack(error), "my stack");
		});

		it("handles assertion errors without a stack trace", () => {
			const error = new AssertionError({});
			error.stack = undefined;

			assert.equal(renderStack(error), "");
		});

		it("handles nested errors", () => {
			const grandchild = new Error("grandchild");
			grandchild.stack = "grandchild stack";
			const child = new Error("child", { cause: grandchild });
			child.stack = "child stack";
			const parent = new Error("parent", { cause: child });
			parent.stack = "parent stack";

			assert.equal(renderStack(parent),
				"[parent stack] {\n" +
				"  [cause]: [child stack] { [cause]: [grandchild stack] }\n" +
				"}");
		});

		it("highlights stack trace lines that include test file", () => {
			const error = new Error("my error");
			error.stack = EXAMPLE_STACK;

			assert.equal(
				renderStack(
					error,
					"/Users/jshore/Documents/Projects/ergotest/_build/util/tests/test_result.test.js",
				),
				HIGHLIGHTED_STACK,
			);
		});

		it("highlights stack trace lines even when test file has a source map", () => {
			const error = new Error("my error");
			error.stack = EXAMPLE_SOURCE_MAP_STACK;

			const sourceMap = SourceMap.createNull({
				"/Users/jshore/Documents/Projects/ergotest/_build/util/tests/test_result.test.js": [
					"/Users/jshore/Documents/Projects/ergotest/_build/util/tests/test_result.test.ts",
				],
			});

			assert.equal(
				renderStack(error, "/Users/jshore/Documents/Projects/ergotest/_build/util/tests/test_result.test.js", sourceMap),
				HIGHLIGHTED_SOURCE_MAP_STACK,
			);
		});

		it("highlights stack trace lines when source map has multiple sources", () => {
			const error = new Error("my error");
			error.stack = EXAMPLE_SOURCE_MAP_STACK;

			const sourceMap = SourceMap.createNull({
				"/Users/jshore/Documents/Projects/ergotest/_build/util/tests/test_result.test.js": [
					"/Users/jshore/Documents/Projects/ergotest/_build/util/tests/test_result.test.ts",
					"/Users/jshore/Documents/Projects/ergotest/_build/util/infrastructure/clock.ts",
				],
			});

			assert.equal(
				renderStack(error, "/Users/jshore/Documents/Projects/ergotest/_build/util/tests/test_result.test.js", sourceMap),
				HIGHLIGHTED_MULTIPLE_SOURCE_MAP_STACK,
			);
		});

	});


	describe("actual / expected diffs", () => {
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

			assert.equal(render(expected, actual),
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

			assert.equal(render(oneLine, twoLines),
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

			assert.equal(render(sevenLines, twoLines),
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
			return renderDiff(error);
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
	renderError = undefined,
}: {
	name?: string | string[],
	error?: unknown,
	filename?: string,
	mark?: TestMarkValue,
	renderError?: RenderErrorFn,
} = {}): TestCaseResult {
	return TestResult.fail(name, error, filename, mark, renderError);
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