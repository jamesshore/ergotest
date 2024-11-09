// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { assert, test } from "tests";
import Repo from "./repo.js";
import Shell from "infrastructure/shell.js";
import ConsoleOutput from "infrastructure/console_output.js";
import Colors from "infrastructure/colors.js";
import TaskError from "tasks/task_error.js";
import * as ensure from "util/ensure.js";

const DEV_BRANCH = "my_dev_branch";
const INTEGRATION_BRANCH = "my_integration_branch";

export default test(({ describe }) => {

	describe("integrate", ({ it }) => {

		it("merges dev directory into integration directory", async () => {
			const { stdoutTracker } = await integrateAsync({
				buildPasses: true,
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
				Colors.cyan("» git merge my_dev_branch --no-ff --log=9999 '--message=INTEGRATE: my integration message'\n"),
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

		it("fails gracefully if git command fails", async () => {
			await assert.errorAsync(
				() => integrateAsync({
					shellOptions: {
						"git status --porcelain": { code: 127 },
					},
				}),
				"git status failed",
			);
		});

	});


	describe("release", ({ it }) => {

		it("updates version and pushes to origin", async () => {
			const { stdoutTracker } = await releaseAsync({
				level: "minor",
			});

			assert.equal(stdoutTracker.data, [
				Colors.brightWhite.underline("\nReleasing:\n"),
				Colors.cyan("» npm version minor\n"),
				Colors.cyan("» git push --all\n"),
				Colors.cyan("» git push --tags\n"),
			]);
		});

	});

});

async function integrateAsync({
	devBranch = DEV_BRANCH,
	integrationBranch = INTEGRATION_BRANCH,
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
		devBranch: DEV_BRANCH,
		integrationBranch: INTEGRATION_BRANCH,
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

async function releaseAsync({
	level,
	shellOptions,
} = {}) {
	ensure.signature(arguments, [[ undefined, {
		level: [ String ],
		shellOptions: [ undefined, Object ],
	}]]);

	const stdout = ConsoleOutput.createNull();
	const stdoutTracker = stdout.track();
	const shell = Shell.createNull(shellOptions);
	const repo = new Repo(shell, stdout);

	await repo.releaseAsync({ level });

	return { stdoutTracker };
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