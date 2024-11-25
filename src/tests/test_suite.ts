// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."

import * as ensure from "../util/ensure.js";
import { Clock } from "../infrastructure/clock.js";
import { TestCaseResult, TestMark, TestMarkValue, TestResult, TestStatus, TestSuiteResult } from "./test_result.js";
import path from "node:path";

// A simple but full-featured test runner. It allows me to get away from Mocha's idiosyncracies and have
// more control over test execution, while also shielding me from dependency churn.


const DEFAULT_TIMEOUT_IN_MS = 2000;

export interface TestConfig {
	[name: string]: unknown,
}

export interface TestOptions {
	timeout?: Milliseconds,
	config?: TestConfig,
	notifyFn?: NotifyFn,
	clock?: Clock,
}

export interface DescribeOptions {
	timeout?: number,
}

export interface ItOptions {
	timeout?: number,
}

export type NotifyFn = (testResult: TestCaseResult) => void;

interface Describe {
	(
		optionalName?: string | DescribeOptions | DescribeFn,
		optionalOptions?: DescribeOptions | DescribeFn,
		describeFn?: DescribeFn
	): TestSuite,
	skip: (
		optionalName?: string | DescribeOptions | DescribeFn,
		optionalOptions?: DescribeOptions | DescribeFn,
		descrbeFn?: DescribeFn
	) => TestSuite,
	only: (
		optionalName?: string | DescribeOptions | DescribeFn,
		optionalOptions?: DescribeOptions | DescribeFn,
		describeFn?: DescribeFn
	) => TestSuite,
}
type DescribeFn = () => void;

interface It {
	(name: string, optionalOptions?: ItOptions | ItFn, itFn?: ItFn): void;
	skip: (name: string, optionalOptions?: ItOptions | ItFn, itFn?: ItFn) => void,
	only: (name: string, optionalOptions?: ItOptions | ItFn, itFn?: ItFn) => void,
}
type ItFn = (testUtilities: TestParameters) => Promise<void> | void;

type BeforeAfter = (fn: ItFn) => void;

type BeforeAfterDefinition = { options: ItOptions, fnAsync: ItFn };

interface TestParameters {
	getConfig: <T>(key: string) => T,
}

type Milliseconds = number;

interface RecursiveRunOptions {
	name: string[];
	filename?: string;
	clock: Clock,
	notifyFn: NotifyFn,
	timeout: Milliseconds,
	config: TestConfig,
}

interface Runnable {
	_recursiveRunAsync: (
		parentMark: TestMarkValue,
		parentBeforeEachFns: BeforeAfterDefinition[],
		parentAfterEachFns: BeforeAfterDefinition[],
		options: RecursiveRunOptions,
	) => Promise<TestResult> | TestResult;
	_isDotOnly: () => boolean,
	_isSkipped: (mark: TestMarkValue) => boolean,
}

interface TestContext {
	describe: Describe,
	it: It,
	beforeAll: BeforeAfter,
	afterAll: BeforeAfter,
	beforeEach: BeforeAfter,
	afterEach: BeforeAfter,
}

const testContext: TestContext[] = [];

/**
 * A simple but full-featured test runner. It's notable for not using globals.
 */
export class TestSuite implements Runnable {

	private _name: string;
	private _mark: TestMarkValue;
	private _tests: Runnable[];
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

	/** @private */
	static _create(
		nameOrOptionsOrSuiteFn: string | DescribeOptions | DescribeFn | undefined,
		optionsOrSuiteFn: DescribeOptions | DescribeFn | undefined,
		possibleSuiteFn: DescribeFn | undefined,
		mark: TestMarkValue,
	): TestSuite {
		const DescribeOptionsType = { timeout: Number };
		ensure.signature(arguments, [
			[ undefined, DescribeOptionsType, String, Function ],
			[ undefined, DescribeOptionsType, Function ],
			[ undefined, Function ],
			String
		]);

		const { name, options, suiteFn } = decipherOverloadedParameters();

		if (suiteFn !== undefined) {
			return this.#runDescribeFunction(suiteFn, name, mark, options.timeout);
		}
		else if (mark === TestMark.only) {
			return new TestSuite(name, mark, {
				tests: [ new FailureTestCase(name, "Test suite is marked '.only', but has no body") ],
			});
		}
		else {
			return new TestSuite(name, TestMark.skip, { timeout: options.timeout });
		}

		function decipherOverloadedParameters() {
			let name: string;
			let options: DescribeOptions | undefined;
			let suiteFn: DescribeFn | undefined;

			switch (typeof nameOrOptionsOrSuiteFn) {
				case "string":
					name = nameOrOptionsOrSuiteFn;
					break;
				case "object":
					options = nameOrOptionsOrSuiteFn;
					break;
				case "function":
					suiteFn = nameOrOptionsOrSuiteFn;
					break;
				case "undefined":
					break;
				default:
					ensure.unreachable(`Unknown typeof for nameOrOptionsOrSuiteFn: ${typeof nameOrOptionsOrSuiteFn}`);
			}
			switch (typeof optionsOrSuiteFn) {
				case "object":
					ensure.that(options === undefined, "Received two options parameters");
					options = optionsOrSuiteFn;
					break;
				case "function":
					ensure.that(suiteFn === undefined, "Received two suite function parameters");
					suiteFn = optionsOrSuiteFn;
					break;
				case "undefined":
					break;
				default:
					ensure.unreachable(`Unknown typeof for optionsOrSuiteFn: ${typeof optionsOrSuiteFn}`);
			}
			if (possibleSuiteFn !== undefined) {
				ensure.that(suiteFn === undefined, "Received two suite function parameters");
				suiteFn = possibleSuiteFn;
			}

			name ??= "";
			options ??= {};

			return { name, options, suiteFn };
		}
	}

	static #runDescribeFunction(
		describeFn: DescribeFn,
		name: string,
		mark: TestMarkValue,
		timeout?: Milliseconds,
	): TestSuite {
		const tests: Runnable[] = [];
		const beforeAllFns: BeforeAfterDefinition[] = [];
		const afterAllFns: BeforeAfterDefinition[] = [];
		const beforeEachFns: BeforeAfterDefinition[] = [];
		const afterEachFns: BeforeAfterDefinition[] = [];

		const pushTest = <T extends Runnable>(test: T): T => {
			tests.push(test);
			return test;
		};

		const result: Describe = (optionalName, optionalOptions, fn) => this._create(optionalName, optionalOptions, fn, TestMark.none);
		result.skip = (optionalName, optionalOptions, fn) => this._create(optionalName, optionalOptions, fn, TestMark.skip);
		result.only = (optionalName, optionalOptions, fn) => this._create(optionalName, optionalOptions, fn, TestMark.only);

		const describe: Describe = (optionalName, optionalOptions, fn) => pushTest(TestSuite._create(optionalName, optionalOptions, fn, TestMark.none));
		describe.skip = (optionalName, optionalOptions, fn) => pushTest(TestSuite._create(optionalName, optionalOptions, fn, TestMark.skip));
		describe.only = (optionalName, optionalOptions, fn) => pushTest(TestSuite._create(optionalName, optionalOptions, fn, TestMark.only));

		const it: It = (name, optionalOptions, testCaseFn) => pushTest(new TestCase(name, optionalOptions, testCaseFn, TestMark.none));
		it.skip = (name, optionalOptions, testCaseFn) => pushTest(new TestCase(name, optionalOptions, testCaseFn, TestMark.skip));
		it.only = (name, optionalOptions, testCaseFn) => pushTest(new TestCase(name, optionalOptions, testCaseFn, TestMark.only));

		testContext.push({
			describe,
			it,
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

	/** Internal use only. (Use {@link TestSuite.create} or {@link TestSuite.fromModulesAsync} instead.) */
	constructor(name: string, mark: TestMarkValue, {
		tests = [],
		beforeAllFns = [],
		afterAllFns = [],
		beforeEachFns = [],
		afterEachFns = [],
		timeout,
	}: {
		tests?: Runnable[],
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
	 * @param {(result: TestResult) => ()} [notifyFn] A function to call each time a test completes. The `result`
	 *   parameter describes the result of the test—whether it passed, failed, etc.
	 * @param {Clock} [clock] The clock to use. Meant for internal use.
	 * @returns {Promise<TestSuiteResult>} The results of the test suite.
	 */
	async runAsync({
		timeout = DEFAULT_TIMEOUT_IN_MS,
		config = {},
		notifyFn = () => {},
		clock = Clock.create(),
	}: TestOptions = {}): Promise<TestSuiteResult> {
		ensure.signature(arguments, [[ undefined, {
			timeout: [ undefined, Number ],
			config: [ undefined, Object ],
			notifyFn: [ undefined, Function ],
			clock: [ undefined, Clock ],
		}]]);

		return await this._recursiveRunAsync(TestMark.only, [], [], {
			clock,
			config,
			notifyFn,
			name: [],
			filename: this._filename,
			timeout: this._timeout ?? timeout ?? DEFAULT_TIMEOUT_IN_MS,
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
			if (!isSuccess(beforeResult)) return TestResult.suite(options.name, [ beforeResult ], options.filename, this._mark);
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

		return TestResult.suite(options.name, results, options.filename, this._mark);
	}

}


class TestCase implements Runnable {

	protected _name: string;
	private _timeout?: Milliseconds;
	private _testFn?: ItFn;
	private _mark: TestMarkValue;

	constructor(
		name: string,
		optionsOrTestFn: TestOptions | ItFn | undefined,
		possibleTestFn: ItFn | undefined,
		mark: TestMarkValue
	) {
		ensure.signature(arguments, [
			String,
			[ undefined, { timeout: [ undefined, Number ]}, Function ],
			[ undefined, Function ],
			String
		]);

		this._name = name;

		switch (typeof optionsOrTestFn) {
			case "object":
				this._timeout = optionsOrTestFn.timeout;
				break;
			case "function":
				this._testFn = optionsOrTestFn;
				break;
			case "undefined":
				break;
			default:
				ensure.unreachable(`Unknown typeof optionsOrTestFn: ${typeof optionsOrTestFn}`);
		}
		if (possibleTestFn !== undefined) {
			ensure.that(this._testFn === undefined, "Received two test function parameters");
			this._testFn = possibleTestFn;
		}

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
				result = TestResult.skip(name, options.filename, this._mark);
			}
		}
		else {
			if (this._mark !== TestMark.only) {
				result = TestResult.skip(name, options.filename, TestMark.skip);
			}
			else {
				result = TestResult.fail(name, "Test is marked '.only', but it has no body", options.filename, this._mark);
			}
		}

		options.notifyFn(result);
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
		const result = TestResult.fail([ this._name ], this._error, this._filename);
		options.notifyFn(result);
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
		const result = await runTestFnAsync(name, beforeAfter.fnAsync, mark, undefined, options);
		if (!isSuccess(result)) return result;
	}
	return TestResult.pass(name, options.filename, mark);
}

async function runTestFnAsync(
	name: string[],
	fn: ItFn,
	mark: TestMarkValue,
	testTimeout: Milliseconds | undefined,
	{ clock, filename, timeout, config }: RecursiveRunOptions,
): Promise<TestCaseResult> {
	const getConfig = <T>(name: string) => {
		if (config[name] === undefined) throw new Error(`No test config found for name '${name}'`);
		return config[name] as T;
	};

	timeout = testTimeout ?? timeout;

	return await clock.timeoutAsync(timeout, async () => {
		try {
			await fn({ getConfig });
			return TestResult.pass(name, filename, mark);
		}
		catch (err) {
			return TestResult.fail(name, err, filename, mark);
		}
	}, async () => {
		return await TestResult.timeout(name, timeout, filename, mark);
	});
}

function isSuccess(result: TestCaseResult) {
	return result.status === TestStatus.pass || result.status === TestStatus.skip;
}


function startTest(
	optionalName: string | DescribeOptions | DescribeFn | undefined,
	optionalOptions: DescribeOptions | DescribeFn | undefined,
	fn: DescribeFn | undefined,
	mark: TestMarkValue,
): TestSuite {
	ensure.that(testContext.length === 0, "test() is not re-entrant [don't run test() inside of test()]");

	try {
		return TestSuite._create(optionalName, optionalOptions, fn, mark);
	}
	finally {
		ensure.that(testContext.length === 0, "test() didn't clear its context; must be an error in ergotest");
	}
}

/**
 * Creates a top-level test suite. In your test module, call this function and `export default` the result. Add `.skip`
 * to skip this test suite and `.only` to only run this test suite.
 * @param {string} [optionalName] The name of the test suite. You can skip this parameter and pass
 *   {@link optionalOptions} or {@link fn} instead.
 * @param {DescribeOptions} [optionalOptions] The test suite options. You can skip this parameter and pass {@link fn}
 *   instead.
 * @param {function} [fn] The body of the test suite. In the body, call {@link describe}, {@link it}, {@link
 *   beforeAll}, {@link afterAll}, {@link beforeEach}, and {@link afterEach} to define the tests in the suite. If
 *   undefined, this test suite will be skipped.
 * @returns {TestSuite} The test suite. You’ll typically `export default` the return value rather than using it
 *   directly.
 */
export function test(
	optionalName?: string | DescribeOptions | DescribeFn,
	optionalOptions?: DescribeOptions | DescribeFn,
	fn?: DescribeFn,
): TestSuite {
	return startTest(optionalName, optionalOptions, fn, TestMark.none);
}

test.skip = function(
	optionalName?: string | DescribeOptions | DescribeFn,
	optionalOptions?: DescribeOptions | DescribeFn,
	fn?: DescribeFn,
): TestSuite {
	return startTest(optionalName, optionalOptions, fn, TestMark.skip);
};

test.only = function(
	optionalName?: string | DescribeOptions | DescribeFn,
	optionalOptions?: DescribeOptions | DescribeFn,
	fn?: DescribeFn,
): TestSuite {
	return startTest(optionalName, optionalOptions, fn, TestMark.only);
};

/**
 * Adds a nested test suite to the current test suite. Must be run inside of a {@link test} or {@link describe}
 * function. Add `.skip` to skip this test suite and `.only` to only run this test suite.
 * @param {string} [optionalName] The name of the test suite. You can skip this parameter and pass
 *   {@link optionalOptions} or {@link fn} instead.
 * @param {DescribeOptions} [optionalOptions] The test suite options. You can skip this parameter and pass {@link fn}
 *   instead.
 * @param {function} [fn] The body of the test suite. In the body, call {@link describe}, {@link it}, {@link
 *   beforeAll}, {@link afterAll}, {@link beforeEach}, and {@link afterEach} to define the tests in the suite. If
 *   undefined, this test suite will be skipped.
 * @returns {TestSuite} The test suite. You’ll typically ignore the return value.
 */
export function describe(
	optionalName?: string | DescribeOptions | DescribeFn,
	optionalOptions?: DescribeOptions | DescribeFn,
	fn?: DescribeFn,
) {
	currentContext("describe").describe(optionalName, optionalOptions, fn);
}

describe.skip = function(
	optionalName?: string | DescribeOptions | DescribeFn,
	optionalOptions?: DescribeOptions | DescribeFn,
	fn?: DescribeFn,
) {
	currentContext("describe").describe.skip(optionalName, optionalOptions, fn);
};

describe.only = function(
	optionalName?: string | DescribeOptions | DescribeFn,
	optionalOptions?: DescribeOptions | DescribeFn,
	fn?: DescribeFn,
) {
	currentContext("describe").describe.only(optionalName, optionalOptions, fn);
};

/**
 * Adds a test to the current test suite. Must be run inside of a {@link test} or {@link describe} function. Add
 * `.skip` to skip this test and `.only` to only run this test.
 * @param {string} name The name of the test.
 * @param {ItOptions} [optionalOptions] The test options. You can skip this parameter and pass {@link fnAsync} instead.
 * @param {function} [fnAsync] The body of the test. May be synchronous or asynchronous. If undefined, this test will be
 *   skipped.
 */
export function it(name: string, optionalOptions: ItOptions | ItFn, fnAsync?: ItFn) {
	currentContext("it").it(name, optionalOptions, fnAsync);
}

it.skip = function it(name: string, optionalOptions: ItOptions | ItFn, fnAsync?: ItFn) {
	currentContext("it").it.skip(name, optionalOptions, fnAsync);
};

it.only = function it(name: string, optionalOptions: ItOptions | ItFn, fnAsync?: ItFn) {
	currentContext("it").it.only(name, optionalOptions, fnAsync);
};

/**
 * Adds a function to run before all the tests in the current test suite. Must be run inside of a {@link test} or
 * {@link describe} function.
 * @param {function} [fnAsync] The function to run. May be synchronous or asynchronous.
 */
export function beforeAll(fnAsync: ItFn) {
	currentContext("beforeAll").beforeAll(fnAsync);
}

/**
 * Adds a function to run after all the tests in the current test suite. Must be run inside of a {@link test} or
 * {@link describe} function.
 * @param {function} [fnAsync] The function to run. May be synchronous or asynchronous.
 */
export function afterAll(fnAsync: ItFn) {
	currentContext("afterAll").afterAll(fnAsync);
}

/**
 * Adds a function to run bfeore each of the tests in the current test suite. Must be run inside of a {@link test} or
 * {@link describe} function.
 * @param {function} [fnAsync] The function to run. May be synchronous or asynchronous.
 */
export function beforeEach(fnAsync: ItFn) {
	currentContext("beforeEach").beforeEach(fnAsync);
}

/**
 * Adds a function to run after each of the tests in the current test suite. Must be run inside of a {@link test} or
 * {@link describe} function.
 * @param {function} [fnAsync] The function to run. May be synchronous or asynchronous.
 */
export function afterEach(fnAsync: ItFn) {
	currentContext("afterEach").afterEach(fnAsync);
}

function currentContext(functionName: string) {
	ensure.that(testContext.length > 0, `${functionName}() must be run inside test()`);

	return testContext[testContext.length - 1];
}