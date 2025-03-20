// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { assert, describe, it } from "../util/tests.js";
import { AssertionError } from "node:assert";
import { TestCaseResult, TestMark, TestMarkValue, TestResult, TestStatus } from "./test_result.js";
import { renderError, TestRenderer } from "./test_renderer.js";
import { TestOptions } from "./test_suite.js";

const IRRELEVANT_ERROR = new Error("irrelevant error");

export default describe(() => {

	describe("test suite", () => {

		it("has a name and list of test results", () => {
			const tests = [ createPass({ name: "test 1" }), createPass({ name: "test 2" }) ];
			const suite = TestResult.suite([ "my name" ], tests);

			assert.equal(suite.name, [ "my name" ]);
			assert.equal(suite.tests, tests);
		});

		it("name can include parent suites", () => {
			const suite = createSuite({ name: [ "parent", "child", "grandchild" ] });

			assert.equal(suite.name, [ "parent", "child", "grandchild" ]);
		});

		it("has optional beforeAll and afterAll results", () => {
			const beforeAll = [ createPass({ name: "before 1" }), createPass({ name: "before 2" }) ];
			const afterAll = [ createPass({ name: "after 1" }), createPass({ name: "after 2" }) ];
			const suite = createSuite({ beforeAll, afterAll });

			assert.equal(suite.beforeAll, beforeAll, "beforeAll");
			assert.equal(suite.afterAll, afterAll, "afterAll");

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
				createSuite({ tests: [ createPass({ name: "test name" }) ]}),
				createSuite({ tests: [ createPass({ name: "test name" }) ]}),
			);
			assert.notDotEquals(
				createSuite({ tests: [ createPass({ name: "test name" }) ]}),
				createSuite({ tests: [ createPass({ name: "different" }) ]}),
			);

			assert.dotEquals(
				createSuite({ beforeAll: [ createPass({ name: "before" }) ]}),
				createSuite({ beforeAll: [ createPass({ name: "before" }) ]}),
			);
			assert.notDotEquals(
				createSuite({ beforeAll: [ createPass({ name: "before" }) ]}),
				createSuite({ beforeAll: [ createPass({ name: "different" }) ]}),
			);

			assert.dotEquals(
				createSuite({ afterAll: [ createPass({ name: "after" }) ]}),
				createSuite({ afterAll: [ createPass({ name: "after" }) ]}),
			);
			assert.notDotEquals(
				createSuite({ afterAll: [ createPass({ name: "after" }) ]}),
				createSuite({ afterAll: [ createPass({ name: "different" }) ]}),
			);
		});

	});


	describe("test suite rendering", () => {

		it("renders marks, errors, and a summary to a nicely-formatted string", () => {
			const fail = createFail();
			const result = createSuite({ tests: [
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
			const result = createSuite({ tests: [
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
			const result = createSuite({ tests: [
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
			const result = createSuite({ tests: [
				createPass(),
			]});

			const renderer = TestRenderer.create();
			assert.equal(result.render(),
				renderer.renderSummary(result),
			);
		});

		it("can include average test time in summary", () => {
			const result = createSuite({ tests: [
				createPass(),
				createSkip(),
			]});

			const renderer = TestRenderer.create();
			assert.equal(result.render("", 100),
				renderer.renderSummary(result, 100),
			);
		});

		it("adds optional preamble when result has marks and errors", () => {
			const result = createSuite({ tests: [
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
			const result = createSuite({ tests: [
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
			const result = createSuite({ tests: [
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


	describe("test case", () => {

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

		it("has optional beforeEach and afterEach results", () => {
			const beforeEach = [ createPass(), createFail() ];
			const afterEach = [ createTimeout(), createSkip() ];

			const pass = createPass({ beforeEach, afterEach });
			const skip = createSkip({ beforeEach, afterEach });
			const fail = createFail({ beforeEach, afterEach });
			const timeout = createTimeout({ beforeEach, afterEach });

			assert.equal(pass.beforeEach, beforeEach);
			assert.equal(pass.afterEach, afterEach);
			assert.equal(skip.beforeEach, beforeEach);
			assert.equal(skip.afterEach, afterEach);
			assert.equal(fail.beforeEach, beforeEach);
			assert.equal(fail.afterEach, afterEach);
			assert.equal(timeout.beforeEach, beforeEach);
			assert.equal(timeout.afterEach, afterEach);
		});

		it("has optional filename", () => {
			const test = createPass({ filename: "my_filename" });
			assert.equal(test.filename, "my_filename");
		});

		it("failing tests have a name, status, mark, error message, and error rendering", () => {
			const error = new AssertionError({
				message: "my error",
				expected: "foo",
				actual: "bar",
			});

			const result = createFail({
				name: "my name",
				error,
				renderError: () => "my custom renderer",
			});
			const noneMark = createFail({ mark: TestMark.none });
			const skipMark = createFail({ mark: TestMark.skip });
			const onlyMark = createFail({ mark: TestMark.only });

			assert.equal(result.name, [ "my name" ], "name");
			assert.equal(result.status, TestStatus.fail, "status");
			assert.equal(result.errorMessage, "my error", "error message");
			assert.equal(result.errorRender, "my custom renderer", "rendered error");

			assert.equal(result.mark, TestMark.none, "mark");
			assert.equal(noneMark.mark, TestMark.none, "mark");
			assert.equal(skipMark.mark, TestMark.skip, "mark");
			assert.equal(onlyMark.mark, TestMark.only, "mark");
		});

		it("failing tests can have any error type", () => {
			const degenerateError = new Error();
			// @ts-expect-error We're deliberately breaking type rules to test an edge case
			degenerateError.message = undefined;

			check(degenerateError, "");
			check("my error", "my error");
			check(123, "123");
			check(undefined, "undefined");
			check(null, "null");
			check(NaN, "NaN");
			check([ 1, 2, 3 ], "[ 1, 2, 3 ]");
			check({ a: 1, b: 2 }, "{ a: 1, b: 2 }");
			check({ message: "my message" }, "{ message: 'my message' }");

			function check(error: unknown, expected: string) {
				const result = TestResult.fail([], error);
				assert.equal(result.errorMessage, expected);
			}
		});

		it("failing tests have default error renderer", () => {
			const result = createFail({ name: "my name", error: "my error" });

			assert.equal(result.errorRender, renderError([ "my name" ], "my error", TestMark.none));
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

			// disregard rendering when comparing errors: if message is equal, error is equal
			assert.dotEquals(
				createFail({ name: "my name", error: new Error("my error") }),
				createFail({ name: "my name", error: new Error("my error") }),
			);
			assert.notDotEquals(
				createFail({ name: "my name", error: new Error("my error") }),
				createFail({ name: "my name", error: new Error("different error") }),
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


	describe("test case interaction with beforeEach and afterEach", () => {

		// Definitely inherit status. Not sure we want to inherit test outcome
		// Maybe we need to have a separate accessor for the test result proper
		// Maybe we need a new type TestSuiteResult --> TestCaseResult --> TestRunResult
		it("inherits failure from beforeEach()");
		it("inherits failure from afterEach()");
		it("inherits first failure when multiple failures exist");
		it("inherits timeout from beforeEach()");
		it("inherits timeout from afterEach()");

		// not sure if we want these; maybe we just change the reporting instead to support multiple failures per test case
		it("inherits first timeout when multiple timeouts exist");
		it("inherits failure over timeout when both exist");
		it("inherits first failure over timeouts when multiple of each exist");

	});


	describe("test case rendering", () => {

		it("renders test case as character, single line, or multi-line", () => {
			const renderer = TestRenderer.create();
			const result = createPass();

			assert.equal(result.renderAsCharacter(), renderer.renderAsCharacters(result));
			assert.equal(result.renderAsSingleLine(), renderer.renderAsSingleLines(result));
			assert.equal(result.renderAsMultipleLines(), renderer.renderAsMultipleLines(result));
		});

	});


	describe("flattening", () => {

		it("flattens all test results into a single list", () => {
			const suite = createSuite({ tests: [
				createPass(),
				createSkip(),
				createFail({ name: "fail 1" }),
				createSuite({ tests: [
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
			const suite = createSuite({ tests: [
				createPass(),
				createSkip({ name: "skip" }),
				createTimeout({ name: "timeout 1" }),
				createSuite({ tests: [
					createFail(),
					createTimeout({ name: "timeout 2" }),
				]}),
			]});

			assert.equal(suite.allMatchingTests(TestStatus.timeout), [
				createTimeout({ name: "timeout 1" }),
				createTimeout({ name: "timeout 2" }),
			], "one status");

			assert.equal(suite.allMatchingTests(TestStatus.timeout, TestStatus.skip), [
				createSkip({ name: "skip" }),
				createTimeout({ name: "timeout 1" }),
				createTimeout({ name: "timeout 2" }),
			], "multiple statuses");
		});

		it("includes beforeAll() and afterAll() results in list", () => {
			const suite = createSuite({
				beforeAll: [
					createPass({ name: "beforeAll pass" }),
					createSkip({ name: "beforeAll skip" }),
					createFail({ name: "beforeAll fail" }),
					createTimeout({ name: "beforeAll timeout" }),
				],
				afterAll: [
					createPass({ name: "afterAll pass" }),
					createSkip({ name: "afterAll skip" }),
				],
				tests: [
					createPass({ name: "normal test" }),
				]
			});

			assert.equal(suite.allTests(), [
				createPass({ name: "beforeAll pass" }),
				createSkip({ name: "beforeAll skip" }),
				createFail({ name: "beforeAll fail" }),
				createTimeout({ name: "beforeAll timeout" }),
				createPass({ name: "afterAll pass" }),
				createSkip({ name: "afterAll skip" }),
				createPass({ name: "normal test" }),
			], "allTests()");

			assert.equal(suite.allMatchingTests(TestStatus.pass, TestStatus.timeout), [
				createPass({ name: "beforeAll pass" }),
				createTimeout({ name: "beforeAll timeout" }),
				createPass({ name: "afterAll pass" }),
				createPass({ name: "normal test" }),
			], "allMatchingTests()");
		});

		it("flattens all marked results into a single list", () => {
			const suite = createSuite({ tests: [
				createPass({ name: "test 0.1", mark: TestMark.none }),
				createPass({ name: "test 0.2", mark: TestMark.skip }),
				createPass({ name: "test 0.3", mark: TestMark.only }),
				createSuite({ name: "suite 1", mark: TestMark.only, tests: [
					createPass({ name: "test 1.1", mark: TestMark.only }),
					createPass({ name: "test 1.2", mark: TestMark.skip }),
					createSuite({ name: "suite 1.1", mark: TestMark.none, tests: [
						createPass({ name: "test 1.1.1", mark: TestMark.skip }),
					]}),
					createSuite({ name: "suite 1.2", mark: TestMark.skip }),
					createPass({ name: "test 1.3", mark: TestMark.none }),
				]}),
			]});

			assert.equal(suite.allMarkedResults(), [
				createPass({ name: "test 0.2", mark: TestMark.skip }),
				createPass({ name: "test 0.3", mark: TestMark.only }),
				createSuite({ name: "suite 1", mark: TestMark.only, tests: [
					createPass({ name: "test 1.1", mark: TestMark.only }),
					createPass({ name: "test 1.2", mark: TestMark.skip }),
						createSuite({ name: "suite 1.1", mark: TestMark.none, tests: [
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
			const suite = createSuite({ tests: [
				createPass({ name: "test 0.1", mark: TestMark.none }),
				createPass({ name: "test 0.2", mark: TestMark.skip }),
				createPass({ name: "test 0.3", mark: TestMark.only }),
				createSuite({ name: "suite 1", mark: TestMark.only, tests: [
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
				createSuite({ name: "suite 1", mark: TestMark.only, tests: [
					createPass({ name: "test 1.1", mark: TestMark.only }),
					createPass({ name: "test 1.2", mark: TestMark.skip }),
					createPass({ name: "test 1.3", mark: TestMark.none }),
				]}),
				createPass({ name: "test 1.1", mark: TestMark.only }),
			], ".only");
		});

		it("includes beforeAll() and afterAll() results in list of marks", () => {
			const suite = createSuite({
				mark: TestMark.only,
				beforeAll: [ createPass({ name: "beforeAll", mark: TestMark.none }) ],
				afterAll: [ createPass({ name: "afterAll", mark: TestMark.none }) ],
			});

			assert.equal(suite.allMatchingMarks(TestMark.none), [
				createPass({ name: "beforeAll", mark: TestMark.none }),
				createPass({ name: "afterAll", mark: TestMark.none }),
			], ".none");

			assert.equal(suite.allMatchingMarks(TestMark.skip), [], ".skip");
		});

	});


	describe("passing test files", () => {

		it("provides names of files that have all passing tests", () => {
			const suite = createSuite({ tests: [
				createPass({ filename: "file2" }),
			]});
			assert.equal(suite.allPassingFiles(), [ "file2" ]);
		});

		it("does not include filenames more than once", () => {
			const suite = createSuite({ tests: [
				createPass({ filename: "my_file" }),
				createPass({ filename: "my_file" }),
			]});
			assert.equal(suite.allPassingFiles(), [ "my_file" ]);
		});

		it("does not include filenames of failing tests", () => {
			const suite = createSuite({ tests: [
				createPass({ filename: "my_file1" }),
				createFail({ filename: "my_file2" }),
			]});
			assert.equal(suite.allPassingFiles(), [ "my_file1" ]);
		});

		it("does not include filenames of failing beforeAll/afterAll blocks", () => {
			const suite = createSuite({ tests: [
				createSuite({
					beforeAll: [ createPass({ filename: "pass_file" }) ],
					afterAll: [ createPass({ filename: "pass_file" }) ],
					tests: [ createPass({ filename: "pass_file" }) ],
				}),
				createSuite({
					beforeAll: [ createFail({ filename: "fail_beforeAll" }) ],
					afterAll: [ createPass({ filename: "fail_beforeAll" }) ],
					tests: [ createPass({ filename: "fail_beforeAll" }) ],
				}),
				createSuite({
					beforeAll: [ createPass({ filename: "fail_afterAll" }) ],
					afterAll: [ createFail({ filename: "fail_afterAll" }) ],
					tests: [ createPass({ filename: "fail_afterAll" }) ],
				}),
			]});

			assert.equal(suite.allPassingFiles(), [ "pass_file" ]);
		});

		it("does not include filenames of skipped tests", () => {
			const suite = createSuite({ tests: [
				createPass({ filename: "my_file1" }),
				createSkip({ filename: "my_file2" }),
			]});
			assert.equal(suite.allPassingFiles(), [ "my_file1" ]);
		});

		it("does not include filenames of timed out tests", () => {
			const suite = createSuite({ tests: [
				createPass({ filename: "my_file1" }),
				createTimeout({ filename: "my_file2" }),
			]});

			assert.equal(suite.allPassingFiles(), [ "my_file1" ]);
		});

		it("[bugfix] does not include filenames of failing tests even when sibling tests pass", () => {
			// Including filename in every test suite has resulted in tests being marked as 'pass' when they were 'fail'

			const suite = createSuite({ tests: [
				createSuite({ filename: "my_file", tests: [
					createPass({ filename: "my_file" }),
					createFail({ filename: "my_file" }),
				]}),
			]});

			assert.equal(suite.allPassingFiles(), []);
		});

	});


	describe("summarization", () => {

		it("provides test count", () => {
			const suite = createSuite({ tests: [
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
			const suite = createSuite({ tests: [
				createPass(),
				createFail(),
				createSuite({ tests: [
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


	describe("serialization and deserialization", () => {

		it("can be serialized and deserialized", () => {
			const suite = createSuite({ tests: [
				createPass({ name: "pass", mark: TestMark.none }),
				createSkip({ name: "skip", mark: TestMark.skip }),
				createFail({ name: "fail", mark: TestMark.only }),
				createTimeout({ name: "timeout" }),
				createSuite({ name: "child", mark: TestMark.skip,
					beforeAll: [ createPass({ name: [ "child", "beforeAll" ]}) ],
					afterAll: [ createPass({ name: [ "child", "afterAll" ]}) ],
					tests: [ createPass({ name: [ "child", "child pass" ]}) ],
				}),
			]});

			const serialized = suite.serialize();
			const deserialized = TestResult.deserialize(serialized);

			assert.dotEquals(deserialized, suite);
		});

	});

});

function createSuite({
	name = "irrelevant name",
	tests = [],
	beforeAll = undefined,
	afterAll = undefined,
	filename = undefined,
	mark = undefined,
}: {
	name?: string | string[],
	tests?: TestResult[],
	beforeAll?: TestCaseResult[],
	afterAll?: TestCaseResult[],
	filename?: string,
	mark?: TestMarkValue,
} = {}) {
	return TestResult.suite(name, tests, { beforeAll, afterAll, filename, mark });
}

function createPass({
	name = "irrelevant name",
	beforeEach = undefined,
	afterEach = undefined,
	filename = undefined,
	mark = undefined,
}: {
	name?: string | string[],
	beforeEach?: TestCaseResult[],
	afterEach?: TestCaseResult[],
	filename?: string,
	mark?: TestMarkValue,
} = {}) {
	return TestResult.pass(name, { beforeEach, afterEach, filename, mark });
}

function createFail({
	name = "irrelevant name",
	error = IRRELEVANT_ERROR,
	renderError = undefined,
	beforeEach = undefined,
	afterEach = undefined,
	filename = undefined,
	mark = undefined,
}: {
	name?: string | string[],
	error?: string | Error,
	renderError?: () => string,
	beforeEach?: TestCaseResult[],
	afterEach?: TestCaseResult[],
	filename?: string,
	mark?: TestMarkValue,
} = {}) {
	return TestResult.fail(name, error, { renderError, beforeEach, afterEach, filename, mark });
}

function createSkip({
	name = "irrelevant name",
	beforeEach = undefined,
	afterEach = undefined,
	filename = undefined,
	mark = undefined,
}: {
	name?: string | string[],
	beforeEach?: TestCaseResult[],
	afterEach?: TestCaseResult[],
	filename?: string,
	mark?: TestMarkValue,
} = {}) {
	return TestResult.skip(name, { beforeEach, afterEach, filename, mark });
}

function createTimeout({
	name = "irrelevant name",
	timeout = 42,
	beforeEach = undefined,
	afterEach = undefined,
	filename = undefined,
	mark = undefined,
}: {
	name?: string | string[],
	timeout?: number,
	beforeEach?: TestCaseResult[],
	afterEach?: TestCaseResult[],
	filename?: string,
	mark?: TestMarkValue,
} = {}) {
	return TestResult.timeout(name, timeout, { beforeEach, afterEach, filename, mark });
}