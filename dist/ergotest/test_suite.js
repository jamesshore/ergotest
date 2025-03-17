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
    _beforeAll;
    _afterAll;
    _beforeEach;
    _afterEach;
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
                    new FailureTestCase(name, "Test suite is marked '.only', but it has no body")
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
        const beforeAll = [];
        const afterAll = [];
        const beforeEach = [];
        const afterEach = [];
        testContext.push({
            describe (optionalName, optionalOptions, fn, mark) {
                const suite = TestSuite.create(optionalName, optionalOptions, fn, mark, testContext);
                tests.push(suite);
                return suite;
            },
            it (name, optionalOptions, testCaseFn, mark) {
                tests.push(TestCase.create(name, optionalOptions, testCaseFn, mark));
            },
            beforeAll: defineBeforeAfterFn(beforeAll),
            afterAll: defineBeforeAfterFn(afterAll),
            beforeEach: defineBeforeAfterFn(beforeEach),
            afterEach: defineBeforeAfterFn(afterEach)
        });
        try {
            describeFn();
        } finally{
            testContext.pop();
        }
        return new TestSuite(name, mark, {
            tests,
            beforeAll,
            afterAll,
            beforeEach,
            afterEach,
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
    /** Internal use only. (Use {@link describe} or {@link TestSuite.fromModulesAsync} instead.) */ constructor(name, mark, { tests = [], beforeAll = [], afterAll = [], beforeEach = [], afterEach = [], timeout }){
        this._name = name;
        this._mark = mark;
        this._tests = tests;
        this._hasDotOnlyChildren = this._tests.some((test)=>test._isDotOnly());
        this._allChildrenSkipped = this._tests.every((test)=>test._isSkipped(this._mark));
        this._beforeAll = beforeAll;
        this._afterAll = afterAll;
        this._beforeEach = beforeEach;
        this._afterEach = afterEach;
        this._timeout = timeout;
    }
    /**
	 * Run the tests in this suite.
	 * @param {number} [timeout] Default timeout in milliseconds.
	 * @param {object} [config={}] Configuration data to provide to tests.
	 * @param {(result: TestResult) => ()} [onTestCaseResult] A function to call each time a test completes. The `result`
	 *   parameter describes the result of the test—whether it passed, failed, etc.
	 * @param {string} [renderer] Path to a module that exports a `renderError()` function with the signature `(name:
	 *   string, error: unknown, mark: TestMarkValue, filename?: string) => unknown`. The path must be an absolute path
	 *   or a module that exists in `node_modules`. The `renderError()` function will be called when a test fails and the
	 *   return value will be placed into the test result as {@link TestResult.errorRender}.
	 * @param {Clock} [clock] Internal use only.
	 * @returns {Promise<TestSuiteResult>} The results of the test suite.
	 */ async runAsync({ timeout = DEFAULT_TIMEOUT_IN_MS, config = {}, onTestCaseResult = ()=>{}, renderer, clock = Clock.create() } = {}) {
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
                    renderer: [
                        undefined,
                        String
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
            timeout: this._timeout ?? timeout ?? DEFAULT_TIMEOUT_IN_MS,
            renderError: await importRendererAsync(renderer)
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
    /** @private */ async _recursiveRunAsync(parentMark, parentBeforeEachFns, parentAfterEachFns, runOptions) {
        runOptions = {
            ...runOptions,
            name: [
                ...runOptions.name
            ],
            filename: this._filename ?? runOptions.filename,
            timeout: this._timeout ?? runOptions.timeout
        };
        if (this._name !== "") runOptions.name.push(this._name);
        const resultOptions = {
            filename: runOptions.filename,
            mark: this._mark
        };
        const beforeAllResults = [];
        let beforeAllFailed = false;
        for await (const before of this._beforeAll){
            const name = [
                ...runOptions.name,
                `beforeAll() #${beforeAllResults.length + 1}`
            ];
            const result = this._allChildrenSkipped || beforeAllFailed ? TestResult.skip(name, resultOptions) : await runTestFnAsync(name, before.fnAsync, TestMark.none, before.options.timeout, runOptions);
            if (!isSuccess(result)) beforeAllFailed = true;
            runOptions.onTestCaseResult(result);
            beforeAllResults.push(result);
        }
        let inheritedMark = this._mark;
        if (inheritedMark === TestMark.none) inheritedMark = parentMark;
        if (inheritedMark === TestMark.only && this._hasDotOnlyChildren) inheritedMark = TestMark.skip;
        if (beforeAllFailed) inheritedMark = TestMark.skip;
        const beforeEachFns = [
            ...parentBeforeEachFns,
            ...this._beforeEach
        ];
        const afterEachFns = [
            ...this._afterEach,
            ...parentAfterEachFns
        ];
        const testResults = [];
        for await (const test of this._tests){
            testResults.push(await test._recursiveRunAsync(inheritedMark, beforeEachFns, afterEachFns, runOptions));
        }
        const afterAllResults = [];
        for await (const after of this._afterAll){
            const name = [
                ...runOptions.name,
                `afterAll() #${afterAllResults.length + 1}`
            ];
            const result = this._allChildrenSkipped || beforeAllFailed ? TestResult.skip(name, resultOptions) : await runTestFnAsync(name, after.fnAsync, TestMark.none, after.options.timeout, runOptions);
            runOptions.onTestCaseResult(result);
            afterAllResults.push(result);
        }
        return TestResult.suite(runOptions.name, testResults, {
            beforeAll: beforeAllResults,
            afterAll: afterAllResults,
            ...resultOptions
        });
    }
}
class TestCase {
    _name;
    _timeout;
    _testFn;
    _mark;
    static create(name, optionsOrTestFn, possibleTestFn, mark) {
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
        let timeout;
        let testFn;
        switch(typeof optionsOrTestFn){
            case "object":
                timeout = optionsOrTestFn.timeout;
                break;
            case "function":
                testFn = optionsOrTestFn;
                break;
            case "undefined":
                break;
            default:
                ensure.unreachable(`Unknown typeof optionsOrTestFn: ${typeof optionsOrTestFn}`);
        }
        if (possibleTestFn !== undefined) {
            ensure.that(testFn === undefined, "Received two test function parameters");
            testFn = possibleTestFn;
        }
        return new TestCase(name, timeout, testFn, mark);
    }
    constructor(name, timeout, testFn, mark){
        this._name = name;
        this._timeout = timeout;
        this._testFn = testFn;
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
                result = TestResult.skip(name, {
                    filename: options.filename,
                    mark: this._mark
                });
            }
        } else {
            if (this._mark !== TestMark.only) {
                result = TestResult.skip(name, {
                    filename: options.filename,
                    mark: TestMark.skip
                });
            } else {
                result = TestResult.fail(name, "Test is marked '.only', but it has no body", {
                    renderError: options.renderError,
                    filename: options.filename,
                    mark: this._mark
                });
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
        ], this._error, {
            renderError: options.renderError,
            filename: this._filename,
            mark: TestMark.none
        });
        options.onTestCaseResult(result);
        return await result;
    }
}
async function runBeforeOrAfterFnsAsync_New(parentName, functionName, beforeAfterArray, mark, options) {
    const results = [];
    let i = 0;
    for await (const beforeAfter of beforeAfterArray){
        i++;
        const name = [
            ...parentName,
            `${functionName} #${i}`
        ];
        const result = await runTestFnAsync(name, beforeAfter.fnAsync, mark, beforeAfter.options.timeout, options);
        results.push(result);
        if (!isSuccess(result)) return {
            results,
            pass: false
        };
    }
    return {
        results,
        pass: true
    };
}
async function runBeforeOrAfterFnsAsync(parentName, beforeAfterArray, mark, options) {
    for await (const beforeAfter of beforeAfterArray){
        const result = await runTestFnAsync(parentName, beforeAfter.fnAsync, mark, beforeAfter.options.timeout, options);
        if (!isSuccess(result)) return result;
    }
    return TestResult.pass(parentName, {
        filename: options.filename,
        mark
    });
}
async function runTestFnAsync(name, fn, mark, testTimeout, { clock, filename, timeout, config, renderError }) {
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
            return TestResult.pass(name, {
                filename,
                mark
            });
        } catch (err) {
            return TestResult.fail(name, err, {
                filename,
                mark,
                renderError
            });
        }
    }, async ()=>{
        return await TestResult.timeout(name, timeout, {
            filename,
            mark
        });
    });
}
function isSuccess(result) {
    return result.status === TestStatus.pass || result.status === TestStatus.skip;
}
/** Internal use only. */ export async function importRendererAsync(renderer) {
    if (renderer === undefined) return undefined;
    try {
        const { renderError } = await import(renderer);
        if (renderError === undefined) {
            throw new Error(`Renderer module doesn't export a renderError() function: ${renderer}`);
        }
        if (typeof renderError !== "function") {
            throw new Error(`Renderer module's 'renderError' export must be a function, but it was a ${typeof renderError}: ${renderer}`);
        }
        return renderError;
    } catch (err) {
        if (typeof err !== "object" || err?.code !== "ERR_MODULE_NOT_FOUND") throw err;
        throw new Error(`Renderer module not found (did you forget to use an absolute path?): ${renderer}`);
    }
}

//# sourceMappingURL=/Users/jshore/Documents/Projects/ergotest/generated/src/ergotest/test_suite.js.map
