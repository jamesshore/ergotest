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
* [assert.fail()](#assertfail)
* [assert.todo()](#asserttodo)
* [assert.identity()](#assertidentity)
* [assert.notIdentity()](#assertnotidentity)
* [assert.equal()](#assertequal)
* [assert.notEqual()](#assertnotequal)
* [assert.isDefined()](#assertisdefined)
* [assert.isUndefined()](#assertisundefined)
* [assert.isNull()](#assertisnull)
* [assert.isNotNull()](#assertisnotnull)
* [assert.isTrue()](#assertistrue)
* [assert.isFalse()](#assertisfalse)
* [assert.atLeast()](#assertatleast)
* [assert.atMost()](#assertatmost)
* [assert.between()](#assertbetween)
* [assert.type()](#asserttype)
* [assert.match()](#assertmatch)
* [assert.matchesGroup()](#assertmatchesgroup)
* [assert.includes()](#assertincludes)
* [assert.notIncludes()](#assertnotincludes)
* [assert.error()](#asserterror)
* [assert.notError()](#assertnoterror)
* [assert.errorAsync()](#asserterrorasync)
* [assert.notErrorAsync()](#assertnoterrorasync)

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


## assert.fail()

* assert.fail(message: string): never

Fails with the provided message.

[Back to top](#assertion-api)


## assert.todo()

* assert.todo(message?: string): never

Fails with `TODO: ` and the provided message, or just `TODO` if there is no message.

[Back to top](#assertion-api)


## assert.identity()

* assert.identity(actual: unknown, expected: unknown, message?: string)

Fails if `actual` and `expected` don't have the reference. Works for objects, arrays, and functions. Fails if used to compare anything else, including `null`.

[Back to top](#assertion-api)


## assert.notIdentity()

* assert.

[Back to top](#assertion-api)


## assert.equal()

* assert.

[Back to top](#assertion-api)


## assert.notEqual()

* assert.

[Back to top](#assertion-api)


## assert.isDefined()

* assert.

[Back to top](#assertion-api)


## assert.isUndefined()

* assert.

[Back to top](#assertion-api)


## assert.isNull()

* assert.

[Back to top](#assertion-api)


## assert.isNotNull()

* assert.

[Back to top](#assertion-api)


## assert.isTrue()

* assert.

[Back to top](#assertion-api)


## assert.isFalse()

* assert.

[Back to top](#assertion-api)


## assert.atLeast()

* assert.

[Back to top](#assertion-api)


## assert.atMost()

* assert.

[Back to top](#assertion-api)


## assert.between()

* assert.

[Back to top](#assertion-api)


## assert.type()

* assert.

[Back to top](#assertion-api)


## assert.match()

* assert.

[Back to top](#assertion-api)


## assert.matchesGroup()

* assert.

[Back to top](#assertion-api)


## assert.includes()

* assert.

[Back to top](#assertion-api)


## assert.notIncludes()

* assert.

[Back to top](#assertion-api)


## assert.error()

* assert.

[Back to top](#assertion-api)


## assert.notError()

* assert.

[Back to top](#assertion-api)


## assert.errorAsync()

* assert.

[Back to top](#assertion-api)


## assert.notErrorAsync()

* assert.

[Back to top](#assertion-api)

