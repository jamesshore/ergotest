// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import * as ensure from "../../util/ensure.js";
import { TestMark } from "../results/test_result.js";
import { TestSuite } from "../tests/test_suite.js";
import { FailureTestCase, TestCase } from "../tests/test_case.js";
import { BeforeAfter } from "../tests/before_after.js";
import path from "node:path";
export class ApiContext {
    _context = [];
    _inSetupModule = false;
    async loadSuiteAsync(setupModuleFilenames, testModuleFilenames) {
        const builder = new TestSuiteBuilder([], TestMark.none);
        this._context.push(builder);
        this._inSetupModule = true;
        try {
            await Promise.all(setupModuleFilenames.map(async (filename)=>{
                const errorSuite = await loadSetupModuleAsync(filename);
                if (errorSuite !== undefined) builder.addTest(errorSuite);
                builder.setFilename(filename);
            }));
        } finally{
            this._inSetupModule = false;
            this._context.pop();
        }
        await Promise.all(testModuleFilenames.map(async (filename)=>{
            const suite = await loadTestModuleAsync(filename);
            builder.addTest(suite);
            builder.setFilename(filename);
        }));
        return builder.toTestSuite();
    }
    describe(optionalName, optionalOptions, optionalFn, mark) {
        this.#ensureCorrectContext("describe");
        const DescribeOptionsType = {
            timeout: Number
        };
        ensure.signature(arguments, [
            [
                undefined,
                DescribeOptionsType,
                String,
                Function
            ],
            [
                undefined,
                DescribeOptionsType,
                Function
            ],
            [
                undefined,
                Function
            ],
            String
        ]);
        const { name, options, fn } = decipherDescribeParameters(optionalName, optionalOptions, optionalFn);
        const fullName = this.#fullName(name);
        const suite = fn === undefined ? createSkippedSuite(fullName, mark) : runDescribeBlock(this._context, fullName, mark, fn);
        if (this._context.length !== 0) this.#top.addTest(suite);
        return suite;
        function runDescribeBlock(context, fullName, mark, fn) {
            const builder = new TestSuiteBuilder(fullName, mark, options.timeout);
            context.push(builder);
            try {
                fn();
            } finally{
                context.pop();
            }
            return builder.toTestSuite();
        }
        function createSkippedSuite(name, mark) {
            if (mark === TestMark.only) {
                return TestSuite.create({
                    name,
                    mark,
                    tests: [
                        new FailureTestCase(name, "Test suite is marked '.only', but it has no body")
                    ]
                });
            } else {
                return TestSuite.create({
                    name,
                    mark: TestMark.skip
                });
            }
        }
    }
    it(name, optionalOptions, possibleFnAsync, mark) {
        this.#ensureCorrectContext("it");
        const { options, fnAsync } = decipherItParameters(name, optionalOptions, possibleFnAsync);
        if (name === "") name = "(unnamed)";
        this.#top.it(this.#fullName(name), mark, options, fnAsync);
    }
    beforeAll(optionalOptions, possibleFnAsync) {
        this.#ensureCorrectContext("beforeAll");
        const { options, fnAsync } = decipherBeforeAfterParameters(optionalOptions, possibleFnAsync);
        this.#top.beforeAll(this.#fullName(), options, fnAsync);
    }
    afterAll(optionalOptions, possibleFnAsync) {
        this.#ensureCorrectContext("afterAll");
        const { options, fnAsync } = decipherBeforeAfterParameters(optionalOptions, possibleFnAsync);
        this.#top.afterAll(this.#fullName(), options, fnAsync);
    }
    beforeEach(optionalOptions, possibleFnAsync) {
        this.#ensureCorrectContext("beforeEach");
        const { options, fnAsync } = decipherBeforeAfterParameters(optionalOptions, possibleFnAsync);
        this.#top.beforeEach(this.#fullName(), options, fnAsync);
    }
    afterEach(optionalOptions, possibleFnAsync) {
        this.#ensureCorrectContext("afterEach");
        const { options, fnAsync } = decipherBeforeAfterParameters(optionalOptions, possibleFnAsync);
        this.#top.afterEach(this.#fullName(), options, fnAsync);
    }
    #ensureCorrectContext(functionName) {
        if (this._inSetupModule) {
            ensure.that(functionName !== "describe" && functionName !== "it", `${functionName}() is not permitted in setup modules`);
        } else {
            ensure.that(functionName === "describe" || this._context.length > 0, `${functionName}() must be run inside describe()`);
        }
    }
    get #top() {
        return this._context[this._context.length - 1];
    }
    #fullName(name = "") {
        const topName = this._context.length === 0 ? [] : this.#top.name;
        return name === "" ? topName : [
            ...topName,
            name
        ];
    }
}
class TestSuiteBuilder {
    _name;
    _mark;
    _timeout;
    _tests = [];
    _beforeAll = [];
    _afterAll = [];
    _beforeEach = [];
    _afterEach = [];
    constructor(name, mark, timeout){
        this._name = name;
        this._mark = mark;
        this._timeout = timeout;
    }
    get name() {
        return this._name;
    }
    addTest(test) {
        this._tests.push(test);
    }
    setFilename(filename) {
        const allChildren = [
            ...this._tests,
            ...this._beforeAll,
            ...this._afterAll,
            ...this._beforeEach,
            ...this._afterEach
        ];
        allChildren.forEach((child)=>child._setFilename(filename));
    }
    it(name, mark, options, fnAsync) {
        this._tests.push(TestCase.create({
            name,
            mark,
            options,
            fnAsync
        }));
    }
    beforeAll(parentName, options, fnAsync) {
        const name = this.#beforeAfterName(parentName, this._beforeAll, "beforeAll()");
        this._beforeAll.push(BeforeAfter.create({
            name,
            options,
            fnAsync
        }));
    }
    afterAll(parentName, options, fnAsync) {
        const name = this.#beforeAfterName(parentName, this._afterAll, "afterAll()");
        this._afterAll.push(BeforeAfter.create({
            name,
            options,
            fnAsync
        }));
    }
    beforeEach(parentName, options, fnAsync) {
        const name = this.#beforeAfterName(parentName, this._beforeEach, "beforeEach()");
        this._beforeEach.push(BeforeAfter.create({
            name,
            options,
            fnAsync
        }));
    }
    afterEach(parentName, options, fnAsync) {
        const name = this.#beforeAfterName(parentName, this._afterEach, "afterEach()");
        this._afterEach.push(BeforeAfter.create({
            name,
            options,
            fnAsync
        }));
    }
    toTestSuite() {
        return TestSuite.create({
            name: this._name,
            mark: this._mark,
            timeout: this._timeout,
            beforeAll: this._beforeAll,
            afterAll: this._afterAll,
            beforeEach: this._beforeEach,
            afterEach: this._afterEach,
            tests: this._tests
        });
    }
    #beforeAfterName(parentName, beforeAfterArray, baseName) {
        const number = beforeAfterArray.length === 0 ? "" : ` #${beforeAfterArray.length + 1}`;
        return [
            ...parentName,
            baseName + number
        ];
    }
}
function decipherDescribeParameters(nameOrOptionsOrDescribeFn, optionsOrDescribeFn, possibleDescribeFn) {
    let name;
    let options;
    let fn;
    switch(typeof nameOrOptionsOrDescribeFn){
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
    switch(typeof optionsOrDescribeFn){
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
    return {
        name,
        options,
        fn
    };
}
function decipherBeforeAfterParameters(optionalOptions, possibleFnAsync) {
    ensure.signature(arguments, [
        [
            {
                timeout: Number
            },
            Function
        ],
        [
            undefined,
            Function
        ]
    ]);
    let options;
    let fnAsync;
    if (possibleFnAsync === undefined) {
        options = {};
        fnAsync = optionalOptions;
    } else {
        options = optionalOptions;
        fnAsync = possibleFnAsync;
    }
    return {
        options,
        fnAsync
    };
}
function decipherItParameters(name, optionsOrTestFn, possibleTestFn) {
    ensure.signature(arguments, [
        String,
        [
            undefined,
            {
                timeout: [
                    undefined,
                    Number
                ]
            },
            Function
        ],
        [
            undefined,
            Function
        ]
    ]);
    let options = {};
    let fnAsync;
    switch(typeof optionsOrTestFn){
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
    return {
        options,
        fnAsync
    };
}
async function loadSetupModuleAsync(setupModulePath) {
    return await loadModuleAsync(setupModulePath, "Setup module");
}
async function loadTestModuleAsync(filename) {
    const description = "Test module";
    const test = await loadModuleAsync(filename, description);
    if (test instanceof TestSuite || test instanceof TestCase) {
        return test;
    } else {
        return createModuleLoadFailure(`Test module doesn't export a test suite: ${filename}`, filename, description);
    }
}
async function loadModuleAsync(filename, description) {
    if (!path.isAbsolute(filename)) {
        return createModuleLoadFailure(`${description} filenames must use absolute paths: ${filename}`, filename, description);
    }
    try {
        const { default: suite } = await import(filename);
        return suite;
    } catch (err) {
        return createModuleLoadFailure(err, filename, description);
    }
}
function createModuleLoadFailure(error, filename, description) {
    const name = `error when importing ${description.toLowerCase()} ${path.basename(filename)}`;
    return new FailureTestCase([
        name
    ], error);
}

//# sourceMappingURL=api_context.js.map
