import { Clock } from "../../infrastructure/clock.js";
import { RenderErrorFn, TestCaseResult, TestMarkValue, TestSuiteResult } from "../results/test_result.js";
import { BeforeAfter } from "./before_after.js";
import { Test } from "./test.js";
import { Milliseconds, TestOptions } from "../runner/test_api.js";
export interface TestConfig {
    [name: string]: unknown;
}
export interface RunOptions {
    clock: Clock;
    onTestCaseResult: (testResult: TestCaseResult) => void;
    config: TestConfig;
    renderError?: RenderErrorFn;
}
export interface RunData {
    mark: TestMarkValue;
    timeout: Milliseconds;
    skipAll: boolean;
    beforeEach: BeforeAfter[];
    afterEach: BeforeAfter[];
}
/**
 * A simple but full-featured test runner.
 */
export declare class TestSuite implements Test {
    #private;
    private _name;
    private _mark;
    private _tests;
    private _hasDotOnlyChildren;
    private _beforeAll;
    private _afterAll;
    private _beforeEach;
    private _afterEach;
    private _timeout?;
    private _filename?;
    static get DEFAULT_TIMEOUT_IN_MS(): number;
    static create({ name, mark, timeout, beforeAll, afterAll, beforeEach, afterEach, tests, }: {
        name?: string[];
        mark?: TestMarkValue;
        timeout?: Milliseconds;
        beforeAll?: BeforeAfter[];
        afterAll?: BeforeAfter[];
        beforeEach?: BeforeAfter[];
        afterEach?: BeforeAfter[];
        tests?: Test[];
    }): TestSuite;
    /** Internal use only. (Use {@link describe} or {@link TestSuite.fromModulesAsync} instead.) */
    constructor(name: string[], mark: TestMarkValue, timeout: Milliseconds | undefined, beforeAll: BeforeAfter[], afterAll: BeforeAfter[], beforeEach: BeforeAfter[], afterEach: BeforeAfter[], tests: Test[]);
    runAsync({ timeout, config, onTestCaseResult, renderer, clock, }?: TestOptions): Promise<TestSuiteResult>;
    /** @private */
    _setFilename(filename: string): void;
    /** @private */
    _isDotOnly(): boolean;
    /** @private */
    _isSkipped(parentMark: TestMarkValue): boolean;
    /** @private */
    _runAsyncInternal(runOptions: RunOptions, parentData: RunData): Promise<TestSuiteResult>;
}
/** Internal use only. */
export declare function importRendererAsync(renderer?: string): Promise<any>;
