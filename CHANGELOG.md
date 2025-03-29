# Ergotest Change Log

Links to other documentation:

* [Test API](docs/test_api.md)
* [Assertion API](assertion_api.md)
* [Automation API](automation_api.md)
* [Reporting API](docs/reporting_api.md)
* [Readme](./README.md)
* **Changelog**
* [Roadmap](./ROADMAP.md)


## v0.12.x: WIP (data model, which will enable 0.13.x performance tracking)

To Document:
* Explicitly document data model?
* Add TestResult.testCase
* TestResult.suite signature change
* TestResult.pass signature change and move to RunResult
* TestResult.fail signature change and move to RunResult
* TestResult.skip signature change and move to RunResult
* TestResult.timeout signature change and move to RunResult
* TestRenderer.renderError() signature change
* Add TestSuiteResult.beforeAll & afterAll
* Add TestCaseResult.beforeEach & afterEach
* Add RunResult
* TestSuiteResult.children --> TestSuiteResult.tests rename
* Change in behavior: beforeAll() and afterAll() now notify upon completion (this is part of general behavior of treating beforeAll() and afterAll() like tests across the board)
* Change in behavior: beforeAll() and afterAll() failures no longer result in failing TestCaseResults. Instead, they show up in TestSuiteResult.beforeAll or .afterAll
* Change in behavior: beforeAll() and afterAll() are picked up by allTests(), allMatchingTests(), and allMatchingMarks() (as 'not marked')
* Change in behavior: Runs all afterAll() blocks even if one fails 
* Change in rendering: renderAsSingleLines() breaks out beforeEach / afterEach
* Change in rendering: renderAsMultipleLines() breaks out beforeEach / afterEach
* Change in rendering: renderNameOnMultipleLines() only highlights first name (usually filename) and last name (test name); it previously highlighted everything

TO DO:
* IN PROGRESS: Factor out RunResult
  * Convert TestResult.testCase() to TestCaseResult.create()
  * Revise TestSuiteResult.create() to match signature of other result factories
  * Revise TestRenderer to more specific types where possible (including RunResult instead of TestResult)
* Check that stack trace highlighting works with beforeEach etc.
* Modify TestResult.suite() to match signature of RunResult factory methods
* Serialize/deserialize RunResult
* Fix public _beforeEach/_afterEach in TestCaseResult
* Fix public _status in TestCaseResult and duplication of renderStatusAsSingleWord() in renderAsSingleLines()
* Delete .equals() methods? If we don't, we need to add beforeEach and afterEach comparisons.
* Delete isPass(), isSkip(), etc. methods? If we don't, should we add or move them to RunResult?
* Rename TestCaseResult.status to .consolidatedStatus? If we do, should we add TestSuiteResult.consolidatedStatus?
* before / after shouldn't put number in name unless there's more than one (including first one, which is different than how beforeEach/afterEach currently work)

## v0.11.x: Add optional 'actual' and 'expected' to assert.fail()

* **0.11.0, 10 Mar 2024:** The [assert.fail()](docs/assertion_api.md#assertfail) assertion now takes optional `actual` and `expected` parameters. If present, they will be included in the error rendering.


## v0.10.x: Better stack trace highlighting, including TypeScript support

* **0.10.0, 15 Feb 2024:** When a test fails, the error message previously highlighted the test's stack frames in bright white. Now they're highlighted in bright yellow for better visibility. In addition, the highlighting supports source maps, which means they now work with TypeScript code.


## v0.9.x: Improve error rendering (minor breaking change)

* **0.9.0, 1 Dec 2024:** Test failures render with more information in various edge cases, particularly for custom errors and some 'expected' and 'actual' results. This was done by rendering errors inside of Ergotest's worker process, rather than serializing errors across the worker process boundary, which resulted in some data being lost. 

This is technically a breaking change, but it's unlikely to affect most users. If you created a custom test renderer, you will need to update it. The new [Reporting  API](docs/reporting_api.md) document describes how to build a custom renderer.

The following property on [TestCaseResult](docs/automation_api.md#testcaseresult) has been removed:

* testCaseResult.error

It has been replaced with the following properties:

* [testCaseResult.errorMessage](docs/automation_api.md#testcaseresulterrormessage)
* [testCaseResult.errorRender](docs/automation_api.md#testcaseresulterrorrender)

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
