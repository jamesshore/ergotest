// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { test, assert } from "tests";
import Repo from "./repo.js";
import Shell from "infrastructure/shell.js";
import ConsoleOutput from "infrastructure/console_output.js";
import Colors from "infrastructure/colors.js";

export default test(({ describe }) => {

	describe("integrate", ({ it }) => {

		it("merges dev directory into integration directory", async () => {
			const shell = Shell.createNull();
			const shellTracker = shell.track();
			const stdout = ConsoleOutput.createNull();
			const stdoutTracker = stdout.track();
			const repo = new Repo(shell, stdout);

			const config = {
				devBranch: "my_dev_branch",
				integrationBranch: "my_integration_branch",
			};
			const message = "my integration message";

			await repo.integrateAsync({ config, message });

			assertCommands(shellTracker, [
				"git checkout my_integration_branch",
				"git merge my_dev_branch --no-ff --log=9999 '--message=my integration message'",
				"git checkout my_dev_branch",
				"git merge my_integration_branch --ff-only",
			]);

			assert.equal(stdoutTracker.data, [
				Colors.brightWhite.underline("\nIntegrating my_dev_branch into my_integration_branch:\n"),
				Colors.cyan("» git checkout my_integration_branch\n"),
				Colors.cyan("» git merge my_dev_branch --no-ff --log=9999 '--message=my integration message'\n"),
				Colors.cyan("» git checkout my_dev_branch\n"),
				Colors.cyan("» git merge my_integration_branch --ff-only\n"),
			]);
		});

		it("fails gracefully if unable to check out integration branch");

		it("fails gracefully if unable to merge dev branch to integration");

		it("fails gracefully if unable to check out dev branch");

		it("fails gracefully if unable to merge integration branch to dev");

	});

});

function assertCommands(shellTracker, expected) {
	const actual = shellTracker.data.map(({ command, args }) => {
		const quotedArgs = args.map((arg) => (arg.includes(" ") ? `'${arg}'` : arg));
		return [ command, ...quotedArgs ].join(" ");
	});

	assert.equal(actual, expected);
}