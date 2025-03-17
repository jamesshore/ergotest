// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."

import * as ensure from "../util/ensure.js";
import { Clock } from "../infrastructure/clock.js";
import {
	RenderErrorFn,
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

type BeforeAfterDefinition = { options: ItOptions, fnAsync: ItFn };

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
	private _beforeAllFns: BeforeAfterDefinition[];
	private _afterAllFns: BeforeAfterDefinition[];
	private _beforeEachFns: BeforeAfterDefinition[];
	private _afterEachFns: BeforeAfterDefinition[];
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
		const beforeAllFns: BeforeAfterDefinition[] = [];
		const afterAllFns: BeforeAfterDefinition[] = [];
		const beforeEachFns: BeforeAfterDefinition[] = [];
		const afterEachFns: BeforeAfterDefinition[] = [];

		testContext.push({
			describe(optionalName, optionalOptions, fn, mark) {
				const suite = TestSuite.create(optionalName, optionalOptions, fn, mark, testContext);
				tests.push(suite);
				return suite;
			},
			it(name, optionalOptions, testCaseFn, mark) {
				tests.push(TestCase.create(name, optionalOptions, testCaseFn, mark));
			},
			beforeAll: defineBeforeAfterFn(beforeAllFns),
			afterAll: defineBeforeAfterFn(afterAllFns),
			beforeEach: defineBeforeAfterFn(beforeEachFns),
			afterEach: defineBeforeAfterFn(afterEachFns),
		});

		try {
			describeFn();
		}
		finally {
			testContext.pop();
		}

		return new TestSuite(name, mark, { tests, beforeAllFns, afterAllFns, beforeEachFns, afterEachFns, timeout });

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
		beforeAllFns = [],
		afterAllFns = [],
		beforeEachFns = [],
		afterEachFns = [],
		timeout,
	}: {
		tests?: Test[],
		beforeAllFns?: BeforeAfterDefinition[],
		afterAllFns?: BeforeAfterDefinition[],
		beforeEachFns?: BeforeAfterDefinition[],
		afterEachFns?: BeforeAfterDefinition[],
		timeout?: Milliseconds,
	}) {
		this._name = name;
		this._mark = mark;
		this._tests = tests;
		this._hasDotOnlyChildren = this._tests.some(test => test._isDotOnly());
		this._allChildrenSkipped = this._tests.every(test => test._isSkipped(this._mark));
		this._beforeAllFns = beforeAllFns;
		this._afterAllFns = afterAllFns;
		this._beforeEachFns = beforeEachFns;
		this._afterEachFns = afterEachFns;
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
		parentBeforeEachFns: BeforeAfterDefinition[],
		parentAfterEachFns: BeforeAfterDefinition[],
		options: RecursiveRunOptions,
	) {
		const name = [ ...options.name ];
		if (this._name !== "") name.push(this._name);
		const filename = this._filename ?? options.filename;
		const timeout = this._timeout ?? options.timeout;
		options = { ...options, name, filename, timeout };

		let myMark = this._mark;
		if (myMark === TestMark.none) myMark = parentMark;
		if (myMark === TestMark.only && this._hasDotOnlyChildren) myMark = TestMark.skip;

		const beforeEachFns = [ ...parentBeforeEachFns, ...this._beforeEachFns ];
		const afterEachFns = [ ...this._afterEachFns, ...parentAfterEachFns ];

		if (!this._allChildrenSkipped) {
			const beforeResult = await runBeforeOrAfterFnsAsync(
				[ ...options.name, "beforeAll()" ], this._beforeAllFns, TestMark.none, options,
			);
			if (!isSuccess(beforeResult)) {
				return TestResult.suite(options.name, [ beforeResult ], {
					filename: options.filename,
					mark: this._mark,
				});
			}
		}

		const results = [];
		for await (const test of this._tests) {
			results.push(await test._recursiveRunAsync(myMark, beforeEachFns, afterEachFns, options));
		}

		if (!this._allChildrenSkipped) {
			const afterResult = await runBeforeOrAfterFnsAsync(
				[ ...options.name, "afterAll()" ], this._afterAllFns, TestMark.none, options
			);
			if (!isSuccess(afterResult)) results.push(afterResult);
		}

		return TestResult.suite(options.name, results, {
			filename: options.filename,
			mark: this._mark,
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
		timeout: Milliseconds,
		testFn: ItFn,
		mark: TestMarkValue
	) {
		this._name = name;
		this._timeout = timeout;
		this._testFn = testFn;
		this._mark = mark;
	}

	/** @private */
	_isDotOnly(): boolean {
		ensure.signature(arguments, []);
		return this._mark === TestMark.only;
	}

	/** @private */
	_isSkipped(parentMark: TestMarkValue): boolean {
		const inheritedMark = this._mark === TestMark.none ? parentMark : this._mark;
		return inheritedMark === TestMark.skip;
	}

	/** @private */
	async _recursiveRunAsync(
		parentMark: TestMarkValue,
		beforeEachFns: BeforeAfterDefinition[],
		afterEachFns: BeforeAfterDefinition[],
		options: RecursiveRunOptions,
	): Promise<TestCaseResult> {
		const name = [ ...options.name ];
		name.push(this._name !== "" ? this._name : "(unnamed)");
		options = { ...options, name };

		let result;
		if (this._testFn !== undefined) {
			if (!this._isSkipped(parentMark)) {
				result = await runTestAsync(this);
			}
			else {
				result = TestResult.skip(name, { filename: options.filename, mark: this._mark });
			}
		}
		else {
			if (this._mark !== TestMark.only) {
				result = TestResult.skip(name, { filename: options.filename, mark: TestMark.skip });
			}
			else {
				result = TestResult.fail(
					name,
					"Test is marked '.only', but it has no body",
					{
						renderError: options.renderError,
						filename: options.filename,
						mark: this._mark,
					}
				);
			}
		}

		options.onTestCaseResult(result);
		return result;

		async function runTestAsync(self: TestCase): Promise<TestCaseResult> {
			const beforeResult = await runBeforeOrAfterFnsAsync(options.name, beforeEachFns, self._mark, options);
			if (!isSuccess(beforeResult)) return beforeResult;

			const itResult = await runTestFnAsync(options.name, self._testFn!, self._mark, self._timeout, options);
			const afterResult = await runBeforeOrAfterFnsAsync(options.name, afterEachFns, self._mark, options);

			if (!isSuccess(itResult)) return itResult;
			else return afterResult;
		}
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


async function runBeforeOrAfterFnsAsync(
	name: string[],
	beforeAfterArray: BeforeAfterDefinition[],
	mark: TestMarkValue,
	options: RecursiveRunOptions,
): Promise<TestCaseResult> {
	for await (const beforeAfter of beforeAfterArray) {
		const result = await runTestFnAsync(name, beforeAfter.fnAsync, mark, beforeAfter.options.timeout, options);
		if (!isSuccess(result)) return result;
	}
	return TestResult.pass(name, { filename: options.filename, mark });
}

async function runTestFnAsync(
	name: string[],
	fn: ItFn,
	mark: TestMarkValue,
	testTimeout: Milliseconds | undefined,
	{ clock, filename, timeout, config, renderError }: RecursiveRunOptions,
): Promise<TestCaseResult> {
	const getConfig = <T>(name: string) => {
		if (config[name] === undefined) throw new Error(`No test config found for name '${name}'`);
		return config[name] as T;
	};

	timeout = testTimeout ?? timeout;

	return await clock.timeoutAsync(timeout, async () => {
		try {
			await fn({ getConfig });
			return TestResult.pass(name, { filename, mark });
		}
		catch (err) {
			return TestResult.fail(name, err, { filename, mark, renderError });
		}
	}, async () => {
		return await TestResult.timeout(name, timeout, { filename, mark });
	});
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
