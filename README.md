# Ergotest

*I think, therefore I test*

Ergotest (pronounced *air-go-test)* is a Node.js library for writing and running tests. It emphasizes speed, functionality, and simplicity. It has a superb, well-documented automation API. It has all the features you need and none of the complexity you don't.

## Documentation

* [Quick start](#quick-start) - Start here
* [Test API](docs/test_api.md) - How to write your tests
* [Assertion API](docs/assertion_api.md) - How to make assertions
* [Automation API](docs/automation_api.md) - How to run your tests
* [Reporting API](docs/reporting_api.md) - How to customize your test output
* [Changelog](CHANGELOG.md)
* [Roadmap](ROADMAP.md)

## Why build yet another testing library?

I built Ergotest because I wanted a tool I could automate easily. Compared to other testing tools, Ergotest is:

* Designed for automation, with an easy-to-use automation API
* Thoroughly documented and easy to understand
* Small and dependency-free (easy to audit!)
* Straightforward, reliable, and fast

Despite its size, Ergotest is a modern test library with support for all the most important features:

* Supports TypeScript, JavaScript, and ES Modules
* TypeScript types and JSDoc documentation
* `describe()` for test suites, `it()` for tests (easily renamed, if you wish)
* `beforeAll()`, `afterAll()`, `beforeEach()`, `afterEach()`
* `.only` and `.skip` to select tests; they work across files and nest cleanly
* `async/await` for asynchronous code
* `getConfig()` makes custom configuration available within tests
* Includes a nice assertion library if you want it; compatible with any assertion library if you don’t
* Timeouts, infinite loop detection, and uncaught exception detection
* Test isolation using child processes
* Concise, readable test output that's easy to customize

Ergotest works particularly well with [Automatopia](https://github.com/jamesshore/automatopia). Together, they provide sophisticated build automation that automatically lints, compiles, and tests real-world TypeScript code in about half a second. 


## Wait for v1.0?

Although Ergotest is battle-tested, I'm still refining the API. It’s possible there will be some breaking API changes, although they shouldn't be significant. The test API is stable and very unlikely to change. Even so, until v1.0 is released, everything is subject to change. You might want to wait.


## Example Tests

```javascript
import { assert, describe, it } from "ergotest";
import { hello } from "./hello.js";

export default describe(() => {

  it("runs tests", async () => {
    assert.equal(await hello.world(), "hello world");
  });
  
  describe("sub-suite", async () => {
    it("placeholder test");
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

Ergotest is designed to be run using its API, not from the command line. You're expected to integrate it into your automated build. If you don’t have an automated build, try [Automatopia](https://github.com/jamesshore/automatopia), or use the starting point provided below. 


## Quick Start

### Installation

```shell
npm install --save-dev ergotest 
```

### 1. Isolate Ergotest

Isolate your tests from Ergotest by creating a `tests.js` file. This allows you to easily customize or replace Ergotest in the future:

```javascript
// tests.js
export * from "ergotest";
```

### 2. Write a test

Write a simple test:

```javascript
// example.test.js
import { assert, describe, it } from "./tests.js";

export default describe(() => {
  
  it("runs tests", () => {
    assert.equal(2 + 2, 4);
  });
  
});
```

### 3. Add to your build

Use Ergotest's API to run tests from your automated build. For now, create a simple `build.js` file:

```javascript
import { TestRunner } from "ergotest";
import path from "node:path";

const args = process.argv.slice(2);
const files = args.map(arg => path.resolve(process.cwd(), arg));

process.stdout.write("Running tests: ");
const result = await TestRunner.create().runInChildProcessAsync(files, { onTestCaseResult: reportProgress });
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


## License

MIT License. See [LICENSE.TXT](LICENSE.TXT).
