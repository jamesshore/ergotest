import { ItFn, ItOptions } from "../test_api.js";
import { RunOptions } from "./test.js";
import { RunData } from "./test_suite.js";
import { RunResult, TestCaseResult } from "../results/test_result.js";
import { Runnable } from "./runnable.js";
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
