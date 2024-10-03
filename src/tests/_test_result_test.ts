// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."

import { test, assert } from "tests";
import { AssertionError } from "node:assert";
import { TestCaseResult, TestResult } from "./test_result.js";
import util from "node:util";
import { Colors } from "../infrastructure/colors.js";

export default test(({ describe }) => {

	describe("test suite", ({ it }) => {

		it("has a name and list of test results", () => {
			const list = [ createPass({ name: "test 1" }), createPass({ name: "test 2" }) ];
			const result = TestResult.suite([ "my name" ], list);

			assert.deepEqual(result.name, [ "my name" ]);
			assert.deepEqual(result.children, list);
		});

		it("name can include parent suites", () => {
			const suite = createSuite({ name: [ "parent", "child", "grandchild" ] });

			assert.deepEqual(suite.name, [ "parent", "child", "grandchild" ]);
		});

		it("has optional filename", () => {
			const suite = createSuite({ filename: "/my/filename" });
			assert.equal(suite.filename, "/my/filename");
		});

		it("can be compared using equals()", () => {
			assert.objEqual(createSuite({ name: "my name" }), createSuite({ name: "my name" }));
			assert.objNotEqual(createSuite({ name: "my name" }), createSuite({ name: "different" }));

			assert.objEqual(createSuite({ name: [ "parent", "child" ]}), createSuite({ name: [ "parent", "child" ]}));
			assert.objNotEqual(createSuite({ name: [ "parent", "child" ]}), createSuite({ name: [ "parent", "different" ]}));

			assert.objEqual(
				createSuite({ name: "my name", results: [ createPass({ name: "test name" }) ]}),
				createSuite({ name: "my name", results: [ createPass({ name: "test name" }) ]}),
			);
			assert.objNotEqual(
				createSuite({ name: "my name", results: [ createPass({ name: "test name" }) ]}),
				createSuite({ name: "my name", results: [ createPass({ name: "different" }) ]}),
			);
		});

	});


	describe("test case", ({ it }) => {

		it("passing tests have a name and status", () => {
			const result = createPass({ name: "my name" });

			assert.deepEqual(result.name, [ "my name" ], "name");
			assert.equal(result.status, TestResult.PASS, "status");
		});

		it("name can include parent suites", () => {
			const test = createPass({ name: [ "parent", "child", "grandchild" ] });
			assert.deepEqual(test.name, [ "parent", "child", "grandchild" ]);
		});

		it("has optional filename", () => {
			const test = createPass({ filename: "my_filename" });
			assert.equal(test.filename, "my_filename");
		});

		it("failing tests have a name, status, and error", () => {
			const result = createFail({ name: "my name", error: new Error("my error") });

			assert.deepEqual(result.name, [ "my name" ], "name");
			assert.equal(result.status, TestResult.FAIL, "status");
			assert.equal((result.error as Error).message, "my error", "error");
		});

		it("failing tests can have a string for the error", () => {
			const result = createFail({ name: "irrelevant name", error: "my error" });
			assert.equal(result.error, "my error");
		});

		it("skipped tests have a name and status", () => {
			const result = createSkip({ name: "my name" });

			assert.deepEqual(result.name, [ "my name" ], "name");
			assert.equal(result.status, TestResult.SKIP, "status");
		});

		it("timeout tests have name, status, and timeout", () => {
			const result = createTimeout({ name: "my name", timeout: 999 });

			assert.deepEqual(result.name, [ "my name" ], "name");
			assert.equal(result.status, TestResult.TIMEOUT, "status");
			assert.equal(result.timeout, 999);
		});

		it("can be compared using equals()", () => {
			assert.objEqual(createPass({ name: "my name" }), createPass({ name: "my name" }));
			assert.objEqual(createPass({ name: [ "parent", "child" ] }), createPass({ name: [ "parent", "child" ] }));

			// disregard stack when comparing errors: if name is equal, error is equal
			assert.objEqual(
				createFail({ name: "my name", error: new Error("my error") }),
				createFail({ name: "my name", error: new Error("my error") }),
			);

			assert.objNotEqual(createPass({ name: "my name" }), createPass({ name: "different" }));
			assert.objNotEqual(createPass({ name: [ "parent", "child" ] }), createPass({ name: [ "parent", "different" ] }));
			assert.objNotEqual(createPass({ name: "my name" }), createSkip({ name: "my name" }));
			assert.objNotEqual(createPass({ name: "my name" }), createFail({ name: "my name", error: new Error() }));
			assert.objNotEqual(
				createTimeout({ name: "my name", timeout: 1 }),
				createTimeout({ name: "my name", timeout: 2 }),
			);
		});

		it("considers 'pass' and 'skipped' to be successes, and 'fail' and 'timeout' to be failures", () => {
			assert.equal(createPass().isSuccess(), true, "pass");
			assert.equal(createFail().isSuccess(), false, "fail");
			assert.equal(createSkip().isSuccess(), true, "skip");
			assert.equal(createTimeout().isSuccess(), false, "timeout");
		});

	});


	describe("flattening", ({ it }) => {

		it("flattens all test results into a single list", () => {
			const suite = createSuite({ results: [
				createPass(),
				createSkip(),
				createFail({ name: "fail 1" }),
				createSuite({ results: [
					createTimeout({ name: "timeout" }),
					createFail({ name: "fail 2" }),
				]}),
			]});

			const tests = suite.allTests();
			assert.deepEqual(tests, [
				createPass(),
				createSkip(),
				createFail({ name: "fail 1" }),
				createTimeout({ name: "timeout" }),
				createFail({ name: "fail 2" }),
			]);
		});

		it("flattens tests with requested statuses into a single list", () => {
			const suite = createSuite({ results: [
				createPass(),
				createSkip(),
				createFail({ name: "fail 1" }),
				createSuite({ results: [
					createTimeout({ name: "timeout" }),
					createFail({ name: "fail 2" }),
				]}),
			]});

			assert.deepEqual(suite.allMatchingTests(TestResult.STATUS.FAIL), [
				createFail({ name: "fail 1" }),
				createFail({ name: "fail 2" }),
			], "one status");

			assert.deepEqual(suite.allMatchingTests(TestResult.STATUS.FAIL, TestResult.STATUS.TIMEOUT), [
				createFail({ name: "fail 1" }),
				createTimeout({ name: "timeout" }),
				createFail({ name: "fail 2" }),
			], "multiple statuses");
		});

	});


	describe("passing test files", ({ it }) => {

		it("provides names of files that have all passing tests", () => {
			const suite = createSuite({ results: [
				createPass({ filename: "file2" }),
			]});
			assert.deepEqual(suite.allPassingFiles(), [ "file2" ]);
		});

		it("does not include filenames more than once", () => {
			const suite = createSuite({ results: [
				createPass({ filename: "my_file" }),
				createPass({ filename: "my_file" }),
			]});
			assert.deepEqual(suite.allPassingFiles(), [ "my_file" ]);
		});

		it("does not include filenames of failing tests", () => {
			const suite = createSuite({ results: [
				createPass({ filename: "my_file1" }),
				createFail({ filename: "my_file2" }),
			]});
			assert.deepEqual(suite.allPassingFiles(), [ "my_file1" ]);
		});

		it("does not include filenames of skipped tests", () => {
			const suite = createSuite({ results: [
				createPass({ filename: "my_file1" }),
				createSkip({ filename: "my_file2" }),
			]});
			assert.deepEqual(suite.allPassingFiles(), [ "my_file1" ]);
		});

		it("does not include filenames of timed out tests", () => {
			const suite = createSuite({ results: [
				createPass({ filename: "my_file1" }),
				createTimeout({ filename: "my_file2" }),
			]});

			assert.deepEqual(suite.allPassingFiles(), [ "my_file1" ]);
		});

		it("[bugfix] does not include filenames of failing tests even when sibling tests pass", () => {
			// Including filename in every test suite has resulted in tests being marked as 'pass' when they were 'fail'

			const suite = createSuite({ results: [
				createSuite({ filename: "my_file", results: [
					createPass({ filename: "my_file" }),
					createFail({ filename: "my_file" }),
				]}),
			]});

			assert.deepEqual(suite.allPassingFiles(), []);
		});

	});


	describe("summarization", ({ it }) => {

		it("provides test count", () => {
			const suite = createSuite({ results: [
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

			assert.deepEqual(suite.count(), {
				[TestResult.PASS]: 1,
				[TestResult.FAIL]: 2,
				[TestResult.SKIP]: 3,
				[TestResult.TIMEOUT]: 4,
				total: 10,
			});
		});

		it("counts tests in sub-suites", () => {
			const suite = createSuite({ results: [
				createPass(),
				createFail(),
				createSuite({ results: [
					createFail(),
					createFail(),
					createSkip(),
				]}),
			]});

			assert.deepEqual(suite.count(), {
				[TestResult.PASS]: 1,
				[TestResult.FAIL]: 3,
				[TestResult.SKIP]: 1,
				[TestResult.TIMEOUT]: 0,
				total: 5,
			});
		});

	});


	describe("serialization and deserialization", ({ it }) => {

		it("can be serialized and deserialized", () => {
			const suite = createSuite({ results: [
				createPass({ name: "pass" }),
				createSkip({ name: "skip" }),
				createFail({ name: "fail" }),
				createTimeout({ name: "timeout" }),
				createSuite({ name: "child", results: [
					createPass({ name: [ "child", "child pass" ]}),
				]}),
			]});

			const serialized = suite.serialize();
			// console.log(serialized);
			const deserialized = TestResult.deserialize(serialized);

			assert.objEqual(deserialized, suite);
		});

		it("handles string errors", () => {
			const test = createFail({ error: "my error" });

			const serialized = test.serialize();
			assert.objEqual(TestResult.deserialize(serialized), test);
		});

		it("handles assertion errors", () => {
			const error = new AssertionError({
				message: "my message",
				actual: "my actual",
				expected: "my expected",
				operator: "my operator",
			});

			const test = createFail({ error });
			const serialized = test.serialize();
			const deserialized = TestResult.deserialize(serialized) as TestCaseResult;

			assert.deepEqual(deserialized.error, error);
			assert.equal((deserialized.error as Error).stack, error.stack);
		});

		it("handles other errors", () => {
			const error = new Error("my message");

			const test = createFail({ error });
			const serialized = test.serialize();
			const deserialized = TestResult.deserialize(serialized) as TestCaseResult;

			assert.deepEqual(deserialized.error, error);
			assert.equal((deserialized.error as Error).stack, error.stack);
		});

		it("propagates custom fields", () => {
			interface MyError extends Error {
				custom1: string,
				custom2: string,
			}

			const error = new Error("my message") as MyError;
			error.custom1 = "custom1";
			error.custom2 = "custom2";

			const test = createFail({ error });
			const serialized = test.serialize();
			const deserialized = TestResult.deserialize(serialized) as TestCaseResult;

			assert.deepEqual(deserialized.error, error);
			assert.equal((deserialized.error as Error).stack, error.stack);
		});

	});

});

function createSuite({
	name = "irrelevant name",
	results = [],
	filename = undefined,
}: {
	name?: string | string[],
	results?: TestResult[],
	filename?: string,
} = {}) {
	return TestResult.suite(name, results, filename);
}

function createPass({
	name = "irrelevant name",
	filename = undefined,
}: {
	name?: string | string[],
	filename?: string,
} = {}) {
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
} = {}) {
	return TestResult.fail(name, error, filename);
}

function createSkip({
	name = "irrelevant name",
	filename = undefined,
}: {
	name?: string | string[],
	filename?: string,
} = {}) {
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
} = {}) {
	return TestResult.timeout(name, timeout, filename);
}