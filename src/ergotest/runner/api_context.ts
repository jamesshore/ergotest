// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import * as ensure from "../../util/ensure.js";
import { TestCaseResult, TestMark, TestMarkValue } from "../results/test_result.js";
import { TestSuite } from "../tests/test_suite.js";
import { FailureTestCase, TestCase } from "../tests/test_case.js";
import { BeforeAfter } from "../tests/before_after.js";
import { DescribeFn, DescribeOptions, ItFn, ItOptions, Milliseconds } from "./test_api.js";
import { Test } from "../tests/test.js";
import path from "node:path";

export class ApiContext {
	private readonly _context: TestSuiteBuilder[] = [];
	private _inSetupModule = false;

	async loadSuiteAsync(
		setupModuleFilenames: string[],
		testModuleFilenames: string[],
	) {
		const builder = new TestSuiteBuilder([], TestMark.none);

		this._context.push(builder);
		this._inSetupModule = true;
		try {
			await loadSetupModulesAsync(setupModuleFilenames, builder);
		}
		finally {
			this._inSetupModule = false;
			this._context.pop();
		}

		await Promise.all(testModuleFilenames.map(async (filename) => {
			const suite = await loadTestModuleAsync(filename);
			builder.addTest(suite);
			builder.setFilename(filename);
		}));

		return builder.toTestSuite();
	}

	describe(
		optionalName: string | DescribeOptions | DescribeFn | undefined,
		optionalOptions: DescribeOptions | DescribeFn | undefined,
		optionalFn: DescribeFn | undefined,
		mark: TestMarkValue,
	) {
		this.#ensureCorrectContext("describe");

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

		if (this._context.length !== 0) this.#top.addTest(suite);
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
		this.#ensureCorrectContext("it");
		const { options, fnAsync } = decipherItParameters(name, optionalOptions, possibleFnAsync);
		if (name === "") name = "(unnamed)";

		this.#top.it(this.#fullName(name), mark, options, fnAsync);
	}

	beforeAll(optionalOptions: ItOptions | ItFn, possibleFnAsync?: ItFn) {
		this.#ensureCorrectContext("beforeAll");
		const { options, fnAsync } = decipherBeforeAfterParameters(optionalOptions, possibleFnAsync);

		this.#top.beforeAll(this.#fullName(), options, fnAsync);
	}

	afterAll(optionalOptions: ItOptions | ItFn, possibleFnAsync?: ItFn) {
		this.#ensureCorrectContext("afterAll");
		const { options, fnAsync } = decipherBeforeAfterParameters(optionalOptions, possibleFnAsync);

		this.#top.afterAll(this.#fullName(), options, fnAsync);
	}

	beforeEach(optionalOptions: ItOptions | ItFn, possibleFnAsync?: ItFn) {
		this.#ensureCorrectContext("beforeEach");
		const { options, fnAsync } = decipherBeforeAfterParameters(optionalOptions, possibleFnAsync);

		this.#top.beforeEach(this.#fullName(), options, fnAsync);
	}

	afterEach(optionalOptions: ItOptions | ItFn, possibleFnAsync?: ItFn) {
		this.#ensureCorrectContext("afterEach");
		const { options, fnAsync } = decipherBeforeAfterParameters(optionalOptions, possibleFnAsync);

		this.#top.afterEach(this.#fullName(), options, fnAsync);
	}

	#ensureCorrectContext(functionName: string) {
		if (this._inSetupModule) {
			ensure.that(
				functionName !== "describe" && functionName !== "it",
				`${functionName}() is not permitted in setup modules`
			);
		}
		else {
			ensure.that(
				functionName === "describe" || this._context.length > 0,
				`${functionName}() must be run inside describe()`
			);
		}
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
	private _tests: Test[] = [];
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

	addBeforeAll(beforeAll: BeforeAfter) {
		this._beforeAll.push(beforeAll);
	}

	addTest(test: Test) {
		this._tests.push(test);
	}

	setFilename(filename: string) {
		const allChildren = [
			...this._tests, ...this._beforeAll, ...this._afterAll, ...this._beforeEach, ...this._afterEach
		];
		allChildren.forEach(child => child._setFilename(filename));
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


async function loadSetupModulesAsync(setupModuleFilenames: string[], builder: TestSuiteBuilder) {
	let skipRemaining = false;
	for await (const filename of setupModuleFilenames) {
		let beforeAll;

		if (skipRemaining) {
			beforeAll = BeforeAfter.create({
				name: [ "load setup module" ],
				fnAsync() {},
			});
		}
		else {
			const { suite, err } = await loadModuleAsync(filename, "Setup module");

			if (err !== undefined) {
				skipRemaining = true;
				beforeAll = BeforeAfter.create({
					name: [ `error when importing setup module ${path.basename(filename)}` ],
					fnAsync() { throw err; },
				});
			}
			else {
				beforeAll = BeforeAfter.create({
					name: [ "loaded setup module" ],
					fnAsync() {}
				});
			}
		}

		builder.addBeforeAll(beforeAll);
		builder.setFilename(filename);
	}
}

async function loadTestModuleAsync(filename: string): Promise<Test> {
	const description = "Test module";

	const { suite, err } = await loadModuleAsync(filename, description);

	if (err !== undefined) {
		return TestCase.create({
			name: [ `error when importing test module ${path.basename(filename)}` ],
			fnAsync() { throw err; },
		});
	}
	else if (suite instanceof TestSuite || suite! instanceof TestCase) {
		return suite;
	}
	else {
		return createModuleLoadFailure(`Test module doesn't export a test suite: ${filename}`, filename, description);
	}

}

async function loadModuleAsync(filename: string, description: string): Promise<{ suite: TestSuite, err?: undefined } | { err: unknown, suite?: undefined }> {
	if (!path.isAbsolute(filename)) {
		return { err: `${description} filenames must use absolute paths: ${filename}` };
	}
	try {
		const { default: suite } = await import(filename);
		return { suite };
	}
	catch(err) {
		return { err };
	}
}

function createModuleLoadFailure(error: unknown, filename: string, description: string): FailureTestCase {
	const name = `error when importing ${description.toLowerCase()} ${path.basename(filename)}`;
	return new FailureTestCase([ name ], error);
}
