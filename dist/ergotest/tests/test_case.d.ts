import { TestCaseResult, TestMarkValue } from "../results/test_result.js";
import { RunData, RunOptions } from "./test_suite.js";
import { Test } from "./test.js";
import { ItFn, ItOptions } from "./test_api.js";
export declare class TestCase implements Test {
    #private;
    protected readonly _name: string[];
    private readonly _mark;
    private readonly _fnAsync?;
    private readonly _runnable;
    private _filename?;
    static create({ name, mark, options, fnAsync, }: {
        name: string[];
        mark?: TestMarkValue;
        options?: ItOptions;
        fnAsync?: ItFn;
    }): TestCase;
    constructor(name: string[], options: ItOptions, fnAsync: ItFn | undefined, mark: TestMarkValue);
    /** @private */
    _setFilename(filename: string): void;
    /** @private */
    _isDotOnly(): boolean;
    /** @private */
    _isSkipped(parentMark: TestMarkValue): boolean;
    /** @private */
    _runAsyncInternal(runOptions: RunOptions, parentData: RunData): Promise<TestCaseResult>;
}
export declare class FailureTestCase extends TestCase {
    private _failureFilename?;
    private _error;
    constructor(name: string[], error: unknown);
    _setFilename(filename: string): void;
    _runAsyncInternal(runOptions: RunOptions, parentData: RunData): Promise<TestCaseResult>;
}
