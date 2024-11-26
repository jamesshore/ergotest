# Ergotest Change Log


## v0.5.x: Timeout option (BREAKING CHANGE)

* **0.5.0, 24 Nov 2024:** Timeouts can now be defined at the test and before/after level, not just the suite level. Timeouts are now configured declaratively rather than with a function call. 

This is a breaking change for these APIs:

* [test()](docs/test_api.md#test)
* [describe()](docs/test_api.md#describe)

This is an additive, non-breaking change for these APIs:

* [it()](docs/test_api.md#it)
* [beforeAll()](docs/test_api.md#beforeall)
* [afterAll()](docs/test_api.md#afterall)
* [beforeEach()](docs/test_api.md#beforeeach)
* [afterEach()](docs/test_api.md#aftereach)

**Old way:**

```javascript
describe(({ setTimeout }) => {
  setTimeout(10000);
  
  it("doesn't time out", async () => {
    await new Promise(resolve => setTimeout(resolve, 8000));
  });
});
```

**New way:**

```javascript
describe({ timeout: 10000 }, () => {
  it("doesn't time out", async () => {
    await new Promise(resolve => setTimeout(resolve, 8000));
  });
});
```

*(or)*

```javascript
describe(() => {
  it("doesn't time out", { timeout: 10000 }, async () => {
    await new Promise(resolve => setTimeout(resolve, 8000));
  });
});
```



## v0.4.x: Default timeout

* **0.4.1, 24 Nov 2024:** Documentation fix (update changelog to reflect correct version number)
* **0.4.0, 24 Nov 2024:** The default timeout can now be configured when running tests.

This is an additive, non-breaking change to [TestOptions](docs/automation_api.md#testoptions). The following APIs are affected:

* [testRunner.runInChildProcessAsync()](docs/automation_api.md#testrunnerruninchildprocessasync)
* [testRunner.runInCurrentProcessAsync()](docs/automation_api.md#testrunnerrunincurrentprocessasync)
* [testSuite.runAsync()](docs/automation_api.md#testsuiterunasync)

**Example:**

```javascript
// set default timeout to five seconds
const result = await TestRunner.create().runInChildProcessAsync(files, { timeout: 5000 });
```


## v0.3.x: (skipped)

This version was accidentally skipped.


## v0.2.x: Test definition imports (BREAKING CHANGE)

* **0.2.0, 9 Nov 2024:** Move test definition functions from suite parameters to imports.

**Old way:**

```javascript
import { assert, test } from "ergotest";

export default describe(({ describe, it, beforeAll, afterAll, beforeEach, afterEach }) => {
  // tests go here
});
```

**New way:**

```javascript
import { assert, describe, it, beforeAll, afterAll, beforeEach, afterEach } from "ergotest";

export default describe(() => {
  // tests go here
});
```

## v0.1.x: Initial release

* **0.1.3, 9 Nov 2024:** 'Expected' and 'Actual' Regexes render properly when tests are run in child process 
* **0.1.2, 6 Nov 2024:** Change expected Node version to range with minimum of 22.11.0 (latest LTS)
* **0.1.1, 13 Oct 2024:** Remove reliance on development dependencies in production code
* **0.1.0, 13 Oct 2024:** Initial release
