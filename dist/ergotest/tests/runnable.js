// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { RunResult } from "../results/test_result.js";
export class Runnable {
    _name;
    _options;
    _fnAsync;
    _filename;
    static create(name, options, fnAsync) {
        return new Runnable(name, options, fnAsync);
    }
    constructor(name, options, fnAsync){
        this._name = name;
        this._options = options;
        this._fnAsync = fnAsync;
    }
    /** @private */ _setFilename(filename) {
        if (this._filename === undefined) this._filename = filename;
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
    async runAsync(runOptions, runData) {
        const fnAsync = this._fnAsync;
        if (runData.skipAll || fnAsync === undefined) {
            return RunResult.skip({
                name: this._name,
                filename: this._filename
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
                    filename: this._filename
                });
            } catch (error) {
                return RunResult.fail({
                    name: this._name,
                    filename: this._filename,
                    error,
                    renderError: runOptions.renderError
                });
            }
        }, async ()=>{
            return await RunResult.timeout({
                name: this._name,
                filename: this._filename,
                timeout: runData.timeout
            });
        });
        function getConfig(name) {
            if (runOptions.config[name] === undefined) throw new Error(`No test config found for name '${name}'`);
            return runOptions.config[name];
        }
    }
}
// Use this class to make sure a runnable always passes even if it would normally be skipped
export class AlwaysPassRunnable extends Runnable {
    _subclassFilename;
    constructor(name){
        super(name, {});
    }
    _setFilename(filename) {
        if (this._subclassFilename === undefined) this._subclassFilename = filename;
    }
    async runAsync(runOptions, runData) {
        return await RunResult.pass({
            name: this.name,
            filename: this._subclassFilename
        });
    }
}

//# sourceMappingURL=runnable.js.map
