# Automation API

Use the automation API to run your tests and display their results.


Links to other documentation:

* [Test API](test_api.md)
* [Assertion API](assertion_api.md)
* **Automation API**
* [Reporting API](reporting_api.md)
* [Readme](../README.md)
* [Changelog](../CHANGELOG.md)
* [Roadmap](../ROADMAP.md)

In this document **(the bold entries are all you need)**:

* **[Start Here](#start-here)**
  * [**Example**](#example)
  * [Data Model](#datamodel)
* [TestRunner](#testrunner)
  * **[TestRunner.create()](#testrunnercreate)**
  * **[testRunner.runInChildProcessAsync()](#testrunnerruninchildprocessasync)**
  * [testRunner.runInCurrentProcessAsync()](#testrunnerrunincurrentprocessasync)
  * [TestOptions](#testoptions) 
* [TestSuiteResult](#testsuiteresult)
  * [testSuiteResult.filename](#testsuiteresultfilename)
  * [testSuiteResult.name](#testsuiteresultname)
  * [testSuiteResult.mark](#testsuiteresultmark)
  * [testSuiteResult.tests](#testsuiteresulttests)
  * **[testSuiteResult.render()](#testsuiteresultrender)**
  * **[testSuiteResult.count()](#testsuiteresultcount)**
  * [testSuiteResult.allTests()](#testsuiteresultalltests)
  * [testSuiteResult.allMatchingTests()](#testsuiteresultallmatchingtests)
  * [testSuiteResult.allMarkedResults()](#testsuiteresultallmarkedresults)
  * [testSuiteResult.allMatchingMarks()](#testsuiteresultallmatchingmarks)
  * [testSuiteResult.allPassingFiles()](#testsuiteresultallpassingfiles)
  * [testSuiteResult.equals()](#testsuiteresultequals)
  * [TestSuiteResult.create()](#testsuiteresultcreate)
* [TestCaseResult](#testcaseresult)
  * [testCaseResult.filename](#testcaseresultfilename)
  * [testCaseResult.name](#testcaseresultname)
  * [testCaseResult.status](#testcaseresultstatus)
  * [testCaseResult.mark](#testcaseresultmark)
  * [testCaseResult.errorMessage](#testcaseresulterrormessage)
  * [testCaseResult.errorRender](#testcaseresulterrorrender)
  * [testCaseResult.timeout](#testcaseresulttimeout)
  * **[testCaseResult.renderAsCharacter()](#testcaseresultrenderascharacter)**
  * **[testCaseResult.renderAsSingleLine()](#testcaseresultrenderassingleline)**
  * **[testCaseResult.renderAsMultipleLines()](#testcaseresultrenderasmultiplelines)**
  * [testCaseResult.equals()](#testcaseresultequals)
  * [TestCaseResult.create()](#testcaseresultcreate)
* [RunResult](#runresult)
  * [RunResult.pass()](#runresultpass)
  * [RunResult.fail()](#runresultfail)
  * [RunResult.skip()](#runresultskip)
  * [RunResult.timeout()](#runresulttimeout)
* [Types](#types)
  * [TestStatus](#teststatus)
  * [TestStatusValue](#teststatusvalue)
  * [TestMark](#testmark)
  * [TestMarkValue](#testmarkvalue)
  * [RenderErrorFn](#rendererrorfn)
* [Result Factories](#testresult)
  

## Start Here

> **The Golden Rule:** Don't use constructors to instantiate Ergotest classes. Constructors are reserved for internal use only in this codebase.

There are six classes in Ergotest, but you only really need to know about three of them. The bolded methods in the table of contents above are the only ones you’re likely to use. The rest of this file is here for reference and advanced usage. 

* ***TestRunner*** is how you run your tests.
* ***TestSuiteResult*** has the results of your test run, and includes a convenient method for reporting the results.
* ***TestCaseResult*** has the details of a single test, and it also has convenient reporting methods.
* _RunResult_ has the details of running a single function, such as _it()_ or _beforeEach()_.
* *TestRenderer* has tools for customizing result rendering. See the [Reporting API](reporting_api.md) for details.

The best way to run your tests is to use [testRunner.runInChildProcessAsync()](#testrunnerruninchildprocessasync). It takes a list of test module paths, which it runs in a child process, and it returns a [TestSuiteResult](#testsuiteresult).

You can report on the test run by calling [TestSuiteResult.render()](#testsuiteresultrender) and writing the string it returns to the console. To learn the overall results of the test run, call [testSuiteResult.count()](#testsuiteresultcount).

To see the results of the tests as they’re running, pass `onTestCaseResult` to [testRunner.runInChildProcessAsync()](#testrunnerruninchildprocessasync). It will be called with a `TestCaseResult`, which you can then render with the [testCaseResult.renderAsCharacter()](#testcaseresultrenderascharacter), [testCaseResult.renderAsSingleLine()](#testcaseresultrenderassingleline), or [testCaseResult.renderAsMultipleLines()](#testcaseresultrenderasmultiplelines) methods.

[Back to top](#automation-api)


### Example

Bringing it all together, here's an annotated version of a simple command-line interface for running tests:

```javascript
import { TestRunner } from "ergotest";
import path from "node:path";

// This function will be called every time a test finishes running
function reportProgress(testCase) {
  // Write the test result as a dot, X, etc.
  process.stdout.write(testCase.renderAsCharacter());
}

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
else if (count.skip > 0) {
  console.log("Tests passed, but some were skipped :-/");
}
else {
  console.log("Tests passed :-)\n");
}
```


### Data Model


The test runner will give you a [TestSuiteResult](#testsuiteresult) when the tests finish running. Each _TestSuiteResult_ corresponds to a _describe()_ block, with the top-level _TestSuiteResult_ acting as a container for all your test files.

```
+--------------------> TestResult
|                   *     /_\
|                          |
|           +--------------+---------------+
|           |                              |
|  +-----------------+            +-----------------+               
|  | TestSuiteResult |            | TestCaseResult  |             
|  +-----------------+         *  +-----------------+
|  |   beforeAll   --|----------> | beforeEach    --|--------+     
|  |   afterAll    --|----------> | afterEach     --|-----+  |      
+--|-- tests         |         *  | it            --|--+  |  |
   +-----------------+            +-----------------+  |  |  |
                                                       |1 |* |*
                                                       v  v  v
                                                   +-------------+            
                                                   |  RunResult  |          
                                                   +-------------+
```

_TestSuiteResult_ has properties corresponding to the functions called inside _describe():_

* [TestSuiteResult.beforeAll](#testsuiteresultbeforeall) is an array of [TestCaseResult](#testcaseresult)s corresponding to the [beforeAll()](test_api.md#beforeall) functions in the suite.
* [TestSuiteResult.afterAll](#testsuiteresultbeforeall) is an array of [TestCaseResult](#testcaseresult)s corresponding to the [afterAll()](test_api.md#afterall) functions in the suite.
* [TestSuiteResult.tests](#testsuiteresulttests) is an array of _TestSuiteResults_ and _TestCaseResults_ corresponding to the _describe()_ and _it()_ functions in the suite.

> **Note:** You don't need to loop through all the properties of _TestSuiteResult_. The easiest way to use it is to call one of its convenience methods, such as [TestSuiteResult.allTests()](#testsuiteresultalltests) or [TestSuiteResult.allMatchingTests()](#testsuiteresultallmatchingtests), which will automatically collate all the _TestCaseResults_ in the suite and its sub-suites.

_TestCaseResult_ has properties corresponding to the functions related to running a test:

* [TestCaseResult.beforeEach](#testcaseresultbeforeeach) is an array of [RunResult](#runresult)s corresponding to all the [beforeEach()](test_api.md#beforeeach) functions that ran before the test, regardless of which suite they were defined within.
* [TestCaseResult.afterEach](#testcaseresultaftereach) is an array of [RunResult](#runresult)s corresponding to all the [afterEach()](test_api.md#aftereach) functions that ran after the test, regardless of which suite they were defined within.
* [TestCaseResult.it](#testcaseresultit) is a single [RunResult](#runresult) corresponding to the [it()](test_api.md#it) function that ran the test itself.

Results for [beforeAll()](test_api.md#beforeall) and [afterAll()](test_api.md#afterall) functions are contained in a [TestCaseResult](#testcaseresult), for ease of reporting, but the _TestCaseResult_ only has an _it_ result. The _beforeEach_ or _afterEach_ results are empty arrays.

[Back to top](#automation-api)


---


## TestRunner

* import { TestRunner } from "ergotest"

Use the `TestRunner` class to run your tests.

[Back to top](#automation-api)


## TestRunner.create()

* TestRunner.create(): TestRunner

Instantiate `TestRunner`.

[Back to top](#automation-api)


## testRunner.runInChildProcessAsync()

* testRunner.runInChildProcessAsync(modulePaths: string[], options?: [TestOptions](#testoptions)): Promise\<[TestSuiteResult](#testsuiteresult)\>

Spawn an isolated child process, import the modules in _modulePaths_ inside that process, and run them as a single test suite. Requires each module to `export default describe(...)`. (See the [test API](test_api.md) for details.) The _modulePaths_ must be absolute paths.

> **Note:** Although the child process is isolated from your test automation script, and each test run gets a fresh child process, all the tests for a given test run are in the same process. They run sequentially, not in parallel, and are not isolated from each other.

The test modules will be loaded fresh every time this method is called, allowing you to run your tests as part of a watch script.

If the tests enter an infinite loop or throw an uncaught exception, a test watchdog will kill the tests and generate a corresponding test failure.

If any of the _modulePaths_ fail to load, the remaining modules will still run. The failed modules will have a corresponding test failure in the test results.

> **Warning:** Your test modules and test runner must use the same installation of `ergotest`, or you’ll get an error saying the test modules don’t export a test suite.

Use [options](#testoptions) to provide configuration data to the tests and otherwise customize your test run.

> **Warning:** Because the tests run in a child process, any configuration information you provide will be serialized. Only bare objects, arrays, and primitive data can be provided; class instances will not work.

[Back to top](#automation-api)


## testRunner.runInCurrentProcessAsync()

* testRunner.runInCurrentProcessAsync(modulePaths: string[], options?: [TestOptions](#testoptions)): Promise\<[TestSuiteResult](#testsuiteresult)\>

> **Warning:** It's typically better to call [testRunner.runInChildProcessAsync()](#testrunnerruninchildprocessasync).

Import the modules in _modulePaths_ in the current process and run them as a single test suite. Requires each module to `export default describe(...)`. (See the [test API](test_api.md) for details.) The _modulePaths_ must be absolute paths.

The modules will *not* be reloaded if they have been loaded before, even if they have changed. As a result, this method is only suitable for automation that exits back to the command line after running the tests.

Does *not* detect infinite loops or uncaught exceptions.

If any of the _modulePaths_ fail to load, the remaining modules will still run. The failed modules will have a corresponding test failure in the test results.

> **Warning:** Your test modules and test runner must use the same installation of `ergotest`, or you’ll get an error saying the test modules don’t export a test suite.

Use [options](#testoptions) to provide configuration data to the tests and otherwise customize your test run.

[Back to top](#automation-api)


## TestOptions

* import { TestOptions } from "ergotest/test_api.js"

You can configure test runs with this interface. Provide an object with these optional parameters:

* **config?: Record<string, unknown>**
  * Configuration information accessible to your tests at run time. Retrieve the values by calling [getConfig()](test_api.md#getconfig) in your tests.
  * An object with key/value pairs. The values should be bare objects, arrays, or primitive data, not class instances, because the configuration will be serialized in most cases.
  * Defaults to an empty object.

* **timeout?: number**
  * The amount of time, in milliseconds, before a test or before/after function times out. Note that, due to the nature of JavaScript, functions continue running even after they've timed out. However, their results are ignored.
  * Defaults to two seconds.

* **onTestCaseResult?: (testCaseResult: TestCaseResult) => void**
  * Every time an _it(), beforeAll(),_ or _afterAll()_ function completes, this function is called with the result.
  * Defaults to a no-op.

* **renderer?: string**
  * See the [Reporting API](reporting_api.md) for details.
  * The path to a module for custom error rendering. Must be an absolute path or a path to `node_modules`.
  * The module must export a function named _renderError()_ of the type [RenderErrorFn](#rendererrorfn). 
  * Defaults to the [built-in error renderer](reporting_api.md#rendererror).

[Back to top](#automation-api)


---


## TestSuiteResult

* import { TestSuiteResult } from "ergotest/test_result.js"
* extends [TestResult](#testresult)

`TestSuiteResult` instances represent the results of running a test suite. You’ll typically get one by calling [TestRunner.runInChildProcessAsync()](#testrunnerruninchildprocessasync). It’s a nested tree of [TestSuiteResult](#testsuiteresult)s, which correspond to [describe()](test_api.md#describe); [TestCaseResult](#testcaseresult)s, which correspond to [it()](test_api.md#it), [beforeAll()](test_api.md#beforeall), and [afterAll()](test_api.md#afterall); and [RunResult](#runresult)s, which correspond to the actual results of executing test functions. See the [data model](#data-model) for details. 

[Back to top](#automation-api)


## testSuiteResult.filename

* testSuiteResult.filename?: string

If this test suite was loaded from a module, which most will be, this property contains the absolute path of the module. Otherwise, it’s undefined. 

[Back to top](#automation-api)


## testSuiteResult.name

* testSuiteResult.name: string[]

The name of the suite and all its parent suites, with the outermost suite first. Suites with no name aren’t included, so if none of the suites had a name, this array will be empty.

[Back to top](#automation-api)


## testSuiteResult.mark

* testSuiteResult.mark: [TestMarkValue](#testmarkvalue)

Indicates whether the suite was defined using `.skip`, `.only`, or neither. Suites with no function body are considered to be marked `.skip`.


[Back to top](#automation-api)


## testSuiteResult.beforeAll

* testSuiteResult.beforeAll: [TestCaseResult](#testcaseresult)[]

The results of this suite's [beforeAll()](test_api.md#beforeall) functions. The [beforeEach](#testcaseresultbeforeeach) and [afterEach](#testcaseresultaftereach) properties of the _TestCaseResult_ will be empty arrays.


## testSuiteResult.afterAll

* testSuiteResult.afterAll: [TestCaseResult](#testcaseresult)[]

The results of this suite's [beforeAll()](test_api.md#afterall) functions. The [beforeEach](#testcaseresultbeforeeach) and [afterEach](#testcaseresultaftereach) properties of the _TestCaseResult_ will be empty arrays.


## testSuiteResult.tests

* testSuiteResult.tests: [TestResult](#testresult)[]

This suite’s direct children, which can either be [TestSuiteResult](#testsuiteresult)s or [TestCaseResult](#testcaseresult)s instances. It’s possible for a suite to have no children.

[Back to top](#automation-api)


## testSuiteResult.render()

[Back to top](#automation-api)

* testSuiteResult.render(preamble?: string = "", elapsedMs?: number): string

> **Warning:** Visual changes to the output of this method are not considered breaking changes.

Render this suite as a nicely formatted and colored string. The rendering consists of three parts:

* A summary list of marked suites and tests, for ease of finding `.only` and `.skip` marks
* A detailed list of test failures and timeouts
* A summary of the test results

This is a convenience method. For more control over rendering, use the [Reporting API](reporting_api.md) instead.

If `preamble` is defined, it will be added to the beginning of the rendered string, but only if there’s more to show than the summary of results. This is convenient for adding blank lines when there’s details to show, but keeping the rendering compact when there’s not.

If `elapsedMs` is defined, the summary will include the average amount of time required for each test. This is a simple division operation; it’s up to you to determine the elapsed time correctly. 


## testSuiteResult.count()

* testSuiteResult.count(): { pass: number, fail: number, skip: number, timeout: number, total: number }

A summary of this suite’s results. Includes a count of each type of test case result and the total number. Only counts  [TestCaseResult](#testcaseresult)s, not [TestSuiteResult](#testsuiteresult)s.

> **Note:** The results of [beforeAll()](test_api.md#beforeall) and [afterAll()](test_api.md#afterall) are included in the count, but not the results of [beforeEach()](test_api.md#beforeeach) and [afterEach()](test_api.md#aftereach), because those are rolled up into each individual test result.

[Back to top](#automation-api)


## testSuiteResult.allTests()

* testSuiteResult.allTests(): [TestCaseResult](#testcaseresult)[]

Find all the test results in this suite and its sub-suites and flatten them into a single array. Only includes [TestCaseResult](#testcaseresult)s, including the results of [beforeEach()](test_api.md#beforeeach) and [afterEach()](test_api.md#aftereach), but not [TestSuiteResult](#testsuiteresult)s.

If you only want test results with a particular status (pass, fail, etc.), use [testSuiteResult.allMatchingTests()](#testsuiteresultallmatchingtests) instead.

[Back to top](#automation-api)


## testSuiteResult.allMatchingTests()

* testSuiteResult.allMatchingTests(...statuses: [TestStatusValue](#teststatusvalue)[]): [TestCaseResult](#testcaseresult)[]

Find all the test results, in this suite and its sub-suites, that match any of the _statuses_ and flatten them into a single array. Only includes [TestCaseResult](#testcaseresult)s, including the results of [beforeEach()](test_api.md#beforeeach) and [afterEach()](test_api.md#aftereach), but not [TestSuiteResult](#testsuiteresult)s.

If you want all test results from this suite and its sub-suites, use [testSuiteResult.allTests()](#testsuiteresultalltests) instead.

[Back to top](#automation-api)


## testSuiteResult.allMarkedResults()

* testSuiteResult.allMarkedResults(): [TestResult](#testresult)[]

Find all the test case *and* test suite results, in this suite and its sub-suites, that were marked with `.only`, or `.skip`, and flatten them into a single array. Suites and tests without a body are considered to have been marked with `.skip`.

Only includes marked results. To get results without marks, or specific marks, use [testSuiteResult.allMatchingMarks()](#testsuiteresultallmatchingmarks) instead. 

[Back to top](#automation-api)


## testSuiteResult.allMatchingMarks()

* testSuiteResult.allMatchingMarks(...marks: [TestMarkValue](#testmarkvalue)[]): [TestResult](#testresult)[]

Find all the test case *and* test suite results, in this suite and its sub-suites, that match any of the _marks_, and flatten them into a single array. Suites and tests without a body are considered to have been marked with `.skip`.

If you want all the test results that were marked, use [testSuiteResult.allMarkedResults()](#testsuiteresultallmarkedresults) instead. 

> **Note:** If you request results without marks, you will also get results for [beforeEach()](test_api.md#beforeeach) and [afterEach()](test_api.md#aftereach), which are *TestCaseResults* that never have marks.


[Back to top](#automation-api)


## testSuiteResult.allPassingFiles()

* testSuiteResult.allPassingFiles(): string[]

Find all the files, in this suite and its sub-suites, that only had passing tests. Files with failed, timed out, or skipped tests are not included.

This is useful for incremental builds. You can avoid re-running files that had passing tests until they change. 

[Back to top](#automation-api)


## testSuiteResult.equals()

* testSuiteResult.equals(that: [TestResult](#testresult)): boolean

Determine if this suite’s result is equal to another test result. To be equal, they must have exactly the same results, including sub-suites, in the same order, with the same names, filenames, marks, error messages, and timeouts. However, error renders are ignored, which means that stack traces and other error details are ignored. 

[Back to top](#automation-api)


## TestSuiteResult.create()

* TestSuiteResult.create(options: Options)

A factory method for creating [TestSuiteResult](#testsuiteresult)s. You aren't likely to need this method. It takes the following parameters:

* _name?: string[]:_ Same as [testSuiteResult.name](#testsuiteresultname). Defaults to an empty array.
* _tests?: TestResult[]:_ Same as [testSuiteResult.tests](#testsuiteresulttests). Defaults to an empty array.
* _beforeAll?: TestCaseResult[]:_ Same as [testSuiteResult.beforeAll](#testsuiteresultbeforeall). Defaults to an empty array.
* _afterAll?: TestCaseResult[]:_ Same as [testSuiteResult.afterAll](#testsuiteresultafterall). Defaults to an empty array.
* _filename?: string:_ Same as [testSuiteResult.filename](#testsuiteresultfilename). Defaults to _undefined_.
* _mark?: TestMarkValue:_ Same as [testSuiteResult.mark](#testsuiteresultmark). Defaults to [TestMark.none](#testmark).


---


## TestCaseResult

* import { TestCaseResult } from "ergotest/test_result.js"
* extends [TestResult](#testresult)

`TestCaseResult` instances represent the result of running a single test. You’ll get them from [TestSuiteResult](#testsuiteresult), typically by calling [TestSuiteResult.allTests()](#testsuiteresultalltests) or [TestSuiteResult.allMatchingTests()](#testsuiteresultallmatchingtests).

[Back to top](#automation-api)


## testCaseResult.filename

* testCaseResult.filename?: string

If this test was loaded from a module, which most will be, this property contains the absolute path of the module. Otherwise, it’s undefined. 

[Back to top](#automation-api)


## testCaseResult.name

* testCaseResult.name: string[]

The name of the test and all its parent suites, with the outermost suite first. Suites with no name aren’t included.

All normal tests have a name, so there should be at least one name element, but it is technically possible to create a test case result with a name that’s an empty array. 

[Back to top](#automation-api)


## testCaseResult.mark

* testCaseResult.mark: [TestMarkValue](#testmarkvalue)

Indicates whether the test was defined using `.skip`, `.only`, or neither. Tests with no function body are considered to be marked `.skip`.


## testCaseResult.status

* testCaseResult.status: [TestStatus](#teststatus)

Whether this test passed, failed, etc. 

See also [testCaseResult.isPass()](#testcaseresultispass), [testCaseResult.isFail()](#testcaseresultisfail), [testCaseResult.isSkip()](#testcaseresultisskip), and [testCaseResult.isTimeout()](#testcaseresultistimeout) .

[Back to top](#automation-api)


## testCaseResult.errorMessage

* testCaseResult.errorMessage?: string

> **Warning:** Visual changes to the output of this method are not considered breaking changes.

If this test failed, contains the error message. Throws an exception if the test didn't fail.

The nature of the error message depends on the type of the error.

* If the error was an instance of `Error`, as is usually the case, this contains `error.message`.
* If the error was an instance of `Error`, but `error.message` was undefined, this contains `""`. 
* If the error was a string, this contains that string.
* In all other cases, this contains the results of calling `util.inspect()` with infinite depth on the error. 

[Back to top](#automation-api)


## testCaseResult.errorRender

* testCaseResult.errorRender?: unknown

> **Warning:** Visual changes to the output of this method are not considered breaking changes.

If this test failed, contains the error rendering. Throws an exception if the test didn't fail.

The error rendering depends on the renderer provided to the test runner in [TestOptions](#testoptions). If no renderer is provided, it defaults to [renderError()](reporting_api.md#rendererror), which returns a human-readable string with the error message, stack trace, and a comparison of actual and expected values (when applicable).

[Back to top](#automation-api)


## testCaseResult.timeout

* testCaseResult.timeout?: number

If this test timed out, contains the timeout value in milliseconds. Throws an exception if the test didn't time out.

Please note that this value is the timeout value the test was expected to meet, *not* the actual run time of the test. Due to the nature of JavaScript, the actual run time could be shorter or longer than the timeout value.

[Back to top](#automation-api)


## testCaseResult.renderAsCharacter()

* testCaseResult.renderAsCharacter(): string

> **Warning:** Visual changes to the output of this method are not considered breaking changes.

Render this test as a single color-coded character representing its status:

* *pass:* normal-colored `.`
* *fail:* red inverse `X`
* *skip:* light cyan `_`
* *timeout:* purple inverse `!`

This is a convenience method. For more control over rendering, use the [Reporting API](reporting_api.md) instead.


[Back to top](#automation-api)


## testCaseResult.renderAsSingleLine()

* testCaseResult.renderAsSingleLine(): string

> **Warning:** Visual changes to the output of this method are not considered breaking changes.

Render this test as a single color-coded line containing its status and name.

This is a convenience method. For more control over rendering, use the [Reporting API](reporting_api.md) instead.

[Back to top](#automation-api)


## testCaseResult.renderAsMultipleLines()

* testCaseResult.renderAsMultipleLines(): string

> **Warning:** Visual changes to the output of this method are not considered breaking changes.

Render this test with all its color-coded detail. The rendering includes:

* The filename, suites, and name of the test on two lines
* The status of the test, if it didn’t fail
* The error, stack trace, and expected/actual results, if it did fail

This is a convenience method. For more control over rendering, use the [Reporting API](reporting_api.md) instead.

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


## TestResult

* import { TestResult } from "ergotest/test_result.js"

The parent class for [TestSuiteResult](#testsuiteresult) and [TestCaseResult](#testcaseresult). It doesn’t have any methods of its own, but it does have several static factory methods. They're only included for completeness; you’re not likely to need them.

[Back to top](#automation-api)


## TestSuiteResult.create()

* TestResult.suite(name: string | string[], children: [TestResult](#testresult)[], filename?: string, mark?: [TestMarkValue](#testmarkvalue)): [TestSuiteResult](#testsuiteresult)

Create a test result for a suite of tests.

[Back to top](#automation-api)


## RunResult.pass()

* TestResult.pass(name: string | string[], filename?: string, mark?: [TestMarkValue](#testmarkvalue)): [TestCaseResult](#testcaseresult)

Create a passing test result.

[Back to top](#automation-api)


## RunResult.fail()

* TestResult.fail(name: string | string[], error: unknown, filename?: string, mark?: [TestMarkValue](#testmarkvalue), renderError?: [RenderErrorFn](#rendererrorfn)): [TestCaseResult](#testcaseresult)

Create a failing test result, where `error` is the reason for the failure. The `error` will not be stored; instead, it will be used to set the [errorMessage](#testcaseresulterrormessage) and [errorRender](#testcaseresulterrorrender) properties. If `renderError` is provided, its return value will be used to set the [errorRender](#testcaseresulterrorrender) property; otherwise, Ergotest's built-in [renderError()](reporting_api.md#rendererror) will be used. 

[Back to top](#automation-api)


## RunResult.skip()

* TestResult.skip(name: string | string[], filename?: string, mark?: [TestMarkValue](#testmarkvalue)): [TestCaseResult](#testcaseresult)

Create a skipped test result.

[Back to top](#automation-api)


## RunResult.timeout()

* TestResult.pass(name: string | string[], timeout: number, filename?: string, mark?: [TestMarkValue](#testmarkvalue)): [TestCaseResult](#testcaseresult)

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


## RenderErrorFn

* import { RenderErrorFn } from "ergotest/test_result.js"
* (name: string[], error: unknown, mark: TestMarkValue, filename?: string) => unknown;

A type for custom error rendering. It takes the following parameters: 

* _names:_ Same as [testCaseResult.name](#testcaseresultname).
* _error:_ The error that caused the test to fail. Although it's usually an `Error` instance, it could be any data type, including a string.
* _mark:_ Same as [testCaseResult.mark](#testcaseresultmark).
* _filename:_ Same as [testCaseResult.filename](#testcaseresultfilename).

See the [Reporting API](reporting_api.md) for more about custom error rendering.

[Back to top](#automation-api)


