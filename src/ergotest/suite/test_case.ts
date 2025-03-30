// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { Milliseconds, RunOptions, Test } from "./test.js";
import { RunResult, TestCaseResult, TestMark, TestMarkValue, TestStatus } from "../results/test_result.js";
import * as ensure from "../../util/ensure.js";
import { ItFn, ItOptions } from "../test_api.js";
import { RunData } from "./test_suite.js";
import { runTestFnAsync } from "./runnable_function.js";
import { BeforeAfter } from "./before_after.js";

export class TestCase implements Test {

	protected _name: string[];
	private _timeout?: Milliseconds;
	private _testFn?: ItFn;
	private _mark: TestMarkValue;

	static create({
		name,
		mark = TestMark.none,
		options = {},
		fnAsync = undefined,
	}: {
		name: string[],
		mark?: TestMarkValue,
		options?: ItOptions,
		fnAsync?: ItFn,
	}): TestCase {
		return new TestCase(name, options.timeout, fnAsync, mark);
	}

	constructor(
		name: string[],
		timeout: Milliseconds | undefined,
		testFn: ItFn | undefined,
		mark: TestMarkValue
	) {
		this._name = name;
		this._timeout = timeout;
		this._testFn = testFn;
		this._mark = mark;
		if (testFn === undefined && mark === TestMark.none) this._mark = TestMark.skip;
	}

	/** @private */
	_isDotOnly(): boolean {
		ensure.signature(arguments, []);
		return this._mark === TestMark.only;
	}

	/** @private */
	_isSkipped(parentMark: TestMarkValue): boolean {
		const inheritedMark = this._mark === TestMark.none ? parentMark : this._mark;
		return inheritedMark === TestMark.skip || this._testFn === undefined;
	}

	/** @private */
	async _runAsyncInternal(
		runOptions: RunOptions,
		parentData: RunData,
	): Promise<TestCaseResult> {
		const runData = this.#consolidateData(parentData);

		const beforeEach = await this.#runBeforeAfterEachAsync(runData.beforeEach, true, runOptions, runData);
		const it = await this.#runTestAsync(runData, runOptions);
		const afterEach = await this.#runBeforeAfterEachAsync(runData.afterEach, false, runOptions, runData);

		const result = TestCaseResult.create({ mark: this._mark, beforeEach, afterEach, it });
		runOptions.onTestCaseResult(result);
		return result;
	}

	async #runTestAsync(runData: RunData, runOptions: RunOptions) {
		if (this._testFn === undefined && this._mark === TestMark.only) {
			return RunResult.fail({
				name: this._name,
				filename: runData.filename,
				error: "Test is marked '.only', but it has no body",
				renderError: runOptions.renderError,
			});
		}
		else if (runData.skipAll) {
			return RunResult.skip({ name: this._name, filename: runData.filename });
		}
		else {
			return await runTestFnAsync(this._name, this._testFn!, this._timeout, runOptions, runData);
		}
	}

	async #runBeforeAfterEachAsync(
		beforeAfter: BeforeAfter[],
		isBeforeEach: boolean,
		runOptions: RunOptions,
		runData: RunData
	) {
		const results = [];
		for await (const test of beforeAfter) {
			const result = await test.runBeforeAfterEachAsync(runOptions, runData);
			if (isBeforeEach && !isSuccess(result)) runData.skipAll = true;
			results.push(result);
		}
		return results;
	}

	#consolidateData(parentData: RunData): RunData {
		return {
			filename: parentData.filename,
			mark: this._mark === TestMark.none ? parentData.mark : this._mark,
			timeout: this._timeout ?? parentData.timeout,
			skipAll: parentData.skipAll || this._isSkipped(parentData.mark),
			beforeEach: parentData.beforeEach,
			afterEach: parentData.afterEach,
		};
	}

}



function isSuccess(result: TestCaseResult | RunResult) {
	return result.status === TestStatus.pass || result.status === TestStatus.skip;
}




export class FailureTestCase extends TestCase {

	private _filename?: string;
	private _error: unknown;

	constructor(name: string[], error: unknown, filename?: string) {
		super(name, undefined, undefined, TestMark.none);

		this._filename = filename;
		this._error = error;
	}

	override async _runAsyncInternal(
		runOptions: RunOptions,
		parentData: RunData,
	): Promise<TestCaseResult> {
		const it = RunResult.fail({
			name: this._name,
			filename: this._filename,
			error: this._error,
			renderError: runOptions.renderError,
		});
		const result = TestCaseResult.create({ mark: TestMark.none, it });

		runOptions.onTestCaseResult(result);
		return await result;
	}

}