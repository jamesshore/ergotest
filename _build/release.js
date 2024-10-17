// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import * as ensure from "util/ensure.js";
import Tasks from "tasks/tasks.js";
import TaskCli from "tasks/task_cli.js";
import FileSystem from "infrastructure/file_system.js";
import Paths from "./config/paths.js";
import ConsoleOutput from "infrastructure/console_output.js";

export default class Release {

	static create() {
		ensure.signature(arguments, []);

		return new Release();
	}

	constructor() {
		this._tasks = this.#defineTasks();
		this._tasks.setDescriptions({
			integrate: "Integrate to the main branch",
		});
	}

	async runCliAsync() {
		ensure.signature(arguments, []);

		return await TaskCli.create().runAsync(this._tasks, "SUCCESS", "FAILURE", async (taskNames, options) => {
			await this._tasks.runTasksAsync(taskNames, {});
		});
	}

	#defineTasks() {
		const fileSystem = FileSystem.create(Paths.rootDir, Paths.timestampsBuildDir);
		const tasks = Tasks.create({ fileSystem, incrementalDir: Paths.tasksDir });
		const stdout = ConsoleOutput.createStdout();

		tasks.defineTask("integrate", () => {
			console.log("TBD");
		});

		return tasks;
	}
}
