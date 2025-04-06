// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { RunResult } from "../results/test_result.js";
export class Runnable {
    _name;
    _options;
    _fnAsync;
    constructor(name, options, fnAsync){
        this._name = name;
        this._options = options;
        this._fnAsync = fnAsync;
    }
    get name() {
        return this._name;
    }
    get options() {
        return this._options;
    }
    get fnAsync() {
        return this._fnAsync;
    }
    async _runTestFnAsync(runOptions, runData) {
        const fnAsync = this._fnAsync;
        if (runData.skipAll || fnAsync === undefined) {
            return RunResult.skip({
                name: this._name,
                filename: runData.filename
            });
        }
        const timeout = this._options.timeout ?? runData.timeout;
        return await runOptions.clock.timeoutAsync(timeout, async ()=>{
            try {
                await fnAsync({
                    getConfig
                });
                return RunResult.pass({
                    name: this._name,
                    filename: runData.filename
                });
            } catch (error) {
                return RunResult.fail({
                    name: this._name,
                    filename: runData.filename,
                    error,
                    renderError: runOptions.renderError
                });
            }
        }, async ()=>{
            return await RunResult.timeout({
                name: this._name,
                filename: runData.filename,
                timeout: runData.timeout
            });
        });
        function getConfig(name) {
            if (runOptions.config[name] === undefined) throw new Error(`No test config found for name '${name}'`);
            return runOptions.config[name];
        }
    }
}

//# sourceMappingURL=runnable.js.map
