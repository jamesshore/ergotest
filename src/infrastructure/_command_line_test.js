// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
"use strict";

const { suite, assert } = require("tests");
const ensure = require("../util/ensure");
const path = require("node:path");
const childProcess = require("node:child_process");
const CommandLine = require("./command_line");
// dependency: ./_command_line_test_helper.js

module.exports = suite(({ describe, it }) => {

	it("provides raw and cooked command-line arguments", async function() {
		const args = [
			"command1", "command2", "-abc", "--option", "--no-d", "-p1", "--parm=parm2", "--", "trailing", "values"
		];
		const { stdout } = await runModuleAsync(
			__dirname,
			"./_command_line_test_helper.js",
			{ args }
		);

		assert.equal(stdout,
			`rawArguments: ${JSON.stringify(args)}\n` +
			`commands: ${JSON.stringify([ "command1", "command2" ])}\n` +
			`options: ${JSON.stringify({ 
				a: true,
				b: true,
				c: true,
				option: true,
				d: false,
				p: 1,
				parm: "parm2",
				"--": [ "trailing", "values" ],
			})}\n`
		);
	});


	describe("Nullability", ({ describe, it }) => {

		it("defaults to no arguments", function() {
			const commandLine = CommandLine.createNull();
			assert.deepEqual(commandLine.rawArguments, []);
		});

		it("allows arguments to be configured", function() {
			const commandLine = CommandLine.createNull({ args: [ "one", "two" ]});
			assert.deepEqual(commandLine.rawArguments, [ "one", "two" ]);
		});

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
