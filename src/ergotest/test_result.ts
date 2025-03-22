// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."

import * as ensure from "../util/ensure.js";
import util from "node:util";
import { renderError as renderErrorFn, TestRenderer } from "./test_renderer.js";

export const TestStatus = {
	pass: "pass",
	fail: "fail",
	skip: "skip",
	timeout: "timeout",
} as const;

export type TestStatusValue = typeof TestStatus[keyof typeof TestStatus];

export const TestMark = {
	none: "none",
	skip: "skip",
	only: "only",
} as const;

export type TestMarkValue = typeof TestMark[keyof typeof TestMark];

export interface TestCount {
	pass: number;
	fail: number;
	skip: number;
	timeout: number;
	total: number;
}

export type SerializedTestResult = SerializedTestSuiteResult | SerializedTestCaseResult;

export interface SerializedTestSuiteResult {
	type: "TestSuiteResult";
	name: string[];
	mark: TestMarkValue;
	filename?: string;
	tests: SerializedTestResult[];
	beforeAll: SerializedTestCaseResult[];
	afterAll: SerializedTestCaseResult[];
}

export interface SerializedTestCaseResult {
	type: "TestCaseResult";
	name: string[];
	mark: TestMarkValue;
	filename?: string;
	status: TestStatusValue;
	errorMessage?: string;
	errorRender?: unknown;
	timeout?: number;
	beforeEach: SerializedTestCaseResult[];
	afterEach: SerializedTestCaseResult[];
}

export type RenderErrorFn = (names: string[], error: unknown, mark: TestMarkValue, filename?: string) => unknown;

/**
 * The result of a test run. Can be a single test case or a suite of nested test results.
 */
export abstract class TestResult {

	/**
	 * Create a TestResult for a suite of tests.
	 * @param {string|string[]} name The name of the test. Can be a list of names.
	 * @param {TestResult[]} tests The nested tests in this suite (can be test suites or individual test cases).
	 * @param {TestCaseResult[]} [options.beforeAll] The beforeAll() blocks in this suite.
	 * @param {TestCaseResult[]} [options.afterAll] The afterAll() blocks in this suite.
	 * @param {string} [options.filename] The file that contained this suite (optional).
	 * @param {TestMarkValue} [options.mark] Whether this suite was marked with `.skip`, `.only`, or nothing.
	 * @returns {TestSuiteResult} The result.
	 */
	static suite(
		name: string | string[],
		tests: TestResult[],
		{
			beforeAll = [],
			afterAll = [],
			filename,
			mark = TestMark.none
		}: {
			beforeAll?: TestCaseResult[],
			afterAll?: TestCaseResult[],
			filename?: string,
			mark?: TestMarkValue,
		} = {},
	): TestSuiteResult {
		ensure.signature(arguments, [
			[ String, Array ],
			Array,
			[ undefined, {
				beforeAll: [ undefined, Array ],
				afterAll: [ undefined, Array ],
				filename: [ undefined, String ],
				mark: [ undefined, String ]
			}],
		]);

		if (!Array.isArray(name)) name = [ name ];
		return new TestSuiteResult(name, tests, beforeAll, afterAll, mark, filename);
	}

	/**
	 * Create a TestResult for a test that passed.
	 * @param {string|string[]} name The name of the test. Can be a list of names.
	 * @param {TestCaseResult[]} [options.beforeEach] The beforeEach() blocks for this test.
	 * @param {TestCaseResult[]} [options.afterEach] The afterEach() blocks for this test.
	 * @param {string} [options.filename] The file that contained this test (optional).
	 * @param {TestMarkValue} [options.mark] Whether this test was marked with `.skip`, `.only`, or nothing.
	 * @returns {TestCaseResult} The result.
	 */
	static pass(
		name: string | string[],
		{
			beforeEach,
			afterEach,
			filename,
			mark,
		}: {
			beforeEach?: TestCaseResult[],
			afterEach?: TestCaseResult[],
			filename?: string,
			mark?: TestMarkValue,
		} = {}
	): TestCaseResult {
		ensure.signature(arguments, [
			[ String, Array ],
			[ undefined, {
				beforeEach: [ undefined, Array ],
				afterEach: [ undefined, Array ],
				filename: [ undefined, String ],
				mark: [ undefined, String ]
			}],
		]);

		if (!Array.isArray(name)) name = [ name ];
		return new TestCaseResult({ name, status: TestStatus.pass, beforeEach, afterEach, filename, mark });
	}

	/**
	 * Create a TestResult for a test that failed.
	 * @param {string|string[]} name The name of the test. Can be a list of names.
	 * @param {unknown} error The error that occurred.
	 * @param {(name: string, error: unknown, mark: TestMarkValue, filename?: string) => unknown} [options.renderError]
	 *   The function to use to render the error into a string (defaults to {@link renderError})
 *   @param {TestCaseResult[]} [options.beforeEach] The beforeEach() blocks for this test.
	 * @param {TestCaseResult[]} [options.afterEach] The afterEach() blocks for this test.
	 * @param {string} [options.filename] The file that contained this test (optional).
	 * @param {TestMarkValue} [options.mark] Whether this test was marked with `.skip`, `.only`, or nothing.
	 *   function will be called and the results put into {@link errorRender}.
	 * @returns {TestCaseResult} The result.
	 */
	static fail(
		name: string | string[],
		error: unknown,
		{
			renderError = renderErrorFn,
			beforeEach,
			afterEach,
			filename,
			mark,
		}: {
			renderError?: RenderErrorFn
			beforeEach?: TestCaseResult[],
			afterEach?: TestCaseResult[],
			filename?: string,
			mark?: TestMarkValue,
		} = {},
	): TestCaseResult {
		ensure.signature(arguments, [
			[ String, Array ],
			ensure.ANY_TYPE,
			[ undefined, {
				renderError: [ undefined, Function ],
				beforeEach: [ undefined, Array ],
				afterEach: [ undefined, Array ],
				filename: [ undefined, String ],
				mark: [ undefined, String ],
			}],
		]);

		if (!Array.isArray(name)) name = [ name ];

		let errorMessage: string;
		if (error instanceof Error) errorMessage = error.message ?? "";
		else if (typeof error === "string") errorMessage = error;
		else errorMessage = util.inspect(error, { depth: Infinity });

		const errorRender = renderError(name, error, mark ?? TestMark.none, filename);

		return new TestCaseResult(
			{ name, status: TestStatus.fail, errorMessage, errorRender, beforeEach, afterEach, filename, mark }
		);
	}

	/**
	 * Create a TestResult for a test that was skipped.
	 * @param {string|string[]} name The name of the test. Can be a list of names.
	 * @param {TestCaseResult[]} [options.beforeEach] The beforeEach() blocks for this test.
	 * @param {TestCaseResult[]} [options.afterEach] The afterEach() blocks for this test.
	 * @param {string} [options.filename] The file that contained this test (optional).
	 * @param {TestMarkValue} [options.mark] Whether this test was marked with `.skip`, `.only`, or nothing.
	 * @returns {TestCaseResult} The result.
	 */
	static skip(
		name: string | string[],
		{
			beforeEach,
			afterEach,
			filename,
			mark,
		}: {
			beforeEach?: TestCaseResult[],
			afterEach?: TestCaseResult[],
			filename?: string,
			mark?: TestMarkValue,
		} = {}
	): TestCaseResult {
		ensure.signature(arguments, [
			[ String, Array ],
			[ undefined, {
				beforeEach: [ undefined, Array ],
				afterEach: [ undefined, Array ],
				filename: [ undefined, String ],
				mark: [ undefined, String ]
			}],
		]);

		if (!Array.isArray(name)) name = [ name ];
		return new TestCaseResult({ name, status: TestStatus.skip, beforeEach, afterEach, filename, mark });
	}

	/**
	 * Create a TestResult for a test that timed out.
	 * @param {string|string[]} name The name of the test. Can be a list of names.
	 * @param {number} timeout The length of the timeout.
	 * @param {TestCaseResult[]} [options.beforeEach] The beforeEach() blocks for this test.
	 * @param {TestCaseResult[]} [options.afterEach] The afterEach() blocks for this test.
	 * @param {string} [options.filename] The file that contained this test (optional).
	 * @param {TestMarkValue} [options.mark] Whether this test was marked with `.skip`, `.only`, or nothing.
	 * @returns {TestCaseResult} The result.
	 */
	static timeout(
		name: string | string[],
		timeout: number,
		{
			beforeEach,
			afterEach,
			filename,
			mark,
		}: {
			beforeEach?: TestCaseResult[],
			afterEach?: TestCaseResult[],
			filename?: string,
			mark?: TestMarkValue,
		} = {},
	): TestCaseResult {
		ensure.signature(arguments, [
			[ String, Array ],
			Number,
			[ undefined, {
				beforeEach: [ undefined, Array ],
				afterEach: [ undefined, Array ],
				filename: [ undefined, String ],
				mark: [ undefined, String ]
			}],
		]);
		
		if (!Array.isArray(name)) name = [ name ];
		return new TestCaseResult({ name, status: TestStatus.timeout, timeout, beforeEach, afterEach, filename, mark });
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
	 * @returns {string | undefined} The file that contained the test (or suite), if any.
	 */
	abstract get filename(): string | undefined;

	/**
	 * @returns {string []} The name of the test (or suite), and all enclosing suites, with the outermost suite first.
	 *   Does not include the file name.
	 */
	abstract get name(): string[];

	/**
	 * @return { TestMark } Whether the test (or suite) was explicitly marked with `.skip`, `.only`, or not at all.
	 */
	abstract get mark(): TestMarkValue;

	/**
	 * @returns {TestCaseResult[]} All the test results, excluding test suites, flattened into a single list.
	 */
	abstract allTests(): TestCaseResult[];

	/**
	 * @returns {TestCaseResult[]} All test results, with a mark (.only, etc.) that matches the requested marks,
	 *   flattened into a single list, including test suites. However, if you access the properties of the test suites,
	 *   such as {@link TestSuiteResult.tests}, those properties won’t be filtered.
	 */
	abstract allMatchingMarks(...marks: TestMarkValue[]): TestResult[];

	/**
	 * Convert this result into a bare object later deserialization.
	 * @returns {SerializedTestSuiteResult} The serialized object.
	 * @see TestResult.deserialize
	 */
	abstract serialize(): SerializedTestResult;

	/**
	 * Determine if this test result is identical to another test result. To be identical, they must have the same
	 * results, in the same order, with the same names, filenames, and marks (.only etc.).
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
	static deserialize(suite: SerializedTestSuiteResult): TestSuiteResult {
		ensure.signature(arguments, [{
			type: String,
			name: Array,
			mark: String,
			filename: [ undefined, String ],
			tests: Array,
			beforeAll: Array,
			afterAll: Array,
		}], [ "serialized TestSuiteResult" ]);

		const { name, filename, mark, tests, beforeAll, afterAll } = suite;
		const deserializedTests = tests.map(test => TestResult.deserialize(test));
		const deserializedBeforeAll = beforeAll.map(test => TestCaseResult.deserialize(test));
		const deserializedAfterAll = afterAll.map(test => TestCaseResult.deserialize(test));

		return new TestSuiteResult(name, deserializedTests, deserializedBeforeAll, deserializedAfterAll, mark, filename);
	}

	private readonly _name: string[];
	private readonly _tests: TestResult[];
	private readonly _beforeAll: TestCaseResult[];
	private readonly _afterAll: TestCaseResult[];
	private readonly _mark: TestMarkValue;
	private readonly _filename?: string;

	/** Internal use only. (Use {@link TestResult.suite} instead.) */
	constructor(name: string[], tests: TestResult[], beforeAll: TestCaseResult[], afterAll: TestCaseResult[], mark: TestMarkValue, filename?: string) {
		super();
		this._name = name;
		this._tests = tests;
		this._beforeAll = beforeAll;
		this._afterAll = afterAll;
		this._mark = mark;
		this._filename = filename;
	}

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
	 * @return { TestMarkValue } Whether the test was explicitly marked with `.skip`, `.only`, or not at all.
	 */
	get mark(): TestMarkValue {
		return this._mark;
	}

	/**
	 * @returns { TestResult[] } The tests in this suite, which can either be test case results or test suite results.
	 */
	get tests(): TestResult[] {
		return this._tests;
	}

	/**
	 * @returns { TestCaseResult[] } The beforeAll() blocks for this suite.
	 */
	get beforeAll(): TestCaseResult[] {
		return this._beforeAll;
	}

	/**
	 * @returns { TestCaseResult[] } The afterAll() blocks for this suite.
	 */
	get afterAll(): TestCaseResult[] {
		return this._afterAll;
	}

	/**
	 * Convert this suite to a nicely-formatted string. The string describes the tests that have marks (such as .only)
	 * and provides details about the tests that have failed or timed out. It doesn't provide any details about the tests
	 * that have passed or been skipped, except for the ones that have marks. After the details, it displays a summary of
	 * the number of tests that have passed, failed, etc., and the average time required per test.
	 *
	 * This is a convenience method. For more control over rendering, use {@link TestRenderer} instead.
	 *
	 * @param {string} [preamble=""] A string to write before the test results, but only if there are any marks or errors.
	 * @param {number} elapsedMs The total time required to run the test suite, in milliseconds.
	 *   If there are no marks or errors, the preamble is ignored. Defaults to an empty string.
	 * @returns The formatted string.
	 */
	render(preamble: string = "", elapsedMs?: number): string {
		ensure.signature(arguments, [ [ undefined, String ], [ undefined, Number ]]);

		const renderer = TestRenderer.create();
		const marks = this.allMarkedResults();
		const errors = this.allMatchingTests(TestStatus.fail, TestStatus.timeout);

		const markRender = renderer.renderMarksAsLines(marks);
		const errorRender = renderer.renderAsMultipleLines(errors);
		const summaryRender = renderer.renderSummary(this, elapsedMs);

		if (marks.length > 0 && errors.length > 0) {
			return preamble + markRender + "\n\n\n" + errorRender + "\n\n" + summaryRender;
		}
		else if (marks.length > 0) {
			return preamble + markRender + "\n\n" + summaryRender;
		}
		else if (errors.length > 0) {
			return preamble + errorRender + "\n\n" + summaryRender;
		}
		else {
			return summaryRender;
		}
	}

	/**
	 * @returns {TestCaseResult[]} All the test results, excluding test suites, flattened into a single list.
	 */
	allTests(): TestCaseResult[] {
		ensure.signature(arguments, []);

		const tests: TestCaseResult[] = [];
		const collect = (result: TestResult) => {
			result.allTests().forEach(subTest => tests.push(subTest));
		};

		this._beforeAll.forEach(collect);
		this._afterAll.forEach(collect);
		this._tests.forEach(collect);

		return tests;
	}

	/**
	 * Finds all the test results that match the provided statuses.
	 * @param {TestStatus[]} statuses The statuses to match.
	 * @returns {TestCaseResult[]} The test results.
	 */
	allMatchingTests(...statuses: TestStatusValue[]): TestCaseResult[] {
		return this.allTests().filter(test => statuses.includes(test.status));
	}

	/**
	 * @returns {TestCaseResult[]} All test results, with a mark (.only, etc.) that matches the requested marks,
	 *   flattened into a single list, including test suites. However, if you access the properties of the test suites,
	 *   such as {@link TestSuiteResult.tests}, those properties won’t be filtered.
	 */
	allMarkedResults(): TestResult[] {
		ensure.signature(arguments, []);

		const allMarks = new Set(Object.values(TestMark));
		allMarks.delete(TestMark.none);
		return this.allMatchingMarks.apply(this, [ ...allMarks ]);
	}

	allMatchingMarks(...marks: TestMarkValue[]): TestResult[] {
		ensureValidMarks(marks);

		const results = new Set<TestResult>();
		if (marks.includes(this.mark)) results.add(this);

		const collect = (result: TestResult) => {
			if (marks.includes(result.mark)) results.add(result);
			result.allMatchingMarks.apply(result, marks).forEach(subResult => results.add(subResult));
		};

		this._beforeAll.forEach(collect);
		this._afterAll.forEach(collect);
		this._tests.forEach(collect);

		return [ ...results ];
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
	 * @returns {TestCount} A summary count of this suite's results. Includes a count of each type of test result and the
	 *   total number of tests.
	 */
	count(): TestCount {
		const count = {
			[TestStatus.pass]: 0,
			[TestStatus.fail]: 0,
			[TestStatus.skip]: 0,
			[TestStatus.timeout]: 0,
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
			mark: this._mark,
			filename: this._filename,
			tests: this._tests.map(test => test.serialize()),
			beforeAll: this._beforeAll.map(test => test.serialize()),
			afterAll: this._afterAll.map(test => test.serialize()),
		};
	}

	equals(that: TestResult): boolean {
		if (!(that instanceof TestSuiteResult)) return false;
		if (this._mark !== that._mark) return false;

		if (!compareTestResults(this._tests, that._tests)) return false;
		if (!compareTestResults(this._beforeAll, that._beforeAll)) return false;
		if (!compareTestResults(this._afterAll, that._afterAll)) return false;

		const sameName = util.isDeepStrictEqual(this._name, that._name);
		return sameName && this._filename === that._filename;

		function compareTestResults(thisTests: TestResult[], thatTests: TestResult[]): boolean {
			if (thisTests.length !== thatTests.length) return false;
			for (let i = 0; i < thisTests.length; i++) {
				const thisResult = thisTests[i]!;
				const thatResult = thatTests[i]!;
				if (!thisResult.equals(thatResult)) return false;
			}
			return true;
		}
	}

}


/**
 * The result of running an individual test.
 */
export class TestCaseResult extends TestResult {

	/**
	 * For use by {@link TestRunner}. Converts a serialized test result back into a TestResult instance.
	 * @param {object} serializedTestResult The serialized test result.
	 * @returns {TestCaseResult} The result object.
	 * @see TestResult#deserialize
	 */
	static deserialize(serializedResult: SerializedTestCaseResult): TestCaseResult {
		ensure.signature(arguments, [{
			type: String,
			name: Array,
			mark: String,
			filename: [ undefined, String ],
			status: String,
			errorMessage: [ undefined, String ],
			errorRender: ensure.ANY_TYPE,
			timeout: [ undefined, Number ],
			beforeEach: [ undefined, Array ],
			afterEach: [ undefined, Array ],
		}], [ "serialized TestCaseResult" ]);

		return new TestCaseResult(serializedResult);
	}

	private _name: string[];
	private _filename?: string;
	public _beforeEach: TestCaseResult[];
	public _afterEach: TestCaseResult[];
	private _status: TestStatusValue;
	private _mark: TestMarkValue;
	private _errorMessage?: string;
	private _errorRender?: unknown;
	private _timeout?: number;

	/** Internal use only. (Use {@link TestResult} factory methods instead.) */
	constructor(
		{
			name,
			status,
			errorMessage,
			errorRender,
			timeout,
			beforeEach = [],
			afterEach = [],
			filename,
			mark,
		}: {
			name: string[],
			status: TestStatusValue,
			errorMessage?: string,
			errorRender?: unknown,
			timeout?: number,
			beforeEach?: TestCaseResult[],
			afterEach?: TestCaseResult[],
			filename?: string,
			mark?: TestMarkValue
		},
	) {
		super();
		this._name = name;
		this._filename = filename;
		this._beforeEach = beforeEach;
		this._afterEach = afterEach;
		this._status = status;
		this._mark = mark ?? TestMark.none;
		this._errorMessage = errorMessage;
		this._errorRender = errorRender;
		this._timeout = timeout;
	}

	get filename(): string | undefined {
		return this._filename;
	}

	get name(): string[] {
		return this._name;
	}

	/**
	 * @returns {TestStatusValue} Whether this test passed, failed, etc.
	 */
	get status(): TestStatusValue {
		const consolidatedBefore = this._beforeEach.reduce(consolidateTestCase, TestStatus.pass);
		const consolidatedBeforeAndAfter = this._afterEach.reduce(consolidateTestCase, consolidatedBefore);

		if (consolidatedBeforeAndAfter === TestStatus.pass && this._status === TestStatus.skip) return TestStatus.skip;
		else return consolidateStatus(consolidatedBeforeAndAfter, this._status);

		function consolidateTestCase(previousStatus: TestStatusValue, testCaseResult: TestCaseResult) {
			return consolidateStatus(previousStatus, testCaseResult._status);
		}

		function consolidateStatus(left: TestStatusValue, right: TestStatusValue) {
			if (left === TestStatus.fail || right === TestStatus.fail) return TestStatus.fail;
			else if (left === TestStatus.timeout || right === TestStatus.timeout) return TestStatus.timeout;
			else if (left === TestStatus.pass || right === TestStatus.pass) return TestStatus.pass;
			else return TestStatus.skip;
		}
	}

	/**
	 * @return { TestMark } Whether the test was explicitly marked with `.skip`, `.only`, or not at all.
	 */
	get mark(): TestMarkValue {
		return this._mark;
	}

	/**
	 * @returns { TestCaseResult[] } The beforeEach() blocks for this test.
	 */
	get beforeEach(): TestCaseResult[] {
		return this._beforeEach;
	}

	/**
	 * @returns { TestCaseResult[] } The afterEach() blocks for this test.
	 */
	get afterEach(): TestCaseResult[] {
		return this._afterEach;
	}

	/**
	 * @returns {string} A short description of the reason this test failed. If the error is an Error instance, it's
	 *   equal to the error's `message` property. Otherwise, the error is converted to a string using `util.inspect()`.
	 * @throws {Error} Throws an error if this test didn't fail.
	 */
	get errorMessage(): string {
		ensure.that(this.isFail(), "Attempted to retrieve error message from a test that didn't fail");
		return this._errorMessage!;
	}

	/**
	 * @returns {unknown} The complete rendering of the reason this test failed. May be of any type, depending on how
	 *   `renderError()` in TestOptions is defined, but it defaults to a string.
	 * @throws {Error} Throws an error if this test didn't fail.
	 */
	get errorRender(): unknown {
		ensure.that(this.isFail(), "Attempted to retrieve error render from a test that didn't fail");
		return this._errorRender!;
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
	 * @returns {boolean} True if this test passed.
	 */
	isPass(): boolean {
		ensure.signature(arguments, []);
		return this.status === TestStatus.pass;
	}

	/**
	 * @returns {boolean} True if this test failed.
	 */
	isFail(): boolean {
		ensure.signature(arguments, []);
		return this.status === TestStatus.fail;
	}

	/**
	 * @returns {boolean} True if this test was skipped.
	 */
	isSkip(): boolean {
		ensure.signature(arguments, []);
		return this.status === TestStatus.skip;
	}

	/**
	 * @returns {boolean} True if this test timed out.
	 */
	isTimeout(): boolean {
		ensure.signature(arguments, []);
		return this.status === TestStatus.timeout;
	}

	/**
	 * Render the test case as a single color-coded character.
	 *
	 * This is a convenience method that calls {@link TestRenderer.renderAsCharacters()}. For more control over rendering,
	 * use that class instead.
	 *
	 * @returns The formatted character.
	 */
	renderAsCharacter(): string {
		ensure.signature(arguments, []);

		return TestRenderer.create().renderAsCharacters(this);
	}

	/**
	 * Render the test case as a single line containing its status (pass, fail, etc.) and names.
	 *
	 * This is a convenience method that calls {@link TestRenderer.renderAsSingleLines()}. For more control over
	 * rendering, use that class instead.
	 *
	 * @returns The formatted line.
	 */
	renderAsSingleLine(): string {
		ensure.signature(arguments, []);

		return TestRenderer.create().renderAsSingleLines(this);
	}

	/**
	 * Render the test case as a multiple lines containing all of its details.
	 *
	 * This is a convenience method that calls {@link TestRenderer.renderAsMultipleLines()}. For more control over
	 * rendering, use that class instead.
	 *
	 * @returns The formatted lines.
	 */
	renderAsMultipleLines(): string {
		ensure.signature(arguments, []);

		return TestRenderer.create().renderAsMultipleLines(this);
	}

	/**
	 * @returns {TestCaseResult[]} This test converted into a list of one.
	 */
	allTests(): TestCaseResult[] {
		ensure.signature(arguments, []);
		return [ this ];
	}

	allMatchingMarks(...marks: TestMarkValue[]): TestResult[] {
		ensureValidMarks(marks);

		if (marks.includes(this._mark)) return [ this ];
		else return [];
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
			mark: this._mark,
			filename: this._filename,
			status: this._status,
			errorMessage: this._errorMessage,
			errorRender: this._errorRender,
			timeout: this._timeout,
			beforeEach: this._beforeEach,
			afterEach: this._afterEach,
		};
	}

	equals(that: TestResult): boolean {
		if (!(that instanceof TestCaseResult)) return false;

		const sameName = util.isDeepStrictEqual(this._name, that._name);
		const sameError = this._errorMessage === that._errorMessage;

		return sameName &&
			sameError &&
			this._status === that._status &&
			this._mark === that._mark &&
			this._timeout === that._timeout &&
			this.filename === that.filename;
	}

}

function ensureValidMarks(marks: TestMarkValue[]) {
	const validMarks = Object.values(TestMark);
	marks.forEach((mark, i) => {
		ensure.that(validMarks.includes(mark), `Argument #${i} was '${mark}', which isn't a valid mark`);
	});
}