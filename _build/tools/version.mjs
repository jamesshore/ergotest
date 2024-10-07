// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import * as ensure from "util/ensure.mjs";
import Reporter from "tasks/reporter.mjs";
import TaskError from "tasks/task_error.mjs";
import FileSystem from "infrastructure/file_system.mjs";

export default class Version {

	static create(fileSystem) {
		ensure.signature(arguments, [ FileSystem ]);

		return new Version(fileSystem);
	}

	constructor(fileSystem) {
		this._fileSystem = fileSystem;
		this._checked = false;
	}

	async checkAsync({ packageJson, reporter }) {
		ensure.signature(arguments, [{
			packageJson: String,
			reporter: Reporter,
		}]);

		if (this._checked) return;
		await reporter.startAsync("Checking Node.js version", async () => {
			const json = await this._fileSystem.readTextFileAsync(packageJson);
			const expectedVersion = "v" + JSON.parse(json).engines.node;
			const actualVersion = process.version;

			if (expectedVersion !== actualVersion) {
				throw new TaskError(`Incorrect Node version. Expected ${expectedVersion}, but was ${actualVersion}.`);
			}
			this._checked = true;
		});
	}

};
