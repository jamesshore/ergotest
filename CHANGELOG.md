# Ergotest Change Log

Links to other documentation:

* [Test API](docs/test_api.md)
* [Assertion API](assertion_api.md)
* [Automation API](automation_api.md)
* [Reporting API](docs/reporting_api.md)
* [Readme](./README.md)
* **Changelog**
* [Roadmap](./ROADMAP.md)


## v0.12.x: Before/after edge case improvements (BREAKING CHANGE)

* **0.12.0, 6 Apr 2025:** Edge cases involving failed _beforeAll()_, _afterAll()_, _beforeEach()_ or _afterEach()_ functions are now handled cleanly. Although this is a breaking change, it won't affect most users.
* **0.12.1, 6 Apr 2025:** Export `test_suite.js` from `package.json` to prevent "The inferred type of 'default' cannot be named" TypeScript error from occurring on test modules.

Previously, tests could only have one result. When a before/after function failed, the failure was treated as the test's only result. This resulted in data loss when both a test and its _after_ functions failed. It also meant that no more _after_ functions would run if one of them failed.

Now before/after failures are handled cleanly. _beforeAll()_ and _afterAll()_ are reported as separate test cases. If a _beforeAll()_ function fails, all the corresponding tests will be reported as having been skipped. If an _afterAll()_ function fails, all the remaining _afterAll()_ functions will still run.

If _beforeEach()_ or _afterEach()_ fail, the reporter will now break out each individual result, showing the actual result of the test as well as each _beforeEach()_ and _afterEach()_ function. If an _afterEach()_ function fails, all the remaining _afterEach()_ functions will still run.

This change has required an overhaul of the [automation API](docs/automation_api.md) and revisions to the [reporting API](docs/reporting_api.md). Fortunately, these changes only affect advanced users. Normal use cases are unaffected.

### Reporting API changes

* [testRenderer.renderAsSingleLines()](docs/reporting_api.md#testrendererrenderassinglelines) breaks out _beforeEach()_ and _afterEach()_ results when one of them fails.
* [testRenderer.renderAsMultipleLines()](docs/reporting_api.md#testrendererrenderasmultiplelines) breaks out _beforeEach()_ and _afterEach()_ results when one of them fails. 

I've also taken this opportunity to [improve the "Start Here" documentation](docs/reporting_api.md#start-here) and clean up the API. These are **breaking changes**:

* [RenderErrorFn](docs/automation_api.md#rendererrorfn) and [renderError()](docs/reporting_api.md#rendererror) no longer take a _mark_ parameter.
* [renderNameOnOneLine()](docs/reporting_api.md#testrendererrendernameononeline) takes _(name: string[], filename?: string)_ parameters instead of a [result: TestResult](docs/automation_api.md#testresult) parameter.
* [renderNameOnMultipleLines()](docs/reporting_api.md#testrendererrendernameonmultiplelines) takes _(name: string[], filename?: string)_ parameters instead of a [result: TestResult](docs/automation_api.md#testresult) parameter.
* [renderMarkAsSingleWord()](docs/reporting_api.md#testrendererrendermarkassingleword) takes a [mark: TestMarkValue](docs/automation_api.md#testmarkvalue) parameter instead of a [result: TestResult](docs/automation_api.md#testresult) parameter. 
* [renderStatusAsSingleWord()](docs/reporting_api.md#testrendererrenderstatusassingleword) takes a [status: TestStatusValue](docs/automation_api.md#teststatusvalue) parameter instead of a [result: TestCaseResult](docs/automation_api.md#testcaseresult) parameter. 
* [renderStatusWithMultiLineDetails()](docs/reporting_api.md#testrendererrenderstatuswithmultilinedetails) takes a [runResult: RunResult](docs/automation_api.md#runresult) parameter instead of a [result: TestCaseResult](docs/automation_api.md#testcaseresult) parameter. 

### Automation API changes

This release overhauls the test results data model. Previously, it looked like this:

```
+--------------------> TestResult
|                   *     /_\
|                          |
|           +--------------+---------------+
|           |                              |
|  +-----------------+            +-----------------+               
|  | TestSuiteResult |            | TestCaseResult  |             
|  +-----------------+            +-----------------+
+--|-- children      |
   +-----------------+            
```

_TestSuiteResult_ contained _TestResults,_ which could either be more _TestSuiteResults_ or _TestCaseResults._ _TestCaseResult_ specified if the test passed, failed, etc. Before/after results were shoehorned in as needed.

The new data model accounts for before/after results explicitly:

```
+--------------------> TestResult
|                   *     /_\
|                          |
|           +--------------+---------------+
|           |                              |
|  +-----------------+            +-----------------+               
|  | TestSuiteResult |            | TestCaseResult  |             
|  +-----------------+         *  +-----------------+
|  |   beforeAll   --|----------> |   beforeEach  --|--------+     
|  |   afterAll    --|----------> |   afterEach   --|-----+  |      
+--|-- tests         |         *  |   it          --|--+  |  |
   +-----------------+            +-----------------+  |  |  |
                                                       |1 |* |*
                                                       v  v  v
                                                   +-------------+            
                                                   |  RunResult  |          
                                                   +-------------+
```

In the new model, _TestSuiteResult_ contains _TestResults_, as before, but it also contains 0..n _beforeAll_ and _afterAll_ results, which are _TestCaseResults_. _TestCaseResults_ contain _RunResults_—one for _it_ and 0..n for _beforeEach_ and _afterEach_—which represent the results of running the _it()_, _beforeEach()_, and _afterEach()_ functions respectively. _TestCaseResults_ no longer have their own status; instead, they consolidate the results of the individual RunResults. You can inspect each result separately, and the built-in renderers will display each result separately when it's appropriate.

This has resulted in the following **non-breaking changes**:

* [TestSuiteResult](docs/automation_api.md#testsuiteresult):
  * Added [testSuiteResult.beforeAll](docs/automation_api.md#testsuiteresultbeforeall)
  * Added [testSuiteResult.afterAll](docs/automation_api.md#testsuiteresultafterall)
* [TestCaseResult](docs/automation_api.md#testcaseresult):
  * Added [testCaseResult.beforeEach](docs/automation_api.md#testcaseresultbeforeeach)
  * Added [testCaseResult.afterEach](docs/automation_api.md#testcaseresultaftereach)
  * Added [testCaseResult.it](docs/automation_api.md#testcaseresultit)
  * [testCaseResult.status](docs/automation_api.md#testcaseresultstatus) consolidates results of _beforeEach()_, _afterEach()_, and _it()_.
* Added [RunResult](docs/automation_api.md#runresult)

It's also resulted in these **breaking changes**, partly because I took advantage of the opportunity to do some cleanup: 

* Renamed testSuiteResult.children to [testSuiteResult.tests](docs/automation_api.md#testsuiteresulttests) 
* Moved testCaseResult.errorMessage to [runResult.errorMessage](docs/automation_api.md#runresulterrormessage)
* Moved testCaseResult.errorRender to [runResult.errorRender](docs/automation_api.md#runresulterrorrender)
* Moved testCaseResult.timeout to [runResult.timeout](docs/automation_api.md#runresulttimeout)
* Replaced TestResult factories with new methods and signatures:
  * Moved TestResult.suite() to [TestSuiteResult.create()](docs/automation_api.md#testsuiteresultcreate)
  * Added [TestCaseResult.create()](docs/automation_api.md#testcaseresultcreate)
  * Moved TestResult.pass() to [RunResult.pass()](docs/automation_api.md#runresultpass)
  * Moved TestResult.skip() to [RunResult.skip()](docs/automation_api.md#runresultskip)
  * Moved TestResult.fail() to [RunResult.fail()](docs/automation_api.md#runresultfail)
  * Moved TestResult.timeout() to [RunResult.timeout()](docs/automation_api.md#runresulttimeout)
  * Revised signatures for above methods
* Removed TestSuite from the documentation; it's now for internal use only

## v0.11.x: Add optional 'actual' and 'expected' to assert.fail()

* **0.11.0, 10 Mar 2025:** The [assert.fail()](docs/assertion_api.md#assertfail) assertion now takes optional `actual` and `expected` parameters. If present, they will be included in the error rendering.


## v0.10.x: Better stack trace highlighting, including TypeScript support

* **0.10.0, 15 Feb 2025:** When a test fails, the error message previously highlighted the test's stack frames in bright white. Now they're highlighted in bright yellow for better visibility. In addition, the highlighting supports source maps, which means they now work with TypeScript code.


## v0.9.x: Improve error rendering (minor breaking change)

* **0.9.0, 1 Dec 2024:** Test failures render with more information in various edge cases, particularly for custom errors and some 'expected' and 'actual' results. This was done by rendering errors inside of Ergotest's worker process, rather than serializing errors across the worker process boundary, which resulted in some data being lost. 

This is technically a breaking change, but it's unlikely to affect most users. If you created a custom test renderer, you will need to update it. The new [Reporting  API](docs/reporting_api.md) document describes how to build a custom renderer.

The following property on [TestCaseResult](docs/automation_api.md#testcaseresult) has been removed:

* testCaseResult.error

It has been replaced with the following properties:

* [testCaseResult.errorMessage](docs/automation_api.md#runresulterrormessage)
* [testCaseResult.errorRender](docs/automation_api.md#runresulterrorrender)

A `renderer` option has been added to [TestOptions](docs/automation_api.md#testoptions). It allows you to customize the rendering of errors. This is an additive, non-breaking change for these APIs:

* [testRunner.runInChildProcessAsync()](docs/automation_api.md#testrunnerruninchildprocessasync)
* [testRunner.runInCurrentProcessAsync()](docs/automation_api.md#testrunnerrunincurrentprocessasync)
* [testSuite.runAsync()](docs/automation_api.md#testsuiterunasync)

The following function export has been added to `ergotest/test_renderer.js`:

* [renderError()](docs/reporting_api.md#rendererror)

The following methods have been converted to function exports on `ergotest/test_renderer.js`:

* testRenderer.renderStack() → [renderStack()](docs/reporting_api.md#renderstack)
* testRenderer.renderDiff() → [renderDiff()](docs/reporting_api.md#renderdiff)




## v0.8.x: Rename notifyFn (BREAKING CHANGE)

* **0.8.0, 29 Nov 2024:** The `notifyFn` parameter in the automation API has been renamed to `onTestCaseResult`.

This is a breaking change for [TestOptions](docs/automation_api.md#testoptions), which is used in these APIs:

* [testRunner.runInChildProcessAsync()](docs/automation_api.md#testrunnerruninchildprocessasync)
* [testRunner.runInCurrentProcessAsync()](docs/automation_api.md#testrunnerrunincurrentprocessasync)
* [testSuite.runAsync()](docs/automation_api.md#testsuiterunasync)

**Old way:**

```javascript
const result = await testRunner.runInChildProcessAsync(files, { 
  notifyFn: reportProgress, 
});
```

**New way:**

```javascript
const result = await testRunner.runInChildProcessAsync(files, { 
  onTestCaseResult: reportProgress, 
});
```

## v0.7.x: Reduce distribution size

* **0.7.0, 29 Nov 2024:** Ergotest's tests have been removed from the npm distribution, cutting its size in half. 


## v0.6.x: Remove test() function (BREAKING CHANGE)

* **0.6.1, 27 Nov 2024:** Documentation fix (fix broken links in changelog and readme, fix outdated API usage in getConfig() example)
* **0.6.0, 25 Nov 2024:** The `test()` function has been merged with `describe()`. Instead of calling `test()`, call `describe()` instead.

**Old way:**

```javascript
import { assert, test, describe, it } from "ergotest";

export default test(() => {
  // tests go here
});
```

**New way:**

```javascript
import { assert, describe, it } from "ergotest";

export default describe(() => {
  // tests go here
});
```


## v0.5.x: Timeout option (BREAKING CHANGE)

* **0.5.0, 24 Nov 2024:** Timeouts can now be defined at the test and before/after level, not just the suite level. Timeouts are now configured declaratively rather than with a function call. 

This is a breaking change for these APIs:

* [test()](docs/test_api.md#test)
* [describe()](docs/test_api.md#describe)

This is an additive, non-breaking change for these APIs:

* [it()](docs/test_api.md#it)
* [beforeAll()](docs/test_api.md#beforeall)
* [afterAll()](docs/test_api.md#afterall)
* [beforeEach()](docs/test_api.md#beforeeach)
* [afterEach()](docs/test_api.md#aftereach)

**Old way:**

```javascript
describe(({ setTimeout }) => {
  setTimeout(10000);
  
  it("doesn't time out", async () => {
    await new Promise(resolve => setTimeout(resolve, 8000));
  });
});
```

**New way:**

```javascript
describe({ timeout: 10000 }, () => {
  it("doesn't time out", async () => {
    await new Promise(resolve => setTimeout(resolve, 8000));
  });
});
```

*(or)*

```javascript
describe(() => {
  it("doesn't time out", { timeout: 10000 }, async () => {
    await new Promise(resolve => setTimeout(resolve, 8000));
  });
});
```



## v0.4.x: Default timeout

* **0.4.1, 24 Nov 2024:** Documentation fix (update changelog to reflect correct version number)
* **0.4.0, 24 Nov 2024:** The default timeout can now be configured when running tests.

This is an additive, non-breaking change to [TestOptions](docs/automation_api.md#testoptions). The following APIs are affected:

* [testRunner.runInChildProcessAsync()](docs/automation_api.md#testrunnerruninchildprocessasync)
* [testRunner.runInCurrentProcessAsync()](docs/automation_api.md#testrunnerrunincurrentprocessasync)
* [testSuite.runAsync()](docs/automation_api.md#testsuiterunasync)

**Example:**

```javascript
// set default timeout to five seconds
const result = await TestRunner.create().runInChildProcessAsync(files, { timeout: 5000 });
```


## v0.3.x: (skipped)

This version was accidentally skipped.


## v0.2.x: Test definition imports (BREAKING CHANGE)

* **0.2.0, 9 Nov 2024:** Move test definition functions from suite parameters to imports.

**Old way:**

```javascript
import { assert, test } from "ergotest";

export default test(({ describe, it, beforeAll, afterAll, beforeEach, afterEach }) => {
  // tests go here
});
```

**New way:**

```javascript
import { assert, test, describe, it, beforeAll, afterAll, beforeEach, afterEach } from "ergotest";

export default test(() => {
  // tests go here
});
```

## v0.1.x: Initial release

* **0.1.3, 9 Nov 2024:** 'Expected' and 'Actual' Regexes render properly when tests are run in child process 
* **0.1.2, 6 Nov 2024:** Change expected Node version to range with minimum of 22.11.0 (latest LTS)
* **0.1.1, 13 Oct 2024:** Remove reliance on development dependencies in production code
* **0.1.0, 13 Oct 2024:** Initial release
