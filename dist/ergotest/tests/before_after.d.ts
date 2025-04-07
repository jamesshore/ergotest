import { RunData, RunOptions } from "./test_suite.js";
import { TestCaseResult } from "../results/test_result.js";
import { Runnable } from "./runnable.js";
import { ItFn, ItOptions } from "./test_api.js";
export declare class BeforeAfter {
    private readonly _runnable;
    static create({ name, options, fnAsync }: {
        name: string[];
        options?: ItOptions;
        fnAsync: ItFn;
    }): BeforeAfter;
    constructor(runnable: Runnable);
    runBeforeAfterAllAsync(runOptions: RunOptions, runData: RunData): Promise<TestCaseResult>;
    runBeforeAfterEachAsync(runOptions: RunOptions, runData: RunData): Promise<import("../results/test_result.js").RunResult>;
}
