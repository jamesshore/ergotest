# Ergotest Change Log


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
