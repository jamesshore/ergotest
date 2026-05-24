// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import {
	assert,
	beforeEach,
	createFail,
	createPass,
	createSuite,
	describe,
	it,
	TestStatus,
} from "../../util/tests.js";
import { TestRunner } from "./test_runner.js";
import path from "node:path";
import { TestSuite } from "../tests/test_suite.js";
import { TestCaseResult, TestResult, TestSuiteResult } from "../results/test_result.js";
import fs from "node:fs/promises";
import { Clock } from "../../infrastructure/clock.js";
import { _loadTestsAsync } from "../tests/test_api.js";

// dependency: ../_renderer_custom.js

const INDEX_PATH = path.resolve(import.meta.dirname, "../index.js");
const CUSTOM_RENDERER_PATH = path.resolve(import.meta.dirname, "../_renderer_custom.js");

export default describe(() => {

	let testModulePath: string;
	let setupModulePath: string;
	let nonce = 1;

	beforeEach(async ({ getConfig }) => {
		const testDir = getConfig<string>("scratchDir");

		testModulePath = `${testDir}/_test_runner_module_${nonce++}.js`;
		setupModulePath = `${testDir}/_test_setup_module_${nonce++}.js`;
		await deleteTempFilesAsync(testDir);
	});


	describe("module loader", () => {

		it("creates test suite from a module (and sets filename on result)", async () => {
			await writeTestModuleAsync();
			const suite = await loadTestsAsync([ testModulePath, testModulePath ]);

			const testCaseResult = createPass({ name: "test", filename: testModulePath });
			assert.dotEquals(await suite.runAsync(),
				createSuite({ tests: [
					createSuite({ tests: [ testCaseResult ], filename: testModulePath }),
					createSuite({ tests: [ testCaseResult ], filename: testModulePath }),
				]}),
			);
		});

		it("fails gracefully if module isn't an absolute path", async () => {
			const suite = await loadTestsAsync([ "./arbitrary_module.js" ]);

			assert.dotEquals(await suite.runAsync(), createSuite({
				tests: [
					createFail({
						filename: "./arbitrary_module.js",
						name: "error when importing test module arbitrary_module.js",
						error: "Test module filenames must use absolute paths: ./arbitrary_module.js",
					}),
				],
			}));
		});

		it("fails gracefully if module doesn't exist", async () => {
			const suite = await loadTestsAsync([ "/no_such_module.js" ]);

			assert.dotEquals(await suite.runAsync(), createSuite({
				tests: [
					createFail({
						filename: "/no_such_module.js",
						name: "error when importing test module no_such_module.js",
						error: `Cannot find module '/no_such_module.js' imported from ${path.resolve(
							import.meta.dirname,
							"../tests/api_context.js",
						)}`,
					}),
				],
			}));
		});

		it("BUG: it doesn't think an import failure means the module doesn't exist", async () => {
			await fs.writeFile(testModulePath, "impo" + "rt irrelevant from '/no_such_module.js'");

			const suite = await loadTestsAsync([ testModulePath ]);
			assert.dotEquals(await suite.runAsync(), createSuite({
				tests: [
					createFail({
						filename: testModulePath,
						name: `error when importing test module ${path.basename(testModulePath)}`,
						error: `Cannot find module '/no_such_module.js' imported from ${testModulePath}`,
					}),
				],
			}));
		});

		it("fails gracefully if module throws an exception while being loaded", async () => {
			await fs.writeFile(testModulePath, "throw new Error('my import error')");

			const suite = await loadTestsAsync([ testModulePath ]);
			assert.dotEquals(await suite.runAsync(), createSuite({
				tests: [
					createFail({
						filename: testModulePath,
						name: `error when importing test module ${path.basename(testModulePath)}`,
						error: "my import error",
					}),
				],
			}));
		});

		it("fails gracefully if module doesn't export a test suite", async () => {
			await fs.writeFile(testModulePath, "");

			const suite = await loadTestsAsync([ testModulePath ]);
			assert.dotEquals(await suite.runAsync(), createSuite({
				tests: [
					createFail({
						filename: testModulePath,
						name: `error when importing test module ${path.basename(testModulePath)}`,
						error: `Test module doesn't export a test suite: ${testModulePath}`,
					}),
				],
			}));
		});

		it("triggers onTestCaseResult when module load fails", async () => {
			let result: TestCaseResult | undefined;
			function onTestCaseResult(_result: TestCaseResult) {
				result = _result;
			}

			const suite = await loadTestsAsync([ "/no_such_module.js" ]);
			await suite.runAsync({ onTestCaseResult });

			assert.equal(result?.filename, "/no_such_module.js");
		});

	});


	describe("test setup", () => {

		it("defines global before/after functions", async () => {
			await writeSetupModuleAsync(`
				beforeAll(() => {});
				afterAll(() => {});
				beforeEach(() => {});
				afterEach(() => {});
			`, setupModulePath);
			await writeTestModuleAsync();

			const suite = await loadTestsAsync([ testModulePath ], [ setupModulePath ]);

			assert.dotEquals(await suite.runAsync(), createSuite({
				beforeAll: [ createPass({ name: "beforeAll()", filename: setupModulePath }) ],
				afterAll: [ createPass({ name: "afterAll()", filename: setupModulePath }) ],
				tests: [
					createSuite({
						filename: testModulePath,
						tests: [
							createPass({
								name: "test",
								filename: testModulePath,
								beforeEach: [ createPass({ name: "beforeEach()", filename: setupModulePath }) ],
								afterEach: [ createPass({ name: "afterEach()", filename: setupModulePath }) ],
							}),
						],
					}),
				]
			}));
		});

		it("can have multiple setup files", async () => {
			const setupPath1 = `${setupModulePath}-1.js`;
			const setupPath2 = `${setupModulePath}-2.js`;

			await writeTestModuleAsync();
			await writeSetupModuleAsync(`
				beforeAll(() => {});
				beforeEach(() => {});
			`, setupPath1);
			await writeSetupModuleAsync(`
				afterAll(() => {});
				afterEach(() => {});
			`, setupPath2);

			const suite = await loadTestsAsync([ testModulePath ], [ setupPath1, setupPath2 ]);

			assert.dotEquals(await suite.runAsync(), createSuite({
				beforeAll: [ createPass({ name: "beforeAll()", filename: setupPath1 }) ],
				afterAll: [ createPass({ name: "afterAll()", filename: setupPath2 }) ],
				tests: [
					createSuite({
						filename: testModulePath,
						tests: [
							createPass({
								name: "test",
								filename: testModulePath,
								beforeEach: [ createPass({ name: "beforeEach()", filename: setupPath1 }) ],
								afterEach: [ createPass({ name: "afterEach()", filename: setupPath2 }) ],
							}),
						],
					}),
				]
			}));
		});

		it("fails gracefully if module isn't an absolute path", async () => {
			await writeTestModuleAsync();
			const suite = await loadTestsAsync([ testModulePath ], [ "./arbitrary_module.js" ]);

			assert.dotEquals(await suite.runAsync(), createSuite({
				tests: [
					createFail({
						filename: "./arbitrary_module.js",
						name: "error when importing setup module arbitrary_module.js",
						error: "Setup module filenames must use absolute paths: ./arbitrary_module.js",
					}),
					createSuite({
						filename: testModulePath,
						tests: [
							createPass({
								filename: testModulePath,
								name: "test",
							}),
						],
					}),
				],
			}));
		});

		it("fails gracefully if module doesn't exist", async () => {
			await writeTestModuleAsync();
			const suite = await loadTestsAsync([ testModulePath ], [ "/no_such_module.js" ]);

			assert.dotEquals(await suite.runAsync(), createSuite({
				tests: [
					createFail({
						filename: "/no_such_module.js",
						name: "error when importing setup module no_such_module.js",
						error: `Cannot find module '/no_such_module.js' imported from ${path.resolve(
							import.meta.dirname,
							"../tests/api_context.js",
						)}`,
					}),
					createSuite({
						filename: testModulePath,
						tests: [
							createPass({
								filename: testModulePath,
								name: "test",
							}),
						],
					}),
				],
			}));
		});

		it("it doesn't think an import failure means the module doesn't exist", async () => {
			await writeTestModuleAsync();
			await writeSetupModuleAsync("impo" + "rt irrelevant from '/no_such_module.js'");

			const suite = await loadTestsAsync([ testModulePath ], [ setupModulePath ]);
			assert.dotEquals(await suite.runAsync(), createSuite({
				tests: [
					createFail({
						filename: setupModulePath,
						name: `error when importing setup module ${path.basename(setupModulePath)}`,
						error: `Cannot find module '/no_such_module.js' imported from ${setupModulePath}`,
					}),
					createSuite({
						filename: testModulePath,
						tests: [
							createPass({
								filename: testModulePath,
								name: "test",
							}),
						],
					}),
				],
			}));
		});

		it("fails gracefully if module throws an exception while being loaded", async () => {
			await writeTestModuleAsync();
			await fs.writeFile(setupModulePath, "throw new Error('my import error')");

			const suite = await loadTestsAsync([ testModulePath ], [ setupModulePath ]);
			assert.dotEquals(await suite.runAsync(), createSuite({
				tests: [
					createFail({
						filename: setupModulePath,
						name: `error when importing setup module ${path.basename(setupModulePath)}`,
						error: "my import error",
					}),
					createSuite({
						filename: testModulePath,
						tests: [
							createPass({
								filename: testModulePath,
								name: "test",
							}),
						],
					}),
				],
			}));
		});

		it("triggers onTestCaseResult when module load fails", async () => {
			let result: TestCaseResult[] = [];
			function onTestCaseResult(_result: TestCaseResult) {
				result.push(_result);
			}

			await writeTestModuleAsync();
			const suite = await loadTestsAsync([ testModulePath ], [ "/no_such_module.js" ]);
			await suite.runAsync({ onTestCaseResult });

			assert.dotEquals(result[0], createFail({
				filename: "/no_such_module.js",
				name: `error when importing setup module no_such_module.js`,
				error: `Cannot find module '/no_such_module.js' imported from ${path.resolve(
					import.meta.dirname,
					"../tests/api_context.js",
				)}`,
			}));
		});

	});


	describe("current process", () => {

		it("runs test modules and passes through config", async () => {
			const myConfig = { myConfig: "my_config" };
			const { runner } = await createAsync();

			await writeTestModuleAsync(`throw new Error(getConfig("myConfig"));`);
			const results = await runner.runInCurrentProcessAsync([ testModulePath ], { config: myConfig });

			assertFailureMessage(results, "my_config");
		});

		// remaining behaviors not tested because of annoyances from them not being isolated

	});


	describe("child process", () => {

		describe("standard behavior", () => {

			it("runs test modules", async () => {
				const { runner } = await createAsync();
				await writeTestModuleAsync(`// passes`);

				const results = await runner.runInChildProcessAsync([ testModulePath ]);

				const expectedResult = createSuite({ tests: [
					createSuite({ filename: testModulePath, tests: [
						createPass({ name: "test", filename: testModulePath })
					]}),
				]});

				assert.equal(results, expectedResult);
			});

			it("passes through config", async () => {
				const myConfig = { myConfig: "my_config" };
				const { runner } = await createAsync();

				await writeTestModuleAsync(`throw new Error(getConfig("myConfig"));`);
				const results = await runner.runInChildProcessAsync([ testModulePath ], { config: myConfig });

				assertFailureMessage(results, "my_config");
			});

			it("supports custom error rendering", async () => {
				const { runner } = await createAsync();

				await writeTestModuleAsync(`throw new Error();`);
				const results = await runner.runInChildProcessAsync([ testModulePath ], {
					renderer: CUSTOM_RENDERER_PATH,
				});

				assert.equal(getTestResult(results).errorRender, "custom rendering");
			});

			it("notifies caller of completed tests", async () => {
				const { runner } = await createAsync();

				const progress: TestResult[] = [];
				const onTestCaseResult = (result: TestResult) => progress.push(result);

				await writeTestModuleAsync(`// passes`);
				await runner.runInChildProcessAsync([ testModulePath ], { onTestCaseResult });

				assert.equal(progress, [
					createPass({ name: "test", filename: testModulePath }),
				]);
			});

			it("renders custom objects", async () => {
				// This test is a bit obscure. The issue is the test result object for failed tests previously stored the error
				// object that caused the test failure in the test result. That caused information to be lost because the test
				// result was being serialized from worker process to parent process, particularly in the 'expected' and 'actual'
				// objects.
				//
				// The problem was fixed architecturally by having failed test results store an "error render", which
				// is a serialized version of the error object--typically the human-readable string that will be displayed to the
				// user.
				//
				// This test exists to prevent future maintainers from reversing that architectural decision. Storing the
				// error object in the test result is cleaner from a design perspective, so it might be tempting to go back to
				// that approach. Unfortunately, it doesn't work when you're serializing test results from worker process to
				// parent process.

				const options = {
					renderer: CUSTOM_RENDERER_PATH,
				};

				const { runner } = await createAsync();
				await writeTestModuleAsync(
					`
						assert.equal(new MyString("actual"), new MyString("expected"));
					`,
					`
						class MyString extends String {
							constructor(customField) {
								super();
								this._customField = customField;
							}
						}
					`
				);
				const result = getTestResult(await runner.runInChildProcessAsync([ testModulePath ], options));

				// This assertion is vulnerable to changes in util.inspect()'s rendering algorithm
				assert.equal(result.errorRender,
					"custom rendering:\n" +
					"expected: [String (MyString): ''] { _customField: 'expected' }\n" +
					"actual: [String (MyString): ''] { _customField: 'actual' }\n");
			});

			it("fails fast if custom renderer doesn't load", async () => {
				const options = {
					renderer: "./no_such_renderer.js",
				};
				const { runner } = await createAsync();
				await writeTestModuleAsync(`// passes`);

				await assert.errorAsync(
					() => runner.runInChildProcessAsync([ testModulePath ], options),
					/Renderer module not found/,
				);
			});

		});


		describe("isolation", () => {

			it("does not cache test modules from run to run", async () => {
				const { runner } = await createAsync();

				await writeTestModuleAsync(`throw new Error("module was cached, and shouldn't have been");`);
				await runner.runInChildProcessAsync([ testModulePath ]);

				await writeTestModuleAsync(`throw new Error("module was not cached");`);
				const results = await runner.runInChildProcessAsync([ testModulePath ]);

				assertFailureMessage(results, "module was not cached");
			});

			it("does not keep variables from run to run", async () => {
				const { runner } = await createAsync();

				await writeTestModuleAsync(`global._test_runner_test = true;`);
				await runner.runInChildProcessAsync([ testModulePath ]);

				await writeTestModuleAsync(`throw new Error("global should be undefined: " + global._test_runner_test);`);
				const results = await runner.runInChildProcessAsync([ testModulePath ]);

				assertFailureMessage(results, "global should be undefined: undefined");
			});

			it("supports process.chdir(), which isn't allowed in Worker threads", async () => {
				const { runner } = await createAsync();

				await writeTestModuleAsync(`
					process.chdir(".");
					throw new Error("process.chdir() should execute without error");
				`);
				const results = await runner.runInChildProcessAsync([ testModulePath ]);

				assertFailureMessage(results, "process.chdir() should execute without error");
			});

		});

		describe("watchdog", () => {

			it("detects uncaught promise rejections", async () => {
				let notifications: TestCaseResult[] = [];
				function onTestCaseResult(result: TestCaseResult) {
					notifications.push(result);
				}

				const options = {
					renderer: CUSTOM_RENDERER_PATH,
					onTestCaseResult,
				};
				const { runner } = await createAsync();

				await writeTestModuleAsync(`Promise.reject(new Error("my error"));`);
				const results = await runner.runInChildProcessAsync([ testModulePath ], options);

				assert.dotEquals(results, createSuite({ tests: [
					createFail({ name: "Unhandled error in tests", error: new Error("my error") }),
				]}));
				assert.equal(getTestResult(results).errorRender, "custom rendering", "should use custom renderer");
			});

			it("detects infinite loops", async () => {
				let notifications: TestCaseResult[] = [];
				function onTestCaseResult(result: TestCaseResult) {
					notifications.push(result);
				}
				const options = {
					renderer: CUSTOM_RENDERER_PATH,
					onTestCaseResult,
				};
				const { runner, clock } = await createAsync();

				await writeTestModuleAsync(`while (true);`);
				const resultsPromise = runner.runInChildProcessAsync([ testModulePath ], options);
				await clock.tickAsync(TestSuite.DEFAULT_TIMEOUT_IN_MS);
				const results = await resultsPromise;

				assert.dotEquals(results, createSuite({ tests: [
					createFail({ name: "Test runner watchdog", error: "Detected infinite loop in tests" }),
				]}));
				assert.equal(getTestResult(results).errorRender, "custom rendering", "should use custom renderer");
				assert.equal(notifications[0]?.status, TestStatus.fail, "should notify caller");
			});

			it("detects early process exit", async () => {
				let notifications: TestCaseResult[] = [];
				function onTestCaseResult(result: TestCaseResult) {
					notifications.push(result);
				}
				const options = {
					renderer: CUSTOM_RENDERER_PATH,
					onTestCaseResult,
				};
				const { runner } = await createAsync();

				await writeTestModuleAsync(`process.exit(0);`);
				const results = await runner.runInChildProcessAsync([ testModulePath ], options);

				assert.dotEquals(results, createSuite({ tests: [
					createFail({ name: "Test runner watchdog", error: "Tests exited early (probably by calling `process.exit()`)" }),
				]}));
				assert.equal(getTestResult(results).errorRender, "custom rendering", "should use custom renderer");
				assert.equal(notifications[0]?.status, TestStatus.fail, "should notify caller");
			});

			it("doesn't trigger infinite loop detection when process exits early", async () => {
				let notifications: TestCaseResult[] = [];
				function onTestCaseResult(result: TestCaseResult) {
					notifications.push(result);
				}
				const options = {
					renderer: CUSTOM_RENDERER_PATH,
					onTestCaseResult,
				};
				const { runner, clock } = await createAsync();

				await writeTestModuleAsync(`process.exit(0);`);
				const results = await runner.runInChildProcessAsync([ testModulePath ], options);
				await clock.tickAsync(TestSuite.DEFAULT_TIMEOUT_IN_MS);

				assert.equal(notifications.length, 1, "should only have one error");
			});

		});

	});


	function getTestResult(result: TestSuiteResult) {
		return result.allTests()[0];
	}

	function assertFailureMessage(results: TestSuiteResult, expectedFailure: string) {
		assert.equal(getTestResult(results).errorMessage, expectedFailure);
	}

	async function writeTestModuleAsync(testSourceCode: string = "", variableDefinition = "") {
		await fs.writeFile(testModulePath, `
			import { assert, describe, it } from ` + `"${INDEX_PATH}";
			
			${variableDefinition}
			
			export default describe(() => {
				it("test", ({ getConfig }) => {
					${testSourceCode}
				});
			});
		`);
	}

	async function writeSetupModuleAsync(sourceCode: string, filename: string = setupModulePath) {
		await fs.writeFile(filename, `
			import { beforeAll, afterAll, beforeEach, afterEach, describe, it } from ` + `"${INDEX_PATH}";
			
			${sourceCode}
		`);
	}

	async function deleteTempFilesAsync(testDir: string) {
		assert.isDefined(testDir);
		await fs.rm(testDir, { recursive: true, force: true });
		await fs.mkdir(testDir, { recursive: true });
	}

});

async function createAsync({
	clock,
}: { clock?: Clock } = {}) {
	clock ??= await Clock.createNullAsync();
	const runner = new TestRunner(clock);

	return { runner, clock };
}

async function loadTestsAsync(
	testModuleFilenames: string[],
	setupModuleFilenames: string[] = [],
): Promise<TestSuite> {
	return await _loadTestsAsync(setupModuleFilenames, testModuleFilenames);
}
