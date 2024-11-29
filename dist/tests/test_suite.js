// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import * as ensure from "../util/ensure.js";
import { Clock } from "../infrastructure/clock.js";
import { TestMark, TestResult, TestStatus } from "./test_result.js";
import path from "node:path";
const DEFAULT_TIMEOUT_IN_MS = 2000;
/**
 * A simple but full-featured test runner.
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
    /** Internal use only. */ static create(nameOrOptionsOrDescribeFn, optionsOrDescribeFn, possibleDescribeFn, mark, testContext) {
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
            String,
            Array
        ]);
        const { name, options, fn } = decipherOverloadedParameters();
        if (fn !== undefined) {
            return this.#runDescribeFunction(fn, name, mark, testContext, options.timeout);
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
    }
    static #runDescribeFunction(describeFn, name, mark, testContext, timeout) {
        const tests = [];
        const beforeAllFns = [];
        const afterAllFns = [];
        const beforeEachFns = [];
        const afterEachFns = [];
        testContext.push({
            describe (optionalName, optionalOptions, fn, mark) {
                return pushTest(TestSuite.create(optionalName, optionalOptions, fn, mark, testContext));
            },
            it (name, optionalOptions, testCaseFn, mark) {
                pushTest(new TestCase(name, optionalOptions, testCaseFn, mark));
            },
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
        function pushTest(test) {
            tests.push(test);
            return test;
        }
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
	 * @param {(result: TestResult) => ()} [onTestCaseResult] A function to call each time a test completes. The `result`
	 *   parameter describes the result of the test—whether it passed, failed, etc.
	 * @param {Clock} [clock] The clock to use. Meant for internal use.
	 * @returns {Promise<TestSuiteResult>} The results of the test suite.
	 */ async runAsync({ timeout = DEFAULT_TIMEOUT_IN_MS, config = {}, onTestCaseResult = ()=>{}, clock = Clock.create() } = {}) {
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
                    onTestCaseResult: [
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
            onTestCaseResult,
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
        options.onTestCaseResult(result);
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
        options.onTestCaseResult(result);
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

//# sourceMappingURL=/Users/jshore/Documents/Projects/ergotest/generated/src/tests/test_suite.js.map
