import {
	assert,
	beforeAll,
	afterAll,
	beforeEach,
	afterEach,
	describe,
	it,
} from "./util/tests.js";

console.log("\nSETUP LOADED");

beforeAll(() => {
	console.log("BEFORE_ALL");
});

afterAll(() => {
	console.log("AFTER_ALL");
	assert.todo();
});

beforeEach(() => {
	console.log("BEFORE_EACH");
	assert.todo();
});

afterEach(() => {
	console.log("AFTER_EACH");
	// assert.todo();
});
