import { TestMarkValue, TestResult } from "../results/test_result.js";
import { RunData, RunOptions } from "./test_suite.js";
export interface Test {
    _runAsyncInternal: (options: RunOptions, parentData: RunData) => Promise<TestResult> | TestResult;
    _isDotOnly: () => boolean;
    _isSkipped: (mark: TestMarkValue) => boolean;
}
