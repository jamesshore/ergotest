import { RunResult, TestCaseResult, TestMarkValue, TestResult, TestSuiteResult } from "../ergotest/test_result.js";
export * from "ergotest";
export declare function createSuite({ name, tests, beforeAll, afterAll, filename, mark, }?: {
    name?: string | string[];
    tests?: TestResult[];
    beforeAll?: TestCaseResult[];
    afterAll?: TestCaseResult[];
    filename?: string;
    mark?: TestMarkValue;
}): TestSuiteResult;
export declare function createPass({ name, beforeEach, afterEach, filename, mark, }?: {
    name?: string | string[];
    beforeEach?: RunResult[] | TestCaseResult[];
    afterEach?: RunResult[] | TestCaseResult[];
    filename?: string;
    mark?: TestMarkValue;
}): TestCaseResult;
export declare function createFail({ name, error, renderError, beforeEach, afterEach, filename, mark, }?: {
    name?: string | string[];
    error?: unknown;
    renderError?: () => string;
    beforeEach?: RunResult[] | TestCaseResult[];
    afterEach?: RunResult[] | TestCaseResult[];
    filename?: string;
    mark?: TestMarkValue;
}): TestCaseResult;
export declare function createSkip({ name, beforeEach, afterEach, filename, mark, }?: {
    name?: string | string[];
    beforeEach?: RunResult[] | TestCaseResult[];
    afterEach?: RunResult[] | TestCaseResult[];
    filename?: string;
    mark?: TestMarkValue;
}): TestCaseResult;
export declare function createTimeout({ name, timeout, beforeEach, afterEach, filename, mark, }?: {
    name?: string | string[];
    timeout?: number;
    beforeEach?: RunResult[] | TestCaseResult[];
    afterEach?: RunResult[] | TestCaseResult[];
    filename?: string;
    mark?: TestMarkValue;
}): TestCaseResult;
