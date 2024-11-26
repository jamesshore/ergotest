import { DescribeFn, DescribeOptions, ItFn, ItOptions, TestSuite } from "./test_suite.js";
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
 */
export declare function describe(optionalName?: string | DescribeOptions | DescribeFn, optionalOptions?: DescribeOptions | DescribeFn, fn?: DescribeFn): TestSuite;
export declare namespace describe {
    var skip: (optionalName?: string | DescribeOptions | DescribeFn, optionalOptions?: DescribeOptions | DescribeFn, fn?: DescribeFn) => TestSuite;
    var only: (optionalName?: string | DescribeOptions | DescribeFn, optionalOptions?: DescribeOptions | DescribeFn, fn?: DescribeFn) => TestSuite;
}
/**
 * Adds a test to the current test suite. Must be run inside of a {@link test} or {@link describe} function. Add
 * `.skip` to skip this test and `.only` to only run this test.
 * @param {string} name The name of the test.
 * @param {ItOptions} [optionalOptions] The test options. You can skip this parameter and pass {@link fnAsync} instead.
 * @param {function} [fnAsync] The body of the test. May be synchronous or asynchronous. If undefined, this test will be
 *   skipped.
 */
export declare function it(name: string, optionalOptions?: ItOptions | ItFn, fnAsync?: ItFn): void;
export declare namespace it {
    var skip: (name: string, optionalOptions?: ItOptions | ItFn, fnAsync?: ItFn) => void;
    var only: (name: string, optionalOptions?: ItOptions | ItFn, fnAsync?: ItFn) => void;
}
/**
 * Adds a function to run before all the tests in the current test suite. Must be run inside of a {@link test} or
 * {@link describe} function.
 * @param {ItOptions} [optionalOptions] The before/after options. You can skip this parameter and pass @{link fnAsync}
 *   instead.
 * @param {function} fnAsync The function to run. May be synchronous or asynchronous.
 */
export declare function beforeAll(optionalOptions: ItOptions | ItFn, fnAsync?: ItFn): void;
/**
 * Adds a function to run after all the tests in the current test suite. Must be run inside of a {@link test} or
 * {@link describe} function.
 * @param {ItOptions} [optionalOptions] The before/after options. You can skip this parameter and pass @{link fnAsync}
 *   instead.
 * @param {function} [fnAsync] The function to run. May be synchronous or asynchronous.
 */
export declare function afterAll(optionalOptions: ItOptions | ItFn, fnAsync?: ItFn): void;
/**
 * Adds a function to run bfeore each of the tests in the current test suite. Must be run inside of a {@link test} or
 * {@link describe} function.
 * @param {ItOptions} [optionalOptions] The before/after options. You can skip this parameter and pass @{link fnAsync}
 *   instead.
 * @param {function} [fnAsync] The function to run. May be synchronous or asynchronous.
 */
export declare function beforeEach(optionalOptions: ItOptions | ItFn, fnAsync?: ItFn): void;
/**
 * Adds a function to run after each of the tests in the current test suite. Must be run inside of a {@link test} or
 * {@link describe} function.
 * @param {ItOptions} [optionalOptions] The before/after options. You can skip this parameter and pass @{link fnAsync}
 *   instead.
 * @param {function} [fnAsync] The function to run. May be synchronous or asynchronous.
 */
export declare function afterEach(optionalOptions: ItOptions | ItFn, fnAsync?: ItFn): void;
