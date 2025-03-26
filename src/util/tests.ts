import { RunResult, TestCaseResult, TestMarkValue, TestResult } from "../ergotest/test_result.js";

export * from "ergotest";

export function createSuite({
	name = [],
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

export function createPass({
	name = [],
	beforeEach = [],
	afterEach = [],
	filename = undefined,
	mark = undefined,
}: {
	name?: string | string[],
	beforeEach?: TestCaseResult[],
	afterEach?: TestCaseResult[],
	filename?: string,
	mark?: TestMarkValue,
} = {}) {
	return TestResult.testCase({
		mark,
		beforeEach: beforeEach.map(each => each.it),
		afterEach: afterEach.map(each => each.it),
		it: RunResult.pass({ name, filename }),
	});
}

export function createFail({
	name = [],
	error = "irrelevant error",
	renderError = undefined,
	beforeEach = [],
	afterEach = [],
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
	return TestResult.testCase({
		mark,
		beforeEach: beforeEach.map(each => each.it),
		afterEach: afterEach.map(each => each.it),
		it: RunResult.fail({ name, filename, error, renderError }),
	});
}

export function createSkip({
	name = [],
	beforeEach = [],
	afterEach = [],
	filename = undefined,
	mark = undefined,
}: {
	name?: string | string[],
	beforeEach?: TestCaseResult[],
	afterEach?: TestCaseResult[],
	filename?: string,
	mark?: TestMarkValue,
} = {}) {
	return TestResult.testCase({
		mark,
		beforeEach: beforeEach.map(each => each.it),
		afterEach: afterEach.map(each => each.it),
		it: RunResult.skip({ name, filename }),
	});
}

export function createTimeout({
	name = [],
	timeout = 42,
	beforeEach = [],
	afterEach = [],
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
	return TestResult.testCase({
		mark,
		beforeEach: beforeEach.map(each => each.it),
		afterEach: afterEach.map(each => each.it),
		it: RunResult.timeout({ name, filename, timeout }),
	});
}