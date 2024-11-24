# Ergotest Change Log


## v0.3.x: Default timeout

* **0.3.0, 24 Nov 2024:** The default timeout can now be configured when running tests.

This is an additive, non-breaking change to [TestOptions](docs/automation_api.md#testoptions). The following APIs are affected:

* [testRunner.runInChildProcessAsync()](docs/automation_api.md#testrunnerruninchildprocessasync)
* [testRunner.runInCurrentProcessAsync()](docs/automation_api.md#testrunnerrunincurrentprocessasync)
* [testSuite.runAsync()](docs/automation_api.md#testsuiterunasync)

**Example:**

```javascript
// set default timeout to five seconds
const result = await TestRunner.create().runInChildProcessAsync(files, { timeout: 5000 });
```


## v0.2.x: Test definition imports (BREAKING CHANGE)

* **0.2.0, 9 Nov 2024:** Move test definition functions from suite parameters to imports.

**Old way:**

```javascript
import { assert, test } from "ergotest";

export default test(({ describe, it, beforeAll, afterAll, beforeEach, afterEach }) => {
  // tests go here
});
```

**New way:**

```javascript
import { assert, test, describe, it, beforeAll, afterAll, beforeEach, afterEach } from "ergotest";

export default test(() => {
  // tests go here
});
```

## v0.1.x: Initial release

* **0.1.3, 9 Nov 2024:** 'Expected' and 'Actual' Regexes render properly when tests are run in child process 
* **0.1.2, 6 Nov 2024:** Change expected Node version to range with minimum of 22.11.0 (latest LTS)
* **0.1.1, 13 Oct 2024:** Remove reliance on development dependencies in production code
* **0.1.0, 13 Oct 2024:** Initial release
