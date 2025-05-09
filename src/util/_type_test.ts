// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."

/* eslint @typescript-eslint/no-explicit-any: "off" */
// There are a lot of weird JavaScript manipulations in these tests, so we work around the type-checker with "as any"

import { assert, describe, it } from "./tests.js";
import * as type from "./type.js";

export default describe(() => {

	describe("checker", () => {

		const check = type.check;

		it("checks built-in types", function() {
			assert.isNull(check(false, Boolean), "boolean");
			assert.isNotNull(check(false, String), "not boolean");

			assert.isNull(check("1", String), "string");
			assert.isNotNull(check("1", Number), "not string");

			assert.isNull(check(1, Number), "number");
			assert.isNotNull(check(1, Function), "not number");

			assert.isNull(check(function() {}, Function), "function");
			assert.isNotNull(check(function() {}, Object), "not function");

			assert.isNull(check({}, Object), "object");
			assert.isNotNull(check({}, Array), "not object");

			assert.isNull(check([], Array), "array");
			assert.isNotNull(check([], RegExp), "not array");

			assert.isNull(check(/foo/, RegExp), "regular expression");
			assert.isNotNull(check(/foo/, Boolean), "not regular expression");
		});

		it("checks undefined and null types (primarily for allowing nullable objects, etc.)", function() {
			assert.isNull(check(undefined, undefined), "undefined");
			assert.isNotNull(check(undefined, null), "not undefined");
			assert.isNotNull(check({}, undefined), "bug: comparing object to undefined caused crash");
			assert.isNotNull(check({}, null), "bug: comparing object to null caused crash");

			assert.isNull(check(null, null), "null");
			assert.isNotNull(check(null, NaN), "not null");
		});

		it("checks NaN (just in case you ever want it)", function() {
			assert.isNull(check(NaN, NaN), "NaN");

			assert.isNotNull(check(NaN, undefined), "undefined should not be NaN");
			assert.isNotNull(check(NaN, null), "null should not be NaN");
			assert.isNotNull(check(NaN, Object), "constructors should not be NaN");
		});

		it("checks custom types", function() {
			class MyClass {}

			const myInstance = new MyClass();

			assert.isNull(check(myInstance, MyClass), "instance of class");
			assert.isNull(check(myInstance, Object), "instance of subclass");
			assert.isNotNull(check({}, MyClass), "instance of superclass");
		});

		it("checks 'structs'", function() {
			assert.isNull(check({ a: 1 }, { a: Number }), "one matching parameter");
			assert.isNotNull(check({ a: 1 }, { a: String }), "one non-matching parameter");

			assert.isNull(check({}, {}), "no parameters");
			assert.isNotNull(check({ a: 1 }, {}), "extra parameters should cause match to fail");
			assert.isNull(check({ a: 1 }, {}, { allowExtraKeys: true }), "extra parameters should NOT cause match to fail when parameter is set");

			assert.isNull(check({ a: 1, b: "a" }, { a: Number, b: String }), "multiple matching parameters");
			assert.isNotNull(check({ a: 1, b: "a" }, { a: Number, b: Number }), "multiple with non-matching parameter");
		});

		it("supports multiple allowed types", function() {
			assert.isNull(check(1, [String, Number]), "string or number");
			assert.isNotNull(check(1, [String, Object, Boolean]), "not string, object, or boolean");
		});

		it("returns string explaining error", function() {
			assert.equal(check(123, String), "argument must be a string, but it was a number", "normal types");
		});

		it("provides detailed error message when using structs", function() {
			assert.equal(
				check(null, { a: String }),
				"argument must be an object containing { a: <string> }, but it was null",
				"not a struct"
			);
			assert.equal(
				check(null, { a: String }, { allowExtraKeys: true }),
				"argument must be an object containing at least { a: <string> }, but it was null",
				"not a struct, and extra keys are allowed"
			);
			assert.equal(
				check({}, { a: String }),
				"argument.a must be a string, but it was undefined",
				"top-level struct"
			);
			assert.equal(
				check({ a: { b: 123 }}, { a: { b: String } }),
				"argument.a.b must be a string, but it was a number",
				"nested struct"
			);
			assert.equal(
				check({ a: "expected", b: "extra" }, { a: String }),
				"argument had unexpected parameter: b",
				"one extra parameters"
			);
			assert.equal(
				check({ a: "expected", b: "extra", c: "extra", d: "extra" }, { a: String }),
				"argument had unexpected parameters: b, c, d",
				"multiple extra paraameters"
			);
		});

		it("provides correct error message when receiving a struct and expecting a primitive", function() {
			assert.equal(
				check({ id: "something" }, Number),
				"argument must be a number, but it was an object"
			);
		});

		it("provides class names when using class instances", function() {
			const One = function One() {} as any;
			const Two = function Two() {} as any;

			assert.equal(check(new One(), Two), "argument must be a Two instance, but it was a One instance");
		});

		it("allows argument name to be customized in error message", function() {
			assert.equal(check(1, String, { name: "custom" }), "custom must be a string, but it was a number");
		});

	});

	describe("describer", () => {

		const MyClass = function MyClass() {} as any;

		const forceAnonymity = {} as any;
		const AnonClass = forceAnonymity.whatever = function() {} as any;

		const myDescribe = type.describe;

		it("describes non-object types", function() {
			assert.equal(myDescribe(Boolean), "boolean");
			assert.equal(myDescribe(String), "string");
			assert.equal(myDescribe(Number), "number");
			assert.equal(myDescribe(Function), "function");
			assert.equal(myDescribe(Array), "array");
			assert.equal(myDescribe(undefined), "undefined");
			assert.equal(myDescribe(null), "null");
			assert.equal(myDescribe(NaN), "NaN");
		});

		it("describes object types", function() {
			assert.equal(myDescribe(Object), "object");
			assert.equal(myDescribe(RegExp), "regular expression");
			assert.equal(myDescribe(MyClass), "MyClass instance");
			assert.equal(myDescribe(AnonClass), "<anon> instance");
		});

		it("describes class instances", function() {
			assert.equal(myDescribe(new MyClass()), "MyClass instance");
			assert.equal(myDescribe(new AnonClass()), "<anon> instance");
		});

		it("describes 'structs'", function() {
			assert.equal(myDescribe(Object.create(null)), "object", "no prototype");
			assert.equal(myDescribe({}), "object", "empty object");
			assert.equal(myDescribe({ a: Number }), "object containing { a: <number> }", "one parameter");
			assert.equal(myDescribe({ a: Number, b: String }), "object containing { a: <number>, b: <string> }");
		});

		it("describes 'structs' when extra keys are allowed", function() {
			const options = { atLeast: true };

			assert.equal(myDescribe(Object.create(null), options), "object", "no prototype");
			assert.equal(myDescribe({}, options), "object", "empty object");
			assert.equal(myDescribe({ a: Number }, options), "object containing at least { a: <number> }", "one parameter");
			assert.equal(myDescribe({ a: Number, b: String }, options), "object containing at least { a: <number>, b: <string> }");
		});

		it("describes multiple types", function() {
			assert.equal(myDescribe([ Boolean ]), "boolean", "one types");
			assert.equal(myDescribe([ Boolean, Object ]), "boolean or object", "two types");
			assert.equal(myDescribe([ Boolean, Object, Number, Function ]), "boolean, object, number, or function", "four types");

			assert.equal(myDescribe([ undefined, Boolean ]), "undefined or boolean", "optional types shouldn't be treated specially");
			assert.equal(myDescribe([ null, Object ]), "null or object", "nullable objects shouldn't be treated specially");
		});

		it("optionally uses articles", function() {
			const MyClass = function MyClass() {} as any;
			const forceAnonymity = {} as any;
			const AnonClass = forceAnonymity.whatever = function() {} as any;

			const options = { articles: true };

			assert.equal(myDescribe(Boolean, options), "a boolean");
			assert.equal(myDescribe(String, options), "a string");
			assert.equal(myDescribe(Number, options), "a number");
			assert.equal(myDescribe(Function, options), "a function");
			assert.equal(myDescribe(Array, options), "an array");
			assert.equal(myDescribe(undefined, options), "undefined");
			assert.equal(myDescribe(null, options), "null");
			assert.equal(myDescribe(NaN, options), "NaN");
			assert.equal(myDescribe(Object, options), "an object", "Object");
			assert.equal(myDescribe(RegExp, options), "a regular expression");
			assert.equal(myDescribe(MyClass, options), "a MyClass instance");
			assert.equal(myDescribe(AnonClass, options), "an <anon> instance");
			assert.equal(myDescribe(new MyClass(), options), "a MyClass instance");
			assert.equal(myDescribe(new AnonClass(), options), "an <anon> instance");
			assert.equal(myDescribe(Object.create(null)), "object");
			assert.equal(myDescribe({}, options), "an object", "{}");
			assert.equal(myDescribe({ a: Number }, options), "an object containing { a: <number> }");
		});

	});

});
