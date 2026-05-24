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
            await loadSetupModulesAsync(setupModuleFilenames, builder);
        } finally{
            this._inSetupModule = false;
            this._context.pop();
        }
        await loadTestModulesAsync(testModuleFilenames, builder);
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
            ensure.that(functionName === "describe" || this._context.length > 0, `${functionName}() must be run inside describe() or a setup module`);
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
    prependImportBeforeAll(beforeAll) {
        this._beforeAll.unshift(beforeAll);
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
        return [
            ...parentName,
            baseName
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
async function loadSetupModulesAsync(setupModuleFilenames, builder) {
    const name = [
        "import setup module"
    ];
    const importResults = [];
    let skipRemaining = false;
    for await (const filename of setupModuleFilenames){
        let importBeforeAll;
        if (skipRemaining) {
            importBeforeAll = BeforeAfter.create({
                name,
                fnAsync () {}
            });
        } else {
            const { err } = await importModuleAsync(filename);
            if (err !== undefined) {
                skipRemaining = true;
                importBeforeAll = BeforeAfter.create({
                    name,
                    fnAsync () {
                        throw err;
                    }
                });
            } else {
                importBeforeAll = BeforeAfter.createPassingImport({
                    name
                });
            }
        }
        importResults.unshift({
            importBeforeAll,
            filename
        });
        builder.setFilename(filename);
    }
    importResults.forEach(({ importBeforeAll, filename })=>{
        builder.prependImportBeforeAll(importBeforeAll);
        builder.setFilename(filename);
    });
}
async function loadTestModulesAsync(testModuleFilenames, builder) {
    const name = [
        "import test module"
    ];
    await Promise.all(testModuleFilenames.map(async (filename)=>{
        let test;
        const { suite, err } = await importModuleAsync(filename);
        if (err !== undefined) {
            test = TestCase.create({
                name: name,
                fnAsync () {
                    throw err;
                }
            });
        } else if (suite instanceof TestSuite || suite instanceof TestCase) {
            test = suite;
        } else if (suite?.runAsync !== undefined) {
            test = new FailureTestCase(name, `Test module '${filename}' appears to export a test suite, but it's not instantiating the correct class. Do you have two copies of ergotest installed?`);
        } else {
            test = new FailureTestCase(name, `Test module '${filename}' doesn't export a test suite. Did you forget to "export default" your describe()?`);
        }
        builder.addTest(test);
        builder.setFilename(filename);
    }));
}
async function importModuleAsync(filename) {
    if (!path.isAbsolute(filename)) {
        return {
            err: `Module filenames must use absolute paths, but was: ${filename}`
        };
    }
    try {
        const { default: suite } = await import(filename);
        return {
            suite
        };
    } catch (err) {
        const code = err?.code;
        const message = err?.message;
        if (code === "ERR_MODULE_NOT_FOUND" && message.includes(import.meta.filename)) {
            return {
                err: `Cannot find module '${filename}'`
            };
        }
        return {
            err
        };
    }
}

//# sourceMappingURL=api_context.js.map
