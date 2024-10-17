// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import * as ensure from "util/ensure.js";
import Shell from "infrastructure/shell.js";
import ConsoleOutput from "infrastructure/console_output.js";
import Colors from "infrastructure/colors.js";

export default class Repo {

	static create() {
		ensure.signature(arguments, []);

		return new Repo(Shell.createNull(), ConsoleOutput.createStdout());
	}

	constructor(shell, stdout, build) {
		this._shell = shell;
		this._stdout = stdout;
	}

	async integrateAsync({ build, buildTask, buildOptions, config, message }) {
		ensure.signature(arguments, [[ undefined, {
			build: Object,
			buildTask: String,
			buildOptions: Object,
			config: {
				devBranch: String,
				integrationBranch: String,
			},
			message: String
		}]]);
		ensure.typeMinimum(build, { runAsync: Function }, "options.build");

		this.#writeHeadline("Validating build");
		await build.runAsync([ buildTask ], buildOptions);

		this.#writeHeadline(`Integrating ${config.devBranch} into ${config.integrationBranch}`);
		await this.#execAsync("git", "checkout", config.integrationBranch);
		await this.#execAsync("git", "merge", config.devBranch, "--no-ff", "--log=9999", `--message=${message}`);
		await this.#execAsync("git", "checkout", config.devBranch);
		await this.#execAsync("git", "merge", config.integrationBranch, "--ff-only");
	}

	#writeHeadline(message) {
		this._stdout.write(Colors.brightWhite.underline(`\n${message}:\n`));
	}

	#execAsync(...command) {
		const render = command.map((element) => (element.includes(" ") ? `'${element}'` : element)).join(" ");

		this._stdout.write(Colors.cyan(`» ${render}\n`));
		this._shell.execAsync.apply(this._shell, command);
	}

}