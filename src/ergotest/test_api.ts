// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { TestMark, TestMarkValue } from "./results/test_result.js";
import * as ensure from "../util/ensure.js";
import { FailureTestCase, TestCase } from "./suite/test_case.js";
import { Milliseconds, Test } from "./suite/test.js";
import { TestSuite } from "./suite/test_suite.js";
import { BeforeAfter, BeforeAfterDefinition } from "./suite/before_after.js";

export interface DescribeOptions {
	timeout?: Milliseconds,
}

export interface ItOptions {
	timeout?: Milliseconds,
}

export type DescribeFn = () => void;

export type ItFn = (testUtilities: TestParameters) => Promise<void> | void;

interface TestParameters {
	getConfig: <T>(key: string) => T,
}

/**
 * Defines a test suite. Add `.skip` to skip this test suite and `.only` to only run this test suite.
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
	return testContext.describe(optionalName, optionalOptions, fn, TestMark.none);
}

describe.skip = function(
	optionalName?: string | DescribeOptions | DescribeFn,
	optionalOptions?: DescribeOptions | DescribeFn,
	fn?: DescribeFn,
) {
	return testContext.describe(optionalName, optionalOptions, fn, TestMark.skip);
};

describe.only = function(
	optionalName?: string | DescribeOptions | DescribeFn,
	optionalOptions?: DescribeOptions | DescribeFn,
	fn?: DescribeFn,
) {
	return testContext.describe(optionalName, optionalOptions, fn, TestMark.only);
};

/**
 * Adds a test to the current test suite. Must be run inside of a {@link test} or {@link describe} function. Add
 * `.skip` to skip this test and `.only` to only run this test.
 * @param {string} name The name of the test.
 * @param {ItOptions} [optionalOptions] The test options. You can skip this parameter and pass {@link fnAsync} instead.
 * @param {function} [fnAsync] The body of the test. May be synchronous or asynchronous. If undefined, this test will be
 *   skipped.
 */
export function it(name: string, optionalOptions?: ItOptions | ItFn, fnAsync?: ItFn) {
	testContext.it(name, optionalOptions, fnAsync, TestMark.none);
}

it.skip = function it(name: string, optionalOptions?: ItOptions | ItFn, fnAsync?: ItFn) {
	testContext.it(name, optionalOptions, fnAsync, TestMark.skip);
};

it.only = function it(name: string, optionalOptions?: ItOptions | ItFn, fnAsync?: ItFn) {
	testContext.it(name, optionalOptions, fnAsync, TestMark.only);
};

/**
 * Adds a function to run before all the tests in the current test suite. Must be run inside of a {@link test} or
 * {@link describe} function.
 * @param {ItOptions} [optionalOptions] The before/after options. You can skip this parameter and pass @{link fnAsync}
 *   instead.
 * @param {function} fnAsync The function to run. May be synchronous or asynchronous.
 */
export function beforeAll(optionalOptions: ItOptions | ItFn, fnAsync?: ItFn) {
	testContext.beforeAll(optionalOptions, fnAsync);
}

/**
 * Adds a function to run after all the tests in the current test suite. Must be run inside of a {@link test} or
 * {@link describe} function.
 * @param {ItOptions} [optionalOptions] The before/after options. You can skip this parameter and pass @{link fnAsync}
 *   instead.
 * @param {function} [fnAsync] The function to run. May be synchronous or asynchronous.
 */
export function afterAll(optionalOptions: ItOptions | ItFn, fnAsync?: ItFn) {
	testContext.afterAll(optionalOptions, fnAsync);
}

/**
 * Adds a function to run bfeore each of the tests in the current test suite. Must be run inside of a {@link test} or
 * {@link describe} function.
 * @param {ItOptions} [optionalOptions] The before/after options. You can skip this parameter and pass @{link fnAsync}
 *   instead.
 * @param {function} [fnAsync] The function to run. May be synchronous or asynchronous.
 */
export function beforeEach(optionalOptions: ItOptions | ItFn, fnAsync?: ItFn) {
	testContext.beforeEach(optionalOptions, fnAsync);
}

/**
 * Adds a function to run after each of the tests in the current test suite. Must be run inside of a {@link test} or
 * {@link describe} function.
 * @param {ItOptions} [optionalOptions] The before/after options. You can skip this parameter and pass @{link fnAsync}
 *   instead.
 * @param {function} [fnAsync] The function to run. May be synchronous or asynchronous.
 */
export function afterEach(optionalOptions: ItOptions | ItFn, fnAsync?: ItFn) {
	testContext.afterEach(optionalOptions, fnAsync);
}


class ContextStack {
	private readonly _context: TestSuiteBuilder[] = [];

	describe(
		optionalName: string | DescribeOptions | DescribeFn | undefined,
		optionalOptions: DescribeOptions | DescribeFn | undefined,
		optionalFn: DescribeFn | undefined,
		mark: TestMarkValue,
	) {
		const DescribeOptionsType = { timeout: Number };
		ensure.signature(arguments, [
			[ undefined, DescribeOptionsType, String, Function ],
			[ undefined, DescribeOptionsType, Function ],
			[ undefined, Function ],
			String,
		]);
		const { name, options, fn } = decipherDescribeParameters(optionalName, optionalOptions, optionalFn);

		const suite = fn === undefined
			? createSkippedSuite(name, mark)
			: runDescribeBlock(this._context, name, mark, fn);

		if (this._context.length !== 0) this.#top.addSuite(suite);
		return suite;

		function runDescribeBlock(context: TestSuiteBuilder[], name: string, mark: TestMarkValue, fn: DescribeFn) {
			const builder = new TestSuiteBuilder(name, mark, options.timeout);
			context.push(builder);
			try {
				fn();
				return builder.toTestSuite();
			}
			finally {
				context.pop();
			}
		}

		function createSkippedSuite(name: string, mark: TestMarkValue) {
			if (mark === TestMark.only) {
				return TestSuite.create({
					name,
					mark,
					tests: [ new FailureTestCase(name, "Test suite is marked '.only', but it has no body") ],
				});
			}
			else {
				return TestSuite.create({
					name,
					mark: TestMark.skip,
				});
			}
		}
	}

	it(
		name: string,
		optionalOptions: ItOptions | ItFn | undefined,
		possibleFnAsync: ItFn | undefined,
		mark: TestMarkValue
	) {
		this.#ensureInsideDescribe("it");
		const { options, fnAsync } = decipherItParameters(name, optionalOptions, possibleFnAsync);

		this.#top.it(name, mark, options, fnAsync);
	}

	beforeAll(optionalOptions: ItOptions | ItFn, possibleFnAsync?: ItFn) {
		this.#ensureInsideDescribe("beforeAll");
		const { options, fnAsync } = decipherBeforeAfterParameters(optionalOptions, possibleFnAsync);

		this.#top.beforeAll(options, fnAsync);
	}

	afterAll(optionalOptions: ItOptions | ItFn, possibleFnAsync?: ItFn) {
		this.#ensureInsideDescribe("afterAll");
		const { options, fnAsync } = decipherBeforeAfterParameters(optionalOptions, possibleFnAsync);

		this.#top.afterAll(options, fnAsync);
	}

	beforeEach(optionalOptions: ItOptions | ItFn, possibleFnAsync?: ItFn) {
		this.#ensureInsideDescribe("beforeEach");
		const { options, fnAsync } = decipherBeforeAfterParameters(optionalOptions, possibleFnAsync);

		this.#top.beforeEach(options, fnAsync);
	}

	afterEach(optionalOptions: ItOptions | ItFn, possibleFnAsync?: ItFn) {
		this.#ensureInsideDescribe("afterEach");
		const { options, fnAsync } = decipherBeforeAfterParameters(optionalOptions, possibleFnAsync);

		this.#top.afterEach(options, fnAsync);
	}

	#ensureInsideDescribe(functionName: string) {
		ensure.that(this._context.length > 0, `${functionName}() must be run inside describe()`);
	}

	get #top() {
		return this._context[this._context.length - 1];
	}

}

class TestSuiteBuilder {
	private readonly _name: string;
	private readonly _mark: TestMarkValue;
	private readonly _timeout?: Milliseconds;
	private readonly _tests: Test[] = [];
	private readonly _beforeAll: BeforeAfterDefinition[] = [];
	private readonly _afterAll: BeforeAfterDefinition[] = [];
	private readonly _beforeEach: BeforeAfterDefinition[] = [];
	private readonly _afterEach: BeforeAfterDefinition[] = [];

	constructor(name = "", mark: TestMarkValue = TestMark.none, timeout?: Milliseconds) {
		this._name = name;
		this._mark = mark;
		this._timeout = timeout;
	}

	addSuite(suite: TestSuite) {
		this._tests.push(suite);
	}

	it(name: string, mark: TestMarkValue, options: ItOptions, fnAsync?: ItFn) {
		this._tests.push(TestCase.create({ name, mark, options, fnAsync }));
	}

	beforeAll(options: ItOptions, fnAsync: ItFn) {
		this._beforeAll.push(BeforeAfter.create({ options, fnAsync }));
	}

	afterAll(options: ItOptions, fnAsync: ItFn) {
		this._afterAll.push(BeforeAfter.create({ options, fnAsync }));
	}

	beforeEach(options: ItOptions, fnAsync: ItFn) {
		this._beforeEach.push(BeforeAfter.create({ options, fnAsync }));
	}

	afterEach(options: ItOptions, fnAsync: ItFn) {
		this._afterEach.push(BeforeAfter.create({ options, fnAsync }));
	}

	toTestSuite(): TestSuite {
		return TestSuite.create({
			name: this._name,
			mark: this._mark,
			timeout: this._timeout,
			beforeAll: this._beforeAll,
			afterAll: this._afterAll,
			beforeEach: this._beforeEach,
			afterEach: this._afterEach,
			tests: this._tests,
		});
	}
}

function decipherDescribeParameters(
	nameOrOptionsOrDescribeFn: string | DescribeOptions | DescribeFn | undefined,
	optionsOrDescribeFn: DescribeOptions | DescribeFn | undefined,
	possibleDescribeFn: DescribeFn | undefined,
) {
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

function decipherBeforeAfterParameters(optionalOptions: ItOptions | ItFn, possibleFnAsync?: ItFn) {
	ensure.signature(arguments, [
		[ { timeout: Number }, Function ],
		[ undefined, Function ],
	]);

	let options: ItOptions;
	let fnAsync: ItFn;

	if (possibleFnAsync === undefined) {
		options = {};
		fnAsync = optionalOptions as ItFn;
	}
	else {
		options = optionalOptions as ItOptions;
		fnAsync = possibleFnAsync;
	}

	return { options, fnAsync };
}

function decipherItParameters(
	name: string,
	optionsOrTestFn?: ItOptions | ItFn,
	possibleTestFn?: ItFn,
) {
	ensure.signature(arguments, [
		String,
		[ undefined, { timeout: [ undefined, Number ]}, Function ],
		[ undefined, Function ],
	]);

	let options = {};
	let fnAsync;

	switch (typeof optionsOrTestFn) {
		case "object":
			options = optionsOrTestFn;
			break;
		case "function":
			fnAsync = optionsOrTestFn;
			break;
		case "undefined":
			break;
		default:
			ensure.unreachable(`Unknown typeof optionsOrTestFn: ${typeof optionsOrTestFn}`);
	}
	if (possibleTestFn !== undefined) {
		ensure.that(fnAsync === undefined, "Received two test function parameters");
		fnAsync = possibleTestFn;
	}

	return { options, fnAsync };
}

const testContext = new ContextStack();
