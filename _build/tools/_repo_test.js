// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { assert, test } from "tests";
import Repo from "./repo.js";
import Shell from "infrastructure/shell.js";
import ConsoleOutput from "infrastructure/console_output.js";
import Colors from "infrastructure/colors.js";
import TaskError from "tasks/task_error.js";
import * as ensure from "util/ensure.js";

export default test(({ describe }) => {

	describe("integrate", ({ it }) => {

		it("merges dev directory into integration directory", async () => {
			const { stdoutTracker } = await integrateAsync({
				buildPasses: true,
				devBranch: "my_dev_branch",
				integrationBranch: "my_integration_branch",
				buildTask: "my_task",
				buildOptions: { buildOptions: true },
				message: "my integration message",
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
			const { build } = await integrateAsync({
				buildTask: "my_task",
				buildOptions: { myOptions: true },
			});

			assert.equal(build.taskNames, [ "my_task" ], "build task names");
			assert.equal(build.options, { myOptions: true }, "build options");
		});

		it("fails gracefully if repo has uncommitted changes", async () => {
			await assert.errorAsync(
				() => integrateAsync({
					shellOptions: {
						"git status --porcelain": { stdout: "some changes" },
					}
				}),
				"Commit changes before integrating",
			);
		});

		it("fails gracefully if build fails", async () => {
			await assert.errorAsync(
				() => integrateAsync({
					buildPasses: false,
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

async function integrateAsync({
	devBranch = "irrelevant_dev_branch",
	integrationBranch = "irrelevant_integration_branch",
	buildTask = "irrelevant_build_task",
	buildOptions = { irrelevantBuildOptions: true },
	buildPasses = true,
	message = "irrelevant_integration_message",
	shellOptions,
} = {}) {
	ensure.signature(arguments, [[ undefined, {
		devBranch: [ undefined, String ],
		integrationBranch: [ undefined, String ],
		buildTask: [ undefined, String ],
		buildOptions: [ undefined, Object ],
		buildPasses: [ undefined, Boolean ],
		message: [ undefined, String ],
		shellOptions: [ undefined, Object ],
	}]]);

	const stdout = ConsoleOutput.createNull();
	const stdoutTracker = stdout.track();
	const shell = Shell.createNull(shellOptions);
	const repo = new Repo(shell, stdout);
	const build = new BuildStub(stdout, buildPasses);

	const config = {
		devBranch,
		integrationBranch,
	};

	await repo.integrateAsync({
		build,
		buildTask: buildTask,
		buildOptions: buildOptions,
		config,
		message,
	});

	return { stdoutTracker, build };
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