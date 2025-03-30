// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import * as ensure from "../../util/ensure.js";
import { Clock } from "../../infrastructure/clock.js";
import {
	RunResult,
	TestCaseResult,
	TestMark,
	TestMarkValue,
	TestResult,
	TestStatus,
	TestSuiteResult,
} from "../results/test_result.js";
import { Milliseconds, RunOptions, Test } from "./test.js";
import { runTestFnAsync } from "./runnable_function.js";
import { BeforeAfter } from "./before_after.js";

const DEFAULT_TIMEOUT_IN_MS = 2000;

export interface TestConfig {
	[name: string]: unknown,
}

export interface TestOptions {
	timeout?: Milliseconds,
	config?: TestConfig,
	onTestCaseResult?: (testCaseResult: TestCaseResult) => void,
	renderer?: string,
	clock?: Clock,
}

export interface RunData {
	filename?: string;
	mark: TestMarkValue;
	timeout: Milliseconds;
	beforeAllFailed: boolean;
	beforeEach: BeforeAfter[];
	afterEach: BeforeAfter[];
}

/**
 * A simple but full-featured test runner.
 */
export class TestSuite implements Test {

	private _name: string[];
	private _mark: TestMarkValue;
	private _tests: Test[];
	private _hasDotOnlyChildren: boolean;
	private _allChildrenSkipped: boolean;
	private _beforeAll: BeforeAfter[];
	private _afterAll: BeforeAfter[];
	private _beforeEach: BeforeAfter[];
	private _afterEach: BeforeAfter[];
	private _timeout?: Milliseconds;
	private _filename?: string;

	static get DEFAULT_TIMEOUT_IN_MS() {
		return DEFAULT_TIMEOUT_IN_MS;
	}

	static create({
		name = [],
		mark = TestMark.none,
		timeout = undefined,
		beforeAll = [],
		afterAll = [],
		beforeEach = [],
		afterEach = [],
		tests = [],
	}: {
		name?: string[],
		mark?: TestMarkValue,
		timeout?: Milliseconds,
		beforeAll?: BeforeAfter[],
		afterAll?: BeforeAfter[],
		beforeEach?: BeforeAfter[],
		afterEach?: BeforeAfter[],
		tests?: Test[],
	}) {
		return new TestSuite(name, mark, timeout, beforeAll, afterAll, beforeEach, afterEach, tests);
	}

	/** Internal use only. (Use {@link describe} or {@link TestSuite.fromModulesAsync} instead.) */
	constructor(
		name: string[],
		mark: TestMarkValue,
		timeout: Milliseconds,
		beforeAll: BeforeAfter[],
		afterAll: BeforeAfter[],
		beforeEach: BeforeAfter[],
		afterEach: BeforeAfter[],
		tests: Test[],
	) {
		this._name = name;
		this._mark = mark;
		this._tests = tests;
		this._hasDotOnlyChildren = this._tests.some(test => test._isDotOnly());
		this._allChildrenSkipped = this._tests.every(test => test._isSkipped(this._mark));
		this._beforeAll = beforeAll;
		this._afterAll = afterAll;
		this._beforeEach = beforeEach;
		this._afterEach = afterEach;
		this._timeout = timeout;
	}

	/**
	 * Run the tests in this suite.
	 * @param {number} [timeout] Default timeout in milliseconds.
	 * @param {object} [config={}] Configuration data to provide to tests.
	 * @param {(result: TestResult) => ()} [onTestCaseResult] A function to call each time a test completes. The `result`
	 *   parameter describes the result of the test—whether it passed, failed, etc.
	 * @param {string} [renderer] Path to a module that exports a `renderError()` function with the signature `(name:
	 *   string, error: unknown, mark: TestMarkValue, filename?: string) => unknown`. The path must be an absolute path
	 *   or a module that exists in `node_modules`. The `renderError()` function will be called when a test fails and the
	 *   return value will be placed into the test result as {@link TestResult.errorRender}.
	 * @param {Clock} [clock] Internal use only.
	 * @returns {Promise<TestSuiteResult>} The results of the test suite.
	 */
	async runAsync({
		timeout = DEFAULT_TIMEOUT_IN_MS,
		config = {},
		onTestCaseResult = () => {},
		renderer,
		clock = Clock.create(),
	}: TestOptions = {}): Promise<TestSuiteResult> {
		ensure.signature(arguments, [[ undefined, {
			timeout: [ undefined, Number ],
			config: [ undefined, Object ],
			onTestCaseResult: [ undefined, Function ],
			renderer: [ undefined, String ],
			clock: [ undefined, Clock ],
		}]]);

		return await this._runAsyncInternal({
			clock,
			config,
			onTestCaseResult,
			renderError: await importRendererAsync(renderer),
		}, {
			mark: TestMark.only,
			timeout: this._timeout ?? timeout,
			beforeAllFailed: false,
			beforeEach: [],
			afterEach: [],
		});
	}

	/** @private */
	_setFilename(filename: string) { this._filename = filename; }

	/** @private */
	_isDotOnly(): boolean {
		return this._mark === TestMark.only || this._hasDotOnlyChildren;
	}

	/** @private */
	_isSkipped(): boolean {
		return this._allChildrenSkipped;
	}

	/** @private */
	async _runAsyncInternal(runOptions: RunOptions, parentData: RunData) {
		const runData = this.#consolidateData(parentData);

		const beforeAllResults = await this.#runBeforeAfterAllAsync(this._beforeAll, true, runOptions, runData);
		const testResults = await this.#runTestsAsync(runOptions, runData);
		const afterAllResults = await this.#runBeforeAfterAllAsync(this._afterAll, false, runOptions, runData);

		return TestSuiteResult.create({
			name: this._name,
			filename: runData.filename,
			mark: this._mark,
			tests: testResults,
			beforeAll: beforeAllResults,
			afterAll: afterAllResults,
		});
	}

	async #runTestsAsync(runOptions: RunOptions, runData: RunData) {
		const testResults = [];
		for await (const test of this._tests) {
			testResults.push(await test._runAsyncInternal(runOptions, runData));
		}
		return testResults;
	}

	async #runBeforeAfterAllAsync(
		beforeAfter: BeforeAfter[],
		isBeforeAll: boolean,
		runOptions: RunOptions,
		runData: RunData
	) {
		const results: TestCaseResult[] = [];

		for await (const test of beforeAfter) {
			const it = this._allChildrenSkipped || runData.beforeAllFailed
				? RunResult.skip({ name: test.name, filename: runData.filename })
				: await runTestFnAsync(test.name, test.fnAsync, test.options.timeout, runOptions, runData);
			const result = TestCaseResult.create({ it });

			if (isBeforeAll && !isSuccess(result)) runData.beforeAllFailed = true;
			runOptions.onTestCaseResult(result);
			results.push(result);
		}
		return results;
	}

	#consolidateData(parentData: RunData): RunData {
		const beforeEach = [ ...parentData.beforeEach, ...this._beforeEach ];
		const afterEach = [ ...this._afterEach, ...parentData.afterEach ];

		let inheritedMark = this._mark;
		if (inheritedMark === TestMark.none) inheritedMark = parentData.mark;
		if (inheritedMark === TestMark.only && this._hasDotOnlyChildren) inheritedMark = TestMark.skip;

		return {
			filename: this._filename ?? parentData.filename,
			mark: inheritedMark,
			timeout: this._timeout ?? parentData.timeout,
			beforeAllFailed: parentData.beforeAllFailed,
			beforeEach,
			afterEach,
		};
	}
}


function isSuccess(result: TestCaseResult | RunResult) {
	return result.status === TestStatus.pass || result.status === TestStatus.skip;
}


/** Internal use only. */
export async function importRendererAsync(renderer?: string) {
	if (renderer === undefined) return undefined;

	try {
		const { renderError } = await import(renderer);
		if (renderError === undefined) {
			throw new Error(`Renderer module doesn't export a renderError() function: ${renderer}`);
		}
		if (typeof renderError !== "function") {
			throw new Error(
				`Renderer module's 'renderError' export must be a function, but it was a ${typeof renderError}: ${renderer}`
			);
		}
		return renderError;
	}
	catch(err) {
		if (typeof err !== "object" || (err as { code: string })?.code !== "ERR_MODULE_NOT_FOUND") throw err;
		throw new Error(`Renderer module not found (did you forget to use an absolute path?): ${renderer}`);
	}
}