// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { TestCaseResult } from "../results/test_result.js";
import { Runnable } from "./runnable.js";
export class BeforeAfter {
    _runnable;
    static create({ name, options = {}, fnAsync }) {
        return new BeforeAfter(Runnable.create(name, options, fnAsync));
    }
    constructor(runnable){
        this._runnable = runnable;
    }
    async runBeforeAfterAllAsync(runOptions, runData) {
        const result = TestCaseResult.create({
            it: await this._runnable.runAsync(runOptions, runData)
        });
        runOptions.onTestCaseResult(result);
        return result;
    }
    async runBeforeAfterEachAsync(runOptions, runData) {
        return await this._runnable.runAsync(runOptions, runData);
    }
}

//# sourceMappingURL=/Users/jshore/Documents/Projects/ergotest/generated/src/ergotest/tests/before_after.js.map
