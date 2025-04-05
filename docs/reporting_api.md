# Reporting API

Use the reporting API to customize test output.


Links to other documentation:

* [Test API](test_api.md)
* [Assertion API](assertion_api.md)
* [Automation API](automation_api.md)
* **Reporting API**
* [Readme](../README.md)
* [Changelog](../CHANGELOG.md)
* [Roadmap](../ROADMAP.md)

In this document:

* **[Start Here](#start-here)**
* [TestRenderer](#testrenderer)
  * [TestRenderer.create()](#testrunnercreate)
  * [testRenderer.renderSummary()](#testrendererrendersummary)
  * [testRenderer.renderAsCharacters()](#testrendererrenderascharacters)
  * [testRenderer.renderAsSingleLines()](#testrendererrenderassinglelines)
  * [testRenderer.renderAsMultipleLines()](#testrendererrenderasmultiplelines)
  * [testRenderer.renderMarksAsLines()](#testrendererrendermarksaslines)
  * [testRenderer.renderNameOnOneLine()](#testrendererrendernameononeline)
  * [testRenderer.renderNameOnMultipleLines()](#testrendererrendernameonmultiplelines)
  * [testRenderer.renderMarkAsSingleWord()](#testrendererrendermarkassingleword)
  * [testRenderer.renderStatusAsSingleWord()](#testrendererrenderstatusassingleword)
  * [testRenderer.renderStatusWithMultilineDetails()](#testrendererrenderstatuswithmultilinedetails)
* [renderError()](#rendererror)
* [renderStack()](#renderstack)
* [renderDiff()](#renderdiff)
  

## Start Here

> **The Golden Rule:** Don't use constructors to instantiate Ergotest classes. Constructors are reserved for internal use only in this codebase.

Most people can ignore the reporting API. The [automation API](automation_api.md) is enough for most uses. But if you want even more customization, this document has what you need.

Reporting is split into two parts in Ergotest:

* _Result rendering_, which converts a test result into a string. Your build calls these functions. 
* _Error rendering_, which converts an error object into a string and sets the [testCaseResult.errorRender](automation_api.md#runresulterrorrender) property. Ergotest calls this function automatically when a test fails.


### Customizing result rendering

Most people only use result rendering. For example, the example in the [Automation API documentation](automation_api.md#start-here) uses `result.render()` to output the overall test results and `testCase.renderAsCharacter()` to output progress:

```javascript
import { TestRunner } from "ergotest/test_runner.js";

// ... (see the automation API documentation for the full example)

const result = await testRunner.runInChildProcessAsync(files, { 
  onTestCaseResult: reportProgress, 
});
console.log("\n" + result.render("\n") + "\n");

function reportProgress(testCase) {
  process.stdout.write(testCase.renderAsCharacter());
}
```

If you want to have more fine-grained control over your test output, use the [TestRenderer](#testrenderer) class. It allows you to pick and choose what you'd like to report.

For example, the default [testSuiteResult.render()](automation_api.md#testsuiteresultrender) method displays skipped tests, timeouts, failures a summary of test counts, and more. If you only want to display failed tests and nothing else, you could do this:

```javascript
// Run the tests
const result = await testRunner.runInChildProcessAsync(/* ... */);

// Get the failed tests from the test results
const failedTests = result.allMatchingTests(TestStatus.fail);

// Display failed tests
const renderer = TestRenderer.create();
console.log(renderer.renderAsMultipleLines(failedTests));
```

Of course, for the maximum control possible, you can ignore `TestRenderer` entirely and write your own rendering using the properties on [TestSuiteResult](#testsuiteresult) and [TestCaseResult](#testcaseresult).  

For a happy middle ground between control and reuse, consider subclassing `TestRenderer` and overriding specific methods. For example, if you like how [testRenderer.renderAsSingleLines()](#testrendererrenderassinglelines) works, but you want it to display emojis for status, override [testRenderer.renderStatusAsSingleWord](#testrendererrenderstatusassingleword)():

```typescript
// Define a custom renderer
class EmojiRenderer extends TestRenderer {
  static create() {
    return new EmojiRenderer();
  }
  renderStatusAsSingleWord(status: TestStatusValue) {
    switch (status) {
      case TestStatus.pass: return "✅";
      case TestStatus.skip: return "⏩";
      case TestStatus.fail: return "❌";
      case TestStatus.timeout: return "⌛️";
      default:
        throw new Error(`Unrecognized test result status: ${testCaseResult.status}`);
    }
  }
}

// Run the tests
const result = await testRunner.runInChildProcessAsync(/* ... */);

// Get the individual test results
const tests = result.allTests();

// Display test results
const renderer = EmojiRenderer.create();
console.log(renderer.renderAsSingleLines(tests));
```

See the [TestRenderer](#testrenderer) documentation for details about how each method works and what other methods they call.


### Customizing error rendering

The test results don’t include the error object that caused a test to fail. That's because Ergotest runs its tests in a worker process, by default, and serializing error objects across the process boundary can result in data loss. As a result, errors have to be handled inside the worker process.

To customize how errors are rendered, create a module that exports a `renderError()` function. It needs to have a signature matching the [RenderErrorFn](automation_api.md#rendererrorfn) type:

* `renderError(names: string[], error: unknown, mark: TestMarkValue, filename?: string): unknown;`
* _names:_ Same as [testCaseResult.name](automation_api.md#testcaseresultname).
* _error:_ The error that caused the test to fail. Although it's usually an `Error` instance, it could be any data type, including a string.
* _mark:_ Same as [testCaseResult.mark](automation_api.md#testcaseresultmark).
* _filename:_ Same as [testCaseResult.filename](automation_api.md#testcaseresultfilename).

Next, provide the path of the module in your [TestOptions](automation_api.md#testoptions]). It needs to either be an absolute path or the name of a node module. You can use `path.resolve()` to figure out the absolute path:

```typescript
import { TestRunner } from "ergotest/test_runner.js";
import path from "node:path";

const files = /* ... */

const options = {
  renderer: path.resolve(import.meta.dirname, "./my_error_renderer.js"),
}
const result = await testRunner.runInChildProcessAsync(files, options);

// ...
```

The worker process will import your custom module and call its `renderError()` function every time a test fails. It stores the result of that call in [TestCaseResult.errorRender](automation_api.md#runresulterrorrender). Ergotest's built-in rendering functions, such as [testSuiteResult.render()](automation_api.md#testsuiteresultrender) and [TestRenderer](#testrenderer), will use the result automatically.


### Total customization

If you want to completely customize your output, you can create your own result renderer and error renderers. It's convenient to put them in the same file. Here's an example of a build that outputs [TAP (Test Anything Protocol)](https://testanything.org/):

> **Warning:** This is just an example. It's not meant to be an accurate or complete implementation of TAP. In particular, it doesn't display error messages when _beforeEach()_ or _afterEach()_ fail.

```typescript
// build.js - The build file

import { TestRunner } from "ergotest/test_runner.js";
import { renderTap } from "./tap_renderer.js";
import path from "node:path";

const files = /* ... */

const testRunner = TestRunner.create();
const result = await testRunner.runInChildProcessAsync(files, { 
  renderer: path.resolve(import.meta.dirname, "./tap_renderer.js")
});

console.log(renderTap(result));
```

```typescript
// tap_renderer.js - The custom renderer

import { TestMarkValue, TestStatus } from "ergotest/test_result.js";
import util from "node:util";

// called by Ergotest when a test fails
export function renderError(name: string[], error: unknown, mark: TestMarkValue, filename?: string) {
  let result = "  ---\n";
  result += "  error: " + util.inspect(error, { depth: Infinity }) + "\n";
  if (error instanceof AssertionError) {
    result += "  found: " + util.inspect(error.actual, { depth: Infinity })  + "\n";
    result += "  wanted: " + util.inspect(error.expected, { depth: Infinity }) + "\n";
  }
  result += "  ...\n";
  return result;
}

// called by the build
export function renderTap(suite: TestSuiteResult) {
  const { total } = suite.count();
  const tests = suite.allTests();

  let result = "TAP version 14\n";
  result += `1..${total}\n`;

  tests.forEach((test: TestCaseResult, i: number) => {
    const ok = (test.isPass() || test.isSkip) ? "ok" : "not ok";
    const name = test.name().pop() ?? "(no name)";
    
    result += `${ok} ${i} - ${name} # ${test.status.toUpperCase()}\n`;
    if (test.it.status === TestStatus.fail) {
      // test.errorRender has the result of calling renderError()
      result += test.it.errorRender;
    }
  });
  
  return result;
}
```

[Back to top](#reporting-api)


---


## TestRenderer

* import { TestRenderer } from "ergotest/test_renderer.js"

`TestRenderer` is a utility class for converting test results into strings. For most people, the `renderXxx()` convenience methods on [TestSuiteResult](#testsuiteresult) and [TestCaseResult](#testcaseresult) are good enough. But if you want to have fine-grained control over your test output, use this class. For details, see [Customizing result rendering](#customizing-result-rendering) above.

[Back to top](#reporting-api)


## TestRenderer.create()

* TestRenderer.create(): TestRenderer

Create a `TestRenderer` instance.

[Back to top](#reporting-api)


## testRenderer.renderSummary()

* testRenderer.renderSummary(testSuiteResult: [TestSuiteResult](#testsuiteresult), elapsedMs?: number): string

> **Warning:** Visual changes to the output of this method are not considered breaking changes.

Convert a `testSuiteResult` into a single line containing the number of tests that passed, failed, etc.. If there were no tests for a particular status, that status is left out. The statuses are color-coded and rendered in the following order:

* *failed:* bright red
* *timed out:* purple
* *skipped:* cyan
* *passed:* green

If `elapsedMs` is defined, the summary will include the average amount of time required for each test in grey. This is a simple division operation; it’s up to you to determine the elapsed time correctly.

[Back to top](#reporting-api)


## testRenderer.renderAsCharacters()

* testRenderer.renderAsCharacters(testCaseResults: [TestCaseResult](#testcaseresult) | [TestCaseResult](#testcaseresult)[]): string

> **Warning:** Visual changes to the output of this method are not considered breaking changes.

Render the results as consecutive color-coded characters representing the tests’ statuses, as follows:

* *pass:* normal-colored `.`
* *fail:* red inverse `X`
* *skip:* light cyan `_`
* *timeout:* purple inverse `!`

[Back to top](#reporting-api)


## testRenderer.renderAsSingleLines()

* testRenderer.renderAsSingleLines(testCaseResults: [TestCaseResult](#testcaseresult) | [TestCaseResult](#testcaseresult)[]): string

> **Warning:** Visual changes to the output of this method are not considered breaking changes.

Render the results as a series of color-coded lines, each containing the test's status and name. If a test has unusual [beforeEach()](#testcaseresultbeforeeach) or [afterEach()](#testcaseresultaftereach) results (for example, if one of them failed), each _beforeEach()_ and _afterEach()_ result will also be rendered as an indented separate line.

Under the covers, this calls [testRenderer.renderStatusAsSingleWord()](#testrendererrenderstatusassingleword) and [testRenderer.renderNameOnOneLine()](#testrendererrendernameononeline). 

[Back to top](#reporting-api)


## testRenderer.renderAsMultipleLines()

* testRenderer.renderAsMultipleLines(testCaseResults: [TestCaseResult](#testcaseresult) | [TestCaseResult](#testcaseresult)[]): string

> **Warning:** Visual changes to the output of this method are not considered breaking changes.

Render the results with detailed explanations of each result, each separated by two blank lines. If a test has unusual [beforeEach()](#testcaseresultbeforeeach) or [afterEach()](#testcaseresultaftereach) results (for example, if one of them failed), each _beforeEach()_ and _afterEach()_ result will also be rendered in its full detail.  

Under the covers, this calls [testRenderer.renderNameOnMultipleLines()](#testrendererrendernameonmultiplelines) and [testRenderer.renderStatusWithMultiLineDetails()](#testrendererrenderstatuswithmultilinedetails).

[Back to top](#reporting-api)


## testRenderer.renderMarksAsLines()

* testRenderer.renderMarksAsLines(testResults: [TestResult](#testresult) | [TestResult](#testresult)[]): string

> **Warning:** Visual changes to the output of this method are not considered breaking changes.

Render _testResults_ as a series of consecutive lines containing the test mark and name. Under the covers, this calls [testRenderer.renderMarkAsSingleWord()](#testrendererrendermarkassingleword) and [testRenderer.renderNameOnOneLine()](#testrendererrendernameononeline).


[Back to top](#reporting-api)


## testRenderer.renderNameOnOneLine()

* testRenderer.renderNameOnOneLine(name: string[], filename?: string): string

> **Warning:** Visual changes to the output of this method are not considered breaking changes.

If _filename_ is defined, that’s rendered first in bold bright white. Next comes the names of the outermost suites down to the name of the the result, from left to right, separated by chevrons (` » `). 

[Back to top](#reporting-api)


## testRenderer.renderNameOnMultipleLines()

* testRenderer.renderNameOnMultipleLines(name: string[], filename?: string): string

> **Warning:** Visual changes to the output of this method are not considered breaking changes.

If _filename_ is defined, that’s rendered first. Next comes the elements of the _name_ array separated by chevrons (` » `). The final name (typically the test result) is rendered on the following line.

The first name (typically the filename) and the last name (typically the test name) are rendered in bold bright white.

[Back to top](#reporting-api)


## testRenderer.renderMarkAsSingleWord()

* testRenderer.renderMarkAsSingleWord(mark: [TestMarkValue](automation_api.md#testmarkvalue)): string

> **Warning:** Visual changes to the output of this method are not considered breaking changes.

Renders _mark_ as a color-coded string, as follows:

* *no mark:* `(no mark)` in default color
* *.only:* `.only` in bright cyan
* *.skip:* `.skip` in bright cyan
* *no body:* same as .skip

[Back to top](#reporting-api)


## testRenderer.renderStatusAsSingleWord()

* testRenderer.renderMarkAsSingleWord(status: [TestStatusValue](automation_api.md#teststatusvalue)): string

> **Warning:** Visual changes to the output of this method are not considered breaking changes.

Renders the status of the test as a color-coded string, as follows:

* *pass:* `passed` in green
* *fail:* `failed` in bright red
* *skip:* `skipped` in bright cyan
* *timeout:* `timeout` in bright purple 

[Back to top](#reporting-api)


## testRenderer.renderStatusWithMultilineDetails()

* testRenderer.renderMarkWithMultilineDetails(testCaseResult: [TestCaseResult](#testcaseresult)): string

> **Warning:** Visual changes to the output of this method are not considered breaking changes.

Renders the status of the test with all its details, as follows:

* *pass:* `passed` in green
* *fail:* The contents of [testCaseResult.errorRender](automation_api.md#runresulterrorrender) (typically [renderError()](#rendererror))
* *skip:* `skipped` in bright cyan
* *timeout:* `Timed out after ###ms` in purple

[Back to top](#reporting-api)


---


## renderError()

* import { renderError } from "ergotest/test_renderer.js"
* renderError(name: string[], error: unknown, filename?: string): unknown

> **Warning:** Visual changes to the output of this method are not considered breaking changes.

Renders an error into a color-coded, human-readable explanation.  
 
If _error.stack_ is defined, it renders the stack trace by calling [renderStack()](#renderstack). Then, if _error.message_ is defined, it adds a blank line, renders the name of the test in bright white—without suite names—followed by the error message in red on a separate line. 

If _error.stack_ isn’t defined, it just converts _error_ to a string and renders it in red.

Finally, if _error_ is an _AssertionError_, it adds a blank line and renders the expected and actual results by calling [renderDiff()](#renderdiff).

[Back to top](#reporting-api)


## renderStack()

* import { renderStack } from "ergotest/test_renderer.js"
* renderStack(error: Error, filename?: string): string

> **Warning:** Visual changes to the output of this method are not considered breaking changes.

Renders an error by calling `util.inspect()` with infinite depth. If the error is an _AssertionError_, only the stack is rendered; otherwise, the entire error is rendered.

If _filename_ is provided, highlights any items in the stack trace that reference the test’s filename by adding an arrow (`-->`) and coloring them bold bright white.

[Back to top](#reporting-api)


## renderDiff()

* import { renderDiff } from "ergotest/test_renderer.js"
* renderDiff(error: AssertionError): string

> **Warning:** Visual changes to the output of this method are not considered breaking changes.

Renders the `expected` and `actual` values of `error` as consecutive lines, with highlighting to make comparing the results easier. If `error` doesn’t have `expected` and `actual` values, returns an empty string.

Renders `expected:` first in green, followed by the expected value in the default color. It’s converted to a string by calling `util.inspect()` with infinite depth.

Then it renders `actual:  ` in red on the following line, with padding after the colon to make the results line up, followed by the actual value in the default color. This is also converted to a string by calling `util.inspect()`.

If the rendered values are more than one line, the strings are compared line by line. Any lines that are different are highlighted by coloring them bold bright yellow.

In the future, I’d like to implement a more sophisticated mechanism for highlighting differences, but this works surprisingly well for such a cheap trick.

[Back to top](#reporting-api)
