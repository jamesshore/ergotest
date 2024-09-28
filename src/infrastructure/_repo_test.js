// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
"use strict";

const { suite, assert } = require("tests");
const Repo = require("./repo");
const Shell = require("./shell");
const Output = require("./console_output");

module.exports = suite(({ describe }) => {

	describe("standard behaviors", ({ it }) => {

		it("writes command to stdout", async () => {
			const { repo, stdout } = createRepo();
			await repo.checkoutBranchAsync("my_branch");

			assert.deepEqual(stdout, [ "» git checkout my_branch\n" ]);
		});

		it("pretty-prints arguments by quoting arguments with spaces and escaping quotes", async () => {
			const { repo, stdout } = createRepo();
			await repo.checkoutBranchAsync('something "quoted"');

			assert.deepEqual(stdout, [ '» git checkout "something \\"quoted\\""\n' ]);
		});

		it("throws exception if command doesn't exit with code zero", async() => {
			const { repo } = createRepo([{ code: 1 }]);
			await assert.exceptionAsync(
				() => repo.checkoutBranchAsync("irrelevant branch"),
				"git checkout failed",
			);
		});

	});


	describe("build command", ({ it }) => {

		it("runs the build", async () => {
			const { repo, shell } = createRepo();
			await repo.runBuildAsync();
			assertCommand(shell, "./build.sh");
		});

	});


	describe("git commands", ({ it }) => {

		it("knows when repo has uncommitted changes", async () => {
			const { repo, shell } = createRepo([{
				stdout: "arbitrary git output",     // git writes to stdout when there are uncommitted changes
			}, {
				stdout: "",                         // when we call a second time, there will be no uncommitted changes
			}]);

			assert.equal(await repo.hasUncommittedChangesAsync(), true, "should detect changes");
			assertCommand(shell, "git", "status", "--porcelain");

			assert.equal(await repo.hasUncommittedChangesAsync(), false, "should not detect changes");
		});

		it("checks out a branch", async () => {
			const { repo, shell } = createRepo();
			await repo.checkoutBranchAsync("my_branch");
			assertCommand(shell, "git", "checkout", "my_branch");
		});

		it("merges two branches with a commit", async () => {
			const { repo, shell } = createRepo();
			await repo.mergeBranchWithCommitAsync("from", "to", "my message");
			assertCommands(shell, [
				[ "git", "checkout", "to" ],
				[ "git", "merge", "from", "--no-ff", "--log=9999", "-m", "my message" ],
				[ "git", "checkout", "-"],    // checkout previous branch
				[ "git", "merge", "to", "--ff-only" ],
			]);
		});

		it("resets repository to freshly-checked-out state", async () => {
			const { repo, shell } = createRepo();
			await repo.resetToFreshCheckoutAsync("my_branch");
			assertCommands(shell, [
				[ "git", "reset", "--hard" ],
				[ "git", "clean", "-fdx" ],
				[ "git", "checkout", "my_branch" ],
			]);
		});

		it("tags the repository", async () => {
			const { repo, shell } = createRepo();
			await repo.tagCommitAsync("my_commit", "my_tag_name", "my_message");
			assertCommand(shell, "git", "tag", "-a", "my_tag_name", "-m", "my_message", "my_commit");
		});

	});


	describe("npm commands", ({ it }) => {

		it("rebuilds packages", async () => {
			const { repo, shell } = createRepo();
			await repo.rebuildNpmPackagesAsync();
			assertCommand(shell, "npm", "rebuild");
		});

		it("checks for known security issues", async () => {
			const { repo, shell } = createRepo([{
				code: 1,    // cause an error the first time we call 'npm audit'
			}, {
				code: 0,    // no error the second time
			}]);

			assert.equal(await repo.hasPackagesWithKnownSecurityFlawsAsync(), true, "audit should fail");
			assertCommand(shell, "npm", "audit");

			assert.equal(await repo.hasPackagesWithKnownSecurityFlawsAsync(), false, "audit should pass");
		});

	});

});

function assertCommand(shell, command, ...args) {
	assertCommands(shell, [[ command, ...args ]]);
}

function assertCommands(shell, commands) {
	const expected = commands.map(([ command, ...args ]) => ({ command, args }));
	assert.deepEqual(shell, expected);
}

function createRepo(shellOptions) {
	const shell = Shell.createNull(shellOptions);
	const stdout = Output.createNull();
	const stderr = Output.createNull();

	const repo = Repo.createNull({ shell, stdout, stderr });

	return {
		repo,
		shell: shell.track().data,
		stdout: stdout.track().data,
	};
}