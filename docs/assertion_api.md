# Assertion API

Use the assertion API inside your tests.


Links to other documentation:

* [Test API](test_api.md)
* Assertion API
* [Automation API](automation_api.md)
* [README](../README.md)
* [Changelog](../CHANGELOG.md)
* [Roadmap](../ROADMAP.md)

In this document:

* [Start Here](#start-here)
* 

## Start Here

If you’d like to use Ergotest’s built-in assertion library, this document describes how it works. But you don’t have to. Ergotest works with any assertion library that throws an exception on failure.

Start by making a `tests.ts` (or `tests.js`) wrapper that re-exports the assertion library of your choice. The [test API documentation](test_api.md) has the details, but here’s how you use Ergotest’s assertion library:

```typescript
// tests.ts
import { TestSuite } from "ergotest/test_suite.js";

export const test = TestSuite.create;
export * as assert from "ergotest/assert.js";
```

Use it in your tests like this:

```typescript
import { test, assert } from "tests.js";

export default test(() => {
  
  // tests go here
  
});
```

As your codebase matures, look for opportunities to add assertions that are specific to your codebase. Create your own `assert.ts` (or `assert.js`) for those assertions:

```typescript
// assert.ts
export * from "ergotest/assert.js";

export function myCoolAssertion() {...}
```

And modify `tests.ts` to use it:

```typescript
// tests.ts
import { TestSuite } from "ergotest/test_suite.js";

export const test = TestSuite.create;
export * as assert from "./assert.js";
```

The remainder of this document describes the assertions in `ergotest/assert.js`.

[Back to top](#assertion-api)


## assert.fail
## assert.todo
## assert.equal
## assert.notEqual