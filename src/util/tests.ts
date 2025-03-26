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
		it: RunResult.pass({ name, filename })
	});
}

export function createFail({
	name = [],
	error = "irrelevant error",
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

export function createSkip({
	name = [],
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

export function createTimeout({
	name = [],
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