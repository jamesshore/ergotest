// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
// ****
// An assertion library that works the way *I* want it to. <oldmanvoice>Get off my lawn!</oldmanvoice>
// ****
/* eslint @typescript-eslint/no-unsafe-function-type: "off" */ // Several assertions operate on arbitrary functions.
import util from "node:util";
import { check as typeCheck, describe as describeType } from "../util/type.js";
import { AssertionError } from "node:assert";
export function fail(message, actual, expected) {
    throw new AssertionError({
        message,
        actual,
        expected
    });
}
export function todo(message) {
    message = message ? `: ${message}` : "";
    fail(`TO DO${message}`);
}
export function identity(actual, expected, message) {
    checkExpected(expected);
    if (typeof expected !== "object" && typeof expected !== "function") {
        throwAssertionError(message, "'expected' is not an object", actual, expected);
    }
    if (expected === null) throwAssertionError(message, "'expected' is null", actual, expected);
    if (actual !== expected) throwAssertionError(message, "should have same object reference", actual, expected);
}
export function notIdentity(actual, expected, message) {
    checkExpected(expected);
    if (typeof expected !== "object") throwAssertionError(message, "'expected' is not an object", actual, expected);
    if (expected === null) throwAssertionError(message, "'expected' is null", actual, expected);
    if (actual === expected) throwAssertionError(message, "should not have same object reference", actual, expected);
}
export function equal(actual, expected, message) {
    checkExpected(expected);
    if (!util.isDeepStrictEqual(actual, expected)) {
        throwAssertionError(message, "should be equal", actual, expected);
    }
}
export function notEqual(actual, expected, message) {
    checkExpected(expected);
    if (util.isDeepStrictEqual(actual, expected)) {
        throwAssertionError(message, "should not be equal", actual, expected);
    }
}
export function dotEquals(actual, expected, message) {
    checkExpected(expected);
    message = message ? `${message}: ` : "";
    isDefined(actual, message);
    if (expected.equals === undefined) fail(message + "'expected' does not have equals() method");
    if (!expected.equals(actual)) throwAssertionError(message, "should be .equals()", actual, expected);
}
export function notDotEquals(actual, expected, message) {
    checkExpected(expected);
    message = message ? `${message}: ` : "";
    isDefined(actual, message);
    if (expected.equals === undefined) fail(message + "'expected' does not have equals() method");
    if (expected.equals(actual)) throwAssertionError(message, "should not be equal()", actual, expected);
}
export function isDefined(actual, message) {
    if (actual === undefined) throwAssertionError(message, "should not be undefined");
}
export function isUndefined(actual, message) {
    if (actual !== undefined) throwAssertionError(message, "should be undefined", actual);
}
export function isTrue(actual, message) {
    if (actual !== true) throwAssertionError(message, "should be true", actual, true);
}
export function isFalse(actual, message) {
    if (actual !== false) throwAssertionError(message, "should be false", actual, false);
}
export function isNull(actual, message) {
    if (actual !== null) throwAssertionError(message, "should be null", actual, null);
}
export function isNotNull(actual, message) {
    if (actual === null) throwAssertionError(message, "should not be null", actual);
}
export function atLeast(actual, expected, message) {
    checkExpected(expected);
    if (actual < expected) {
        throwAssertionError(message, `should be at least ${expected}`, actual, expected);
    }
}
export function atMost(actual, expected, message) {
    checkExpected(expected);
    if (actual > expected) {
        throwAssertionError(message, `should be at most ${expected}`, actual, expected);
    }
}
export function between(actual, min, max, message) {
    isDefined(actual, message);
    message = message ? `${message}: ` : "";
    if (actual < min || actual > max) {
        fail(message + "should be between " + min + " and " + max + " (inclusive), but was " + actual);
    }
}
export function match(actual, expected, message) {
    checkExpected(expected);
    if (typeof actual !== "string") throwAssertionError(message, `should have been string, but was ${typeof actual}`);
    if (!expected.test(actual)) throwAssertionError(message, "should match regex", actual, expected);
}
export function matchesGroup(actual, regex, expectedMatch, message) {
    message = message ?? "regex group";
    const regexResult = regex.exec(actual);
    const actualMatch = regexResult === null ? null : regexResult[1];
    if (expectedMatch === null && actualMatch === null) {
        return;
    } else if (expectedMatch === null && actualMatch !== null) {
        fail(`should not have found ${message}, but it was '${actualMatch}' (searched with ${regex})`);
    } else if (expectedMatch !== null && actualMatch === null) {
        fail(`${message} expected '${expectedMatch}', but nothing was found (searched with ${regex})`);
    } else {
        equal(actualMatch, expectedMatch, message);
    }
}
export function includes(actual, expected, message) {
    checkExpected(expected);
    isDefined(actual, message);
    if (!actual.includes(expected)) {
        throwAssertionError(message, "actual value should include expected value", actual, expected);
    }
}
export function notIncludes(actual, expected, message) {
    checkExpected(expected);
    isDefined(actual, message);
    if (actual.includes(expected)) {
        throwAssertionError(message, "actual value should not include expected value", actual, expected);
    }
}
export function error(fn, expected, message) {
    try {
        fn();
    } catch (err) {
        if (expected === undefined) return;
        if (!(err instanceof Error)) fail(`should have thrown Error, but was: ${err}`);
        if (typeof expected === "string") {
            equal(err.message, expected, message);
        } else {
            match(err.message, expected, message);
        }
        return;
    }
    throwAssertionError(message, "Expected exception");
}
export function notError(fn) {
    fn();
}
export async function errorAsync(fnAsync, expectedRegexOrExactString, message) {
    try {
        await fnAsync();
    } catch (err) {
        if (expectedRegexOrExactString === undefined) return;
        if (!(err instanceof Error)) fail(`should have thrown Error, but was: ${err}`);
        if (typeof expectedRegexOrExactString === "string") {
            equal(err.message, expectedRegexOrExactString, message);
        } else {
            match(err.message, expectedRegexOrExactString, message);
        }
        return;
    }
    throwAssertionError(message, "Expected exception");
}
export async function notErrorAsync(fnAsync) {
    await fnAsync();
}
export function type(actual, expected, message) {
    checkExpected(expected);
    const error = typeCheck(actual, expected);
    if (error !== null) {
        throwAssertionError(message, "type should match", actual, describeType(expected));
    }
}
function checkExpected(expected) {
    if (expected === undefined) fail("'undefined' provided as expected value in assertion");
}
function throwAssertionError(userMessage, assertionMessage, actual, expected) {
    userMessage = userMessage ? `${userMessage}: ` : "";
    throw new AssertionError({
        message: `${userMessage}${assertionMessage}`,
        actual,
        expected
    });
}

//# sourceMappingURL=/Users/jshore/Documents/Projects/ergotest/generated/src/tests/assert.js.map
