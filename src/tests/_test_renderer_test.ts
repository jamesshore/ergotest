// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."

import { test, assert } from "tests";
import { TestRenderer } from "./test_renderer.js";
import { AssertionError } from "node:assert";
import { TestResult } from "./test_result.js";
import util from "node:util";
import { Colors } from "../infrastructure/colors.js";

export default test(({ describe }) => {

	describe("test suite rendering", ({ it }) => {

		it("renders single characters all in a row", () => {
			const result = createSuite({ results: [
				createPass(),
				createFail(),
				createSuite({ results: [ createSkip() ]}),
			]});

			assert.equal(renderCharacter(result),
				renderCharacter(createPass()) +
				renderCharacter(createFail()) +
				renderCharacter(createSkip())
			);
		});

		it("renders single lines with their built-in line feeds", () => {
			const result = createSuite({ results: [
				createPass(),
				createFail(),
				createSuite({ results: [ createSkip() ]}),
			]});

			assert.equal(renderSingleLine(result),
				renderSingleLine(createPass()) +
				renderSingleLine(createFail()) +
				renderSingleLine(createSkip())
			);
		});

		it("renders multiple lines with their built-in line feeds", () => {
			const fail = createFail();    // have to use the same fail each time, or the stack trace will be different

			const result = createSuite({ results: [
				createPass(),
				fail,
				createSuite({ results: [ createSkip() ]}),
			]});

			assert.equal(renderMultiLine(result),
				renderMultiLine(createPass()) +
				renderMultiLine(fail) +
				renderMultiLine(createSkip())
			);
		});

	});


	describe("single-character rendering", ({ it }) => {

		it("renders progress marker", () => {
			assert.equal(renderCharacter(createPass()), Colors.white("."), "pass");
			assert.equal(renderCharacter(createFail()), Colors.brightRed.inverse("X"), "fail");
			assert.equal(renderCharacter(createSkip()), Colors.cyan.dim("_"), "skip");
			assert.equal(renderCharacter(createTimeout()), Colors.purple.inverse("!"), "timeout");
		});

	});


	describe("single-line rendering", ({ it }) => {

		it("pass", () => {
			const result = createPass({ name: "my name" });
			assert.equal(renderSingleLine(result), Colors.green("passed") + " my name\n");
		});

		it("skip", () => {
			const result = createSkip({ name: "my name" });
			assert.equal(renderSingleLine(result), Colors.brightCyan("skipped") + " my name\n");
		});

		it("timeout", () => {
			const result = createTimeout({ name: "my name" });
			assert.equal(renderSingleLine(result), Colors.brightPurple("timeout") + " my name\n");
		});

		it("fail", () => {
			const result = createFail({ name: "my name" });
			assert.equal(renderSingleLine(result), Colors.brightRed("failed") + " my name\n");
		});

		it("renders multi-level names", () => {
			const result = createPass({ name: [ "parent", "child", "test" ]});
			assert.equal(renderSingleLine(result), Colors.green("passed") + " parent » child » test\n");
		});

		it("includes filename when it exists", () => {
			const result = createPass({ filename: "/my/filename.js", name: [ "parent", "child", "test" ]});
			assert.equal(
				renderSingleLine(result),
				Colors.green("passed") + " " + Colors.brightWhite("filename.js") + " » parent » child » test\n");
		});

	});


	describe("multi-line rendering", ({ describe, it }) => {

		it("'pass' renders name and description", () => {
			const result = createPass({ name: "my name" });
			assert.equal(renderMultiLine(result), Colors.brightWhite.bold("my name\n") + "\n" + Colors.green("passed") + "\n");
		});

		it("'skip' renders name and description", () => {
			const result = createSkip({ name: "my name" });
			assert.equal(renderMultiLine(result), Colors.brightWhite.bold("my name\n") + "\n" + Colors.brightCyan("skipped") + "\n");
		});

		it("'timeout' renders name and timeout", () => {
			const result = createTimeout({ name: "my name", timeout: 42 });
			assert.equal(
				renderMultiLine(result),
				Colors.brightWhite.bold("my name\n") + Colors.purple("\nTimed out after 42ms\n"),
			);
		});

		it("renders multi-level names", () => {
			const result = createPass({ name: [ "parent", "child", "test" ]});
			assert.equal(
				renderMultiLine(result),
				Colors.brightWhite.bold("parent » child\n» test\n") + "\n" + Colors.green("passed") + "\n",
			);
		});

		it("includes filename when it exists", () => {
			const result = createPass({ filename: "/my/filename.js", name: [ "parent", "child", "test" ]});
			assert.deepEqual(
				renderMultiLine(result),
				Colors.brightWhite.bold("filename.js » parent » child\n» test\n") + "\n" + Colors.green("passed") + "\n",
			);
		});


		describe("fail", ({ it }) => {

			it("renders name, stack trace, and error message", () => {
				const error = new Error("my error");
				error.stack = "my stack";

				const result = createFail({ name: "my name", error });
				assert.equal(renderMultiLine(result),
					Colors.brightWhite.bold("my name\n") +
					"\nmy stack\n" +
					Colors.brightWhite("\nmy name »\n") +
					Colors.brightRed("my error\n")
				);
			});

			it("doesn't render stack trace when it doesn't exist (presumably, because error is a string)", () => {
				const result = createFail({ name: "my name", error: "my error" });
				assert.equal(renderMultiLine(result),
					Colors.brightWhite.bold("my name\n") +
					Colors.brightRed("\nmy error\n")
				);
			});

			it("highlights stack trace lines that include test file", () => {
				const error = new Error("my error");
				error.stack = "Error: my error\n" +
					"    at file:///Users/jshore/Documents/Projects/ai_chronicles/_build/util/tests/test_result.test.js:306:11\n" +
					"    at file:///Users/jshore/Documents/Projects/ai_chronicles/_build/util/tests/test_suite.js:222:10\n" +
					"    at file:///Users/jshore/Documents/Projects/ai_chronicles/_build/util/infrastructure/clock.js:68:26\n" +
					"    at new Promise (<anonymous>)\n" +
					"    at Clock.timeoutAsync (file:///Users/jshore/Documents/Projects/ai_chronicles/_build/util/infrastructure/clock.js:56:16)\n" +
					"    at runOneTestFnAsync (file:///Users/jshore/Documents/Projects/ai_chronicles/_build/util/tests/test_suite.js:220:21)\n" +
					"    at runTestAsync (file:///Users/jshore/Documents/Projects/ai_chronicles/_build/util/tests/test_suite.js:187:27)\n" +
					"    at async TestCase._recursiveRunAsync (file:///Users/jshore/Documents/Projects/ai_chronicles/_build/util/tests/test_suite.js:178:6)\n" +
					"    at async TestSuite._recursiveRunAsync (file:///Users/jshore/Documents/Projects/ai_chronicles/_build/util/tests/test_suite.js:110:17)\n" +
					"    at async TestSuite._recursiveRunAsync (file:///Users/jshore/Documents/Projects/ai_chronicles/_build/util/tests/test_suite.js:110:17)\n";

				const expectedStack = "Error: my error\n" +
					Colors.brightWhite.bold("--> at file:///Users/jshore/Documents/Projects/ai_chronicles/_build/util/tests/test_result.test.js:306:11") + "\n" +
					"    at file:///Users/jshore/Documents/Projects/ai_chronicles/_build/util/tests/test_suite.js:222:10\n" +
					"    at file:///Users/jshore/Documents/Projects/ai_chronicles/_build/util/infrastructure/clock.js:68:26\n" +
					"    at new Promise (<anonymous>)\n" +
					"    at Clock.timeoutAsync (file:///Users/jshore/Documents/Projects/ai_chronicles/_build/util/infrastructure/clock.js:56:16)\n" +
					"    at runOneTestFnAsync (file:///Users/jshore/Documents/Projects/ai_chronicles/_build/util/tests/test_suite.js:220:21)\n" +
					"    at runTestAsync (file:///Users/jshore/Documents/Projects/ai_chronicles/_build/util/tests/test_suite.js:187:27)\n" +
					"    at async TestCase._recursiveRunAsync (file:///Users/jshore/Documents/Projects/ai_chronicles/_build/util/tests/test_suite.js:178:6)\n" +
					"    at async TestSuite._recursiveRunAsync (file:///Users/jshore/Documents/Projects/ai_chronicles/_build/util/tests/test_suite.js:110:17)\n" +
					"    at async TestSuite._recursiveRunAsync (file:///Users/jshore/Documents/Projects/ai_chronicles/_build/util/tests/test_suite.js:110:17)\n";

				const result = createFail({
					error,
					filename: "file:///Users/jshore/Documents/Projects/ai_chronicles/_build/util/tests/test_result.test.js",
				});

				assert.includes(renderMultiLine(result), expectedStack);
			});

			it("renders expected and actual values (when they exist)", () => {
				const error = new AssertionError({
					message: "my error",
					expected: "my expected",
					actual: "my actual",
				});
				error.stack = "my stack";

				const result = createFail({ name: "my name", error });
				assert.equal(renderMultiLine(result),
					Colors.brightWhite.bold("my name\n") +
					"\nmy stack\n" +
					Colors.brightWhite("\nmy name »\n") +
					Colors.brightRed("my error\n") +
					"\n" + Colors.green("expected: ") + util.inspect("my expected") + "\n" +
					Colors.brightRed("actual:   ") + util.inspect("my actual") + "\n"
				);
			});

			it("highlights differences between expected and actual values when they have more than one line", () => {
				// This test depends on util.inspect() behavior, which is not guaranteed to remain consistent across
				// Node versions, so it could break after a Node version upgrade.

				const error = new AssertionError({
					message: "my error",
					expected: "1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n",
					actual:   "1234567890\n1234567890\nXXXXXXXXXX\n1234567890\n1234567890\n1234567890\n1234567890\n",
				});
				error.stack = "my stack";

				const result = createFail({ name: "my name", error });
				assert.deepEqual(renderMultiLine(result),
					Colors.brightWhite.bold("my name\n") +
					"\nmy stack\n" +
					Colors.brightWhite("\nmy name »\n") +
					Colors.brightRed("my error\n") +
					"\n" + Colors.green("expected: ") + "'1234567890\\n' +\n" +
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
					"  '1234567890\\n'\n"
				);
			});

			it("highlights differences between expected and actual values when expected has one line", () => {
				// This test depends on util.inspect() behavior, which is not guaranteed to remain consistent across
				// Node versions, so it could break after a Node version upgrade.
				const oneLine = "1234567890123456789012345678901234567890\n";
				const twoLines = "1234567890123456789012345678901234567890\n1234567890123456789012345678901234567890\n";

				const error = new AssertionError({
					message: "my error",
					expected: oneLine,
					actual: twoLines,
				});
				error.stack = "my stack";

				const result = createFail({ name: "my name", error });
				assert.deepEqual(renderMultiLine(result),
					Colors.brightWhite.bold("my name\n") +
					"\nmy stack\n" +
					Colors.brightWhite("\nmy name »\n") +
					Colors.brightRed("my error\n") +
					"\n" + Colors.green("expected: ") + Colors.brightYellow.bold("'1234567890123456789012345678901234567890\\n'") + "\n" +
					Colors.brightRed("actual:   ") + Colors.brightYellow.bold("'1234567890123456789012345678901234567890\\n' +") + "\n" +
					Colors.brightYellow.bold("  '1234567890123456789012345678901234567890\\n'") + "\n"
				);
			});

			it("doesn't break when actual and expected have different numbers of lines", () => {
				// This test depends on util.inspect() behavior, which is not guaranteed to remain consistent across
				// Node versions, so it could break after a Node version upgrade.
				const sevenLines = "1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n";
				const twoLines = "1234567890123456789012345678901234567890\n1234567890123456789012345678901234567890\n";

				const error = new AssertionError({
					message: "my error",
					expected: sevenLines,
					actual: twoLines,
				});
				error.stack = "my stack";

				const result = createFail({ name: "my name", error });
				assert.deepEqual(renderMultiLine(result),
					Colors.brightWhite.bold("my name\n") +
					"\nmy stack\n" +
					Colors.brightWhite("\nmy name »\n") +
					Colors.brightRed("my error\n") +
					"\n" + Colors.green("expected: ") + Colors.brightYellow.bold("'1234567890\\n' +") + "\n" +
					Colors.brightYellow.bold("  '1234567890\\n' +") + "\n" +
					Colors.brightYellow.bold("  '1234567890\\n' +") + "\n" +
					Colors.brightYellow.bold("  '1234567890\\n' +") + "\n" +
					Colors.brightYellow.bold("  '1234567890\\n' +") + "\n" +
					Colors.brightYellow.bold("  '1234567890\\n' +") + "\n" +
					Colors.brightYellow.bold("  '1234567890\\n'") + "\n" +
					Colors.brightRed("actual:   ") + Colors.brightYellow.bold("'1234567890123456789012345678901234567890\\n' +") + "\n" +
					Colors.brightYellow.bold("  '1234567890123456789012345678901234567890\\n'") + "\n"
				);
			});

		});

	});

});


function renderCharacter(testResult: TestResult): string {
	return TestRenderer.create().renderCharacter(testResult);
}

function renderSingleLine(testResult: TestResult): string {
	return TestRenderer.create().renderSingleLine(testResult);
}

function renderMultiLine(testResult: TestResult): string {
	return TestRenderer.create().renderMultiLine(testResult);
}

function createSuite({
	name = "irrelevant name",
	results = [],
	filename = undefined,
}: {
	name?: string | string[],
	results?: TestResult[],
	filename?: string,
} = {}): TestResult {
	return TestResult.suite(name, results, filename);
}

function createPass({
	name = "irrelevant name",
	filename = undefined,
}: {
	name?: string | string[],
	filename?: string,
} = {}): TestResult {
	return TestResult.pass(name, filename);
}

function createFail({
	name = "irrelevant name",
	error = new Error("irrelevant error"),
	filename = undefined,
}: {
	name?: string | string[],
	error?: string | Error,
	filename?: string,
} = {}): TestResult {
	return TestResult.fail(name, error, filename);
}

function createSkip({
	name = "irrelevant name",
	filename = undefined,
}: {
	name?: string | string[],
	filename?: string,
} = {}): TestResult {
	return TestResult.skip(name, filename);
}

function createTimeout({
	name = "irrelevant name",
	timeout = 42,
	filename = undefined,
}: {
	name?: string | string[],
	timeout?: number,
	filename?: string,
} = {}): TestResult {
	return TestResult.timeout(name, timeout, filename);
}