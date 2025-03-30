// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { Milliseconds, RecursiveRunOptions, Test } from "./test.js";
import { RunResult, TestCaseResult, TestMark, TestMarkValue, TestStatus } from "../results/test_result.js";
import * as ensure from "../../util/ensure.js";
import { ItFn, ItOptions } from "../test_api.js";
import { BeforeAfterDefinition } from "./before_after.js";

export class TestCase implements Test {

	protected _name: string;
	private _timeout?: Milliseconds;
	private _testFn?: ItFn;
	private _mark: TestMarkValue;

	static create({
		name,
		mark = TestMark.none,
		options = {},
		fnAsync,
	}: {
		name: string,
		mark?: TestMarkValue,
		options?: ItOptions,
		fnAsync?: ItFn,
	}): TestCase {
		ensure.signature(arguments, [{
			name: String,
			mark: [ undefined, String ],
			options: [ undefined, { timeout: [ undefined, Number ] } ],
			fnAsync: [ undefined, Function ],
		}]);

		return new TestCase(name, options.timeout, fnAsync, mark);
	}

	constructor(
		name: string,
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
		parentMark: TestMarkValue,
		parentBeforeEach: BeforeAfterDefinition[],
		parentAfterEach: BeforeAfterDefinition[],
		options: RecursiveRunOptions,
	): Promise<TestCaseResult> {
		const name = [ ...options.name ];
		name.push(this._name !== "" ? this._name : "(unnamed)");
		options = { ...options, name };

		let skipTest = this._isSkipped(parentMark);
		const beforeEach = [];
		for await (const before of parentBeforeEach) {
			ensure.defined(before.name, "before.name");
			const result = skipTest
				? RunResult.skip({ name: before.name!, filename: options.filename })
				: await runTestFnAsync(before.name!, before.fnAsync, before.options.timeout, options);
			if (!isSuccess(result)) skipTest = true;
			beforeEach.push(result);
		}

		let it;
		if (this._testFn === undefined && this._mark === TestMark.only) {
			it = RunResult.fail({
				name,
				filename: options.filename,
				error: "Test is marked '.only', but it has no body",
				renderError: options.renderError,
			});
		}
		else if (skipTest) {
			it = RunResult.skip({ name: options.name, filename: options.filename });
		}
		else {
			it = await runTestFnAsync(options.name, this._testFn!, this._timeout, options);
		}

		const afterEach = [];
		for await (const after of parentAfterEach) {
			ensure.defined(after.name, "after.name");
			const result = skipTest
				? RunResult.skip({ name: after.name!, filename: options.filename })
				: await runTestFnAsync(after.name!, after.fnAsync, after.options.timeout, options);
			afterEach.push(result);
		}

		const result = TestCaseResult.create({ mark: this._mark, beforeEach, afterEach, it });

		options.onTestCaseResult(result);
		return result;
	}
}



async function runTestFnAsync(
	name: string[],
	fn: ItFn,
	testTimeout: Milliseconds | undefined,
	{ clock, filename, timeout, config, renderError }: RecursiveRunOptions,
): Promise<RunResult> {
	const getConfig = <T>(name: string) => {
		if (config[name] === undefined) throw new Error(`No test config found for name '${name}'`);
		return config[name] as T;
	};

	timeout = testTimeout ?? timeout;

	return await clock.timeoutAsync(timeout, async () => {
		try {
			await fn({ getConfig });
			return RunResult.pass({ name, filename });
		}
		catch (error) {
			return RunResult.fail({ name, filename, error, renderError });
		}
	}, async () => {
		return await RunResult.timeout({ name, filename, timeout });
	});
}



function isSuccess(result: TestCaseResult | RunResult) {
	return result.status === TestStatus.pass || result.status === TestStatus.skip;
}




export class FailureTestCase extends TestCase {

	private _filename?: string;
	private _error: unknown;

	constructor(name: string, error: unknown, filename?: string) {
		super(name, undefined, undefined, TestMark.none);

		this._filename = filename;
		this._error = error;
	}

	override async _recursiveRunAsync(
		parentMark: TestMarkValue,
		beforeEachFns: BeforeAfterDefinition[],
		afterEachFns: BeforeAfterDefinition[],
		options: RecursiveRunOptions,
	): Promise<TestCaseResult> {
		const it = RunResult.fail({
			name: this._name,
			filename: this._filename,
			error: this._error,
			renderError: options.renderError,
		});
		const result = TestCaseResult.create({ mark: TestMark.none, it });

		options.onTestCaseResult(result);
		return await result;
	}

}