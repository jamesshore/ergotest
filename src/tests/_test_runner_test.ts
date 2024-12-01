// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { assert, describe, it, beforeEach } from "../tests.js";
import { TestRunner } from "./test_runner.js";
import path from "node:path";
import { TestSuite } from "./test_suite.js";
import { TestResult, TestSuiteResult } from "./test_result.js";
import fs from "node:fs/promises";
import { Clock } from "../infrastructure/clock.js";
import { AssertionError } from "node:assert";
import util from "node:util";

export default describe(() => {

	let TEST_MODULE_PATH: string;

	beforeEach(async ({ getConfig }) => {
		const testDir = getConfig<string>("scratchDir");

		TEST_MODULE_PATH = `${testDir}/_test_runner_module.js`;
		await deleteTempFilesAsync(testDir);
	});


	describe("current process", () => {

		it("runs test modules and passes through config", async () => {
			const myConfig = { myConfig: "my_config" };
			const { runner } = await createAsync();

			await writeTestModuleAsync(`throw new Error(getConfig("myConfig"));`);
			const results = await runner.runInCurrentProcessAsync([ TEST_MODULE_PATH ], { config: myConfig });

			assertFailureMessage(results, "my_config");
		});

		// remaining behaviors not tested because of annoyances from them not being isolated

	});


	describe("child process", () => {

		it("runs test modules", async () => {
			const { runner } = await createAsync();
			await writeTestModuleAsync(`// passes`);

			const results = await runner.runInChildProcessAsync([ TEST_MODULE_PATH ]);

			const expectedResult = TestResult.suite([], [
				TestResult.suite([], [
					TestResult.pass("test", TEST_MODULE_PATH)
				], TEST_MODULE_PATH),
			]);

			assert.dotEquals(results, expectedResult);
		});

		it("passes through config", async () => {
			const myConfig = { myConfig: "my_config" };
			const { runner } = await createAsync();

			await writeTestModuleAsync(`throw new Error(getConfig("myConfig"));`);
			const results = await runner.runInChildProcessAsync([ TEST_MODULE_PATH ], { config: myConfig });

			assertFailureMessage(results, "my_config");
		});

		it("notifies caller of completed tests", async () => {
			const { runner } = await createAsync();

			const progress: TestResult[] = [];
			const onTestCaseResult = (result: TestResult) => progress.push(result);

			await writeTestModuleAsync(`// passes`);
			await runner.runInChildProcessAsync([ TEST_MODULE_PATH ], { onTestCaseResult });

			assert.equal(progress, [
				TestResult.pass("test", TEST_MODULE_PATH),
			]);
		});

		it.skip("supports custom error rendering", async () => {
			assert.todo("We can't pass a function to the worker process, so we need to pass a module name instead");

			const { runner } = await createAsync();

			await writeTestModuleAsync(`throw new Error();`);
			const results = await runner.runInChildProcessAsync([ TEST_MODULE_PATH ], {
				renderError: () => "my custom renderer",
			});

			assert.equal(getTestResult(results).errorRender, "my custom renderer");
		});

		it("does not cache test modules from run to run", async () => {
			const { runner } = await createAsync();

			await writeTestModuleAsync(`throw new Error("module was cached, and shouldn't have been");`);
			await runner.runInChildProcessAsync([ TEST_MODULE_PATH ]);

			await writeTestModuleAsync(`throw new Error("module was not cached");`);
			const results = await runner.runInChildProcessAsync([ TEST_MODULE_PATH ]);

			assertFailureMessage(results, "module was not cached");
		});

		it("isolates tests", async () => {
			const { runner } = await createAsync();

			await writeTestModuleAsync(`global._test_runner_test = true;`);
			await runner.runInChildProcessAsync([ TEST_MODULE_PATH ]);

			await writeTestModuleAsync(`throw new Error("global should be undefined: " + global._test_runner_test);`);
			const results = await runner.runInChildProcessAsync([ TEST_MODULE_PATH ]);

			assertFailureMessage(results, "global should be undefined: undefined");
		});

		it("supports process.chdir(), which isn't allowed in Worker threads", async () => {
			const { runner } = await createAsync();

			await writeTestModuleAsync(`
				process.chdir(".");
				throw new Error("process.chdir() should execute without error");
			`);
			const results = await runner.runInChildProcessAsync([ TEST_MODULE_PATH ]);

			assertFailureMessage(results, "process.chdir() should execute without error");
		});

		it.skip("handles uncaught promise rejections", async () => {
			const options = {
				renderError: () => "my renderer",
			};
			const { runner } = await createAsync();

			await writeTestModuleAsync(`Promise.reject(new Error("my error"));`);
			const results = await runner.runInChildProcessAsync([ TEST_MODULE_PATH ], options);

			assert.dotEquals(results, TestResult.suite([], [
				TestResult.fail("Unhandled error in tests", new Error("my error")),
			]));
			assert.equal(getTestResult(results).errorRender, "my renderer", "should use custom renderer");
		});

		it("handles infinite loops", async () => {
			const options = {
				renderError: () => "my renderer",
			};
			const { runner, clock } = await createAsync();

			await writeTestModuleAsync(`while (true);`);
			const resultsPromise = runner.runInChildProcessAsync([ TEST_MODULE_PATH ], options);

			await clock.tickAsync(TestSuite.DEFAULT_TIMEOUT_IN_MS);
			const results = await resultsPromise;

			assert.dotEquals(results, TestResult.suite([], [
				TestResult.fail("Test runner watchdog", "Detected infinite loop in tests"),
			]));
			assert.equal(getTestResult(results).errorRender, "my renderer", "should use custom renderer");
		});

		it.skip("renders custom objects", async () => {
			// This test is a bit obscure. The issue is that the code previously serialized objects from the worker process
			// back to the test runner. That caused information about 'expected' and 'actual' results to be lost. The
			// problem was fixed by having the worker process perform error rendering. This test mostly exists to stop
			// future maintainers from trying to reverse that decision, because it's non-obvious and makes the design
			// a bit clunky.


			class MyString extends String {
				constructor(private readonly _customField: string) {
					super();
				}
			}

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
			const result = getTestResult(await runner.runInChildProcessAsync([ TEST_MODULE_PATH ]));

			assert.equal(result.errorRender, "tbd");
		});

	});


	function getTestResult(result: TestSuiteResult) {
		return result.allTests()[0];
	}

	function assertFailureMessage(results: TestSuiteResult, expectedFailure: string) {
		assert.equal(getTestResult(results).errorMessage, expectedFailure);
	}

	async function writeTestModuleAsync(testSourceCode: string, variableDefinition = "") {
		await fs.writeFile(TEST_MODULE_PATH, `
			import { assert, describe, it } from ` + `"${(path.resolve(import.meta.dirname, "./index.js"))}";
			
			${variableDefinition}
			
			export default describe(() => {
				it("test", ({ getConfig }) => {
					${testSourceCode}
				});
			});
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