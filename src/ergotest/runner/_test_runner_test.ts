// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import {
	assert,
	beforeEach,
	createFail,
	createPass, createSkip,
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
import { _loadTestsAsync } from "./test_api.js";
import { isDefined } from "../assert.js";

// dependency: ../_renderer_custom.js

const INDEX_PATH = path.resolve(import.meta.dirname, "../index.js");
const CUSTOM_RENDERER_PATH = path.resolve(import.meta.dirname, "../_renderer_custom.js");

export default describe(() => {

	let testModuleFilename: string;
	let setupModuleFilename: string;
	let apiContextFilename: string;
	let nonce = 1;

	beforeEach(async ({ getConfig }) => {
		const testDir = getConfig<string>("scratchDir");

		testModuleFilename = `${testDir}/_test_runner_module_${nonce}.js`;
		setupModuleFilename = `${testDir}/_test_setup_module_${nonce}.js`;
		nonce++;
		apiContextFilename = path.resolve(import.meta.dirname, "./api_context.js");

		await deleteTempFilesAsync(testDir);
	});


	describe("module loader", () => {

		it("creates test suite from a module (and sets filename on result)", async () => {
			await writeTestModuleAsync();
			const suite = await loadTestsAsync([ testModuleFilename, testModuleFilename ]);

			const testCaseResult = createPass({ name: "test", filename: testModuleFilename });
			assert.dotEquals(await suite.runAsync(),
				createSuite({ tests: [
					createSuite({ tests: [ testCaseResult ], filename: testModuleFilename }),
					createSuite({ tests: [ testCaseResult ], filename: testModuleFilename }),
				]}),
			);
		});

		it("fails gracefully if module isn't an absolute path", async () => {
			const suite = await loadTestsAsync([ "./arbitrary_module.js" ]);

			assert.dotEquals(await suite.runAsync(), createSuite({
				tests: [
					createFail({
						filename: "./arbitrary_module.js",
						name: "import test module",
						error: "Module filenames must use absolute paths, but was: ./arbitrary_module.js",
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
						name: "import test module",
						error: `Cannot find module '/no_such_module.js' imported from ${path.resolve(
							import.meta.dirname,
							apiContextFilename,
						)}`,
					}),
				],
			}));
		});

		it("BUG: it doesn't think an import failure means the module doesn't exist", async () => {
			await fs.writeFile(testModuleFilename, "impo" + "rt irrelevant from '/no_such_module.js'");

			const suite = await loadTestsAsync([ testModuleFilename ]);
			assert.dotEquals(await suite.runAsync(), createSuite({
				tests: [
					createFail({
						filename: testModuleFilename,
						name: "import test module",
						error: `Cannot find module '/no_such_module.js' imported from ${testModuleFilename}`,
					}),
				],
			}));
		});

		it("fails gracefully if module throws an exception while being loaded", async () => {
			await fs.writeFile(testModuleFilename, "throw new Error('my import error')");

			const suite = await loadTestsAsync([ testModuleFilename ]);
			assert.dotEquals(await suite.runAsync(), createSuite({
				tests: [
					createFail({
						filename: testModuleFilename,
						name: "import test module",
						error: "my import error",
					}),
				],
			}));
		});

		it("fails gracefully if module doesn't export a test suite", async () => {
			await fs.writeFile(testModuleFilename, "");

			const suite = await loadTestsAsync([ testModuleFilename ]);
			assert.dotEquals(await suite.runAsync(), createSuite({
				tests: [
					createFail({
						filename: testModuleFilename,
						name: "import test module",
						error: `Test module '${testModuleFilename}' doesn't export a test suite. Did you forget to "export default" your describe()?`,
					}),
				],
			}));
		});

		it("provides helpful error message if there appear to be two installations of ergotest", async () => {
			// First, confirm that we're expecting test modules to export an object with a specific method
			await writeTestModuleAsync();
			const assumptionCheckerSuite = await loadTestsAsync([ testModuleFilename ]);
			assert.isDefined(assumptionCheckerSuite.runAsync);

			// Then check what happens if we manually export that object rather than using describe()
			const filename = `${testModuleFilename}-a.js`;
			await fs.writeFile(filename, `
				export default {
					runAsync() {}
				}
			`);

			const suite = await loadTestsAsync([ filename ]);
			assert.dotEquals(await suite.runAsync(), createSuite({
				tests: [
					createFail({
						filename,
						name: "import test module",
						error: `Test module '${filename}' appears to export a test suite, but it's not instantiating the correct class. Do you have two copies of ergotest installed?`,
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
			`);
			await writeTestModuleAsync();

			const suite = await loadTestsAsync([ testModuleFilename ], [ setupModuleFilename ]);

			assert.dotEquals(await suite.runAsync(), createSuite({
				beforeAll: [
					createPass({ name: "import setup module", filename: setupModuleFilename }),
					createPass({ name: "beforeAll()", filename: setupModuleFilename }),
				],
				afterAll: [ createPass({ name: "afterAll()", filename: setupModuleFilename }) ],
				tests: [
					createSuite({
						filename: testModuleFilename,
						tests: [
							createPass({
								name: "test",
								filename: testModuleFilename,
								beforeEach: [ createPass({ name: "beforeEach()", filename: setupModuleFilename }) ],
								afterEach: [ createPass({ name: "afterEach()", filename: setupModuleFilename }) ],
							}),
						],
					}),
				]
			}));
		});

		it("can have multiple setup files", async () => {
			const setupPath1 = `${setupModuleFilename}-1.js`;
			const setupPath2 = `${setupModuleFilename}-2.js`;

			await writeTestModuleAsync();
			await writeSetupModuleAsync(`
				beforeAll(() => {});
				beforeEach(() => {});
			`, setupPath1);
			await writeSetupModuleAsync(`
				afterAll(() => {});
				afterEach(() => {});
			`, setupPath2);

			const suite = await loadTestsAsync([ testModuleFilename ], [ setupPath1, setupPath2 ]);

			assert.dotEquals(await suite.runAsync(), createSuite({
				beforeAll: [
					createPass({ name: "import setup module", filename: setupPath1 }),
					createPass({ name: "import setup module", filename: setupPath2 }),
					createPass({ name: "beforeAll()", filename: setupPath1 }),
				],
				afterAll: [ createPass({ name: "afterAll()", filename: setupPath2 }) ],
				tests: [
					createSuite({
						filename: testModuleFilename,
						tests: [
							createPass({
								name: "test",
								filename: testModuleFilename,
								beforeEach: [ createPass({ name: "beforeEach()", filename: setupPath1 }) ],
								afterEach: [ createPass({ name: "afterEach()", filename: setupPath2 }) ],
							}),
						],
					}),
				]
			}));
		});

		it("inserts a do-nothing beforeAll() so it's included in TestSuiteResult.allPassingFiles()", async () => {
			await writeTestModuleAsync();
			await writeSetupModuleAsync("");

			const suite = await loadTestsAsync([ testModuleFilename ], [ setupModuleFilename ]);

			assert.dotEquals(await suite.runAsync(), createSuite({
				beforeAll: [ createPass({ name: "import setup module", filename: setupModuleFilename }) ],
				tests: [
					createSuite({
						filename: testModuleFilename,
						tests: [ createPass({
							name: "test",
							filename: testModuleFilename,
						})],
					}),
				],
			}));
		});

		it("puts import results in front of before/after results", async () => {
			const setupPath1 = `${setupModuleFilename}-1.js`;
			const setupPath2 = `${setupModuleFilename}-2.js`;
			const setupPath3 = `${setupModuleFilename}-3.js`;

			await writeTestModuleAsync();
			await writeSetupModuleAsync(`
				beforeAll(() => {});
			`, setupPath1);
			await writeSetupModuleAsync(`
				beforeAll(() => {});
			`, setupPath2);
			await writeSetupModuleAsync(`
				beforeAll(() => {});
			`, setupPath3);

			const suite = await loadTestsAsync([ testModuleFilename ], [ setupPath1, setupPath2, setupPath3 ]);

			assert.dotEquals(await suite.runAsync(), createSuite({
				beforeAll: [
					createPass({ name: "import setup module", filename: setupPath1 }),
					createPass({ name: "import setup module", filename: setupPath2 }),
					createPass({ name: "import setup module", filename: setupPath3 }),
					createPass({ name: "beforeAll()", filename: setupPath1 }),
					createPass({ name: "beforeAll()", filename: setupPath2 }),
					createPass({ name: "beforeAll()", filename: setupPath3 }),
				],
				tests: [
					createSuite({
						filename: testModuleFilename,
						tests: [
							createPass({
								name: "test",
								filename: testModuleFilename,
							}),
						],
					}),
				]
			}));

		});

		it("doesn't mark import results as skipped when no tests run, even though they're 'before' results");

		it("causes all subsequent runs to be skipped when a setup module fails to load", async () => {
			const setupPath1 = `${setupModuleFilename}-1.js`;
			const setupPath2 = `${setupModuleFilename}-2.js`;

			await writeSetupModuleAsync(`
				throw new Error("error 1");
			`, setupPath1);
			await writeSetupModuleAsync(`
				throw new Error("error 2");
			`, setupPath2);
			await writeTestModuleAsync();

			const suite = await loadTestsAsync([ testModuleFilename ], [ setupPath1, setupPath2 ]);

			assert.dotEquals(await suite.runAsync(), createSuite({
				beforeAll: [
					createFail({
						name: "import setup module",
						filename: setupPath1,
						error: "error 1",
					}),
					createSkip({ name: "import setup module", filename: setupPath2 }),
				],
				tests: [
					createSuite({
						filename: testModuleFilename,
						tests: [
							createSkip({
								name: "test",
								filename: testModuleFilename,
							}),
						],
					}),
				]
			}));

		});

		it("fails gracefully if describe() used in setup module", async () => {
			await writeSetupModuleAsync(`
				describe();
			`);
			await writeTestModuleAsync();

			const suite = await loadTestsAsync([ testModuleFilename ], [ setupModuleFilename ]);

			assert.dotEquals(await suite.runAsync(), createSuite({
				beforeAll: [
					createFail({
						filename: setupModuleFilename,
						name: "import setup module",
						error: "describe() is not permitted in setup modules",
					}),
				],
				tests: [
					createSuite({
						filename: testModuleFilename,
						tests: [
							createSkip({
								filename: testModuleFilename,
								name: "test",
							}),
						],
					}),
				],
			}));
		});

		it("fails gracefully if it() is used in setup module", async () => {
			await writeSetupModuleAsync(`
				it("irrelevant name");
			`);
			await writeTestModuleAsync();

			const suite = await loadTestsAsync([ testModuleFilename ], [ setupModuleFilename ]);

			assert.dotEquals(await suite.runAsync(), createSuite({
				beforeAll: [
					createFail({
						filename: setupModuleFilename,
						name: "import setup module",
						error: "it() is not permitted in setup modules",
					}),
				],
				tests: [
					createSuite({
						filename: testModuleFilename,
						tests: [
							createSkip({
								filename: testModuleFilename,
								name: "test",
							}),
						],
					}),
				],
			}));
		});

		it("fails gracefully if module isn't an absolute path", async () => {
			await writeTestModuleAsync();
			const suite = await loadTestsAsync([ testModuleFilename ], [ "./arbitrary_module.js" ]);

			assert.dotEquals(await suite.runAsync(), createSuite({
				beforeAll: [
					createFail({
						filename: "./arbitrary_module.js",
						name: "import setup module",
						error: "Module filenames must use absolute paths, but was: ./arbitrary_module.js",
					}),
				],
				tests: [
					createSuite({
						filename: testModuleFilename,
						tests: [
							createSkip({
								filename: testModuleFilename,
								name: "test",
							}),
						],
					}),
				],
			}));
		});

		it("fails gracefully if module doesn't exist", async () => {
			await writeTestModuleAsync();
			const suite = await loadTestsAsync([ testModuleFilename ], [ "/no_such_module.js" ]);

			assert.dotEquals(await suite.runAsync(), createSuite({
				beforeAll: [
					createFail({
						filename: "/no_such_module.js",
						name: "import setup module",
						error: `Cannot find module '/no_such_module.js' imported from ${apiContextFilename}`,
					}),
				],
				tests: [
					createSuite({
						filename: testModuleFilename,
						tests: [
							createSkip({
								filename: testModuleFilename,
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

			const suite = await loadTestsAsync([ testModuleFilename ], [ setupModuleFilename ]);
			assert.dotEquals(await suite.runAsync(), createSuite({
				beforeAll: [
					createFail({
						filename: setupModuleFilename,
						name: "import setup module",
						error: `Cannot find module '/no_such_module.js' imported from ${setupModuleFilename}`,
					}),
				],
				tests: [
					createSuite({
						filename: testModuleFilename,
						tests: [
							createSkip({
								filename: testModuleFilename,
								name: "test",
							}),
						],
					}),
				],
			}));
		});

		it("fails gracefully if module throws an exception while being loaded", async () => {
			await writeTestModuleAsync();
			await fs.writeFile(setupModuleFilename, "throw new Error('my import error')");

			const suite = await loadTestsAsync([ testModuleFilename ], [ setupModuleFilename ]);
			assert.dotEquals(await suite.runAsync(), createSuite({
				beforeAll: [
					createFail({
						filename: setupModuleFilename,
						name: "import setup module",
						error: "my import error",
					}),
				],
				tests: [
					createSuite({
						filename: testModuleFilename,
						tests: [
							createSkip({
								filename: testModuleFilename,
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
			const suite = await loadTestsAsync([ testModuleFilename ], [ "/no_such_module.js" ]);
			await suite.runAsync({ onTestCaseResult });

			assert.dotEquals(result[0], createFail({
				filename: "/no_such_module.js",
				name: `import setup module`,
				error: `Cannot find module '/no_such_module.js' imported from ${apiContextFilename}`,
			}));
		});

	});


	describe("current process", () => {

		it("runs test modules and passes through config", async () => {
			const myConfig = { myConfig: "my_config" };
			const { runner } = await createAsync();

			await writeTestModuleAsync(`throw new Error(getConfig("myConfig"));`);

			const results = await runner.runInCurrentProcessAsync([ testModuleFilename ], { config: myConfig });

			assert.dotEquals(results, createSuite({
				tests: [ createSuite({
					filename: testModuleFilename,
					tests: [ createFail({
						filename: testModuleFilename,
						name: "test",
						error: "my_config",
					})]
				})]
			}));
		});

		it("runs setup modules", async () => {
			const myConfig = { myConfig: "my_config" };
			const { runner } = await createAsync();

			await writeSetupModuleAsync(`afterAll(() => { throw new Error("my afterAll"); });`);
			await writeTestModuleAsync();

			const results = await runner.runInCurrentProcessAsync([ testModuleFilename ], {
					setupModulePaths: [ setupModuleFilename ],
					config: myConfig
				});

			assert.dotEquals(results, createSuite({
				beforeAll: [ createPass({
					filename: setupModuleFilename,
					name: "import setup module",
				})],
				afterAll: [ createFail({
					filename: setupModuleFilename,
					name: "afterAll()",
					error: "my afterAll",
				})],
				tests: [ createSuite({
					filename: testModuleFilename,
					tests: [ createPass({
						filename: testModuleFilename,
						name: "test",
					})],
				})],
			}));
		});

		// remaining behaviors not tested because of annoyances from them not being isolated

	});


	describe("child process", () => {

		describe("standard behavior", () => {

			it("runs test modules", async () => {
				const { runner } = await createAsync();
				await writeTestModuleAsync();

				const results = await runner.runInChildProcessAsync([ testModuleFilename ]);

				const expectedResult = createSuite({ tests: [
					createSuite({ filename: testModuleFilename, tests: [
						createPass({ name: "test", filename: testModuleFilename })
					]}),
				]});

				assert.equal(results, expectedResult);
			});

			it("runs setup modules", async () => {
				const myConfig = { myConfig: "my_config" };
				const { runner } = await createAsync();

				await writeSetupModuleAsync(`afterAll(() => { throw new Error("my afterAll"); });`);
				await writeTestModuleAsync();

				const results = await runner.runInChildProcessAsync([ testModuleFilename ], {
						setupModulePaths: [ setupModuleFilename ],
						config: myConfig
					});

				assert.dotEquals(results, createSuite({
					beforeAll: [ createPass({
						filename: setupModuleFilename,
						name: "import setup module",
					})],
					afterAll: [ createFail({
						filename: setupModuleFilename,
						name: "afterAll()",
						error: "my afterAll",
					})],
					tests: [ createSuite({
						filename: testModuleFilename,
						tests: [ createPass({
							filename: testModuleFilename,
							name: "test",
						})],
					})],
				}));
			});

			it("passes through config", async () => {
				const myConfig = { myConfig: "my_config" };
				const { runner } = await createAsync();

				await writeTestModuleAsync(`throw new Error(getConfig("myConfig"));`);
				const results = await runner.runInChildProcessAsync([ testModuleFilename ], { config: myConfig });

				assertFailureMessage(results, "my_config");
			});

			it("supports custom error rendering", async () => {
				const { runner } = await createAsync();

				await writeTestModuleAsync(`throw new Error();`);
				const results = await runner.runInChildProcessAsync([ testModuleFilename ], {
					renderer: CUSTOM_RENDERER_PATH,
				});

				assert.equal(getTestResult(results).errorRender, "custom rendering");
			});

			it("notifies caller of completed tests", async () => {
				const { runner } = await createAsync();

				const progress: TestResult[] = [];
				const onTestCaseResult = (result: TestResult) => progress.push(result);

				await writeTestModuleAsync(`// passes`);
				await runner.runInChildProcessAsync([ testModuleFilename ], { onTestCaseResult });

				assert.equal(progress, [
					createPass({ name: "test", filename: testModuleFilename }),
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
				const result = getTestResult(await runner.runInChildProcessAsync([ testModuleFilename ], options));

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
					() => runner.runInChildProcessAsync([ testModuleFilename ], options),
					/Renderer module not found/,
				);
			});

		});


		describe("isolation", () => {

			it("does not cache test modules from run to run", async () => {
				const { runner } = await createAsync();

				await writeTestModuleAsync(`throw new Error("module was cached, and shouldn't have been");`);
				await runner.runInChildProcessAsync([ testModuleFilename ]);

				await writeTestModuleAsync(`throw new Error("module was not cached");`);
				const results = await runner.runInChildProcessAsync([ testModuleFilename ]);

				assertFailureMessage(results, "module was not cached");
			});

			it("does not keep variables from run to run", async () => {
				const { runner } = await createAsync();

				await writeTestModuleAsync(`global._test_runner_test = true;`);
				await runner.runInChildProcessAsync([ testModuleFilename ]);

				await writeTestModuleAsync(`throw new Error("global should be undefined: " + global._test_runner_test);`);
				const results = await runner.runInChildProcessAsync([ testModuleFilename ]);

				assertFailureMessage(results, "global should be undefined: undefined");
			});

			it("supports process.chdir(), which isn't allowed in Worker threads", async () => {
				const { runner } = await createAsync();

				await writeTestModuleAsync(`
					process.chdir(".");
					throw new Error("process.chdir() should execute without error");
				`);
				const results = await runner.runInChildProcessAsync([ testModuleFilename ]);

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
				const results = await runner.runInChildProcessAsync([ testModuleFilename ], options);

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
				const resultsPromise = runner.runInChildProcessAsync([ testModuleFilename ], options);
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
				const results = await runner.runInChildProcessAsync([ testModuleFilename ], options);

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
				const results = await runner.runInChildProcessAsync([ testModuleFilename ], options);
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
		await fs.writeFile(testModuleFilename, `
			import { assert, describe, it } from ` + `"${INDEX_PATH}";
			
			${variableDefinition}
			
			export default describe(() => {
				it("test", ({ getConfig }) => {
					${testSourceCode}
				});
			});
		`);
	}

	async function writeSetupModuleAsync(sourceCode: string, filename: string = setupModuleFilename) {
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
