// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
"use strict";

const { suite, assert } = require("tests");
const ensure = require("../util/ensure");
const path = require("node:path");
const childProcess = require("node:child_process");
const ConsoleOutput = require("./console_output");
// dependency: ./_console_output_test_helper.js

module.exports = suite(({ describe, it }) => {

	it("real version writes to stdout (or stderr), null version doesn't", async () => {
		const { stdout, stderr } = await runModuleAsync(
			__dirname,
			"./_console_output_test_helper.js",
			{ failOnStderr: false }
		);
		assert.equal(stdout, "string stdout\nbuffer stdout\n");
		assert.equal(stderr, "string stderr\n");
	});

	it("tracks writes", () => {
		const stdout = ConsoleOutput.createNull();
		const track = stdout.track().data;

		stdout.write("string stdout");
		stdout.write(Buffer.from("buffer stdout"));
		assert.deepEqual(track, [
			"string stdout",
			"buffer stdout",
		]);
	});

});

function runModuleAsync(cwd, modulePath, { args = [], failOnStderr = true } = {}) {
	return new Promise((resolve, reject) => {
		ensure.signature(arguments, [ String, String, [ undefined, {
			args: [ undefined, Array ],
			failOnStderr: [ undefined, Boolean ],
		}]], [ "cwd", "modulePath", "options" ]);

		const absolutePath = path.resolve(cwd, modulePath);
		const options = {
			stdio: "pipe",
		};
		const child = childProcess.fork(absolutePath, args, options);

		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (data) => {
			stdout += data;
		});
		child.stderr.on("data", (data) => {
			stderr += data;
		});

		child.on("exit", () => {
			if (failOnStderr && stderr !== "") {
				console.log(stderr);
				return reject(new Error("Runner failed"));
			}
			else {
				return resolve({ stdout, stderr });
			}
		});
	});
}
