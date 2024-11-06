// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import * as ensure from "util/ensure.js";
import Reporter from "tasks/reporter.js";
import TaskError from "tasks/task_error.js";
import FileSystem from "infrastructure/file_system.js";

export default class Version {

	static create(fileSystem) {
		ensure.signature(arguments, [ FileSystem ]);

		return new Version(fileSystem);
	}

	constructor(fileSystem) {
		this._fileSystem = fileSystem;
		this._checked = false;
	}

	async checkAsync({ expectedVersion, reporter }) {
		ensure.signature(arguments, [{
			expectedVersion: String,
			reporter: Reporter,
		}]);

		if (this._checked) return;
		await reporter.startAsync("Checking Node.js version", (report) => {
			const actualVersion = process.version;

			report.debug(`\n  Expected: ${expectedVersion}`);
			report.debug(`\n  Actual: ${actualVersion}`);

			if ("v" + expectedVersion !== actualVersion) {
				throw new TaskError(`Incorrect Node version. Expected ${expectedVersion}, but was ${actualVersion}.`);
			}
			this._checked = true;
		});
	}

}
