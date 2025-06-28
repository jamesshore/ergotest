// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { RunResult, TestCaseResult, TestMark, TestStatus } from "../results/test_result.js";
import { Runnable } from "./runnable.js";
export class TestCase {
    _name;
    _mark;
    _fnAsync;
    _runnable;
    static create({ name, mark = TestMark.none, options = {}, fnAsync = undefined }) {
        return new TestCase(name, options, fnAsync, mark);
    }
    constructor(name, options, fnAsync, mark){
        this._name = name;
        this._fnAsync = fnAsync;
        this._runnable = Runnable.create(name, options, fnAsync);
        this._mark = mark;
        if (fnAsync === undefined && mark === TestMark.none) this._mark = TestMark.skip;
    }
    /** @private */ _isDotOnly() {
        return this._mark === TestMark.only;
    }
    /** @private */ _isSkipped(parentMark) {
        const inheritedMark = this._mark === TestMark.none ? parentMark : this._mark;
        return inheritedMark === TestMark.skip || this._fnAsync === undefined;
    }
    /** @private */ async _runAsyncInternal(runOptions, parentData) {
        const runData = this.#consolidateRunData(parentData);
        const beforeEach = await this.#runBeforeAfterEachAsync(runData.beforeEach, true, runOptions, runData);
        const it = await this.#runTestAsync(runData, runOptions);
        const afterEach = await this.#runBeforeAfterEachAsync(runData.afterEach, false, runOptions, runData);
        const result = TestCaseResult.create({
            mark: this._mark,
            beforeEach,
            afterEach,
            it
        });
        runOptions.onTestCaseResult(result);
        return result;
    }
    async #runTestAsync(runData, runOptions) {
        if (this._fnAsync === undefined && this._mark === TestMark.only) {
            return RunResult.fail({
                name: this._name,
                filename: runData.filename,
                error: "Test is marked '.only', but it has no body",
                renderError: runOptions.renderError
            });
        }
        return await this._runnable.runAsync(runOptions, runData);
    }
    async #runBeforeAfterEachAsync(beforeAfter, isBeforeEach, runOptions, runData) {
        const results = [];
        for await (const test of beforeAfter){
            const result = await test.runBeforeAfterEachAsync(runOptions, runData);
            if (isBeforeEach && !isSuccess(result)) runData.skipAll = true;
            results.push(result);
        }
        return results;
    }
    #consolidateRunData(parentData) {
        return {
            filename: parentData.filename,
            mark: this._mark === TestMark.none ? parentData.mark : this._mark,
            timeout: parentData.timeout,
            skipAll: parentData.skipAll || this._isSkipped(parentData.mark),
            beforeEach: parentData.beforeEach,
            afterEach: parentData.afterEach
        };
    }
}
function isSuccess(result) {
    return result.status === TestStatus.pass || result.status === TestStatus.skip;
}
export class FailureTestCase extends TestCase {
    _filename;
    _error;
    constructor(name, error, filename){
        super(name, {}, undefined, TestMark.none);
        this._filename = filename;
        this._error = error;
    }
    async _runAsyncInternal(runOptions, parentData) {
        const it = RunResult.fail({
            name: this._name,
            filename: this._filename,
            error: this._error,
            renderError: runOptions.renderError
        });
        const result = TestCaseResult.create({
            mark: TestMark.none,
            it
        });
        runOptions.onTestCaseResult(result);
        return await result;
    }
}

//# sourceMappingURL=/Users/jshore/Documents/Projects/ergotest/generated/src/ergotest/tests/test_case.js.map
