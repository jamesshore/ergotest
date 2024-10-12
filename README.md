# Ergotest

*I think, therefore I test*

Ergotest (pronounced *air-go-test*) is a library for writing and running tests. It emphasizes speed, functionality, and simplicity. It has a superb, well-documented Node API. It has all the features you need and none of the complexity you don't.


## Features

* Supports TypeScript, JavaScript, and ES Modules
* `describe()` for test suites, `it()` for tests
* `beforeEach(), afterEach(), beforeAll(), afterAll()`
* `.only` to run specific tests and `.skip` to skip tests; they work across files and nest cleanly
* `async / await` for asynchronous code
* Timeouts, infinite loop detection, and uncaught exception detection
* Test configuration provided from build to tests
* Test isolation using child processes
* Concise, readable test output that's easy to customize
* Shows which tests are marked with `.only` or `.skip`
* Clean, well-documented API
* Small and easy to audit, with no dependencies


## Example Test

```javascript
// Write your own "/tests.js" by re-exporting the Ergotest API. This allows
// you to swap out parts of Ergotest in the future if you like. You can use
// Ergotest's built-in assertion library or use a library such as Chai.
import { assert, test } from "/tests.js";
import { hello } from "./hello.js";

// The test() function returns a TestSuite.
export default test(() => {

  it("runs tests", async () => {
    assert.equal(await hello.world(), "hello world");
  });

});
```

Example `/tests.js`. This isolates Ergotest, allowing you to customize or replace it without changing all your tests:

```javascript
export * from "ergotest";
```


## Prerequisites

Ergotest is designed for experienced practitioners using test-driven development. It's designed to be used by people who want:

* **fast unit tests**, not slow end-to-end tests
* **reliable tests**, not flaky tests
* **composable libraries**, not do-everything frameworks
* **[Nullables](https://www.jamesshore.com/s/nullables)** or hand-rolled test doubles, not mocking libraries
* **Node APIs**, not command-line tools

Features for slow, flaky tests are deliberately excluded, as are features for auto-mocking.

Ergotest doesn't include a command-line tool. You're expected to integrate it into your automated build, as shown below.


## Example Build

Use Ergotest's API to run tests from your automated build. If you don't have an automated build, the following example will get you started. 

For more advanced builds, consider using [Automatopia](https://github.com/jamesshore/automatopia) instead, which supports Ergotest out of the box. It includes features such as file globs, file watching, incremental testing, linting, and TypeScript compilation. (It’s also ridiculously fast, clocking in at a fraction of a second in most cases.)

```javascript
import { TestRunner } from "ergotest/test_runner.js";
import path from "node:path";

const args = process.argv.slice(2);
const files = args.map(arg => path.resolve(process.cwd(), arg));

const result = await TestRunner.create().runInChildProcessAsync(files, { notifyFn: reportProgress });
console.log("\n" + result.render());

function reportProgress(testCase) {
  process.stdout.write(testCase.renderAsCharacter());
}
```

Save the above as `build.js` and run it as follows:

```shell
node --enable-source-maps build.js *.test.js
```

(The `--enable-source-maps` option causes Node to render TypeScript stack traces correctly.)


## Documentation

* Test API
* Assertion API
* Test Runner API
* Changelog


## License

MIT License. See [LICENSE.TXT](LICENSE.TXT).


