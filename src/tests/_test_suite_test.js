// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
"use strict";

const { suite, assert } = require("tests");
const TestSuite = require("./test_suite");
const Clock = require("../infrastructure/clock");
const TestResult = require("./test_result");
const path = require("node:path");
// dependency: ./_module_passes.js
// dependency: ./_module_throws.js
// dependency: ./_module_no_export.js

// Tests for my test library. (How meta.)

const SUCCESS_MODULE_PATH = path.resolve(__dirname, "./_module_passes.js");
const IRRELEVANT_NAME = "irrelevant name";
const DEFAULT_TIMEOUT = TestSuite.DEFAULT_TIMEOUT_IN_MS;
const EXCEED_TIMEOUT = DEFAULT_TIMEOUT + 1;

module.exports = suite(({ describe }) => {

	describe("test modules", ({ it }) => {

		it("creates test suite from a module (and sets filename on result)", async () => {
			const suite = await TestSuite.fromModulesAsync([ SUCCESS_MODULE_PATH, SUCCESS_MODULE_PATH ]);

			const testCaseResult = TestResult.pass("passes", SUCCESS_MODULE_PATH);
			assert.objEqual(await suite.runAsync(),
				TestResult.suite([], [
					TestResult.suite([], [ testCaseResult ], SUCCESS_MODULE_PATH),
					TestResult.suite([], [ testCaseResult ], SUCCESS_MODULE_PATH),
				]),
			);
		});

		it("fails gracefully if module fails to require()", async () => {
			const suite = await TestSuite.fromModulesAsync([ "./_module_throws.js" ]);
			const renderedResult = (await suite.runAsync()).allTests()[0].renderMultiLine();

			assert.match(renderedResult, /error when requiring _module_throws.js/);
			assert.match(renderedResult, /my require error/);
		});

		it("fails gracefully if module doesn't export a test suite", async () => {
			const suite = await TestSuite.fromModulesAsync([ "./_module_no_export.js" ]);
			const renderedResult = (await suite.runAsync()).allTests()[0].renderMultiLine();

			assert.match(renderedResult, /doesn't export a test suite: \.\/_module_no_export.js/);
		});

	});


	describe("test suites", ({ it }) => {

		it("executes immediately (but tests don't)", () => {
			let suiteRan = false;
			let testRan = false;
			TestSuite.createFn(IRRELEVANT_NAME, ({ it }) => {
				suiteRan = true;
				it(IRRELEVANT_NAME, () => {
					testRan = true;
				});
			});

			assert.equal(suiteRan, true, "should run suite");
			assert.equal(testRan, false, "should not run test");
		});

		it("returns test results when run", async () => {
			const suite = TestSuite.createFn(({ it }) => {
				it("test 1", () => {});
				it("test 2", () => {});
				it("test 3", () => {});
			});

			const result = await suite.runAsync();
			assert.objEqual(result,
				TestResult.suite([], [
					TestResult.pass("test 1"),
					TestResult.pass("test 2"),
					TestResult.pass("test 3"),
				]),
			);
		});

		it("can be nested", async () => {
			const top = TestSuite.createFn("top", ({ describe }) => {
				describe("middle", ({ describe }) => {
					describe("bottom", ({ it }) => {
						it("my test", () => {});
					});
				});
			});

			const result = await top.runAsync();
			assert.objEqual(result,
				TestResult.suite("top", [
					TestResult.suite([ "top", "middle" ], [
						TestResult.suite([ "top", "middle", "bottom" ], [
							TestResult.pass([ "top", "middle", "bottom", "my test" ]),
						]),
					]),
				]),
			);
		});

		it("propagates filename into children's test results", async () => {
			const clock = Clock.createNull();
			const filename = "my_filename";

			const suite = TestSuite.createFn(({ describe, it }) => {
				it("pass", () => {});
				it.skip("skip", () => {});
				it("fail", () => { throw Error("fail"); });
				it("timeout", async () => { await clock.waitAsync(EXCEED_TIMEOUT); });
				it("test without body");
				describe("suite without body");
			});
			suite._setFilename(filename);

			const actualPromise = suite.runAsync({ clock });
			clock.tickUntilTimersExpireAsync();

			assert.deepEqual(await actualPromise, TestResult.suite([], [
				TestResult.pass("pass", filename),
				TestResult.skip("skip", filename),
				TestResult.fail("fail", new Error("fail"), filename),
				TestResult.timeout("timeout", DEFAULT_TIMEOUT, filename),
				TestResult.skip("test without body", filename),
				TestResult.suite("suite without body", [], filename),
			], filename));
		});

	});


	describe("test case", ({ it }) => {

		it("runs when its parent suite is run", async () => {
			let testRan = false;
			const suite = TestSuite.createFn(IRRELEVANT_NAME, ({ it }) => {
				it(IRRELEVANT_NAME, () => {
					testRan = true;
				});
			});

			assert.equal(testRan, false, "before suite runs");
			await suite.runAsync();
			assert.equal(testRan, true, "after suite runs");
		});

		it("works with asynchronous code", async () => {
			let testRan = false;
			const suite = TestSuite.createFn(IRRELEVANT_NAME, ({ it }) => {
				it(IRRELEVANT_NAME, async () => {
					await new Promise((resolve) => {
						setImmediate(() => {
							testRan = true;
							resolve();
						});
					});
				});
			});

			await suite.runAsync();
			assert.equal(testRan, true);
		});

		it("passes when test doesn't throw exception", async () => {
			const result = await runTestAsync("my test", () => {});
			assert.objEqual(result, TestResult.pass("my test"));
		});

		it("fails when test throws exception", async () => {
			const error = new Error("my error");
			const result = await runTestAsync("my test", () => {
				throw error;
			});
			assert.objEqual(result, TestResult.fail("my test", error));
		});

		it("can retrieve config variables", async () => {
			const myConfig = { myConfig: "my_config" };
			let receivedConfig;

			const suite = TestSuite.createFn(({ it }) => {
				it(IRRELEVANT_NAME, ({ getConfig }) => {
					receivedConfig = getConfig("myConfig");
				});
			});

			await suite.runAsync({ config: myConfig });
			assert.equal(receivedConfig, "my_config");
		});

		it("fails fast when no config defined", async () => {
			const suite = TestSuite.createFn(({ it }) => {
				it(IRRELEVANT_NAME, ({ getConfig }) => {
					getConfig("no_such_config");
				});
			});

			const results = await suite.runAsync({});
			assert.deepEqual(results, TestResult.suite([], [
				TestResult.fail(IRRELEVANT_NAME, new Error("No test config found for name 'no_such_config'")),
			]));
		});

		it("fails fast when config defined, but config variable not found", async () => {
			const suite = TestSuite.createFn(({ it }) => {
				it(IRRELEVANT_NAME, ({ getConfig }) => {
					getConfig("no_such_config");
				});
			});

			const results = await suite.runAsync({ config: {} });
			assert.deepEqual(results, TestResult.suite([], [
				TestResult.fail(IRRELEVANT_NAME, new Error("No test config found for name 'no_such_config'")),
			]));
		});

		it("runs notify function", async () => {
			const suite = TestSuite.createFn(({ it }) => {
				it("my test", () => {});
			});

			let testResult;
			function notifyFn(result) {
				testResult = result;
			}

			await suite.runAsync({ notifyFn });
			assert.objEqual(testResult, TestResult.pass("my test"));
		});

	});


	describe("naming", ({ it }) => {

		it("test suites can be created with and without a name", async () => {
			const name = TestSuite.createFn("named", ({ it }) => {
				it("has a name", () => {});
			});
			const noName = TestSuite.createFn(({ it }) => {
				it("has no name", () => {});
			});

			assert.objEqual(await name.runAsync(), TestResult.suite("named", [ TestResult.pass([ "named", "has a name" ]) ]));
			assert.objEqual(await noName.runAsync(), TestResult.suite([], [ TestResult.pass("has no name") ]));
		});

		it("test cases without names are given a default", async () => {
			const suite = TestSuite.createFn(({ it }) => {
				it("", () => {});
			});

			assert.objEqual(await suite.runAsync(), TestResult.suite([], [ TestResult.pass("(unnamed)") ]));
		});

		it("sets name of test result to include nested suites", async () => {
			const top = TestSuite.createFn("top", ({ describe }) => {
				describe("middle", ({ describe }) => {
					describe("bottom", ({ it }) => {
						it("my test", () => {});
					});
				});
			});

			const result = await top.runAsync();
			assert.objEqual(result,
				TestResult.suite([ "top" ], [
					TestResult.suite([ "top", "middle" ], [
						TestResult.suite([ "top", "middle", "bottom" ], [
							TestResult.pass([ "top", "middle", "bottom", "my test" ]),
						]),
					]),
				]),
			);
		});

		it("collapses unnamed suites when setting test result name", async () => {
			const top = TestSuite.createFn("top", ({ describe }) => {
				describe("", ({ describe }) => {
					describe("", ({ it }) => {
						it("my test", () => {});
					});
				});
			});

			const result = await top.runAsync();
			assert.objEqual(result,
				TestResult.suite("top", [
					TestResult.suite("top", [
						TestResult.suite("top", [
							TestResult.pass([ "top", "my test" ]),
						]),
					]),
				]),
			);
		});

	});


	describe("before/after", ({ it }) => {

		it("runs function before and after all tests in a suite", async () => {
			const ordering = [];
			const pushFn = (message) => {
				return () => ordering.push(message);
			};

			const suite = TestSuite.createFn(IRRELEVANT_NAME, ({ beforeAll, afterAll, describe, it }) => {
				beforeAll(pushFn("parent before 1"));
				beforeAll(pushFn("parent before 2"));
				afterAll(pushFn("parent after 1"));
				afterAll(pushFn("parent after 2"));
				it(IRRELEVANT_NAME, pushFn("test 1"));
				it(IRRELEVANT_NAME, pushFn("test 2"));
				describe(IRRELEVANT_NAME, ({ beforeAll, afterAll, it }) => {
					beforeAll(pushFn("child before"));
					afterAll(pushFn("child after"));
					it(IRRELEVANT_NAME, pushFn("test 3"));
				});
			});

			await suite.runAsync();
			assert.deepEqual(ordering, [
				"parent before 1",
				"parent before 2",
				"test 1",
				"test 2",
				"child before",
				"test 3",
				"child after",
				"parent after 1",
				"parent after 2",
			]);
		});

		it("runs function before and after each test in a suite", async () => {
			const ordering = [];
			const pushFn = (message) => {
				return () => ordering.push(message);
			};

			const suite = TestSuite.createFn(IRRELEVANT_NAME, ({ beforeEach, afterEach, describe, it }) => {
				beforeEach(pushFn("parent before 1"));
				beforeEach(pushFn("parent before 2"));
				afterEach(pushFn("parent after 1"));
				afterEach(pushFn("parent after 2"));
				it(IRRELEVANT_NAME, pushFn("test 1"));
				it(IRRELEVANT_NAME, pushFn("test 2"));
				describe(IRRELEVANT_NAME, ({ beforeEach, afterEach, it }) => {
					beforeEach(pushFn("child before"));
					afterEach(pushFn("child after"));
					it(IRRELEVANT_NAME, pushFn("test 3"));
				});
			});

			await suite.runAsync();
			assert.deepEqual(ordering, [
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
				"parent after 2",
			]);
		});

		it("provides config", async () => {
			const myConfig = { myConfig: "my_config" };
			let beforeAllReceived, beforeEachReceived, afterEachReceived, afterAllReceived;

			const suite = TestSuite.createFn(IRRELEVANT_NAME, ({ beforeAll, beforeEach, afterEach, afterAll, it }) => {
				beforeAll(({ getConfig }) => { beforeAllReceived = getConfig("myConfig"); });
				beforeEach(({ getConfig }) => { beforeEachReceived = getConfig("myConfig"); });
				it(IRRELEVANT_NAME, () => {});
				afterEach(({ getConfig }) => { afterEachReceived = getConfig("myConfig"); });
				afterAll(({ getConfig }) => { afterAllReceived = getConfig("myConfig"); });
			});

			await suite.runAsync({ config: myConfig });

			assert.equal(beforeAllReceived, "my_config", "beforeAll");
			assert.equal(beforeEachReceived, "my_config", "beforeEach");
			assert.equal(afterEachReceived, "my_config", "afterEach");
			assert.equal(afterAllReceived, "my_config", "afterAll");
		});

		it("doesn't run beforeAll and afterAll when all children are skipped", async () => {
			let beforeRan = false;
			let afterRan = false;
			const suite = TestSuite.createFn("my suite", ({ it, beforeAll, afterAll }) => {
				beforeAll(() => {
					beforeRan = true;
				});
				afterAll(() => {
					afterRan = true;
				});
				it.skip("test 1", async () => {});
				it.skip("test 2", async () => {});
			});

			await suite.runAsync();
			assert.equal(beforeRan, false, "shouldn't run beforeAll()");
			assert.equal(afterRan, false, "shouldn't run afterAll()");
		});

		it("doesn't run beforeEach and afterEach when the test is skipped", async () => {
			let beforeRan = false;
			let afterRan = false;
			const suite = TestSuite.createFn("my suite", ({ it, beforeEach, afterEach }) => {
				beforeEach(() => {
					beforeRan = true;
				});
				afterEach(() => {
					afterRan = true;
				});
				it.skip("test 1", async () => {});
			});

			await suite.runAsync();
			assert.equal(beforeRan, false, "shouldn't run beforeEach()");
			assert.equal(afterRan, false, "shouldn't run afterEach()");
		});

		it("handles exception in beforeAll", async () => {
			const error = new Error("my error");
			const suite = TestSuite.createFn(({ it, beforeAll }) => {
				beforeAll(() => {
					throw error;
				});
				it("test 1", async () => {});
				it("test 2", async () => {});
			});

			assert.objEqual(await suite.runAsync(),
				TestResult.suite([], [
					TestResult.fail("beforeAll()", error),
				]),
			);
		});

		it("handles exception in afterAll", async () => {
			const error = new Error("my error");
			const suite = TestSuite.createFn(({ it, afterAll }) => {
				afterAll(() => {
					throw error;
				});
				it("test 1", async () => {});
				it("test 2", async () => {});
			});

			assert.objEqual(await suite.runAsync(),
				TestResult.suite([], [
					TestResult.pass("test 1"),
					TestResult.pass("test 2"),
					TestResult.fail("afterAll()", error),
				]),
			);
		});

		it("handles exception in beforeEach", async () => {
			const error = new Error("my error");
			const suite = TestSuite.createFn(({ it, beforeEach }) => {
				beforeEach(() => {
					throw error;
				});
				it("test 1", async () => {});
				it("test 2", async () => {});
			});

			assert.objEqual(await suite.runAsync(),
				TestResult.suite([], [
					TestResult.fail("test 1", error),
					TestResult.fail("test 2", error),
				]),
			);
		});

		it("doesn't run test when beforeEach throws exception", async () => {
			let testRan = false;
			const suite = TestSuite.createFn("my suite", ({ it, beforeEach }) => {
				beforeEach(() => {
					throw new Error();
				});
				it("my test", () => {
					testRan = true;
				});
			});

			await suite.runAsync();
			assert.equal(testRan, false);
		});

		it("handles exception in afterEach", async () => {
			const error = new Error("my error");
			const suite = TestSuite.createFn(({ it, afterEach }) => {
				afterEach(() => {
					throw error;
				});
				it("test 1", () => {});
				it("test 2", () => {});
			});

			assert.objEqual(await suite.runAsync(),
				TestResult.suite([], [
					TestResult.fail("test 1", error),
					TestResult.fail("test 2", error),
				]),
			);
		});

		it("runs afterEach() even when test throws exception", async() => {
			let afterEachRan = false;
			const suite = TestSuite.createFn("my suite", ({ it, afterEach }) => {
				afterEach(() => {
					afterEachRan = true;
				});
				it("my test", () => {
					throw new Error();
				});
			});

			await suite.runAsync();
			assert.equal(afterEachRan, true);
		});

		it("only reports test exception when both test and afterEach throw exceptions", async () => {
			const afterEachError = new Error("afterEach error");
			const testError = new Error("test error");

			const suite = TestSuite.createFn(({ it, afterEach }) => {
				afterEach(() => {
					throw afterEachError;
				});
				it("my test", () => {
					throw testError;
				});
			});

			assert.objEqual(await suite.runAsync(),
				TestResult.suite([], [
					TestResult.fail("my test", testError),
				]),
			);
		});

	});


	describe("timeouts", ({ it }) => {

		it("times out when test doesn't complete in expected amount of time", async () => {
			const clock = Clock.createNull();

			let beforeTime = null;
			let afterTime = null;
			const suite = TestSuite.createFn(({ it, beforeEach, afterEach }) => {
				beforeEach(() => {
					beforeTime = clock.now();
				});
				afterEach(() => {
					afterTime = clock.now();
				});
				it("my test", async () => {
					await clock.waitAsync(EXCEED_TIMEOUT);
				});
			});

			const actualPromise = suite.runAsync({ clock });
			await clock.tickUntilTimersExpireAsync();

			assert.objEqual(await actualPromise,
				TestResult.suite([], [
					TestResult.timeout("my test", DEFAULT_TIMEOUT)
				]),
				"result",
			);
			assert.equal(beforeTime, 0, "beforeEach() should run immediately");
			assert.equal(afterTime, DEFAULT_TIMEOUT, "afterEach() should run as soon as it() times out");
		});

		it("times out when beforeAll doesn't complete in expected amount of time", async () => {
			const clock = Clock.createNull();

			let itTime = null;
			let afterTime = null;
			const suite = TestSuite.createFn("my suite", ({ it, beforeAll, afterAll }) => {
				beforeAll(async () => {
					await clock.waitAsync(EXCEED_TIMEOUT);
				});
				afterAll(() => {
					afterTime = clock.now();
				});
				it("my test", () => {
					itTime = clock.now();
				});
			});

			const actualPromise = suite.runAsync({ clock });
			await clock.tickUntilTimersExpireAsync();

			assert.objEqual(await actualPromise,
				TestResult.suite("my suite", [
					TestResult.timeout("beforeAll()", DEFAULT_TIMEOUT)
				]),
				"result",
			);
			assert.equal(itTime, null, "it() should not run");
			assert.equal(afterTime, null, "afterAll() should not run");
		});

		it("times out when afterAll doesn't complete in expected amount of time", async () => {
			const clock = Clock.createNull();

			let beforeTime = null;
			let itTime = null;
			const suite = TestSuite.createFn(({ it, beforeAll, afterAll }) => {
				beforeAll(() => {
					beforeTime = clock.now();
				});
				afterAll(async () => {
					await clock.waitAsync(EXCEED_TIMEOUT);
				});
				it("test 1", () => {
					itTime = clock.now();
				});
				it("test 2", () => {});
			});

			const actualPromise = suite.runAsync({ clock });
			await clock.tickUntilTimersExpireAsync();

			assert.objEqual(await actualPromise,
				TestResult.suite([], [
					TestResult.pass("test 1"),
					TestResult.pass("test 2"),
					TestResult.timeout("afterAll()", DEFAULT_TIMEOUT),
				]),
				"result",
			);
			assert.equal(beforeTime, 0, "beforeAll() should run immediately");
			assert.equal(itTime, 0, "it() should run immediately");
		});

		it("times out when beforeEach doesn't complete in expected amount of time", async () => {
			const clock = Clock.createNull();

			let itTime = null;
			let afterTime = null;
			const suite = TestSuite.createFn(({ it, beforeEach, afterEach }) => {
				beforeEach(async () => {
					await clock.waitAsync(EXCEED_TIMEOUT);
				});
				afterEach(() => {
					afterTime = clock.now();
				});
				it("my test", () => {
					itTime = clock.now();
				});
			});

			const actualPromise = suite.runAsync({ clock });
			await clock.tickUntilTimersExpireAsync();

			assert.objEqual(await actualPromise,
				TestResult.suite([], [
					TestResult.timeout("my test", DEFAULT_TIMEOUT)
				]),
				"result",
			);
			assert.equal(itTime, null, "it() should not run");
			assert.equal(afterTime, null, "afterEach() should not run");
		});

		it("times out when afterEach doesn't complete in expected amount of time", async () => {
			const clock = Clock.createNull();

			let beforeTime = null;
			let itTime = null;
			const suite = TestSuite.createFn(({ it, beforeEach, afterEach }) => {
				beforeEach(() => {
					beforeTime = clock.now();
				});
				afterEach(async () => {
					await clock.waitAsync(EXCEED_TIMEOUT);
				});
				it("my test", () => {
					itTime = clock.now();
				});
			});

			const actualPromise = suite.runAsync({ clock });
			await clock.tickUntilTimersExpireAsync();

			assert.objEqual(await actualPromise,
				TestResult.suite([], [
					TestResult.timeout("my test", DEFAULT_TIMEOUT)
				]),
				"result",
			);
			assert.equal(beforeTime, 0, "beforeEach() should run immediately");
			assert.equal(itTime, 0, "it() should run immediately");
		});

		it("times out each function separately", async () => {
			const clock = Clock.createNull();
			const notQuiteTimeoutFn = async () => {
				await clock.waitAsync(DEFAULT_TIMEOUT - 1);
			};

			const suite = TestSuite.createFn(({ it, beforeAll, afterAll, beforeEach, afterEach }) => {
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

			const actualPromise = suite.runAsync({ clock });
			await clock.tickUntilTimersExpireAsync();

			assert.objEqual(await actualPromise,
				TestResult.suite([], [
					TestResult.pass("test 1"),  // all tests pass because nothing timed out
					TestResult.pass("test 2"),
				]),
			);
		});

		it("allows suites to configure timeout", async () => {
			const NEW_TIMEOUT = DEFAULT_TIMEOUT * 10;

			const clock = Clock.createNull();
			const notQuiteTimeoutFn = async () => {
				await clock.waitAsync(NEW_TIMEOUT - 1);
			};

			const suite = TestSuite.createFn(({
				it, setTimeout, beforeAll, afterAll, beforeEach, afterEach
			}) => {
				setTimeout(NEW_TIMEOUT);
				beforeAll(notQuiteTimeoutFn);
				afterAll(notQuiteTimeoutFn);
				beforeEach(notQuiteTimeoutFn);
				afterEach(notQuiteTimeoutFn);
				it("my test", notQuiteTimeoutFn);
			});

			const actualPromise = suite.runAsync({ clock });
			await clock.tickUntilTimersExpireAsync();

			assert.objEqual(await actualPromise,
				TestResult.suite([], [
					TestResult.pass("my test"),
				]),
			);
		});

		it("inherits parent's timeout", async () => {
			const NEW_TIMEOUT = DEFAULT_TIMEOUT * 10;

			const clock = Clock.createNull();
			const suite = TestSuite.createFn(({ describe, setTimeout }) => {
				setTimeout(NEW_TIMEOUT);
				describe(({ it }) => {
					it("my test", async () => {
						await clock.waitAsync(NEW_TIMEOUT - 1);
					});
				});
			});

			const actualPromise = suite.runAsync({ clock });
			await clock.tickUntilTimersExpireAsync();

			assert.objEqual(await actualPromise,
				TestResult.suite([], [
					TestResult.suite([], [
						TestResult.pass("my test"),
					]),
				]),
			);
		});

	});


	describe(".skip", ({ it }) => {

		it("skips tests that have no function", async () => {
			const suite = TestSuite.createFn(({ it }) => {
				it("my test");
			});

			const result = await suite.runAsync();
			assert.objEqual(result.suite[0], TestResult.skip("my test"));
		});

		it("skips tests that have '.skip'", async () => {
			let testRan = false;
			const suite = TestSuite.createFn(({ it }) => {
				it.skip("my test", () => {
					testRan = true;
				});
			});

			const result = await suite.runAsync();
			assert.equal(testRan, false, "should not run test");
			assert.objEqual(result.suite[0], TestResult.skip("my test"));
		});

		it("skips suites that have no function", async () => {
			const suite = TestSuite.createFn("my suite");
			const noName = TestSuite.createFn();

			assert.objEqual(await suite.runAsync(), TestResult.suite("my suite", []));
			assert.objEqual(await noName.runAsync(), TestResult.suite([], []));
		});

		it("recursively skips everything within a suite that has '.skip'", async () => {
			const suite = TestSuite.createFn.skip(({ describe, it }) => {
				it("test 1", () => {});
				it("test 2", () => {});
				describe(({ it }) => {
					it("test 3", () => {});
				});
			});

			const result = await suite.runAsync();
			assert.objEqual(result,
				TestResult.suite([], [
					TestResult.skip("test 1"),
					TestResult.skip("test 2"),
					TestResult.suite([], [
						TestResult.skip("test 3"),
					]),
				]),
			);
		});

	});


	describe(".only", ({ it }) => {

		it("if any tests are marked .only, it only runs those tests", async () => {
			const suite = TestSuite.createFn(({ it }) => {
				it.only(".only", () => {});
				it("not .only", () => {});
			});

			assert.deepEqual(await suite.runAsync(),
				TestResult.suite([], [
					TestResult.pass(".only"),
					TestResult.skip("not .only"),
				]),
			);
		});

		it("if a suite is marked .only and none of its tests are, runs all of those tests", async () => {
			const suite = TestSuite.createFn(({ describe }) => {
				describe("not .only", ({ it }) => {
					it("test1", () => {});
					it("test2", () => {});
				});
				describe.only(".only", ({ it }) => {
					it("test3", () => {});
					it("test4", () => {});
				});
			});

			assert.deepEqual(await suite.runAsync(),
				TestResult.suite([], [
					TestResult.suite("not .only", [
						TestResult.skip([ "not .only", "test1" ]),
						TestResult.skip([ "not .only", "test2" ]),
					]),
					TestResult.suite(".only", [
						TestResult.pass([ ".only", "test3" ]),
						TestResult.pass([ ".only", "test4" ]),
					]),
				]),
			);
		});

		it("if a suite is marked .only and none of its children are, run those tests recursively", async () => {
			const suite = TestSuite.createFn.only(({ describe }) => {
				describe(({ it }) => {
					it("test", () => {});
				});
			});

			assert.deepEqual(await suite.runAsync(),
				TestResult.suite([], [
					TestResult.suite([], [
						TestResult.pass("test"),
					]),
				]),
			);
		});

		it("if a suite is marked .only and one of its children is also, only run that test", async () => {
			const suite = TestSuite.createFn.only(({ it }) => {
				it("not only", () => {});
				it.only("only", () => {});
			});

			assert.deepEqual(await suite.runAsync(),
				TestResult.suite([], [
					TestResult.skip("not only"),
					TestResult.pass("only"),
				]),
			);
		});

		it("if a suite is marked .only and one of its grandchildren is also, only run that test", async () => {
			const suite = TestSuite.createFn.only(({ describe }) => {
				describe(({ it }) => {
					it("not only", () => {});
					it.only("only", () => {});
				});
			});

			assert.deepEqual(await suite.runAsync(),
				TestResult.suite([], [
					TestResult.suite([], [
						TestResult.skip("not only"),
						TestResult.pass("only"),
					]),
				]),
			);
		});

		it("if a suite is marked .only and one of its child suites is also, only run that suite", async () => {
			const suite = TestSuite.createFn.only(({ describe }) => {
				describe("not only", ({ it }) => {
					it("test1", () => {});
				});
				describe.only("only", ({ it }) => {
					it("test2", () => {});
				});
			});

			assert.deepEqual(await suite.runAsync(),
				TestResult.suite([], [
					TestResult.suite("not only", [
						TestResult.skip([ "not only", "test1" ]),
					]),
					TestResult.suite("only", [
						TestResult.pass([ "only", "test2" ]),
					]),
				]),
			);
		});

		it("if a suite is marked .only and a child is marked .skip, skip the child", async () => {
			const suite = TestSuite.createFn.only(({ describe }) => {
				describe(({ it }) => {
					it.skip("test1", () => {});
					it("test2", () => {});
				});
			});

			assert.deepEqual(await suite.runAsync(),
				TestResult.suite([], [
					TestResult.suite([], [
						TestResult.skip("test1"),
						TestResult.pass("test2"),
					]),
				]),
			);
		});

		it("if a suite is marked .skip and a child is marked .only, run the child", async () => {
			const suite = TestSuite.createFn.skip(({ describe }) => {
				describe(({ it }) => {
					it.only("test1", () => {});
					it("test2", () => {});
				});
			});

			assert.deepEqual(await suite.runAsync(),
				TestResult.suite([], [
					TestResult.suite([], [
						TestResult.pass("test1"),
						TestResult.skip("test2"),
					]),
				]),
			);
		});

		it("if a suite is marked .only and a child suite is marked .skip, skip its children", async () => {
			const suite = TestSuite.createFn.only(({ describe }) => {
				describe.skip(({ it }) => {
					it("test1", () => {});
					it("test2", () => {});
				});
			});

			assert.deepEqual(await suite.runAsync(),
				TestResult.suite([], [
					TestResult.suite([], [
						TestResult.skip("test1"),
						TestResult.skip("test2"),
					]),
				]),
			);
		});

		it("if a suite is marked .skip and a child suite is marked .only, run its children", async () => {
			const suite = TestSuite.createFn.skip(({ describe }) => {
				describe.only(({ it }) => {
					it("test1", () => {});
					it("test2", () => {});
				});
			});

			assert.deepEqual(await suite.runAsync(),
				TestResult.suite([], [
					TestResult.suite([], [
						TestResult.pass("test1"),
						TestResult.pass("test2"),
					]),
				]),
			);
		});

	});

});


async function runTestAsync(testName, testFn) {
	const suite = TestSuite.createFn(({ it }) => {
		it(testName, testFn);
	});
	const result = await suite.runAsync();
	return result.suite[0];
}
