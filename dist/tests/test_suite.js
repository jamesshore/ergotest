// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import * as ensure from "../util/ensure.js";
import { Clock } from "../infrastructure/clock.js";
import { TestMark, TestResult, TestStatus } from "./test_result.js";
import path from "node:path";
// A simple but full-featured test runner. It allows me to get away from Mocha's idiosyncracies and have
// more control over test execution, while also shielding me from dependency churn.
const DEFAULT_TIMEOUT_IN_MS = 2000;
const testContext = [];
/**
 * A simple but full-featured test runner. It's notable for not using globals.
 */ export class TestSuite {
    _name;
    _mark;
    _tests;
    _hasDotOnlyChildren;
    _allChildrenSkipped;
    _beforeAllFns;
    _afterAllFns;
    _beforeEachFns;
    _afterEachFns;
    _timeout;
    _filename;
    static get DEFAULT_TIMEOUT_IN_MS() {
        return DEFAULT_TIMEOUT_IN_MS;
    }
    /**
	 * Convert a list of test modules into a test suite. Each module needs to export a test suite by using
	 * {@link TestSuite.create}.
	 * @param {string[]} moduleFilenames The filenames of the test modules.
	 * @returns {TestSuite} The test suite.
	 */ static async fromModulesAsync(moduleFilenames) {
        ensure.signature(arguments, [
            Array
        ]);
        const suites = await Promise.all(moduleFilenames.map((filename)=>loadModuleAsync(filename)));
        return new TestSuite("", TestMark.none, {
            tests: suites
        });
        async function loadModuleAsync(filename) {
            const errorName = `error when importing ${path.basename(filename)}`;
            if (!path.isAbsolute(filename)) {
                return createFailure(errorName, `Test module filenames must use absolute paths: ${filename}`);
            }
            try {
                const { default: suite } = await import(filename);
                if (suite instanceof TestSuite) {
                    suite._setFilename(filename);
                    return suite;
                } else {
                    return createFailure(errorName, `Test module doesn't export a test suite: ${filename}`, filename);
                }
            } catch (err) {
                const code = err?.code;
                if (code === "ERR_MODULE_NOT_FOUND") {
                    return createFailure(errorName, `Test module not found: ${filename}`, filename);
                } else {
                    return createFailure(errorName, err, filename);
                }
            }
        }
        function createFailure(name, error, filename) {
            return new TestSuite("", TestMark.none, {
                tests: [
                    new FailureTestCase(name, error, filename)
                ]
            });
        }
    }
    /** @private */ static _create(nameOrOptionsOrSuiteFn, optionsOrSuiteFn, possibleSuiteFn, mark) {
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
        const { name, options, suiteFn } = decipherOverloadedParameters();
        if (suiteFn !== undefined) {
            return this.#runDescribeFunction(suiteFn, name, mark, options.timeout);
        } else if (mark === TestMark.only) {
            return new TestSuite(name, mark, {
                tests: [
                    new FailureTestCase(name, "Test suite is marked '.only', but has no body")
                ]
            });
        } else {
            return new TestSuite(name, TestMark.skip, {
                timeout: options.timeout
            });
        }
        function decipherOverloadedParameters() {
            let name;
            let options;
            let suiteFn;
            switch(typeof nameOrOptionsOrSuiteFn){
                case "string":
                    name = nameOrOptionsOrSuiteFn;
                    break;
                case "object":
                    options = nameOrOptionsOrSuiteFn;
                    break;
                case "function":
                    suiteFn = nameOrOptionsOrSuiteFn;
                    break;
                case "undefined":
                    break;
                default:
                    ensure.unreachable(`Unknown typeof for nameOrOptionsOrSuiteFn: ${typeof nameOrOptionsOrSuiteFn}`);
            }
            switch(typeof optionsOrSuiteFn){
                case "object":
                    ensure.that(options === undefined, "Received two options parameters");
                    options = optionsOrSuiteFn;
                    break;
                case "function":
                    ensure.that(suiteFn === undefined, "Received two suite function parameters");
                    suiteFn = optionsOrSuiteFn;
                    break;
                case "undefined":
                    break;
                default:
                    ensure.unreachable(`Unknown typeof for optionsOrSuiteFn: ${typeof optionsOrSuiteFn}`);
            }
            if (possibleSuiteFn !== undefined) {
                ensure.that(suiteFn === undefined, "Received two suite function parameters");
                suiteFn = possibleSuiteFn;
            }
            name ??= "";
            options ??= {};
            return {
                name,
                options,
                suiteFn
            };
        }
    }
    static #runDescribeFunction(describeFn, name, mark, timeout) {
        const tests = [];
        const beforeAllFns = [];
        const afterAllFns = [];
        const beforeEachFns = [];
        const afterEachFns = [];
        const pushTest = (test)=>{
            tests.push(test);
            return test;
        };
        const result = (optionalName, optionalOptions, fn)=>this._create(optionalName, optionalOptions, fn, TestMark.none);
        result.skip = (optionalName, optionalOptions, fn)=>this._create(optionalName, optionalOptions, fn, TestMark.skip);
        result.only = (optionalName, optionalOptions, fn)=>this._create(optionalName, optionalOptions, fn, TestMark.only);
        const describe = (optionalName, optionalOptions, fn)=>pushTest(TestSuite._create(optionalName, optionalOptions, fn, TestMark.none));
        describe.skip = (optionalName, optionalOptions, fn)=>pushTest(TestSuite._create(optionalName, optionalOptions, fn, TestMark.skip));
        describe.only = (optionalName, optionalOptions, fn)=>pushTest(TestSuite._create(optionalName, optionalOptions, fn, TestMark.only));
        const it = (name, optionalOptions, testCaseFn)=>pushTest(new TestCase(name, optionalOptions, testCaseFn, TestMark.none));
        it.skip = (name, optionalOptions, testCaseFn)=>pushTest(new TestCase(name, optionalOptions, testCaseFn, TestMark.skip));
        it.only = (name, optionalOptions, testCaseFn)=>pushTest(new TestCase(name, optionalOptions, testCaseFn, TestMark.only));
        testContext.push({
            describe,
            it,
            beforeAll: defineBeforeAfterFn(beforeAllFns),
            afterAll: defineBeforeAfterFn(afterAllFns),
            beforeEach: defineBeforeAfterFn(beforeEachFns),
            afterEach: defineBeforeAfterFn(afterEachFns)
        });
        try {
            describeFn();
        } finally{
            testContext.pop();
        }
        return new TestSuite(name, mark, {
            tests,
            beforeAllFns,
            afterAllFns,
            beforeEachFns,
            afterEachFns,
            timeout
        });
        function defineBeforeAfterFn(beforeAfterArray) {
            return function(optionsOrFnAsync, possibleFnAsync) {
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
                    fnAsync = optionsOrFnAsync;
                } else {
                    options = optionsOrFnAsync;
                    fnAsync = possibleFnAsync;
                }
                beforeAfterArray.push({
                    options,
                    fnAsync
                });
            };
        }
    }
    /** Internal use only. (Use {@link TestSuite.create} or {@link TestSuite.fromModulesAsync} instead.) */ constructor(name, mark, { tests = [], beforeAllFns = [], afterAllFns = [], beforeEachFns = [], afterEachFns = [], timeout }){
        this._name = name;
        this._mark = mark;
        this._tests = tests;
        this._hasDotOnlyChildren = this._tests.some((test)=>test._isDotOnly());
        this._allChildrenSkipped = this._tests.every((test)=>test._isSkipped(this._mark));
        this._beforeAllFns = beforeAllFns;
        this._afterAllFns = afterAllFns;
        this._beforeEachFns = beforeEachFns;
        this._afterEachFns = afterEachFns;
        this._timeout = timeout;
    }
    /**
	 * Run the tests in this suite.
	 * @param {number} [timeout] Default timeout in milliseconds.
	 * @param {object} [config={}] Configuration data to provide to tests.
	 * @param {(result: TestResult) => ()} [notifyFn] A function to call each time a test completes. The `result`
	 *   parameter describes the result of the test—whether it passed, failed, etc.
	 * @param {Clock} [clock] The clock to use. Meant for internal use.
	 * @returns {Promise<TestSuiteResult>} The results of the test suite.
	 */ async runAsync({ timeout = DEFAULT_TIMEOUT_IN_MS, config = {}, notifyFn = ()=>{}, clock = Clock.create() } = {}) {
        ensure.signature(arguments, [
            [
                undefined,
                {
                    timeout: [
                        undefined,
                        Number
                    ],
                    config: [
                        undefined,
                        Object
                    ],
                    notifyFn: [
                        undefined,
                        Function
                    ],
                    clock: [
                        undefined,
                        Clock
                    ]
                }
            ]
        ]);
        return await this._recursiveRunAsync(TestMark.only, [], [], {
            clock,
            config,
            notifyFn,
            name: [],
            filename: this._filename,
            timeout: this._timeout ?? timeout ?? DEFAULT_TIMEOUT_IN_MS
        });
    }
    /** @private */ _setFilename(filename) {
        this._filename = filename;
    }
    /** @private */ _isDotOnly() {
        return this._mark === TestMark.only || this._hasDotOnlyChildren;
    }
    /** @private */ _isSkipped() {
        return this._allChildrenSkipped;
    }
    /** @private */ async _recursiveRunAsync(parentMark, parentBeforeEachFns, parentAfterEachFns, options) {
        const name = [
            ...options.name
        ];
        if (this._name !== "") name.push(this._name);
        const filename = this._filename ?? options.filename;
        const timeout = this._timeout ?? options.timeout;
        options = {
            ...options,
            name,
            filename,
            timeout
        };
        let myMark = this._mark;
        if (myMark === TestMark.none) myMark = parentMark;
        if (myMark === TestMark.only && this._hasDotOnlyChildren) myMark = TestMark.skip;
        const beforeEachFns = [
            ...parentBeforeEachFns,
            ...this._beforeEachFns
        ];
        const afterEachFns = [
            ...this._afterEachFns,
            ...parentAfterEachFns
        ];
        if (!this._allChildrenSkipped) {
            const beforeResult = await runBeforeOrAfterFnsAsync([
                ...options.name,
                "beforeAll()"
            ], this._beforeAllFns, TestMark.none, options);
            if (!isSuccess(beforeResult)) return TestResult.suite(options.name, [
                beforeResult
            ], options.filename, this._mark);
        }
        const results = [];
        for await (const test of this._tests){
            results.push(await test._recursiveRunAsync(myMark, beforeEachFns, afterEachFns, options));
        }
        if (!this._allChildrenSkipped) {
            const afterResult = await runBeforeOrAfterFnsAsync([
                ...options.name,
                "afterAll()"
            ], this._afterAllFns, TestMark.none, options);
            if (!isSuccess(afterResult)) results.push(afterResult);
        }
        return TestResult.suite(options.name, results, options.filename, this._mark);
    }
}
class TestCase {
    _name;
    _timeout;
    _testFn;
    _mark;
    constructor(name, optionsOrTestFn, possibleTestFn, mark){
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
            ],
            String
        ]);
        this._name = name;
        switch(typeof optionsOrTestFn){
            case "object":
                this._timeout = optionsOrTestFn.timeout;
                break;
            case "function":
                this._testFn = optionsOrTestFn;
                break;
            case "undefined":
                break;
            default:
                ensure.unreachable(`Unknown typeof optionsOrTestFn: ${typeof optionsOrTestFn}`);
        }
        if (possibleTestFn !== undefined) {
            ensure.that(this._testFn === undefined, "Received two test function parameters");
            this._testFn = possibleTestFn;
        }
        this._mark = mark;
    }
    /** @private */ _isDotOnly() {
        ensure.signature(arguments, []);
        return this._mark === TestMark.only;
    }
    /** @private */ _isSkipped(parentMark) {
        const inheritedMark = this._mark === TestMark.none ? parentMark : this._mark;
        return inheritedMark === TestMark.skip;
    }
    /** @private */ async _recursiveRunAsync(parentMark, beforeEachFns, afterEachFns, options) {
        const name = [
            ...options.name
        ];
        name.push(this._name !== "" ? this._name : "(unnamed)");
        options = {
            ...options,
            name
        };
        let result;
        if (this._testFn !== undefined) {
            if (!this._isSkipped(parentMark)) {
                result = await runTestAsync(this);
            } else {
                result = TestResult.skip(name, options.filename, this._mark);
            }
        } else {
            if (this._mark !== TestMark.only) {
                result = TestResult.skip(name, options.filename, TestMark.skip);
            } else {
                result = TestResult.fail(name, "Test is marked '.only', but it has no body", options.filename, this._mark);
            }
        }
        options.notifyFn(result);
        return result;
        async function runTestAsync(self) {
            const beforeResult = await runBeforeOrAfterFnsAsync(options.name, beforeEachFns, self._mark, options);
            if (!isSuccess(beforeResult)) return beforeResult;
            const itResult = await runTestFnAsync(options.name, self._testFn, self._mark, self._timeout, options);
            const afterResult = await runBeforeOrAfterFnsAsync(options.name, afterEachFns, self._mark, options);
            if (!isSuccess(itResult)) return itResult;
            else return afterResult;
        }
    }
}
class FailureTestCase extends TestCase {
    _filename;
    _error;
    constructor(name, error, filename){
        super(name, undefined, undefined, TestMark.none);
        this._filename = filename;
        this._error = error;
    }
    async _recursiveRunAsync(parentMark, beforeEachFns, afterEachFns, options) {
        const result = TestResult.fail([
            this._name
        ], this._error, this._filename);
        options.notifyFn(result);
        return await result;
    }
}
async function runBeforeOrAfterFnsAsync(name, beforeAfterArray, mark, options) {
    for await (const beforeAfter of beforeAfterArray){
        const result = await runTestFnAsync(name, beforeAfter.fnAsync, mark, beforeAfter.options.timeout, options);
        if (!isSuccess(result)) return result;
    }
    return TestResult.pass(name, options.filename, mark);
}
async function runTestFnAsync(name, fn, mark, testTimeout, { clock, filename, timeout, config }) {
    const getConfig = (name)=>{
        if (config[name] === undefined) throw new Error(`No test config found for name '${name}'`);
        return config[name];
    };
    timeout = testTimeout ?? timeout;
    return await clock.timeoutAsync(timeout, async ()=>{
        try {
            await fn({
                getConfig
            });
            return TestResult.pass(name, filename, mark);
        } catch (err) {
            return TestResult.fail(name, err, filename, mark);
        }
    }, async ()=>{
        return await TestResult.timeout(name, timeout, filename, mark);
    });
}
function isSuccess(result) {
    return result.status === TestStatus.pass || result.status === TestStatus.skip;
}
function startTest(optionalName, optionalOptions, fn, mark) {
    ensure.that(testContext.length === 0, "test() is not re-entrant [don't run test() inside of test()]");
    try {
        return TestSuite._create(optionalName, optionalOptions, fn, mark);
    } finally{
        ensure.that(testContext.length === 0, "test() didn't clear its context; must be an error in ergotest");
    }
}
/**
 * Creates a top-level test suite. In your test module, call this function and `export default` the result. Add `.skip`
 * to skip this test suite and `.only` to only run this test suite.
 * @param {string} [optionalName] The name of the test suite. You can skip this parameter and pass
 *   {@link optionalOptions} or {@link fn} instead.
 * @param {DescribeOptions} [optionalOptions] The test suite options. You can skip this parameter and pass {@link fn}
 *   instead.
 * @param {function} [fn] The body of the test suite. In the body, call {@link describe}, {@link it}, {@link
 *   beforeAll}, {@link afterAll}, {@link beforeEach}, and {@link afterEach} to define the tests in the suite. If
 *   undefined, this test suite will be skipped.
 * @returns {TestSuite} The test suite. You’ll typically `export default` the return value rather than using it
 *   directly.
 */ export function test(optionalName, optionalOptions, fn) {
    return startTest(optionalName, optionalOptions, fn, TestMark.none);
}
test.skip = function(optionalName, optionalOptions, fn) {
    return startTest(optionalName, optionalOptions, fn, TestMark.skip);
};
test.only = function(optionalName, optionalOptions, fn) {
    return startTest(optionalName, optionalOptions, fn, TestMark.only);
};
/**
 * Adds a nested test suite to the current test suite. Must be run inside of a {@link test} or {@link describe}
 * function. Add `.skip` to skip this test suite and `.only` to only run this test suite.
 * @param {string} [optionalName] The name of the test suite. You can skip this parameter and pass
 *   {@link optionalOptions} or {@link fn} instead.
 * @param {DescribeOptions} [optionalOptions] The test suite options. You can skip this parameter and pass {@link fn}
 *   instead.
 * @param {function} [fn] The body of the test suite. In the body, call {@link describe}, {@link it}, {@link
 *   beforeAll}, {@link afterAll}, {@link beforeEach}, and {@link afterEach} to define the tests in the suite. If
 *   undefined, this test suite will be skipped.
 * @returns {TestSuite} The test suite. You’ll typically ignore the return value.
 */ export function describe(optionalName, optionalOptions, fn) {
    currentContext("describe").describe(optionalName, optionalOptions, fn);
}
describe.skip = function(optionalName, optionalOptions, fn) {
    currentContext("describe").describe.skip(optionalName, optionalOptions, fn);
};
describe.only = function(optionalName, optionalOptions, fn) {
    currentContext("describe").describe.only(optionalName, optionalOptions, fn);
};
/**
 * Adds a test to the current test suite. Must be run inside of a {@link test} or {@link describe} function. Add
 * `.skip` to skip this test and `.only` to only run this test.
 * @param {string} name The name of the test.
 * @param {ItOptions} [optionalOptions] The test options. You can skip this parameter and pass {@link fnAsync} instead.
 * @param {function} [fnAsync] The body of the test. May be synchronous or asynchronous. If undefined, this test will be
 *   skipped.
 */ export function it(name, optionalOptions, fnAsync) {
    currentContext("it").it(name, optionalOptions, fnAsync);
}
it.skip = function it(name, optionalOptions, fnAsync) {
    currentContext("it").it.skip(name, optionalOptions, fnAsync);
};
it.only = function it(name, optionalOptions, fnAsync) {
    currentContext("it").it.only(name, optionalOptions, fnAsync);
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
function currentContext(functionName) {
    ensure.that(testContext.length > 0, `${functionName}() must be run inside test()`);
    return testContext[testContext.length - 1];
}

//# sourceMappingURL=/Users/jshore/Documents/Projects/ergotest/generated/src/tests/test_suite.js.map
