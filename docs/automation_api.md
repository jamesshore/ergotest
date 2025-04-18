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
  * **[testCaseResult.renderAsCharacter()](#testcaseresultrenderascharacter)**
  * **[testCaseResult.renderAsSingleLine()](#testcaseresultrenderassingleline)**
  * **[testCaseResult.renderAsMultipleLines()](#testcaseresultrenderasmultiplelines)**
  * [testCaseResult.isPass()](#testcaseresultispass)
  * [testCaseResult.isFail()](#testcaseresultisfail)
  * [testCaseResult.isSkip()](#testcaseresultisskip)
  * [testCaseResult.isTimeout()](#testcaseresultistimeout)
  * [testCaseResult.equals()](#testcaseresultequals)
  * [TestCaseResult.create()](#testcaseresultcreate)
* [RunResult](#runresult)
  * [runResult.errorMessage](#runresulterrormessage)
  * [runResult.errorRender](#runresulterrorrender)
  * [runResult.timeout](#runresulttimeout)
  * [RunResult.pass()](#runresultpass)
  * [RunResult.fail()](#runresultfail)
  * [RunResult.skip()](#runresultskip)
  * [RunResult.timeout()](#runresulttimeout)
* Types and Enums
  * [TestResult](#testresult)
  * [TestStatus](#teststatus)
  * [TestStatusValue](#teststatusvalue)
  * [TestMark](#testmark)
  * [TestMarkValue](#testmarkvalue)
  * [RenderErrorFn](#rendererrorfn)
  

## Start Here

> **The Golden Rule:** Don't use constructors to instantiate Ergotest classes. Constructors are reserved for internal use only in this codebase.

There are five classes in Ergotest, but only the three bolded below are important for everyday use. Similarly, the bolded methods in the table of contents above are the only ones you really need to know. The rest are for reference and advanced usage. 

* ***TestRunner*** is how you run your tests.
* ***TestSuiteResult*** has the results of your test run, and includes a convenient method for reporting the results. It's provided by the test runner after the tests finish running.
* ***TestCaseResult*** has the details of a single test, and it also has convenient reporting methods. It's provided to a callback by the test runner while the tests are running.  
* _RunResult_ has the details of running a single function, such as _it()_ or _beforeEach()_.
* *TestRenderer* allows you to customize your test reports. See the [Reporting API](reporting_api.md) for details.

**To run your tests,** call [**TestRunner.create()**](#testrunnercreate) to create a test runner, then call [**testRunner.runInChildProcessAsync()**](#testrunnerruninchildprocessasync) to run your tests. It takes an array of test module paths, runs them in a child process, and returns a [TestSuiteResult](#testsuiteresult).

**To report the results of your test run,** call [**testSuiteResult.render()**](#testsuiteresultrender) on the _testSuiteResult_ you got from [testRunner.runInChildProcessAsync()](#testrunnerruninchildprocessasync). It will return a string you can write to the console.

**To learn the overall results of your test run,** call [**testSuiteResult.count()**](#testsuiteresultcount) on the _testSuiteResult_ you got from [testRunner.runInChildProcessAsync()](#testrunnerruninchildprocessasync). It will give you an object with the number of tests that passed, failed, etc.

**To report the progress of the tests while they’re running,** pass the **_onTestCaseResult_ callback** to [testRunner.runInChildProcessAsync()](#testrunnerruninchildprocessasync). The test runner will call your callback after every test and give it a _TestCaseResult_. You can render the result with the **[testCaseResult.renderAsCharacter()](#testcaseresultrenderascharacter), [testCaseResult.renderAsSingleLine()](#testcaseresultrenderassingleline),** or **[testCaseResult.renderAsMultipleLines()](#testcaseresultrenderasmultiplelines)**. They each give you a string you can write to the console.

[Back to top](#automation-api)


### Example

**Bringing it all together,** here's a simple command-line interface for running tests:

```javascript
import { TestRunner } from "ergotest";
import path from "node:path";

// This function will be called every time a test finishes running
function onTestCaseResult(testCase) {
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

// Run the tests, calling the onTestCaseResult() function after each test completes
const result = await testRunner.runInChildProcessAsync(files, { onTestCaseResult });

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

**For advanced users,** this section describes how results are structured. Most people will be fine sticking to the methods described above.

The test runner will give you a [TestSuiteResult](#testsuiteresult) when the tests finish running. Most _TestSuiteResult_ corresponds to a [describe()](test_api.md#describe) block, except for some top-level results which act as a container for the other results.

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

**TestSuiteResult** has properties corresponding to the functions called inside _describe():_

* [beforeAll()](test_api.md#beforeall) results are found in [TestSuiteResult.beforeAll](#testsuiteresultbeforeall)
* [afterAll()](test_api.md#afterall) results are found in [TestSuiteResult.afterAll](#testsuiteresultbeforeall)
* [describe()](test_api.md#describe) and [it()](test_api.md#it) results are found in [TestSuiteResult.tests](#testsuiteresulttests)

> **Note:** You don't need to loop through the properties of _TestSuiteResult_. The easiest way to collect all the tests in your test run is to call one of its convenience methods, such as [TestSuiteResult.allTests()](#testsuiteresultalltests) or [TestSuiteResult.allMatchingTests()](#testsuiteresultallmatchingtests).

**TestCaseResult** has properties corresponding to the functions related to running a test:

* [beforeEach()](test_api.md#beforeeach) results are found in [TestCaseResult.beforeEach](#testcaseresultbeforeeach). It has results for every _beforeEach()_ associated with the test, including ones defined in parent suites.
* [afterEach()](test_api.md#aftereach) results are found in [TestCaseResult.afterEach](#testcaseresultaftereach). It has results for every _afterEach()_ associated with the test, including ones defined in parent suites.
* The [it()](test_api.md#it) result is found in [TestCaseResult.it](#testcaseresultit).

> **Note:** For ease of reporting, each [beforeAll()](test_api.md#beforeall) and [afterAll()](test_api.md#afterall) result is contained a [TestCaseResult](#testcaseresult). The details are in the [it](#testcaseresultit) property.

The remainder of this document is intended to be used as a reference. It describes the classes, methods, and supporting types 

[Back to top](#automation-api)


---


## TestRunner

* import { TestRunner } from "ergotest"

Use the _TestRunner_ class to run your tests.

[Back to top](#automation-api)


## TestRunner.create()

* TestRunner.create(): TestRunner

Instantiate _TestRunner_.

[Back to top](#automation-api)


## testRunner.runInChildProcessAsync()

* testRunner.runInChildProcessAsync(modulePaths: string[], options?: [TestOptions](#testoptions)): Promise\<[TestSuiteResult](#testsuiteresult)\>

Spawn an isolated child process, import the modules in _modulePaths_ inside that process, and run them as a single test suite. Requires each module to `export default describe(...)`. (See the [test API](test_api.md) for details.) The _modulePaths_ must be absolute paths.

> **Note:** Although the child process is isolated from your test automation script, and each test run gets a fresh child process, all the tests run in the same process. They run sequentially, not in parallel, and are not isolated from each other.

The test modules will be loaded fresh every time this method is called, allowing you to run your tests as part of a watch script.

If the tests enter an infinite loop or throw an uncaught exception, a test watchdog will kill the tests and generate a failed [TestCaseResult](#testcaseresult).

If any of the _modulePaths_ fail to load, the remaining modules will still run. Each failed module will generate a failed [TestCaseResult](#testcaseresult).

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

If any of the _modulePaths_ fail to load, the remaining modules will still run. Each failed module will generate a failed [TestCaseResult](#testcaseresult).

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

_TestSuiteResult_ instances represent the results of running a test suite. You’ll typically get one by calling [TestRunner.runInChildProcessAsync()](#testrunnerruninchildprocessasync). It’s a nested tree of [TestSuiteResult](#testsuiteresult)s, which correspond to [describe()](test_api.md#describe); [TestCaseResult](#testcaseresult)s, which correspond to [it()](test_api.md#it), [beforeAll()](test_api.md#beforeall), and [afterAll()](test_api.md#afterall); and [RunResult](#runresult)s, which correspond to the results of individual test functions. See the [data model](#data-model) for details. 

[Back to top](#automation-api)


## testSuiteResult.filename

* testSuiteResult.filename?: string

Contains the absolute path of the file that contained this test suite, if known. Otherwise, it's _undefined_. 

[Back to top](#automation-api)


## testSuiteResult.name

* testSuiteResult.name: string[]

The name of the suite and all its parent suites, with the outermost suite first. Suites named with an empty string, or with no name at all, won’t be included in the array. If none of the suites had a name, this array will be empty.

[Back to top](#automation-api)


## testSuiteResult.mark

* testSuiteResult.mark: [TestMarkValue](#testmarkvalue)

Indicates whether the suite was defined using `.skip`, `.only`, or neither. Suites with no function body are considered to be marked `.skip`.

[Back to top](#automation-api)


## testSuiteResult.beforeAll

* testSuiteResult.beforeAll: [TestCaseResult](#testcaseresult)[]

The results of this suite's [beforeAll()](test_api.md#beforeall) functions. The [beforeEach](#testcaseresultbeforeeach) and [afterEach](#testcaseresultaftereach) properties of the _TestCaseResult_ will be empty arrays.

[Back to top](#automation-api)


## testSuiteResult.afterAll

* testSuiteResult.afterAll: [TestCaseResult](#testcaseresult)[]

The results of this suite's [beforeAll()](test_api.md#afterall) functions. The [beforeEach](#testcaseresultbeforeeach) and [afterEach](#testcaseresultaftereach) properties of the _TestCaseResult_ will be empty arrays.

[Back to top](#automation-api)


## testSuiteResult.tests

* testSuiteResult.tests: [TestResult](#testresult)[]

This suite’s direct children, which can either be [TestSuiteResult](#testsuiteresult) or [TestCaseResult](#testcaseresult) instances. It’s possible for a suite to have no children.

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

If _preamble_ is defined, it will be added to the beginning of the rendered string, but only if there’s more to show than the summary of results. This is convenient for adding blank lines when there’s details to show, but keeping the rendering compact when there’s not.

If _elapsedMs_ is defined, the summary will include the average amount of time required for each test. This is a simple division operation; it’s up to you to determine the elapsed time correctly. 


## testSuiteResult.count()

* testSuiteResult.count(): { pass: number, fail: number, skip: number, timeout: number, total: number }

A summary of this suite’s results. Includes a count of each type of test case result and the total number. Only counts  [TestCaseResult](#testcaseresult)s, not [TestSuiteResult](#testsuiteresult)s.

> **Note:** The results of [beforeAll()](test_api.md#beforeall) and [afterAll()](test_api.md#afterall) are included in the count.

[Back to top](#automation-api)


## testSuiteResult.allTests()

* testSuiteResult.allTests(): [TestCaseResult](#testcaseresult)[]

Find all the test results in this suite and its sub-suites and flatten them into a single array. Only includes [TestCaseResult](#testcaseresult)s, including the results of [beforeAll()](test_api.md#beforeall) and [afterAll()](test_api.md#afterall), but not [TestSuiteResult](#testsuiteresult)s.

If you only want test results with a particular status (pass, fail, etc.), use [testSuiteResult.allMatchingTests()](#testsuiteresultallmatchingtests) instead.

> **Note:** The results of [beforeAll()](test_api.md#beforeall) and [afterAll()](test_api.md#afterall) are included.

[Back to top](#automation-api)


## testSuiteResult.allMatchingTests()

* testSuiteResult.allMatchingTests(...statuses: [TestStatusValue](#teststatusvalue)[]): [TestCaseResult](#testcaseresult)[]

Find all the test results, in this suite and its sub-suites, that match any of the _statuses_ and flatten them into a single array. Only includes [TestCaseResult](#testcaseresult)s, including the results of [beforeAll()](test_api.md#beforeall) and [afterAll()](test_api.md#afterall), but not [TestSuiteResult](#testsuiteresult)s.

If you want all test results from this suite and its sub-suites, use [testSuiteResult.allTests()](#testsuiteresultalltests) instead.
> **Note:** The results of [beforeAll()](test_api.md#beforeall) and [afterAll()](test_api.md#afterall) are included.

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

> **Note:** If you ask for results without marks, the results of [beforeAll()](test_api.md#beforeall) and [afterAll()](test_api.md#afterall) will be included.


[Back to top](#automation-api)


## testSuiteResult.allPassingFiles()

* testSuiteResult.allPassingFiles(): string[]

Find all the files, in this suite and its sub-suites, that only had passing tests. Files with failed, timed out, or skipped tests are not included.

This is useful for incremental builds. You can avoid re-running passing files until they change. 

> **Note:** The results of [beforeAll()](test_api.md#beforeall) and [afterAll()](test_api.md#afterall) are also considered.

[Back to top](#automation-api)


## testSuiteResult.equals()

* testSuiteResult.equals(that: [TestResult](#testresult)): boolean

Determine if this _TestSuiteResult_ is equal to another result. To be equal, they must have exactly the same results, including sub-suites, in the same order, with the same names, filenames, marks, statuses, error messages, and timeouts. However, error renders are ignored, which means that stack traces and other error details are ignored. 

[Back to top](#automation-api)


## TestSuiteResult.create()

* TestSuiteResult.create(options)

A factory method for creating [TestSuiteResult](#testsuiteresult) instances. You aren't likely to need this method. It takes the following options object:

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

_TestCaseResult_ instances represent the result of running a single [it()](test_api.md#it), [beforeAll()](test_api.md#beforeall), or [afterAll()](test_api.md#afterall) function. You’ll get them from [TestSuiteResult](#testsuiteresult), typically by calling [TestSuiteResult.allTests()](#testsuiteresultalltests) or [TestSuiteResult.allMatchingTests()](#testsuiteresultallmatchingtests).

_TestCaseResults_ represent a complete test run, including all associated [beforeEach()](test_api.md#beforeeach) and [afterEach()](test_api.md#aftereach) functions.  

> **Note:** [beforeAll()](test_api.md#beforeall) and [afterAll()](test_api.md#afterall) don't have associated [beforeEach()](test_api.md#beforeeach) and [afterEach()](test_api.md#aftereach) functions.

[Back to top](#automation-api)


## testCaseResult.filename

* testCaseResult.filename?: string

Contains the absolute path of the file that contained this test suite, if known. Otherwise, it's _undefined_. 

This is a convenience method for accessing [testCaseResult.it.filename](RunResult.filename). To get the filenames for [beforeEach()](test_api.md#beforeeach) or [afterEach()](test_api.md#aftereach) functions, use the  [testCaseResult.beforeEach](#testcaseresultbeforeeach) and [testCaseResult.afterEach](#testcaseresultaftereach) properties.


[Back to top](#automation-api)


## testCaseResult.name

* testCaseResult.name: string[]

The name of the test and all its parent suites, with the outermost suite first. Suites with no name aren’t included.

All normal tests have a name, so there should be at least one name element, but it is technically possible to create a test case result with a name that’s an empty array. 

This is a convenience method for accessing [testCaseResult.it.name](RunResult.name). To get the names of [beforeEach()](test_api.md#beforeeach) or [afterEach()](test_api.md#aftereach) functions, use the  [testCaseResult.beforeEach](#testcaseresultbeforeeach) and [testCaseResult.afterEach](#testcaseresultaftereach) properties.

[Back to top](#automation-api)


## testCaseResult.mark

* testCaseResult.mark: [TestMarkValue](#testmarkvalue)

Indicates whether the test was defined using `.skip`, `.only`, or neither. Tests with no function body are considered to be marked `.skip`.

[Back to top](#automation-api)


## testCaseResult.status

* testCaseResult.status: [TestStatus](#teststatus)

Whether this test passed, failed, etc.

This property consolidates the results of [testCaseResult.beforeEach](#testcaseresultbeforeeach), [testCaseResult.afterEach](#testcaseresultaftereach), and [testCaseResult.it](#testcaseresultit) as follows:

* If any sub-result failed, the test case failed.
* Otherwise, if any sub-result timed out, the test case timed out.
* Otherwise, use the result of [testCaseResult.it](#testcaseresultit), which will be "pass" or "skip".

[Back to top](#automation-api)


## testCaseResult.beforeEach

* testCaseResult.beforeEach: [RunResult](#runresult)[]

The results of every [beforeEach()](test_api.md#beforeeach) function associated with this test, including functions defined in parent suites. If there are no associated _beforeEach()_ functions, this array will be empty.

> **Note:** [beforeAll()](test_api.md#beforeall) and [afterAll()](test_api.md#afterall) don't have associated [beforeEach()](test_api.md#beforeeach)  functions.

[Back to top](#automation-api)


## testCaseResult.afterEach

* testCaseResult.afterEach: [RunResult](#runresult)[]

The results of every [afterEach()](test_api.md#aftereach) function associated with this test, including functions defined in parent suites. If there are no associated _afterEach()_ functions, this array will be empty.

> **Note:** [beforeAll()](test_api.md#beforeall) and [afterAll()](test_api.md#afterall) don't have associated [afterEach()](test_api.md#aftereach) functions.

[Back to top](#automation-api)


## testCaseResult.it

* testCaseResult.it: [RunResult](#runresult)

The result of the [it()](test_api.md#aftereach) function associated with this test.

> **Note:** For [beforeAll()](test_api.md#beforeall) and [afterAll()](test_api.md#afterall), this property will have the result of the _beforeAll()_ or _afterAll()_ function.

[Back to top](#automation-api)


## testCaseResult.renderAsCharacter()

* testCaseResult.renderAsCharacter(): string

> **Warning:** Visual changes to the output of this method are not considered breaking changes.

Render this test as a single color-coded character representing its status:

* *pass:* normal-colored `.`
* *fail:* red inverse `X`
* *skip:* light cyan `_`
* *timeout:* purple inverse `!`

This is a convenience method. For more control over rendering, use the [Reporting API](reporting_api.md) instead. This is the same as calling [testRenderer.renderAsCharacters(testCaseResult)](reporting_api.md#testrendererrenderassinglelines).


[Back to top](#automation-api)


## testCaseResult.renderAsSingleLine()

* testCaseResult.renderAsSingleLine(): string

> **Warning:** Visual changes to the output of this method are not considered breaking changes.

Render this test as a single color-coded line containing its status and name. If the test has unusual [beforeEach()](#testcaseresultbeforeeach) or [afterEach()](#testcaseresultaftereach) results (for example, if one of them failed), each _beforeEach()_ and _afterEach()_ result will also be rendered as an indented separate line.

This is a convenience method. For more control over rendering, use the [Reporting API](reporting_api.md) instead. This is the same as calling [testRenderer.renderAsSingleLines(testCaseResult)](reporting_api.md#testrendererrenderassinglelines).

[Back to top](#automation-api)


## testCaseResult.renderAsMultipleLines()

* testCaseResult.renderAsMultipleLines(): string

> **Warning:** Visual changes to the output of this method are not considered breaking changes.

Render this test with all its color-coded detail. The rendering includes:

* The filename, suites, and name of the test on two lines
* The status of the test, if it didn’t fail
* The error, stack trace, and expected/actual results, if it did fail

If the test has unusual [beforeEach()](#testcaseresultbeforeeach) or [afterEach()](#testcaseresultaftereach) results (for example, if one of them failed), each _beforeEach()_ and _afterEach()_ result will also be rendered in its full detail.

This is a convenience method. For more control over rendering, use the [Reporting API](reporting_api.md) instead.  This is the same as calling [testRenderer.renderAsMultipleLines(testCaseResult)](reporting_api.md#testrendererrenderassinglelines).

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


## testCaseResult.equals()

* testCaseResult.equals(that: [TestResult](#testresult)): boolean

Determine if this _TestCaseResult_ is equal to another result. To be equal, they must have exactly the same results, including [beforeEach()](#testcaseresultbeforeeach) and [afterEach()](#testcaseresultaftereach), in the same order, with the same names, filenames, mark, statuses, error messages, and timeouts. However, error renders are ignored, which means that stack traces and other error details are ignored. 

[Back to top](#automation-api)


## TestCaseResult.create()

* TestCaseResult.create(options)

A factory method for creating [TestCaseResult](#testcaseresult) instances. You aren't likely to need this method. It takes the following options object:

* _mark?: TestMarkValue:_ Same as [TestCaseResult.mark](#testcaseresultmark). Defaults to [TestMark.none](#testmark).
* _beforeEach?: RunResult[]:_ Same as [TestCaseResult.beforeEach](#testcaseresultbeforeeach). Defaults to an empty array.
* _afterEach?: RunResult[]:_ Same as [TestCaseResult.afterEach](#testcaseresultaftereach). Defaults to an empty array.
* _it: RunResult:_ Same as [TestCaseResult.it](#testcaseresultit).

[Back to top](#automation-api)


---


## RunResult

* import { RunResult } from "ergotest/test_result.js"

_RunResult_ instances represent the result of running an individual test function: either [it()](test_api.md#it), [beforeAll()](test_api.md#beforeall), [afterAll()](test_api.md#afterall), [beforeEach()](test_api.md#beforeEach), or [afterEach()](test_api.md#aftereach). You’ll get them from [testCaseResult.it](#testcaseresultit), [testCaseResult.beforeEach](#testcaseresultbeforeeach), or [testCaseResult.afterEach](#testcaseresultaftereach).

> **Note:** [beforeAll()](test_api.md#beforeall) and [afterAll()](test_api.md#afterall) function results can be found in [testSuiteResult.beforeAll[].it](#testsuiteresultbeforeall) and [testSuiteResult.afterAll[].it](#testsuiteresultafterall).

[Back to top](#automation-api)


## runResult.filename

* runResult.filename?: string

Contains the absolute path of the file that contained this function, if known. Otherwise, it's _undefined_. 

[Back to top](#automation-api)


## runResult.name

* runResult.name: string[]

The name of the test and all its parent suites, with the outermost suite first. Suites with no name aren’t included.

All normal tests have a name, so there should be at least one name element, but it is technically possible to create a test case result with a name that’s an empty array. 

[Back to top](#automation-api)


## runResult.status

* runResult.status: [TestStatus](#teststatus)

Whether this function completed normally (passed), threw an exception (failed), timed out, or was skipped.

[Back to top](#automation-api)


## runResult.errorMessage

* runResult.errorMessage?: string

> **Warning:** Visual changes to the output of this method are not considered breaking changes.

If this test failed, contains the error message. Throws an exception if the test didn't fail.

The nature of the error message depends on the type of the error.

* If the error was an instance of _Error_, as is usually the case, this contains `error.message`.
* If the error was an instance of _Error_, but `error.message` was undefined, this contains `""`. 
* If the error was a string, this contains that string.
* In all other cases, this contains the results of calling `util.inspect()` with infinite depth on the error. 

[Back to top](#automation-api)


## runResult.errorRender

* runResult.errorRender?: unknown

> **Warning:** Visual changes to the output of this method are not considered breaking changes.

If this test failed, contains the error rendering. Throws an exception if the test didn't fail.

The error rendering depends on the renderer provided to the test runner in [TestOptions](#testoptions). If no renderer is provided, it defaults to [renderError()](reporting_api.md#rendererror), which returns a human-readable string with the error message, stack trace, and (for _AssertionErrors_) a comparison of actual and expected values.

[Back to top](#automation-api)


## runResult.timeout

* runResult.timeout?: number

If this test timed out, contains the timeout value in milliseconds. Throws an exception if the test didn't time out.

Please note that this value is the timeout value the test was expected to meet, *not* the actual run time of the test. Due to the nature of JavaScript, the actual run time could be shorter or longer than the timeout value.

[Back to top](#automation-api)


## runResult.equals()

* runResult.equals(that: [RunResult](#testresult)): boolean

Determine if this _RunResult_ is equal to another result. To be equal, they must have exactly the same results, with the same name, filename, status, error message, and timeout. However, error renders are ignored, which means that stack traces and other error details are ignored. 

[Back to top](#automation-api)


## RunResult.pass()

* RunResult.pass(options): [RunResult](#runresult)

A factory method for creating passing [RunResult](#runresult) instances. You aren't likely to need this method. It takes the following options object:

* _name: string[]:_ Same as [runResult.name](#runresultname).
* _filename?: string:_ Same as [runResult.filename](#runresultfilename).

[Back to top](#automation-api)


## RunResult.fail()

* RunResult.fail(options): [RunResult](#runresult)

A factory method for creating failing [RunResult](#runresult) instances. You aren't likely to need this method. It takes the following options object:

* _name: string[]:_ Same as [runResult.name](#runresultname).
* _filename?: string:_ Same as [runResult.filename](#runresultfilename).
* _error: unknown:_ The error that caused the failure. It will be used to generate [runResult.errorMessage](#runresulterrormessage) and [runResult.errorRender](#runresulterrorrender).
* _renderError: [RenderErrorFn](#rendererrorfn):_ A function to convert _error_ into a string. The output of the function will be stored in [runResult.errorRender](#runresulterrorrender). 

[Back to top](#automation-api)


## RunResult.skip()

* RunResult.skip(options): [RunResult](#runresult)

A factory method for creating passing [RunResult](#runresult) instances. You aren't likely to need this method. It takes the following options object:

* _name: string[]:_ Same as [runResult.name](#runresultname).
* _filename?: string:_ Same as [runResult.filename](#runresultfilename).

[Back to top](#automation-api)


## RunResult.timeout()

* RunResult.timeout(options): [RunResult](#runresult)

A factory method for creating passing [RunResult](#runresult) instances. You aren't likely to need this method. It takes the following parameters:

* _name: string[]:_ Same as [runResult.name](#runresultname).
* _filename?: string:_ Same as [runResult.filename](#runresultfilename).
* _timeout: number:_ Same as [runResult.timeout](#runresulttimeout).

[Back to top](#automation-api)


---


## TestResult

* import { TestResult } from "ergotest"

The abstract parent class of [TestSuiteResult](#testsuiteresult) and [TestCaseResult](#testcaseresult).


## TestStatus

* import { TestStatus } from "ergotest"

An “enum” object with the following options:

* `pass`: for tests that passed
* `fail`: for tests that failed
* `skip`: for tests that were skipped
* `timeout`: for tests that timed out

[Back to top](#automation-api)


## TestStatusValue

* import { TestStatusValue } from "ergotest"

A type for the possible values of [TestStatus](#teststatus).

[Back to top](#automation-api)


## TestMark

* import { TestMark } from "ergotest"

An “enum” object with the following options:

* `only`: for tests and suites that were defined with `.only`
* `skip`: for tests and suites that were defined with `.skip` or defined without a body
* `none`: for all other tests and suites

[Back to top](#automation-api)


## TestMarkValue

* import { TestMarkValue } from "ergotest"

A type for the possible values of [TestMark](#testmark).

[Back to top](#automation-api)


## RenderErrorFn

* import { RenderErrorFn } from "ergotest"
* (name: string[], error: unknown, mark: TestMarkValue, filename?: string) => unknown;

A type for custom error rendering. It takes the following parameters: 

* _names:_ Same as [testCaseResult.name](#testcaseresultname).
* _error:_ The error that caused the test to fail. Although it's usually an `Error` instance, it could be any data type, including a string.
* _mark:_ Same as [testCaseResult.mark](#testcaseresultmark).
* _filename:_ Same as [testCaseResult.filename](#testcaseresultfilename).

See the [Reporting API](reporting_api.md) for more about custom error rendering.

[Back to top](#automation-api)


