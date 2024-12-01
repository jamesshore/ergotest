// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import util from "node:util";
import { AssertionError } from "node:assert";

export function renderError(name: string[], error: unknown) {
	if (error instanceof AssertionError) {
		return "custom rendering:\n" +
			`expected: ${util.inspect(error.expected)}\n` +
			`actual: ${util.inspect(error.actual)}\n`;
	}
	else {
		return "custom rendering";
	}
}