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
  * [Using Ergotest's built-in rendering functions](#using-ergotests-built-in-rendering-functions)
  * [Customizing Ergotest’s built-in rendering functions](#customizing-ergotests-built-in-rendering-functions)
  * [Customizing error rendering](#customizing-error-rendering)
  * [Writing your own renderer](#writing-your-own-renderer)
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

**This document is for advanced users** who want to customize their test output. For basic usage, see the [automation API](automation_api.md) documentation instead.

Reporting is split into two parts in Ergotest:

* _Result rendering_, which converts test results into strings. Your build calls these functions. 
* _Error rendering_, which converts errors into strings and sets the [testCaseResult.errorRender](automation_api.md#runresulterrorrender) property. Ergotest calls this function automatically when tests fail.

You can use Ergotest's built-in rendering functions as-is, override part of their behavior, or write your own rendering functions. 


### Using Ergotest's built-in rendering functions

The [Automation API](automation_api.md#start-here) includes convenience methods, such as [testSuiteResult.render()](automation_api.md#testsuiteresultrender), that render the results of a test suite. If you don't like its default rendering, you can use the automation API and the rendering API to customize the results without a lot of extra work.

For example, [testSuiteResult.render()](automation_api.md#testsuiteresultrender) displays a summary list of marked suites and tests, a detailed list of test failures and timeouts, and a summary of the test results. If you only wanted to display detailed results for test failures, and summary results for timeouts, you could use the automation API and rendering API as follows:

```typescript
import { TestRunner, TestRenderer } from "ergotest";

// ... (running the tests is the same as the automation API example)

const result = await testRunner.runInChildProcessAsync(files, { onTestCaseResult });

// Use the automation API to get the different types of tests
const failedTests = result.allMatchingTests(TestStatus.fail);
const timedOutTests = results.allMatchingTests(TestStatus.timeout); 

// Create the renderer
const renderer = TestRenderer.create();

// Check for existence of timed-out tests so we don't write blank lines
if (timedOutTests.length > 0) {
  // Display one line for each timed-out test
  console.log("\n" + renderer.renderAsSingleLines(timedOutTests));
}

// Check for existence of failed tests so we don't write blank lines 
if (failedTests.length > 0) {
  // Display the failed tests in detail
  console.log("\n" + renderer.renderAsMultipleLines(failedTests));
}
```

Each rendering API returns a color-coded string. Some rendering functions include newlines within the string, but they never start or end with a newline, so you have to add separators yourself.


### Customizing Ergotest’s built-in rendering functions

If you like the output of the rendering API, but want to customize specific behavior, subclass [TestRenderer](#testrenderer) and override its helper methods.  The API documentation describes the helper methods in detail, including when they're called, so you can know which ones to override.

For example, [testRenderer.renderAsSingleLines()](#testrendererrenderassinglelines) displays the result of a test on a single line, like this (except color-coded and highlighted):

```typescript
pass my_file.js » my suite » does a thing
```

It also has some complicated logic to handle the case when [beforeEach()](test_api.md#beforeeach) or [afterEach()](test_api.md#aftereach) fail:

```typescript
failed my_file.js » my suite » does a thing
  -->  pass the test itself
  -->  pass my_file.js » my suite » beforeEach()
  -->  failed my_file.js » my suite » afterEach()
```

If you didn't want to reimplement all that logic, but you wanted to use emojis for the status, you could subclass [TestRenderer](#testrenderer) and override [testRenderer.renderStatusAsSingleWord()](#testrendererrenderstatusassingleword), like this:

```typescript
import { TestRunner, TestRenderer } from "ergotest";

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

// Create the custom renderer
const renderer = EmojiRenderer.create();

// This function will be called every time a test finishes running
function onTestCaseResult(testCase) {
  // Output the test result using the new renderer
  console.log(renderer.renderAsSingleLines(testCase));
}

// ... (running the tests is the same as the automation API example)
```

This will result in the same output as before, but with the status rendering changed:

```typescript
❌ my_file.js » my suite » does a thing
  -->  ✅ the test itself
  -->  ✅ my_file.js » my suite » beforeEach()
  -->  ❌ my_file.js » my suite » afterEach()
```

See the [TestRenderer](#testrenderer) documentation for details about how each method works and what other methods they call.


### Customizing error rendering

Error rendering is special. Errors are rendered to strings as soon as they fail, rather than afterward like the rest of the rendering API, because Ergotest runs tests in a worker process by default. Errors have to be rendered inside the worker process to avoid data loss.

To customize how errors are rendered, create a module that exports a `renderError()` function. It needs to have a signature matching the [RenderErrorFn](automation_api.md#rendererrorfn) type:

renderError(names: string[], error: unknown, mark: TestMarkValue, filename?: string): unknown;
* _names:_ Same as [testCaseResult.name](automation_api.md#testcaseresultname).
* _error:_ The error that caused the test to fail. Although it's usually an _Error_ instance, it could be any data type, including a string.
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

Ergotest will import your custom module and call _renderError()_ every time a test fails. It stores the result of that call in [TestCaseResult.errorRender](automation_api.md#runresulterrorrender). Ergotest's built-in rendering functions, such as [testSuiteResult.render()](automation_api.md#testsuiteresultrender) and [TestRenderer](#testrenderer), will use the result automatically.


### Writing your own renderer

For maximum control, you can ignore [TestRenderer](#testrenderer) and write your own renderer using the properties on [TestSuiteResult](#testsuiteresult) and [TestCaseResult](#testcaseresult).  

Here's an example of a renderer that outputs [TAP (Test Anything Protocol)](https://testanything.org/):

> **Warning:** This is just an example. It's not meant to be an accurate or complete implementation of TAP. In particular, it doesn't handle the edge cases that occur when _beforeEach()_ or _afterEach()_ fail.

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

// Called by Ergotest when a test fails
// The output of this function is stored in testCaseResult.errorRender
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

// Called by the last line of the build file above
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

`TestRenderer` is a utility class for converting test results into strings. For most people, the _renderXxx()_ convenience methods on [TestSuiteResult](#testsuiteresult) and [TestCaseResult](#testcaseresult) are good enough. But if you want to have fine-grained control over your test output, use this class. For details, see [Start Here](#start-here) above.

[Back to top](#reporting-api)


## TestRenderer.create()

* TestRenderer.create(): TestRenderer

Create a _TestRenderer_ instance.

[Back to top](#reporting-api)


## testRenderer.renderSummary()

* testRenderer.renderSummary(testSuiteResult: [TestSuiteResult](#testsuiteresult), elapsedMs?: number): string

> **Warning:** Visual changes to the output of this method are not considered breaking changes.

Convert a [testSuiteResult](automation_api.md#testsuiteresult) into a single line containing the number of tests that passed, failed, etc.. If there were no tests for a particular status, that status is left out. The statuses are color-coded and rendered in the following order:

* *failed:* bright red
* *timed out:* purple
* *skipped:* cyan
* *passed:* green

If _elapsedMs_ is defined, the summary will include the average amount of time required for each test in grey. This is a simple division operation; it’s up to you to determine the elapsed time correctly.

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

Render the results as a series of color-coded lines, each containing the test's status and name.

If a test has unusual [beforeEach()](#testcaseresultbeforeeach) or [afterEach()](#testcaseresultaftereach) results (for example, if one of them failed), each sub-result will be rendered on an additional line, indented under the top-level test result with an arrow (`  -->  `).

Under the covers, this calls [testRenderer.renderStatusAsSingleWord()](#testrendererrenderstatusassingleword) and [testRenderer.renderNameOnOneLine()](#testrendererrendernameononeline). 

[Back to top](#reporting-api)


## testRenderer.renderAsMultipleLines()

* testRenderer.renderAsMultipleLines(testCaseResults: [TestCaseResult](#testcaseresult) | [TestCaseResult](#testcaseresult)[]): string

> **Warning:** Visual changes to the output of this method are not considered breaking changes.

Render the results with detailed explanations of each result, each separated by two blank lines.

If a test has unusual [beforeEach()](#testcaseresultbeforeeach) or [afterEach()](#testcaseresultaftereach) results (for example, if one of them failed), each sub-result will be rendered in its full detail, with the test name indented with three chevrons (`»»» `). After the final sub-result, an additional line with inverse chevrons will be rendered (`«««`).

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

If _filename_ is defined, that’s rendered first. Next comes the names of the outermost suites down to the name of the the result, from left to right, separated by chevrons.

```
my_file.ts » my suite » my test
```

The filename, if it exists, is rendered in bold bright white.


[Back to top](#reporting-api)


## testRenderer.renderNameOnMultipleLines()

* testRenderer.renderNameOnMultipleLines(name: string[], filename?: string): string

> **Warning:** Visual changes to the output of this method are not considered breaking changes.

If _filename_ is defined, that’s rendered first. Next comes the elements of the _name_ array separated by chevrons (` » `). The final name (typically the test result) is rendered on the following line with a chevron in front.

```
my_file.ts » my suite
» my test
```

The first element (typically the filename) and the last element (typically the test name) are rendered in bold bright white.

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
* *fail:* The contents of [testCaseResult.errorRender](automation_api.md#runresulterrorrender) (typically generated by [renderError()](#rendererror))
* *skip:* `skipped` in bright cyan
* *timeout:* `Timed out after ###ms` in purple

Despite the name of this method, only the _fail_ case results in multiple lines being rendered.

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

If _filename_ is provided, any lines in the stack trace that reference the test’s filename are highlighted by adding an arrow (`-->`) and coloring them bold bright yellow.

[Back to top](#reporting-api)


## renderDiff()

* import { renderDiff } from "ergotest/test_renderer.js"
* renderDiff(error: AssertionError): string

> **Warning:** Visual changes to the output of this method are not considered breaking changes.

Renders the _error.expected_ and _error.actual_ as consecutive lines, with highlighting to make comparing the results easier. If they're undefined, returns an empty string.

The expected value starts with the string `expected: ` in green, followed by _error.expected_ in the default color. It’s converted to a string by calling `util.inspect()` with infinite depth. 

The actual value starts with the string `actual:  ` in red, with padding after the colon to make the results line up, followed by _error.actual_ in the default color. This is also converted to a string by calling `util.inspect()`.

If the rendered values are more than one line, the strings are compared line by line. Any lines that are different are highlighted by coloring them bold bright yellow.

In the future, I’d like to implement a more sophisticated mechanism for highlighting differences, but this works surprisingly well for such a cheap trick.

[Back to top](#reporting-api)
