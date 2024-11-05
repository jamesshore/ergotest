// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { assert, test } from "tests";
import Repo from "./repo.js";
import Shell from "infrastructure/shell.js";
import ConsoleOutput from "infrastructure/console_output.js";
import Colors from "infrastructure/colors.js";
import TaskError from "tasks/task_error.js";

export default test(({ describe }) => {

	describe("integrate", ({ it }) => {

		it("merges dev directory into integration directory", async () => {
			const stdout = ConsoleOutput.createNull();
			const stdoutTracker = stdout.track();
			const repo = new Repo(Shell.createNull(), stdout);
			const build = new BuildStub(stdout, true);

			const config = {
				devBranch: "my_dev_branch",
				integrationBranch: "my_integration_branch",
			};
			const message = "my integration message";

			await repo.integrateAsync({
				build,
				buildTask: "my_task",
				buildOptions: { myOptions: true },
				config,
				message,
			});

			assert.equal(stdoutTracker.data, [
				Colors.brightWhite.underline("\nChecking for uncommitted changes:\n"),
				Colors.cyan("» git status --porcelain\n"),
				Colors.brightWhite.underline("\nValidating build:\n"),
				"Stub build passed\n",
				Colors.brightWhite.underline("\nIntegrating my_dev_branch into my_integration_branch:\n"),
				Colors.cyan("» git checkout my_integration_branch\n"),
				Colors.cyan("» git merge my_dev_branch --no-ff --log=9999 '--message=my integration message'\n"),
				Colors.cyan("» git checkout my_dev_branch\n"),
				Colors.cyan("» git merge my_integration_branch --ff-only\n"),
			]);
		});

		it("runs build with provided task name and options", async () => {
			const repo = new Repo(Shell.createNull(), ConsoleOutput.createNull());
			const build = new BuildStub(ConsoleOutput.createNull(), true);

			const config = {
				devBranch: "my_dev_branch",
				integrationBranch: "my_integration_branch",
			};
			const message = "my integration message";

			await repo.integrateAsync({
				build,
				buildTask: "my_task",
				buildOptions: { myOptions: true },
				config,
				message,
			});

			assert.equal(build.taskNames, [ "my_task" ], "build task names");
			assert.equal(build.options, { myOptions: true }, "build options");
		});

		it("fails gracefully if repo has uncommitted changes", async () => {
			const shell = Shell.createNull({
				"git status --porcelain": { stdout: "some changes" },
			});
			const stdout = ConsoleOutput.createNull();
			const stdoutTracker = stdout.track();
			const repo = new Repo(shell, stdout);
			const build = new BuildStub(stdout, true);

			const config = {
				devBranch: "my_dev_branch",
				integrationBranch: "my_integration_branch",
			};

			await assert.errorAsync(
				() => repo.integrateAsync({
					build,
					buildTask: "irrelevant_task",
					buildOptions: { irrelevantOptions: true },
					config,
					message: "irrelevant integration message",
				}),
				"Commit changes before integrating",
			);
		});

		it("fails gracefully if build fails", async () => {
			const stdout = ConsoleOutput.createNull();
			const stdoutTracker = stdout.track();
			const repo = new Repo(Shell.createNull(), stdout);
			const build = new BuildStub(stdout, false);

			const config = {
				devBranch: "my_dev_branch",
				integrationBranch: "my_integration_branch",
			};
			const message = "my integration message";

			await assert.errorAsync(
				() => repo.integrateAsync({
					build,
					buildTask: "irrelevant_task",
					buildOptions: { irrelevantOptions: true },
					config,
					message: "irrelevant integration message",
				}),
				"Build error: Stub build failed",
			);
		});

		it("fails gracefully if unable to get repo status");

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

class BuildStub {

	constructor(stdout, pass) {
		this._stdout = stdout;
		this._pass = pass;
	}

	runAsync(taskNames, options) {
		this.taskNames = taskNames;
		this.options = options;

		if (this._pass) this._stdout.write("Stub build passed\n");
		else this._stdout.write("Stub build failed\n");

		if (!this._pass) throw new TaskError("Stub build failed");
	}

}