// Copyright Titanium I.T. LLC.

import { suite, assert } from "tests";
import { Hello } from "./hello.js";

export default suite(({ it }) => {

	it("runs tests", () => {
		assert.equal(Hello.add(40, 2), 42);
	});

});