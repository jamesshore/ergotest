// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."

import * as ensure from "../util/ensure.js";
import { Clock } from "../infrastructure/clock.js";
import {
	RenderErrorFn, RunResult,
	TestCaseResult,
	TestMark,
	TestMarkValue,
	TestResult,
	TestStatus,
	TestSuiteResult,
} from "./test_result.js";
import path from "node:path";

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

export interface DescribeOptions {
	timeout?: Milliseconds,
}

export interface ItOptions {
	timeout?: Milliseconds,
}

export type DescribeFn = () => void;

export type ItFn = (testUtilities: TestParameters) => Promise<void> | void;

type BeforeAfter = (optionalOptions: ItOptions | ItFn, fnAsync?: ItFn) => void;

type BeforeAfterDefinition = { name?: string[], options: ItOptions, fnAsync: ItFn };

interface TestParameters {
	getConfig: <T>(key: string) => T,
}

type Milliseconds = number;

interface RecursiveRunOptions {
	name: string[];
	filename?: string;
	clock: Clock,
	onTestCaseResult: (testResult: TestCaseResult) => void,
	timeout: Milliseconds,
	config: TestConfig,
	renderError?: RenderErrorFn,
}

interface Test {
	_recursiveRunAsync: (
		parentMark: TestMarkValue,
		parentBeforeEachFns: BeforeAfterDefinition[],
		parentAfterEachFns: BeforeAfterDefinition[],
		options: RecursiveRunOptions,
	) => Promise<TestResult> | TestResult;
	_isDotOnly: () => boolean,
	_isSkipped: (mark: TestMarkValue) => boolean,
}

export interface TestContext {
	describe(
		optionalName: string | DescribeOptions | DescribeFn | undefined,
		optionalOptions: DescribeOptions | DescribeFn | undefined,
		describeFn: DescribeFn | undefined,
		mark: TestMarkValue,
	): TestSuite,
	it(
		name: string,
		optionalOptions: ItOptions | ItFn | undefined,
		itFn: ItFn | undefined,
		mark: TestMarkValue,
	): void;
	beforeAll: BeforeAfter,
	afterAll: BeforeAfter,
	beforeEach: BeforeAfter,
	afterEach: BeforeAfter,
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

	/**
	 * Convert a list of test modules into a test suite. Each module needs to export a test suite by using
	 * {@link TestSuite.create}.
	 * @param {string[]} moduleFilenames The filenames of the test modules.
	 * @returns {TestSuite} The test suite.
	 */
	static async fromModulesAsync(moduleFilenames: string[]): Promise<TestSuite> {
		ensure.signature(arguments, [ Array ]);

		const suites = await Promise.all(moduleFilenames.map(filename => loadModuleAsync(filename)));
		return new TestSuite("", TestMark.none, { tests: suites });

		async function loadModuleAsync(filename: string): Promise<TestSuite> {
			const errorName = `error when importing ${path.basename(filename)}`;

			if (!path.isAbsolute(filename)) {
				return createFailure(errorName, `Test module filenames must use absolute paths: ${filename}`);
			}
			try {
				const { default: suite } = await import(filename);
				if (suite instanceof TestSuite) {
					suite._setFilename(filename);
					return suite;
				}
				else {
					return createFailure(errorName, `Test module doesn't export a test suite: ${filename}`, filename);
				}
			}
			catch(err) {
				const code = (err as { code: string })?.code;
				if (code === "ERR_MODULE_NOT_FOUND") {
					return createFailure(errorName, `Test module not found: ${filename}`, filename);
				}
				else {
					return createFailure(errorName, err, filename);
				}
			}
		}

		function createFailure(name: string, error: unknown, filename?: string) {
			return new TestSuite("", TestMark.none, { tests: [ new FailureTestCase(name, error, filename) ] });
		}
	}

	/** Internal use only. */
	static create(
		nameOrOptionsOrDescribeFn: string | DescribeOptions | DescribeFn | undefined,
		optionsOrDescribeFn: DescribeOptions | DescribeFn | undefined,
		possibleDescribeFn: DescribeFn | undefined,
		mark: TestMarkValue,
		testContext: TestContext[],
	): TestSuite {
		const DescribeOptionsType = { timeout: Number };
		ensure.signature(arguments, [
			[ undefined, DescribeOptionsType, String, Function ],
			[ undefined, DescribeOptionsType, Function ],
			[ undefined, Function ],
			String,
			Array,
		]);

		const { name, options, fn } = decipherOverloadedParameters();

		if (fn !== undefined) {
			return this.#runDescribeFunction(fn, name, mark, testContext, options.timeout);
		}
		else if (mark === TestMark.only) {
			return new TestSuite(name, mark, {
				tests: [ new FailureTestCase(name, "Test suite is marked '.only', but it has no body") ],
			});
		}
		else {
			return new TestSuite(name, TestMark.skip, { timeout: options.timeout });
		}

		function decipherOverloadedParameters() {
			let name: string;
			let options: DescribeOptions | undefined;
			let fn: DescribeFn | undefined;

			switch (typeof nameOrOptionsOrDescribeFn) {
				case "string":
					name = nameOrOptionsOrDescribeFn;
					break;
				case "object":
					options = nameOrOptionsOrDescribeFn;
					break;
				case "function":
					fn = nameOrOptionsOrDescribeFn;
					break;
				case "undefined":
					break;
				default:
					ensure.unreachable(`Unknown typeof for nameOrOptionsOrSuiteFn: ${typeof nameOrOptionsOrDescribeFn}`);
			}
			switch (typeof optionsOrDescribeFn) {
				case "object":
					ensure.that(options === undefined, "Received two options parameters");
					options = optionsOrDescribeFn;
					break;
				case "function":
					ensure.that(fn === undefined, "Received two suite function parameters");
					fn = optionsOrDescribeFn;
					break;
				case "undefined":
					break;
				default:
					ensure.unreachable(`Unknown typeof for optionsOrSuiteFn: ${typeof optionsOrDescribeFn}`);
			}
			if (possibleDescribeFn !== undefined) {
				ensure.that(fn === undefined, "Received two suite function parameters");
				fn = possibleDescribeFn;
			}

			name ??= "";
			options ??= {};

			return { name, options, fn };
		}
	}

	static #runDescribeFunction(
		describeFn: DescribeFn,
		name: string,
		mark: TestMarkValue,
		testContext: TestContext[],
		timeout?: Milliseconds,
	): TestSuite {
		const tests: Test[] = [];
		const beforeAll: BeforeAfterDefinition[] = [];
		const afterAll: BeforeAfterDefinition[] = [];
		const beforeEach: BeforeAfterDefinition[] = [];
		const afterEach: BeforeAfterDefinition[] = [];

		testContext.push({
			describe(optionalName, optionalOptions, fn, mark) {
				const suite = TestSuite.create(optionalName, optionalOptions, fn, mark, testContext);
				tests.push(suite);
				return suite;
			},
			it(name, optionalOptions, testCaseFn, mark) {
				tests.push(TestCase.create(name, optionalOptions, testCaseFn, mark));
			},
			beforeAll: defineBeforeAfterFn(beforeAll),
			afterAll: defineBeforeAfterFn(afterAll),
			beforeEach: defineBeforeAfterFn(beforeEach),
			afterEach: defineBeforeAfterFn(afterEach),
		});

		try {
			describeFn();
		}
		finally {
			testContext.pop();
		}

		return new TestSuite(name, mark, { tests, beforeAll, afterAll, beforeEach, afterEach, timeout });

		function defineBeforeAfterFn(beforeAfterArray: BeforeAfterDefinition[]) {
			return function (optionsOrFnAsync: ItOptions | ItFn, possibleFnAsync?: ItFn) {
				ensure.signature(arguments, [
					[ { timeout: Number }, Function ],
					[ undefined, Function ],
				]);

				let options: ItOptions;
				let fnAsync: ItFn;

				if (possibleFnAsync === undefined) {
					options = {};
					fnAsync = optionsOrFnAsync as ItFn;
				}
				else {
					options = optionsOrFnAsync as ItOptions;
					fnAsync = possibleFnAsync;
				}

				beforeAfterArray.push({ options, fnAsync });
			};
		}
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

			const result = this._allChildrenSkipped || beforeAllFailed
				? TestResult.skip(name, resultOptions)
				: await runTestFnAsync(name, before.fnAsync, TestMark.none, before.options.timeout, [], runOptions);

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

			const result = this._allChildrenSkipped || beforeAllFailed
				? TestResult.skip(name, resultOptions)
				: await runTestFnAsync(name, after.fnAsync, TestMark.none, after.options.timeout, [], runOptions);

			runOptions.onTestCaseResult(result);
			afterAllResults.push(result);
		}

		return TestResult.suite(runOptions.name, testResults, {
			beforeAll: beforeAllResults,
			afterAll: afterAllResults,
			...resultOptions,
		});
	}

}


class TestCase implements Test {

	protected _name: string;
	private _timeout?: Milliseconds;
	private _testFn?: ItFn;
	private _mark: TestMarkValue;

	static create(
		name: string,
		optionsOrTestFn: TestOptions | ItFn | undefined,
		possibleTestFn: ItFn | undefined,
		mark: TestMarkValue,
	) {
		ensure.signature(arguments, [
			String,
			[ undefined, { timeout: [ undefined, Number ]}, Function ],
			[ undefined, Function ],
			String
		]);

		let timeout;
		let testFn;

		switch (typeof optionsOrTestFn) {
			case "object":
				timeout = optionsOrTestFn.timeout;
				break;
			case "function":
				testFn = optionsOrTestFn;
				break;
			case "undefined":
				break;
			default:
				ensure.unreachable(`Unknown typeof optionsOrTestFn: ${typeof optionsOrTestFn}`);
		}
		if (possibleTestFn !== undefined) {
			ensure.that(testFn === undefined, "Received two test function parameters");
			testFn = possibleTestFn;
		}

		return new TestCase(name, timeout, testFn, mark);
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
		const beforeEachResults = [];
		for await (const before of parentBeforeEach) {
			ensure.defined(before.name, "before.name");
			const result = skipTest
				? TestResult.skip(before.name!, { filename: options.filename, mark: TestMark.none })
				: await runTestFnAsync(before.name!, before.fnAsync, TestMark.none, before.options.timeout, [], options);
			if (!isSuccess(result)) skipTest = true;
			beforeEachResults.push(result);
		}

		let result;
		if (this._testFn === undefined && this._mark === TestMark.only) {
			result = TestResult.fail(
				name,
				"Test is marked '.only', but it has no body",
				{
					renderError: options.renderError,
					filename: options.filename,
					mark: TestMark.only,
				},
			);
		}
		else if (skipTest) {
			result = TestResult.skip(options.name, { filename: options.filename, mark: this._mark });
		}
		else {
			result = await runTestFnAsync(
				options.name, this._testFn!, this._mark, this._timeout, beforeEachResults, options
			);
		}

		const afterEachResults = [];
		for await (const after of parentAfterEach) {
			ensure.defined(after.name, "after.name");
			const result = skipTest
				? TestResult.skip(after.name!, { filename: options.filename, mark: TestMark.none })
				: await runTestFnAsync(after.name!, after.fnAsync, TestMark.none, after.options.timeout, [], options);
			afterEachResults.push(result);
		}

		result._beforeEach = beforeEachResults;
		result._afterEach = afterEachResults;

		options.onTestCaseResult(result);
		return result;
	}
}


class FailureTestCase extends TestCase {

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
		const result = TestResult.fail([ this._name ], this._error, {
			renderError: options.renderError,
			filename: this._filename,
			mark: TestMark.none,
		});
		options.onTestCaseResult(result);
		return await result;
	}

}


async function runTestFnAsync(
	name: string[],
	fn: ItFn,
	mark: TestMarkValue,
	testTimeout: Milliseconds | undefined,
	beforeEach: TestCaseResult[],
	{ clock, filename, timeout, config, renderError }: RecursiveRunOptions,
): Promise<TestCaseResult> {
	const getConfig = <T>(name: string) => {
		if (config[name] === undefined) throw new Error(`No test config found for name '${name}'`);
		return config[name] as T;
	};

	timeout = testTimeout ?? timeout;

	const it = await clock.timeoutAsync(timeout, async () => {
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
	return await TestResult.testCase({ mark, it });
}

function isSuccess(result: TestCaseResult) {
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
