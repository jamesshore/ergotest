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
import { Milliseconds, RecursiveRunOptions, Test } from "./test.js";
import { BeforeAfterDefinition, runTestFnAsync } from "./runnable_function.js";

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

/**
 * A simple but full-featured test runner.
 */
export class TestSuite implements Test {

	private _name: string;
	private _mark: TestMarkValue;
	private _tests: Test[];
	private _hasDotOnlyChildren: boolean;
	private _allChildrenSkipped: boolean;
	private _beforeAll: BeforeAfterDefinition[];
	private _afterAll: BeforeAfterDefinition[];
	private _beforeEach: BeforeAfterDefinition[];
	private _afterEach: BeforeAfterDefinition[];
	private _timeout?: Milliseconds;
	private _filename?: string;

	static get DEFAULT_TIMEOUT_IN_MS() {
		return DEFAULT_TIMEOUT_IN_MS;
	}

	static create({
		name,
		mark = TestMark.none,
		timeout,
		beforeAll = [],
		afterAll = [],
		beforeEach = [],
		afterEach = [],
		tests = [],
	}: {
		name: string,
		mark?: TestMarkValue,
		timeout?: Milliseconds,
		beforeAll?: BeforeAfterDefinition[],
		afterAll?: BeforeAfterDefinition[],
		beforeEach?: BeforeAfterDefinition[],
		afterEach?: BeforeAfterDefinition[],
		tests?: Test[],
	}) {
		return new TestSuite(name, mark, { timeout, beforeAll, afterAll, beforeEach, afterEach, tests });
	}

	/** Internal use only. (Use {@link describe} or {@link TestSuite.fromModulesAsync} instead.) */
	constructor(name: string, mark: TestMarkValue, {
		tests = [],
		beforeAll = [],
		afterAll = [],
		beforeEach = [],
		afterEach = [],
		timeout,
	}: {
		tests?: Test[],
		beforeAll?: BeforeAfterDefinition[],
		afterAll?: BeforeAfterDefinition[],
		beforeEach?: BeforeAfterDefinition[],
		afterEach?: BeforeAfterDefinition[],
		timeout?: Milliseconds,
	}) {
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

		return await this._recursiveRunAsync(TestMark.only, [], [], {
			clock,
			config,
			onTestCaseResult,
			name: [],
			filename: this._filename,
			timeout: this._timeout ?? timeout ?? DEFAULT_TIMEOUT_IN_MS,
			renderError: await importRendererAsync(renderer),
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
	async _recursiveRunAsync(
		parentMark: TestMarkValue,
		parentBeforeEach: BeforeAfterDefinition[],
		parentAfterEach: BeforeAfterDefinition[],
		runOptions: RecursiveRunOptions,
	) {
		runOptions = {
			...runOptions,
			name: [ ...runOptions.name ],
			filename: this._filename ?? runOptions.filename,
			timeout: this._timeout ?? runOptions.timeout
		};
		if (this._name !== "") runOptions.name.push(this._name);
		const resultOptions = { filename: runOptions.filename, mark: this._mark };

		const beforeAllResults: TestCaseResult[] = [];
		let beforeAllFailed = false;
		for await (const before of this._beforeAll) {
			const name = [ ...runOptions.name, `beforeAll() #${beforeAllResults.length + 1}`];

			const it = this._allChildrenSkipped || beforeAllFailed
				? RunResult.skip({ name, filename: runOptions.filename })
				: await runTestFnAsync(name, before.fnAsync, before.options.timeout, runOptions);
			const result = TestCaseResult.create({ it });

			if (!isSuccess(result)) beforeAllFailed = true;
			runOptions.onTestCaseResult(result);
			beforeAllResults.push(result);
		}


		let inheritedMark = this._mark;
		if (inheritedMark === TestMark.none) inheritedMark = parentMark;
		if (inheritedMark === TestMark.only && this._hasDotOnlyChildren) inheritedMark = TestMark.skip;
		if (beforeAllFailed) inheritedMark = TestMark.skip;

		this._beforeEach.forEach((beforeEach, i) => {
			const number = i === 0 ? "" : ` #${i + 1}`;
			beforeEach.name = [ ...runOptions.name, `beforeEach()${number}` ];
		});
		this._afterEach.forEach((afterEach, i) => {
			const number = i === 0 ? "" : ` #${i + 1}`;
			afterEach.name = [ ...runOptions.name, `afterEach()${number}` ];
		});

		const beforeEach = [ ...parentBeforeEach, ...this._beforeEach ];
		const afterEach = [ ...this._afterEach, ...parentAfterEach ];

		const testResults = [];
		for await (const test of this._tests) {
			testResults.push(await test._recursiveRunAsync(inheritedMark, beforeEach, afterEach, runOptions));
		}

		const afterAllResults: TestCaseResult[] = [];
		for await (const after of this._afterAll) {
			const name = [ ...runOptions.name, `afterAll() #${afterAllResults.length + 1}`];

			const it = this._allChildrenSkipped || beforeAllFailed
				? RunResult.skip({ name, filename: runOptions.filename })
				: await runTestFnAsync(name, after.fnAsync, after.options.timeout, runOptions);
			const result = TestCaseResult.create({ it });

			runOptions.onTestCaseResult(result);
			afterAllResults.push(result);
		}

		return TestSuiteResult.create({
			name: runOptions.name,
			tests: testResults,
			beforeAll: beforeAllResults,
			afterAll: afterAllResults,
			...resultOptions,
		});
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