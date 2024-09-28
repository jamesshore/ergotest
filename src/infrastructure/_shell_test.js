// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
"use strict";

const { suite, assert } = require("tests");
const Shell = require("./shell");
const path = require("node:path");

module.exports = suite(({ describe, it }) => {

	it("runs a program and outputs stdout and stderr", async () => {
		const { stdout, stderr } = await runNestedShellAsync(() => {
			const shell = Shell.create();
			shell.execAsync("node", "-e",
				"process.stdout.write('my stdout'); process.stderr.write('my stderr');"
			);
		});

		assert.equal(stderr, "my stderr");
		assert.equal(stdout, "my stdout");
	});

	it("can be constructed with silent option that doesn't output stdout and stderr", async () => {
		const { stdout, stderr } = await runNestedShellAsync(() => {
			const shell = Shell.createSilent();
			shell.execAsync("node", "-e",
				"process.stdout.write('my stdout'); process.stderr.write('my stderr');"
			);
		});

		assert.equal(stderr, "", "stderr");
		assert.equal(stdout, "", "stdout");
	});

	it("returns stdout and stderr", async () => {
		const shell = Shell.createSilent();
		const { stdout, stderr } = await shell.execAsync("node", "-e",
			"process.stdout.write('my stdout'); process.stderr.write('my stderr')"
		);

		assert.equal(stdout, "my stdout");
		assert.equal(stderr, "my stderr");
	});

	it("returns error code", async () => {
		const shell = Shell.createSilent();
		const { code } = await shell.execAsync("node", "-e",
			"process.exit(77);",
		);

		assert.equal(code, 77);
	});

	it("can be cancelled", async () => {
		const shell = Shell.createSilent();
		const { execPromise, cancelFnAsync } = shell.exec("node", "-e", "while (true);");

		await cancelFnAsync();
		await execPromise;    // if cancelFn doesn't work, this never exits

		// execPromise resolves with stdout, stderr, and exit code, but that's too much work to test. We'd have to
		// somehow delay cancelFnAsync() until after stdout had been written, and there's no easy way to determine
		// that. (It can be done by piping the output, but it's probably not worth it.)
	});

	it("does nothing when cancelling a function that's already exited", async () => {
		const shell = Shell.createSilent();
		const { execPromise, cancelFnAsync } = shell.exec("node", "-e", "");

		await execPromise;
		await assert.noExceptionAsync(
			() => cancelFnAsync(),
		);
	});

	it("tracks command and arguments", async () => {
		const shell = Shell.createNull();
		const tracker = shell.track();

		await shell.execAsync("my command", "arg 1", "arg 2", "arg 3");
		await shell.execAsync("2nd command");

		assert.deepEqual(tracker.data, [{
			command: "my command",
			args: [ "arg 1", "arg 2", "arg 3" ],
		}, {
			command: "2nd command",
			args: [],
		}]);
	});

	it("tracks cancellations", async () => {
		const shell = Shell.create();
		const tracker = shell.track();

		const { cancelFnAsync } = await shell.exec("node", "-e", "while(true);");
		await cancelFnAsync();

		assert.deepEqual(tracker.data, [{
			command: "node",
			args: [ "-e", "while(true);" ],
		}, {
			command: "node",
			args: [ "-e", "while(true);" ],
			cancelled: true,
		}]);
	});

	it("doesn't track cancellations that occur after the process has exited", async () => {
		const shell = Shell.createNull();
		const tracker = shell.track();

		const { execPromise, cancelFnAsync } = await shell.exec("node", "-e", "while(true);");
		await execPromise;
		await cancelFnAsync();

		assert.deepEqual(tracker.data, [{
			command: "node",
			args: [ "-e", "while(true);" ],
		}]);
	});


	describe("null", ({ it }) => {

		const IRRELEVANT_PROGRAM = "irrelevant program";

		it("doesn't run anything", async () => {
			const { code } = await runNestedShellAsync(() => {
				const shell = Shell.createNull();
				shell.execAsync("no_such_program!");
			});
			assert.equal(code, 0, "code");
		});

		it("can be cancelled", async () => {
			const shell = Shell.createNull();
			const { execPromise, cancelFnAsync } = await shell.exec(IRRELEVANT_PROGRAM);

			await cancelFnAsync();
			await execPromise;
		});

		it("provides default output and code", async () => {
			const shell = Shell.createNull();
			const { stdout, stderr, code } = await shell.execAsync(IRRELEVANT_PROGRAM);

			assert.equal(stderr, "", "stderr");
			assert.equal(stdout, "", "stdout");
			assert.equal(code, 0, "code");
		});

		it("allows output and code to be configured", async () => {
			const shell = Shell.createNull([{
				stdout: "stdout 1",
				stderr: "stderr 1",
				code: 1,
			}, {
				stdout: "stdout 2",
				stderr: "stderr 2",
				code: 2,
			}]);

			let { stdout, stderr, code } = await shell.execAsync(IRRELEVANT_PROGRAM);
			assert.equal(stdout, "stdout 1", "stdout");
			assert.equal(stderr, "stderr 1", "stderr");
			assert.equal(code, 1, "code");

			({ stdout, stderr, code } = await shell.execAsync(IRRELEVANT_PROGRAM));
			assert.equal(stdout, "stdout 2", "stdout");
			assert.equal(stderr, "stderr 2", "stderr");
			assert.equal(code, 2, "code");
		});

	});

});

async function runNestedShellAsync(fn) {
	// Okay, this is weird stuff. But it's necessary to test the create() and createSilent() methods.
	//
	// What I'm doing here is shelling out to Node to run the provided function. The reason I do this is so that
	// I can evaluate the results of the function. But it means I'm using the system under test (Shell) to test the
	// system under test (Shell again). That's a bit weird.
	//
	// In addition, I'm taking the function that's been passed in and converting it to a string argument that I
	// can pass to Node. I do that by calling .toString() on the function, which returns the original text of the
	// function. (JavaScript--either crazy or amazing, depending on your point of view.) Then I wrap the text of
	// that function in just enough code to allow it to run.
	//
	// To make matters worse, the code that requires Shell (SHELL_REQUIRE) has some seemingly-unnecessary
	// concatenation. That's because our build searches for require() statements for its dependency analysis,
	// and we have to make sure it doesn't find this one, because it's not a real require(), and if it thought
	// it was, the dependency analysis would fail.
	const program =
		"const Shell = require" + `("${path.resolve(__dirname, "./shell.js")}");\n` +
		`(${fn})();\n`;

	const testbedShell = Shell.createSilent();
	return await testbedShell.execAsync("node", "-e", program);
}
