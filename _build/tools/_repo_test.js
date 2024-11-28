// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { assert, describe, it } from "tests";
import Repo from "./repo.js";
import Shell from "infrastructure/shell.js";
import ConsoleOutput from "infrastructure/console_output.js";
import Colors from "infrastructure/colors.js";
import TaskError from "tasks/task_error.js";
import * as ensure from "util/ensure.js";

const DEV_BRANCH = "my_dev_branch";
const INTEGRATION_BRANCH = "my_integration_branch";

export default describe(() => {

	describe("integrate", () => {

		it("merges dev directory into integration directory", async () => {
			const { stdoutTracker } = await integrateAsync({
				buildPasses: true,
				message: "my integration message",
			});

			assert.equal(stdoutTracker.data, [
				Colors.brightWhite.underline("\nValidating build and creating distribution:\n"),
				"Stub build passed\n",
				Colors.brightWhite.underline("\nChecking for uncommitted changes:\n"),
				Colors.cyan("» git status --porcelain\n"),
				Colors.brightWhite.underline("\nIntegrating my_dev_branch into my_integration_branch:\n"),
				Colors.cyan("» git checkout my_integration_branch\n"),
				Colors.cyan("» git merge my_dev_branch --no-ff --log=9999 '--message=INTEGRATE: my integration message'\n"),
				Colors.cyan("» git checkout my_dev_branch\n"),
				Colors.cyan("» git merge my_integration_branch --ff-only\n"),
			]);
		});

		it("runs build with provided task name and options", async () => {
			const { build } = await integrateAsync({
				buildTasks: [ "task1", "task2" ],
				buildOptions: { myOptions: true },
			});

			assert.equal(build.taskNames, [ "task1", "task2" ], "build task names");
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


	describe("release", () => {

		it("updates version and pushes to origin", async () => {
			const { stdoutTracker } = await releaseAsync({
				level: "minor",
				otp: "my_otp",
			});

			assert.equal(stdoutTracker.data, [
				Colors.brightWhite.underline("\nSwitching to integration branch:\n"),
				Colors.cyan(`» git checkout ${INTEGRATION_BRANCH}\n`),

				Colors.brightWhite.underline("\nReleasing:\n"),
				Colors.cyan("» npm version minor\n"),
				Colors.cyan("» npm publish --otp=my_otp\n"),

				Colors.brightWhite.underline("\nMerging release into dev branch:\n"),
				Colors.cyan(`» git checkout ${DEV_BRANCH}\n`),
				Colors.cyan(`» git merge ${INTEGRATION_BRANCH}\n`),

				Colors.brightWhite.underline("\nPushing to GitHub:\n"),
				Colors.cyan("» git push --all\n"),
				Colors.cyan("» git push --tags\n"),
			]);
		});

		it("fails gracefully if npm publish fails", async () => {
			const { releasePromise, stdoutTracker } = release({
				level: "minor",
				otp: "my_otp",
				shellOptions: {
					"npm publish --otp=my_otp": { code: 127 },
				},
			});

			await assert.errorAsync(
				() => releasePromise,
				"npm publish failed, but everything else worked; run `npm publish` manually"
			);

			assert.equal(stdoutTracker.data, [
				Colors.brightWhite.underline("\nSwitching to integration branch:\n"),
				Colors.cyan(`» git checkout ${INTEGRATION_BRANCH}\n`),

				Colors.brightWhite.underline("\nReleasing:\n"),
				Colors.cyan("» npm version minor\n"),
				Colors.cyan("» npm publish --otp=my_otp\n"),

				Colors.brightWhite.underline("\nMerging release into dev branch:\n"),
				Colors.cyan(`» git checkout ${DEV_BRANCH}\n`),
				Colors.cyan(`» git merge ${INTEGRATION_BRANCH}\n`),

				Colors.brightWhite.underline("\nPushing to GitHub:\n"),
				Colors.cyan("» git push --all\n"),
				Colors.cyan("» git push --tags\n"),
			]);
		});

	});

});

async function integrateAsync({
	devBranch = DEV_BRANCH,
	integrationBranch = INTEGRATION_BRANCH,
	buildTasks = [ "irrelevant_build_task" ],
	buildOptions = { irrelevantBuildOptions: true },
	buildPasses = true,
	message = "irrelevant_integration_message",
	shellOptions,
} = {}) {
	ensure.signature(arguments, [[ undefined, {
		devBranch: [ undefined, String ],
		integrationBranch: [ undefined, String ],
		buildTasks: [ undefined, Array ],
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
		buildTasks,
		buildOptions,
		config,
		message,
	});

	return { stdoutTracker, build };
}

async function releaseAsync(options) {
	const { releasePromise, ...others } = release(options);

	await releasePromise;
	return others;
}

function release({
	level,
	otp,
	shellOptions,
} = {}) {
	ensure.signature(arguments, [[ undefined, {
		level: [ String ],
		otp: [ String ],
		shellOptions: [ undefined, Object ],
	}]]);

	const stdout = ConsoleOutput.createNull();
	const stdoutTracker = stdout.track();
	const shell = Shell.createNull(shellOptions);
	const repo = new Repo(shell, stdout);

	const config = {
		devBranch: DEV_BRANCH,
		integrationBranch: INTEGRATION_BRANCH,
	};

	const releasePromise = repo.releaseAsync({ level, config, otp });

	return { stdoutTracker, releasePromise };
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