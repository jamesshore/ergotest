// Copyright Titanium I.T. LLC.

import { suite, assert } from "tests";
import { Hello } from "./hello";

module.exports = suite(({ it }) => {

	it("runs tests", () => {
		assert.equal(Hello.add(40 + 2), 42);
	});

});