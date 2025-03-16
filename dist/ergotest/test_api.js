// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { TestSuite } from "./test_suite.js";
import { TestMark } from "./test_result.js";
import * as ensure from "../util/ensure.js";
const testContext = [];
/**
 * Defines a test suite. Add `.skip` to skip this test suite and `.only` to only run this test suite.
 * @param {string} [optionalName] The name of the test suite. You can skip this parameter and pass
 *   {@link optionalOptions} or {@link fn} instead.
 * @param {DescribeOptions} [optionalOptions] The test suite options. You can skip this parameter and pass {@link fn}
 *   instead.
 * @param {function} [fn] The body of the test suite. In the body, call {@link describe}, {@link it}, {@link
 *   beforeAll}, {@link afterAll}, {@link beforeEach}, and {@link afterEach} to define the tests in the suite. If
 *   undefined, this test suite will be skipped.
 * @returns {TestSuite} The test suite. You’ll typically ignore the return value.
 */ export function describe(optionalName, optionalOptions, fn) {
    return createSuite(optionalName, optionalOptions, fn, TestMark.none);
}
describe.skip = function(optionalName, optionalOptions, fn) {
    return createSuite(optionalName, optionalOptions, fn, TestMark.skip);
};
describe.only = function(optionalName, optionalOptions, fn) {
    return createSuite(optionalName, optionalOptions, fn, TestMark.only);
};
/**
 * Adds a test to the current test suite. Must be run inside of a {@link test} or {@link describe} function. Add
 * `.skip` to skip this test and `.only` to only run this test.
 * @param {string} name The name of the test.
 * @param {ItOptions} [optionalOptions] The test options. You can skip this parameter and pass {@link fnAsync} instead.
 * @param {function} [fnAsync] The body of the test. May be synchronous or asynchronous. If undefined, this test will be
 *   skipped.
 */ export function it(name, optionalOptions, fnAsync) {
    currentContext("it").it(name, optionalOptions, fnAsync, TestMark.none);
}
it.skip = function it(name, optionalOptions, fnAsync) {
    currentContext("it").it(name, optionalOptions, fnAsync, TestMark.skip);
};
it.only = function it(name, optionalOptions, fnAsync) {
    currentContext("it").it(name, optionalOptions, fnAsync, TestMark.only);
};
/**
 * Adds a function to run before all the tests in the current test suite. Must be run inside of a {@link test} or
 * {@link describe} function.
 * @param {ItOptions} [optionalOptions] The before/after options. You can skip this parameter and pass @{link fnAsync}
 *   instead.
 * @param {function} fnAsync The function to run. May be synchronous or asynchronous.
 */ export function beforeAll(optionalOptions, fnAsync) {
    currentContext("beforeAll").beforeAll(optionalOptions, fnAsync);
}
/**
 * Adds a function to run after all the tests in the current test suite. Must be run inside of a {@link test} or
 * {@link describe} function.
 * @param {ItOptions} [optionalOptions] The before/after options. You can skip this parameter and pass @{link fnAsync}
 *   instead.
 * @param {function} [fnAsync] The function to run. May be synchronous or asynchronous.
 */ export function afterAll(optionalOptions, fnAsync) {
    currentContext("afterAll").afterAll(optionalOptions, fnAsync);
}
/**
 * Adds a function to run bfeore each of the tests in the current test suite. Must be run inside of a {@link test} or
 * {@link describe} function.
 * @param {ItOptions} [optionalOptions] The before/after options. You can skip this parameter and pass @{link fnAsync}
 *   instead.
 * @param {function} [fnAsync] The function to run. May be synchronous or asynchronous.
 */ export function beforeEach(optionalOptions, fnAsync) {
    currentContext("beforeEach").beforeEach(optionalOptions, fnAsync);
}
/**
 * Adds a function to run after each of the tests in the current test suite. Must be run inside of a {@link test} or
 * {@link describe} function.
 * @param {ItOptions} [optionalOptions] The before/after options. You can skip this parameter and pass @{link fnAsync}
 *   instead.
 * @param {function} [fnAsync] The function to run. May be synchronous or asynchronous.
 */ export function afterEach(optionalOptions, fnAsync) {
    currentContext("afterEach").afterEach(optionalOptions, fnAsync);
}
function createSuite(optionalName, optionalOptions, fn, mark) {
    return testContext.length === 0 ? TestSuite.create(optionalName, optionalOptions, fn, mark, testContext) : currentContext("describe").describe(optionalName, optionalOptions, fn, mark);
}
function currentContext(functionName) {
    ensure.that(testContext.length > 0, `${functionName}() must be run inside describe()`);
    return testContext[testContext.length - 1];
}

//# sourceMappingURL=/Users/jshore/Documents/Projects/ergotest/generated/src/ergotest/test_api.js.map
