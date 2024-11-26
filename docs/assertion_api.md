# Assertion API

Use the assertion API inside your tests.

Links to other documentation:

* [Test API](test_api.md)
* **Assertion API**
* [Automation API](automation_api.md)
* [Readme](../README.md)
* [Changelog](../CHANGELOG.md)
* [Roadmap](../ROADMAP.md)

In this document **(the bold entries are the most useful)**:

* **[Start Here](#start-here)**
* **[assert.fail()](#assertfail)**
* **[assert.todo()](#asserttodo)**
* [assert.identity()](#assertidentity)
* [assert.notIdentity()](#assertnotidentity)
* **[assert.equal()](#assertequal)**
* [assert.notEqual()](#assertnotequal)
* [assert.dotEquals()](#assertdotequals)
* [assert.notDotEquals()](#assertnotdotequals)
* [assert.isDefined()](#assertisdefined)
* [assert.isUndefined()](#assertisundefined)
* [assert.isNull()](#assertisnull)
* [assert.isNotNull()](#assertisnotnull)
* [assert.isTrue()](#assertistrue)
* [assert.isFalse()](#assertisfalse)
* [assert.atLeast()](#assertatleast)
* [assert.atMost()](#assertatmost)
* [assert.between()](#assertbetween)
* [assert.match()](#assertmatch)
* [assert.matchesGroup()](#assertmatchesgroup)
* [assert.includes()](#assertincludes)
* [assert.notIncludes()](#assertnotincludes)
* **[assert.error()](#asserterror)**
* [assert.notError()](#assertnoterror)
* **[assert.errorAsync()](#asserterrorasync)**
* [assert.notErrorAsync()](#assertnoterrorasync)
* [assert.type()](#asserttype)

## Start Here

If you’d like to use Ergotest’s built-in assertion library, this document describes how it works. But you can use any assertion library that throws an exception on failure.

Start by making a `tests.ts` (or `tests.js`) wrapper that re-exports the assertion library of your choice. The [test API documentation](test_api.md) has more details, but here’s how you use Ergotest’s assertion library:

```typescript
// tests.ts
export * from "ergotest"; 
```

Use it in your tests like this:

```typescript
import { assert, describe, it } from "tests.js";

export default describe(() => {
  
  it("my test", () => {
    assert.equal(2 + 2, 4);
  });
  
});
```

As your codebase matures, look for opportunities to add assertions that are specific to your needs. Create your own `assert.ts` (or `assert.js`) for those assertions:

```typescript
// assert.ts
export * from "ergotest/assert.js";

export function myCoolAssertion() {...}
```

And modify `tests.ts` to export it:

```typescript
// tests.ts
export { describe, it, beforeAll, afterAll, beforeEach, afterEach } from "ergotest";
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

Fails if `actual` and `expected` don't have the same reference. Works for objects, arrays, and functions. Fails if used to compare anything else, including `null`.

[Back to top](#assertion-api)


## assert.notIdentity()

* assert.notIdentity(actual: unknown, expected: unknown, message?: string)

Fails if `actual` and `expected` have the same reference. Works for objects, arrays, and functions. Fails if used to compare anything else, including `null`.

[Back to top](#assertion-api)


## assert.equal()

* assert.equal(actual: unknown, expected: unknown, message?: string)

Fails if `actual` and `expected` don’t have the same contents, with no type coercion. Performs a deep comparison, so if you’re comparing objects, they’ll pass if they have the same contents.

To compare object references rather than contents, use [assert.identity](#assertidentity) instead. 

Examples:

```typescript
assert.equal("abc", "abc");   // passes
assert.equal("123", 123);     // fails
assert.equal({ abc: 123 }, { abc: 123 });   // passes
assert.equal({ abc: 123 }, { abc: "123" }); // fails
```

[Back to top](#assertion-api)


## assert.notEqual()

* assert.notEqual(actual: unknown, expected: unknown, message?: string)

Fails if `actual` and `expected` have the same contents, with no type coercion. Performs a deep comparison, so if you’re comparing objects, they’ll fail if they have the same contents.

To compare object references rather than contents, use [assert.notIdentity](#assertnotidentity) instead. 

Examples:

```typescript
assert.equal("abc", "abc");   // fails
assert.equal("123", 123);     // passes
assert.equal({ abc: 123 }, { abc: 123 });   // fails
assert.equal({ abc: 123 }, { abc: "123" }); // passes
```

[Back to top](#assertion-api)


## assert.dotEquals()

* assert.dotEquals(actual: unknown, expected: unknown, message?: string)

Calls `expected.equals(actual)` and fails if the return value is false.

[Back to top](#assertion-api)


## assert.notDotEquals()

* assert.notDotEquals(actual: unknown, expected: unknown, message?: string)

Calls `expected.equals(actual)` and fails if the return value is true. 

[Back to top](#assertion-api)


## assert.isDefined()

* assert.isDefined(actual: unknown, message?: string)

Fails if `actual` is `undefined`.

[Back to top](#assertion-api)


## assert.isUndefined()

* assert.isUndefined(actual: unknown, message?: string)

Fails if `actual` is not `undefined`.

[Back to top](#assertion-api)


## assert.isNull()

* assert.isNull(actual: unknown, message?: string)

Fails if `actual` is not `null`.

[Back to top](#assertion-api)


## assert.isNotNull()

* assert.isNotNull(actual: unknown, message?: string)

Fails if `actual` is `null`.

[Back to top](#assertion-api)


## assert.isTrue()

* assert.isTrue(actual: unknown, message?: string)

Fails if `actual` is not `true`. Must be literally `true`; ”truthy” values are not enough.

[Back to top](#assertion-api)


## assert.isFalse()

* assert.isFalse(actual: unknown, message?: string)

Fails if `actual` is not `false`. Must be literally `false`; “falsey” values are not enough.

[Back to top](#assertion-api)


## assert.atLeast()

* assert.atLeast(actual: unknown, expected: unknown, message?: string)

Fails if `actual` is less than `expected`. Uses the `<` operator, so types will be coerced to numbers by calling `valueOf()`, if it exists. This allows you to do things such as comparing `Date` objects.

[Back to top](#assertion-api)


## assert.atMost()

* assert.atMost(actual: unknown, expected: unknown, message?: string)

Fails if `actual` is greater than `expected`. Uses the `>` operator, so types will be coerced to numbers by calling `valueOf()`, if it exists. This allows you to do things such as comparing `Date` objects.

[Back to top](#assertion-api)


## assert.between()


* assert.between(actual: unknown, min: unknown, max: unknown, message?: string)

Fails if `actual` is less than `min` or greater than `max`. Uses the `<` and `>` operators, so types will be coerced to numbers by calling `valueOf()`, if it exists. This allows you to do things such as comparing `Date` objects.

[Back to top](#assertion-api)


## assert.match()

* assert.match(actual: string, expected: RegExp, message?: string)

Checks to see if `actual` matches the `expected` regular expression. Fails if `actual` is not a string or `expected` is not a regular expression.

For better assertion errors when comparing large strings, consider using [assert.matchesGroup()](#assertmatchesgroup) instead.

Examples:

```typescript
assert.matches("abc", /b/);   // passes
assert.matches("abc", /x/);   // fails
```

[Back to top](#assertion-api)


## assert.matchesGroup()

* assert.matchesGroup(actual: string, regex: RegExp, expectedMatch: string | null, message?: string)

Executes `regex` against `actual` and compares the first capturing group against `expectedMatch`. Fails if they aren’t the same. To say the capturing group wasn’t found, provide `null` to `expectedMatch`.

This assertion is useful for comparing large strings. It allows you to extract just the piece you care about and compare it in isolation, leading to better assertion errors than [assert.match()](#assertmatch).

Examples:

```typescript
// Passes
assert.matchesGroup(
  "<a href='https://my-url.com/>My Link</a>",
  /<a .*?>(.*?)<\/a>/,   // Match the part between tags
  "My Link",             
)

// Fails with 'Expected: My Link; Actual: Some Other Link'
assert.matchesGroup(
  "<a href='https://my-url.com/>Some Other Link</a>",
  /<a .*?>(.*?)<\/a>/,
  "My Link",             
)
```

[Back to top](#assertion-api)


## assert.includes()

* assert.includes(actual: { includes: Function }, expected: unknown, message?: string)

Calls `actual.includes(expected)` and fails if the return value is false. Note that this works on any object that implements `includes()`.

[Back to top](#assertion-api)


## assert.notIncludes()

* assert.notIncludes(actual: { includes: Function }, expected: unknown, message?: string)

Calls `actual.notIncludes(expected)` and fails if the return value is true. Note that this works on any object that implements `includes()`.

[Back to top](#assertion-api)


## assert.error()

* assert.error(fn: Function, expected?: RegExp | string, message?: string)

Fails if `fn()` doesn’t throw an exception, or if it does throw an exception and it isn’t an instance of `Error`. If `expected` is defined, this assertion also fails if the error message doesn’t match `expected`.

Use [assert.errorAsync()](#asserterrorasync) if `fn()` is asynchronous.

Example:

```typescript
assert.error(
  () => sut.myMethod(),
  "My error message",
);
```

[Back to top](#assertion-api)


## assert.notError()

* assert.notError(fn: Function)

Fails if `fn()` throws an exception. The error message is the same as the exception that was thrown.

This assertion is unnecessary—it has the exact same effect of calling `fn()` directly, because tests already fail if something throws an exception. But it’s useful for making clear what your test is testing.

Use [assert.notErrorAsync()](#assertnoterrorasync) if `fn()` is asynchronous.

Example:

```typescript
assert.notError(
  () => sut.myMethod(),
);
```

[Back to top](#assertion-api)


## assert.errorAsync()

* assert.errorAsync(fnAsync: Function, expected?: RegExp | string, message?: string): Promise\<void\>

Fails if `fnAsync()` doesn’t throw an exception, or if it does throw an exception and it isn’t an instance of `Error`. If `expected` is defined, this assertion also fails if the error message doesn’t match `expected`.

Use [assert.error()](#asserterror) if `fnAsync()` is not asynchronous.

Example:

```typescript
await assert.errorAsync(
  () => sut.myMethod(),
  "My error message",
);
```

[Back to top](#assertion-api)


## assert.notErrorAsync()

* assert.notError(fnAsync: Function): Promise\<void\>

Fails if `fnAsync()` throws an exception. The error message is the same as the exception that was thrown.

This assertion is unnecessary—it has the exact same effect of calling `fnAsync()` directly, because tests already fail if something throws an exception. But it’s useful for making clear what your test is testing.

Use [assert.notError()](#assertnoterror) if `fnAsync()` is not asynchronous.

Example:

```typescript
await assert.notErrorAsync(
  () => sut.myMethod(),
);
```

[Back to top](#assertion-api)


## assert.type()

* assert.type(actual: unknown, expected: TypeDescriptor, message?: string)

Fails if `actual` isn’t one of the expected types.

> *Note:* You’re typically better off calling [assert.equal()](#assertequal).

To specify a language type, use JavaScript’s class names: `String`, `Number`, `Array`, `Object`, `Boolean`, etc. You can also use `undefined`, `null`, and `NaN`.

To specify an object instance, use the name of the class: `Date`, `RegExp`, `MyClass`, etc.

To specify an object with specific fields, use an object literal. Provide the keys you expect and put the key’s expected types as their value, as shown in the example below.

There is no built-in way to check the types of an array’s elements. Instead, loop through the array and check the type of each element: `array.forEach(element => assert.type(element, expectedType));`

Examples:

```typescript
assert.type(actual, String);              // expects a string
assert.type(actual, MyClass);             // expects a MyClass instance
assert.type(actual, [ Date, Number ]);    // expects a Date instance or a number

assert.type(actual, {                     // expects an object with:
  host: String,                             // "host" as a string
  port: [ String, Number ],                 // "port" as a string or a number
  auth: [ undefined, {                      // an optional 'auth' parameter 
    username: String,                         // with "username" as a string
    password: String,                         // and "password" as a string
  }],
});
```

[Back to top](#assertion-api)
