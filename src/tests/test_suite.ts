// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."

import * as ensure from "../util/ensure.js";
import { Clock } from "../infrastructure/clock.js";
import { TestCaseResult, TestResult, TestStatus, TestSuiteResult } from "./test_result.js";
import path from "node:path";

// A simple but full-featured test runner. It allows me to get away from Mocha's idiosyncracies and have
// more control over test execution, while also shielding me from dependency churn.


const DEFAULT_TIMEOUT_IN_MS = 2000;

export const TestMark = {
	none: "none",
	skip: "skip",
	only: "only",
};

export type TestMarkValue = typeof TestMark[keyof typeof TestMark];

interface Describe {
	(optionalName?: string | DescribeFunction, describeFn?: DescribeFunction): TestSuite,
	skip: (optionalName?: string | DescribeFunction, descrbeFn?: DescribeFunction) => TestSuite,
	only: (optionalName?: string | DescribeFunction, describeFn?: DescribeFunction) => TestSuite,
}

interface It {
	(name: string, itFn?: ItFn): void;
	skip: (name: string, itFn?: ItFn) => void,
	only: (name: string, itFn?: ItFn) => void,
}

type BeforeAfter = (fn: Test) => void;

export interface SuiteParameters {
	describe: Describe,
	it: It,
	beforeAll: BeforeAfter,
	afterAll: BeforeAfter,
	beforeEach: BeforeAfter,
	afterEach: BeforeAfter,
	setTimeout: (newTimeout: Milliseconds) => void,
}

export interface TestParameters {
	getConfig: <T>(name: string) => T,
}

export type DescribeFunction = (suiteUtilities: SuiteParameters) => void;
export type Test = (testUtilities: TestParameters) => Promise<void> | void;
export type ItFn = Test;
export type BeforeAfterFn = Test;
type Milliseconds = number;

export interface TestConfig {
	[name: string]: unknown,
}

interface RecursiveRunOptions {
	name: string[];
	filename?: string;
	clock: Clock,
	notifyFn: (result: TestResult) => void,
	timeout: Milliseconds,
	config: TestConfig,
}


interface Runnable {
	_recursiveRunAsync: (
		parentMark: TestMarkValue,
		parentBeforeEachFns: Test[],
		parentAfterEachFns: Test[],
		options: RecursiveRunOptions,
	) => Promise<TestResult> | TestResult;
	_isDotOnly: () => boolean,
	_isSkipped: (mark: TestMarkValue) => boolean,
}

/**
 * A simple but full-featured test runner. It's notable for not using globals.
 */
export class TestSuite implements Runnable {

	static get DEFAULT_TIMEOUT_IN_MS() {
		return DEFAULT_TIMEOUT_IN_MS;
	}

	/**
	 * @returns {function} A function for creating a test suite. In your test module, call this function and export the
	 *   result.
	 */
	static get create(): Describe {
		const result: Describe = (optionalName, suiteFn) => this.#create(optionalName, suiteFn, TestMark.none);
		result.skip = (optionalName, suiteFn) => this.#create(optionalName, suiteFn, TestMark.skip);
		result.only = (optionalName, suiteFn) => this.#create(optionalName, suiteFn, TestMark.only);
		return result;
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
			const errorName = `error when requiring ${path.basename(filename)}`;
			try {
				const { default: suite } = await import(filename);
				if (suite instanceof TestSuite) {
					suite._setFilename(filename);
					return suite;
				}
				else {
					return createFailure(errorName, `doesn't export a test suite: ${filename}`, filename);
				}
			}
			catch(err) {
				return createFailure(errorName, err, filename);
			}
		}

		function createFailure(name: string, error: unknown, filename?: string) {
			return new TestSuite("", TestMark.none, { tests: [ new FailureTestCase(name, error, filename) ] });
		}
	}

	static #create(
		nameOrSuiteFn: string | DescribeFunction | undefined,
		possibleSuiteFn: DescribeFunction | undefined,
		mark: TestMarkValue,
	): TestSuite {
		ensure.signature(arguments, [ [ undefined, String, Function ], [ undefined, Function ], String ]);

		let name: string;
		let suiteFn: DescribeFunction | undefined;

		if (nameOrSuiteFn instanceof Function || (nameOrSuiteFn === undefined && possibleSuiteFn === undefined)) {
			name = "";
			suiteFn = nameOrSuiteFn;
		}
		else {
			name = nameOrSuiteFn ?? "";
			suiteFn = possibleSuiteFn;
		}

		if (suiteFn !== undefined) {
			return this.#runDescribeFunction(suiteFn, name, mark);
		}
		else if (mark === TestMark.only) {
			return new TestSuite(name, mark, {
				tests: [ new FailureTestCase(name, "Test suite is marked '.only', but has no body") ],
			});
		}
		else {
			return new TestSuite(name, TestMark.skip, {});
		}
	}

	static #runDescribeFunction(
		describeFn: DescribeFunction,
		name: string,
		mark: string,
	): TestSuite {
		const tests: Runnable[] = [];
		const beforeAllFns: Test[] = [];
		const afterAllFns: Test[] = [];
		const beforeEachFns: Test[] = [];
		const afterEachFns: Test[] = [];
		let timeout: number | undefined;

		const pushTest = <T extends Runnable>(test: T): T => {
			tests.push(test);
			return test;
		};

		const result: Describe = (optionalName, suiteFn) => this.#create(optionalName, suiteFn, TestMark.none);
		result.skip = (optionalName, suiteFn) => this.#create(optionalName, suiteFn, TestMark.skip);
		result.only = (optionalName, suiteFn) => this.#create(optionalName, suiteFn, TestMark.only);

		const describe: Describe = (optionalName, suiteFn) => pushTest(TestSuite.#create(optionalName, suiteFn, TestMark.none));
		describe.skip = (optionalName, describeFn) => pushTest(TestSuite.#create(optionalName, describeFn, TestMark.skip));
		describe.only = (optionalName, suiteFn) => pushTest(TestSuite.#create(optionalName, suiteFn, TestMark.only));

		const it: It = (name, testCaseFn) => pushTest(new TestCase(name, testCaseFn, TestMark.none));
		it.skip = (name, testCaseFn) => pushTest(new TestCase(name, testCaseFn, TestMark.skip));
		it.only = (name, testCaseFn) => pushTest(new TestCase(name, testCaseFn, TestMark.only));

		describeFn({
			describe,
			it,
			beforeAll: (fnAsync) => { beforeAllFns.push(fnAsync); },
			afterAll: (fnAsync) => { afterAllFns.push(fnAsync); },
			beforeEach: (fnAsync) => { beforeEachFns.push(fnAsync); },
			afterEach: (fnAsync) => { afterEachFns.push(fnAsync); },
			setTimeout: (newTimeout) => { timeout = newTimeout; },
		});

		return new TestSuite(name, mark, { tests, beforeAllFns, afterAllFns, beforeEachFns, afterEachFns, timeout });
	}

	private _name: string;
	private _mark: TestMarkValue;
	private _tests: Runnable[];
	private _hasDotOnlyChildren: boolean;
	private _allChildrenSkipped: boolean;
	private _beforeAllFns: BeforeAfterFn[];
	private _afterAllFns: BeforeAfterFn[];
	private _beforeEachFns: BeforeAfterFn[];
	private _afterEachFns: BeforeAfterFn[];
	private _timeout?: Milliseconds;
	private _filename?: string;

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
		beforeAllFns?: BeforeAfterFn[],
		afterAllFns?: BeforeAfterFn[],
		beforeEachFns?: BeforeAfterFn[],
		afterEachFns?: BeforeAfterFn[],
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
	 * @param {object} [config={}] Configuration data to provide to tests.
	 * @param {(result: TestResult) => ()} [notifyFn] A function to call each time a test completes. The `result`
	 *   parameter describes the result of the test—whether it passed, failed, etc.
	 * @param {Clock} [clock] The clock to use. Meant for internal use.
	 * @returns {Promise<TestSuiteResult>} The results of the test suite.
	 */
	async runAsync({
		config = {},
		notifyFn = () => {},
		clock = Clock.create(),
	}: {
		config?: TestConfig,
		notifyFn?: (result: TestResult) => void,
		clock?: Clock,
	} = {}): Promise<TestSuiteResult> {
		ensure.signature(arguments, [[ undefined, {
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
			timeout: this._timeout ?? DEFAULT_TIMEOUT_IN_MS,
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
		parentBeforeEachFns: Test[],
		parentAfterEachFns: Test[],
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
	private _testFn?: ItFn;
	private _mark: TestMarkValue;

	constructor(name: string, testFn: ItFn | undefined, mark: TestMarkValue) {
		ensure.signature(arguments, [ String, [ undefined, Function ], String ]);

		this._name = name;
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
		beforeEachFns: Test[],
		afterEachFns: Test[],
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

			const itResult = await runTestFnAsync(options.name, self._testFn!, self._mark, options);
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
		super(name, undefined, TestMark.none);

		this._filename = filename;
		this._error = error;
	}

	override async _recursiveRunAsync(
		parentMark: TestMarkValue,
		beforeEachFns: Test[],
		afterEachFns: Test[],
		options: RecursiveRunOptions,
	): Promise<TestCaseResult> {
		return await TestResult.fail([ this._name ], this._error, this._filename);
	}

}


async function runBeforeOrAfterFnsAsync(
	name: string[],
	fns: Test[],
	mark: TestMarkValue,
	options: RecursiveRunOptions,
): Promise<TestCaseResult> {
	for await (const fn of fns) {
		const result = await runTestFnAsync(name, fn, mark, options);
		if (!isSuccess(result)) return result;
	}
	return TestResult.pass(name, options.filename, mark);
}

async function runTestFnAsync(
	name: string[],
	fn: Test,
	mark: TestMarkValue,
	{ clock, filename, timeout, config }: RecursiveRunOptions,
): Promise<TestCaseResult> {
	const getConfig = <T>(name: string) => {
		if (config[name] === undefined) throw new Error(`No test config found for name '${name}'`);
		return config[name] as T;
	};

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
