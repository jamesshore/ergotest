import {
	assert,
	beforeAll,
	afterAll,
	beforeEach,
	afterEach,
	describe,
	it,
	TestStatus,
} from "./util/tests.js";

// This file is only used for manual testing

// We need to do something or the dependency analysis won't realize this file has run.
afterAll(() => {});
