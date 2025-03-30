// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { Milliseconds, RecursiveRunOptions, Test } from "./test.js";
import { RunResult, TestCaseResult, TestMark, TestMarkValue, TestStatus } from "../results/test_result.js";
import * as ensure from "../../util/ensure.js";
import { ItFn, ItOptions } from "../test_api.js";
import { ParentData } from "./test_suite.js";
import { runTestFnAsync } from "./runnable_function.js";

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
	async _recursiveRunAsync(
		options: RecursiveRunOptions,
		parentData: ParentData,
	): Promise<TestCaseResult> {
		const name = this._name;
		options = { ...options };

		let skipTest = this._isSkipped(parentData.mark);
		const beforeEach = [];
		for await (const before of parentData.beforeEach) {
			ensure.defined(before.name, "before.name");
			const result = skipTest
				? RunResult.skip({ name: before.name!, filename: parentData.filename })
				: await runTestFnAsync(before.name!, before.fnAsync, before.options.timeout, options, parentData);
			if (!isSuccess(result)) skipTest = true;
			beforeEach.push(result);
		}

		let it;
		if (this._testFn === undefined && this._mark === TestMark.only) {
			it = RunResult.fail({
				name,
				filename: parentData.filename,
				error: "Test is marked '.only', but it has no body",
				renderError: options.renderError,
			});
		}
		else if (skipTest) {
			it = RunResult.skip({ name: this._name, filename: parentData.filename });
		}
		else {
			it = await runTestFnAsync(this._name, this._testFn!, this._timeout, options, parentData);
		}

		const afterEach = [];
		for await (const after of parentData.afterEach) {
			ensure.defined(after.name, "after.name");
			const result = skipTest
				? RunResult.skip({ name: after.name!, filename: parentData.filename })
				: await runTestFnAsync(after.name!, after.fnAsync, after.options.timeout, options, parentData);
			afterEach.push(result);
		}

		const result = TestCaseResult.create({ mark: this._mark, beforeEach, afterEach, it });

		options.onTestCaseResult(result);
		return result;
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

	override async _recursiveRunAsync(
		runOptions: RecursiveRunOptions,
		parentData: ParentData,
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