// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."

import * as ensure from "../util/ensure.js";
import { Clock } from "../infrastructure/clock.js";
import { TestResult } from "./test_result.js";
import path from "node:path";

// A simple but full-featured test runner. It allows me to get away from Mocha's idiosyncracies and have
// more control over test execution, while also shielding me from dependency churn.


const DEFAULT_TIMEOUT_IN_MS = 2000;

const RUN_STATE = {
	DEFAULT: "default",
	SKIP: "skip",
	ONLY: "only",
};

type RunState = typeof RUN_STATE[keyof typeof RUN_STATE];

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
	getConfig: (name: string) => unknown,
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
		parentRunState: RunState,
		parentBeforeEachFns: Test[],
		parentAfterEachFns: Test[],
		options: RecursiveRunOptions,
	) => Promise<TestResult> | TestResult;
	_isDotOnly: () => boolean,
	_isSkipped: (runState: RunState) => boolean,
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
	static get createFn(): Describe {
		const result: Describe = (optionalName, suiteFn) => this.#create(optionalName, suiteFn, RUN_STATE.DEFAULT);
		result.skip = (optionalName, suiteFn) => this.#create(optionalName, suiteFn, RUN_STATE.SKIP);
		result.only = (optionalName, suiteFn) => this.#create(optionalName, suiteFn, RUN_STATE.ONLY);
		return result;
	}

	/**
	 * Convert a list of test modules into a test suite. Each module needs to export a test suite by using
	 * {@link TestSuite.createFn}.
	 * @param {string[]} moduleFilenames The filenames of the test modules.
	 * @returns {TestSuite} The test suite.
	 */
	static async fromModulesAsync(moduleFilenames: string[]): Promise<TestSuite> {
		ensure.signature(arguments, [ Array ]);

		const suites = await Promise.all(moduleFilenames.map(filename => loadModuleAsync(filename)));
		return new TestSuite("", RUN_STATE.DEFAULT, { tests: suites });

		async function loadModuleAsync(filename: string): Promise<TestSuite> {
			try {
				const { default: suite } = await import(filename);
				if (suite instanceof TestSuite) {
					suite._setFilename(filename);
					return suite;
				}
				else {
					return createFailure(filename, path.basename(filename), `doesn't export a test suite: ${filename}`);
				}
			}
			catch(err) {
				return createFailure(filename, `error when requiring ${path.basename(filename)}`, err);
			}
		}

		function createFailure(filename: string, name: string, error: string) {
			return new TestSuite("", RUN_STATE.DEFAULT, { tests: [ new FailureTestCase(filename, name, error) ] });
		}
	}

	static #create(
		nameOrSuiteFn: string | DescribeFunction | undefined,
		possibleSuiteFn: DescribeFunction | undefined,
		runState: RunState,
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

		if (suiteFn === undefined) return new TestSuite(name, runState, {});
		else return this.#runDescribeFunction(suiteFn, name, runState);
	}

	static #runDescribeFunction(
		describeFn: DescribeFunction,
		name: string,
		runState: string,
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

		const result: Describe = (optionalName, suiteFn) => this.#create(optionalName, suiteFn, RUN_STATE.DEFAULT);
		result.skip = (optionalName, suiteFn) => this.#create(optionalName, suiteFn, RUN_STATE.SKIP);
		result.only = (optionalName, suiteFn) => this.#create(optionalName, suiteFn, RUN_STATE.ONLY);

		const describe: Describe = (optionalName, suiteFn) => pushTest(TestSuite.#create(optionalName, suiteFn, RUN_STATE.DEFAULT));
		describe.skip = (optionalName, describeFn) => pushTest(TestSuite.#create(optionalName, describeFn, RUN_STATE.SKIP));
		describe.only = (optionalName, suiteFn) => pushTest(TestSuite.#create(optionalName, suiteFn, RUN_STATE.ONLY));

		const it: It = (name, testCaseFn) => pushTest(new TestCase(name, testCaseFn, RUN_STATE.DEFAULT));
		it.skip = (name, testCaseFn) => pushTest(new TestCase(name, testCaseFn, RUN_STATE.SKIP));
		it.only = (name, testCaseFn) => pushTest(new TestCase(name, testCaseFn, RUN_STATE.ONLY));

		describeFn({
			describe,
			it,
			beforeAll: (fnAsync) => { beforeAllFns.push(fnAsync); },
			afterAll: (fnAsync) => { afterAllFns.push(fnAsync); },
			beforeEach: (fnAsync) => { beforeEachFns.push(fnAsync); },
			afterEach: (fnAsync) => { afterEachFns.push(fnAsync); },
			setTimeout: (newTimeout) => { timeout = newTimeout; },
		});

		return new TestSuite(name, runState, { tests, beforeAllFns, afterAllFns, beforeEachFns, afterEachFns, timeout });
	}

	private _name: string;
	private _runState: RunState;
	private _tests: Runnable[];
	private _hasDotOnlyChildren: boolean;
	private _allChildrenSkipped: boolean;
	private _beforeAllFns: BeforeAfterFn[];
	private _afterAllFns: BeforeAfterFn[];
	private _beforeEachFns: BeforeAfterFn[];
	private _afterEachFns: BeforeAfterFn[];
	private _timeout?: Milliseconds;
	private _filename?: string;

	/** Internal use only. (Use {@link TestSuite.createFn} or {@link TestSuite.fromModulesAsync} instead.) */
	constructor(name: string, runState: RunState, {
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
		this._runState = runState;
		this._tests = tests;
		this._hasDotOnlyChildren = this._tests.some(test => test._isDotOnly());
		this._allChildrenSkipped = this._tests.every(test => test._isSkipped(this._runState));
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
	} = {}) {
		ensure.signature(arguments, [[ undefined, {
			config: [ undefined, Object ],
			notifyFn: [ undefined, Function ],
			clock: [ undefined, Clock ],
		}]]);

		return await this._recursiveRunAsync(RUN_STATE.ONLY, [], [], {
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
		return this._runState === RUN_STATE.ONLY || this._hasDotOnlyChildren;
	}

	/** @private */
	_isSkipped(): boolean {
		return this._allChildrenSkipped;
	}

	/** @private */
	async _recursiveRunAsync(
		parentRunState: RunState,
		parentBeforeEachFns: Test[],
		parentAfterEachFns: Test[],
		options: RecursiveRunOptions,
	) {
		const name = [ ...options.name ];
		if (this._name !== "") name.push(this._name);
		const filename = this._filename ?? options.filename;
		const timeout = this._timeout ?? options.timeout;
		options = { ...options, name, filename, timeout };

		let myRunState = this._runState;
		if (myRunState === RUN_STATE.DEFAULT) myRunState = parentRunState;
		if (myRunState === RUN_STATE.ONLY && this._hasDotOnlyChildren) myRunState = RUN_STATE.SKIP;

		const beforeEachFns = [ ...parentBeforeEachFns, ...this._beforeEachFns ];
		const afterEachFns = [ ...this._afterEachFns, ...parentAfterEachFns ];

		if (!this._allChildrenSkipped) {
			const beforeResult = await runBeforeOrAfterFnsAsync([ "beforeAll()" ], this._beforeAllFns, options);
			if (!beforeResult.isSuccess()) return TestResult.suite(options.name, [ beforeResult ], options.filename);
		}

		const results = [];
		for await (const test of this._tests) {
			results.push(await test._recursiveRunAsync(myRunState, beforeEachFns, afterEachFns, options));
		}

		if (!this._allChildrenSkipped) {
			const afterResult = await runBeforeOrAfterFnsAsync([ "afterAll()" ], this._afterAllFns, options);
			if (!afterResult.isSuccess()) results.push(afterResult);
		}

		return TestResult.suite(options.name, results, options.filename);
	}

}


class TestCase implements Runnable {

	static get RUN_STATE() {
		return RUN_STATE;
	}

	protected _name: string;
	private _testFn?: ItFn;
	private _runState: RunState;

	constructor(name: string, testFn: ItFn | undefined, runState: RunState) {
		ensure.signature(arguments, [ String, [ undefined, Function ], String ]);

		this._name = name;
		this._testFn = testFn;
		this._runState = runState;
	}

	/** @private */
	_isDotOnly(): boolean {
		ensure.signature(arguments, []);
		return this._runState === RUN_STATE.ONLY;
	}

	/** @private */
	_isSkipped(parentRunState: RunState): boolean {
		const myRunState = this._runState === RUN_STATE.DEFAULT ? parentRunState : this._runState;

		return myRunState === RUN_STATE.SKIP || this._testFn === undefined;
	}

	/** @private */
	async _recursiveRunAsync(
		parentRunState: RunState,
		beforeEachFns: Test[],
		afterEachFns: Test[],
		options: RecursiveRunOptions,
	): Promise<TestResult> {
		const name = [ ...options.name ];
		name.push(this._name !== "" ? this._name : "(unnamed)");
		options = { ...options, name };

		const result = this._isSkipped(parentRunState)
			? TestResult.skip(options.name, options.filename)
			: await runTestAsync(this);

		options.notifyFn(result);
		return result;

		async function runTestAsync(self: TestCase): Promise<TestResult> {
			const beforeResult = await runBeforeOrAfterFnsAsync(options.name, beforeEachFns, options);
			if (!beforeResult.isSuccess()) return beforeResult;

			const itResult = await runTestFnAsync(options.name, self._testFn!, options);
			const afterResult = await runBeforeOrAfterFnsAsync(options.name, afterEachFns, options);

			if (!itResult.isSuccess()) return itResult;
			else return afterResult;
		}
	}
}


class FailureTestCase extends TestCase {

	private _filename: string;
	private _error: string;

	constructor(filename: string, name: string, error: string) {
		super(name, undefined, RUN_STATE.DEFAULT);

		this._filename = filename;
		this._error = error;
	}

	override async _recursiveRunAsync(
		parentRunState: RunState,
		beforeEachFns: Test[],
		afterEachFns: Test[],
		options: RecursiveRunOptions,
	): Promise<TestResult> {
		return await TestResult.fail([ this._name ], this._error, this._filename);
	}

}


async function runBeforeOrAfterFnsAsync(
	name: string[],
	fns: Test[],
	options: RecursiveRunOptions,
): Promise<TestResult> {
	for await (const fn of fns) {
		const result = await runTestFnAsync(name, fn, options);
		if (!result.isSuccess()) return result;
	}
	return TestResult.pass(name, options.filename);
}

async function runTestFnAsync(
	name: string[],
	fn: Test,
	{ clock, filename, timeout, config }: RecursiveRunOptions,
): Promise<TestResult> {
	const getConfig = (name: string) => {
		if (config[name] === undefined) throw new Error(`No test config found for name '${name}'`);
		return config[name];
	};

	return await clock.timeoutAsync(timeout, async () => {
		try {
			await fn({ getConfig });
			return TestResult.pass(name, filename);
		}
		catch (err) {
			return TestResult.fail(name, err, filename);
		}
	}, async () => {
		return await TestResult.timeout(name, timeout, filename);
	});
}