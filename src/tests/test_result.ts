// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."

import * as ensure from "../util/ensure.js";
import util from "node:util";
import { AssertionError } from "node:assert";

const STATUS = {
	PASS: "pass",
	FAIL: "fail",
	SKIP: "skip",
	TIMEOUT: "timeout",
} as const;

const SUCCESS_MAP = {
	[STATUS.PASS]: true,
	[STATUS.FAIL]: false,
	[STATUS.SKIP]: true,
	[STATUS.TIMEOUT]: false,
};

export type SerializedTestResult = SerializedTestSuiteResult | SerializedTestCaseResult;

type TestStatus = typeof STATUS[keyof typeof STATUS];

interface TestCount {
	pass: number;
	fail: number;
	skip: number;
	timeout: number;
	total: number;
}

interface SerializedTestSuiteResult {
	type: "TestSuiteResult";
	name: string[];
	filename?: string;
	suite: SerializedTestResult[];
}

interface SerializedTestCaseResult {
	type: "TestCaseResult";
	name: string[];
	filename?: string;
	status: TestStatus;
	error?: unknown;
	timeout?: number;
}

interface SerializedError {
	type: "Error" | "AssertionError";
	message: string;
	stack?: string;
	customFields: Record<string, unknown>;
	actual?: unknown;
	expected?: unknown;
	operator?: string;
}

/**
 * The result of a test run. Can be a single test case or a suite of nested test results.
 */
export abstract class TestResult {

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
	static suite(names: string | string[], results: TestResult[], filename?: string): TestSuiteResult {
		ensure.signature(arguments, [[ String, Array ], Array, [ undefined, String ]]);

		return new TestSuiteResult(names, results, filename);
	}

	/**
	 * Factory method. Create a TestResult for a test that passed.
	 * @param {string|string[]} names The name of the test. Can be a list of names.
	 * @param {string} [filename] The file that contained this test (optional).
	 * @returns {TestCaseResult} The result.
	 */
	static pass(names: string | string[], filename?: string): TestCaseResult {
		ensure.signature(arguments, [[ String, Array ], [ undefined, String ] ]);

		return new TestCaseResult(names, STATUS.PASS, { filename });
	}

	/**
	 * Factory method. Create a TestResult for a test that failed.
	 * @param {string|string[]} names The name of the test. Can be a list of names.
	 * @param {unknown} error The error that occurred.
	 * @param {string} [filename] The file that contained this test (optional).
	 * @returns {TestCaseResult} The result.
	 */
	static fail(names: string | string[], error: unknown, filename?: string): TestCaseResult {
		ensure.signature(arguments, [[ String, Array ], [ String, Error ], [ undefined, String ]]);

		return new TestCaseResult(names, STATUS.FAIL, { error, filename });
	}

	/**
	 * Factory method. Create a TestResult for a test that was skipped.
	 * @param {string|string[]} names The name of the test. Can be a list of names.
	 * @param {string} [filename] The file that contained this test (optional).
	 * @returns {TestCaseResult} The result.
	 */
	static skip(names: string | string[], filename?: string): TestCaseResult {
		ensure.signature(arguments, [[ String, Array ], [ undefined, String ] ]);

		return new TestCaseResult(names, STATUS.SKIP, { filename });
	}

	/**
	 * Factory method. Create a TestResult for a test that timed out.
	 * @param {string|string[]} names The name of the test. Can be a list of names.
	 * @param {number} timeout The length of the timeout.
	 * @param {string} [filename] The file that contained this test (optional).
	 * @returns {TestCaseResult} The result.
	 */
	static timeout(names: string | string[], timeout: number, filename?: string): TestCaseResult {
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
	static deserialize(serializedTestResult: SerializedTestResult): TestResult {
		ensure.signatureMinimum(arguments, [{ type: String }]);

		const type = serializedTestResult.type;
		switch (type) {
			case "TestSuiteResult": return TestSuiteResult.deserialize(serializedTestResult);
			case "TestCaseResult": return TestCaseResult.deserialize(serializedTestResult);
			default: ensure.unreachable(`Unrecognized type '${type}' in serialized test result: ${serializedTestResult}`);
		}
	}

	/**
	 * @returns {boolean} True if this result represents a suite of tests.
	 */
	abstract isSuite(): boolean;

	/**
	 * @returns {boolean} True if this test either passed or was skipped.
	 */
	abstract isSuccess(): boolean;

	/**
	 * @returns {TestCaseResult[]} All the test results, excluding test suites, flattened into a single list.
	 */
	abstract allTests(): TestCaseResult[];

	/**
	 * Convert this result into a bare object later deserialization.
	 * @returns {SerializedTestSuiteResult} The serialized result.
	 * @see TestResult.deserialize
	 */
	abstract serialize(): SerializedTestResult;

	/**
	 * Determine if this test result is identical to another test result. To be identical, they must have the same
	 * results, in the same order, with the same names and filenames.
	 * @param {any} that The thing to compare against
	 * @returns {boolean}
	 */
	abstract equals(that: TestResult): boolean;

}

/**
 * The result of running a test suite.
 */
export class TestSuiteResult extends TestResult {

	/**
	 * For use by {@link TestRunner}. Converts a serialized test result back into a TestResult instance.
	 * @param {SerializedTestSuiteResult} serializedTestResult The serialized test result.
	 * @returns {TestSuiteResult} The result object.
	 * @see TestResult#deserialize
	 */
	static override deserialize({ name, filename, suite }: SerializedTestSuiteResult): TestSuiteResult {
		ensure.signature(arguments, [{
			type: String,
			name: Array,
			filename: [ undefined, String ],
			suite: Array,
		}], [ "serialized TestSuiteResult" ]);

		const deserializedSuite = suite.map(test => TestResult.deserialize(test));
		return new TestSuiteResult(name, deserializedSuite, filename);
	}

	private readonly _name: string[];
	private readonly _filename?: string;
	private readonly _children: TestResult[];

	/** Internal use only. (Use {@link TestResult.suite} instead.) */
	constructor(names: string | string[], results: TestResult[], filename?: string) {
		super();
		this._name = Array.isArray(names) ? names : [ names ];
		this._filename = filename;
		this._children = results;
	}

	isSuite(): boolean { return true; }

	/**
	 * @returns {string []} The names of the suite, which typically includes all enclosing suites.
	 */
	get name(): string[] {
		return this._name;
	}

	/**
	 * @returns {string | undefined} The file that contained the suite, if any.
	 */
	get filename(): string | undefined {
		return this._filename;
	}

	/**
	 * @returns { TestResult[] } This suite's direct children, which can either be test case results or test suite
	 *   results.
	 */
	get children(): TestResult[] {
		return this._children;
	}

	/**
	 * @returns {boolean} True if this test either passed or was skipped.
	 */
	isSuccess(): boolean {
		ensure.signature(arguments, []);

		ensure.unreachable("not yet implemented");
	}

	/**
	 * @returns {TestCaseResult[]} All the test results, excluding test suites, flattened into a single list.
	 */
	allTests(): TestCaseResult[] {
		ensure.signature(arguments, []);

		const tests: TestCaseResult[] = [];
		this._children.forEach(result => {
			result.allTests().forEach(subTest => tests.push(subTest));
		});
		return tests;
	}

	/**
	 * Finds all the test results that match the provided statuses.
	 * @param {STATUS[]} statuses The statuses to match.
	 * @returns {TestResult[]} The test results.
	 */
	allMatchingTests(...statuses: TestStatus[]): TestCaseResult[] {
		return this.allTests().filter(test => statuses.includes(test.status));
	}

	/**
	 * @returns {string[]} All the test files with 100% passing tests--nothing that was skipped, failed, or timed out.
	 */
	allPassingFiles(): string[] {
		ensure.signature(arguments, []);

		const allFiles = new Set<string>();
		const notPassFiles = new Set<string>();
		this.allTests()
			.filter(test => test.filename !== undefined)
			.forEach(test => {
				allFiles.add(test.filename!);
				if (!test.isPass()) notPassFiles.add(test.filename!);
			});

		return [ ...differencePolyfill(allFiles, notPassFiles) ];

		function differencePolyfill<T>(leftSet: Set<T>, rightSet: Set<T>): Set<T> {
			// Included in Node v22.0; remove this polyfill and replace with left.difference(right) when that enters LTS
			return new Set([ ...leftSet ].filter(value => !rightSet.has(value)));
		}
	}

	/**
	 * A summary count of this suite's results. Includes a count of each type of test result and the total number of
	 * tests.
	 * @returns {{[STATUS.FAIL]: number, total: number, [STATUS.PASS]: number, [STATUS.SKIP]: number, [STATUS.TIMEOUT]:
	 *   number}}
	 */
	count(): TestCount {
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
	 * @returns {SerializedTestSuiteResult} The serialized object.
	 * @see TestResult.deserialize
	 */
	serialize(): SerializedTestSuiteResult {
		return {
			type: "TestSuiteResult",
			name: this._name,
			filename: this._filename,
			suite: this._children.map(test => test.serialize()),
		};
	}

	/**
	 * Determine if this test result is identical to another test result. To be identical, they must have the same
	 * results, in the same order, with the same names and filenames.
	 * @param {any} that The thing to compare against
	 * @returns {boolean}
	 */
	equals(that: TestResult): boolean {
		if (!(that instanceof TestSuiteResult)) return false;
		if (this._children.length !== that._children.length) return false;

		for (let i = 0; i < this._children.length; i++) {
			const thisResult = this._children[i]!;
			const thatResult = that._children[i]!;
			if (!thisResult.equals(thatResult)) return false;
		}

		const sameName = util.isDeepStrictEqual(this._name, that._name);
		return sameName && this._filename === that._filename;
	}

}


/**
 * The result of running an individual test.
 */
export class TestCaseResult extends TestResult {

	/**
	 * For use by {@link TestRunner}. Converts a serialized test result back into a TestResult instance.
	 * @param {object} serializedTestResult The serialized test result.
	 * @returns {TestSuiteResult | TestCaseResult} The result object.
	 * @see TestResult#deserialize
	 */
	static override deserialize(serializedResult: SerializedTestCaseResult) {
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

		function deserializeError(serializedError?: unknown) {
			if (serializedError === undefined || typeof serializedError === "string") return serializedError;

			const { type, message, actual, expected, operator, stack, customFields } = serializedError as SerializedError;

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
			Object.entries(customFields).forEach(([ key, value ]) => {
				// @ts-expect-error - don't know how to get TypeScript to stop complaining about this
				error[key] = value;
			});
			return error;
		}
	}

	private _name: string[];
	private _filename?: string;
	private _status: TestStatus;
	private _error?: unknown;
	private _timeout?: number;

	/** Internal use only. (Use {@link TestResult} factory methods instead.) */
	constructor(
		names: string | string[],
		status: TestStatus,
		{ error, timeout, filename }: { error?: unknown, timeout?: number, filename?: string } = {}
	) {
		super();
		this._name = Array.isArray(names) ? names : [ names ];
		this._filename = filename;
		this._status = status;
		this._error = error;
		this._timeout = timeout;
	}

	isSuite(): boolean { return false; }

	/**
	 * @returns {string | undefined} The file that contained the test, if any.
	 */
	get filename(): string | undefined {
		return this._filename;
	}

	/**
	 * @returns {string []} The names of the suite, which typically includes all enclosing suites.
	 */
	get name(): string[] {
		return this._name;
	}

	/**
	 * @returns {TestStatus | TestCount} Whether this test passed, failed, etc. If this result is for a test suite, returns an object representing the results of all the tests.
	 */
	get status(): TestStatus {
		return this._status;
	}

	/**
	 * @returns {Error | string} The error that caused this test to fail.
	 * @throws {Error} Throws an error if this test didn't fail.
	 */
	get error(): unknown {
		ensure.that(this.isFail(), "Attempted to retrieve error from a test that didn't fail");
		return this._error!;
	}

	/**
	 * @returns {number} The timeout that this test didn't satisfy. Note that this is not the actual amount of run time
	 *   of the test.
	 * @throws {Error} Throws an error if this test didn't time out.
	 */
	get timeout(): number {
		ensure.that(this.isTimeout(), "Attempted to retrieve timeout from a test that didn't time out");
		return this._timeout!;
	}

	/**
	 * @returns {boolean} True if this test either passed or was skipped.
	 */
	isSuccess(): boolean {
		ensure.signature(arguments, []);

		return SUCCESS_MAP[this.status];
	}

	/**
	 * @returns {boolean} True if this test passed.
	 */
	isPass(): boolean {
		ensure.signature(arguments, []);
		return this.status === STATUS.PASS;
	}

	/**
	 * @returns {boolean} True if this test failed.
	 */
	isFail(): boolean {
		ensure.signature(arguments, []);
		return this.status === STATUS.FAIL;
	}

	/**
	 * @returns {boolean} True if this test was skipped.
	 */
	isSkip(): boolean {
		ensure.signature(arguments, []);
		return this.status === STATUS.SKIP;
	}

	/**
	 * @returns {boolean} True if this test timed out.
	 */
	isTimeout(): boolean {
		ensure.signature(arguments, []);
		return this.status === STATUS.TIMEOUT;
	}

	/**
	 * @returns {TestCaseResult[]} This test converted into a list of one.
	 */
	allTests(): TestCaseResult[] {
		ensure.signature(arguments, []);
		return [ this ];
	}

	/**
	 * Convert this result into a bare object later deserialization.
	 * @returns {object} The serialized object.
	 * @see TestResult.deserialize
	 */
	serialize(): SerializedTestCaseResult {
		ensure.signature(arguments, []);

		return {
			type: "TestCaseResult",
			name: this._name,
			filename: this._filename,
			status: this._status,
			error: serializeError(this._error),
			timeout: this._timeout,
		};

		function serializeError(error?: unknown) {
			if (!(error instanceof Error)) return error;

			const serialized: SerializedError = {
				type: "Error",
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

			return serialized;
		}
	}

	/**
	 * Determine if this test result is identical to another test result. To be identical, they must have the same
	 * results, in the same order, with the same names and filenames.
	 * @param {any} that The thing to compare against
	 * @returns {boolean}
	 */
	equals(that: TestResult): boolean {
		if (!(that instanceof TestCaseResult)) return false;
		if (this._status !== that._status) return false;

		const sameName = util.isDeepStrictEqual(this._name, that._name);
		// @ts-expect-error - strings are objects, so this._error.message is legit on strings
		const sameError = this._error === undefined || this._error.message === that._error.message;

		return sameName &&
			sameError &&
			this._timeout === that._timeout &&
			this.filename === that.filename;
	}

}
