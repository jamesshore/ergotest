// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."

import { assert, test } from "tests";
import { TestRunner } from "./test_runner.js";
import path from "node:path";
import { TestSuite } from "./test_suite.js";
import { TestResultFactory } from "./test_result.js";
import fs from "node:fs/promises";
import { Clock } from "../infrastructure/clock.js";

export default test(({ beforeEach, it }) => {

	let TEST_MODULE_PATH: string;

	beforeEach(async ({ getConfig }) => {
		const testDir = getConfig<string>("scratchDir");

		TEST_MODULE_PATH = `${testDir}/_test_runner_module.js`;
		await deleteTempFilesAsync(testDir);
	});

	it("runs test modules", async () => {
		const { runner } = create();
		await writeTestModuleAsync(`// passes`);

		const results = await runner.runIsolatedAsync([ TEST_MODULE_PATH ]);

		const expectedResult = TestResultFactory.suite([], [
			TestResultFactory.suite([], [
				TestResultFactory.pass("test", TEST_MODULE_PATH)
			], TEST_MODULE_PATH),
		]);

		assert.objEqual(results, expectedResult);
	});

	it("passes through config", async () => {
		const myConfig = { myConfig: "my_config" };
		const { runner } = create();

		await writeTestModuleAsync(`throw new Error(getConfig("myConfig"));`);
		const results = await runner.runIsolatedAsync([ TEST_MODULE_PATH ], { config: myConfig });

		assertFailureMessage(results, "my_config");
	});

	it("notifies caller of completed tests", async () => {
		const { runner } = create();

		const progress: TestResultFactory[] = [];
		const notifyFn = (result: TestResultFactory) => progress.push(result);

		await writeTestModuleAsync(`// passes`);
		await runner.runIsolatedAsync([ TEST_MODULE_PATH ], { notifyFn });

		assert.deepEqual(progress, [
			TestResultFactory.pass("test", TEST_MODULE_PATH),
		]);
	});

	it("does not cache test modules from run to run", async () => {
		const { runner } = create();

		await writeTestModuleAsync(`throw new Error("module was cached, and shouldn't have been");`);
		await runner.runIsolatedAsync([ TEST_MODULE_PATH ]);

		await writeTestModuleAsync(`throw new Error("module was not cached");`);
		const results = await runner.runIsolatedAsync([ TEST_MODULE_PATH ]);

		assertFailureMessage(results, "module was not cached");
	});

	it("isolates tests", async () => {
		const { runner } = create();

		await writeTestModuleAsync(`global._test_runner_test = true;`);
		await runner.runIsolatedAsync([ TEST_MODULE_PATH ]);

		await writeTestModuleAsync(`throw new Error("global should be undefined: " + global._test_runner_test);`);
		const results = await runner.runIsolatedAsync([ TEST_MODULE_PATH ]);

		assertFailureMessage(results, "global should be undefined: undefined");
	});

	it("supports process.chdir(), which isn't allowed in Worker threads", async () => {
		const { runner } = create();

		await writeTestModuleAsync(`
			process.chdir(".");
			throw new Error("process.chdir() should execute without error");
		`);
		const results = await runner.runIsolatedAsync([ TEST_MODULE_PATH ]);

		assertFailureMessage(results, "process.chdir() should execute without error");
	});

	it("handles uncaught promise rejections", async () => {
		const { runner } = create();

		await writeTestModuleAsync(`Promise.reject(new Error("my error"));`);
		const results = await runner.runIsolatedAsync([ TEST_MODULE_PATH ]);

		assert.deepEqual(results, TestResultFactory.suite([], [
			TestResultFactory.fail("Unhandled error in tests", new Error("my error")),
		]));
	});

	it("handles infinite loops", async () => {
		const { runner, clock } = create();

		await writeTestModuleAsync(`while (true);`);
		const resultsPromise = runner.runIsolatedAsync([ TEST_MODULE_PATH ]);

		await clock.tickAsync(TestSuite.DEFAULT_TIMEOUT_IN_MS);

		assert.deepEqual(await resultsPromise, TestResultFactory.suite([], [
			TestResultFactory.fail("Test runner watchdog", "Detected infinite loop in tests"),
		]));
	});


	function assertFailureMessage(results: TestResultFactory, expectedFailure: string) {
		// @ts-expect-error This is pretty janky, but the tests will fail if it breaks
		assert.equal(results.children[0].children[0].error.message, expectedFailure);
	}

	async function writeTestModuleAsync(bodySourceCode: string) {
		const testSuitePath = path.resolve(import.meta.dirname, "./test_suite.js");
		await fs.writeFile(TEST_MODULE_PATH, `
			import { TestSuite } from ` + `"${testSuitePath}";
			
			export default TestSuite.createFn(({ it }) => {
				it("test", ({ getConfig }) => {
					${bodySourceCode}
				});
			});
		`);
	}

	async function deleteTempFilesAsync(testDir: string) {
		assert.defined(testDir);
		await fs.rm(testDir, { recursive: true, force: true });
		await fs.mkdir(testDir, { recursive: true });
	}

});

function create({
	clock = Clock.createNull(),
} = {}) {
	const runner = new TestRunner(clock);

	return { runner, clock };
}