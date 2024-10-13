# Test API

Use the test API to write your tests.


Links to other documentation:

* Test API
* [Assertion API](assertion_api.md)
* [Automation API](automation_api.md)
* [README](../README.md)
* [Changelog](../CHANGELOG.md)
* [Roadmap](../ROADMAP.md)

In this document:

* [Start Here](#start-here)
* [TestSuite.create](#testsuitecreate) aka test() or describe()
* [it()](#it)
* [beforeAll()](#beforeall)
* [afterAll()](#afterall)
* [beforeEach()](#beforeeach)
* [afterEach()](#aftereach)
* [setTimeout()](#settimeout)
* [getConfig()](#getconfig)

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

Instead of importing `ergotest` directly, create a `tests.ts` (or `tests.js`) wrapper that re-exports Ergotest. That way, if you ever decide to change test libraries, you won’t have to go update every single test. Like this:

```typescript
// tests.ts
import { TestSuite } from "ergotest/test_suite.js";

export const test = TestSuite.create;
export * as assert from "ergotest/assert.js";
```

Then use it in your tests like this:

```typescript
// RECOMMENDED
import { test, assert } from "tests.js";

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
