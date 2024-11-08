// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { test, assert } from "../tests.js";
import { TestSuite } from "./test_suite.js";
import { Clock } from "../infrastructure/clock.js";
import { TestStatus, TestResult, TestMark } from "./test_result.js";
import path from "node:path";
// dependency: ./_module_passes.js
// dependency: ./_module_throws.js
// dependency: ./_module_no_export.js
// Tests for my test library. (How meta.)
const SUCCESS_MODULE_PATH = path.resolve(import.meta.dirname, "./_module_passes.js");
const THROWS_MODULE_PATH = path.resolve(import.meta.dirname, "./_module_throws.js");
const NO_EXPORT_MODULE_PATH = path.resolve(import.meta.dirname, "./_module_no_export.js");
const IRRELEVANT_NAME = "irrelevant name";
const DEFAULT_TIMEOUT = TestSuite.DEFAULT_TIMEOUT_IN_MS;
const EXCEED_TIMEOUT = DEFAULT_TIMEOUT + 1;
export default test(({ describe })=>{
    describe("test modules", ({ it })=>{
        it("creates test suite from a module (and sets filename on result)", async ()=>{
            const suite = await TestSuite.fromModulesAsync([
                SUCCESS_MODULE_PATH,
                SUCCESS_MODULE_PATH
            ]);
            const testCaseResult = TestResult.pass("passes", SUCCESS_MODULE_PATH);
            assert.dotEquals(await suite.runAsync(), TestResult.suite([], [
                TestResult.suite([], [
                    testCaseResult
                ], SUCCESS_MODULE_PATH),
                TestResult.suite([], [
                    testCaseResult
                ], SUCCESS_MODULE_PATH)
            ]));
        });
        it("fails gracefully if module isn't an absolute path", async ()=>{
            const suite = await TestSuite.fromModulesAsync([
                "./_module_passes.js"
            ]);
            const result = (await suite.runAsync()).allTests()[0];
            assert.equal(result.name, [
                "error when importing _module_passes.js"
            ]);
            assert.isUndefined(result.filename);
            assert.equal(result.status, TestStatus.fail);
            assert.equal(result.error, "Test module filenames must use absolute paths: ./_module_passes.js");
        });
        it("fails gracefully if module doesn't exist", async ()=>{
            const suite = await TestSuite.fromModulesAsync([
                "/no_such_module.js"
            ]);
            const result = (await suite.runAsync()).allTests()[0];
            assert.equal(result.name, [
                "error when importing no_such_module.js"
            ]);
            assert.equal(result.filename, "/no_such_module.js");
            assert.equal(result.status, TestStatus.fail);
            assert.equal(result.error, `Test module not found: /no_such_module.js`);
        });
        it("fails gracefully if module fails to require()", async ()=>{
            const suite = await TestSuite.fromModulesAsync([
                THROWS_MODULE_PATH
            ]);
            const result = (await suite.runAsync()).allTests()[0];
            assert.equal(result.name, [
                "error when importing _module_throws.js"
            ]);
            assert.equal(result.filename, THROWS_MODULE_PATH);
            assert.equal(result.status, TestStatus.fail);
            assert.match(result.error.message, /my require error/);
        });
        it("fails gracefully if module doesn't export a test suite", async ()=>{
            const suite = await TestSuite.fromModulesAsync([
                NO_EXPORT_MODULE_PATH
            ]);
            const result = (await suite.runAsync()).allTests()[0];
            assert.equal(result.name, [
                "error when importing _module_no_export.js"
            ]);
            assert.equal(result.filename, NO_EXPORT_MODULE_PATH);
            assert.equal(result.status, TestStatus.fail);
            assert.equal(result.error, `Test module doesn't export a test suite: ${NO_EXPORT_MODULE_PATH}`);
        });
    });
    describe("test suites", ({ it })=>{
        it("executes immediately (but tests don't)", ()=>{
            let suiteRan = false;
            let testRan = false;
            TestSuite.create(IRRELEVANT_NAME, ({ it })=>{
                suiteRan = true;
                it(IRRELEVANT_NAME, ()=>{
                    testRan = true;
                });
            });
            assert.equal(suiteRan, true, "should run suite");
            assert.equal(testRan, false, "should not run test");
        });
        it("returns test results when run", async ()=>{
            const suite = TestSuite.create(({ it })=>{
                it("test 1", ()=>{});
                it("test 2", ()=>{});
                it("test 3", ()=>{});
            });
            const result = await suite.runAsync();
            assert.dotEquals(result, TestResult.suite([], [
                TestResult.pass("test 1"),
                TestResult.pass("test 2"),
                TestResult.pass("test 3")
            ]));
        });
        it("can be nested", async ()=>{
            const top = TestSuite.create("top", ({ describe })=>{
                describe("middle", ({ describe })=>{
                    describe("bottom", ({ it })=>{
                        it("my test", ()=>{});
                    });
                });
            });
            const result = await top.runAsync();
            assert.dotEquals(result, TestResult.suite("top", [
                TestResult.suite([
                    "top",
                    "middle"
                ], [
                    TestResult.suite([
                        "top",
                        "middle",
                        "bottom"
                    ], [
                        TestResult.pass([
                            "top",
                            "middle",
                            "bottom",
                            "my test"
                        ])
                    ])
                ])
            ]));
        });
        it("propagates filename into children's test results", async ()=>{
            const clock = await Clock.createNullAsync();
            const filename = "my_filename";
            const suite = TestSuite.create(({ describe, it })=>{
                it("pass", ()=>{});
                it.skip("skip", ()=>{});
                it("fail", ()=>{
                    throw Error("fail");
                });
                it("timeout", async ()=>{
                    await clock.waitAsync(EXCEED_TIMEOUT);
                });
                it("test without body");
                describe("suite without body");
            });
            suite._setFilename(filename);
            const actualPromise = suite.runAsync({
                clock
            });
            clock.tickUntilTimersExpireAsync();
            assert.equal(await actualPromise, TestResult.suite([], [
                createPass({
                    name: "pass",
                    filename
                }),
                createSkip({
                    name: "skip",
                    mark: TestMark.skip,
                    filename
                }),
                createFail({
                    name: "fail",
                    error: new Error("fail"),
                    filename
                }),
                createTimeout({
                    name: "timeout",
                    timeout: DEFAULT_TIMEOUT,
                    filename
                }),
                createSkip({
                    name: "test without body",
                    mark: TestMark.skip,
                    filename
                }),
                createSuite({
                    name: "suite without body",
                    mark: TestMark.skip,
                    filename
                })
            ], filename));
        });
    });
    describe("test cases", ({ it })=>{
        it("runs when its parent suite is run", async ()=>{
            let testRan = false;
            const suite = TestSuite.create(IRRELEVANT_NAME, ({ it })=>{
                it(IRRELEVANT_NAME, ()=>{
                    testRan = true;
                });
            });
            assert.equal(testRan, false, "before suite runs");
            await suite.runAsync();
            assert.equal(testRan, true, "after suite runs");
        });
        it("works with asynchronous code", async ()=>{
            let testRan = false;
            const suite = TestSuite.create(IRRELEVANT_NAME, ({ it })=>{
                it(IRRELEVANT_NAME, async ()=>{
                    await new Promise((resolve)=>{
                        setImmediate(()=>{
                            testRan = true;
                            resolve();
                        });
                    });
                });
            });
            await suite.runAsync();
            assert.equal(testRan, true);
        });
        it("passes when test doesn't throw exception", async ()=>{
            const result = await runTestAsync("my test", ()=>{});
            assert.dotEquals(result, TestResult.pass("my test"));
        });
        it("fails when test throws exception", async ()=>{
            const error = new Error("my error");
            const result = await runTestAsync("my test", ()=>{
                throw error;
            });
            assert.dotEquals(result, TestResult.fail("my test", error));
        });
        it("can retrieve config variables", async ()=>{
            const myConfig = {
                myConfig: "my_config"
            };
            let receivedConfig;
            const suite = TestSuite.create(({ it })=>{
                it(IRRELEVANT_NAME, ({ getConfig })=>{
                    receivedConfig = getConfig("myConfig");
                });
            });
            await suite.runAsync({
                config: myConfig
            });
            assert.equal(receivedConfig, "my_config");
        });
        it("fails fast when no config defined", async ()=>{
            const suite = TestSuite.create(({ it })=>{
                it(IRRELEVANT_NAME, ({ getConfig })=>{
                    getConfig("no_such_config");
                });
            });
            const results = await suite.runAsync({});
            assert.equal(results, TestResult.suite([], [
                TestResult.fail(IRRELEVANT_NAME, new Error("No test config found for name 'no_such_config'"))
            ]));
        });
        it("fails fast when config defined, but config variable not found", async ()=>{
            const suite = TestSuite.create(({ it })=>{
                it(IRRELEVANT_NAME, ({ getConfig })=>{
                    getConfig("no_such_config");
                });
            });
            const results = await suite.runAsync({
                config: {}
            });
            assert.equal(results, TestResult.suite([], [
                TestResult.fail(IRRELEVANT_NAME, new Error("No test config found for name 'no_such_config'"))
            ]));
        });
    });
    describe("naming", ({ it })=>{
        it("test suites can be created with and without a name", async ()=>{
            const name = TestSuite.create("named", ({ it })=>{
                it("has a name", ()=>{});
            });
            const noName = TestSuite.create(({ it })=>{
                it("has no name", ()=>{});
            });
            assert.dotEquals(await name.runAsync(), TestResult.suite("named", [
                TestResult.pass([
                    "named",
                    "has a name"
                ])
            ]));
            assert.dotEquals(await noName.runAsync(), TestResult.suite([], [
                TestResult.pass("has no name")
            ]));
        });
        it("test cases without names are given a default", async ()=>{
            const suite = TestSuite.create(({ it })=>{
                it("", ()=>{});
            });
            assert.dotEquals(await suite.runAsync(), TestResult.suite([], [
                TestResult.pass("(unnamed)")
            ]));
        });
        it("sets name of test result to include nested suites", async ()=>{
            const top = TestSuite.create("top", ({ describe })=>{
                describe("middle", ({ describe })=>{
                    describe("bottom", ({ it })=>{
                        it("my test", ()=>{});
                    });
                });
            });
            const result = await top.runAsync();
            assert.dotEquals(result, TestResult.suite([
                "top"
            ], [
                TestResult.suite([
                    "top",
                    "middle"
                ], [
                    TestResult.suite([
                        "top",
                        "middle",
                        "bottom"
                    ], [
                        TestResult.pass([
                            "top",
                            "middle",
                            "bottom",
                            "my test"
                        ])
                    ])
                ])
            ]));
        });
        it("collapses unnamed suites when setting test result name", async ()=>{
            const top = TestSuite.create("top", ({ describe })=>{
                describe("", ({ describe })=>{
                    describe("", ({ it })=>{
                        it("my test", ()=>{});
                    });
                });
            });
            const result = await top.runAsync();
            assert.dotEquals(result, TestResult.suite("top", [
                TestResult.suite("top", [
                    TestResult.suite("top", [
                        TestResult.pass([
                            "top",
                            "my test"
                        ])
                    ])
                ])
            ]));
        });
    });
    describe("before/after", ({ it })=>{
        it("runs function before and after all tests in a suite", async ()=>{
            const ordering = [];
            const pushFn = (message)=>{
                return ()=>ordering.push(message);
            };
            const suite = TestSuite.create(IRRELEVANT_NAME, ({ beforeAll, afterAll, describe, it })=>{
                beforeAll(pushFn("parent before 1"));
                beforeAll(pushFn("parent before 2"));
                afterAll(pushFn("parent after 1"));
                afterAll(pushFn("parent after 2"));
                it(IRRELEVANT_NAME, pushFn("test 1"));
                it(IRRELEVANT_NAME, pushFn("test 2"));
                describe(IRRELEVANT_NAME, ({ beforeAll, afterAll, it })=>{
                    beforeAll(pushFn("child before"));
                    afterAll(pushFn("child after"));
                    it(IRRELEVANT_NAME, pushFn("test 3"));
                });
            });
            await suite.runAsync();
            assert.equal(ordering, [
                "parent before 1",
                "parent before 2",
                "test 1",
                "test 2",
                "child before",
                "test 3",
                "child after",
                "parent after 1",
                "parent after 2"
            ]);
        });
        it("runs function before and after each test in a suite", async ()=>{
            const ordering = [];
            const pushFn = (message)=>{
                return ()=>ordering.push(message);
            };
            const suite = TestSuite.create(IRRELEVANT_NAME, ({ beforeEach, afterEach, describe, it })=>{
                beforeEach(pushFn("parent before 1"));
                beforeEach(pushFn("parent before 2"));
                afterEach(pushFn("parent after 1"));
                afterEach(pushFn("parent after 2"));
                it(IRRELEVANT_NAME, pushFn("test 1"));
                it(IRRELEVANT_NAME, pushFn("test 2"));
                describe(IRRELEVANT_NAME, ({ beforeEach, afterEach, it })=>{
                    beforeEach(pushFn("child before"));
                    afterEach(pushFn("child after"));
                    it(IRRELEVANT_NAME, pushFn("test 3"));
                });
            });
            await suite.runAsync();
            assert.equal(ordering, [
                "parent before 1",
                "parent before 2",
                "test 1",
                "parent after 1",
                "parent after 2",
                "parent before 1",
                "parent before 2",
                "test 2",
                "parent after 1",
                "parent after 2",
                "parent before 1",
                "parent before 2",
                "child before",
                "test 3",
                "child after",
                "parent after 1",
                "parent after 2"
            ]);
        });
        it("provides config", async ()=>{
            const myConfig = {
                myConfig: "my_config"
            };
            let beforeAllReceived, beforeEachReceived, afterEachReceived, afterAllReceived;
            const suite = TestSuite.create(IRRELEVANT_NAME, ({ beforeAll, beforeEach, afterEach, afterAll, it })=>{
                beforeAll(({ getConfig })=>{
                    beforeAllReceived = getConfig("myConfig");
                });
                beforeEach(({ getConfig })=>{
                    beforeEachReceived = getConfig("myConfig");
                });
                it(IRRELEVANT_NAME, ()=>{});
                afterEach(({ getConfig })=>{
                    afterEachReceived = getConfig("myConfig");
                });
                afterAll(({ getConfig })=>{
                    afterAllReceived = getConfig("myConfig");
                });
            });
            await suite.runAsync({
                config: myConfig
            });
            assert.equal(beforeAllReceived, "my_config", "beforeAll");
            assert.equal(beforeEachReceived, "my_config", "beforeEach");
            assert.equal(afterEachReceived, "my_config", "afterEach");
            assert.equal(afterAllReceived, "my_config", "afterAll");
        });
        it("doesn't run beforeAll and afterAll when all children are skipped", async ()=>{
            let beforeRan = false;
            let afterRan = false;
            const suite = TestSuite.create("my suite", ({ it, beforeAll, afterAll })=>{
                beforeAll(()=>{
                    beforeRan = true;
                });
                afterAll(()=>{
                    afterRan = true;
                });
                it.skip("test 1", async ()=>{});
                it.skip("test 2", async ()=>{});
            });
            await suite.runAsync();
            assert.equal(beforeRan, false, "shouldn't run beforeAll()");
            assert.equal(afterRan, false, "shouldn't run afterAll()");
        });
        it("doesn't run beforeEach and afterEach when the test is skipped", async ()=>{
            let beforeRan = false;
            let afterRan = false;
            const suite = TestSuite.create("my suite", ({ it, beforeEach, afterEach })=>{
                beforeEach(()=>{
                    beforeRan = true;
                });
                afterEach(()=>{
                    afterRan = true;
                });
                it.skip("test 1", async ()=>{});
            });
            await suite.runAsync();
            assert.equal(beforeRan, false, "shouldn't run beforeEach()");
            assert.equal(afterRan, false, "shouldn't run afterEach()");
        });
        it("handles exception in beforeAll", async ()=>{
            const error = new Error("my error");
            const suite = TestSuite.create("my suite", ({ it, beforeAll })=>{
                beforeAll(()=>{
                    throw error;
                });
                it("test 1", async ()=>{});
                it("test 2", async ()=>{});
            });
            assert.dotEquals(await suite.runAsync(), createSuite({
                name: "my suite",
                children: [
                    createFail({
                        name: [
                            "my suite",
                            "beforeAll()"
                        ],
                        error
                    })
                ]
            }));
        });
        it("handles exception in afterAll", async ()=>{
            const error = new Error("my error");
            const suite = TestSuite.create("my suite", ({ it, afterAll })=>{
                afterAll(()=>{
                    throw error;
                });
                it("test 1", async ()=>{});
                it("test 2", async ()=>{});
            });
            assert.dotEquals(await suite.runAsync(), createSuite({
                name: "my suite",
                children: [
                    createPass({
                        name: [
                            "my suite",
                            "test 1"
                        ]
                    }),
                    createPass({
                        name: [
                            "my suite",
                            "test 2"
                        ]
                    }),
                    createFail({
                        name: [
                            "my suite",
                            "afterAll()"
                        ],
                        error
                    })
                ]
            }));
        });
        it("handles exception in beforeEach", async ()=>{
            const error = new Error("my error");
            const suite = TestSuite.create(({ it, beforeEach })=>{
                beforeEach(()=>{
                    throw error;
                });
                it("test 1", async ()=>{});
                it("test 2", async ()=>{});
            });
            assert.dotEquals(await suite.runAsync(), TestResult.suite([], [
                TestResult.fail("test 1", error),
                TestResult.fail("test 2", error)
            ]));
        });
        it("doesn't run test when beforeEach throws exception", async ()=>{
            let testRan = false;
            const suite = TestSuite.create("my suite", ({ it, beforeEach })=>{
                beforeEach(()=>{
                    throw new Error();
                });
                it("my test", ()=>{
                    testRan = true;
                });
            });
            await suite.runAsync();
            assert.equal(testRan, false);
        });
        it("handles exception in afterEach", async ()=>{
            const error = new Error("my error");
            const suite = TestSuite.create(({ it, afterEach })=>{
                afterEach(()=>{
                    throw error;
                });
                it("test 1", ()=>{});
                it("test 2", ()=>{});
            });
            assert.dotEquals(await suite.runAsync(), TestResult.suite([], [
                TestResult.fail("test 1", error),
                TestResult.fail("test 2", error)
            ]));
        });
        it("runs afterEach() even when test throws exception", async ()=>{
            let afterEachRan = false;
            const suite = TestSuite.create("my suite", ({ it, afterEach })=>{
                afterEach(()=>{
                    afterEachRan = true;
                });
                it("my test", ()=>{
                    throw new Error();
                });
            });
            await suite.runAsync();
            assert.equal(afterEachRan, true);
        });
        it("only reports test exception when both test and afterEach throw exceptions", async ()=>{
            const afterEachError = new Error("afterEach error");
            const testError = new Error("test error");
            const suite = TestSuite.create(({ it, afterEach })=>{
                afterEach(()=>{
                    throw afterEachError;
                });
                it("my test", ()=>{
                    throw testError;
                });
            });
            assert.dotEquals(await suite.runAsync(), TestResult.suite([], [
                TestResult.fail("my test", testError)
            ]));
        });
    });
    describe("timeouts", ({ it })=>{
        it("times out when test doesn't complete in expected amount of time", async ()=>{
            const clock = await Clock.createNullAsync();
            let beforeTime = null;
            let afterTime = null;
            const suite = TestSuite.create(({ it, beforeEach, afterEach })=>{
                beforeEach(()=>{
                    beforeTime = clock.now();
                });
                afterEach(()=>{
                    afterTime = clock.now();
                });
                it("my test", async ()=>{
                    await clock.waitAsync(EXCEED_TIMEOUT);
                });
            });
            const actualPromise = suite.runAsync({
                clock
            });
            await clock.tickUntilTimersExpireAsync();
            assert.dotEquals(await actualPromise, TestResult.suite([], [
                TestResult.timeout("my test", DEFAULT_TIMEOUT)
            ]), "result");
            assert.equal(beforeTime, 0, "beforeEach() should run immediately");
            assert.equal(afterTime, DEFAULT_TIMEOUT, "afterEach() should run as soon as it() times out");
        });
        it("times out when beforeAll doesn't complete in expected amount of time", async ()=>{
            const clock = await Clock.createNullAsync();
            let itTime = null;
            let afterTime = null;
            const suite = TestSuite.create("my suite", ({ it, beforeAll, afterAll })=>{
                beforeAll(async ()=>{
                    await clock.waitAsync(EXCEED_TIMEOUT);
                });
                afterAll(()=>{
                    afterTime = clock.now();
                });
                it("my test", ()=>{
                    itTime = clock.now();
                });
            });
            const actualPromise = suite.runAsync({
                clock
            });
            await clock.tickUntilTimersExpireAsync();
            assert.dotEquals(await actualPromise, TestResult.suite("my suite", [
                TestResult.timeout([
                    "my suite",
                    "beforeAll()"
                ], DEFAULT_TIMEOUT)
            ]), "result");
            assert.equal(itTime, null, "it() should not run");
            assert.equal(afterTime, null, "afterAll() should not run");
        });
        it("times out when afterAll doesn't complete in expected amount of time", async ()=>{
            const clock = await Clock.createNullAsync();
            let beforeTime = null;
            let itTime = null;
            const suite = TestSuite.create(({ it, beforeAll, afterAll })=>{
                beforeAll(()=>{
                    beforeTime = clock.now();
                });
                afterAll(async ()=>{
                    await clock.waitAsync(EXCEED_TIMEOUT);
                });
                it("test 1", ()=>{
                    itTime = clock.now();
                });
                it("test 2", ()=>{});
            });
            const actualPromise = suite.runAsync({
                clock
            });
            await clock.tickUntilTimersExpireAsync();
            assert.dotEquals(await actualPromise, TestResult.suite([], [
                TestResult.pass("test 1"),
                TestResult.pass("test 2"),
                TestResult.timeout("afterAll()", DEFAULT_TIMEOUT)
            ]), "result");
            assert.equal(beforeTime, 0, "beforeAll() should run immediately");
            assert.equal(itTime, 0, "it() should run immediately");
        });
        it("times out when beforeEach doesn't complete in expected amount of time", async ()=>{
            const clock = await Clock.createNullAsync();
            let itTime = null;
            let afterTime = null;
            const suite = TestSuite.create(({ it, beforeEach, afterEach })=>{
                beforeEach(async ()=>{
                    await clock.waitAsync(EXCEED_TIMEOUT);
                });
                afterEach(()=>{
                    afterTime = clock.now();
                });
                it("my test", ()=>{
                    itTime = clock.now();
                });
            });
            const actualPromise = suite.runAsync({
                clock
            });
            await clock.tickUntilTimersExpireAsync();
            assert.dotEquals(await actualPromise, TestResult.suite([], [
                TestResult.timeout("my test", DEFAULT_TIMEOUT)
            ]), "result");
            assert.equal(itTime, null, "it() should not run");
            assert.equal(afterTime, null, "afterEach() should not run");
        });
        it("times out when afterEach doesn't complete in expected amount of time", async ()=>{
            const clock = await Clock.createNullAsync();
            let beforeTime = null;
            let itTime = null;
            const suite = TestSuite.create(({ it, beforeEach, afterEach })=>{
                beforeEach(()=>{
                    beforeTime = clock.now();
                });
                afterEach(async ()=>{
                    await clock.waitAsync(EXCEED_TIMEOUT);
                });
                it("my test", ()=>{
                    itTime = clock.now();
                });
            });
            const actualPromise = suite.runAsync({
                clock
            });
            await clock.tickUntilTimersExpireAsync();
            assert.dotEquals(await actualPromise, TestResult.suite([], [
                TestResult.timeout("my test", DEFAULT_TIMEOUT)
            ]), "result");
            assert.equal(beforeTime, 0, "beforeEach() should run immediately");
            assert.equal(itTime, 0, "it() should run immediately");
        });
        it("times out each function separately", async ()=>{
            const clock = await Clock.createNullAsync();
            const notQuiteTimeoutFn = async ()=>{
                await clock.waitAsync(DEFAULT_TIMEOUT - 1);
            };
            const suite = TestSuite.create(({ it, beforeAll, afterAll, beforeEach, afterEach })=>{
                beforeAll(notQuiteTimeoutFn);
                beforeAll(notQuiteTimeoutFn);
                afterAll(notQuiteTimeoutFn);
                afterAll(notQuiteTimeoutFn);
                beforeEach(notQuiteTimeoutFn);
                beforeEach(notQuiteTimeoutFn);
                afterEach(notQuiteTimeoutFn);
                afterEach(notQuiteTimeoutFn);
                it("test 1", notQuiteTimeoutFn);
                it("test 2", notQuiteTimeoutFn);
            });
            const actualPromise = suite.runAsync({
                clock
            });
            await clock.tickUntilTimersExpireAsync();
            assert.dotEquals(await actualPromise, TestResult.suite([], [
                TestResult.pass("test 1"),
                TestResult.pass("test 2")
            ]));
        });
        it("allows suites to configure timeout", async ()=>{
            const NEW_TIMEOUT = DEFAULT_TIMEOUT * 10;
            const clock = await Clock.createNullAsync();
            const notQuiteTimeoutFn = async ()=>{
                await clock.waitAsync(NEW_TIMEOUT - 1);
            };
            const suite = TestSuite.create(({ it, setTimeout, beforeAll, afterAll, beforeEach, afterEach })=>{
                setTimeout(NEW_TIMEOUT);
                beforeAll(notQuiteTimeoutFn);
                afterAll(notQuiteTimeoutFn);
                beforeEach(notQuiteTimeoutFn);
                afterEach(notQuiteTimeoutFn);
                it("my test", notQuiteTimeoutFn);
            });
            const actualPromise = suite.runAsync({
                clock
            });
            await clock.tickUntilTimersExpireAsync();
            assert.dotEquals(await actualPromise, TestResult.suite([], [
                TestResult.pass("my test")
            ]));
        });
        it("inherits parent's timeout", async ()=>{
            const NEW_TIMEOUT = DEFAULT_TIMEOUT * 10;
            const clock = await Clock.createNullAsync();
            const suite = TestSuite.create(({ describe, setTimeout })=>{
                setTimeout(NEW_TIMEOUT);
                describe(({ it })=>{
                    it("my test", async ()=>{
                        await clock.waitAsync(NEW_TIMEOUT - 1);
                    });
                });
            });
            const actualPromise = suite.runAsync({
                clock
            });
            await clock.tickUntilTimersExpireAsync();
            assert.dotEquals(await actualPromise, TestResult.suite([], [
                TestResult.suite([], [
                    TestResult.pass("my test")
                ])
            ]));
        });
    });
    describe(".skip", ({ it })=>{
        it("skips and marks tests that have no function", async ()=>{
            const suite = TestSuite.create(({ it })=>{
                it("my test");
            });
            const result = (await suite.runAsync()).allTests()[0];
            assert.dotEquals(result, createSkip({
                name: "my test",
                mark: TestMark.skip
            }), "should be skipped");
        });
        it("skips and marks tests that have '.skip'", async ()=>{
            let testRan = false;
            const suite = TestSuite.create(({ it })=>{
                it.skip("my test", ()=>{
                    testRan = true;
                });
            });
            const result = (await suite.runAsync()).allTests()[0];
            assert.equal(testRan, false, "should not run test");
            assert.dotEquals(result, createSkip({
                name: "my test",
                mark: TestMark.skip
            }));
            assert.equal(result.mark, TestMark.skip, "should be marked");
        });
        it("skips suites that have no function", async ()=>{
            const suite = await TestSuite.create("my suite").runAsync();
            const noName = await TestSuite.create().runAsync();
            assert.dotEquals(suite, createSuite({
                name: "my suite",
                mark: TestMark.skip
            }));
            assert.dotEquals(noName, createSuite({
                name: [],
                mark: TestMark.skip
            }));
        });
        it("recursively skips everything within a suite that has '.skip'", async ()=>{
            const suite = TestSuite.create.skip(({ describe, it })=>{
                it("test 1", ()=>{});
                it("test 2", ()=>{});
                describe(({ it })=>{
                    it("test 3", ()=>{});
                });
            });
            const result = await suite.runAsync();
            assert.dotEquals(result, createSuite({
                mark: TestMark.skip,
                children: [
                    TestResult.skip("test 1"),
                    TestResult.skip("test 2"),
                    TestResult.suite([], [
                        TestResult.skip("test 3")
                    ])
                ]
            }));
        });
        it("doesn't mark skipped tests and suites that aren't explicitly marked '.skip'", async ()=>{
            const suite = TestSuite.create.skip(({ describe, it })=>{
                it("test", ()=>{});
                describe("suite", ()=>{});
            });
            const result = await suite.runAsync();
            assert.dotEquals(result, createSuite({
                mark: TestMark.skip,
                children: [
                    createSkip({
                        name: "test",
                        mark: TestMark.none
                    }),
                    createSuite({
                        name: "suite",
                        mark: TestMark.none
                    })
                ]
            }));
        });
        it("generates failure when a suite is marked 'only' but has no body", async ()=>{
            const suite = TestSuite.create.only("my suite");
            const result = await suite.runAsync();
            assert.dotEquals(result, createSuite({
                name: "my suite",
                mark: TestMark.only,
                children: [
                    createFail({
                        name: "my suite",
                        error: "Test suite is marked '.only', but it has no body"
                    })
                ]
            }));
        });
        it("generates failure when a test is marked 'only' but has no body", async ()=>{
            const suite = TestSuite.create("my suite", ({ it })=>{
                it.only("my test");
            });
            const result = await suite.runAsync();
            assert.dotEquals(result, createSuite({
                name: "my suite",
                children: [
                    createFail({
                        name: [
                            "my suite",
                            "my test"
                        ],
                        error: "Test is marked '.only', but it has no body",
                        mark: TestMark.only
                    })
                ]
            }));
        });
    });
    describe(".only", ({ it })=>{
        it("if any tests are marked .only, it only runs those tests", async ()=>{
            const suite = TestSuite.create(({ it })=>{
                it.only(".only", ()=>{});
                it("not .only", ()=>{});
            });
            assert.equal(await suite.runAsync(), createSuite({
                children: [
                    createPass({
                        name: ".only",
                        mark: TestMark.only
                    }),
                    createSkip({
                        name: "not .only"
                    })
                ]
            }));
        });
        it("marks test results as '.only'", async ()=>{
            const clock = await Clock.createNullAsync();
            const suite = TestSuite.create(({ it })=>{
                it.only("pass", ()=>{});
                it.only("fail", ()=>{
                    throw new Error("my error");
                });
                it.only("timeout", async ()=>{
                    await clock.waitAsync(EXCEED_TIMEOUT);
                });
            });
            const resultPromise = suite.runAsync({
                clock
            });
            clock.tickUntilTimersExpireAsync();
            assert.equal(await resultPromise, createSuite({
                children: [
                    createPass({
                        name: "pass",
                        mark: TestMark.only
                    }),
                    createFail({
                        name: "fail",
                        error: new Error("my error"),
                        mark: TestMark.only
                    }),
                    createTimeout({
                        name: "timeout",
                        timeout: DEFAULT_TIMEOUT,
                        mark: TestMark.only
                    })
                ]
            }));
        });
        it("if a suite is marked .only and none of its tests are, runs all of those tests", async ()=>{
            const suite = TestSuite.create(({ describe })=>{
                describe("not .only", ({ it })=>{
                    it("test1", ()=>{});
                    it("test2", ()=>{});
                });
                describe.only(".only", ({ it })=>{
                    it("test3", ()=>{});
                    it("test4", ()=>{});
                });
            });
            assert.equal(await suite.runAsync(), TestResult.suite([], [
                TestResult.suite("not .only", [
                    TestResult.skip([
                        "not .only",
                        "test1"
                    ]),
                    TestResult.skip([
                        "not .only",
                        "test2"
                    ])
                ]),
                createSuite({
                    name: ".only",
                    mark: TestMark.only,
                    children: [
                        TestResult.pass([
                            ".only",
                            "test3"
                        ]),
                        TestResult.pass([
                            ".only",
                            "test4"
                        ])
                    ]
                })
            ]));
        });
        it("if a suite is marked .only and none of its children are, run those tests recursively", async ()=>{
            const suite = TestSuite.create.only(({ describe })=>{
                describe(({ it })=>{
                    it("test", ()=>{});
                });
            });
            assert.equal(await suite.runAsync(), createSuite({
                mark: TestMark.only,
                children: [
                    TestResult.suite([], [
                        TestResult.pass("test")
                    ])
                ]
            }));
        });
        it("if a suite is marked .only and one of its children is also, only run that test", async ()=>{
            const suite = TestSuite.create.only(({ it })=>{
                it("not only", ()=>{});
                it.only("only", ()=>{});
            });
            assert.equal(await suite.runAsync(), createSuite({
                mark: TestMark.only,
                children: [
                    createSkip({
                        name: "not only"
                    }),
                    createPass({
                        name: "only",
                        mark: TestMark.only
                    })
                ]
            }));
        });
        it("if a suite is marked .only and one of its grandchildren is also, only run that test", async ()=>{
            const suite = TestSuite.create.only(({ describe })=>{
                describe(({ it })=>{
                    it("not only", ()=>{});
                    it.only("only", ()=>{});
                });
            });
            assert.equal(await suite.runAsync(), createSuite({
                mark: TestMark.only,
                children: [
                    createSuite({
                        children: [
                            createSkip({
                                name: "not only"
                            }),
                            createPass({
                                name: "only",
                                mark: TestMark.only
                            })
                        ]
                    })
                ]
            }));
        });
        it("if a suite is marked .only and one of its child suites is also, only run that suite", async ()=>{
            const suite = TestSuite.create.only(({ describe })=>{
                describe("not only", ({ it })=>{
                    it("test1", ()=>{});
                });
                describe.only("only", ({ it })=>{
                    it("test2", ()=>{});
                });
            });
            assert.equal(await suite.runAsync(), createSuite({
                mark: TestMark.only,
                children: [
                    TestResult.suite("not only", [
                        TestResult.skip([
                            "not only",
                            "test1"
                        ])
                    ]),
                    createSuite({
                        name: "only",
                        mark: TestMark.only,
                        children: [
                            TestResult.pass([
                                "only",
                                "test2"
                            ])
                        ]
                    })
                ]
            }));
        });
        it("if a suite is marked .only and a child is marked .skip, skip the child", async ()=>{
            const suite = TestSuite.create.only(({ describe })=>{
                describe(({ it })=>{
                    it.skip("test1", ()=>{});
                    it("test2", ()=>{});
                });
            });
            assert.equal(await suite.runAsync(), createSuite({
                mark: TestMark.only,
                children: [
                    createSuite({
                        children: [
                            createSkip({
                                name: "test1",
                                mark: TestMark.skip
                            }),
                            TestResult.pass("test2")
                        ]
                    })
                ]
            }));
        });
        it("if a suite is marked .skip and a child is marked .only, run the child", async ()=>{
            const suite = TestSuite.create.skip(({ describe })=>{
                describe(({ it })=>{
                    it.only("test1", ()=>{});
                    it("test2", ()=>{});
                });
            });
            assert.equal(await suite.runAsync(), createSuite({
                mark: TestMark.skip,
                children: [
                    createSuite({
                        children: [
                            createPass({
                                name: "test1",
                                mark: TestMark.only
                            }),
                            createSkip({
                                name: "test2"
                            })
                        ]
                    })
                ]
            }));
        });
        it("if a suite is marked .only and a child suite is marked .skip, skip its children", async ()=>{
            const suite = TestSuite.create.only(({ describe })=>{
                describe.skip(({ it })=>{
                    it("test1", ()=>{});
                    it("test2", ()=>{});
                });
            });
            assert.equal(await suite.runAsync(), createSuite({
                mark: TestMark.only,
                children: [
                    createSuite({
                        mark: TestMark.skip,
                        children: [
                            TestResult.skip("test1"),
                            TestResult.skip("test2")
                        ]
                    })
                ]
            }));
        });
        it("if a suite is marked .skip and a child suite is marked .only, run its children", async ()=>{
            const suite = TestSuite.create.skip(({ describe })=>{
                describe.only(({ it })=>{
                    it("test1", ()=>{});
                    it("test2", ()=>{});
                });
            });
            assert.equal(await suite.runAsync(), createSuite({
                mark: TestMark.skip,
                children: [
                    createSuite({
                        mark: TestMark.only,
                        children: [
                            TestResult.pass("test1"),
                            TestResult.pass("test2")
                        ]
                    })
                ]
            }));
        });
        it("marks suites even if they fail 'beforeAll'", async ()=>{
            const suite = TestSuite.create.only("my suite", ({ beforeAll, it })=>{
                beforeAll(()=>{
                    throw new Error("my error");
                });
                it("my test");
            });
            const result = await suite.runAsync();
            assert.dotEquals(result, createSuite({
                name: "my suite",
                mark: TestMark.only,
                children: [
                    createFail({
                        name: [
                            "my suite",
                            "beforeAll()"
                        ],
                        error: new Error("my error")
                    })
                ]
            }));
        });
    });
    describe("notification", ({ it })=>{
        it("runs notify function when test completes", async ()=>{
            const suite = TestSuite.create(({ it })=>{
                it("my test", ()=>{});
            });
            let testResult;
            function notifyFn(result) {
                testResult = result;
            }
            await suite.runAsync({
                notifyFn
            });
            assert.dotEquals(testResult, TestResult.pass("my test"));
        });
        it("runs notify function if module fails to require()", async ()=>{
            const suite = await TestSuite.fromModulesAsync([
                "./_module_throws.js"
            ]);
            let testResult;
            function notifyFn(result) {
                testResult = result;
            }
            await suite.runAsync({
                notifyFn
            });
            assert.equal(testResult.name, [
                "error when importing _module_throws.js"
            ]);
        });
        it("runs notify function if module doesn't export a test suite", async ()=>{
            const suite = await TestSuite.fromModulesAsync([
                "./_module_no_export.js"
            ]);
            let testResult;
            function notifyFn(result) {
                testResult = result;
            }
            await suite.runAsync({
                notifyFn
            });
            assert.equal(testResult.name, [
                "error when importing _module_no_export.js"
            ]);
        });
    });
});
async function runTestAsync(testName, testFn) {
    const suite = TestSuite.create(({ it })=>{
        it(testName, testFn);
    });
    const result = await suite.runAsync();
    return result.children[0];
}
function createSuite({ name = [], children = [], filename = undefined, mark = undefined } = {}) {
    return TestResult.suite(name, children, filename, mark);
}
function createPass({ name = "irrelevant name", filename = undefined, mark = undefined } = {}) {
    return TestResult.pass(name, filename, mark);
}
function createFail({ name = "irrelevant name", error = new Error("irrelevant error"), filename = undefined, mark = undefined } = {}) {
    return TestResult.fail(name, error, filename, mark);
}
function createSkip({ name = "irrelevant name", filename = undefined, mark = undefined } = {}) {
    return TestResult.skip(name, filename, mark);
}
function createTimeout({ name = "irrelevant name", timeout = 42, filename = undefined, mark = undefined } = {}) {
    return TestResult.timeout(name, timeout, filename, mark);
}

//# sourceMappingURL=/Users/jshore/Documents/Projects/ergotest/generated/src/tests/_test_suite_test.js.map
