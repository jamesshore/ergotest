// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { TestCaseResult } from "../results/test_result.js";
import { AlwaysPassRunnable, Runnable } from "./runnable.js";
export class BeforeAfter {
    _runnable;
    static create({ name, options = {}, fnAsync }) {
        return new BeforeAfter(Runnable.create(name, options, fnAsync));
    }
    static createPassingImport({ name }) {
        return new BeforeAfter(new AlwaysPassRunnable(name));
    }
    constructor(runnable){
        this._runnable = runnable;
    }
    /** @private */ _setFilename(filename) {
        this._runnable._setFilename(filename);
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

//# sourceMappingURL=before_after.js.map
