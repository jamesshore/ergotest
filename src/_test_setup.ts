import {
	assert,
	beforeEach,
	afterEach,
	describe,
	it,
} from "./util/tests.js";

console.log("\nSETUP LOADED");

afterEach(() => {
	console.log("AFTER_EACH 1");
});

afterEach(() => {
	console.log("AFTER_EACH 2");
});
