# Ergotest

*I think, therefore I test*

Ergotest (pronounced *air-go-test*) is a library for writing and running tests. It emphasizes speed, functionality, and simplicity. It has a superb, well-documented Node API. It has all the features you need and none of the complexity you don't.


## Why build yet another testing library?

I care deeply about fast feedback. If the build takes longer than half a second, I notice. When it takes longer than a second, I’m frustrated. And when it takes longer than five seconds, I’m unhappy.

In my production code, I kept running into problems with slow builds. I responded by creating the build automation that eventually became [Automatopia](https://github.com/jamesshore/automatopia). But I kept running into problems with test frameworks. They were designed to be run from the command-line, stealing valuable milliseconds, and they didn’t make it easy to write a fast, incremental build that could interoperate with other tools. So I said, “Screw it! How hard could it be?” It worked out. Years later, I decided to open-source my test library, and here we are. 

Ergotest is a battletested library that I’ve used for years in my own production codebases. Compared to other testing tools, Ergotest is:

* Simple to understand with a great automation API
* Small and easy to audit, with no dependencies
* Very fast

Despite its size, Ergotest is a modern test library with support for all the most important features:

* Supports TypeScript, JavaScript, and ES Modules
* `describe()` for test suites, `it()` for tests
* `beforeAll()`, `afterAll()`, `beforeEach()`, `afterEach()`
* `.only` and `.skip` work across files and nest cleanly
* `async / await` for asynchronous code
* Includes a nice assertion library if you want it; compatible with any assertion library if you don’t
* Timeouts, infinite loop detection, and uncaught exception detection
* Test configuration provided to tests (useful for integration tests)
* Test isolation using child processes
* Concise, readable test output that's easy to customize
* TypeScript types and JSDoc documentation

Ergotest works particularly well with [Automatopia](https://github.com/jamesshore/automatopia). Together, they provide sophisticated build automation that automatically lints, compiles, and tests my code in about 0.2 seconds. 


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

Ergotest is designed for experienced practitioners using test-driven development. It's designed to be used by people who want:

* **fast unit tests**, not slow end-to-end tests
* **reliable tests**, not flaky tests
* **composable libraries**, not do-everything frameworks
* **[Nullables](https://www.jamesshore.com/s/nullables)** or hand-rolled test doubles, not mocking libraries
* **Node APIs**, not command-line tools

Features needed by slow, flaky test suites are deliberately excluded, as are features for auto-mocking.

Ergotest doesn't include a command-line tool. You're expected to integrate it into your automated build, as shown below.


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

export default test(() => {
	
	it("runs tests", () => {
		assert.equal(2 + 2, 4);
  });
	
});
```

### 3. Create a test runner

Use Ergotest's API to run tests from your automated build. For now, create a simple `build.js` file:

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

For more advanced builds, consider using [Automatopia](https://github.com/jamesshore/automatopia), which supports Ergotest out of the box. It includes features such as file globs, file watching, incremental testing, linting, and TypeScript compilation. (It’s also ridiculously fast, clocking at a fraction of a second in most cases.)

### 4. Run your tests

Run your tests:

```shell
node --enable-source-maps build.js *.test.js
```

(The `--enable-source-maps` option causes Node to render TypeScript stack traces correctly.)

For more information, see the documentation below.


## Documentation

* [Test API](docs/test_api.md)
* Assertion API
* Automation API
* Changelog


## License

MIT License. See [LICENSE.TXT](LICENSE.TXT).


