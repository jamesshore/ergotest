import { RunOptions, Test } from "./test.js";
import { TestCaseResult, TestMarkValue } from "../results/test_result.js";
import { ItFn, ItOptions } from "../test_api.js";
import { RunData } from "./test_suite.js";
import { Runnable } from "./runnable.js";
export declare class TestCase extends Runnable implements Test {
    #private;
    private _mark;
    static create({ name, mark, options, fnAsync, }: {
        name: string[];
        mark?: TestMarkValue;
        options?: ItOptions;
        fnAsync?: ItFn;
    }): TestCase;
    constructor(name: string[], options: ItOptions, fnAsync: ItFn | undefined, mark: TestMarkValue);
    /** @private */
    _isDotOnly(): boolean;
    /** @private */
    _isSkipped(parentMark: TestMarkValue): boolean;
    /** @private */
    _runAsyncInternal(runOptions: RunOptions, parentData: RunData): Promise<TestCaseResult>;
}
export declare class FailureTestCase extends TestCase {
    private _filename?;
    private _error;
    constructor(name: string[], error: unknown, filename?: string);
    _runAsyncInternal(runOptions: RunOptions, parentData: RunData): Promise<TestCaseResult>;
}
