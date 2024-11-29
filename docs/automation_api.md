# Automation API

Use the automation API to run your tests and display their results.


Links to other documentation:

* [Test API](test_api.md)
* [Assertion API](assertion_api.md)
* **Automation API**
* [Readme](../README.md)
* [Changelog](../CHANGELOG.md)
* [Roadmap](../ROADMAP.md)

In this document **(the bold entries are all you need)**:

* **[Start Here](#start-here)**
* [TestRunner](#testrunner)
  * **[TestRunner.create()](#testrunnercreate)**
  * **[testRunner.runInChildProcessAsync()](#testrunnerruninchildprocessasync)**
  * [testRunner.runInCurrentProcessAsync()](#testrunnerrunincurrentprocessasync)
  * [TestOptions](#testoptions) 
* [TestSuiteResult](#testsuiteresult)
  * [testSuiteResult.filename](#testsuiteresultfilename)
  * [testSuiteResult.name](#testsuiteresultname)
  * [testSuiteResult.mark](#testsuiteresultmark)
  * [testSuiteResult.children](#testsuiteresultchildren)
  * **[testSuiteResult.render()](#testsuiteresultrender)**
  * **[testSuiteResult.count()](#testsuiteresultcount)**
  * [testSuiteResult.allTests()](#testsuiteresultalltests)
  * [testSuiteResult.allMatchingTests()](#testsuiteresultallmatchingtests)
  * [testSuiteResult.allMarkedResults()](#testsuiteresultallmarkedresults)
  * [testSuiteResult.allMatchingMarks()](#testsuiteresultallmatchingmarks)
  * [testSuiteResult.allPassingFiles()](#testsuiteresultallpassingfiles)
  * [testSuiteResult.equals()](#testsuiteresultequals)
* [TestCaseResult](#testcaseresult)
  * [testCaseResult.filename](#testcaseresultfilename)
  * [testCaseResult.name](#testcaseresultname)
  * [testCaseResult.status](#testcaseresultstatus)
  * [testCaseResult.mark](#testcaseresultmark)
  * [testCaseResult.error](#testcaseresulterror)
  * [testCaseResult.timeout](#testcaseresulttimeout)
  * **[testCaseResult.renderAsCharacter()](#testcaseresultrenderascharacter)**
  * **[testCaseResult.renderAsSingleLine()](#testcaseresultrenderassingleline)**
  * **[testCaseResult.renderAsMultipleLines()](#testcaseresultrenderasmultiplelines)**
  * [testCaseResult.isPass()](#testcaseresultispass)
  * [testCaseResult.isFail()](#testcaseresultisfail)
  * [testCaseResult.isSkip()](#testcaseresultisskip)
  * [testCaseResult.isTimeout()](#testcaseresultistimeout)
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
  * [testRenderer.renderStack()](#testrendererrenderstack)
  * [testRenderer.renderDiff()](#testrendererrenderdiff)
* [TestResult](#testresult)
  * [TestResult.suite()](#testresultsuite)
  * [TestResult.pass()](#testresultpass)
  * [TestResult.fail()](#testresultfail)
  * [TestResult.skip()](#testresultskip)
  * [TestResult.timeout()](#testresulttimeout)
  * [TestStatus](#teststatus)
  * [TestStatusValue](#teststatusvalue)
  * [TestMark](#testmark)
  * [TestMarkValue](#testmarkvalue)
* [TestSuite](#testsuite)
  * [TestSuite.fromModulesAsync()](#testsuitefrommodulesasync)
  * [testSuite.runAsync()](#testsuiterunasync)
  

## Start Here

> **The Golden Rule:** Instantiate all classes by calling the `TheClass.create()` factory method, *not* the `new TheClass()` constructor! Constructors are reserved for internal use only in this codebase.

There are six classes in Ergotest. The first three are all you really need to know about, and the bolded methods in the table of contents above are the only ones you’re likely to use. 

* ***TestRunner*** is how you run your tests.
* ***TestSuiteResult*** has the results of your test run, and includes a convenient method for rendering the results.
* ***TestCaseResult*** has the details of a single test, and it also has convenient rendering methods.
* *TestRenderer* is how you create customized renderings, if you want to.
* *TestResult* has factory methods for creating test results, and is the parent to `TestSuiteResult` and `TestCaseResult`.
* *TestSuite* is mainly for internal use, and is included only for completeness. To create test suites, use [the test API](test_api.md).

The best way to run your tests is to use [testRunner.runInChildProcessAsync()](#testrunnerruninchildprocessasync). It takes a list of test module paths which it runs in an isolated child process.

The `runInChildProcessAsync()` method returns the results of the test run as a `TestSuiteResult` instance. You can render those results to a string by calling [TestSuiteResult.render()](#testsuiteresultrender). To learn the overall results of the test run, call [testSuiteResult.count()](#testsuiteresultcount)

If you want more fine-grained control, you can use the methods and properties on `TestSuiteResult` and `TestCaseResult`. Create a `TestRenderer` instance for more rendering options.

To see the results of the tests as they’re running, pass `onTestCaseResult` to [testRunner.runInChildProcessAsync()](#testrunnerruninchildprocessasync). It will be called with a `TestCaseResult`, which you can then render with the [testCaseResult.renderAsCharacter()](#testcaseresultrenderascharacter), [testCaseResult.renderAsSingleLine()](#testcaseresultrenderassingleline), or [testCaseResult.renderAsMultipleLines()](#testcaseresultrenderasmultiplelines) methods.

Bringing it all together, here's an annotated version of a simple command-line interface for running tests:

```javascript
import { TestRunner } from "ergotest/test_runner.js";
import path from "node:path";

// Get the command-line arguments
const args = process.argv.slice(2);

// Convert the command-line arguments to absolute paths.
// (TestRunner requires absolute paths.)
const files = args.map(arg => path.resolve(process.cwd(), arg));

// Instantiate TestRunner
const testRunner = TestRunner.create();

// Let the user know what's happening
process.stdout.write("Running tests: ");

// Run the tests, calling the reportProgress() function after each test completes
const result = await testRunner.runInChildProcessAsync(files, { 
  onTestCaseResult: reportProgress, 
});

// Display the test results, with some blank lines to make it look nice
console.log("\n" + result.render("\n") + "\n");

// Get a summary of the test results
const count = result.count();

// Check to see if the tests passed or failed
if (count.fail + count.timeout > 0) {
  console.log("Tests failed :-(\n");
}
else if (count.total - count.skip === 0) {
  console.log("No tests ran :-O\n");
}
else {
  console.log("Tests passed :-)\n");
}

// This function is called every time a test finishes running
function reportProgress(testCase) {
  // Write the test result as a dot, X, etc.
  process.stdout.write(testCase.renderAsCharacter());
}
```


---


## TestRunner

* import { TestRunner } from "ergotest/test_runner.js"

Use the `TestRunner` class to run your tests.

[Back to top](#automation-api)


## TestRunner.create()

* TestRunner.create(): TestRunner

Instantiate `TestRunner`.

[Back to top](#automation-api)


## testRunner.runInChildProcessAsync()

* testRunner.runInChildProcessAsync(modulePaths: string[], options?: [TestOptions](#testoptions)): Promise\<[TestSuiteResult](#testsuiteresult)\>

Spawn an isolated child process, import the modules in `modulePaths` inside that process, and run them as a single test suite. Requires each module to export a `TestSuite`. (See the [test API](test_api.md) for details.) The `modulePaths` must be absolute paths.

The modules will be loaded fresh every time this method is called, allowing you to run your tests as part of a watch script.

If the tests enter an infinite loop or throw an uncaught exception, a test watchdog will kill the tests and generate a corresponding test failure.

Generates test failures if any of the `modulePaths` fail to load, or if they don’t export a test suite, but continues to run any modules that do load.

> **Warning:** Your test modules and test runner must use the same installation of `ergotest`, or you’ll get an error saying the test modules don’t export a test suite.

Use `options` to provide configuration data to the tests or specify a callback for reporting test progress.

> **Warning:** Because the tests run in a child process, any configuration information you provide will be serialized. Only bare objects, arrays, and primitive data can be provided; class instances will not work.

[Back to top](#automation-api)


## testRunner.runInCurrentProcessAsync()

* testRunner.runInCurrentProcessAsync(modulePaths: string[], options?: [TestOptions](#testoptions)): Promise\<[TestSuiteResult](#testsuiteresult)\>

> **Warning:** It's typically better to call [testRunner.runInChildProcessAsync()](#testrunnerruninchildprocessasync).

Import the modules in `modulePaths` in the current process and run them as a single test suite. Requires each module to export a `TestSuite`. (See the [test API](test_api.md) for details.) The `modulePaths` must be absolute paths.

The modules will *not* be reloaded if they have been loaded before, even if they have changed. As a result, this method is only suitable for automation that exits back to the command line after running the tests.

Does *not* detect infinite loops or uncaught exceptions.

Generates test failures if any of the `modulePaths` fail to load, or if they don’t export a test suite, but continues to run any modules that do load.

> **Warning:** Your test modules and test runner must use the same installation of `ergotest`, or you’ll get an error saying the test modules don’t export a test suite.

Use `options` to provide configuration data to the tests or specify a callback for reporting test progress.

[Back to top](#automation-api)


## TestOptions

* import { TestOptions } from "ergotest/test_suite.js"

You can configure test runs with this interface. Provide an object with these optional parameters:

* **config: Record<string, unknown> = {}**
  * Configuration information accesible to your tests at run time. Retrieve the values in your tests by calling [getConfig()](test_api.md#getconfig) as described in the test API.
  * An object with key/value pairs. The values should be bare objects, arrays, or primitive data, not class instances, because the configuration will be serialized if you run the tests in a child process, which is the recommended approach.
  * Defaults to an empty object.

* **timeout: number = 2000**
  * The amount of time, in milliseconds, before a test times out. Note that, due to the nature of JavaScript, tests continue running even after they've timed out. However, their results are ignored.
  * Defaults to two seconds.

* **onTestCaseResult: (testCaseResult: TestCaseResult) => void**
  * Every time a test completes, this function is called with the result. It’s only called when a test completes, not when a test suite completes.
  * Defaults to a no-op.

[Back to top](#automation-api)


---


## TestSuiteResult

* import { TestSuiteResult } from "ergotest/test_result.js"
* extends [TestResult](#testresult)

`TestSuiteResult` instances represent the results of running a test suite. You’ll typically get one by calling [TestRunner.runInChildProcessAsync()](#testrunnerruninchildprocessasync). It’s a nested tree of [TestSuiteResult](#testsuiteresult)s (which is the result of `test()` and `describe()` blocks) and [TestCaseResult](#testcaseresult)s (which is the result of `it()` blocks). See the [test API documentation](test_api.md) for more about writing tests with `test()`, `describe()`, and `it()`. 

[Back to top](#automation-api)


## testSuiteResult.filename

* testSuiteResult.filename?: string

If this test suite was loaded from a module (and they typically will be), this property contains the absolute path of the module. Otherwise, it’s undefined. 

[Back to top](#automation-api)


## testSuiteResult.name

* testSuiteResult.name: string[]

The name of the suite and all its parent suites, with the outermost suite first. Suites with no name aren’t included, so if none of the suites had a name, this array will be empty.

[Back to top](#automation-api)


## testSuiteResult.mark

* testSuiteResult.mark: [TestMarkValue](#testmarkvalue)

Indicates whether the suite was marked with `.skip`, `.only` (or not marked at all). Only suites that called `.skip` or `.only` are considered to be marked; this value isn’t inherited. As a result, the tests in a suite can be skipped but without the suite being *marked* `.skip`.

Suites with no function body are considered to be marked `.skip`.


[Back to top](#automation-api)


## testSuiteResult.children

* testSuiteResult.children: [TestResult](#testresult)[]

This suite’s direct children, which can either be [TestSuiteResult](#testsuiteresult) or [TestCaseResult](#testcaseresult) instances. It’s possible for a suite to have no children.

[Back to top](#automation-api)


## testSuiteResult.render()

[Back to top](#automation-api)

* testSuiteResult.render(preamble?: string = "", elapsedMs?: number): string

Render this suite as a nicely formatted string. The rendering consists of three parts:

* A summary list of marked suites and tests, for ease of finding `.only` and `.skip` marks
* A detailed list of test failures and timeouts
* A summary of the test results

This is a convenience method. For more control over rendering, use [TestRenderer](#testrenderer) instead.

If `preamble` is defined, it will be added to the beginning of the rendered string, but only if there’s more to show than the summary of results. This is convenient for adding blank lines when there’s details to show, but keeping the rendering compact when there’s not.

If `elapsedMs` is defined, the summary will include the average amount of time required for each test. This is a simple division operation; it’s up to you to determine the elapsed time correctly. 


## testSuiteResult.count()

* testSuiteResult.count(): { pass: number, fail: number, skip: number, timeout: number, total: number }

A summary of this suite’s results. Includes a count of each type of test case result and the total number. Only counts  [TestCaseResult](#testcaseresult)s, not [TestSuiteResult](#testsuiteresult)s.

[Back to top](#automation-api)


## testSuiteResult.allTests()

* testSuiteResult.allTests(): [TestCaseResult](#testcaseresult)[]

Find all the test results in this suite and all it’s sub-suites and flatten them into a single array. Only includes [TestCaseResult](#testcaseresult)s, not [TestSuiteResult](#testsuiteresult)s.

If you only want test results with a particular status (pass, fail, etc.), use [testSuiteResult.allMatchingTests()](#testsuiteresultallmatchingtests) instead.

[Back to top](#automation-api)


## testSuiteResult.allMatchingTests()

* testSuiteResult.allMatchingTests(...statuses: [TestStatusValue](#teststatusvalue)[]): [TestCaseResult](#testcaseresult)[]

Find all the test results, in this suite and all its sub-suites, that match any of the `statuses` and flatten them into a single array. Only includes [TestCaseResult](#testcaseresult)s, not [TestSuiteResult](#testsuiteresult)s.

If you want all test results from this suite and its sub-suites, use [testSuiteResult.allTests](#testsuiteresultalltests) instead.

[Back to top](#automation-api)


## testSuiteResult.allMarkedResults()

* testSuiteResult.allMarkedResults(): [TestResult](#testresult)[]

Find all the test case *and* test suite results, in this suite and all its sub-suites, that were marked with `.only`, or `.skip`, and flatten them into a single array. Suites and tests without a body are considered to have been marked with `.skip`.

Only includes marked results. To get results without marks, or specific marks (only `.skip` marks, for example), use [testSuiteResult.allMatchingMarks()](#testsuiteresultallmatchingmarks) instead. 

[Back to top](#automation-api)


## testSuiteResult.allMatchingMarks()

* testSuiteResult.allMatchingMarks(...marks: [TestMarkValue](#testmarkvalue)[]): [TestResult](#testresult)[]

Find all the test case *and* test suite results, in this suite and all its sub-suites, that match any of the `marks`, and flatten them into a single array. Suites and tests without a body are considered to have been marked with `.skip`.

If you want all the test results that were marked, use [testSuiteResult.allMarkedResults()](#testsuiteresultallmarkedresults) instead. 

[Back to top](#automation-api)


## testSuiteResult.allPassingFiles()

* testSuiteResult.allPassingFiles(): string[]

Find all the files, in this suite and all its sub-suites, that only had passing tests. Files with failed, timed out, or skipped tests are not included.

This is useful for incremental builds. It allows you to ignore test files that have passed while re-testing files that had failures, timeouts, or skips.

[Back to top](#automation-api)


## testSuiteResult.equals()

* testSuiteResult.equals(that: [TestResult](#testresult)): boolean

Determine if this suite’s result is equal to another test result. To be equal, they must have exactly the same results, including sub-suites, in the same order, with the same names, filenames, and marks.

[Back to top](#automation-api)


---


## TestCaseResult

* import { TestCaseResult } from "ergotest/test_result.js"
* extends [TestResult](#testresult)

`TestCaseResult` instances represent the result of running a single test. You’ll get them from [TestSuiteResult](#testsuiteresult), typically by calling [TestSuiteResult.allTests()](#testsuiteresultalltests) or [TestSuiteResult.allMatchingTests()](#testsuiteresultallmatchingtests).

[Back to top](#automation-api)


## testCaseResult.filename

* testCaseResult.filename?: string

If this test was loaded from a module (and it typically will be), this property contains the absolute path of the module. Otherwise, it’s undefined. 

[Back to top](#automation-api)


## testCaseResult.name

* testCaseResult.name: string[]

The name of the test and all its parent suites, with the outermost suite first. Suites with no name aren’t included.

All normal tests have a name, so there should be at least one name element, but it is technically possible to create a test case result with a name that’s an empty array. 

[Back to top](#automation-api)


## testCaseResult.mark

* testCaseResult.mark: [TestMarkValue](#testmarkvalue)

Indicates whether the test was marked with `.skip` or `.only` (or not marked at all). Only tests that called `.skip` or `.only` are considered to be marked; this value isn’t inherited. As a result, tests can be skipped but not be *marked* `.skip`.

Tests with no function body are considered to be marked `.skip`.


## testCaseResult.status

* testCaseResult.status: [TestStatus](#teststatus)

Whether this test passed, failed, etc. 

See also [testCaseResult.isPass()](#testcaseresultispass), [testCaseResult.isFail](#testcaseresultisfail), [testCaseResult.isSkip](#testcaseresultisskip), and [testCaseResult.isTimeout()](#testcaseresultistimeout) .

[Back to top](#automation-api)


## testCaseResult.error

* testCaseResult.error?: unknown

If this test failed, contains the error that was thrown. Otherwise, it’s undefined.

[Back to top](#automation-api)


## testCaseResult.timeout

* testCaseResult.timeout?: number

If this test timed out, contains the timeout value in milliseconds. Otherwise, it’s undefined.

Please note that this value is the timeout value the test was expected to meet, *not* the actual run time of the test. Due to the nature of JavaScript, the actual run time could be shorter or longer than the timeout value.

[Back to top](#automation-api)


## testCaseResult.renderAsCharacter()

* testCaseResult.renderAsCharacter(): string

Render this test as a single color-coded character representing its status:

* *pass:* normal-colored `.`
* *fail:* red inverse `X`
* *skip:* light cyan `_`
* *timeout:* purple inverse `!`

This is a convenience method. For more control over rendering, use [TestRenderer](#testrenderer) instead.


[Back to top](#automation-api)


## testCaseResult.renderAsSingleLine()

* testCaseResult.renderAsSingleLine(): string

Render this test as a single color-coded line containing its status and name.

This is a convenience method. For more control over rendering, use [TestRenderer](#testrenderer) instead.

[Back to top](#automation-api)


## testCaseResult.renderAsMultipleLines()

* testCaseResult.renderAsMultipleLines(): string

Render this test with all its color-coded detail. The rendering includes:

* The filename, suites, and name of the test on two lines
* The status of the test, if it didn’t fail
* The error, stack trace, and expected/actual results, if it did fail

This is a convenience method. For more control over rendering, use [TestRenderer](#testrenderer) instead.

[Back to top](#automation-api)


## testCaseResult.isPass()

* testCaseResult.isPass(): boolean

Returns true if this test passed; false otherwise.

See also [testCaseResult.status](#testcaseresultstatus).

[Back to top](#automation-api)


## testCaseResult.isFail()

* testCaseResult.isFail(): boolean

Returns true if this test failed; false otherwise.

See also [testCaseResult.status](#testcaseresultstatus).

[Back to top](#automation-api)


## testCaseResult.isSkip()

* testCaseResult.isSkip(): boolean

Returns true if this test was skipped; false otherwise.

See also [testCaseResult.status](#testcaseresultstatus).

[Back to top](#automation-api)


## testCaseResult.isTimeout()

* testCaseResult.isTimeout(): boolean

Returns true if this test timed out; false otherwise.

See also [testCaseResult.status](#testcaseresultstatus).

[Back to top](#automation-api)


---


## TestRenderer

* import { TestRenderer } from "ergotest/test_renderer.js"

`TestRenderer` is a utility class for converting test results into strings. For most people, the `renderXxx()` convenience methods on [TestSuiteResult](#testsuiteresult) and [TestCaseResult](#testcaseresult) are good enough. But if you want to have fine-grained control over your test output, use this class.

> *Note:* Although some rendered strings include line feeds, for added flexibility, none of them have a line feed at the end.

Of course, for the maximum control possible, you can ignore `TestRenderer` entirely and write your own rendering using the properties on [TestSuiteResult](#testsuiteresult) and [TestCaseResult](#testcaseresult).  

But for a happy middle ground between control and reuse, consider subclassing `TestRenderer` and overriding specific methods. For example, if you like how [testRenderer.renderAsSingleLines()](#testrendererrenderassinglelines) works, but you want it to display emojis for status, override [testRenderer.renderStatusAsSingleWord](#testrendererrenderstatusassingleword) Or you can override [testRenderer.renderDiff](#testrendererrenderdiff) to change the way [testRenderer.renderAsMultipleLines()](#testrendererrenderasmultiplelines) displays errors.

[Back to top](#automation-api)


## TestRenderer.create()

* TestRenderer.create(): TestRenderer

Create a `TestRenderer` instance.

[Back to top](#automation-api)


## testRenderer.renderSummary()

* testRenderer.renderSummary(testSuiteResult: [TestSuiteResult](#testsuiteresult), elapsedMs?: number): string

Convert a `testSuiteResult` into a single line containing the number of tests that passed, failed, etc.. If there were no tests for a particular status, that status is left out. The statuses are color-coded and rendered in the following order:

* *failed:* bright red
* *timed out:* purple
* *skipped:* cyan
* *passed:* green

If `elapsedMs` is defined, the summary will include the average amount of time required for each test in grey. This is a simple division operation; it’s up to you to determine the elapsed time correctly.

[Back to top](#automation-api)


## testRenderer.renderAsCharacters()

* testRenderer.renderAsCharacters(testCaseResults: [TestCaseResult](#testcaseresult) | [TestCaseResult](#testcaseresult)[]): string

Render `testCaseResults` as a series of color-coded characters representing the tests’ statuses, as follows:

* *pass:* normal-colored `.`
* *fail:* red inverse `X`
* *skip:* light cyan `_`
* *timeout:* purple inverse `!`

[Back to top](#automation-api)


## testRenderer.renderAsSingleLines()

* testRenderer.renderAsSingleLines(testCaseResults: [TestCaseResult](#testcaseresult) | [TestCaseResult](#testcaseresult)[]): string

Render `testCaseResults` as a series of consecutive lines containing the test status and name. Under the covers, this calls [testRenderer.renderStatusAsSingleWord()](#testrendererrenderstatusassingleword) and [testRenderer.renderNameOnOneLine()](#testrendererrendernameononeline). 

[Back to top](#automation-api)


## testRenderer.renderAsMultipleLines()

* testRenderer.renderAsMultipleLines(testCaseResults: [TestCaseResult](#testcaseresult) | [TestCaseResult](#testcaseresult)[]): string

Render `testCaseResults` as detailed explanations of each result, each separated by two blank lines. Under the covers, this calls [testRenderer.renderNameOnMultipleLines()](#testrendererrendernameonmultiplelines) and [testRenderer.renderStatusWithMultiLineDetails()](#testrendererrenderstatuswithmultilinedetails).

[Back to top](#automation-api)


## testRenderer.renderMarksAsLines()

* testRenderer.renderMarksAsLines(testResults: [TestResult](#testresult) | [TestResult](#testresult)[]): string

Render `testResults` as a series of consecutive lines containing the test mark and name. Under the covers, this calls [testRenderer.renderMarkAsSingleWord()](#testrendererrendermarkassingleword) and [testRenderer.renderNameOnOneLine()](#testrendererrendernameononeline).


[Back to top](#automation-api)


## testRenderer.renderNameOnOneLine()

* testRenderer.renderNameOnOneLine(testResult: [TestResult](#testresult)): string

If the test or suite has a filename, that’s rendered first in bold bright white. Next comes the names of the outermost suites down to the name of the the result, from left to right, separated by chevrons (` » `). 

[Back to top](#automation-api)


## testRenderer.renderNameOnMultipleLines()

* testRenderer.renderNameOnMultipleLines(testResult: [TestResult](#testresult)): string

If the test or suite has a filename, that’s rendered first. Next comes the name of the outermost suites down to the parent suite, from left to right, separated by chevrons (` » `). Finally, the name of test result is rendered on the following line.

The whole string is rendered in bold bright white.

[Back to top](#automation-api)


## testRenderer.renderMarkAsSingleWord()

* testRenderer.renderMarkAsSingleWord(testResult: [TestResult](#testresult)): string

Renders the mark of the test or suite as a color-coded string, as follows:

* *no mark:* `(no mark)` in default color
* *.only:* `.only` in bright cyan
* *.skip:* `.skip` in bright cyan
* *no body:* same as .skip

[Back to top](#automation-api)


## testRenderer.renderStatusAsSingleWord()

* testRenderer.renderMarkAsSingleWord(testCaseResult: [TestCaseResult](#testcaseresult)): string

Renders the status of the test as a color-coded string, as follows:

* *pass:* `passed` in green
* *fail:* `failed` in bright red
* *skip:* `skipped` in bright cyan
* *timeout:* `timeout` in bright purple 

[Back to top](#automation-api)


## testRenderer.renderStatusWithMultilineDetails()

* testRenderer.renderMarkWithMultilineDetails(testCaseResult: [TestCaseResult](#testcaseresult)): string

Renders the status of the test with all its details, as follows:

* *pass:* `passed` in green
* *skip:* `skipped` in bright cyan
* *timeout:* `Timed out after ###ms` in purple

Failed tests are more complicated.

* If `testCaseResult.error.stack` is defined, it renders the stack trace by calling [testRenderer.renderStack()](#testrendererrenderstack). Then, if `testCaseResult.error.message` is defined, it adds a blank line, renders the name of the test in bright white—without suite names—followed by the error message in red on a separate line. 
* If `testCaseResult.error.stack` isn’t defined, it just converts `testCaseResult.error` to a string and renders it in red.
* Finally, if `testCaseResult.error` is an `AssertionError`, it adds a blank line and renders the expected and actual results by calling [testRenderer.renderDiff()](#testrendererrenderdiff).

[Back to top](#automation-api)


## testRenderer.renderStack()

* testRenderer.renderStack(testCaseResult: [TestCaseResult](#testcaseresult)): string

Pulls out a failed test’s stack trace and highlights the lines that reference the test’s filename by adding an arrow (`-->`) and coloring them bold bright white.

If the stack trace isn’t a string, converts it to a string and returns it without attempting to perform any highlighting. If the test doesn’t have an error, or it doesn’t have a stack trace, returns an empty string.

[Back to top](#automation-api)


## testRenderer.renderDiff()

* testRenderer.renderDiff(error: AssertionError): string

Renders the `expected` and `actual` values of `error` as consecutive lines, with highlighting to make comparing the results easier. If `error` doesn’t have `expected` and `actual` values, returns an empty string.

Renders `expected:` first in green, followed by the expected value in the default color. It’s converted to a string by calling `util.inspect()` with infinite depth.

Then it renders `actual:  ` in red on the following line, with padding after the colon to make the results line up, followed by the actual value in the default color. This is also converted to a string by calling `util.inspect()`.

If the rendered values are more than one line, the strings are compared line by line. Any lines that are different are highlighted by coloring them bold bright yellow.

In the future, I’d like to implement a more sophisticated mechanism for highlighting differences, but this works surprisingly well for such a cheap trick.

[Back to top](#automation-api)


---


## TestResult

* import { TestResult } from "ergotest/test_result.js"

`TestResult` is the parent class for [TestSuiteResult](#testsuiteresult) and [TestCaseResult](#testcaseresult). It doesn’t have any methods of its own, but it does have several static factory methods. You’re not likely to need them.

[Back to top](#automation-api)


## TestResult.suite()

* TestResult.suite(names: string | string[], children: [TestResult](#testresult)[], filename?: string, mark?: [TestMarkValue](#testmarkvalue)): [TestSuiteResult](#testsuiteresult)

Create a test result for a suite of tests.

[Back to top](#automation-api)


## TestResult.pass()

* TestResult.pass(names: string | string[], filename?: string, mark?: [TestMarkValue](#testmarkvalue)): [TestCaseResult](#testcaseresult)

Create a passing test result.

[Back to top](#automation-api)


## TestResult.fail()

* TestResult.fail(names: string | string[], error: unknown, filename?: string, mark?: [TestMarkValue](#testmarkvalue)): [TestCaseResult](#testcaseresult)

Create a failing test result, where `error` is the reason for the failure. If it’s an `Error`, the failure will be rendered with a stack trace. If it’s an `AssertionError`, it will also be rendered with expected and actual values.

[Back to top](#automation-api)


## TestResult.skip()

* TestResult.skip(names: string | string[], filename?: string, mark?: [TestMarkValue](#testmarkvalue)): [TestCaseResult](#testcaseresult)

Create a skipped test result.

[Back to top](#automation-api)


## TestResult.timeout()

* TestResult.pass(names: string | string[], timeout: number, filename?: string, mark?: [TestMarkValue](#testmarkvalue)): [TestCaseResult](#testcaseresult)

Create a timed out test result, where `timeout` is the length of the timeout (*not* the time the test actually took to run).

[Back to top](#automation-api)


## TestStatus

* import { TestStatus } from "ergotest/test_result.js"

An “enum” object with the following options:

* `pass`: for tests that passed
* `fail`: for tests that failed
* `skip`: for tests that were skipped
* `timeout`: for tests that timed out

[Back to top](#automation-api)


## TestStatusValue

* import { TestStatusValue } from "ergotest/test_result.js"

A type for the possible values of [TestStatus](#teststatus).

[Back to top](#automation-api)


## TestMark

* import { TestMark } from "ergotest/test_result.js"

An “enum” object with the following options:

* `only`: for tests and suites that were defined with `.only`
* `skip`: for tests and suites that were defined with `.skip`, or that were defined without a body
* `none`: for all other tests and suites

[Back to top](#automation-api)


## TestMarkValue

* import { TestStatus } from "ergotest/test_result.js"

A type for the possible values of [TestMark](#testmark).

[Back to top](#automation-api)


---


## TestSuite

* import { TestSuite } from "ergotest/test_suite.js"

You’re very unlikely to use this class directly, but I’ve included it for completeness. To create a `TestSuite`, call `test()`. (It’s defined in the [test API documentation](test_api.md)).

[Back to top](#automation-api)


## TestSuite.fromModulesAsync()

* TestSuite.fromModulesAsync(moduleFilenames: string[]): Promise\<TestSuite\>

> **Warning:** It’s probably better to call [testRunner.runInChildProcessAsync()](#testrunnerruninchildprocessasync).

Import the modules in `modulePaths` in the current process and groups them into a single suite. Requires each module to export a `TestSuite`. (See the [test API](test_api.md) for details.) The `modulePaths` must be absolute paths.

The modules will *not* be reloaded if they have been loaded before, even if they have changed.

Generates test failures if any of the `modulePaths` fail to load, or if they don’t export a test suite.

> **Warning:** Your test modules and test runner must use the same installation of `ergotest`, or you’ll get an error saying the test modules don’t export a test suite.

[Back to top](#automation-api)


## testSuite.runAsync()

* testSuite.runAsync(options?: [TestOptions](#testoptions)): Promise\<[TestSuiteResult](#testsuiteresult)\>

> **Warning:** It's probably better to call [testRunner.runInChildProcessAsync()](#testrunnerruninchildprocessasync).

Run the tests in the test suite. (See the [test API](test_api.md) for details.) Does *not* detect infinite loops or uncaught exceptions.

Use `options` to provide configuration data to the tests or specify a callback for reporting test progress.

[Back to top](#automation-api)
