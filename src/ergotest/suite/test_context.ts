// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { TestMark, TestMarkValue } from "../results/test_result.js";
import { DescribeFn, DescribeOptions, ItFn, ItOptions, TestSuite } from "./test_suite.js";
import { Milliseconds, Test } from "./test.js";
import { BeforeAfterDefinition } from "./runnable_function.js";
import { FailureTestCase, TestCase } from "./test_case.js";
import * as ensure from "../../util/ensure.js";

type BeforeAfter = (optionalOptions: ItOptions | ItFn, fnAsync?: ItFn) => void;

type TestContextConstructorParams = {
	name: string,
	mark: TestMarkValue,
	timeout?: Milliseconds,
	contextArray: TestContext[],

	beforeAll?: BeforeAfter,
	afterAll?: BeforeAfter,
	beforeEach?: BeforeAfter,
	afterEach?: BeforeAfter,
};

export class TestContext {
	private readonly _name: string;
	private readonly _mark: TestMarkValue;
	private readonly _timeout?: Milliseconds;
	private readonly _contextArray: TestContext[];
	private readonly _tests: Test[] = [];
	private readonly _beforeAll: BeforeAfterDefinition[] = [];
	private readonly _afterAll: BeforeAfterDefinition[] = [];
	private readonly _beforeEach: BeforeAfterDefinition[] = [];
	private readonly _afterEach: BeforeAfterDefinition[] = [];

	static create(options: TestContextConstructorParams) {
		return new TestContext(options);
	}

	constructor({
		name,
		mark,
		timeout,
		contextArray,
	}: TestContextConstructorParams) {
		this._name = name;
		this._mark = mark;
		this._timeout = timeout;
		this._contextArray = contextArray;
	}

	describe(
		optionalName: string | DescribeOptions | DescribeFn | undefined,
		optionalOptions: DescribeOptions | DescribeFn | undefined,
		fn: DescribeFn | undefined,
		mark: TestMarkValue)
	{
		const suite = describe2(optionalName, optionalOptions, fn, mark, this._contextArray);
		this._tests.push(suite);
		return suite;
	}

	it(
		name: string,
		optionalOptions: ItOptions | ItFn | undefined,
		itFn: ItFn | undefined,
		mark: TestMarkValue,
	): void {
		this._tests.push(TestCase.create(name, optionalOptions, itFn, mark));
	}

	beforeAll(optionsOrFnAsync: ItOptions | ItFn, possibleFnAsync?: ItFn) {
		this.#checkBeforeAfterArguments(arguments);
		this.#doTheThing(this._beforeAll, optionsOrFnAsync, possibleFnAsync);
	}

	afterAll(optionsOrFnAsync: ItOptions | ItFn, possibleFnAsync?: ItFn) {
		this.#checkBeforeAfterArguments(arguments);
		this.#doTheThing(this._afterAll, optionsOrFnAsync, possibleFnAsync);
	}

	beforeEach(optionsOrFnAsync: ItOptions | ItFn, possibleFnAsync?: ItFn) {
		this.#checkBeforeAfterArguments(arguments);
		this.#doTheThing(this._beforeEach, optionsOrFnAsync, possibleFnAsync);
	}

	afterEach(optionsOrFnAsync: ItOptions | ItFn, possibleFnAsync?: ItFn) {
		this.#checkBeforeAfterArguments(arguments);
		this.#doTheThing(this._afterEach, optionsOrFnAsync, possibleFnAsync);
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

	#checkBeforeAfterArguments(args: IArguments) {
		ensure.signature(args, [
			[ { timeout: Number }, Function ],
			[ undefined, Function ],
		]);
	}

	#doTheThing(fns: BeforeAfterDefinition[], optionsOrFnAsync: ItOptions | ItFn, possibleFnAsync?: ItFn) {
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

		fns.push({ options, fnAsync });
	}
}


/** Internal use only. */
export function describe2(
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
		const context = TestContext.create({
			name,
			mark,
			timeout: options.timeout,
			contextArray: testContext,
		});

		testContext.push(context);
		try {
			fn();
			return context.toTestSuite();
		}
		finally {
			testContext.pop();
		}
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
