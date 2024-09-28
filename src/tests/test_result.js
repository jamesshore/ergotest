// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
"use strict";

const ensure = require("../util/ensure");
const util = require("node:util");
const path = require("node:path");
const { AssertionError } = require("node:assert");
const Colors = require("../infrastructure/colors");

const headerColor = Colors.brightWhite.bold;
const highlightColor = Colors.brightWhite;
const errorMessageColor = Colors.brightRed;
const timeoutMessageColor = Colors.purple;
const expectedColor = Colors.green;
const actualColor = Colors.brightRed;
const diffColor = Colors.brightYellow.bold;

const STATUS = {
	PASS: "pass",
	FAIL: "fail",
	SKIP: "skip",
	TIMEOUT: "timeout",
};

const SUCCESS_MAP = {
	[STATUS.PASS]: true,
	[STATUS.FAIL]: false,
	[STATUS.SKIP]: true,
	[STATUS.TIMEOUT]: false,
};
const PROGRESS_RENDERING = {
	[STATUS.PASS]: Colors.white("."),
	[STATUS.FAIL]: Colors.brightRed.inverse("X"),
	[STATUS.SKIP]: Colors.cyan.dim("_"),
	[STATUS.TIMEOUT]: Colors.purple.inverse("!"),
};
const DESCRIPTION_RENDERING = {
	[STATUS.PASS]: Colors.green("passed"),
	[STATUS.FAIL]: Colors.brightRed("failed"),
	[STATUS.SKIP]: Colors.brightCyan("skipped"),
	[STATUS.TIMEOUT]: Colors.brightPurple("timeout"),
};


/**
 * The result of a test run. Can be a single test case or a suite of nested test results.
 */
const TestResult = module.exports = class TestResult {

	static get PASS() { return STATUS.PASS; }
	static get FAIL() { return STATUS.FAIL; }
	static get SKIP() { return STATUS.SKIP; }
	static get TIMEOUT() { return STATUS.TIMEOUT; }

	/**
	 * Types of test results.
	 */
	static get STATUS() {
		return STATUS;
	}

	/**
	 * Factory method. Create a TestResult for a suite of tests.
	 * @param {string|string[]} names The name of the test. Can be a list of names.
	 * @param {TestResult[]} results The nested results of this suite.
	 * @param {string} [filename] The file that contained this suite (optional).
	 * @returns {TestSuiteResult} The result.
	 */
	static suite(names, results, filename) {
		ensure.signature(arguments, [[ String, Array ], Array, [ undefined, String ]]);

		return new TestSuiteResult(names, results, filename);
	}

	/**
	 * Factory method. Create a TestResult for a test that passed.
	 * @param {string|string[]} names The name of the test. Can be a list of names.
	 * @param {string} [filename] The file that contained this test (optional).
	 * @returns {TestCaseResult} The result.
	 */
	static pass(names, filename) {
		ensure.signature(arguments, [[ String, Array ], [ undefined, String ] ]);

		return new TestCaseResult(names, STATUS.PASS, { filename });
	}

	/**
	 * Factory method. Create a TestResult for a test that failed.
	 * @param {string|string[]} names The name of the test. Can be a list of names.
	 * @param {Error|string} error The error that occurred.
	 * @param {string} [filename] The file that contained this test (optional).
	 * @returns {TestCaseResult} The result.
	 */
	static fail(names, error, filename) {
		ensure.signature(arguments, [[ String, Array ], [ String, Error ], [ undefined, String ]]);

		return new TestCaseResult(names, STATUS.FAIL, { error, filename });
	}

	/**
	 * Factory method. Create a TestResult for a test that was skipped.
	 * @param {string|string[]} names The name of the test. Can be a list of names.
	 * @param {string} [filename] The file that contained this test (optional).
	 * @returns {TestCaseResult} The result.
	 */
	static skip(names, filename) {
		ensure.signature(arguments, [[ String, Array ], [ undefined, String ] ]);

		return new TestCaseResult(names, STATUS.SKIP, { filename });
	}

	/**
	 * Factory method. Create a TestResult for a test that timed out.
	 * @param {string|string[]} names The name of the test. Can be a list of names.
	 * @param {Error|string} error The length of the timeout.
	 * @param {string} [filename] The file that contained this test (optional).
	 * @returns {TestCaseResult} The result.
	 */
	static timeout(names, timeout, filename) {
		ensure.signature(arguments, [[ String, Array ], Number, [ undefined, String ] ]);

		return new TestCaseResult(names, STATUS.TIMEOUT, { timeout, filename });
	}

	/**
	 * For use by {@link TestRunner}. Converts a serialized test result back into a TestResult instance.
	 * @param {objects} serializedTestResult The serialized test result.
	 * @returns {TestSuiteResult | TestCaseResult} The result object.
	 * @see TestSuiteResult#serialize
	 * @see TestCaseResult#serialize
	 */
	static deserialize(serializedTestResult) {
		ensure.signatureMinimum(arguments, [{ type: String }]);

		const type = serializedTestResult.type;
		switch (type) {
			case "TestSuiteResult": return TestSuiteResult.deserialize(serializedTestResult);
			case "TestCaseResult": return TestCaseResult.deserialize(serializedTestResult);
			default: ensure.unreachable(`Unrecognized type '${type}' in serialized test result: ${serializedTestResult}`);
		}
	}

};


/**
 * The result of running a test suite.
 */
class TestSuiteResult extends TestResult {

	/**
	 * For use by {@link TestRunner}. Converts a serialized test result back into a TestResult instance.
	 * @param {object} serializedTestResult The serialized test result.
	 * @returns {TestSuiteResult | TestCaseResult} The result object.
	 * @see TestResult#deserialize
	 */
	static deserialize({ name, filename, suite }) {
		ensure.signature(arguments, [{
			type: String,
			name: Array,
			filename: [ undefined, String ],
			suite: Array,
		}], [ "serialized TestSuiteResult" ]);

		const deserializedSuite = suite.map(test => TestResult.deserialize(test));
		return new TestSuiteResult(name, deserializedSuite, filename);
	}

	/** Internal use only. (Use {@link TestResult.suite} instead.) */
	constructor(names, results, filename) {
		super();
		this._name = Array.isArray(names) ? names : [ names ];
		this._filename = filename;
		this.suite = results;
	}

	/**
	 * Is this result for a test suite? Yes!
	 * @returns {boolean}
	 */
	get isSuite() { return true; }

	/**
	 * @returns {string []} The names of the suite, which typically includes all enclosing suites.
	 */
	get name() {
		return this._name;
	}

	/**
	 * @returns {string | undefined} The file that contained the suite, if any.
	 */
	get filename() {
		return this._filename;
	}

	/**
	 * @returns {TestResult[]} All the test results, excluding test suites, flattened into a single list.
	 */
	allTests() {
		ensure.signature(arguments, []);

		const tests = [];
		this.suite.forEach(result => {
			result.allTests().forEach(subTest => tests.push(subTest));
		});
		return tests;
	}

	/**
	 * Finds all the test results that match the provided statuses.
	 * @param {STATUS[]} statuses The statuses to match.
	 * @returns {TestResult[]} The test results.
	 */
	allMatchingTests(...statuses) {
		return this.allTests().filter(test => statuses.includes(test.status));
	}

	/**
	 * @returns {string[]} All the test files with 100% passing tests--nothing that was skipped, failed, or timed out.
	 */
	allPassingFiles() {
		ensure.signature(arguments, []);

		const allFiles = new Set();
		const notPassFiles = new Set();
		this.allTests()
			.filter(test => test.filename !== undefined)
			.forEach(test => {
				allFiles.add(test.filename);
				if (!test.isPass()) notPassFiles.add(test.filename);
			});

		return [ ...differencePolyfill(allFiles, notPassFiles) ];

		function differencePolyfill(leftSet, rightSet) {
			// Included in Node v22.0; remove this polyfill and replace with left.difference(right) when that enters LTS
			return new Set([ ...leftSet ].filter(value => !rightSet.has(value)));
		}
	}

	/**
	 * A summary count of this suite's results. Includes a count of each type of test result and the total number of tests.
	 * @returns {{[STATUS.FAIL]: number, total: number, [STATUS.PASS]: number, [STATUS.SKIP]: number, [STATUS.TIMEOUT]: number}}
	 */
	count() {
		const count = {
			[STATUS.PASS]: 0,
			[STATUS.FAIL]: 0,
			[STATUS.SKIP]: 0,
			[STATUS.TIMEOUT]: 0,
			total: 0,
		};

		this.allTests().forEach(test => {
			count[test.status]++;
			count.total++;
		});

		return count;
	}

	/**
	 * Convert this suite into a bare object later deserialization.
	 * @returns {object} The serialized object.
	 * @see TestResult.deserialize
	 */
	serialize() {
		return {
			type: "TestSuiteResult",
			name: this._name,
			filename: this._filename,
			suite: this.suite.map(test => test.serialize()),
		};
	}

	/**
	 * Determine if this test result is identical to another test result. To be identical, they must have the same
	 * results, in the same order, with the same names and filenames.
	 * @param {any} that The thing to compare against
	 * @returns {boolean}
	 */
	equals(that) {
		if (!(that instanceof TestSuiteResult)) return false;
		if (this.suite.length !== that.suite.length) return false;

		for (let i = 0; i < this.suite.length; i++) {
			const thisResult = this.suite[i];
			const thatResult = that.suite[i];
			if (!thisResult.equals(thatResult)) return false;
		}

		const sameName = util.isDeepStrictEqual(this._name, that._name);
		return sameName && this._filename === that._filename;
	}

}


/**
 * The result of running an individual test.
 */
class TestCaseResult extends TestResult {

	/**
	 * For use by {@link TestRunner}. Converts a serialized test result back into a TestResult instance.
	 * @param {object} serializedTestResult The serialized test result.
	 * @returns {TestSuiteResult | TestCaseResult} The result object.
	 * @see TestResult#deserialize
	 */
	static deserialize(serializedResult) {
		ensure.signature(arguments, [{
			type: String,
			name: Array,
			filename: [ undefined, String ],
			status: String,
			error: [ undefined, String, Object ],
			timeout: [ undefined, Number ],
		}], [ "serialized TestCaseResult" ]);

		const { name, filename, status, error, timeout } = serializedResult;
		return new TestCaseResult(name, status, { error: deserializeError(error), timeout, filename });

		function deserializeError(serializedError) {
			if (serializedError === undefined || typeof serializedError === "string") return serializedError;

			const { type, message, actual, expected, operator, stack, customFields } = serializedError;

			let error;
			switch (type) {
				case "AssertionError":
					error = new AssertionError({ message, actual, expected, operator });
					break;
				case "Error":
					error = new Error(message);
					break;
				default:
					ensure.unreachable(`Unrecognized error type '${type} when deserializing TestCaseResult: ${serializedResult}`);
			}
			error.stack = stack;
			Object.entries(customFields).forEach(([ key, value ]) => { error[key] = value; });
			return error;
		}
	}

	/** Internal use only. (Use {@link TestResult} factory methods instead.) */
	constructor(names, status, { error, timeout, filename } = {}) {
		super();
		this._name = Array.isArray(names) ? names : [ names ];
		this._filename = filename;
		this._status = status;
		this._error = error;
		this._timeout = timeout;
	}

	/**
	 * Is this result for a test suite? No!
	 * @returns {boolean}
	 */
	get isSuite() { return false; }

	/**
	 * @returns {string | undefined} The file that contained the test, if any.
	 */
	get filename() {
		return this._filename;
	}

	/**
	 * @returns {string []} The names of the suite, which typically includes all enclosing suites.
	 */
	get name() {
		return this._name;
	}

	/**
	 * @returns {STATUS} The status of this test (see {@link TestResult.STATUS}).
	 */
	get status() {
		return this._status;
	}

	/**
	 * @returns {Error | string} The error that caused this test to fail.
	 * @throws {Error} Throws an error if this test didn't fail.
	 */
	get error() {
		ensure.that(this.isFail(), "Attempted to retrieve error from a test that didn't fail");
		return this._error;
	}

	/**
	 * @returns {number} The timeout that this test didn't satisfy. Note that this is not the actual amount of run time of the test.
	 * @throws {Error} Throws an error if this test didn't time out.
	 */
	get timeout() {
		ensure.that(this.isTimeout(), "Attempted to retrieve timeout from a test that didn't time out");
		return this._timeout;
	}

	/**
	 * @returns {boolean} True if this test either passed or was skipped.
	 */
	isSuccess() {
		ensure.signature(arguments, []);

		return SUCCESS_MAP[this.status];
	}

	/**
	 * @returns {boolean} True if this test passed.
	 */
	isPass() {
		ensure.signature(arguments, []);
		return this.status === STATUS.PASS;
	}

	/**
	 * @returns {boolean} True if this test failed.
	 */
	isFail() {
		ensure.signature(arguments, []);
		return this.status === STATUS.FAIL;
	}

	/**
	 * @returns {boolean} True if this test was skipped.
	 */
	isSkip() {
		ensure.signature(arguments, []);
		return this.status === STATUS.SKIP;
	}

	/**
	 * @returns {boolean} True if this test timed out.
	 */
	isTimeout() {
		ensure.signature(arguments, []);
		return this.status === STATUS.TIMEOUT;
	}

	/**
	 * @returns {TestResult[]} This test converted into a list of one.
	 */
	allTests() {
		ensure.signature(arguments, []);
		return [ this ];
	}

	/**
	 * Convert this result into a bare object later deserialization.
	 * @returns {object} The serialized object.
	 * @see TestResult.deserialize
	 */
	serialize() {
		ensure.signature(arguments, []);

		return {
			type: "TestCaseResult",
			name: this._name,
			filename: this._filename,
			status: this._status,
			error: serializeError(this._error),
			timeout: this._timeout,
		};

		function serializeError(error) {
			if (error === undefined || typeof error === "string") return error;

			const serialized = {
				message: error.message,
				stack: error.stack,
				customFields: { ...error },
			};
			if (error instanceof AssertionError) {
				serialized.type = "AssertionError";
				serialized.actual = error.actual;
				serialized.expected = error.expected;
				serialized.operator = error.operator;
			}
			else {
				serialized.type = "Error";
			}

			return serialized;
		}
	}

	/**
	 * @returns {string} A single character representing this test result: a dot for passed, a red X for failed, etc.
	 */
	renderCharacter() {
		ensure.signature(arguments, []);

		return PROGRESS_RENDERING[this._status];
	}

	/**
	 * @returns {string} A single-line string representing this test result. No details are provided beyond the name.
	 */
	renderSingleLine() {
		ensure.signature(arguments, []);

		const description = DESCRIPTION_RENDERING[this._status];
		const filename = this._filename === undefined ? "" : highlightColor(path.basename(this._filename)) + " » ";
		const name = this._name.length === 0 ? "(no name)" : this._name.join(" » ");

		return `${description} ${filename}${name}\n`;
	}

	/**
	 * @returns {string} A multi-line rendering of this test result. Full details are provided.
	 */
	renderMultiLine() {
		ensure.signature(arguments, []);

		return renderName(this) + renderBody(this);
	}

	/**
	 * Determine if this test result is identical to another test result. To be identical, they must have the same
	 * results, in the same order, with the same names and filenames.
	 * @param {any} that The thing to compare against
	 * @returns {boolean}
	 */
	equals(that) {
		if (!(that instanceof TestCaseResult)) return false;
		if (this._status !== that._status) return false;

		const sameName = util.isDeepStrictEqual(this._name, that._name);
		const sameError = this._error === undefined || this._error.message === that._error.message;

		return sameName &&
			sameError &&
			this._timeout === that._timeout &&
			this.filename === that.filename;
	}

}

function renderName(testCase) {
	const name = testCase.name;

	const suites = name.slice(0, name.length - 1);
	const test = name[name.length - 1];
	if (testCase.filename !== undefined) suites.unshift(path.basename(testCase.filename));

	const suitesName = suites.length > 0 ? suites.join(" » ") + "\n» " : "";
	return headerColor(suitesName + test + "\n");
}

function renderBody(testCase) {
	const name = testCase.name;

	switch (testCase._status) {
		case STATUS.PASS:
		case STATUS.SKIP:
			return `\n${DESCRIPTION_RENDERING[testCase._status]}\n`;
		case STATUS.FAIL:
			return renderFailure(testCase, name);
		case STATUS.TIMEOUT:
			return timeoutMessageColor(`\nTimed out after ${testCase._timeout}ms\n`);
		default:
			throw new Error(`Unrecognized test result status: ${testCase._status}`);
	}
}

function renderFailure(testCase, name) {
	let error;
	if (testCase._error.stack === undefined) {
		error = errorMessageColor(`\n${testCase._error}\n`);
	} else {
		error = `\n${renderStack(testCase._error, testCase.filename)}\n` +
			highlightColor(`\n${name[name.length - 1]} »\n`) +
			errorMessageColor(`${testCase._error.message}\n`);
	}
	const diff = renderDiff(testCase._error);

	return `${error}${diff}`;
}

function renderStack(error, filename) {
	const stack = error.stack.split("\n");
	const highlighted = stack.map(line => {
		if (!line.includes(filename)) return line;

		line = line.replace(/    at/, "--> at");	// this code is vulnerable to changes in Node.js rendering
		return headerColor(line);
	});
	return highlighted.join("\n");
}

function renderDiff(error) {
	if (error.expected === undefined && error.actual === undefined) return "";
	if (error.expected === null && error.actual === null) return "";

	const expected = util.inspect(error.expected, { depth: Infinity }).split("\n");
	const actual = util.inspect(error.actual, { depth: Infinity }).split("\n");
	if (expected.length > 1 || actual.length > 1) {
		for (let i = 0; i < Math.max(expected.length, actual.length); i++) {
			const expectedLine = expected[i];
			const actualLine = actual[i];

			if (expectedLine !== actualLine) {
				if (expected[i] !== undefined) expected[i] = diffColor(expected[i]);
				if (actual[i] !== undefined) actual[i] = diffColor(actual[i]);
			}
		}
	}

	return "\n" +
		expectedColor("expected: ") + expected.join("\n") + "\n" +
		actualColor("actual:   ") + actual.join("\n") + "\n";
}