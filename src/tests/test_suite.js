// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
"use strict";

const ensure = require("../util/ensure");
const Clock = require("../infrastructure/clock");
const TestResult = require("./test_result");
const path = require("node:path");

// A simple but full-featured test runner. It allows me to get away from Mocha's idiosyncracies and have
// more control over test execution, while also shielding me from dependency churn.


const DEFAULT_TIMEOUT_IN_MS = 2000;

const RUN_STATE = {
	DEFAULT: "default",
	SKIP: "skip",
	ONLY: "only",
};

/**
 * A simple but full-featured test runner. It's notable for not using globals.
 */
module.exports = class TestSuite {

	static get DEFAULT_TIMEOUT_IN_MS() {
		return DEFAULT_TIMEOUT_IN_MS;
	}

	/**
	 * @returns {function} A function for creating a test suite. In your test module, call this function and export the result.
	 */
	static get createFn() {
		const result = (name, suiteFn) => this.#create(name, suiteFn, RUN_STATE.DEFAULT);
		result.skip = (name, suiteFn) => this.#create(name, suiteFn, RUN_STATE.SKIP);
		result.only = (name, suiteFn) => this.#create(name, suiteFn, RUN_STATE.ONLY);
		return result;
	}

	/**
	 * Convert a list of test modules into a test suite. Each module needs to export a test suite by using {@link TestSuite.createFn}.
	 * @param moduleFilenames The filenames of the test modules.
	 * @returns {TestSuite} The test suite.
	 */
	static fromModulesAsync(moduleFilenames) {
		ensure.signature(arguments, [ Array ]);

		const suites = moduleFilenames.map(filename => loadModule(filename));
		return new TestSuite("", RUN_STATE.DEFAULT, { tests: suites });

		function loadModule(filename) {
			try {
				const suite = require(filename);
				if (suite instanceof TestSuite) {
					suite._setFilename(filename);
					return suite;
				}
				else {
					return createFailure(filename, path.basename(filename), `doesn't export a test suite: ${filename}`);
				}
			}
			catch(err) {
				console.log(err);
				return createFailure(filename, `error when requiring ${path.basename(filename)}`, err);
			}
		}

		function createFailure(filename, name, error) {
			return new TestSuite("", RUN_STATE.DEFAULT, { tests: [ new FailureTestCase(filename, name, error) ] });
		}
	}

	static #create(name, suiteFn, runState) {
		ensure.signature(arguments, [ [ undefined, String, Function ], [ undefined, Function ], String ]);
		if (name instanceof Function || (name === undefined && suiteFn === undefined)) { // allow name to be left off
			suiteFn = name;
			name = "";
		}
		if (suiteFn === undefined) return new TestSuite(name, runState, {});

		const tests = [];
		const beforeAllFns = [];
		const afterAllFns = [];
		const beforeEachFns = [];
		const afterEachFns = [];
		let timeout;

		const pushTest = (test) => {
			tests.push(test);
			return test;
		};

		const describe = (name, suiteFn) => pushTest(TestSuite.#create(name, suiteFn, RUN_STATE.DEFAULT ));
		describe.skip = (name, suiteFn) => pushTest(TestSuite.#create(name, suiteFn, RUN_STATE.SKIP));
		describe.only = (name, suiteFn) => pushTest(TestSuite.#create(name, suiteFn, RUN_STATE.ONLY));

		const it = (name, testCaseFn) => pushTest(new TestCase(name, testCaseFn, RUN_STATE.DEFAULT));
		it.skip = (name, testCaseFn) => pushTest(new TestCase(name, testCaseFn, RUN_STATE.SKIP));
		it.only = (name, testCaseFn) => pushTest(new TestCase(name, testCaseFn, RUN_STATE.ONLY));

		suiteFn({
			describe,
			it,
			beforeAll: (fnAsync) => { beforeAllFns.push(fnAsync); },
			afterAll: (fnAsync) => { afterAllFns.push(fnAsync); },
			beforeEach: (fnAsync) => { beforeEachFns.push(fnAsync); },
			afterEach: (fnAsync) => { afterEachFns.push(fnAsync); },
			setTimeout: (newTimeout) => { timeout = newTimeout; }
		});

		return new TestSuite(name, runState, { tests, beforeAllFns, afterAllFns, beforeEachFns, afterEachFns, timeout });
	}

	/** Only for use by TestSuite's tests. (Use {@link TestSuite.createFn} or {@link TestSuite.fromModulesAsync} instead.) */
	constructor(name, runState, {
		tests = [],
		beforeAllFns = [],
		afterAllFns = [],
		beforeEachFns = [],
		afterEachFns = [],
		timeout,
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
	 * @param {object} [config] Configuration data to provide to tests.
	 * @param {Clock} [clock] The clock to use. Meant for internal use.
	 * @param {(result: TestResult) => ()} [notifyFn] A function to call each time a test completes. The `result` parameter describes the result of the test—whether it passed, failed, etc.
	 * @returns {Promise<TestSuiteResult>} The results of the test suite.
	 */
	async runAsync({
		config,
		clock = Clock.create(),
		notifyFn = () => {},
	} = {}) {
		ensure.signature(arguments, [[ undefined, {
			config: [ undefined, Object ],
			clock: [ undefined, Clock ],
			notifyFn: [ undefined, Function ],
		}]]);

		return await this._recursiveRunAsync(RUN_STATE.ONLY, [], [], {
			clock,
			config,
			notifyFn,
			name: [],
			filename: this._filename,
			timeout: this._timeout
		});
	}

	/** @private */
	_setFilename(filename) { this._filename = filename; }

	/** @private */
	_isDotOnly() {
		return this._runState === RUN_STATE.ONLY || this._hasDotOnlyChildren;
	}

	/** @private */
	_isSkipped() {
		return this._allChildrenSkipped;
	}

	/** @private */
	async _recursiveRunAsync(parentRunState, parentBeforeEachFns, parentAfterEachFns, options) {
		const name = [ ...options.name ];
		if (this._name !== "") name.push(this._name);
		const filename = this._filename ?? options.filename;
		const timeout = this._timeout ?? options.timeout ?? DEFAULT_TIMEOUT_IN_MS;
		options = { ...options, name, filename, timeout };

		let myRunState = this._runState;
		if (myRunState === RUN_STATE.DEFAULT) myRunState = parentRunState;
		if (myRunState === RUN_STATE.ONLY && this._hasDotOnlyChildren) myRunState = RUN_STATE.SKIP;

		const beforeEachFns = [ ...parentBeforeEachFns, ...this._beforeEachFns ];
		const afterEachFns = [ ...this._afterEachFns, ...parentAfterEachFns ];

		if (!this._allChildrenSkipped) {
			const beforeResult = await runBeforeOrAfterFnsAsync("beforeAll()", this._beforeAllFns, options);
			if (!beforeResult.isSuccess()) return TestResult.suite(options.name, [ beforeResult ], options.filename);
		}

		const results = [];
		for await (const test of this._tests) {
			results.push(await test._recursiveRunAsync(myRunState, beforeEachFns, afterEachFns, options));
		}

		if (!this._allChildrenSkipped) {
			const afterResult = await runBeforeOrAfterFnsAsync("afterAll()", this._afterAllFns, options);
			if (!afterResult.isSuccess()) results.push(afterResult);
		}

		return TestResult.suite(options.name, results, options.filename);
	}

};


class TestCase {

	static get RUN_STATE() {
		return RUN_STATE;
	}

	constructor(name, testFn, runState) {
		ensure.signature(arguments, [ String, [ undefined, Function ], String ]);

		this._name = name;
		this._testFn = testFn;
		this._runState = runState;
	}

	/** @private */
	_isDotOnly() {
		ensure.signature(arguments, []);
		return this._runState === RUN_STATE.ONLY;
	}

	/** @private */
	_isSkipped(parentRunState) {
		const myRunState = this._runState === RUN_STATE.DEFAULT ? parentRunState : this._runState;

		return myRunState === RUN_STATE.SKIP || this._testFn === undefined;
	}

	/** @private */
	async _recursiveRunAsync(parentRunState, beforeEachFns, afterEachFns, options) {
		const name = [ ...options.name ];
		name.push(this._name !== "" ? this._name : "(unnamed)");
		options = { ...options, name };

		const result = this._isSkipped(parentRunState)
			? TestResult.skip(options.name, options.filename)
			: await runTestAsync(this);

		options.notifyFn(result);
		return result;

		async function runTestAsync(self) {
			const beforeResult = await runBeforeOrAfterFnsAsync(options.name, beforeEachFns, options);
			if (!beforeResult.isSuccess()) return beforeResult;

			const itResult = await runTestFnAsync(options.name, self._testFn, options);
			const afterResult = await runBeforeOrAfterFnsAsync(options.name, afterEachFns, options);

			if (!itResult.isSuccess()) return itResult;
			else return afterResult;
		}
	}
}


class FailureTestCase extends TestCase {

	constructor(filename, name, error) {
		super(name, undefined, RUN_STATE.DEFAULT);
		this._filename = filename;
		this._error = error;
	}

	/** @private */
	_recursiveRunAsync() {
		return TestResult.fail([ this._name ], this._error, this._filename);
	}

}


async function runBeforeOrAfterFnsAsync(name, fns, options) {
	for await (const fn of fns) {
		const result = await runTestFnAsync(name, fn, options);
		if (!result.isSuccess()) return result;
	}
	return TestResult.pass(name, options.filename);
}

async function runTestFnAsync(name, fn, { clock, filename, timeout, config }) {
	const getConfig = (name) => {
		if (config?.[name] === undefined) throw new Error(`No test config found for name '${name}'`);
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
	}, () => {
		return TestResult.timeout(name, timeout, filename);
	});
}
