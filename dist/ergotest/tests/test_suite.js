// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import * as ensure from "../../util/ensure.js";
import { Clock } from "../../infrastructure/clock.js";
import { TestMark, TestStatus, TestSuiteResult } from "../results/test_result.js";
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
    static create({ name = [], mark = TestMark.none, timeout = undefined, beforeAll = [], afterAll = [], beforeEach = [], afterEach = [], tests = [] }) {
        return new TestSuite(name, mark, timeout, beforeAll, afterAll, beforeEach, afterEach, tests);
    }
    /** Internal use only. (Use {@link describe} or {@link TestSuite.fromModulesAsync} instead.) */ constructor(name, mark, timeout, beforeAll, afterAll, beforeEach, afterEach, tests){
        this._name = name;
        this._mark = mark;
        this._timeout = timeout;
        this._beforeAll = beforeAll;
        this._afterAll = afterAll;
        this._beforeEach = beforeEach;
        this._afterEach = afterEach;
        this._tests = tests;
        this._hasDotOnlyChildren = this._tests.some((test)=>test._isDotOnly());
        this._allChildrenSkipped = this._tests.every((test)=>test._isSkipped(this._mark));
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
        return await this._runAsyncInternal({
            clock,
            config,
            onTestCaseResult,
            renderError: await importRendererAsync(renderer)
        }, {
            mark: TestMark.only,
            timeout: this._timeout ?? timeout,
            skipAll: false,
            beforeEach: [],
            afterEach: []
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
    /** @private */ async _runAsyncInternal(runOptions, parentData) {
        const runData = this.#consolidateRunData(parentData);
        const beforeAllResults = await this.#runBeforeAfterAllAsync(this._beforeAll, true, runOptions, runData);
        const testResults = await this.#runTestsAsync(runOptions, runData);
        const afterAllResults = await this.#runBeforeAfterAllAsync(this._afterAll, false, runOptions, runData);
        return TestSuiteResult.create({
            name: this._name,
            filename: runData.filename,
            mark: this._mark,
            tests: testResults,
            beforeAll: beforeAllResults,
            afterAll: afterAllResults
        });
    }
    async #runTestsAsync(runOptions, runData) {
        const testResults = [];
        for await (const test of this._tests){
            testResults.push(await test._runAsyncInternal(runOptions, runData));
        }
        return testResults;
    }
    async #runBeforeAfterAllAsync(beforeAfter, isBeforeAll, runOptions, runData) {
        const results = [];
        for await (const test of beforeAfter){
            const result = await test.runBeforeAfterAllAsync(runOptions, runData);
            if (isBeforeAll && !isSuccess(result)) runData.skipAll = true;
            results.push(result);
        }
        return results;
    }
    #consolidateRunData(parentData) {
        const beforeEach = [
            ...parentData.beforeEach,
            ...this._beforeEach
        ];
        const afterEach = [
            ...this._afterEach,
            ...parentData.afterEach
        ];
        let inheritedMark = this._mark;
        if (inheritedMark === TestMark.none) inheritedMark = parentData.mark;
        if (inheritedMark === TestMark.only && this._hasDotOnlyChildren) inheritedMark = TestMark.skip;
        return {
            filename: this._filename ?? parentData.filename,
            mark: inheritedMark,
            timeout: this._timeout ?? parentData.timeout,
            skipAll: parentData.skipAll || this._isSkipped(),
            beforeEach,
            afterEach
        };
    }
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

//# sourceMappingURL=test_suite.js.map
