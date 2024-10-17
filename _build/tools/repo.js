// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import * as ensure from "util/ensure.js";
import Shell from "infrastructure/shell.js";

export default class Repo {

	static create() {
		ensure.signature(arguments, []);

		return new Repo(Shell.create());
	}

	constructor(shell) {
		this._shell = shell;
	}

	async integrateAsync({ config, message }) {
		ensure.signature(arguments, [[ undefined, {
			config: {
				devBranch: String,
				integrationBranch: String,
			},
			message: String
		}]]);

		await this._shell.execAsync("git", "checkout", config.integrationBranch);
		await this._shell.execAsync("git", "merge", config.devBranch, "--no-ff", "--log=9999", `--message=${message}`);
		await this._shell.execAsync("git", "checkout", config.devBranch);
		await this._shell.execAsync("git", "merge", config.integrationBranch, "--ff-only");
	}

}