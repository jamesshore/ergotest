# Test API

Use the test API to write your tests.


Links to other documentation:

* **Test API**
* [Assertion API](assertion_api.md)
* [Automation API](automation_api.md)
* [Reporting API](reporting_api.md)
* [Readme](../README.md)
* [Changelog](../CHANGELOG.md)
* [Roadmap](../ROADMAP.md)

In this document:

* [**Example**](#example)
* [**Start Here**](#start-here)
* [describe()](#describe)
* [it()](#it)
* [beforeAll()](#beforeall)
* [afterAll()](#afterall)
* [beforeEach()](#beforeeach)
* [afterEach()](#aftereach)
* [getConfig()](#getconfig)



## Example

```typescript
import { assert, describe, it, beforeAll, afterAll } from "./tests.js";

export default describe(() => {
  
  beforeAll(() => {
    // runs one time before any tests run
  });
  
  afterAll(() => {
    // runs one time after all tests run
  });
  
  beforeEach(() => {
    // runs before each test runs
  });
  
  afterEach(() => {
    // runs after each test runs
  });
  
  describe("scenario 1", () => {

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
        setTimeout(resolve, 10000);
      });
    });
    
    it("has a test with a configured timeout", { timeout: 20000 }, async () => {
      // this test passes
      await new Promise((resolve) => {
        setTimeout(resolve, 10000);
      });
    });
    
    it.skip("has a test that's explicitly skipped", () => {
      process.exit(0); // this never runs
    });
    
    it("has a test that's skipped because it doesn't have a body");
    
  });
  
  
  describe.skip("skipped scenario", () => {
    
    it("also does something", () => {
      // this test is skipped because its parent suite is marked '.skip'
    });
    
    describe("nested scenario", () => {
      
      it.only("does some more stuff", () => {
        // this test runs because its '.only' overrides the grandparent suite's '.skip`. 
      });
      
    });
    
  });
  
});
```


## Start Here

Start by creating a `tests.ts` (or `tests.js`) wrapper that re-exports Ergotest. Like this:

```typescript
// tests.ts
export * from "ergotest";
```

Then use it in your tests like this:

```typescript
import { assert, describe, it } from "./tests.js";

export default describe(() => {
  
  it("my test", () => {
    // ...
  })
  
  describe("my sub-suite", () => {
    it("another test", () => {
      // ...
    });
  });
  
});
```

Re-exporting Ergotest has two benefits: First, if you ever decide to change test libraries, you won’t have to go update every single test. Second, it lets you customize Ergotest to your preferences.

Don’t like `it` and `describe`? Export different names:

```typescript
// tests.ts
export {
  describe as suite,
  it as test,
  beforeAll, afterAll, beforeEach, afterEach, assert,
} from "ergotest";
```

Prefer a different assertion library? Like `expect` better than `assert`? Use that instead:

```typescript
// tests.ts
export { describe, it, beforeAll, afterAll, beforeEach, afterEach } from "ergotest";
export { expect } from "chai";    // Chai is a third-party module
```

You can also export custom assertion methods that are purpose-built for the needs of your project. See the [Assertion API documentation](assertion_api.md) for details. 

The remainder of this document describes the functions you’ll use in your tests.

[Back to top](#test-api)


## describe()

* describe(name?: string, options?: [DescribeOptions](#describeoptions) , fn?: () => void)
* describe(name?: string, fn?: () => void)
* describe(options?: [DescribeOptions](#describeoptions), fn?: () => void)
* describe(fn?: () => void)
* describe(name?: string)
* describe()
* describe.skip(...)
* describe.only(...)

Use `export default describe(() => {...})` to define your test module. Inside the function, call [it()](#it) to define each test, call [describe()](#describe) again to define sub-suites of tests, and call [beforeAll()](#beforeall), [afterAll()](#afterall), [beforeEach()](#beforeeach), and [afterEach()](#aftereach) to define functions to run before and after tests in each suite.

All parameters are optional, and later parameters (such as _fn_) can be included even if earlier parameters (such as _name_ or _options_) are left out. If _fn_ is left out, the suite will be skipped.

If you call `describe.skip()`, all the tests in that suite will be skipped. If you call `describe.only()`, all tests and suites that _aren’t_ marked `.only` will be skipped. These statuses can be overridden by using `.skip` or `.only` on a test or sub-suite.

After the tests run, the result of this suite will be stored in a [TestSuiteResult](automation_api.md#testsuiteresult). The parent _TestSuiteResult_ of all your tests will be returned by the [TestRunner](automation_api.md#testrunner) you use to run the tests, and this suite's _TestSuiteResult_ will be found within that parent result.


The _describe()_ function technically returns a TestSuite instance, but that's an internal implementation detail. Just export it using `export default` on the top-level _describe()_ call in your test module.


### DescribeOptions

* { timeout: number }

Use the `timeout` option to change the timeout for tests in this suite and its sub-suites. The default value is two seconds, if not configured otherwise by the test automation. 

[Back to top](#test-api)


## it()

* it(name: string, options?: [ItOptions](#itoptions), fn?: [ItFunction](#itfunction))
* it(name: string, fn?: [ItFunction](#itfunction))
* it(name: string)
* it.only(...)
* it.skip(...)

Define an individual test. When the test suite runs, it will run each test’s _fn()_ in the order _it()_ was called.

The _options_ and _fn_ parameters are optional, and _fn_ can be included even if _options_ is left out. If _fn_ is left out, the test will be skipped.

> *Note:* In the future, ergotest may support parallel test runs. If the tests are being run in parallel, tests in different modules could run at the same time. The order that modules will run is unpredictable. But all the tests in a single module will run one at a time in the order they were defined.

If _fn()_ returns a promise, the test runner will `await` that promise before continuing.

If you call `it.skip()`, this test will be skipped. If you call `test.only()` all other tests and suites that _aren't_ marked `.only` will be skipped.

After the test runs, the result will be stored in a [RunResult](automation_api.md#runresult) inside the *it* property of a [TestCaseResult](automation_api.md#testcaseresult). The _TestCaseResult_ will be reported to [onTestCaseResult()](automation_api.md#testoptions) and will be accessible from the [TestSuiteResult](automation_api.md#testsuiteresult)s that contains this test. The test result will have one of the following statuses:

* *Pass:* The function ran and exited normally.
* *Skip:* The test was skipped.
* *Fail:* The function threw an exception.
* *Timeout:* The function took too long to complete. Use [ItOptions](#itoptions), [DescribeOptions](#describeoptions), or [TestOptions](automation_api.md#testoptions) to change the timeout. The default is two seconds. 

> **Note:** Due to JavaScript limitations, the test will continue running after the timeout occurs. The test runner will continue with its next action as soon as possible after the timeout. This could lead to multiple before/after functions or tests running at the same time.


You’ll typically make your tests fail by using an assertion library that throws `AssertionError`. You can use any library you like. For details about Ergotest’s built-in assertion library, see the [assertion API documentation](assertion_api.md).

### ItFunction

* fn({ getConfig }) => void | Promise\<void\>

The _fn()_ parameter is provided with an object containing the [getConfig()](#getconfig) function. Use it to get configuration data provided to the test from your automation.

### ItOptions

* { timeout: number }

Use the _timeout_ option to change the timeout for this test. The default value is two seconds, if not configured otherwise by your automation. 


[Back to top](#test-api)


## beforeAll()

* beforeAll(options: [ItOptions](#itoptions), fn: [ItFunction](#itfunction))
* beforeAll(fn: [ItFunction](#itfunction))

Define a function to run immediately before running any of the tests in this suite or its sub-suites. If _fn()_ returns a promise, the test runner will `await` that promise before continuing. 

After _beforeAll()_ runs, the result will be stored in a [RunResult](automation_api.md#runresult) inside the *it* property of a [TestCaseResult](automation_api.md#testcaseresult). It will be reported to [onTestCaseResult()](automation_api.md#testoptions) and will be accessible from the [TestSuiteResult](automation_api.md#testsuiteresult)s that contains it. The result will have one of the following statuses:

* *Pass:* The function ran and exited normally.
* *Skip:* The function was skipped.
* *Fail:* The function threw an exception.
* *Timeout:* The function took too long to complete. Use [ItOptions](#itoptions), [DescribeOptions](#describeoptions), or [TestOptions](automation_api.md#testoptions) to change the timeout. The default is two seconds.

> **Note:** Due to JavaScript limitations, _beforeAll()_ will continue running after the timeout occurs. The test runner will continue with its next action as soon as possible after the timeout. This could lead to multiple before/after functions or tests running at the same time.

If there are multiple _beforeAll()_ functions in a suite, they will run in the order _beforeAll()_ was called. If there are multiple nested suites, they will run from the outside in.

If there are no tests in this suite or its sub-suites, or they’re all skipped, _fn()_ will not be run.

If _fn()_ throws an exception or times out, the remainder of this suite will be skipped. No more _beforeAll(), afterAll(), beforeEach(), afterEach(),_ or _it()_ functions will run in this suite or any sub-suites. They will marked as "skipped" in the test results.

[Back to top](#test-api)


## afterAll()

* afterAll(options: [ItOptions](#itoptions), fn: [ItFunction](#itfunction))
* afterAll(fn: [ItFunction](#itfunction))

Define a function to run immediately before running all the tests in this suite and its sub-suites. If _fn()_ returns a promise, the test runner will `await` that promise before continuing.

After _afterAll()_ runs, the result will be stored in a [RunResult](automation_api.md#runresult) inside the *it* property of a [TestCaseResult](automation_api.md#testcaseresult). It will be reported to [onTestCaseResult()](automation_api.md#testoptions) and will be accessible from the [TestSuiteResult](automation_api.md#testsuiteresult)s that contains it. The result will have one of the following statuses:

* *Pass:* The function ran and exited normally.
* *Skip:* The function was skipped.
* *Fail:* The function threw an exception.
* *Timeout:* The function took too long to complete. Use [ItOptions](#itoptions), [DescribeOptions](#describeoptions), or [TestOptions](automation_api.md#testoptions) to change the timeout. The default is two seconds.

> **Note:** Due to JavaScript limitations, _afterAll()_ will continue running after the timeout occurs. The test runner will continue with its next action as soon as possible after the timeout. This could lead to multiple before/after functions or tests running at the same time.


If there are multiple _afterAll()_ functions in a suite, _fn()_ will run in the order _afterAll()_ was called. If there are multiple nested suites, they will run from the inside out.

If any tests throw an exception or time out, _fn()_ will still be run.

If no tests in this suite or its sub-suites ran—either because there weren’t any, they were skipped, or [beforeAll()](#beforeAll) threw an exception, _fn()_ will not be run.

If _fn()_ throws an exception or times out, any remaining _afterAll()_ functions will still be run.

[Back to top](#test-api)


## beforeEach()

* beforeEach(options: [ItOptions](#itoptions), fn: [ItFunction](#itfunction))
* beforeEach(fn: [ItFunction](#itfunction))

Define a function to run immediately before running each test in this suite and its sub-suites. It will run once for each test. If _fn()_ returns a promise, the test runner will `await` that promise before continuing.

Each time _beforeEach()_ runs, the result will be stored in a [RunResult](automation_api.md#runresult) inside the *beforeEach* property of the [TestCaseResult](automation_api.md#testcaseresult) for the test it corresponds to. The result will have one of the following statuses:

* *Pass:* The function ran and exited normally.
* *Skip:* The function was skipped.
* *Fail:* The function threw an exception.
* *Timeout:* The function took too long to complete. Use [ItOptions](#itoptions), [DescribeOptions](#describeoptions), or [TestOptions](automation_api.md#testoptions) to change the timeout. The default is two seconds.

> **Note:** Due to JavaScript limitations, _beforeEach()_ will continue running after the timeout occurs. The test runner will continue with its next action as soon as possible after the timeout. This could lead to multiple before/after functions or tests running at the same time.

If there are multiple _beforeEach()_ functions in a suite, _fn()_ will be run in the order _beforeEach()_ was called. If there are multiple nested suites, they will run from the outside in. If there are [beforeAll()](#beforeall) functions in the suite, they will run first.

If no tests in this suite or its sub-suites will be run—either because there weren’t any, they were skipped, or [beforeAll()](#beforeall) threw an exception, _fn()_ will not be run.

If _fn()_ throws an exception or times out, no _beforeEach()_, _afterEach()_, or _it()_ functions related to the corresponding test will be run. They will marked as "skipped" in the test results. However, _beforeEach(), afterEach()_ and _it()_ functions will be still run again for any remaining tests.

[Back to top](#test-api)


## afterEach()

* afterEach(options: [ItOptions](#itoptions), fn: [ItFunction](#itfunction))
* afterEach(fn: [ItFunction](#itfunction))

Define a function to run immediately after running each test in this suite and its sub-suites. It will run once for each test. If _fn()_ returns a promise, the test runner will `await` that promise before continuing.

Each time _afterEach()_ runs, the result will be stored in a [RunResult](automation_api.md#runresult) inside the *afterEach* property of the [TestCaseResult](automation_api.md#testcaseresult) for the test it corresponds to.The result will have one of the following statuses:

* *Pass:* The function ran and exited normally.
* *Skip:* The function was skipped.
* *Fail:* The function threw an exception.
* *Timeout:* The function took too long to complete. Use [ItOptions](#itoptions), [DescribeOptions](#describeoptions), or [TestOptions](automation_api.md#testoptions) to change the timeout. The default is two seconds.

> **Note:** Due to JavaScript limitations, _afterEach()_ will continue running after the timeout occurs. The test runner will continue with its next action as soon as possible after the timeout. This could lead to multiple before/after functions or tests running at the same time.

If there are multiple `afterEach()` functions in a suite, they will run in the order `afterEach()` was called. If there are multiple nested suites, they will be run from the inside out. If there are [afterAll()](#afterall) functions in the suite, they will run last.

If any tests throw an exception or time out, `fn()` will still be run for each test.

If no tests in this suite or its sub-suites were ran—either because there weren’t any, they were skipped, or [beforeAll()](#beforeall) and/or [beforeEach()](#beforeEach) threw exceptions, `fn()` will not be run.

If _fn()_ throws an exception or times out, any remaining _afterEach()_ functions will still be run.

[Back to top](#test-api)


## getConfig()

* getConfig\<T\>(key: string): T

Passed into [it()](#it), [beforeAll()](#beforeAll), [beforeEach()](#beforeEach), [afterAll()](#afterAll), and [afterEach()](#afterEach).

Gets the configuration value associated with `key`. This is useful for defining test-specific configuration, such as temporary file-system directories, connection strings, and so forth.

If no configuration object was defined, or if `key` doesn’t exist, `getConfig()` will throw an exception.

See [TestRunner](automation_api.md#testrunner) for information about how to define the configuration object.

### Example

```typescript
import { assert, describe, it, beforeAll, beforeEach } from "ergotest";
import fs from "node:fs/promises";
import { sut } from "./system_under_test.js";

export default describe(() => {

  // This example involves a test that writes to the file system.
  // We use getConfig() to get the "scratch" directory that the
  // test will write to, and store it in the `testDir` variable.
  // Inside of beforeEach(), we erase the scratch directory.
  
  // (We use beforeEach() rather than afterEach() for two reasons: 
  // 1. It cleans up the scratch dir if it wasn't cleaned up for some reason
  // 2. If we use .only on a test, we can manually examine what it wrote.)
  
  let testDir;

  beforeEach(async ({ getConfig }) => {
    testDir = getConfig("scratchDir");
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
