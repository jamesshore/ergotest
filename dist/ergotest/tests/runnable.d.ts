import { RunResult } from "../results/test_result.js";
import { RunData, RunOptions } from "./test_suite.js";
import { ItFn, ItOptions } from "./test_api.js";
export declare class Runnable {
    private readonly _name;
    private readonly _options;
    private readonly _fnAsync?;
    private _filename?;
    static create(name: string[], options: ItOptions, fnAsync?: ItFn): Runnable;
    constructor(name: string[], options: ItOptions, fnAsync: ItFn | undefined);
    /** @private */
    _setFilename(filename: string): void;
    get name(): string[];
    get options(): ItOptions;
    get fnAsync(): ItFn | undefined;
    runAsync(runOptions: RunOptions, runData: RunData): Promise<RunResult>;
}
