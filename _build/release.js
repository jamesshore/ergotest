// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import * as ensure from "util/ensure.js";
import Tasks from "tasks/tasks.js";
import TaskCli from "tasks/task_cli.js";
import FileSystem from "infrastructure/file_system.js";
import Paths from "./config/paths.js";
import repoConfig from "./config/repo.conf.js";
import Repo from "./tools/repo.js";
import TaskError from "tasks/task_error.js";
import Build from "./build.js";

export default class Release {

	static create() {
		ensure.signature(arguments, []);

		return new Release();
	}

	constructor() {
		this._tasks = this.#defineTasks();
		this._tasks.setDescriptions({
			default: "Integrate to the main branch",
		});
	}

	async runCliAsync() {
		ensure.signature(arguments, []);

		return await TaskCli.create().runAsync(this._tasks, "SUCCESS", "FAILURE", async (taskNames, options) => {
			await this._tasks.runTasksAsync(taskNames, { args: options });
		});
	}

	#defineTasks() {
		const fileSystem = FileSystem.create(Paths.rootDir, Paths.timestampsBuildDir);
		const tasks = Tasks.create({ fileSystem, incrementalDir: Paths.tasksDir });
		const repo = Repo.create();
		const build = Build.create();

		tasks.defineTask("default", async (options) => {
			if (typeof options.args.message !== "string") {
				throw new TaskError("Need --message argument for integration message");
			}

			await repo.integrateAsync({
				build,
				buildTask: "default",
				buildOptions: { integrate: true },
				config: repoConfig,
				message: options.args.message,
			});
		});

		return tasks;
	}
}
