// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."

import { assert, test } from "../tests.js";
import { AssertionError } from "node:assert";
import { TestCaseResult, TestMark, TestMarkValue, TestResult, TestStatus } from "./test_result.js";
import { TestRenderer } from "./test_renderer.js";

export default test(({ describe }) => {

	describe("test suite", ({ it }) => {

		it("has a name and list of test results", () => {
			const list = [ createPass({ name: "test 1" }), createPass({ name: "test 2" }) ];
			const result = TestResult.suite([ "my name" ], list);

			assert.equal(result.name, [ "my name" ]);
			assert.equal(result.children, list);
		});

		it("name can include parent suites", () => {
			const suite = createSuite({ name: [ "parent", "child", "grandchild" ] });

			assert.equal(suite.name, [ "parent", "child", "grandchild" ]);
		});

		it("has optional filename", () => {
			const suite = createSuite({ filename: "/my/filename" });
			assert.equal(suite.filename, "/my/filename");
		});

		it("has a mark", () => {
			const notSpecified = createSuite();
			const none = createSuite({ mark: TestMark.none });
			const skip = createSuite({ mark: TestMark.skip });
			const only = createSuite({ mark: TestMark.only });

			assert.equal(notSpecified.mark, TestMark.none);
			assert.equal(none.mark, TestMark.none);
			assert.equal(skip.mark, TestMark.skip);
			assert.equal(only.mark, TestMark.only);
		});

		it("can be compared using equals()", () => {
			assert.dotEquals(createSuite({ name: "my name" }), createSuite({ name: "my name" }));
			assert.notDotEquals(createSuite({ name: "my name" }), createSuite({ name: "different" }));

			assert.dotEquals(createSuite({ mark: TestMark.skip }), createSuite({ mark: TestMark.skip }));
			assert.notDotEquals(createSuite({ mark: TestMark.skip }), createSuite({ mark: TestMark.only }));

			assert.dotEquals(createSuite({ name: [ "parent", "child" ]}), createSuite({ name: [ "parent", "child" ]}));
			assert.notDotEquals(createSuite({ name: [ "parent", "child" ]}), createSuite({ name: [ "parent", "different" ]}));

			assert.dotEquals(
				createSuite({ name: "my name", children: [ createPass({ name: "test name" }) ]}),
				createSuite({ name: "my name", children: [ createPass({ name: "test name" }) ]}),
			);
			assert.notDotEquals(
				createSuite({ name: "my name", children: [ createPass({ name: "test name" }) ]}),
				createSuite({ name: "my name", children: [ createPass({ name: "different" }) ]}),
			);
		});

	});


	describe("test suite rendering", ({ it }) => {

		it("renders marks, errors, and a summary to a nicely-formatted string", () => {
			const fail = createFail();
			const result = createSuite({ children: [
				createPass({ mark: TestMark.only }),
				createSkip({ mark: TestMark.skip }),
				fail,
				createTimeout(),
			]});

			const renderer = TestRenderer.create();
			assert.equal(result.render(),
				renderer.renderMarksAsLines([
					createPass({ mark: TestMark.only }),
					createSkip({ mark: TestMark.skip })
				]) + "\n\n\n" +
				renderer.renderAsMultipleLines([
					fail,
					createTimeout(),
				]) + "\n\n" +
				renderer.renderSummary(result),
			);
		});

		it("renders marks and summary without errors", () => {
			const result = createSuite({ children: [
				createPass({ mark: TestMark.only }),
				createSkip({ mark: TestMark.skip }),
			]});

			const renderer = TestRenderer.create();
			assert.equal(result.render(),
				renderer.renderMarksAsLines([
					createPass({ mark: TestMark.only }),
					createSkip({ mark: TestMark.skip })
				]) + "\n\n" +
				renderer.renderSummary(result),
			);
		});

		it("renders errors and summary without marks", () => {
			const fail = createFail();
			const result = createSuite({ children: [
					fail,
					createTimeout(),
			]});

			const renderer = TestRenderer.create();
			assert.equal(result.render(),
				renderer.renderAsMultipleLines([
					fail,
					createTimeout(),
				]) + "\n\n" +
				renderer.renderSummary(result),
			);
		});

		it("renders summary alone", () => {
			const result = createSuite({ children: [
				createPass(),
			]});

			const renderer = TestRenderer.create();
			assert.equal(result.render(),
				renderer.renderSummary(result),
			);
		});

		it("can include average test time in summary", () => {
			const result = createSuite({ children: [
				createPass(),
				createSkip(),
			]});

			const renderer = TestRenderer.create();
			assert.equal(result.render("", 100),
				renderer.renderSummary(result, 100),
			);
		});

		it("adds optional preamble when result has marks and errors", () => {
			const result = createSuite({ children: [
				createPass({ mark: TestMark.only }),
				createTimeout(),
			]});

			const renderer = TestRenderer.create();
			assert.equal(result.render("my_preamble"),
				"my_preamble" +
				renderer.renderMarksAsLines([
					createPass({ mark: TestMark.only }),
				]) + "\n\n\n" +
				renderer.renderAsMultipleLines([
					createTimeout(),
				]) + "\n\n" +
				renderer.renderSummary(result),
			);
		});

		it("adds optional preamble when result has marks alone", () => {
			const result = createSuite({ children: [
				createPass({ mark: TestMark.only }),
			]});

			const renderer = TestRenderer.create();
			assert.equal(result.render("my_preamble"),
				"my_preamble" +
				renderer.renderMarksAsLines([
					createPass({ mark: TestMark.only }),
				]) + "\n\n" +
				renderer.renderSummary(result),
			);
		});

		it("adds optional preamble when result has errors alone", () => {
			const result = createSuite({ children: [
				createTimeout(),
			]});

			const renderer = TestRenderer.create();
			assert.equal(result.render("my_preamble"),
				"my_preamble" +
				renderer.renderAsMultipleLines([
					createTimeout(),
				]) + "\n\n" +
				renderer.renderSummary(result),
			);
		});

		it("doesn't add preamble when result has no marks or errors", () => {
			const result = createSuite();

			const renderer = TestRenderer.create();
			assert.equal(result.render("my_preamble"),
				renderer.renderSummary(result),
			);
		});

	});


	describe("test case", ({ it }) => {

		it("passing tests have a name, status, and mark", () => {
			const result = createPass({ name: "my name" });
			const noneMark = createPass({ mark: TestMark.none });
			const skipMark = createPass({ mark: TestMark.skip });
			const onlyMark = createPass({ mark: TestMark.only });

			assert.equal(result.name, [ "my name" ], "name");
			assert.equal(result.status, TestStatus.pass, "status");

			assert.equal(result.mark, TestMark.none, "mark");
			assert.equal(noneMark.mark, TestMark.none, "mark");
			assert.equal(skipMark.mark, TestMark.skip, "mark");
			assert.equal(onlyMark.mark, TestMark.only, "mark");
		});

		it("name can include parent suites", () => {
			const test = createPass({ name: [ "parent", "child", "grandchild" ] });
			assert.equal(test.name, [ "parent", "child", "grandchild" ]);
		});

		it("has optional filename", () => {
			const test = createPass({ filename: "my_filename" });
			assert.equal(test.filename, "my_filename");
		});

		it("failing tests have a name, status, mark, and error", () => {
			const result = createFail({ name: "my name", error: new Error("my error") });
			const noneMark = createFail({ mark: TestMark.none });
			const skipMark = createFail({ mark: TestMark.skip });
			const onlyMark = createFail({ mark: TestMark.only });

			assert.equal(result.name, [ "my name" ], "name");
			assert.equal(result.status, TestStatus.fail, "status");
			assert.equal((result.error as Error).message, "my error", "error");

			assert.equal(result.mark, TestMark.none, "mark");
			assert.equal(noneMark.mark, TestMark.none, "mark");
			assert.equal(skipMark.mark, TestMark.skip, "mark");
			assert.equal(onlyMark.mark, TestMark.only, "mark");
		});

		it("failing tests can have a string for the error", () => {
			const result = createFail({ name: "irrelevant name", error: "my error" });
			assert.equal(result.error, "my error");
		});

		it("skipped tests have a name, status, and mark", () => {
			const result = createSkip({ name: "my name" });
			const noneMark = createSkip({ mark: TestMark.none });
			const skipMark = createSkip({ mark: TestMark.skip });
			const onlyMark = createSkip({ mark: TestMark.only });

			assert.equal(result.name, [ "my name" ], "name");
			assert.equal(result.status, TestStatus.skip, "status");

			assert.equal(result.mark, TestMark.none, "mark");
			assert.equal(noneMark.mark, TestMark.none, "mark");
			assert.equal(skipMark.mark, TestMark.skip, "mark");
			assert.equal(onlyMark.mark, TestMark.only, "mark");
		});

		it("timeout tests have name, status, mark, and timeout", () => {
			const result = createTimeout({ name: "my name", timeout: 999 });
			const noneMark = createTimeout({ mark: TestMark.none });
			const skipMark = createTimeout({ mark: TestMark.skip });
			const onlyMark = createTimeout({ mark: TestMark.only });

			assert.equal(result.name, [ "my name" ], "name");
			assert.equal(result.status, TestStatus.timeout, "status");
			assert.equal(result.timeout, 999);

			assert.equal(result.mark, TestMark.none, "mark");
			assert.equal(noneMark.mark, TestMark.none, "mark");
			assert.equal(skipMark.mark, TestMark.skip, "mark");
			assert.equal(onlyMark.mark, TestMark.only, "mark");
		});

		it("can be compared using equals()", () => {
			assert.dotEquals(createPass({ name: "my name" }), createPass({ name: "my name" }));
			assert.dotEquals(createPass({ name: [ "parent", "child" ] }), createPass({ name: [ "parent", "child" ] }));

			// disregard stack when comparing errors: if name is equal, error is equal
			assert.dotEquals(
				createFail({ name: "my name", error: new Error("my error") }),
				createFail({ name: "my name", error: new Error("my error") }),
			);

			assert.notDotEquals(createPass({ name: "my name" }), createPass({ name: "different" }));
			assert.notDotEquals(createPass({ name: [ "parent", "child" ] }), createPass({ name: [ "parent", "different" ] }));
			assert.notDotEquals(createPass({ name: "my name" }), createSkip({ name: "my name" }));
			assert.notDotEquals(createPass({ name: "my name" }), createFail({ name: "my name", error: new Error() }));
			assert.notDotEquals(
				createTimeout({ name: "my name", timeout: 1 }),
				createTimeout({ name: "my name", timeout: 2 }),
			);

			// marks
			assert.dotEquals(createPass({ mark: TestMark.skip }), createPass({ mark: TestMark.skip }));
			assert.notDotEquals(createPass({ mark: TestMark.skip }), createPass({ mark: TestMark.none }));
		});

	});


	describe("test case rendering", ({ it }) => {

		it("renders test case as character, single line, or multi-line", () => {
			const renderer = TestRenderer.create();
			const result = createPass();

			assert.equal(result.renderAsCharacter(), renderer.renderAsCharacters(result));
			assert.equal(result.renderAsSingleLine(), renderer.renderAsSingleLines(result));
			assert.equal(result.renderAsMultipleLines(), renderer.renderAsMultipleLines(result));
		});

	});


	describe("flattening", ({ it }) => {

		it("flattens all test results into a single list", () => {
			const suite = createSuite({ children: [
				createPass(),
				createSkip(),
				createFail({ name: "fail 1" }),
				createSuite({ children: [
					createTimeout({ name: "timeout" }),
					createFail({ name: "fail 2" }),
				]}),
			]});

			assert.equal(suite.allTests(), [
				createPass(),
				createSkip(),
				createFail({ name: "fail 1" }),
				createTimeout({ name: "timeout" }),
				createFail({ name: "fail 2" }),
			]);
		});

		it("flattens tests with requested statuses into a single list", () => {
			const suite = createSuite({ children: [
				createPass(),
				createSkip(),
				createFail({ name: "fail 1" }),
				createSuite({ children: [
					createTimeout({ name: "timeout" }),
					createFail({ name: "fail 2" }),
				]}),
			]});

			assert.equal(suite.allMatchingTests(TestStatus.fail), [
				createFail({ name: "fail 1" }),
				createFail({ name: "fail 2" }),
			], "one status");

			assert.equal(suite.allMatchingTests(TestStatus.fail, TestStatus.timeout), [
				createFail({ name: "fail 1" }),
				createTimeout({ name: "timeout" }),
				createFail({ name: "fail 2" }),
			], "multiple statuses");
		});


		it("flattens all marked results into a single list", () => {
			const suite = createSuite({ children: [
				createPass({ name: "test 0.1", mark: TestMark.none }),
				createPass({ name: "test 0.2", mark: TestMark.skip }),
				createPass({ name: "test 0.3", mark: TestMark.only }),
				createSuite({ name: "suite 1", mark: TestMark.only, children: [
					createPass({ name: "test 1.1", mark: TestMark.only }),
					createPass({ name: "test 1.2", mark: TestMark.skip }),
					createSuite({ name: "suite 1.1", mark: TestMark.none, children: [
						createPass({ name: "test 1.1.1", mark: TestMark.skip }),
					]}),
					createSuite({ name: "suite 1.2", mark: TestMark.skip }),
					createPass({ name: "test 1.3", mark: TestMark.none }),
				]}),
			]});

			assert.equal(suite.allMarkedResults(), [
				createPass({ name: "test 0.2", mark: TestMark.skip }),
				createPass({ name: "test 0.3", mark: TestMark.only }),
				createSuite({ name: "suite 1", mark: TestMark.only, children: [
					createPass({ name: "test 1.1", mark: TestMark.only }),
					createPass({ name: "test 1.2", mark: TestMark.skip }),
						createSuite({ name: "suite 1.1", mark: TestMark.none, children: [
							createPass({ name: "test 1.1.1", mark: TestMark.skip }),
						]}),
						createSuite({ name: "suite 1.2", mark: TestMark.skip }),
					createPass({ name: "test 1.3", mark: TestMark.none }),
				]}),
				createPass({ name: "test 1.1", mark: TestMark.only }),
				createPass({ name: "test 1.2", mark: TestMark.skip }),
				createPass({ name: "test 1.1.1", mark: TestMark.skip }),
				createSuite({ name: "suite 1.2", mark: TestMark.skip }),
			]);
		});

		it("includes parent suite", () => {
			const suite = createSuite({ mark: TestMark.skip });

			assert.equal(suite.allMarkedResults(), [ createSuite({ mark: TestMark.skip }) ]);
		});

		it("flattens results with requested marks into a single list", () => {
			const suite = createSuite({ children: [
				createPass({ name: "test 0.1", mark: TestMark.none }),
				createPass({ name: "test 0.2", mark: TestMark.skip }),
				createPass({ name: "test 0.3", mark: TestMark.only }),
				createSuite({ name: "suite 1", mark: TestMark.only, children: [
					createPass({ name: "test 1.1", mark: TestMark.only }),
					createPass({ name: "test 1.2", mark: TestMark.skip }),
					createPass({ name: "test 1.3", mark: TestMark.none }),
				]}),
			]});

			assert.equal(suite.allMatchingMarks(TestMark.skip), [
				createPass({ name: "test 0.2", mark: TestMark.skip }),
				createPass({ name: "test 1.2", mark: TestMark.skip }),
			], ".skip");

			assert.equal(suite.allMatchingMarks(TestMark.only), [
				createPass({ name: "test 0.3", mark: TestMark.only }),
				createSuite({ name: "suite 1", mark: TestMark.only, children: [
					createPass({ name: "test 1.1", mark: TestMark.only }),
					createPass({ name: "test 1.2", mark: TestMark.skip }),
					createPass({ name: "test 1.3", mark: TestMark.none }),
				]}),
				createPass({ name: "test 1.1", mark: TestMark.only }),
			], ".only");
		});

	});


	describe("passing test files", ({ it }) => {

		it("provides names of files that have all passing tests", () => {
			const suite = createSuite({ children: [
				createPass({ filename: "file2" }),
			]});
			assert.equal(suite.allPassingFiles(), [ "file2" ]);
		});

		it("does not include filenames more than once", () => {
			const suite = createSuite({ children: [
				createPass({ filename: "my_file" }),
				createPass({ filename: "my_file" }),
			]});
			assert.equal(suite.allPassingFiles(), [ "my_file" ]);
		});

		it("does not include filenames of failing tests", () => {
			const suite = createSuite({ children: [
				createPass({ filename: "my_file1" }),
				createFail({ filename: "my_file2" }),
			]});
			assert.equal(suite.allPassingFiles(), [ "my_file1" ]);
		});

		it("does not include filenames of skipped tests", () => {
			const suite = createSuite({ children: [
				createPass({ filename: "my_file1" }),
				createSkip({ filename: "my_file2" }),
			]});
			assert.equal(suite.allPassingFiles(), [ "my_file1" ]);
		});

		it("does not include filenames of timed out tests", () => {
			const suite = createSuite({ children: [
				createPass({ filename: "my_file1" }),
				createTimeout({ filename: "my_file2" }),
			]});

			assert.equal(suite.allPassingFiles(), [ "my_file1" ]);
		});

		it("[bugfix] does not include filenames of failing tests even when sibling tests pass", () => {
			// Including filename in every test suite has resulted in tests being marked as 'pass' when they were 'fail'

			const suite = createSuite({ children: [
				createSuite({ filename: "my_file", children: [
					createPass({ filename: "my_file" }),
					createFail({ filename: "my_file" }),
				]}),
			]});

			assert.equal(suite.allPassingFiles(), []);
		});

	});


	describe("summarization", ({ it }) => {

		it("provides test count", () => {
			const suite = createSuite({ children: [
				createPass(),
				createFail(),
				createFail(),
				createSkip(),
				createSkip(),
				createSkip(),
				createTimeout(),
				createTimeout(),
				createTimeout(),
				createTimeout(),
			]});

			assert.equal(suite.count(), {
				[TestStatus.pass]: 1,
				[TestStatus.fail]: 2,
				[TestStatus.skip]: 3,
				[TestStatus.timeout]: 4,
				total: 10,
			});
		});

		it("counts tests in sub-suites", () => {
			const suite = createSuite({ children: [
				createPass(),
				createFail(),
				createSuite({ children: [
					createFail(),
					createFail(),
					createSkip(),
				]}),
			]});

			assert.equal(suite.count(), {
				[TestStatus.pass]: 1,
				[TestStatus.fail]: 3,
				[TestStatus.skip]: 1,
				[TestStatus.timeout]: 0,
				total: 5,
			});
		});

	});


	describe("serialization and deserialization", ({ it }) => {

		it("can be serialized and deserialized", () => {
			const suite = createSuite({ children: [
				createPass({ name: "pass", mark: TestMark.none }),
				createSkip({ name: "skip", mark: TestMark.skip }),
				createFail({ name: "fail", mark: TestMark.only }),
				createTimeout({ name: "timeout" }),
				createSuite({ name: "child", mark: TestMark.skip, children: [
					createPass({ name: [ "child", "child pass" ]}),
				]}),
			]});

			const serialized = suite.serialize();
			const deserialized = TestResult.deserialize(serialized);

			assert.dotEquals(deserialized, suite);
		});

		it("handles string errors", () => {
			assertErrorWorks("my error");
		});

		it("handles assertion errors", () => {
			assertErrorWorks(new AssertionError({
				message: "my message",
				actual: "my actual",
				expected: "my expected",
				operator: "my operator",
			}));
		});

		it("handles other errors", () => {
			assertErrorWorks(new Error("my message"));
		});

		it("propagates custom error fields", () => {
			assertErrorWorks(createCustomError("custom1", "custom2"));
		});

		function assertErrorWorks(error: string | Error) {
			const test = createFail({ error });
			const serialized = test.serialize();
			const deserialized = TestResult.deserialize(serialized) as TestCaseResult;

			assert.equal(deserialized.error, error);
			if (error instanceof Error && error.stack !== undefined) {
				assert.equal((deserialized.error as Error).stack, error.stack);
			}
		}

		function createCustomError(custom1: unknown, custom2: unknown) {
			interface CustomError extends Error {
				custom1: unknown,
				custom2: unknown,
			}

			const error = new Error("my message") as CustomError;
			error.custom1 = custom1;
			error.custom2 = custom2;

			return error;
		}
	});

});

function createSuite({
	name = "irrelevant name",
	children = [],
	filename = undefined,
	mark = undefined,
}: {
	name?: string | string[],
	children?: TestResult[],
	filename?: string,
	mark?: TestMarkValue,
} = {}) {
	return TestResult.suite(name, children, filename, mark);
}

function createPass({
	name = "irrelevant name",
	filename = undefined,
	mark = undefined,
}: {
	name?: string | string[],
	filename?: string,
	mark?: TestMarkValue,
} = {}) {
	return TestResult.pass(name, filename, mark);
}

function createFail({
	name = "irrelevant name",
	error = new Error("irrelevant error"),
	filename = undefined,
	mark = undefined,
}: {
	name?: string | string[],
	error?: string | Error,
	filename?: string,
	mark?: TestMarkValue,
} = {}) {
	return TestResult.fail(name, error, filename, mark);
}

function createSkip({
	name = "irrelevant name",
	filename = undefined,
	mark = undefined,
}: {
	name?: string | string[],
	filename?: string,
	mark?: TestMarkValue,
} = {}) {
	return TestResult.skip(name, filename, mark);
}

function createTimeout({
	name = "irrelevant name",
	timeout = 42,
	filename = undefined,
	mark = undefined,
}: {
	name?: string | string[],
	timeout?: number,
	filename?: string,
	mark?: TestMarkValue,
} = {}) {
	return TestResult.timeout(name, timeout, filename, mark);
}