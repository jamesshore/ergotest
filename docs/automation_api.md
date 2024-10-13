# Automation API

Use the automation API to run your tests and display their results.


Links to other documentation:

* [Test API](test_api.md)
* [Assertion API](assertion_api.md)
* Automation API
* [README](../README.md)
* [Changelog](../CHANGELOG.md)

In this document:

* TBD
* [TestRunner](#testrunner)
  * [TestRunner.create()](#testrunnercreate)
  * [testRunner.runInChildProcessAsync()](#testrunnerruninchildprocessasync)
  * [testRunner.runInCurrentProcessAsync()](#testrunnerrunincurrentprocessasync)
* TestSuiteResult
* TestCaseResult
* TestRenderer
* TestResult
* TestSuite


## Start Here

> **The Golden Rule:** Instantiate all classes by calling the `TheClass.create()` factory method, *not* the `new TheClass()` constructor! Constructors are reserved for internal use only in this codebase.

The best way to run your tests is to use [testRunner.runInChildProcessAsync()]. It takes a list of filenames which it will bundle up into a suite and run in an isolated child process.

The `runInChildProcessAsync()` method returns the results of the test run as a `TestSuiteResult` instance. You can render those results to a string by calling [TestSuiteResult.render()](#testsuiteresultrender). To learn the overall results of the test run, call [testSuiteResult.count()](#testsuiteresultcount)

If you want more fine-grained control, you can use the methods and properties on `TestSuiteResult` and `TestCaseResult`. Create a `TestRenderer` instance for more rendering options.

To see the results of the tests as they’re running, pass `notifyFn` to [testRunner.runInChildProcessAsync()](#testrunnerruninchildprocessasync). It will be called with a `TestCaseResult`, which you can then render with the [testCaseResult.renderAsCharacter()](#testcaseresultrenderascharacter), [testCaseResult.renderAsSingleLine()](#testcaseresultrenderassingleline), or [testCaseResult.renderAsMultipleLines()](#testcaseresultrenderasmultiplelines) methods.

Bringing it all together, here's an annotated version of a simple command-line interface for running tests:

```javascript
import { TestRunner } from "ergotest/test_runner.js";
import path from "node:path";

// Get the command-line arguments, ignoring 'node' and the build script.
const args = process.argv.slice(2);

// Convert the command-line arguments to absolute paths.
// (TestRunner requires absolute paths.)
const files = args.map(arg => path.resolve(process.cwd(), arg));

// Instantiate TestRunner
const testRunner = TestRunner.create();

// Run the tests, calling the reportProgress() function after each test completes
const result = await testRunner.runInChildProcessAsync(files, { notifyFn: reportProgress });

// Display the test results
console.log("\n" + result.render());

// Get a summary of the test results
const count = result.count();

// Check to see if the tests passed or failed
if (count.fail + count.timeout > 0) {
  console.log("Tests failed :-(");
}
else if (count.total === 0) {
  console.log("No tests ran :-O");
}
else {
  console.log("Tests passed :-)");
}

// This function is called every time a test finishes running
function reportProgress(testCase) {
  // Write the test result as a dot, X, etc.
  process.stdout.write(testCase.renderAsCharacter());
}
```


---


## TestRunner

Use `TestRunner` to run your tests.

* [TestRunner.create()](#testrunnercreate) - Instantiate `TestRunner`
* [testRunner.runInChildProcessAsync()](#testrunnerruninchildprocessasync) - Run tests in a child process
* [testRunner.runInCurrentProcessAsync()](#testrunnerrunincurrentprocessasync) - Run tests in the current process

[Back to top](#automation-api)


## TestRunner.create()

* TestRunner.create(): TestRunner

Instantiate `TestRunner`.

[Back to top](#automation-api)


## testRunner.runInChildProcessAsync()

* testRunner.runInChildProcessAsync(modulePaths: string[], options?: [TestOptions](#testoptions)): Promise\<[TestSuiteResult](#testsuiteresult)\>

Spawn an isolated child process, import the modules in `modulePaths` inside that process, and run them as a single test suite. Requires each module to export a `TestSuite`. (See the [test API](test_api.md) for details.)

The modules will be loaded fresh every time this method is called, allowing you to detect when files change and run the tests again.

If the tests enter an infinite loop or throw an uncaught exception, a test watchdog will kill the tests and generate a corresponding test failure.

Generates test failures if any of the `modulePaths` fail to load, or if they don’t export a test suite, but continues to run any modules that do load.

Use `options` to provide configuration data to the tests or specify a callback for reporting test progress.

[Back to top](#automation-api)


## testRunner.runInCurrentProcessAsync()

* testRunner.runInCurrentProcessAsync(modulePaths: string[], options?: [TestOptions](#testoptions)): Promise\<[TestSuiteResult](#testsuiteresult)\>

> **Warning:** It's typically better to call [testRunner.runInChildProcessAsync()](#testrunnerruninchildprocessasync).

Import the modules in `modulePaths` in the current process and run them as a single test suite. Requires each module to export a `TestSuite`. (See the [test API](test_api.md) for details.)

The modules will *not* be reloaded if they have been loaded before, even if they have changed. As a result, this method is only suitable for automation that exits back to the command line after running the tests.

Does *not* detect infinite loops or uncaught exceptions.

Generates test failures if any of the `modulePaths` fail to load, or if they don’t export a test suite, but continues to run any modules that do load.

Use `options` to provide configuration data to the tests or specify a callback for reporting test progress.

[Back to top](#automation-api)


---

## testRunner.runInChildProcessAsync()


## testSuiteResult.render()


## testSuiteResult.count()


## testCaseResult.renderAsCharacter()


## testCaseResult.renderAsSingleLine()


## testCaseResult.renderAsMultipleLines()




## Start Here

Your test files must export a `TestSuite` instance. The easiest way to do so is like this:

```typescript
// NOT RECOMMENDED
import { test, assert } from "ergotest";

export default test(() => {
  
  // tests go here
  
});
```

The `test()` function is an alias for [TestSuite.create()](#testsuitecreate), described below.

Instead of importing `ergotest` directly, create a `tests.js` wrapper that re-exports Ergotest. That way, if you ever decide to change test libraries, you won’t have to go update every single test. Like this:

```typescript
// tests.ts
import { TestSuite } from "ergotest/test_suite.js";

export const test = TestSuite.create;
export * as assert from "ergotest/assert.js";
```

Then use it in your tests like this:

```typescript
// RECOMMENDED
import { test, assert } from "/tests.js";

export default test(() => {
  
  // tests go here
  
});
```

This approach allows you to use any assertion library you want. If you prefer Chai's `expect` library, you'd put this in `tests.ts` instead:

```typescript
// tests.ts
import { TestSuite } from "ergotest/test_suite.js";

export const test = TestSuite.create;
export { expect } from "chai";
```

Even better, you can export custom assertion methods that are built for the needs of your project. See the [Assertion API documentation](assertion_api.md) for details. 

[Back to top](#test-api)


## TestSuite.create()

* TestSuite.create(fn?: DescribeFunction)
* TestSuite.create(name?: string, fn?: DescribeFunction)
* TestSuite.create.only(...)
* TestSuite.create.skip(...)

It's also known as `describe()` or `test()`:

* describe(fn?: DescribeFunction)
* describe(name?: string, fn?: DescribeFunction)
* describe.only(...)
* describe.skip(...)

`TestSuite.create()` defines a set of tests. When called, it runs `fn()` with an object parameter you can use to define your tests. When `fn()` complete, `TestSuite.create()` will return a `TestSuite` instance that you can use to run the tests you defined. See [the automation API](automation_api.md) for more information about running tests. 

### DescribeFunction

* fn({ it, describe, beforeAll, afterAll, beforeEach, afterEach, setTimeout }) => void

`fn()` is provided with an object parameter containing the following functions:

* [it()](#it)
* [describe()](#testsuitecreate)
* [beforeAll()](#beforeall)
* [afterAll()](#afterall)
* [beforeEach()](#beforeeach)
* [afterEach()](#aftereach)
* [setTimeout()](#settimeout)

Use these parameters to define your tests. You’ll use `describe()` and `it()` most frequently.

`fn()` must run synchronously. Any return value is ignored.

### .only and .skip

Use the `.only` variant to skip all tests or test suites other than the ones marked `.only`. This works across modules, assuming the modules are bundled into a single suite (which they typically are).

Use the `.skip` variant to skip this test suite. Leaving out `fn()` will also skip this test suite.

The `.skip` and `.only` status is inherited by all tests and suites created by `fn()`, but can be overridden by using `.skip` or `.only` again.  

### Example

```typescript
import { assert, test } from "ergotest";

export default test(({ describe, beforeAll, afterAll }) => {
  
  beforeAll(() => {
    // runs before all tests in this module
  });
  
  afterAll(() => {
    // runs after all tests in this module
  });
  
  describe("scenario 1", ({ it }) => {
    
    it("does something", () => {
      // ...
    });
    
    it("does something else", () => {
      // ...
    });
    
  });
  
  
  describe.skip("skipped scenario", ({ describe, it }) => {
    
    it("also does something", () => {
      // this test is skipped because its parent suite is marked '.skip'
    });
    
    describe("nested scenario", ({ it }) => {
      
      it.only("does some more stuff", () => {
        // this test runs because its '.only' overrides the grandparent suite's '.skip`. 
      });
      
    });
    
  });
  
});
```

[Back to top](#test-api)


## it()

* it(name: string, fn?: ItFunction)
* it.only(...)
* it.skip(...)

Define an individual test. When the test suite is run (see [the automation API](automation_api.md) for details), it will run each test's `fn()` in the order `it()` was called.

> *Note:* If the tests are being run in parallel, tests in different modules could run at the same time. The order that modules will run is unpredictable. But all the tests in a single module will run one at a time in the order they were defined.

If `fn()` returns a promise, the test runner will `await` that promise before continuing.

After the test runs, it will have one of the following statuses:

* *Fail:* The function threw an exception.
* *Timeout:* The function took too long to complete (defaults to two seconds).
* *Skip:* The test was skipped.
* *Pass:* The function ran and exited normally.

You’ll typically make your tests fail by throwing an `AssertionError`. Most assertion libraries will do this for you. For details about Ergotest's built-in assertion library, see the [assertion API documentation](assertion_api.md).

### ItFunction

* fn({ getConfig }) => void | Promise\<void\>

`fn()` is provided with an object parameter containing the following function:

* [getConfig()](#getconfig)

Use this parameter to get configuration data provided to the test from your automation.

### .only and .skip

Use the `.only` variant to skip all tests or test suites other than the ones marked `.only`. This works across modules, assuming the modules are bundled into a single suite (which they typically are).

Use the `.skip` variant to skip this test. Leaving out `fn()` will also skip this test.

### Example

```typescript
import { assert, test } from "ergotest";

export default test(({ it }) => {
  
  it("has a passing test", () => {
    assert.equal(2 + 2, 4);
  });
    
  it("has a test that fails because of an assertion", () => {
    assert.equal("apples", "oranges");
  });
  
  it("has a test that fails due to throwing an exception", () => {
    throw new Error("YOLO");
  });
  
  it("has a test that fails due to rejecting a promise", async () => {
    await new Promise((resolve, reject) => {
      reject(new Error("I like turtles"));
    });
  });
  
  it("has a test that times out", async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 100000);
    });
  });
  
  it.skip("has a test that's explicitly skipped", () => {
    process.exit(0); // this never runs
  });
  
  it("has a test that's skipped because it doesn't have a body");
  
});
```

[Back to top](#test-api)


## beforeAll()

* beforeAll(fn: ({ [getConfig](#getconfig) }) => void)

Define a function to run immediately before running any of the tests in this suite or its sub-suites.

If there are multiple `beforeAll()` functions in a suite, they will run in the order `beforeAll()` was called. If there are multiple nested suites, they will run from the outside in.

If there are no tests in this suite or its sub-suites, or they're all skipped, `fn()` will not be run.

If `fn()` throws an exception or times out, the tests won't run.

[Back to top](#test-api)


## afterAll()

* afterAll(fn: ({ [getConfig](#getconfig} )) => void)

Define a function to run immediately before running all the tests in this suite and its sub-suites.

If there are multiple `afterAll()` functions in a suite, `fn()` will run in the order `afterAll()` was called. If there are multiple nested suites, they will run from the inside out.

If any tests throw an exception or time out, `fn()` will still be run.

If no tests in this suite or its sub-suites ran—either because there weren’t any, they were skipped, or [beforeAll()](#beforeAll) threw an exception, `fn()` will not be run.

[Back to top](#test-api)


## beforeEach()

* beforeEach(fn: ({ [getConfig](#getconfig} )) => void)

Define a function to run immediately before running each test in this suite and its sub-suites. It will run once for each test.

If there are multiple `beforeEach()` functions in a suite, `fn()` will be run in the order `beforeEach()` was called. If there are multiple nested suites, they will run from the outside in. If there are [beforeAll()](#beforeall) functions in the suite, they will run first.

If no tests in this suite or its sub-suites will be run—either because there weren’t any, they were skipped, or [beforeAll()](#beforeall) threw an exception, `fn()` will not be run.

If `fn()` throws an exception or times out, the corresponding test will not be run.

[Back to top](#test-api)


## afterEach()

* afterEach(fn: ({ [getConfig](#getconfig} )) => void)

Define a function to run immediately after running each test in this suite and its sub-suites. It will run once for each test.

If there are multiple `afterEach()` functions in a suite, they will run in the order `afterEach()` was called. If there are multiple nested suites, they will be run from the inside out. If there are [afterAll()](#afterall) functions in the suite, they will run last.

If any tests throw an exception or time out, `fn()` will still be run for each test.

If no tests in this suite or its sub-suites were ran—either because there weren’t any, they were skipped, or [beforeAll()](#beforeall) and/or [beforeEach()](#beforeEach) threw exceptions, `fn()` will not be run.

[Back to top](#test-api)


## setTimeout()

* setTimeout(newTimeout: number)

Set the timeout, in milliseconds, for each test in this suite and any nested suites.

[Back to top](#test-api)


## getConfig()

* getConfig<T>(key: string): T

If this test suite was run with a configuration object (see the [automation API](automation_api.md)), gets the configuration value associated with `key`. This is useful for defining test-specific configuration, such as temporary file-system directories, connection strings, and so forth.

If no configuration object was defined, or if `key` doesn’t exist, `getConfig()` will throw an exception.

### Example

```typescript
import { assert, test } from "ergotest";
import fs from "node:fs/promises";
import { sut } from "./system_under_test.js";

export default test(({ beforeAll, beforeEach, it }) => {
  
  let testDir;

  beforeAll(async ({ getConfig }) => {
    testDir = getConfig("scratchDir");
  });

  beforeEach(async () => {
    // Erase the files before, not after. This solves two problems:
    // 1. Cleans up the test dir if it wasn't cleaned up for some reason
    // 2. We can use .only to look at the files written by a particular test run
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("reads and writes files", async () => {
    await sut.writeFileAsync(`${testDir}/my_file`);
    const actual = await fs.readFile(`${testDir}/myFile`);
    
    assert.equal(actual, "some expected value");
  });
  
});
```

[Back to top](#test-api)
