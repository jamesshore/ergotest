// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import {
	afterAll,
	assert,
	beforeAll,
	createFail,
	createPass,
	createSkip,
	createSuite,
	createTimeout,
	describe,
	it,
} from "../../util/tests.js";
import { importRendererAsync, TestSuite } from "./test_suite.js";
import {
	afterAll as afterAll_sut,
	afterEach as afterEach_sut,
	beforeAll as beforeAll_sut,
	beforeEach as beforeEach_sut,
	describe as describe_sut,
	it as it_sut,
} from "../test_api.js";
import { Clock } from "../../infrastructure/clock.js";
import { TestCaseResult, TestMark, TestResult, TestStatus } from "../results/test_result.js";
import path from "node:path";
import { fromModulesAsync } from "../runner/loader.js";
// dependency: ./_module_passes.js
// dependency: ./_module_throws.js
// dependency: ./_module_no_export.js
// dependency: ../_renderer_custom.js
// dependency: ../_renderer_no_export.js
// dependency: ../_renderer_not_function.js
// dependency: _test_renderer/_renderer_in_node_modules.js

// Tests for my test library. (How meta.)

const SUCCESS_MODULE_PATH = path.resolve(import.meta.dirname, "./_module_passes.js");
const THROWS_MODULE_PATH = path.resolve(import.meta.dirname, "./_module_throws.js");
const NO_EXPORT_MODULE_PATH = path.resolve(import.meta.dirname, "./_module_no_export.js");

const CUSTOM_RENDERER_PATH = path.resolve(import.meta.dirname, "../_renderer_custom.js");
const NO_EXPORT_RENDERER_PATH = path.resolve(import.meta.dirname, "../_renderer_no_export.js");
const NOT_FUNCTION_RENDERER_PATH = path.resolve(import.meta.dirname, "../_renderer_not_function.js");
const NODE_MODULES_RENDERER_NAME = "_test_renderer/_renderer_in_node_modules.js";

const IRRELEVANT_NAME = "irrelevant name";
const DEFAULT_TIMEOUT = TestSuite.DEFAULT_TIMEOUT_IN_MS;

const ERROR = new Error("my error");
const PASS_FN = () => {};
const FAIL_FN = () => { throw ERROR; };


export default describe(() => {

	describe("test modules", () => {

		it("creates test suite from a module (and sets filename on result)", async () => {
			const suite = await fromModulesAsync([ SUCCESS_MODULE_PATH, SUCCESS_MODULE_PATH ]);

			const testCaseResult = createPass({ name: "passes", filename: SUCCESS_MODULE_PATH });
			assert.dotEquals(await suite.runAsync(),
				createSuite({ tests: [
					createSuite({ tests: [ testCaseResult ], filename: SUCCESS_MODULE_PATH }),
					createSuite({ tests: [ testCaseResult ], filename: SUCCESS_MODULE_PATH }),
				]}),
			);
		});

		it("fails gracefully if module isn't an absolute path", async () => {
			const suite = await fromModulesAsync([ "./_module_passes.js" ]);
			const result = (await suite.runAsync()).allTests()[0];

			assert.equal(result.name, [ "error when importing _module_passes.js" ]);
			assert.isUndefined(result.filename);
			assert.equal(result.status, TestStatus.fail);
			assert.equal(result.errorMessage, "Test module filenames must use absolute paths: ./_module_passes.js");
		});

		it("fails gracefully if module doesn't exist", async () => {
			const suite = await fromModulesAsync([ "/no_such_module.js" ]);
			const result = (await suite.runAsync()).allTests()[0];

			assert.equal(result.name, [ "error when importing no_such_module.js" ]);
			assert.equal(result.filename, "/no_such_module.js");
			assert.equal(result.status, TestStatus.fail);
			assert.equal(result.errorMessage, `Test module not found: /no_such_module.js`);
		});

		it("fails gracefully if module fails to require()", async () => {
			const suite = await fromModulesAsync([ THROWS_MODULE_PATH ]);
			const result = (await suite.runAsync()).allTests()[0];

			assert.equal(result.name, [ "error when importing _module_throws.js" ]);
			assert.equal(result.filename, THROWS_MODULE_PATH);
			assert.equal(result.status, TestStatus.fail);
			assert.equal(result.errorMessage, "my require error");
		});

		it("fails gracefully if module doesn't export a test suite", async () => {
			const suite = await fromModulesAsync([ NO_EXPORT_MODULE_PATH ]);
			const result = (await suite.runAsync()).allTests()[0];

			assert.equal(result.name, [ "error when importing _module_no_export.js" ]);
			assert.equal(result.filename, NO_EXPORT_MODULE_PATH);
			assert.equal(result.status, TestStatus.fail);
			assert.equal(result.errorMessage, `Test module doesn't export a test suite: ${NO_EXPORT_MODULE_PATH}`);
		});

	});


	describe("custom rendering", () => {

		it("uses custom error renderer to render test failures", async () => {
			const options = {
				renderer: CUSTOM_RENDERER_PATH,
			};

			const suite = await fromModulesAsync([ THROWS_MODULE_PATH ]);
			const result = (await suite.runAsync(options)).allTests()[0];

			await assert.equal(result.errorRender, "custom rendering");
		});

		it("support error renderers that are defined in node_modules", async () => {
			const options = {
				renderer: NODE_MODULES_RENDERER_NAME,
			};

			const suite = await fromModulesAsync([ THROWS_MODULE_PATH ]);
			const result = (await suite.runAsync(options)).allTests()[0];

			await assert.equal(result.errorRender, "node_modules rendering");
		});

		it("exports custom renderer import function", async () => {
			const renderError = await importRendererAsync(CUSTOM_RENDERER_PATH);
			await assert.equal(renderError(), "custom rendering");
		});

		it("fails fast if error renderer doesn't exist", async () => {
			await assert.errorAsync(
				() => importRendererAsync("./no_such_renderer.js"),
				"Renderer module not found (did you forget to use an absolute path?): ./no_such_renderer.js",
			);
		});

		it("fails fast if error renderer doesn't export correct function", async () => {
			await assert.errorAsync(
				() => importRendererAsync(NO_EXPORT_RENDERER_PATH),
				`Renderer module doesn't export a renderError() function: ${NO_EXPORT_RENDERER_PATH}`,
			);
		});

		it("fails fast if error renderer exports something other than a function", async () => {
			await assert.errorAsync(
				() => importRendererAsync(NOT_FUNCTION_RENDERER_PATH),
				`Renderer module's 'renderError' export must be a function, but it was a string: ${NOT_FUNCTION_RENDERER_PATH}`,
			);
		});

	});


	describe("test suites", () => {

		it("executes immediately (but tests don't)", () => {
			let suiteRan = false;
			let testRan = false;
			describe_sut(() => {
				suiteRan = true;
				it_sut(IRRELEVANT_NAME, () => {
					testRan = true;
				});
			});

			assert.equal(suiteRan, true, "should run suite");
			assert.equal(testRan, false, "should not run test");
		});

		it("returns test results when run", async () => {
			const suite = describe_sut(() => {
				it_sut("test 1", () => {});
				it_sut("test 2", () => {});
				it_sut("test 3", () => {});
			});

			const result = await suite.runAsync();
			assert.dotEquals(result,
				createSuite({ tests: [
					createPass({ name: "test 1" }),
					createPass({ name: "test 2" }),
					createPass({ name: "test 3" }),
				]}),
			);
		});

		it("uses custom renderer for test failures", async () => {
			const suite = describe_sut(() => {
				it_sut("test", () => {
					throw new Error("my error");
				});
			});

			const result = await suite.runAsync({
				renderer: CUSTOM_RENDERER_PATH,
			});

			assert.equal(result.allTests()[0].errorRender, "custom rendering");
		});

		it("can be nested", async () => {
			const top = describe_sut("top", () => {
				describe_sut("middle", () => {
					describe_sut("bottom", () => {
						it_sut("my test", () => {});
					});
				});
			});

			const result = await top.runAsync();
			assert.dotEquals(result,
				createSuite({ name: "top", tests: [
					createSuite({ name: [ "top", "middle" ], tests: [
						createSuite({ name: [ "top", "middle", "bottom" ], tests: [
							createPass({ name: [ "top", "middle", "bottom", "my test" ] }),
						]}),
					]}),
				]}),
			);
		});

		it("retains correct context as nesting expands and contracts", async () => {
			const top = describe_sut("top", () => {
				it_sut("top.1", () => {});
				describe_sut("middle", () => {
					it_sut("middle.1", () => {});
					describe_sut("bottom", () => {
						it_sut("bottom.1", () => {});
					});
					it_sut("middle.2", () => {});
				});
				it_sut("top.2", () => {});
			});

			assert.equal(await top.runAsync(),
				createSuite({ name: "top", tests: [
					createPass({ name: [ "top", "top.1" ] }),
					createSuite({ name: [ "top", "middle" ], tests: [
						createPass({ name: [ "top", "middle", "middle.1" ] }),
						createSuite({ name: [ "top", "middle", "bottom" ], tests: [
							createPass({ name: [ "top", "middle", "bottom", "bottom.1" ] }),
						]}),
						createPass({ name: [ "top", "middle", "middle.2" ] }),
					]}),
					createPass({ name: [ "top", "top.2" ] }),
				]}),
			);
		});

		it("retains correct context even if a nested describe block throws an exception", async () => {
			const parent = describe_sut("parent", () => {
				it_sut("parent.1", () => {});
				try {
					describe_sut("child", () => {
						throw new Error("my exception");
					});
				}
				catch {
					// ignored
				}
				it_sut("parent.2", () => {});
			});

			assert.equal(await parent.runAsync(),
				createSuite({ name: "parent", tests: [
					createPass({ name: [ "parent", "parent.1" ] }),
					createPass({ name: [ "parent", "parent.2" ] }),
				]}),
			);
		});

		it("can be run multiple times", () => {
			describe_sut();
			describe_sut();
		});

		it("can be run multiple times even if a previous run results in an exception", () => {
			try {
				describe_sut(() => {
					throw new Error("my exception");
				});
			}
			catch {
				// ignored
			}

			describe_sut();
		});

		it("propagates filename into children's test results", async () => {
			const clock = await Clock.createNullAsync();
			const filename = "my_filename";

			const suite = describe_sut(() => {
				it_sut("pass", () => {});
				it_sut.skip("skip", () => {});
				it_sut("fail", () => { throw Error("fail"); });
				it_sut("timeout", async () => { await clock.waitAsync(DEFAULT_TIMEOUT + 1); });
				it_sut("test without body");
				describe_sut("suite without body");
			});
			suite._setFilename(filename);

			const actualPromise = suite.runAsync({ clock });
			clock.tickUntilTimersExpireAsync();

			assert.dotEquals(await actualPromise, createSuite({ filename, tests: [
				createPass({ name: "pass", filename }),
				createSkip({ name: "skip", mark: TestMark.skip, filename }),
				createFail({ name: "fail", error: new Error("fail"), filename }),
				createTimeout({ name: "timeout", timeout: DEFAULT_TIMEOUT, filename }),
				createSkip({ name: "test without body", mark: TestMark.skip, filename }),
				createSuite({ name: "suite without body", mark: TestMark.skip, filename }),
			]}));
		});

		it("propagates filename into before/after results", async () => {
			const filename = "my_filename";

			const suite = describe_sut(() => {
				beforeAll_sut(PASS_FN);
				afterAll_sut(FAIL_FN);
				beforeEach_sut(PASS_FN);
				afterEach_sut(FAIL_FN);
				it_sut("test", PASS_FN);
			});
			suite._setFilename(filename);

			assert.equal(await suite.runAsync(), createSuite({
				filename,
				beforeAll: [ createPass({ name: "beforeAll() #1", filename }) ],
				afterAll: [ createFail({ name: "afterAll() #1", error: ERROR, filename }) ],
				tests: [ createPass({
					name: "test",
					filename,
					beforeEach: [ createPass({ name: "beforeEach()", filename }) ],
					afterEach: [ createFail({ name: "afterEach()", error: ERROR, filename }) ],
				}) ],
			}));
		});

	});


	describe("test cases", () => {

		it("runs when its parent suite is run", async () => {
			let testRan = false;
			const suite = describe_sut(() => {
				it_sut(IRRELEVANT_NAME, () => {
					testRan = true;
				});
			});

			assert.equal(testRan, false, "before suite runs");
			await suite.runAsync();
			assert.equal(testRan, true, "after suite runs");
		});

		it("works with asynchronous code", async () => {
			let testRan = false;
			const suite = describe_sut(() => {
				it_sut(IRRELEVANT_NAME, async () => {
					await new Promise<void>((resolve) => {
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
			assert.dotEquals(result, createPass({ name: "my test" }));
		});

		it("fails when test throws exception", async () => {
			const error = new Error("my error");
			const result = await runTestAsync("my test", () => {
				throw error;
			});
			assert.dotEquals(result, createFail({ name: "my test", error }));
		});

		it("can retrieve config variables", async () => {
			const myConfig = { myConfig: "my_config" };
			let receivedConfig;

			const suite = describe_sut(() => {
				it_sut(IRRELEVANT_NAME, ({ getConfig }) => {
					receivedConfig = getConfig("myConfig");
				});
			});

			await suite.runAsync({ config: myConfig });
			assert.equal(receivedConfig, "my_config");
		});

		it("fails fast when no config defined", async () => {
			const suite = describe_sut(() => {
				it_sut(IRRELEVANT_NAME, ({ getConfig }) => {
					getConfig("no_such_config");
				});
			});

			const results = await suite.runAsync({});
			assert.dotEquals(results, createSuite({ tests: [
				createFail({ name: IRRELEVANT_NAME, error: new Error("No test config found for name 'no_such_config'") }),
			]}));
		});

		it("fails fast when config defined, but config variable not found", async () => {
			const suite = describe_sut(() => {
				it_sut(IRRELEVANT_NAME, ({ getConfig }) => {
					getConfig("no_such_config");
				});
			});

			const results = await suite.runAsync({ config: {} });
			assert.dotEquals(results, createSuite({ tests: [
				createFail({ name: IRRELEVANT_NAME, error: new Error("No test config found for name 'no_such_config'") }),
			]}));
		});

		it("fails when run outside of describe()", () => {
			assert.error(
				() => it_sut(IRRELEVANT_NAME),
				"it() must be run inside describe()",
			);
			assert.error(
				() => it_sut.skip(IRRELEVANT_NAME),
				"it() must be run inside describe()",
			);
			assert.error(
				() => it_sut.only(IRRELEVANT_NAME),
				"it() must be run inside describe()",
			);
		});

	});


	describe("naming", () => {

		it("test suites can be created with and without a name", async () => {
			const name = describe_sut("named", () => {
				it_sut("has a name", () => {});
			});
			const noName = describe_sut(() => {
				it_sut("has no name", () => {});
			});

			assert.equal(await name.runAsync(), createSuite({
				name: "named",
				tests: [ createPass({ name: [ "named", "has a name" ] }) ],
			}));

			assert.equal(await noName.runAsync(), createSuite({
				tests: [ createPass({ name: "has no name" }) ],
			}));
		});

		it("test cases without names are given a default", async () => {
			const suite = describe_sut(() => {
				it_sut("", () => {});
			});

			assert.equal(await suite.runAsync(),
				createSuite({ tests: [
					createPass({ name: "(unnamed)" })
				]
			}));
		});

		it("sets name of test result to include nested suites", async () => {
			const top = describe_sut("top", () => {
				describe_sut("middle", () => {
					describe_sut("bottom", () => {
						it_sut("my test", () => {});
					});
				});
			});

			const result = await top.runAsync();
			assert.dotEquals(result,
				createSuite({ name: [ "top" ], tests: [
					createSuite({ name: [ "top", "middle" ], tests: [
						createSuite({ name: [ "top", "middle", "bottom" ], tests: [
							createPass({ name: [ "top", "middle", "bottom", "my test" ] }),
						]}),
					]}),
				]}),
			);
		});

		it("collapses unnamed suites when setting test result name", async () => {
			const top = describe_sut("top", () => {
				describe_sut("", () => {
					describe_sut("", () => {
						it_sut("my test", () => {});
					});
				});
			});

			const result = await top.runAsync();
			assert.dotEquals(result,
				createSuite({ name: "top", tests: [
					createSuite({ name: "top", tests: [
						createSuite({ name: "top", tests: [
							createPass({ name: [ "top", "my test" ] }),
						]}),
					]}),
				]}),
			);
		});

	});


	describe("before/after", () => {

		it("runs function before and after all tests in a suite", async () => {
			const ordering: string[] = [];
			const pushFn: ((message: string) => () => void) = (message: string) => {
				return () => ordering.push(message);
			};

			const suite = describe_sut(IRRELEVANT_NAME, () => {
				beforeAll_sut(pushFn("parent before 1"));
				beforeAll_sut(pushFn("parent before 2"));
				afterAll_sut(pushFn("parent after 1"));
				afterAll_sut(pushFn("parent after 2"));
				it_sut(IRRELEVANT_NAME, pushFn("test 1"));
				it_sut(IRRELEVANT_NAME, pushFn("test 2"));
				describe_sut(IRRELEVANT_NAME, () => {
					beforeAll_sut(pushFn("child before"));
					afterAll_sut(pushFn("child after"));
					it_sut(IRRELEVANT_NAME, pushFn("test 3"));
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
				"parent after 2",
			]);
		});

		it("runs function before and after each test in a suite", async () => {
			const ordering: string[] = [];
			const pushFn: ((message: string) => () => void) = (message) => {
				return () => ordering.push(message);
			};

			const suite = describe_sut(IRRELEVANT_NAME, () => {
				beforeEach_sut(pushFn("parent before 1"));
				beforeEach_sut(pushFn("parent before 2"));
				afterEach_sut(pushFn("parent after 1"));
				afterEach_sut(pushFn("parent after 2"));
				it_sut(IRRELEVANT_NAME, pushFn("test 1"));
				it_sut(IRRELEVANT_NAME, pushFn("test 2"));
				describe_sut(IRRELEVANT_NAME, () => {
					beforeEach_sut(pushFn("child before"));
					afterEach_sut(pushFn("child after"));
					it_sut(IRRELEVANT_NAME, pushFn("test 3"));
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
				"parent after 2",
			]);
		});

		it("provides config", async () => {
			const myConfig = { myConfig: "my_config" };
			let beforeAllReceived, beforeEachReceived, afterEachReceived, afterAllReceived;

			const suite = describe_sut(IRRELEVANT_NAME, () => {
				beforeAll_sut(({ getConfig }) => { beforeAllReceived = getConfig("myConfig"); });
				beforeEach_sut(({ getConfig }) => { beforeEachReceived = getConfig("myConfig"); });
				it_sut(IRRELEVANT_NAME, () => {});
				afterEach_sut(({ getConfig }) => { afterEachReceived = getConfig("myConfig"); });
				afterAll_sut(({ getConfig }) => { afterAllReceived = getConfig("myConfig"); });
			});

			await suite.runAsync({ config: myConfig });

			assert.equal(beforeAllReceived, "my_config", "beforeAll");
			assert.equal(beforeEachReceived, "my_config", "beforeEach");
			assert.equal(afterEachReceived, "my_config", "afterEach");
			assert.equal(afterAllReceived, "my_config", "afterAll");
		});

		it("includes beforeAll() and afterAll() functions in test results", async () => {
			const suite = describe_sut("parent", () => {
				beforeAll_sut(PASS_FN);
				beforeAll_sut(PASS_FN);
				afterAll_sut(PASS_FN);
				afterAll_sut(PASS_FN);
				it_sut("test 1", PASS_FN);
				describe_sut("child", () => {
					beforeAll_sut(PASS_FN);
					afterAll_sut(PASS_FN);
					it_sut("test 2", PASS_FN);
				});
			});

			assert.equal(
				await suite.runAsync(),
				createSuite({
					name: "parent",
					beforeAll: [
						createPass({ name: [ "parent", "beforeAll() #1" ]}),
						createPass({ name: [ "parent", "beforeAll() #2" ]}),
					],
					afterAll: [
						createPass({ name: [ "parent", "afterAll() #1" ]}),
						createPass({ name: [ "parent", "afterAll() #2" ]}),
					],
					tests: [
						createPass({ name: [ "parent", "test 1" ] }),
						createSuite({
							name: [ "parent", "child" ],
							beforeAll: [ createPass({ name: [ "parent", "child", "beforeAll() #1" ]}) ],
							afterAll: [ createPass({ name: [ "parent", "child", "afterAll() #1" ]}) ],
							tests: [ createPass({ name: [ "parent", "child", "test 2" ] }) ],
						}),
					],
				}),
			);
		});

		it("includes beforeEach() and afterEach() functions in passing test results", async () => {
			const suite = describe_sut("parent", () => {
				beforeEach_sut(PASS_FN);
				beforeEach_sut(PASS_FN);
				afterEach_sut(PASS_FN);
				afterEach_sut(PASS_FN);
				it_sut("pass", PASS_FN);
				describe_sut("child", () => {
					beforeEach_sut(PASS_FN);
					afterEach_sut(PASS_FN);
					it_sut("nested", PASS_FN);
				});
			});

			assert.equal(await suite.runAsync(), createSuite({
					name: "parent",
					tests: [
						createPass({
							name: [ "parent", "pass" ],
							beforeEach: [
								createPass({ name: [ "parent", "beforeEach()" ]}),
								createPass({ name: [ "parent", "beforeEach() #2" ]}),
							],
							afterEach: [
								createPass({ name: [ "parent", "afterEach()" ]}),
								createPass({ name: [ "parent", "afterEach() #2" ]}),
							],
						}),
						createSuite({
							name: [ "parent", "child" ],
							tests: [
								createPass({
									name: [ "parent", "child", "nested" ],
									beforeEach: [
										createPass({ name: [ "parent", "beforeEach()" ]}),
										createPass({ name: [ "parent", "beforeEach() #2" ]}),
										createPass({ name: [ "parent", "child", "beforeEach()" ]}),
									],
									afterEach: [
										createPass({ name: [ "parent", "child", "afterEach()" ]}),
										createPass({ name: [ "parent", "afterEach()" ]}),
										createPass({ name: [ "parent", "afterEach() #2" ]}),
									],
								}),
							],
						}),
					],
				}),
			);
		});

		it("includes beforeEach() and afterEach() functions in test results skipped due to .only", async () => {
			const suite = describe_sut(() => {
				beforeEach_sut(PASS_FN);
				afterEach_sut(PASS_FN);
				it_sut.only("only", PASS_FN);
				it_sut("skipped", PASS_FN);
			});

			assert.equal(await suite.runAsync(), createSuite({
				tests: [
					createPass({
						name: "only",
						mark: "only",
						beforeEach: [ createPass({ name: "beforeEach()" }) ],
						afterEach: [ createPass({ name: "afterEach()" }) ],
					}),
					createSkip({
						name: "skipped",
						beforeEach: [ createSkip({ name: "beforeEach()" }) ],
						afterEach: [ createSkip({ name: "afterEach()" }) ],
					}),
				]
			}));
		});

		it("includes beforeEach() and afterEach() functions in test results for tests marked .only and have no body", async () => {
			const suite = describe_sut(() => {
				beforeEach_sut(PASS_FN);
				afterEach_sut(PASS_FN);
				it_sut.only("only");
			});

			assert.equal(await suite.runAsync(), createSuite({
				tests: [
					createFail({
						name: "only",
						mark: "only",
						error: "Test is marked '.only', but it has no body",
						beforeEach: [ createSkip({ name: "beforeEach()" }) ],
						afterEach: [ createSkip({ name: "afterEach()" }) ],
					}),
				]
			}));
		});

		it("fails when run outside of describe()", () => {
			assert.error(
				() => beforeAll_sut(() => {}),
				"beforeAll() must be run inside describe()",
			);
			assert.error(
				() => beforeEach_sut(() => {}),
				"beforeEach() must be run inside describe()",
			);
			assert.error(
				() => afterAll_sut(() => {}),
				"afterAll() must be run inside describe()",
			);
			assert.error(
				() => afterEach_sut(() => {}),
				"afterEach() must be run inside describe()",
			);
		});


		describe("beforeAll/afterAll edge cases", () => {

			it("doesn't run beforeAll() and afterAll() when all children are skipped", async () => {
				const suite = describe_sut(() => {
					beforeAll_sut(PASS_FN);
					beforeAll_sut(PASS_FN);
					afterAll_sut(PASS_FN);
					afterAll_sut(PASS_FN);
					it_sut.skip("test 1", PASS_FN);
					it_sut("test 2");
				});

				assert.equal(await suite.runAsync(), createSuite({
					beforeAll: [
						createSkip({ name: "beforeAll() #1", mark: "none" }),
						createSkip({ name: "beforeAll() #2", mark: "none" }),
					],
					afterAll: [
						createSkip({ name: "afterAll() #1", mark: "none" }),
						createSkip({ name: "afterAll() #2", mark: "none" }),
					],
					tests: [
						createSkip({ name: "test 1", mark: "skip" }),
						createSkip({ name: "test 2", mark: "skip" }),
					],
				}));
			});

			it("runs afterAll() even when tests throw exception", async () => {
				const suite = describe_sut(() => {
					afterAll_sut(PASS_FN);
					it_sut("test", FAIL_FN);
				});

				assert.equal(await suite.runAsync(), createSuite({
					afterAll: [ createPass({ name: "afterAll() #1" }) ],
					tests: [ createFail({ name: "test", error: ERROR }) ],
				}));
			});

			it("doesn't run tests when beforeAll() fails", async () => {
				const suite = describe_sut(() => {
					beforeAll_sut(FAIL_FN);
					it_sut("test 1", async () => {});
					it_sut("test 2", async () => {});
				});

				assert.equal(await suite.runAsync(), createSuite({
					beforeAll: [ createFail({ name: "beforeAll() #1", error: ERROR }) ],
					tests: [
						createSkip({ name: "test 1" }),
						createSkip({ name: "test 2" }),
					]}),
				);
			});

			it("stops running beforeAll() functions if one fails", async () => {
				const suite = describe_sut(() => {
					beforeAll_sut(PASS_FN);
					beforeAll_sut(PASS_FN);
					beforeAll_sut(FAIL_FN);
					beforeAll_sut(PASS_FN);
					it_sut("test", PASS_FN);
				});

				assert.equal(await suite.runAsync(), createSuite({
					beforeAll: [
						createPass({ name: "beforeAll() #1" }),
						createPass({ name: "beforeAll() #2" }),
						createFail({ name: "beforeAll() #3", error: ERROR }),
						createSkip({ name: "beforeAll() #4" }),
					],
					tests: [ createSkip({ name: "test" }) ],
				}));
			});

			it("doesn't run afterAll() when beforeAll() fails", async () => {
				const suite = describe_sut(() => {
					beforeAll_sut(FAIL_FN);
					afterAll_sut(PASS_FN);
					afterAll_sut(PASS_FN);
					it_sut("test", PASS_FN);
				});

				assert.equal(await suite.runAsync(), createSuite({
					beforeAll: [ createFail({ name: "beforeAll() #1", error: ERROR }) ],
					afterAll: [
						createSkip({ name: "afterAll() #1" }),
						createSkip({ name: "afterAll() #2" }),
					],
					tests: [ createSkip({ name: "test" }) ],
				}));
			});

			it("continues running afterAll() even when one fails", async () => {
				const suite = describe_sut(() => {
					afterAll_sut(PASS_FN);
					afterAll_sut(PASS_FN);
					afterAll_sut(FAIL_FN);
					afterAll_sut(PASS_FN);
					it_sut("test", PASS_FN);
				});

				assert.equal(await suite.runAsync(), createSuite({
					afterAll: [
						createPass({ name: "afterAll() #1" }),
						createPass({ name: "afterAll() #2" }),
						createFail({ name: "afterAll() #3", error: ERROR }),
						createPass({ name: "afterAll() #4" }),
					],
					tests: [ createPass({ name: "test" }) ],
				}));
			});

		});

		describe("beforeEach/afterEach edge cases", () => {

			it("doesn't inherit test mark", async () => {
				const suite = describe_sut(() => {
					beforeEach_sut(PASS_FN);
					afterEach_sut(PASS_FN);
					it_sut.only("test", async () => {});
				});

				assert.equal(await suite.runAsync(), createSuite({
					tests: [
						createPass({
							name: "test",
							mark: TestMark.only,
							beforeEach: [
								createPass({ name: "beforeEach()" }),
							],
							afterEach: [
								createPass({ name: "afterEach()" }),
							],
						}),
					],
				}));
			});

			it("doesn't run beforeEach() and afterEach() when the test is skipped", async () => {
				const suite = describe_sut(() => {
					beforeEach_sut(PASS_FN);
					afterEach_sut(PASS_FN);
					it_sut.skip("test", async () => {});
				});

				assert.equal(await suite.runAsync(), createSuite({
					tests: [
						createSkip({
							name: "test",
							mark: TestMark.skip,
							beforeEach: [
								createSkip({ name: "beforeEach()" }),
							],
							afterEach: [
								createSkip({ name: "afterEach()" }),
							],
						}),
					],
				}));
			});

			it("runs afterEach() even when test throws exception", async () => {
				const suite = describe_sut(() => {
					afterEach_sut(PASS_FN);
					it_sut("test", FAIL_FN);
				});

				assert.equal(await suite.runAsync(), createSuite({
					tests: [
						createFail({
							name: "test",
							error: ERROR,
							afterEach: [ createPass({ name: "afterEach()" }) ],
						}),
					],
				}));
			});

			it("handles exception in afterEach()", async () => {
				const suite = describe_sut(() => {
					afterEach_sut(FAIL_FN);
					it_sut("test 1", PASS_FN);
					it_sut("test 2", PASS_FN);
				});

				assert.dotEquals(
					await suite.runAsync(),
					createSuite({ tests: [
						createPass({
							name: "test 1",
							afterEach: [ createFail({ name: "afterEach()", error: ERROR }) ],
						}),
						createPass({
							name: "test 2",
							afterEach: [ createFail({ name: "afterEach()", error: ERROR }) ],
						}),
					]}),
				);
			});

			it("doesn't run test when beforeEach() fails", async () => {
				const suite = describe_sut(() => {
					beforeEach_sut(FAIL_FN);
					it_sut("test 1", PASS_FN);
					it_sut("test 2", PASS_FN);
				});

				assert.equal(await suite.runAsync(), createSuite({
					tests: [
						createSkip({
							name: "test 1",
							beforeEach: [ createFail({ name: "beforeEach()", error: ERROR }) ],
						}),
						createSkip({
							name: "test 2",
							beforeEach: [ createFail({ name: "beforeEach()", error: ERROR }) ],
						}),
					]}),
				);
			});

			it("stops running beforeEach() functions if one fails", async () => {
				const suite = describe_sut(() => {
					beforeEach_sut(PASS_FN);
					beforeEach_sut(PASS_FN);
					beforeEach_sut(FAIL_FN);
					beforeEach_sut(PASS_FN);
					it_sut("test", PASS_FN);
				});

				assert.equal(await suite.runAsync(), createSuite({
					tests: [ createSkip({
						name: "test",
						beforeEach: [
							createPass({ name: "beforeEach()" }),
							createPass({ name: "beforeEach() #2" }),
							createFail({ name: "beforeEach() #3", error: ERROR }),
							createSkip({ name: "beforeEach() #4" }),
						],
					}) ],
				}));
			});

			it("doesn't consider afterEach() results when setting test status", async () => {
				const suite = describe_sut(() => {
					afterEach_sut(FAIL_FN);
					it_sut("test", PASS_FN);
				});

				assert.equal(await suite.runAsync(), createSuite({
					tests: [
						createPass({
							name: "test",
							afterEach: [
								createFail({ name: "afterEach()", error: ERROR }),
							],
						}),
					],
				}));
			});

			it("doesn't run afterEach() when beforeEach() fails", async () => {
				const suite = describe_sut(() => {
					beforeEach_sut(FAIL_FN);
					afterEach_sut(PASS_FN);
					it_sut("test", PASS_FN);
				});

				assert.equal(await suite.runAsync(), createSuite({
					tests: [ createSkip({
						name: "test",
						beforeEach: [ createFail({ name: "beforeEach()", error: ERROR }) ],
						afterEach: [ createSkip({ name: "afterEach()" }) ],
					}) ],
				}));
			});

			it("continues running afterEach() even when one fails", async () => {
				const suite = describe_sut(() => {
					afterEach_sut(PASS_FN);
					afterEach_sut(PASS_FN);
					afterEach_sut(FAIL_FN);
					afterEach_sut(PASS_FN);
					it_sut("test", PASS_FN);
				});

				assert.equal(await suite.runAsync(), createSuite({
					tests: [
						createPass({
							name: "test",
							afterEach: [
								createPass({ name: "afterEach()" }),
								createPass({ name: "afterEach() #2" }),
								createFail({ name: "afterEach() #3", error: ERROR }),
								createPass({ name: "afterEach() #4" }),
							],
						}),
					],
				}));
			});

			it("handles case where test and afterEach both fail", async () => {
				const suite = describe_sut(() => {
					afterEach_sut(FAIL_FN);
					it_sut("test", FAIL_FN);
				});

				assert.equal(await suite.runAsync(), createSuite({
					tests: [
						createFail({
							name: "test",
							error: ERROR,
							afterEach: [
								createFail({ name: "afterEach()", error: ERROR }),
							],
						}),
					],
				}));
			});

		});

	});


	describe("timeouts", () => {

		it("times out when test doesn't complete before default timeout", async () => {
			const clock = await Clock.createNullAsync();

			let beforeTime = null;
			let afterTime = null;
			const suite = describe_sut(() => {
				beforeEach_sut(() => {
					beforeTime = clock.now();
				});
				afterEach_sut(() => {
					afterTime = clock.now();
				});
				it_sut("my test", async () => {
					await clock.waitAsync(DEFAULT_TIMEOUT + 1);
				});
			});

			const actualPromise = suite.runAsync({ clock });
			await clock.tickUntilTimersExpireAsync();

			assert.equal(await actualPromise,
				createSuite({
					tests: [ createTimeout({
						name: "my test",
						timeout: DEFAULT_TIMEOUT,
						beforeEach: [ createPass({ name: "beforeEach()" })],
						afterEach: [ createPass({ name: "afterEach()" })],
					}) ]
				}),
				"result",
			);
			assert.equal(beforeTime, 0, "beforeEach() should run immediately");
			assert.equal(afterTime, DEFAULT_TIMEOUT, "afterEach() should run as soon as it() times out");
		});

		it("times out when beforeAll doesn't complete before default timeout", async () => {
			const clock = await Clock.createNullAsync();

			let itTime = null;
			let afterTime = null;
			const suite = describe_sut(() => {
				beforeAll_sut(async () => {
					await clock.waitAsync(DEFAULT_TIMEOUT + 1);
				});
				afterAll_sut(() => {
					afterTime = clock.now();
				});
				it_sut("my test", () => {
					itTime = clock.now();
				});
			});

			const actualPromise = suite.runAsync({ clock });
			await clock.tickUntilTimersExpireAsync();

			assert.equal(await actualPromise, createSuite({
				beforeAll: [ createTimeout({ name: "beforeAll() #1", timeout: DEFAULT_TIMEOUT }) ],
				afterAll: [ createSkip({ name: "afterAll() #1" }) ],
				tests: [ createSkip({ name: "my test" }) ],
			}));
			assert.equal(itTime, null, "it() should not run");
			assert.equal(afterTime, null, "afterAll() should not run");
		});

		it("times out when afterAll doesn't complete before default timeout", async () => {
			const clock = await Clock.createNullAsync();

			let beforeTime = null;
			let itTime = null;
			const suite = describe_sut(() => {
				beforeAll_sut(() => {
					beforeTime = clock.now();
				});
				afterAll_sut(async () => {
					await clock.waitAsync(DEFAULT_TIMEOUT + 1);
				});
				it_sut("test 1", () => {
					itTime = clock.now();
				});
				it_sut("test 2", () => {});
			});

			const actualPromise = suite.runAsync({ clock });
			await clock.tickUntilTimersExpireAsync();

			assert.dotEquals(await actualPromise,
				createSuite({
					beforeAll: [ createPass({ name: "beforeAll() #1" }) ],
					afterAll: [ createTimeout({ name: "afterAll() #1", timeout: DEFAULT_TIMEOUT })],
					tests: [
						createPass({ name: "test 1" }),
						createPass({ name: "test 2" }),
					],
				}),
				"result",
			);
			assert.equal(beforeTime, 0, "beforeAll() should run immediately");
			assert.equal(itTime, 0, "it() should run immediately");
		});

		it("times out when beforeEach doesn't complete before default timeout", async () => {
			const clock = await Clock.createNullAsync();

			const suite = describe_sut(() => {
				beforeEach_sut(async () => {
					await clock.waitAsync(DEFAULT_TIMEOUT + 1);
				});
				afterEach_sut(PASS_FN);
				it_sut("my test", PASS_FN);
			});

			const actualPromise = suite.runAsync({ clock });
			await clock.tickUntilTimersExpireAsync();

			assert.equal(await actualPromise, createSuite({ tests: [
				createSkip({
					name: "my test",
					beforeEach: [ createTimeout({ name: "beforeEach()", timeout: DEFAULT_TIMEOUT }) ],
					afterEach: [ createSkip({ name: "afterEach()" }) ],
				})
			]}));
		});

		it("times out when afterEach doesn't complete before default timeout", async () => {
			const clock = await Clock.createNullAsync();

			const suite = describe_sut(() => {
				beforeEach_sut(PASS_FN);
				afterEach_sut(async () => {
					await clock.waitAsync(DEFAULT_TIMEOUT + 1);
				});
				it_sut("my test", PASS_FN);
			});

			const actualPromise = suite.runAsync({ clock });
			await clock.tickUntilTimersExpireAsync();

			assert.equal(await actualPromise, createSuite({ tests: [
				createPass({
					name: "my test",
					beforeEach: [ createPass({ name: "beforeEach()" }) ],
					afterEach: [ createTimeout({ name: "afterEach()", timeout: DEFAULT_TIMEOUT }) ],
				}),
			]}));
		});

		it("times out each function separately", async () => {
			const clock = await Clock.createNullAsync();
			const notQuiteTimeoutFn = async () => {
				await clock.waitAsync(DEFAULT_TIMEOUT - 1);
			};

			const suite = describe_sut(() => {
				beforeAll_sut(notQuiteTimeoutFn);
				beforeAll_sut(notQuiteTimeoutFn);
				afterAll_sut(notQuiteTimeoutFn);
				afterAll_sut(notQuiteTimeoutFn);
				beforeEach_sut(notQuiteTimeoutFn);
				beforeEach_sut(notQuiteTimeoutFn);
				afterEach_sut(notQuiteTimeoutFn);
				afterEach_sut(notQuiteTimeoutFn);
				it_sut("test 1", notQuiteTimeoutFn);
				it_sut("test 2", notQuiteTimeoutFn);
			});

			const actualPromise = suite.runAsync({ clock });
			await clock.tickUntilTimersExpireAsync();

			const actual = await actualPromise;
			assert.equal(actual.count().timeout, 0);
		});

		it("allows runner to configure default timeout", async () => {
			const NEW_TIMEOUT = DEFAULT_TIMEOUT * 2;

			const clock = await Clock.createNullAsync();
			const suite = describe_sut(() => {
				it_sut("no timeout", async () => {
					await clock.waitAsync(NEW_TIMEOUT - 1);
				});
				it_sut("timeout", async () => {
					await clock.waitAsync(NEW_TIMEOUT + 1);
				});
			});

			const actualPromise = suite.runAsync({ timeout: NEW_TIMEOUT, clock });
			await clock.tickUntilTimersExpireAsync();

			assert.dotEquals(
				await actualPromise,
				createSuite({ tests: [
					createPass({ name: "no timeout" }),
					createTimeout({ name: "timeout", timeout: NEW_TIMEOUT }),
				]}),
			);
		});

		it("allows suites to configure custom timeout", async () => {
			const NEW_TIMEOUT = DEFAULT_TIMEOUT * 2;

			const clock = await Clock.createNullAsync();
			const notQuiteTimeoutFn = async () => {
				await clock.waitAsync(NEW_TIMEOUT - 1);
			};

			const suite = describe_sut({ timeout: NEW_TIMEOUT }, () => {
				beforeAll_sut(notQuiteTimeoutFn);
				afterAll_sut(notQuiteTimeoutFn);
				beforeEach_sut(notQuiteTimeoutFn);
				afterEach_sut(notQuiteTimeoutFn);
				it_sut("my test", notQuiteTimeoutFn);
			});

			const actualPromise = suite.runAsync({ clock });
			await clock.tickUntilTimersExpireAsync();

			const actual = await actualPromise;
			assert.equal(actual.count().timeout, 0);
		});

		it("inherits parent suite's timeout even when suite is marked 'skip'", async () => {
			const NEW_TIMEOUT = DEFAULT_TIMEOUT * 2;

			const clock = await Clock.createNullAsync();
			const notQuiteTimeoutFn = async () => {
				await clock.waitAsync(NEW_TIMEOUT - 1);
			};

			const suite = describe_sut.skip({ timeout: NEW_TIMEOUT }, () => {
				it_sut.only("my test", notQuiteTimeoutFn);
			});

			const actualPromise = suite.runAsync({ clock });
			await clock.tickUntilTimersExpireAsync();

			const actual = await actualPromise;
			assert.equal(actual.count().timeout, 0);

		});

		it("allows nested suites to override parent suite's timeout", async () => {
			const NEW_TIMEOUT = DEFAULT_TIMEOUT * 10;

			const clock = await Clock.createNullAsync();
			const suite = describe_sut({ timeout: NEW_TIMEOUT / 2 }, () => {
				describe_sut("my suite", { timeout: NEW_TIMEOUT }, () => {
					it_sut("my test", async () => {
						await clock.waitAsync(NEW_TIMEOUT - 1);
					});
				});
			});

			const actualPromise = suite.runAsync({ clock });
			await clock.tickUntilTimersExpireAsync();

			assert.equal(await actualPromise,
				createSuite({ tests: [
					createSuite({ name: "my suite", tests: [
						createPass({ name: [ "my suite", "my test" ] }),
					]}),
				]}),
			);
		});

		it("allows tests to configure custom timeout", async () => {
			const NEW_TIMEOUT = DEFAULT_TIMEOUT * 10;

			const clock = await Clock.createNullAsync();
			const suite = describe_sut(() => {
				it_sut("my test", { timeout: NEW_TIMEOUT }, async () => {
					await clock.waitAsync(NEW_TIMEOUT - 1);
				});
			});

			const actualPromise = suite.runAsync({ clock });
			await clock.tickUntilTimersExpireAsync();

			assert.equal(await actualPromise,
				createSuite({ tests: [
					createPass({ name: "my test" }),
				]}),
			);
		});

		it("allows before/after functions to configure custom timeout", async() => {
			const NEW_TIMEOUT = DEFAULT_TIMEOUT * 10;

			const clock = await Clock.createNullAsync();
			const notQuiteTimeoutFn = async () => {
				await clock.waitAsync(NEW_TIMEOUT - 1);
			};

			const suite = describe_sut(() => {
				beforeAll_sut({ timeout: NEW_TIMEOUT }, notQuiteTimeoutFn);
				beforeAll_sut({ timeout: NEW_TIMEOUT }, notQuiteTimeoutFn);
				afterAll_sut({ timeout: NEW_TIMEOUT }, notQuiteTimeoutFn);
				afterAll_sut({ timeout: NEW_TIMEOUT }, notQuiteTimeoutFn);
				beforeEach_sut({ timeout: NEW_TIMEOUT }, notQuiteTimeoutFn);
				beforeEach_sut({ timeout: NEW_TIMEOUT }, notQuiteTimeoutFn);
				afterEach_sut({ timeout: NEW_TIMEOUT }, notQuiteTimeoutFn);
				afterEach_sut({ timeout: NEW_TIMEOUT }, notQuiteTimeoutFn);
				it_sut("my test", () => {});
			});

			const actualPromise = suite.runAsync({ clock });
			await clock.tickUntilTimersExpireAsync();

			const actual = await actualPromise;
			assert.equal(actual.count().timeout, 0);
		});
	});


	describe(".skip", () => {

		it("skips and marks tests that have no function", async () => {
			const suite = describe_sut(() => {
				it_sut("my test");
			});

			const result = (await suite.runAsync()).allTests()[0];

			assert.dotEquals(result, createSkip({ name: "my test", mark: TestMark.skip }), "should be skipped");
		});

		it("skips and marks tests that have '.skip'", async () => {
			let testRan = false;
			const suite = describe_sut(() => {
				it_sut.skip("my test", () => {
					testRan = true;
				});
			});

			const result = (await suite.runAsync()).allTests()[0];
			assert.equal(testRan, false, "should not run test");
			assert.dotEquals(result, createSkip({ name: "my test", mark: TestMark.skip }));
			assert.equal(result.mark, TestMark.skip, "should be marked");
		});

		it("skips suites that have no function", async () => {
			const suite = await describe_sut("my suite").runAsync();
			const noName = await describe_sut().runAsync();

			assert.dotEquals(suite, createSuite({ name: "my suite", mark: TestMark.skip }));
			assert.dotEquals(noName, createSuite({ name: [], mark: TestMark.skip }));
		});

		it("recursively skips everything within a suite that has '.skip'", async () => {
			const suite = describe_sut.skip(() => {
				it_sut("test 1", () => {});
				it_sut("test 2", () => {});
				describe_sut(() => {
					it_sut("test 3", () => {});
				});
			});

			const result = await suite.runAsync();
			assert.dotEquals(result,
				createSuite({ mark: TestMark.skip, tests: [
					createSkip({ name: "test 1" }),
					createSkip({ name: "test 2" }),
					createSuite({ tests: [
						createSkip({ name: "test 3" }),
					]}),
				]}),
			);
		});

		it("doesn't mark skipped tests and suites that aren't explicitly marked '.skip'", async () => {
			const suite = describe_sut.skip(() => {
				it_sut("test", () => {});
				describe_sut("suite", () => {});
			});

			const result = await suite.runAsync();
			assert.dotEquals(result,
				createSuite({ mark: TestMark.skip, tests: [
					createSkip({ name: "test", mark: TestMark.none }),
					createSuite({ name: "suite", mark: TestMark.none }),
				]}),
			);
		});

		it("generates failure when a suite is marked 'only' but has no body", async () => {
			const options = {
				renderer: CUSTOM_RENDERER_PATH,
			};

			const suite = describe_sut("parent", () => {
				describe_sut.only("my suite");
			});
			const result = await suite.runAsync(options);

			assert.dotEquals(result,
				createSuite({ name: "parent", tests: [
					createSuite({ name: [ "parent", "my suite" ], mark: TestMark.only, tests: [
						createFail({ name: [ "parent", "my suite" ], error: "Test suite is marked '.only', but it has no body" }),
					]}),
				]}),
			);
			assert.equal(result.allTests()[0].errorRender, "custom rendering", "should use custom renderer");
		});

		it("generates failure when a test is marked 'only' but has no body", async () => {
			const options = {
				renderer: CUSTOM_RENDERER_PATH,
			};

			const suite = describe_sut("parent", () => {
				describe_sut("my suite", () => {
					it_sut.only("my test");
				});
			});

			assert.dotEquals(await suite.runAsync(options),
				createSuite({ name: "parent", tests: [
					createSuite({ name: [ "parent", "my suite" ], tests: [
						createFail({
							name: [ "parent", "my suite", "my test" ],
							error: "Test is marked '.only', but it has no body",
							mark: TestMark.only,
						}),
					]}),
				]}),
			);
			assert.equal((await suite.runAsync(options)).allTests()[0].errorRender, "custom rendering", "should use custom renderer");
		});

	});


	describe(".only", () => {

		it("if any tests are marked .only, it only runs those tests", async () => {
			const suite = describe_sut(() => {
				it_sut.only(".only", () => {});
				it_sut("not .only", () => {});
			});

			assert.dotEquals(await suite.runAsync(),
				createSuite({ tests: [
					createPass({ name: ".only", mark: TestMark.only }),
					createSkip({ name: "not .only" }),
				]}),
			);
		});

		it("marks test results as '.only'", async () => {
			const clock = await Clock.createNullAsync();

			const suite = describe_sut(() => {
				it_sut.only("pass", () => {});
				it_sut.only("fail", () => { throw new Error("my error"); });
				it_sut.only("timeout", async () => { await clock.waitAsync(DEFAULT_TIMEOUT + 1); });
			});

			const resultPromise = suite.runAsync({ clock });
			clock.tickUntilTimersExpireAsync();

			assert.dotEquals(await resultPromise,
				createSuite({ tests: [
					createPass({ name: "pass", mark: TestMark.only }),
					createFail({ name: "fail", error: new Error("my error"), mark: TestMark.only }),
					createTimeout({ name: "timeout", timeout: DEFAULT_TIMEOUT, mark: TestMark.only }),
				]}),
			);
		});

		it("if a suite is marked .only and none of its tests are, runs all of those tests", async () => {
			const suite = describe_sut(() => {
				describe_sut("not .only", () => {
					it_sut("test1", () => {});
					it_sut("test2", () => {});
				});
				describe_sut.only(".only", () => {
					it_sut("test3", () => {});
					it_sut("test4", () => {});
				});
			});

			assert.dotEquals(await suite.runAsync(),
				createSuite({ tests: [
					createSuite({ name: "not .only", tests: [
						createSkip({ name: [ "not .only", "test1" ] }),
						createSkip({ name: [ "not .only", "test2" ] }),
					]}),
					createSuite({ name: ".only", mark: TestMark.only, tests: [
						createPass({ name: [ ".only", "test3" ] }),
						createPass({ name: [ ".only", "test4" ] }),
					]}),
				]}),
			);
		});

		it("if a suite is marked .only and none of its children are, run those tests recursively", async () => {
			const suite = describe_sut.only(() => {
				describe_sut(() => {
					it_sut("test", () => {});
				});
			});

			assert.dotEquals(await suite.runAsync(),
				createSuite({ mark: TestMark.only, tests: [
					createSuite({ tests: [
						createPass({ name: "test" }),
					]}),
				]}),
			);
		});

		it("if a suite is marked .only and one of its children is also, only run that test", async () => {
			const suite = describe_sut.only(() => {
				it_sut("not only", () => {});
				it_sut.only("only", () => {});
			});

			assert.dotEquals(await suite.runAsync(),
				createSuite({ mark: TestMark.only, tests: [
					createSkip({ name: "not only" }),
					createPass({ name: "only", mark: TestMark.only }),
				]}),
			);
		});

		it("if a suite is marked .only and one of its grandchildren is also, only run that test", async () => {
			const suite = describe_sut.only(() => {
				describe_sut(() => {
					it_sut("not only", () => {});
					it_sut.only("only", () => {});
				});
			});

			assert.dotEquals(await suite.runAsync(),
				createSuite({ mark: TestMark.only, tests: [
					createSuite({ tests: [
						createSkip({ name: "not only" }),
						createPass({ name: "only", mark: TestMark.only }),
					]}),
				]}),
			);
		});

		it("if a suite is marked .only and one of its child suites is also, only run that suite", async () => {
			const suite = describe_sut.only(() => {
				describe_sut("not only", () => {
					it_sut("test1", () => {});
				});
				describe_sut.only("only", () => {
					it_sut("test2", () => {});
				});
			});

			assert.dotEquals(await suite.runAsync(),
				createSuite({ mark: TestMark.only, tests: [
					createSuite({ name: "not only", tests: [
						createSkip({ name: [ "not only", "test1" ] }),
					]}),
					createSuite({ name: "only", mark: TestMark.only, tests: [
						createPass({ name: [ "only", "test2" ] }),
					]}),
				]}),
			);
		});

		it("if a suite is marked .only and a child is marked .skip, skip the child", async () => {
			const suite = describe_sut.only(() => {
				describe_sut(() => {
					it_sut.skip("test1", () => {});
					it_sut("test2", () => {});
				});
			});

			assert.dotEquals(await suite.runAsync(),
				createSuite({ mark: TestMark.only, tests: [
					createSuite({ tests: [
						createSkip({ name: "test1", mark: TestMark.skip }),
						createPass({ name: "test2" }),
					]}),
				]}),
			);
		});

		it("if a suite is marked .skip and a child is marked .only, run the child", async () => {
			const suite = describe_sut.skip(() => {
				describe_sut(() => {
					it_sut.only("test1", () => {});
					it_sut("test2", () => {});
				});
			});

			assert.dotEquals(await suite.runAsync(),
				createSuite({ mark: TestMark.skip, tests: [
					createSuite({ tests: [
						createPass({ name: "test1", mark: TestMark.only }),
						createSkip({ name: "test2" }),
					]}),
				]}),
			);
		});

		it("if a suite is marked .only and a child suite is marked .skip, skip its children", async () => {
			const suite = describe_sut.only(() => {
				describe_sut.skip(() => {
					it_sut("test1", () => {});
					it_sut("test2", () => {});
				});
			});

			assert.dotEquals(await suite.runAsync(),
				createSuite({ mark: TestMark.only, tests: [
					createSuite({ mark: TestMark.skip, tests: [
						createSkip({ name: "test1" }),
						createSkip({ name: "test2" }),
					]}),
				]}),
			);
		});

		it("if a suite is marked .skip and a child suite is marked .only, run its children", async () => {
			const suite = describe_sut.skip(() => {
				describe_sut.only(() => {
					it_sut("test1", () => {});
					it_sut("test2", () => {});
				});
			});

			assert.dotEquals(await suite.runAsync(),
				createSuite({ mark: TestMark.skip, tests: [
					createSuite({ mark: TestMark.only, tests: [
						createPass({ name: "test1" }),
						createPass({ name: "test2" }),
					]}),
				]}),
			);
		});

		it("marks suites even if they fail 'beforeAll'", async () => {
			const suite = describe_sut.only(() => {
				beforeAll_sut(FAIL_FN);
				it_sut("my test", PASS_FN);
			});

			const result = await suite.runAsync();
			assert.equal(result.mark, TestMark.only);
		});

	});


	describe("notification", () => {

		it("runs notify function when test completes", async () => {
			const suite = describe_sut(() => {
				it_sut("my test", PASS_FN);
			});

			let testResult;
			function onTestCaseResult(result: TestResult) {
				testResult = result;
			}

			await suite.runAsync({ onTestCaseResult });
			assert.dotEquals(testResult, createPass({ name: "my test" }));
		});

		it("runs notify function when beforeAll() and afterAll() complete", async () => {
			const suite = describe_sut(() => {
				beforeAll_sut(PASS_FN);
				afterAll_sut(PASS_FN);
				it_sut("my test", PASS_FN);
			});

			const testResults: TestCaseResult[] = [];
			function onTestCaseResult(result: TestCaseResult) {
				testResults.push(result);
			}

			await suite.runAsync({ onTestCaseResult });
			assert.equal(testResults, [
				createPass({ name: "beforeAll() #1" }),
				createPass({ name: "my test" }),
				createPass({ name: "afterAll() #1" }),
			]);
		});

		it("runs notify function if module fails to require()", async () => {
			const suite = await fromModulesAsync([ "./_module_throws.js" ]);

			let testResult: TestCaseResult;
			function onTestCaseResult(result: TestCaseResult) {
				testResult = result;
			}

			await suite.runAsync({ onTestCaseResult });
			assert.equal(testResult!.name, [ "error when importing _module_throws.js" ]);
		});

		it("runs notify function if module doesn't export a test suite", async () => {
			const suite = await fromModulesAsync([ "./_module_no_export.js" ]);

			let testResult: TestCaseResult;

			function onTestCaseResult(result: TestCaseResult) {
				testResult = result;
			}

			await suite.runAsync({ onTestCaseResult });
			assert.equal(testResult!.name, [ "error when importing _module_no_export.js" ]);
		});

	});

});


async function runTestAsync(testName: string, testFn: () => void) {
	const suite = describe_sut(() => {
		it_sut(testName, testFn);
	});
	const result = await suite.runAsync();
	return result.tests[0];
}
