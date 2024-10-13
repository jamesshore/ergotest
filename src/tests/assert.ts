// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."

// ****
// An assertion library that works the way *I* want it to. <oldmanvoice>Get off my lawn!</oldmanvoice>
// ****

/* eslint @typescript-eslint/no-unsafe-function-type: "off" */
// Several assertions operate on arbitrary functions.

import util from "node:util";
import { TypeDescriptor as TypeLibDescriptor, check as typeCheck, describe as describeType } from "../util/type.js";
import { AssertionError } from "node:assert";

interface DotEquals {
	equals(that: unknown): boolean,
}

interface Includes {
	includes(any: unknown): boolean,
}

export type TypeDescriptor = TypeLibDescriptor;

export function fail(message: string): never {
	throw new AssertionError({ message });
}

export function todo(message?: string): never {
	message = message ? `: ${message}` : "";
	fail(`TO DO${message}`);
}

export function identity(actual: unknown, expected: unknown, message?: string) {
	checkExpected(expected);
	if (typeof expected !== "object" && typeof expected !== "function") {
		throwAssertionError(message, "'expected' is not an object", actual, expected);
	}
	if (expected === null) throwAssertionError(message, "'expected' is null", actual, expected);

	if (actual !== expected) throwAssertionError(message, "should have same object reference", actual, expected);
}

export function notIdentity(actual: unknown, expected: unknown, message?: string) {
	checkExpected(expected);
	if (typeof expected !== "object") throwAssertionError(message, "'expected' is not an object", actual, expected);
	if (expected === null) throwAssertionError(message, "'expected' is null", actual, expected);

	if (actual === expected) throwAssertionError(message, "should not have same object reference", actual, expected);
}

export function equal(actual: unknown, expected: unknown,  message?: string) {
	checkExpected(expected);
	if (!util.isDeepStrictEqual(actual, expected)) {
		throwAssertionError(message, "should be equal", actual, expected);
	}
}

export function notEqual(actual: unknown, expected: unknown,  message?: string) {
	checkExpected(expected);
	if (util.isDeepStrictEqual(actual, expected)) {
		throwAssertionError(message, "should not be equal", actual, expected);
	}
}

export function dotEquals(actual: unknown, expected: DotEquals,  message?: string) {
	checkExpected(expected);

	message = message ? `${message}: ` : "";
	isDefined(actual, message);
	if (expected.equals === undefined) fail(message + "'expected' does not have equals() method");
	if (!expected.equals(actual)) throwAssertionError(message, "should be .equals()", actual, expected);
}

export function notDotEquals(actual: unknown, expected: DotEquals,  message?: string) {
	checkExpected(expected);

	message = message ? `${message}: ` : "";
	isDefined(actual, message);
	if (expected.equals === undefined) fail(message + "'expected' does not have equals() method");
	if (expected.equals(actual)) throwAssertionError(message, "should not be equal()", actual, expected);
}

export function isDefined(actual: unknown, message?: string) {
	if (actual === undefined) throwAssertionError(message, "should not be undefined");
}

export function isUndefined(actual: unknown, message?: string) {
	if (actual !== undefined) throwAssertionError(message, "should be undefined", actual);
}

export function isTrue(actual: unknown, message?: string) {
	if (actual !== true) throwAssertionError(message, "should be true", actual, true);
}

export function isFalse(actual: unknown, message?: string) {
	if (actual !== false) throwAssertionError(message, "should be false", actual, false);
}

export function isNull(actual: unknown, message?: string) {
	if (actual !== null) throwAssertionError(message, "should be null", actual, null);
}

export function isNotNull(actual: unknown, message?: string) {
	if (actual === null) throwAssertionError(message, "should not be null", actual);
}

export function atLeast(actual: unknown, expected: unknown,  message?: string) {
	checkExpected(expected);
	if ((actual as number) < (expected as number)) {
		throwAssertionError(message, `should be at least ${expected}`, actual, expected);
	}
}

export function atMost(actual: unknown, expected: unknown,  message?: string) {
	checkExpected(expected);
	if ((actual as number) > (expected as number)) {
		throwAssertionError(message, `should be at most ${expected}`, actual, expected);
	}
}

export function between(actual: unknown, min: unknown, max: unknown, message?: string) {
	isDefined(actual, message);
	message = message ? `${message}: ` : "";
	if ((actual as number) < (min as number) || (actual as number) > (max as number)) {
		fail(message + "should be between " + min + " and " + max + " (inclusive), but was " + actual);
	}
}

export function match(actual: string, expected: RegExp, message?: string) {
	checkExpected(expected);
	if (typeof actual !== "string") throwAssertionError(message, `should have been string, but was ${typeof actual}`);
	if (!expected.test(actual)) throwAssertionError(message, "should match regex", actual, expected);
}

export function matchesGroup(actual: string, regex: RegExp, expectedMatch: string | null, message?: string) {
	message = message ?? "regex group";
	const regexResult = regex.exec(actual);
	const actualMatch = regexResult === null ? null : regexResult[1];

	if (expectedMatch === null && actualMatch === null) {
		return;
	}
	else if (expectedMatch === null && actualMatch !== null) {
		fail(`should not have found ${message}, but it was '${actualMatch}' (searched with ${regex})`);
	}
	else if (expectedMatch !== null && actualMatch === null) {
		fail(`${message} expected '${expectedMatch}', but nothing was found (searched with ${regex})`);
	}
	else {
		equal(actualMatch, expectedMatch, message);
	}
}

export function includes(actual: Includes, expected: unknown,  message?: string) {
	checkExpected(expected);
	isDefined(actual, message);
	if (!actual.includes(expected)) {
		throwAssertionError(message, "actual value should include expected value", actual, expected);
	}
}

export function notIncludes(actual: Includes, expected: unknown,  message?: string) {
	checkExpected(expected);
	isDefined(actual, message);
	if (actual.includes(expected)) {
		throwAssertionError(message, "actual value should not include expected value", actual, expected);
	}
}

export function error(fn: Function, expected?: RegExp | string, message?: string) {
	try {
		fn();
	}
	catch (err) {
		if (expected === undefined) return;
		if (!(err instanceof Error)) fail(`should have thrown Error, but was: ${err}`);
		if (typeof expected === "string") {
			equal(err.message, expected, message);
		}
		else {
			match(err.message, expected, message);
		}
		return;
	}
	throwAssertionError(message, "Expected exception");
}

export function notError(fn: Function) {
	fn();
}

export async function errorAsync(fnAsync: Function, expectedRegexOrExactString?: RegExp | string, message?: string) {
	try {
		await fnAsync();
	}
	catch (err) {
		if (expectedRegexOrExactString === undefined) return;
		if (!(err instanceof Error)) fail(`should have thrown Error, but was: ${err}`);
		if (typeof expectedRegexOrExactString === "string") {
			equal(err.message, expectedRegexOrExactString, message);
		}
		else {
			match(err.message, expectedRegexOrExactString, message);
		}
		return;
	}
	throwAssertionError(message, "Expected exception");
}

export async function notErrorAsync(fnAsync: Function) {
	await fnAsync();
}

export function type(actual: unknown, expected: TypeDescriptor,  message?: string) {
	checkExpected(expected);
	const error = typeCheck(actual, expected);
	if (error !== null) {
		throwAssertionError(message, "type should match", actual, describeType(expected));
	}
}

function checkExpected(expected: unknown) {
	if (expected === undefined) fail("'undefined' provided as expected value in assertion");
}

function throwAssertionError(
	userMessage: string | undefined,
	assertionMessage: string,
	actual?: unknown,
	expected?: unknown,
): never {
	userMessage = userMessage ? `${userMessage}: ` : "";
	throw new AssertionError({ message: `${userMessage}${assertionMessage}`, actual, expected });
}