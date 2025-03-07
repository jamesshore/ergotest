// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import * as ensure from "util/ensure.js";
import Shell from "infrastructure/shell.js";
import ConsoleOutput from "infrastructure/console_output.js";
import Colors from "infrastructure/colors.js";
import TaskError from "tasks/task_error.js";

const CONFIG_TYPE = {
	devBranch: String,
	integrationBranch: String,
};

export default class Repo {

	static create() {
		ensure.signature(arguments, []);

		return new Repo(Shell.create(), ConsoleOutput.createStdout());
	}

	constructor(shell, stdout) {
		this._shell = shell;
		this._stdout = stdout;
	}

	async integrateAsync({ build, buildTasks, buildOptions, config, message }) {
		ensure.signature(arguments, [[ undefined, {
			build: Object,
			buildTasks: Array,
			buildOptions: Object,
			config: CONFIG_TYPE,
			message: String
		}]]);
		ensure.typeMinimum(build, { runAsync: Function }, "options.build");

		this.#writeHeadline("Validating build and creating distribution");
		try {
			await build.runAsync(buildTasks, buildOptions);
		}
		catch (err) {
			throw new TaskError(`Build error: ${err.message}`);
		}

		this.#writeHeadline("Checking for uncommitted changes");
		const { stdout } = await this.#execAsync("git", "status", "--porcelain");
		if (stdout.trim() !== "") throw new TaskError("Commit changes before integrating");

		this.#writeHeadline(`Integrating ${config.devBranch} into ${config.integrationBranch}`);
		await this.#execAsync("git", "checkout", config.integrationBranch);
		await this.#execAsync("git", "merge", config.devBranch, "--no-ff", "--log=9999", `--message=INTEGRATE: ${message}`);
		await this.#execAsync("git", "checkout", config.devBranch);
		await this.#execAsync("git", "merge", config.integrationBranch, "--ff-only");
	}

	async releaseAsync({ level, config, otp }) {
		ensure.signature(arguments, [[ undefined, {
			level: String,
			config: CONFIG_TYPE,
			otp: String,
		}]]);
		ensure.that(
			level === "patch" || level === "minor" || level === "major",
			`Release level must be 'patch', 'minor', or 'major', but it was: ${level}`,
		);

		this.#writeHeadline(`Switching to integration branch`);
		await this.#execAsync("git", "checkout", config.integrationBranch);

		this.#writeHeadline("Releasing");
		await this.#execAsync("npm", "version", level);
		try {
			await this.#execAsync("npm", "publish", `--otp=${otp}`);
		}
		catch (err) {
			throw new TaskError("npm publish failed, but everything else worked; run `npm publish` manually");
		}
		finally {
			this.#writeHeadline(`Merging release into dev branch`);
			await this.#execAsync("git", "checkout", config.devBranch);
			await this.#execAsync("git", "merge", config.integrationBranch);

			this.#writeHeadline(`Pushing to GitHub`);
			await this.#execAsync("git", "push", "--all");
			await this.#execAsync("git", "push", "--tags");
		}
	}

	#writeHeadline(message) {
		this._stdout.write(Colors.brightWhite.underline(`\n${message}:\n`));
	}

	async #execAsync(...command) {
		const render = command.map((element) => (element.includes(" ") ? `'${element}'` : element)).join(" ");

		this._stdout.write(Colors.cyan(`» ${render}\n`));

		const { code, stdout } = await this._shell.execAsync.apply(this._shell, command);
		if (code !== 0) throw new TaskError(`${command[0]} ${command[1]} failed`);

		return { stdout };
	}

}