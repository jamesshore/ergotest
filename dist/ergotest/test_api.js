// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { TestMark } from "./results/test_result.js";
import * as ensure from "../util/ensure.js";
import { FailureTestCase, TestCase } from "./suite/test_case.js";
import { TestSuite } from "./suite/test_suite.js";
import { BeforeAfter } from "./suite/before_after.js";
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
    return testContext.describe(optionalName, optionalOptions, fn, TestMark.none);
}
describe.skip = function(optionalName, optionalOptions, fn) {
    return testContext.describe(optionalName, optionalOptions, fn, TestMark.skip);
};
describe.only = function(optionalName, optionalOptions, fn) {
    return testContext.describe(optionalName, optionalOptions, fn, TestMark.only);
};
/**
 * Adds a test to the current test suite. Must be run inside of a {@link test} or {@link describe} function. Add
 * `.skip` to skip this test and `.only` to only run this test.
 * @param {string} name The name of the test.
 * @param {ItOptions} [optionalOptions] The test options. You can skip this parameter and pass {@link fnAsync} instead.
 * @param {function} [fnAsync] The body of the test. May be synchronous or asynchronous. If undefined, this test will be
 *   skipped.
 */ export function it(name, optionalOptions, fnAsync) {
    testContext.it(name, optionalOptions, fnAsync, TestMark.none);
}
it.skip = function it(name, optionalOptions, fnAsync) {
    testContext.it(name, optionalOptions, fnAsync, TestMark.skip);
};
it.only = function it(name, optionalOptions, fnAsync) {
    testContext.it(name, optionalOptions, fnAsync, TestMark.only);
};
/**
 * Adds a function to run before all the tests in the current test suite. Must be run inside of a {@link test} or
 * {@link describe} function.
 * @param {ItOptions} [optionalOptions] The before/after options. You can skip this parameter and pass @{link fnAsync}
 *   instead.
 * @param {function} fnAsync The function to run. May be synchronous or asynchronous.
 */ export function beforeAll(optionalOptions, fnAsync) {
    testContext.beforeAll(optionalOptions, fnAsync);
}
/**
 * Adds a function to run after all the tests in the current test suite. Must be run inside of a {@link test} or
 * {@link describe} function.
 * @param {ItOptions} [optionalOptions] The before/after options. You can skip this parameter and pass @{link fnAsync}
 *   instead.
 * @param {function} [fnAsync] The function to run. May be synchronous or asynchronous.
 */ export function afterAll(optionalOptions, fnAsync) {
    testContext.afterAll(optionalOptions, fnAsync);
}
/**
 * Adds a function to run bfeore each of the tests in the current test suite. Must be run inside of a {@link test} or
 * {@link describe} function.
 * @param {ItOptions} [optionalOptions] The before/after options. You can skip this parameter and pass @{link fnAsync}
 *   instead.
 * @param {function} [fnAsync] The function to run. May be synchronous or asynchronous.
 */ export function beforeEach(optionalOptions, fnAsync) {
    testContext.beforeEach(optionalOptions, fnAsync);
}
/**
 * Adds a function to run after each of the tests in the current test suite. Must be run inside of a {@link test} or
 * {@link describe} function.
 * @param {ItOptions} [optionalOptions] The before/after options. You can skip this parameter and pass @{link fnAsync}
 *   instead.
 * @param {function} [fnAsync] The function to run. May be synchronous or asynchronous.
 */ export function afterEach(optionalOptions, fnAsync) {
    testContext.afterEach(optionalOptions, fnAsync);
}
class ContextStack {
    _context = [];
    describe(optionalName, optionalOptions, optionalFn, mark) {
        const DescribeOptionsType = {
            timeout: Number
        };
        ensure.signature(arguments, [
            [
                undefined,
                DescribeOptionsType,
                String,
                Function
            ],
            [
                undefined,
                DescribeOptionsType,
                Function
            ],
            [
                undefined,
                Function
            ],
            String
        ]);
        const { name, options, fn } = decipherDescribeParameters(optionalName, optionalOptions, optionalFn);
        const fullName = this.#fullName(name);
        const suite = fn === undefined ? createSkippedSuite(fullName, mark) : runDescribeBlock(this._context, fullName, mark, fn);
        if (this._context.length !== 0) this.#top.addSuite(suite);
        return suite;
        function runDescribeBlock(context, fullName, mark, fn) {
            const builder = new TestSuiteBuilder(fullName, mark, options.timeout);
            context.push(builder);
            try {
                fn();
            } finally{
                context.pop();
            }
            return builder.toTestSuite();
        }
        function createSkippedSuite(name, mark) {
            if (mark === TestMark.only) {
                return TestSuite.create({
                    name,
                    mark,
                    tests: [
                        new FailureTestCase(name, "Test suite is marked '.only', but it has no body")
                    ]
                });
            } else {
                return TestSuite.create({
                    name,
                    mark: TestMark.skip
                });
            }
        }
    }
    it(name, optionalOptions, possibleFnAsync, mark) {
        this.#ensureInsideDescribe("it");
        const { options, fnAsync } = decipherItParameters(name, optionalOptions, possibleFnAsync);
        if (name === "") name = "(unnamed)";
        this.#top.it(this.#fullName(name), mark, options, fnAsync);
    }
    beforeAll(optionalOptions, possibleFnAsync) {
        this.#ensureInsideDescribe("beforeAll");
        const { options, fnAsync } = decipherBeforeAfterParameters(optionalOptions, possibleFnAsync);
        this.#top.beforeAll(this.#fullName(), options, fnAsync);
    }
    afterAll(optionalOptions, possibleFnAsync) {
        this.#ensureInsideDescribe("afterAll");
        const { options, fnAsync } = decipherBeforeAfterParameters(optionalOptions, possibleFnAsync);
        this.#top.afterAll(this.#fullName(), options, fnAsync);
    }
    beforeEach(optionalOptions, possibleFnAsync) {
        this.#ensureInsideDescribe("beforeEach");
        const { options, fnAsync } = decipherBeforeAfterParameters(optionalOptions, possibleFnAsync);
        this.#top.beforeEach(this.#fullName(), options, fnAsync);
    }
    afterEach(optionalOptions, possibleFnAsync) {
        this.#ensureInsideDescribe("afterEach");
        const { options, fnAsync } = decipherBeforeAfterParameters(optionalOptions, possibleFnAsync);
        this.#top.afterEach(this.#fullName(), options, fnAsync);
    }
    #ensureInsideDescribe(functionName) {
        ensure.that(this._context.length > 0, `${functionName}() must be run inside describe()`);
    }
    get #top() {
        return this._context[this._context.length - 1];
    }
    #fullName(name = "") {
        const topName = this._context.length === 0 ? [] : this.#top.name;
        return name === "" ? topName : [
            ...topName,
            name
        ];
    }
}
class TestSuiteBuilder {
    _name;
    _mark;
    _timeout;
    _tests = [];
    _beforeAll = [];
    _afterAll = [];
    _beforeEach = [];
    _afterEach = [];
    constructor(name, mark, timeout){
        this._name = name;
        this._mark = mark;
        this._timeout = timeout;
    }
    get name() {
        return this._name;
    }
    addSuite(suite) {
        this._tests.push(suite);
    }
    it(name, mark, options, fnAsync) {
        this._tests.push(TestCase.create({
            name,
            mark,
            options,
            fnAsync
        }));
    }
    beforeAll(parentName, options, fnAsync) {
        const name = this.#beforeAfterName(parentName, this._beforeAll, "beforeAll()");
        this._beforeAll.push(BeforeAfter.create({
            name,
            options,
            fnAsync
        }));
    }
    afterAll(parentName, options, fnAsync) {
        const name = this.#beforeAfterName(parentName, this._afterAll, "afterAll()");
        this._afterAll.push(BeforeAfter.create({
            name,
            options,
            fnAsync
        }));
    }
    beforeEach(parentName, options, fnAsync) {
        const name = this.#beforeAfterName(parentName, this._beforeEach, "beforeEach()");
        this._beforeEach.push(BeforeAfter.create({
            name,
            options,
            fnAsync
        }));
    }
    afterEach(parentName, options, fnAsync) {
        const name = this.#beforeAfterName(parentName, this._afterEach, "afterEach()");
        this._afterEach.push(BeforeAfter.create({
            name,
            options,
            fnAsync
        }));
    }
    toTestSuite() {
        return TestSuite.create({
            name: this._name,
            mark: this._mark,
            timeout: this._timeout,
            beforeAll: this._beforeAll,
            afterAll: this._afterAll,
            beforeEach: this._beforeEach,
            afterEach: this._afterEach,
            tests: this._tests
        });
    }
    #beforeAfterName(parentName, beforeAfterArray, baseName) {
        const number = beforeAfterArray.length === 0 ? "" : ` #${beforeAfterArray.length + 1}`;
        return [
            ...parentName,
            baseName + number
        ];
    }
}
function decipherDescribeParameters(nameOrOptionsOrDescribeFn, optionsOrDescribeFn, possibleDescribeFn) {
    let name;
    let options;
    let fn;
    switch(typeof nameOrOptionsOrDescribeFn){
        case "string":
            name = nameOrOptionsOrDescribeFn;
            break;
        case "object":
            options = nameOrOptionsOrDescribeFn;
            break;
        case "function":
            fn = nameOrOptionsOrDescribeFn;
            break;
        case "undefined":
            break;
        default:
            ensure.unreachable(`Unknown typeof for nameOrOptionsOrSuiteFn: ${typeof nameOrOptionsOrDescribeFn}`);
    }
    switch(typeof optionsOrDescribeFn){
        case "object":
            ensure.that(options === undefined, "Received two options parameters");
            options = optionsOrDescribeFn;
            break;
        case "function":
            ensure.that(fn === undefined, "Received two suite function parameters");
            fn = optionsOrDescribeFn;
            break;
        case "undefined":
            break;
        default:
            ensure.unreachable(`Unknown typeof for optionsOrSuiteFn: ${typeof optionsOrDescribeFn}`);
    }
    if (possibleDescribeFn !== undefined) {
        ensure.that(fn === undefined, "Received two suite function parameters");
        fn = possibleDescribeFn;
    }
    name ??= "";
    options ??= {};
    return {
        name,
        options,
        fn
    };
}
function decipherBeforeAfterParameters(optionalOptions, possibleFnAsync) {
    ensure.signature(arguments, [
        [
            {
                timeout: Number
            },
            Function
        ],
        [
            undefined,
            Function
        ]
    ]);
    let options;
    let fnAsync;
    if (possibleFnAsync === undefined) {
        options = {};
        fnAsync = optionalOptions;
    } else {
        options = optionalOptions;
        fnAsync = possibleFnAsync;
    }
    return {
        options,
        fnAsync
    };
}
function decipherItParameters(name, optionsOrTestFn, possibleTestFn) {
    ensure.signature(arguments, [
        String,
        [
            undefined,
            {
                timeout: [
                    undefined,
                    Number
                ]
            },
            Function
        ],
        [
            undefined,
            Function
        ]
    ]);
    let options = {};
    let fnAsync;
    switch(typeof optionsOrTestFn){
        case "object":
            options = optionsOrTestFn;
            break;
        case "function":
            fnAsync = optionsOrTestFn;
            break;
        case "undefined":
            break;
        default:
            ensure.unreachable(`Unknown typeof optionsOrTestFn: ${typeof optionsOrTestFn}`);
    }
    if (possibleTestFn !== undefined) {
        ensure.that(fnAsync === undefined, "Received two test function parameters");
        fnAsync = possibleTestFn;
    }
    return {
        options,
        fnAsync
    };
}
const testContext = new ContextStack();

//# sourceMappingURL=/Users/jshore/Documents/Projects/ergotest/generated/src/ergotest/test_api.js.map
