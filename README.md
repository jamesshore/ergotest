# Ergotest

*I think, therefore I test*

Ergotest (pronounced *air-go-test*) is a Node.js library for writing and running tests. It emphasizes speed, functionality, and simplicity. It has a superb, well-documented automation API. It has all the features you need and none of the complexity you don't.


## Why build yet another testing library?

I care deeply about fast feedback. If the build takes longer than half a second, I notice. When it takes longer than a second, I’m unhappy. And when it takes longer than five seconds, I’m frustrated.

In my production code, I kept running into problems with slow builds. I responded by creating the build automation that eventually became [Automatopia](https://github.com/jamesshore/automatopia). But test frameworks were a problem. They were designed to be run from the command-line, stealing valuable milliseconds, and they didn’t make it easy to interoperate with other tools. After fighting with them for a several years, I said, “Screw it! How hard could it be to write my own?” (Not that hard, as it turns out.) I eventually decided to open-source my solution, and here we are. 

Ergotest is a battletested library that I’ve used for years in my own production codebases. Compared to other testing tools, Ergotest is:

* Simple to understand with a great automation API
* Small and easy to audit, with no dependencies
* Very fast

Despite its size, Ergotest is a modern test library with support for all the most important features:

* Supports TypeScript, JavaScript, and ES Modules
* `describe()` for test suites, `it()` for tests
* `beforeAll()`, `afterAll()`, `beforeEach()`, `afterEach()`
* `.only` and `.skip` to select tests; they work across files and nest cleanly
* `async / await` for asynchronous code
* Includes a nice assertion library if you want it; compatible with any assertion library if you don’t
* Timeouts, infinite loop detection, and uncaught exception detection
* Test configuration provided to tests (useful for integration tests)
* Test isolation using child processes
* Concise, readable test output that's easy to customize
* TypeScript types and JSDoc documentation

Ergotest works particularly well with [Automatopia](https://github.com/jamesshore/automatopia). Together, they provide sophisticated build automation that automatically lints, compiles, and tests my TypeScript code in about 0.2 seconds. 


## Wait for v1.0

Although Ergotest is battle-tested, it’s got some idiosyncracies. I'm still refining the API to make it more suitable for maintstream use. Until v1.0 is released, everything is subject to change, so you might want to wait.


## Example Test

```javascript
import { assert, test } from "ergotest";
import { hello } from "./hello.js";

export default test(() => {

  it("runs tests", async () => {
    assert.equal(await hello.world(), "hello world");
  });

});
```


## Limitations

Ergotest is for **Node.js only**. It uses Node.js APIs and won’t work in the browser.

Other than that, Ergotest is designed for experienced practitioners using test-driven development. Several popular features are deliberately excluded, and are unlikely to ever be added:

* **no auto-mocking**
* **no automatic retries**
* **no parameterized tests**
* **no test coverage**
* **no benchmarking**

Ergotest also doesn't include a command-line tool. You're expected to integrate it into your automated build. If you don’t have an automated build, try [Automatopia](https://github.com/jamesshore/automatopia), or use the starting point provided below. 


## Quick Start

### 1. Isolate Ergotest

Isolate your tests from Ergotest by creating a `tests.js` file. This allows you to easily customize or replace Ergotest in the future:

```javascript
// tests.js
import { TestSuite } from "ergotest/test_suite.js";

export const test = TestSuite.create;
export * as assert from "ergotest/assert.js";
```

### 2. Write a test

Write a simple test:

```javascript
// example.test.js
import { assert, test } from "./tests.js";

export default test(({ it }) => {
  
  it("runs tests", () => {
    assert.equal(2 + 2, 4);
  });
  
});
```

### 3. Create a command-line interface

Use Ergotest's API to run tests from your automated build. For now, create a simple `build.js` file:

```javascript
import { TestRunner } from "ergotest/test_runner.js";
import path from "node:path";

const args = process.argv.slice(2);
const files = args.map(arg => path.resolve(process.cwd(), arg));

process.stdout.write("Running tests: ");
const result = await TestRunner.create().runInChildProcessAsync(files, { notifyFn: reportProgress });
console.log("\n" + result.render("\n") + "\n");

function reportProgress(testCase) {
  process.stdout.write(testCase.renderAsCharacter());
}
```

For more advanced builds, consider using [Automatopia](https://github.com/jamesshore/automatopia), which supports Ergotest out of the box. It includes features such as file globs, file watching, incremental testing, linting, and TypeScript compilation. (It’s also ridiculously fast, clocking at a fraction of a second in most cases.)

### 4. Run your tests

Run your tests:

```shell
node --enable-source-maps build.js *.test.js
```

(The `--enable-source-maps` option causes Node to render TypeScript stack traces correctly.)

For more information, see the documentation below.


## Documentation

* [Test API](docs/test_api.md) - How to write your tests
* [Assertion API](docs/assertion_api.md) - How to make assertions
* [Automation API](docs/automation_api.md) - How to run your tests
* [Changelog](CHANGELOG.md)
* [Roadmap](ROADMAP.md)


## License

MIT License. See [LICENSE.TXT](LICENSE.TXT).
