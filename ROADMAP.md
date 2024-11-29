# Ergotest Roadmap

Links to other documentation:

* [Test API](test_api.md)
* [Assertion API](assertion_api.md)
* [Automation API](automation_api.md)
* [Readme](./README.md)
* [Changelog](./CHANGELOG.md)
* **Roadmap**

## Road to 1.0

Although I’ve been using Ergotest for many years, I’m planning to make a few breaking API changes prior to releasing v1.0. Most of these changes are to make Ergotest compatible with a subset of [Vitest](https://vitest.dev/). That makes trying Ergotest lower risk: you can give it a try and switch to Vitest later if it doesn’t do what you want. 

* ✅ **Better test API.** Currently, `describe()`, `it()`, `beforeXxx()`, and `afterXxx()` are passed in as parameters to the test suite function. This is awkward and has some footguns. I’d like to you to be able to just import them like you do in Vitest.  
* ✅ **Better timeout handling.** Currently, timeouts are set by a `setTimeout()` method provided to the test suite function. Vitest takes a `{ timeout }` parameter instead. That’s cleaner and more flexible. I’d like to do the same.
* ✅ **Rename notifyFn.** The test runner takes a `notifyFn()` parameter. I should probably rename that to something like `onTestCaseResult()`.
* **Remove clock.** The test runner takes an undocumented `clock` parameter. This was a hack I used for testing. I’d like to clean it up, if possible.
* **Perform error rendering in child process.** Failed test results currently include the error that caused the test to fail. The expected and actual results are rendered by the caller, not in the test worker, which typically runs in a child process. Unfortunately, some objects don't serialize properly, resulting in a diff that's missing data. I'll need to move the rendering into the child process to fix the problem.
* **Detect non-exit.** Detect if a test puts something on the event loop that would prevent the process from exiting when using TestRunner.runInChildProcessAsync(). 
* **Fix orphaned processes.** The watch script appears to leave orphaned Node processes running in some situations, even after the script exits. I’m not sure if this is an `ergotest` problem or an `automatopia` problem. Either way, it needs to be fixed.


## Road to “fully baked”

My goal is for Ergo to reach the point where it’s “fully baked” and not incorporating new features. Here’s what I’d like to finish before declaring it “done:”

* **Detect early exit.** Detect if a test calls process.exit() when using TestRunner.runInChildProcessAsync(). Current behavior is to hang.
* **TypeScript stack highlighting.** Ergotest highlights the test in failure stack traces for JavaScript. I’d like that to work for TypeScript too.
* ✅ **Configurable default timeout.** The default timeout is hardcoded to two seconds. I’d like that to be configurable.
* **Add a 'no body' mark.** Right now, suites and tests without bodies are considered to be the same as `.skip`. I'd like them to be identified separately, so builds can render them differently.
* **Parallel test runs.** This isn’t that high on my list, given that my tests run in a matter of seconds, and [Automatopia’s](https://github.com/jamesshore/automatopia) incremental watch script brings that down to a fraction of a second, but it would be good for bragging rights.
  * Specifically, I want to spawn multiple child processes and have them each process one test module at time off of a shared queue. 
  * This isn't that hard, given that we already use a child process to run the tests. The main challenge is that we need to ensure that `.only` still works across files.
* **Child process pre-warming.** Spinning up a child process takes about 50ms on my M1 MacBook Pro. If we have multiple child processes, that cost becomes substantial. I’d like to add a method to `TestRunner` that allows watch scripts to spin up the child processes in advance.
  * This will make [Automatopia](https://github.com/jamesshore/automatopia) builds run in about 0.05s in the typical case, most of which will be linting costs, which is frankly faster than it needs to be. But it’s fun for bragging rights.
* **Better error diffs.** I’d like to make it easier to see the differences between `expected` and `actual`, particularly for long strings and large objects. The current algorithm works surprisingly well for how simple it is, but it breaks down when a value is inserted or removed from the middle of the results.
* **A few more assertions.** There’s probably a few more assertions that would be useful, especially a “compare in any order” assertion.


## Out of Scope

I’m opposed to including the following features:

* **Automocking support.** Try [Nullables](https://www.jamesshore.com/s/nullables) instead.
* **expect().** Use a third-party assertion library.
* **Parameterized tests.** Write helper functions instead.
* **Rerunning failing tests.** Fix flaky tests. [Nullables](https://www.jamesshore.com/s/nullables) could help.
* **Command-line interface.** Take the example and make it your own, or use [Automatopia](https://github.com/jamesshore/automatopia).
* **Benchmarking.** Use a dedicated benchmarking tool.
* **Code coverage.** [Don't measure unit test code coverage.](https://www.jamesshore.com/v2/blog/2019/dont-measure-unit-test-code-coverage)
