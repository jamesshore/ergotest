// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { RunResult, TestCaseResult } from "../results/test_result.js";
import { Runnable } from "./runnable.js";
export class BeforeAfter extends Runnable {
    static create({ name, options = {}, fnAsync }) {
        return new BeforeAfter(name, options, fnAsync);
    }
    async runBeforeAfterAllAsync(runOptions, runData) {
        const result = TestCaseResult.create({
            it: await this._runAsyncInternal(runOptions, runData)
        });
        runOptions.onTestCaseResult(result);
        return result;
    }
    async runBeforeAfterEachAsync(runOptions, runData) {
        return await this._runAsyncInternal(runOptions, runData);
    }
    async _runAsyncInternal(runOptions, runData) {
        if (runData.skipAll) return RunResult.skip({
            name: this.name,
            filename: runData.filename
        });
        return await this._runTestFnAsync(runOptions, runData);
    }
}

//# sourceMappingURL=/Users/jshore/Documents/Projects/ergotest/generated/src/ergotest/suite/before_after.js.map
