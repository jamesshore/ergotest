// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import * as ensure from "../../util/ensure.js";
import { Milliseconds, Test } from "./test.js";
import { TestMark, TestMarkValue } from "../results/test_result.js";
import { TestSuite } from "./test_suite.js";
import { FailureTestCase, TestCase } from "./test_case.js";
import { BeforeAfter } from "./before_after.js";

export interface DescribeOptions {
	timeout?: Milliseconds,
}

export interface ItOptions {
	timeout?: Milliseconds,
}

export type DescribeFn = () => void;

export type ItFn = (testUtilities: {
	getConfig: <T>(key: string) => T,
}) => Promise<void> | void;

export class ApiContext {
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
		const fullName = this.#fullName(name);

		const suite = fn === undefined
			? createSkippedSuite(fullName, mark)
			: runDescribeBlock(this._context, fullName, mark, fn);

		if (this._context.length !== 0) this.#top.addSuite(suite);
		return suite;

		function runDescribeBlock(context: TestSuiteBuilder[], fullName: string[], mark: TestMarkValue, fn: DescribeFn) {
			const builder = new TestSuiteBuilder(fullName, mark, options.timeout);
			context.push(builder);
			try {
				fn();
			}
			finally {
				context.pop();
			}
			return builder.toTestSuite();
		}

		function createSkippedSuite(name: string[], mark: TestMarkValue) {
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
		if (name === "") name = "(unnamed)";

		this.#top.it(this.#fullName(name), mark, options, fnAsync);
	}

	beforeAll(optionalOptions: ItOptions | ItFn, possibleFnAsync?: ItFn) {
		this.#ensureInsideDescribe("beforeAll");
		const { options, fnAsync } = decipherBeforeAfterParameters(optionalOptions, possibleFnAsync);

		this.#top.beforeAll(this.#fullName(), options, fnAsync);
	}

	afterAll(optionalOptions: ItOptions | ItFn, possibleFnAsync?: ItFn) {
		this.#ensureInsideDescribe("afterAll");
		const { options, fnAsync } = decipherBeforeAfterParameters(optionalOptions, possibleFnAsync);

		this.#top.afterAll(this.#fullName(), options, fnAsync);
	}

	beforeEach(optionalOptions: ItOptions | ItFn, possibleFnAsync?: ItFn) {
		this.#ensureInsideDescribe("beforeEach");
		const { options, fnAsync } = decipherBeforeAfterParameters(optionalOptions, possibleFnAsync);

		this.#top.beforeEach(this.#fullName(), options, fnAsync);
	}

	afterEach(optionalOptions: ItOptions | ItFn, possibleFnAsync?: ItFn) {
		this.#ensureInsideDescribe("afterEach");
		const { options, fnAsync } = decipherBeforeAfterParameters(optionalOptions, possibleFnAsync);

		this.#top.afterEach(this.#fullName(), options, fnAsync);
	}

	#ensureInsideDescribe(functionName: string) {
		ensure.that(this._context.length > 0, `${functionName}() must be run inside describe()`);
	}

	get #top() {
		return this._context[this._context.length - 1];
	}

	#fullName(name = "") {
		const topName = this._context.length === 0 ? [] : this.#top.name;
		return name === "" ? topName : [ ...topName, name ];
	}

}

class TestSuiteBuilder {
	private readonly _name: string[];
	private readonly _mark: TestMarkValue;
	private readonly _timeout?: Milliseconds;
	private readonly _tests: Test[] = [];
	private readonly _beforeAll: BeforeAfter[] = [];
	private readonly _afterAll: BeforeAfter[] = [];
	private readonly _beforeEach: BeforeAfter[] = [];
	private readonly _afterEach: BeforeAfter[] = [];

	constructor(name: string[], mark: TestMarkValue, timeout?: Milliseconds) {
		this._name = name;
		this._mark = mark;
		this._timeout = timeout;
	}

	public get name() {
		return this._name;
	}

	addSuite(suite: TestSuite) {
		this._tests.push(suite);
	}

	it(name: string[], mark: TestMarkValue, options: ItOptions, fnAsync?: ItFn) {
		this._tests.push(TestCase.create({ name, mark, options, fnAsync }));
	}

	beforeAll(parentName: string[], options: ItOptions, fnAsync: ItFn) {
		const name = this.#beforeAfterName(parentName, this._beforeAll, "beforeAll()");
		this._beforeAll.push(BeforeAfter.create({ name, options, fnAsync }));
	}

	afterAll(parentName: string[], options: ItOptions, fnAsync: ItFn) {
		const name = this.#beforeAfterName(parentName, this._afterAll, "afterAll()");
		this._afterAll.push(BeforeAfter.create({ name, options, fnAsync }));
	}

	beforeEach(parentName: string[], options: ItOptions, fnAsync: ItFn) {
		const name = this.#beforeAfterName(parentName, this._beforeEach, "beforeEach()");
		this._beforeEach.push(BeforeAfter.create({ name, options, fnAsync }));
	}

	afterEach(parentName: string[], options: ItOptions, fnAsync: ItFn) {
		const name = this.#beforeAfterName(parentName, this._afterEach, "afterEach()");
		this._afterEach.push(BeforeAfter.create({ name, options, fnAsync }));
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

	#beforeAfterName(parentName: string[], beforeAfterArray: BeforeAfter[], baseName: string) {
		const number = beforeAfterArray.length === 0 ? "" : ` #${beforeAfterArray.length + 1}`;
		return [ ...parentName, baseName + number];
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

const testContext = new ApiContext();
