// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import {
	assert,
	createFail,
	createPass,
	createSkip,
	createSuite, createTimeout,
	describe,
	it,
} from "../../util/tests.js";
import { renderDiff, renderError, renderStack, TestRenderer } from "./test_renderer.js";
import { AssertionError } from "node:assert";
import {
	TestCaseResult,
	TestMark,
	TestMarkValue,
	TestResult, TestStatus, TestStatusValue,
} from "./test_result.js";
import { Colors } from "../../infrastructure/colors.js";
import util from "node:util";
import { describe as describe_sut, it as it_sut } from "../tests/test_api.js";
import path from "node:path";
import { SourceMap } from "../../infrastructure/source_map.js";

const headerColor = Colors.brightWhite.bold;

const summaryColor = Colors.brightWhite.dim;
const summaryFailColor = Colors.brightRed;
const summaryTimeoutColor = Colors.purple;
const summarySkipColor = Colors.cyan;
const summaryPassColor = Colors.green;

const testFailColor = Colors.brightRed;
const testTimeoutColor = Colors.brightPurple;
const testSkipColor = Colors.brightCyan;
const testPassColor = Colors.green;

const TEST_RENDERER_PATH = path.resolve(import.meta.dirname, "./test_renderer.js");

export default describe(() => {

	describe("summary", () => {

		it("renders summary", () => {
			const result = createSuite({ tests: [
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
				summaryFailColor("3 failed") +
				summaryColor("; ") +
				summaryTimeoutColor("4 timed out") +
				summaryColor("; ") +
				summarySkipColor("2 skipped") +
				summaryColor("; ") +
				summaryPassColor("1 passed") +
				summaryColor("; ") +
				summaryColor("125.0ms avg.") +
				summaryColor(")")
			);
		});

		it("only renders information for non-zero counts", () => {
			const result = createSuite({ tests: [ createPass() ]});

			assert.equal(TestRenderer.create().renderSummary(result, 1000),
				summaryColor("(") +
				summaryPassColor("1 passed") +
				summaryColor("; ") +
				summaryColor("1000.0ms avg.") +
				summaryColor(")")
			);
		});

		it("leaves out test time if elapsed time not provided", () => {
			const result = createSuite({ tests: [ createPass() ]});

			assert.equal(TestRenderer.create().renderSummary(result),
				summaryColor("(") +
				summaryPassColor("1 passed") +
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
			assert.equal(renderAsCharacters(createPass()), ".", "pass");
			assert.equal(renderAsCharacters(createFail()), Colors.brightRed.inverse("X"), "fail");
			assert.equal(renderAsCharacters(createSkip()), Colors.cyan.dim("_"), "skip");
			assert.equal(renderAsCharacters(createTimeout()), Colors.purple.inverse("!"), "timeout");
		});

		it("renders multiple results", () => {
			const results = [
				createPass(),
				createFail(),
				createSkip(),
			];

			assert.equal(renderAsCharacters(results),
				renderAsCharacters(createPass()) +
				renderAsCharacters(createFail()) +
				renderAsCharacters(createSkip())
			);
		});

		it("renders no results as an empty string", () => {
			assert.equal(renderAsCharacters([]), "");
		});

		it("doesn't render beforeEach() / afterEach() in any circumstance", () => {
			const result = createPass({
				name: "my name",
				beforeEach: [
					createSkip({ name: "before 1" }),
					createTimeout({ name: "before 2" }),
					createPass({ name: "before 3" }),
				],
				afterEach: [
					createSkip({ name: "after 1" }),
					createFail({ name: "after 2" }),
					createPass({ name: "after 3" }),
				],
			});
			assert.equal(renderAsCharacters(result), renderAsCharacters(createFail()));
		});
	});


	describe("single-line test cases", () => {

		it("pass", () => {
			const result = createPass({ name: "my name" });
			assert.equal(renderAsSingleLines(result), testPassColor("passed") + " my name");
		});

		it("skip", () => {
			const result = createSkip({ name: "my name" });
			assert.equal(renderAsSingleLines(result), testSkipColor("skipped") + " my name");
		});

		it("timeout", () => {
			const result = createTimeout({ name: "my name" });
			assert.equal(renderAsSingleLines(result), testTimeoutColor("timeout") + " my name");
		});

		it("fail", () => {
			const result = createFail({ name: "my name" });
			assert.equal(renderAsSingleLines(result), testFailColor("failed") + " my name");
		});

		it("renders multiple results with a line feed between each one", () => {
			const results = [
				createPass(),
				createFail(),
				createSkip(),
			];

			assert.equal(renderAsSingleLines(results),
				renderAsSingleLines(createPass()) + "\n" +
				renderAsSingleLines(createFail()) + "\n" +
				renderAsSingleLines(createSkip())
			);
		});

		it("renders no results as an empty string", () => {
			assert.equal(renderAsSingleLines([]), "");
		});

		describe("beforeEach/afterEach", () => {

			it("doesn't render beforeEach() / afterEach() when they all pass", () => {
				assert.equal(renderAsSingleLines(createPass({
					beforeEach: [ createPass() ],
					afterEach: [ createPass() ],
				})), renderAsSingleLines(createPass()), "test passes");

				assert.equal(renderAsSingleLines(createFail({
					beforeEach: [ createPass({ name: "before" }) ],
					afterEach: [ createPass({ name: "after" }) ],
				})), renderAsSingleLines(createFail()), "test fails");
			});

			it("doesn't render beforeEach() / afterEach() when they’re all skipped AND the test is skipped", () => {
				assert.equal(renderAsSingleLines(createSkip({
					beforeEach: [ createSkip() ],
					afterEach: [ createSkip() ],
				})), renderAsSingleLines(createSkip()));
			});

			it("renders detailed beforeEach() / afterEach() as well as the test detail when they don't all pass", () => {
				const result = createPass({
					name: "my name",
					beforeEach: [
						createSkip({ name: "before 1" }),
						createTimeout({ name: "before 2" }),
						createPass({ name: "before 3" }),
					],
					afterEach: [
						createSkip({ name: "after 1" }),
						createFail({ name: "after 2" }),
						createPass({ name: "after 3" }),
					],
				});
				assert.equal(renderAsSingleLines(result),
					testFailColor("failed") + " my name"
					+ `\n  ${summaryColor("-->")}  ${testPassColor("passed")} the test itself`
					+ `\n  ${summaryColor("-->")}  ${testSkipColor("skipped")} before 1`
					+ `\n  ${summaryColor("-->")}  ${testTimeoutColor("timeout")} before 2`
					+ `\n  ${summaryColor("-->")}  ${testPassColor("passed")} before 3`
					+ `\n  ${summaryColor("-->")}  ${testSkipColor("skipped")} after 1`
					+ `\n  ${summaryColor("-->")}  ${testFailColor("failed")} after 2`
					+ `\n  ${summaryColor("-->")}  ${testPassColor("passed")} after 3`
				);
			});

			it("renders all test detail even if one set of beforeEach or afterEach is passing", () => {
				assert.equal(renderAsSingleLines(createPass({
					name: "my name",
					beforeEach: [
						createSkip({ name: "before" }),
					],
					afterEach: [
						createPass({ name: "after" }),
					],
				})),
					testPassColor("passed") + " my name"
					+ `\n  ${summaryColor("-->")}  ${testPassColor("passed")} the test itself`
					+ `\n  ${summaryColor("-->")}  ${testSkipColor("skipped")} before`
					+ `\n  ${summaryColor("-->")}  ${testPassColor("passed")} after`
				);

				assert.equal(renderAsSingleLines(createPass({
					name: "my name",
					beforeEach: [
						createPass({ name: "before" }),
					],
					afterEach: [
						createSkip({ name: "after" }),
					],
				})),
					testPassColor("passed") + " my name"
					+ `\n  ${summaryColor("-->")}  ${testPassColor("passed")} the test itself`
					+ `\n  ${summaryColor("-->")}  ${testPassColor("passed")} before`
					+ `\n  ${summaryColor("-->")}  ${testSkipColor("skipped")} after`
				);

			});

		});

	});


	describe("multi-line test cases", () => {

		it("renders multi-line name and status separated by a blank line", () => {
			const result = createPass({ name: [ "my suite", "my name" ]});
			const renderer = TestRenderer.create();

			assert.equal(renderAsMultipleLines(result),
				renderer.renderNameOnMultipleLines([ "my suite", "my name" ]) + "\n\n"
				+ renderer.renderStatusWithMultiLineDetails(result.it)
			);
		});

		it("renders multiple results with a two-line gap between each result", () => {
			const fail = createFail();    // have to use the same fail each time, or the stack trace will be different

			const results = [
				createPass(),
				fail,
				createSkip(),
			];

			assert.equal(renderAsMultipleLines(results),
				renderAsMultipleLines(createPass()) + "\n\n\n" +
				renderAsMultipleLines(fail) + "\n\n\n" +
				renderAsMultipleLines(createSkip())
			);
		});

		it("renders no results as an empty string", () => {
			assert.equal(renderAsMultipleLines([]), "");
		});

		describe("beforeEach/afterEach", () => {

			it("doesn't render passing beforeEach() / afterEach() when they all pass", () => {
				assert.equal(renderAsMultipleLines(createPass({
					beforeEach: [ createPass() ],
					afterEach: [ createPass() ],
				})), renderAsMultipleLines(createPass()));

				assert.equal(renderAsMultipleLines(createTimeout({
					beforeEach: [ createPass({ name: "before" }) ],
					afterEach: [ createPass({ name: "after" }) ],
				})), renderAsMultipleLines(createTimeout()));
			});

			it("doesn't render beforeEach() / afterEach() when they’re all skipped AND the test is skipped", () => {
				assert.equal(renderAsMultipleLines(createSkip({
					beforeEach: [ createSkip() ],
					afterEach: [ createSkip() ],
				})), renderAsMultipleLines(createSkip()));
			});

			it("renders detailed beforeEach() / afterEach() as well as the test detail when they don't all pass", () => {
				const after1 = createSkip({ name: "after 1" });
				const after2 = createFail({ name: "after 2" });
				const after3 = createPass({ name: "after 3" });
				const before1 = createSkip({ name: "before 1" });
				const before2 = createTimeout({ name: "before 2" });
				const before3 = createPass({ name: "before 3" });
				const result = createPass({
					name: "my name",
					beforeEach: [ before1, before2, before3 ],
					afterEach: [ after1, after2, after3 ],
				});

				const renderer = TestRenderer.create();
				assert.equal(renderAsMultipleLines(result),
					renderer.renderNameOnMultipleLines(["my name"]) + "\n\n"
					+ headerColor("»»» ") + headerColor("before 1") + "\n" + renderer.renderNameOnOneLine(["before 1"]) + "\n\n"
					+ renderer.renderStatusWithMultiLineDetails(before1.it) + "\n\n"
					+ headerColor("»»» ") + headerColor("before 2") + "\n" + renderer.renderNameOnOneLine(["before 2"]) + "\n\n"
					+ renderer.renderStatusWithMultiLineDetails(before2.it) + "\n\n"
					+ headerColor("»»» ") + headerColor("before 3") + "\n" + renderer.renderNameOnOneLine(["before 3"]) + "\n\n"
					+ renderer.renderStatusWithMultiLineDetails(before3.it) + "\n\n"
					+ headerColor("»»» ") + headerColor("after 1") + "\n" + renderer.renderNameOnOneLine(["after 1"]) + "\n\n"
					+ renderer.renderStatusWithMultiLineDetails(after1.it) + "\n\n"
					+ headerColor("»»» ") + headerColor("after 2") + "\n" + renderer.renderNameOnOneLine(["after 2"]) + "\n\n"
					+ renderer.renderStatusWithMultiLineDetails(after2.it) + "\n\n"
					+ headerColor("»»» ") + headerColor("after 3") + "\n" + renderer.renderNameOnOneLine(["after 3"]) + "\n\n"
					+ renderer.renderStatusWithMultiLineDetails(after3.it) + "\n\n"
					+ headerColor("»»» ") + headerColor("the test itself") + "\n" + renderer.renderNameOnOneLine(["my name"]) + "\n\n"
					+ renderer.renderStatusWithMultiLineDetails(result.it) + "\n\n"
					+ headerColor("«««")
				);
			});

			it("renders all test detail even if one set of beforeEach or afterEach is passing", () => {
				const before = createSkip({ name: "before" });
				const after = createPass({ name: "after" });
				const result = createPass({
					name: "my name",
					beforeEach: [ before ],
					afterEach: [ after ],
				});

				const renderer = TestRenderer.create();
				assert.equal(renderAsMultipleLines(result),
					renderer.renderNameOnMultipleLines(["my name"]) + "\n\n"
					+ headerColor("»»» ") + headerColor("before") + "\n" + renderer.renderNameOnOneLine(["before"]) + "\n\n"
					+ renderer.renderStatusWithMultiLineDetails(before.it) + "\n\n"
					+ headerColor("»»» ") + headerColor("after") + "\n" + renderer.renderNameOnOneLine(["after"]) + "\n\n"
					+ renderer.renderStatusWithMultiLineDetails(after.it) + "\n\n"
					+ headerColor("»»» ") + headerColor("the test itself") + "\n" + renderer.renderNameOnOneLine(["my name"]) + "\n\n"
					+ renderer.renderStatusWithMultiLineDetails(result.it) + "\n\n"
					+ headerColor("«««")
				);
			});
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
				createSuite({ name: "suite only 1", mark: TestMark.only, tests: [
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
			assert.equal(render([]), "(no name)");
		});

		it("renders one name", () => {
			assert.equal(render([ "my name" ]), "my name");
		});

		it("renders multiple names", () => {
			assert.equal(render([ "suite 1", "suite 2", "my name" ]), "suite 1 » suite 2 » my name");
		});

		it("renders filename and name together", () => {
			assert.equal(render([ "my name" ], "my_file"), headerColor("my_file") +" » my name");
		});

		it("strips directories from filename", () => {
			assert.equal(render([ "my name" ], "/root/parent/child/my_file"), headerColor("my_file") + " » my name");
		});

		function render(name: string[], filename?: string): string {
			return TestRenderer.create().renderNameOnOneLine(name, filename);
		}

	});


	describe("multi-line names", () => {

		it("renders default name when no name provided", () => {
			assert.equal(render([]), headerColor("(no name)"));
		});

		it("renders one name", () => {
			assert.equal(render(["my name"]), headerColor("my name"));
		});

		it("renders multiple names", () => {
			assert.equal(
				render([ "suite 1", "suite 2", "suite 3", "my name" ]),
				headerColor("suite 1") + " » suite 2 » suite 3\n" + headerColor("» ") + headerColor("my name")
			);
		});

		it("renders filename and name together", () => {
			assert.equal(
				render(["my name"], "my_file"),
				headerColor("my_file") + "\n" + headerColor("» ") + headerColor("my name"),
			);
		});

		it("strips directories from filename", () => {
			assert.equal(
				render(["my name"], "/root/parent/child/my_file"),
				headerColor("my_file") + "\n" + headerColor("» ") + headerColor("my name"),
			);
		});

		function render(name: string[], filename?: string): string {
			return TestRenderer.create().renderNameOnMultipleLines(name, filename);
		}

	});


	describe("single-word statuses", () => {

		it("renders all statuses", () => {
			assert.equal(render(TestStatus.pass), Colors.green("passed"), "pass");
			assert.equal(render(TestStatus.fail), Colors.brightRed("failed"), "fail");
			assert.equal(render(TestStatus.skip), Colors.brightCyan("skipped"), "skip");
			assert.equal(render(TestStatus.timeout), Colors.brightPurple("timeout"), "timeout");
		});

		function render(status: TestStatusValue): string {
			return TestRenderer.create().renderStatusAsSingleWord(status);
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
				renderError([ "irrelevant name" ], "my error", "irrelevant filename"),
			);
		});

		it("renders fail when errorRender isn't a string", () => {
			const fail = createFail({
				renderError: () => [ 1, 2, 3 ] as unknown as string,
			});
			assert.equal(render(fail), "[ 1, 2, 3 ]");
		});

		function render(result: TestCaseResult): string {
			return TestRenderer.create().renderStatusWithMultiLineDetails(result.it);
		}

	});


	describe("single-word marks", () => {

		it("renders all marks", () => {
			assert.equal(render(TestMark.none), "(no mark)");
			assert.equal(render(TestMark.skip), Colors.brightCyan(".skip"));
			assert.equal(render(TestMark.only), Colors.brightCyan(".only"));
		});

		function render(mark: TestMarkValue): string {
			return TestRenderer.create().renderMarkAsSingleWord(mark);
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

			await assert.equal(result.errorRender, renderError([ "my test" ], "my error"));
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

		it("doesn't render diff when assertion doesn't have expected and actual values", () => {
			const error = new AssertionError({
				message: "my error",
			});
			error.stack = "my stack";

			assert.equal(render({ name: "my name", error }),
				"my stack\n" +
				"\n" +
				Colors.brightWhite("my name »\n") +
				Colors.brightRed("my error")
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

			return renderError(name, error, "irrelevant filename");
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
			Colors.brightYellow.bold(
				"--> at file:///Users/jshore/Documents/Projects/ergotest/_build/util/tests/test_result.test.js:306:11"
			) + "\n" +
			"    at file:///Users/jshore/Documents/Projects/ergotest/_build/util/tests/test_suite.js:222:10\n" +
			"    at file:///Users/jshore/Documents/Projects/ergotest/_build/util/infrastructure/clock.js:68:26\n";

		const HIGHLIGHTED_SOURCE_MAP_STACK = "Error: my error\n" +
			Colors.brightYellow.bold(
				"--> at file:///Users/jshore/Documents/Projects/ergotest/_build/util/tests/test_result.test.ts:306:11"
			) + "\n" +
			"    at file:///Users/jshore/Documents/Projects/ergotest/_build/util/tests/test_suite.ts:222:10\n" +
			"    at file:///Users/jshore/Documents/Projects/ergotest/_build/util/infrastructure/clock.ts:68:26\n";

		const HIGHLIGHTED_MULTIPLE_SOURCE_MAP_STACK = "Error: my error\n" +
			Colors.brightYellow.bold(
				"--> at file:///Users/jshore/Documents/Projects/ergotest/_build/util/tests/test_result.test.ts:306:11"
			) + "\n" +
			"    at file:///Users/jshore/Documents/Projects/ergotest/_build/util/tests/test_suite.ts:222:10\n" +
			Colors.brightYellow.bold(
				"--> at file:///Users/jshore/Documents/Projects/ergotest/_build/util/infrastructure/clock.ts:68:26"
			) + "\n";

		it("inspects the error object", () => {
			class MyError extends Error {
				public readonly custom: string;
				constructor(message: string, custom: string) {
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

function renderAsCharacters(result: TestCaseResult | TestCaseResult[]): string {
	return TestRenderer.create().renderAsCharacters(result);
}

function renderAsSingleLines(result: TestCaseResult | TestCaseResult[]): string {
	return TestRenderer.create().renderAsSingleLines(result);
}

function renderAsMultipleLines(result: TestCaseResult | TestCaseResult[]): string {
	return TestRenderer.create().renderAsMultipleLines(result);
}

function renderSingleLineMark(result: TestResult | TestResult[]): string {
	return TestRenderer.create().renderMarksAsLines(result);
}
