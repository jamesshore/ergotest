# Test API

Use the test API to write your tests.


Links to other documentation:

* **Test API**
* [Assertion API](assertion_api.md)
* [Automation API](automation_api.md)
* [Readme](../README.md)
* [Changelog](../CHANGELOG.md)
* [Roadmap](../ROADMAP.md)

In this document:

* [Example](#example)
* [Start Here](#start-here)
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
export { expect } from "chai";
```

You can also export custom assertion methods that are purpose-built for the needs of your project. See the [Assertion API documentation](assertion_api.md) for details. 

The remainder of this document describes the functions you’ll use in your tests.

[Back to top](#test-api)


## describe()

* describe(name?: string, options?: [DescribeOptions](#describeoptions) , fn?: () => void)
* describe(name?: string, fn?: () => void)
* describe(options?: [DescribeOptions](#describeoptions), fn?: () => void)
* describe(fn?: () => void)
* describe.only(...)
* describe.skip(...)

Use `export default describe(() => {...})` to define your test module. Inside the function, call [it()](#it) to define each test, call [describe()](#describe) again to define sub-suites of tests, and call [beforeAll()](#beforeall), [afterAll()](#afterall), [beforeEach()](#beforeeach), and [afterEach()](#aftereach) to define functions to run before and after tests in each suite.

If `fn` is not provided, the suite will be skipped.

If you call `describe.skip()`, all the tests in that suite will be skipped. If you call `describe.only()`, all tests and suites that _aren’t_ marked `.only` will be skipped. These statuses are inherited by all tests and sub-suites within this suite, but it can be overridden by using `.skip` or `.only` on a test or sub-suite.

This function technically returns a [TestSuite](automation_api.md#testsuite) instance, but you should use [TestRunner](automation_api.md#testrunner) instead.


### DescribeOptions

* { timeout: number }

Use the `timeout` option to change the timeout for tests in this suite and its sub-suites. The default value is two seconds, if not configured otherwise by the test automation. 

[Back to top](#test-api)


## it()

* it(name: string, options?: ItOptions, fn?: ItFunction)
* it(name: string, fn?: ItFunction)
* it(name: string)
* it.only(...)
* it.skip(...)

Define an individual test. When the test suite runs, it will run each test’s `fn()` in the order `it()` was called. If `fn` is not provided, the test will be skipped.

> *Note:* In the future, ergotest may support parallel test runs. If the tests are being run in parallel, tests in different modules could run at the same time. The order that modules will run is unpredictable. But all the tests in a single module will run one at a time in the order they were defined.

If `fn()` returns a promise, the test runner will `await` that promise before continuing.

If you call `it.skip()`, this test will be skipped. If you call `test.only()` all other tests and suites that aren't also marked `.only` will be skipped.

After the test runs, it will have one of the following statuses:

* *Fail:* The function threw an exception.
* *Timeout:* The function took too long to complete. Use [ItOptions](#itoptions) or your automation to change the timeout (defaults to two seconds).
* *Skip:* The test was skipped.
* *Pass:* The function ran and exited normally.

You’ll typically make your tests fail by throwing an `AssertionError`. Most assertion libraries will do this for you. For details about Ergotest’s built-in assertion library, see the [assertion API documentation](assertion_api.md).

### ItFunction

* fn({ getConfig }) => void | Promise\<void\>

`fn()` is provided with an object parameter containing the [getConfig()](#getconfig) function. Use this parameter to get configuration data provided to the test from your automation.

### ItOptions

* { timeout: number }

Use this `timeout` option to change the timeout for this test. The default value is two seconds, if not configured otherwise by your automation. 


[Back to top](#test-api)


## beforeAll()

* beforeAll(options: [ItOptions](#itoptions), fn: ({ [getConfig](#getconfig) }) => void | Promise\<void>)
* beforeAll(fn: ({ [getConfig](#getconfig) }) => void | Promise\<void>)

Define a function to run immediately before running any of the tests in this suite or its sub-suites. If `fn()` returns a promise, the test runner will `await` that promise before continuing. 

If there are multiple `beforeAll()` functions in a suite, they will run in the order `beforeAll()` was called. If there are multiple nested suites, they will run from the outside in.

If there are no tests in this suite or its sub-suites, or they’re all skipped, `fn()` will not be run.

If `fn()` throws an exception or times out, the tests won’t run.

[Back to top](#test-api)


## afterAll()

* afterAll(options: [ItOptions](#itoptions), fn: ({ [getConfig](#getconfig) }) => void | Promise\<void>)
* afterAll(fn: ({ [getConfig }](#getconfig} )) => void | Promise\<void>)

Define a function to run immediately before running all the tests in this suite and its sub-suites. If `fn()` returns a promise, the test runner will `await` that promise before continuing.

If there are multiple `afterAll()` functions in a suite, `fn()` will run in the order `afterAll()` was called. If there are multiple nested suites, they will run from the inside out.

If any tests throw an exception or time out, `fn()` will still be run.

If no tests in this suite or its sub-suites ran—either because there weren’t any, they were skipped, or [beforeAll()](#beforeAll) threw an exception, `fn()` will not be run.

[Back to top](#test-api)


## beforeEach()

* beforeEach(options: [ItOptions](#itoptions), fn: ({ [getConfig](#getconfig) }) => void | Promise\<void>)
* beforeEach(fn: ({ [getConfig](#getconfig} )) => void | Promise\<void>)

Define a function to run immediately before running each test in this suite and its sub-suites. It will run once for each test. If `fn()` returns a promise, the test runner will `await` that promise before continuing.

If there are multiple `beforeEach()` functions in a suite, `fn()` will be run in the order `beforeEach()` was called. If there are multiple nested suites, they will run from the outside in. If there are [beforeAll()](#beforeall) functions in the suite, they will run first.

If no tests in this suite or its sub-suites will be run—either because there weren’t any, they were skipped, or [beforeAll()](#beforeall) threw an exception, `fn()` will not be run.

If `fn()` throws an exception or times out, the corresponding test will not be run.

[Back to top](#test-api)


## afterEach()

* afterEach(options: [ItOptions](#itoptions), fn: ({ [getConfig](#getconfig) }) => void | Promise\<void>)
* afterEach(fn: ({ [getConfig](#getconfig} )) => void | Promise\<void>)

Define a function to run immediately after running each test in this suite and its sub-suites. It will run once for each test. If `fn()` returns a promise, the test runner will `await` that promise before continuing.

If there are multiple `afterEach()` functions in a suite, they will run in the order `afterEach()` was called. If there are multiple nested suites, they will be run from the inside out. If there are [afterAll()](#afterall) functions in the suite, they will run last.

If any tests throw an exception or time out, `fn()` will still be run for each test.

If no tests in this suite or its sub-suites were ran—either because there weren’t any, they were skipped, or [beforeAll()](#beforeall) and/or [beforeEach()](#beforeEach) threw exceptions, `fn()` will not be run.

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
