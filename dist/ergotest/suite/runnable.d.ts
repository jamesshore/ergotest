import { RunOptions } from "./test.js";
import { RunResult } from "../results/test_result.js";
import { ItFn, ItOptions } from "../test_api.js";
import { RunData } from "./test_suite.js";
export declare class Runnable {
    private readonly _name;
    private readonly _options;
    private readonly _fnAsync?;
    constructor(name: string[], options: ItOptions, fnAsync: ItFn | undefined);
    get name(): string[];
    get options(): ItOptions;
    get fnAsync(): ItFn | undefined;
    _runTestFnAsync(runOptions: RunOptions, runData: RunData): Promise<RunResult>;
}
