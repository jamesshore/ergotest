// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { test, assert } from "tests";
import Repo from "./repo.js";
import Shell from "infrastructure/shell.js";

export default test(({ describe }) => {

	describe("integrate", ({ it }) => {

		it("merges dev directory into integration directory", async () => {
			const shell = Shell.createNull();
			const shellTracker = shell.track();
			const repo = new Repo(shell);

			const config = {
				devBranch: "my_dev_branch",
				integrationBranch: "my_integration_branch",
			};
			const message = "my integration message";

			await repo.integrateAsync({ config, message });

			assert.equal(shellTracker.data, [
				{ command: "git", args: [ "checkout", "my_integration_branch" ]},
				{ command: "git", args: [ "merge", "my_dev_branch", "--no-ff", "--log=9999", "--message=my integration message" ]},
				{ command: "git", args: [ "checkout", "my_dev_branch" ]},
				{ command: "git", args: [ "merge", "my_integration_branch", "--ff-only" ]},
			]);
		});

		it("fails gracefully if unable to check out integration branch");

		it("fails gracefully if unable to merge dev branch to integration");

		it("fails gracefully if unable to check out dev branch");

		it("fails gracefully if unable to merge integration branch to dev");

	});

});