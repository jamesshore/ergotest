# Automation API

Use the automation API to run your tests and display their results.


Links to other documentation:

* [Test API](test_api.md)
* [Assertion API](assertion_api.md)
* Automation API
* [README](../README.md)
* [Changelog](../CHANGELOG.md)

In this document:

* [Start Here](#start-here)
* [TestRunner](#testrunner)
  * [TestRunner.create()](#testrunnercreate)
  * **[testRunner.runInChildProcessAsync()](#testrunnerruninchildprocessasync)**
  * [testRunner.runInCurrentProcessAsync()](#testrunnerrunincurrentprocessasync)
* [TestSuiteResult](#testsuiteresult)
  * [testSuiteResult.filename](#testsuiteresultfilename)
  * [testSuiteResult.name](#testsuiteresultname)
  * [testSuiteResult.mark](#testsuiteresultmark)
  * [testSuiteResult.children](#testsuiteresultchildren)
  * **[testSuiteResult.render()](#testsuiteresultrender)**
  * [testSuiteResult.count()](#testsuiteresultcount)
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

* TestRenderer
* TestResult
  * TestStatus
  * TestStatusValue
  * TestMark
  * TestMarkValue
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

* import { TestRunner } from "ergotest/test_runner.js"

Use the `TestRunner` class to run your tests.

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

> **Warning:** Because the tests run in a child process, any configuration information you provide will be serialized. Only bare objects, arrays, and primitive data can be provided; class instances will not work.

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

Indicates whether the suite was marked with `.skip` or `.only` (or not marked at all). Only suites that called `.skip` or `.only` are considered to be marked; this value isn’t inherited. As a result, the tests in a suite can be skipped but without the suite being *marked* `.skip`.

Suites with no function body are considered to be marked `.skip`.


[Back to top](#automation-api)


## testSuiteResult.children

* testSuiteResult.children: [TestResult](#testresult)[]

This suite’s direct children, which can either be [TestSuiteResult](#testsuiteresult) or [TestCaseResult](#testcaseresult) instances. It’s possible for a suite to have no children.

[Back to top](#automation-api)


## testSuiteResult.render()

[Back to top](#automation-api)

* testSuiteResult.render(preamble?: string = "", elapsedMs: number): string

Render this suite as a nicely formatted string. The rendering consists of three parts:

* A summary list of marked suites and tests, for ease of finding `.only` and `.skip` marks
* A detailed list of test failures and timeouts
* A summary of the test results

This is a convenience method. For more control over rendering, use [TestRenderer](#testrenderer) instead.

If `preamble` is defined, it will be added to the beginning of the rendered string, but only if there’s more to show than the summary of results. This is convenient for adding blank lines when there’s details to show, but keeping the rendering compact when there’s not.

If `elapsedMs` is defined, the summary will include the average amount of time required for each test. This is a simple division operation; it’s up to you to determine the elapsed time correctly. 


## testSuiteResult.count()

* testSuiteResult.count(): { pass: number, fail: number, skip: number, timeout: number, total: number }

A summary of this suite’s results. Includes a count of each type of test case result and the total number. Only counts  [TestCaseResult](#testcaseresult), not [TestSuiteResult](#testsuiteresult).

[Back to top](#automation-api)


## testSuiteResult.allTests()

* testSuiteResult.allTests(): [TestCaseResult](#testcaseresult)[]

Find all the test results in this suite and all it’s sub-suites and flatten them into a single array. Only includes [TestCaseResult](#testcaseresult), not [TestSuiteResult](#testsuiteresult).

If you only want test results with a particular status (pass, fail, etc.), use [testSuiteResult.allMatchingTests()](#testsuiteresultallmatchingtests) instead.

[Back to top](#automation-api)


## testSuiteResult.allMatchingTests()

* testSuiteResult.allMatchingTests(...statuses: [TestStatusValue](#teststatusvalue)[]): [TestCaseResult](#testcaseresult)[]

Find all the test results, in this suite and all its sub-suites, that match any of the `statuses` and flatten them into a single array. Only includes [TestCaseResult](#testcaseresult), not [TestSuiteResult](#testsuiteresult).

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

Find all the files, in this suite and all its sub-suites, that only had passing tests. Files with failed, timed out, *or skipped* tests are not included.

This is useful for incremental builds. It allows you to ignore test files that have passed while re-testing files that had failures, timeouts, or skips.

[Back to top](#automation-api)


## testSuiteResult.equals()

* testSuiteResult.equals(that: [TestResult](#testresult)): boolean

Determine if this suite is equal to another test result. To be equal, they must have exactly the same results, including sub-suites, in the same order, with the same names, filenames, and marks.

[Back to top](#automation-api)


---


## TestCaseResult

* import { TestCaseResult } from "ergotest/test_result.js"
* extends [TestResult](#testresult)

`TestCaseResult` instances represent the result of running a single test. You’ll get them from [TestSuiteResult](#testsuiteresult), typically by calling [TestSuiteResult.allTests()](#testsuiteresultalltests) or [TestSuiteResult.allMatchingTests()](#testsuiteresultallmatchingtests).

[Back to top](#automation-api)


## testCaseResult.filename

* testCaseResult.filename?: string

If this test suite was loaded from a module (and they typically will be), this property contains the absolute path of the module. Otherwise, it’s undefined. 

[Back to top](#automation-api)


## testCaseResult.name

* testCaseResult.name: string[]

The name of the test and all its parent suites, with the outermost suite first. Suites with no name aren’t included.

All normal tests have a name, so there should be at least one name element, but it is technically possible to manually create a test case result with a name that’s an empty array. 

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

* *pass:* normal-colored dot
* *fail:* red inverse X
* *skip:* light cyan underline
* *timeout:* purple inverse !

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

* The filename and name of the test on two lines
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



