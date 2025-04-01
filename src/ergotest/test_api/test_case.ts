// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { RunOptions, Test } from "./test.js";
import { RunResult, TestCaseResult, TestMark, TestMarkValue, TestStatus } from "../results/test_result.js";
import * as ensure from "../../util/ensure.js";
import { ItFn, ItOptions } from "../test_api.js";
import { RunData } from "./test_suite.js";
import { Runnable } from "./runnable.js";
import { BeforeAfter } from "./before_after.js";

export class TestCase extends Runnable implements Test {

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
		return new TestCase(name, options, fnAsync, mark);
	}

	constructor(
		name: string[],
		options: ItOptions,
		fnAsync: ItFn | undefined,
		mark: TestMarkValue
	) {
		super(name, options, fnAsync);

		this._mark = mark;
		if (fnAsync === undefined && mark === TestMark.none) this._mark = TestMark.skip;
	}

	/** @private */
	_isDotOnly(): boolean {
		ensure.signature(arguments, []);
		return this._mark === TestMark.only;
	}

	/** @private */
	_isSkipped(parentMark: TestMarkValue): boolean {
		const inheritedMark = this._mark === TestMark.none ? parentMark : this._mark;
		return inheritedMark === TestMark.skip || this.fnAsync === undefined;
	}

	/** @private */
	async _runAsyncInternal(
		runOptions: RunOptions,
		parentData: RunData,
	): Promise<TestCaseResult> {
		const runData = this.#consolidateRunData(parentData);

		const beforeEach = await this.#runBeforeAfterEachAsync(runData.beforeEach, true, runOptions, runData);
		const it = await this.#runTestAsync(runData, runOptions);
		const afterEach = await this.#runBeforeAfterEachAsync(runData.afterEach, false, runOptions, runData);

		const result = TestCaseResult.create({ mark: this._mark, beforeEach, afterEach, it });
		runOptions.onTestCaseResult(result);
		return result;
	}

	async #runTestAsync(runData: RunData, runOptions: RunOptions) {
		if (this.fnAsync === undefined && this._mark === TestMark.only) {
			return RunResult.fail({
				name: this.name,
				filename: runData.filename,
				error: "Test is marked '.only', but it has no body",
				renderError: runOptions.renderError,
			});
		}

		return await this._runTestFnAsync(runOptions, runData);
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

	#consolidateRunData(parentData: RunData): RunData {
		return {
			filename: parentData.filename,
			mark: this._mark === TestMark.none ? parentData.mark : this._mark,
			timeout: parentData.timeout,
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
		super(name, {}, undefined, TestMark.none);

		this._filename = filename;
		this._error = error;
	}

	override async _runAsyncInternal(
		runOptions: RunOptions,
		parentData: RunData,
	): Promise<TestCaseResult> {
		const it = RunResult.fail({
			name: this.name,
			filename: this._filename,
			error: this._error,
			renderError: runOptions.renderError,
		});
		const result = TestCaseResult.create({ mark: TestMark.none, it });

		runOptions.onTestCaseResult(result);
		return await result;
	}

}