// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
// ****
// An assertion library that works the way *I* want it to. <oldmanvoice>Get off my lawn!</oldmanvoice>
// ****
/* eslint @typescript-eslint/no-unsafe-function-type: "off" */ // Several assertions operate on arbitrary functions.
import util from "node:util";
import * as typeLib from "../util/type.js";
import { AssertionError } from "node:assert";
export function fail(message) {
    throw new AssertionError({
        message
    });
}
export function todo(message) {
    message = message ? `: ${message}` : "";
    fail(`TO DO${message}`);
}
export function equal(actual, expected, message) {
    checkExpected(expected);
    if (expected !== actual) throwAssertionError(message, "expected equality", actual, expected);
}
export function notEqual(actual, expected, message) {
    checkExpected(expected);
    if (expected === actual) throwAssertionError(message, "expected no equality", actual, expected);
}
export function isDefined(actual, message) {
    if (actual === undefined) throwAssertionError(message, "expected value, but was undefined");
}
export function isUndefined(actual, message) {
    if (actual !== undefined) throwAssertionError(message, "expected value, but was undefined", actual);
}
export function isTrue(actual, message) {
    if (actual !== true) throwAssertionError(message, "expected true", actual, true);
}
export function isFalse(actual, message) {
    if (actual !== false) throwAssertionError(message, "expected false", actual, false);
}
export function isNull(actual, message) {
    if (actual !== null) throwAssertionError(message, "expected null", actual, null);
}
export function isNotNull(actual, message) {
    if (actual === null) throwAssertionError(message, "expected non-null", actual);
}
export function atLeast(actual, expected, message) {
    checkExpected(expected);
    if (actual < expected) throwAssertionError(message, `expected at least ${expected}`, actual, expected);
}
export function atMost(actual, expected, message) {
    checkExpected(expected);
    if (actual > expected) throwAssertionError(message, `expected at most ${expected}`, actual, expected);
}
export function deepEqual(actual, expected, message) {
    checkExpected(expected);
    if (!util.isDeepStrictEqual(actual, expected)) {
        throwAssertionError(message, "expected deep equality", actual, expected);
    }
}
export function type(actual, expected, message) {
    checkExpected(expected);
    const error = typeLib.check(actual, expected);
    if (error !== null) {
        throwAssertionError(message, "type should match", actual, typeLib.describe(expected));
    }
}
export function objEqual(actual, expected, message) {
    checkExpected(expected);
    message = message ? `${message}: ` : "";
    isDefined(actual, message);
    if (expected.equals === undefined) fail(message + "'expected' does not have equals() method");
    if (!expected.equals(actual)) throwAssertionError(message, "should be equal()", actual, expected);
}
export function objNotEqual(actual, expected, message) {
    checkExpected(expected);
    message = message ? `${message}: ` : "";
    isDefined(actual, message);
    if (actual.equals === undefined) fail(message + "does not have equals() method");
    isFalse(actual.equals(expected), message + "expected '" + expected + "' and '" + actual + "' to be not be equal(), but they were");
}
export function between(value, min, max, message) {
    isDefined(value, message);
    message = message ? `${message}: ` : "";
    if (value < min || value > max) {
        fail(message + "expected value between " + min + " and " + max + " (inclusive), but was " + value);
    }
}
export function match(actual, expectedRegex, message) {
    if (typeof actual !== "string") throwAssertionError(message, `should have been string, but was ${typeof actual}`);
    if (!expectedRegex.test(actual)) throwAssertionError(message, "should match regex", actual, expectedRegex);
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
    if (!actual.includes(expected)) {
        throwAssertionError(message, "actual value should include expected value", actual, expected);
    }
}
export function notIncludes(actual, expected, message) {
    checkExpected(expected);
    if (actual.includes(expected)) {
        throwAssertionError(message, "actual value should not include expected value", actual, expected);
    }
}
export function noException(fn) {
    fn();
}
export function exception(fn, expectedRegexOrExactString, message) {
    try {
        fn();
    } catch (err) {
        if (expectedRegexOrExactString === undefined) return;
        if (!(err instanceof Error)) fail(`Should have thrown Error, but was: ${err}`);
        if (typeof expectedRegexOrExactString === "string") {
            equal(err.message, expectedRegexOrExactString, message);
        } else {
            match(err.message, expectedRegexOrExactString, message);
        }
        return;
    }
    throwAssertionError(message, "Expected exception");
}
export async function exceptionAsync(fnAsync, expectedRegexOrExactString, message) {
    try {
        await fnAsync();
    } catch (err) {
        if (expectedRegexOrExactString === undefined) return;
        if (!(err instanceof Error)) fail(`Should have thrown Error, but was: ${err}`);
        if (typeof expectedRegexOrExactString === "string") {
            equal(err.message, expectedRegexOrExactString, message);
        } else {
            match(err.message, expectedRegexOrExactString, message);
        }
        return;
    }
    throwAssertionError(message, "Expected exception");
}
export async function noExceptionAsync(fnAsync) {
    await fnAsync();
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
