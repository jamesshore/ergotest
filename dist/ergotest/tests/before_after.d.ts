import { RunData, RunOptions } from "./test_suite.js";
import { RunResult, TestCaseResult } from "../results/test_result.js";
import { Runnable } from "./runnable.js";
import { ItFn, ItOptions } from "./test_api.js";
export declare class BeforeAfter extends Runnable {
    static create({ name, options, fnAsync }: {
        name: string[];
        options?: ItOptions;
        fnAsync: ItFn;
    }): BeforeAfter;
    runBeforeAfterAllAsync(runOptions: RunOptions, runData: RunData): Promise<TestCaseResult>;
    runBeforeAfterEachAsync(runOptions: RunOptions, runData: RunData): Promise<RunResult>;
    _runAsyncInternal(runOptions: RunOptions, runData: RunData): Promise<RunResult>;
}
